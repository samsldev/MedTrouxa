/**
 * Biblioteca de cenas HyperFrames do MedTrouxa.
 * Cada função devolve um arquivo de sub-composição completo (<template> com estilo, marcação e UMA timeline pausada).
 * Motion citado das regras do /hyperframes-animation:
 *   gancho  → kinetic-beat-slam (entradas distintas num grid de pulso = BPM da trilha) + ambient-glow-bloom
 *   dor     → waterfall-entry (título) + css-marker-patterns (risco/destaque) + spring-pop-entrance (ícones)
 *   virada  → spring-pop-entrance (tela e chips) + ambient-glow-bloom (hero) + regras da tela (counting-dynamic-scale, svg-path-draw…)
 *   oferta  → spring-pop-entrance (marca, CTA) + ambient-glow-bloom (sweep no botão) + sine-wave-loop (seta, amplitude baixa)
 * Regras do contrato: fromTo com estado inicial explícito, nada infinito, sem Math.random/Date, sem CSS transform nos alvos.
 */
import { COR, FONT_FACE, estrelas, icone, marca, palavras, rich } from './marca.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ------------------------------------------------------------------ base comum
function baseCss(fmt) {
  const { w, h, pad } = fmt;
  return `${FONT_FACE}
#root { position: absolute; inset: 0; overflow: hidden; background: ${COR.bg}; color: ${COR.tinta}; font-family: "Inter", sans-serif; }
.bg, .bg-glow, .bg-glow2, .bg-stars, .bg-ghost, .bg-rule { position: absolute; pointer-events: none; }
.bg { inset: 0; }
.bg-glow { width: ${Math.round(w * 1.3)}px; height: ${Math.round(w * 1.3)}px; left: ${Math.round(-w * 0.45)}px; top: ${Math.round(-w * 0.55)}px; border-radius: 50%;
  background: radial-gradient(circle, rgba(64, 54, 170, 0.62) 0%, rgba(43, 36, 112, 0.28) 38%, rgba(9, 10, 23, 0) 70%); }
.bg-glow2 { width: ${Math.round(w * 1.1)}px; height: ${Math.round(w * 1.1)}px; right: ${Math.round(-w * 0.5)}px; bottom: ${Math.round(-w * 0.35)}px; border-radius: 50%;
  background: radial-gradient(circle, rgba(212, 176, 108, 0.22) 0%, rgba(212, 176, 108, 0.06) 42%, rgba(9, 10, 23, 0) 70%); }
.bg-stars { inset: 0; width: 100%; height: 100%; }
.bg-ghost { left: ${pad.l - 20}px; bottom: ${Math.round(h * 0.2)}px; font-family: "Cormorant Garamond", serif; font-weight: 700; font-size: ${Math.round(w * 0.36)}px;
  line-height: 0.8; color: ${COR.ouro}; opacity: 0.09; white-space: nowrap; letter-spacing: -0.02em; }
.bg-rule { left: ${pad.l}px; right: ${pad.r}px; height: 3px; background: linear-gradient(90deg, rgba(212,176,108,0.85), rgba(212,176,108,0)); transform-origin: left center; }
.brand { position: absolute; top: ${pad.t - 118}px; left: ${pad.l}px; display: flex; align-items: center; gap: 18px; }
.brand-nome { font-family: "Cormorant Garamond", serif; font-weight: 600; font-size: 46px; color: ${COR.tinta}; letter-spacing: -0.01em; }
.brand-nome em, .t em, .lead em, .big em { font-style: italic; color: ${COR.ouroTexto}; }
.stage { position: absolute; left: ${pad.l}px; right: ${pad.r}px; top: ${pad.t}px; bottom: ${pad.b}px; display: flex; flex-direction: column; justify-content: center; gap: 36px; }
.kick { align-self: flex-start; display: inline-flex; align-items: center; gap: 14px; padding: 14px 26px; border-radius: 999px;
  border: 2px solid rgba(212, 176, 108, 0.55); background: rgba(212, 176, 108, 0.12); color: ${COR.ouroTexto};
  font-weight: 700; font-size: 28px; letter-spacing: 0.16em; text-transform: uppercase; }
.t { font-family: "Cormorant Garamond", serif; font-weight: 700; letter-spacing: -0.015em; line-height: 1.02; color: ${COR.tinta}; }
.lead { font-size: 42px; line-height: 1.35; color: ${COR.muted}; font-weight: 500; }
.w { display: inline-block; }
`;
}

function fundo(sid, fmt, ghost, semente) {
  return `<div class="bg" aria-hidden="true">
    <div class="bg-glow" id="${sid}-glow"></div>
    <div class="bg-glow2" id="${sid}-glow2"></div>
    <svg class="bg-stars" id="${sid}-stars" viewBox="0 0 ${fmt.w} ${fmt.h}" preserveAspectRatio="none">${estrelas(46, fmt.w, fmt.h, semente)}</svg>
    <div class="bg-ghost" id="${sid}-ghost" data-layout-allow-overflow data-layout-allow-occlusion>${esc(ghost)}</div>
    <div class="bg-rule" id="${sid}-rule" style="top:${fmt.h - fmt.pad.b + 40}px"></div>
  </div>
  <div class="brand" id="${sid}-brand">${marca(58)}<span class="brand-nome">Med<em>Trouxa</em></span></div>`;
}

