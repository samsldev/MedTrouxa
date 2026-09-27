const only = (s: string) => s.replace(/\D/g, '');

export function validCpf(raw: string): boolean {
  const d = [...only(raw)].map(Number);
  if (d.length !== 11 || d.every((x) => x === d[0])) return false;
  const check = (len: number) => { const r = (d.slice(0, len).reduce((s, x, i) => s + x * (len + 1 - i), 0) * 10) % 11; return r === 10 ? 0 : r; };
  return check(9) === d[9] && check(10) === d[10];
}

export function validCnpj(raw: string): boolean {
  const d = [...only(raw)].map(Number);
  if (d.length !== 14 || d.every((x) => x === d[0])) return false;
  const check = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = d.slice(0, len).reduce((s, x, i) => s + x * w[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(12) === d[12] && check(13) === d[13];
}

/** CPF até 11 dígitos, CNPJ a partir de 12 — formatado enquanto digita. */
export function formatDoc(raw: string): { value: string; type: 'cpf' | 'cnpj' } {
  const d = only(raw).slice(0, 14);
  if (d.length <= 11) return { type: 'cpf', value: d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2') };
  return { type: 'cnpj', value: d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2') };
}

export function formatPhone(raw: string): string {
  const d = only(raw).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export const phoneOk = (raw: string) => { const d = only(raw); return d.length === 0 || d.length === 10 || d.length === 11; };
