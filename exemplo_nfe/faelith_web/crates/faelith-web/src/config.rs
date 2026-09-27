/**
 * @fileoverview Environment configuration for the Faelith Industries web origin.
 * @author Samuel S. L.
 * @version 1.8.0
 * @since 2026-09-06
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
 * - Loads DATABASE_URL, Stripe Price IDs, and OAuth client credentials from env
 * - COOKIE_SECURE=0 disables the __Host- prefix so localhost HTTP can set sessions
 * - COOKIE_SECRET HMAC-signs the session cookie; at-rest storage remains SHA-256 of the token
 * - Yearly Stripe Price IDs are STRIPE_PRICE_*_YEARLY; the SPA never sees amounts
 * - Price IDs stay server-side; the SPA never sees amounts
 * - MFA_SECRET keys TOTP sealing and one-time-code MACs; SMTP_* configures transactional email
 */

use anyhow::{Context, Result};
use faelith_core::PlanTier;
use std::collections::HashMap;
use std::env;
use std::path::PathBuf;

/// Billing cadence selected in Checkout. Yearly Price IDs live in env, never in the SPA.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BillingInterval {
    Monthly,
    Yearly,
}

impl BillingInterval {
    /// Parses the SPA `interval` field. Unknown values are rejected.
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "" | "monthly" | "month" => Some(Self::Monthly),
            "yearly" | "year" | "annual" => Some(Self::Yearly),
            _ => None,
        }
    }

    /// Wire name stored in Stripe metadata.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Monthly => "monthly",
            Self::Yearly => "yearly",
        }
    }
}

/// Stripe credit pack identifier used in Checkout metadata.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CreditPack {
    Ten,
    Fifty,
    Hundred,
}

impl CreditPack {
    /// Parses a SPA pack id (`10`, `50`, `100`).
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim() {
            "10" => Some(Self::Ten),
            "50" => Some(Self::Fifty),
            "100" => Some(Self::Hundred),
            _ => None,
        }
    }

    /// Wallet grant in USD micros.
    pub fn micros(self) -> i64 {
        match self {
            Self::Ten => 10_000_000,
            Self::Fifty => 50_000_000,
            Self::Hundred => 100_000_000,
        }
    }

    /// Wire name stored in Stripe metadata.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ten => "10",
            Self::Fifty => "50",
            Self::Hundred => "100",
        }
    }
}

/// How the SMTP connection is protected (RFC 8314 prefers implicit TLS).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmtpSecurity {
    /// Upgrade with STARTTLS, usually on port 587. TLS is mandatory, not opportunistic.
    StartTls,
    /// Implicit TLS from the first byte, usually on port 465.
    Tls,
    /// No TLS. Only accepted for a loopback dev relay (Mailpit, MailHog).
    Plain,
}

impl SmtpSecurity {
    /// Parses `SMTP_SECURITY`; unknown values are rejected rather than downgraded.
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "" | "starttls" => Some(Self::StartTls),
            "tls" | "ssl" | "implicit" => Some(Self::Tls),
            "plain" | "none" => Some(Self::Plain),
            _ => None,
        }
    }

    /// Conventional port for the mode when `SMTP_PORT` is unset.
    fn default_port(self) -> u16 {
        match self {
            Self::StartTls => 587,
            Self::Tls => 465,
            Self::Plain => 1025,
        }
    }
}

/// Outbound SMTP relay settings. The password is redacted from Debug output.
#[derive(Clone)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub security: SmtpSecurity,
    /// RFC 5322 mailbox, e.g. `Faelith <no-reply@faelithindustries.com>`.
    pub from: String,
}

impl std::fmt::Debug for SmtpConfig {
    /// Prints connection details but never the password.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SmtpConfig")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("username", &self.username)
            .field("password", &self.password.as_ref().map(|_| "<redacted>"))
            .field("security", &self.security)
            .field("from", &self.from)
            .finish()
    }
}

