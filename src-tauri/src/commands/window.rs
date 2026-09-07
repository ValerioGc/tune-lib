//! Window behaviour the frontend decides but the shell has to enforce.

use tauri::{AppHandle, Manager as _, Runtime, State, WebviewUrl, WebviewWindowBuilder};

use crate::{
    keep_inside_the_app, tray_menu, CloseToTray, MINI_CONFIRM_WINDOW, MINI_SCREEN_MARGIN,
    MINI_SIZE, MINI_SIZE_EXPANDED, MINI_SIZE_VERTICAL, MINI_SIZE_VERTICAL_EXPANDED, MINI_WINDOW,
};

/// How much room the dock takes, for the layout and the level it is in.
fn mini_size(vertical: bool, expanded: bool) -> (f64, f64) {
    match (vertical, expanded) {
        (true, true) => MINI_SIZE_VERTICAL_EXPANDED,
        (true, false) => MINI_SIZE_VERTICAL,
        (false, true) => MINI_SIZE_EXPANDED,
        (false, false) => MINI_SIZE,
    }
}

/// Where the dock stands the first time: the corner the taskbar is in, out of its way.
fn corner_position<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    width: f64,
    height: f64,
) -> Option<tauri::LogicalPosition<f64>> {
    let monitor = window.current_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let area = monitor.size().to_logical::<f64>(scale);
    let origin = monitor.position().to_logical::<f64>(scale);

    Some(tauri::LogicalPosition::new(
        origin.x + area.width - width - MINI_SCREEN_MARGIN,
        // The taskbar sits at the bottom by default: the dock stops short of it.
        origin.y + area.height - height - MINI_SCREEN_MARGIN * 4.0,
    ))
}

/// Where the dock has to stand once it is `width` by `height`, to keep the edge it is on.
///
/// Resizing a window holds its top left corner still, so a dock resting in the bottom right
/// corner walks away from that corner every time it changes level. The side it is nearest
/// on each axis is the one it is taken to be resting against, and the gap to that side is
/// what is kept: a dock in the middle of the screen keeps its top left corner as before.
fn anchored_position<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    width: f64,
    height: f64,
) -> Option<tauri::LogicalPosition<f64>> {
    let monitor = window.current_monitor().ok().flatten()?;
    let scale = monitor.scale_factor();
    let area = monitor.size().to_logical::<f64>(scale);
    let origin = monitor.position().to_logical::<f64>(scale);
    let position = window.outer_position().ok()?.to_logical::<f64>(scale);
    let size = window.outer_size().ok()?.to_logical::<f64>(scale);

    let left_gap = position.x - origin.x;
    let right_gap = (origin.x + area.width) - (position.x + size.width);
    let top_gap = position.y - origin.y;
    let bottom_gap = (origin.y + area.height) - (position.y + size.height);

    let x = if right_gap < left_gap {
        origin.x + area.width - right_gap - width
    } else {
        position.x
    };
    let y = if bottom_gap < top_gap {
        origin.y + area.height - bottom_gap - height
    } else {
        position.y
    };

    // Keep the same safety gap used for the initial corner. Without it, a resize from the
    // bottom-right corner can leave the new window flush with or slightly beyond the edge.
    // A monitor smaller than the dock would leave the two bounds crossed, so choose the lower
    // bound first instead of calling `clamp` with an invalid range.
    let min_x = origin.x + MINI_SCREEN_MARGIN;
    let max_x = (origin.x + area.width - width - MINI_SCREEN_MARGIN).max(min_x);
    let min_y = origin.y + MINI_SCREEN_MARGIN * 4.0;
    let max_y = (origin.y + area.height - height - MINI_SCREEN_MARGIN * 4.0).max(min_y);

    Some(tauri::LogicalPosition::new(
        x.min(max_x).max(min_x),
        y.min(max_y).max(min_y),
    ))
}

/// Whether closing the window hides the app in the tray instead of quitting it.
///
/// The setting lives in the frontend store, but the window is also closed by the system,
/// so the choice is mirrored here for the close handler to read.
#[tauri::command]
pub fn set_close_to_tray(state: State<'_, CloseToTray>, enabled: bool) {
    state.set(enabled);
}

/// Opens the floating dock, or brings back the one already there.
///
/// A window of its own: the main one is on its way to the tray, and a webview goes with the
/// window that holds it. The playback stays where it is — the dock only asks for things.
#[tauri::command]
pub async fn open_mini_player<R: Runtime>(
    app: AppHandle<R>,
    vertical: bool,
    always_on_top: bool,
    expanded: bool,
    position: Option<(f64, f64)>,
) -> bool {
    if let Some(window) = app.get_webview_window(MINI_WINDOW) {
        // The dock may already exist when the user changes orientation or level. Reapply the
        // requested shape here as well as when the command comes from the dock itself.
        let _ = set_mini_player_window_shape(&window, vertical, always_on_top, expanded);
        let _ = window.set_always_on_top(always_on_top);
        let _ = window.show();
        let _ = window.set_focus();

        return true;
    }

    let (width, height) = mini_size(vertical, expanded);

    let built = keep_inside_the_app(WebviewWindowBuilder::new(
        &app,
        MINI_WINDOW,
        WebviewUrl::App("index.html?view=mini".into()),
    ))
    .title("TuneLib")
    .inner_size(width, height)
    .resizable(false)
    .decorations(false)
    .always_on_top(always_on_top)
    .skip_taskbar(true)
    .shadow(true)
    .visible(false)
    .build();

    let Ok(window) = built else {
        return false;
    };

    // Where it was left, or the corner it belongs to the first time. The window is placed
    // before it is shown, so it never appears in one spot and jumps to another.
    match position {
        Some((x, y)) => {
            let _ = window.set_position(tauri::LogicalPosition::new(x, y));
        }
        None => {
            if let Some(corner) = corner_position(&window, width, height) {
                let _ = window.set_position(corner);
            }
        }
    }

    let _ = window.show();

    true
}

