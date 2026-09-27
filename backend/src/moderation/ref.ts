import { createHmac } from 'crypto';

/** Referência opaca de um usuário no ranking (permite denunciar sem expor o id). */
export const rankingRef = (userId: string) => createHmac('sha256', process.env.JWT_SECRET ?? '').update(`ranking:${userId}`).digest('base64url').slice(0, 22);
