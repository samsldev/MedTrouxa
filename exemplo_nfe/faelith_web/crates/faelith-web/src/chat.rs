/**
 * @fileoverview Website Chat handlers: thread CRUD and the SSE turn that runs the shared faelith-chat engine.
 * @author Samuel S. L.
 * @version 1.1.0
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
 * - Same engine as the desktop app (`faelith_chat::run_chat_turn`), so tools,
 *   redaction, language locks and retries are identical
 * - POST /api/chat/send streams Server-Sent Events whose `event:` names match
 *   the desktop Tauri events (chat-delta, chat-tool, ...);
 *   a final `chat-thread` frame carries the persisted thread
 * - The gateway key is a server-minted purpose=chat key stored encrypted;
 *   a 401 from the gateway (key revoked in the dashboard) rotates it once
 * - Client disconnect flips the abort flag; POST /api/chat/abort does too
 * - Thread ids are validated like the desktop (alphanumeric, `_`, `-`)
 * Primary docs: https://docs.rs/axum/latest/axum/response/sse/index.html
 * https://html.spec.whatwg.org/multipage/server-sent-events.html
 */

use crate::chat_store::{decrypt_chat_key, encrypt_chat_key, StoredChatKey};
use crate::routes::{csrf_origin, err, require_user};
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::Json;
use faelith_chat::{
    async_trait, run_chat_turn, ChatAttachment, ChatEvent, ChatSink, ChatStore, ChatThread,
    ChatTurnConfig,
};
use faelith_config::{FaelithSettings, ThinkingLevel};
use faelith_core::auth::issue_key;
use faelith_core::plans::KeyPurpose;
use faelith_core::store::ApiKeyRecord;
use faelith_types::parse_faelith_model;
use futures_util::StreamExt;
use serde::Deserialize;
use serde_json::{json, Value};
use std::convert::Infallible;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;
use uuid::Uuid;

