//! Reads effective file associations without changing the user's defaults.

#[cfg(windows)]
mod windows {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::path::{Path, PathBuf};

    use windows_sys::Win32::UI::Shell::{
        AssocQueryStringW, ASSOCF_INIT_IGNOREUNKNOWN, ASSOCSTR_EXECUTABLE,
    };

    use crate::metadata::SUPPORTED_EXTENSIONS;

    fn associated_executable(extension: &str) -> Option<PathBuf> {
        let extension: Vec<u16> = format!(".{extension}").encode_utf16().chain([0]).collect();
        let mut length = 0;
        // SAFETY: the extension is NUL-terminated; the output is null to query its size.
        let status = unsafe {
            AssocQueryStringW(
                ASSOCF_INIT_IGNOREUNKNOWN,
                ASSOCSTR_EXECUTABLE,
                extension.as_ptr(),
                std::ptr::null(),
                std::ptr::null_mut(),
                &mut length,
            )
        };
        if status < 0 || length == 0 {
            return None;
        }
        let mut buffer = vec![0; length as usize];
        // SAFETY: all pointers remain valid for the call and the buffer holds `length` units.
        let status = unsafe {
            AssocQueryStringW(
                ASSOCF_INIT_IGNOREUNKNOWN,
                ASSOCSTR_EXECUTABLE,
                extension.as_ptr(),
                std::ptr::null(),
                buffer.as_mut_ptr(),
                &mut length,
            )
        };
        if status != 0 {
            return None;
        }
        let end = buffer.iter().position(|unit| *unit == 0)?;
        Some(PathBuf::from(OsString::from_wide(&buffer[..end])))
    }

    fn all_associated_with(
        executable: &Path,
        mut query: impl FnMut(&str) -> Option<PathBuf>,
    ) -> bool {
        SUPPORTED_EXTENSIONS.iter().all(|extension| {
            let Some(associated) = query(extension).and_then(|path| path.canonicalize().ok())
            else {
                return false;
            };
            // Canonical paths also resolve short names and normalize Windows path prefixes.
            associated.to_string_lossy().to_lowercase()
                == executable.to_string_lossy().to_lowercase()
        })
    }

    pub(super) fn detect() -> Option<bool> {
        let executable = std::env::current_exe().ok()?.canonicalize().ok()?;
        Some(all_associated_with(&executable, associated_executable))
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn checks_every_supported_extension() {
            let executable = std::env::current_exe().unwrap().canonicalize().unwrap();
            let mut queried = Vec::new();
            assert!(all_associated_with(&executable, |extension| {
                queried.push(extension.to_owned());
                Some(executable.clone())
            }));
            assert_eq!(queried, SUPPORTED_EXTENSIONS);
        }

        #[test]
        fn partial_or_missing_associations_are_not_default() {
            let executable = std::env::current_exe().unwrap().canonicalize().unwrap();
            assert!(!all_associated_with(&executable, |extension| {
                (extension != "wav").then(|| executable.clone())
            }));
            assert!(!all_associated_with(&executable, |_| None));
        }

        #[test]
        fn same_name_in_another_installation_is_not_this_executable() {
            let executable = std::env::current_exe().unwrap().canonicalize().unwrap();
            let directory = tempfile::tempdir().unwrap();
            let other = directory.path().join(executable.file_name().unwrap());
            std::fs::write(&other, []).unwrap();
            assert!(!all_associated_with(&executable, |_| Some(other.clone())));
        }

        #[test]
        fn reads_windows_associations_without_registering_anything() {
            assert!(associated_executable("tunelib-test-unregistered-extension").is_none());
            assert!(detect().is_some());
        }
    }
}

/// `None` means detection is unavailable; it is never persisted as a dismissed banner.
#[tauri::command]
pub async fn is_default_audio_player() -> Option<bool> {
    #[cfg(windows)]
    {
        tauri::async_runtime::spawn_blocking(windows::detect)
            .await
            .ok()
            .flatten()
    }
    #[cfg(not(windows))]
    {
        None
    }
}
