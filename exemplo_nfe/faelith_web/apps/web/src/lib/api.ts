/**
 * @fileoverview Cookie-authenticated fetch helpers for /auth and /api routes.
 * @author Samuel S. L.
 * @version 1.18.0
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
 * - Always sends credentials so session cookies reach the Vite proxy
 * - Parses JSON bodies and surfaces HTTP status as ApiError
 * - Normalizes nested gateway payloads into typed SPA records
 * - Signup returns a pending state; login may return a two-factor challenge
 */

import type {
  ApiKeyRecord,
  CliDeviceRequester,
  BillingResponse,
  CheckoutBody,
  ContactBody,
  CreatedApiKey,
  HeatmapDay,
  KeyPurpose,
  LoginResult,
  MeterBar,
  MfaChallenge,
  MfaMethod,
  MfaProof,
  OAuthProvider,
  OverviewResponse,
  PlanId,
  ReauthMethod,
  ReauthProof,
  ReauthRequirement,
  SecurityStatus,
  SessionUser,
  SpendingResponse,
  TotpSetup,
  Invoice,
  UsageResponse,
  UsageTokens,
} from './types';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Reads a JSON body, returning null for empty responses.
 */
async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Narrows an unknown value to a plain object record.
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Extracts a human-readable error message from a gateway JSON body.
 */
function errorMessage(body: unknown, fallback: string): string {
  // Plain-text errors are shown; an HTML page (proxy or SPA fallback) never is.
  if (typeof body === 'string' && body.trim() !== '' && !body.trimStart().startsWith('<')) {
    return body;
  }
  const record = asRecord(body);
  if (!record) {
    return fallback;
  }
  const candidates = [record.error, record.message, record.detail];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate;
    }
  }
  return fallback;
}

/**
 * Issues a same-origin request with credentials included and JSON headers.
 */
async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  let payload = body;
  for (let prompts = 0; ; prompts += 1) {
    const response = await send(method, path, payload);
    const parsed = await readBody(response);
    if (response.ok) {
      return parsed;
    }
    const requirement = readReauth(response.status, parsed);
    const base = body === undefined ? {} : asRecord(body);
    if (requirement && reauthPrompt && base && prompts < MAX_REAUTH_PROMPTS) {
      const proof = await reauthPrompt(requirement);
      if (!proof) {
        throw new ApiError(403, 'Confirmation cancelled');
      }
      // Settings calls carry their own `proof`; the server accepts `reauth` as an alias.
      const { proof: _previous, ...rest } = base;
      payload = { ...rest, reauth: proof };
      continue;
    }
    throw new ApiError(response.status, errorMessage(parsed, response.statusText));
  }
}

/**
 * Shared JSON request (same-origin, credentials, transparent reauth) for feature clients such as adminApi.
 */
export function apiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  return request(method, path, body);
}

/**
 * Performs one same-origin JSON fetch with the session cookie.
 */
async function send(method: string, path: string, body: unknown): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return fetch(path, init);
}

/** Maximum confirmation prompts for one action before the error is surfaced. */
const MAX_REAUTH_PROMPTS = 5;

/** UI callback that asks the user to confirm it is them; null means cancelled. */
export type ReauthPrompt = (requirement: ReauthRequirement) => Promise<ReauthProof | null>;

let reauthPrompt: ReauthPrompt | null = null;

/**
 * Registers the dialog that answers server reauth challenges. Every sensitive
 * call (keys, billing, password, deletion, device approval) then retries
 * transparently with the proof, so call sites stay unchanged.
 */
export function setReauthPrompt(prompt: ReauthPrompt | null): void {
  reauthPrompt = prompt;
}

const REAUTH_METHODS: readonly ReauthMethod[] = ['password', 'totp', 'email', 'backup'];

/**
 * Parses a 403 reauth challenge (`{ error, reauth: { methods, email_hint } }`).
 */
function readReauth(status: number, body: unknown): ReauthRequirement | null {
  if (status !== 403) {
    return null;
  }
  const record = asRecord(body);
  const reauth = record ? asRecord(record.reauth) : null;
  if (!record || !reauth || !Array.isArray(reauth.methods)) {
    return null;
  }
  const methods = reauth.methods.filter((method): method is ReauthMethod =>
    REAUTH_METHODS.includes(method as ReauthMethod),
  );
  if (methods.length === 0) {
    return null;
  }
  return {
    methods,
    emailHint: typeof reauth.email_hint === 'string' ? reauth.email_hint : '',
    message: errorMessage(body, 'Confirm it is you to continue'),
  };
}

