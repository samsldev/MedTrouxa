# MedTrouxa — design spec (vídeo e estáticos)

Marca de estudos para medicina com tom "medicina mágica, minimalista": meia-noite + pergaminho + ouro antigo.
Fonte da verdade: o site (frontend/src/styles.css, tema escuro). Mesmo visual em Reels, Stories e carrosséis.

## Cores (estritas)
- Fundo: #090a17 (meia-noite), superfícies #111329 / #171a35, bordas #2c3160
- Texto: #f6f1e6 (pergaminho); secundário #b3b0c6
- Acento único: ouro #d4b06c (texto em ouro: #e3c48a); dourado "foil" em gradiente só em botões/CTA
- Semânticas só onde há significado: acerto #5fd39a, erro/dor #f08a80; brilho ambiente #2b2470

## Tipografia (estrita — é a da marca)
- Títulos: Cormorant Garamond 600/700; ênfase em *itálico dourado* (o "em" do site)
- Texto, rótulos e botões: Inter 500–800
- Algarismos alinhados; nada abaixo de 26px em vídeo (rótulos 26–30px, corpo 38–46px, títulos 96–150px)
- Fontes embutidas por @font-face local (assets/fonts), nunca buscadas no render

## Composição
- Fundo com profundidade: brilho radial meia-noite/violeta, céu de estrelas douradas, palavra-fantasma gigante, filetes de ouro
- Marca (varinha + estrela) presente no topo; logotipo "Med*Trouxa*" no fechamento
- Telas do produto recriadas em HTML com o visual real do app (cartões #111329, pílulas, alternativas com certo/errado)
- Áreas seguras: Reels — nada importante nos 460px de baixo nem nos 150px da direita; Stories — 280px no topo e 320px embaixo

## Movimento
- Entradas com peso (power3/power4/expo.out), sem "quicadas" de desenho animado
- Ambiente sempre vivo e sutil (brilho que respira, estrelas); cortes secos entre cenas
- Nada infinito; tudo determinístico e seekável

## Não fazer
- Números de alunos/aprovados inventados; promessas de aprovação
- Neon, gradiente em texto corrido, preto/branco puros
