/**
 * @fileoverview Website Chat page: thread list, transcript and composer wired to the SSE turn API.
 * @author Samuel S. L.
 * @version 1.2.0
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
 * - Port of the Chat branch of the desktop App.tsx: same state, same event
 *   handling (rAF-batched deltas, stream reset, tool rows, done/error/notice)
 * - Left column lists durable threads with a right-click menu (Fork, Delete)
 * - Topbar: hide list, title, temporary-chat toggle; Ctrl+N starts a new chat
 * - Temporary threads are discarded when left; a startup purge is the safety net
 * - The persisted thread returned by the turn replaces the streamed view
 * - Thinking effort is kept per model family in localStorage (desktop: settings)
 * - Localized (en, pt-BR, pt-PT) through chatI18n
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import './chat.css';
import { ChatComposer } from './ChatComposer';
import { ChatThread } from './ChatThread';
import { ContextMenu, type MenuAnchor, type MenuItem } from './ContextMenu';
import { Icon } from './Icons';
import {
  abortChat,
  chatContextUsage,
  deleteChat,
  forkChat,
  listChat,
  loadChat,
  newChat,
  purgeTemporaryChats,
  sendChat,
  setChatTemporary,
  type ChatAttachment,
  type ChatMessage,
  type ChatStreamEvent,
  type ChatSummary,
  type ChatThread as ChatThreadRecord,
  type ContextUsage,
} from './chatApi';
import {
  appendDelta,
  createStreamBatcher,
  defaultEffort,
  dropTrailingLiveStream,
  fileToBase64,
  patchTool,
  relativeTime,
  thinkingFamily,
  toChatModel,
  type ThinkingByFamily,
  type UiMessage,
} from './chatState';
import { useChatT } from './chatI18n';

const THINKING_STORAGE_KEY = 'faelith.web.chat.thinking';
const MODEL_STORAGE_KEY = 'faelith.web.chat.model';

/**
 * Loads the per-family effort choice; falls back to CLI defaults.
 */
