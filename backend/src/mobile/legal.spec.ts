import { legalDoc } from './legal';

/** Regra das lojas (App Store 3.1.3(b), Google Play Payments): o texto mostrado no app não pode ter preço nem indicar como/onde comprar. */
const FORBIDDEN = /R\$|\b\d{1,2}x\b|mercado ?pago|\bassin(e|ar|atura)\b|comprar|checkout|\/planos|parcelad|à vista|pix/i;

describe('textos legais', () => {
  it('variante do app não menciona preço nem meio de compra', () => {
    for (const doc of ['termos', 'privacidade'] as const) {
      const text = legalDoc(doc, 'app').sections.flat().join(' ');
      expect(text).not.toMatch(FORBIDDEN);
    }
  });
  it('site mantém as condições comerciais completas', () => {
    expect(legalDoc('termos', 'web').sections.flat().join(' ')).toMatch(/12x/);
  });
  it('privacidade informa o envio à IA e a exclusão de conta', () => {
    const p = legalDoc('privacidade', 'app').sections.flat().join(' ');
    expect(p).toMatch(/Anthropic/);
    expect(p).toMatch(/excluir a conta|Ao excluir a conta/i);
  });
});
