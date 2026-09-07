//! Playback source: turns a track id into the file the webview should ask for.
//!
//! Nothing is granted here. The commands resolve a path and check it is playable, and the
//! `track:` scheme in [`crate::protocol`] checks it again for itself when the bytes are
//! actually requested — so a track that leaves the library stops being readable at once,
//! instead of at the next restart.

use std::path::{Path, PathBuf};

use tauri::State;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::library::{self, Library, Track, TrackView};
use crate::metadata;
use crate::state::{LibraryState, StartupFile};

/// Path of a track that can actually be played, refusing entries whose file is gone.
///
/// The `track:` scheme is the one thing that hands the webview the raw bytes of something
/// on disk, so what it is pointed at has to be an audio file this app knows — being listed
/// in the library is not on its own enough.
pub fn playable_path(library: &Library, id: &str) -> AppResult<PathBuf> {
    let path = library::path_of(library, id).ok_or_else(|| AppError::NotFound(id.to_owned()))?;

    metadata::ensure_importable(&path)?;

    Ok(path)
}

fn playable_file_path(path: &Path) -> AppResult<PathBuf> {
    metadata::ensure_importable(path)?;

    Ok(path.to_path_buf())
}

fn standalone_track(path: &Path) -> AppResult<TrackView> {
    let metadata = metadata::read_metadata(path)?;
    let track = Track::new(path, metadata, library::now_seconds());

    Ok(TrackView {
        track,
        missing: false,
    })
}

/// Where to read a track from, and how loud to read it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSource {
    pub path: String,
    /// The correction the file asks for, in decibels. Absent when it asks for none.
    pub gain_db: Option<f32>,
}

fn source_of(path: &Path) -> PlaybackSource {
    PlaybackSource {
        path: path.to_string_lossy().into_owned(),
        // A file that cannot be read for its loudness is simply played as it is.
        gain_db: metadata::read_track_gain(path).ok().flatten(),
    }
}

/// Resolves one track to the file the webview should ask the `track:` scheme for.
#[tauri::command]
pub fn prepare_playback(state: State<'_, LibraryState>, id: String) -> AppResult<PlaybackSource> {
    let path = state.read(|library| playable_path(library, &id))??;

    Ok(source_of(&path))
}

/// Reads the audio file passed by the operating system when this app is opened as
/// the default player.
#[tauri::command]
pub fn startup_audio_file(startup: State<'_, StartupFile>) -> AppResult<Option<TrackView>> {
    let Some(path) = startup.path() else {
        return Ok(None);
    };

    standalone_track(&path).map(Some)
}

/// Resolves the file the app was opened with.
///
/// It takes no path: the only file outside the library the app ever plays is the one the
/// system handed it, and that one is known here.
#[tauri::command]
pub fn prepare_external_playback(startup: State<'_, StartupFile>) -> AppResult<PlaybackSource> {
    let path = startup
        .path()
        .ok_or_else(|| AppError::NotFound("no file was passed to the application".to_owned()))?;
    let path = playable_file_path(&path)?;

    Ok(source_of(&path))
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/commands/playback.rs");
}
