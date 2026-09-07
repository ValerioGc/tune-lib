//! Library commands. The logic lives in [`crate::library`]; these only bridge Tauri.

use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

use tauri::{AppHandle, Emitter as _, Manager as _, State};

use serde::{Deserialize, Serialize};

use crate::catalog::CatalogState;
use crate::error::{AppError, AppResult};
use crate::library::{self, AddReport, LibraryMetadata, TrackView};
use crate::state::LibraryState;

/// What a refresh found: how many entries changed, and which files are no longer there.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryRefreshReport {
    pub refreshed: usize,
    pub missing: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryInfo {
    pub name: String,
    pub metadata: LibraryMetadata,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TrackListExportFormat {
    Csv,
    Txt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TrackListExportField {
    Title,
    Artist,
    Album,
    Year,
    Genre,
    Duration,
    Format,
    Path,
    Missing,
}

fn info_of(library: &library::Library) -> LibraryInfo {
    LibraryInfo {
        name: library.name.clone(),
        metadata: library.metadata().clone(),
    }
}

fn format_duration(duration_ms: u64) -> String {
    let total_seconds = duration_ms / 1000;
    let seconds = total_seconds % 60;
    let minutes = (total_seconds / 60) % 60;
    let hours = total_seconds / 3600;

    if hours > 0 {
        format!("{hours}:{minutes:02}:{seconds:02}")
    } else {
        format!("{minutes}:{seconds:02}")
    }
}

fn field_header(field: TrackListExportField) -> &'static str {
    match field {
        TrackListExportField::Title => "Name",
        TrackListExportField::Artist => "Artist",
        TrackListExportField::Album => "Album",
        TrackListExportField::Year => "Year",
        TrackListExportField::Genre => "Genre",
        TrackListExportField::Duration => "Duration",
        TrackListExportField::Format => "Format",
        TrackListExportField::Path => "Path",
        TrackListExportField::Missing => "Missing file",
    }
}

fn field_value(track: &TrackView, field: TrackListExportField) -> String {
    match field {
        TrackListExportField::Title => track.track.title.clone(),
        TrackListExportField::Artist => track.track.artist.clone().unwrap_or_default(),
        TrackListExportField::Album => track.track.album.clone().unwrap_or_default(),
        TrackListExportField::Year => track
            .track
            .year
            .map(|year| year.to_string())
            .unwrap_or_default(),
        TrackListExportField::Genre => track.track.genre.clone().unwrap_or_default(),
        TrackListExportField::Duration => format_duration(track.track.duration_ms),
        TrackListExportField::Format => track.track.format.clone(),
        TrackListExportField::Path => track.track.path.clone(),
        TrackListExportField::Missing => {
            if track.missing {
                "yes".to_owned()
            } else {
                "no".to_owned()
            }
        }
    }
}

/// Characters a spreadsheet reads as the start of a formula rather than as text.
const FORMULA_STARTS: [char; 6] = ['=', '+', '-', '@', '\t', '\r'];

fn csv_cell(value: &str) -> String {
    // A title comes out of a tag written by whoever made the file, and an exported list
    // exists to be opened somewhere else. To Excel and to LibreOffice a cell beginning with
    // `=` is a formula rather than a word, and a formula can reach outside the document.
    // The leading apostrophe is what tells them it is text: it shows on the rare name that
    // really starts with one of these, which is the cheaper of the two prices.
    let value = if value.starts_with(FORMULA_STARTS) {
        format!("'{value}")
    } else {
        value.to_owned()
    };

    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value
    }
}