/// Matches the desktop UI preview cap for tool results.
const UI_PREVIEW_CHARS: usize = 4000;
/// Upper bound on one user message (characters) to keep JSONB rows sane.
const MAX_TEXT_CHARS: usize = 64_000;
/// Upper bound on attachments per message.
const MAX_ATTACHMENTS: usize = 8;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewThreadBody {
    pub model: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchThreadBody {
    pub temporary: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendBody {
    #[serde(default)]
    pub thread_id: String,
    pub text: String,
    pub model: String,
    pub thinking: Option<String>,
    #[serde(default)]
    pub attachments: Vec<ChatAttachment>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AbortBody {
    pub thread_id: String,
}

/// Rejects ids that could not have been produced by `ChatThread::new`.
fn valid_thread_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-'))
}

/// Truncates `text` to `max` Unicode scalar values without splitting a char.
fn truncate_chars(text: &str, max: usize) -> String {
    text.chars().take(max).collect()
}

/// Returns a clone of `thread` with tool results capped for the browser.
fn thread_for_ui(mut thread: ChatThread) -> ChatThread {
    for message in &mut thread.messages {
        for tool in &mut message.tools {
            tool.result = truncate_chars(&tool.result, UI_PREVIEW_CHARS);
        }
    }
    thread
}

/// Effective thinking level: explicit wire name wins, otherwise the per-model
/// default from settings (same rule as the CLI `get_thinking_level_for_model`).
fn resolve_thinking(settings: &FaelithSettings, model: &str, explicit: Option<&str>) -> ThinkingLevel {
    explicit
        .and_then(ThinkingLevel::parse)
        .or_else(|| {
            parse_faelith_model(model).map(|parsed| {
                if parsed.uses_echo_thinking() {
                    settings.thinking.echo
                } else {
                    settings.thinking.horizon
                }
            })
        })
        .unwrap_or_default()
}

/// Scratch directory for the web tools' CallContext (egress caches).
fn chat_cwd() -> String {
    let dir = std::env::temp_dir().join("faelith-web-chat");
    let _ = std::fs::create_dir_all(&dir);
    dir.to_string_lossy().into_owned()
}

/// Mints a purpose=chat key for the user's org, persists it in `api_keys`
/// (so it shows in the dashboard and can be revoked there) and stores the
/// plaintext encrypted for the origin's own use.
async fn mint_chat_key(state: &AppState, user_id: Uuid, org_id: Uuid) -> Result<String, String> {
    let issued = issue_key(&state.config.pepper).map_err(|_| "key issue failed".to_string())?;
    let record = ApiKeyRecord {
        id: Uuid::new_v4(),
        org_id,
        prefix: issued.prefix.clone(),
        hmac_hex: issued.hmac_hex,
        rpm: 60,
        tpm: 1_000_000,
        revoked: false,
        purpose: KeyPurpose::Chat,
    };
    state
        .store
        .insert_key(record)
        .await
        .map_err(|_| "key persist failed".to_string())?;
    let ciphertext = encrypt_chat_key(&state.config.chat_key_secret, &issued.plaintext)?;
    state
        .chat
        .put_chat_key(
            user_id,
            StoredChatKey {
                prefix: issued.prefix,
                ciphertext,
            },
        )
        .await?;
    Ok(issued.plaintext)
}

/// Loads (or mints) the user's server-managed chat key.
async fn chat_key_for(state: &AppState, user_id: Uuid, org_id: Uuid) -> Result<String, String> {
    if let Some(stored) = state.chat.get_chat_key(user_id).await? {
        if let Ok(plain) = decrypt_chat_key(&state.config.chat_key_secret, &stored.ciphertext) {
            return Ok(plain);
        }
        // Secret rotated or blob corrupt: forget it and mint again.
        state.chat.delete_chat_key(user_id).await?;
    }
    mint_chat_key(state, user_id, org_id).await
}

/// Persists through the web store on every engine checkpoint.
struct WebThreadStore {
    state: AppState,
    user_id: Uuid,
}

#[async_trait]
impl ChatStore for WebThreadStore {
    async fn save(&self, thread: &ChatThread) -> Result<(), String> {
        self.state.chat.upsert_thread(self.user_id, thread).await
    }
}

/// Forwards engine events as SSE frames. A closed receiver means the browser
/// went away, so the sink flips the abort flag to stop the gateway stream.
struct SseSink {
    tx: mpsc::UnboundedSender<(String, Value)>,
    abort: Arc<AtomicBool>,
}

impl SseSink {
    fn send(&self, name: &str, payload: Value) {
        if self.tx.send((name.to_string(), payload)).is_err() {
            self.abort.store(true, Ordering::SeqCst);
        }
    }
}

impl ChatSink for SseSink {
    fn emit(&self, event: ChatEvent) {
        match event {
            ChatEvent::TextDelta { thread_id, text } => {
                self.send("chat-delta", json!({ "threadId": thread_id, "text": text }))
            }
            // Host-only thinking trace: the shared engine accumulates it for
            // DeepSeek tool replay, but it never reaches the browser.
            ChatEvent::ReasoningDelta { .. } => {}
            ChatEvent::Flush { .. } => {}
            ChatEvent::StreamReset { thread_id } => {
                self.send("chat-stream-reset", json!({ "threadId": thread_id }))
            }
            ChatEvent::ToolStart { thread_id, id, name, input } => self.send(
                "chat-tool",
                json!({ "threadId": thread_id, "id": id, "name": name, "input": input }),
            ),
            ChatEvent::ToolResult { thread_id, id, result } => self.send(
                "chat-tool-result",
                json!({ "threadId": thread_id, "id": id, "result": truncate_chars(&result, UI_PREVIEW_CHARS) }),
            ),
            ChatEvent::Notice { thread_id, message } => {
                self.send("chat-notice", json!({ "threadId": thread_id, "message": message }))
            }
            ChatEvent::Error { thread_id, message } => {
                self.send("chat-error", json!({ "threadId": thread_id, "message": message }))
            }
            ChatEvent::Done { thread_id, cancelled } => {
                self.send("chat-done", json!({ "threadId": thread_id, "cancelled": cancelled }))
            }
        }
    }
}

/// GET /api/chat/threads
pub async fn list_threads(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state.chat.list_threads(user.id).await {
        Ok(threads) => Json(json!({ "threads": threads })).into_response(),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "chat list failed"),
    }
}

/// POST /api/chat/threads
pub async fn new_thread(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<NewThreadBody>,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let thread = ChatThread::new(body.model.filter(|model| !model.trim().is_empty()));
    match state.chat.upsert_thread(user.id, &thread).await {
        Ok(()) => Json(thread).into_response(),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "chat create failed"),
    }
}

