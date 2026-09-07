//! TuneLib core.
//!
//! The binary only calls [`run`]; all logic lives here so it stays testable with `cargo test`.

pub mod catalog;
pub mod commands;
pub mod error;
pub mod hash;
pub mod library;
pub mod metadata;
pub mod protocol;
pub mod state;

#[cfg(test)]
pub mod fixtures;

#[cfg(test)]
include!("../../tests/backend/navigation.rs");

pub use error::{AppError, AppResult};

#[cfg(desktop)]
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};
use tauri::{AppHandle, Emitter as _, Manager, Runtime, Url, WindowEvent};

use crate::catalog::CatalogState;
use crate::metadata::CoverCache;
use crate::state::{LibraryState, StartupFile};

pub const LIBRARY_FILE_NAME: &str = "library.json";
pub const COVER_CACHE_DIR_NAME: &str = "covers";

/// Argument the autostart entry carries when the app is asked to start out of sight.
pub const MINIMIZED_ARG: &str = "--minimized";

const TRAY_ID: &str = "main";
const MAIN_WINDOW: &str = "main";

/// The floating dock: a window of its own, so it survives the main one going to the tray.
pub const MINI_WINDOW: &str = "mini";
/// The close question is a separate centred window, so it is never clipped by the dock.
pub const MINI_CONFIRM_WINDOW: &str = "mini-confirm";

/// Sizes of the dock, in logical pixels: one per layout, one per level.
pub const MINI_SIZE: (f64, f64) = (360.0, 144.0);
pub const MINI_SIZE_EXPANDED: (f64, f64) = (400.0, 172.0);
pub const MINI_SIZE_VERTICAL: (f64, f64) = (224.0, 244.0);
pub const MINI_SIZE_VERTICAL_EXPANDED: (f64, f64) = (252.0, 340.0);

/// Room left between the dock and the corner of the screen it first appears in.
pub const MINI_SCREEN_MARGIN: f64 = 16.0;

/// Asks the frontend to stop the playback: the sound is played by the webview, not here.
pub const STOP_PLAYBACK_EVENT: &str = "tray://stop-playback";
/// Sent to the main webview when the running instance receives an audio file from a later
/// invocation of the application.
pub const OPEN_AUDIO_FILE_EVENT: &str = "audio-file-opened";

/// Whether closing the window leaves the app in the tray instead of quitting it.
///
/// The setting itself lives in the frontend store; the window is closed by the system too,
/// through Alt+F4 or the taskbar, so the answer has to be readable from here as well.
#[derive(Debug, Default)]
pub struct CloseToTray(AtomicBool);

impl CloseToTray {
    pub fn set(&self, enabled: bool) {
        self.0.store(enabled, Ordering::Relaxed);
    }

    pub fn is_enabled(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }
}

/// Whether an address belongs to the app itself.
///
/// The pages of the app are served by the shell, over `tauri:` in a bundle and over the
/// local dev server while developing. Nothing else is a page of this app.
pub fn is_app_page(url: &Url) -> bool {
    if !url.username().is_empty()
        || url.password().is_some()
        || !matches!(url.path(), "/" | "/index.html")
    {
        return false;
    }
    protocol::is_app_origin(url)
}

/// Shuts the two doors a webview has to the outside.
///
/// A remote page loaded in here would run beside the commands of the app, so the webview
/// is not allowed to go anywhere but its own pages, and is not allowed to open a window
/// for a page it was asked to.
pub fn keep_inside_the_app<'a, R: Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
    builder
        .on_navigation(is_app_page)
        .on_new_window(|_, _| NewWindowResponse::Deny)
}

/// The picture of a cache entry, when the entry is a picture at all.
fn file_of(entry: metadata::CoverEntry) -> Option<std::path::PathBuf> {
    match entry {
        metadata::CoverEntry::Image(path) => Some(path),
        metadata::CoverEntry::Missing | metadata::CoverEntry::TooLarge(_) => None,
    }
}

/// Clears what an earlier run may have left behind: the staged copies of an interrupted
/// edit, and whatever the cover cache is holding above its limit.
///
/// One folder read per folder of the library, so it runs off the main thread: the window
/// opens while it works, and a folder that is slow to answer — a network drive, a disk
/// waking up — delays nothing the user is looking at.
fn sweep_leftovers<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let Ok(directories) = app.state::<LibraryState>().read(library::track_directories) else {
            return;
        };

        metadata::write::remove_abandoned_staging_files(directories);
        app.state::<CoverCache>().evict_to_fit();
    });
}

/// Brings the window back from the tray, wherever it was left.
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    // The dock stands in for the window: with the window back, it has nothing left to do.
    if let Some(dock) = app.get_webview_window(MINI_WINDOW) {
        let _ = dock.close();
    }

    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Brings the floating player forward without closing it or restoring the main window.
fn bring_mini_player_to_front<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MINI_WINDOW) {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn hide_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.hide();
    }
}

/// The tray menu, rebuilt whenever the interface changes language or the player its state.
///
/// `can_stop` greys out the command while the player holds nothing to stop.
pub fn tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    show: &str,
    bring_to_front: &str,
    stop: &str,
    quit: &str,
    can_stop: bool,
    can_bring_to_front: bool,
) -> tauri::Result<Menu<R>> {
    Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "show", show, true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                "bring-to-front",
                bring_to_front,
                can_bring_to_front,
                None::<&str>,
            )?,
            &MenuItem::with_id(app, "stop", stop, can_stop, None::<&str>)?,
            &MenuItem::with_id(app, "quit", quit, true, None::<&str>)?,
        ],
    )
}

