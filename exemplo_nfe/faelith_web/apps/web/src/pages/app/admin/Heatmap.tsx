/**
 * @fileoverview Admin Heatmaps tab: live page in a same-origin frame with click, attention, and scroll-reach overlays.
 * @author Samuel S. L.
 * @version 1.1.0
 * @since 2026-09-26
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 * All information contained herein is, and remains, the property of
 * Samuel S. L. and its suppliers, if any.
 *
 * The intellectual, technical, creative, and software concepts contained
 * herein are proprietary to Samuel S. L. and its suppliers and
 * are protected by copyright law, trade secret law, and other applicable
 * intellectual property laws in the Netherlands, the European Union, and
 * other foreign jurisdictions.
 *
 * Where applicable, such rights may be registered, recorded, or protected
 * with the competent authorities of the Government of the Netherlands,
 * the European Union, and/or other relevant jurisdictions.
 *
 * Dissemination of this information, reproduction of this material,
 * modification, distribution, disclosure, or commercial use is strictly
 * forbidden unless prior written permission is obtained from
 * Samuel S. L.
 *
 * @commercialUse Commercial use permitted only with prior written permission from Samuel S. L.
 *
 * <DETAILED_DESCRIPTION>:
 * - The frame is rendered at the device's reference width and viewport height, scaled to fit, and never
 *   clickable; the mouse wheel scrolls it and the overlay follows its scroll offset
 * - Click heat: additive alpha splats mapped onto a blue-green-yellow-red ramp
 * - Attention: 20 horizontal bands shaded by visible time; scroll: dashed lines every 10% with reach share
 * - Framed pages do not track and do not show the consent banner (see lib/analytics.ts)
 */

import { useEffect, useRef, useState } from 'react';
import { fetchPageReport, type PageReport, type Range, type Segment } from '../../../lib/adminApi';
import { useT } from '../../../lib/i18n';
import styles from './Admin.module.css';
import { formatDuration, formatPct, T } from './adminI18n';
import { useReport } from './useReport';

/** Reference frame widths per device class (match the tracker's breakpoints). */
const FRAME_WIDTH: Record<string, number> = { desktop: 1280, tablet: 820, mobile: 390 };
/** Reference viewport heights, so `100vh` sections lay out as they did for visitors. */
const VIEWPORT_HEIGHT: Record<string, number> = { desktop: 800, tablet: 1180, mobile: 844 };
/** Overlay height cap; very long pages are clipped to keep the canvas affordable. */
const MAX_DOC_HEIGHT = 20_000;
const SPLAT_RADIUS = 26;

type Layers = { clicks: boolean; attention: boolean; scroll: boolean };

/**
 * Maps heat intensity (0..1) to an RGB colour on a blue-green-yellow-red ramp.
 */