/// Opens the close question as a small independent window, centred on the current monitor.
///
/// Asynchronous, like every other command that builds a window: a synchronous command is run
/// on the thread the event loop is on, and building a webview from there leaves the two
/// waiting on each other — the frame is drawn empty and the application stops answering.
#[tauri::command]
pub async fn open_mini_close_confirmation<R: Runtime>(app: AppHandle<R>) -> bool {
    if let Some(window) = app.get_webview_window(MINI_CONFIRM_WINDOW) {
        let _ = window.show();
        let _ = window.set_focus();

        return true;
    }

    let built = keep_inside_the_app(WebviewWindowBuilder::new(
        &app,
        MINI_CONFIRM_WINDOW,
        WebviewUrl::App("index.html?view=mini-confirm".into()),
    ))
    .title("TuneLib")
    // Room for the question, the choice to remember it and three answers, in the language
    // that spells them out at their longest: a window that clips the last button is worse
    // than no window at all.
    .inner_size(420.0, 304.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .shadow(true)
    .center()
    // Shown by the webview once it has a frame to show, the way the dock is: a window
    // revealed at the moment it is built is an empty rectangle for as long as its page takes
    // to arrive.
    .visible(false)
    .build();

    let Ok(window) = built else {
        return false;
    };

    let _ = window.set_focus();

    true
}

#[tauri::command]
pub fn close_mini_player<R: Runtime>(app: AppHandle<R>) -> bool {
    app.get_webview_window(MINI_WINDOW)
        .map(|window| window.close().is_ok())
        .unwrap_or(false)
}

/// Applies what the dock menu changed: the side it lays out along, and the front it keeps.
#[tauri::command]
pub fn set_mini_player_shape<R: Runtime>(
    app: AppHandle<R>,
    vertical: bool,
    always_on_top: bool,
    expanded: bool,
) -> bool {
    let Some(window) = app.get_webview_window(MINI_WINDOW) else {
        return false;
    };

    set_mini_player_window_shape(&window, vertical, always_on_top, expanded)
}

/// Changes only the z-order flag. Pinning must not run the resize/anchor calculation.
#[tauri::command]
pub fn set_mini_player_always_on_top<R: Runtime>(app: AppHandle<R>, always_on_top: bool) -> bool {
    app.get_webview_window(MINI_WINDOW)
        .map(|window| window.set_always_on_top(always_on_top).is_ok())
        .unwrap_or(false)
}

fn set_mini_player_window_shape<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
    vertical: bool,
    always_on_top: bool,
    expanded: bool,
) -> bool {
    let (width, height) = mini_size(vertical, expanded);
    let _ = window.set_always_on_top(always_on_top);

    let same_size = window
        .outer_size()
        .ok()
        .zip(window.scale_factor().ok())
        .map(|(size, scale)| {
            let current = size.to_logical::<f64>(scale);
            (current.width - width).abs() < 1.0 && (current.height - height).abs() < 1.0
        })
        .unwrap_or(false);

    if same_size {
        return true;
    }

    // Read before the resize, applied after it: the new position depends on where the dock
    // was standing, and the resize is what would have moved it.
    let anchored = anchored_position(window, width, height);
    let resized = window
        .set_size(tauri::LogicalSize::new(width, height))
        .is_ok();

    if let Some(position) = anchored {
        let _ = window.set_position(position);
    }

    resized
}

/// Closes the app for good, dock included: asked from the dock, which has no other way out.
#[tauri::command]
pub fn quit_app<R: Runtime>(app: AppHandle<R>) {
    // What the library has pending is only ever data read back from the files, so losing it
    // costs a re-read rather than anything of the user's — but there is no reason to lose it
    // once the app has been told it is closing.
    let _ = app.state::<crate::state::LibraryState>().flush();

    app.exit(0);
}

/// Writes the tray menu in the language of the interface, and in the state of the player.
#[tauri::command]
pub fn set_tray_menu<R: Runtime>(
    app: AppHandle<R>,
    show: String,
    bring_to_front: String,
    stop: String,
    quit: String,
    can_stop: bool,
    can_bring_to_front: bool,
) -> bool {
    let Some(tray) = app.tray_by_id("main") else {
        return false;
    };

    match tray_menu(
        &app,
        &show,
        &bring_to_front,
        &stop,
        &quit,
        can_stop,
        can_bring_to_front,
    ) {
        Ok(menu) => tray.set_menu(Some(menu)).is_ok(),
        Err(_) => false,
    }
}
