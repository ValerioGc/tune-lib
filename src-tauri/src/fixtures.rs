//! Audio files generated on the fly for the test suite.
//!
//! Building them programmatically keeps binary assets out of the repository and
//! makes every expectation in the tests explicit.

use std::path::{Path, PathBuf};

use lofty::config::WriteOptions;
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::{Accessor, ItemKey, TagExt};
use lofty::tag::{Tag, TagType};

pub struct TempDir(tempfile::TempDir);

impl TempDir {
    pub fn new(prefix: &str) -> Self {
        Self(
            tempfile::Builder::new()
                .prefix(prefix)
                .tempdir()
                .expect("temporary folder created"),
        )
    }

    pub fn path(&self) -> &Path {
        self.0.path()
    }
}

const SAMPLE_RATE: u32 = 44_100;

/// Half a second of silent 16 bit stereo PCM wrapped in a RIFF container.
fn wav_bytes() -> Vec<u8> {
    let channels: u16 = 2;
    let bits_per_sample: u16 = 16;
    let block_align = channels * bits_per_sample / 8;
    let byte_rate = SAMPLE_RATE * u32::from(block_align);
    let data_len = byte_rate / 2;

    let mut bytes = Vec::with_capacity(44 + data_len as usize);
    bytes.extend_from_slice(b"RIFF");
    bytes.extend_from_slice(&(36 + data_len).to_le_bytes());
    bytes.extend_from_slice(b"WAVEfmt ");
    bytes.extend_from_slice(&16u32.to_le_bytes());
    bytes.extend_from_slice(&1u16.to_le_bytes());
    bytes.extend_from_slice(&channels.to_le_bytes());
    bytes.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
    bytes.extend_from_slice(&byte_rate.to_le_bytes());
    bytes.extend_from_slice(&block_align.to_le_bytes());
    bytes.extend_from_slice(&bits_per_sample.to_le_bytes());
    bytes.extend_from_slice(b"data");
    bytes.extend_from_slice(&data_len.to_le_bytes());
    bytes.resize(44 + data_len as usize, 0);

    bytes
}

/// A sequence of silent MPEG-1 Layer III frames at 128 kbps.
fn mp3_bytes() -> Vec<u8> {
    const FRAME_HEADER: [u8; 4] = [0xff, 0xfb, 0x90, 0x00];
    const FRAME_SIZE: usize = 417;

    let mut bytes = Vec::with_capacity(FRAME_SIZE * 40);
    for _ in 0..40 {
        bytes.extend_from_slice(&FRAME_HEADER);
        bytes.resize(bytes.len() + FRAME_SIZE - FRAME_HEADER.len(), 0);
    }

    bytes
}

/// A FLAC stream carrying only its mandatory STREAMINFO block.
fn flac_bytes() -> Vec<u8> {
    let mut bytes = Vec::with_capacity(4 + 4 + 34);
    bytes.extend_from_slice(b"fLaC");
    bytes.push(0x80);
    bytes.extend_from_slice(&[0x00, 0x00, 0x22]);

    bytes.extend_from_slice(&4096u16.to_be_bytes());
    bytes.extend_from_slice(&4096u16.to_be_bytes());
    bytes.extend_from_slice(&[0x00, 0x00, 0x00]);
    bytes.extend_from_slice(&[0x00, 0x00, 0x00]);

    let packed = (u64::from(SAMPLE_RATE) << 44) | (1 << 41) | (15 << 36) | u64::from(SAMPLE_RATE);
    bytes.extend_from_slice(&packed.to_be_bytes());
    bytes.extend_from_slice(&[0u8; 16]);

    bytes
}

/// An MP4 box: its length and four-character name, then whatever it holds.
fn mp4_box(name: &[u8; 4], payload: &[u8]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(8 + payload.len());
    bytes.extend_from_slice(&((8 + payload.len()) as u32).to_be_bytes());
    bytes.extend_from_slice(name);
    bytes.extend_from_slice(payload);

    bytes
}

