/**
 * Identidade visual do MedTrouxa para vídeo — tokens do site (frontend/src/styles.css, tema escuro)
 * adaptados à escala de vídeo (hyperframes-creative/video-composition.md).
 */

export const COR = {
  bg: '#090a17',        // meia-noite (fundo do site no escuro)
  bg2: '#111329',       // superfície
  bg3: '#171a35',
  borda: '#2c3160',
  tinta: '#f6f1e6',     // pergaminho (texto)
  muted: '#b3b0c6',     // texto secundário (clareado p/ contraste AA em vídeo)
  ouro: '#d4b06c',      // acento único
  ouroTexto: '#e3c48a',
  arcano: '#a99eff',
  ok: '#5fd39a',
  ko: '#f08a80',
  glow: '#2b2470',
};

export const FONTES = [
  ['Cormorant Garamond', 600, 'normal', 'cormorant-garamond-latin-600-normal.woff2'],
  ['Cormorant Garamond', 600, 'italic', 'cormorant-garamond-latin-600-italic.woff2'],
  ['Cormorant Garamond', 700, 'normal', 'cormorant-garamond-latin-700-normal.woff2'],
  ['Cormorant Garamond', 700, 'italic', 'cormorant-garamond-latin-700-italic.woff2'],
  ['Inter', 400, 'normal', 'inter-latin-400-normal.woff2'],
  ['Inter', 500, 'normal', 'inter-latin-500-normal.woff2'],
  ['Inter', 600, 'normal', 'inter-latin-600-normal.woff2'],
  ['Inter', 700, 'normal', 'inter-latin-700-normal.woff2'],
  ['Inter', 800, 'normal', 'inter-latin-800-normal.woff2'],
];

export const FONT_FACE = FONTES.map(([f, w, s, file]) =>
  `@font-face { font-family: "${f}"; font-weight: ${w}; font-style: ${s}; font-display: block; src: url("assets/fonts/${file}") format("woff2"); }`,
).join('\n');

/** Ícones do site (traço 1.6, 24×24). */
export const ICONES = {
  questions: 'M9 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9zM9 4v5H4M8 13h8M8 17h5',
  cards: 'M7 3h11a1 1 0 0 1 1 1v13M4 7h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z',
  timer: 'M12 8v5l3 2M9 2h6M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3',
  owl: 'M5 5l3 2h8l3-2v9a7 7 0 0 1-14 0zM9.5 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM14.5 12.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM12 15l-1-1h2z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  up: 'M12 19V5M6 11l6-6 6 6',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
};

export const icone = (nome, tam = 40, cor = 'currentColor', traco = 1.8) =>
  `<svg class="ico" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="${traco}" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONES[nome]}"/></svg>`;

/** Varinha + estrela (a marca), em ouro sobre meia-noite. */
export const marca = (tam = 64) => `<svg class="marca" width="${tam}" height="${tam}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#1b1e48"/>
  <path d="M9 23 L20 12" stroke="${COR.ouro}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M22.5 5.5 L23.6 8.4 L26.5 9.5 L23.6 10.6 L22.5 13.5 L21.4 10.6 L18.5 9.5 L21.4 8.4 Z" fill="${COR.ouro}"/>
  <circle cx="11" cy="9" r="1" fill="${COR.ouro}" opacity=".7"/><circle cx="24" cy="21" r="1.2" fill="${COR.ouro}" opacity=".5"/>
</svg>`;

/** Texto com *ênfase* → <em> (itálico dourado, como no site). Escapa HTML. */
export const rich = (s) => s
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>');

/** Palavras de um texto rico, preservando ênfase (para cascatas palavra a palavra). */
export function palavras(s) {
  const out = [];
  let em = false;
  for (const parte of s.split(/(\*)/)) {
    if (parte === '*') { em = !em; continue; }
    for (const w of parte.split(/\s+/).filter(Boolean)) out.push({ w: rich(w), em });
  }
  return out;
}

/** Estrelas determinísticas (sem Math.random): hash por índice. */
export function estrelas(n, w, h, semente = 1) {
  const hash = (i, k) => { const x = Math.sin((i + 1) * 12.9898 * (k + semente) + semente * 78.233) * 43758.5453; return x - Math.floor(x); };
  let s = '';
  for (let i = 0; i < n; i++) {
    const cx = (hash(i, 1) * w).toFixed(1), cy = (hash(i, 2) * h).toFixed(1);
    const r = (i % 5 === 0 ? 3.2 : i % 3 === 0 ? 2.2 : 1.5).toFixed(1);
    const o = (0.35 + hash(i, 3) * 0.5).toFixed(2);
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${COR.ouro}" opacity="${o}"/>`;
  }
  return s;
}

/** Design spec escrito em cada projeto (fonte da verdade da marca para o HyperFrames). */
export const DESIGN_MD = `# MedTrouxa — design spec (vídeo e estáticos)

Marca de estudos para medicina com tom "medicina mágica, minimalista": meia-noite + pergaminho + ouro antigo.
Fonte da verdade: o site (frontend/src/styles.css, tema escuro). Mesmo visual em Reels, Stories e carrosséis.

## Cores (estritas)
- Fundo: ${COR.bg} (meia-noite), superfícies ${COR.bg2} / ${COR.bg3}, bordas ${COR.borda}
- Texto: ${COR.tinta} (pergaminho); secundário ${COR.muted}
- Acento único: ouro ${COR.ouro} (texto em ouro: ${COR.ouroTexto}); dourado "foil" em gradiente só em botões/CTA
- Semânticas só onde há significado: acerto ${COR.ok}, erro/dor ${COR.ko}; brilho ambiente ${COR.glow}

## Tipografia (estrita — é a da marca)
- Títulos: Cormorant Garamond 600/700; ênfase em *itálico dourado* (o "em" do site)
- Texto, rótulos e botões: Inter 500–800
- Algarismos alinhados; nada abaixo de 26px em vídeo (rótulos 26–30px, corpo 38–46px, títulos 96–150px)
- Fontes embutidas por @font-face local (assets/fonts), nunca buscadas no render

## Composição
- Fundo com profundidade: brilho radial meia-noite/violeta, céu de estrelas douradas, palavra-fantasma gigante, filetes de ouro
- Marca (varinha + estrela) presente no topo; logotipo "Med*Trouxa*" no fechamento
- Telas do produto recriadas em HTML com o visual real do app (cartões ${COR.bg2}, pílulas, alternativas com certo/errado)
- Áreas seguras: Reels — nada importante nos 460px de baixo nem nos 150px da direita; Stories — 280px no topo e 320px embaixo

## Movimento
- Entradas com peso (power3/power4/expo.out), sem "quicadas" de desenho animado
- Ambiente sempre vivo e sutil (brilho que respira, estrelas); cortes secos entre cenas
- Nada infinito; tudo determinístico e seekável

## Não fazer
- Números de alunos/aprovados inventados; promessas de aprovação
- Neon, gradiente em texto corrido, preto/branco puros
`;