/** Ambiente comum: brilho respira (ambient-glow-bloom, forma "bounded breathe"), fantasma deriva, estrelas cintilam. */
function ambiente(sid, dur, entrada = true) {
  return `
    ${entrada ? `tl.fromTo("#${sid}-glow", { opacity: 0.35, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.9, ease: "power2.out" }, 0);` : ''}
    (function () {
      const g = document.getElementById("${sid}-glow2"), st = document.getElementById("${sid}-stars"), ph = { p: 0 };
      tl.to(ph, { p: Math.PI * 2 * ${Math.max(1, Math.round(dur / 2.4))}, duration: ${dur}, ease: "none", onUpdate: function () {
        const s = Math.sin(ph.p);
        g.style.opacity = String(0.85 + s * 0.15);
        g.style.transform = "scale(" + (1 + s * 0.04) + ")";
        st.style.opacity = String(0.8 + Math.sin(ph.p * 1.7 + 1) * 0.2);
      } }, 0);
    })();
    tl.fromTo("#${sid}-ghost", { x: 0 }, { x: -120, duration: ${dur}, ease: "none" }, 0);
    tl.fromTo("#${sid}-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power3.out" }, 0.15);
    tl.fromTo("#${sid}-brand", { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, 0.05);`;
}

function arquivo(sid, fmt, css, corpo, js) {
  return `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="UTF-8" /></head>
  <body>
    <template>
      <style>
${baseCss(fmt)}
${css}
      </style>
      <div id="root" data-composition-id="${sid}" data-width="${fmt.w}" data-height="${fmt.h}">
${corpo}
      </div>
      <script>
        const tl = gsap.timeline({ paused: true });
${js}
        window.__timelines["${sid}"] = tl;
      </script>
    </template>
  </body>
</html>
`;
}

/** Cascata palavra a palavra (waterfall-entry): opacidade binária via set, subida power4.out, sobreposição de 1 quadro. */
function cascata(seletor, t0, travessia = 56) {
  return `(function () {
      const F = 1 / 60; let t = ${t0};
      document.querySelectorAll("${seletor}").forEach(function (el, i, all) {
        const pesada = i === 0, ultima = i === all.length - 1;
        const dy = pesada ? ${travessia + 20} : ultima ? ${travessia + 10} : ${travessia};
        const d = pesada ? 0.19 : ultima ? 0.17 : 0.15;
        tl.set(el, { opacity: 1, y: dy }, t);
        tl.to(el, { y: 0, duration: d, ease: "power4.out" }, t);
        t += d - F;
      });
    })();`;
}

const spans = (texto, cls) => palavras(texto).map(({ w, em }) => `<span class="w ${cls}" style="opacity:0">${em ? `<em>${w}</em>` : w}</span>`).join(' ');

// ------------------------------------------------------------------ telas do app (recriadas em HTML)
const MOCK_CSS = `
.app { position: relative; align-self: stretch; border-radius: 34px; background: ${COR.bg2}; border: 2px solid ${COR.borda};
  box-shadow: 0 40px 90px -30px rgba(0,0,0,0.75), 0 0 0 1px rgba(212,176,108,0.08); padding: 40px 42px; display: flex; flex-direction: column; gap: 22px; }
.app-glow { position: absolute; inset: -140px; border-radius: 50%; background: radial-gradient(circle, rgba(212,176,108,0.30) 0%, rgba(212,176,108,0) 62%); z-index: 0; }
.app > *:not(.app-glow) { position: relative; z-index: 1; }
.pills { display: flex; gap: 12px; flex-wrap: wrap; }
.pill { padding: 8px 18px; border-radius: 999px; background: ${COR.bg3}; color: ${COR.muted}; font-weight: 600; font-size: 26px; }
.pill.ok { background: rgba(95,211,154,0.14); color: ${COR.ok}; }
.pill.ouro { background: rgba(212,176,108,0.16); color: ${COR.ouroTexto}; }
.enun { font-size: 34px; line-height: 1.42; color: ${COR.tinta}; font-weight: 500; }
.alt { display: flex; align-items: center; gap: 20px; padding: 18px 22px; border-radius: 18px; border: 2px solid ${COR.borda}; background: ${COR.bg}; font-size: 30px; color: ${COR.tinta}; }
.alt b { display: grid; place-items: center; width: 50px; height: 50px; flex: none; border-radius: 50%; border: 2px solid ${COR.borda}; font-size: 26px; color: ${COR.muted}; }
.feedback { display: flex; align-items: center; gap: 14px; padding: 18px 24px; border-radius: 18px; background: rgba(95,211,154,0.14); color: ${COR.ok}; font-weight: 700; font-size: 32px; }
.bar { height: 16px; border-radius: 16px; background: ${COR.bg3}; overflow: hidden; }
.bar i { display: block; width: 100%; height: 100%; background: linear-gradient(90deg, #f1dca4, #d2ad63 40%, #a57e3c 70%, #e6c982); transform-origin: left center; }
.item { display: flex; align-items: center; gap: 20px; padding: 16px 0; border-top: 2px solid ${COR.bg3}; font-size: 30px; color: ${COR.tinta}; }
.box { display: grid; place-items: center; width: 46px; height: 46px; flex: none; border-radius: 12px; border: 2.5px solid ${COR.borda}; }
.box .ico { opacity: 0; }
.dia { color: ${COR.ouroTexto}; font-weight: 700; font-size: 24px; letter-spacing: 0.06em; text-transform: uppercase; display: block; }
.bubble { max-width: 86%; padding: 22px 28px; border-radius: 28px; font-size: 32px; line-height: 1.42; }
.bubble.me { align-self: flex-end; background: #1f2352; color: ${COR.tinta}; border-bottom-right-radius: 8px; }
.bubble.ia { align-self: flex-start; background: ${COR.bg}; border: 2px solid ${COR.borda}; color: ${COR.tinta}; border-bottom-left-radius: 8px; }
.avatar { display: flex; align-items: center; gap: 14px; color: ${COR.ouroTexto}; font-weight: 700; font-size: 26px; }
.avatar span { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 50%; background: rgba(212,176,108,0.16); }
.flip { position: relative; height: 360px; perspective: 1400px; }
.flip-in { position: absolute; inset: 0; transform-style: preserve-3d; }
.face { position: absolute; inset: 0; border-radius: 26px; display: grid; place-items: center; padding: 40px; text-align: center; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.face.frente { background: #1f2352; font-family: "Cormorant Garamond", serif; font-weight: 700; font-size: 58px; line-height: 1.1; color: ${COR.tinta}; }
.face.verso { background: ${COR.bg}; border: 2.5px solid ${COR.ouro}; font-size: 54px; font-weight: 700; color: ${COR.tinta}; }
.face small { position: absolute; top: 26px; font-family: "Inter", sans-serif; font-size: 22px; letter-spacing: 0.18em; color: ${COR.ouroTexto}; font-weight: 700; }
.grades { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.grade { text-align: center; padding: 18px 0; border-radius: 16px; border: 2.5px solid; font-weight: 700; font-size: 28px; }
.timer { display: flex; align-items: center; gap: 12px; color: ${COR.ouroTexto}; font-weight: 800; font-size: 40px; font-variant-numeric: tabular-nums; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.btn-app { text-align: center; padding: 22px; border-radius: 18px; background: linear-gradient(135deg, #f1dca4, #d2ad63 30%, #a57e3c 55%, #e6c982 80%, #b8904f); color: #1a1406; font-weight: 800; font-size: 32px; }
`;

