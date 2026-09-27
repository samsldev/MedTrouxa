/**
 * @fileoverview Binary entrypoint for the Faelith Industries website origin.
 * @author Samuel S. L.
 * @version 1.4.0
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
 * - Connects to the same Postgres primary as faelith-gateway
 * - JSON logs omit secrets; Stripe remains in test mode until go-live
 * - SMTP is verified at startup; without it the process refuses to start unless
 *   FAELITH_ALLOW_LOG_MAILER=1 (dev only: codes are written to the log)
 */

use anyhow::{Context, Result};
use faelith_core::postgres::PostgresStore;
use faelith_web::accounts::PostgresAccounts;
use faelith_web::chat_store::PostgresWebChat;
use faelith_web::config::WebConfig;
use faelith_web::limit::{MemoryLimiter, RedisLimiter};
use faelith_web::mailer::{LogMailer, Mailer, SmtpMailer};
use faelith_web::security_store::PostgresSecurity;
use faelith_web::stripe::LiveStripe;
use faelith_web::{app, AppState};
use std::net::SocketAddr;
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(EnvFilter::from_default_env())
        .init();
    let config = WebConfig::from_env()?;
    let database_url = config
        .database_url
        .as_deref()
        .context("DATABASE_URL is required")?;
    let postgres = PostgresStore::connect(database_url).await.map_err(|_| {
        anyhow::anyhow!("postgres connect or migrate failed")
    })?;
    let accounts = PostgresAccounts::new(postgres.pool().clone());
    let chat = PostgresWebChat::new(postgres.pool().clone());
    let security = PostgresSecurity::new(postgres.pool().clone());
    let mailer = build_mailer(&config).await?;
    // The in-memory limiter keeps counters inside one process, so a second
    // worker would let an attacker evade the cap by landing elsewhere.
    // Production without REDIS_URL fails closed; dev opts in explicitly.
    let limiter: Arc<dyn faelith_web::limit::AuthLimiter> = match config.redis_url.as_deref() {
        Some(url) => Arc::new(RedisLimiter::new(url).context("REDIS_URL")?),
        None if allow_in_memory_fallback() => {
            tracing::warn!("REDIS_URL unset; using in-memory auth limiter (dev fallback enabled)");
            Arc::new(MemoryLimiter::new())
        }
        None => anyhow::bail!(
            "REDIS_URL is required; the in-memory auth limiter is per-process and bypassable"
        ),
    };
    // Bounded timeouts: OAuth, JWKS, and Stripe calls must never pin a worker.
    let http = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .context("http client")?;
    let stripe_secret = config
        .stripe_secret
        .clone()
        .context("STRIPE_SECRET_KEY is required")?;
    let stripe = Arc::new(LiveStripe::new(http.clone(), stripe_secret));
    let listen = config.listen.clone();
    let analytics = Arc::new(faelith_web::analytics_store::PostgresAnalytics::new(postgres.pool().clone()));
    let audit = Arc::new(faelith_web::audit_store::PostgresAudit::new(postgres.pool().clone()));
    let nfse_pool = postgres.pool().clone();
    let http_for_nfse = http.clone();
    let state = AppState::new(
        config,
        Arc::new(postgres),
        Arc::new(accounts),
        limiter,
        stripe,
        http,
        Arc::new(chat),
        Arc::new(security),
        mailer,
    )
    .with_insight_stores(analytics, audit);
    let nfse_service = build_nfse(&http_for_nfse)?;
    let state = state.with_nfse(Arc::new(faelith_web::nfse::store::PostgresNfse::new(nfse_pool)), nfse_service.clone());
    if let Some(service) = nfse_service {
        tracing::info!("nfse emitter enabled");
        faelith_web::nfse::spawn_worker(state.clone(), service);
    }
    let addr: SocketAddr = listen.parse().context("LISTEN_ADDR")?;
    tracing::info!(%addr, "faelith-web listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app(state).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}

/// Builds the NFS-e emitter when NFSE_ENABLED=1; a misconfiguration stops the process (fail fast).
fn build_nfse(http: &reqwest::Client) -> Result<Option<Arc<faelith_web::nfse::service::NfseService>>> {
    use faelith_web::nfse::{client::LiveGateway, config::NfseConfig, ptax::BcbPtax, service::NfseService, sign::SigningIdentity};
    let Some(config) = NfseConfig::from_env().map_err(|error| anyhow::anyhow!(error))? else {
        return Ok(None);
    };
    let identity = SigningIdentity::from_pem(&config.cert_pem, &config.key_pem).map_err(|error| anyhow::anyhow!(error))?;
    if identity.not_after < chrono::Utc::now().timestamp() {
        anyhow::bail!("the NFS-e certificate has expired; renew the A1 certificate");
    }
    let gateway = LiveGateway::new(config.environment, &config.tls_identity_pem(), config.ca_bundle_pem.as_deref())
        .map_err(|error| anyhow::anyhow!(error))?;
    let rates = BcbPtax::new(http.clone());
    Ok(Some(Arc::new(NfseService::new(config, identity, Arc::new(gateway), Arc::new(rates)))))
}

/// Builds the transactional mailer, failing closed when SMTP is missing or unreachable.
///
/// Signup and 2FA depend on email, so a production process without a working
/// relay must not start. `FAELITH_ALLOW_LOG_MAILER=1` opts a dev box into
/// logging messages instead; it is ignored when SMTP_HOST is set.
async fn build_mailer(config: &WebConfig) -> Result<Arc<dyn Mailer>> {
    if let Some(smtp) = config.smtp.as_ref() {
        let mailer = SmtpMailer::new(smtp).map_err(|err| anyhow::anyhow!(err))?;
        mailer
            .verify()
            .await
            .map_err(|err| anyhow::anyhow!("{err} (host {}:{})", smtp.host, smtp.port))?;
        tracing::info!(host = %smtp.host, port = smtp.port, "smtp relay verified");
        return Ok(Arc::new(mailer));
    }
    if env_flag("FAELITH_ALLOW_LOG_MAILER") {
        tracing::warn!("SMTP_HOST unset; emails are written to the log (dev fallback enabled)");
        return Ok(Arc::new(LogMailer));
    }
    anyhow::bail!("SMTP_HOST is required; signup verification and 2FA need a mail relay")
}

/// True when an environment flag is `1` or `true` (case-insensitive).
fn env_flag(name: &str) -> bool {
    std::env::var(name)
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

/// Returns true only when a process-local auth limiter is explicitly allowed.
///
/// The in-memory limiter keeps counters inside one process, so a multi-worker
/// deployment would let a caller evade the cap by landing on another worker.
/// Operators set `FAELITH_ALLOW_MEMORY_LIMITER=1` for single-node development;
/// production without `REDIS_URL` fails closed.
fn allow_in_memory_fallback() -> bool {
    env_flag("FAELITH_ALLOW_MEMORY_LIMITER")
}
