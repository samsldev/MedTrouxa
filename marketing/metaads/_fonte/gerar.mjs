#!/usr/bin/env node
/**
 * Gera os 12 projetos HyperFrames de marketing/metaads a partir dos roteiros + biblioteca de cenas.
 *   reels/criativo_{1,2,3,4}     vídeo 1080×1920, 15 s, com trilha
 *   stories/criativo_{1,2,3,4}   vídeo 1080×1920, 15 s, com trilha (áreas seguras de Stories)
 *   carrosel/criativo_{1,2,3,4}  5 lâminas 1080×1350 (renderizadas como PNG via snapshot)
 *
 * Uso:  node marketing/metaads/_fonte/gerar.mjs         (da raiz do repositório)
 * Projetos novos são criados com `npx hyperframes init` (estrutura oficial); os arquivos de composição são reescritos.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cenaDor, cenaGancho, cenaOferta, cenaVirada, lamina } from './cenas.mjs';
import { DESIGN_MD, FONTES } from './marca.mjs';
import { CARROSSEIS, REELS, STORIES } from './roteiros.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const META = join(AQUI, '..');
const FONTS_SRC = join(AQUI, '..', '..', '..', 'frontend', 'node_modules', '@fontsource');
const VERSAO_HF = '0.8.80';

const BPM = { 1: 96, 2: 104, 3: 90 }; // mesmo andamento da trilha (trilha.py) → cortes no pulso

// Áreas seguras (px): Reels esconde ~460px embaixo (legenda/UI) e ~150px à direita (ícones);
// Stories esconde ~280px no topo (barra de perfil) e ~320px embaixo (resposta/link).
const FMT = {
  reels: { w: 1080, h: 1920, pad: { t: 300, r: 150, b: 470, l: 80 } },
  stories: { w: 1080, h: 1920, pad: { t: 330, r: 80, b: 360, l: 80 } },
  carrosel: { w: 1080, h: 1350, pad: { t: 200, r: 90, b: 150, l: 90 } },
};

const CENAS_VIDEO = [
  ['gancho', 0, 3.0],
  ['dor', 3.0, 4.0],
  ['virada', 7.0, 4.5],
  ['oferta', 11.5, 3.5],
];

function init(dir) {
  if (existsSync(join(dir, 'hyperframes.json'))) return;
  mkdirSync(dirname(dir), { recursive: true });
  execFileSync('npx', ['--yes', `hyperframes@${VERSAO_HF}`, 'init', dir, '--non-interactive', '--example=blank', '--skill=general-video'],
    { stdio: 'ignore', env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' } });
}

function assets(dir, trilha) {
  const fdir = join(dir, 'assets', 'fonts');
  mkdirSync(fdir, { recursive: true });
  for (const [fam, , , file] of FONTES) {
    const pkg = fam === 'Inter' ? 'inter' : 'cormorant-garamond';
    copyFileSync(join(FONTS_SRC, pkg, 'files', file), join(fdir, file));
  }
  copyFileSync(join(AQUI, 'gsap.min.js'), join(dir, 'assets', 'gsap.min.js'));
  if (trilha) copyFileSync(join(AQUI, 'trilhas', `trilha_${trilha}.wav`), join(dir, 'assets', 'trilha.wav'));
}

function indexVideo(fmt, trilha) {
  const slots = CENAS_VIDEO.map(([id, start, dur], i) => `      <div id="slot-${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html"
        data-start="${start}" data-duration="${dur}" data-track-index="${i % 2}" data-width="${fmt.w}" data-height="${fmt.h}"></div>`).join('\n');
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${fmt.w}, height=${fmt.h}" />
    <!-- GSAP embutido (sem rede no render: regra de determinismo do HyperFrames) -->
    <script src="assets/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${fmt.w}px; height: ${fmt.h}px; overflow: hidden; background: #090a17; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #090a17; }
      [data-composition-id="main"] > div[data-composition-src] { position: absolute; inset: 0; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="15" data-width="${fmt.w}" data-height="${fmt.h}">
${slots}
      <audio id="trilha" src="assets/trilha.wav" data-start="0" data-duration="15" data-track-index="3" data-volume="0.9"></audio>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

function indexCarrossel(fmt, n) {
  const slots = Array.from({ length: n }, (_, i) => `      <div id="slot-lamina${i + 1}" data-composition-id="lamina${i + 1}" data-composition-src="compositions/lamina${i + 1}.html"
        data-start="${i}" data-duration="1" data-track-index="${i % 2}" data-width="${fmt.w}" data-height="${fmt.h}"></div>`).join('\n');
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${fmt.w}, height=${fmt.h}" />
    <!-- GSAP embutido (sem rede no render: regra de determinismo do HyperFrames) -->
    <script src="assets/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${fmt.w}px; height: ${fmt.h}px; overflow: hidden; background: #090a17; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #090a17; }
      [data-composition-id="main"] > div[data-composition-src] { position: absolute; inset: 0; }
    </style>
  </head>
  <body>
    <!-- Carrossel: cada lâmina ocupa 1 s da linha do tempo; as imagens são capturadas no meio de cada segundo. -->
    <div id="root" data-composition-id="main" data-start="0" data-duration="${n}" data-width="${fmt.w}" data-height="${fmt.h}">
${slots}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

const brief = (formato, ad, extra) => `---
workflow: general-video
flow: automation
storyboard: no
message: "${ad.tema}"
destination: meta-ads-${formato}
aspect: "${formato === 'carrosel' ? '4:5' : '9:16'}"
language: pt-BR
audience: estudantes de medicina (graduação, internato, ENAMED e Residência)
length: "${formato === 'carrosel' ? '5 lâminas' : '15s'}"
angle: dor do cliente, persuasivo e orientado a conversão
---

# ${formato} · ${ad.slug} — ${ad.tema}

## Intent
Anúncio de Meta Ads (${formato}) atacando a dor "${ad.tema}" e convertendo para o MedTrouxa, no estilo do site
(meia-noite + pergaminho + ouro, Cormorant Garamond + Inter). Pedido do usuário: "super conversivo, super persuasivo".

## Customizations
${extra}

## Notes
- Claims somente verdadeiros (preços reais, 20 questões grátis/dia, 7 dias de garantia, recursos existentes). Sem números de alunos.
- Gerado por \`marketing/metaads/_fonte/gerar.mjs\` — edite os roteiros/cenas lá e rode o gerador de novo.
`;

function storyboardVideo(ad) {
  const dor = ad.dor.titulo ?? '';
  return `---
mode: autonomous
---
## Frame 1
status: outline
src: compositions/gancho.html
motion: kinetic-beat-slam + ambient-glow-bloom
beat: 0–3s · gancho — ${ad.gancho.linhas ? ad.gancho.linhas.join(' ') : ad.gancho.pergunta}

## Frame 2
status: outline
src: compositions/dor.html
motion: waterfall-entry + css-marker-patterns (highlight) + spring-pop-entrance
beat: 3–7s · dor — ${dor}

## Frame 3
status: outline
src: compositions/virada.html
motion: spring-pop-entrance + ambient-glow-bloom + counting-dynamic-scale/svg-path-draw conforme a tela
beat: 7–11.5s · virada — ${ad.virada.titulo} (tela: ${ad.virada.mock})

## Frame 4
status: outline
src: compositions/oferta.html
motion: spring-pop-entrance + ambient-glow-bloom (sweep) + sine-wave-loop (seta, baixa amplitude)
beat: 11.5–15s · oferta — ${ad.oferta.titulo} → CTA "${ad.oferta.cta}"
`;
}

function gerarVideo(formato, lista) {
  for (const ad of lista) {
    const dir = join(META, formato, ad.slug);
    init(dir);
    assets(dir, ad.trilha);
    const fmt = FMT[formato];
    const stories = formato === 'stories';
    mkdirSync(join(dir, 'compositions'), { recursive: true });
    writeFileSync(join(dir, 'compositions', 'gancho.html'), cenaGancho('gancho', fmt, ad, BPM[ad.trilha]));
    writeFileSync(join(dir, 'compositions', 'dor.html'), cenaDor('dor', fmt, ad));
    writeFileSync(join(dir, 'compositions', 'virada.html'), cenaVirada('virada', fmt, ad));
    writeFileSync(join(dir, 'compositions', 'oferta.html'), cenaOferta('oferta', fmt, ad, stories));
    writeFileSync(join(dir, 'index.html'), indexVideo(fmt, ad.trilha));
    writeFileSync(join(dir, 'design.md'), DESIGN_MD);
    writeFileSync(join(dir, 'BRIEF.md'), brief(formato, ad, `- Trilha original sintetizada (trilha_${ad.trilha}, ${BPM[ad.trilha]} BPM): tensão → virada → resolução; sem locução.\n- Legenda forte: todo o argumento está na tela (funciona no mudo).`));
    writeFileSync(join(dir, 'STORYBOARD.md'), storyboardVideo(ad));
    console.log(`✓ ${formato}/${ad.slug}`);
  }
}

function gerarCarrosseis() {
  const fmt = FMT.carrosel;
  for (const car of CARROSSEIS) {
    const dir = join(META, 'carrosel', car.slug);
    init(dir);
    assets(dir, null);
    mkdirSync(join(dir, 'compositions'), { recursive: true });
    car.laminas.forEach((_, i) => writeFileSync(join(dir, 'compositions', `lamina${i + 1}.html`), lamina(`lamina${i + 1}`, fmt, car, i)));
    writeFileSync(join(dir, 'index.html'), indexCarrossel(fmt, car.laminas.length));
    writeFileSync(join(dir, 'design.md'), DESIGN_MD);
    writeFileSync(join(dir, 'BRIEF.md'), brief('carrosel', car, '- Carrossel de 5 lâminas estáticas 4:5: capa (gancho) → dor → explicação → recursos → CTA.'));
    writeFileSync(join(dir, 'STORYBOARD.md'), `---\nmode: autonomous\n---\n${car.laminas.map((l, i) => `## Frame ${i + 1}\nstatus: outline\nsrc: compositions/lamina${i + 1}.html\nmotion: estático\nbeat: lâmina ${i + 1} · ${l.tipo} — ${l.titulo}\n`).join('\n')}`);
    console.log(`✓ carrosel/${car.slug}`);
  }
}

gerarVideo('reels', REELS);
gerarVideo('stories', STORIES);
gerarCarrosseis();