/// GET /api/chat/threads/{id}
pub async fn get_thread(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if !valid_thread_id(&id) {
        return err(StatusCode::BAD_REQUEST, "invalid chat thread id");
    }
    match state.chat.get_thread(user.id, &id).await {
        Ok(Some(thread)) => Json(thread_for_ui(thread)).into_response(),
        Ok(None) => err(StatusCode::NOT_FOUND, "chat thread not found"),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "chat load failed"),
    }
}

/// DELETE /api/chat/threads/{id}
pub async fn delete_thread(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if !valid_thread_id(&id) {
        return err(StatusCode::BAD_REQUEST, "invalid chat thread id");
    }
    match state.chat.delete_thread(user.id, &id).await {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => err(StatusCode::NOT_FOUND, "chat thread not found"),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "chat delete failed"),
    }
}

/// PATCH /api/chat/threads/{id} — toggles the temporary flag.
pub async fn patch_thread(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<PatchThreadBody>,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if !valid_thread_id(&id) {
        return err(StatusCode::BAD_REQUEST, "invalid chat thread id");
    }
    let mut thread = match state.chat.get_thread(user.id, &id).await {
        Ok(Some(thread)) => thread,
        Ok(None) => return err(StatusCode::NOT_FOUND, "chat thread not found"),
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "chat load failed"),
    };
    if let Some(temporary) = body.temporary {
        thread.temporary = temporary;
    }
    match state.chat.upsert_thread(user.id, &thread).await {
        Ok(()) => Json(thread_for_ui(thread)).into_response(),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "chat save failed"),
    }
}

/// POST /api/chat/threads/{id}/fork — durable copy titled "Fork: <title>".
pub async fn fork_thread(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if !valid_thread_id(&id) {
        return err(StatusCode::BAD_REQUEST, "invalid chat thread id");
    }
    let source = match state.chat.get_thread(user.id, &id).await {
        Ok(Some(thread)) => thread,
        Ok(None) => return err(StatusCode::NOT_FOUND, "chat thread not found"),
        Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "chat load failed"),
    };
    let mut forked = ChatThread::new(Some(source.model));
    forked.title = format!("Fork: {}", source.title);
    forked.messages = source.messages;
    match state.chat.upsert_thread(user.id, &forked).await {
        Ok(()) => Json(thread_for_ui(forked)).into_response(),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "chat fork failed"),
    }
}

/// POST /api/chat/purge-temporary — called once when the chat opens.
pub async fn purge_temporary(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state.chat.purge_temporary(user.id).await {
        Ok(removed) => Json(json!({ "removed": removed })).into_response(),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "chat purge failed"),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageQuery {
    #[serde(default)]
    pub thread_id: String,
    pub model: String,
}

/// GET /api/chat/usage?threadId=&model= — context ring payload (desktop parity).
pub async fn usage(State(state): State<AppState>, headers: HeaderMap, Query(query): Query<UsageQuery>) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let thread = if query.thread_id.is_empty() || !valid_thread_id(&query.thread_id) {
        None
    } else {
        match state.chat.get_thread(user.id, &query.thread_id).await {
            Ok(thread) => thread,
            Err(_) => return err(StatusCode::INTERNAL_SERVER_ERROR, "chat load failed"),
        }
    };
    let usage = faelith_chat::context_usage(thread.as_ref(), &query.model);
    let segments = if usage.used > 0 {
        json!([{ "id": "conversation", "label": "chat", "value": usage.used, "color": "#ff6b35" }])
    } else {
        json!([])
    };
    Json(json!({
        "used": usage.used,
        "limit": usage.limit,
        "segments": segments,
        "estimated": usage.estimated,
    }))
    .into_response()
}

