//! On-disk cache for extracted cover art.
//!
//! Pulling a picture out of an audio file means parsing the whole tag, which is too
//! slow to repeat for every scroll. Entries are keyed by file path *and* modification
//! time, so a file edited outside the app is never served stale.
//!
//! Cache failures are never fatal: on any problem the cover is read straight from the
//! audio file, which is exactly what the cache is there to avoid, not to replace.

use std::fs::FileTimes;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine as _;

use crate::error::AppResult;
use crate::hash::fnv1a_hex;
use crate::library::canonical_key;
use crate::metadata::{read_cover, Cover, CoverRead, JPEG_MIME, PNG_MIME};

/// Marks a file already known to carry no cover, so it is not parsed again.
const EMPTY_EXTENSION: &str = "none";

/// Marks a file whose picture was found too heavy to read. The entry holds its size, so
/// the answer given to the interface survives without opening the audio file again.
const OVERSIZED_EXTENSION: &str = "big";

/// How large the cache is allowed to get before the least recently used entries go.
///
/// Room for some thousands of covers, which is more than a library of any ordinary size
/// asks for, and small enough that the folder never becomes something the user finds by
/// wondering where their disk went.
pub const MAX_CACHE_BYTES: u64 = 256 * 1024 * 1024;

/// How much has to be written before the size is checked again.
///
/// Measuring the folder means reading all of it, which is not something to do once per
/// cover while a library is being scrolled through for the first time. Counting the bytes
/// written and looking only every so often costs the same in the end.
const SWEEP_AFTER_BYTES: u64 = 16 * 1024 * 1024;

/// What the cache is brought down to once it goes over the limit.
const EVICTION_TARGET_BYTES: u64 = MAX_CACHE_BYTES / 5 * 4;

/// How stale an entry's timestamp has to be before serving it writes a fresher one.
///
/// The timestamp is what tells the eviction which entries are still in use, so it has to
/// move — but not on every hit, or scrolling a library would rewrite the whole folder.
const TOUCH_AFTER: u64 = 60 * 60;

/// What the cache holds for one file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CoverEntry {
    /// The picture, as a file on disk that can be served as it is.
    Image(PathBuf),
    /// The file carries no cover, or one in a format this app does not read.
    Missing,
    /// The picture was left where it is, being too heavy to read.
    TooLarge(u64),
}

pub struct CoverCache {
    directory: PathBuf,
    /// Bytes stored since the last time the size was checked.
    written: AtomicU64,
}

fn extension_for(mime_type: &str) -> Option<&'static str> {
    match mime_type {
        PNG_MIME => Some("png"),
        JPEG_MIME => Some("jpg"),
        _ => None,
    }
}

fn mime_for(extension: &str) -> Option<&'static str> {
    match extension {
        "png" => Some(PNG_MIME),
        "jpg" => Some(JPEG_MIME),
        _ => None,
    }
}

/// When a file was last written, in whole seconds. Used to weigh the age of a cache
/// entry, which is a matter of hours: see [`TOUCH_AFTER`].
fn modified_seconds(path: &Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |elapsed| elapsed.as_secs())
}

/// When the file was last written, counted finely enough to tell two edits apart.
///
/// Seconds are not: a picture chosen and saved lands well inside the same one as the
/// picture it replaces, and an entry keyed by the second it happened in is an entry that
/// answers for both. What a file system will report here varies — NTFS keeps far more than
/// this needs, a FAT volume keeps less than a second — which is why this is not the only
/// thing that retires an entry. See [`CoverCache::forget`].
fn modified_stamp(path: &Path) -> u128 {
    std::fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |elapsed| elapsed.as_nanos())
}

/// Marks an entry as still in use, so the eviction can tell it from dead weight.
///
/// Last-access times are no help here — Windows stops updating them by default — so the
/// cache keeps its own record: the modification time of the entry, which nothing but this
/// writes. It is only rewritten once the old one has gone stale, or scrolling through a
/// library would mean rewriting the whole folder.
fn touch(path: &Path) {
    let Ok(modified) = std::fs::metadata(path).and_then(|metadata| metadata.modified()) else {
        return;
    };

    let still_fresh = SystemTime::now()
        .duration_since(modified)
        .is_ok_and(|age| age.as_secs() < TOUCH_AFTER);

    if still_fresh {
        return;
    }

    let Ok(file) = std::fs::File::options().write(true).open(path) else {
        return;
    };

    let _ = file.set_times(FileTimes::new().set_modified(SystemTime::now()));
}

