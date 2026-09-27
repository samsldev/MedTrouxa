/**
 * MercadoPago.js v2 (campos seguros). O número, a validade e o CVV ficam em iframes do Mercado Pago:
 * nosso código só recebe um token de uso único (PCI DSS SAQ A).
 */
export interface MpField { mount(id: string): MpField; unmount(): void; on(ev: string, cb: (e: any) => void): void; update(o: unknown): void }
export interface MpInstance {
  fields: {
    create(type: 'cardNumber' | 'expirationDate' | 'securityCode', opts: Record<string, unknown>): MpField;
    createCardToken(o: { cardholderName: string; identificationType: string; identificationNumber: string }): Promise<{ id: string }>;
  };
  getPaymentMethods(o: { bin: string }): Promise<{ results: { id: string; name: string; thumbnail?: string; settings: { card_number: unknown; security_code: unknown }[]; issuer?: { id: number } }[] }>;
  getIssuers(o: { paymentMethodId: string; bin: string }): Promise<{ id: number; name: string }[]>;
}
declare global { interface Window { MercadoPago?: new (key: string, o: { locale: string }) => MpInstance; MP_DEVICE_SESSION_ID?: string } }

function script(src: string, attrs: Record<string, string> = {}) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Não foi possível carregar o pagamento seguro. Verifique sua conexão.'));
    document.head.appendChild(s);
  });
}

let instance: Promise<MpInstance> | null = null;
export function loadMercadoPago(publicKey: string): Promise<MpInstance> {
  instance ??= (async () => {
    // Impressão digital do dispositivo (antifraude do MP): melhora a taxa de aprovação
    script('https://www.mercadopago.com/v2/security.js', { view: 'checkout' }).catch(() => undefined);
    await script('https://sdk.mercadopago.com/js/v2');
    if (!window.MercadoPago) throw new Error('Pagamento seguro indisponível');
    return new window.MercadoPago(publicKey, { locale: 'pt-BR' });
  })();
  instance.catch(() => { instance = null; });
  return instance;
}
export const deviceId = () => window.MP_DEVICE_SESSION_ID;
