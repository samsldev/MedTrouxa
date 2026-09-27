/**
 * @fileoverview Website Chat composer: attachments, auto-growing textarea, model and effort pickers.
 * @author Samuel S. L.
 * @version 1.3.0
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
 * - Chat subset of the desktop Composer.tsx (no modes, mentions, run targets)
 * - Error strip, working strip with elapsed seconds and Stop
 * - Chip row for file attachments, each removable
 * - Enter sends, Shift+Enter inserts a newline; textarea grows up to 240px
 * - Bottom row: attach, context ring, model picker, effort picker, send
 * - Localized (en, pt-BR, pt-PT) through chatI18n
 */
import { useEffect, useRef, useState } from 'react';
import type { ChatAttachment, ContextUsage } from './chatApi';
import { localizedItems, useChatT } from './chatI18n';
import { CHAT_MODELS, EFFORTS } from './chatState';
import { ContextRing } from './ContextRing';
import { Dropdown } from './Dropdown';
import { Icon } from './Icons';
import { PlanLimits } from './PlanLimits';
import { fetchBilling } from '../lib/api';

type Props = {
  draft: string;
  busy: boolean;
  model: string;
  effort: string;
  attachments: ChatAttachment[];
  error: string | null;
  usage: ContextUsage | null;
  onRefreshUsage: () => void;
  onDraft: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onModel: (id: string) => void;
  onEffort: (id: string) => void;
  onAttach: (files: FileList | null) => void;
  onRemoveAttachment: (index: number) => void;
  onDismissError: () => void;
};

/**
 * Tracks elapsed seconds while `active` is true; resets when it stops.
 */
function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const start = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return seconds;
}

/**
 * Composer card. The textarea height is recomputed on every draft change
 * (capped by CSS max-height) so the card grows with the message.
 */
export function ChatComposer(props: Props) {
  const { draft, busy, model, effort, attachments, error, usage } = props;
  // Echo is unavailable while the subscription's refund window is open.
  const [echoLocked, setEchoLocked] = useState(false);
  useEffect(() => {
    let live = true;
    fetchBilling()
      .then((billing) => live && setEchoLocked(billing.refundUntil !== null))
      .catch(() => live && setEchoLocked(false));
    return () => {
      live = false;
    };
  }, []);
  const { onModel } = props;
  useEffect(() => {
    if (echoLocked && model === 'echo') onModel('horizon');
  }, [echoLocked, model, onModel]);
  const t = useChatT();
  const baseModels = localizedItems(CHAT_MODELS, t);
  const models = echoLocked ? baseModels.map((item) => (item.id === 'echo' ? { ...item, disabled: true } : item)) : baseModels;
  const efforts = localizedItems(EFFORTS, t);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const elapsed = useElapsed(busy);
  const canSend = draft.trim().length > 0 && !busy;

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${Math.min(element.scrollHeight, 240)}px`;
  }, [draft]);

  return (
    <div className="composer">
      {error && (
        <div className="error-strip" role="alert">
          <span>{error}</span>
          <button type="button" className="icon-btn" aria-label="Dismiss" onClick={props.onDismissError}>
            <Icon name="x" size={12} />
          </button>
        </div>
      )}
      <div className={`composer-card ${busy ? 'busy' : ''}`}>
        {busy && (
          <div className="working-strip">
            <span className="pulse" />
            <span className="working-text">Working</span>
            <span className="working-time">{elapsed}s</span>
            <button type="button" className="icon-btn" aria-label="Stop" onClick={props.onStop}>
              <Icon name="stop" size={12} />
            </button>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="attachments">
            {attachments.map((file, index) => (
              <span key={`${file.name}-${index}`} className="chip">
                <Icon name="file" size={12} />
                {file.name}
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => props.onRemoveAttachment(index)}>
                  <Icon name="x" size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          placeholder={t.askAnything}
          onChange={(event) => props.onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              props.onSubmit();
            }
          }}
        />
        <div className="composer-row">
          <input ref={fileRef} type="file" hidden multiple onChange={(event) => props.onAttach(event.target.files)} />
          <button type="button" className="icon-btn" aria-label={t.attachFiles} title={t.attach} onClick={() => fileRef.current?.click()}>
            <Icon name="plus" size={16} />
          </button>
          <span className="grow" />
          <ContextRing usage={usage} color="var(--accent)" onOpen={props.onRefreshUsage} />
          <Dropdown value={model} items={models} onChange={props.onModel} align="right" compact icon={<Icon name="spark" size={12} />} />
          <Dropdown value={effort} items={efforts} onChange={props.onEffort} align="right" compact icon={<Icon name="gauge" size={12} />} title={t.thinkingEffort} />
          <button
            type="button"
            className={`send-btn ${canSend ? 'ready' : ''}`}
            aria-label={busy ? t.stop : t.send}
            disabled={!canSend && !busy}
            onClick={busy ? props.onStop : props.onSubmit}
          >
            <Icon name={busy ? 'stop' : 'send'} size={14} />
          </button>
        </div>
      </div>
      <div className="composer-footer">
        <span className="ctx-chip">
          <Icon name="globe" size={12} />
          {t.webOnly}
        </span>
        <span className="grow" />
        <span className="hint">{t.enterHint}</span>
      </div>
      <PlanLimits busy={busy} />
    </div>
  );
}
