/**
 * @fileoverview Typed client for the admin console API (/api/admin/*): analytics reports and support actions.
 * @author Samuel S. L.
 * @version 1.7.0
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
 * - Uses the shared `apiRequest`, so reauthentication challenges open the ReauthDialog transparently
 * - Response shapes mirror crates/faelith-web/src/admin.rs and analytics.rs (same-origin, first-party contract)
 */

import { apiRequest } from './api';

/** Aggregates for one group of page views (a page, a source, a device...). */
export interface GroupStats {
  name: string;
  views: number;
  visitors: number;
  sessions: number;
  avg_active_ms: number;
  avg_scroll: number;
  /** Percent of views reaching 25, 50, 75 and 100 percent of the page. */
  reach: [number, number, number, number];
  bounce_rate: number;
  clicks: number;
  click_rate: number;
}

export interface Overview {
  from: string;
  to: string;
  truncated: boolean;
  totals: GroupStats;
  anonymous_views: number;
  series: { day: string; views: number; visitors: number }[];
  pages: GroupStats[];
  landing_pages: GroupStats[];
  referrers: GroupStats[];
  utm_sources: GroupStats[];
  utm_campaigns: GroupStats[];
  utm_contents: GroupStats[];
  devices: GroupStats[];
  languages: GroupStats[];
  /** Clicks on subscribe CTAs (`plan / interval[ / intro]`) and the pages they happened on. */
  subscribe_intent: { total: number; by_plan: CountRow[]; by_page: CountRow[] };
  /** Same-length period right before `from`, same segment. */
  previous: { from: string; totals: GroupStats; anonymous_views: number };
}

export interface CountRow {
  name: string;
  clicks: number;
}

/** Checkout Sessions of one group in the period. */
export interface FunnelRow {
  name: string;
  started: number;
  completed: number;
  open: number;
  conversion: number;
}

/** Live Stripe subscription mix plus the period's churn and checkout funnel. */
export interface SubscriptionsReport {
  live: number;
  monthly: number;
  yearly: number;
  cancel_scheduled: number;
  mrr_cents: number;
  arr_cents: number;
  new_in_range: number;
  canceled_in_range: number;
  statuses: Record<string, number>;
  plans: { plan: string; monthly: number; yearly: number; total: number; cancel_scheduled: number; mrr_cents: number }[];
  checkout: { totals: FunnelRow | null; by_plan: FunnelRow[]; by_landing: FunnelRow[]; by_offer: FunnelRow[] };
  refund: RefundReport;
  profit: ProfitReport;
  /** Live subscriptions by buyer kind (business / individual / unknown) and billing country. */
  customers: {
    by_kind: { name: string; count: number; mrr_cents: number }[];
    by_country: NameCount[];
    by_tax_id: NameCount[];
  };
}

/** Revenue minus provider cost minus tax, in cents. */
export interface ProfitLine {
  revenue_cents: number;
  cost_cents: number;
  fee_cents: number;
  revenue_tax_cents: number;
  profit_tax_cents: number;
  tax_cents: number;
  profit_cents: number;
  margin: number;
}

/** Real profit: subscriptions on a monthly basis, prepaid usage on the period. */
export interface ProfitReport {
  /** Rates actually applied, in percent. */
  tax: { revenue_pct: number; profit_pct: number; payment_fee_pct: number; payment_fee_source: 'stripe' | 'config' | 'override' };
  period_days: number;
  subscriptions: {
    rows: (ProfitLine & { name: string; subscriptions: number; profit_per_sub_cents: number })[];
    total: ProfitLine & { subscriptions: number; annual_profit_cents: number };
  };
  api: ProfitLine & { requests: number; orgs: number };
  overage: ProfitLine & { requests: number };
}

/** `{ name, count }` ranking row. */
export interface NameCount {
  name: string;
  count: number;
}

/** Refund windows: open now (split several ways) and the period's refunds. */
export interface RefundReport {
  open: number;
  opened_in_range: number;
  refunded_in_range: number;
  refund_rate: number;
  /** Per window length ("7d", "14d"). */
  by_kind: { name: string; open: number; closing_soon: number; opened: number; refunded: number; refund_rate: number }[];
  by_plan: NameCount[];
  by_kind_plan: NameCount[];
  by_country: NameCount[];
}

