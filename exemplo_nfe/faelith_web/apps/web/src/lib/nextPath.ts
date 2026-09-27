/**
 * @fileoverview Same-origin post-login redirect helper. Only in-app paths are allowed.
 * @author Samuel S. L.
 * @version 1.0.0
 * @since 2026-09-07
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 */

/**
 * Returns a relative in-app path, defaulting to /app when the query is missing or off-site.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/app'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback;
  }
  return raw;
}
