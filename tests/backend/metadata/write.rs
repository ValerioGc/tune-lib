    use super::*;
    use crate::fixtures::{png_cover_base64, wav_with_cover, wav_with_tags, TempDir};
    use crate::metadata::read_cover;

    fn update() -> MetadataUpdate {
        MetadataUpdate {
            title: "Nuovo titolo".to_owned(),
            artist: Some("New Artist".to_owned()),
            album: Some("Nuovo album".to_owned()),
            year: Some(2010),
            genre: Some("Blues".to_owned()),
        }
    }

    fn png_cover() -> Cover {
        Cover {
            mime_type: "image/png".to_owned(),
            data: png_cover_base64(),
        }
    }

    /// The same picture with another size written into its header: still a picture, and
    /// not the bytes of the one before it.
    fn other_cover() -> Cover {
        use base64::Engine as _;

        let mut bytes = base64::engine::general_purpose::STANDARD
            .decode(png_cover_base64())
            .expect("the fixture decodes");
        bytes[19] = 2;

        Cover {
            mime_type: "image/png".to_owned(),
            data: base64::engine::general_purpose::STANDARD.encode(bytes),
        }
    }

    fn stored_cover(path: &Path) -> Option<String> {
        read_cover(path)
            .expect("the file is readable")
            .into_cover()
            .map(|cover| cover.data)
    }

    /// What a WAV says its size is, and what it actually is.
    fn riff_sizes(path: &Path) -> (u64, u64) {
        let bytes = std::fs::read(path).expect("the file is readable");
        let declared = u32::from_le_bytes(bytes[4..8].try_into().expect("four bytes"));

        (u64::from(declared), bytes.len() as u64)
    }

    /// The whole life cycle of a cover, in every container the app declares it reads.
    ///
    /// WAV earns its place here: its picture used to be the one thing an edit could not
    /// take back, the file having been left declaring a size smaller than its own chunks.
    #[test]
    fn cover_can_be_added_replaced_and_removed_in_every_format() {
        let dir = TempDir::new("cover-cycle");
        let first = png_cover();
        let second = other_cover();

        for path in [
            crate::fixtures::mp3_with_tags(dir.path(), "track.mp3"),
            crate::fixtures::flac_with_tags(dir.path(), "track.flac"),
            crate::fixtures::m4a_with_tags(dir.path(), "track.m4a"),
            crate::fixtures::ogg_with_tags(dir.path(), "track.ogg"),
            wav_with_tags(dir.path(), "track.wav"),
        ] {
            let name = path.display().to_string();

            assert!(
                write_cover(&path, Some(&first))
                    .unwrap_or_else(|_| panic!("{name}: the addition succeeded"))
                    .has_cover
            );
            assert_eq!(
                stored_cover(&path),
                Some(first.data.clone()),
                "{name}: the picture written is the one read back"
            );

            write_cover(&path, Some(&second))
                .unwrap_or_else(|_| panic!("{name}: the replacement succeeded"));
            assert_eq!(
                stored_cover(&path),
                Some(second.data.clone()),
                "{name}: a replacement leaves nothing of the picture before it"
            );

            assert!(
                !write_cover(&path, None)
                    .unwrap_or_else(|_| panic!("{name}: the removal succeeded"))
                    .has_cover,
                "{name}: the picture is gone"
            );
            assert_eq!(
                stored_cover(&path),
                None,
                "{name}: and stays gone when the file is read again"
            );
        }
    }

    /// The size in the RIFF header is what every later write trusts to find the tag by.
    #[test]
    fn a_wav_keeps_declaring_the_size_it_has() {
        let dir = TempDir::new("riff-size");
        let path = wav_with_tags(dir.path(), "track.wav");

        for written in [Some(&png_cover()), None] {
            write_cover(&path, written).expect("the write succeeded");

            let (declared, length) = riff_sizes(&path);
            assert_eq!(declared + 8, length, "the stream covers the whole file");
        }
    }

    /// Files edited by an earlier version are on disk in this state: short of the size
    /// they declare, with a tail of zeros left by every write that gave up on them.
    #[test]
    fn a_wav_left_inconsistent_is_put_right_by_the_next_edit() {
        let dir = TempDir::new("riff-recovery");
        let path = wav_with_tags(dir.path(), "track.wav");

        write_cover(&path, Some(&png_cover())).expect("the cover was added");
        let healthy = std::fs::read(&path).expect("the file is readable");

        let mut damaged = healthy.clone();
        let declared = u32::from_le_bytes(damaged[4..8].try_into().expect("four bytes"));
        damaged[4..8].copy_from_slice(&(declared - 188).to_le_bytes());
        damaged.extend(std::iter::repeat_n(0_u8, 1138));
        std::fs::write(&path, &damaged).expect("the damaged file was written");

        assert!(
            !write_cover(&path, None)
                .expect("the removal succeeded")
                .has_cover
        );
        assert_eq!(stored_cover(&path), None, "the picture is gone for good");

        let (declared, length) = riff_sizes(&path);
        assert_eq!(declared + 8, length, "and the file is in step with itself");
    }

    #[test]
    fn writes_and_rereads_tags() {
        let dir = TempDir::new("write-roundtrip");
        let path = wav_with_tags(dir.path(), "track.wav");

        let written = write_metadata(&path, &update()).expect("write succeeded");
        let reread = read_metadata(&path).expect("riread succeeded");

        assert_eq!(written, reread);
        assert_eq!(reread.title.as_deref(), Some("Nuovo titolo"));
        assert_eq!(reread.artist.as_deref(), Some("New Artist"));
        assert_eq!(reread.album.as_deref(), Some("Nuovo album"));
        assert_eq!(reread.year, Some(2010));
        assert_eq!(reread.genre.as_deref(), Some("Blues"));
    }

    #[test]
    fn trims_fields_left_empty() {
        let dir = TempDir::new("write-clear");
        let path = wav_with_tags(dir.path(), "track.wav");

        let cleared = MetadataUpdate {
            title: "Solo titolo".to_owned(),
            artist: None,
            album: Some("   ".to_owned()),
            year: None,
            genre: None,
        };

        let written = write_metadata(&path, &cleared).expect("write succeeded");

        assert_eq!(written.title.as_deref(), Some("Solo titolo"));
        assert_eq!(written.artist, None);
        assert_eq!(written.album, None);
        assert_eq!(written.year, None);
        assert_eq!(written.genre, None);
    }

    #[test]
    fn keeps_the_cover_when_only_text_changes() {
        let dir = TempDir::new("write-keeps-cover");
        let path = wav_with_cover(dir.path(), "track.wav");

        let written = write_metadata(&path, &update()).expect("write succeeded");

        assert!(written.has_cover);
    }

    #[test]
    fn leaves_no_temporary_files() {
        let dir = TempDir::new("write-no-temp");
        let path = wav_with_tags(dir.path(), "track.wav");

        write_metadata(&path, &update()).expect("write succeeded");

        let leftovers: Vec<_> = std::fs::read_dir(dir.path())
            .expect("readable folder")
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().contains("mal-tmp"))
            .collect();

        assert!(leftovers.is_empty());
    }

    #[test]
    fn a_staged_copy_is_told_apart_from_the_file_it_came_from() {
        let dir = TempDir::new("staging-recognised");
        let path = wav_with_tags(dir.path(), "track.wav");

        assert!(is_staging_file(&staging_path(&path)));
        assert!(!is_staging_file(&path));
    }

    #[test]
    fn a_staged_copy_left_behind_is_swept_away() {
        let dir = TempDir::new("staging-swept");
        let path = wav_with_tags(dir.path(), "track.wav");
        let abandoned = staging_path(&path);
        std::fs::copy(&path, &abandoned).expect("copia scritta");

        // No waiting for the hour to pass: the age the sweep goes by is given here.
        let removed = remove_staging_files_older_than([dir.path().to_path_buf()], Duration::ZERO);

        assert_eq!(removed, 1);
        assert!(!abandoned.exists());
        assert!(path.exists(), "the original file is left untouched");
    }

    #[test]
    fn a_staged_copy_still_being_written_is_left_alone() {
        let dir = TempDir::new("staging-kept");
        let path = wav_with_tags(dir.path(), "track.wav");
        let in_progress = staging_path(&path);
        std::fs::copy(&path, &in_progress).expect("copia scritta");

        let removed = remove_abandoned_staging_files([dir.path().to_path_buf()]);

        assert_eq!(removed, 0);
        assert!(in_progress.exists());
    }

    #[test]
    fn a_folder_named_twice_is_swept_once() {
        let dir = TempDir::new("staging-twice");
        let path = wav_with_tags(dir.path(), "track.wav");
        std::fs::copy(&path, staging_path(&path)).expect("copia scritta");

        let folder = dir.path().to_path_buf();
        let removed = remove_staging_files_older_than([folder.clone(), folder], Duration::ZERO);

        assert_eq!(removed, 1);
    }

    #[test]
    fn rejects_an_empty_title_without_touching_the_file() {
        let dir = TempDir::new("write-empty-title");
        let path = wav_with_tags(dir.path(), "track.wav");
        let invalid = MetadataUpdate {
            title: "   ".to_owned(),
            ..update()
        };

        let error = write_metadata(&path, &invalid).unwrap_err();

        assert!(matches!(error, AppError::Validation(_)));
        assert_eq!(
            read_metadata(&path).expect("riread").title.as_deref(),
            Some("Test Title")
        );
    }

    #[test]
    fn rejects_an_implausible_year() {
        let dir = TempDir::new("write-bad-year");
        let path = wav_with_tags(dir.path(), "track.wav");

        for year in [999, max_year() + 1] {
            let invalid = MetadataUpdate {
                year: Some(year),
                ..update()
            };

            assert!(matches!(
                write_metadata(&path, &invalid).unwrap_err(),
                AppError::Validation(_)
            ));
        }
    }

    #[test]
    fn accepts_the_allowed_range_boundaries() {
        assert!(validate_update(&MetadataUpdate {
            year: Some(MIN_YEAR),
            ..update()
        })
        .is_ok());
        assert!(validate_update(&MetadataUpdate {
            year: Some(max_year()),
            ..update()
        })
        .is_ok());
    }

    #[test]
    fn rejects_an_overly_long_title() {
        let invalid = MetadataUpdate {
            title: "a".repeat(MAX_TITLE_LENGTH + 1),
            ..update()
        };

        assert!(matches!(
            validate_update(&invalid).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn rejects_writing_to_a_read_only_file() {
        let dir = TempDir::new("write-readonly");
        let path = wav_with_tags(dir.path(), "track.wav");

        let mut permissions = std::fs::metadata(&path).expect("metadata").permissions();
        permissions.set_readonly(true);
        std::fs::set_permissions(&path, permissions).expect("permessi impostati");

        let error = write_metadata(&path, &update()).unwrap_err();

        let mut permissions = std::fs::metadata(&path).expect("metadata").permissions();
        #[allow(clippy::permissions_set_readonly_false)]
        permissions.set_readonly(false);
        std::fs::set_permissions(&path, permissions).expect("permessi ripristinati");

        assert!(matches!(error, AppError::ReadOnly(_)));
    }

    #[test]
    fn rejects_a_missing_file() {
        let error = write_metadata(Path::new("C:/music/assente.mp3"), &update()).unwrap_err();

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn writes_the_cover_and_reads_it_back() {
        let dir = TempDir::new("cover-write");
        let path = wav_with_tags(dir.path(), "track.wav");
        let cover = Cover {
            mime_type: "image/png".to_owned(),
            data: png_cover_base64(),
        };

        let written = write_cover(&path, Some(&cover)).expect("write succeeded");
        let stored = read_cover(&path)
            .expect("riread")
            .into_cover()
            .expect("cover present");

        assert!(written.has_cover);
        assert_eq!(stored.mime_type, "image/png");
        assert_eq!(stored.data, cover.data);
    }

    #[test]
    fn replaces_the_existing_cover_without_accumulating_others() {
        let dir = TempDir::new("cover-replace");
        let path = wav_with_cover(dir.path(), "track.wav");
        let cover = Cover {
            mime_type: "image/jpeg".to_owned(),
            data: png_cover_base64(),
        };

        write_cover(&path, Some(&cover)).expect("write succeeded");
        let stored = read_cover(&path)
            .expect("riread")
            .into_cover()
            .expect("cover present");

        // Announced as JPEG, written and read back as what the bytes actually are.
        assert_eq!(stored.mime_type, "image/png");
    }

    #[test]
    fn refuses_a_cover_whose_bytes_are_not_an_image() {
        let dir = TempDir::new("cover-not-an-image");
        let path = wav_with_tags(dir.path(), "track.wav");
        let cover = Cover {
            mime_type: "image/png".to_owned(),
            data: base64::engine::general_purpose::STANDARD.encode(b"<html>ciao</html>"),
        };

        let error = write_cover(&path, Some(&cover)).unwrap_err();

        assert!(matches!(error, AppError::Validation(_)));
        assert_eq!(read_cover(&path).expect("riread").into_cover(), None);
    }

    #[test]
    fn removes_the_cover() {
        let dir = TempDir::new("cover-remove");
        let path = wav_with_cover(dir.path(), "track.wav");

        let written = write_cover(&path, None).expect("removal succeeded");

        assert!(!written.has_cover);
        assert_eq!(read_cover(&path).expect("riread").into_cover(), None);
    }

    #[test]
    fn rejects_a_disallowed_image_format() {
        let cover = Cover {
            mime_type: "image/gif".to_owned(),
            data: png_cover_base64(),
        };

        assert!(matches!(
            validate_cover(&cover).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn rejects_an_unreadable_or_empty_image() {
        let broken = Cover {
            mime_type: "image/png".to_owned(),
            data: "non-base64!!".to_owned(),
        };
        let empty = Cover {
            mime_type: "image/png".to_owned(),
            data: String::new(),
        };

        assert!(matches!(
            validate_cover(&broken).unwrap_err(),
            AppError::Validation(_)
        ));
        assert!(matches!(
            validate_cover(&empty).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn rejects_an_oversized_image() {
        let cover = Cover {
            mime_type: "image/png".to_owned(),
            data: base64::engine::general_purpose::STANDARD.encode(vec![0u8; MAX_COVER_BYTES + 1]),
        };

        assert!(matches!(
            validate_cover(&cover).unwrap_err(),
            AppError::Validation(_)
        ));
    }

    #[test]
    fn invalid_cover_leaves_the_file_untouched() {
        let dir = TempDir::new("cover-invalid");
        let path = wav_with_cover(dir.path(), "track.wav");
        let cover = Cover {
            mime_type: "image/gif".to_owned(),
            data: png_cover_base64(),
        };

        assert!(write_cover(&path, Some(&cover)).is_err());
        assert!(read_cover(&path).expect("riread").cover.is_some());
    }
