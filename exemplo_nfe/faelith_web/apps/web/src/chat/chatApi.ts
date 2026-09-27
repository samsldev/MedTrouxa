/**
 * @fileoverview Website Chat API client: thread CRUD plus the SSE turn stream from /api/chat/send.
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
 * - Same-origin fetch with the session cookie; JSON errors surface as ApiError
 * - `sendChat` parses the SSE body (`event:` / `data:` frames per the WHATWG
 *   EventSource spec) and dispatches events named exactly like the desktop
 *   Tauri events, so the page logic is a copy of App.tsx
 * - The turn resolves with the persisted thread from the final `chat-thread` frame
 * Primary docs: https://html.spec.whatwg.org/multipage/server-sent-events.html
 */

import { ApiError } from '../lib/api';

export type ChatAttachment = { name: string; mime: string; base64: string };

export type ChatToolCall = { id: string; name: string; input: unknown; result: string };

export type ChatMessage = {
  role: string;
  content: string;
  attachments?: ChatAttachment[];
  tools?: ChatToolCall[];
};

export type ChatThread = {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  temporary: boolean;
  messages: ChatMessage[];
};

export type ChatSummary = { id: string; title: string; model: string; updatedAt: number };

export type UsageSegment = { id: string; label: string; value: number; color: string };
export type ContextUsage = {
  used: number;
  limit: number;
  segments: UsageSegment[];
  /** True when `used` is the local chars/4 estimate, not a provider count. */
  estimated?: boolean;
};

/** Event names and payloads streamed by POST /api/chat/send (desktop parity). */
export type ChatStreamEvent =
  | { name: 'chat-delta'; payload: { threadId: string; text: string } }
  | { name: 'chat-stream-reset'; payload: { threadId: string } }
  | { name: 'chat-tool'; payload: { threadId: string; id: string; name: string; input: unknown } }
  | { name: 'chat-tool-result'; payload: { threadId: string; id: string; result: string } }
  | { name: 'chat-notice'; payload: { threadId: string; message: string } }
  | { name: 'chat-error'; payload: { threadId: string; message: string } }
  | { name: 'chat-done'; payload: { threadId: string; cancelled: boolean } }
  | { name: 'chat-thread'; payload: ChatThread };

const KNOWN_EVENTS = new Set<ChatStreamEvent['name']>([
  'chat-delta',
  'chat-stream-reset',
  'chat-tool',
  'chat-tool-result',
  'chat-notice',
  'chat-error',
  'chat-done',
  'chat-thread',
]);

/**
 * Same-origin JSON request with the session cookie. Non-2xx responses throw
 * an ApiError carrying the server's `error` string when present.
 */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'include', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(path, init);
  const text = await response.text();
  let parsed: unknown = null;
  if (text.trim() !== '') {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    const record = parsed as { error?: unknown } | null;
    const message = typeof record?.error === 'string' ? record.error : typeof parsed === 'string' ? parsed : response.statusText;
    throw new ApiError(response.status, message);
  }
  return parsed as T;
}

export async function listChat(): Promise<ChatSummary[]> {
  const data = await request<{ threads: ChatSummary[] }>('GET', '/api/chat/threads');
  return data.threads ?? [];
}

export function newChat(model: string): Promise<ChatThread> {
  return request<ChatThread>('POST', '/api/chat/threads', { model });
}

export function loadChat(id: string): Promise<ChatThread> {
  return request<ChatThread>('GET', `/api/chat/threads/${encodeURIComponent(id)}`);
}

export async function deleteChat(id: string): Promise<void> {
  await request<null>('DELETE', `/api/chat/threads/${encodeURIComponent(id)}`);
}

export function forkChat(id: string): Promise<ChatThread> {
  return request<ChatThread>('POST', `/api/chat/threads/${encodeURIComponent(id)}/fork`);
}

export function setChatTemporary(id: string, temporary: boolean): Promise<ChatThread> {
  return request<ChatThread>('PATCH', `/api/chat/threads/${encodeURIComponent(id)}`, { temporary });
}

export async function purgeTemporaryChats(): Promise<number> {
  const data = await request<{ removed: number }>('POST', '/api/chat/purge-temporary');
  return data.removed ?? 0;
}

export async function abortChat(threadId: string): Promise<void> {
  await request<null>('POST', '/api/chat/abort', { threadId });
}

export function chatContextUsage(threadId: string, model: string): Promise<ContextUsage> {
  const query = new URLSearchParams({ model });
  if (threadId) query.set('threadId', threadId);
  return request<ContextUsage>('GET', `/api/chat/usage?${query.toString()}`);
}

/**
 * Parses one SSE block (lines between blank lines) into an event. Comment
 * lines (`:`) and unknown event names are ignored per the spec.
 */
function parseSseBlock(block: string): ChatStreamEvent | null {
  let name = '';
  const data: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') name = value;
    else if (field === 'data') data.push(value);
  }
  if (!KNOWN_EVENTS.has(name as ChatStreamEvent['name']) || data.length === 0) return null;
  try {
    return { name, payload: JSON.parse(data.join('\n')) } as ChatStreamEvent;
  } catch {
    return null;
  }
}

/**
 * Runs one turn. Events are delivered in order through `onEvent`; the promise
 * resolves with the persisted thread (last `chat-thread` frame) once the
 * stream ends, or rejects when the request itself fails before streaming.
 */
export async function sendChat(
  threadId: string,
  text: string,
  model: string,
  thinking: string,
  attachments: ChatAttachment[],
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<ChatThread> {
  const response = await fetch('/api/chat/send', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ threadId, text, model, thinking, attachments }),
    signal,
  });
  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '');
    let message = response.statusText;
    try {
      const record = JSON.parse(body) as { error?: unknown };
      if (typeof record.error === 'string') message = record.error;
    } catch {
      if (body.trim()) message = body;
    }
    throw new ApiError(response.status, message);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let thread: ChatThread | null = null;
  const dispatch = (block: string) => {
    const event = parseSseBlock(block);
    if (!event) return;
    if (event.name === 'chat-thread') thread = event.payload;
    onEvent(event);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.search(/\r?\n\r?\n/);
    while (index !== -1) {
      const separator = buffer.slice(index).match(/^\r?\n\r?\n/)?.[0].length ?? 2;
      dispatch(buffer.slice(0, index));
      buffer = buffer.slice(index + separator);
      index = buffer.search(/\r?\n\r?\n/);
    }
  }
  if (buffer.trim()) dispatch(buffer);
  if (!thread) throw new ApiError(502, 'Chat stream ended without the persisted thread');
  return thread;
}
