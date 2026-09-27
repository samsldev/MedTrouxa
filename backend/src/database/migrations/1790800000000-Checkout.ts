import { MigrationInterface, QueryRunner } from 'typeorm';

/** Checkout próprio: cupons de desconto, dados do Pix e motivo de recusa do pagamento. */
export class Checkout1790800000000 implements MigrationInterface {
  name = 'Checkout1790800000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE coupons (
      code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{3,32}$'),
      percent_off int NOT NULL CHECK (percent_off BETWEEN 1 AND 90),
      plan_ids text[],
      max_redemptions int CHECK (max_redemptions IS NULL OR max_redemptions > 0),
      expires_at timestamptz,
      active boolean NOT NULL DEFAULT true,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`ALTER TABLE subscriptions
      ADD "couponCode" text, ADD "discount" int NOT NULL DEFAULT 0, ADD "statusDetail" text,
      ADD "pixQrCode" text, ADD "pixQrBase64" text, ADD "pixTicketUrl" text, ADD "pixExpiresAt" timestamptz`);
    await q.query(`CREATE INDEX subscriptions_coupon ON subscriptions ("couponCode") WHERE "couponCode" IS NOT NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX subscriptions_coupon`);
    await q.query(`ALTER TABLE subscriptions DROP "couponCode", DROP "discount", DROP "statusDetail", DROP "pixQrCode", DROP "pixQrBase64", DROP "pixTicketUrl", DROP "pixExpiresAt"`);
    await q.query(`DROP TABLE coupons`);
  }
}
