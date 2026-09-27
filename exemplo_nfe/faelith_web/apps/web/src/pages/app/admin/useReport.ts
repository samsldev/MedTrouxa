/**
 * @fileoverview Loading state for admin reports: runs a loader when its inputs change and ignores stale answers.
 * @author Samuel S. L.
 * @version 1.0.0
 * @since 2026-09-26
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
 * - Returns data, error message, loading flag, and a reload function
 * - A response that arrives after newer inputs were requested is dropped (no flicker between periods)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';

export interface Report<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs `load` whenever `key` changes; `fallback` is the message for non-API errors.
 */
export function useReport<T>(load: () => Promise<T>, key: string, fallback: string): Report<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    const request = latest.current + 1;
    latest.current = request;
    setLoading(true);
    setError(null);
    loader
      .current()
      .then((next) => {
        if (latest.current === request) setData(next);
      })
      .catch((caught: unknown) => {
        if (latest.current === request) setError(caught instanceof ApiError ? caught.message : fallback);
      })
      .finally(() => {
        if (latest.current === request) setLoading(false);
      });
  }, [key, tick, fallback]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, loading, reload };
}
