    use super::*;
    use crate::fixtures::{
        corrupted_file, flac_with_tags, mp3_with_tags, wav_with_cover, wav_with_tags, TempDir,
    };

    #[test]
    fn stored_artwork_must_be_bounded_and_match_its_image_type() {
        let mut cover = Cover { mime_type: PNG_MIME.to_owned(), data: crate::fixtures::png_cover_base64() };
        assert!(valid_stored_cover(&cover));
        cover.mime_type = "image/svg+xml".to_owned();
        assert!(!valid_stored_cover(&cover));
        cover.data = "not-base64".to_owned();
        assert!(!valid_stored_cover(&cover));
    }

    #[test]
    fn extracts_the_lowercase_extension() {
        assert_eq!(extension_of(Path::new("C:/music/Track.MP3")), "mp3");
        assert_eq!(extension_of(Path::new("/musica/track")), "");
    }

    #[test]
    fn recognizes_only_declared_formats() {
        assert!(is_supported(Path::new("track.mp3")));
        assert!(is_supported(Path::new("track.FLAC")));
        assert!(!is_supported(Path::new("cover.png")));
    }

    #[test]
    fn rejects_missing_files() {
        let error = ensure_importable(Path::new("C:/music/assente.mp3")).unwrap_err();

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn rejects_unsupported_formats() {
        let dir = TempDir::new("metadata-unsupported");
        let path = dir.path().join("nota.txt");
        std::fs::write(&path, b"not audio").expect("test file written");

        let error = ensure_importable(&path).unwrap_err();

        assert!(matches!(error, AppError::UnsupportedFormat(extension) if extension == "txt"));
    }

    #[test]
    fn rejects_corrupted_audio_files() {
        let dir = TempDir::new("metadata-corrupted");
        let path = corrupted_file(dir.path(), "rotto.mp3");

        let error = read_metadata(&path).unwrap_err();

        assert!(matches!(error, AppError::InvalidAudio(_)));
    }

    #[test]
    fn reads_wav_tags() {
        let dir = TempDir::new("metadata-wav");
        let path = wav_with_tags(dir.path(), "track.wav");

        let metadata = read_metadata(&path).expect("metadata read");

        assert_eq!(metadata.title.as_deref(), Some("Test Title"));
        assert_eq!(metadata.artist.as_deref(), Some("Test Artist"));
        assert_eq!(metadata.album.as_deref(), Some("Sample Album"));
        assert_eq!(metadata.year, Some(1999));
        assert_eq!(metadata.genre.as_deref(), Some("Rock"));
        assert_eq!(metadata.format, "wav");
        assert!(!metadata.has_cover);
    }

    #[test]
    fn reads_mp3_tags() {
        let dir = TempDir::new("metadata-mp3");
        let path = mp3_with_tags(dir.path(), "track.mp3");

        let metadata = read_metadata(&path).expect("metadata read");

        assert_eq!(metadata.title.as_deref(), Some("Test Title"));
        assert_eq!(metadata.format, "mp3");
    }

    #[test]
    fn reads_flac_tags() {
        let dir = TempDir::new("metadata-flac");
        let path = flac_with_tags(dir.path(), "track.flac");

        let metadata = read_metadata(&path).expect("metadata read");

        assert_eq!(metadata.title.as_deref(), Some("Test Title"));
        assert_eq!(metadata.format, "flac");
    }

    #[test]
    fn reports_a_non_negative_duration() {
        let dir = TempDir::new("metadata-duration");
        let path = wav_with_tags(dir.path(), "track.wav");

        let metadata = read_metadata(&path).expect("metadata read");

        assert!(metadata.duration_ms > 0);
    }

    #[test]
    fn returns_no_cover_when_there_is_none() {
        let dir = TempDir::new("cover-missing");
        let path = wav_with_tags(dir.path(), "track.wav");

        assert_eq!(read_cover(&path).expect("read succeeded").into_cover(), None);
    }

    #[test]
    fn reads_the_loudness_a_file_asks_to_be_played_at() {
        let dir = TempDir::new("gain");
        let path = wav_with_tags(dir.path(), "track.wav");

        assert_eq!(
            read_track_gain(&path).expect("read"),
            None,
            "a file without gain metadata plays unchanged"
        );

        assert_eq!(parse_gain_db("-7.35 dB"), Some(-7.35));
        assert_eq!(parse_gain_db("  +2.10 dB "), Some(2.10));
        assert_eq!(parse_gain_db("-4.2"), Some(-4.2));
        assert_eq!(parse_gain_db("molto forte"), None);
        // A tag asking for sixty decibels of correction is a tag nobody should believe.
        assert_eq!(parse_gain_db("-96 dB"), None);
    }

    #[test]
    fn a_picture_that_is_not_png_or_jpeg_is_left_alone() {
        let dir = TempDir::new("cover-unknown-bytes");
        let path = wav_with_tags(dir.path(), "track.wav");
        // Written straight into the tag, past the checks the app applies to its own writes.
        crate::fixtures::add_raw_picture(&path, b"GIF89a not really an image");

        let read = read_cover(&path).expect("read succeeded");

        assert_eq!(read.cover, None);
        assert_eq!(read.too_large_bytes, None);
    }

    #[test]
    fn a_picture_too_heavy_to_read_is_reported_rather_than_loaded() {
        let dir = TempDir::new("cover-oversized");
        let path = wav_with_cover(dir.path(), "track.wav");
        let weight = std::fs::metadata(&path).expect("readable file").len();

        // No need for a sixteen megabyte fixture: the weight refused is an argument.
        let read = read_cover_within(&path, 8).expect("read succeeded");

        assert_eq!(read.cover, None, "nothing huge crosses the IPC");
        assert!(read.too_large_bytes.is_some_and(|bytes| bytes > 8));
        assert!(read.too_large_bytes.is_some_and(|bytes| bytes < weight));
    }

    #[test]
    fn the_type_written_in_the_tag_does_not_decide_what_the_picture_is() {
        assert_eq!(image_mime(&[0x89, b'P', b'N', b'G', 13, 10, 26, 10]), Some(PNG_MIME));
        assert_eq!(image_mime(&[0xFF, 0xD8, 0xFF, 0xE0]), Some(JPEG_MIME));
        assert_eq!(image_mime(b"<html>"), None);
        assert_eq!(image_mime(&[]), None);
    }

    #[test]
    fn returns_the_cover_encoded_as_base64() {
        let dir = TempDir::new("cover-present");
        let path = wav_with_cover(dir.path(), "track.wav");

        let metadata = read_metadata(&path).expect("metadata read");
        let cover = read_cover(&path)
            .expect("read succeeded")
            .into_cover()
            .expect("cover present");

        assert!(metadata.has_cover);
        assert_eq!(cover.mime_type, "image/png");
        assert!(!cover.data.is_empty());
        assert_eq!(
            base64::engine::general_purpose::STANDARD
                .decode(&cover.data)
                .expect("valid base64")
                .first(),
            Some(&0x89)
        );
    }

    #[test]
    fn cover_of_a_missing_file_is_an_error() {
        let error = read_cover(Path::new("C:/music/assente.mp3")).unwrap_err();

        assert!(matches!(error, AppError::NotFound(_)));
    }
