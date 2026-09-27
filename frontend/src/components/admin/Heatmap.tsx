import { useEffect, useRef, useState } from 'react';
import { ALL_SEGMENTS, formatDuration, formatPct, get, Kpi, lastDays, Loading, Note, num, query, Range, RangePicker, Section, Segment, SegmentBar, Table, useReport } from './common';
import type { Stats } from './Marketing';

interface Data { path: string; summary: Stats; avg_doc_h: number; reach: number[]; attention_ms: number[]; clicks: [number, number][]; targets: { label: string; clicks: number }[] }
const PAGES = ['/', '/login', '/termos', '/privacidade', '/esqueci-senha'];
const WIDTHS: Record<string, number> = { desktop: 1280, tablet: 820, mobile: 390 };
type Layer = 'clicks' | 'attention' | 'scroll';

/** Mapa de calor — port de Heatmap.tsx: a página pública num iframe com camadas em canvas por cima. */
export default function Heatmap({ initialPath }: { initialPath?: string }) {
  const [range, setRange] = useState<Range>(lastDays(30));
  const [seg, setSeg] = useState<Segment>({ ...ALL_SEGMENTS, device: 'desktop' });
  const [path, setPath] = useState(initialPath && (PAGES.includes(initialPath) || initialPath.startsWith('/lp/')) ? initialPath : '/');
  const [layer, setLayer] = useState<Layer>('clicks');
  const r = useReport(() => get<Data>(`/admin/analytics/page?${query(range, seg, { path })}`), JSON.stringify([range, seg, path]));
  const d = r.data;

  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const width = WIDTHS[seg.device || 'desktop'];
  const height = Math.max(900, Math.min(d?.avg_doc_h || 3000, 14000));

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !d) return;
    c.width = width; c.height = height;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, width, height);
    if (layer === 'clicks') {
      // Acúmulo de pontos com gradiente radial e colorização por intensidade.
      const shadow = document.createElement('canvas');
      shadow.width = width; shadow.height = height;
      const s = shadow.getContext('2d')!;
      const radius = Math.max(18, width / 45);
      const alpha = Math.min(0.5, Math.max(0.05, 12 / Math.sqrt(d.clicks.length + 1)));
      for (const [x, y] of d.clicks) {
        const grd = s.createRadialGradient(x * width, y * height, 0, x * width, y * height, radius);
        grd.addColorStop(0, `rgba(0,0,0,${alpha})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
        s.fillStyle = grd;
        s.fillRect(x * width - radius, y * height - radius, radius * 2, radius * 2);
      }
      const img = s.getImageData(0, 0, width, height);
      for (let i = 0; i < img.data.length; i += 4) {
        const a = img.data[i + 3] / 255;
        if (!a) continue;
        const [cr, cg, cb] = ramp(a);
        img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = Math.min(220, 60 + a * 255);
      }
      g.putImageData(img, 0, 0);
    } else if (layer === 'attention') {
      const max = Math.max(1, ...d.attention_ms);
      const band = height / d.attention_ms.length;
      d.attention_ms.forEach((ms, i) => {
        const [cr, cg, cb] = ramp(ms / max);
        g.fillStyle = `rgba(${cr},${cg},${cb},${0.12 + (ms / max) * 0.45})`;
        g.fillRect(0, i * band, width, band);
      });
    } else {
      g.font = '600 22px system-ui'; g.textAlign = 'right';
      d.reach.forEach((pct, step) => {
        if (step === 0) return;
        const y = (step / 10) * height;
        g.fillStyle = `rgba(20,16,40,${0.05 + (1 - pct / 100) * 0.5})`;
        g.fillRect(0, ((step - 1) / 10) * height, width, height / 10);
        g.strokeStyle = 'rgba(201,162,39,.9)'; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(0, y); g.lineTo(width, y); g.stroke();
        g.fillStyle = '#fff'; g.fillText(`${pct}% chegaram a ${step * 10}%`, width - 16, y - 10);
      });
    }
  }, [d, layer, width, height]);

  return (
    <>
      <RangePicker value={range} onChange={setRange} />
      <SegmentBar value={seg} onChange={(s) => setSeg({ ...s, device: s.device || 'desktop' })} />
      <div className="c-toolbar">
        <label className="c-field">Página
          <select value={path} onChange={(e) => setPath(e.target.value)}>
            {[...new Set([...PAGES, path])].map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <div className="c-presets" role="group" aria-label="Camada">
          {([['clicks', 'Cliques'], ['attention', 'Atenção'], ['scroll', 'Rolagem']] as [Layer, string][]).map(([k, l]) => (
            <button key={k} className={layer === k ? 'on' : ''} aria-pressed={layer === k} onClick={() => setLayer(k)}>{l}</button>
          ))}
        </div>
      </div>
      {!d ? <Loading {...r} /> : (
        <>
          <div className="c-kpis">
            <Kpi label="Visualizações" value={num(d.summary.views)} /><Kpi label="Visitantes" value={num(d.summary.visitors)} />
            <Kpi label="Tempo ativo médio" value={formatDuration(d.summary.avg_active_ms)} /><Kpi label="Rolagem média" value={`${d.summary.avg_scroll}%`} />
            <Kpi label="Rejeição" value={formatPct(d.summary.bounce_rate)} /><Kpi label="Cliques" value={num(d.clicks.length)} />
          </div>
          <div className="c-grid2 wide-left">
            <Section title={`Mapa de calor — ${path}`}>
              <Note>Prévia ao vivo da página em {width}px; os pontos usam a posição relativa ao documento, então mudanças de layout recentes podem deslocá-los.</Note>
              <div className="c-stage" ref={stage} style={{ height: height * scale }}>
                <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'relative' }}>
                  <iframe title={`Prévia de ${path}`} src={path} width={width} height={height} sandbox="allow-same-origin allow-scripts" tabIndex={-1} />
                  <canvas ref={canvas} />
                </div>
              </div>
            </Section>
            <Section title="Elementos mais clicados">
              <Table head={['Elemento', 'Cliques']} rows={d.targets.map((t) => [<code>{t.label}</code>, num(t.clicks)])} />
            </Section>
          </div>
        </>
      )}
    </>
  );
}

/** Azul → verde → amarelo → vermelho. */
function ramp(t: number): [number, number, number] {
  const stops: [number, number, number][] = [[64, 64, 255], [0, 200, 150], [255, 214, 0], [230, 40, 40]];
  const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x), f = x - i;
  return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f)) as [number, number, number];
}
