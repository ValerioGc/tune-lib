    use super::*;
    use crate::fixtures::{wav_with_tags, TempDir};
    use crate::library::{Library, Track};

    #[test]
    fn complete_flow_adds_lists_and_removes() {
        let dir = TempDir::new("commands-library");
        let track = wav_with_tags(dir.path(), "track.wav");
        let state = LibraryState::from_file(dir.path().join("library.json"));

        let report = state
            .update(|library| {
                library::add_paths(
                    library,
                    &[track.display().to_string()],
                    library::now_seconds(),
                )
            })
            .expect("import succeeded");
        assert_eq!(report.added.len(), 1);

        let views = state.read(library::to_views).expect("read succeeded");
        assert_eq!(views.len(), 1);
        assert!(!views[0].missing);

        let id = views[0].track.id.clone();
        let removed = state
            .update(|library: &mut Library| library.remove(&id))
            .expect("removal succeeded");

        assert!(removed);
        assert!(state.read(Library::is_empty).expect("read succeeded"));
        assert!(track.exists());
    }

    #[test]
    fn renames_the_library_and_returns_info() {
        let dir = TempDir::new("commands-library-name");
        let state = LibraryState::from_file(dir.path().join("library.json"));

        state
            .update(|library| library.rename("Archive"))
            .expect("update succeeded")
            .expect("rename succeeded");

        let info = state.read(info_of).expect("read succeeded");

        assert_eq!(info.name, "Archive");
    }

    #[test]
    fn verifies_a_tracked_file() {
        let dir = TempDir::new("commands-library-verify");
        let track = wav_with_tags(dir.path(), "track.wav");
        let state = LibraryState::from_file(dir.path().join("library.json"));
        state
            .update(|library| {
                library::add_paths(
                    library,
                    &[track.display().to_string()],
                    library::now_seconds(),
                )
            })
            .expect("import succeeded");
        let id = state
            .read(|library| library.tracks()[0].id.clone())
            .expect("read succeeded");

        let present = state
            .read(|library| library::view_of(library, &id))
            .expect("read succeeded")
            .expect("track present");
        assert!(!present.missing);

        std::fs::remove_file(&track).expect("file removed");

        let missing = state
            .read(|library| library::view_of(library, &id))
            .expect("read succeeded")
            .expect("track present");
        assert!(missing.missing);
    }

    #[test]
    fn exports_track_list_as_csv_with_escaping() {
        let tracks = vec![TrackView {
            track: Track {
                id: "aaa".to_owned(),
                path: "C:/music/track,one.mp3".to_owned(),
                title: "Track, \"one\"".to_owned(),
                artist: Some("Artist".to_owned()),
                album: None,
                year: Some(2000),
                genre: None,
                duration_ms: 185_000,
                format: "mp3".to_owned(),
                has_cover: false,
                added_at: 1,
            },
            missing: true,
        }];

        let contents = export_contents(
            &tracks,
            TrackListExportFormat::Csv,
            &[
                TrackListExportField::Title,
                TrackListExportField::Path,
                TrackListExportField::Missing,
            ],
        );

        assert_eq!(
            contents,
            "Name,Path,Missing file\n\"Track, \"\"one\"\"\",\"C:/music/track,one.mp3\",yes"
        );
    }

    #[test]
    fn a_title_that_looks_like_a_formula_is_exported_as_text() {
        let tracks = vec![TrackView {
            track: Track {
                id: "aaa".to_owned(),
                path: "C:/music/track.mp3".to_owned(),
                title: "=cmd|'/c calc'!A0".to_owned(),
                artist: None,
                album: None,
                year: None,
                genre: None,
                duration_ms: 0,
                format: "mp3".to_owned(),
                has_cover: false,
                added_at: 1,
            },
            missing: false,
        }];

        let contents = export_contents(
            &tracks,
            TrackListExportFormat::Csv,
            &[TrackListExportField::Title],
        );

        // The apostrophe is what a spreadsheet reads as "this cell is a word".
        assert!(
            contents.ends_with("'=cmd|'/c calc'!A0"),
            "contenuto inatteso: {contents}"
        );
    }

    #[test]
    fn exports_track_list_as_txt() {
        let tracks = vec![TrackView {
            track: Track {
                id: "aaa".to_owned(),
                path: "C:/music/track.mp3".to_owned(),
                title: "Track".to_owned(),
                artist: None,
                album: None,
                year: None,
                genre: None,
                duration_ms: 185_000,
                format: "mp3".to_owned(),
                has_cover: false,
                added_at: 1,
            },
            missing: false,
        }];

        let contents = export_contents(
            &tracks,
            TrackListExportFormat::Txt,
            &[TrackListExportField::Title, TrackListExportField::Duration],
        );

        assert_eq!(contents, "Name: Track\nDuration: 3:05");
    }