function ramp(value: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0, [40, 90, 255]],
    [0.35, [40, 220, 120]],
    [0.65, [255, 225, 40]],
    [1, [255, 45, 45]],
  ];
  for (let index = 1; index < stops.length; index += 1) {
    const [end, to] = stops[index];
    const [start, from] = stops[index - 1];
    if (value <= end) {
      const mix = (value - start) / (end - start);
      return [0, 1, 2].map((channel) => Math.round(from[channel] + (to[channel] - from[channel]) * mix)) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * Draws the click heat layer: alpha splats on an offscreen canvas, then colourised by intensity.
 */
function drawClicks(ctx: CanvasRenderingContext2D, width: number, height: number, clicks: [number, number][]): void {
  if (clicks.length === 0) return;
  const shadow = document.createElement('canvas');
  shadow.width = width;
  shadow.height = height;
  const shade = shadow.getContext('2d');
  if (!shade) return;
  const weight = Math.min(0.5, Math.max(0.08, 12 / clicks.length));
  for (const [x, y] of clicks) {
    const px = x * width;
    const py = y * height;
    const gradient = shade.createRadialGradient(px, py, 0, px, py, SPLAT_RADIUS);
    gradient.addColorStop(0, `rgba(0,0,0,${weight})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    shade.fillStyle = gradient;
    shade.fillRect(px - SPLAT_RADIUS, py - SPLAT_RADIUS, SPLAT_RADIUS * 2, SPLAT_RADIUS * 2);
  }
  const image = shade.getImageData(0, 0, width, height);
  const pixels = image.data;
  // Normalise to the hottest pixel so the busiest spot is always red, whatever the volume.
  let peak = 1;
  for (let index = 3; index < pixels.length; index += 4) peak = Math.max(peak, pixels[index]);
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha === 0) continue;
    const heat = alpha / peak;
    const [r, g, b] = ramp(heat);
    pixels[index] = r;
    pixels[index + 1] = g;
    pixels[index + 2] = b;
    pixels[index + 3] = Math.round(70 + heat * 150);
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Shades 20 horizontal bands by their share of the most-viewed band.
 */
function drawAttention(ctx: CanvasRenderingContext2D, width: number, height: number, attention: number[]): void {
  const max = Math.max(1, ...attention);
  const band = height / attention.length;
  attention.forEach((ms, index) => {
    const share = ms / max;
    ctx.fillStyle = `rgba(255, 120, 40, ${0.04 + share * 0.4})`;
    ctx.fillRect(0, index * band, width, band);
  });
}

/**
 * Dashed line every 10% of the page with the share of views that scrolled at least that far.
 */
function drawScroll(ctx: CanvasRenderingContext2D, width: number, height: number, reach: number[], label: (pct: number) => string): void {
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.font = '600 15px system-ui, sans-serif';
  for (let step = 1; step < reach.length; step += 1) {
    const y = (step / 10) * height - 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    const text = label(Math.round(reach[step]));
    const textWidth = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(width - textWidth - 22, y - 26, textWidth + 14, 22);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, width - textWidth - 15, y - 10);
  }
  ctx.setLineDash([]);
}

/**
 * Scaled live page at the device viewport; the overlay spans the whole document and follows the page scroll.
 */
function Stage({ report, device, layers }: { report: PageReport; device: string; layers: Layers }) {
  const t = useT(T);
  const width = FRAME_WIDTH[device] ?? FRAME_WIDTH.desktop;
  const viewport = VIEWPORT_HEIGHT[device] ?? VIEWPORT_HEIGHT.desktop;
  const outer = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [docHeight, setDocHeight] = useState(() => Math.min(MAX_DOC_HEIGHT, report.avg_doc_h || viewport));
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const element = outer.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setScale(Math.min(1, element.clientWidth / width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);

  // The frame is pointer-inert, so wheel over the stage scrolls the framed page instead.
  useEffect(() => {
    const element = outer.current;
    if (!element) return undefined;
    const onWheel = (event: WheelEvent) => {
      const win = frame.current?.contentWindow;
      if (!win) return;
      event.preventDefault();
      win.scrollBy(0, event.deltaY / scale);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [scale]);

  /** Follows the framed page's scroll and measures its height while the SPA finishes rendering. */
  function attach() {
    const win = frame.current?.contentWindow;
    if (!win) return;
    win.addEventListener('scroll', () => setScrollY(win.scrollY), { passive: true });
    [300, 1200, 3000].forEach((delay) =>
      window.setTimeout(() => {
        const doc = frame.current?.contentDocument;
        if (doc) setDocHeight(Math.min(MAX_DOC_HEIGHT, Math.max(doc.documentElement.scrollHeight, viewport)));
      }, delay),
    );
  }

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, docHeight);
    if (layers.attention) drawAttention(ctx, width, docHeight, report.attention_ms);
    if (layers.clicks) drawClicks(ctx, width, docHeight, report.clicks);
    if (layers.scroll) drawScroll(ctx, width, docHeight, report.reach, t.heat.reached);
  }, [report, layers, width, docHeight, t]);

  const src = `${report.path}${report.path.includes('?') ? '&' : '?'}_hm=1`;
  return (
    <div ref={outer} className={styles.stage} style={{ height: viewport * scale }}>
      <div className={styles.stageInner} style={{ width, height: viewport, transform: `scale(${scale})` }}>
        <iframe
          ref={frame}
          className={styles.frame}
          src={src}
          title={report.path}
          width={width}
          height={viewport}
          tabIndex={-1}
          onLoad={attach}
        />
        <canvas
          ref={canvas}
          className={styles.overlay}
          width={width}
          height={docHeight}
          style={{ height: docHeight, transform: `translateY(${-scrollY}px)` }}
        />
      </div>
    </div>
  );
}

/**
 * Heatmap tab: path and device pickers, layer toggles, stage, and most-clicked elements.
 */
export function HeatmapTab({
  range,
  segment,
  path,
  device,
  onChange,
}: {
  range: Range;
  segment: Segment;
  path: string;
  device: string;
  onChange: (path: string, device: string) => void;
}) {
  const t = useT(T);
  const [draft, setDraft] = useState(path);
  const [layers, setLayers] = useState<Layers>({ clicks: true, attention: false, scroll: true });
  const key = `${range.from}|${range.to}|${path}|${device}|${JSON.stringify(segment)}`;
  const { data, error, loading } = useReport(
    () => (path ? fetchPageReport(range, path, device, { ...segment, device: '' }) : Promise.resolve(null)),
    key,
    t.failed,
  );

  useEffect(() => setDraft(path), [path]);

  return (
    <>
      <form
        className={styles.toolbar}
        onSubmit={(event) => {
          event.preventDefault();
          onChange(draft.trim(), device);
        }}
      >
        <label className="field" style={{ flex: '1 1 320px' }}>
          <span>{t.heat.path}</span>
          <input value={draft} placeholder="/lp/code/1/br" onChange={(event) => setDraft(event.target.value)} />
        </label>
        <label className="field">
          <span>{t.heat.device}</span>
          <select value={device} onChange={(event) => onChange(path, event.target.value)}>
            {Object.keys(FRAME_WIDTH).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary btn-sm">
          {t.heat.show}
        </button>
      </form>
      <div className={styles.layers}>
        {(Object.keys(layers) as (keyof Layers)[]).map((name) => (
          <label key={name}>
            <input type="checkbox" checked={layers[name]} onChange={(event) => setLayers({ ...layers, [name]: event.target.checked })} />
            {t.heat.layers[name]}
          </label>
        ))}
      </div>
      {!path ? <p className={styles.note}>{t.heat.pickPage}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
      {path && !data && loading ? <p className={styles.note}>{t.loading}</p> : null}
      {data ? (
        <div className={styles.split}>
          <div>
            <Stage key={`${data.path}|${device}`} report={data} device={device} layers={layers} />
            <p className={styles.note} style={{ marginTop: 8 }}>
              {t.heat.frameNote}
            </p>
          </div>
          <div className="card">
            <dl className={styles.facts}>
              <dt>{t.kpi.views}</dt>
              <dd>{data.summary.views}</dd>
              <dt>{t.kpi.avgTime}</dt>
              <dd>{formatDuration(data.summary.avg_active_ms)}</dd>
              <dt>{t.kpi.avgScroll}</dt>
              <dd>{formatPct(data.summary.avg_scroll)}</dd>
              <dt>{t.kpi.bounce}</dt>
              <dd>{formatPct(data.summary.bounce_rate)}</dd>
              <dt>{t.kpi.clickRate}</dt>
              <dd>{formatPct(data.summary.click_rate)}</dd>
              <dt>{t.cols.clicks}</dt>
              <dd>{data.clicks.length}</dd>
            </dl>
            <h2 className={styles.section}>{t.heat.targets}</h2>
            <div className="table-wrap">
              <table>
                <tbody>
                  {data.targets.map((target) => (
                    <tr key={target.label}>
                      <td className={styles.clip} title={target.label}>
                        {target.label}
                      </td>
                      <td className={styles.num}>{target.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
