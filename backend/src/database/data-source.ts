import { DataSourceOptions } from 'typeorm';
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
  synchronize: process.env.DB_SYNC === 'true',
  extra: { max: 20, connectionTimeoutMillis: 5000 },
});
