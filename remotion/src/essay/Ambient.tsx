import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { EssayPalette } from "./types";

// Hintergrundebenen, damit nie eine schwarze Flaeche steht. Alles rein
// gerechnet, keine Bilddateien - so funktioniert es fuer jede Reel.
// Jeder Wert haengt nur am Frame, damit Remotion die Frames unabhaengig
// voneinander rendern kann.

const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Zwei grosse, langsam wandernde Lichter: eines in der Akzentfarbe unten
// links, ein kuehles oben rechts. Sie geben dem Bild Tiefe.
const Lichter: React.FC<{ p: EssayPalette }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const x1 = 22 + Math.sin(t * 0.09) * 14;
  const y1 = 74 + Math.cos(t * 0.07) * 10;
  const x2 = 78 + Math.cos(t * 0.06) * 12;
  const y2 = 22 + Math.sin(t * 0.08) * 9;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 86% 56% at ${x1}% ${y1}%, ${p.accent}34 0%, rgba(0,0,0,0) 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 72% 48% at ${x2}% ${y2}%, rgba(140,165,205,0.20) 0%, rgba(0,0,0,0) 72%)` }} />
    </AbsoluteFill>
  );
};

// Punktraster mit leichter Drift. Gibt Struktur, ohne vom Text abzulenken.
const PUNKTE = Array.from({ length: 130 }, (_, i) => ({
  x: rnd(i) * 100,
  y: rnd(i + 50) * 100,
  r: 1.5 + rnd(i + 120) * 2.5,
  s: 0.25 + rnd(i + 200) * 0.7,
  o: 0.1 + rnd(i + 300) * 0.3,
}));

const Punkte: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" viewBox="0 0 100 178" preserveAspectRatio="none">
        {PUNKTE.map((d, i) => {
          const y = (d.y + t * d.s * 2.2) % 100;
          const puls = 0.7 + 0.3 * Math.sin(t * 0.9 + i);
          return <circle key={i} cx={d.x} cy={y * 1.78} r={d.r * 0.14} fill="#FFFFFF" opacity={d.o * puls * 0.7} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

// Ein Lichtstreifen, der alle paar Sekunden schraeg durchs Bild zieht.
const Streifen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const periode = 7.5 * fps;
  const k = (frame % periode) / periode;
  const x = interpolate(k, [0, 1], [-45, 145]);
  const sicht = interpolate(k, [0, 0.12, 0.88, 1], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: sicht * 0.6, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-25%", left: `${x}%`, width: "26%", height: "150%",
        background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.075) 50%, rgba(255,255,255,0) 100%)",
        transform: "rotate(14deg)", filter: "blur(28px)" }} />
    </AbsoluteFill>
  );
};

// Zwei duenne Linien, die mit dem Text atmen - Rahmen statt Leere.
const Linien: React.FC<{ p: EssayPalette }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const b1 = 300 + Math.sin(t * 0.5) * 70;
  const b2 = 220 + Math.cos(t * 0.42) * 60;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 262, left: 76, width: b1, height: 2, background: `linear-gradient(90deg, ${p.accent}CC, rgba(255,255,255,0))` }} />
      <div style={{ position: "absolute", bottom: 232, right: 76, width: b2, height: 2, background: `linear-gradient(270deg, rgba(255,255,255,0.3), rgba(255,255,255,0))` }} />
    </AbsoluteFill>
  );
};

export const Ambient: React.FC<{ p: EssayPalette; aus?: boolean }> = ({ p, aus }) => {
  if (aus) return null;   // auf hellen Beats aus, sonst matscht es
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Lichter p={p} />
      <Punkte />
      <Streifen />
      <Linien p={p} />
    </AbsoluteFill>
  );
};
