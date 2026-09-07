//! Header-only dimension checks before a cover reaches a decoder.

use super::{image_mime, JPEG_MIME, PNG_MIME};

const MAX_PIXELS: u64 = 16 * 1024 * 1024;

fn jpeg_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    let mut remaining = bytes.get(2..)?;
    while !remaining.is_empty() {
        if remaining[0] != 0xff {
            return None;
        }
        remaining = remaining.get(1..)?;
        while remaining.first() == Some(&0xff) {
            remaining = remaining.get(1..)?;
        }
        let marker = *remaining.first()?;
        remaining = remaining.get(1..)?;
        if matches!(marker, 0xd9 | 0xda) {
            return None;
        }
        if matches!(marker, 0x01 | 0xd0..=0xd8) {
            continue;
        }
        let length = usize::from(u16::from_be_bytes(remaining.get(..2)?.try_into().ok()?));
        if length < 2 {
            return None;
        }
        let segment = remaining.get(..length)?;
        if matches!(marker, 0xc0..=0xc3 | 0xc5..=0xc7 | 0xc9..=0xcb | 0xcd..=0xcf) {
            let height = u16::from_be_bytes(segment.get(3..5)?.try_into().ok()?);
            let width = u16::from_be_bytes(segment.get(5..7)?.try_into().ok()?);
            return Some((u32::from(width), u32::from(height)));
        }
        remaining = remaining.get(length..)?;
    }
    None
}

pub fn within_image_bounds(bytes: &[u8]) -> bool {
    let dimensions = match image_mime(bytes) {
        Some(PNG_MIME) if bytes.get(8..16) == Some(&[0, 0, 0, 13, b'I', b'H', b'D', b'R']) => {
            bytes.get(16..24).map(|data| {
                (
                    u32::from_be_bytes([data[0], data[1], data[2], data[3]]),
                    u32::from_be_bytes([data[4], data[5], data[6], data[7]]),
                )
            })
        }
        Some(JPEG_MIME) => jpeg_dimensions(bytes),
        _ => None,
    };
    dimensions.is_some_and(|(width, height)| {
        width > 0 && height > 0 && u64::from(width) * u64::from(height) <= MAX_PIXELS
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_dimensions_without_allocating_decoded_pixels() {
        let mut png = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
        png.extend_from_slice(&4096_u32.to_be_bytes());
        png.extend_from_slice(&4096_u32.to_be_bytes());
        assert!(within_image_bounds(&png));
        png[16..20].copy_from_slice(&u32::MAX.to_be_bytes());
        assert!(!within_image_bounds(&png));
        assert!(!within_image_bounds(&png[..20]));
        assert!(!within_image_bounds(b"not an image"));
    }

    #[test]
    fn checks_jpeg_frames_and_refuses_truncated_segments() {
        let jpeg = [
            0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xc0, 0, 8, 8, 0, 32, 0, 64, 1,
        ];
        assert!(within_image_bounds(&jpeg));
        for end in 0..jpeg.len() {
            assert!(!within_image_bounds(&jpeg[..end]));
        }
        assert!(!within_image_bounds(&[0xff, 0xd8, 0xff, 0xd9]));
        assert!(!within_image_bounds(&[0xff, 0xd8, 0xff, 0xe0, 0, 0]));
    }
}
