import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Filtro de termos ofensivos para textos públicos (nome e faculdade aparecem no ranking).
 * Normaliza acentos, maiúsculas, "leetspeak" e separadores (p.u.t.a, pu7a, P U T A).
 * Complementa a denúncia no app (App Store 1.2 / Google Play: conteúdo gerado por usuários).
 */
const TERMS = [
  'porra', 'caralho', 'buceta', 'boceta', 'xoxota', 'puta', 'puto', 'putinha', 'foder', 'fuder', 'fodase', 'foda', 'cuzao', 'cuzinho',
  'arrombado', 'arrombada', 'viado', 'viadinho', 'bicha', 'sapatao', 'traveco', 'macaco', 'crioulo', 'vagabunda', 'vagabundo',
  'piranha', 'rapariga', 'babaca', 'otario', 'otaria', 'retardado', 'retardada', 'mongoloide', 'cacete', 'pinto', 'pica', 'rola',
  'punheta', 'siririca', 'estupro', 'estuprador', 'nazista', 'hitler', 'fuck', 'shit', 'bitch', 'nigger', 'nigga', 'faggot', 'cunt', 'dick', 'pussy',
];
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i' };
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[0134578@$!]/g, (c) => LEET[c] ?? c);

/** Sobrenomes reais no Brasil que também são gírias: aceitos fora da primeira palavra. */
const SURNAMES_OK = new Set(['pinto', 'rola', 'macaco']);

/** Palavras do texto, juntando letras soltas ("p u t a", "p.u.t.a" → "puta"). Só compara palavras inteiras: "Computação" não é barrada. */
function words(text: string): string[] {
  const raw = norm(text).split(/[^a-z]+/).filter(Boolean);
  const out: string[] = [];
  let run = '';
  for (const w of raw) {
    if (w.length === 1) { run += w; continue; }
    if (run) { out.push(run); run = ''; }
    out.push(w);
  }
  if (run) out.push(run);
  return out;
}

export function hasProfanity(text: string): boolean {
  const ws = words(text);
  return ws.some((w, i) => TERMS.includes(w) && !(i > 0 && SURNAMES_OK.has(w)));
}

/** Validador: rejeita textos com termos ofensivos. */
export function IsClean(options?: ValidationOptions) {
  return (object: object, propertyName: string) => registerDecorator({
    name: 'isClean', target: object.constructor, propertyName, options: { message: 'Use um texto sem termos ofensivos', ...options },
    validator: { validate: (v: unknown) => typeof v !== 'string' || !hasProfanity(v) },
  });
}