impl CoverCache {
    pub fn new(directory: PathBuf) -> Self {
        Self {
            directory,
            written: AtomicU64::new(0),
        }
    }

    pub fn directory(&self) -> &Path {
        &self.directory
    }

    /// Stable prefix of every entry belonging to `path`, regardless of its content.
    fn track_prefix(path: &Path) -> String {
        fnv1a_hex(&canonical_key(path))
    }

    /// Entry name for the file as it is right now: a new modification time means a new key.
    ///
    /// The mark carried in the middle retires every entry written before it: `v2` came in
    /// when covers began to be checked for their dimensions, and entries from before that
    /// had never been. Entries from before the stamp grew finer than a second are retired
    /// by the stamp itself, which no longer has the shape they were written with.
    pub fn entry_key(path: &Path) -> String {
        format!("{}-v2-{}", Self::track_prefix(path), modified_stamp(path))
    }

    /// Throws away everything the cache holds about one file.
    ///
    /// Called where this app is the one that rewrote it. A key made from a timestamp can
    /// only promise to notice a change the file system bothered to record, and on a coarse
    /// volume two edits a moment apart are recorded as the same moment — so where the
    /// change is ours to know about, it is not guessed at.
    pub fn forget(&self, path: &Path) {
        let prefix = Self::track_prefix(path);

        let Ok(entries) = std::fs::read_dir(&self.directory) else {
            return;
        };

        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().starts_with(&prefix) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }

    fn cached(&self, key: &str) -> Option<CoverRead> {
        let empty = self.directory.join(format!("{key}.{EMPTY_EXTENSION}"));

        if empty.is_file() {
            touch(&empty);

            return Some(CoverRead::default());
        }

        let oversized = self.directory.join(format!("{key}.{OVERSIZED_EXTENSION}"));

        if let Ok(recorded) = std::fs::read_to_string(&oversized) {
            touch(&oversized);

            return Some(CoverRead {
                cover: None,
                too_large_bytes: recorded.trim().parse().ok(),
            });
        }

        for extension in ["png", "jpg"] {
            let candidate = self.directory.join(format!("{key}.{extension}"));

            if let Ok(bytes) = std::fs::read(&candidate) {
                touch(&candidate);

                return Some(CoverRead::found(Cover {
                    mime_type: mime_for(extension).unwrap_or(PNG_MIME).to_owned(),
                    data: base64::engine::general_purpose::STANDARD.encode(bytes),
                }));
            }
        }

        None
    }

    /// Drops the entries left over from previous versions of the same file.
    fn forget_older_entries(&self, path: &Path, current_key: &str) {
        let prefix = Self::track_prefix(path);

        let Ok(entries) = std::fs::read_dir(&self.directory) else {
            return;
        };

        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with(&prefix) && !name.starts_with(current_key) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }

    #[cfg(test)]
    fn store_read(&self, key: &str, path: &Path, read: &CoverRead) {
        self.store(key, path, read);
    }

    fn store(&self, key: &str, path: &Path, read: &CoverRead) {
        if std::fs::create_dir_all(&self.directory).is_err() {
            return;
        }

        let stored = match read.cover.as_ref() {
            None => {
                let (extension, contents) = match read.too_large_bytes {
                    Some(bytes) => (OVERSIZED_EXTENSION, bytes.to_string()),
                    None => (EMPTY_EXTENSION, String::new()),
                };

                std::fs::write(self.directory.join(format!("{key}.{extension}")), contents)
                    .map(|()| 0)
            }
            Some(cover) => {
                let Some(extension) = extension_for(&cover.mime_type) else {
                    return;
                };
                let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(&cover.data)
                else {
                    return;
                };
                let written = bytes.len() as u64;

                std::fs::write(self.directory.join(format!("{key}.{extension}")), bytes)
                    .map(|()| written)
            }
        };

        if let Ok(written) = stored {
            self.forget_older_entries(path, key);
            self.evict_if_enough_was_written(written);
        }
    }

    /// Counts what was just stored and checks the size once enough has piled up.
    fn evict_if_enough_was_written(&self, written: u64) {
        let before = self.written.fetch_add(written, Ordering::Relaxed);

        if before + written < SWEEP_AFTER_BYTES {
            return;
        }

        self.written.store(0, Ordering::Relaxed);
        self.evict_to_fit();
    }

