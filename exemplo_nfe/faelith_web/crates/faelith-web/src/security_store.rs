/**
 * @fileoverview Persistence for pending signups, 2FA factors, challenges, and step-up codes.
 * @author Samuel S. L.
 * @version 1.1.0
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
 * - Separate from AccountStore so identity and second-factor state evolve independently
 * - Replay-sensitive writes (TOTP step, backup code use, attempt counters) are single atomic statements
 * - Reads filter expired rows; writes opportunistically purge them so tables stay small
 * - Memory backend mirrors Postgres semantics for Axum tests
 * Primary docs: https://docs.rs/sqlx/latest/sqlx/
 */

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

/// Password signup waiting for its email code.
#[derive(Debug, Clone)]
pub struct PendingSignup {
    pub email: String,
    pub name: String,
    pub password_hash: String,
    pub code_hash: String,
    pub attempts: i32,
    pub expires_at: DateTime<Utc>,
    pub resend_after: DateTime<Utc>,
}

/// Second-factor configuration for one user.
#[derive(Debug, Clone, Default)]
pub struct MfaState {
    pub totp_secret_enc: Option<Vec<u8>>,
    pub totp_pending_enc: Option<Vec<u8>>,
    pub totp_enabled_at: Option<DateTime<Utc>>,
    pub totp_last_step: i64,
    pub email_enabled_at: Option<DateTime<Utc>>,
}

impl MfaState {
    /// True when an authenticator app is active.
    pub fn totp_enabled(&self) -> bool {
        self.totp_enabled_at.is_some() && self.totp_secret_enc.is_some()
    }

    /// True when email codes are an active second factor.
    pub fn email_enabled(&self) -> bool {
        self.email_enabled_at.is_some()
    }

    /// True when any second factor is active, i.e. login requires a challenge.
    pub fn any_enabled(&self) -> bool {
        self.totp_enabled() || self.email_enabled()
    }
}

/// Login that passed the first factor and awaits the second.
#[derive(Debug, Clone)]
pub struct MfaChallenge {
    pub token_hash: String,
    pub user_id: Uuid,
    pub attempts: i32,
    pub email_code_hash: Option<String>,
    pub email_sent_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
}

/// Email code that re-proves a signed-in user before a security change.
#[derive(Debug, Clone)]
pub struct StepUpCode {
    pub user_id: Uuid,
    pub code_hash: String,
    pub attempts: i32,
    pub expires_at: DateTime<Utc>,
    pub resend_after: DateTime<Utc>,
}

/// Storage for signup verification and two-factor authentication.
#[async_trait]
pub trait SecurityStore: Send + Sync {
    /// Inserts or replaces the pending signup for an email (a new code resets attempts).
    async fn upsert_pending_signup(&self, pending: PendingSignup) -> Result<(), String>;
    /// Live pending signup for an email.
    async fn get_pending_signup(&self, email: &str) -> Result<Option<PendingSignup>, String>;
    /// Atomically increments and returns the failed-attempt counter.
    async fn bump_pending_signup_attempts(&self, email: &str) -> Result<i32, String>;
    /// Removes a pending signup (verified, burned, or superseded).
    async fn delete_pending_signup(&self, email: &str) -> Result<(), String>;

    /// Current 2FA state; default (nothing enabled) when no row exists.
    async fn get_mfa(&self, user_id: Uuid) -> Result<MfaState, String>;
    /// Stores or clears the unconfirmed TOTP seed from enrollment.
    async fn set_totp_pending(&self, user_id: Uuid, sealed: Option<Vec<u8>>) -> Result<(), String>;
    /// Promotes a confirmed seed to active and records the step that confirmed it.
    async fn enable_totp(&self, user_id: Uuid, sealed: Vec<u8>, step: i64) -> Result<(), String>;
    /// Records a used TOTP step only if it is newer; false means replay.
    async fn advance_totp_step(&self, user_id: Uuid, step: i64) -> Result<bool, String>;
    /// Removes the authenticator app factor.
    async fn disable_totp(&self, user_id: Uuid) -> Result<(), String>;
    /// Turns the email-code factor on or off.
    async fn set_email_enabled(&self, user_id: Uuid, enabled: bool) -> Result<(), String>;

