/**
 * @fileoverview GitHub Releases client for the Download page: latest Faelith App installers by platform.
 * @author Samuel S. L.
 * @version 1.0.0
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
 * - Reads GET /repos/{owner}/{repo}/releases/latest (public, unauthenticated;
 *   60 requests/hour per IP, cached in sessionStorage for 10 minutes)
 * - Classifies Tauri bundle names into platform/arch/format entries
 *   (Faelith_0.1.0_aarch64.dmg, Faelith_0.1.0_x64-setup.exe, ..._amd64.AppImage)
 * - Detects the visitor's platform from navigator to preselect a tab
 * Primary docs: https://docs.github.com/en/rest/releases/releases#get-the-latest-release
 */

export const APP_REPO = 'FaelithIndustries/faelith-app';
const LATEST_URL = `https://api.github.com/repos/${APP_REPO}/releases/latest`;
export const RELEASES_URL = `https://github.com/${APP_REPO}/releases`;
const CACHE_KEY = 'faelith.releases.latest';
const CACHE_TTL_MS = 10 * 60_000;

export type Platform = 'macos' | 'windows' | 'linux';

export type Installer = {
  platform: Platform;
  /** Human label such as "Apple Silicon (.dmg)". */
  label: string;
  arch: string;
  format: string;
  url: string;
  sizeBytes: number;
};

export type LatestRelease = {
  version: string;
  tag: string;
  publishedAt: string;
  notesUrl: string;
  checksumsUrl: string | null;
  installers: Installer[];
};

type GitHubAsset = { name: string; browser_download_url: string; size: number };
type GitHubRelease = { tag_name: string; html_url: string; published_at: string; assets: GitHubAsset[] };

/**
 * Maps a bundle file name onto its platform, architecture and format label.
 * Returns null for non-installer assets (signatures, updater JSON, checksums).
 */
export function classifyAsset(name: string, url: string, size: number): Installer | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.sig') || lower.endsWith('.json') || lower.endsWith('.txt')) return null;
  const arch = /aarch64|arm64/.test(lower) ? 'arm64' : /x64|x86_64|amd64/.test(lower) ? 'x64' : /universal/.test(lower) ? 'universal' : 'x64';
  const base = { url, sizeBytes: size, arch };
  if (lower.endsWith('.dmg')) {
    const label = arch === 'arm64' ? 'Apple Silicon' : arch === 'universal' ? 'Universal' : 'Intel';
    return { ...base, platform: 'macos', format: 'dmg', label: `${label} (.dmg)` };
  }
  if (lower.endsWith('.app.tar.gz')) return null;
  if (lower.endsWith('.msi')) return { ...base, platform: 'windows', format: 'msi', label: 'Installer (.msi)' };
  if (lower.endsWith('.exe')) return { ...base, platform: 'windows', format: 'exe', label: 'Setup (.exe)' };
  if (lower.endsWith('.appimage')) return { ...base, platform: 'linux', format: 'AppImage', label: 'AppImage' };
  if (lower.endsWith('.deb')) return { ...base, platform: 'linux', format: 'deb', label: 'Debian / Ubuntu (.deb)' };
  if (lower.endsWith('.rpm')) return { ...base, platform: 'linux', format: 'rpm', label: 'Fedora / RHEL (.rpm)' };
  return null;
}

/**
 * Converts a GitHub release payload into the page model. Tag `v0.1.0` yields
 * version `0.1.0`; `app-v0.1.0` (tauri-action default) is also accepted.
 */
export function parseRelease(release: GitHubRelease): LatestRelease {
  const installers = release.assets
    .map((asset) => classifyAsset(asset.name, asset.browser_download_url, asset.size))
    .filter((entry): entry is Installer => entry !== null);
  const checksums = release.assets.find((asset) => /sha256sums/i.test(asset.name));
  return {
    version: release.tag_name.replace(/^(app-)?v/, ''),
    tag: release.tag_name,
    publishedAt: release.published_at,
    notesUrl: release.html_url,
    checksumsUrl: checksums?.browser_download_url ?? null,
    installers,
  };
}

/**
 * Fetches the latest release, serving a sessionStorage copy while fresh.
 * Returns null when the repository has no published release yet (404).
 */
export async function fetchLatestRelease(): Promise<LatestRelease | null> {
  try {
    const cached = window.sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const entry = JSON.parse(cached) as { at: number; release: LatestRelease | null };
      if (Date.now() - entry.at < CACHE_TTL_MS) return entry.release;
    }
  } catch {
    /* ignore corrupt cache */
  }
  const response = await fetch(LATEST_URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (response.status === 404) {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release: null }));
    return null;
  }
  if (!response.ok) throw new Error(`GitHub releases request failed: ${response.status}`);
  const release = parseRelease((await response.json()) as GitHubRelease);
  window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release }));
  return release;
}

/**
 * Best-effort platform detection from the user agent for the default tab.
 */
export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/Mac|iPhone|iPad/.test(ua)) return 'macos';
  if (/Linux|X11/.test(ua) && !/Android/.test(ua)) return 'linux';
  return 'windows';
}

/**
 * Formats a byte count as MB with one decimal.
 */
export function formatSize(bytes: number): string {
  if (!bytes) return '';
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}
