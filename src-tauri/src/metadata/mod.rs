//! Reading of audio tags and cover art.
//!
//! Every supported format goes through `lofty`, so adding one is a matter of
//! listing its extension in [`SUPPORTED_EXTENSIONS`].

pub mod cover_cache;
mod image_bounds;
pub use image_bounds::within_image_bounds;
pub mod write;
pub mod rename;

pub use cover_cache::{CoverCache, CoverEntry, MAX_CACHE_BYTES};
pub use write::{write_cover, write_metadata, MetadataUpdate};

use std::path::Path;

use base64::Engine as _;
use lofty::prelude::{Accessor, AudioFile, ItemKey, TaggedFileExt};
use lofty::tag::Tag;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

pub const SUPPORTED_EXTENSIONS: [&str; 5] = ["mp3", "flac", "m4a", "ogg", "wav"];

/// Tags read from an audio file, exactly as stored: no fallback is applied here.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub duration_ms: u64,
    pub format: String,
    pub has_cover: bool,
}

/// The image types this app reads and writes. Anything else in a tag is left alone.
pub const PNG_MIME: &str = "image/png";
pub const JPEG_MIME: &str = "image/jpeg";

/// How large an embedded picture may be before it is left where it is.
///
/// Reading one means holding it in memory, encoding it to base64 (half again as large),
/// pushing it across to the webview and writing it to the cache. A tag can carry a picture
/// of any size at all, and a file is not something this app gets to choose.
pub const MAX_EMBEDDED_COVER_BYTES: usize = 16 * 1024 * 1024;

/// Cover art encoded for the webview, ready to be used in a `data:` URL.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cover {
    pub mime_type: String,
    pub data: String,
}

/// Library artwork is untrusted too; check it once when loading the library.
pub fn valid_stored_cover(cover: &Cover) -> bool {
    if cover.data.len() > MAX_EMBEDDED_COVER_BYTES.div_ceil(3) * 4 {
        return false;
    }
    let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(&cover.data) else {
        return false;
    };
    bytes.len() <= MAX_EMBEDDED_COVER_BYTES
        && image_mime(&bytes) == Some(cover.mime_type.as_str())
        && within_image_bounds(&bytes)
}

/// What looking for the cover of a file found.
///
/// A missing cover and a cover too heavy to read look the same to the interface — no
/// picture to show — but they are not the same thing to the user, who can do something
/// about the second. So the weight travels back with the answer.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverRead {
    pub cover: Option<Cover>,
    /// Size of the picture that was left alone, when one was.
    pub too_large_bytes: Option<u64>,
}

impl CoverRead {
    pub fn found(cover: Cover) -> Self {
        Self {
            cover: Some(cover),
            too_large_bytes: None,
        }
    }

    /// The picture that was found, when one was small enough and readable.
    pub fn into_cover(self) -> Option<Cover> {
        self.cover
    }

    pub fn too_large(bytes: usize) -> Self {
        Self {
            cover: None,
            too_large_bytes: Some(bytes as u64),
        }
    }
}

/// The loudness adjustment a file carries, in decibels, if it carries one.
///
/// Records made twenty years apart are mastered at wildly different levels, and a library
/// plays them one after another. Many files already say by how much they should be turned
/// down — ReplayGain, written by whatever ripped or tagged them — and this reads that
/// number. Nothing is written and nothing is measured: a file that does not say gets left
/// exactly as loud as it is.
pub fn read_track_gain(path: &Path) -> AppResult<Option<f32>> {
    let tagged_file = read_tagged_file(path)?;

    let gain = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag())
        .and_then(|tag| tag.get_string(ItemKey::ReplayGainTrackGain))
        .and_then(parse_gain_db);

    Ok(gain)
}

/// Reads "-7.35 dB", and the handful of ways the same number gets written.
fn parse_gain_db(value: &str) -> Option<f32> {
    let cleaned = value
        .trim()
        .trim_end_matches("dB")
        .trim_end_matches("DB")
        .trim();
    let gain: f32 = cleaned.trim().parse().ok()?;

    // A file claiming to need sixty decibels of correction is a file with a broken tag.
    if !gain.is_finite() || gain.abs() > 60.0 {
        return None;
    }

    Some(gain)
}

