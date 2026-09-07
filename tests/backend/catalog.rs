    use super::*;
    use crate::fixtures::TempDir;
    use crate::library::Library;

    fn entry(id: &str) -> CatalogEntry {
        CatalogEntry {
            id: id.to_owned(),
            file: format!("C:/dati/{id}.json"),
        }
    }

    #[test]
    fn catalog_starts_from_the_existing_library() {
        let directory = TempDir::new("catalog");
        let legacy = directory.path().join("library.json");
        Library::new().save(&legacy).expect("library saved");

        let catalog = bootstrap(directory.path(), &legacy);

        assert_eq!(catalog.entries.len(), 1);
        assert_eq!(catalog.entries[0].path(), legacy);
        assert_eq!(catalog.active, catalog.entries[0].id);
    }

    #[test]
    fn with_nothing_on_disk_creates_the_first_library_in_its_folder() {
        let directory = TempDir::new("catalog");

        let catalog = bootstrap(directory.path(), &directory.path().join("library.json"));

        let file = catalog.entries[0].path();
        assert!(file.starts_with(directory.path().join(LIBRARIES_DIR_NAME)));
        assert_eq!(
            file.extension().and_then(|value| value.to_str()),
            Some("json")
        );
    }

    #[test]
    fn an_entry_pointing_outside_the_app_folder_is_not_followed() {
        let directory = TempDir::new("catalog-outside");

        assert!(is_own_library_file(
            directory.path(),
            &directory.path().join("libraries").join("abc.json")
        ));
        // The library file of an installation that predates the catalog.
        assert!(is_own_library_file(
            directory.path(),
            &directory.path().join("library.json")
        ));

        assert!(!is_own_library_file(
            directory.path(),
            Path::new("C:/Users/qualcuno/Documenti/segreti.json")
        ));
        assert!(!is_own_library_file(
            directory.path(),
            &directory.path().join("..").join("altrove.json")
        ));
        assert!(!is_own_library_file(
            directory.path(),
            &directory.path().join("libraries").join("appunti.txt")
        ));
    }

    #[test]
    fn a_tampered_catalog_loses_the_entries_that_lead_elsewhere() {
        let directory = TempDir::new("catalog-tampered");
        let mine = CatalogEntry {
            id: "mia".to_owned(),
            file: directory
                .path()
                .join("libraries")
                .join("mia.json")
                .to_string_lossy()
                .into_owned(),
        };
        let mut catalog = Catalog::with_entry(entry("intrusa"));
        catalog.add(mine.clone());
        catalog.active = "intrusa".to_owned();

        let dropped = catalog.retain_own_files(directory.path());

        assert_eq!(dropped, 1);
        assert_eq!(catalog.entries.len(), 1);
        assert_eq!(catalog.entries[0].id, mine.id);
        assert_eq!(catalog.active, mine.id, "the active one falls back to what is left");
    }

    #[test]
    fn catalog_survives_saving_and_rereading() {
        let directory = TempDir::new("catalog");
        let file = directory.path().join(CATALOG_FILE_NAME);
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));

        catalog.save(&file).expect("catalog saved");
        let riletto = Catalog::load(&file).expect("catalog riletto");

        assert_eq!(riletto, catalog);
    }

    #[test]
    fn rejects_a_catalog_from_a_future_version() {
        let directory = TempDir::new("catalog");
        let file = directory.path().join(CATALOG_FILE_NAME);
        std::fs::write(
            &file,
            r#"{"version":99,"active":"uno","entries":[{"id":"uno","file":"a.json"}]}"#,
        )
        .expect("catalog written");

        let error = Catalog::load(&file).expect_err("schema troppo recente");

        assert!(matches!(error, AppError::UnsupportedFormat(_)));
    }

    #[test]
    fn changes_the_active_library() {
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));

        catalog.set_active("due").expect("library activated");

        assert_eq!(catalog.active, "due");
    }

    #[test]
    fn refuses_to_activate_an_unknown_library() {
        let mut catalog = Catalog::with_entry(entry("uno"));

        let error = catalog.set_active("ignota").expect_err("id sconosciuto");

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn deleting_the_active_library_activates_another_one() {
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));
        catalog.set_active("due").expect("library activated");

        let removed = catalog.remove("due").expect("library deleted");

        assert_eq!(removed.id, "due");
        assert_eq!(catalog.active, "uno");
        assert_eq!(catalog.entries.len(), 1);
    }

    #[test]
    fn does_not_delete_the_last_library() {
        let mut catalog = Catalog::with_entry(entry("uno"));

        let error = catalog.remove("uno").expect_err("last library");

        assert!(matches!(error, AppError::Validation(_)));
        assert_eq!(catalog.entries.len(), 1);
    }

    #[test]
    fn deleting_an_unknown_library_is_an_error() {
        let mut catalog = Catalog::with_entry(entry("uno"));
        catalog.add(entry("due"));

        let error = catalog.remove("tre").expect_err("id sconosciuto");

        assert!(matches!(error, AppError::NotFound(_)));
    }

    #[test]
    fn state_writes_the_catalog_on_first_start() {
        let directory = TempDir::new("catalog");

        let state = CatalogState::open(
            directory.path().to_path_buf(),
            &directory.path().join("library.json"),
        );

        assert!(state.file().exists());
        assert!(!state.active_file().expect("active library").exists());
    }

    #[test]
    fn state_rereads_the_already_written_catalog() {
        let directory = TempDir::new("catalog");
        let legacy = directory.path().join("library.json");
        let first = CatalogState::open(directory.path().to_path_buf(), &legacy);
        let expected = first.active_file().expect("active library");

        let second = CatalogState::open(directory.path().to_path_buf(), &legacy);

        assert_eq!(second.active_file().expect("active library"), expected);
    }

    #[test]
    fn every_catalog_change_lands_on_disk() {
        let directory = TempDir::new("catalog");
        let state = CatalogState::open(
            directory.path().to_path_buf(),
            &directory.path().join("library.json"),
        );

        state
            .update(|catalog| catalog.add(entry("due")))
            .expect("catalog aggiornato");

        let riletto = Catalog::load(&state.file()).expect("catalog riletto");
        assert_eq!(riletto.entries.len(), 2);
    }

    #[test]
    fn knows_the_file_of_each_library() {
        let directory = TempDir::new("catalog");
        let state = CatalogState::open(
            directory.path().to_path_buf(),
            &directory.path().join("library.json"),
        );
        state
            .update(|catalog| catalog.add(entry("due")))
            .expect("catalog aggiornato");

        let file = state.file_of("due").expect("file found");

        assert_eq!(file, PathBuf::from("C:/dati/due.json"));
        assert!(matches!(
            state.file_of("ignota"),
            Err(AppError::NotFound(_))
        ));
    }
