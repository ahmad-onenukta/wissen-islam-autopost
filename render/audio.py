#!/usr/bin/env python3
"""Synth audio bed + SFX from event timeline. Usage: audio.py events.json total_seconds out.wav"""
import sys, json, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SR = 48000
events = json.load(open(sys.argv[1])); total = float(sys.argv[2]); out = sys.argv[3]
N = int(SR * (total + 0.5)); mix = np.zeros(N)
t_all = np.arange(N) / SR

def lp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2)); return lfilter(b, a, x)
def hp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), btype='high'); return lfilter(b, a, x)
def add(sig, t0, gain=1.0):
    i = int(t0 * SR); n = min(len(sig), N - i)
    if n > 0: mix[i:i + n] += sig[:n] * gain

# ---- ambient pad: slow minor chord progression, detuned sines, breathing ----
chords = [[220, 261.6, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [164.8, 207.7, 246.9]]  # Am G F E
bar = 8.0
pad = np.zeros(N)
for ci in range(int(total // bar) + 2):
    ch = chords[ci % 4]; t0 = ci * bar; i0 = int(t0 * SR); n = int(bar * SR) + SR
    if i0 >= N: break
    tt = np.arange(n) / SR
    env = np.minimum(1, tt / 2.5) * np.minimum(1, (bar + 1 - tt) / 2.5).clip(0, 1)
    seg = np.zeros(n)
    for f in ch:
        for det in (-0.4, 0, 0.4):
            seg += np.sin(2 * np.pi * (f + det) * tt + np.random.rand() * 6.28) * 0.12
        seg += np.sin(2 * np.pi * f / 2 * tt) * 0.08
    seg *= env
    n2 = min(n, N - i0); pad[i0:i0 + n2] += seg[:n2]
pad = lp(pad, 900)
breath = 0.75 + 0.25 * np.sin(2 * np.pi * t_all / 6.0)
mix += pad * breath * 0.22
# soft heartbeat pulse 72 bpm, very low
for k in range(int(total / (60 / 72)) + 1):
    t0 = k * 60 / 72; tt = np.arange(int(0.25 * SR)) / SR
    kick = np.sin(2 * np.pi * (55 + 40 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 14)
    add(kick, t0, 0.10)

# ---- SFX ----
rng = np.random.default_rng(7)
def whoosh():
    tt = np.arange(int(0.5 * SR)) / SR; noise = rng.standard_normal(len(tt))
    env = np.sin(np.pi * np.minimum(tt / 0.5, 1)) ** 2
    x = lp(hp(noise, 400), 3500) * env
    return x / (np.abs(x).max() + 1e-9)
def tick():
    tt = np.arange(int(0.03 * SR)) / SR
    x = np.sin(2 * np.pi * 2200 * tt) * np.exp(-tt * 180) + rng.standard_normal(len(tt)) * np.exp(-tt * 400) * 0.3
    return x / (np.abs(x).max() + 1e-9)
def boom():
    tt = np.arange(int(1.2 * SR)) / SR
    x = np.sin(2 * np.pi * (48 + 60 * np.exp(-tt * 12)) * tt) * np.exp(-tt * 4.5)
    x += lp(rng.standard_normal(len(tt)), 300) * np.exp(-tt * 20) * 0.5
    return x / (np.abs(x).max() + 1e-9)
def hit():
    tt = np.arange(int(0.35 * SR)) / SR
    x = np.sin(2 * np.pi * (180 * np.exp(-tt * 10) + 90) * tt) * np.exp(-tt * 12)
    x += hp(rng.standard_normal(len(tt)), 2000) * np.exp(-tt * 60) * 0.4
    return x / (np.abs(x).max() + 1e-9)
def pop():
    tt = np.arange(int(0.12 * SR)) / SR
    x = np.sin(2 * np.pi * (600 * np.exp(-tt * 40) + 200) * tt) * np.exp(-tt * 40)
    return x / (np.abs(x).max() + 1e-9)
gains = {'whoosh': 0.35, 'tick': 0.18, 'boom': 0.55, 'hit': 0.45, 'pop': 0.25}
fns = {'whoosh': whoosh, 'tick': tick, 'boom': boom, 'hit': hit, 'pop': pop}
for e in events:
    if e['type'] in fns: add(fns[e['type']](), e['t'], gains[e['type']])

# fade out last 1.5 s, normalize
fade = np.ones(N); nf = int(1.5 * SR); fade[-nf:] = np.linspace(1, 0, nf)
mix *= fade
mix = mix / (np.abs(mix).max() + 1e-9) * 0.89
wavfile.write(out, SR, (mix * 32767).astype(np.int16))
print(out, round(total, 2), 's', len(events), 'events')
