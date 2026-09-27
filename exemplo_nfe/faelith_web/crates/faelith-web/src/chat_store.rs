/**
 * @fileoverview Website Chat persistence: per-user threads and the encrypted server-managed chat key.
 * @author Samuel S. L.
 * @version 1.0.0
 * @since 2026-09-14
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
 * - Threads live in `web_chat_threads` (migration 020) with the message array as JSONB,
 *   mirroring the desktop `~/.faelith/chat/<id>.json` files
 * - The chat key is a real purpose=chat API key minted by the origin and stored
 *   AES-256-GCM encrypted under CHAT_KEY_SECRET; the browser never receives it
 * - Memory implementation backs unit tests; Postgres backs production
 * Primary docs: https://docs.rs/aes-gcm/latest/aes_gcm/ , https://docs.rs/sqlx/latest/sqlx/
 */

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Key, Nonce};
use async_trait::async_trait;
use faelith_chat::{ChatMessage, ChatThread};
use serde::Serialize;
use sha2::{Digest, Sha256};
use sqlx::types::Json;
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

/// AES-GCM nonce length in bytes (RFC 5116 recommended size).
const NONCE_LEN: usize = 12;

/// Sidebar row: never carries the message array.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatThreadSummary {
    pub id: String,
    pub title: String,
    pub model: String,
    pub updated_at: u64,
}

/// Encrypted chat key row.
#[derive(Debug, Clone)]
pub struct StoredChatKey {
    pub prefix: String,
    pub ciphertext: Vec<u8>,
}

/// Derives the 256-bit AES key from the operator secret (any length >= 16 bytes).
fn derive_key(secret: &[u8]) -> Key<Aes256Gcm> {
    let digest = Sha256::digest(secret);
    Key::<Aes256Gcm>::from_slice(&digest).to_owned()
}

/// Encrypts a chat key plaintext as `nonce || ciphertext` with a random nonce.
pub fn encrypt_chat_key(secret: &[u8], plaintext: &str) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(&derive_key(secret));
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let sealed = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|_| "chat key encrypt failed".to_string())?;
    let mut blob = nonce.to_vec();
    blob.extend_from_slice(&sealed);
    Ok(blob)
}

/// Reverses `encrypt_chat_key`. Fails closed on a truncated or tampered blob.
pub fn decrypt_chat_key(secret: &[u8], blob: &[u8]) -> Result<String, String> {
    if blob.len() <= NONCE_LEN {
        return Err("chat key blob too short".into());
    }
    let (nonce, sealed) = blob.split_at(NONCE_LEN);
    let cipher = Aes256Gcm::new(&derive_key(secret));
    let plain = cipher
        .decrypt(Nonce::from_slice(nonce), sealed)
        .map_err(|_| "chat key decrypt failed".to_string())?;
    String::from_utf8(plain).map_err(|_| "chat key is not utf-8".to_string())
}

/// Storage for the website Chat. Every method is scoped by `user_id` so a
/// thread id from another account is indistinguishable from a missing one.
#[async_trait]
pub trait WebChatStore: Send + Sync {
    async fn get_chat_key(&self, user_id: Uuid) -> Result<Option<StoredChatKey>, String>;
    async fn put_chat_key(&self, user_id: Uuid, key: StoredChatKey) -> Result<(), String>;
    async fn delete_chat_key(&self, user_id: Uuid) -> Result<(), String>;
    /// Durable (non-temporary) threads, newest first.
    async fn list_threads(&self, user_id: Uuid) -> Result<Vec<ChatThreadSummary>, String>;
    async fn get_thread(&self, user_id: Uuid, id: &str) -> Result<Option<ChatThread>, String>;
    async fn upsert_thread(&self, user_id: Uuid, thread: &ChatThread) -> Result<(), String>;
    /// Returns false when no thread matched.
    async fn delete_thread(&self, user_id: Uuid, id: &str) -> Result<bool, String>;
    /// Removes temporary threads left behind by a closed tab. Returns the count.
    async fn purge_temporary(&self, user_id: Uuid) -> Result<usize, String>;
}

#[derive(Default)]
struct MemoryChatInner {
    keys: HashMap<Uuid, StoredChatKey>,
    threads: HashMap<(Uuid, String), ChatThread>,
}

