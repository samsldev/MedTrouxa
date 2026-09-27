import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';
import { brl, installmentTotal } from '../billing';
import { Icon, Logo } from '../components/Brand';
import { usePlans } from '../components/Pricing';
import { attribution } from '../lib/analytics';
import { SITE } from '../site';
import { deviceId, loadMercadoPago, MpField, MpInstance } from '../lib/mercadopago';
import { formatDoc, formatPhone, phoneOk, validCnpj, validCpf } from '../lib/taxid';

interface Config { provider: 'fake' | 'mercadopago'; publicKey: string | null }
interface Coupon { code: string; percentOff: number; cashPrice: number; installmentTotal: number }
interface PayResult { subscriptionId: string; status: 'active' | 'pending' | 'failed'; message: string | null }

const BRANDS = [['visa', 'Visa'], ['master', 'Master'], ['elo', 'Elo'], ['amex', 'Amex'], ['hipercard', 'Hiper']];
const onlyDigits = (s: string) => s.replace(/\D/g, '');
function fakeBrand(n: string) {
  const d = onlyDigits(n);
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'master';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^(606282|3841)/.test(d)) return 'hipercard';
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(d)) return 'elo';
  return d.length >= 6 ? 'master' : '';
}

/** Campo com rótulo flutuante, estado válido/erro e mensagem — padrão de todos os campos do checkout. */
function Field({ label, error, ok, children, hint }: { label: string; error?: string | false; ok?: boolean; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className={`co-field ${error ? 'bad' : ok ? 'good' : ''}`}>
      <span className="co-label">{label}</span>
      <span className="co-control">{children}{error ? <b className="co-mark">✕</b> : ok ? <b className="co-mark">✓</b> : null}</span>
      {error ? <small className="co-err">{error}</small> : hint ? <small className="co-hint">{hint}</small> : null}
    </label>
  );
}

