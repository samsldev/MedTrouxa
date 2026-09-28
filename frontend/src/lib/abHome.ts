/**
 * Teste A/B da página inicial: metade dos visitantes vê a versão atual ("escura"), metade a "clara".
 * O sorteio acontece na primeira visita e fica guardado no navegador, para a pessoa não alternar a cada recarga.
 * Para forçar uma versão (conferir/compartilhar): /?v=clara ou /?v=escura (também passa a ser a versão guardada).
 * A variação vai para o analytics como `lp` (home-escura / home-clara), então dá para comparar as duas no console.
 */
export type HomeVariant = 'escura' | 'clara';

const KEY = 'mt.ab.home';
const VARIANTS: HomeVariant[] = ['escura', 'clara'];
const isVariant = (v: string | null): v is HomeVariant => VARIANTS.includes(v as HomeVariant);

export function homeVariant(search = window.location.search): HomeVariant {
  const forced = new URLSearchParams(search).get('v');
  let saved: string | null = null;
  try { saved = window.localStorage.getItem(KEY); } catch { /* storage bloqueado: sorteia a cada visita */ }
  const variant: HomeVariant = isVariant(forced) ? forced : isVariant(saved) ? saved : Math.random() < 0.5 ? 'escura' : 'clara';
  try { window.localStorage.setItem(KEY, variant); } catch { /* ignora */ }
  return variant;
}