/// The smallest MP4 that still describes one silent audio track.
///
/// Every box here is one a reader looks for on the way to the track; the boxes that only
/// describe samples are present but empty, there being no samples to describe.
fn m4a_bytes() -> Vec<u8> {
    const MATRIX: [u32; 9] = [0x0001_0000, 0, 0, 0, 0x0001_0000, 0, 0, 0, 0x4000_0000];

    let mut ftyp = Vec::new();
    ftyp.extend_from_slice(b"M4A ");
    ftyp.extend_from_slice(&0u32.to_be_bytes());
    ftyp.extend_from_slice(b"M4A mp42isom");

    let mut mvhd = vec![0; 4];
    mvhd.extend_from_slice(&0u32.to_be_bytes()); // created
    mvhd.extend_from_slice(&0u32.to_be_bytes()); // modified
    mvhd.extend_from_slice(&SAMPLE_RATE.to_be_bytes()); // timescale
    mvhd.extend_from_slice(&(SAMPLE_RATE / 2).to_be_bytes()); // duration
    mvhd.extend_from_slice(&0x0001_0000u32.to_be_bytes()); // rate
    mvhd.extend_from_slice(&0x0100u16.to_be_bytes()); // volume
    mvhd.extend_from_slice(&[0; 10]); // reserved
    for value in MATRIX {
        mvhd.extend_from_slice(&value.to_be_bytes());
    }
    mvhd.extend_from_slice(&[0; 24]); // pre-defined
    mvhd.extend_from_slice(&2u32.to_be_bytes()); // next track id

    let mut tkhd = vec![0, 0, 0, 7]; // enabled, in the movie and in its preview
    tkhd.extend_from_slice(&0u32.to_be_bytes()); // created
    tkhd.extend_from_slice(&0u32.to_be_bytes()); // modified
    tkhd.extend_from_slice(&1u32.to_be_bytes()); // track id
    tkhd.extend_from_slice(&0u32.to_be_bytes()); // reserved
    tkhd.extend_from_slice(&(SAMPLE_RATE / 2).to_be_bytes()); // duration
    tkhd.extend_from_slice(&[0; 8]); // reserved
    tkhd.extend_from_slice(&0u16.to_be_bytes()); // layer
    tkhd.extend_from_slice(&0u16.to_be_bytes()); // alternate group
    tkhd.extend_from_slice(&0x0100u16.to_be_bytes()); // volume
    tkhd.extend_from_slice(&0u16.to_be_bytes()); // reserved
    for value in MATRIX {
        tkhd.extend_from_slice(&value.to_be_bytes());
    }
    tkhd.extend_from_slice(&[0; 8]); // width and height, neither of them a sound's

    let mut mdhd = vec![0; 4];
    mdhd.extend_from_slice(&0u32.to_be_bytes()); // created
    mdhd.extend_from_slice(&0u32.to_be_bytes()); // modified
    mdhd.extend_from_slice(&SAMPLE_RATE.to_be_bytes()); // timescale
    mdhd.extend_from_slice(&(SAMPLE_RATE / 2).to_be_bytes()); // duration
    mdhd.extend_from_slice(&0x55c4u16.to_be_bytes()); // language: undetermined
    mdhd.extend_from_slice(&0u16.to_be_bytes()); // pre-defined

    let mut hdlr = vec![0; 4];
    hdlr.extend_from_slice(&0u32.to_be_bytes()); // pre-defined
    hdlr.extend_from_slice(b"soun");
    hdlr.extend_from_slice(&[0; 12]); // reserved
    hdlr.push(0); // an empty name

    let mut smhd = vec![0; 4];
    smhd.extend_from_slice(&0u16.to_be_bytes()); // balance
    smhd.extend_from_slice(&0u16.to_be_bytes()); // reserved

    let url = vec![0, 0, 0, 1]; // the media is in this file
    let mut dref = vec![0; 4];
    dref.extend_from_slice(&1u32.to_be_bytes());
    dref.extend_from_slice(&mp4_box(b"url ", &url));
    let dinf = mp4_box(b"dinf", &mp4_box(b"dref", &dref));

    let mut mp4a = vec![0; 6]; // reserved
    mp4a.extend_from_slice(&1u16.to_be_bytes()); // data reference index
    mp4a.extend_from_slice(&[0; 8]); // version, revision, vendor
    mp4a.extend_from_slice(&2u16.to_be_bytes()); // channels
    mp4a.extend_from_slice(&16u16.to_be_bytes()); // bits per sample
    mp4a.extend_from_slice(&[0; 4]); // pre-defined, reserved
    mp4a.extend_from_slice(&(SAMPLE_RATE << 16).to_be_bytes());

    let mut stsd = vec![0; 4];
    stsd.extend_from_slice(&1u32.to_be_bytes());
    stsd.extend_from_slice(&mp4_box(b"mp4a", &mp4a));

    let mut empty_table = vec![0; 4];
    empty_table.extend_from_slice(&0u32.to_be_bytes());

    let mut stsz = vec![0; 4];
    stsz.extend_from_slice(&0u32.to_be_bytes()); // one size for all, where there is one
    stsz.extend_from_slice(&0u32.to_be_bytes()); // sample count

    let mut stbl = mp4_box(b"stsd", &stsd);
    stbl.extend_from_slice(&mp4_box(b"stts", &empty_table));
    stbl.extend_from_slice(&mp4_box(b"stsc", &empty_table));
    stbl.extend_from_slice(&mp4_box(b"stsz", &stsz));
    stbl.extend_from_slice(&mp4_box(b"stco", &empty_table));

    let mut minf = mp4_box(b"smhd", &smhd);
    minf.extend_from_slice(&dinf);
    minf.extend_from_slice(&mp4_box(b"stbl", &stbl));

    let mut mdia = mp4_box(b"mdhd", &mdhd);
    mdia.extend_from_slice(&mp4_box(b"hdlr", &hdlr));
    mdia.extend_from_slice(&mp4_box(b"minf", &minf));

    let mut trak = mp4_box(b"tkhd", &tkhd);
    trak.extend_from_slice(&mp4_box(b"mdia", &mdia));

    let mut moov = mp4_box(b"mvhd", &mvhd);
    moov.extend_from_slice(&mp4_box(b"trak", &trak));

    let mut bytes = mp4_box(b"ftyp", &ftyp);
    bytes.extend_from_slice(&mp4_box(b"moov", &moov));
    bytes.extend_from_slice(&mp4_box(b"mdat", &[]));

    bytes
}

