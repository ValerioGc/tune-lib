    use super::*;
    use crate::fixtures::{mp3_with_tags, TempDir};
    use crate::library::Track;

    fn library_with(path: &std::path::Path) -> Library {
        let mut library = Library::new();
        library.tracks.push(Track {
            id: "id-1".to_owned(),
            path: path.to_string_lossy().into_owned(),
            title: "Track".to_owned(),
            artist: None,
            album: None,
            year: None,
            genre: None,
            duration_ms: 0,
            format: "mp3".to_owned(),
            has_cover: false,
            added_at: 0,
        });

        library
    }

    #[test]
    fn refuses_a_listed_path_that_is_not_an_audio_file() {
        let directory = TempDir::new("playback-not-audio");
        let intruder = directory.path().join("segreti.pdf");
        std::fs::write(&intruder, b"not music").expect("file written");
        let library = library_with(&intruder);

        let error = playable_path(&library, "id-1").unwrap_err();

        assert!(matches!(error, AppError::UnsupportedFormat(_)));
    }

    #[test]
    fn returns_the_path_of_a_present_track() {
        let directory = TempDir::new("playback");
        let file = mp3_with_tags(directory.path(), "track.mp3");
        let library = library_with(&file);

        let path = playable_path(&library, "id-1").expect("path risolto");

        assert_eq!(path, file);
    }

    #[test]
    fn rejects_an_unknown_id() {
        let library = Library::new();

        let error = playable_path(&library, "id-ignoto").expect_err("id sconosciuto");

        assert!(matches!(error, AppError::NotFound(id) if id == "id-ignoto"));
    }

    #[test]
    fn rejects_a_track_whose_file_disappeared() {
        let directory = TempDir::new("playback");
        let file = mp3_with_tags(directory.path(), "sparito");
        let library = library_with(&file);
        std::fs::remove_file(&file).expect("file removed");

        let error = playable_path(&library, "id-1").expect_err("missing file");

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn creates_a_standalone_track_from_an_audio_file() {
        let directory = TempDir::new("playback-standalone");
        let file = mp3_with_tags(directory.path(), "track.mp3");

        let track = standalone_track(&file).expect("standalone track");

        assert_eq!(track.track.path, file.display().to_string());
        assert_eq!(track.track.title, "Test Title");
        assert!(!track.missing);
    }

    #[test]
    fn rejects_an_external_file_that_is_not_audio() {
        let directory = TempDir::new("playback-external-unsupported");
        let file = directory.path().join("note.txt");
        std::fs::write(&file, b"text").expect("test file written");

        let error = playable_file_path(&file).expect_err("unsupported file");

        assert!(matches!(error, AppError::UnsupportedFormat(extension) if extension == "txt"));
    }

    #[test]
    fn finds_the_first_supported_startup_argument() {
        let directory = TempDir::new("playback-startup-args");
        let text = directory.path().join("note.txt");
        std::fs::write(&text, b"text").expect("test file written");
        let audio = mp3_with_tags(directory.path(), "track.mp3");

        let found = crate::state::StartupFile::from_arguments([
            PathBuf::from("--flag"),
            text,
            audio.clone(),
            directory.path().join("missing.mp3"),
        ])
        .path()
        .expect("audio path");

        assert_eq!(found, audio);
    }
