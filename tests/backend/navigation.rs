#[cfg(test)]
mod tests {
    use super::*;

    fn page(url: &str) -> Url {
        Url::parse(url).expect("the address parses")
    }

    #[test]
    fn only_the_application_entry_points_are_pages() {
        assert!(is_app_page(&page("tauri://localhost/index.html")));
        assert!(is_app_page(&page("http://tauri.localhost/index.html?view=mini")));
        assert!(!is_app_page(&page("track://localhost/C:/music/track.mp3")));
        // The dev server, while developing.
        assert_eq!(is_app_page(&page("http://localhost:1420/")), cfg!(debug_assertions));
    }

    #[test]
    fn nothing_else_is_a_page_of_this_app() {
        assert!(!is_app_page(&page("https://example.com/")));
        assert!(!is_app_page(&page("http://valeriogc.github.io/tune-lib/")));
        assert!(!is_app_page(&page("file:///C:/Windows/System32/")));
        // A host that only looks like the local one.
        assert!(!is_app_page(&page("https://tauri.localhost.example.com/")));
        for url in ["http://localhost:9000/", "tauri://remote/index.html", "http://tauri.localhost/private.html", "https://user@tauri.localhost/", "file://localhost/index.html"] {
            assert!(!is_app_page(&page(url)), "{url}");
        }
    }
}
