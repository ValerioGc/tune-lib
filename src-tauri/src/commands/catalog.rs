//! Commands over the set of libraries: list, create, switch, delete and export.

use std::path::PathBuf;

use tauri::State;

use serde::{Deserialize, Serialize};

use crate::catalog::{self, Catalog, CatalogState};
use crate::commands::library::LibraryInfo;
use crate::error::{AppError, AppResult};
use crate::library::{
    Library, LibraryExport, LibraryExportMode, LibraryImportReport, LibraryImportStrategy,
};
use crate::state::LibraryState;

/// One library as shown in the settings list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySummary {
    pub id: String,
    pub name: String,
    pub track_count: usize,
    pub active: bool,
}

/// Describes every library: the active one from memory, the others from their file.
pub fn summaries(catalog: &CatalogState, state: &LibraryState) -> AppResult<Vec<LibrarySummary>> {
    let (active_id, entries) =
        catalog.read(|catalog| (catalog.active.clone(), catalog.entries.clone()))?;

    let mut summaries = Vec::with_capacity(entries.len());

    for entry in entries {
        let active = entry.id == active_id;
        let (name, track_count) = if active {
            state.read(|library| (library.name.clone(), library.len()))?
        } else {
            let library = Library::load(&entry.path())?;
            (library.name, library.tracks.len())
        };

        summaries.push(LibrarySummary {
            id: entry.id,
            name,
            track_count,
            active,
        });
    }

    Ok(summaries)
}

/// Ids come from name and clock, so two libraries named the same in the same second would
/// collide: the seed is changed until the catalog has no such entry.
fn unique_id(catalog: &Catalog, name: &str) -> String {
    let mut candidate = catalog::library_id(name);

    for attempt in 1.. {
        if catalog.entry(&candidate).is_none() {
            break;
        }

        candidate = catalog::library_id(&format!("{name}-{attempt}"));
    }

    candidate
}

/// Whether two names would be read as the same library by the person looking at them.
///
/// Case and the spaces around a name are not what tells two libraries apart: "Jazz" and
/// "jazz " in the same list are a mistake waiting to be made, not two collections.
fn same_name(first: &str, second: &str) -> bool {
    first.trim().to_lowercase() == second.trim().to_lowercase()
}

/// Refuses a name another library already answers to.
///
/// `except` is the library allowed to keep it: renaming one to what it is already called
/// is not a clash with itself.
pub fn ensure_name_is_free(
    catalog: &CatalogState,
    state: &LibraryState,
    name: &str,
    except: Option<&str>,
) -> AppResult<()> {
    let taken = summaries(catalog, state)?.into_iter().any(|library| {
        same_name(&library.name, name) && except.is_none_or(|allowed| library.id != allowed)
    });

    if taken {
        return Err(AppError::Validation(format!(
            "a library named {name} already exists"
        )));
    }

    Ok(())
}

/// Creates an empty library and adds it to the catalog without opening it.
pub fn create(
    catalog: &CatalogState,
    state: &LibraryState,
    name: &str,
) -> AppResult<LibrarySummary> {
    let mut library = Library::new();
    let name = library.rename(name)?;

    ensure_name_is_free(catalog, state, &name, None)?;

    let id = catalog.read(|entries| unique_id(entries, &name))?;
    let file = catalog::library_file(catalog.directory(), &id);
    library.save(&file)?;

    catalog.update(|catalog| {
        catalog.add(catalog::CatalogEntry {
            id: id.clone(),
            file: file.to_string_lossy().into_owned(),
        });
    })?;

    Ok(LibrarySummary {
        id,
        name,
        track_count: 0,
        active: false,
    })
}

/// Opens another library.
///
/// The catalog is written first: if loading the file then fails, the next start opens the
/// library the user asked for instead of silently going back to the previous one.
pub fn switch(catalog: &CatalogState, state: &LibraryState, id: &str) -> AppResult<LibraryInfo> {
    let file = catalog.file_of(id)?;
    catalog.update(|catalog| catalog.set_active(id))??;
    state.switch_to(file)?;

    state.read(|library| LibraryInfo {
        name: library.name.clone(),
        metadata: library.metadata().clone(),
    })
}

