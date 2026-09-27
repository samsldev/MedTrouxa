import { hasProfanity } from './profanity';

describe('filtro de termos ofensivos (nomes públicos no ranking)', () => {
  it('barra ofensas, inclusive disfarçadas', () => {
    for (const t of ['Puta Silva', 'P u t a', 'p.u.t.a', 'Viad0 Souza', 'CARALHO', 'Arrombado da Silva', 'Pinto Souza']) expect(hasProfanity(t)).toBe(true);
  });
  it('não barra nomes e faculdades legítimos', () => {
    for (const t of ['Maria Pinto', 'João Rola', 'Ana Macaco', 'Ciência da Computação', 'Desviado Santos', 'UNIFESP', 'Fotografia', 'José da Silva'])
      expect(hasProfanity(t)).toBe(false);
  });
});