/// The checksum an Ogg page carries over itself, its own field read as zero.
fn ogg_crc(bytes: &[u8]) -> u32 {
    let mut crc: u32 = 0;

    for byte in bytes {
        crc ^= u32::from(*byte) << 24;

        for _ in 0..8 {
            crc = if crc & 0x8000_0000 == 0 {
                crc << 1
            } else {
                (crc << 1) ^ 0x04c1_1db7
            };
        }
    }

    crc
}

/// One Ogg page holding one packet, which is as much as any of these fixtures needs.
fn ogg_page(header_type: u8, granule: u64, sequence: u32, packet: &[u8]) -> Vec<u8> {
    let mut segments: Vec<u8> = Vec::new();
    let mut left = packet.len();

    while left >= 255 {
        segments.push(255);
        left -= 255;
    }
    segments.push(left as u8);

    let mut page = Vec::new();
    page.extend_from_slice(b"OggS");
    page.push(0); // version
    page.push(header_type);
    page.extend_from_slice(&granule.to_le_bytes());
    page.extend_from_slice(&1u32.to_le_bytes()); // serial number
    page.extend_from_slice(&sequence.to_le_bytes());
    page.extend_from_slice(&0u32.to_le_bytes()); // the checksum, until it is known
    page.push(segments.len() as u8);
    page.extend_from_slice(&segments);
    page.extend_from_slice(packet);

    let checksum = ogg_crc(&page);
    page[22..26].copy_from_slice(&checksum.to_le_bytes());

    page
}

/// An Ogg Vorbis stream: the three headers the format requires, and no audio.
///
/// Vorbis rather than Opus because the extension is what decides how an `.ogg` is read,
/// and `.ogg` is Vorbis. The setup header is a stub: nothing here decodes audio, and the
/// codebooks are only ever skipped over.
fn ogg_bytes() -> Vec<u8> {
    let mut identification = Vec::new();
    identification.extend_from_slice(b"\x01vorbis");
    identification.extend_from_slice(&0u32.to_le_bytes()); // version
    identification.push(2); // channels
    identification.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
    identification.extend_from_slice(&0i32.to_le_bytes()); // maximum bitrate
    identification.extend_from_slice(&128_000i32.to_le_bytes()); // nominal bitrate
    identification.extend_from_slice(&0i32.to_le_bytes()); // minimum bitrate
    identification.push(0xb8); // block sizes: 256 and 2048
    identification.push(1); // framing

    let vendor = b"tunelib";
    let mut comments = Vec::new();
    comments.extend_from_slice(b"\x03vorbis");
    comments.extend_from_slice(&(vendor.len() as u32).to_le_bytes());
    comments.extend_from_slice(vendor);
    comments.extend_from_slice(&0u32.to_le_bytes()); // no comments yet
    comments.push(1); // framing

    let mut setup = Vec::new();
    setup.extend_from_slice(b"\x05vorbis");
    setup.push(1); // framing

    let mut bytes = ogg_page(0x02, 0, 0, &identification);
    bytes.extend_from_slice(&ogg_page(0x00, 0, 1, &comments));
    // The last page says how far the stream got, which is what its length is read from.
    bytes.extend_from_slice(&ogg_page(0x04, u64::from(SAMPLE_RATE / 2), 2, &setup));

    bytes
}