fn export_contents(
    tracks: &[TrackView],
    format: TrackListExportFormat,
    fields: &[TrackListExportField],
) -> String {
    match format {
        TrackListExportFormat::Csv => {
            let mut lines = vec![fields
                .iter()
                .map(|field| csv_cell(field_header(*field)))
                .collect::<Vec<_>>()
                .join(",")];

            lines.extend(tracks.iter().map(|track| {
                fields
                    .iter()
                    .map(|field| csv_cell(&field_value(track, *field)))
                    .collect::<Vec<_>>()
                    .join(",")
            }));

            lines.join("\n")
        }
        TrackListExportFormat::Txt => tracks
            .iter()
            .map(|track| {
                fields
                    .iter()
                    .map(|field| {
                        format!("{}: {}", field_header(*field), field_value(track, *field))
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .collect::<Vec<_>>()
            .join("\n\n"),
    }
}

/// Returns metadata about the active library.
#[tauri::command]
pub fn library_info(state: State<'_, LibraryState>) -> AppResult<LibraryInfo> {
    state.read(info_of)
}

/// Renames the active library.
///
/// The catalog is asked as well: a name is only free if no other library already answers
/// to it, and creation is not the only door into the same mistake.
#[tauri::command]
pub fn rename_library(
    catalog: State<'_, CatalogState>,
    state: State<'_, LibraryState>,
    name: String,
) -> AppResult<LibraryInfo> {
    let active = catalog.read(|catalog| catalog.active.clone())?;
    crate::commands::catalog::ensure_name_is_free(&catalog, &state, &name, Some(&active))?;

    state.update(|library| library.rename(&name))??;
    state.read(info_of)
}

/// How far an import has got.
///
/// `total` is zero while the folders are still being walked: at that point the files are
/// being counted, and how many there will be is not yet known.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    pub done: usize,
    pub total: usize,
    pub finalizing: bool,
}

/// What an import reports itself on, as it goes.
pub const IMPORT_PROGRESS_EVENT: &str = "library://import-progress";

/// Imports the given files, skipping duplicates and reporting the failures.
///
/// Off the main thread, and off the library for all but the last moment of it: a folder
/// of a few thousand files is a tag read a few thousand times, and doing that where the
/// window is answered from is what used to leave it frozen for the length of the import.
/// The library is taken once, at the end, to store what was read.
#[tauri::command]
pub async fn add_tracks(app: AppHandle, paths: Vec<String>) -> AppResult<AddReport> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryState>();

        // Said before the walk rather than after it: on a large folder the walk itself is
        // a wait, and one nobody should be looking at a still window through.
        let _ = app.emit(
            IMPORT_PROGRESS_EVENT,
            ImportProgress {
                done: 0,
                total: 0,
                finalizing: false,
            },
        );

        let files = library::expand_paths(&paths);
        let total = files.len();

        let _ = app.emit(
            IMPORT_PROGRESS_EVENT,
            ImportProgress {
                done: 0,
                total,
                finalizing: false,
            },
        );

        // One message per point of a percentage: enough to move a number, few enough that
        // the window spends the import drawing rather than reading its post.
        let reported = AtomicUsize::new(0);
        let read = library::read_imports(&files, &|done| {
            let percent = done * 100 / total.max(1);

            if reported.fetch_max(percent, Ordering::Relaxed) < percent {
                let _ = app.emit(
                    IMPORT_PROGRESS_EVENT,
                    ImportProgress {
                        done,
                        total,
                        finalizing: false,
                    },
                );
            }
        });

        let _ = app.emit(
            IMPORT_PROGRESS_EVENT,
            ImportProgress {
                done: total,
                total,
                finalizing: true,
            },
        );
        state.update(|library| library::add_read_imports(library, read, library::now_seconds()))
    })
    .await
    .map_err(|error| AppError::State(error.to_string()))?
}

/// Re-reads from disk what other programs may have changed, and reports what is missing.
///
/// One file read per track, on a few threads and off the main one — and, more to the point,
/// outside the library: the reading takes the list of files and gives back what it found,
/// and only writing it back needs the library. A window that would once sit unable to show
/// a row for the length of the scan now waits the moment it takes to store the result.
#[tauri::command]
pub async fn refresh_library_from_disk(app: AppHandle) -> AppResult<LibraryRefreshReport> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<LibraryState>();

        let files = state.read(library::files_to_reread)?;
        let read = library::read_all_metadata(&files);

        let refreshed = state.update(|library| library::apply_reread(library, read))?;
        let missing = state.read(library::missing_paths)?;

        Ok(LibraryRefreshReport { refreshed, missing })
    })
    .await
    .map_err(|error| AppError::State(error.to_string()))?
}

/// Re-reads one file, so what is shown is what the file says right now.
#[tauri::command]
pub fn refresh_track(state: State<'_, LibraryState>, id: String) -> AppResult<Option<TrackView>> {
    // Derived: this runs before every play, and what it finds is in the file already.
    state.update_derived(|library| library::refresh_track(library, &id))
}

/// Removes a track from the library without touching the file on disk.
#[tauri::command]
pub fn remove_track(state: State<'_, LibraryState>, id: String) -> AppResult<bool> {
    state.update(|library| library.remove(&id))
}

/// Lists the tracked files, flagging the ones that are no longer on disk.
#[tauri::command]
pub fn list_tracks(state: State<'_, LibraryState>) -> AppResult<Vec<TrackView>> {
    state.read(library::to_views)
}

/// Checks whether one tracked file still exists on disk.
#[tauri::command]
pub fn verify_track_file(state: State<'_, LibraryState>, id: String) -> AppResult<TrackView> {
    state
        .read(|library| library::view_of(library, &id))?
        .ok_or(AppError::NotFound(id))
}

/// Exports the active library track list with the chosen columns.
#[tauri::command]
pub fn export_track_list(
    state: State<'_, LibraryState>,
    destination: String,
    format: TrackListExportFormat,
    fields: Vec<TrackListExportField>,
) -> AppResult<String> {
    if destination.trim().is_empty() {
        return Err(AppError::Validation("missing destination path".to_owned()));
    }

    if fields.is_empty() {
        return Err(AppError::Validation(
            "select at least one field to export".to_owned(),
        ));
    }

    let tracks = state.read(library::to_views)?;
    let destination = PathBuf::from(destination);

    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(&destination, export_contents(&tracks, format, &fields))?;

    Ok(destination.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/commands/library.rs");
}
