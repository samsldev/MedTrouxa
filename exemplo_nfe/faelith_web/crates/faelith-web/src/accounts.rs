/**
 * @fileoverview User, session, OAuth pending, CSRF, and Stripe event persistence.
 * @author Samuel S. L.
 * @version 1.5.0
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
 * - Memory backend for Axum tests; Postgres uses the same primary as the gateway
 * - Session tokens are stored as SHA-256 hashes, never plaintext
 * - Stripe event IDs are unique so webhook delivery is idempotent
 */

use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

/// OAuth identity provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum OAuthProvider {
    GitHub,
    Google,
}

impl OAuthProvider {
    /// Parses a stored provider name.
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "github" => Some(Self::GitHub),
            "google" => Some(Self::Google),
            _ => None,
        }
    }

    /// Catalog wire name.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::GitHub => "github",
            Self::Google => "google",
        }
    }
}

/// Persisted user row (password hash may be absent for OAuth-only accounts).
#[derive(Debug, Clone)]
pub struct UserRecord {
    pub id: Uuid,
    pub org_id: Uuid,
    pub email: String,
    pub password_hash: Option<String>,
    pub name: String,
}

/// Buyer classification captured at Stripe Checkout (who pays: company or person, and where).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BillingProfile {
    pub stripe_customer_id: String,
    pub org_id: Option<Uuid>,
    /// `business` when a company tax id (CNPJ, EU VAT...) was given, else `individual`.
    pub kind: String,
    /// Stripe tax id type (`br_cnpj`, `eu_vat`, `br_cpf`...), when one was given.
    pub tax_id_type: Option<String>,
    /// ISO 3166-1 alpha-2 billing country.
    pub country: Option<String>,
    pub updated_at: DateTime<Utc>,
}

/// Browser session keyed by the SHA-256 of the cookie token.
#[derive(Debug, Clone)]
pub struct SessionRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub expires_at: DateTime<Utc>,
    pub rotated_at: DateTime<Utc>,
    pub user_agent_hash: Option<String>,
    pub ip_hash: Option<String>,
}

/// Authorization-code PKCE state waiting for the provider callback.
#[derive(Debug, Clone)]
pub struct OAuthPending {
    pub state: String,
    pub provider: OAuthProvider,
    pub code_verifier: String,
    pub nonce: Option<String>,
    pub expires_at: DateTime<Utc>,
}

