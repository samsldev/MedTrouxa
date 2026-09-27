import { DataSource, DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';

/** Conecta no Pgpool-II, que roteia escritas ao primário e balanceia leituras nas réplicas. */
export const dataSourceOptions = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'medtrouxa',
  password: process.env.DB_PASSWORD ?? 'medtrouxa',
  database: process.env.DB_NAME ?? 'medtrouxa',
  entities: ENTITIES,
  // Dev e produção: o schema só muda por migrations versionadas (nunca synchronize).
  // Um caminho só evita bancos criados "por sincronização" que depois quebram ao aplicar as migrations.
  synchronize: false,
  migrations: [__dirname + '/migrations/*.js'],
  migrationsRun: true,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_INSECURE !== 'true' } : undefined,
  extra: { max: 20, connectionTimeoutMillis: 5000, statement_timeout: 15000 },
  logging: ['error'],
});

/** Usado pela CLI do TypeORM (npm run migration:generate / migration:run) */
export default new DataSource(dataSourceOptions());