fn write_file(directory: &Path, name: &str, bytes: &[u8]) -> PathBuf {
    let path = directory.join(name);
    std::fs::write(&path, bytes).expect("test file written");
    path
}

fn tag_with_values(tag_type: TagType) -> Tag {
    let mut tag = Tag::new(tag_type);
    tag.set_title("Test Title".to_owned());
    tag.set_artist("Test Artist".to_owned());
    tag.set_album("Sample Album".to_owned());
    tag.insert_text(ItemKey::RecordingDate, "1999".to_owned());
    tag.set_genre("Rock".to_owned());
    tag
}

fn save_tag(tag: &Tag, path: &Path) {
    tag.save_to_path(path, WriteOptions::default())
        .expect("tags written to the test file");
}

pub fn wav_with_tags(directory: &Path, name: &str) -> PathBuf {
    let path = write_file(directory, name, &wav_bytes());
    save_tag(&tag_with_values(TagType::Id3v2), &path);
    path
}

fn png_cover_bytes() -> Vec<u8> {
    use base64::Engine as _;
    // A real one-pixel PNG, including its image header and pixel data.
    base64::engine::general_purpose::STANDARD
        .decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
        .expect("valid PNG fixture")
}

pub fn png_cover_base64() -> String {
    use base64::Engine as _;

    base64::engine::general_purpose::STANDARD.encode(png_cover_bytes())
}

pub fn wav_with_cover(directory: &Path, name: &str) -> PathBuf {
    let path = write_file(directory, name, &wav_bytes());

    let mut tag = tag_with_values(TagType::Id3v2);
    let picture_data = png_cover_bytes();
    tag.push_picture(
        Picture::unchecked(picture_data)
            .mime_type(MimeType::Png)
            .pic_type(PictureType::CoverFront)
            .build(),
    );
    save_tag(&tag, &path);

    path
}

/// Puts arbitrary bytes into the picture of an existing file's tag.
///
/// The app refuses to write a picture that is not a real PNG or JPEG, and refuses one that
/// is too heavy — but nothing stops another program from putting either in a file. This is
/// how the tests produce a file the app has to cope with rather than one it made.
pub fn add_raw_picture(path: &Path, bytes: &[u8]) {
    let mut tag = tag_with_values(TagType::Id3v2);
    tag.push_picture(
        Picture::unchecked(bytes.to_vec())
            .mime_type(MimeType::Png)
            .pic_type(PictureType::CoverFront)
            .build(),
    );
    save_tag(&tag, path);
}

pub fn wav_without_tags(directory: &Path, name: &str) -> PathBuf {
    write_file(directory, name, &wav_bytes())
}

pub fn mp3_with_tags(directory: &Path, name: &str) -> PathBuf {
    let path = write_file(directory, name, &mp3_bytes());
    save_tag(&tag_with_values(TagType::Id3v2), &path);
    path
}

pub fn flac_with_tags(directory: &Path, name: &str) -> PathBuf {
    let path = write_file(directory, name, &flac_bytes());
    save_tag(&tag_with_values(TagType::VorbisComments), &path);
    path
}

pub fn m4a_with_tags(directory: &Path, name: &str) -> PathBuf {
    let path = write_file(directory, name, &m4a_bytes());
    save_tag(&tag_with_values(TagType::Mp4Ilst), &path);
    path
}

pub fn ogg_with_tags(directory: &Path, name: &str) -> PathBuf {
    let path = write_file(directory, name, &ogg_bytes());
    save_tag(&tag_with_values(TagType::VorbisComments), &path);
    path
}

pub fn corrupted_file(directory: &Path, name: &str) -> PathBuf {
    write_file(directory, name, b"this is not a valid audio file")
}