impl SmtpConfig {
    /// Reads `SMTP_*` and `MAIL_FROM`. Returns Ok(None) when `SMTP_HOST` is unset.
    fn from_env() -> Result<Option<Self>> {
        let Some(host) = env::var("SMTP_HOST").ok().filter(|s| !s.trim().is_empty()) else {
            return Ok(None);
        };
        let security = SmtpSecurity::parse(&env::var("SMTP_SECURITY").unwrap_or_default())
            .context("SMTP_SECURITY must be starttls, tls, or plain")?;
        let port = match env::var("SMTP_PORT").ok().filter(|s| !s.trim().is_empty()) {
            Some(raw) => raw.trim().parse().context("SMTP_PORT must be a port number")?,
            None => security.default_port(),
        };
        let from = env::var("MAIL_FROM")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .context("MAIL_FROM is required when SMTP_HOST is set")?;
        let username = env::var("SMTP_USERNAME").ok().filter(|s| !s.is_empty());
        let password = env::var("SMTP_PASSWORD").ok().filter(|s| !s.is_empty());
        if username.is_some() != password.is_some() {
            anyhow::bail!("SMTP_USERNAME and SMTP_PASSWORD must be set together");
        }
        Ok(Some(Self {
            host: host.trim().to_string(),
            port,
            username,
            password,
            security,
            from: from.trim().to_string(),
        }))
    }
}

/// Process configuration. Secrets never appear in logs.
#[derive(Debug, Clone)]
pub struct WebConfig {
    pub listen: String,
    pub public_origin: String,
    pub database_url: Option<String>,
    pub redis_url: Option<String>,
    pub pepper: Vec<u8>,
    pub cookie_secret: Vec<u8>,
    pub cookie_secure: bool,
    /// When true, `X-Forwarded-For` is trusted (only behind a proxy that overwrites it).
    pub trust_forwarded: bool,
    pub stripe_secret: Option<String>,
    pub stripe_webhook_secret: Option<String>,
    pub stripe_prices: HashMap<String, String>,
    pub credit_price_ids: HashMap<String, String>,
    /// Stripe coupon for the intro offer: 50 percent off, duration once (`STRIPE_INTRO_COUPON_ID`).
    pub stripe_intro_coupon: Option<String>,
    /// Lowercased emails allowed into the admin console (`ADMIN_EMAILS`, comma separated).
    pub admin_emails: Vec<String>,
    /// Default tax on revenue for the admin profit report, in percent (`ADMIN_TAX_REVENUE_PCT`, default 6).
    pub tax_revenue_pct: f64,
    /// Default tax on profit for the admin profit report, in percent (`ADMIN_TAX_PROFIT_PCT`, default 0).
    pub tax_profit_pct: f64,
    /// Fallback payment processing fee for the admin profit report, in percent (`ADMIN_PAYMENT_FEE_PCT`,
    /// default 5); the report prefers the effective rate measured in Stripe balance transactions.
    pub payment_fee_pct: f64,
    pub github_client_id: Option<String>,
    pub github_client_secret: Option<String>,
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    pub dist_dir: PathBuf,
    /// Gateway origin the website Chat talks to (`FAELITH_API_URL`).
    pub api_url: String,
    /// Encrypts the server-managed purpose=chat keys at rest (`CHAT_KEY_SECRET`).
    pub chat_key_secret: Vec<u8>,
    /// Seals TOTP seeds and keys one-time-code MACs (`MFA_SECRET`).
    pub mfa_secret: Vec<u8>,
    /// Transactional email relay; None means no SMTP was configured.
    pub smtp: Option<SmtpConfig>,
}

/// Gateway origin when `FAELITH_API_URL` is unset. For now the website is
/// wired to the test stack (`faelith_api_test`, port 8788); production
/// (`faelith-gateway` on 8080) must set the variable explicitly.
pub const DEFAULT_API_URL: &str = "http://127.0.0.1:8788";

/// Parses a percentage in `0..=100`; missing or invalid values fall back to `default`.
fn parse_pct(raw: Option<String>, default: f64) -> f64 {
    raw.and_then(|value| value.trim().parse::<f64>().ok())
        .filter(|value| value.is_finite() && (0.0..=100.0).contains(value))
        .unwrap_or(default)
}

/// Splits `ADMIN_EMAILS` on commas, trimming and lowercasing; empty entries are dropped.
fn parse_admin_emails(raw: &str) -> Vec<String> {
    raw.split(',').map(|email| email.trim().to_ascii_lowercase()).filter(|email| email.contains('@')).collect()
}

