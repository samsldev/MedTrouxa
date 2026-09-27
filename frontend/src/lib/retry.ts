/**
 * Busca com novas tentativas (1s, 3s, 10s, 30s): uma falha passageira da API não deixa seções da página vazias.
 * Devolve a função de limpeza para usar direto no useEffect.
 */
export function retrying<T>(load: () => Promise<T>, onData: (d: T) => unknown, delays = [1000, 3000, 10000, 30000]): () => void {
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const attempt = (n: number) => {
    load().then((d) => { if (alive) onData(d); }).catch(() => {
      if (alive && n < delays.length) timer = setTimeout(() => attempt(n + 1), delays[n]);
    });
  };
  attempt(0);
  return () => { alive = false; clearTimeout(timer); };
}
