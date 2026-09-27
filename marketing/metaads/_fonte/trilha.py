#!/usr/bin/env python3
"""
Trilha original dos anúncios MedTrouxa (15 s), sintetizada localmente — sem samples, sem direitos de terceiros.

Arco sonoro espelha o roteiro de cada anúncio:
  0–5 s    tensão   drone grave + tique de relógio (a dor, a pressão)
  5–11 s   virada   arpejo em tom menor subindo + swell de ruído (o problema tem solução)
  11 s     impacto  sub + estalo (a marca entra)
  11.5–15  resolução acorde maior quente + sinos (a oferta, o alívio) e fade-out

Determinístico: o ruído usa um LCG com semente fixa, então o mesmo comando gera o mesmo arquivo.
Uso: python3 trilha.py <saida.wav> <variante 1|2|3>
"""
import math
import struct
import sys
import wave

SR = 44100
DUR = 15.0
N = int(SR * DUR)

# Variantes: tônica (Hz) e andamento — cada criativo com identidade própria
VARIANTES = {
    1: dict(root=110.00, bpm=96),   # Lá
    2: dict(root=98.00, bpm=104),   # Sol
    3: dict(root=123.47, bpm=90),   # Si
}


class Lcg:
    """Ruído determinístico (sem random)."""
    def __init__(self, seed):
        self.s = seed & 0xFFFFFFFF

    def next(self):
        self.s = (1664525 * self.s + 1013904223) & 0xFFFFFFFF
        return self.s / 0xFFFFFFFF * 2.0 - 1.0