/// Deletes a library and its file, opening another one when the active library goes away.
pub fn delete(
    catalog: &CatalogState,
    state: &LibraryState,
    id: &str,
) -> AppResult<Vec<LibrarySummary>> {
    let was_active = catalog.read(|catalog| catalog.active == id)?;
    let removed = catalog.update(|catalog| catalog.remove(id))??;

    match std::fs::remove_file(removed.path()) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(AppError::Io(error)),
    }

    if was_active {
        state.switch_to(catalog.active_file()?)?;
    }

    summaries(catalog, state)
}

/// Writes a copy of one library to the chosen file.
pub fn export(
    catalog: &CatalogState,
    state: &LibraryState,
    id: &str,
    destination: &str,
    mode: LibraryExportMode,
    app_version: &str,
) -> AppResult<String> {
    if destination.trim().is_empty() {
        return Err(AppError::Validation("missing destination path".to_owned()));
    }

    let source = catalog.file_of(id)?;
    let active = catalog.read(|catalog| catalog.active == id)?;

    // The active library lives in memory: exporting it from there also covers the case of
    // a library whose file has not been written yet.
    let mut library = if active {
        state.read(Clone::clone)?
    } else {
        Library::load(&source)?
    };
    // A paths export carries no artwork, so there is nothing to fill in for it.
    if mode == LibraryExportMode::Full {
        library.fill_missing_artwork();
    }

    let destination = PathBuf::from(destination);
    LibraryExport::new(&library, mode, app_version).save(&destination)?;

    Ok(destination.to_string_lossy().into_owned())
}

/// Imports a library JSON into the active library using the selected merge strategy.
pub fn import(
    state: &LibraryState,
    source: &str,
    strategy: LibraryImportStrategy,
) -> AppResult<LibraryImportReport> {
    if source.trim().is_empty() {
        return Err(AppError::Validation("missing source path".to_owned()));
    }

    let mut imported = crate::library::load_for_import(&PathBuf::from(source))?;
    crate::library::maintain_from_disk(&mut imported);

    state.update(|library| library.import(imported, strategy))
}

/// Lists the libraries the user can switch between.
#[tauri::command]
pub fn list_libraries(
    catalog: State<'_, CatalogState>,
    state: State<'_, LibraryState>,
) -> AppResult<Vec<LibrarySummary>> {
    summaries(&catalog, &state)
}

/// Creates a new empty library.
#[tauri::command]
pub fn create_library(
    catalog: State<'_, CatalogState>,
    state: State<'_, LibraryState>,
    name: String,
) -> AppResult<LibrarySummary> {
    create(&catalog, &state, &name)
}

/// Makes another library the active one.
#[tauri::command]
pub fn switch_library(
    catalog: State<'_, CatalogState>,
    state: State<'_, LibraryState>,
    id: String,
) -> AppResult<LibraryInfo> {
    switch(&catalog, &state, &id)
}

/// Deletes a library and its file.
#[tauri::command]
pub fn delete_library(
    catalog: State<'_, CatalogState>,
    state: State<'_, LibraryState>,
    id: String,
) -> AppResult<Vec<LibrarySummary>> {
    delete(&catalog, &state, &id)
}

/// Exports a library to the chosen file, whole or as a list of paths.
#[tauri::command]
pub fn export_library<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    catalog: State<'_, CatalogState>,
    state: State<'_, LibraryState>,
    id: String,
    destination: String,
    mode: Option<LibraryExportMode>,
) -> AppResult<String> {
    export(
        &catalog,
        &state,
        &id,
        &destination,
        mode.unwrap_or_default(),
        &tauri::Manager::package_info(&app).version.to_string(),
    )
}

/// Imports a library file into the active library.
#[tauri::command]
pub fn import_library(
    state: State<'_, LibraryState>,
    source: String,
    strategy: LibraryImportStrategy,
) -> AppResult<LibraryImportReport> {
    import(&state, &source, strategy)
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/commands/catalog.rs");
}
