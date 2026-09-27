/**
 * @fileoverview Cryptographic primitives for email codes, TOTP, and backup codes.
 * @author Samuel S. L.
 * @version 1.0.0
 * @since 2026-09-23
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 * All information contained herein is, and remains, the property of
 * Samuel S. L. and its suppliers, if any.
 *
 * The intellectual, technical, creative, and software concepts contained
 * herein are proprietary to Samuel S. L. and its suppliers and
 * are protected by copyright law, trade secret law, and other applicable
 * intellectual property laws in the Netherlands, the European Union, and
 * other foreign jurisdictions.
 *
 * Where applicable, such rights may be registered, recorded, or protected
 * with the competent authorities of the Government of the Netherlands,
 * the European Union, and/or other relevant jurisdictions.
 *
 * Dissemination of this information, reproduction of this material,
 * modification, distribution, disclosure, or commercial use is strictly
 * forbidden unless prior written permission is obtained from
 * Samuel S. L.
 *
 * @commercialUse Commercial use permitted only with prior written permission from Samuel S. L.
 *
 * <DETAILED_DESCRIPTION>:
 * - MFA_SECRET is split into independent encryption and MAC subkeys (HMAC-SHA256 KDF)
 * - One-time codes are stored as HMAC(purpose, subject, code) so rows cannot be transplanted
 * - TOTP follows RFC 6238 (SHA-1, 6 digits, 30 s, skew 1) with caller-enforced replay protection
 * - Backup codes carry 50 bits of entropy each and are compared in constant time via their MAC
 * Primary docs: https://www.rfc-editor.org/rfc/rfc6238
 * https://docs.rs/totp-rs/6.0.0/totp_rs/
 * https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
 */

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Key, Nonce};
use hmac::{Hmac, Mac};
use rand::Rng;
use sha2::Sha256;
use totp_rs::{Algorithm, Builder, Totp};

type HmacSha256 = Hmac<Sha256>;

/// Issuer shown in authenticator apps next to the account email.
pub const TOTP_ISSUER: &str = "Faelith";
/// Number of recovery codes issued per set (matches common consumer apps).
pub const BACKUP_CODE_COUNT: usize = 12;
/// Wrong guesses allowed against one code or challenge before it is burned.
pub const MAX_CODE_ATTEMPTS: i32 = 5;

const NONCE_LEN: usize = 12;
const TOTP_SECRET_BYTES: usize = 20;
const TOTP_STEP_SECONDS: u64 = 30;
/// Crockford base32 without I, L, O, U so codes survive handwriting.
const BACKUP_ALPHABET: &[u8] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BACKUP_GROUP_LEN: usize = 5;

/// What a one-time code authorizes; mixed into its MAC for domain separation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CodePurpose {
    Signup,
    LoginEmail,
    StepUp,
    Backup,
}

impl CodePurpose {
    /// Stable label bound into the MAC input.
    fn label(self) -> &'static str {
        match self {
            Self::Signup => "signup",
            Self::LoginEmail => "login-email",
            Self::StepUp => "step-up",
            Self::Backup => "backup",
        }
    }
}

/// Encryption and MAC subkeys derived from `MFA_SECRET`.
#[derive(Clone)]
pub struct MfaKeys {
    enc: [u8; 32],
    mac: [u8; 32],
}

impl std::fmt::Debug for MfaKeys {
    /// Never prints key material.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("MfaKeys(<redacted>)")
    }
}

impl MfaKeys {
    /// Derives the two subkeys with HMAC-SHA256(secret, label).
    ///
    /// Separate keys mean a flaw in one use (AEAD sealing vs code MACs)
    /// cannot leak material usable by the other.
    pub fn derive(secret: &[u8]) -> Self {
        Self {
            enc: hmac_bytes(secret, b"faelith-mfa-enc-v1"),
            mac: hmac_bytes(secret, b"faelith-mfa-mac-v1"),
        }
    }

