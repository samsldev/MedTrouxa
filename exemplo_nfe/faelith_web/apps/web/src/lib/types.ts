/**
 * @fileoverview Shared domain unions and API payload types for the Faelith SPA.
 * @author Samuel S. L.
 * @version 1.16.0
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
 * - Mirrors gateway wire names for plans, key purpose, and OAuth
 * - Keeps response shapes tolerant of nested or flat JSON
 * - Avoids TypeScript enums to satisfy erasableSyntaxOnly
 */

export type PlanId = 'starter' | 'pro' | 'max' | 'ultra' | 'scale';
export type KeyPurpose = 'code' | 'chat' | 'api';
export type OAuthProvider = 'github' | 'google';
export type CheckoutKind = 'subscription' | 'credits' | 'credits_custom';
export type CreditPack = '10' | '50' | '100';
export type BillingInterval = 'monthly' | 'yearly';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  plan: PlanId | null;
  usageBased: boolean;
  githubLinked: boolean;
  googleLinked: boolean;
  /** Listed in ADMIN_EMAILS (the console still requires TOTP). */
  admin: boolean;
}

export interface MeterBar {
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
}

export interface OverviewResponse {
  plan: PlanId | null;
  usageBased: boolean;
  usage: UsageResponse | null;
  heatmap: HeatmapDay[];
}

/** Tokens used on one UTC day (`all` includes API keys). */
export interface HeatmapDay {
  date: string;
  all: number;
  chat: number;
  code: number;
}

export interface UsageResponse {
  plan: PlanId | null;
  code5h: MeterBar;
  codeWeekly: MeterBar;
  chat5h: MeterBar;
  chatWeekly: MeterBar;
  availableResets: number;
}

export interface ApiKeyRecord {
  prefix: string;
  purpose: KeyPurpose;
  createdAt: string | null;
}

export interface CreatedApiKey extends ApiKeyRecord {
  secret: string;
}

/** Token buckets of one request; `input` excludes cached tokens. */
export interface UsageTokens {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  total: number;
}

export interface UsageEvent {
  id: string;
  at: string | null;
  purpose: string;
  amountMicros: number;
  source: string;
  tokens: UsageTokens | null;
  /** `included` = plan allowance; `credits` = prepaid wallet (API keys, overage). */
  billing: 'included' | 'credits';
}

/** One paid Stripe invoice. */
export interface Invoice {
  id: string;
  number: string | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** Smallest currency unit (cents for USD). */
  amountPaid: number;
  currency: string;
  description: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

export interface SpendingResponse {
  walletMicros: number;
  plan: PlanId | null;
  events: UsageEvent[];
}

export interface BillingResponse {
  plan: PlanId | null;
  usageBased: boolean;
  /** ISO time until which a full refund can be requested; null when unavailable. */
  refundUntil: string | null;
}

export interface CheckoutBody {
  kind: CheckoutKind;
  plan?: PlanId;
  pack?: CreditPack;
  /** Subscription cadence. Omitted for credit packs. Backend defaults to monthly when absent. */
  interval?: BillingInterval;
  /** Custom top-up in US cents (`credits_custom`, minimum 500). */
  amount_cents?: number;
  /** `intro`: 50 percent off the first month (monthly, first subscription only). */
  offer?: 'intro';
  /** Campaign landing tag; a canceled checkout returns to the recapture offer. */
  lp?: string;
}

export interface UrlResponse {
  url: string;
}

export interface ContactBody {
  name: string;
  email: string;
  message: string;
  csrf: string;
}

/** Second-factor method offered on the challenge screen. */
export type MfaMethod = 'totp' | 'email' | 'backup';

/** Pending sign-in that passed the password (or OAuth) and awaits a second factor. */
export interface MfaChallenge {
  methods: MfaMethod[];
  emailHint: string;
  emailSent: boolean;
}

/** Password login either signs in directly or stops at a 2FA challenge. */
export type LoginResult =
  | { kind: 'session'; user: SessionUser | null }
  | { kind: 'mfa'; challenge: MfaChallenge };

/** Two-factor configuration shown in Settings. */
export interface SecurityStatus {
  totpEnabled: boolean;
  emailEnabled: boolean;
  mfaEnabled: boolean;
  backupCodesRemaining: number;
  /** Plaintext recovery codes, present only in the response that issued them. */
  backupCodes: string[] | null;
}

/** Authenticator enrollment payload (QR plus manual-entry secret). */
export interface TotpSetup {
  qr: string;
  secret: string;
  otpauthUrl: string;
}

/** Step-up proof required for security changes once 2FA is on. */
export interface MfaProof {
  method: MfaMethod;
  code: string;
}

/** Proof accepted by the server-side reauth gate (password only without 2FA). */
export type ReauthMethod = MfaMethod | 'password';

/** What the server asked for before a sensitive action. */
export interface ReauthRequirement {
  methods: ReauthMethod[];
  emailHint: string;
  /** Server message: a first prompt or the reason a previous proof failed. */
  message: string;
}

/** Proof sent back with the retried request. */
export interface ReauthProof {
  method: ReauthMethod;
  code: string;
}

/** Who started a pending CLI / desktop device login. */
export interface CliDeviceRequester {
  ip: string | null;
  userAgent: string | null;
  createdAt: string | null;
}
