/**
 * Algoritmo SM-2 (SuperMemo 2) de repetição espaçada.
 * grade: 0 = errei feio, 3 = difícil, 4 = bom, 5 = fácil.
 */
export function sm2(prev: { ease: number; interval: number; repetitions: number }, grade: number, now = new Date()) {
  let { ease, interval, repetitions } = prev;
  if (grade < 3) {
    repetitions = 0;
    interval = 0; // revisa de novo ainda hoje (10 min)
  } else {
    repetitions += 1;
    interval = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(interval * ease);
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  const dueAt = new Date(now.getTime() + (interval === 0 ? 10 * 60_000 : interval * 86_400_000));
  return { ease: Number(ease.toFixed(2)), interval, repetitions, dueAt };
}
