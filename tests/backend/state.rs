    use super::*;
    use crate::fixtures::TempDir;
    use crate::library::Track;

    fn sample_track() -> Track {
        Track {
            id: "aaa".to_owned(),
            path: "C:/music/track.mp3".to_owned(),
            title: "Title".to_owned(),
            artist: None,
            album: None,
            year: None,
            genre: None,
            duration_ms: 0,
            format: "mp3".to_owned(),
            has_cover: false,
            added_at: 0,
        }
    }

    #[test]
    fn starts_from_an_empty_library_when_file_does_not_exist() {
        let dir = TempDir::new("state-empty");
        let state = LibraryState::from_file(dir.path().join("library.json"));

        assert_eq!(state.read(Library::len).expect("read succeeded"), 0);
    }

    #[test]
    fn reloads_the_saved_library() {
        let dir = TempDir::new("state-reload");
        let file = dir.path().join("library.json");
        let mut library = Library::new();
        library.add(sample_track());
        library.save(&file).expect("save succeeded");

        let state = LibraryState::from_file(file.clone());

        assert_eq!(state.read(Library::len).expect("read succeeded"), 1);
    }

    #[test]
    fn starts_empty_when_file_is_unreadable() {
        let dir = TempDir::new("state-broken");
        let file = dir.path().join("library.json");
        std::fs::write(&file, "{ invalid").expect("file written");

        let state = LibraryState::from_file(file.clone());

        assert_eq!(state.read(Library::len).expect("read succeeded"), 0);
    }

    #[test]
    fn every_change_lands_on_disk() {
        let dir = TempDir::new("state-update");
        let file = dir.path().join("library.json");
        let state = LibraryState::from_file(file.clone());

        let added = state
            .update(|library| library.add(sample_track()))
            .expect("update succeeded");

        assert!(added);
        assert_eq!(Library::load(&file).expect("loading").len(), 1);
    }

    #[test]
    fn v1_library_is_migrated_by_rereading_tags_from_file() {
        let dir = TempDir::new("state-migration");
        let file = dir.path().join("library.json");
        let track = crate::fixtures::wav_with_tags(dir.path(), "track.wav");
        let id = crate::library::track_id(&track);

        // A v1 library: the artist field did not exist yet.
        std::fs::write(
            &file,
            format!(
                r#"{{"version":1,"tracks":[{{"id":"{id}","path":{path},
                   "title":"Title","album":null,"year":null,"genre":null,
                   "durationMs":0,"format":"wav","hasCover":false,"addedAt":42}}]}}"#,
                path = serde_json::to_string(&track.display().to_string()).expect("path"),
            ),
        )
        .expect("file written");

        let state = LibraryState::from_file(file.clone());

        // Opening only reconciles the paths: the tags are read again by the refresh the
        // frontend asks for once the library is on screen.
        state
            .update(crate::library::refresh_metadata)
            .expect("refresh succeeded");

        let track = state
            .read(|library| library.get(&id).cloned())
            .expect("read succeeded")
            .expect("track present");
        assert_eq!(track.artist.as_deref(), Some("Test Artist"));
        assert_eq!(track.title, "Test Title");

        // The migration is persisted: restart does not need to run it again.
        let reloaded = Library::load(&file).expect("reloaded");
        assert_eq!(
            reloaded.get(&id).expect("present").artist.as_deref(),
            Some("Test Artist")
        );
        assert_eq!(reloaded.version, crate::library::SCHEMA_VERSION);
    }

    #[test]
    fn a_refresh_brings_in_the_tags_edited_outside_the_app() {
        let dir = TempDir::new("state-refresh");
        let file = dir.path().join("library.json");
        let track = crate::fixtures::wav_with_tags(dir.path(), "track.wav");

        let mut library = Library::new();
        library.add(Track {
            id: crate::library::track_id(&track),
            path: track.display().to_string(),
            title: "User chosen title".to_owned(),
            ..sample_track()
        });
        library.save(&file).expect("save succeeded");

        let state = LibraryState::from_file(file.clone());

        // The list is handed over as it was saved, without a file read per track.
        assert_eq!(
            state
                .read(|library| library.tracks()[0].title.clone())
                .expect("read"),
            "User chosen title"
        );

        state
            .update(crate::library::refresh_metadata)
            .expect("refresh succeeded");

        assert_eq!(
            state
                .read(|library| library.tracks()[0].title.clone())
                .expect("read"),
            "Test Title"
        );

        assert_eq!(
            Library::load(&file).expect("reloaded").tracks()[0]
                .title
                .as_str(),
            "Test Title"
        );
    }

    #[test]
    fn opening_a_library_removes_duplicate_entries_for_the_same_file() {
        let dir = TempDir::new("state-deduplicate");
        let file = dir.path().join("library.json");
        let track = crate::fixtures::wav_with_tags(dir.path(), "track.wav");
        let mut library = Library::new();
        library.tracks.push(Track {
            id: "old-id".to_owned(),
            path: track.display().to_string(),
            title: "First".to_owned(),
            ..sample_track()
        });
        library.tracks.push(Track {
            id: "other-old-id".to_owned(),
            path: track.display().to_string(),
            title: "Duplicate".to_owned(),
            ..sample_track()
        });
        library.save(&file).expect("save succeeded");

        let state = LibraryState::from_file(file.clone());

        assert_eq!(state.read(Library::len).expect("read"), 1);
        assert_eq!(Library::load(&file).expect("reloaded").len(), 1);
    }

    #[test]
    fn answers_whether_it_holds_a_file_and_notices_when_that_changes() {
        let dir = TempDir::new("state-holds");
        let track = crate::fixtures::mp3_with_tags(dir.path(), "track.mp3");
        let state = LibraryState::new(dir.path().join("library.json"), Library::new());

        assert!(!state.holds_file(&track).expect("risposta"));

        state
            .update(|library| {
                crate::library::add_paths(library, &[track.display().to_string()], 0)
            })
            .expect("track added");

        // The set is built on the first question and dropped by the change above, so this
        // is the new answer and not the one from before.
        assert!(state.holds_file(&track).expect("risposta"));
        assert!(!state
            .holds_file(&dir.path().join("altro.mp3"))
            .expect("risposta"));
    }

    #[test]
    fn a_derived_change_waits_for_a_reason_to_be_written() {
        let dir = TempDir::new("state-derived");
        let file = dir.path().join("library.json");
        let state = LibraryState::new(file.clone(), Library::new());
        state.update(|_| ()).expect("first write");

        state
            .update_derived(|library| library.rename("Derivata"))
            .expect("cambiamento derivato")
            .expect("valid name");

        assert_eq!(
            Library::load(&file).expect("read back").name,
            crate::library::DEFAULT_LIBRARY_NAME,
            "the file was not written again"
        );

        state.flush().expect("deferred write");

        assert_eq!(Library::load(&file).expect("read back").name, "Derivata");
    }

    #[test]
    fn a_change_from_the_user_is_written_at_once() {
        let dir = TempDir::new("state-durable");
        let file = dir.path().join("library.json");
        let state = LibraryState::new(file.clone(), Library::new());

        state
            .update(|library| library.rename("Scelta"))
            .expect("aggiornamento")
            .expect("valid name");

        assert_eq!(Library::load(&file).expect("read back").name, "Scelta");
    }

    #[test]
    fn exposes_the_library_file_path() {
        let dir = TempDir::new("state-path");
        let file = dir.path().join("library.json");
        let state = LibraryState::new(file.clone(), Library::new());

        assert_eq!(state.file().expect("path read"), file);
    }
