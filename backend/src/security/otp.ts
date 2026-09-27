import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { RedisService } from '../redis/redis.module';
import { sha256 } from './crypto';
import { MailService } from './mail';

export type ChallengePurpose = 'verify_email' | 'mfa' | 'setup_email_2fa' | 'confirm_2fa';

interface Challenge { uid: string; purpose: ChallengePurpose; attempts: number; sends: number }

const CHALLENGE_TTL = 15 * 60;
const CODE_TTL = 10 * 60;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 5;
const RESEND_COOLDOWN = 60;

const SUBJECTS: Record<ChallengePurpose, [string, string]> = {
  verify_email: ['Confirme seu e-mail', 'Use o código abaixo para confirmar seu e-mail e ativar sua conta no MedTrouxa.'],
  mfa: ['Seu código de acesso', 'Use o código abaixo para concluir sua entrada no MedTrouxa.'],
  setup_email_2fa: ['Ative a verificação em duas etapas', 'Use o código abaixo para ativar a verificação em duas etapas por e-mail.'],
  confirm_2fa: ['Confirme a alteração de segurança', 'Use o código abaixo para confirmar uma alteração nas configurações de segurança da sua conta.'],
};

export function codeEmail(name: string, code: string, purpose: ChallengePurpose) {
  const [title, lead] = SUBJECTS[purpose];
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const text = `Olá, ${name}.\n\n${lead}\n\nCódigo: ${spaced}\n\nEle expira em 10 minutos. Se não foi você, ignore este e-mail e considere trocar sua senha.\nNunca compartilhe este código — a equipe do MedTrouxa jamais vai pedi-lo.`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4efe4;font-family:Inter,Segoe UI,Arial,sans-serif;color:#15162c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border:1px solid #e8e1d2;border-radius:16px;overflow:hidden">
<tr><td style="background:#0e1030;padding:22px 28px;color:#f3ecdd;font-family:Georgia,serif;font-size:22px">Med<em style="color:#d4b06c">Trouxa</em></td></tr>
<tr><td style="padding:28px">
<h1 style="font-family:Georgia,serif;font-weight:500;font-size:26px;margin:0 0 12px">${title}</h1>
<p style="margin:0 0 20px;color:#6c6a7c;line-height:1.6">Olá, ${escapeHtml(name)}. ${lead}</p>
<div style="font-family:'Courier New',monospace;font-size:34px;letter-spacing:10px;font-weight:700;text-align:center;background:#f5eddd;border:1px solid #e3cf9f;border-radius:12px;padding:18px 0;color:#15162c">${spaced}</div>
<p style="margin:20px 0 0;font-size:13px;color:#6c6a7c;line-height:1.6">O código expira em 10 minutos. Se não foi você, ignore este e-mail e considere trocar sua senha.<br><strong>Nunca compartilhe este código.</strong> A equipe do MedTrouxa jamais vai pedi-lo.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject: `${spaced} é o seu código — ${title}`, text, html };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Desafios de verificação (token opaco) + códigos de 6 dígitos por e-mail, guardados apenas como hash. */
@Injectable()
export class OtpService {
  constructor(private redis: RedisService, private mail: MailService) {}

  async create(uid: string, purpose: ChallengePurpose): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const ch: Challenge = { uid, purpose, attempts: 0, sends: 0 };
    await this.redis.client.set(`ch:${sha256(token)}`, JSON.stringify(ch), 'EX', CHALLENGE_TTL);
    return token;
  }

  async get(token: string, purpose: ChallengePurpose | ChallengePurpose[]): Promise<Challenge> {
    const raw = typeof token === 'string' && token.length < 100 ? await this.redis.client.get(`ch:${sha256(token)}`) : null;
    const ch = raw ? (JSON.parse(raw) as Challenge) : null;
    const allowed = Array.isArray(purpose) ? purpose : [purpose];
    if (!ch || !allowed.includes(ch.purpose)) throw new UnauthorizedException('Verificação expirada. Comece novamente.');
    return ch;
  }

  /** Envia (ou reenvia) um código de 6 dígitos por e-mail, com espera entre envios e limite total. */
  async sendCode(token: string, to: { email: string; name: string }, opts: { cooldown?: boolean } = {}) {
    const h = sha256(token);
    const ch = await this.get(token, ['verify_email', 'mfa', 'setup_email_2fa', 'confirm_2fa']);
    // Todo envio inicia a espera; só o reenvio pedido pelo usuário é barrado por ela
    const ok = await this.redis.client.set(`cd:${h}`, '1', 'EX', RESEND_COOLDOWN, 'NX');
    if (!ok && opts.cooldown !== false) {
      throw new HttpException(`Aguarde ${RESEND_COOLDOWN} segundos para pedir um novo código.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (ch.sends >= MAX_SENDS) throw new HttpException('Limite de envios atingido. Comece novamente.', HttpStatus.TOO_MANY_REQUESTS);
    ch.sends += 1;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const ttl = await this.redis.client.ttl(`ch:${h}`);
    await this.redis.client.multi()
      .set(`ch:${h}`, JSON.stringify(ch), 'EX', Math.max(ttl, 60))
      .set(`code:${h}`, sha256(`${h}:${code}`), 'EX', CODE_TTL)
      .exec();
    const mail = codeEmail(to.name, code, ch.purpose);
    await this.mail.send(to.email, mail.subject, mail.text, mail.html);
  }

  /** Confere o código do e-mail. Cada erro consome uma tentativa; esgotadas, o desafio é invalidado. */
  async checkEmailCode(token: string, code: string): Promise<boolean> {
    const h = sha256(token);
    const stored = await this.redis.client.get(`code:${h}`);
    const ok = !!stored && /^\d{6}$/.test(code) &&
      timingSafeEqual(Buffer.from(stored), Buffer.from(sha256(`${h}:${code}`)));
    if (ok) await this.redis.client.del(`code:${h}`);
    return ok;
  }

  /** Registra uma tentativa falha; lança erro amigável. */
  async fail(token: string): Promise<never> {
    const h = sha256(token);
    const raw = await this.redis.client.get(`ch:${h}`);
    if (raw) {
      const ch = JSON.parse(raw) as Challenge;
      ch.attempts += 1;
      if (ch.attempts >= MAX_ATTEMPTS) {
        await this.redis.client.del(`ch:${h}`, `code:${h}`);
        throw new UnauthorizedException('Muitas tentativas incorretas. Comece novamente.');
      }
      const ttl = await this.redis.client.ttl(`ch:${h}`);
      await this.redis.client.set(`ch:${h}`, JSON.stringify(ch), 'EX', Math.max(ttl, 1));
      throw new BadRequestException(`Código incorreto. Restam ${MAX_ATTEMPTS - ch.attempts} tentativas.`);
    }
    throw new UnauthorizedException('Verificação expirada. Comece novamente.');
  }

  consume(token: string) {
    const h = sha256(token);
    return this.redis.client.del(`ch:${h}`, `code:${h}`, `cd:${h}`);
  }
}

/** 10 códigos de recuperação de uso único, formato xxxx-xxxx (sem caracteres ambíguos). */
export function generateRecoveryCodes(n = 10): string[] {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: n }, () => {
    const s = Array.from({ length: 8 }, () => alphabet[randomInt(0, alphabet.length)]).join('');
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}
export const normalizeRecovery = (c: string) => c.trim().toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2');
