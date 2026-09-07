// Hides the Windows console in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    media_audio_lib_lib::run()
}
