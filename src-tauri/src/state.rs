//! Shared library state, guarded by a mutex and mirrored on disk.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use crate::error::{AppError, AppResult};
use crate::library::Library;

/// The audio file the operating system passed on the command line, if it passed one.
///
/// Read once, when the app starts, and kept here: the commands that act on it answer for
/// themselves instead of trusting a path handed over by the interface.
#[derive(Debug, Default)]
pub struct StartupFile(Mutex<Option<PathBuf>>);

impl StartupFile {
    /// The first playable file among the arguments the app was started with.
    pub fn from_arguments<I: IntoIterator<Item = PathBuf>>(arguments: I) -> Self {
        Self(Mutex::new(find_playable_argument(arguments)))
    }

    /// Replaces the file handed to the running app by a later invocation.
    ///
    /// The single-instance plugin gives the first process the arguments of the process it
    /// closes. Keeping the path here lets the frontend request its metadata through the same
    /// trusted command used for the first launch.
    pub fn replace_from_arguments<I: IntoIterator<Item = PathBuf>>(&self, arguments: I) -> bool {
        let Some(path) = find_playable_argument(arguments) else {
            return false;
        };

        let Ok(mut current) = self.0.lock() else {
            return false;
        };

        *current = Some(path);
        true
    }

    pub fn path(&self) -> Option<PathBuf> {
        self.0.lock().ok().and_then(|path| path.clone())
    }
}

fn find_playable_argument<I: IntoIterator<Item = PathBuf>>(arguments: I) -> Option<PathBuf> {
    arguments
        .into_iter()
        .find(|path| path.is_file() && crate::metadata::is_supported(path))
}

/// The library in memory together with the file it belongs to: switching library swaps
/// both at once, so a save can never land in the file of another library.
struct Active {
    file: PathBuf,
    library: Library,
    /// Canonical key of every file of the library, built when it is first asked for and
    /// thrown away whenever the library changes.
    keys: Option<HashSet<String>>,
    /// Whether a change is held in memory that the file does not have yet.
    unsaved: bool,
}

impl Active {
    fn new(file: PathBuf, library: Library) -> Self {
        Self {
            file,
            library,
            keys: None,
            unsaved: false,
        }
    }

    /// The set of files the library holds, built once and kept until something moves.
    ///
    /// Building it canonicalises every path, which is a call to the filesystem each — the
    /// reason this is not done per question. The questions come from the audio scheme and
    /// from the cover reader, both of which ask again for every request they serve.
    fn keys(&mut self) -> &HashSet<String> {
        self.keys.get_or_insert_with(|| {
            self.library
                .tracks()
                .iter()
                .map(|track| crate::library::canonical_key(Path::new(&track.path)))
                .collect()
        })
    }
}

pub struct LibraryState {
    active: Mutex<Active>,
}

impl LibraryState {
    pub fn new(file: PathBuf, library: Library) -> Self {
        Self {
            active: Mutex::new(Active::new(file, library)),
        }
    }

    /// Whether the library holds this file, by one canonicalisation instead of one per
    /// track.
    pub fn holds_file(&self, path: &Path) -> AppResult<bool> {
        let key = crate::library::canonical_key(path);
        let mut active = self.lock()?;

        Ok(active.keys().contains(&key))
    }

    /// Loads the library from `file`, starting empty when it cannot be read.
    ///
    /// Every app opening reconciles the saved list with the files on disk: ids are
    /// realigned to canonical paths and duplicate entries are removed. Re-reading the tags
    /// costs one file read per track, so it is left to the refresh the frontend asks for
    /// once the library is on screen.
    pub fn from_file(file: PathBuf) -> Self {
        let library = load_or_empty(&file);
        let state = Self::new(file, library);
        state.maintain_from_disk();

        state
    }

    pub fn file(&self) -> AppResult<PathBuf> {
        Ok(self.lock()?.file.clone())
    }