    /// Replaces every recovery code with a new set of MACs.
    async fn replace_backup_codes(&self, user_id: Uuid, hashes: Vec<String>) -> Result<(), String>;
    /// Marks an unused code as used; false when it is unknown or already spent.
    async fn consume_backup_code(&self, user_id: Uuid, hash: &str) -> Result<bool, String>;
    /// Number of unused recovery codes.
    async fn count_backup_codes(&self, user_id: Uuid) -> Result<i64, String>;
    /// Deletes all recovery codes (when the last factor is turned off).
    async fn delete_backup_codes(&self, user_id: Uuid) -> Result<(), String>;

    /// Stores a new login challenge.
    async fn insert_challenge(&self, challenge: MfaChallenge) -> Result<(), String>;
    /// Live challenge by token hash.
    async fn get_challenge(&self, token_hash: &str) -> Result<Option<MfaChallenge>, String>;
    /// Atomically increments and returns the failed-attempt counter.
    async fn bump_challenge_attempts(&self, token_hash: &str) -> Result<i32, String>;
    /// Attaches a freshly emailed code to the challenge.
    async fn set_challenge_email_code(
        &self,
        token_hash: &str,
        code_hash: &str,
        sent_at: DateTime<Utc>,
    ) -> Result<(), String>;
    /// Consumes a challenge; true only for the caller that removed it.
    async fn take_challenge(&self, token_hash: &str) -> Result<bool, String>;

    /// Inserts or replaces the step-up code for a user.
    async fn upsert_stepup(&self, code: StepUpCode) -> Result<(), String>;
    /// Live step-up code for a user.
    async fn get_stepup(&self, user_id: Uuid) -> Result<Option<StepUpCode>, String>;
    /// Atomically increments and returns the failed-attempt counter.
    async fn bump_stepup_attempts(&self, user_id: Uuid) -> Result<i32, String>;
    /// Removes a step-up code after use or when burned.
    async fn delete_stepup(&self, user_id: Uuid) -> Result<(), String>;

    /// Stores a single-use reset token hash, replacing older tokens for the user.
    async fn insert_password_reset(
        &self,
        token_hash: &str,
        user_id: Uuid,
        expires_at: DateTime<Utc>,
    ) -> Result<(), String>;
    /// Consumes a live reset token and returns its user; a second call gets None.
    async fn take_password_reset(&self, token_hash: &str) -> Result<Option<Uuid>, String>;
}

/// Process-local store used by Axum tests.
#[derive(Default)]
pub struct MemorySecurity {
    inner: Mutex<MemoryInner>,
}

#[derive(Default)]
struct MemoryInner {
    pending: HashMap<String, PendingSignup>,
    mfa: HashMap<Uuid, MfaState>,
    backup: HashMap<Uuid, Vec<(String, bool)>>,
    challenges: HashMap<String, MfaChallenge>,
    stepups: HashMap<Uuid, StepUpCode>,
    resets: HashMap<String, (Uuid, DateTime<Utc>)>,
}

impl MemorySecurity {
    /// Creates an empty store.
    pub fn new() -> Self {
        Self::default()
    }

    /// Locks the inner maps, mapping poisoning to a store error.
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, MemoryInner>, String> {
        self.inner.lock().map_err(|err| err.to_string())
    }
}

#[async_trait]
impl SecurityStore for MemorySecurity {
    async fn upsert_pending_signup(&self, pending: PendingSignup) -> Result<(), String> {
        self.lock()?.pending.insert(pending.email.clone(), pending);
        Ok(())
    }

    async fn get_pending_signup(&self, email: &str) -> Result<Option<PendingSignup>, String> {
        Ok(self
            .lock()?
            .pending
            .get(email)
            .filter(|row| row.expires_at > Utc::now())
            .cloned())
    }