/// Lowercase extension without the dot, empty when the path has none.
pub fn extension_of(path: &Path) -> String {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_lowercase)
        .unwrap_or_default()
}

pub fn is_supported(path: &Path) -> bool {
    SUPPORTED_EXTENSIONS.contains(&extension_of(path).as_str())
}

/// Rejects paths that cannot be imported before any parsing is attempted.
pub fn ensure_importable(path: &Path) -> AppResult<()> {
    if !path.is_file() {
        return Err(AppError::NotFound(path.display().to_string()));
    }

    if !is_supported(path) {
        return Err(AppError::UnsupportedFormat(extension_of(path)));
    }

    Ok(())
}

/// Reads the release year from the timestamp field, falling back to the plain year item.
fn year_of(tag: &Tag) -> Option<u32> {
    if let Some(timestamp) = tag.date() {
        return Some(u32::from(timestamp.year));
    }

    tag.get_string(ItemKey::Year)
        .or_else(|| tag.get_string(ItemKey::RecordingDate))
        .and_then(|value| value.get(..4).unwrap_or(value).parse().ok())
}

pub(crate) fn read_tagged_file(path: &Path) -> AppResult<lofty::file::TaggedFile> {
    ensure_importable(path)?;

    lofty::read_from_path(path).map_err(|error| AppError::InvalidAudio(error.to_string()))
}

pub fn read_metadata(path: &Path) -> AppResult<TrackMetadata> {
    let tagged_file = read_tagged_file(path)?;
    let duration_ms = u64::try_from(tagged_file.properties().duration().as_millis()).unwrap_or(0);
    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());

    let Some(tag) = tag else {
        return Ok(TrackMetadata {
            duration_ms,
            format: extension_of(path),
            ..TrackMetadata::default()
        });
    };

    Ok(TrackMetadata {
        title: tag.title().map(|value| value.to_string()),
        artist: tag.artist().map(|value| value.to_string()),
        album: tag.album().map(|value| value.to_string()),
        year: year_of(tag),
        genre: tag.genre().map(|value| value.to_string()),
        duration_ms,
        format: extension_of(path),
        has_cover: !tag.pictures().is_empty(),
    })
}

pub fn read_cover(path: &Path) -> AppResult<CoverRead> {
    read_cover_within(path, MAX_EMBEDDED_COVER_BYTES)
}

/// The reading itself, with the weight it refuses given as an argument.
fn read_cover_within(path: &Path, max_bytes: usize) -> AppResult<CoverRead> {
    let tagged_file = read_tagged_file(path)?;

    let picture = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag())
        .and_then(|tag| tag.pictures().first());

    let Some(picture) = picture else {
        return Ok(CoverRead::default());
    };

    let bytes = picture.data();

    if bytes.len() > max_bytes {
        return Ok(CoverRead::too_large(bytes.len()));
    }

    // The type written in the tag is whatever whoever made the file decided to write; the
    // first bytes of the picture are the picture itself.
    let Some(mime_type) = image_mime(bytes) else {
        return Ok(CoverRead::default());
    };
    if !within_image_bounds(bytes) {
        return Ok(CoverRead::default());
    }

    Ok(CoverRead::found(Cover {
        mime_type: mime_type.to_owned(),
        data: base64::engine::general_purpose::STANDARD.encode(bytes),
    }))
}

/// The image type the bytes themselves say they are, for the two types this app handles.
pub fn image_mime(bytes: &[u8]) -> Option<&'static str> {
    const PNG_SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    const JPEG_SIGNATURE: [u8; 3] = [0xFF, 0xD8, 0xFF];

    if bytes.starts_with(&PNG_SIGNATURE) {
        return Some(PNG_MIME);
    }

    if bytes.starts_with(&JPEG_SIGNATURE) {
        return Some(JPEG_MIME);
    }

    None
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/metadata/mod.rs");
}
