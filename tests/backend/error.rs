    use super::*;

    #[test]
    fn not_found_has_a_readable_message() {
        let error = AppError::NotFound("C:/music/track.mp3".to_owned());

        assert_eq!(error.to_string(), "file not found: C:/music/track.mp3");
    }

    #[test]
    fn unsupported_format_has_a_readable_message() {
        let error = AppError::UnsupportedFormat("mid".to_owned());

        assert_eq!(error.to_string(), "unsupported format: mid");
    }

    #[test]
    fn invalid_audio_has_a_readable_message() {
        let error = AppError::InvalidAudio("corrupt tags".to_owned());

        assert_eq!(error.to_string(), "unreadable audio file: corrupt tags");
    }

    #[test]
    fn state_has_a_readable_message() {
        let error = AppError::State("poisoned lock".to_owned());

        assert_eq!(error.to_string(), "library unavailable: poisoned lock");
    }

    #[test]
    fn io_errors_are_converted_automatically() {
        let io_error = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "access denied");
        let error: AppError = io_error.into();

        assert!(matches!(error, AppError::Io(_)));
        assert!(error.to_string().contains("access denied"));
    }

    #[test]
    fn serialization_errors_are_converted_automatically() {
        let json_error = serde_json::from_str::<serde_json::Value>("{ invalid").unwrap_err();
        let error: AppError = json_error.into();

        assert!(matches!(error, AppError::Serialization(_)));
    }

    #[test]
    fn error_is_serialized_as_a_string() {
        let error = AppError::NotFound("track.mp3".to_owned());

        let json = serde_json::to_string(&error).expect("serialization succeeded");

        assert_eq!(json, "\"file not found: track.mp3\"");
    }
