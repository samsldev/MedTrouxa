import { FormEvent, useState } from 'react';
import { api } from '../../api/client';
import { brl, get, Loading, num, Section, Table, useReauth, useReport } from './common';

interface Coupon { code: string; percentOff: number; planIds: string[] | null; maxRedemptions: number | null; expiresAt: string | null; active: boolean; createdBy: string; createdAt: string; redemptions: number; revenueCents: number; discountCents: number }
const PLANS = [['aprendiz', 'Aprendiz'], ['alquimista', 'Alquimista'], ['arcano', 'Arcano']];
const empty = { code: '', percentOff: '10', planIds: [] as string[], maxRedemptions: '', expiresAt: '' };

/** Cupons de desconto: criação com reautenticação, pausa/retomada e desempenho (usos, receita, desconto concedido). */
export default function Coupons() {
  const r = useReport(() => get<Coupon[]>('/admin/coupons'), 'coupons');
  const [ask, dialog] = useReauth();
  const [form, setForm] = useState(empty);
  const [msg, setMsg] = useState('');

  async function create(e: FormEvent) {
    e.preventDefault();
    const proof = await ask(`Criar cupom ${form.code.toUpperCase()}`);
    if (!proof) return;
    setMsg('');
    try {
      await api('/admin/coupons', { body: {
        ...proof, couponCode: form.code.trim().toUpperCase(), percentOff: Number(form.percentOff),
        ...(form.planIds.length ? { planIds: form.planIds } : {}), ...(form.maxRedemptions ? { maxRedemptions: Number(form.maxRedemptions) } : {}),
        ...(form.expiresAt ? { expiresAt: new Date(`${form.expiresAt}T23:59:59`).toISOString() } : {}),
      } });
      setForm(empty); setMsg('Cupom criado.'); r.reload();
    } catch (x) { setMsg((x as Error).message); }
  }
  async function toggle(c: Coupon) {
    try { await api(`/admin/coupons/${encodeURIComponent(c.code)}/${c.active ? 'disable' : 'enable'}`, { method: 'POST' }); r.reload(); }
    catch (x) { setMsg((x as Error).message); }
  }

  const status = (c: Coupon) => !c.active ? 'pausado' : c.expiresAt && new Date(c.expiresAt) <= new Date() ? 'expirado' : c.maxRedemptions && c.redemptions >= c.maxRedemptions ? 'esgotado' : 'ativo';
  return (
    <>
      {dialog}
      <Section title="Novo cupom" note="O desconto vale para Pix e cartão. Use códigos diferentes por campanha para medir o retorno de cada uma.">
        <form className="c-toolbar" onSubmit={create}>
          <label className="c-field">Código<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="ENAMED10" pattern="[A-Za-z0-9_\-]{3,32}" required /></label>
          <label className="c-field">Desconto %<input type="number" min={1} max={90} value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: e.target.value })} required /></label>
          <label className="c-field">Limite de usos<input type="number" min={1} value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} placeholder="ilimitado" /></label>
          <label className="c-field">Válido até<input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} /></label>
          <fieldset className="c-field c-plans"><span>Planos (nenhum = todos)</span>
            <span className="row wrap">{PLANS.map(([id, label]) => (
              <label key={id} className="check"><input type="checkbox" checked={form.planIds.includes(id)}
                onChange={(e) => setForm({ ...form, planIds: e.target.checked ? [...form.planIds, id] : form.planIds.filter((p) => p !== id) })} /><span>{label}</span></label>
            ))}</span>
          </fieldset>
          <button className="btn btn-dark">Criar cupom</button>
        </form>
        {msg && <div className="notice">{msg}</div>}
      </Section>
      <Section title="Cupons">
        {!r.data ? <Loading {...r} /> : (
          <Table head={['Código', 'Desconto', 'Planos', 'Usos pagos', 'Receita', 'Desconto concedido', 'Validade', 'Status', '']} empty="Nenhum cupom ainda."
            rows={r.data.map((c) => [
              <code>{c.code}</code>, `${c.percentOff}%`, c.planIds?.map((p) => PLANS.find(([id]) => id === p)?.[1] ?? p).join(', ') ?? 'todos',
              `${num(c.redemptions)}${c.maxRedemptions ? ` / ${num(c.maxRedemptions)}` : ''}`, brl(c.revenueCents), brl(c.discountCents),
              c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('pt-BR') : '—', <span className={`c-chip ${status(c) === 'ativo' ? '' : 'off'}`}>{status(c)}</span>,
              <button className="c-link" onClick={() => toggle(c)}>{c.active ? 'Pausar' : 'Reativar'}</button>,
            ])} />
        )}
      </Section>
    </>
  );
}
