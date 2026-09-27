/**
 * @fileoverview Pointer-tracking hook that feeds card spotlight CSS variables.
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
 * - Returns a pointer-move handler that writes --mx/--my onto the hovered element
 * - Used by .card::after to render a cursor-following radial highlight
 * - Zero allocations per frame beyond the DOMRect read
 */

import { useCallback, type PointerEvent } from 'react';

/**
 * Produces a stable onPointerMove handler that records the pointer position
 * relative to the event target as CSS custom properties in pixels.
 */
export function useSpotlight() {
  return useCallback((event: PointerEvent<HTMLElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    target.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }, []);
}
