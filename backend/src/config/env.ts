/**
 * Validação das variáveis de ambiente no boot (OWASP A05 — Security Misconfiguration).
 * Em produção, a aplicação NÃO sobe com segredos fracos, senhas padrão ou opções inseguras.
 */
export const isProd = () => process.env.NODE_ENV === 'production';

const WEAK = new Set(['', 'x', 'dev-secret', 'troque-este-segredo', 'medtrouxa', 'adminpass', 'repmgrpass', 'pgpooladmin', 'changeme', 'password', 'secret']);

export function validateEnv() {
  const errors: string[] = [];
  const req = (k: string) => { if (!process.env[k]) errors.push(`${k} é obrigatório`); };
  const strong = (k: string, min: number) => {
    const v = process.env[k] ?? '';
    if (v.length < min || WEAK.has(v)) errors.push(`${k} deve ser forte (mínimo ${min} caracteres, não pode ser um valor padrão)`);
  };

  if (isProd()) {
    strong('JWT_SECRET', 32);
    strong('DB_PASSWORD', 16);
    req('APP_URL');
    req('REDIS_URL');
    if (!/^rediss?:\/\/[^@]*:[^@]+@/.test(process.env.REDIS_URL ?? '')) errors.push('REDIS_URL deve conter senha (redis://:SENHA@host:6379)');
    if (process.env.DB_SYNC === 'true') errors.push('DB_SYNC=true é proibido em produção (use migrations)');
    if (process.env.DEMO_CONTENT === 'true') console.warn('[env] DEMO_CONTENT ignorado em produção');
    if ((process.env.PAYMENT_PROVIDER ?? 'fake') === 'fake') errors.push('PAYMENT_PROVIDER=fake é proibido em produção (use mercadopago)');
    if (process.env.PAYMENT_PROVIDER === 'mercadopago') { req('MP_ACCESS_TOKEN'); req('MP_WEBHOOK_SECRET'); }
    if (!process.env.SMTP_URL) errors.push('SMTP_URL é obrigatório em produção (e-mails de recuperação de senha)');
  } else if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'dev-only-secret-not-for-production-use-000';
  }

  if (errors.length) {
    console.error(`\n[env] Configuração insegura/incompleta:\n - ${errors.join('\n - ')}\n`);
    process.exit(1);
  }
}

export const appUrl = () => (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, '');
