    use super::*;
    use crate::fixtures::{mp3_with_tags, wav_with_cover, wav_with_tags, TempDir};

    fn cache(dir: &TempDir) -> CoverCache {
        CoverCache::new(dir.path().join("cover-cache"))
    }

    #[test]
    fn reads_the_cover_and_stores_it_in_cache() {
        let dir = TempDir::new("cache-store");
        let cache = cache(&dir);
        let track = wav_with_cover(dir.path(), "track.wav");

        let cover = cache
            .load(&track)
            .expect("read")
            .into_cover()
            .expect("cover");

        assert_eq!(cover.mime_type, "image/png");
        assert!(cache
            .directory()
            .join(format!("{}.png", CoverCache::entry_key(&track)))
            .is_file());
    }

    #[test]
    fn second_read_comes_from_cache() {
        let dir = TempDir::new("cache-hit");
        let cache = cache(&dir);
        let track = wav_with_cover(dir.path(), "track.wav");

        // A fake entry written by hand: if the audio file were reread,
        // the returned content would be different.
        std::fs::create_dir_all(cache.directory()).expect("directory created");
        std::fs::write(
            cache
                .directory()
                .join(format!("{}.png", CoverCache::entry_key(&track))),
            b"fake-cover",
        )
        .expect("entry written");

        let cover = cache
            .load(&track)
            .expect("read")
            .into_cover()
            .expect("cover");
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&cover.data)
            .expect("valid base64");

        assert_eq!(bytes, b"fake-cover");
    }

    #[test]
    fn remembers_files_without_cover_without_reopening_them() {
        let dir = TempDir::new("cache-none");
        let cache = cache(&dir);
        let track = wav_with_tags(dir.path(), "track.wav");

        assert_eq!(cache.load(&track).expect("read").into_cover(), None);
        assert!(cache
            .directory()
            .join(format!("{}.none", CoverCache::entry_key(&track)))
            .is_file());
        assert_eq!(cache.load(&track).expect("second read").into_cover(), None);
    }

    #[test]
    fn file_change_invalidates_the_entry() {
        let dir = TempDir::new("cache-invalidate");
        let cache = cache(&dir);
        let track = mp3_with_tags(dir.path(), "track.mp3");

        cache.load(&track).expect("first read");
        let old_key = CoverCache::entry_key(&track);

        // Rewrites the file with a cover: the modification time changes.
        std::thread::sleep(std::time::Duration::from_millis(1100));
        crate::metadata::write_cover(
            &track,
            Some(&Cover {
                mime_type: "image/png".to_owned(),
                data: crate::fixtures::png_cover_base64(),
            }),
        )
        .expect("cover written");

        let new_key = CoverCache::entry_key(&track);
        assert_ne!(old_key, new_key);

        assert!(cache.load(&track).expect("second read").cover.is_some());
        assert!(!cache.directory().join(format!("{old_key}.none")).exists());
    }

    #[test]
    fn unwritable_cache_does_not_prevent_reading() {
        let dir = TempDir::new("cache-readonly");
        let track = wav_with_cover(dir.path(), "track.wav");
        // A file in place of the directory makes every cache write fail.
        let path_occupato = dir.path().join("occupato");
        std::fs::write(&path_occupato, b"not a folder").expect("file written");
        let cache = CoverCache::new(path_occupato);

        assert!(cache.load(&track).expect("read succeeded").cover.is_some());
    }

    #[test]
    fn propagates_the_error_for_a_missing_file() {
        let dir = TempDir::new("cache-missing");

        assert!(cache(&dir).load(Path::new("C:/music/assente.mp3")).is_err());
    }

    #[test]
    fn clears_the_cache_on_request() {
        let dir = TempDir::new("cache-clear");
        let cache = cache(&dir);
        let track = wav_with_cover(dir.path(), "track.wav");
        cache.load(&track).expect("read");

        cache.clear().expect("cleanup succeeded");

        assert_eq!(
            std::fs::read_dir(cache.directory())
                .expect("readable folder")
                .count(),
            0
        );
    }

    /// Writes an entry of the given weight, last served `age_seconds` ago.
    fn aged_entry(cache: &CoverCache, name: &str, size: usize, age_seconds: u64) {
        std::fs::create_dir_all(cache.directory()).expect("folder created");
        let path = cache.directory().join(name);
        std::fs::write(&path, vec![0_u8; size]).expect("entry written");

        let when = SystemTime::now() - std::time::Duration::from_secs(age_seconds);
        let file = std::fs::File::options()
            .write(true)
            .open(&path)
            .expect("entry can be opened");
        file.set_times(FileTimes::new().set_modified(when))
            .expect("data impostata");
    }

    #[test]
    fn a_picture_too_heavy_to_read_is_answered_from_the_cache() {
        let dir = TempDir::new("cache-oversized");
        let cache = cache(&dir);
        // A file with no cover at all: if the answer came from the file rather than from
        // the note beside it, it would say "no cover" instead of "too heavy".
        let track = wav_with_tags(dir.path(), "track.wav");
        std::fs::create_dir_all(cache.directory()).expect("folder created");
        std::fs::write(
            cache
                .directory()
                .join(format!("{}.big", CoverCache::entry_key(&track))),
            b"20000000",
        )
        .expect("nota scritta");

        let read = cache.load(&track).expect("read");

        assert_eq!(read.cover, None);
        assert_eq!(read.too_large_bytes, Some(20_000_000));
    }

    #[test]
    fn a_heavy_picture_leaves_a_note_instead_of_an_image() {
        let dir = TempDir::new("cache-oversized-store");
        let cache = cache(&dir);
        let track = wav_with_cover(dir.path(), "track.wav");

        cache.store_read(
            &CoverCache::entry_key(&track),
            &track,
            &crate::metadata::CoverRead::too_large(20_000_000),
        );

        assert!(cache
            .directory()
            .join(format!("{}.big", CoverCache::entry_key(&track)))
            .is_file());
        assert!(cache.size_bytes() < 100, "the image is not kept");
        assert_eq!(
            cache.load(&track).expect("read").too_large_bytes,
            Some(20_000_000)
        );
    }

    #[test]
    fn hands_out_the_file_it_keeps_rather_than_its_content() {
        let dir = TempDir::new("cache-entry");
        let cache = cache(&dir);
        let track = wav_with_cover(dir.path(), "track.wav");

        let entry = cache.entry(&track).expect("entry");

        let CoverEntry::Image(picture) = entry else {
            panic!("an image was expected, found {entry:?}");
        };
        assert_eq!(
            std::fs::read(&picture).expect("readable image"),
            base64::engine::general_purpose::STANDARD
                .decode(crate::fixtures::png_cover_base64())
                .expect("valid base64"),
            "the bytes served are those of the cover, with no re-encoding"
        );

        // The second time nothing is opened but the cache itself.
        assert!(matches!(
            cache.entry(&track).expect("entry"),
            CoverEntry::Image(_)
        ));
    }

    #[test]
    fn says_when_there_is_no_picture_to_hand_out() {
        let dir = TempDir::new("cache-entry-none");
        let cache = cache(&dir);
        let without = wav_with_tags(dir.path(), "track.wav");

        assert_eq!(cache.entry(&without).expect("entry"), CoverEntry::Missing);

        let heavy = wav_with_tags(dir.path(), "heavy.wav");
        std::fs::create_dir_all(cache.directory()).expect("folder created");
        std::fs::write(
            cache
                .directory()
                .join(format!("{}.big", CoverCache::entry_key(&heavy))),
            b"20000000",
        )
        .expect("nota scritta");

        assert_eq!(
            cache.entry(&heavy).expect("entry"),
            CoverEntry::TooLarge(20_000_000)
        );
    }

    #[test]
    fn reports_how_much_room_it_takes() {
        let dir = TempDir::new("cache-size");
        let cache = cache(&dir);

        assert_eq!(cache.size_bytes(), 0, "a cache never created weighs nothing");

        aged_entry(&cache, "a.png", 500, 0);
        aged_entry(&cache, "b.jpg", 300, 0);

        assert_eq!(cache.size_bytes(), 800);
    }

    #[test]
    fn drops_the_covers_asked_for_longest_ago_first() {
        let dir = TempDir::new("cache-evict");
        let cache = cache(&dir);
        aged_entry(&cache, "vecchia.png", 400, 90_000);
        aged_entry(&cache, "media.png", 400, 40_000);
        aged_entry(&cache, "recente.png", 400, 0);

        // Over a limit of 1000 bytes, back down to 500.
        let removed = cache.evict_down_to(1_000, 500);

        assert_eq!(removed, 2);
        assert!(!cache.directory().join("vecchia.png").exists());
        assert!(!cache.directory().join("media.png").exists());
        assert!(cache.directory().join("recente.png").exists());
    }

    #[test]
    fn a_cache_within_its_limit_is_left_alone() {
        let dir = TempDir::new("cache-evict-none");
        let cache = cache(&dir);
        aged_entry(&cache, "one.png", 400, 90_000);

        assert_eq!(cache.evict_down_to(1_000, 500), 0);
        assert!(cache.directory().join("one.png").exists());
    }

    #[test]
    fn serving_a_cover_marks_it_as_still_wanted() {
        let dir = TempDir::new("cache-touch");
        let cache = cache(&dir);
        let track = wav_with_cover(dir.path(), "track.wav");
        cache.load(&track).expect("first read");

        let entry = cache
            .directory()
            .join(format!("{}.png", CoverCache::entry_key(&track)));
        // Old enough that the next hit is expected to write a fresh date on it.
        let file = std::fs::File::options()
            .write(true)
            .open(&entry)
            .expect("entry can be opened");
        file.set_times(
            FileTimes::new().set_modified(SystemTime::now() - std::time::Duration::from_secs(7_200)),
        )
        .expect("data impostata");

        cache.load(&track).expect("second read");

        let age = SystemTime::now()
            .duration_since(
                std::fs::metadata(&entry)
                    .expect("readable entry")
                    .modified()
                    .expect("readable data"),
            )
            .expect("data nel passato");

        assert!(age.as_secs() < 60, "the entry served returns to the head of the queue");
    }

    #[test]
    fn a_cover_served_a_moment_ago_is_not_rewritten() {
        let dir = TempDir::new("cache-touch-skip");
        let cache = cache(&dir);
        let track = wav_with_cover(dir.path(), "track.wav");
        cache.load(&track).expect("first read");

        let entry = cache
            .directory()
            .join(format!("{}.png", CoverCache::entry_key(&track)));
        let before = std::fs::metadata(&entry)
            .expect("readable entry")
            .modified()
            .expect("readable data");

        cache.load(&track).expect("second read");

        let after = std::fs::metadata(&entry)
            .expect("readable entry")
            .modified()
            .expect("readable data");

        assert_eq!(before, after, "walking the library does not write the cache again");
    }

    #[test]
    fn clearing_a_never_created_cache_is_not_an_error() {
        let dir = TempDir::new("cache-clear-empty");

        assert!(cache(&dir).clear().is_ok());
    }

    /// Two pictures chosen one after the other land in the same second, and used to be
    /// answered for by the same entry: the file changed and the picture on screen did not.
    #[test]
    fn a_second_change_in_the_same_second_is_not_served_from_the_cache() {
        use base64::Engine as _;

        let dir = TempDir::new("cache-same-second");
        let cache = cache(&dir);
        let track = mp3_with_tags(dir.path(), "track.mp3");

        let first_bytes = base64::engine::general_purpose::STANDARD
            .decode(crate::fixtures::png_cover_base64())
            .expect("the fixture decodes");
        // The same picture with another size in its header: different bytes, still an image.
        let mut second_bytes = first_bytes.clone();
        second_bytes[19] = 2;
        let encode = |bytes: &[u8]| base64::engine::general_purpose::STANDARD.encode(bytes);
        let first = Cover {
            mime_type: "image/png".to_owned(),
            data: encode(&first_bytes),
        };
        let second = Cover {
            mime_type: "image/png".to_owned(),
            data: encode(&second_bytes),
        };

        // The editor opening on the picture the track has fills the cache with it.
        crate::metadata::write_cover(&track, Some(&first)).expect("the first was written");
        assert_eq!(
            cache.load(&track).expect("read").into_cover().map(|c| c.data),
            Some(first.data)
        );

        // And the picture chosen in its place, at the speed a person chooses it.
        crate::metadata::write_cover(&track, Some(&second)).expect("the second was written");

        assert_eq!(
            cache.load(&track).expect("read").into_cover().map(|c| c.data),
            Some(second.data),
            "the cache answers with what the file now holds"
        );
    }
