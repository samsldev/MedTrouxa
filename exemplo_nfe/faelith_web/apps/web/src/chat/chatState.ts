/**
 * @fileoverview Pure helpers for the website Chat: catalogs, stream reducers and the rAF batcher.
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
 * - Copied from the desktop app (lib/catalog.ts, lib/threadState.ts,
 *   lib/streamBatch.ts) so the web Chat behaves identically
 * - CHAT_MODELS / EFFORTS drive the composer pickers; EFFORTS mirrors
 *   faelith_config::ThinkingLevel
 * - appendDelta / dropTrailingLiveStream / patchTool keep React state immutable
 * - createStreamBatcher joins consecutive deltas onto one paint (rAF + 32ms race)
 * - Localized (en, pt-BR, pt-PT) through chatI18n
 */

import type { DropdownItem } from './Dropdown';

/** Matches Rust `UI_PREVIEW_CHARS` so a stray huge result cannot land in React state. */
const UI_PREVIEW_CHARS = 4000;

export type ToolState = {
  id: string;
  name: string;
  result?: string;
  blocked?: string;
};

export type UiMessage = {
  /** user | assistant | system | tool | notice */
  role: string;
  content: string;
  attachments?: Array<{ name: string; mime: string }>;
  tools?: ToolState[];
};

/** Models offered to Faelith Chat: the standard-context pair only. */
export const CHAT_MODELS: DropdownItem[] = [
  { id: 'echo', label: 'Echo Preview', description: 'Fast, balanced' },
  { id: 'horizon', label: 'Horizon Preview', description: 'Deep reasoning' },
];

/** Thinking levels in intensity order; descriptions match the CLI /thinking help. */
export const EFFORTS: DropdownItem[] = [
  { id: 'off', label: 'Off', description: 'No extended reasoning; fastest' },
  { id: 'low', label: 'Low', description: 'Light reasoning for simple tasks' },
  { id: 'medium', label: 'Medium', description: 'Skips thinking on simple queries' },
  { id: 'high', label: 'High', description: 'Deep reasoning for complex tasks' },
  { id: 'xhigh', label: 'Extra high', description: 'Always thinks thoroughly' },
  { id: 'max', label: 'Max', description: 'Maximum depth; slowest' },
];

export type ThinkingByFamily = { echo: string; horizon: string };

/**
 * Returns the thinking family a model belongs to, exactly like
 * `FaelithModel::uses_echo_thinking` in the CLI.
 */
export function thinkingFamily(model: string): 'echo' | 'horizon' {
  return model === 'echo' || model === 'echo1m' ? 'echo' : 'horizon';
}

/** CLI defaults: echo -> low, horizon -> high. */
export function defaultEffort(model: string): string {
  return thinkingFamily(model) === 'echo' ? 'low' : 'high';
}

/** Collapses 1M ids onto the standard-context sibling Chat is allowed to use. */
export function toChatModel(model: string): string {
  return thinkingFamily(model);
}

/**
 * Formats an epoch-millisecond timestamp as a compact relative label such as
 * "4m", "3h", "5d" or "2w". Falls back to an empty string for invalid input.
 */
export function relativeTime(ms: number | undefined, nowLabel = 'now'): string {
  if (!ms || Number.isNaN(ms)) return '';
  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return nowLabel;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

/**
 * Caps a tool result at the Thread preview width.
 */
export function capUiPreview(text: string): string {
  if (text.length <= UI_PREVIEW_CHARS) return text;
  return `${text.slice(0, UI_PREVIEW_CHARS)}\n... (truncated for UI)`;
}

/**
 * Appends streamed text to the trailing message of `role`, or opens a new row
 * when the previous row belongs to another role.
 */
export function appendDelta(current: UiMessage[], role: 'assistant', text: string): UiMessage[] {

  const last = current[current.length - 1];
  if (last?.role === role) {
    const next = current.slice();
    next[next.length - 1] = { ...last, content: last.content + text };
    return next;
  }
  return [...current, { role, content: text }];
}

/**
 * Drops trailing live assistant bubbles so a silent thinking-loop retry does
 * not keep the abandoned answer on screen.
 */
export function dropTrailingLiveStream(current: UiMessage[]): UiMessage[] {
  let end = current.length;
  while (end > 0) {
    const role = current[end - 1]?.role;
    if (role === 'assistant') {
      end -= 1;
      continue;
    }
    break;
  }
  return current.slice(0, end);
}

/**
 * Updates the tool row whose id matches. Returns the same array when no row
 * matches so React can skip the re-render.
 */
export function patchTool(current: UiMessage[], toolUseId: string, patch: { result?: string; blocked?: string }): UiMessage[] {
  const index = current.findIndex((row) => row.role === 'tool' && row.tools?.[0]?.id === toolUseId);
  if (index === -1) return current;
  const row = current[index];
  const tool = row.tools![0];
  const nextPatch = patch.result !== undefined ? { ...patch, result: capUiPreview(patch.result) } : patch;
  const next = [...current];
  next[index] = { ...row, tools: [{ ...tool, ...nextPatch }] };
  return next;
}

export type StreamBatcher = {
  push: (text: string) => void;
  flush: () => void;
};

/**
 * Accumulates streamed text and delivers it on the next animation frame. A
 * 32ms timeout races rAF so hidden tabs still paint the first token.
 * `flush` delivers immediately so a following tool row keeps its order.
 */
export function createStreamBatcher(apply: (text: string) => void): StreamBatcher {
  let buf = '';
  let frame = 0;
  let timeout = 0;

  const clearSchedule = () => {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    if (timeout) {
      window.clearTimeout(timeout);
      timeout = 0;
    }
  };

  const deliver = () => {
    clearSchedule();
    if (!buf) return;
    const text = buf;
    buf = '';
    apply(text);
  };

  return {
    push(text: string) {
      if (!text) return;
      buf += text;
      if (!frame) frame = window.requestAnimationFrame(deliver);
      if (!timeout) timeout = window.setTimeout(deliver, 32);
    },
    flush() {
      deliver();
    },
  };
}

/**
 * Reads a File as base64 (payload only, no data-URL prefix).
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('file read failed'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}