function mock(tipo, s) {
  switch (tipo) {
    case 'questao':
      return `<div class="app" id="${s}-app"><div class="app-glow" id="${s}-appglow"></div>
        <div class="pills"><span class="pill">Cardiologia</span><span class="pill">ENAMED 2025</span><span class="pill ouro">Média</span></div>
        <div class="enun">IAM com supra de ST, sem hemodinâmica: transferência levaria 3 horas. Qual a conduta?</div>
        ${[['A', 'Aguardar troponina'], ['B', 'Trombólise em até 30 min'], ['C', 'Transferir para angioplastia']].map(([k, t], i) => `<div class="alt" id="${s}-alt${i}"><b id="${s}-altb${i}">${k}</b><span>${t}</span></div>`).join('')}
        <div class="feedback" id="${s}-fb">${icone('check', 36, COR.ok, 2.6)}<span>Acertou! +10 XP</span></div>
      </div>`;
    case 'cronograma':
      return `<div class="app" id="${s}-app"><div class="app-glow" id="${s}-appglow"></div>
        <div class="row"><span class="t" style="font-size:52px">ENAMED · 90 dias</span><span class="pill ouro"><span id="${s}-pct">0</span>%</span></div>
        <div class="bar"><i id="${s}-fill"></i></div>
        ${[['Dia 12', 'Questões: Cardiologia'], ['Dia 13', 'Flashcards: Arritmias'], ['Dia 14', 'Simulado cronometrado'], ['Dia 15', 'Revisão: o que mais cai']].map(([d, t], i) => `<div class="item" id="${s}-it${i}"><span class="box" id="${s}-box${i}">${icone('check', 30, COR.ok, 3)}</span><span><span class="dia">${d}</span>${t}</span></div>`).join('')}
      </div>`;
    case 'chat':
      return `<div class="app" id="${s}-app"><div class="app-glow" id="${s}-appglow"></div>
        <div class="bubble me" id="${s}-me">Por que não é a letra A?</div>
        <div class="avatar" id="${s}-av"><span>${icone('owl', 32, COR.ouro, 2)}</span>Coruja</div>
        <div class="bubble ia" id="${s}-ia">${spans('Porque no IAM com supra a troponina *não pode atrasar* a reperfusão. Sem hemodinâmica em até 120 min, a conduta é fibrinólise em até 30 min.', `${s}-iaw`)}</div>
      </div>`;
    case 'flashcard':
      return `<div class="app" id="${s}-app"><div class="app-glow" id="${s}-appglow"></div>
        <div class="flip"><div class="flip-in" id="${s}-flip">
          <div class="face frente" data-layout-allow-overlap><small data-layout-allow-overlap>PERGUNTA</small>Tempo porta-agulha na fibrinólise?</div>
          <div class="face verso" data-layout-allow-overlap style="transform: rotateY(180deg)"><small data-layout-allow-overlap>RESPOSTA</small>≤ 30 minutos</div>
        </div></div>
        <div class="grades">${[['Errei', COR.ko], ['Difícil', COR.ouroTexto], ['Bom', COR.ok], ['Fácil', COR.arcano]].map(([t, c], i) => `<div class="grade" id="${s}-g${i}" style="border-color:${c};color:${c}">${t}</div>`).join('')}</div>
        <div class="feedback" id="${s}-fb">${icone('calendar', 34, COR.ok, 2.4)}<span>Volta para revisão em 6 dias</span></div>
      </div>`;
    case 'simulado':
      return `<div class="app" id="${s}-app"><div class="app-glow" id="${s}-appglow"></div>
        <div class="row"><span class="t" style="font-size:50px">Simulado ENAMED</span><span class="timer">${icone('timer', 40, COR.ouro, 2.4)}<span id="${s}-clock">30:00</span></span></div>
        <div class="bar"><i id="${s}-fill"></i></div>
        <div class="enun">Lactente com febre alta por 3 dias que cessa, seguida de exantema. Diagnóstico?</div>
        ${[['A', 'Sarampo'], ['B', 'Exantema súbito'], ['C', 'Rubéola']].map(([k, t], i) => `<div class="alt" id="${s}-alt${i}"><b id="${s}-altb${i}">${k}</b><span>${t}</span></div>`).join('')}
        <div class="btn-app">Finalizar (<span id="${s}-n">6</span>/10)</div>
      </div>`;
    default:
      throw new Error(`mock desconhecido: ${tipo}`);
  }
}