/// Pending CLI authorization (website login that mints a Code API key).
///
/// `approved` is stored as `cli_device_grants.approved`. The Code secret is
/// minted on poll and is never written onto the grant.
#[derive(Debug, Clone)]
pub struct CliDeviceGrant {
    pub user_code: String,
    pub device_code_hash: String,
    pub expires_at: DateTime<Utc>,
    pub user_id: Option<Uuid>,
    pub approved: bool,
    pub plan: Option<String>,
    /// Client IP that started the device login (shown on the approval page).
    pub requester_ip: Option<String>,
    /// User-Agent that started the device login.
    pub requester_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Account, session, CSRF, and Stripe idempotency store.
#[async_trait]
pub trait AccountStore: Send + Sync {
    /// Inserts a user bound 1:1 to an organization.
    async fn insert_user(&self, user: UserRecord) -> Result<(), String>;
    /// Looks up a user by normalized email.
    async fn get_user_by_email(&self, email: &str) -> Result<Option<UserRecord>, String>;
    /// Looks up a user by id.
    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserRecord>, String>;
    /// Website users of one organization (admin console).
    async fn list_users_for_org(&self, org_id: Uuid) -> Result<Vec<UserRecord>, String>;
    /// Updates display name.
    async fn update_name(&self, id: Uuid, name: &str) -> Result<(), String>;
    /// Replaces the Argon2id password hash.
    async fn set_password_hash(&self, id: Uuid, hash: Option<String>) -> Result<(), String>;
    /// Deletes the user (sessions and OAuth rows cascade in Postgres).
    async fn delete_user(&self, id: Uuid) -> Result<(), String>;
    /// Inserts a hashed session token.
    async fn insert_session(&self, session: SessionRecord) -> Result<(), String>;
    /// Resolves a session by token hash when it has not expired.
    async fn get_session_by_hash(&self, token_hash: &str) -> Result<Option<SessionRecord>, String>;
    /// Deletes one session (logout / rotation).
    async fn delete_session(&self, token_hash: &str) -> Result<(), String>;
    /// Deletes every session for a user (password change, account delete).
    async fn delete_sessions_for_user(&self, user_id: Uuid) -> Result<(), String>;
    /// Stores PKCE state until the callback arrives.
    async fn insert_oauth_pending(&self, pending: OAuthPending) -> Result<(), String>;
    /// Removes and returns a pending OAuth row by state.
    async fn take_oauth_pending(&self, state: &str) -> Result<Option<OAuthPending>, String>;
    /// Links an OAuth subject to a user.
    async fn link_oauth(
        &self,
        user_id: Uuid,
        provider: OAuthProvider,
        subject: &str,
    ) -> Result<(), String>;
    /// Removes an OAuth link.
    async fn unlink_oauth(&self, user_id: Uuid, provider: OAuthProvider) -> Result<(), String>;
    /// Returns linked providers for the settings page.
    async fn list_oauth(&self, user_id: Uuid) -> Result<Vec<OAuthProvider>, String>;
    /// Finds a user by provider subject.
    async fn get_user_by_oauth(
        &self,
        provider: OAuthProvider,
        subject: &str,
    ) -> Result<Option<UserRecord>, String>;
    /// Stores a one-time CSRF token hash.
    async fn insert_csrf(&self, token_hash: &str, expires_at: DateTime<Utc>) -> Result<(), String>;
    /// Consumes a CSRF token; returns true when it was valid.
    async fn consume_csrf(&self, token_hash: &str) -> Result<bool, String>;
    /// Inserts a Stripe event id. Returns false when the event was already processed.
    async fn insert_stripe_event(&self, event_id: &str) -> Result<bool, String>;
    /// Forgets an event id whose processing failed, so Stripe's retry is applied.
    async fn delete_stripe_event(&self, event_id: &str) -> Result<(), String>;
    /// Inserts or replaces the buyer profile of a Stripe customer.
    async fn upsert_billing_profile(&self, profile: &BillingProfile) -> Result<(), String>;
    /// Every buyer profile (admin report; one row per Stripe customer).
    async fn list_billing_profiles(&self) -> Result<Vec<BillingProfile>, String>;
    /// Persists a sales-contact lead.
    async fn insert_contact(&self, name: &str, email: &str, message: &str) -> Result<(), String>;
    /// Stores a CLI device-login grant until the user approves it.
    async fn insert_cli_device(&self, grant: CliDeviceGrant) -> Result<(), String>;
    /// Drops expired grants (approved markers and any leftover secrets).
    async fn purge_expired_cli_devices(&self) -> Result<(), String>;
    /// Looks up a live CLI grant by the user-visible code.
    async fn get_cli_device_by_user_code(
        &self,
        user_code: &str,
    ) -> Result<Option<CliDeviceGrant>, String>;
    /// Binds a live grant to the first session that opens it.
    async fn claim_cli_device(
        &self,
        user_code: &str,
        user_id: Uuid,
    ) -> Result<Option<CliDeviceGrant>, String>;
    /// Looks up a live CLI grant by the hashed device secret.
    async fn get_cli_device_by_device_hash(
        &self,
        device_code_hash: &str,
    ) -> Result<Option<CliDeviceGrant>, String>;
    /// Marks the grant approved for this user. The Code key is minted later on poll.
    /// Returns false when another session already approved it.
    async fn approve_cli_device(&self, grant: &CliDeviceGrant) -> Result<bool, String>;
    /// Removes and returns an approved grant so only one poller mints the key.
    async fn take_cli_device_by_device_hash(
        &self,
        device_code_hash: &str,
    ) -> Result<Option<CliDeviceGrant>, String>;
}

/// Process-local account store used by Axum tests.
#[derive(Default)]
pub struct MemoryAccounts {
    inner: Mutex<MemoryInner>,
}

#[derive(Default)]
struct MemoryInner {
    users: HashMap<Uuid, UserRecord>,
    email: HashMap<String, Uuid>,
    sessions: HashMap<String, SessionRecord>,
    pending: HashMap<String, OAuthPending>,
    oauth: HashMap<(OAuthProvider, String), Uuid>,
    oauth_by_user: HashMap<Uuid, Vec<OAuthProvider>>,
    csrf: HashMap<String, DateTime<Utc>>,
    stripe_events: HashMap<String, ()>,
    billing_profiles: HashMap<String, BillingProfile>,
    cli_devices: HashMap<String, CliDeviceGrant>,
}

impl MemoryAccounts {
    /// Creates an empty memory account store.
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl AccountStore for MemoryAccounts {
    async fn insert_user(&self, user: UserRecord) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.email.insert(user.email.clone(), user.id);
        inner.users.insert(user.id, user);
        Ok(())
    }

