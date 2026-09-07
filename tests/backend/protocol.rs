    use super::*;
    use crate::fixtures::{mp3_with_tags, wav_with_tags, TempDir};

    fn request(path: &Path, range: Option<&str>) -> Request<Vec<u8>> {
        let displayed = path.display().to_string();
        let encoded =
            percent_encoding::utf8_percent_encode(&displayed, percent_encoding::NON_ALPHANUMERIC);
        let builder = Request::builder().uri(format!("track://localhost/{encoded}"));

        let builder = match range {
            Some(value) => builder.header(header::RANGE, value),
            None => builder,
        };

        builder.body(Vec::new()).expect("valid request")
    }

    #[test]
    fn a_file_the_library_does_not_hold_is_refused() {
        let directory = TempDir::new("protocol-forbidden");
        let track = mp3_with_tags(directory.path(), "track.mp3");

        let response = respond(&request(&track, None), false);

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(response.body().is_empty(), "no bytes leave the application");
    }

    #[test]
    fn an_unregistered_hard_link_does_not_grant_another_path_access() {
        let directory = TempDir::new("protocol-link");
        let track = mp3_with_tags(directory.path(), "track.mp3");
        let alias = directory.path().join("unregistered.mp3");
        std::fs::hard_link(&track, &alias).unwrap();
        let mut library = crate::library::Library::new();
        crate::library::add_paths(&mut library, &[track.display().to_string()], 0);
        let state = LibraryState::new(directory.path().join("library.json"), library);
        assert!(is_playable_now(&state, &StartupFile::default(), &track));
        assert!(!is_playable_now(&state, &StartupFile::default(), &alias));
        let traversal = directory.path().join("sub/../unregistered.mp3");
        assert!(!is_playable_now(&state, &StartupFile::default(), &traversal));
    }

    #[test]
    fn a_file_of_the_library_comes_back_whole() {
        let directory = TempDir::new("protocol-whole");
        let track = mp3_with_tags(directory.path(), "track.mp3");
        let on_disk = std::fs::read(&track).expect("readable file");

        let response = respond(&request(&track, None), true);

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body(), &on_disk);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "audio/mpeg"
        );
        assert_eq!(
            response.headers().get(header::ACCEPT_RANGES).unwrap(),
            "bytes"
        );
    }

    #[test]
    fn a_seek_is_answered_with_the_piece_it_asked_for() {
        let directory = TempDir::new("protocol-range");
        let track = wav_with_tags(directory.path(), "track.wav");
        let on_disk = std::fs::read(&track).expect("readable file");
        let length = on_disk.len() as u64;

        let response = respond(&request(&track, Some("bytes=4-9")), true);

        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.body(), &on_disk[4..=9]);
        assert_eq!(
            response.headers().get(header::CONTENT_RANGE).unwrap(),
            &format!("bytes 4-9/{length}")
        );
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "audio/wav"
        );
    }

    /// What a media element sends when it starts playing: everything from here on.
    #[test]
    fn an_open_ended_range_runs_to_the_end_of_the_file() {
        let directory = TempDir::new("protocol-open-range");
        let track = wav_with_tags(directory.path(), "track.wav");
        let on_disk = std::fs::read(&track).expect("readable file");
        let length = on_disk.len() as u64;

        let response = respond(&request(&track, Some("bytes=0-")), true);

        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.body().len() as u64, length);
        assert_eq!(
            response.headers().get(header::CONTENT_RANGE).unwrap(),
            &format!("bytes 0-{}/{length}", length - 1)
        );
    }

    #[test]
    fn a_range_past_the_end_of_the_file_is_told_so() {
        let directory = TempDir::new("protocol-bad-range");
        let track = wav_with_tags(directory.path(), "track.wav");
        let length = std::fs::metadata(&track).expect("readable file").len();

        let response = respond(
            &request(&track, Some(&format!("bytes={}-{}", length + 10, length + 20))),
            true,
        );

        assert_eq!(response.status(), StatusCode::RANGE_NOT_SATISFIABLE);
        assert_eq!(
            response.headers().get(header::CONTENT_RANGE).unwrap(),
            &format!("bytes */{length}")
        );
    }

    #[test]
    fn a_request_for_several_pieces_at_once_gets_the_whole_file() {
        let directory = TempDir::new("protocol-multi-range");
        let track = wav_with_tags(directory.path(), "track.wav");
        let on_disk = std::fs::read(&track).expect("readable file");

        let response = respond(&request(&track, Some("bytes=0-3,8-11")), true);

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body(), &on_disk);
    }

    #[test]
    fn a_file_that_is_no_longer_there_is_a_404() {
        let directory = TempDir::new("protocol-missing");
        let gone = directory.path().join("track.mp3");

        let response = respond(&request(&gone, None), true);

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn large_files_require_ranges_and_never_allocate_the_whole_file() {
        let directory = TempDir::new("protocol-large");
        let path = directory.path().join("large.wav");
        File::create(&path).unwrap().set_len(MAX_FULL_RESPONSE_BYTES + 1).unwrap();
        let response = respond(&request(&path, None), true);
        assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
        assert!(response.body().is_empty());
        let response = respond(&request(&path, Some("bytes=0-")), true);
        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.body().len() as u64, MAX_RANGE_BYTES);
        let mut head = request(&path, None);
        *head.method_mut() = Method::HEAD;
        let response = respond(&head, true);
        assert_eq!(response.status(), StatusCode::OK);
        assert!(response.body().is_empty());
    }

    #[test]
    fn refuses_foreign_origins_and_write_methods() {
        let directory = TempDir::new("protocol-origin");
        let path = wav_with_tags(directory.path(), "track.wav");
        let mut foreign = request(&path, None);
        foreign.headers_mut().insert(header::ORIGIN, "https://example.com".parse().unwrap());
        assert_eq!(respond(&foreign, true).status(), StatusCode::FORBIDDEN);
        foreign.headers_mut().insert(header::ORIGIN, "http://tauri.localhost".parse().unwrap());
        let response = respond(&foreign, true);
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::ACCESS_CONTROL_ALLOW_ORIGIN], "http://tauri.localhost");
        assert_eq!(response.headers()[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
        *foreign.method_mut() = Method::POST;
        assert_eq!(respond(&foreign, true).status(), StatusCode::METHOD_NOT_ALLOWED);
    }

    #[test]
    fn refuses_malformed_ranges_and_detects_truncated_reads() {
        let directory = TempDir::new("protocol-invalid");
        let path = wav_with_tags(directory.path(), "track.wav");
        let mut invalid = request(&path, None);
        invalid.headers_mut().insert(header::RANGE, tauri::http::HeaderValue::from_bytes(&[0xff]).unwrap());
        assert_eq!(respond(&invalid, true).status(), StatusCode::RANGE_NOT_SATISFIABLE);
        let long = format!("bytes={}", "0".repeat(257));
        assert_eq!(respond(&request(&path, Some(&long)), true).status(), StatusCode::RANGE_NOT_SATISFIABLE);
        let mut file = File::open(&path).unwrap();
        let length = file.metadata().unwrap().len();
        assert!(read_at(&mut file, length, length + 1).is_err());
        let empty_path = directory.path().join("empty.wav");
        File::create(&empty_path).unwrap();
        assert_eq!(respond(&request(&empty_path, Some("bytes=0-")), true).status(), StatusCode::RANGE_NOT_SATISFIABLE);
        assert_eq!(respond(&request(&path, Some("bytes=-0")), true).status(), StatusCode::RANGE_NOT_SATISFIABLE);
    }

    #[test]
    fn only_a_file_of_the_library_or_the_one_the_system_handed_over_is_playable() {
        let directory = TempDir::new("protocol-known");
        let track = mp3_with_tags(directory.path(), "track.mp3");
        let stranger = mp3_with_tags(directory.path(), "stranger.mp3");
        let document = directory.path().join("appunti.txt");
        std::fs::write(&document, b"testo").expect("file written");

        let mut library = crate::library::Library::new();
        crate::library::add_paths(&mut library, &[track.display().to_string()], 0);
        let state = LibraryState::new(directory.path().join("library.json"), library);
        let startup = StartupFile::from_arguments([stranger.clone()]);

        assert!(is_playable_now(&state, &startup, &track));
        assert!(is_playable_now(&state, &startup, &stranger));
        assert!(!is_playable_now(&state, &startup, &document));
        assert!(!is_playable_now(
            &state,
            &startup,
            &directory.path().join("mai-vista.mp3")
        ));
    }
