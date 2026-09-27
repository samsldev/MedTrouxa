export interface Plan {
  id: 'aprendiz' | 'alquimista' | 'arcano';
  name: string; tagline: string; badge?: string;
  cashPrice: number; installmentPrice: number; maxInstallments: number; accessYears: number; features: string[];
}

export const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Total no cartão parcelado (2x–12x): 12 × parcela anunciada */
export const installmentTotal = (p: Plan) => p.installmentPrice * p.maxInstallments;

export const totalFor = (p: Plan, n: number) => (n === 1 ? p.cashPrice : installmentTotal(p));