/// POST /api/chat/abort — stops the running turn for this user's thread.
pub async fn abort(State(state): State<AppState>, headers: HeaderMap, Json(body): Json<AbortBody>) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let key = run_key(user.id, &body.thread_id);
    if let Ok(runs) = state.chat_runs.lock() {
        if let Some(flag) = runs.get(&key) {
            flag.store(true, Ordering::SeqCst);
        }
    }
    StatusCode::NO_CONTENT.into_response()
}

/// Key for the in-process abort map: one running turn per (user, thread).
fn run_key(user_id: Uuid, thread_id: &str) -> String {
    format!("{user_id}:{thread_id}")
}

/// Returns true when a gateway error text is an authentication failure.
fn is_unauthorized(err: &str) -> bool {
    err.contains("(401") || err.contains("401 Unauthorized")
}

/// POST /api/chat/send — runs one turn and streams events as SSE.
pub async fn send(State(state): State<AppState>, headers: HeaderMap, Json(body): Json<SendBody>) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    if body.text.trim().is_empty() && body.attachments.is_empty() {
        return err(StatusCode::BAD_REQUEST, "text is required");
    }
    if body.text.chars().count() > MAX_TEXT_CHARS {
        return err(StatusCode::PAYLOAD_TOO_LARGE, "message too long");
    }
    if body.attachments.len() > MAX_ATTACHMENTS {
        return err(StatusCode::PAYLOAD_TOO_LARGE, "too many attachments");
    }
    if !body.thread_id.is_empty() && !valid_thread_id(&body.thread_id) {
        return err(StatusCode::BAD_REQUEST, "invalid chat thread id");
    }
    if body.model.trim().is_empty() {
        return err(StatusCode::BAD_REQUEST, "model is required");
    }

    let (tx, rx) = mpsc::unbounded_channel::<(String, Value)>();
    let abort = Arc::new(AtomicBool::new(false));
    let sink = SseSink {
        tx: tx.clone(),
        abort: Arc::clone(&abort),
    };
    let turn_state = state.clone();
    tokio::spawn(async move {
        run_turn(turn_state, user.id, user.org_id, body, abort, sink).await;
    });

    let stream = UnboundedReceiverStream::new(rx).map(|(name, payload)| {
        Ok::<Event, Infallible>(Event::default().event(name).data(payload.to_string()))
    });
    Sse::new(stream)
        .keep_alive(KeepAlive::new().interval(Duration::from_secs(15)).text("keep-alive"))
        .into_response()
}