/**
 * Reads a string field from a record, defaulting to empty when absent.
 */
function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Reads a boolean field, treating missing values as false.
 */
function readBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true;
}

/**
 * Parses a plan id, returning null for unknown or empty values.
 */
function readPlan(value: unknown): PlanId | null {
  if (value === 'starter' || value === 'pro' || value === 'max' || value === 'ultra' || value === 'scale') {
    return value;
  }
  return null;
}

/**
 * Parses a key purpose, defaulting to api when the payload is malformed.
 */
function readPurpose(value: unknown): KeyPurpose {
  if (value === 'code' || value === 'chat' || value === 'api') {
    return value;
  }
  return 'api';
}

/**
 * Reads a nested object under one of the provided keys.
 */
function nestedRecord(root: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  for (const key of keys) {
    const nested = asRecord(root[key]);
    if (nested) {
      return nested;
    }
  }
  return root;
}

/**
 * Normalizes GET /auth/me JSON into a SessionUser, or null when unauthenticated.
 */
export function parseSession(data: unknown): SessionUser | null {
  const root = asRecord(data);
  if (!root) {
    return null;
  }
  if (root.authenticated === false) {
    return null;
  }
  const rec = nestedRecord(root, ['user', 'account', 'me']);
  const email = readString(rec, 'email');
  const name = readString(rec, 'name');
  const id = readString(rec, 'id') || email;
  if (!email && !name && !id) {
    return null;
  }
  const oauth = asRecord(rec.oauth) ?? rec;
  return {
    id,
    email,
    name,
    plan: readPlan(rec.plan),
    usageBased: readBoolean(rec, 'usageBased') || readBoolean(rec, 'usage_based'),
    githubLinked:
      readBoolean(oauth, 'github') ||
      readBoolean(oauth, 'githubLinked') ||
      readBoolean(rec, 'githubLinked'),
    googleLinked:
      readBoolean(oauth, 'google') ||
      readBoolean(oauth, 'googleLinked') ||
      readBoolean(rec, 'googleLinked'),
    admin: readBoolean(rec, 'admin'),
  };
}

/**
 * Reads a meter bar from either camelCase or snake_case nested objects.
 */
function readMeter(record: Record<string, unknown>, camel: string, snake: string): MeterBar {
  const nested = asRecord(record[camel]) ?? asRecord(record[snake]);
  const usedRaw = nested?.used ?? nested?.consumed ?? record[`${camel}Used`];
  const limitRaw = nested?.limit ?? nested?.allowance ?? record[`${camel}Limit`];
  const remainingRaw = nested?.remaining ?? record[`${camel}Remaining`];
  const exhaustedRaw = nested?.exhausted ?? record[`${camel}Exhausted`];
  const used = typeof usedRaw === 'number' ? usedRaw : 0;
  const limit = typeof limitRaw === 'number' ? limitRaw : 0;
  const remaining =
    typeof remainingRaw === 'number' ? remainingRaw : Math.max(0, limit - used);
  const exhausted =
    typeof exhaustedRaw === 'boolean' ? exhaustedRaw : limit > 0 && used >= limit;
  return { used, limit, remaining, exhausted };
}

/**
 * Normalizes usage JSON, treating missing meters as empty bars.
 */
function parseUsage(data: unknown): UsageResponse {
  const root = asRecord(data) ?? {};
  const usage = nestedRecord(root, ['usage', 'meters']);
  const availableRaw = root.available_resets ?? root.availableResets ?? usage.available_resets;
  return {
    plan: readPlan(root.plan) ?? readPlan(usage.plan),
    code5h: readMeter(usage, 'code5h', 'code_5h'),
    codeWeekly: readMeter(usage, 'codeWeekly', 'code_weekly'),
    chat5h: readMeter(usage, 'chat5h', 'chat_5h'),
    chatWeekly: readMeter(usage, 'chatWeekly', 'chat_weekly'),
    availableResets: typeof availableRaw === 'number' ? availableRaw : 0,
  };
}

/**
 * GET /auth/me. Returns null on 401 without throwing.
 */
