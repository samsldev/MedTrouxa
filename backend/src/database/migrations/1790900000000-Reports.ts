import { MigrationInterface, QueryRunner } from 'typeorm';

/** Denúncias de conteúdo (respostas da IA e nomes no ranking) — exigência das lojas para conteúdo gerado. */
export class Reports1790900000000 implements MigrationInterface {
  name = 'Reports1790900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE content_reports (
      id bigserial PRIMARY KEY,
      reporter_id uuid NOT NULL,
      kind text NOT NULL CHECK (kind IN ('ai_reply', 'ranking_name')),
      target_user uuid,
      content text NOT NULL,
      reason text NOT NULL,
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'resolved')),
      resolved_by text,
      resolved_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX content_reports_open ON content_reports (created_at DESC) WHERE status = 'open'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE content_reports`);
  }
}
