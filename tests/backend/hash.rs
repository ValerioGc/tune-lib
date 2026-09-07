    use super::*;

    #[test]
    fn is_stable_for_the_same_input() {
        assert_eq!(fnv1a_hex("track.mp3"), fnv1a_hex("track.mp3"));
    }

    #[test]
    fn distinguishes_different_inputs() {
        assert_ne!(fnv1a_hex("uno"), fnv1a_hex("due"));
    }

    #[test]
    fn always_produces_sixteen_characters() {
        assert_eq!(fnv1a_hex("").len(), 16);
        assert_eq!(fnv1a_hex("very/long/path/to/a/track.flac").len(), 16);
    }