/// In-memory store for tests.
#[derive(Default)]
pub struct MemoryWebChat {
    inner: Mutex<MemoryChatInner>,
}

impl MemoryWebChat {
    pub fn new() -> Self {
        Self::default()
    }
}

/// Projects a full thread onto its sidebar summary.
fn summary_of(thread: &ChatThread) -> ChatThreadSummary {
    ChatThreadSummary {
        id: thread.id.clone(),
        title: thread.title.clone(),
        model: thread.model.clone(),
        updated_at: thread.updated_at,
    }
}

#[async_trait]
impl WebChatStore for MemoryWebChat {
    async fn get_chat_key(&self, user_id: Uuid) -> Result<Option<StoredChatKey>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner.keys.get(&user_id).cloned())
    }

    async fn put_chat_key(&self, user_id: Uuid, key: StoredChatKey) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.keys.insert(user_id, key);
        Ok(())
    }

    async fn delete_chat_key(&self, user_id: Uuid) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.keys.remove(&user_id);
        Ok(())
    }

    async fn list_threads(&self, user_id: Uuid) -> Result<Vec<ChatThreadSummary>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        let mut rows: Vec<ChatThreadSummary> = inner
            .threads
            .iter()
            .filter(|((owner, _), thread)| *owner == user_id && !thread.temporary)
            .map(|(_, thread)| summary_of(thread))
            .collect();
        rows.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(rows)
    }

    async fn get_thread(&self, user_id: Uuid, id: &str) -> Result<Option<ChatThread>, String> {
        let inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner.threads.get(&(user_id, id.to_string())).cloned())
    }

    async fn upsert_thread(&self, user_id: Uuid, thread: &ChatThread) -> Result<(), String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        inner.threads.insert((user_id, thread.id.clone()), thread.clone());
        Ok(())
    }

    async fn delete_thread(&self, user_id: Uuid, id: &str) -> Result<bool, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        Ok(inner.threads.remove(&(user_id, id.to_string())).is_some())
    }

    async fn purge_temporary(&self, user_id: Uuid) -> Result<usize, String> {
        let mut inner = self.inner.lock().map_err(|err| err.to_string())?;
        let before = inner.threads.len();
        inner
            .threads
            .retain(|(owner, _), thread| !(*owner == user_id && thread.temporary));
        Ok(before - inner.threads.len())
    }
}

/// Postgres-backed store on the shared primary pool.
pub struct PostgresWebChat {
    pool: PgPool,
}

