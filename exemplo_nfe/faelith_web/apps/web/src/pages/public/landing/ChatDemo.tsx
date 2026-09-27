/**
 * @fileoverview Animated Faelith Chat window for the Chat campaign landings.
 * @author Samuel S. L.
 * @version 1.0.0
 * @since 2026-09-25
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
 * DETAILED_DESCRIPTION:
 * - Scenes loop: type the prompt, send, "thinking" dots, stream the answer, hold, restart
 * - Localized script comes from the landing copy; model chip reads "Horizon Preview"
 * - Under prefers-reduced-motion it renders the finished exchange statically
 */

import { useEffect, useState } from 'react';
import type { ChatDemoScript } from './copy';
import styles from './ChatDemo.module.css';

/** Milliseconds per typed prompt character and per streamed answer word. */
const TYPE_MS = 34;
const STREAM_MS = 55;
/** Pauses between scenes. */
const THINK_MS = 1400;
const HOLD_MS = 4200;

/** True when the visitor asked the OS to reduce motion. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Looping chat replay: `typed` prompt characters, then `streamed` answer words.
 */
export function ChatDemo({ script }: { script: ChatDemoScript }) {
  const words = script.answer.split(' ');
  const still = prefersReducedMotion();
  const [typed, setTyped] = useState(still ? script.prompt.length : 0);
  const [sent, setSent] = useState(still);
  const [streamed, setStreamed] = useState(still ? words.length : 0);

  useEffect(() => {
    if (still) return;
    let timer: number;
    if (!sent && typed < script.prompt.length) {
      timer = window.setTimeout(() => setTyped(typed + 1), TYPE_MS);
    } else if (!sent) {
      timer = window.setTimeout(() => setSent(true), 500);
    } else if (streamed < words.length) {
      timer = window.setTimeout(() => setStreamed(streamed + 1), streamed === 0 ? THINK_MS : STREAM_MS);
    } else {
      timer = window.setTimeout(() => {
        setTyped(0);
        setSent(false);
        setStreamed(0);
      }, HOLD_MS);
    }
    return () => window.clearTimeout(timer);
  }, [still, sent, typed, streamed, script.prompt.length, words.length]);

  return (
    <div className={styles.window} aria-label="Faelith Chat demo">
      <div className={styles.bar}>
        <span className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className={styles.title}>Faelith Chat</span>
      </div>
      <div className={styles.thread}>
        {sent && <div className={styles.user}>{script.prompt}</div>}
        {sent && streamed === 0 && (
          <div className={styles.thinking} aria-label="Thinking">
            <i />
            <i />
            <i />
          </div>
        )}
        {streamed > 0 && <p className={styles.answer}>{words.slice(0, streamed).join(' ')}</p>}
      </div>
      <div className={styles.composer}>
        <span className={sent || typed > 0 ? styles.input : styles.placeholder}>
          {sent ? script.placeholder : typed > 0 ? script.prompt.slice(0, typed) : script.placeholder}
          {!sent && typed > 0 && <span className={styles.caret} />}
        </span>
        <div className={styles.composerRow}>
          <span className={styles.chip}>Horizon Preview</span>
          <span className={styles.send} aria-hidden="true">↑</span>
        </div>
      </div>
    </div>
  );
}