def env_adsr(t, a, d, s, r, length):
    if t < 0 or t > length + r:
        return 0.0
    if t < a:
        return t / a
    if t < a + d:
        return 1.0 - (1.0 - s) * (t - a) / d
    if t < length:
        return s
    return s * (1.0 - (t - length) / r)


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def gerar(caminho, variante):
    v = VARIANTES[variante]
    root, beat = v["root"], 60.0 / v["bpm"]
    ruido = Lcg(1234 + variante)
    L = [0.0] * N
    R = [0.0] * N

    minor = [0, 3, 7, 10, 12, 15, 19]            # arpejo menor (tensão)
    major = [0, 4, 7, 11, 14]                     # acorde maior com 7ª e 9ª (resolução)
    semi = lambda n: root * (2 ** (n / 12.0))

    # estado dos filtros de 1 polo
    lp_drone = 0.0
    lp_noise = 0.0
    hp_prev_in = 0.0
    hp_prev_out = 0.0

    for i in range(N):
        t = i / SR
        l = r = 0.0

        # ---------- drone (0–11.3 s): tônica + quinta levemente desafinadas, filtrado ----------
        if t < 11.6:
            g = smooth(t / 1.2) * (1.0 - smooth((t - 10.8) / 0.8))
            raw = 0.0
            for f, det in ((root / 2, 0.0), (root / 2, 0.35), (root * 0.75, -0.25)):
                ph = (f + det) * t
                raw += (2.0 * (ph - math.floor(ph + 0.5)))  # serra
            cutoff = 280 + 900 * smooth((t - 5.0) / 6.0)   # abre na virada
            a = 1.0 - math.exp(-2 * math.pi * cutoff / SR)
            lp_drone += a * (raw - lp_drone)
            d = lp_drone * 0.10 * g
            l += d
            r += d

        # ---------- tique de relógio (0–7 s), no pulso ----------
        if t < 7.2:
            tb = t % beat
            if tb < 0.03:
                n = ruido.next()
                hp = n - hp_prev_in + 0.95 * hp_prev_out  # passa-alta: clique seco
                hp_prev_in, hp_prev_out = n, hp
                k = hp * 0.22 * (1.0 - tb / 0.03) * (1.0 - smooth((t - 6.0) / 1.2))
                pan = 0.35 if int(t / beat) % 2 else -0.35
                l += k * (1 - pan)
                r += k * (1 + pan)

        # ---------- batida de "coração" sub (0–5 s) ----------
        if t < 5.2:
            tb = t % (beat * 2)
            for off in (0.0, 0.18):
                tt = tb - off
                if 0 <= tt < 0.25:
                    s = math.sin(2 * math.pi * 55 * tt) * math.exp(-tt * 18) * 0.35
                    l += s
                    r += s

        # ---------- arpejo (5–11 s): pluck menor subindo ----------
        if 5.0 <= t < 11.2:
            step = beat / 2
            k = int((t - 5.0) / step)
            tt = (t - 5.0) - k * step
            nota = minor[k % len(minor)] + (12 if k >= 8 else 0)
            f = semi(nota) * 2
            env = math.exp(-tt * 7.0)
            vel = 0.10 + 0.10 * smooth((t - 5.0) / 6.0)
            s = (math.sin(2 * math.pi * f * t) + 0.35 * math.sin(2 * math.pi * f * 2 * t)) * env * vel
            pan = 0.4 * math.sin(k * 1.3)
            l += s * (1 - pan)
            r += s * (1 + pan)

        # ---------- swell de ruído (8.8–11.1 s) ----------
        if 8.8 <= t < 11.1:
            n = ruido.next()
            cutoff = 600 + 5000 * smooth((t - 8.8) / 2.3)
            a = 1.0 - math.exp(-2 * math.pi * cutoff / SR)
            lp_noise += a * (n - lp_noise)
            g = smooth((t - 8.8) / 2.3) ** 2 * 0.16
            l += lp_noise * g
            r -= lp_noise * g * 0.9

        # ---------- impacto (11.1 s): sub + estalo ----------
        ti = t - 11.1
        if 0 <= ti < 1.2:
            sub = math.sin(2 * math.pi * (60 - 25 * min(ti, 0.4)) * ti) * math.exp(-ti * 3.2) * 0.55
            l += sub
            r += sub
            if ti < 0.06:
                n = ruido.next() * (1 - ti / 0.06) * 0.25
                l += n
                r += n

        # ---------- resolução (11.2–15 s): pad maior + sinos ----------
        if t >= 11.15:
            tt = t - 11.15
            g = smooth(tt / 0.5) * (1.0 - smooth((t - 14.0) / 1.0))
            pad = 0.0
            for j, n_ in enumerate(major):
                f = semi(n_)
                pad += math.sin(2 * math.pi * f * t + j) + 0.5 * math.sin(2 * math.pi * f * 2.002 * t)
            pad *= 0.045 * g
            l += pad
            r += pad * 0.96
            for j, (quando, n_) in enumerate(((11.25, 24), (11.9, 28), (12.55, 31), (13.2, 35))):
                tb = t - quando
                if 0 <= tb < 2.2:
                    f = semi(n_)
                    bell = (math.sin(2 * math.pi * f * tb) + 0.4 * math.sin(2 * math.pi * f * 2.76 * tb)) * math.exp(-tb * 2.4) * 0.07
                    pan = (-0.45, 0.45, -0.2, 0.3)[j]
                    l += bell * (1 - pan)
                    r += bell * (1 + pan)

        L[i], R[i] = l, r

    # fades de borda (sem estalo no loop do Reels) + limitador suave + normalização
    fade = int(0.04 * SR)
    for i in range(fade):
        k = i / fade
        L[i] *= k
        R[i] *= k
        L[N - 1 - i] *= k
        R[N - 1 - i] *= k
    pico = max(max(abs(x) for x in L), max(abs(x) for x in R)) or 1.0
    ganho = 0.89 / pico
    with wave.open(caminho, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for i in range(N):
            for x in (L[i], R[i]):
                y = math.tanh(x * ganho * 1.2) / math.tanh(1.2)
                frames += struct.pack("<h", int(max(-1.0, min(1.0, y)) * 32767))
        w.writeframes(bytes(frames))


if __name__ == "__main__":
    gerar(sys.argv[1], int(sys.argv[2]))