    fn lock(&self) -> AppResult<MutexGuard<'_, Active>> {
        self.active
            .lock()
            .map_err(|error| AppError::State(error.to_string()))
    }

    pub fn read<T>(&self, action: impl FnOnce(&Library) -> T) -> AppResult<T> {
        Ok(action(&self.lock()?.library))
    }

    pub fn rename_track(&self, id: &str, filename: &str) -> AppResult<crate::library::Track> {
        use crate::{library, metadata::rename};
        let mut active = self.lock()?;
        let source = library::path_of(&active.library, id)
            .ok_or_else(|| AppError::NotFound("track is not in the library".into()))?;
        let target = rename::destination(&source, filename)?;
        if source == target {
            return active.library.get(id).cloned().ok_or_else(|| AppError::NotFound(id.into()));
        }
        let previous = active.library.clone();
        rename::move_file(&source, &target)?;
        let updated = library::relocate_track(&mut active.library, id, &target)
            .ok_or_else(|| AppError::NotFound(id.into()))?;
        active.keys = None;
        if let Err(error) = active.library.save(&active.file) {
            if let Err(rollback) = rename::move_file(&target, &source) {
                active.unsaved = true;
                return Err(AppError::State(format!("{error}; rename rollback failed: {rollback}")));
            }
            active.library = previous;
            return Err(error);
        }
        active.unsaved = false;
        Ok(updated)
    }

    /// Applies a change and writes the library back to disk before returning.
    pub fn update<T>(&self, action: impl FnOnce(&mut Library) -> T) -> AppResult<T> {
        let mut active = self.lock()?;
        let outcome = action(&mut active.library);
        // Whatever just changed may have been a path: the set is built again next time it
        // is asked for rather than patched here, which no caller can forget to do.
        active.keys = None;
        active.library.save(&active.file)?;
        active.unsaved = false;

        Ok(outcome)
    }

    /// Applies a change that only mirrors what the file on disk already says.
    ///
    /// Nothing is written: re-reading the tags of a track happens every time it is played,
    /// and writing the whole library back each time means rewriting megabytes to record
    /// something the file itself already knows. If the app closes before this is stored,
    /// the next play reads it again — which is the difference between this and [`Self::update`],
    /// where what changed came from the user and cannot be worked out a second time.
    pub fn update_derived<T>(&self, action: impl FnOnce(&mut Library) -> T) -> AppResult<T> {
        let mut active = self.lock()?;
        let outcome = action(&mut active.library);
        active.keys = None;
        active.unsaved = true;

        Ok(outcome)
    }

    /// Writes down what the derived changes have left pending, if anything.
    pub fn flush(&self) -> AppResult<()> {
        let mut active = self.lock()?;

        if !active.unsaved {
            return Ok(());
        }

        active.library.save(&active.file)?;
        active.unsaved = false;

        Ok(())
    }

    /// Loads another library file and makes it the current one.
    ///
    /// The library left behind needs no flush: every change is already written when it
    /// happens.
    pub fn switch_to(&self, file: PathBuf) -> AppResult<()> {
        // What the library being left behind has pending goes to its own file, not to the
        // one about to take its place.
        self.flush()?;

        let library = load_or_empty(&file);

        {
            let mut active = self.lock()?;
            active.file = file;
            active.library = library;
            active.keys = None;
            active.unsaved = false;
        }

        self.maintain_from_disk();

        Ok(())
    }

    fn maintain_from_disk(&self) {
        match self.update(crate::library::maintain_paths) {
            Ok(report) => {
                if report != crate::library::LibraryMaintenanceReport::default() {
                    eprintln!(
                        "library reconciled with the disk: {} duplicate entries removed, {} ids realigned",
                        report.deduplicated, report.ids_updated,
                    );
                }
            }
            Err(error) => eprintln!("library refresh failed: {error}"),
        }
    }
}

fn load_or_empty(file: &Path) -> Library {
    Library::load(file).unwrap_or_else(|error| {
        eprintln!("library not loaded ({error}), starting from an empty one");
        Library::new()
    })
}

#[cfg(test)]
mod tests {
    include!("../../tests/backend/state.rs");
}
