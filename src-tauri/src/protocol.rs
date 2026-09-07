//! The scheme the webview reads audio through.
//!
//! The alternative is Tauri's asset protocol, which decides from a list of paths granted
//! ahead of time. A grant on that list cannot be taken back — forbidding a path there wins
//! over every later grant and never expires — so a file played once stayed readable for the
//! rest of the session, whatever happened to the library afterwards.
//!
//! Here nothing is granted. Every request names a file, and every request is answered by
//! asking the library, at that moment, whether the file is one of its own. A track removed
//! a second ago stops being readable a second ago.

use std::fs::File;
use std::io::{Read as _, Seek as _, SeekFrom};
use std::path::{Path, PathBuf};

use tauri::http::{header, Method, Request, Response, StatusCode};

use crate::library;
use crate::metadata;
use crate::state::{LibraryState, StartupFile};

/// Name of the scheme. The webview reaches it as `track://localhost/<path>` on Linux and
/// `http://track.localhost/<path>` on Windows; `convertFileSrc` writes the right one.
pub const SCHEME: &str = "track";

/// The pictures travel the same way as the audio: as files the webview fetches and caches
/// for itself, rather than as base64 pushed across the bridge and held in memory.
pub const COVER_SCHEME: &str = "cover";

/// Most a single response carries, so a seek in a long file does not pull all of it into
/// memory. The webview asks for the next piece when it wants it.
const MAX_RANGE_BYTES: u64 = 1024 * 1024;
// Media elements use byte ranges. A whole-file fallback must not allocate gigabytes.
const MAX_FULL_RESPONSE_BYTES: u64 = 32 * 1024 * 1024;

pub fn is_app_origin(url: &tauri::Url) -> bool {
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    let origin = (url.scheme(), url.host_str(), url.port());
    matches!(
        origin,
        ("tauri", Some("localhost"), None) | ("http" | "https", Some("tauri.localhost"), None)
    ) || (cfg!(debug_assertions)
        && matches!(
            origin,
            ("http", Some("localhost" | "127.0.0.1"), Some(1420))
        ))
}

/// Content type of a file, from the extension the library already sorted by.
fn content_type(path: &Path) -> &'static str {
    match metadata::extension_of(path).as_str() {
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        "m4a" => "audio/mp4",
        "ogg" => "audio/ogg",
        "wav" => "audio/wav",
        "png" => "image/png",
        "jpg" => "image/jpeg",
        _ => "application/octet-stream",
    }
}

/// The file a request is asking for.
pub fn requested_path(request: &Request<Vec<u8>>) -> PathBuf {
    let path = request.uri().path();
    // Every path arrives with the leading slash of the URL, which is not part of it.
    let path = path.strip_prefix('/').unwrap_or(path);

    PathBuf::from(
        percent_encoding::percent_decode(path.as_bytes())
            .decode_utf8_lossy()
            .as_ref(),
    )
}

/// Whether a file is one this app is holding right now.
///
/// The same question `ensure_known_file` asks before reading tags, asked again here because
/// this is where the bytes themselves go out.
pub fn is_playable_now(state: &LibraryState, startup: &StartupFile, path: &Path) -> bool {
    if !metadata::is_supported(path) {
        return false;
    }

    if state.holds_file(path).unwrap_or(false) {
        return true;
    }

    startup
        .path()
        .is_some_and(|startup| library::canonical_key(&startup) == library::canonical_key(path))
}

fn empty(status: StatusCode) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .body(Vec::new())
        .expect("a response without a body is always valid")
}

/// The single range a request asks for, when it asks for one it can be given.
///
/// Only one range is honoured. A request for several is answered with the whole file,
/// which the specification allows and which no media element ever needs: sending the parts
/// separately would mean writing a multipart body for a case that does not arrive.
fn single_range(request: &Request<Vec<u8>>, length: u64) -> Option<Result<(u64, u64), ()>> {
    let Ok(header) = request.headers().get(header::RANGE)?.to_str() else {
        return Some(Err(()));
    };
    if header.len() > 256 {
        return Some(Err(()));
    }
    let Ok(ranges) = http_range::HttpRange::parse(header, length) else {
        return Some(Err(()));
    };

    let [range] = ranges.as_slice() else {
        return None;
    };

    let start = range.start;
    if range.length == 0 || start >= length {
        return Some(Err(()));
    }
    let end = start
        .saturating_add(range.length - 1)
        .min(start.saturating_add(MAX_RANGE_BYTES - 1));

    if start >= length || end < start {
        return Some(Err(()));
    }

    Some(Ok((start, end.min(length - 1))))
}