/// Loads or creates the thread, appends the user turn, runs the engine and
/// finishes with a `chat-thread` frame. Errors before the engine starts are
/// reported as `chat-error` + `chat-done` so the composer never stays idle.
async fn run_turn(state: AppState, user_id: Uuid, org_id: Uuid, body: SendBody, abort: Arc<AtomicBool>, sink: SseSink) {
    let SendBody {
        thread_id,
        text,
        model,
        thinking,
        attachments,
    } = body;
    let mut thread = match load_or_create(&state, user_id, &thread_id, &model).await {
        Ok(thread) => thread,
        Err(message) => {
            sink.send("chat-error", json!({ "threadId": thread_id, "message": message }));
            sink.send("chat-done", json!({ "threadId": thread_id, "cancelled": false }));
            return;
        }
    };
    thread.model = model.clone();
    let user_prompt = text.clone();
    thread.push_user_message(text, attachments);
    let store = WebThreadStore {
        state: state.clone(),
        user_id,
    };
    if let Err(message) = store.save(&thread).await {
        sink.send("chat-error", json!({ "threadId": thread.id, "message": message }));
        sink.send("chat-done", json!({ "threadId": thread.id, "cancelled": false }));
        return;
    }
    sink.send("chat-thread", json!(thread_for_ui(thread.clone())));

    let key = run_key(user_id, &thread.id);
    if let Ok(mut runs) = state.chat_runs.lock() {
        runs.insert(key.clone(), Arc::clone(&abort));
    }
    let settings = FaelithSettings::default();
    let mut cfg = ChatTurnConfig {
        api_base_url: state.config.api_url.clone(),
        api_key: String::new(),
        model: model.clone(),
        thinking: resolve_thinking(&settings, &model, thinking.as_deref()),
        settings,
        cwd: chat_cwd(),
    };

    // One retry with a fresh key when the gateway rejects the stored one
    // (revoked in the dashboard). The engine only returns Err before any
    // tool ran, so the thread has no partial assistant rows at that point.
    let mut rotated = false;
    loop {
        cfg.api_key = match chat_key_for(&state, user_id, org_id).await {
            Ok(key) => key,
            Err(message) => {
                sink.send("chat-error", json!({ "threadId": thread.id, "message": message }));
                sink.send("chat-done", json!({ "threadId": thread.id, "cancelled": false }));
                break;
            }
        };
        match run_chat_turn(&mut thread, &user_prompt, &cfg, Arc::clone(&abort), &sink, &store).await {
            Ok(()) => break,
            Err(message) if is_unauthorized(&message) && !rotated => {
                rotated = true;
                let _ = state.chat.delete_chat_key(user_id).await;
                sink.send("chat-stream-reset", json!({ "threadId": thread.id }));
                continue;
            }
            Err(_) => break,
        }
    }
    if let Ok(mut runs) = state.chat_runs.lock() {
        runs.remove(&key);
    }
    sink.send("chat-thread", json!(thread_for_ui(thread)));
}

/// Resolves the target thread: the requested id when it belongs to the user,
/// otherwise a fresh thread (matching the desktop `send_chat` fallback).
async fn load_or_create(state: &AppState, user_id: Uuid, thread_id: &str, model: &str) -> Result<ChatThread, String> {
    if !thread_id.is_empty() {
        if let Some(thread) = state.chat.get_thread(user_id, thread_id).await? {
            return Ok(thread);
        }
    }
    let thread = ChatThread::new(Some(model.to_string()));
    state.chat.upsert_thread(user_id, &thread).await?;
    Ok(thread)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Desktop-style ids pass; traversal and odd characters fail.
    #[test]
    fn thread_id_validation() {
        assert!(valid_thread_id("chat_1757890000000"));
        assert!(valid_thread_id("abc-DEF_9"));
        assert!(!valid_thread_id(""));
        assert!(!valid_thread_id(".."));
        assert!(!valid_thread_id("a/b"));
        assert!(!valid_thread_id("a b"));
    }

    /// Explicit level wins; otherwise the per-model default applies.
    #[test]
    fn thinking_resolution() {
        let settings = FaelithSettings::default();
        assert_eq!(resolve_thinking(&settings, "echo", Some("off")), ThinkingLevel::Off);
        assert_eq!(resolve_thinking(&settings, "echo", None), settings.thinking.echo);
        assert_eq!(resolve_thinking(&settings, "horizon", None), settings.thinking.horizon);
    }

    /// Gateway 401 texts are recognised for key rotation.
    #[test]
    fn unauthorized_detection() {
        assert!(is_unauthorized("Chat request failed (401 Unauthorized): {}"));
        assert!(!is_unauthorized("Chat request failed (429 Too Many Requests): {}"));
    }
}