/** Animação interna de cada tela (tempos locais da cena, a partir de t0). */
function mockJs(tipo, s, t0) {
  const altIn = (n) => `for (let i = 0; i < ${n}; i++) tl.fromTo("#${s}-alt" + i, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.35, ease: "power3.out" }, ${t0} + 0.25 + i * 0.08);`;
  switch (tipo) {
    case 'questao':
      return `${altIn(3)}
      tl.to("#${s}-alt1", { borderColor: "${COR.ouro}", backgroundColor: "rgba(212,176,108,0.12)", duration: 0.2 }, ${t0} + 0.95);
      tl.to("#${s}-alt1", { borderColor: "${COR.ok}", backgroundColor: "rgba(95,211,154,0.14)", duration: 0.25 }, ${t0} + 1.45);
      tl.to("#${s}-altb1", { backgroundColor: "${COR.ok}", borderColor: "${COR.ok}", color: "#0b1a12", duration: 0.25 }, ${t0} + 1.45);
      tl.fromTo("#${s}-fb", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.45, ease: "power3.out" }, ${t0} + 1.6);`;
    case 'cronograma':
      return `(function () { const pct = document.getElementById("${s}-pct"), st = { v: 0 };
        tl.to(st, { v: 34, duration: 1.4, ease: "power2.out", onUpdate: function () { pct.textContent = String(Math.round(st.v)); } }, ${t0} + 0.3); })();
      tl.fromTo("#${s}-fill", { scaleX: 0 }, { scaleX: 0.34, duration: 1.4, ease: "power2.out" }, ${t0} + 0.3);
      for (let i = 0; i < 4; i++) {
        tl.fromTo("#${s}-it" + i, { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.35, ease: "power3.out" }, ${t0} + 0.3 + i * 0.08);
        tl.to("#${s}-box" + i, { backgroundColor: "rgba(95,211,154,0.18)", borderColor: "${COR.ok}", duration: 0.2 }, ${t0} + 1.0 + i * 0.32);
        tl.fromTo("#${s}-box" + i + " .ico", { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power3.out" }, ${t0} + 1.0 + i * 0.32);
      }`;
    case 'chat':
      return `tl.fromTo("#${s}-me", { opacity: 0, y: 30, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "power3.out" }, ${t0} + 0.3);
      tl.fromTo("#${s}-av", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.35, ease: "power3.out" }, ${t0} + 0.85);
      tl.fromTo("#${s}-ia", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, ${t0} + 1.0);
      (function () { let t = ${t0} + 1.15; document.querySelectorAll(".${s}-iaw").forEach(function (el) {
        tl.set(el, { opacity: 1, y: 12 }, t); tl.to(el, { y: 0, duration: 0.12, ease: "power4.out" }, t); t += 0.075; }); })();`;
    case 'flashcard':
      return `tl.fromTo("#${s}-flip", { rotationY: 0, transformPerspective: 1400 }, { rotationY: 180, transformPerspective: 1400, duration: 0.7, ease: "power3.inOut" }, ${t0} + 0.9);
      for (let i = 0; i < 4; i++) tl.fromTo("#${s}-g" + i, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power3.out" }, ${t0} + 1.55 + i * 0.06);
      tl.to("#${s}-g2", { scale: 0.9, duration: 0.1, ease: "power2.in" }, ${t0} + 2.1);
      tl.to("#${s}-g2", { scale: 1, backgroundColor: "rgba(95,211,154,0.2)", duration: 0.35, ease: "power3.out" }, ${t0} + 2.2);
      tl.fromTo("#${s}-fb", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, ${t0} + 2.35);`;
    case 'simulado':
      return `${altIn(3)}
      (function () { const c = document.getElementById("${s}-clock"), n = document.getElementById("${s}-n"), st = { v: 1800 };
        // um único proxy dirige relógio e contador de questões — estado puro do tempo (seek-safe)
        tl.to(st, { v: 1792, duration: 3.2, ease: "none", onUpdate: function () {
          const s2 = Math.ceil(st.v); c.textContent = String(Math.floor(s2 / 60)).padStart(2, "0") + ":" + String(s2 % 60).padStart(2, "0");
          n.textContent = st.v <= 1796 ? "7" : "6"; } }, ${t0}); })();
      tl.fromTo("#${s}-fill", { scaleX: 0.6 }, { scaleX: 0.7, duration: 0.5, ease: "power2.out" }, ${t0} + 1.6);
      tl.to("#${s}-alt1", { borderColor: "${COR.ouro}", backgroundColor: "rgba(212,176,108,0.12)", duration: 0.2 }, ${t0} + 1.2);
      tl.to("#${s}-altb1", { backgroundColor: "${COR.ouro}", borderColor: "${COR.ouro}", color: "#1a1406", duration: 0.2 }, ${t0} + 1.2);`;
    default:
      return '';
  }
}

// ------------------------------------------------------------------ CENAS DE VÍDEO