    async fn get_user_by_email(&self, email: &str) -> Result<Option<UserRecord>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner
            .email
            .get(email)
            .and_then(|id| inner.users.get(id).cloned()))
    }

    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserRecord>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner.users.get(&id).cloned())
    }

    async fn list_users_for_org(&self, org_id: Uuid) -> Result<Vec<UserRecord>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner.users.values().filter(|user| user.org_id == org_id).cloned().collect())
    }

    async fn update_name(&self, id: Uuid, name: &str) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        if let Some(user) = inner.users.get_mut(&id) {
            user.name = name.to_string();
        }
        Ok(())
    }

    async fn set_password_hash(&self, id: Uuid, hash: Option<String>) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        if let Some(user) = inner.users.get_mut(&id) {
            user.password_hash = hash;
        }
        Ok(())
    }

    async fn delete_user(&self, id: Uuid) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        if let Some(user) = inner.users.remove(&id) {
            inner.email.remove(&user.email);
        }
        inner.sessions.retain(|_, session| session.user_id != id);
        inner.oauth.retain(|_, user_id| *user_id != id);
        inner.oauth_by_user.remove(&id);
        Ok(())
    }

    async fn insert_session(&self, session: SessionRecord) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.sessions.insert(session.token_hash.clone(), session);
        Ok(())
    }

    async fn get_session_by_hash(&self, token_hash: &str) -> Result<Option<SessionRecord>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner.sessions.get(token_hash).cloned().filter(|session| {
            session.expires_at > Utc::now()
        }))
    }

    async fn delete_session(&self, token_hash: &str) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.sessions.remove(token_hash);
        Ok(())
    }

    async fn delete_sessions_for_user(&self, user_id: Uuid) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.sessions.retain(|_, session| session.user_id != user_id);
        Ok(())
    }

    async fn insert_oauth_pending(&self, pending: OAuthPending) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.pending.insert(pending.state.clone(), pending);
        Ok(())
    }

    async fn take_oauth_pending(&self, state: &str) -> Result<Option<OAuthPending>, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner.pending.remove(state).filter(|row| row.expires_at > Utc::now()))
    }

    async fn link_oauth(
        &self,
        user_id: Uuid,
        provider: OAuthProvider,
        subject: &str,
    ) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.oauth.insert((provider, subject.to_string()), user_id);
        let list = inner.oauth_by_user.entry(user_id).or_default();
        if !list.contains(&provider) {
            list.push(provider);
        }
        Ok(())
    }

    async fn unlink_oauth(&self, user_id: Uuid, provider: OAuthProvider) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.oauth.retain(|(p, _), uid| !(*p == provider && *uid == user_id));
        if let Some(list) = inner.oauth_by_user.get_mut(&user_id) {
            list.retain(|p| *p != provider);
        }
        Ok(())
    }

    async fn list_oauth(&self, user_id: Uuid) -> Result<Vec<OAuthProvider>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner.oauth_by_user.get(&user_id).cloned().unwrap_or_default())
    }

    async fn get_user_by_oauth(
        &self,
        provider: OAuthProvider,
        subject: &str,
    ) -> Result<Option<UserRecord>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner
            .oauth
            .get(&(provider, subject.to_string()))
            .and_then(|id| inner.users.get(id).cloned()))
    }

    async fn insert_csrf(&self, token_hash: &str, expires_at: DateTime<Utc>) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.csrf.insert(token_hash.to_string(), expires_at);
        Ok(())
    }

    async fn consume_csrf(&self, token_hash: &str) -> Result<bool, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        match inner.csrf.remove(token_hash) {
            Some(expires) if expires > Utc::now() => Ok(true),
            _ => Ok(false),
        }
    }

    async fn insert_stripe_event(&self, event_id: &str) -> Result<bool, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner.stripe_events.insert(event_id.to_string(), ()).is_none())
    }

    async fn delete_stripe_event(&self, event_id: &str) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.stripe_events.remove(event_id);
        Ok(())
    }

    async fn insert_contact(&self, _name: &str, _email: &str, _message: &str) -> Result<(), String> {
        Ok(())
    }

    async fn upsert_billing_profile(&self, profile: &BillingProfile) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.billing_profiles.insert(profile.stripe_customer_id.clone(), profile.clone());
        Ok(())
    }

    async fn list_billing_profiles(&self) -> Result<Vec<BillingProfile>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner.billing_profiles.values().cloned().collect())
    }

    async fn insert_cli_device(&self, grant: CliDeviceGrant) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.cli_devices.insert(grant.user_code.clone(), grant);
        Ok(())
    }

    async fn purge_expired_cli_devices(&self) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        let now = Utc::now();
        inner.cli_devices.retain(|_, grant| grant.expires_at > now);
        Ok(())
    }

    async fn get_cli_device_by_user_code(
        &self,
        user_code: &str,
    ) -> Result<Option<CliDeviceGrant>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner
            .cli_devices
            .get(user_code)
            .cloned()
            .filter(|grant| grant.expires_at > Utc::now()))
    }

    async fn claim_cli_device(
        &self,
        user_code: &str,
        user_id: Uuid,
    ) -> Result<Option<CliDeviceGrant>, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        let Some(grant) = inner.cli_devices.get_mut(user_code) else {
            return Ok(None);
        };
        if grant.expires_at <= Utc::now() {
            return Ok(None);
        }
        match grant.user_id {
            None => grant.user_id = Some(user_id),
            Some(existing) if existing == user_id => {}
            Some(_) => return Ok(None),
        }
        Ok(Some(grant.clone()))
    }

    async fn get_cli_device_by_device_hash(
        &self,
        device_code_hash: &str,
    ) -> Result<Option<CliDeviceGrant>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner
            .cli_devices
            .values()
            .find(|grant| grant.device_code_hash == device_code_hash && grant.expires_at > Utc::now())
            .cloned())
    }

    async fn approve_cli_device(&self, grant: &CliDeviceGrant) -> Result<bool, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        let Some(existing) = inner.cli_devices.get_mut(&grant.user_code) else {
            return Ok(false);
        };
        if existing.expires_at <= Utc::now() || existing.approved {
            return Ok(false);
        }
        if let Some(owner) = existing.user_id {
            if grant.user_id.is_some_and(|id| id != owner) {
                return Ok(false);
            }
        }
        *existing = grant.clone();
        Ok(true)
    }

    async fn take_cli_device_by_device_hash(
        &self,
        device_code_hash: &str,
    ) -> Result<Option<CliDeviceGrant>, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        let now = Utc::now();
        let key = inner.cli_devices.iter().find_map(|(code, grant)| {
            if grant.device_code_hash == device_code_hash
                && grant.approved
                && grant.expires_at > now
            {
                Some(code.clone())
            } else {
                None
            }
        });
        Ok(key.and_then(|code| inner.cli_devices.remove(&code)))
    }
}