export async function fetchMe(): Promise<SessionUser | null> {
  try {
    const data = await request('GET', '/auth/me');
    return parseSession(data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

/**
 * POST /auth/signup. The server emails a 6-digit code; no session exists yet.
 * The response is identical for registered emails, so it never confirms an account.
 */
export async function signup(email: string, password: string, name: string): Promise<void> {
  await request('POST', '/auth/signup', { email, password, name });
}

/**
 * POST /auth/signup/verify with the emailed code; creates the account and session.
 */
export async function verifySignup(email: string, code: string): Promise<SessionUser | null> {
  const data = await request('POST', '/auth/signup/verify', { email, code });
  return parseSession(data);
}

/**
 * POST /auth/signup/resend to email a fresh code (server enforces a 60 s cooldown).
 */
export async function resendSignup(email: string): Promise<void> {
  await request('POST', '/auth/signup/resend', { email });
}

/**
 * Reads the method list and masked email from a challenge payload.
 */
function parseChallenge(data: unknown): MfaChallenge {
  const root = asRecord(data) ?? {};
  const methods = Array.isArray(root.methods)
    ? root.methods.filter((m): m is MfaMethod => m === 'totp' || m === 'email' || m === 'backup')
    : [];
  return {
    methods,
    emailHint: readString(root, 'email_hint'),
    emailSent: readBoolean(root, 'email_sent'),
  };
}

/**
 * POST /auth/login. Returns a session, or a challenge when 2FA is enabled.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  const data = await request('POST', '/auth/login', { email, password });
  if (asRecord(data)?.mfa_required === true) {
    return { kind: 'mfa', challenge: parseChallenge(data) };
  }
  return { kind: 'session', user: parseSession(data) };
}

/**
 * GET /auth/mfa for the pending challenge (after a password or OAuth first factor).
 */
export async function fetchMfaChallenge(): Promise<MfaChallenge> {
  return parseChallenge(await request('GET', '/auth/mfa'));
}

/**
 * POST /auth/mfa/email to email a sign-in code for the pending challenge.
 */
export async function sendMfaEmail(): Promise<MfaChallenge> {
  return parseChallenge(await request('POST', '/auth/mfa/email'));
}

/**
 * POST /auth/mfa/verify; on success the server sets the session cookie.
 */
export async function verifyMfa(method: MfaMethod, code: string): Promise<SessionUser | null> {
  const data = await request('POST', '/auth/mfa/verify', { method, code });
  return parseSession(data);
}

/**
 * Normalizes the security settings payload.
 */
function parseSecurity(data: unknown): SecurityStatus {
  const root = asRecord(data) ?? {};
  const remaining = root.backup_codes_remaining;
  const codes = Array.isArray(root.backup_codes)
    ? root.backup_codes.filter((code): code is string => typeof code === 'string')
    : null;
  return {
    totpEnabled: readBoolean(root, 'totp_enabled'),
    emailEnabled: readBoolean(root, 'email_enabled'),
    mfaEnabled: readBoolean(root, 'mfa_enabled'),
    backupCodesRemaining: typeof remaining === 'number' ? remaining : 0,
    backupCodes: codes,
  };
}

/**
 * GET /api/security for the Settings two-factor section.
 */
export async function fetchSecurity(): Promise<SecurityStatus> {
  return parseSecurity(await request('GET', '/api/security'));
}

/**
 * POST /api/security/stepup/email to email a code that confirms the next change.
 */
export async function sendStepUpEmail(): Promise<void> {
  await request('POST', '/api/security/stepup/email');
}

/**
 * POST /api/security/totp/setup; returns the QR and manual secret for a pending seed.
 */
export async function setupTotp(): Promise<TotpSetup> {
  const root = asRecord(await request('POST', '/api/security/totp/setup')) ?? {};
  return {
    qr: readString(root, 'qr'),
    secret: readString(root, 'secret'),
    otpauthUrl: readString(root, 'otpauth_url'),
  };
}

/**
 * POST /api/security/totp/enable with a code from the authenticator app.
 */
export async function enableTotp(code: string, proof?: MfaProof): Promise<SecurityStatus> {
  return parseSecurity(await request('POST', '/api/security/totp/enable', { code, proof }));
}

/**
 * POST /api/security/totp/disable after step-up proof.
 */
export async function disableTotp(proof?: MfaProof): Promise<SecurityStatus> {
  return parseSecurity(await request('POST', '/api/security/totp/disable', { proof }));
}

/**
 * POST /api/security/email/enable with the emailed step-up code.
 */
export async function enableEmailMfa(code: string): Promise<SecurityStatus> {
  return parseSecurity(await request('POST', '/api/security/email/enable', { code }));
}

/**
 * POST /api/security/email/disable after step-up proof.
 */
export async function disableEmailMfa(proof?: MfaProof): Promise<SecurityStatus> {
  return parseSecurity(await request('POST', '/api/security/email/disable', { proof }));
}

/**
 * POST /api/security/backup-codes to replace every recovery code after step-up proof.
 */
export async function regenerateBackupCodes(proof?: MfaProof): Promise<SecurityStatus> {
  return parseSecurity(await request('POST', '/api/security/backup-codes', { proof }));
}

/**
 * POST /auth/logout and drop the server session cookie.
 */
export async function logout(): Promise<void> {
  await request('POST', '/auth/logout');
}

/**
 * GET /api/csrf and extract a token from csrf, token, or string bodies.
 */
export async function fetchCsrf(): Promise<string> {
  const data = await request('GET', '/api/csrf');
  if (typeof data === 'string' && data.trim() !== '') {
    return data;
  }
  const record = asRecord(data);
  if (record) {
    const csrf = record.csrf ?? record.token ?? record.csrfToken;
    if (typeof csrf === 'string' && csrf.trim() !== '') {
      return csrf;
    }
  }
  throw new ApiError(500, 'CSRF token missing from /api/csrf');
}

/**
 * Parses the overview heatmap array, ignoring malformed cells.
 */
function parseHeatmap(data: unknown): HeatmapDay[] {
  const root = asRecord(data) ?? {};
  const raw = root.heatmap;
  if (!Array.isArray(raw)) {
    return [];
  }
  const days: HeatmapDay[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec) {
      continue;
    }
    const date = readString(rec, 'date');
    const count = (key: string) => {
      const value = Number(rec[key] ?? 0);
      return Number.isFinite(value) ? value : 0;
    };
    if (date) {
      days.push({ date, all: count('all'), chat: count('chat'), code: count('code') });
    }
  }
  return days;
}

/**
 * GET /api/overview for the dashboard landing page.
 */
export async function fetchOverview(): Promise<OverviewResponse> {
  const data = await request('GET', '/api/overview');
  const root = asRecord(data) ?? {};
  return {
    plan: readPlan(root.plan),
    usageBased: readBoolean(root, 'usageBased') || readBoolean(root, 'usage_based'),
    usage: data === null ? null : parseUsage(data),
    heatmap: parseHeatmap(data),
  };
}

/**
 * PATCH /api/settings to update the display name.
 */
export async function patchSettings(name: string): Promise<void> {
  await request('PATCH', '/api/settings', { name });
}

/**
 * POST /api/settings/password with current and next passwords.
 */
export async function changePassword(current: string, next: string): Promise<void> {
  await request('POST', '/api/settings/password', { current, next });
}

/**
 * POST /api/settings/oauth/unlink for GitHub or Google.
 */
export async function unlinkOAuth(provider: OAuthProvider): Promise<void> {
  await request('POST', '/api/settings/oauth/unlink', { provider });
}

/**
 * DELETE /api/account permanently.
 */
export async function deleteAccount(): Promise<void> {
  await request('DELETE', '/api/account', {});
}

/**
 * POST /auth/password/forgot; always resolves so registered emails are not revealed.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await request('POST', '/auth/password/forgot', { email });
}

/**
 * POST /auth/password/reset with the single-use token from the emailed link.
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  await request('POST', '/auth/password/reset', { token, password });
}

/**
 * GET /api/keys and normalize a list or {keys:[]} payload.
 */
export async function fetchKeys(): Promise<ApiKeyRecord[]> {
  const data = await request('GET', '/api/keys');
  const list = Array.isArray(data) ? data : asRecord(data)?.keys;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((item) => {
    const rec = asRecord(item) ?? {};
    return {
      prefix: readString(rec, 'prefix'),
      purpose: readPurpose(rec.purpose),
      createdAt: readString(rec, 'createdAt') || readString(rec, 'created_at') || null,
    };
  });
}

/**
 * POST /api/keys and return the plaintext secret shown only once.
 */
export async function createKey(purpose: KeyPurpose): Promise<CreatedApiKey> {
  const data = await request('POST', '/api/keys', { purpose });
  const rec = asRecord(data) ?? {};
  const secret =
    readString(rec, 'secret') ||
    readString(rec, 'key') ||
    readString(rec, 'plaintext') ||
    readString(rec, 'token');
  return {
    prefix: readString(rec, 'prefix'),
    purpose: readPurpose(rec.purpose) || purpose,
    createdAt: readString(rec, 'createdAt') || null,
    secret,
  };
}

/**
 * DELETE /api/keys/:prefix to revoke a key.
 */
export async function revokeKey(prefix: string): Promise<void> {
  await request('DELETE', `/api/keys/${encodeURIComponent(prefix)}`);
}

/**
 * GET /api/usage meter snapshot.
 */
export async function fetchUsage(): Promise<UsageResponse> {
  const data = await request('GET', '/api/usage');
  return parseUsage(data);
}

/**
 * POST /api/usage/reset/redeem to consume the oldest unused grant.
 */
export async function redeemUsageReset(): Promise<UsageResponse> {
  const data = await request('POST', '/api/usage/reset/redeem');
  return parseUsage(data);
}

/**
 * GET /api/spending wallet and usage_events table.
 */
export async function fetchSpending(): Promise<SpendingResponse> {
  const data = await request('GET', '/api/spending');
  const root = asRecord(data) ?? {};
  const eventsRaw = root.events ?? root.usage_events ?? root.usageEvents;
  const events = Array.isArray(eventsRaw) ? eventsRaw : [];
  const walletRaw = root.walletMicros ?? root.wallet_micros ?? root.wallet;
  return {
    walletMicros: typeof walletRaw === 'number' ? walletRaw : 0,
    plan: readPlan(root.plan),
    events: events.map((item, index) => {
      const rec = asRecord(item) ?? {};
      const amount = rec.amountMicros ?? rec.amount_micros ?? rec.amount;
      return {
        id: readString(rec, 'id') || String(index),
        at: readString(rec, 'at') || readString(rec, 'createdAt') || readString(rec, 'created_at') || null,
        purpose: readString(rec, 'purpose'),
        amountMicros: typeof amount === 'number' ? amount : 0,
        source: readString(rec, 'source'),
        tokens: parseTokens(rec.tokens),
        billing: readString(rec, 'billing') === 'included' ? 'included' : 'credits',
      };
    }),
  };
}

/**
 * Reads the per-event token buckets; null when the server sent none.
 */
function parseTokens(value: unknown): UsageTokens | null {
  const rec = asRecord(value);
  if (!rec) {
    return null;
  }
  const count = (key: string) => (typeof rec[key] === 'number' ? (rec[key] as number) : 0);
  return {
    input: count('input'),
    cacheRead: count('cache_read'),
    cacheWrite: count('cache_write'),
    output: count('output'),
    total: count('total'),
  };
}

/**
 * GET /api/billing/invoices: paid Stripe invoices, newest first.
 */
export async function fetchInvoices(): Promise<Invoice[]> {
  const data = await request('GET', '/api/billing/invoices');
  const rows = asRecord(data)?.invoices;
  if (!Array.isArray(rows)) {
    return [];
  }
  const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
  return rows.flatMap((row) => {
    const rec = asRecord(row);
    if (!rec || typeof rec.id !== 'string' || typeof rec.created !== 'number') {
      return [];
    }
    return [
      {
        id: rec.id,
        number: text(rec.number),
        createdAt: new Date(rec.created * 1000).toISOString(),
        amountPaid: typeof rec.amount_paid === 'number' ? rec.amount_paid : 0,
        currency: text(rec.currency) ?? 'usd',
        description: text(rec.description),
        hostedUrl: text(rec.hosted_invoice_url),
        pdfUrl: text(rec.invoice_pdf),
      },
    ];
  });
}

/**
 * GET /api/billing plan and usage-based flag.
 */
export async function fetchBilling(): Promise<BillingResponse> {
  const data = await request('GET', '/api/billing');
  const root = asRecord(data) ?? {};
  const refund = asRecord(root.refund);
  return {
    plan: readPlan(root.plan),
    usageBased: readBoolean(root, 'usageBased') || readBoolean(root, 'usage_based'),
    refundUntil: refund && refund.available === true ? readString(refund, 'closes_at') || null : null,
  };
}

/**
 * POST /api/billing/refund: cancels now and refunds the subscription in full (refund period only).
 */
export async function refundSubscription(): Promise<void> {
  await request('POST', '/api/billing/refund', {});
}

/** One NFS-e of the signed-in organization. */
export interface MyNote {
  id: string;
  status: string;
  number: string | null;
  amount_brl_cents: number | null;
  amount_usd_cents: number;
  paid_at: string;
  issued_at: string | null;
}

/** Notes plus the masked CPF / CNPJ on file. */
export interface MyNotes {
  notes: MyNote[];
  identity: { doc_type: string; doc_number: string } | null;
}

/**
 * GET /api/billing/nfse: the organization's NFS-e list and fiscal identity.
 */
export async function fetchMyNotes(): Promise<MyNotes> {
  const root = asRecord(await request('GET', '/api/billing/nfse')) ?? {};
  return {
    notes: Array.isArray(root.notes) ? (root.notes as MyNote[]) : [],
    identity: (asRecord(root.identity) as MyNotes['identity']) ?? null,
  };
}

/**
 * PUT /api/billing/fiscal-identity: CPF or CNPJ for the notes (resumes notes waiting for it).
 */
export async function saveFiscalIdentity(docType: 'cpf' | 'cnpj', docNumber: string): Promise<void> {
  await request('PUT', '/api/billing/fiscal-identity', { doc_type: docType, doc_number: docNumber });
}

/**
 * POST /api/billing/cancel: stops renewal; access continues until the paid period ends.
 */
export async function cancelSubscription(): Promise<void> {
  await request('POST', '/api/billing/cancel', {});
}

/** Retention offer shown when a monthly subscriber tries to cancel. */
export interface RetentionOffer {
  eligible: boolean;
  /** ISO-8601 renewal the 50 percent discount applies to; null when not eligible. */
  renewsAt: string | null;
}

/**
 * GET /api/billing/retention: whether the cancel flow should offer 50 percent off the next month.
 */
export async function fetchRetentionOffer(): Promise<RetentionOffer> {
  const root = asRecord(await request('GET', '/api/billing/retention')) ?? {};
  const eligible = root.eligible === true;
  return { eligible, renewsAt: eligible ? readString(root, 'renews_at') || null : null };
}

/**
 * POST /api/billing/retention/accept: discounts the next month and keeps the plan renewing.
 */
export async function acceptRetentionOffer(): Promise<void> {
  await request('POST', '/api/billing/retention/accept', {});
}

/**
 * POST /api/billing/checkout and return the hosted Stripe URL.
 */
export async function startCheckout(body: CheckoutBody): Promise<string> {
  const data = await request('POST', '/api/billing/checkout', body);
  const rec = asRecord(data);
  const url = rec ? readString(rec, 'url') : '';
  if (!url) {
    throw new ApiError(500, 'Checkout URL missing');
  }
  return url;
}

/**
 * POST /api/billing/portal and return the Stripe Customer Portal URL.
 */
export async function startPortal(): Promise<string> {
  const data = await request('POST', '/api/billing/portal');
  const rec = asRecord(data);
  const url = rec ? readString(rec, 'url') : '';
  if (!url) {
    throw new ApiError(500, 'Portal URL missing');
  }
  return url;
}

/**
 * POST /api/billing/usage-based to enable or disable prepaid overage.
 */
export async function setUsageBased(enabled: boolean): Promise<void> {
  await request('POST', '/api/billing/usage-based', { enabled });
}

/**
 * GET /api/cli/device/:code for the website authorize page.
 */
export async function fetchCliDevice(
  code: string,
): Promise<{ user_code: string; status: string; requester: CliDeviceRequester | null }> {
  const data = await request('GET', `/api/cli/device/${encodeURIComponent(code)}`);
  const rec = asRecord(data) ?? {};
  const requester = asRecord(rec.requester);
  const text = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value : null);
  return {
    user_code: readString(rec, 'user_code') || readString(rec, 'userCode') || code,
    status: readString(rec, 'status') || 'pending',
    requester: requester
      ? { ip: text(requester.ip), userAgent: text(requester.user_agent), createdAt: text(requester.created_at) }
      : null,
  };
}

/**
 * POST /api/cli/device/:code/approve. The typed code must match the path.
 */
export async function approveCliDevice(code: string): Promise<void> {
  const trimmed = code.trim();
  await request('POST', `/api/cli/device/${encodeURIComponent(trimmed)}/approve`, {
    user_code: trimmed,
  });
}

/**
 * POST /api/contact after the caller has obtained a CSRF token.
 */
export async function submitContact(body: ContactBody): Promise<void> {
  await request('POST', '/api/contact', body);
}