    /// Seals a TOTP seed with AES-256-GCM as `nonce || ciphertext`.
    pub fn seal(&self, plaintext: &[u8]) -> Result<Vec<u8>, String> {
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&self.enc));
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let sealed = cipher
            .encrypt(&nonce, plaintext)
            .map_err(|_| "mfa seal failed".to_string())?;
        let mut blob = nonce.to_vec();
        blob.extend_from_slice(&sealed);
        Ok(blob)
    }

    /// Reverses `seal`. Fails closed on truncated or tampered blobs.
    pub fn open(&self, blob: &[u8]) -> Result<Vec<u8>, String> {
        if blob.len() <= NONCE_LEN {
            return Err("mfa blob too short".to_string());
        }
        let (nonce, sealed) = blob.split_at(NONCE_LEN);
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&self.enc));
        cipher
            .decrypt(Nonce::from_slice(nonce), sealed)
            .map_err(|_| "mfa open failed".to_string())
    }

    /// Hex MAC of a code bound to its purpose and subject (email, user id, or challenge).
    ///
    /// Length-prefixing each field removes ambiguity between concatenations,
    /// so ("ab","c") and ("a","bc") never collide.
    pub fn code_mac(&self, purpose: CodePurpose, subject: &str, code: &str) -> String {
        let mut mac = <HmacSha256 as Mac>::new_from_slice(&self.mac).expect("hmac accepts any key length");
        for field in [purpose.label(), subject, code] {
            mac.update(&(field.len() as u64).to_be_bytes());
            mac.update(field.as_bytes());
        }
        hex::encode(mac.finalize().into_bytes())
    }

    /// Constant-time comparison of a submitted code against a stored MAC.
    pub fn code_matches(&self, purpose: CodePurpose, subject: &str, code: &str, stored: &str) -> bool {
        use subtle::ConstantTimeEq;
        let expected = self.code_mac(purpose, subject, code);
        expected.as_bytes().ct_eq(stored.as_bytes()).into()
    }
}

/// HMAC-SHA256(key, message) as a fixed 32-byte array.
fn hmac_bytes(key: &[u8], message: &[u8]) -> [u8; 32] {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(key).expect("hmac accepts any key length");
    mac.update(message);
    mac.finalize().into_bytes().into()
}

/// Uniform 6-digit code (000000-999999) from the thread CSPRNG.
pub fn generate_numeric_code() -> String {
    format!("{:06}", rand::thread_rng().gen_range(0..1_000_000u32))
}

/// Strips spaces and dashes a user may paste around a 6-digit code.
///
/// Returns None unless exactly six ASCII digits remain.
pub fn normalize_numeric_code(raw: &str) -> Option<String> {
    let digits: String = raw.chars().filter(|c| !c.is_whitespace() && *c != '-').collect();
    (digits.len() == 6 && digits.bytes().all(|b| b.is_ascii_digit())).then_some(digits)
}

/// Generates one recovery code as `XXXXX-XXXXX` (10 Crockford base32 chars, 50 bits).
fn generate_backup_code() -> String {
    let mut rng = rand::thread_rng();
    let chars: String = (0..BACKUP_GROUP_LEN * 2)
        .map(|_| BACKUP_ALPHABET[rng.gen_range(0..BACKUP_ALPHABET.len())] as char)
        .collect();
    format!("{}-{}", &chars[..BACKUP_GROUP_LEN], &chars[BACKUP_GROUP_LEN..])
}

/// Generates a full set of distinct recovery codes.
pub fn generate_backup_codes() -> Vec<String> {
    let mut codes = Vec::with_capacity(BACKUP_CODE_COUNT);
    while codes.len() < BACKUP_CODE_COUNT {
        let code = generate_backup_code();
        if !codes.contains(&code) {
            codes.push(code);
        }
    }
    codes
}