    async fn bump_pending_signup_attempts(&self, email: &str) -> Result<i32, String> {
        let mut inner = self.lock()?;
        let row = inner.pending.get_mut(email).ok_or("pending signup missing")?;
        row.attempts += 1;
        Ok(row.attempts)
    }

    async fn delete_pending_signup(&self, email: &str) -> Result<(), String> {
        self.lock()?.pending.remove(email);
        Ok(())
    }

    async fn get_mfa(&self, user_id: Uuid) -> Result<MfaState, String> {
        Ok(self.lock()?.mfa.get(&user_id).cloned().unwrap_or_default())
    }

    async fn set_totp_pending(&self, user_id: Uuid, sealed: Option<Vec<u8>>) -> Result<(), String> {
        self.lock()?.mfa.entry(user_id).or_default().totp_pending_enc = sealed;
        Ok(())
    }

    async fn enable_totp(&self, user_id: Uuid, sealed: Vec<u8>, step: i64) -> Result<(), String> {
        let mut inner = self.lock()?;
        let state = inner.mfa.entry(user_id).or_default();
        state.totp_secret_enc = Some(sealed);
        state.totp_pending_enc = None;
        state.totp_enabled_at = Some(Utc::now());
        state.totp_last_step = step;
        Ok(())
    }

    async fn advance_totp_step(&self, user_id: Uuid, step: i64) -> Result<bool, String> {
        let mut inner = self.lock()?;
        let state = inner.mfa.entry(user_id).or_default();
        if step <= state.totp_last_step {
            return Ok(false);
        }
        state.totp_last_step = step;
        Ok(true)
    }

    async fn disable_totp(&self, user_id: Uuid) -> Result<(), String> {
        let mut inner = self.lock()?;
        let state = inner.mfa.entry(user_id).or_default();
        state.totp_secret_enc = None;
        state.totp_pending_enc = None;
        state.totp_enabled_at = None;
        Ok(())
    }

    async fn set_email_enabled(&self, user_id: Uuid, enabled: bool) -> Result<(), String> {
        self.lock()?.mfa.entry(user_id).or_default().email_enabled_at =
            enabled.then(Utc::now);
        Ok(())
    }

    async fn replace_backup_codes(&self, user_id: Uuid, hashes: Vec<String>) -> Result<(), String> {
        self.lock()?
            .backup
            .insert(user_id, hashes.into_iter().map(|hash| (hash, false)).collect());
        Ok(())
    }

    async fn consume_backup_code(&self, user_id: Uuid, hash: &str) -> Result<bool, String> {
        let mut inner = self.lock()?;
        let Some(codes) = inner.backup.get_mut(&user_id) else {
            return Ok(false);
        };
        match codes.iter_mut().find(|(stored, used)| stored == hash && !*used) {
            Some(entry) => {
                entry.1 = true;
                Ok(true)
            }
            None => Ok(false),
        }
    }

    async fn count_backup_codes(&self, user_id: Uuid) -> Result<i64, String> {
        Ok(self
            .lock()?
            .backup
            .get(&user_id)
            .map(|codes| codes.iter().filter(|(_, used)| !*used).count() as i64)
            .unwrap_or(0))
    }

    async fn delete_backup_codes(&self, user_id: Uuid) -> Result<(), String> {
        self.lock()?.backup.remove(&user_id);
        Ok(())
    }

    async fn insert_challenge(&self, challenge: MfaChallenge) -> Result<(), String> {
        self.lock()?
            .challenges
            .insert(challenge.token_hash.clone(), challenge);
        Ok(())
    }

    async fn get_challenge(&self, token_hash: &str) -> Result<Option<MfaChallenge>, String> {
        Ok(self
            .lock()?
            .challenges
            .get(token_hash)
            .filter(|row| row.expires_at > Utc::now())
            .cloned())
    }

    async fn bump_challenge_attempts(&self, token_hash: &str) -> Result<i32, String> {
        let mut inner = self.lock()?;
        let row = inner.challenges.get_mut(token_hash).ok_or("challenge missing")?;
        row.attempts += 1;
        Ok(row.attempts)
    }