fn build_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().cloned().ok_or_else(|| {
            tauri::Error::AssetNotFound("the window icon is needed for the tray".to_owned())
        })?)
        .tooltip("TuneLib")
        // Nothing plays at startup, so the command starts out of reach.
        .menu(&tray_menu(
            app,
            "Show",
            "Bring mini player to front",
            "Stop playback",
            "Quit",
            false,
            false,
        )?)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "bring-to-front" => bring_mini_player_to_front(app),
            "stop" => {
                let _ = app.emit(STOP_PLAYBACK_EVENT, ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // The left click is the shortcut back to the window; the menu answers the right one.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

/// Starts the Tauri shell with the registered commands.
///
/// # Panics
/// Aborts when the Tauri configuration is invalid: the application cannot start at all.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // This must be registered first: a second file-association launch is closed here and its
    // arguments are handed to the already running process instead of creating another tray
    // icon and another copy of the frontend.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let cwd = PathBuf::from(cwd);
            let arguments = args.into_iter().skip(1).map(|argument| {
                let path = PathBuf::from(argument);

                if path.is_absolute() {
                    path
                } else {
                    cwd.join(path)
                }
            });

            let Some(startup) = app.try_state::<StartupFile>() else {
                return;
            };

            if startup.replace_from_arguments(arguments) {
                let _ = app.emit_to(MAIN_WINDOW, OPEN_AUDIO_FILE_EVENT, ());
            }
        }));
    }

    builder
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .manage(CloseToTray::default())
        // Audio does not travel over Tauri's asset protocol: that one answers from a list
        // of paths granted in advance, and a grant on it cannot be taken back. This scheme
        // asks the library on every request instead.
        .register_asynchronous_uri_scheme_protocol(protocol::SCHEME, |app, request, responder| {
            let app = app.app_handle().clone();

            tauri::async_runtime::spawn_blocking(move || {
                let allowed = protocol::is_playable_now(
                    &app.state::<LibraryState>(),
                    &app.state::<StartupFile>(),
                    &protocol::requested_path(&request),
                );

                responder.respond(protocol::respond(&request, allowed));
            });
        })
        // The covers travel the same way, and are checked the same way: the picture of a
        // file the library no longer holds is not served either.
        .register_asynchronous_uri_scheme_protocol(
            protocol::COVER_SCHEME,
            |app, request, responder| {
                let app = app.app_handle().clone();

                tauri::async_runtime::spawn_blocking(move || {
                    let path = protocol::requested_path(&request);
                    let allowed = protocol::is_playable_now(
                        &app.state::<LibraryState>(),
                        &app.state::<StartupFile>(),
                        &path,
                    );

                    let entry = if allowed {
                        app.state::<CoverCache>().entry(&path).ok()
                    } else {
                        None
                    };

                    responder.respond(protocol::respond_cover(&request, entry.and_then(file_of)));
                });
            },
        )
        .setup(|app| {
            // The window is described in the configuration but built here, so it can be
            // given the guards a window created for us would not carry.
            let main_config = app
                .config()
                .app
                .windows
                .iter()
                .find(|window| window.label == MAIN_WINDOW)
                .cloned();

            if let Some(config) = main_config {
                keep_inside_the_app(WebviewWindowBuilder::from_config(app.handle(), &config)?)
                    .build()?;
            }

            build_tray(app.handle())?;

            // Started by the system with the window out of sight: it waits in the tray.
            if std::env::args().any(|argument| argument == MINIMIZED_ARG) {
                hide_main_window(app.handle());
            }

            let data_directory = app.path().app_data_dir()?;
            let catalog = CatalogState::open(
                data_directory.clone(),
                &data_directory.join(LIBRARY_FILE_NAME),
            );
            app.manage(LibraryState::from_file(catalog.active_file()?));
            app.manage(catalog);

            app.manage(StartupFile::from_arguments(
                std::env::args_os().skip(1).map(std::path::PathBuf::from),
            ));

            let cache_directory = app.path().app_cache_dir()?;
            app.manage(CoverCache::new(cache_directory.join(COVER_CACHE_DIR_NAME)));

            // Last: it reads the state everything above has just been put into.
            sweep_leftovers(app.handle());

            Ok(())
        })
        // Closing the window only quits the app when the tray is not holding it.
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Destroyed) && window.label() == MINI_WINDOW {
                let _ = window.emit_to(MAIN_WINDOW, "mini://closed", ());
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == MAIN_WINDOW && window.state::<CloseToTray>().is_enabled() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::default_player::is_default_audio_player,
            commands::window::set_close_to_tray,
            commands::window::set_tray_menu,
            commands::window::open_mini_player,
            commands::window::open_mini_close_confirmation,
            commands::window::close_mini_player,
            commands::window::set_mini_player_always_on_top,
            commands::window::set_mini_player_shape,
            commands::window::quit_app,
            commands::library::library_info,
            commands::library::rename_library,
            commands::library::add_tracks,
            commands::library::remove_track,
            commands::library::list_tracks,
            commands::library::refresh_library_from_disk,
            commands::library::refresh_track,
            commands::library::verify_track_file,
            commands::library::export_track_list,
            commands::metadata::heavy_cover_bytes,
            commands::metadata::cover_cache_size,
            commands::metadata::clear_cover_cache,
            commands::metadata::write_metadata,
            commands::metadata::write_cover,
            commands::metadata::rename_track_file,
            commands::playback::prepare_playback,
            commands::playback::prepare_external_playback,
            commands::playback::startup_audio_file,
            commands::catalog::list_libraries,
            commands::catalog::create_library,
            commands::catalog::switch_library,
            commands::catalog::delete_library,
            commands::catalog::export_library,
            commands::catalog::import_library,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start the Tauri application");
}