export interface PageReport {
  path: string;
  summary: GroupStats;
  avg_doc_h: number;
  /** Percent of views reaching 0, 10, ..., 100 percent of the page (11 values). */
  reach: number[];
  /** Summed visible milliseconds per 5 percent band (20 values). */
  attention_ms: number[];
  /** Click points as [x, y] fractions of page width and height. */
  clicks: [number, number][];
  targets: { label: string; clicks: number }[];
}

export interface VisitorRow {
  visitor_id: string;
  first_seen: string | null;
  last_seen: string | null;
  first_source: string | null;
  views: number;
  sessions: number;
  pages: number;
  active_ms: number;
  clicks: number;
  email: string | null;
}

export interface VisitorJourney {
  visitor_id: string;
  email: string | null;
  pageviews: {
    id: string;
    path: string;
    started_at: string;
    last_seen_at: string;
    active_ms: number;
    max_scroll: number;
    clicks: number;
    device: string;
    session_id: string | null;
    referrer: string | null;
    utm_source: string | null;
    utm_campaign: string | null;
    lp: string | null;
  }[];
  clicks: { pageview_id: string; path: string; label: string; at: string }[];
}

export interface AdminKey {
  prefix: string;
  purpose: string;
  rpm: number;
  tpm: number;
  revoked: boolean;
}

export interface OrgDetail {
  org_id: string;
  account: { email: string; name: string; user_id: string } | null;
  subscription: {
    plan: string | null;
    status: string;
    usage_based: boolean;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  } | null;
  credits_usd: number;
  suspended: boolean;
  refund: { available: boolean; closes_at?: string };
  intro: { until: string; active: boolean } | null;
  retention: { accepted_at: string; starts_at: string; ends_at: string; active: boolean } | null;
  keys: AdminKey[];
}

export interface AuditRow {
  admin_email: string;
  action: string;
  target_org: string | null;
  detail: Record<string, unknown>;
  at: string;
}

/** Report period: `YYYY-MM-DD` days (inclusive) or RFC 3339 instants; `preset` is UI-only. */
export interface Range {
  from: string;
  to: string;
  preset?: string;
}

/** Only the bounds of a range go to the server. */
function bounds(range: Range): { from: string; to: string } {
  return { from: range.from, to: range.to };
}

/** Segment filters; empty strings mean "all". */
export interface Segment {
  device: string;
  source: string;
  campaign: string;
  lp: string;
}

/**
 * Builds a query string, skipping empty values.
 */
function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** GET /api/admin/me — resolves when the signed-in user may use the console. */
export async function fetchAdminMe(): Promise<void> {
  await apiRequest('GET', '/api/admin/me');
}

/** GET /api/admin/analytics/overview. */
export async function fetchOverview(range: Range, segment: Segment): Promise<Overview> {
  return (await apiRequest('GET', `/api/admin/analytics/overview${query({ ...bounds(range), ...segment })}`)) as Overview;
}

/** GET /api/admin/analytics/page. */
export async function fetchPageReport(range: Range, path: string, device: string, segment: Segment): Promise<PageReport> {
  return (await apiRequest('GET', `/api/admin/analytics/page${query({ ...bounds(range), ...segment, path, device })}`)) as PageReport;
}

/** GET /api/admin/analytics/visitors. */
export async function fetchVisitors(range: Range, segment: Segment): Promise<VisitorRow[]> {
  const body = (await apiRequest('GET', `/api/admin/analytics/visitors${query({ ...bounds(range), ...segment })}`)) as { visitors: VisitorRow[] };
  return body.visitors;
}

/** GET /api/admin/analytics/visitors/{id}. */
export async function fetchVisitor(id: string): Promise<VisitorJourney> {
  return (await apiRequest('GET', `/api/admin/analytics/visitors/${encodeURIComponent(id)}`)) as VisitorJourney;
}

/** GET /api/admin/orgs/search — first match by email, org id, or key prefix. */
export async function searchOrg(q: string): Promise<{ org_id: string; email: string | null }[]> {
  const body = (await apiRequest('GET', `/api/admin/orgs/search${query({ q })}`)) as {
    results: { org_id: string; email: string | null }[];
  };
  return body.results;
}

/** GET /api/admin/orgs/{id}. */
export async function fetchOrg(orgId: string): Promise<OrgDetail> {
  return (await apiRequest('GET', `/api/admin/orgs/${orgId}`)) as OrgDetail;
}