/// Canonical form used for MACs: uppercase, no separators, Crockford aliases resolved.
///
/// Returns None unless ten valid alphabet characters remain, so malformed
/// input is rejected before any database lookup.
pub fn normalize_backup_code(raw: &str) -> Option<String> {
    let canonical: String = raw
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| match c.to_ascii_uppercase() {
            'O' => '0',
            'I' | 'L' => '1',
            other => other,
        })
        .collect();
    let valid = canonical.len() == BACKUP_GROUP_LEN * 2
        && canonical.bytes().all(|b| BACKUP_ALPHABET.contains(&b));
    valid.then_some(canonical)
}

/// Fresh 160-bit TOTP seed (RFC 4226 section 4 recommends at least 160 bits).
pub fn generate_totp_secret() -> Vec<u8> {
    let mut secret = vec![0u8; TOTP_SECRET_BYTES];
    rand::thread_rng().fill(secret.as_mut_slice());
    secret
}

/// Builds the RFC 6238 authenticator for a seed and account label.
///
/// SHA-1/6 digits/30 s is the only profile every mainstream authenticator
/// app honors; HMAC-SHA1 is not weakened by SHA-1 collisions (RFC 4226 B.2).
pub fn build_totp(secret: &[u8], account: &str) -> Result<Totp, String> {
    Builder::new()
        .with_algorithm(Algorithm::SHA1)
        .with_digits(6)
        .with_skew(1)
        .with_step_duration(TOTP_STEP_SECONDS)
        .with_secret(secret.to_vec())
        .with_issuer(Some(TOTP_ISSUER))
        .with_account_name(account.replace(':', ""))
        .build()
        .map_err(|err| format!("totp build failed: {err}"))
}

/// Enrollment payload for the settings page.
pub struct TotpEnrollment {
    /// `data:image/png;base64,...` QR of the otpauth URL.
    pub qr_data_url: String,
    /// Base32 seed for manual entry when the camera cannot scan.
    pub secret_base32: String,
    /// Raw `otpauth://` URL (mobile deep link).
    pub otpauth_url: String,
}

/// Renders the QR code and manual-entry values for a seed.
pub fn totp_enrollment(secret: &[u8], account: &str) -> Result<TotpEnrollment, String> {
    let totp = build_totp(secret, account)?;
    let qr = totp
        .to_qr_base64()
        .map_err(|err| format!("totp qr failed: {err}"))?;
    let url = totp
        .to_url()
        .map_err(|err| format!("totp url failed: {err}"))?;
    Ok(TotpEnrollment {
        qr_data_url: format!("data:image/png;base64,{qr}"),
        secret_base32: totp.secret().to_base32(),
        otpauth_url: url,
    })
}

/// Verifies a TOTP code at `now_unix` and returns the matched step.
///
/// Steps at or below `last_step` are rejected, enforcing the RFC 6238
/// section 5.2 rule that a code is accepted at most once.
pub fn verify_totp(secret: &[u8], code: &str, last_step: i64, now_unix: u64) -> Option<i64> {
    let code = normalize_numeric_code(code)?;
    let totp = build_totp(secret, "").ok()?;
    let step = i64::try_from(totp.check(&code, now_unix)?).ok()?;
    (step > last_step).then_some(step)
}

/// Current Unix time in seconds (0 if the clock is before the epoch).
pub fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0)
}

