/**
 * @fileoverview Enveloped XMLDSig for NFS-e documents with the company's ICP-Brasil A1 certificate.
 * @author Samuel S. L.
 * @version 1.0.0
 * @since 2026-09-26
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
 * - Profile used by the national system and the reference implementations: inclusive C14N 1.0,
 *   enveloped-signature transform, SHA-1 digest, RSA-SHA1 signature, X509Certificate in KeyInfo
 * - The signed element (infDPS / infPedReg) is rendered already canonical by `dps.rs`, and SignedInfo is
 *   built here in canonical form, so no generic XML canonicalizer is needed
 * - Certificate and key come from PEM (convert the .pfx once with OpenSSL; see NFSE setup in the docs)
 */

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rsa::pkcs1v15::SigningKey;
use rsa::pkcs8::DecodePrivateKey;
use rsa::signature::{SignatureEncoding, Signer};
use rsa::RsaPrivateKey;
use sha1::{Digest, Sha1};
use x509_cert::der::{Decode, DecodePem};
use x509_cert::Certificate;

const C14N: &str = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const DSIG_NS: &str = "http://www.w3.org/2000/09/xmldsig#";

/// Signing identity: RSA private key plus the leaf certificate (DER) sent in KeyInfo.
pub struct SigningIdentity {
    key: SigningKey<Sha1>,
    cert_der: Vec<u8>,
    /// Unix seconds after which the certificate is no longer valid.
    pub not_after: i64,
    /// Subject of the certificate (for the admin status page).
    pub subject: String,
}

impl SigningIdentity {
    /// Loads a PKCS#8 (or PKCS#1) private key and the leaf certificate from PEM text.
    ///
    /// When the PEM holds a chain, the first certificate must be the company's own (leaf).
    pub fn from_pem(cert_pem: &str, key_pem: &str) -> Result<Self, String> {
        let key = RsaPrivateKey::from_pkcs8_pem(key_pem)
            .or_else(|_| {
                use rsa::pkcs1::DecodeRsaPrivateKey;
                RsaPrivateKey::from_pkcs1_pem(key_pem)
            })
            .map_err(|_| "NFS-e private key is not a PKCS#8 or PKCS#1 RSA PEM".to_string())?;
        let leaf = first_certificate(cert_pem)?;
        let cert = Certificate::from_pem(leaf.as_bytes()).map_err(|_| "NFS-e certificate PEM is invalid".to_string())?;
        let cert_der = x509_cert::der::Encode::to_der(&cert).map_err(|_| "certificate encode failed".to_string())?;
        let not_after = cert.tbs_certificate.validity.not_after.to_unix_duration().as_secs() as i64;
        let subject = cert.tbs_certificate.subject.to_string();
        Ok(Self { key: SigningKey::<Sha1>::new(key), cert_der, not_after, subject })
    }

    /// Builds an identity from an in-memory key and certificate (tests).
    #[cfg(test)]
    pub fn from_parts(key: RsaPrivateKey, cert_der: Vec<u8>) -> Self {
        Self { key: SigningKey::<Sha1>::new(key), cert_der, not_after: i64::MAX, subject: "test".into() }
    }

    /// Returns the `<Signature>` element for the canonical element `canonical` whose Id is `id`.
    pub fn signature_for(&self, id: &str, canonical: &str) -> String {
        let digest = B64.encode(Sha1::digest(canonical.as_bytes()));
        let signed_info = signed_info(id, &digest);
        let signature = self.key.sign(signed_info.as_bytes());
        let value = B64.encode(signature.to_bytes());
        // The SignedInfo inside Signature is serialized without its own xmlns (inherited from Signature).
        let inner = signed_info.replacen(&format!(" xmlns=\"{DSIG_NS}\""), "", 1);
        format!(
            "<Signature xmlns=\"{DSIG_NS}\">{inner}<SignatureValue>{value}</SignatureValue><KeyInfo><X509Data><X509Certificate>{}</X509Certificate></X509Data></KeyInfo></Signature>",
            B64.encode(&self.cert_der)
        )
    }
}

/// Canonical SignedInfo (C14N expands empty elements and declares the namespace on the apex).
pub fn signed_info(id: &str, digest_b64: &str) -> String {
    format!(
        "<SignedInfo xmlns=\"{DSIG_NS}\"><CanonicalizationMethod Algorithm=\"{C14N}\"></CanonicalizationMethod><SignatureMethod Algorithm=\"{DSIG_NS}rsa-sha1\"></SignatureMethod><Reference URI=\"#{id}\"><Transforms><Transform Algorithm=\"{DSIG_NS}enveloped-signature\"></Transform><Transform Algorithm=\"{C14N}\"></Transform></Transforms><DigestMethod Algorithm=\"{DSIG_NS}sha1\"></DigestMethod><DigestValue>{digest_b64}</DigestValue></Reference></SignedInfo>"
    )
}

