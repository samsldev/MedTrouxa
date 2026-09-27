/**
 * @fileoverview Auth rate limiter for login, signup, OAuth, and contact.
 * @author Samuel S. L.
 * @version 1.1.0
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
 * - In-memory sliding window for tests and single-node dev
 * - Redis INCR+EXPIRE when REDIS_URL is set
 */

use async_trait::async_trait;
use redis::AsyncCommands;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Shared auth window used by login, signup, OAuth start, and contact.
pub const AUTH_WINDOW: Duration = Duration::from_secs(15 * 60);
/// Shared auth cap used by login, signup, OAuth start, and contact.
pub const AUTH_LIMIT: u32 = 10;

/// Fail-closed limiter for sensitive POST endpoints.
#[async_trait]
pub trait AuthLimiter: Send + Sync {
    /// Returns true when the caller is still under the cap.
    async fn check(&self, bucket: &str, key: &str, limit: u32, window: Duration) -> bool;
}

/// Process-local limiter used by tests.
#[derive(Default)]
pub struct MemoryLimiter {
    inner: Mutex<HashMap<String, (u32, Instant)>>,
}

impl MemoryLimiter {
    /// Creates an empty limiter.
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl AuthLimiter for MemoryLimiter {
    async fn check(&self, bucket: &str, key: &str, limit: u32, window: Duration) -> bool {
        let id = format!("{bucket}:{key}");
        let mut inner = match self.inner.lock() {
            Ok(guard) => guard,
            Err(_) => return false,
        };
        let now = Instant::now();
        let entry = inner.entry(id).or_insert((0, now));
        if now.duration_since(entry.1) > window {
            *entry = (0, now);
        }
        if entry.0 >= limit {
            return false;
        }
        entry.0 += 1;
        true
    }
}

/// Redis INCR limiter sharing the API compose instance.
pub struct RedisLimiter {
    client: redis::Client,
}

impl RedisLimiter {
    /// Connects a Redis client; connection is opened per check.
    pub fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        Ok(Self {
            client: redis::Client::open(redis_url)?,
        })
    }
}

#[async_trait]
impl AuthLimiter for RedisLimiter {
    async fn check(&self, bucket: &str, key: &str, limit: u32, window: Duration) -> bool {
        let mut conn = match self.client.get_multiplexed_async_connection().await {
            Ok(conn) => conn,
            Err(error) => {
                tracing::error!(error = %error, "redis limiter unavailable");
                return false;
            }
        };
        let id = format!("web:rl:{bucket}:{key}");
        let count: u32 = match conn.incr(&id, 1u32).await {
            Ok(count) => count,
            Err(_) => return false,
        };
        if count == 1 {
            let _ = conn
                .expire::<_, ()>(&id, window.as_secs() as i64)
                .await;
        }
        count <= limit
    }
}
