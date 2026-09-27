/**
 * @fileoverview HTTPS client for the Sistema Nacional NFS-e (SEFIN Nacional and ADN) with mutual TLS.
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
 * - Emission: POST {sefin}/nfse with {"dpsXmlGZipB64"}; events: POST {sefin}/nfse/{chave}/eventos with
 *   {"pedidoRegistroEventoXmlGZipB64"}; recovery: GET {sefin}/dps/{id}; PDF: GET {adn}/danfse/{chave}
 * - Documents travel as UTF-8 XML, gzip-compressed and Base64-encoded; responses are JSON
 * - The TLS client presents the company's A1 certificate; extra CA roots (ICP-Brasil) can be added
 * - A trait keeps the service testable without the government endpoints
 */

use crate::nfse::dps::Environment;
use async_trait::async_trait;
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::time::Duration;

/// Outcome of a DPS submission.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Submission {
    /// NFS-e authorized: access key and the NFS-e XML returned by the system.
    Issued { access_key: String, nfse_xml: String },
    /// Business-rule rejection (do not retry the same content); raw error body kept for the admin.
    Rejected(String),
    /// Transport or server failure: the outcome is unknown, retry after checking the DPS id.
    Unavailable(String),
}

/// Operations of the national system used by Faelith.
#[async_trait]
pub trait NfseGateway: Send + Sync {
    /// Sends a signed DPS.
    async fn submit_dps(&self, signed_xml: &str) -> Submission;
    /// Access key of the NFS-e generated from a DPS id, when it exists (idempotent recovery).
    async fn find_by_dps(&self, dps_id: &str) -> Result<Option<String>, String>;
    /// NFS-e XML by access key.
    async fn fetch_nfse(&self, access_key: &str) -> Result<String, String>;
    /// Sends a signed event request (cancellation); Ok(()) when registered.
    async fn submit_event(&self, access_key: &str, signed_xml: &str) -> Result<(), String>;
    /// DANFSe PDF by access key.
    async fn danfse(&self, access_key: &str) -> Result<Vec<u8>, String>;
}

/// Gzip then Base64, the transport encoding of every document.
pub fn pack(xml: &str) -> Result<String, String> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(xml.as_bytes()).map_err(|error| error.to_string())?;
    Ok(B64.encode(encoder.finish().map_err(|error| error.to_string())?))
}

/// Base64 then gunzip.
pub fn unpack(b64: &str) -> Result<String, String> {
    let bytes = B64.decode(b64.trim()).map_err(|error| error.to_string())?;
    let mut text = String::new();
    GzDecoder::new(bytes.as_slice()).read_to_string(&mut text).map_err(|error| error.to_string())?;
    Ok(text)
}

/// Live client for the national endpoints.
pub struct LiveGateway {
    http: reqwest::Client,
    sefin: String,
    adn: String,
}

impl LiveGateway {
    /// Builds an mTLS client. `identity_pem` holds the private key followed by the certificate chain.
    pub fn new(environment: Environment, identity_pem: &str, extra_roots_pem: Option<&str>) -> Result<Self, String> {
        let identity = reqwest::Identity::from_pem(identity_pem.as_bytes()).map_err(|error| format!("NFS-e TLS identity: {error}"))?;
        let mut builder = reqwest::Client::builder()
            .identity(identity)
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(60));
        if let Some(bundle) = extra_roots_pem {
            for cert in reqwest::Certificate::from_pem_bundle(bundle.as_bytes()).map_err(|error| format!("NFS-e CA bundle: {error}"))? {
                builder = builder.add_root_certificate(cert);
            }
        }
        let http = builder.build().map_err(|error| error.to_string())?;
        let (sefin, adn) = match environment {
            Environment::Production => ("https://sefin.nfse.gov.br/sefinnacional", "https://adn.nfse.gov.br"),
            Environment::Homologation => ("https://sefin.producaorestrita.nfse.gov.br/SefinNacional", "https://adn.producaorestrita.nfse.gov.br"),
        };
        Ok(Self { http, sefin: sefin.to_string(), adn: adn.to_string() })
    }
}

