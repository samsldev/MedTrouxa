/**
 * @fileoverview Reveal-on-scroll wrapper driven by IntersectionObserver.
 * @author Samuel S. L.
 * @version 1.0.0
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
 * DETAILED_DESCRIPTION:
 * - Tracks visibility as React state so re-renders never drop the revealed class
 * - Reveals on intersection or when the element is already above the viewport
 * - Supports a per-instance stagger delay via a CSS custom property
 * - Disconnects the observer after the first reveal to avoid re-triggering
 */

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';

interface RevealProps extends Record<string, unknown> {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
  style?: CSSProperties;
}

/**
 * Wraps children in an element that fades and slides in when scrolled into view.
 * Extra props (for example `to` when rendering a router Link) are forwarded to the tag.
 * Falls back to immediately visible when IntersectionObserver is unavailable.
 */
export function Reveal({ children, as: Tag = 'div', className = '', delay = 0, style, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      // The large top margin makes anything already above the viewport count as
      // intersecting, so anchor jumps and instant scrolls never leave content hidden.
      { threshold: 0.15, rootMargin: '100000px 0px -8% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const merged: CSSProperties = { ...style, ['--reveal-delay' as string]: `${delay}ms` };

  return (
    <Tag {...rest} ref={ref} className={`reveal ${visible ? 'is-visible' : ''} ${className}`.trim()} style={merged}>
      {children}
    </Tag>
  );
}