impl PostgresWebChat {
    /// Wraps the primary pool (migrations already ran in PostgresStore::connect).
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

/// Maps a `web_chat_threads` row (with messages) onto the shared thread type.
fn map_thread(row: &sqlx::postgres::PgRow) -> ChatThread {
    let messages: Json<Vec<ChatMessage>> = row.get("messages");
    ChatThread {
        id: row.get("id"),
        title: row.get("title"),
        model: row.get("model"),
        created_at: row.get::<i64, _>("created_at").max(0) as u64,
        updated_at: row.get::<i64, _>("updated_at").max(0) as u64,
        temporary: row.get("temporary"),
        messages: messages.0,
    }
}

#[async_trait]
impl WebChatStore for PostgresWebChat {
    async fn get_chat_key(&self, user_id: Uuid) -> Result<Option<StoredChatKey>, String> {
        let row = sqlx::query("SELECT key_prefix, key_ciphertext FROM web_chat_keys WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(row.map(|row| StoredChatKey {
            prefix: row.get("key_prefix"),
            ciphertext: row.get("key_ciphertext"),
        }))
    }

    async fn put_chat_key(&self, user_id: Uuid, key: StoredChatKey) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO web_chat_keys (user_id, key_prefix, key_ciphertext) VALUES ($1,$2,$3)
             ON CONFLICT (user_id) DO UPDATE
             SET key_prefix = EXCLUDED.key_prefix, key_ciphertext = EXCLUDED.key_ciphertext, created_at = now()",
        )
        .bind(user_id)
        .bind(&key.prefix)
        .bind(&key.ciphertext)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn delete_chat_key(&self, user_id: Uuid) -> Result<(), String> {
        sqlx::query("DELETE FROM web_chat_keys WHERE user_id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn list_threads(&self, user_id: Uuid) -> Result<Vec<ChatThreadSummary>, String> {
        let rows = sqlx::query(
            "SELECT id, title, model, updated_at FROM web_chat_threads
             WHERE user_id = $1 AND temporary = FALSE
             ORDER BY updated_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(rows
            .iter()
            .map(|row| ChatThreadSummary {
                id: row.get("id"),
                title: row.get("title"),
                model: row.get("model"),
                updated_at: row.get::<i64, _>("updated_at").max(0) as u64,
            })
            .collect())
    }

    async fn get_thread(&self, user_id: Uuid, id: &str) -> Result<Option<ChatThread>, String> {
        let row = sqlx::query(
            "SELECT id, title, model, temporary, messages, created_at, updated_at
             FROM web_chat_threads WHERE user_id = $1 AND id = $2",
        )
        .bind(user_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(row.as_ref().map(map_thread))
    }

    async fn upsert_thread(&self, user_id: Uuid, thread: &ChatThread) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO web_chat_threads (id, user_id, title, model, temporary, messages, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT (id) DO UPDATE
             SET title = EXCLUDED.title, model = EXCLUDED.model, temporary = EXCLUDED.temporary,
                 messages = EXCLUDED.messages, updated_at = EXCLUDED.updated_at
             WHERE web_chat_threads.user_id = EXCLUDED.user_id",
        )
        .bind(&thread.id)
        .bind(user_id)
        .bind(&thread.title)
        .bind(&thread.model)
        .bind(thread.temporary)
        .bind(Json(&thread.messages))
        .bind(thread.created_at as i64)
        .bind(thread.updated_at as i64)
        .execute(&self.pool)
        .await
        .map_err(|err| err.to_string())?;
        Ok(())
    }

    async fn delete_thread(&self, user_id: Uuid, id: &str) -> Result<bool, String> {
        let result = sqlx::query("DELETE FROM web_chat_threads WHERE user_id = $1 AND id = $2")
            .bind(user_id)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(result.rows_affected() > 0)
    }

    async fn purge_temporary(&self, user_id: Uuid) -> Result<usize, String> {
        let result = sqlx::query("DELETE FROM web_chat_threads WHERE user_id = $1 AND temporary = TRUE")
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|err| err.to_string())?;
        Ok(result.rows_affected() as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Round-trips a key and rejects a tampered blob.
    #[test]
    fn chat_key_encrypt_round_trip_and_tamper() {
        let secret = b"chat-key-secret-for-tests-32b!!";
        let blob = encrypt_chat_key(secret, "sk-fae_chat_abc").unwrap();
        assert_eq!(decrypt_chat_key(secret, &blob).unwrap(), "sk-fae_chat_abc");
        let mut broken = blob.clone();
        let last = broken.len() - 1;
        broken[last] ^= 0x01;
        assert!(decrypt_chat_key(secret, &broken).is_err());
        assert!(decrypt_chat_key(b"another-secret-1234567890", &blob).is_err());
        assert!(decrypt_chat_key(secret, &blob[..8]).is_err());
    }

    /// Temporary threads are hidden from the list and purged on demand.
    #[tokio::test]
    async fn memory_store_scopes_by_user_and_hides_temporary() {
        let store = MemoryWebChat::new();
        let alice = Uuid::new_v4();
        let bob = Uuid::new_v4();
        let mut durable = ChatThread::new(Some("echo".into()));
        durable.id = "chat_1".into();
        let mut temp = ChatThread::new(Some("echo".into()));
        temp.id = "chat_2".into();
        temp.temporary = true;
        store.upsert_thread(alice, &durable).await.unwrap();
        store.upsert_thread(alice, &temp).await.unwrap();
        assert_eq!(store.list_threads(alice).await.unwrap().len(), 1);
        assert!(store.get_thread(bob, "chat_1").await.unwrap().is_none());
        assert!(!store.delete_thread(bob, "chat_1").await.unwrap());
        assert_eq!(store.purge_temporary(alice).await.unwrap(), 1);
        assert!(store.get_thread(alice, "chat_2").await.unwrap().is_none());
    }
}
