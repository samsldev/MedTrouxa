import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities';
import { RedisService } from '../redis/redis.module';
import { decrypt, sha256 } from './crypto';
import { normalizeRecovery, OtpService } from './otp';
import { verifyTotp } from './totp';

export type MfaMethod = 'totp' | 'email' | 'recovery';

@Injectable()
export class TwoFactorService {
  constructor(@InjectRepository(User) private users: Repository<User>, private redis: RedisService, private otp: OtpService) {}

  /** TOTP com proteção contra reuso do mesmo código (anti-replay por janela de 30 s). */
  async checkTotp(uid: string, secretB32: string, code: string): Promise<boolean> {
    const step = verifyTotp(secretB32, code);
    if (step === null) return false;
    const key = `totp-used:${uid}`;
    const last = Number(await this.redis.client.get(key)) || 0;
    if (step <= last) return false;
    await this.redis.client.set(key, String(step), 'EX', 120);
    return true;
  }

  /** Verifica o segundo fator do usuário. `challenge` é necessário para o método por e-mail. */
  async verify(uid: string, method: MfaMethod, code: string, challenge?: string): Promise<boolean> {
    const u = await this.users.findOne({ where: { id: uid }, select: ['id', 'twoFactorMethod', 'totpSecretEnc', 'recoveryCodes'] });
    if (!u?.twoFactorMethod) return false;
    if (method === 'recovery') {
      const h = sha256(normalizeRecovery(code));
      const list = u.recoveryCodes ?? [];
      if (!list.includes(h)) return false;
      await this.users.update(uid, { recoveryCodes: list.filter((x) => x !== h) }); // uso único
      return true;
    }
    if (method === 'totp' && u.twoFactorMethod === 'totp' && u.totpSecretEnc) {
      return this.checkTotp(uid, decrypt(u.totpSecretEnc), code.replace(/\s/g, ''));
    }
    if (method === 'email' && u.twoFactorMethod === 'email' && challenge) {
      return this.otp.checkEmailCode(challenge, code.replace(/\s/g, ''));
    }
    return false;
  }

  async recoveryLeft(uid: string) {
    const u = await this.users.findOne({ where: { id: uid }, select: ['id', 'recoveryCodes'] });
    return u?.recoveryCodes?.length ?? 0;
  }
}
