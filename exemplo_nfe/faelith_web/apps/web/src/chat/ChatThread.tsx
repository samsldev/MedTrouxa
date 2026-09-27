/**
 * @fileoverview Website Chat transcript: markdown bubbles, tool rows, empty state.
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
 * - Chat subset of the desktop Thread.tsx (no Code panels, rewind, asks or diffs)
 * - Assistant bubbles render GitHub-flavoured markdown with copyable code blocks
 * - Tool rows: collapsible "Ran <tool>" with a spinner while the result is pending
 * - Auto-scrolls only while the viewport is already near the bottom
 * - Older rows are memoized so a token only re-parses the live markdown bubble
 * - Localized (en, pt-BR, pt-PT) through chatI18n
 */
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from './Icons';
import { useChatT } from './chatI18n';
import type { UiMessage } from './chatState';

/** Number of rotating tips (same count in every locale). */
const TIP_COUNT = 4;
const TIP_INTERVAL_MS = 8000;
const REMARK_PLUGINS = [remarkGfm];

type Props = {
  messages: UiMessage[];
  busy: boolean;
  /** The empty state announces a temporary (unsaved) chat. */
  temporary?: boolean;
};

/**
 * Stable list key: tool id, else role+index.
 */
function messageKey(message: UiMessage, index: number): string {
  return message.tools?.[0]?.id ?? `${message.role}-${index}`;
}

/**
 * Walks from the end so finding the live assistant bubble is O(k) near the tail.
 */
function lastAssistantIndex(messages: UiMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') return index;
  }
  return -1;
}

/**
 * Copies text to the clipboard and flips a short-lived "copied" flag.
 */
function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };
  return [copied, copy];
}

/**
 * Fenced code block with language label and copy button.
 */
function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const [copied, copy] = useCopy();
  const language = /language-(\w+)/.exec(className || '')?.[1];
  const text = String(children ?? '').replace(/\n$/, '');
  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span>{language || 'text'}</span>
        <button type="button" className="icon-btn" aria-label="Copy code" onClick={() => copy(text)}>
          <Icon name={copied ? 'check' : 'copy'} size={12} />
        </button>
      </div>
      <pre>
        <code className={className}>{text}</code>
      </pre>
    </div>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, node }) => {
    const isBlock = Boolean(className) || String(children ?? '').includes('\n');
    void node;
    return isBlock ? <CodeBlock className={className}>{children}</CodeBlock> : <code>{children}</code>;
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

/**
 * Markdown renderer with GitHub-flavoured extensions. memo skips re-parse
 * when `text` is reference-equal (older bubbles).
 */
export const Prose = memo(function Prose({ text }: { text: string }) {
  return (
    <div className="prose">
      <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {text}
      </Markdown>
    </div>
  );
});

/**
 * Collapsible tool invocation row with a spinner while the result is pending.
 */
function ToolRow({ message }: { message: UiMessage }) {
  const [open, setOpen] = useState(false);
  const tool = message.tools?.[0];
  const pending = tool?.result === undefined;
  const t = useChatT();
  const label = pending ? t.running : t.ran;
  return (
    <div className={`tool-row ${open ? 'open' : ''}`}>
      <button type="button" className="tool-head" onClick={() => setOpen((state) => !state)} disabled={pending}>
        {pending ? <span className="spinner" /> : <Icon name="chevron-right" size={12} className="tool-caret" />}
        <Icon name={tool?.name === 'WebFetch' || tool?.name === 'WebSearch' ? 'globe' : 'terminal'} size={13} />
        <span className="tool-name">{label}</span>
        <code>{message.content}</code>
      </button>
      {open && tool?.result !== undefined && <pre className="tool-result">{tool.result.slice(0, 4000) || '(empty result)'}</pre>}
    </div>
  );
}

type MessageRowProps = {
  message: UiMessage;
  showCursor: boolean;
};

/**
 * One transcript row. memo + stable message identity means a delta that only
 * clones the last bubble does not re-render earlier markdown.
 */
const MessageRow = memo(function MessageRow({ message, showCursor }: MessageRowProps) {
  if (message.role === 'user') {
    return (
      <article className="msg user">
        {message.attachments && message.attachments.length > 0 && (
          <div className="attachments">
            {message.attachments.map((file, fileIndex) => (
              <span key={`${file.name}-${fileIndex}`} className="chip">
                <Icon name="file" size={12} />
                {file.name}
              </span>
            ))}
          </div>
        )}
        <div className="user-text">{message.content}</div>
      </article>
    );
  }
  if (message.role === 'tool') return <ToolRow message={message} />;
  if (message.role === 'system') {
    return (
      <article className="msg system">
        <Prose text={message.content} />
      </article>
    );
  }
  return (
    <article className="msg assistant">
      <Prose text={message.content} />
      {showCursor && <span className="cursor-blink" />}
    </article>
  );
});

/**
 * Empty state shown before the first message with rotating tips.
 */
function EmptyState({ temporary }: { temporary: boolean }) {
  const t = useChatT();
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIP_COUNT));
  useEffect(() => {
    const timer = window.setInterval(() => setTipIndex((current) => (current + 1) % TIP_COUNT), TIP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="empty">
      <div className="empty-mark">
        <Icon name={temporary ? 'ghost-chat' : 'chat'} size={22} />
      </div>
      <h1>{temporary ? t.temporaryChat : 'Faelith Chat'}</h1>
      {temporary ? <p>{t.temporaryBody}</p> : <p>{t.emptyBody}</p>}
      <p className="tip" key={tipIndex}>
        <Icon name="spark" size={11} />
        {t.tips[tipIndex % t.tips.length]}
      </p>
    </div>
  );
}

/**
 * True when a tool row is still waiting for its result.
 */
function hasPendingTool(messages: UiMessage[]): boolean {
  return messages.some((message) => message.role === 'tool' && message.tools?.[0]?.result === undefined);
}

/**
 * Transcript list. Follows the stream automatically only when the viewport is
 * within 120px of the bottom.
 */
export const ChatThread = memo(function ChatThread({ messages, busy, temporary = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const last = messages[messages.length - 1];

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onScroll = () => {
      stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    };
    element.addEventListener('scroll', onScroll);
    return () => element.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (element && stickRef.current) element.scrollTop = element.scrollHeight;
  }, [messages.length, last?.content.length, last?.role]);

  if (messages.length === 0) return <EmptyState temporary={temporary} />;

  const lastAsst = lastAssistantIndex(messages);

  return (
    <div className="messages" ref={scrollRef}>
      <div className="messages-inner">
        {messages.map((message, index) => (
          <MessageRow key={messageKey(message, index)} message={message} showCursor={busy && index === lastAsst} />
        ))}
        {busy && !hasPendingTool(messages) && last?.role !== 'assistant' && (
          <div className="thinking">
            <span className="spinner" />
            Thinking
          </div>
        )}
      </div>
    </div>
  );
});
