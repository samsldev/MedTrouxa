import { decrypt, encrypt } from './crypto';
import { generateRecoveryCodes, normalizeRecovery } from './otp';
import { base32Decode, base32Encode, generateTotpSecret, hotp, otpauthUrl, verifyTotp } from './totp';

describe('TOTP (RFC 6238)', () => {
  // Vetores oficiais da RFC 6238, apêndice B (SHA-1, segredo "12345678901234567890"), truncados em 6 dígitos
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  const vectors: [number, string][] = [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037']];

  it.each(vectors)('t=%i -> %s', (t, code) => {
    expect(hotp(base32Decode(secret), Math.floor(t / 30))).toBe(code);
    expect(verifyTotp(secret, code, t * 1000)).not.toBeNull();
  });

  it('aceita ±1 janela e rejeita fora dela ou formato inválido', () => {
    const now = 1_700_000_000_000;
    const code = hotp(base32Decode(secret), Math.floor(now / 1000 / 30) - 1);
    expect(verifyTotp(secret, code, now)).not.toBeNull();
    const old = hotp(base32Decode(secret), Math.floor(now / 1000 / 30) - 3);
    expect(verifyTotp(secret, old, now)).toBeNull();
    expect(verifyTotp(secret, '12345', now)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', now)).toBeNull();
  });

  it('base32 ida e volta; segredo de 160 bits; URL otpauth', () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(otpauthUrl(s, 'ana@x.dev')).toMatch(/^otpauth:\/\/totp\/MedTrouxa:ana%40x\.dev\?secret=[A-Z2-7]+&issuer=MedTrouxa/);
  });
});

describe('segredos e códigos de recuperação', () => {
  it('AES-256-GCM: cifra, decifra e detecta adulteração', () => {
    const c = encrypt('JBSWY3DPEHPK3PXP');
    expect(c).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decrypt(c)).toBe('JBSWY3DPEHPK3PXP');
    const parts = c.split(':'); parts[3] = Buffer.from('xxxx').toString('base64');
    expect(() => decrypt(parts.join(':'))).toThrow();
  });
  it('10 códigos únicos no formato xxxx-xxxx; normalização tolera maiúsculas e espaços', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    codes.forEach((c) => expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/));
    expect(normalizeRecovery(' AB2C D3EF ')).toBe('ab2c-d3ef');
  });
});