fn read_at(file: &mut File, start: u64, end: u64) -> std::io::Result<Vec<u8>> {
    let wanted = end + 1 - start;
    let mut body = Vec::with_capacity(wanted as usize);

    file.seek(SeekFrom::Start(start))?;
    file.take(wanted).read_to_end(&mut body)?;
    if body.len() as u64 != wanted {
        return Err(std::io::ErrorKind::UnexpectedEof.into());
    }

    Ok(body)
}

/// Answers one request, having already been told whether the file may be read.
///
/// The permission arrives as an argument rather than being looked up here, so the whole
/// answer — statuses, ranges, headers — can be exercised by a test without an application
/// around it.
pub fn respond(request: &Request<Vec<u8>>, allowed: bool) -> Response<Vec<u8>> {
    if !allowed {
        return empty(StatusCode::FORBIDDEN);
    }

    serve(request, &requested_path(request))
}

/// Answers a request for a cover with the file the cache is holding, if it holds one.
///
/// A file with no cover, or with one this app will not read, is a plain 404: the interface
/// shows its placeholder and asks nothing further.
pub fn respond_cover(request: &Request<Vec<u8>>, entry: Option<PathBuf>) -> Response<Vec<u8>> {
    match entry {
        Some(path) => serve(request, &path),
        None => empty(StatusCode::NOT_FOUND),
    }
}

fn serve(request: &Request<Vec<u8>>, path: &Path) -> Response<Vec<u8>> {
    if request.method() != Method::GET && request.method() != Method::HEAD {
        return empty(StatusCode::METHOD_NOT_ALLOWED);
    }
    let origin = request.headers().get(header::ORIGIN);
    if origin.is_some_and(|value| {
        value
            .to_str()
            .ok()
            .and_then(|value| tauri::Url::parse(value).ok())
            .is_none_or(|url| !is_app_origin(&url))
    }) {
        return empty(StatusCode::FORBIDDEN);
    }
    let Ok(mut file) = File::open(path) else {
        return empty(StatusCode::NOT_FOUND);
    };

    let Ok(length) = file.metadata().map(|metadata| metadata.len()) else {
        return empty(StatusCode::NOT_FOUND);
    };

    let mut response = Response::builder()
        .header(header::CONTENT_TYPE, content_type(path))
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::VARY, "Origin")
        .header(header::CACHE_CONTROL, "no-store")
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff");
    // Canvas reads need CORS, but only the app's own origin may read these bytes.
    if let Some(origin) = origin {
        response = response.header(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin);
    }
    if request.method() == Method::HEAD {
        return response
            .header(header::CONTENT_LENGTH, length)
            .body(Vec::new())
            .unwrap_or_else(|_| empty(StatusCode::INTERNAL_SERVER_ERROR));
    }

    match single_range(request, length) {
        Some(Err(())) => Response::builder()
            .status(StatusCode::RANGE_NOT_SATISFIABLE)
            .header(header::CONTENT_RANGE, format!("bytes */{length}"))
            .body(Vec::new())
            .expect("a response without a body is always valid"),
        Some(Ok((start, end))) => match read_at(&mut file, start, end) {
            Ok(body) => response
                .status(StatusCode::PARTIAL_CONTENT)
                .header(
                    header::CONTENT_RANGE,
                    format!("bytes {start}-{end}/{length}"),
                )
                .header(header::CONTENT_LENGTH, body.len())
                .body(body)
                .unwrap_or_else(|_| empty(StatusCode::INTERNAL_SERVER_ERROR)),
            Err(_) => empty(StatusCode::INTERNAL_SERVER_ERROR),
        },
        None => {
            if length > MAX_FULL_RESPONSE_BYTES {
                return empty(StatusCode::PAYLOAD_TOO_LARGE);
            }
            let body = if length == 0 {
                Ok(Vec::new())
            } else {
                read_at(&mut file, 0, length - 1)
            };
            match body {
                Ok(body) => response
                    .status(StatusCode::OK)
                    .header(header::CONTENT_LENGTH, body.len())
                    .body(body)
                    .unwrap_or_else(|_| empty(StatusCode::INTERNAL_SERVER_ERROR)),
                Err(_) => empty(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    include!("../../tests/backend/protocol.rs");
}
