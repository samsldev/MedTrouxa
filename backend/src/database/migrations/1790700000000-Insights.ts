import { MigrationInterface, QueryRunner } from 'typeorm';

/** Rastreador de marketing, auditoria de admin, suspensão de contas e atribuição de assinaturas (port do faelith). */
export class Insights1790700000000 implements MigrationInterface {
  name = 'Insights1790700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "analytics_pageviews" (
      "id" uuid PRIMARY KEY,
      "visitor_id" uuid,
      "session_id" uuid,
      "user_id" uuid,
      "path" text NOT NULL,
      "referrer" text,
      "utm_source" text, "utm_medium" text, "utm_campaign" text, "utm_content" text, "utm_term" text,
      "lp" text,
      "device" text NOT NULL,
      "lang" text,
      "viewport_w" integer NOT NULL DEFAULT 0,
      "viewport_h" integer NOT NULL DEFAULT 0,
      "doc_h" integer NOT NULL DEFAULT 0,
      "started_at" timestamptz NOT NULL,
      "last_seen_at" timestamptz NOT NULL,
      "active_ms" bigint NOT NULL DEFAULT 0,
      "max_scroll" smallint NOT NULL DEFAULT 0,
      "attention" bigint[] NOT NULL,
      "clicks" integer NOT NULL DEFAULT 0
    )`);
    await q.query(`CREATE INDEX "analytics_pageviews_started" ON "analytics_pageviews" ("started_at" DESC)`);
    await q.query(`CREATE INDEX "analytics_pageviews_visitor" ON "analytics_pageviews" ("visitor_id", "started_at" DESC) WHERE visitor_id IS NOT NULL`);
    await q.query(`CREATE TABLE "analytics_clicks" (
      "id" bigserial PRIMARY KEY,
      "pageview_id" uuid NOT NULL,
      "path" text NOT NULL,
      "device" text NOT NULL,
      "x_pct" real NOT NULL,
      "y_pct" real NOT NULL,
      "label" text NOT NULL DEFAULT '',
      "at" timestamptz NOT NULL
    )`);
    await q.query(`CREATE INDEX "analytics_clicks_path" ON "analytics_clicks" ("path", "at" DESC)`);
    await q.query(`CREATE INDEX "analytics_clicks_pageview" ON "analytics_clicks" ("pageview_id")`);
    await q.query(`CREATE INDEX "analytics_clicks_label" ON "analytics_clicks" ("label" text_pattern_ops, "at")`);
    await q.query(`CREATE TABLE "admin_audit" (
      "id" bigserial PRIMARY KEY,
      "admin_email" text NOT NULL,
      "action" text NOT NULL,
      "target_user" uuid,
      "detail" jsonb NOT NULL DEFAULT '{}',
      "at" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX "admin_audit_at" ON "admin_audit" ("at" DESC)`);
    await q.query(`ALTER TABLE "users" ADD "suspendedAt" TIMESTAMP WITH TIME ZONE`);
    await q.query(`ALTER TABLE "users" ADD "suspendReason" text`);
    await q.query(`ALTER TABLE "subscriptions" ADD "canceledAt" TIMESTAMP WITH TIME ZONE`);
    await q.query(`ALTER TABLE "subscriptions" ADD "grantedBy" text`);
    await q.query(`ALTER TABLE "subscriptions" ADD "utmSource" text`);
    await q.query(`ALTER TABLE "subscriptions" ADD "utmMedium" text`);
    await q.query(`ALTER TABLE "subscriptions" ADD "utmCampaign" text`);
    await q.query(`ALTER TABLE "subscriptions" ADD "lp" text`);
    await q.query(`CREATE INDEX "subscriptions_created" ON "subscriptions" ("createdAt")`);
    await q.query(`CREATE INDEX "answers_created" ON "answers" ("createdAt")`);
    await q.query(`CREATE INDEX "users_created" ON "users" ("createdAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "users_created"`);
    await q.query(`DROP INDEX "answers_created"`);
    await q.query(`DROP INDEX "subscriptions_created"`);
    for (const c of ['lp', 'utmCampaign', 'utmMedium', 'utmSource', 'grantedBy', 'canceledAt']) await q.query(`ALTER TABLE "subscriptions" DROP COLUMN "${c}"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN "suspendReason"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN "suspendedAt"`);
    await q.query(`DROP TABLE "admin_audit"`);
    await q.query(`DROP TABLE "analytics_clicks"`);
    await q.query(`DROP TABLE "analytics_pageviews"`);
  }
}
