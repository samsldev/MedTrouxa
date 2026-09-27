/**
 * Peças compartilhadas do console (port de faelith_web admin: Filters, useReport, adminI18n, ReauthDialog) + gráficos.
 */
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';

export interface Range { from: string; to: string; preset?: string }
export interface Segment { device: string; source: string; campaign: string; lp: string }
export const ALL_SEGMENTS: Segment = { device: '', source: '', campaign: '', lp: '' };

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export function lastDays(days: number): Range {
  const to = new Date();
  return { from: isoDay(new Date(to.getTime() - (days - 1) * 86_400_000)), to: isoDay(to), preset: `${days}d` };
}
const last24h = (): Range => { const to = new Date(); return { from: new Date(to.getTime() - 86_400_000).toISOString(), to: to.toISOString(), preset: '24h' }; };

export function query(range: Range, segment?: Partial<Segment>, extra: Record<string, string | undefined> = {}) {
  const q = new URLSearchParams({ from: range.from, to: range.to });
  for (const [k, v] of Object.entries({ ...segment, ...extra })) if (v) q.set(k, v);
  return q.toString();
}

// ---------------- formatação (adminI18n) ----------------
export const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlShort = (cents: number) => {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(v) >= 10_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return brl(cents);
};
export const num = (n: number) => n.toLocaleString('pt-BR');
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
export const formatPct = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`.replace('.', ',');
/** Variação sobre o período anterior: % relativa para valores, pontos percentuais para taxas. */
export function formatDelta(current: number, previous: number, isRate: boolean): { text: string; tone: 'up' | 'down' | 'flat' } | null {
  if (isRate) {
    const p = Math.round((current - previous) * 10) / 10;
    return { text: `${p > 0 ? '+' : ''}${String(p).replace('.', ',')} p.p.`, tone: p > 0 ? 'up' : p < 0 ? 'down' : 'flat' };
  }
  if (previous === 0) return null;
  const c = Math.round(((current - previous) / previous) * 1000) / 10;
  return { text: `${c > 0 ? '+' : ''}${String(c).replace('.', ',')}%`, tone: c > 0 ? 'up' : c < 0 ? 'down' : 'flat' };
}

// ---------------- dados ----------------
export interface Report<T> { data: T | null; error: string | null; loading: boolean; reload: () => void }
/** Roda `load` sempre que `key` muda (ignora respostas antigas). */
export function useReport<T>(load: () => Promise<T>, key: string): Report<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);
  const loader = useRef(load);
  loader.current = load;
  useEffect(() => {
    const req = ++latest.current;
    setLoading(true); setError(null);
    loader.current()
      .then((next) => { if (latest.current === req) setData(next); })
      .catch((e: unknown) => { if (latest.current === req) setError(e instanceof Error ? e.message : 'Não foi possível carregar'); })
      .finally(() => { if (latest.current === req) setLoading(false); });
  }, [key, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}
export const get = <T,>(path: string) => api<T>(path);

// ---------------- filtros ----------------
const PRESETS: [string, () => Range][] = [['24 horas', last24h], ['7 dias', () => lastDays(7)], ['15 dias', () => lastDays(15)], ['1 mês', () => lastDays(30)], ['3 meses', () => lastDays(90)], ['1 ano', () => lastDays(365)]];

export function RangePicker({ value, onChange }: { value: Range; onChange(r: Range): void }) {
  return (
    <div className="c-toolbar">
      <div className="c-presets" role="group" aria-label="Período">
        {PRESETS.map(([label, make]) => {
          const r = make();
          const active = value.preset === r.preset;
          return <button key={label} type="button" className={active ? 'on' : ''} aria-pressed={active} onClick={() => onChange(r)}>{label}</button>;
        })}
      </div>
      <label className="c-field">De<input type="date" value={value.from.slice(0, 10)} max={value.to.slice(0, 10)} onChange={(e) => e.target.value && onChange({ from: e.target.value, to: value.to.slice(0, 10) })} /></label>
      <label className="c-field">Até<input type="date" value={value.to.slice(0, 10)} min={value.from.slice(0, 10)} onChange={(e) => e.target.value && onChange({ from: value.from.slice(0, 10), to: e.target.value })} /></label>
    </div>
  );
}

export function SegmentBar({ value, onChange, showDevice = true }: { value: Segment; onChange(s: Segment): void; showDevice?: boolean }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const submit = (e: FormEvent) => { e.preventDefault(); onChange({ ...draft, source: draft.source.trim(), campaign: draft.campaign.trim(), lp: draft.lp.trim() }); };
  const active = Object.values(value).some(Boolean);
  return (
    <form className="c-toolbar c-segment" onSubmit={submit}>
      {showDevice && (
        <label className="c-field">Dispositivo
          <select value={value.device} onChange={(e) => onChange({ ...value, device: e.target.value })}>
            <option value="">Todos</option><option value="desktop">desktop</option><option value="tablet">tablet</option><option value="mobile">mobile</option>
          </select>
        </label>
      )}
      <label className="c-field">Fonte UTM<input value={draft.source} placeholder="instagram" onChange={(e) => setDraft({ ...draft, source: e.target.value })} /></label>
      <label className="c-field">Campanha UTM<input value={draft.campaign} placeholder="enamed-2026" onChange={(e) => setDraft({ ...draft, campaign: e.target.value })} /></label>
      <label className="c-field">Variação de landing<input value={draft.lp} placeholder="enamed-a" onChange={(e) => setDraft({ ...draft, lp: e.target.value })} /></label>
      <button type="submit" className="btn btn-outline">Aplicar filtros</button>
      {active && <button type="button" className="btn btn-text" onClick={() => onChange(ALL_SEGMENTS)}>Limpar</button>}
    </form>
  );
}

// ---------------- apresentação ----------------
export function Kpi({ label, value, delta, hint, accent }: { label: string; value: string; delta?: { text: string; tone: string } | null; hint?: string; accent?: boolean }) {
  return (
    <div className={`c-kpi ${accent ? 'accent' : ''}`} title={hint}>
      <span className="c-kpi-label">{label}</span>
      <span className="c-kpi-value">{value}</span>
      {delta && <span className={`c-delta ${delta.tone}`}>{delta.text} <small>vs período anterior</small></span>}
    </div>
  );
}
export const Section = ({ title, children, note }: { title: string; children: ReactNode; note?: string }) => (
  <section className="c-section"><h2>{title}</h2>{note && <p className="c-note">{note}</p>}{children}</section>
);
export const Note = ({ children }: { children: ReactNode }) => <p className="c-note">{children}</p>;
export const Loading = ({ error, loading }: { error: string | null; loading: boolean }) =>
  error ? <p className="error">{error}</p> : <p className="c-note">{loading ? 'Carregando…' : 'Sem dados neste período.'}</p>;

export function Table({ head, rows, empty = 'Sem dados.' }: { head: ReactNode[]; rows: ReactNode[][]; empty?: string }) {
  return (
    <div className="c-table-wrap">
      <table className="c-table">
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={head.length} className="c-empty">{empty}</td></tr> : rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

/** Barra horizontal proporcional (para rankings). */
export const Bar = ({ value, max, label }: { value: number; max: number; label?: string }) => (
  <span className="c-bar"><i style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }} /><b>{label ?? num(value)}</b></span>
);

// ---------------- gráficos (SVG) ----------------
export function BarChart({ series, value, secondary, label, format = num, height = 180 }: {
  series: { day: string }[]; value: (d: never) => number; secondary?: (d: never) => number; label?: string; format?: (n: number) => string; height?: number;
}) {
  const width = 1000;
  const vals = series.map((d) => value(d as never));
  const max = Math.max(1, ...vals, ...(secondary ? series.map((d) => secondary(d as never)) : []));
  const slot = width / Math.max(series.length, 1);
  const bar = Math.max(2, slot * 0.62);
  const every = Math.ceil(series.length / 10);
  return (
    <svg className="c-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {[0.25, 0.5, 0.75].map((g) => <line key={g} className="c-grid" x1="0" x2={width} y1={(height - 20) * g} y2={(height - 20) * g} />)}
      {series.map((d, i) => {
        const x = i * slot + (slot - bar) / 2;
        const h = (vals[i] / max) * (height - 26);
        const h2 = secondary ? (secondary(d as never) / max) * (height - 26) : 0;
        return (
          <g key={d.day}>
            <title>{`${d.day.split('-').reverse().join('/')}: ${format(vals[i])}${secondary ? ` / ${format(secondary(d as never))}` : ''}`}</title>
            {secondary && <rect className="c-bar-soft" x={x} y={height - 20 - h2} width={bar} height={h2} rx="2" />}
            <rect className="c-bar-main" x={x + (secondary ? bar * 0.22 : 0)} y={height - 20 - h} width={secondary ? bar * 0.56 : bar} height={h} rx="2" />
            {i % every === 0 && <text className="c-axis" x={x} y={height - 4}>{d.day.slice(8)}/{d.day.slice(5, 7)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ series, value, format = num, height = 200 }: { series: { day: string }[]; value: (d: never) => number; format?: (n: number) => string; height?: number }) {
  const width = 1000, pad = 22;
  const vals = series.map((d) => value(d as never));
  const max = Math.max(1, ...vals) * 1.1;
  const x = (i: number) => (series.length <= 1 ? width / 2 : (i / (series.length - 1)) * (width - 8) + 4);
  const y = (v: number) => height - pad - (v / max) * (height - pad - 10);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const every = Math.ceil(series.length / 10);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="c-line-wrap">
      <svg className="c-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); setHover(Math.round(((e.clientX - r.left) / r.width) * (series.length - 1))); }}>
        <defs>
          <linearGradient id="c-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--gold)" stopOpacity=".35" /><stop offset="1" stopColor="var(--gold)" stopOpacity="0" /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} className="c-grid" x1="0" x2={width} y1={(height - pad) * g} y2={(height - pad) * g} />)}
        {vals.length > 0 && <path d={`${line} L${x(vals.length - 1)},${height - pad} L${x(0)},${height - pad} Z`} fill="url(#c-area)" />}
        <path d={line} className="c-line" vectorEffect="non-scaling-stroke" />
        {hover !== null && vals[hover] !== undefined && <line className="c-cursor" x1={x(hover)} x2={x(hover)} y1="0" y2={height - pad} vectorEffect="non-scaling-stroke" />}
        {series.map((d, i) => (i % every === 0 ? <text key={d.day} className="c-axis" x={x(i)} y={height - 4}>{d.day.slice(8)}/{d.day.slice(5, 7)}</text> : null))}
      </svg>
      {hover !== null && series[hover] && (
        <div className="c-tip" style={{ left: `${(x(hover) / width) * 100}%` }}>
          <small>{series[hover].day.split('-').reverse().join('/')}</small><b>{format(vals[hover])}</b>
        </div>
      )}
    </div>
  );
}

export function FunnelChart({ steps }: { steps: { name: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="c-funnel">
      {steps.map((s, i) => (
        <div key={s.name} className="c-funnel-row">
          <span className="c-funnel-name">{s.name}</span>
          <span className="c-funnel-bar"><i style={{ width: `${Math.max(1.5, (s.value / max) * 100)}%` }} /></span>
          <b>{num(s.value)}</b>
          <small>{i === 0 ? '' : steps[i - 1].value ? formatPct(Math.round((s.value * 1000) / steps[i - 1].value) / 10) : '—'}</small>
        </div>
      ))}
    </div>
  );
}

// ---------------- reautenticação (port de ReauthDialog) ----------------
export interface Proof { password: string; method?: 'totp' | 'recovery'; code?: string }
type Ask = (title: string, extra?: { reason?: boolean }) => Promise<(Proof & { reason?: string }) | null>;

export function useReauth(): [Ask, ReactNode] {
  const [state, setState] = useState<{ title: string; reason: boolean; resolve: (p: (Proof & { reason?: string }) | null) => void } | null>(null);
  const [form, setForm] = useState({ password: '', code: '', reason: '' });
  const ask: Ask = (title, extra) => new Promise((resolve) => { setForm({ password: '', code: '', reason: '' }); setState({ title, reason: !!extra?.reason, resolve }); });
  const close = (value: (Proof & { reason?: string }) | null) => { state?.resolve(value); setState(null); };
  const dialog = state && (
    <div className="modal" role="dialog" aria-modal="true" aria-label={state.title} onClick={() => close(null)}>
      <form className="card stack c-reauth" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
        e.preventDefault();
        const code = form.code.trim();
        close({ password: form.password, ...(code ? { method: code.includes('-') ? 'recovery' : 'totp', code } : {}), ...(state.reason ? { reason: form.reason.trim() } : {}) });
      }}>
        <span className="kicker">Confirme que é você</span>
        <h3>{state.title}</h3>
        {state.reason && <label>Motivo (fica registrado na auditoria)<textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required minLength={5} maxLength={500} /></label>}
        <label>Sua senha<input type="password" autoComplete="current-password" autoFocus value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        <label>Código do app autenticador (se ativo)<input inputMode="numeric" autoComplete="one-time-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="000000 ou código de recuperação" /></label>
        <div className="row wrap"><button className="btn btn-dark">Confirmar</button><button type="button" className="btn btn-text" onClick={() => close(null)}>Cancelar</button></div>
      </form>
    </div>
  );
  return [ask, dialog];
}