    /// Every entry of the cache, with its weight and the last time it was served.
    fn entries(&self) -> Vec<(PathBuf, u64, u64)> {
        let Ok(entries) = std::fs::read_dir(&self.directory) else {
            return Vec::new();
        };

        entries
            .flatten()
            .filter_map(|entry| {
                let path = entry.path();
                let metadata = entry.metadata().ok()?;

                if !metadata.is_file() {
                    return None;
                }

                Some((path.clone(), metadata.len(), modified_seconds(&path)))
            })
            .collect()
    }

    /// How much room the cache is taking on disk, in bytes.
    pub fn size_bytes(&self) -> u64 {
        self.entries().iter().map(|(_, size, _)| size).sum()
    }

    /// Drops the entries served longest ago until the cache fits again, and says how many
    /// went.
    ///
    /// It clears down to below the limit rather than exactly to it, so the next cover
    /// stored does not start the whole walk over again.
    pub fn evict_to_fit(&self) -> usize {
        self.evict_down_to(MAX_CACHE_BYTES, EVICTION_TARGET_BYTES)
    }

    /// The eviction itself, with the two sizes named out loud so a test can choose them.
    fn evict_down_to(&self, limit: u64, target: u64) -> usize {
        let mut entries = self.entries();
        let mut total: u64 = entries.iter().map(|(_, size, _)| size).sum();

        if total <= limit {
            return 0;
        }

        // Oldest first: the covers nothing has asked for in the longest time.
        entries.sort_by_key(|(_, _, last_used)| *last_used);

        let mut removed = 0;

        for (path, size, _) in entries {
            if total <= target {
                break;
            }

            if std::fs::remove_file(&path).is_ok() {
                total = total.saturating_sub(size);
                removed += 1;
            }
        }

        removed
    }

    /// What the cache holds for `path`, without reading any of it.
    ///
    /// Only names are looked at, so answering costs a handful of `stat` calls whatever the
    /// picture weighs.
    fn stored_entry(&self, key: &str) -> Option<CoverEntry> {
        let empty = self.directory.join(format!("{key}.{EMPTY_EXTENSION}"));

        if empty.is_file() {
            touch(&empty);

            return Some(CoverEntry::Missing);
        }

        let oversized = self.directory.join(format!("{key}.{OVERSIZED_EXTENSION}"));

        if let Ok(recorded) = std::fs::read_to_string(&oversized) {
            touch(&oversized);

            return Some(CoverEntry::TooLarge(recorded.trim().parse().unwrap_or(0)));
        }

        for extension in ["png", "jpg"] {
            let candidate = self.directory.join(format!("{key}.{extension}"));

            if candidate.is_file() {
                touch(&candidate);

                return Some(CoverEntry::Image(candidate));
            }
        }

        None
    }

    /// The cover of `path` as a file, extracted from the audio only when the cache is
    /// empty of it.
    ///
    /// This is what serves the pictures: nothing is decoded, encoded or copied into memory
    /// on the way, the webview is simply pointed at a file it can read.
    pub fn entry(&self, path: &Path) -> AppResult<CoverEntry> {
        let key = Self::entry_key(path);

        if let Some(entry) = self.stored_entry(&key) {
            return Ok(entry);
        }

        let read = read_cover(path)?;
        self.store(&key, path, &read);

        Ok(self.stored_entry(&key).unwrap_or(CoverEntry::Missing))
    }

    /// Returns the cover of `path`, reading the audio file only on a cache miss.
    pub fn load(&self, path: &Path) -> AppResult<CoverRead> {
        let key = Self::entry_key(path);

        if let Some(hit) = self.cached(&key) {
            return Ok(hit);
        }

        let read = read_cover(path)?;
        self.store(&key, path, &read);

        Ok(read)
    }

    /// Empties the cache. Used when the user asks for a clean slate.
    pub fn clear(&self) -> AppResult<()> {
        self.written.store(0, Ordering::Relaxed);

        if !self.directory.exists() {
            return Ok(());
        }

        for entry in std::fs::read_dir(&self.directory)?.flatten() {
            let _ = std::fs::remove_file(entry.path());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/metadata/cover_cache.rs");
}