    async fn set_challenge_email_code(
        &self,
        token_hash: &str,
        code_hash: &str,
        sent_at: DateTime<Utc>,
    ) -> Result<(), String> {
        let mut inner = self.lock()?;
        let row = inner.challenges.get_mut(token_hash).ok_or("challenge missing")?;
        row.email_code_hash = Some(code_hash.to_string());
        row.email_sent_at = Some(sent_at);
        Ok(())
    }

    async fn take_challenge(&self, token_hash: &str) -> Result<bool, String> {
        Ok(self.lock()?.challenges.remove(token_hash).is_some())
    }

    async fn upsert_stepup(&self, code: StepUpCode) -> Result<(), String> {
        self.lock()?.stepups.insert(code.user_id, code);
        Ok(())
    }

    async fn get_stepup(&self, user_id: Uuid) -> Result<Option<StepUpCode>, String> {
        Ok(self
            .lock()?
            .stepups
            .get(&user_id)
            .filter(|row| row.expires_at > Utc::now())
            .cloned())
    }

    async fn bump_stepup_attempts(&self, user_id: Uuid) -> Result<i32, String> {
        let mut inner = self.lock()?;
        let row = inner.stepups.get_mut(&user_id).ok_or("step-up code missing")?;
        row.attempts += 1;
        Ok(row.attempts)
    }

    async fn delete_stepup(&self, user_id: Uuid) -> Result<(), String> {
        self.lock()?.stepups.remove(&user_id);
        Ok(())
    }

    async fn insert_password_reset(
        &self,
        token_hash: &str,
        user_id: Uuid,
        expires_at: DateTime<Utc>,
    ) -> Result<(), String> {
        let mut inner = self.lock()?;
        inner.resets.retain(|_, (owner, _)| *owner != user_id);
        inner.resets.insert(token_hash.to_string(), (user_id, expires_at));
        Ok(())
    }

    async fn take_password_reset(&self, token_hash: &str) -> Result<Option<Uuid>, String> {
        let removed = self.lock()?.resets.remove(token_hash);
        Ok(removed.filter(|(_, until)| *until > Utc::now()).map(|(user_id, _)| user_id))
    }
}

/// Postgres store sharing the gateway primary (tables from migration 024).
pub struct PostgresSecurity {
    pool: PgPool,
}

impl PostgresSecurity {
    /// Wraps the primary pool (migrations already ran in PostgresStore::connect).
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Executes a statement that returns no rows.
    async fn exec(&self, query: sqlx::query::Query<'_, sqlx::Postgres, sqlx::postgres::PgArguments>) -> Result<(), String> {
        query
            .execute(&self.pool)
            .await
            .map(|_| ())
            .map_err(|err| err.to_string())
    }

    /// Runs a bound `... RETURNING attempts` statement and reads the counter.
    async fn bump(&self, query: sqlx::query::Query<'_, sqlx::Postgres, sqlx::postgres::PgArguments>) -> Result<i32, String> {
        let row = query
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| err.to_string())?
            .ok_or("row missing")?;
        Ok(row.get("attempts"))
    }
}

#[async_trait]
impl SecurityStore for PostgresSecurity {
    async fn upsert_pending_signup(&self, pending: PendingSignup) -> Result<(), String> {
        self.exec(sqlx::query("DELETE FROM pending_signups WHERE expires_at <= now()"))
            .await?;
        self.exec(
            sqlx::query(
                "INSERT INTO pending_signups
                 (email, name, password_hash, code_hash, attempts, expires_at, resend_after)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (email) DO UPDATE SET
                   name = EXCLUDED.name,
                   password_hash = EXCLUDED.password_hash,
                   code_hash = EXCLUDED.code_hash,
                   attempts = EXCLUDED.attempts,
                   expires_at = EXCLUDED.expires_at,
                   resend_after = EXCLUDED.resend_after,
                   created_at = now()",
            )
            .bind(&pending.email)
            .bind(&pending.name)
            .bind(&pending.password_hash)
            .bind(&pending.code_hash)
            .bind(pending.attempts)
            .bind(pending.expires_at)
            .bind(pending.resend_after),
        )
        .await
    }

