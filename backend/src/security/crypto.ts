import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Criptografia de campos sensíveis em repouso (ex.: segredo TOTP) com AES-256-GCM.
 * Chave: ENCRYPTION_KEY (32 bytes em base64). Em dev, derivada do JWT_SECRET.
 */
function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, 'base64');
    if (k.length !== 32) throw new Error('ENCRYPTION_KEY deve ter 32 bytes em base64');
    return k;
  }
  return createHash('sha256').update(`dev-encryption:${process.env.JWT_SECRET ?? ''}`).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(':');
  if (v !== 'v1') throw new Error('formato de cifra desconhecido');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