/// Masks an address for display: `ada@example.com` -> `a**@example.com`.
pub fn mask_email(email: &str) -> String {
    match email.split_once('@') {
        Some((local, domain)) if !local.is_empty() => {
            let first: String = local.chars().take(1).collect();
            let stars = "*".repeat(local.chars().count().saturating_sub(1).clamp(2, 6));
            format!("{first}{stars}@{domain}")
        }
        _ => "***".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn keys() -> MfaKeys {
        MfaKeys::derive(b"test-mfa-secret-32-bytes-minimum!")
    }

    /// Sealed seeds round-trip and tampering is detected.
    #[test]
    fn seal_round_trip_and_tamper_detection() {
        let keys = keys();
        let mut blob = keys.seal(b"seed").unwrap();
        assert_eq!(keys.open(&blob).unwrap(), b"seed");
        let last = blob.len() - 1;
        blob[last] ^= 1;
        assert!(keys.open(&blob).is_err());
    }

    /// A code MAC is bound to both purpose and subject.
    #[test]
    fn code_mac_is_domain_separated() {
        let keys = keys();
        let mac = keys.code_mac(CodePurpose::Signup, "a@x.com", "123456");
        assert!(keys.code_matches(CodePurpose::Signup, "a@x.com", "123456", &mac));
        assert!(!keys.code_matches(CodePurpose::StepUp, "a@x.com", "123456", &mac));
        assert!(!keys.code_matches(CodePurpose::Signup, "b@x.com", "123456", &mac));
        assert!(!keys.code_matches(CodePurpose::Signup, "a@x.com", "123457", &mac));
    }

    /// Numeric codes are always six digits and normalization rejects junk.
    #[test]
    fn numeric_codes_are_six_digits() {
        for _ in 0..200 {
            let code = generate_numeric_code();
            assert_eq!(normalize_numeric_code(&code).as_deref(), Some(code.as_str()));
        }
        assert_eq!(normalize_numeric_code(" 123-456 ").as_deref(), Some("123456"));
        assert!(normalize_numeric_code("12345").is_none());
        assert!(normalize_numeric_code("12345a").is_none());
    }

    /// Backup codes are twelve distinct values that normalize back to themselves.
    #[test]
    fn backup_codes_are_distinct_and_normalize() {
        let codes = generate_backup_codes();
        assert_eq!(codes.len(), BACKUP_CODE_COUNT);
        for code in &codes {
            let canonical = normalize_backup_code(code).unwrap();
            assert_eq!(canonical, code.replace('-', ""));
            assert_eq!(normalize_backup_code(&code.to_lowercase()).unwrap(), canonical);
        }
        let unique: std::collections::HashSet<&String> = codes.iter().collect();
        assert_eq!(unique.len(), codes.len());
        assert!(normalize_backup_code("SHORT").is_none());
    }

    /// TOTP accepts the current code once and rejects replay of the same step.
    #[test]
    fn totp_rejects_replay() {
        let secret = generate_totp_secret();
        let now = 1_900_000_000;
        let code = build_totp(&secret, "a@x.com").unwrap().generate(now).to_string();
        let step = verify_totp(&secret, &code, 0, now).expect("fresh code accepted");
        assert!(verify_totp(&secret, &code, step, now).is_none());
    }

    /// A code from outside the skew window is rejected.
    #[test]
    fn totp_rejects_stale_code() {
        let secret = generate_totp_secret();
        let now = 1_900_000_000;
        let stale = build_totp(&secret, "a@x.com")
            .unwrap()
            .generate(now - 10 * TOTP_STEP_SECONDS)
            .to_string();
        let current = build_totp(&secret, "a@x.com").unwrap().generate(now).to_string();
        if stale != current {
            assert!(verify_totp(&secret, &stale, 0, now).is_none());
        }
    }

    /// Enrollment yields a PNG data URL and an otpauth URL with the issuer.
    #[test]
    fn enrollment_renders_qr_and_url() {
        let enrollment = totp_enrollment(&generate_totp_secret(), "ada@example.com").unwrap();
        assert!(enrollment.qr_data_url.starts_with("data:image/png;base64,"));
        assert!(enrollment.otpauth_url.starts_with("otpauth://totp/"));
        assert!(enrollment.otpauth_url.contains("issuer=Faelith"));
        assert_eq!(enrollment.secret_base32.len(), 32);
    }

    /// Masked emails keep the first character and the domain only.
    #[test]
    fn mask_email_hides_local_part() {
        assert_eq!(mask_email("ada@example.com"), "a**@example.com");
        assert_eq!(mask_email("a@example.com"), "a**@example.com");
        assert_eq!(mask_email("nope"), "***");
    }
}
