import type { Request } from 'express';
import { isMobileClient } from './auth.module';

const req = (headers: Record<string, string>) => ({ headers }) as unknown as Request;

describe('sessão de app nativo', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = env; });

  it('app nativo (sem Origin) usa refresh token no corpo', () => {
    process.env.NODE_ENV = 'production';
    expect(isMobileClient(req({ 'x-client': 'mobile' }))).toBe(true);
  });
  it('em produção, página web não consegue se passar por app para fugir do cookie httpOnly', () => {
    process.env.NODE_ENV = 'production';
    expect(isMobileClient(req({ 'x-client': 'mobile', origin: 'https://evil.example' }))).toBe(false);
  });
  it('sem o cabeçalho, segue o fluxo web (cookie)', () => {
    expect(isMobileClient(req({}))).toBe(false);
    expect(isMobileClient(undefined)).toBe(false);
  });
});