    async fn get_pending_signup(&self, email: &str) -> Result<Option<PendingSignup>, String> {
        let row = sqlx::query(
            "SELECT email, name, password_hash, code_hash, attempts, expires_at, resend_after
             FROM pending_signups WHERE email = $1 AND expires_at > now()",
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.map(|row| PendingSignup {
            email: row.get("email"),
            name: row.get("name"),
            password_hash: row.get("password_hash"),
            code_hash: row.get("code_hash"),
            attempts: row.get("attempts"),
            expires_at: row.get("expires_at"),
            resend_after: row.get("resend_after"),
        }))
    }

    async fn bump_pending_signup_attempts(&self, email: &str) -> Result<i32, String> {
        self.bump(sqlx::query("UPDATE pending_signups SET attempts = attempts + 1 WHERE email = $1 RETURNING attempts").bind(email.to_string())).await
    }

    async fn delete_pending_signup(&self, email: &str) -> Result<(), String> {
        self.exec(sqlx::query("DELETE FROM pending_signups WHERE email = $1").bind(email))
            .await
    }

    async fn get_mfa(&self, user_id: Uuid) -> Result<MfaState, String> {
        let row = sqlx::query(
            "SELECT totp_secret_enc, totp_pending_enc, totp_enabled_at, totp_last_step, email_enabled_at
             FROM user_mfa WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row
            .map(|row| MfaState {
                totp_secret_enc: row.get("totp_secret_enc"),
                totp_pending_enc: row.get("totp_pending_enc"),
                totp_enabled_at: row.get("totp_enabled_at"),
                totp_last_step: row.get("totp_last_step"),
                email_enabled_at: row.get("email_enabled_at"),
            })
            .unwrap_or_default())
    }

    async fn set_totp_pending(&self, user_id: Uuid, sealed: Option<Vec<u8>>) -> Result<(), String> {
        self.exec(
            sqlx::query(
                "INSERT INTO user_mfa (user_id, totp_pending_enc) VALUES ($1,$2)
                 ON CONFLICT (user_id) DO UPDATE SET totp_pending_enc = EXCLUDED.totp_pending_enc, updated_at = now()",
            )
            .bind(user_id)
            .bind(sealed),
        )
        .await
    }

    async fn enable_totp(&self, user_id: Uuid, sealed: Vec<u8>, step: i64) -> Result<(), String> {
        self.exec(
            sqlx::query(
                "INSERT INTO user_mfa (user_id, totp_secret_enc, totp_enabled_at, totp_last_step)
                 VALUES ($1,$2,now(),$3)
                 ON CONFLICT (user_id) DO UPDATE SET
                   totp_secret_enc = EXCLUDED.totp_secret_enc,
                   totp_pending_enc = NULL,
                   totp_enabled_at = now(),
                   totp_last_step = EXCLUDED.totp_last_step,
                   updated_at = now()",
            )
            .bind(user_id)
            .bind(sealed)
            .bind(step),
        )
        .await
    }

    async fn advance_totp_step(&self, user_id: Uuid, step: i64) -> Result<bool, String> {
        let result = sqlx::query(
            "UPDATE user_mfa SET totp_last_step = $2, updated_at = now()
             WHERE user_id = $1 AND totp_last_step < $2",
        )
        .bind(user_id)
        .bind(step)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(result.rows_affected() == 1)
    }

    async fn disable_totp(&self, user_id: Uuid) -> Result<(), String> {
        self.exec(
            sqlx::query(
                "UPDATE user_mfa SET totp_secret_enc = NULL, totp_pending_enc = NULL,
                   totp_enabled_at = NULL, updated_at = now()
                 WHERE user_id = $1",
            )
            .bind(user_id),
        )
        .await
    }

