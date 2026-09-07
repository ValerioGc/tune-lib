//! Commands exposed to the frontend.

pub mod catalog;
pub mod default_player;
pub mod library;
pub mod metadata;
pub mod playback;
pub mod window;

use serde::{Deserialize, Serialize};

pub use catalog::{
    create_library, delete_library, export_library, import_library, list_libraries, switch_library,
};
pub use library::{
    add_tracks, export_track_list, library_info, list_tracks, refresh_library_from_disk,
    refresh_track, remove_track, rename_library, verify_track_file,
};
pub use metadata::{
    clear_cover_cache, cover_cache_size, heavy_cover_bytes, write_cover, write_metadata,
    CoverCacheReport,
};
pub use playback::{
    prepare_external_playback, prepare_playback, startup_audio_file, PlaybackSource,
};
pub use window::{
    close_mini_player, open_mini_close_confirmation, open_mini_player, quit_app, set_close_to_tray,
    set_mini_player_always_on_top, set_mini_player_shape, set_tray_menu,
};

use crate::metadata::SUPPORTED_EXTENSIONS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub supported_extensions: Vec<String>,
}

pub fn build_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_owned(),
        version: env!("CARGO_PKG_VERSION").to_owned(),
        supported_extensions: SUPPORTED_EXTENSIONS
            .iter()
            .map(|extension| (*extension).to_owned())
            .collect(),
    }
}

/// Returns name, version and supported formats of the application.
#[tauri::command]
pub fn app_info() -> AppInfo {
    build_app_info()
}

#[cfg(test)]
mod tests {
    include!("../../../tests/backend/commands/mod.rs");
}
