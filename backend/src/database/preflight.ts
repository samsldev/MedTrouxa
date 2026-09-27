import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

/**
 * Checagem antes de aplicar as migrations.
 * Um banco criado pelo antigo modo "sincronizar" (DB_SYNC, removido) tem as tabelas mas não o histórico de migrations:
 * a primeira migration falharia com "relation already exists" e o TypeORM ficaria tentando para sempre, sem a API subir.
 * Aqui paramos com uma mensagem clara. Também espera o banco ficar acessível (Pgpool pode demorar no primeiro boot).
 */
export async function databasePreflight(): Promise<void> {
  const log = new Logger('Banco');
  const ds = new DataSource({ ...dataSourceOptions(), migrationsRun: false, entities: [], migrations: [] });
  for (let attempt = 1; ; attempt++) {
    try { await ds.initialize(); break; } catch (e) {
      if (attempt >= 30) { log.error(`Banco inacessível após ${attempt} tentativas: ${(e as Error).message}`); process.exit(1); }
      log.warn(`Aguardando o banco (${attempt}/30): ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  try {
    const [{ users, migrations }] = await ds.query(`SELECT to_regclass('public.users') IS NOT NULL AS users, to_regclass('public.migrations') IS NOT NULL AS migrations`);
    const applied = migrations ? Number((await ds.query(`SELECT count(*)::int AS n FROM migrations`))[0].n) : 0;
    if (users && applied === 0) {
      log.error([
        'Este banco foi criado pelo antigo modo de sincronização e não tem histórico de migrations.',
        'Aplicar as migrations nele falharia. Use um banco novo:',
        '  • Desenvolvimento: .\\scripts\\dev.ps1 reset   (ou: docker compose down -v)',
        '  • Produção: aponte DB_NAME para um banco vazio, ou restaure um backup feito por uma versão com migrations.',
      ].join('\n'));
      process.exit(1);
    }
  } finally {
    await ds.destroy().catch(() => undefined);
  }
}