    async fn set_email_enabled(&self, user_id: Uuid, enabled: bool) -> Result<(), String> {
        self.exec(
            sqlx::query(
                "INSERT INTO user_mfa (user_id, email_enabled_at)
                 VALUES ($1, CASE WHEN $2 THEN now() END)
                 ON CONFLICT (user_id) DO UPDATE SET
                   email_enabled_at = CASE WHEN $2 THEN now() END,
                   updated_at = now()",
            )
            .bind(user_id)
            .bind(enabled),
        )
        .await
    }

    async fn replace_backup_codes(&self, user_id: Uuid, hashes: Vec<String>) -> Result<(), String> {
        let mut tx = self.pool.begin().await.map_err(|err| err.to_string())?;
        sqlx::query("DELETE FROM mfa_backup_codes WHERE user_id = $1")
            .bind(user_id)
            .execute(&mut *tx)
            .await
            .map_err(|err| err.to_string())?;
        for hash in hashes {
            sqlx::query("INSERT INTO mfa_backup_codes (id, user_id, code_hash) VALUES ($1,$2,$3)")
                .bind(Uuid::new_v4())
                .bind(user_id)
                .bind(hash)
                .execute(&mut *tx)
                .await
                .map_err(|err| err.to_string())?;
        }
        tx.commit().await.map_err(|err| err.to_string())
    }

    async fn consume_backup_code(&self, user_id: Uuid, hash: &str) -> Result<bool, String> {
        let result = sqlx::query(
            "UPDATE mfa_backup_codes SET used_at = now()
             WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL",
        )
        .bind(user_id)
        .bind(hash)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(result.rows_affected() == 1)
    }

    async fn count_backup_codes(&self, user_id: Uuid) -> Result<i64, String> {
        let row = sqlx::query(
            "SELECT COUNT(*) AS remaining FROM mfa_backup_codes WHERE user_id = $1 AND used_at IS NULL",
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.get("remaining"))
    }

    async fn delete_backup_codes(&self, user_id: Uuid) -> Result<(), String> {
        self.exec(sqlx::query("DELETE FROM mfa_backup_codes WHERE user_id = $1").bind(user_id))
            .await
    }

    async fn insert_challenge(&self, challenge: MfaChallenge) -> Result<(), String> {
        self.exec(sqlx::query("DELETE FROM mfa_challenges WHERE expires_at <= now()"))
            .await?;
        self.exec(
            sqlx::query(
                "INSERT INTO mfa_challenges
                 (token_hash, user_id, attempts, email_code_hash, email_sent_at, expires_at)
                 VALUES ($1,$2,$3,$4,$5,$6)",
            )
            .bind(&challenge.token_hash)
            .bind(challenge.user_id)
            .bind(challenge.attempts)
            .bind(challenge.email_code_hash.as_deref())
            .bind(challenge.email_sent_at)
            .bind(challenge.expires_at),
        )
        .await
    }

    async fn get_challenge(&self, token_hash: &str) -> Result<Option<MfaChallenge>, String> {
        let row = sqlx::query(
            "SELECT token_hash, user_id, attempts, email_code_hash, email_sent_at, expires_at
             FROM mfa_challenges WHERE token_hash = $1 AND expires_at > now()",
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.map(|row| MfaChallenge {
            token_hash: row.get("token_hash"),
            user_id: row.get("user_id"),
            attempts: row.get("attempts"),
            email_code_hash: row.get("email_code_hash"),
            email_sent_at: row.get("email_sent_at"),
            expires_at: row.get("expires_at"),
        }))
    }

    async fn bump_challenge_attempts(&self, token_hash: &str) -> Result<i32, String> {
        self.bump(sqlx::query("UPDATE mfa_challenges SET attempts = attempts + 1 WHERE token_hash = $1 RETURNING attempts").bind(token_hash.to_string())).await
    }

    async fn set_challenge_email_code(
        &self,
        token_hash: &str,
        code_hash: &str,
        sent_at: DateTime<Utc>,
    ) -> Result<(), String> {
        self.exec(
            sqlx::query(
                "UPDATE mfa_challenges SET email_code_hash = $2, email_sent_at = $3 WHERE token_hash = $1",
            )
            .bind(token_hash)
            .bind(code_hash)
            .bind(sent_at),
        )
        .await
    }

