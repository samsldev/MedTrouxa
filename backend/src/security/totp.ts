import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/** TOTP (RFC 6238) / HOTP (RFC 4226), compatível com Google Authenticator, Authy, 1Password, Microsoft Authenticator. */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0, value = 0; const out: number[] = [];
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error('base32 inválido');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** Segredo de 160 bits (recomendação da RFC 4226) */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const STEP = 30;
export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP);

/**
 * Verifica o código aceitando ±1 janela (tolerância de relógio).
 * Retorna o passo (step) usado, para o chamador impedir reuso do mesmo código (anti-replay), ou null.
 */
export function verifyTotp(secretB32: string, code: string, now = Date.now(), window = 1): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secretB32);
  const step = currentStep(now);
  for (let w = -window; w <= window; w++) {
    const expected = Buffer.from(hotp(key, step + w));
    if (timingSafeEqual(expected, Buffer.from(code))) return step + w;
  }
  return null;
}

export const otpauthUrl = (secretB32: string, account: string, issuer = 'MedTrouxa') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;