function loadThinking(): ThinkingByFamily {
  const fallback = { echo: defaultEffort('echo'), horizon: defaultEffort('horizon') };
  try {
    const raw = window.localStorage.getItem(THINKING_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ThinkingByFamily>;
    return { echo: parsed.echo || fallback.echo, horizon: parsed.horizon || fallback.horizon };
  } catch {
    return fallback;
  }
}

/**
 * Maps persisted thread messages onto transcript rows (tool results capped
 * server-side).
 */
function toUiMessages(messages: ChatMessage[]): UiMessage[] {
  const rows: UiMessage[] = [];
  for (const message of messages) {
    if (message.role === 'tool') {
      const tool = message.tools?.[0];
      rows.push({ role: 'tool', content: message.content, tools: tool ? [{ id: tool.id, name: tool.name, result: tool.result }] : [] });
      continue;
    }
    rows.push({
      role: message.role,
      content: message.content,
      attachments: message.attachments?.map(({ name, mime }) => ({ name, mime })),
    });
  }
  return rows;
}

/**
 * Formats an unknown error for the composer strip.
 */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Chat page. Mirrors the desktop shell's Chat state machine one-to-one.
 */
export function ChatPage() {
  const t = useChatT();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [thread, setThread] = useState<ChatThreadRecord | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState(() => toChatModel(window.localStorage.getItem(MODEL_STORAGE_KEY) || 'echo'));
  const [thinking, setThinking] = useState<ThinkingByFamily>(loadThinking);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<ContextUsage | null>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [listHidden, setListHidden] = useState(false);
  const [menu, setMenu] = useState<{ anchor: MenuAnchor; items: MenuItem[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<ChatThreadRecord | null>(null);
  threadRef.current = thread;

  useEffect(() => {
    window.localStorage.setItem(MODEL_STORAGE_KEY, model);
  }, [model]);

  const refreshChats = useCallback(async () => {
    setChats(await listChat());
  }, []);

  useEffect(() => {
    // Temporary chats left behind by a closed tab must not resurface.
    void purgeTemporaryChats()
      .catch(() => undefined)
      .then(refreshChats)
      .catch((err) => setError(describe(err)));
  }, [refreshChats]);

  /** Pulls the Chat context budget; failures are swallowed (informational ring). */
  const refreshUsage = useCallback(async () => {
    try {
      setUsage(await chatContextUsage(thread?.id ?? '', model));
    } catch {
      /* ring is best-effort */
    }
  }, [thread?.id, model]);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage, messages.length, busy]);

  /**
   * Drops the active thread when it is temporary. Called on every path that
   * leaves the thread; errors are ignored because the purge is the safety net.
   */
  const discardTemporary = useCallback(async () => {
    const current = threadRef.current;
    if (!current?.temporary) return;
    await deleteChat(current.id).catch(() => undefined);
    setChats((rows) => rows.filter((row) => row.id !== current.id));
  }, []);

  const startNew = useCallback(async () => {
    setError(null);
    try {
      await discardTemporary();
      setThread(await newChat(model));
      setMessages([]);
      await refreshChats();
    } catch (err) {
      setError(describe(err));
    }
  }, [discardTemporary, model, refreshChats]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        void startNew();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startNew]);

  useEffect(() => {
    // Leaving the page (route change) discards a temporary chat like the desktop.
    return () => {
      void discardTemporary();
      abortRef.current?.abort();
    };
  }, [discardTemporary]);

  async function openChat(id: string) {
    try {
      if (thread?.id !== id) await discardTemporary();
      const loaded = await loadChat(id);
      setThread(loaded);
      setModel(toChatModel(loaded.model));
      setMessages(toUiMessages(loaded.messages));
      setError(null);
    } catch (err) {
      setError(describe(err));
    }
  }

  async function toggleTemporary() {
    try {
      const current = thread ?? (await newChat(model));
      const updated = await setChatTemporary(current.id, !current.temporary);
      setThread(updated);
      await refreshChats();
    } catch (err) {
      setError(describe(err));
    }
  }

  async function removeChat(row: ChatSummary) {
    if (!window.confirm(`Delete "${row.title}"? This removes the chat and cannot be undone.`)) return;
    try {
      await deleteChat(row.id);
      if (thread?.id === row.id) {
        setThread(null);
        setMessages([]);
      }
      await refreshChats();
    } catch (err) {
      setError(describe(err));
    }
  }

  async function fork(id: string) {
    try {
      const forked = await forkChat(id);
      await refreshChats();
      await openChat(forked.id);
    } catch (err) {
      setError(describe(err));
    }
  }

  /** Applies the effort choice for the active model family and persists it. */
  function changeEffort(level: string) {
    const family = thinkingFamily(model);
    setThinking((current) => {
      const next = { ...current, [family]: level };
      window.localStorage.setItem(THINKING_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function onAttach(list: FileList | null) {
    if (!list) return;
    try {
      const next = await Promise.all(
        Array.from(list).map(async (file) => ({
          name: file.name,
          mime: file.type || 'application/octet-stream',
          base64: await fileToBase64(file),
        })),
      );
      setAttachments((current) => [...current, ...next]);
    } catch (err) {
      setError(describe(err));
    }
  }

  async function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    setError(null);
    const textBatch = createStreamBatcher((delta) => setMessages((current) => appendDelta(current, 'assistant', delta)));
    const flushDeltas = () => {
      textBatch.flush();
    };
    const onEvent = (event: ChatStreamEvent) => {
      switch (event.name) {
        case 'chat-delta':
          textBatch.push(event.payload.text);
          break;
        case 'chat-stream-reset':
          flushDeltas();
          setMessages((current) => dropTrailingLiveStream(current));
          break;
        case 'chat-tool':
          flushDeltas();
          setMessages((current) => [...current, { role: 'tool', content: event.payload.name, tools: [{ id: event.payload.id, name: event.payload.name }] }]);
          break;
        case 'chat-tool-result':
          setMessages((current) => patchTool(current, event.payload.id, { result: event.payload.result }));
          break;
        case 'chat-done':
          flushDeltas();
          setBusy(false);
          break;
        case 'chat-error':
        case 'chat-notice':
          flushDeltas();
          if (event.name === 'chat-error') setBusy(false);
          if (event.payload.message) setError(event.payload.message);
          break;
        case 'chat-thread':
          // The first frame carries the thread with the user turn appended;
          // the final frame is applied below once the stream completes.
          setThread((current) => (current && current.id === event.payload.id ? { ...current, title: event.payload.title } : current ?? event.payload));
          break;
        default: {
          const exhaustive: never = event;
          throw new Error(`Unhandled chat event: ${String(exhaustive)}`);
        }
      }
    };
    try {
      setDraft('');
      setBusy(true);
      const outgoing = attachments;
      setMessages((current) => [...current, { role: 'user', content: text, attachments: outgoing.map(({ name, mime }) => ({ name, mime })) }]);
      const id = thread?.id || (await newChat(model)).id;
      setAttachments([]);
      const controller = new AbortController();
      abortRef.current = controller;
      const sent = await sendChat(id, text, model, thinking[thinkingFamily(model)], outgoing, onEvent, controller.signal);
      flushDeltas();
      setThread(sent);
      // The persisted thread is authoritative: replace the streamed view so
      // the transcript matches exactly what reopening the chat would show.
      setMessages(toUiMessages(sent.messages));
      setChats(await listChat());
    } catch (err) {
      flushDeltas();
      if (!(err instanceof DOMException && err.name === 'AbortError')) setError(describe(err));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function stop() {
    const id = thread?.id;
    if (id) void abortChat(id).catch(() => undefined);
    abortRef.current?.abort();
  }

  function openMenu(event: ReactMouseEvent, row: ChatSummary) {
    event.preventDefault();
    setMenu({
      anchor: { x: event.clientX, y: event.clientY },
      items: [
        { label: t.fork, icon: 'branch', onSelect: () => void fork(row.id) },
        { kind: 'separator' },
        { label: t.delete, icon: 'trash', danger: true, onSelect: () => void removeChat(row) },
      ],
    });
  }

  const title = useMemo(() => (thread?.temporary ? t.temporaryChat : thread?.title || t.newChat), [thread, t]);

  return (
    <div className={`fchat chat-shell ${listHidden ? 'list-hidden' : ''}`}>
      {!listHidden && (
        <aside className="sidebar">
          <div className="nav">
            <button type="button" onClick={() => void startNew()}>
              <Icon name="plus" size={14} />
              <span>{t.newChat}</span>
              <kbd>Ctrl+N</kbd>
            </button>
          </div>
          <div className="sidebar-scroll">
            <div className="section-label">{t.recents}</div>
            <div className="list">
              {chats.length === 0 && <div className="list-empty">{t.noChats}</div>}
              {chats.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`row ${row.id === thread?.id ? 'active' : ''}`}
                  onClick={() => void openChat(row.id)}
                  onContextMenu={(event) => openMenu(event, row)}
                >
                  <Icon name="chat" size={13} className="row-icon" />
                  <span className="row-title">{row.title}</span>
                  <span className="row-time">{relativeTime(row.updatedAt, t.now)}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}
      <section className="thread">
        <header className="topbar">
          <button
            type="button"
            className={`icon-btn ${listHidden ? '' : 'on'}`}
            aria-label={listHidden ? t.showChats : t.hideChats}
            title={listHidden ? t.showChats : t.hideChats}
            onClick={() => setListHidden((hidden) => !hidden)}
          >
            <Icon name="panel" size={15} />
          </button>
          <span className="topbar-title">{title}</span>
          <span className="grow" />
          <button
            type="button"
            className={`icon-btn ${thread?.temporary ? 'on' : ''}`}
            aria-pressed={Boolean(thread?.temporary)}
            aria-label={t.temporaryChat}
            title={thread?.temporary ? t.temporaryOn : t.temporaryOff}
            onClick={() => void toggleTemporary()}
          >
            <Icon name="ghost-chat" size={15} />
          </button>
        </header>
        <ChatThread messages={messages} busy={busy} temporary={Boolean(thread?.temporary)} />
        <ChatComposer
          draft={draft}
          busy={busy}
          model={model}
          effort={thinking[thinkingFamily(model)]}
          attachments={attachments}
          error={error}
          usage={usage}
          onRefreshUsage={() => void refreshUsage()}
          onDraft={setDraft}
          onSubmit={() => void submit()}
          onStop={stop}
          onModel={setModel}
          onEffort={changeEffort}
          onAttach={(list) => void onAttach(list)}
          onRemoveAttachment={(index) => setAttachments((current) => current.filter((_, i) => i !== index))}
          onDismissError={() => setError(null)}
        />
      </section>
      {menu && <ContextMenu anchor={menu.anchor} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}