    async fn take_challenge(&self, token_hash: &str) -> Result<bool, String> {
        let result = sqlx::query("DELETE FROM mfa_challenges WHERE token_hash = $1")
            .bind(token_hash)
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(result.rows_affected() == 1)
    }

    async fn upsert_stepup(&self, code: StepUpCode) -> Result<(), String> {
        self.exec(
            sqlx::query(
                "INSERT INTO mfa_stepup_codes (user_id, code_hash, attempts, expires_at, resend_after)
                 VALUES ($1,$2,$3,$4,$5)
                 ON CONFLICT (user_id) DO UPDATE SET
                   code_hash = EXCLUDED.code_hash,
                   attempts = EXCLUDED.attempts,
                   expires_at = EXCLUDED.expires_at,
                   resend_after = EXCLUDED.resend_after",
            )
            .bind(code.user_id)
            .bind(&code.code_hash)
            .bind(code.attempts)
            .bind(code.expires_at)
            .bind(code.resend_after),
        )
        .await
    }

    async fn get_stepup(&self, user_id: Uuid) -> Result<Option<StepUpCode>, String> {
        let row = sqlx::query(
            "SELECT user_id, code_hash, attempts, expires_at, resend_after
             FROM mfa_stepup_codes WHERE user_id = $1 AND expires_at > now()",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.map(|row| StepUpCode {
            user_id: row.get("user_id"),
            code_hash: row.get("code_hash"),
            attempts: row.get("attempts"),
            expires_at: row.get("expires_at"),
            resend_after: row.get("resend_after"),
        }))
    }

    async fn bump_stepup_attempts(&self, user_id: Uuid) -> Result<i32, String> {
        self.bump(sqlx::query("UPDATE mfa_stepup_codes SET attempts = attempts + 1 WHERE user_id = $1 RETURNING attempts").bind(user_id)).await
    }

    async fn delete_stepup(&self, user_id: Uuid) -> Result<(), String> {
        self.exec(sqlx::query("DELETE FROM mfa_stepup_codes WHERE user_id = $1").bind(user_id))
            .await
    }

    async fn insert_password_reset(
        &self,
        token_hash: &str,
        user_id: Uuid,
        expires_at: DateTime<Utc>,
    ) -> Result<(), String> {
        self.exec(sqlx::query("DELETE FROM password_resets WHERE user_id = $1 OR expires_at <= now()").bind(user_id))
            .await?;
        self.exec(
            sqlx::query("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1,$2,$3)")
                .bind(token_hash)
                .bind(user_id)
                .bind(expires_at),
        )
        .await
    }

    async fn take_password_reset(&self, token_hash: &str) -> Result<Option<Uuid>, String> {
        let row = sqlx::query(
            "DELETE FROM password_resets WHERE token_hash = $1 AND expires_at > now() RETURNING user_id",
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.map(|row| row.get("user_id")))
    }
}

#[cfg(test)]
mod postgres_tests {
    use super::*;
    use crate::accounts::{AccountStore, PostgresAccounts, UserRecord};
    use chrono::Duration;
    use faelith_core::postgres::PostgresStore;
    use faelith_core::store::PlatformStore;

