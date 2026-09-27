/**
 * @fileoverview Changelog content model: dated releases across Code, CLI, Chat, App, API and Web.
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
 * - Newest release first; each entry lists the products it touches so the
 *   page can filter by product
 * - Items are Markdown fragments (inline code and links allowed)
 * - Kinds map to badges: added, changed, fixed, security
 */

export type Product = 'App' | 'CLI' | 'Chat' | 'Code' | 'API' | 'Web';

export type ChangeKind = 'added' | 'changed' | 'fixed' | 'security';

export type ChangeItem = { kind: ChangeKind; text: string };

export type Release = {
  version: string;
  date: string;
  title: string;
  products: Product[];
  items: ChangeItem[];
};

export const PRODUCTS: Product[] = ['App', 'CLI', 'Chat', 'Code', 'API', 'Web'];

export const RELEASES: Release[] = [
  {
    version: '2026.09.14',
    date: '2026-09-14',
    title: 'Web Chat, desktop installers, docs',
    products: ['Web', 'Chat', 'App'],
    items: [
      { kind: 'added', text: '**Web Chat** in the dashboard: the desktop Chat, served from the website with your signed-in session, threads synced server-side.' },
      { kind: 'added', text: 'Chat engine extracted into a shared crate so the app and the website stream the same events (`chat-delta`, `chat-reasoning`, `chat-tool`, `chat-done`).' },
      { kind: 'added', text: 'Download page lists desktop installers for macOS, Windows and Linux straight from the latest GitHub release, with SHA-256 checksums.' },
      { kind: 'added', text: 'Documentation, Changelog and Terms pages.' },
      { kind: 'changed', text: 'Website signup mints an encrypted `chat`-purpose key on first Chat use; nothing to configure.' },
    ],
  },
  {
    version: '2026.09.13',
    date: '2026-09-13',
    title: 'Onboarding and sign out',
    products: ['App'],
    items: [
      { kind: 'added', text: 'First-run screen with **Continue in browser** (device flow) and **Paste an API key**, identical to the CLI login.' },
      { kind: 'changed', text: 'Signing out returns to the onboarding screen; the app requires a valid key to proceed.' },
      { kind: 'changed', text: 'Test builds of the app point at the test gateway by default.' },
    ],
  },
  {
    version: '2026.09.12',
    date: '2026-09-12',
    title: 'Build in parallel, subagent transcripts',
    products: ['App', 'Code'],
    items: [
      { kind: 'added', text: '**Build in parallel** on the Plan tab runs the plan in Parallel mode; the Build button now uses the Plan-mode colour.' },
      { kind: 'added', text: 'Subagent rows show a dedicated indicator; click to open the full subagent transcript.' },
      { kind: 'fixed', text: 'Composer no longer clips when three or four panes are open.' },
    ],
  },
  {
    version: '2026.09.11',
    date: '2026-09-11',
    title: 'Multi-pane sessions',
    products: ['App', 'CLI', 'Code'],
    items: [
      { kind: 'added', text: 'Drag **New session** onto the canvas to split into up to four independent Code panes, each with its own workspace, model and permissions.' },
      { kind: 'added', text: 'Slash command picker: type `/` to browse built-ins, skills, plugins and MCP prompts.' },
      { kind: 'changed', text: 'Session-scoped runtime state (to-dos, file history, subagents, MCP scope) so concurrent sessions never share state.' },
      { kind: 'fixed', text: 'MCP servers configured by different panes no longer collide; servers are aliased per workspace.' },
    ],
  },
  {
    version: '2026.09.10',
    date: '2026-09-10',
    title: 'Plan tab',
    products: ['App', 'CLI', 'Code'],
    items: [
      { kind: 'added', text: 'Plan mode renders the plan in a **Plan** tab with inline comments, model selector and a **Build** button.' },
      { kind: 'changed', text: 'To-dos are created when you build, not when the plan is generated; the plan ends in a `## To-dos` checklist instead.' },
      { kind: 'changed', text: 'Plans are persisted under `.faelith/plans/` alongside host metadata.' },
    ],
  },
  {
    version: '2026.09.06',
    date: '2026-09-06',
    title: 'Dashboard and billing',
    products: ['Web', 'API'],
    items: [
      { kind: 'added', text: 'Dashboard with Overview heatmap, Usage meters, Spending ledger, API Keys and Billing.' },
      { kind: 'added', text: 'Usage-based billing toggle and usage reset grants; `POST /v1/billing/usage-reset/redeem`.' },
      { kind: 'added', text: 'Key purposes (`code`, `chat`, `api`) and unified encrypted model-I/O capture.' },
      { kind: 'security', text: 'CSRF protection on state-changing dashboard routes; sessions bound to Origin.' },
    ],
  },
];