/// First `CERTIFICATE` block of a PEM bundle.
fn first_certificate(pem: &str) -> Result<String, String> {
    let begin = "-----BEGIN CERTIFICATE-----";
    let end = "-----END CERTIFICATE-----";
    let start = pem.find(begin).ok_or_else(|| "no certificate in NFS-e PEM".to_string())?;
    let stop = pem[start..].find(end).ok_or_else(|| "unterminated certificate in NFS-e PEM".to_string())?;
    Ok(pem[start..start + stop + end.len()].to_string())
}

/// Decodes a DER certificate (tests and diagnostics).
#[allow(dead_code)]
pub fn certificate_from_der(der: &[u8]) -> Result<Certificate, String> {
    Certificate::from_der(der).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rsa::pkcs1v15::{Signature, VerifyingKey};
    use rsa::signature::Verifier;

    /// The digest covers the canonical element and the RSA-SHA1 signature verifies over SignedInfo.
    #[test]
    fn signature_verifies() {
        let mut rng = rand::thread_rng();
        let key = RsaPrivateKey::new(&mut rng, 1024).unwrap();
        let public = key.to_public_key();
        let identity = SigningIdentity::from_parts(key, vec![1, 2, 3]);
        let canonical = "<infDPS xmlns=\"http://www.sped.fazenda.gov.br/nfse\" Id=\"DPS1\"><tpAmb>2</tpAmb></infDPS>";
        let element = identity.signature_for("DPS1", canonical);

        let digest = B64.encode(Sha1::digest(canonical.as_bytes()));
        assert!(element.contains(&format!("<DigestValue>{digest}</DigestValue>")));
        assert!(element.contains("<Reference URI=\"#DPS1\">"));
        assert!(element.contains("<X509Certificate>AQID</X509Certificate>"));

        let value = element.split("<SignatureValue>").nth(1).unwrap().split("</SignatureValue>").next().unwrap();
        let signature = Signature::try_from(B64.decode(value).unwrap().as_slice()).unwrap();
        let verifier = VerifyingKey::<Sha1>::new(public);
        assert!(verifier.verify(signed_info("DPS1", &digest).as_bytes(), &signature).is_ok());
    }

    /// Writes signed samples for external conformance checks (official XSD, independent XMLDSig verifier).
    ///
    /// Run: NFSE_TEST_CERT=cert.pem NFSE_TEST_KEY=key.pem NFSE_TEST_OUT=dir cargo test -p faelith-web conformance_samples -- --ignored
    #[test]
    #[ignore]
    fn conformance_samples() {
        use crate::nfse::dps::{Buyer, BuyerId, CancelRequest, Environment, ForeignAddress};
        use chrono::{FixedOffset, TimeZone};
        let cert = std::fs::read_to_string(std::env::var("NFSE_TEST_CERT").unwrap()).unwrap();
        let key = std::fs::read_to_string(std::env::var("NFSE_TEST_KEY").unwrap()).unwrap();
        let out = std::path::PathBuf::from(std::env::var("NFSE_TEST_OUT").unwrap());
        let identity = SigningIdentity::from_pem(&cert, &key).unwrap();
        let domestic = crate::nfse::dps::tests::fixture(Buyer {
            id: BuyerId::Cpf("12345678909".into()),
            name: "Ana Souza".into(),
            email: Some("ana@example.com".into()),
            country: "BR".into(),
            foreign_address: None,
        });
        let export = crate::nfse::dps::tests::fixture(Buyer {
            id: BuyerId::NoNif("2"),
            name: "John Doe".into(),
            email: Some("john@example.com".into()),
            country: "US".into(),
            foreign_address: Some(ForeignAddress {
                country: "US".into(),
                postal_code: "94105".into(),
                city: "San Francisco".into(),
                state: "CA".into(),
                street: "Market St 1".into(),
                number: String::new(),
                district: String::new(),
            }),
        });
        for (name, dps) in [("dps_domestic.xml", domestic), ("dps_export.xml", export)] {
            let signed = dps.document(&identity.signature_for(&dps.id(), &dps.canonical_inf()));
            std::fs::write(out.join(name), signed).unwrap();
        }
        let cancel = CancelRequest {
            environment: Environment::Homologation,
            app_version: "Faelith_1.0".into(),
            requested_at: FixedOffset::west_opt(3 * 3600).unwrap().with_ymd_and_hms(2026, 9, 26, 10, 0, 0).unwrap(),
            seller_cnpj: "11222333000181".into(),
            access_key: "3".repeat(50),
            reason_code: "9",
            reason: "Reembolso integral no prazo de arrependimento".into(),
        };
        let signed = cancel.document(&identity.signature_for(&cancel.id(), &cancel.canonical_inf()));
        std::fs::write(out.join("cancel.xml"), signed).unwrap();
    }
}
