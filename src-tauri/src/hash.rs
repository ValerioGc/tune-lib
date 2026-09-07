//! Small stable hash shared by the library and the cover cache.

/// FNV-1a over the input, hex encoded. Deterministic across releases, unlike
/// `DefaultHasher`, so it is safe to persist.
pub fn fnv1a_hex(input: &str) -> String {
    const OFFSET_BASIS: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;

    let mut hash = OFFSET_BASIS;
    for byte in input.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(PRIME);
    }

    format!("{hash:016x}")
}

#[cfg(test)]
mod tests {
    include!("../../tests/backend/hash.rs");
}
