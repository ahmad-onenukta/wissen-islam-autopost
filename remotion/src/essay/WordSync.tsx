import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../fonts";
import type { Block, EssayPalette, Word } from "./types";

const WordSpan: React.FC<{ w: Word; t: number; p: EssayPalette; big: boolean; sofort?: boolean }> = ({ w, t, p, big, sofort }) => {
  // reveal 0.16 s before the word starts (ref: words appear with slight anticipation), blur-in
  const t0 = w.s - 0.12;
  const k = interpolate(t, [t0, t0 + 0.22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = sofort ? 1 : 1 - Math.pow(1 - k, 3);
  const color = w.accent ? p.accent : big ? p.ink : p.sub ?? p.ink;
  return (
    <span
      style={{
        display: "inline-block",
        marginRight: big ? "0.26em" : "0.28em",
        color,
        opacity: ease,
        filter: `blur(${(1 - ease) * 10}px)`,
        transform: `translateY(${(1 - ease) * 10}px) scale(${0.96 + ease * 0.04})`,
        transformOrigin: "left center",
        whiteSpace: "pre",
      }}
    >
      {w.w}
    </span>
  );
};

export const WordSync: React.FC<{ b: Block; p: EssayPalette; align: "left" | "center" }> = ({ b, p, align }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = b.start + frame / fps; // absolute time
  // Erster Block: alles sofort sichtbar, kein Wort-fuer-Wort-Aufbau. In der
  // ersten Sekunde entscheidet sich, ob jemand bleibt - da darf nicht ein
  // einzelnes Wort auf schwarzem Grund stehen.
  const sofort = b.start <= 0.05;
  const top = b.words.filter((w) => w.line === "top");
  const big = b.words.filter((w) => w.line === "big");
  // block fade out at end
  const out = interpolate(t, [b.end - 0.18, b.end - 0.02], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bigLen = (b.big ?? "").length;
  const bigSize = bigLen > 90 ? 76 : bigLen > 70 ? 86 : bigLen > 44 ? 100 : 116;
  const topSize = (b.top ?? "").length > 64 ? 46 : 54;
  return (
    <div
      style={{
        position: "absolute",
        top: 340,
        bottom: 300,
        left: 76,
        right: 76,
        justifyContent: "center",
        fontFamily: FONT,
        textAlign: align,
        opacity: out,
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
      }}
    >
      {top.length ? (
        <div style={{ fontSize: topSize, fontWeight: 600, lineHeight: 1.28, letterSpacing: "-0.005em", marginBottom: 18, display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start" }}>
          {top.map((w, i) => <WordSpan key={i} w={w} t={t} p={p} big={false} sofort={sofort} />)}
        </div>
      ) : null}
      {big.length ? (
        <div style={{ fontSize: bigSize, fontWeight: 800, lineHeight: 1.06, letterSpacing: "-0.022em", display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start" }}>
          {big.map((w, i) => <WordSpan key={i} w={w} t={t} p={p} big sofort={sofort} />)}
        </div>
      ) : null}
    </div>
  );
};
