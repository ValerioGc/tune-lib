//! Application errors shared by every command.
//!
//! Errors are typed and serialized to the frontend as a readable string:
//! no `unwrap()` should ever reach the end user.
//!
//! Diagnostic messages are written in English. The interface maps failures to its own
//! translated messages instead of displaying these diagnostics directly.

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("file not found: {0}")]
    NotFound(String),

    #[error("unsupported format: {0}")]
    UnsupportedFormat(String),

    #[error("unreadable audio file: {0}")]
    InvalidAudio(String),

    #[error("invalid data: {0}")]
    Validation(String),

    #[error("read-only file: {0}")]
    ReadOnly(String),

    #[error("library unavailable: {0}")]
    State(String),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("stored data error: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub type AppResult<T> = Result<T, AppError>;

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    include!("../../tests/backend/error.rs");
}
