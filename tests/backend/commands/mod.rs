    use super::*;

    #[test]
    fn app_info_exposes_package_name_and_version() {
        let info = app_info();

        assert_eq!(info.name, "tune-lib");
        assert_eq!(info.version, "1.0.0");
    }

    #[test]
    fn app_info_lists_supported_formats() {
        let info = build_app_info();

        assert_eq!(info.supported_extensions.len(), SUPPORTED_EXTENSIONS.len());
        assert!(info.supported_extensions.contains(&"mp3".to_owned()));
    }

    #[test]
    fn app_info_is_serializable_for_the_frontend() {
        let json = serde_json::to_string(&build_app_info()).expect("serialization succeeded");

        assert!(json.contains("\"supportedExtensions\""));
    }
