import { DataSource } from 'typeorm';
import { Coupons, paymentMessage } from './coupons';

const fakeDb = (coupon: Record<string, unknown> | null, used = 0) =>
  ({ query: async (sql: string) => (sql.includes('FROM coupons WHERE code') ? (coupon ? [coupon] : []) : [{ n: used }]) }) as unknown as DataSource;
const base = { code: 'ENAMED10', percent_off: 10, plan_ids: null, max_redemptions: null, expires_at: null, active: true, created_by: 'a@b', created_at: new Date() };

describe('cupons', () => {
  it('aceita cupom válido, em minúsculas e com espaços', async () => {
    expect((await new Coupons(fakeDb(base)).resolve(' enamed10 ', 'arcano')).percentOff).toBe(10);
  });
  it('recusa inexistente, pausado, expirado, de outro plano e esgotado', async () => {
    await expect(new Coupons(fakeDb(null)).resolve('NADA', 'arcano')).rejects.toThrow('Cupom inválido');
    await expect(new Coupons(fakeDb({ ...base, active: false })).resolve('ENAMED10', 'arcano')).rejects.toThrow('Cupom inválido');
    await expect(new Coupons(fakeDb({ ...base, expires_at: new Date(Date.now() - 1000) })).resolve('ENAMED10', 'arcano')).rejects.toThrow('expirado');
    await expect(new Coupons(fakeDb({ ...base, plan_ids: ['aprendiz'] })).resolve('ENAMED10', 'arcano')).rejects.toThrow('não vale');
    await expect(new Coupons(fakeDb({ ...base, max_redemptions: 5 }, 5)).resolve('ENAMED10', 'arcano')).rejects.toThrow('esgotado');
  });
  it('rejeita códigos com caracteres fora do padrão sem consultar o banco', async () => {
    await expect(new Coupons(fakeDb(base)).resolve("x' OR 1=1", 'arcano')).rejects.toThrow('Cupom inválido');
  });
  it('traduz motivos de recusa do Mercado Pago', () => {
    expect(paymentMessage('cc_rejected_insufficient_amount')).toMatch(/Limite insuficiente/);
    expect(paymentMessage('algo_novo')).toMatch(/Não foi possível/);
  });
});
