import * as bcrypt from 'bcryptjs';

export const BCRYPT_COST = 12;

/** Senhas mais comuns em vazamentos (amostra). Bloqueadas no cadastro/troca. */
const COMMON = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'senha123', 'senha1234', 'qwerty123', 'abcd1234',
  '11111111', '00000000', 'iloveyou', 'admin123', 'medicina', 'medicina123', 'brasil123', 'mudar123', 'q1w2e3r4',
]);

/** Política de senha (OWASP ASVS 2.1): 8–72 caracteres, letras e números, fora das mais comuns. */
export function passwordProblem(pw: string, email?: string): string | null {
  if (pw.length < 8) return 'A senha deve ter pelo menos 8 caracteres';
  if (Buffer.byteLength(pw, 'utf8') > 72) return 'A senha deve ter no máximo 72 bytes';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'A senha deve conter letras e números';
  if (COMMON.has(pw.toLowerCase())) return 'Essa senha é muito comum; escolha outra';
  if (email && pw.toLowerCase().includes(email.split('@')[0].toLowerCase())) return 'A senha não pode conter seu e-mail';
  return null;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_COST);

/** Hash fixo para comparar quando o usuário não existe: iguala o tempo de resposta (evita enumeração por timing). */
const DUMMY = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5Xb1Gm2Qd8r7tQJpC8GJx1c5oYz3u9e';
export const verifyPassword = (pw: string, hash?: string | null) => bcrypt.compare(pw, hash ?? DUMMY);