/** Checkout próprio do MedTrouxa: dados, cupom, cartão (tokenizado pelo Mercado Pago) ou Pix, sem sair do site. */
export default function Checkout() {
  const { planId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const plans = usePlans();
  const plan = plans.find((p) => p.id === planId);
  const [config, setConfig] = useState<Config | null>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState('');
  const [doc, setDoc] = useState('');
  const [method, setMethod] = useState<'card' | 'pix'>('card');
  const [n, setN] = useState(12);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Cartão — modo de teste (inputs locais) ou Mercado Pago (iframes seguros)
  const [holder, setHolder] = useState('');
  const [fake, setFake] = useState({ number: '', exp: '', cvv: '' });
  const [brand, setBrand] = useState('');
  const [mpErrors, setMpErrors] = useState<Record<string, string>>({});
  const [mpReady, setMpReady] = useState(false);
  const mp = useRef<{ inst: MpInstance; fields: MpField[]; pm: { id: string; issuer?: string } | null } | null>(null);

  useEffect(() => { api<Config>('/billing/config').then(setConfig).catch(() => setConfig({ provider: 'fake', publicKey: null })); }, []);
  useEffect(() => { if (user?.name && !name) setName(user.name); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (plan) setN(plan.maxInstallments); }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = config?.provider === 'mercadopago' && !!config.publicKey;
  useEffect(() => {
    if (!live || method !== 'card') return undefined;
    let cancelled = false;
    const style = { fontSize: '15px', color: getComputedStyle(document.body).color, fontFamily: 'Inter, system-ui, sans-serif', placeholderColor: '#9b99b0' };
    loadMercadoPago(config!.publicKey!).then((inst) => {
      if (cancelled) return;
      const number = inst.fields.create('cardNumber', { placeholder: '0000 0000 0000 0000', style }).mount('mp-card-number');
      const exp = inst.fields.create('expirationDate', { placeholder: 'MM/AA', style }).mount('mp-card-exp');
      const cvv = inst.fields.create('securityCode', { placeholder: '123', style }).mount('mp-card-cvv');
      const state = { inst, fields: [number, exp, cvv], pm: null as { id: string; issuer?: string } | null };
      mp.current = state;
      number.on('binChange', async ({ bin }: { bin?: string }) => {
        if (!bin) { state.pm = null; setBrand(''); return; }
        const { results } = await inst.getPaymentMethods({ bin }).catch(() => ({ results: [] as never[] }));
        const pm = results[0];
        if (!pm) { setMpErrors((e) => ({ ...e, cardNumber: 'Bandeira não aceita' })); return; }
        const issuers = await inst.getIssuers({ paymentMethodId: pm.id, bin }).catch(() => []);
        state.pm = { id: pm.id, issuer: String(issuers[0]?.id ?? pm.issuer?.id ?? '') || undefined };
        setBrand(pm.id);
        number.update({ settings: pm.settings[0]?.card_number });
        cvv.update({ settings: pm.settings[0]?.security_code });
      });
      const track = (key: string, f: MpField) => f.on('validityChange', ({ errorMessages }: { errorMessages: unknown[] }) => setMpErrors((e) => ({ ...e, [key]: errorMessages.length ? 'Campo inválido' : '' })));
      track('cardNumber', number); track('expirationDate', exp); track('securityCode', cvv);
      setMpReady(true);
    }).catch((e: Error) => setError(e.message));
    return () => { cancelled = true; mp.current?.fields.forEach((f) => { try { f.unmount(); } catch { /* já desmontado */ } }); mp.current = null; setMpReady(false); };
  }, [live, method, config?.publicKey]);

  const options = useMemo(() => (plan ? Array.from({ length: plan.maxInstallments }, (_, i) => i + 1) : []), [plan]);
  if (!plans.length || !config) return <div className="center">Carregando...</div>;
  if (!plan) return <div className="center">Plano não encontrado. <Link to="/planos">Ver planos</Link></div>;

  const installments = method === 'pix' ? 1 : n;
  const cash = coupon?.cashPrice ?? plan.cashPrice;
  const parcel = coupon?.installmentTotal ?? installmentTotal(plan);
  const total = installments === 1 ? cash : parcel;
  const grossTotal = installments === 1 ? plan.cashPrice : installmentTotal(plan);
  const each = Math.round(total / installments);

  const docDigits = onlyDigits(doc);
  const docType = docDigits.length > 11 ? 'cnpj' : 'cpf';
  const errors = {
    name: !/^\S{2,}(\s+\S+)+$/.test(name.trim()) && 'Informe nome e sobrenome',
    doc: !(docType === 'cpf' ? validCpf(docDigits) : validCnpj(docDigits)) && (docDigits.length ? `${docType.toUpperCase()} inválido` : 'Informe seu CPF ou CNPJ'),
    phone: !phoneOk(phone) && 'Celular inválido',
    holder: method === 'card' && holder.trim().length < 4 && 'Informe o nome como está no cartão',
    number: method === 'card' && (live ? mpErrors.cardNumber : onlyDigits(fake.number).length < 13 && 'Número do cartão inválido'),
    exp: method === 'card' && (live ? mpErrors.expirationDate : !/^(0[1-9]|1[0-2])\/\d{2}$/.test(fake.exp) && 'Validade inválida'),
    cvv: method === 'card' && (live ? mpErrors.securityCode : !/^\d{3,4}$/.test(fake.cvv) && 'CVV inválido'),
    terms: (!terms || !privacy) && 'Aceite os termos',
  };
  const show = (k: keyof typeof errors, touched: boolean) => (submitted || touched ? errors[k] : false);
  const invalid = Object.values(errors).some(Boolean);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponMsg('');
    try { setCoupon(await api<Coupon>(`/billing/coupons/${encodeURIComponent(code)}?planId=${plan!.id}`)); }
    catch (e) { setCoupon(null); setCouponMsg((e as Error).message); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true); setError('');
    if (invalid) { document.querySelector('.co-field.bad, .co-terms.bad')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    setBusy(true);
    try {
      let card: { token: string; paymentMethodId: string; issuerId?: string } | undefined;
      if (method === 'card') {
        if (live) {
          if (!mp.current?.pm) throw new Error('Confira o número do cartão');
          const t = await mp.current.inst.fields.createCardToken({ cardholderName: holder.trim(), identificationType: docType.toUpperCase(), identificationNumber: docDigits })
            .catch(() => { throw new Error('Confira os dados do cartão'); });
          card = { token: t.id, paymentMethodId: mp.current.pm.id, issuerId: mp.current.pm.issuer };
        } else {
          card = { token: onlyDigits(fake.number).endsWith('0002') ? 'fake-reject' : 'fake-ok', paymentMethodId: fakeBrand(fake.number) || 'master' };
        }
      }
      const r = await api<PayResult>('/billing/pay', { body: {
        planId: plan!.id, paymentMethod: method, installments, coupon: coupon?.code, acceptTerms: true, deviceId: deviceId(),
        payer: { name: name.trim(), docType, docNumber: docDigits, ...(onlyDigits(phone) ? { phone: onlyDigits(phone) } : {}) },
        card, ...attribution(),
      } });
      if (r.status === 'failed') { setError(r.message ?? 'Pagamento recusado.'); return; }
      nav(`/pagamento/${r.subscriptionId}`);
    } catch (x) { setError((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="checkout-page co">
      <header className="checkout-top"><Link to="/"><Logo /></Link><span className="co-secure"><Icon name="lock" size={15} /> Compra 100% segura</span></header>
      <form className="co-grid" onSubmit={submit} noValidate>
        <aside className="co-summary">
          <div className="co-product">
            <div className="co-product-art" aria-hidden="true"><Logo /><span>Plataforma de estudos</span></div>
            <span className="kicker">Plano {plan.name}</span>
            <p className="muted small">{plan.tagline}</p>
          </div>
          <dl className="co-lines">
            <div><dt><Icon name="crown" size={14} /> Plano {plan.name}</dt><dd>{brl(grossTotal)}</dd></div>
            {coupon && <div className="co-discount"><dt>Cupom {coupon.code} (−{coupon.percentOff}%)</dt><dd>−{brl(grossTotal - total)}</dd></div>}
            <div className="co-total"><dt>Total</dt><dd>{installments > 1 ? <>em {installments}x de <b>{brl(each)}</b></> : <b>{brl(total)}</b>}</dd></div>
          </dl>
          <p className="co-note">Pagamento único · {plan.accessYears > 1 ? `${plan.accessYears} anos` : '1 ano'} de acesso · <b>sem renovação automática</b></p>
          {installments > 1 && total > cash && <p className="co-note">No Pix ou à vista: {brl(cash)} (economia de {brl(total - cash)}).</p>}
          <ul className="co-perks">
            <li><Icon name="check" size={14} /> Acesso liberado na hora após a aprovação</li>
            <li><Icon name="check" size={14} /> 7 dias de garantia: devolvemos 100%</li>
            <li><Icon name="check" size={14} /> Nota fiscal (NFS-e) enviada por e-mail</li>
          </ul>
        </aside>

        <section className="co-main">
          <h2 className="co-h">Seus dados</h2>
          <Field label="Nome e sobrenome *" error={show('name', name.length > 0)} ok={!errors.name}>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
          </Field>
          <div className="co-row">
            <Field label="E-mail da conta" ok hint={<>O acesso é liberado nesta conta. <Link to="/conta">Trocar</Link></>}>
              <input value={user?.email ?? ''} readOnly />
            </Field>
            <Field label="Celular (opcional)" error={show('phone', onlyDigits(phone).length >= 10)} ok={onlyDigits(phone).length >= 10 && !errors.phone}>
              <input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} inputMode="tel" autoComplete="tel-national" placeholder="(11) 91234-5678" />
            </Field>
          </div>
          <Field label="CPF / CNPJ *" error={show('doc', docDigits.length >= 11)} ok={!errors.doc} hint="Usado na nota fiscal e exigido pelo banco emissor.">
            <input value={doc} onChange={(e) => setDoc(formatDoc(e.target.value).value)} inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" />
          </Field>

          <div className="co-coupon">
            <span>Tem um cupom de desconto?</span>
            {coupon ? (
              <span className="co-coupon-on"><Icon name="check" size={14} /> {coupon.code} aplicado (−{coupon.percentOff}%) <button type="button" className="btn btn-text" onClick={() => { setCoupon(null); setCouponInput(''); }}>Remover</button></span>
            ) : (
              <span className="co-coupon-form">
                <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Código do cupom" maxLength={32}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }} aria-label="Código do cupom" />
                <button type="button" className="btn btn-outline" onClick={applyCoupon} disabled={!couponInput.trim()}>Aplicar</button>
              </span>
            )}
            {couponMsg && <small className="co-err">{couponMsg}</small>}
          </div>

          <h2 className="co-h">Método de pagamento</h2>
          <div className="co-methods" role="radiogroup">
            <div className={`co-method ${method === 'card' ? 'on' : ''}`}>
              <label className="co-radio"><input type="radio" name="m" checked={method === 'card'} onChange={() => setMethod('card')} />
                <Icon name="card" size={18} /> <b>Cartão de crédito</b><small>em até {plan.maxInstallments}x</small></label>
              {method === 'card' && (
                <div className="co-card">
                  <div className="co-brands" aria-label="Bandeiras aceitas">
                    {BRANDS.map(([id, label]) => <span key={id} className={(live ? brand : fakeBrand(fake.number)) === id ? 'on' : ''}>{label}</span>)}
                  </div>
                  {live ? (
                    <>
                      <Field label="Número do cartão *" error={show('number', false)}><div id="mp-card-number" className="mp-slot" /></Field>
                      <Field label="Nome impresso no cartão *" error={show('holder', holder.length > 3)} ok={!errors.holder}>
                        <input value={holder} onChange={(e) => setHolder(e.target.value.toUpperCase())} autoComplete="cc-name" />
                      </Field>
                      <div className="co-row">
                        <Field label="Validade *" error={show('exp', false)}><div id="mp-card-exp" className="mp-slot" /></Field>
                        <Field label="CVV *" error={show('cvv', false)}><div id="mp-card-cvv" className="mp-slot" /></Field>
                      </div>
                      {!mpReady && <p className="co-hint">Carregando campos seguros…</p>}
                    </>
                  ) : (
                    <>
                      <p className="co-test">Modo de teste: nenhum cartão é cobrado. Final <b>0002</b> simula recusa.</p>
                      <Field label="Número do cartão *" error={show('number', onlyDigits(fake.number).length >= 13)} ok={!errors.number}>
                        <input value={fake.number} inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
                          onChange={(e) => setFake({ ...fake, number: onlyDigits(e.target.value).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ') })} />
                      </Field>
                      <Field label="Nome impresso no cartão *" error={show('holder', holder.length > 3)} ok={!errors.holder}>
                        <input value={holder} onChange={(e) => setHolder(e.target.value.toUpperCase())} autoComplete="cc-name" />
                      </Field>
                      <div className="co-row">
                        <Field label="Validade *" error={show('exp', fake.exp.length >= 5)} ok={!errors.exp}>
                          <input value={fake.exp} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA"
                            onChange={(e) => setFake({ ...fake, exp: onlyDigits(e.target.value).slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2') })} />
                        </Field>
                        <Field label="CVV *" error={show('cvv', fake.cvv.length >= 3)} ok={!errors.cvv}>
                          <input value={fake.cvv} inputMode="numeric" autoComplete="cc-csc" placeholder="123" onChange={(e) => setFake({ ...fake, cvv: onlyDigits(e.target.value).slice(0, 4) })} />
                        </Field>
                      </div>
                    </>
                  )}
                  <Field label="Parcelamento *" ok>
                    <select value={n} onChange={(e) => setN(Number(e.target.value))}>
                      {options.map((i) => {
                        const t = i === 1 ? cash : parcel;
                        return <option key={i} value={i}>{i}x de {brl(Math.round(t / i))}{i === 1 ? ' (à vista)' : ` · total ${brl(t)}`}</option>;
                      })}
                    </select>
                  </Field>
                </div>
              )}
            </div>
            <div className={`co-method ${method === 'pix' ? 'on' : ''}`}>
              <label className="co-radio"><input type="radio" name="m" checked={method === 'pix'} onChange={() => setMethod('pix')} />
                <Icon name="pix" size={18} /> <b>Pix</b><small>à vista · {brl(cash)} · aprovação imediata</small></label>
              {method === 'pix' && <p className="co-pix-info">Ao confirmar, mostramos o QR Code e o código copia-e-cola. O acesso é liberado assim que o banco confirmar, normalmente em segundos. O código vale por 30 minutos.</p>}
            </div>
          </div>

          <div className={`co-terms ${submitted && errors.terms ? 'bad' : ''}`}>
            <label className="check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span>Declaro estar de acordo com os <Link to="/termos" target="_blank">termos de uso</Link>. *</span></label>
            <label className="check"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /><span>Declaro estar de acordo com a <Link to="/privacidade" target="_blank">política de privacidade</Link>. *</span></label>
          </div>

          {submitted && invalid && <div className="co-alert">Existem campos inválidos ou não preenchidos</div>}
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn btn-foil btn-block btn-lg co-submit" disabled={busy || (live && method === 'card' && !mpReady)}>
            {busy ? 'Processando…' : method === 'pix' ? `Gerar Pix de ${brl(total)}` : `Assinar agora · ${installments}x de ${brl(each)}`}
          </button>
          <p className="co-fine"><Icon name="shield" size={13} /> Pagamento processado pelo Mercado Pago com criptografia. O MedTrouxa não vê nem armazena os dados do seu cartão.</p>
        </section>
      </form>
      <footer className="co-footer">
        {(SITE.email || SITE.whatsapp) && <span>Atendimento: {SITE.whatsapp && <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>}{SITE.email && SITE.whatsapp && ' · '}{SITE.email && <a href={`mailto:${SITE.email}`}>{SITE.email}</a>}</span>}
        {SITE.legalName && <span>{SITE.legalName}{SITE.cnpj ? ` · CNPJ ${SITE.cnpj}` : ''}</span>}
        <span><Link to="/termos">Termos</Link> · <Link to="/privacidade">Privacidade</Link></span>
      </footer>
    </div>
  );
}