    /// Exercises every Postgres query against a real database.
    ///
    /// Runs only when `FAELITH_TEST_DATABASE_URL` points at a disposable
    /// database (migrations are applied); otherwise it returns immediately.
    #[tokio::test]
    async fn postgres_security_round_trip() {
        let Ok(url) = std::env::var("FAELITH_TEST_DATABASE_URL") else {
            return;
        };
        let store = PostgresStore::connect(&url).await.expect("connect + migrate");
        let accounts = PostgresAccounts::new(store.pool().clone());
        let security = PostgresSecurity::new(store.pool().clone());
        let org_id = store.create_org("pg-security-test").await.unwrap();
        let user_id = Uuid::new_v4();
        let email = format!("pg-{user_id}@example.com");
        accounts
            .insert_user(UserRecord {
                id: user_id,
                org_id,
                email: email.clone(),
                password_hash: None,
                name: "Pg".to_string(),
            })
            .await
            .unwrap();
        let now = Utc::now();

        let pending = PendingSignup {
            email: email.clone(),
            name: "Pg".to_string(),
            password_hash: "hash".to_string(),
            code_hash: "c1".to_string(),
            attempts: 0,
            expires_at: now + Duration::minutes(10),
            resend_after: now,
        };
        security.upsert_pending_signup(pending.clone()).await.unwrap();
        security
            .upsert_pending_signup(PendingSignup { code_hash: "c2".to_string(), ..pending })
            .await
            .unwrap();
        assert_eq!(security.get_pending_signup(&email).await.unwrap().unwrap().code_hash, "c2");
        assert_eq!(security.bump_pending_signup_attempts(&email).await.unwrap(), 1);
        security.delete_pending_signup(&email).await.unwrap();
        assert!(security.get_pending_signup(&email).await.unwrap().is_none());

        assert!(!security.get_mfa(user_id).await.unwrap().any_enabled());
        security.set_totp_pending(user_id, Some(vec![1, 2, 3])).await.unwrap();
        security.enable_totp(user_id, vec![4, 5, 6], 100).await.unwrap();
        let mfa = security.get_mfa(user_id).await.unwrap();
        assert!(mfa.totp_enabled());
        assert!(mfa.totp_pending_enc.is_none());
        assert!(!security.advance_totp_step(user_id, 100).await.unwrap(), "replay rejected");
        assert!(security.advance_totp_step(user_id, 101).await.unwrap());
        security.set_email_enabled(user_id, true).await.unwrap();
        assert!(security.get_mfa(user_id).await.unwrap().email_enabled());
        security.set_email_enabled(user_id, false).await.unwrap();
        security.disable_totp(user_id).await.unwrap();
        assert!(!security.get_mfa(user_id).await.unwrap().any_enabled());

        security
            .replace_backup_codes(user_id, vec!["b1".to_string(), "b2".to_string()])
            .await
            .unwrap();
        assert_eq!(security.count_backup_codes(user_id).await.unwrap(), 2);
        assert!(security.consume_backup_code(user_id, "b1").await.unwrap());
        assert!(!security.consume_backup_code(user_id, "b1").await.unwrap(), "single use");
        assert_eq!(security.count_backup_codes(user_id).await.unwrap(), 1);
        security.delete_backup_codes(user_id).await.unwrap();
        assert_eq!(security.count_backup_codes(user_id).await.unwrap(), 0);

        let token = format!("tok-{user_id}");
        security
            .insert_challenge(MfaChallenge {
                token_hash: token.clone(),
                user_id,
                attempts: 0,
                email_code_hash: None,
                email_sent_at: None,
                expires_at: now + Duration::minutes(10),
            })
            .await
            .unwrap();
        security.set_challenge_email_code(&token, "e1", now).await.unwrap();
        assert_eq!(
            security.get_challenge(&token).await.unwrap().unwrap().email_code_hash.as_deref(),
            Some("e1")
        );
        assert_eq!(security.bump_challenge_attempts(&token).await.unwrap(), 1);
        assert!(security.take_challenge(&token).await.unwrap());
        assert!(!security.take_challenge(&token).await.unwrap(), "only one taker");

        security
            .upsert_stepup(StepUpCode {
                user_id,
                code_hash: "s1".to_string(),
                attempts: 0,
                expires_at: now + Duration::minutes(10),
                resend_after: now,
            })
            .await
            .unwrap();
        assert_eq!(security.bump_stepup_attempts(user_id).await.unwrap(), 1);
        assert_eq!(security.get_stepup(user_id).await.unwrap().unwrap().code_hash, "s1");
        security.delete_stepup(user_id).await.unwrap();
        assert!(security.get_stepup(user_id).await.unwrap().is_none());

        accounts.delete_user(user_id).await.unwrap();
    }
}
