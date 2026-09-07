use std::path::{Path, PathBuf};
use crate::error::{AppError, AppResult};

pub fn destination(source: &Path, filename: &str) -> AppResult<PathBuf> {
    let stem = filename.split('.').next().unwrap_or_default().to_ascii_uppercase();
    let reserved = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (stem.starts_with("COM") || stem.starts_with("LPT"))
            && matches!(stem.get(3..), Some("1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"));
    if filename.trim().is_empty() {
        return Err(AppError::Validation("filenameRequired".into()));
    }
    if filename != filename.trim() || filename.ends_with('.') || reserved
        || filename.encode_utf16().count() > 255 || filename.len() > 255
        || filename.chars().any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        || Path::new(filename).file_stem().is_none_or(|s| s.is_empty())
    {
        return Err(AppError::Validation("filenameInvalid".into()));
    }
    if Path::new(filename).extension() != source.extension() {
        return Err(AppError::Validation("filenameExtension".into()));
    }
    Ok(source.with_file_name(filename))
}

/// Atomically refuse an existing destination on Windows, including case-only aliases.
pub fn move_file(source: &Path, target: &Path) -> AppResult<()> {
    if target.try_exists()? {
        return Err(AppError::Validation("filenameExists".into()));
    }
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        let source: Vec<u16> = source.as_os_str().encode_wide().chain([0]).collect();
        let target: Vec<u16> = target.as_os_str().encode_wide().chain([0]).collect();
        // SAFETY: both paths are owned, NUL-terminated buffers valid for this call.
        if unsafe { windows_sys::Win32::Storage::FileSystem::MoveFileW(source.as_ptr(), target.as_ptr()) } == 0 {
            let error = std::io::Error::last_os_error();
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                return Err(AppError::Validation("filenameExists".into()));
            }
            return Err(error.into());
        }
    }
    #[cfg(not(windows))]
    {
        // A same-directory link reserves the destination without replacing another file.
        std::fs::hard_link(source, target).map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                AppError::Validation("filenameExists".into())
            } else { error.into() }
        })?;
        if let Err(error) = std::fs::remove_file(source) {
            let _ = std::fs::remove_file(target);
            return Err(error.into());
        }
    }
    Ok(())
}
