/**
 * @fileoverview NFS-e emitter configuration from the environment (NFSE_* variables).
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
 * - Disabled unless NFSE_ENABLED=1; when enabled every required value is validated at startup (fail fast)
 * - Defaults: homologation environment, series 1, cTribNac 010301 (LC 116 item 1.03.01, data processing),
 *   Simples Nacional ME/EPP (opSimpNac 3, regApTribSN 1), no special regime, IBS/CBS group off
 * - cTribNac, NBS, regime, and rates must be confirmed by the accountant (see BRIEFING_CONTADOR.md)
 * - The certificate is read from PEM files converted once from the A1 .pfx
 */

use crate::nfse::dps::{digits, valid_cnpj, Environment, IbsCbs, Seller, ServiceCode};
use std::env;

/// Validated emitter settings.
#[derive(Debug, Clone)]
pub struct NfseConfig {
    pub environment: Environment,
    pub seller: Seller,
    pub series: i32,
    pub service: ServiceCode,
    /// First line of `xDescServ` (the invoice lines are appended).
    pub description_prefix: String,
    pub app_version: String,
    pub ibs_cbs: Option<IbsCbs>,
    /// Leaf certificate (and optional chain) in PEM.
    pub cert_pem: String,
    /// RSA private key in PEM (PKCS#8 or PKCS#1).
    pub key_pem: String,
    /// Extra trusted roots for the government endpoints (ICP-Brasil), in PEM.
    pub ca_bundle_pem: Option<String>,
}

/// Reads a variable, trimmed; empty counts as missing.
fn var(name: &str) -> Option<String> {
    env::var(name).ok().map(|value| value.trim().to_string()).filter(|value| !value.is_empty())
}

/// Reads a required variable.
fn required(name: &str) -> Result<String, String> {
    var(name).ok_or_else(|| format!("{name} is required when NFSE_ENABLED=1"))
}

/// Requires `value` to be exactly `len` ASCII digits.
fn fixed_digits(name: &str, value: &str, len: usize) -> Result<String, String> {
    if value.len() == len && value.chars().all(|c| c.is_ascii_digit()) {
        Ok(value.to_string())
    } else {
        Err(format!("{name} must have exactly {len} digits"))
    }
}

/// Reads a PEM file referenced by `name`.
fn read_file(name: &str, path: &str) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| format!("{name} ({path}): {error}"))
}

impl NfseConfig {
    /// None when the emitter is disabled; Err when enabled but misconfigured.
    pub fn from_env() -> Result<Option<Self>, String> {
        if !matches!(var("NFSE_ENABLED").as_deref(), Some("1" | "true")) {
            return Ok(None);
        }
        let cnpj = digits(&required("NFSE_CNPJ")?);
        if !valid_cnpj(&cnpj) {
            return Err("NFSE_CNPJ is not a valid CNPJ".to_string());
        }
        let environment = match var("NFSE_ENV").as_deref() {
            Some("producao") | Some("production") => Environment::Production,
            None | Some("homologacao") | Some("homologation") => Environment::Homologation,
            Some(other) => return Err(format!("NFSE_ENV must be homologacao or producao, got {other}")),
        };
        let simples_option = var("NFSE_SIMPLES_OPTION").unwrap_or_else(|| "3".into());
        if !["1", "2", "3"].contains(&simples_option.as_str()) {
            return Err("NFSE_SIMPLES_OPTION must be 1, 2 or 3".to_string());
        }
        let ibs_cbs = match (var("NFSE_IBSCBS_CINDOP"), var("NFSE_IBSCBS_CST"), var("NFSE_IBSCBS_CCLASSTRIB")) {
            (Some(op), Some(cst), Some(class)) => Some(IbsCbs {
                operation_indicator: fixed_digits("NFSE_IBSCBS_CINDOP", &op, 6)?,
                cst: fixed_digits("NFSE_IBSCBS_CST", &cst, 3)?,
                class_code: fixed_digits("NFSE_IBSCBS_CCLASSTRIB", &class, 6)?,
            }),
            (None, None, None) => None,
            _ => return Err("set all of NFSE_IBSCBS_CINDOP, NFSE_IBSCBS_CST and NFSE_IBSCBS_CCLASSTRIB, or none".to_string()),
        };
        let series: i32 = var("NFSE_SERIES").unwrap_or_else(|| "1".into()).parse().map_err(|_| "NFSE_SERIES must be a number".to_string())?;
        if !(1..=99_999).contains(&series) {
            return Err("NFSE_SERIES must be between 1 and 99999".to_string());
        }
        let cert_path = required("NFSE_CERT_PEM_PATH")?;
        let key_path = required("NFSE_KEY_PEM_PATH")?;
        Ok(Some(Self {
            environment,
            seller: Seller {
                cnpj,
                municipal_registration: var("NFSE_IM"),
                city_code: fixed_digits("NFSE_CITY_CODE", &required("NFSE_CITY_CODE")?, 7)?,
                simples_regime: (simples_option == "3").then(|| var("NFSE_SIMPLES_REGIME").unwrap_or_else(|| "1".into())),
                simples_option,
                special_regime: var("NFSE_SPECIAL_REGIME").unwrap_or_else(|| "0".into()),
            },
            series,
            service: ServiceCode {
                national: fixed_digits("NFSE_TRIB_NAC", &var("NFSE_TRIB_NAC").unwrap_or_else(|| "010301".into()), 6)?,
                nbs: fixed_digits("NFSE_NBS", &required("NFSE_NBS")?, 9)?,
            },
            description_prefix: var("NFSE_DESCRIPTION")
                .unwrap_or_else(|| "Serviço de processamento de dados por inteligência artificial (plataforma Faelith, SaaS)".into()),
            app_version: "Faelith_1.0".to_string(),
            ibs_cbs,
            cert_pem: read_file("NFSE_CERT_PEM_PATH", &cert_path)?,
            key_pem: read_file("NFSE_KEY_PEM_PATH", &key_path)?,
            ca_bundle_pem: match var("NFSE_CA_BUNDLE_PATH") {
                Some(path) => Some(read_file("NFSE_CA_BUNDLE_PATH", &path)?),
                None => None,
            },
        }))
    }

    /// PEM accepted by the TLS client: private key followed by the certificate chain.
    pub fn tls_identity_pem(&self) -> String {
        format!("{}\n{}", self.key_pem.trim(), self.cert_pem.trim())
    }
}