/** POST /api/admin/orgs/{id}/keys — returns the plaintext once. */
export async function adminCreateKey(orgId: string, purpose: string, rpm: number, tpm: number): Promise<{ prefix: string; plaintext: string }> {
  return (await apiRequest('POST', `/api/admin/orgs/${orgId}/keys`, { purpose, rpm, tpm })) as { prefix: string; plaintext: string };
}

/** POST /api/admin/keys/{prefix}/revoke. */
export async function adminRevokeKey(prefix: string): Promise<void> {
  await apiRequest('POST', `/api/admin/keys/${encodeURIComponent(prefix)}/revoke`, {});
}

/** POST /api/admin/orgs/{id}/subscription — `plan` null clears the plan. */
export async function adminSetPlan(orgId: string, plan: string | null, usageBased: boolean): Promise<void> {
  await apiRequest('POST', `/api/admin/orgs/${orgId}/subscription`, { plan, usage_based: usageBased });
}

/** POST /api/admin/orgs/{id}/credits — positive grants, negative removes. */
export async function adminAdjustCredits(orgId: string, usd: number): Promise<{ applied_usd: number; balance_usd: number }> {
  return (await apiRequest('POST', `/api/admin/orgs/${orgId}/credits`, { usd })) as { applied_usd: number; balance_usd: number };
}

/** POST /api/admin/orgs/{id}/usage-reset. */
export async function adminGrantReset(orgId: string, reason: string): Promise<void> {
  await apiRequest('POST', `/api/admin/orgs/${orgId}/usage-reset`, { reason });
}

/** POST /api/admin/orgs/{id}/suspend or /unsuspend. */
export async function adminSetSuspended(orgId: string, suspended: boolean, reason: string): Promise<void> {
  if (suspended) await apiRequest('POST', `/api/admin/orgs/${orgId}/suspend`, { reason });
  else await apiRequest('POST', `/api/admin/orgs/${orgId}/unsuspend`, {});
}

/** GET /api/admin/subscriptions (live from Stripe). */
/** Tax overrides in percent; null uses the server defaults (ADMIN_TAX_*_PCT). */
export interface TaxRates {
  revenue: number;
  profit: number;
  /** Payment fee override in percent; null uses the rate measured in Stripe. */
  fee: number | null;
}

export async function fetchSubscriptions(range: Range, tax: TaxRates | null): Promise<SubscriptionsReport> {
  const rates = tax
    ? { revenue_tax: String(tax.revenue), profit_tax: String(tax.profit), payment_fee: tax.fee === null ? undefined : String(tax.fee) }
    : {};
  return (await apiRequest('GET', `/api/admin/subscriptions${query({ ...bounds(range), ...rates })}`)) as SubscriptionsReport;
}

/** One NFS-e document as listed in the admin console. */
export interface AdminNfseDoc {
  id: string;
  status: string;
  number: string | null;
  access_key: string | null;
  stripe_invoice_id: string;
  amount_usd_cents: number;
  amount_brl_cents: number | null;
  buyer_name: string | null;
  buyer_country: string | null;
  attempts: number;
  last_error: string | null;
  paid_at: string;
  issued_at: string | null;
}

export interface AdminNfse {
  enabled: boolean;
  emitter: {
    environment: string;
    cnpj: string;
    series: number;
    trib_nac: string;
    nbs: string;
    certificate_subject: string;
    certificate_expires_at: string | null;
  } | null;
  documents: AdminNfseDoc[];
}

/** GET /api/admin/nfse. */
export async function fetchAdminNfse(status: string): Promise<AdminNfse> {
  return (await apiRequest('GET', `/api/admin/nfse${query({ status })}`)) as AdminNfse;
}

/** POST /api/admin/nfse/{id}/{retry|cancel}. */
export async function adminNfseAction(id: string, action: 'retry' | 'cancel', reason?: string): Promise<void> {
  await apiRequest('POST', `/api/admin/nfse/${encodeURIComponent(id)}/${action}`, reason ? { reason } : {});
}

/** GET /api/admin/audit. */
export async function fetchAudit(): Promise<AuditRow[]> {
  const body = (await apiRequest('GET', '/api/admin/audit')) as { entries: AuditRow[] };
  return body.entries;
}
