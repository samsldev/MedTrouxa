import { createHmac } from 'crypto';
import { MercadoPago } from '../billing/mercadopago';
import { LIMITS } from '../billing/entitlements';
import { planById, PLANS } from '../billing/plans';
import { sm2 } from '../flashcards/sm2';
import { likeEscape } from '../questions/questions.module';
import { maskEmail } from './logging';
import { passwordProblem, verifyPassword, hashPassword } from './password';

describe('política de senha', () => {
  it('rejeita senhas fracas', () => {
    expect(passwordProblem('curta1')).toMatch(/8 caracteres/);
    expect(passwordProblem('somenteletras')).toMatch(/letras e números/);
    expect(passwordProblem('12345678a'.replace('a', ''))).toBeTruthy();
    expect(passwordProblem('senha123')).toBeTruthy(); // comum
    expect(passwordProblem('harry2026x', 'harry@hogwarts.dev')).toMatch(/e-mail/);
    expect(passwordProblem('x'.repeat(70) + 'é1')).toMatch(/72 bytes/);
  });
  it('aceita senha forte', () => expect(passwordProblem('Varinha-de-Sabugueiro-7')).toBeNull());
  it('hash e verificação', async () => {
    const h = await hashPassword('Correta-123');
    expect(h.startsWith('$2')).toBe(true);
    expect(await verifyPassword('Correta-123', h)).toBe(true);
    expect(await verifyPassword('Errada-123', h)).toBe(false);
    expect(await verifyPassword('qualquer', undefined)).toBe(false); // usuário inexistente
  }, 20000);
});

describe('webhook Mercado Pago', () => {
  const secret = 'segredo-de-teste';
  const mp = new MercadoPago('token', secret);
  const sign = (id: string, rid: string, ts: string) =>
    `ts=${ts},v1=${createHmac('sha256', secret).update(`id:${id};request-id:${rid};ts:${ts};`).digest('hex')}`;
  it('aceita assinatura válida', () => {
    const ts = String(Date.now());
    expect(mp.verifySignature(sign('123', 'req-1', ts), 'req-1', '123')).toBe(true);
  });
  it('rejeita assinatura adulterada, de outro id, ausente ou antiga (replay)', () => {
    const ts = String(Date.now());
    expect(mp.verifySignature(sign('123', 'req-1', ts), 'req-1', '999')).toBe(false);
    expect(mp.verifySignature(sign('123', 'req-1', ts).replace(/.$/, '0'), 'req-1', '123')).toBe(false);
    expect(mp.verifySignature(undefined, 'req-1', '123')).toBe(false);
    const old = String(Date.now() - 60 * 60 * 1000);
    expect(mp.verifySignature(sign('123', 'req-1', old), 'req-1', '123')).toBe(false);
  });
  it('sem segredo configurado, nunca aceita', () => {
    expect(new MercadoPago('t', '').verifySignature('ts=1,v1=aa', 'r', '1')).toBe(false);
  });
});

describe('planos e acesso', () => {
  it('parcelado = 12 × parcela; Arcano custa menos que 6 anos de Alquimista', () => {
    for (const p of PLANS) expect(p.installmentPrice * 12).toBeGreaterThanOrEqual(p.cashPrice);
    expect(planById('arcano')!.cashPrice).toBeLessThan(planById('alquimista')!.cashPrice * 6);
  });
  it('plano gratuito é limitado; pagos liberam recursos', () => {
    expect(LIMITS.free).toMatchObject({ answersPerDay: 20, exams: false, studyPlans: false, aiPerHour: 0 });
    expect(LIMITS.aprendiz.exams).toBe(true);
    expect(LIMITS.aprendiz.studyPlans).toBe(false);
    expect(LIMITS.alquimista.studyPlans).toBe(true);
  });
});

describe('utilitários', () => {
  it('SM-2: erro volta em minutos; acertos espaçam', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(sm2({ ease: 2.5, interval: 0, repetitions: 0 }, 0, now).interval).toBe(0);
    const r1 = sm2({ ease: 2.5, interval: 0, repetitions: 0 }, 4, now);
    const r2 = sm2(r1, 4, now);
    const r3 = sm2(r2, 5, now);
    expect([r1.interval, r2.interval]).toEqual([1, 6]);
    expect(r3.interval).toBeGreaterThan(6);
    expect(sm2({ ease: 1.3, interval: 1, repetitions: 1 }, 3, now).ease).toBeGreaterThanOrEqual(1.3);
  });
  it('escapa curingas do LIKE', () => expect(likeEscape('100%_a\\b')).toBe('100\\%\\_a\\\\b'));
  it('mascara e-mail em logs', () => expect(maskEmail('hermione@hogwarts.dev')).toBe('h***@hogwarts.dev'));
});
