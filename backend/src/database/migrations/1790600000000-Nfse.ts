import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tabelas do emissor de NFS-e Nacional (port da migration 034_nfse.sql do faelith). */
export class Nfse1790600000000 implements MigrationInterface {
  name = 'Nfse1790600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "nfse_documents" (
      "id" uuid PRIMARY KEY,
      "source_id" text NOT NULL UNIQUE,
      "payment_id" text,
      "user_id" uuid,
      "customer_id" text,
      "status" text NOT NULL,
      "attempts" integer NOT NULL DEFAULT 0,
      "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
      "last_error" text,
      "series" integer NOT NULL,
      "number" bigint,
      "dps_id" text,
      "access_key" text,
      "nfse_number" text,
      "amount_usd_cents" bigint NOT NULL DEFAULT 0,
      "amount_brl_cents" bigint,
      "ptax_rate" double precision,
      "ptax_date" date,
      "paid_at" timestamptz NOT NULL,
      "buyer" jsonb NOT NULL DEFAULT '{}',
      "description" text NOT NULL DEFAULT '',
      "dps_xml" text,
      "nfse_xml" text,
      "cancel_reason" text,
      "cancel_xml" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "issued_at" timestamptz,
      "canceled_at" timestamptz,
      CONSTRAINT "nfse_series_number_unique" UNIQUE ("series", "number")
    )`);
    await q.query(`CREATE INDEX "nfse_documents_due" ON "nfse_documents" ("next_attempt_at") WHERE status IN ('queued', 'cancel_queued')`);
    await q.query(`CREATE INDEX "nfse_documents_payment" ON "nfse_documents" ("payment_id")`);
    await q.query(`CREATE INDEX "nfse_documents_user" ON "nfse_documents" ("user_id", "created_at" DESC)`);
    await q.query(`CREATE INDEX "nfse_documents_customer_pending" ON "nfse_documents" ("customer_id") WHERE status = 'pending_data'`);
    await q.query(`CREATE TABLE "nfse_series" ("series" integer PRIMARY KEY, "last_number" bigint NOT NULL)`);
    await q.query(`CREATE TABLE "fiscal_identities" (
      "customer_id" text PRIMARY KEY,
      "user_id" uuid,
      "doc_type" text NOT NULL CHECK ("doc_type" IN ('cpf', 'cnpj', 'nif')),
      "doc_number" text NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "fiscal_identities"`);
    await q.query(`DROP TABLE "nfse_series"`);
    await q.query(`DROP TABLE "nfse_documents"`);
  }
}