/// First access key-like field of a JSON response.
fn access_key(body: &Value) -> Option<String> {
    ["chaveAcesso", "ChaveAcesso", "chNFSe"]
        .iter()
        .find_map(|field| body.get(*field).and_then(Value::as_str))
        .map(str::to_string)
}

#[async_trait]
impl NfseGateway for LiveGateway {
    async fn submit_dps(&self, signed_xml: &str) -> Submission {
        let packed = match pack(signed_xml) {
            Ok(packed) => packed,
            Err(error) => return Submission::Rejected(error),
        };
        let response = match self.http.post(format!("{}/nfse", self.sefin)).json(&json!({ "dpsXmlGZipB64": packed })).send().await {
            Ok(response) => response,
            Err(error) => return Submission::Unavailable(error.to_string()),
        };
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        if status.is_server_error() || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Submission::Unavailable(format!("{status}: {}", text.chars().take(2000).collect::<String>()));
        }
        let body: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        match (status.is_success(), access_key(&body), body.get("nfseXmlGZipB64").and_then(Value::as_str)) {
            (true, Some(key), Some(xml)) => match unpack(xml) {
                Ok(nfse_xml) => Submission::Issued { access_key: key, nfse_xml },
                Err(error) => Submission::Unavailable(format!("undecodable NFS-e: {error}")),
            },
            _ => Submission::Rejected(format!("{status}: {}", text.chars().take(4000).collect::<String>())),
        }
    }

    async fn find_by_dps(&self, dps_id: &str) -> Result<Option<String>, String> {
        let response = self.http.get(format!("{}/dps/{dps_id}", self.sefin)).send().await.map_err(|error| error.to_string())?;
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }
        if !response.status().is_success() {
            return Err(format!("dps lookup failed with {}", response.status()));
        }
        let body: Value = response.json().await.map_err(|error| error.to_string())?;
        Ok(access_key(&body))
    }

    async fn fetch_nfse(&self, key: &str) -> Result<String, String> {
        let response = self.http.get(format!("{}/nfse/{key}", self.sefin)).send().await.map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Err(format!("nfse lookup failed with {}", response.status()));
        }
        let body: Value = response.json().await.map_err(|error| error.to_string())?;
        let packed = body.get("nfseXmlGZipB64").and_then(Value::as_str).ok_or_else(|| "nfse lookup without XML".to_string())?;
        unpack(packed)
    }

    async fn submit_event(&self, key: &str, signed_xml: &str) -> Result<(), String> {
        let packed = pack(signed_xml)?;
        let response = self
            .http
            .post(format!("{}/nfse/{key}/eventos", self.sefin))
            .json(&json!({ "pedidoRegistroEventoXmlGZipB64": packed }))
            .send()
            .await
            .map_err(|error| error.to_string())?;
        let status = response.status();
        if status.is_success() {
            Ok(())
        } else {
            let text = response.text().await.unwrap_or_default();
            Err(format!("{status}: {}", text.chars().take(4000).collect::<String>()))
        }
    }

    async fn danfse(&self, key: &str) -> Result<Vec<u8>, String> {
        let response = self.http.get(format!("{}/danfse/{key}", self.adn)).send().await.map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Err(format!("danfse failed with {}", response.status()));
        }
        Ok(response.bytes().await.map_err(|error| error.to_string())?.to_vec())
    }
}

/// Parses `<nNFSe>` from an NFS-e XML (the number assigned by the national system).
pub fn nfse_number(nfse_xml: &str) -> Option<String> {
    let start = nfse_xml.find("<nNFSe>")? + "<nNFSe>".len();
    let end = nfse_xml[start..].find("</nNFSe>")?;
    Some(nfse_xml[start..start + end].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Transport encoding round-trips and the NFS-e number is read from the XML.
    #[test]
    fn pack_roundtrip_and_number() {
        let xml = "<NFSe><infNFSe><nNFSe>42</nNFSe></infNFSe></NFSe>";
        assert_eq!(unpack(&pack(xml).unwrap()).unwrap(), xml);
        assert_eq!(nfse_number(xml).as_deref(), Some("42"));
    }
}