/** Gancho: kinetic-beat-slam, entradas distintas travadas no pulso da trilha. */
export function cenaGancho(sid, fmt, ad, bpm) {
  const g = ad.gancho;
  const PULSE = (60 / bpm).toFixed(4);
  let corpo, css, js;
  if (!g.tipo || g.tipo === 'titulo' || g.linhas) {
    css = `.g-line { font-size: ${fmt.h > 1500 ? 124 : 104}px; opacity: 0; display: block; }
      .g-line em { font-style: italic; color: ${COR.ouroTexto}; }
      .g-metro { display: flex; gap: 16px; margin-top: 18px; }
      .g-metro i { display: block; width: 10px; height: 42px; border-radius: 6px; background: ${COR.ouro}; opacity: 0.22; }`;
    corpo = `<div class="stage">
        <div class="kick" id="${sid}-kick">${icone('spark', 28, COR.ouro, 2.2)}${esc(g.kicker)}</div>
        <div>${g.linhas.map((l, i) => `<span class="t g-line" id="${sid}-l${i}">${rich(l)}</span>`).join('')}</div>
        <div class="g-metro" aria-hidden="true">${'<i></i>'.repeat(4)}</div>
      </div>`;
    js = `const PULSE = ${PULSE}, BEATS = [0.2, 0.2 + PULSE, 0.2 + PULSE * 2];
      tl.fromTo("#${sid}-kick", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" }, 0.05);
      tl.fromTo("#${sid}-l0", { opacity: 0, scale: 1.35, filter: "blur(14px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.5, ease: "power4.out" }, BEATS[0]);
      tl.fromTo("#${sid}-l1", { opacity: 0, x: -260 }, { opacity: 1, x: 0, duration: 0.45, ease: "expo.out" }, BEATS[1]);
      tl.fromTo("#${sid}-l2", { opacity: 0, y: 90, rotation: 4 }, { opacity: 1, y: 0, rotation: 0, duration: 0.55, ease: "circ.out" }, BEATS[2]);
      document.querySelectorAll("#root .g-metro i").forEach(function (tick, i) {
        tl.fromTo(tick, { opacity: 0.22 }, { opacity: 1, duration: 0.08, yoyo: true, repeat: 1, ease: "none" }, 0.2 + PULSE * i);
      });`;
  } else {
    // enquete / quiz (Stories): cartão de pergunta com opções; a opção escolhida acende (sem porcentagens inventadas)
    const quiz = g.tipo === 'quiz';
    css = `.g-q { font-size: ${quiz ? 76 : 86}px; opacity: 0; }
      .g-card { border-radius: 34px; background: ${COR.bg2}; border: 2px solid ${COR.borda}; padding: 30px; display: flex; flex-direction: column; gap: 18px; }
      .g-op { display: flex; align-items: center; gap: 22px; padding: 26px 28px; border-radius: 22px; border: 2.5px solid ${COR.borda}; background: ${COR.bg}; font-size: 38px; font-weight: 600; color: ${COR.tinta}; opacity: 0; }
      .g-op b { display: grid; place-items: center; width: 58px; height: 58px; flex: none; border-radius: 50%; border: 2.5px solid ${COR.borda}; font-size: 28px; color: ${COR.muted}; }
      .g-op .ico { margin-left: auto; opacity: 0; }`;
    corpo = `<div class="stage">
        <div class="kick" id="${sid}-kick">${icone('spark', 28, COR.ouro, 2.2)}${esc(g.kicker)}</div>
        <div class="t g-q" id="${sid}-q">${rich(g.pergunta)}</div>
        <div class="g-card" id="${sid}-card">${g.opcoes.map((o, i) => `<div class="g-op" id="${sid}-op${i}"><b id="${sid}-opb${i}">${quiz ? 'ABCD'[i] : ''}${quiz ? '' : icone(i ? 'x' : 'check', 28, COR.muted, 2.4)}</b><span>${esc(o)}</span>${icone('check', 40, COR.ok, 3)}</div>`).join('')}</div>
      </div>`;
    js = `tl.fromTo("#${sid}-kick", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.4, ease: "power3.out" }, 0.05);
      tl.fromTo("#${sid}-q", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.5, ease: "power4.out" }, 0.2);
      for (let i = 0; i < ${g.opcoes.length}; i++) tl.fromTo("#${sid}-op" + i, { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.35, ease: "power3.out" }, 0.6 + i * 0.09);
      tl.to("#${sid}-op${g.escolhida}", { borderColor: "${quiz ? COR.ok : COR.ouro}", backgroundColor: "${quiz ? 'rgba(95,211,154,0.14)' : 'rgba(212,176,108,0.14)'}", scale: 1.03, duration: 0.3, ease: "power3.out" }, 1.75);
      tl.to("#${sid}-opb${g.escolhida}", { backgroundColor: "${quiz ? COR.ok : COR.ouro}", borderColor: "${quiz ? COR.ok : COR.ouro}", color: "#0b1a12", duration: 0.3 }, 1.75);
      tl.fromTo("#${sid}-op${g.escolhida} > .ico", { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power3.out" }, 1.85);
      ${g.opcoes.map((_, i) => i === g.escolhida ? '' : `tl.to("#${sid}-op${i}", { opacity: 0.45, duration: 0.3 }, 1.8);`).join('\n      ')}`;
  }
  js = `${ambiente(sid, 3.0)}
      ${js}`;
  return arquivo(sid, fmt, css, `${fundo(sid, fmt, ad.ghost, 1)}\n${corpo}`, js);
}