impl WebConfig {
    /// Loads configuration from the process environment.
    pub fn from_env() -> Result<Self> {
        let pepper = env::var("FAELITH_KEY_PEPPER")
            .context("FAELITH_KEY_PEPPER is required")?
            .into_bytes();
        if pepper.len() < 32 {
            anyhow::bail!("FAELITH_KEY_PEPPER must be at least 32 bytes");
        }
        let cookie_secret = env::var("COOKIE_SECRET")
            .context("COOKIE_SECRET is required")?
            .into_bytes();
        if cookie_secret.len() < 32 {
            anyhow::bail!("COOKIE_SECRET must be at least 32 bytes");
        }
        let chat_key_secret = env::var("CHAT_KEY_SECRET")
            .context("CHAT_KEY_SECRET is required")?
            .into_bytes();
        if chat_key_secret.len() < 32 {
            anyhow::bail!("CHAT_KEY_SECRET must be at least 32 bytes");
        }
        if chat_key_secret == cookie_secret || chat_key_secret == pepper {
            anyhow::bail!("CHAT_KEY_SECRET must differ from COOKIE_SECRET and FAELITH_KEY_PEPPER");
        }
        let mfa_secret = env::var("MFA_SECRET")
            .context("MFA_SECRET is required")?
            .into_bytes();
        if mfa_secret.len() < 32 {
            anyhow::bail!("MFA_SECRET must be at least 32 bytes");
        }
        if [&cookie_secret, &pepper, &chat_key_secret].contains(&&mfa_secret) {
            anyhow::bail!("MFA_SECRET must differ from COOKIE_SECRET, FAELITH_KEY_PEPPER, and CHAT_KEY_SECRET");
        }
        let smtp = SmtpConfig::from_env()?;
        let cookie_secure = env::var("COOKIE_SECURE")
            .map(|value| value != "0" && value.to_ascii_lowercase() != "false")
            .unwrap_or(true);
        let mut stripe_prices = HashMap::new();
        for (tier, key) in [
            (PlanTier::Starter, "STRIPE_PRICE_STARTER"),
            (PlanTier::Pro, "STRIPE_PRICE_PRO"),
            (PlanTier::Max, "STRIPE_PRICE_MAX"),
            (PlanTier::Ultra, "STRIPE_PRICE_ULTRA"),
            (PlanTier::Scale, "STRIPE_PRICE_SCALE"),
        ] {
            if let Ok(price) = env::var(key) {
                if !price.is_empty() {
                    stripe_prices.insert(tier.as_str().to_string(), price);
                }
            }
            let yearly_key = format!("{key}_YEARLY");
            if let Ok(price) = env::var(&yearly_key) {
                if !price.is_empty() {
                    stripe_prices.insert(format!("{}:yearly", tier.as_str()), price);
                }
            }
        }
        let mut credit_price_ids = HashMap::new();
        for (pack, key) in [
            ("10", "STRIPE_PRICE_CREDITS_10"),
            ("50", "STRIPE_PRICE_CREDITS_50"),
            ("100", "STRIPE_PRICE_CREDITS_100"),
        ] {
            if let Ok(price) = env::var(key) {
                if !price.is_empty() {
                    credit_price_ids.insert(pack.to_string(), price);
                }
            }
        }
        let config = Self {
            listen: env::var("LISTEN_ADDR").unwrap_or_else(|_| "127.0.0.1:8081".to_string()),
            public_origin: env::var("PUBLIC_ORIGIN")
                .unwrap_or_else(|_| "http://127.0.0.1:5173".to_string()),
            database_url: env::var("DATABASE_URL").ok().filter(|s| !s.is_empty()),
            redis_url: env::var("REDIS_URL").ok().filter(|s| !s.is_empty()),
            pepper,
            cookie_secret,
            cookie_secure,
            trust_forwarded: env::var("TRUST_FORWARDED_HEADERS")
                .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
                .unwrap_or(false),
            stripe_secret: env::var("STRIPE_SECRET_KEY").ok().filter(|s| !s.is_empty()),
            stripe_webhook_secret: env::var("STRIPE_WEBHOOK_SECRET")
                .ok()
                .filter(|s| !s.is_empty()),
            stripe_prices,
            credit_price_ids,
            stripe_intro_coupon: env::var("STRIPE_INTRO_COUPON_ID").ok().filter(|s| !s.is_empty()),
            admin_emails: parse_admin_emails(&env::var("ADMIN_EMAILS").unwrap_or_default()),
            tax_revenue_pct: parse_pct(env::var("ADMIN_TAX_REVENUE_PCT").ok(), 6.0),
            tax_profit_pct: parse_pct(env::var("ADMIN_TAX_PROFIT_PCT").ok(), 0.0),
            payment_fee_pct: parse_pct(env::var("ADMIN_PAYMENT_FEE_PCT").ok(), 5.0),
            github_client_id: env::var("OAUTH_GITHUB_CLIENT_ID")
                .ok()
                .filter(|s| !s.is_empty()),
            github_client_secret: env::var("OAUTH_GITHUB_CLIENT_SECRET")
                .ok()
                .filter(|s| !s.is_empty()),
            google_client_id: env::var("OAUTH_GOOGLE_CLIENT_ID")
                .ok()
                .filter(|s| !s.is_empty()),
            google_client_secret: env::var("OAUTH_GOOGLE_CLIENT_SECRET")
                .ok()
                .filter(|s| !s.is_empty()),
            dist_dir: PathBuf::from(
                env::var("WEB_DIST").unwrap_or_else(|_| "apps/web/dist".to_string()),
            ),
            api_url: env::var("FAELITH_API_URL")
                .ok()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| DEFAULT_API_URL.to_string())
                .trim_end_matches('/')
                .to_string(),
            chat_key_secret,
            mfa_secret,
            smtp,
        };
        config.ensure_production_safe()?;
        Ok(config)
    }

    /// Refuses development shortcuts when the site is served over HTTPS.
    ///
    /// An https origin means real users, so non-Secure cookies or a mailer that
    /// only logs codes would silently weaken sessions and 2FA.
    fn ensure_production_safe(&self) -> Result<()> {
        if !self.public_origin.starts_with("https://") {
            return Ok(());
        }
        if !self.cookie_secure {
            anyhow::bail!("COOKIE_SECURE=0 is not allowed when PUBLIC_ORIGIN is https");
        }
        if self.smtp.is_none() {
            anyhow::bail!("SMTP_HOST is required when PUBLIC_ORIGIN is https");
        }
        Ok(())
    }

    /// In-memory test configuration (HTTP cookies, no Stripe/OAuth secrets).
    pub fn test_config() -> Self {
        Self {
            listen: "127.0.0.1:0".to_string(),
            public_origin: "http://127.0.0.1:5173".to_string(),
            database_url: None,
            redis_url: None,
            pepper: b"test-pepper-32-bytes-minimum!!!".to_vec(),
            cookie_secret: b"test-cookie-secret-32-bytes!!!!".to_vec(),
            cookie_secure: false,
            trust_forwarded: false,
            stripe_secret: Some("sk_test_fake".to_string()),
            stripe_webhook_secret: Some("whsec_test_secret".to_string()),
            stripe_prices: HashMap::from([
                ("starter".to_string(), "price_starter".to_string()),
                ("starter:yearly".to_string(), "price_starter_yearly".to_string()),
            ]),
            credit_price_ids: HashMap::from([("10".to_string(), "price_credits_10".to_string())]),
            stripe_intro_coupon: Some("coupon_intro_test".to_string()),
            admin_emails: vec!["admin@example.com".to_string()],
            tax_revenue_pct: 6.0,
            tax_profit_pct: 0.0,
            payment_fee_pct: 5.0,
            github_client_id: Some("github-client".to_string()),
            github_client_secret: Some("github-secret".to_string()),
            google_client_id: Some("google-client".to_string()),
            google_client_secret: Some("google-secret".to_string()),
            dist_dir: PathBuf::from("apps/web/dist"),
            api_url: "http://127.0.0.1:8788".to_string(),
            chat_key_secret: b"test-chat-key-secret-32-bytes!!".to_vec(),
            mfa_secret: b"test-mfa-secret-32-bytes-minimum!".to_vec(),
            smtp: None,
        }
    }

    /// Session cookie name. `__Host-` requires Secure and no Domain attribute.
    pub fn session_cookie_name(&self) -> &'static str {
        if self.cookie_secure {
            "__Host-faelith-sid"
        } else {
            "faelith-sid"
        }
    }

    /// Short-lived cookie binding an OAuth `state` to the browser that started it.
    pub fn oauth_cookie_name(&self) -> &'static str {
        if self.cookie_secure {
            "__Host-faelith-oauth"
        } else {
            "faelith-oauth"
        }
    }

    /// Short-lived cookie holding a pending two-factor login challenge.
    pub fn mfa_cookie_name(&self) -> &'static str {
        if self.cookie_secure {
            "__Host-faelith-mfa"
        } else {
            "faelith-mfa"
        }
    }

    /// Looks up the Stripe Price ID for a paid plan and billing interval.
    pub fn price_for_plan(&self, plan: PlanTier, interval: BillingInterval) -> Option<&str> {
        let key = match interval {
            BillingInterval::Monthly => plan.as_str().to_string(),
            BillingInterval::Yearly => format!("{}:yearly", plan.as_str()),
        };
        self.stripe_prices.get(&key).map(String::as_str)
    }

    /// Looks up the Stripe Price ID for a credit pack.
    pub fn price_for_pack(&self, pack: CreditPack) -> Option<&str> {
        self.credit_price_ids.get(pack.as_str()).map(String::as_str)
    }
}