/// Postgres account store sharing the gateway primary.
pub struct PostgresAccounts {
    pool: PgPool,
}

impl PostgresAccounts {
    /// Wraps an existing primary pool (migrations run in PostgresStore::connect).
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

/// Maps a users row onto the domain record.
fn map_user(row: &sqlx::postgres::PgRow) -> UserRecord {
    UserRecord {
        id: row.get("id"),
        org_id: row.get("org_id"),
        email: row.get("email"),
        password_hash: row.get("password_hash"),
        name: row.get("name"),
    }
}

#[async_trait]
impl AccountStore for PostgresAccounts {
    async fn insert_user(&self, user: UserRecord) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO users (id, org_id, email, password_hash, name) VALUES ($1,$2,$3,$4,$5)",
        )
        .bind(user.id)
        .bind(user.org_id)
        .bind(&user.email)
        .bind(user.password_hash.as_deref())
        .bind(&user.name)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn get_user_by_email(&self, email: &str) -> Result<Option<UserRecord>, String> {
        let row = sqlx::query(
            "SELECT id, org_id, email, password_hash, name FROM users WHERE email = $1",
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.map(|row| map_user(&row)))
    }

    async fn get_user_by_id(&self, id: Uuid) -> Result<Option<UserRecord>, String> {
        let row = sqlx::query(
            "SELECT id, org_id, email, password_hash, name FROM users WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.map(|row| map_user(&row)))
    }

    async fn list_users_for_org(&self, org_id: Uuid) -> Result<Vec<UserRecord>, String> {
        let rows = sqlx::query("SELECT id, org_id, email, password_hash, name FROM users WHERE org_id = $1 ORDER BY email")
            .bind(org_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(rows.iter().map(map_user).collect())
    }

    async fn update_name(&self, id: Uuid, name: &str) -> Result<(), String> {
        sqlx::query("UPDATE users SET name = $2 WHERE id = $1")
            .bind(id)
            .bind(name)
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn set_password_hash(&self, id: Uuid, hash: Option<String>) -> Result<(), String> {
        sqlx::query("UPDATE users SET password_hash = $2 WHERE id = $1")
            .bind(id)
            .bind(hash.as_deref())
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn delete_user(&self, id: Uuid) -> Result<(), String> {
        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn insert_session(&self, session: SessionRecord) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO sessions (id, user_id, token_hash, expires_at, rotated_at, user_agent_hash, ip_hash)
             VALUES ($1,$2,$3,$4,$5,$6,$7)",
        )
        .bind(session.id)
        .bind(session.user_id)
        .bind(&session.token_hash)
        .bind(session.expires_at)
        .bind(session.rotated_at)
        .bind(session.user_agent_hash.as_deref())
        .bind(session.ip_hash.as_deref())
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn get_session_by_hash(&self, token_hash: &str) -> Result<Option<SessionRecord>, String> {
        let row = sqlx::query(
            "SELECT id, user_id, token_hash, expires_at, rotated_at, user_agent_hash, ip_hash
             FROM sessions
             WHERE token_hash = $1 AND expires_at > now()",
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.map(|row| SessionRecord {
            id: row.get("id"),
            user_id: row.get("user_id"),
            token_hash: row.get("token_hash"),
            expires_at: row.get("expires_at"),
            rotated_at: row.get("rotated_at"),
            user_agent_hash: row.get("user_agent_hash"),
            ip_hash: row.get("ip_hash"),
        }))
    }

    async fn delete_session(&self, token_hash: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
            .bind(token_hash)
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn delete_sessions_for_user(&self, user_id: Uuid) -> Result<(), String> {
        sqlx::query("DELETE FROM sessions WHERE user_id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn insert_oauth_pending(&self, pending: OAuthPending) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO oauth_pending (state, provider, code_verifier, nonce, expires_at)
             VALUES ($1,$2,$3,$4,$5)",
        )
        .bind(&pending.state)
        .bind(pending.provider.as_str())
        .bind(&pending.code_verifier)
        .bind(pending.nonce.as_deref())
        .bind(pending.expires_at)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn take_oauth_pending(&self, state: &str) -> Result<Option<OAuthPending>, String> {
        let row = sqlx::query(
            "DELETE FROM oauth_pending WHERE state = $1 AND expires_at > now()
             RETURNING state, provider, code_verifier, nonce, expires_at",
        )
        .bind(state)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.and_then(|row| {
            let provider = OAuthProvider::parse(row.get("provider"))?;
            Some(OAuthPending {
                state: row.get("state"),
                provider,
                code_verifier: row.get("code_verifier"),
                nonce: row.get("nonce"),
                expires_at: row.get("expires_at"),
            })
        }))
    }

    async fn link_oauth(
        &self,
        user_id: Uuid,
        provider: OAuthProvider,
        subject: &str,
    ) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO oauth_accounts (user_id, provider, subject) VALUES ($1,$2,$3)
             ON CONFLICT (provider, subject) DO UPDATE SET user_id = EXCLUDED.user_id",
        )
        .bind(user_id)
        .bind(provider.as_str())
        .bind(subject)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn unlink_oauth(&self, user_id: Uuid, provider: OAuthProvider) -> Result<(), String> {
        sqlx::query("DELETE FROM oauth_accounts WHERE user_id = $1 AND provider = $2")
            .bind(user_id)
            .bind(provider.as_str())
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn list_oauth(&self, user_id: Uuid) -> Result<Vec<OAuthProvider>, String> {
        let rows = sqlx::query("SELECT provider FROM oauth_accounts WHERE user_id = $1")
            .bind(user_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(rows
            .iter()
            .filter_map(|row| OAuthProvider::parse(row.get("provider")))
            .collect())
    }

    async fn get_user_by_oauth(
        &self,
        provider: OAuthProvider,
        subject: &str,
    ) -> Result<Option<UserRecord>, String> {
        let row = sqlx::query(
            "SELECT u.id, u.org_id, u.email, u.password_hash, u.name
             FROM oauth_accounts o JOIN users u ON u.id = o.user_id
             WHERE o.provider = $1 AND o.subject = $2",
        )
        .bind(provider.as_str())
        .bind(subject)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.map(|row| map_user(&row)))
    }

    async fn insert_csrf(&self, token_hash: &str, expires_at: DateTime<Utc>) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO csrf_tokens (token_hash, expires_at) VALUES ($1,$2)
             ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at",
        )
        .bind(token_hash)
        .bind(expires_at)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn consume_csrf(&self, token_hash: &str) -> Result<bool, String> {
        let row = sqlx::query(
            "DELETE FROM csrf_tokens
             WHERE token_hash = $1 AND expires_at > now()
             RETURNING token_hash",
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.is_some())
    }

    async fn insert_stripe_event(&self, event_id: &str) -> Result<bool, String> {
        let row = sqlx::query(
            "INSERT INTO stripe_events (id) VALUES ($1)
             ON CONFLICT (id) DO NOTHING
             RETURNING id",
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.is_some())
    }

    async fn delete_stripe_event(&self, event_id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM stripe_events WHERE id = $1")
            .bind(event_id)
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn upsert_billing_profile(&self, profile: &BillingProfile) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO billing_profiles (stripe_customer_id, org_id, kind, tax_id_type, country, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (stripe_customer_id) DO UPDATE SET
                 org_id = COALESCE(EXCLUDED.org_id, billing_profiles.org_id),
                 kind = EXCLUDED.kind,
                 tax_id_type = EXCLUDED.tax_id_type,
                 country = COALESCE(EXCLUDED.country, billing_profiles.country),
                 updated_at = EXCLUDED.updated_at",
        )
        .bind(&profile.stripe_customer_id)
        .bind(profile.org_id)
        .bind(&profile.kind)
        .bind(profile.tax_id_type.as_deref())
        .bind(profile.country.as_deref())
        .bind(profile.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn list_billing_profiles(&self) -> Result<Vec<BillingProfile>, String> {
        let rows = sqlx::query("SELECT stripe_customer_id, org_id, kind, tax_id_type, country, updated_at FROM billing_profiles")
            .fetch_all(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(rows
            .iter()
            .map(|row| BillingProfile {
                stripe_customer_id: row.get("stripe_customer_id"),
                org_id: row.get("org_id"),
                kind: row.get("kind"),
                tax_id_type: row.get("tax_id_type"),
                country: row.get("country"),
                updated_at: row.get("updated_at"),
            })
            .collect())
    }

    async fn insert_contact(&self, name: &str, email: &str, message: &str) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO contact_leads (id, name, email, message) VALUES ($1,$2,$3,$4)",
        )
        .bind(Uuid::new_v4())
        .bind(name)
        .bind(email)
        .bind(message)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn insert_cli_device(&self, grant: CliDeviceGrant) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO cli_device_grants
             (user_code, device_code_hash, expires_at, user_id, approved, plan,
              requester_ip, requester_agent, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        )
        .bind(&grant.user_code)
        .bind(&grant.device_code_hash)
        .bind(grant.expires_at)
        .bind(grant.user_id)
        .bind(grant.approved)
        .bind(grant.plan.as_deref())
        .bind(grant.requester_ip.as_deref())
        .bind(grant.requester_agent.as_deref())
        .bind(grant.created_at)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn purge_expired_cli_devices(&self) -> Result<(), String> {
        sqlx::query("DELETE FROM cli_device_grants WHERE expires_at <= now()")
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn get_cli_device_by_user_code(
        &self,
        user_code: &str,
    ) -> Result<Option<CliDeviceGrant>, String> {
        map_cli_device(
            sqlx::query(
                "SELECT user_code, device_code_hash, expires_at, user_id, approved, plan,
                        requester_ip, requester_agent, created_at
                 FROM cli_device_grants
                 WHERE user_code = $1 AND expires_at > now()",
            )
            .bind(user_code)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| err.to_string())?,
        )
    }

    async fn claim_cli_device(
        &self,
        user_code: &str,
        user_id: Uuid,
    ) -> Result<Option<CliDeviceGrant>, String> {
        map_cli_device(
            sqlx::query(
                "UPDATE cli_device_grants
                 SET user_id = $2
                 WHERE user_code = $1
                   AND expires_at > now()
                   AND (user_id IS NULL OR user_id = $2)
                 RETURNING user_code, device_code_hash, expires_at, user_id, approved, plan, requester_ip, requester_agent, created_at",
            )
            .bind(user_code)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| err.to_string())?,
        )
    }

    async fn get_cli_device_by_device_hash(
        &self,
        device_code_hash: &str,
    ) -> Result<Option<CliDeviceGrant>, String> {
        map_cli_device(
            sqlx::query(
                "SELECT user_code, device_code_hash, expires_at, user_id, approved, plan,
                        requester_ip, requester_agent, created_at
                 FROM cli_device_grants
                 WHERE device_code_hash = $1 AND expires_at > now()",
            )
            .bind(device_code_hash)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| err.to_string())?,
        )
    }

    async fn approve_cli_device(&self, grant: &CliDeviceGrant) -> Result<bool, String> {
        let result = sqlx::query(
            "UPDATE cli_device_grants
             SET user_id = $2, approved = $3, plan = $4
             WHERE user_code = $1
               AND approved = false
               AND expires_at > now()
               AND (user_id IS NULL OR user_id = $2)",
        )
        .bind(&grant.user_code)
        .bind(grant.user_id)
        .bind(grant.approved)
        .bind(grant.plan.as_deref())
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(result.rows_affected() == 1)
    }

    async fn take_cli_device_by_device_hash(
        &self,
        device_code_hash: &str,
    ) -> Result<Option<CliDeviceGrant>, String> {
        map_cli_device(
            sqlx::query(
                "DELETE FROM cli_device_grants
                 WHERE device_code_hash = $1 AND approved = true AND expires_at > now()
                 RETURNING user_code, device_code_hash, expires_at, user_id, approved, plan, requester_ip, requester_agent, created_at",
            )
            .bind(device_code_hash)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| err.to_string())?,
        )
    }
}

fn map_cli_device(row: Option<sqlx::postgres::PgRow>) -> Result<Option<CliDeviceGrant>, String> {
    Ok(row.map(|row| CliDeviceGrant {
        user_code: row.get("user_code"),
        device_code_hash: row.get("device_code_hash"),
        expires_at: row.get("expires_at"),
        user_id: row.get("user_id"),
        approved: row.get("approved"),
        plan: row.get("plan"),
        requester_ip: row.get("requester_ip"),
        requester_agent: row.get("requester_agent"),
        created_at: row.get("created_at"),
    }))
}

/// Session lifetime used when issuing cookies (14 days).
pub fn session_ttl() -> Duration {
    Duration::days(14)
}