/** Dor: título em cascata (waterfall-entry), itens riscados (css-marker-patterns: highlight fino como risco), fecho com destaque. */
export function cenaDor(sid, fmt, ad) {
  const d = ad.dor;
  const css = `.d-tit { font-size: ${fmt.h > 1500 ? 96 : 84}px; }
    .d-list { display: flex; flex-direction: column; gap: 26px; }
    .d-it { display: flex; align-items: center; gap: 26px; opacity: 0; }
    .d-x { display: grid; place-items: center; width: 70px; height: 70px; flex: none; border-radius: 50%; background: rgba(240,138,128,0.16); border: 2.5px solid rgba(240,138,128,0.6); }
    .d-num { display: grid; place-items: center; width: 70px; height: 70px; flex: none; border-radius: 50%; background: rgba(212,176,108,0.14); border: 2.5px solid rgba(212,176,108,0.6);
      font-family: "Cormorant Garamond", serif; font-weight: 700; font-size: 44px; color: ${COR.ouroTexto}; }
    .d-txt { position: relative; display: inline-block; font-size: 46px; font-weight: 600; color: ${COR.tinta}; }
    .d-strike { position: absolute; left: -8px; right: -8px; top: 52%; height: 6px; border-radius: 3px; background: ${COR.ko}; transform-origin: left center; }
    .d-fecho { font-family: "Cormorant Garamond", serif; font-weight: 700; font-size: ${fmt.h > 1500 ? 72 : 64}px; line-height: 1.08; opacity: 0; color: ${COR.tinta}; }
    .d-fecho em { position: relative; isolation: isolate; display: inline-block; font-style: italic; color: ${COR.ouroTexto}; }
    .d-hl { position: absolute; left: -10px; right: -10px; bottom: 6px; height: 22px; border-radius: 6px; background: rgba(212,176,108,0.28); transform-origin: left center; z-index: 0; }
    .d-emt { position: relative; z-index: 1; }
    .d-curva { width: 100%; height: auto; }
    .d-leg { font-size: 40px; line-height: 1.4; color: ${COR.muted}; font-weight: 500; opacity: 0; }`;
  let corpo, js;
  const fecho = d.fecho ? rich(d.fecho).replace(/<em>(.*?)<\/em>/, `<em><span class="d-hl" id="${sid}-hl"></span><span class="d-emt">$1</span></em>`) : '';
  if (d.tipo === 'curva') {
    // Curva do esquecimento qualitativa (sem números): svg-path-draw com pathLength=1 (sem medir DOM)
    corpo = `<div class="stage">
        <div class="t d-tit">${spans(d.titulo, `${sid}-tw`)}</div>
        <svg class="d-curva" viewBox="0 0 900 520" aria-label="Curva do esquecimento">
          <line x1="60" y1="460" x2="880" y2="460" stroke="${COR.borda}" stroke-width="4"/><line x1="60" y1="40" x2="60" y2="460" stroke="${COR.borda}" stroke-width="4"/>
          <text x="80" y="30" fill="${COR.muted}" font-family="Inter" font-weight="600" font-size="28">Quanto você lembra</text>
          <text x="880" y="506" fill="${COR.muted}" font-family="Inter" font-weight="600" font-size="28" text-anchor="end">dias sem revisar →</text>
          <path id="${sid}-curve" d="M60 70 C 150 300, 260 380, 420 410 S 760 440, 880 445" fill="none" stroke="${COR.ko}" stroke-width="9" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
          <path id="${sid}-curve2" d="M60 70 C 200 150, 240 170, 300 130 C 380 90, 470 170, 540 140 C 620 110, 720 150, 880 118" fill="none" stroke="${COR.ok}" stroke-width="9" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1" pathLength="1"/>
          <circle id="${sid}-dot" cx="880" cy="445" r="16" fill="${COR.ko}" opacity="0"/>
        </svg>
        <div class="d-leg" id="${sid}-leg">${rich(d.legenda)}</div>
      </div>`;
    js = `${cascata(`.${sid}-tw`, 0.1)}
      tl.fromTo("#${sid}-curve", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.3, ease: "power2.inOut" }, 0.7);
      tl.fromTo("#${sid}-dot", { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, transformOrigin: "50% 50%", duration: 0.3, ease: "power3.out" }, 1.95);
      tl.fromTo("#${sid}-leg", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, 2.1);
      tl.fromTo("#${sid}-curve2", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" }, 2.7);`;
  } else {
    const numerado = d.tipo === 'sinais';
    corpo = `<div class="stage">
        <div class="t d-tit">${spans(d.titulo, `${sid}-tw`)}</div>
        <div class="d-list">${d.itens.map((it, i) => `<div class="d-it" id="${sid}-it${i}">
          ${numerado ? `<span class="d-num">${i + 1}</span>` : `<span class="d-x">${icone('x', 36, COR.ko, 3)}</span>`}
          <span class="d-txt">${esc(it)}${numerado ? '' : `<span class="d-strike" id="${sid}-st${i}"></span>`}</span></div>`).join('')}</div>
        ${fecho ? `<div class="d-fecho" id="${sid}-fecho">${fecho}</div>` : ''}
      </div>`;
    js = `${cascata(`.${sid}-tw`, 0.08)}
      for (let i = 0; i < ${d.itens.length}; i++) {
        tl.fromTo("#${sid}-it" + i, { opacity: 0, x: 70 }, { opacity: 1, x: 0, duration: 0.35, ease: "power3.out" }, 0.6 + i * 0.42);
        ${numerado ? '' : `tl.fromTo("#${sid}-st" + i, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power2.out" }, 0.9 + i * 0.42);
        tl.to("#${sid}-it" + i + " .d-txt", { color: "${COR.muted}", duration: 0.3 }, 0.95 + i * 0.42);`}
      }
      ${fecho ? `tl.fromTo("#${sid}-fecho", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 2.25);
      tl.fromTo("#${sid}-hl", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power2.out" }, 2.7);` : ''}`;
  }
  return arquivo(sid, fmt, css, `${fundo(sid, fmt, ad.ghost, 2)}\n${corpo}`, `${ambiente(sid, 4.0, false)}\n      ${js}`);
}

/** Virada: título + tela do produto com brilho (spring-pop + ambient-glow-bloom) + chips em grupo. */
export function cenaVirada(sid, fmt, ad) {
  const v = ad.virada;
  const css = `${MOCK_CSS}
    .v-tit { font-size: ${fmt.h > 1500 ? 88 : 78}px; }
    .v-chips { display: flex; flex-wrap: wrap; gap: 14px; }
    .v-chip { display: inline-flex; align-items: center; gap: 12px; padding: 14px 22px; border-radius: 999px; background: rgba(212,176,108,0.14); border: 2px solid rgba(212,176,108,0.45);
      color: ${COR.tinta}; font-weight: 600; font-size: 29px; opacity: 0; }
    .v-stage { gap: 30px; }`;
  const corpo = `<div class="stage v-stage">
      <div class="kick" id="${sid}-kick">${icone('spark', 28, COR.ouro, 2.2)}${esc(v.kicker)}</div>
      <div class="t v-tit">${spans(v.titulo, `${sid}-tw`)}</div>
      ${mock(v.mock, sid)}
      <div class="v-chips">${v.chips.map((c, i) => `<span class="v-chip" id="${sid}-c${i}">${icone('check', 28, COR.ouro, 2.6)}${esc(c)}</span>`).join('')}</div>
    </div>`;
  const js = `${ambiente(sid, 4.5, false)}
      tl.fromTo("#${sid}-kick", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" }, 0.0);
      ${cascata(`.${sid}-tw`, 0.12)}
      tl.fromTo("#${sid}-app", { opacity: 0, scale: 0.86, y: 60 }, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.45);
      tl.fromTo("#${sid}-appglow", { opacity: 0, scale: 0.7 }, { opacity: 0.9, scale: 1, duration: 0.8, ease: "power2.out" }, 0.45);
      ${mockJs(v.mock, sid, 0.45)}
      (function () { const n = ${v.chips.length}, st = Math.min(0.08, 0.5 / n);
        for (let i = 0; i < n; i++) tl.fromTo("#${sid}-c" + i, { opacity: 0, scale: 0.6, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "power3.out" }, 3.0 + i * st); })();`;
  return arquivo(sid, fmt, css, `${fundo(sid, fmt, ad.ghost, 3)}\n${corpo}`, js);
}

/** Oferta: marca + oferta real + CTA (spring-pop, sweep de brilho no botão, seta com sine-wave-loop baixo). */
export function cenaOferta(sid, fmt, ad, stories) {
  const o = ad.oferta;
  const css = `.o-stage { align-items: center; text-align: center; gap: 34px; }
    .o-logo { display: flex; flex-direction: column; align-items: center; gap: 22px; opacity: 0; }
    .o-logo .brand-nome { font-size: 96px; }
    .o-halo { position: absolute; width: 900px; height: 900px; left: 50%; top: 30%; margin-left: -450px; margin-top: -450px; border-radius: 50%;
      background: radial-gradient(circle, rgba(212,176,108,0.36) 0%, rgba(212,176,108,0.08) 45%, rgba(212,176,108,0) 70%); opacity: 0; }
    .o-tit { font-size: ${fmt.h > 1500 ? 112 : 96}px; }
    .o-linha { font-size: 42px; line-height: 1.35; color: ${COR.muted}; font-weight: 500; max-width: 860px; opacity: 0; }
    .o-cta { position: relative; overflow: hidden; display: inline-flex; align-items: center; gap: 20px; padding: 34px 56px; border-radius: 26px;
      background: linear-gradient(135deg, #f1dca4 0%, #d2ad63 28%, #a57e3c 52%, #e6c982 78%, #b8904f 100%);
      color: #1a1406; font-weight: 800; font-size: 46px; box-shadow: 0 30px 70px -20px rgba(212,176,108,0.55); opacity: 0; }
    .o-sheen { position: absolute; top: -20%; bottom: -20%; width: 140px; left: -200px; background: linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.65) 50%, rgba(255,255,255,0) 100%); }
    .o-arrow { display: inline-block; }
    .o-rodape { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 600; color: ${COR.muted}; opacity: 0; }
    .o-swipe { display: flex; flex-direction: column; align-items: center; gap: 6px; color: ${COR.ouroTexto}; font-weight: 700; font-size: 30px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0; }`;
  const corpo = `<div class="o-halo" id="${sid}-halo"></div>
    <div class="stage o-stage">
      <div class="o-logo" id="${sid}-logo">${marca(150)}<span class="brand-nome">Med<em>Trouxa</em></span></div>
      <div class="t o-tit">${spans(o.titulo, `${sid}-tw`)}</div>
      <div class="o-linha" id="${sid}-linha">${rich(o.linha)}</div>
      <div class="o-cta" id="${sid}-cta"><span class="o-sheen" id="${sid}-sheen" data-layout-allow-overflow></span><span>${esc(o.cta)}</span><span class="o-arrow" id="${sid}-arrow">${icone(stories ? 'up' : 'arrow', 46, '#1a1406', 3)}</span></div>
      <div class="o-rodape" id="${sid}-rod">${icone('shield', 32, COR.ouro, 2.2)}<span>${esc(o.rodape)}</span></div>
      ${stories ? `<div class="o-swipe" id="${sid}-swipe">${icone('up', 44, COR.ouro, 2.6)}Toque no link</div>` : ''}
    </div>`;
  const js = `${ambiente(sid, 3.5, false)}
      tl.fromTo("#${sid}-halo", { opacity: 0, scale: 0.6 }, { opacity: 0.95, scale: 1, duration: 0.8, ease: "power2.out" }, 0.0);
      tl.fromTo("#${sid}-logo", { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.55, ease: "power3.out" }, 0.05);
      ${cascata(`.${sid}-tw`, 0.45, 50)}
      tl.fromTo("#${sid}-linha", { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, 0.95);
      tl.fromTo("#${sid}-cta", { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.55, ease: "power3.out" }, 1.2);
      tl.fromTo("#${sid}-sheen", { x: 0, opacity: 0 }, { x: 1000, opacity: 1, duration: 0.9, ease: "none" }, 1.8);
      tl.fromTo("#${sid}-rod", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 1.55);
      tl.fromTo("#${sid}-arrow", { x: 0, y: 0 }, { ${stories ? 'y: -8' : 'x: 8'}, duration: 0.35, ease: "sine.inOut", yoyo: true, repeat: 3 }, 2.0);
      ${stories ? `tl.fromTo("#${sid}-swipe", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 1.7);
      tl.to("#${sid}-swipe", { y: -10, duration: 0.3, ease: "sine.inOut", yoyo: true, repeat: 3 }, 2.2);` : ''}`;
  return arquivo(sid, fmt, css, `${fundo(sid, fmt, ad.ghost, 4)}\n${corpo}`, js);
}

// ------------------------------------------------------------------ LÂMINAS DE CARROSSEL (estáticas)

export function lamina(sid, fmt, car, idx) {
  const L = car.laminas[idx];
  const total = car.laminas.length;
  const css = `${MOCK_CSS}
    .c-stage { gap: 34px; }
    .c-cont { position: absolute; top: ${fmt.pad.t - 110}px; right: ${fmt.pad.r}px; font-weight: 700; font-size: 30px; letter-spacing: 0.1em; color: ${COR.ouroTexto}; }
    .c-swipe { position: absolute; bottom: 58px; right: ${fmt.pad.r}px; display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 28px; color: ${COR.muted}; letter-spacing: 0.08em; text-transform: uppercase; }
    .c-big { font-size: 118px; }
    .c-tit { font-size: 84px; }
    .c-sub { font-size: 44px; line-height: 1.4; color: ${COR.muted}; font-weight: 500; }
    .c-list { display: flex; flex-direction: column; gap: 28px; }
    .c-it { display: flex; align-items: center; gap: 26px; font-size: 44px; font-weight: 600; color: ${COR.tinta}; }
    .c-x { display: grid; place-items: center; width: 72px; height: 72px; flex: none; border-radius: 50%; background: rgba(240,138,128,0.16); border: 2.5px solid rgba(240,138,128,0.6); }
    .c-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
    .c-card { border-radius: 28px; background: ${COR.bg2}; border: 2px solid ${COR.borda}; padding: 30px; display: flex; flex-direction: column; gap: 12px; }
    .c-card span.ic { display: grid; place-items: center; width: 70px; height: 70px; border-radius: 20px; background: rgba(212,176,108,0.16); }
    .c-card b { font-size: 38px; color: ${COR.tinta}; }
    .c-card small { font-size: 28px; color: ${COR.muted}; line-height: 1.35; }
    .c-cta { align-self: flex-start; display: inline-flex; align-items: center; gap: 18px; padding: 30px 48px; border-radius: 24px;
      background: linear-gradient(135deg, #f1dca4 0%, #d2ad63 28%, #a57e3c 52%, #e6c982 78%, #b8904f 100%); color: #1a1406; font-weight: 800; font-size: 44px; }
    .c-rod { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 600; color: ${COR.muted}; }
    .c-texto { font-size: 40px; line-height: 1.45; color: ${COR.muted}; font-weight: 500; }
    .c-mock .app { padding: 30px 34px; gap: 16px; }
    .c-mock .flip { height: 250px; }
    .c-mock .face.frente { font-size: 48px; }
    .c-mock .face.verso { transform: rotateY(0deg) !important; }
    .c-mock .flip-in .face.frente { display: none; }`;
  let corpo;
  switch (L.tipo) {
    case 'capa':
      corpo = `<div class="kick">${icone('spark', 28, COR.ouro, 2.2)}${esc(L.kicker)}</div>
        <div class="t c-big">${rich(L.titulo)}</div>
        <div class="c-sub">${rich(L.sub)}</div>`;
      break;
    case 'lista':
      corpo = `<div class="t c-tit">${rich(L.titulo)}</div>
        <div class="c-list">${L.itens.map((it) => `<div class="c-it"><span class="c-x">${icone('x', 36, COR.ko, 3)}</span><span>${esc(it)}</span></div>`).join('')}</div>`;
      break;
    case 'explica':
      corpo = `<div class="kick">${icone('spark', 28, COR.ouro, 2.2)}${esc(L.kicker)}</div>
        <div class="t c-tit">${rich(L.titulo)}</div>
        <div class="c-texto">${rich(L.texto)}</div>
        <div class="c-mock">${mockEstatico(L.mock, sid)}</div>`;
      break;
    case 'recursos':
      corpo = `<div class="t c-tit">${rich(L.titulo)}</div>
        <div class="c-grid">${L.itens.map(([ic, b, sm]) => `<div class="c-card"><span class="ic">${icone(ic, 40, COR.ouro, 2)}</span><b>${esc(b)}</b><small>${esc(sm)}</small></div>`).join('')}</div>`;
      break;
    case 'cta':
      corpo = `<div class="brand" style="position:static">${marca(96)}<span class="brand-nome" style="font-size:72px">Med<em>Trouxa</em></span></div>
        <div class="t c-big">${rich(L.titulo)}</div>
        <div class="c-sub">${rich(L.linha)}</div>
        <div class="c-cta">${esc(L.cta)}${icone('arrow', 44, '#1a1406', 3)}</div>
        <div class="c-rod">${icone('shield', 32, COR.ouro, 2.2)}<span>${esc(L.rodape)}</span></div>`;
      break;
    default:
      throw new Error(L.tipo);
  }
  const html = `${fundo(sid, fmt, car.ghost, idx + 5)}
    <div class="c-cont">${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</div>
    <div class="stage c-stage">${corpo}</div>
    ${idx < total - 1 ? `<div class="c-swipe">Arraste ${icone('arrow', 34, COR.muted, 2.6)}</div>` : ''}`;
  // Lâmina estática: sem tweens (o registro da timeline vazia mantém o contrato).
  return arquivo(sid, fmt, css, html, '        // lâmina estática de carrossel — sem animação');
}

/** Tela do app no estado final (para lâminas estáticas). */
function mockEstatico(tipo, s) {
  const html = mock(tipo, `${s}m`);
  const fim = {
    questao: [[`${s}m-alt1`, `border-color:${COR.ok};background:rgba(95,211,154,0.14)`]],
    cronograma: [],
    chat: [],
    flashcard: [],
    simulado: [],
  }[tipo];
  let out = html
    .replace(/style="opacity:0"/g, '')
    .replace(`id="${s}m-fill"`, `id="${s}m-fill" style="transform:scaleX(0.34)"`)
    .replace(`<span id="${s}m-pct">0</span>`, `<span id="${s}m-pct">34</span>`)
    .replace(/class="box" id="([^"]+)">/g, `class="box" id="$1" style="background:rgba(95,211,154,0.18);border-color:${COR.ok}">`)
    .replace(/<svg class="ico" width="30"/g, '<svg class="ico" style="opacity:1" width="30"');
  for (const [id, st] of fim) out = out.replace(`id="${id}"`, `id="${id}" style="${st}"`);
  if (tipo === 'flashcard') out = out.replace(/<div class="grades">[\s\S]*?<\/div><div class="feedback"/, '<div class="feedback"');
  return out;
}
