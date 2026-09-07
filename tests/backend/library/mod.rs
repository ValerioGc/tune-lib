    use super::*;
    use crate::fixtures::{
        corrupted_file, wav_with_cover, wav_with_tags, wav_without_tags, TempDir,
    };

    fn sample_track(id: &str) -> Track {
        Track {
            id: id.to_owned(),
            path: format!("C:/music/{id}.mp3"),
            title: "Title".to_owned(),
            artist: None,
            album: None,
            year: None,
            genre: None,
            duration_ms: 1000,
            format: "mp3".to_owned(),
            has_cover: false,
            added_at: 42,
        }
    }

    fn sample_cover() -> Cover {
        Cover {
            mime_type: "image/png".to_owned(),
            data: crate::fixtures::png_cover_base64(),
        }
    }

    #[test]
    fn imported_artwork_is_validated_before_it_reaches_the_webview() {
        let dir = TempDir::new("untrusted-artwork");
        let path = dir.path().join("library.json");
        let mut library = Library::new();
        library.add(Track { artist: Some("Artist".to_owned()), ..sample_track("a") });
        library.metadata.artist_artwork.push(LibraryArtwork {
            name: "Artist".to_owned(), cover: Cover { mime_type: "image/svg+xml".to_owned(), data: "PHN2Zy8+".to_owned() },
        });
        library.save(&path).unwrap();
        assert!(Library::load(&path).unwrap().metadata.artist_artwork.is_empty());
        assert!(load_for_import(&path).unwrap().metadata.artist_artwork.is_empty());
    }

    #[test]
    fn new_library_is_empty_and_versioned() {
        let library = Library::new();

        assert!(library.is_empty());
        assert_eq!(library.version, SCHEMA_VERSION);
        assert_eq!(library.name, DEFAULT_LIBRARY_NAME);
        assert_eq!(library.metadata, LibraryMetadata::default());
    }

    #[test]
    fn missing_file_produces_an_empty_library() {
        let dir = TempDir::new("library-missing");

        let library = Library::load(&dir.path().join("library.json")).expect("loading riuscito");

        assert!(library.is_empty());
    }

    #[test]
    fn round_trips_on_disk() {
        let dir = TempDir::new("library-roundtrip");
        let file = dir.path().join("nested").join("library.json");
        let mut library = Library::new();
        library.rename("Jazz Archive").expect("rename succeeded");
        library.add(sample_track("aaa"));
        library.add(sample_track("bbb"));

        library.save(&file).expect("save succeeded");
        let reloaded = Library::load(&file).expect("loading riuscito");

        assert_eq!(reloaded, library);
        assert!(!file.with_file_name("library.json.tmp").exists());
    }

    #[test]
    fn overwrites_the_existing_file() {
        let dir = TempDir::new("library-overwrite");
        let file = dir.path().join("library.json");
        let mut library = Library::new();
        library.add(sample_track("aaa"));
        library.save(&file).expect("first save");

        library.remove("aaa");
        library.save(&file).expect("second save");

        assert!(Library::load(&file).expect("loading riuscito").is_empty());
    }

    #[test]
    fn unreadable_file_is_a_serialization_error() {
        let dir = TempDir::new("library-broken");
        let file = dir.path().join("library.json");
        std::fs::write(&file, "{ invalid").expect("file written");

        assert!(matches!(
            Library::load(&file).unwrap_err(),
            AppError::Serialization(_)
        ));
    }

    #[test]
    fn rejects_a_newer_schema() {
        let dir = TempDir::new("library-future");
        let file = dir.path().join("library.json");
        std::fs::write(&file, r#"{"version":99,"tracks":[]}"#).expect("file written");

        assert!(matches!(
            Library::load(&file).unwrap_err(),
            AppError::UnsupportedFormat(_)
        ));
    }

    #[test]
    fn accepts_an_older_schema_by_realigning_the_version() {
        let dir = TempDir::new("library-old");
        let file = dir.path().join("library.json");
        std::fs::write(&file, r#"{"version":0,"tracks":[]}"#).expect("file written");

        let library = Library::load(&file).expect("loading riuscito");

        assert_eq!(library.version, SCHEMA_VERSION);
    }

    #[test]
    fn reads_a_v2_library_without_a_name() {
        let dir = TempDir::new("library-v2");
        let file = dir.path().join("library.json");
        std::fs::write(&file, r#"{"version":2,"tracks":[]}"#).expect("file written");

        let library = Library::load(&file).expect("loading riuscito");

        assert_eq!(library.name, DEFAULT_LIBRARY_NAME);
        assert_eq!(library.version, SCHEMA_VERSION);
    }

    #[test]
    fn reads_a_v1_library_without_the_artist_field() {
        let dir = TempDir::new("library-v1");
        let file = dir.path().join("library.json");
        std::fs::write(
            &file,
            r#"{"version":1,"tracks":[{"id":"aaa","path":"C:/music/aaa.mp3",
               "title":"Title","album":null,"year":null,"genre":null,
               "durationMs":1000,"format":"mp3","hasCover":false,"addedAt":42}]}"#,
        )
        .expect("file written");

        let library = Library::load(&file).expect("loading riuscito");

        assert_eq!(library.len(), 1);
        assert_eq!(library.get("aaa").expect("present").artist, None);
        assert_eq!(library.version, SCHEMA_VERSION);
    }

    #[test]
    fn rebuilds_metadata_indexes_when_loading_an_old_library() {
        let dir = TempDir::new("library-metadata-load");
        let file = dir.path().join("library.json");
        std::fs::write(
            &file,
            r#"{"version":3,"name":"Archive","tracks":[
              {"id":"aaa","path":"C:/music/aaa.mp3","title":"A","artist":"Artist B",
               "album":"Album B","year":null,"genre":"Rock","durationMs":1000,
               "format":"mp3","hasCover":false,"addedAt":42},
              {"id":"bbb","path":"C:/music/bbb.mp3","title":"B","artist":"Artist A",
               "album":"Album A","year":null,"genre":"Jazz","durationMs":1000,
               "format":"mp3","hasCover":false,"addedAt":42}
            ]}"#,
        )
        .expect("file written");

        let library = Library::load(&file).expect("loading riuscito");

        assert_eq!(library.metadata.artists, vec!["Artist A", "Artist B"]);
        assert_eq!(library.metadata.albums, vec!["Album A", "Album B"]);
        assert_eq!(library.metadata.genres, vec!["Jazz", "Rock"]);
    }

    #[test]
    fn adds_and_removes_tracks() {
        let mut library = Library::new();

        assert!(library.add(sample_track("aaa")));
        assert_eq!(library.len(), 1);
        assert!(library.get("aaa").is_some());
        assert!(library.remove("aaa"));
        assert!(library.is_empty());
    }

    #[test]
    fn keeps_library_metadata_in_sync_when_tracks_are_removed() {
        let mut library = Library::new();
        library.add(Track {
            artist: Some("Artist A".to_owned()),
            album: Some("Album A".to_owned()),
            genre: Some("Jazz".to_owned()),
            ..sample_track("aaa")
        });
        library.add(Track {
            artist: Some("Artist B".to_owned()),
            album: Some("Album B".to_owned()),
            genre: Some("Rock".to_owned()),
            ..sample_track("bbb")
        });

        assert_eq!(library.metadata.artists, vec!["Artist A", "Artist B"]);
        assert_eq!(library.metadata.albums, vec!["Album A", "Album B"]);
        assert_eq!(library.metadata.genres, vec!["Jazz", "Rock"]);

        assert!(library.remove("aaa"));

        assert_eq!(library.metadata.artists, vec!["Artist B"]);
        assert_eq!(library.metadata.albums, vec!["Album B"]);
        assert_eq!(library.metadata.genres, vec!["Rock"]);
    }

    #[test]
    fn removes_artwork_when_its_metadata_value_disappears() {
        let mut library = Library::new();
        library.add(Track {
            artist: Some("Artist A".to_owned()),
            genre: Some("Jazz".to_owned()),
            ..sample_track("aaa")
        });
        library.metadata.artist_artwork.push(LibraryArtwork {
            name: "Artist A".to_owned(),
            cover: sample_cover(),
        });
        library.metadata.genre_artwork.push(LibraryArtwork {
            name: "Jazz".to_owned(),
            cover: sample_cover(),
        });

        assert!(library.remove("aaa"));

        assert!(library.metadata.artist_artwork.is_empty());
        assert!(library.metadata.genre_artwork.is_empty());
    }

    #[test]
    fn fills_missing_artist_and_genre_artwork_from_track_covers() {
        let dir = TempDir::new("library-artwork-fill");
        let path = wav_with_cover(dir.path(), "track.wav");
        let mut library = Library::new();
        library.add(Track {
            id: track_id(&path),
            path: path.display().to_string(),
            artist: Some("Artist A".to_owned()),
            genre: Some("Jazz".to_owned()),
            has_cover: true,
            ..sample_track("aaa")
        });

        let filled = library.fill_missing_artwork();

        assert_eq!(filled, 2);
        assert_eq!(library.metadata.artist_artwork.len(), 1);
        assert_eq!(library.metadata.genre_artwork.len(), 1);
        assert_eq!(library.metadata.artist_artwork[0].name, "Artist A");
        assert_eq!(library.metadata.genre_artwork[0].name, "Jazz");
        assert_eq!(
            library.metadata.artist_artwork[0].cover.mime_type,
            "image/png"
        );
        assert!(!library.metadata.artist_artwork[0].cover.data.is_empty());
    }

    #[test]
    fn does_not_replace_existing_artwork_when_filling_missing_artwork() {
        let dir = TempDir::new("library-artwork-existing");
        let path = wav_with_cover(dir.path(), "track.wav");
        let mut library = Library::new();
        library.add(Track {
            id: track_id(&path),
            path: path.display().to_string(),
            artist: Some("Artist A".to_owned()),
            has_cover: true,
            ..sample_track("aaa")
        });
        library.metadata.artist_artwork.push(LibraryArtwork {
            name: "Artist A".to_owned(),
            cover: sample_cover(),
        });

        let filled = library.fill_missing_artwork();

        assert_eq!(filled, 0);
        assert_eq!(library.metadata.artist_artwork.len(), 1);
        assert_eq!(library.metadata.artist_artwork[0].cover.data, sample_cover().data);
    }

    #[test]
    fn renames_the_library_validating_the_name() {
        let mut library = Library::new();

        assert_eq!(
            library.rename("  Personal Archive  ").expect("rename"),
            "Personal Archive"
        );
        assert_eq!(library.name, "Personal Archive");
        assert!(matches!(
            library.rename("   ").unwrap_err(),
            AppError::Validation(_)
        ));
        assert_eq!(library.name, "Personal Archive");
    }

    #[test]
    fn ignores_removal_of_an_unknown_id() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        assert!(!library.remove("zzz"));
        assert_eq!(library.len(), 1);
    }

    #[test]
    fn imports_by_replacing_the_current_library() {
        let mut library = Library::new();
        library.rename("Vecchia").expect("valid name");
        library.add(sample_track("aaa"));
        let mut imported = Library::new();
        imported.rename("Nuova").expect("valid name");
        imported.add(Track {
            artist: Some("Artist B".to_owned()),
            ..sample_track("bbb")
        });
        imported.metadata.artist_artwork.push(LibraryArtwork {
            name: "Artist B".to_owned(),
            cover: sample_cover(),
        });

        let report = library.import(imported, LibraryImportStrategy::Replace);

        assert_eq!(library.name, "Nuova");
        assert_eq!(library.len(), 1);
        assert_eq!(library.tracks()[0].path, "C:/music/bbb.mp3");
        assert_eq!(library.metadata.artist_artwork.len(), 1);
        assert_eq!(library.metadata.artist_artwork[0].name, "Artist B");
        assert_eq!(report.added, 1);
        assert_eq!(report.total, 1);
    }

    #[test]
    fn imports_by_merging_and_updating_duplicates() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));
        let mut imported = Library::new();
        imported.add(Track {
            title: "Aggiornato".to_owned(),
            ..sample_track("aaa")
        });
        imported.add(sample_track("bbb"));

        let report = library.import(imported, LibraryImportStrategy::Merge);

        assert_eq!(library.len(), 2);
        assert!(library
            .tracks()
            .iter()
            .any(|track| track.path == "C:/music/aaa.mp3" && track.title == "Aggiornato"));
        assert_eq!(report.updated, 1);
        assert_eq!(report.added, 1);
    }

    #[test]
    fn imports_missing_artwork_when_merging() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));
        let mut imported = Library::new();
        imported.add(Track {
            artist: Some("Artist B".to_owned()),
            genre: Some("Jazz".to_owned()),
            ..sample_track("bbb")
        });
        imported.metadata.artist_artwork.push(LibraryArtwork {
            name: "Artist B".to_owned(),
            cover: sample_cover(),
        });
        imported.metadata.genre_artwork.push(LibraryArtwork {
            name: "Jazz".to_owned(),
            cover: sample_cover(),
        });

        library.import(imported, LibraryImportStrategy::Merge);

        assert_eq!(library.metadata.artist_artwork.len(), 1);
        assert_eq!(library.metadata.artist_artwork[0].name, "Artist B");
        assert_eq!(library.metadata.genre_artwork.len(), 1);
        assert_eq!(library.metadata.genre_artwork[0].name, "Jazz");
    }

    #[test]
    fn imports_by_merging_and_skipping_duplicates() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));
        let mut imported = Library::new();
        imported.add(Track {
            title: "Aggiornato".to_owned(),
            ..sample_track("aaa")
        });
        imported.add(sample_track("bbb"));

        let report = library.import(imported, LibraryImportStrategy::MergeSkipDuplicates);

        assert_eq!(library.len(), 2);
        assert_eq!(library.get("aaa").expect("present").title, "Title");
        assert_eq!(report.skipped, 1);
        assert_eq!(report.added, 1);
    }

    #[test]
    fn imports_by_matching_duplicate_paths_even_when_ids_differ() {
        let mut library = Library::new();
        let existing = Track {
            id: "old-id".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            title: "Old title".to_owned(),
            ..sample_track("aaa")
        };
        let incoming = Track {
            id: "new-id".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            title: "New title".to_owned(),
            ..sample_track("bbb")
        };
        library.add(existing);
        let mut imported = Library::new();
        imported.tracks.push(incoming);

        let report = library.import(imported, LibraryImportStrategy::Merge);

        assert_eq!(library.len(), 1);
        assert_eq!(library.tracks()[0].title, "New title");
        assert_eq!(report.updated, 1);
    }

    #[test]
    fn importing_by_replacement_keeps_one_entry_per_file() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));
        let shared = Track {
            id: "first".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            ..sample_track("bbb")
        };
        let duplicate = Track {
            id: "second".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            ..sample_track("ccc")
        };
        let mut imported = Library::new();
        imported.tracks.push(shared);
        imported.tracks.push(duplicate);

        let report = library.import(imported, LibraryImportStrategy::Replace);

        assert_eq!(library.len(), 1);
        assert_eq!(report.total, 2);
        assert_eq!(report.added, 1);
        assert_eq!(report.skipped, 1);
    }

    #[test]
    fn import_reports_files_missing_on_disk() {
        let mut library = Library::new();
        let mut imported = Library::new();
        imported.add(sample_track("aaa"));

        let report = library.import(imported, LibraryImportStrategy::Merge);

        assert_eq!(report.missing, vec!["C:/music/aaa.mp3"]);
    }

    #[test]
    fn rejects_duplicates() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        assert!(!library.add(sample_track("aaa")));
        assert_eq!(library.len(), 1);
    }

    #[test]
    fn rejects_tracks_pointing_to_the_same_file_even_with_different_ids() {
        let mut library = Library::new();
        let first = sample_track("aaa");
        let duplicate = Track {
            id: "different-id".to_owned(),
            ..first.clone()
        };

        assert!(library.add(first));
        assert!(!library.add(duplicate));
        assert_eq!(library.len(), 1);
    }

    #[test]
    fn id_depends_only_on_the_given_file() {
        let dir = TempDir::new("library-id");
        let path = wav_with_tags(dir.path(), "track.wav");
        let same_file = dir.path().join(".").join("track.wav");

        assert_eq!(track_id(&path), track_id(&same_file));
        assert_ne!(track_id(&path), track_id(&dir.path().join("altro.wav")));
    }

    #[test]
    fn canonical_key_normalizes_separators() {
        let key = canonical_key(Path::new("C:\\music\\track.mp3"));

        assert!(!key.contains('\\'));
        assert!(!key.starts_with("//?/"));
    }

    #[test]
    fn canonical_key_normalizes_current_directory_segments() {
        let dir = TempDir::new("library-key");
        let path = dir.path().join(".").join("track.wav");

        assert_eq!(
            canonical_key(&path),
            canonical_key(&dir.path().join("track.wav"))
        );
    }

    #[test]
    fn maintenance_realigns_ids_and_removes_duplicate_files() {
        let mut library = Library::new();
        let first = Track {
            id: "old-id".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            ..sample_track("aaa")
        };
        let duplicate = Track {
            id: "other-old-id".to_owned(),
            path: "C:/music/shared.mp3".to_owned(),
            ..sample_track("bbb")
        };
        library.tracks.push(first);
        library.tracks.push(duplicate);

        let report = maintain_from_disk(&mut library);

        assert_eq!(library.len(), 1);
        assert_eq!(
            library.tracks()[0].id,
            track_id(Path::new("C:/music/shared.mp3"))
        );
        assert_eq!(report.ids_updated, 2);
        assert_eq!(report.deduplicated, 1);
    }

    #[test]
    fn imports_valid_files_and_reports_skipped_ones() {
        let dir = TempDir::new("library-import");
        let valido = wav_with_tags(dir.path(), "valid.wav");
        let rotto = corrupted_file(dir.path(), "rotto.mp3");
        let mut library = Library::new();

        let report = add_paths(
            &mut library,
            &[
                valido.display().to_string(),
                rotto.display().to_string(),
                "C:/music/assente.mp3".to_owned(),
                valido.display().to_string(),
            ],
            7,
        );

        assert_eq!(report.added.len(), 1);
        assert_eq!(report.duplicates.len(), 1);
        assert_eq!(report.failed.len(), 2);
        assert_eq!(library.len(), 1);
        assert_eq!(report.added[0].title, "Test Title");
        assert_eq!(report.added[0].added_at, 7);
    }

    /// The reading is what an import spends its time on, and what it is followed by.
    #[test]
    fn reading_an_import_keeps_the_order_given_and_counts_every_file() {
        let dir = TempDir::new("library-import-progress");
        let files: Vec<String> = (0..8)
            .map(|index| {
                wav_with_tags(dir.path(), &format!("track-{index}.wav"))
                    .display()
                    .to_string()
            })
            .chain(std::iter::once("C:/music/assente.mp3".to_owned()))
            .collect();

        let seen = std::sync::Mutex::new(Vec::new());
        let read = crate::library::read_imports(&files, &|done| {
            seen.lock().expect("the counter is readable").push(done);
        });

        // Every file is answered for, in the order it was handed over.
        assert_eq!(read.len(), files.len());
        for (outcome, path) in read.iter().zip(&files) {
            let named = match outcome {
                crate::library::ImportRead::Found(found, _) => found,
                crate::library::ImportRead::Failed(failure) => &failure.path,
            };
            assert_eq!(named, path);
        }
        assert!(matches!(
            read.last(),
            Some(crate::library::ImportRead::Failed(_))
        ));

        // And is counted once, whichever thread got to it.
        let mut counted = seen.into_inner().expect("the counter is readable");
        counted.sort_unstable();
        assert_eq!(counted, (1..=files.len()).collect::<Vec<_>>());
    }

    #[test]
    fn bulk_import_deduplicates_existing_and_repeated_paths_and_syncs_metadata() {
        let dir = TempDir::new("bulk-import-duplicates");
        let first = wav_with_tags(dir.path(), "first.wav").display().to_string();
        let second = wav_with_tags(dir.path(), "second.wav").display().to_string();
        let mut library = Library::new();
        add_paths(&mut library, std::slice::from_ref(&first), 1);
        let paths = vec![first.clone(), second.clone(), second.clone()];
        let read = crate::library::read_imports(&paths, &|_| {});
        let report = crate::library::add_read_imports(&mut library, read, 2);
        assert_eq!(report.added.len(), 1);
        assert_eq!(report.duplicates, vec![first, second]);
        assert_eq!(library.tracks().len(), 2);
        let mut expected = library.clone();
        expected.sync_metadata();
        assert_eq!(library.metadata, expected.metadata);
    }

    #[test]
    fn walking_a_folder_skips_the_copies_an_edit_left_behind() {
        let dir = TempDir::new("library-import-staging");
        wav_with_tags(dir.path(), "track.wav");
        let path = dir.path().join("track.wav");
        // A staged copy keeps the extension of its original, so only the name tells them
        // apart: without that, importing the folder would find the same song twice.
        std::fs::copy(&path, dir.path().join("track.mal-tmp.wav")).expect("copia scritta");
        let mut library = Library::new();

        let report = add_paths(&mut library, &[dir.path().display().to_string()], 0);

        assert_eq!(report.added.len(), 1);
        assert_eq!(library.len(), 1);
    }

    #[test]
    fn importing_drops_the_entries_that_are_not_audio_files() {
        let mut library = Library::new();
        let mut imported = Library::new();
        imported.add(sample_track("track"));
        imported.add(Track {
            path: "C:/Users/qualcuno/.ssh/id_rsa".to_owned(),
            ..sample_track("intruso")
        });

        let report = library.import(imported, LibraryImportStrategy::Replace);

        assert_eq!(report.total, 2, "the count says how many entries it held");
        assert_eq!(report.skipped, 1);
        assert_eq!(library.len(), 1);
        assert!(library
            .tracks()
            .iter()
            .all(|track| track.path.ends_with(".mp3")));
    }

    #[test]
    fn refuses_a_name_longer_than_a_name() {
        let mut library = Library::new();
        let long = "a".repeat(MAX_LIBRARY_NAME_LENGTH + 1);

        assert!(library.rename(&long).is_err());
        assert!(library.rename(&"a".repeat(MAX_LIBRARY_NAME_LENGTH)).is_ok());
    }

    #[test]
    fn a_name_that_arrives_too_long_from_disk_is_shortened_rather_than_refused() {
        let dir = TempDir::new("library-long-name");
        let path = dir.path().join("library.json");
        let mut library = Library::new();
        library.name = "b".repeat(MAX_LIBRARY_NAME_LENGTH * 3);
        library.save(&path).expect("library saved");

        let reloaded = Library::load(&path).expect("library read back");

        assert_eq!(reloaded.name.chars().count(), MAX_LIBRARY_NAME_LENGTH);
    }

    #[test]
    fn refuses_a_library_file_too_large_to_read() {
        let dir = TempDir::new("library-huge");
        let path = dir.path().join("library.json");
        Library::new().save(&path).expect("library saved");

        // The weight it refuses is an argument, so no gigantic fixture is needed.
        assert!(ensure_readable_size(&path, MAX_LIBRARY_FILE_BYTES).is_ok());
        assert!(matches!(
            ensure_readable_size(&path, 4).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn lists_each_folder_of_the_library_once() {
        let mut library = Library::new();
        library.add(sample_track("uno"));
        library.add(sample_track("due"));
        library.add(Track {
            path: "C:/altro/tre.mp3".to_owned(),
            ..sample_track("tre")
        });

        let directories = track_directories(&library);

        assert_eq!(directories.len(), 2);
        assert!(directories.contains(&PathBuf::from("C:/music")));
        assert!(directories.contains(&PathBuf::from("C:/altro")));
    }

    #[test]
    fn uses_the_file_name_when_title_is_missing() {
        let dir = TempDir::new("library-fallback");
        let path = wav_without_tags(dir.path(), "senza-tag.wav");
        let mut library = Library::new();

        add_paths(&mut library, &[path.display().to_string()], 0);

        assert_eq!(library.tracks()[0].title, "senza-tag");
    }

    #[test]
    fn reports_files_missing_from_disk() {
        let dir = TempDir::new("library-views");
        let path = wav_with_tags(dir.path(), "track.wav");
        let mut library = Library::new();
        add_paths(&mut library, &[path.display().to_string()], 0);

        assert!(!to_views(&library)[0].missing);

        std::fs::remove_file(&path).expect("file removed");

        assert!(to_views(&library)[0].missing);
    }

    #[test]
    fn verifies_one_tracked_file() {
        let dir = TempDir::new("library-view-one");
        let path = wav_with_tags(dir.path(), "track.wav");
        let mut library = Library::new();
        add_paths(&mut library, &[path.display().to_string()], 0);
        let id = library.tracks()[0].id.clone();

        assert!(!view_of(&library, &id).expect("present").missing);
        assert!(view_of(&library, "zzz").is_none());

        std::fs::remove_file(&path).expect("file removed");

        assert!(view_of(&library, &id).expect("present").missing);
    }

    #[test]
    fn reflects_rewritten_tags_on_the_tracked_file() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        let updated = apply_metadata(
            &mut library,
            "aaa",
            TrackMetadata {
                title: Some("Title nuovo".to_owned()),
                artist: Some("New Artist".to_owned()),
                album: Some("Album nuovo".to_owned()),
                year: Some(2011),
                genre: Some("Blues".to_owned()),
                duration_ms: 4242,
                format: "mp3".to_owned(),
                has_cover: true,
            },
        )
        .expect("track present");

        assert_eq!(updated.title, "Title nuovo");
        assert_eq!(library.get("aaa").expect("present").year, Some(2011));
        assert!(library.get("aaa").expect("present").has_cover);
        assert_eq!(library.get("aaa").expect("present").duration_ms, 4242);
        assert_eq!(library.metadata.artists, vec!["New Artist"]);
        assert_eq!(library.metadata.albums, vec!["Album nuovo"]);
        assert_eq!(library.metadata.genres, vec!["Blues"]);
    }

    #[test]
    fn uses_the_file_name_if_tags_still_have_no_title() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        let updated =
            apply_metadata(&mut library, "aaa", TrackMetadata::default()).expect("track present");

        assert_eq!(updated.title, "aaa");
    }

    #[test]
    fn ignores_update_of_an_unknown_id() {
        let mut library = Library::new();

        assert!(apply_metadata(&mut library, "zzz", TrackMetadata::default()).is_none());
    }

    #[test]
    fn reading_one_track_again_brings_in_what_the_file_now_says() {
        let dir = TempDir::new("library-refresh-track");
        let file = crate::fixtures::wav_with_tags(dir.path(), "track.wav");
        let mut library = Library::new();
        let id = track_id(&file);
        library.add(Track {
            id: id.clone(),
            path: file.display().to_string(),
            title: "What the library last heard".to_owned(),
            ..sample_track("aaa")
        });

        let view = refresh_track(&mut library, &id).expect("the track is tracked");

        assert_eq!(view.track.title, "Test Title");
        assert!(!view.missing);
        assert_eq!(library.get(&id).expect("present").title, "Test Title");
        assert!(refresh_track(&mut library, "unknown").is_none());
    }

    #[test]
    fn exposes_the_path_of_a_tracked_track() {
        let mut library = Library::new();
        library.add(sample_track("aaa"));

        assert_eq!(
            path_of(&library, "aaa"),
            Some(PathBuf::from("C:/music/aaa.mp3"))
        );
        assert_eq!(path_of(&library, "zzz"), None);
    }

    #[test]
    fn added_time_is_a_plausible_epoch() {
        assert!(now_seconds() > 1_700_000_000);
    }
