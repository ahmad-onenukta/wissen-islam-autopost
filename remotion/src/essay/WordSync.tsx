import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../fonts";
import type { Block, EssayPalette, Word } from "./types";

const WordSpan: React.FC<{ w: Word; t: number; p: EssayPalette; big: boolean }> = ({ w, t, p, big }) => {
  // reveal 0.16 s before the word starts (ref: words appear with slight anticipation), blur-in
  const t0 = w.s - 0.12;
  const k = interpolate(t, [t0, t0 + 0.22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ease = 1 - Math.pow(1 - k, 3);
  const color = w.accent ? p.accent : big ? p.ink : p.dim;
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
  const top = b.words.filter((w) => w.line === "top");
  const big = b.words.filter((w) => w.line === "big");
  // block fade out at end
  const out = interpolate(t, [b.end - 0.18, b.end - 0.02], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bigLen = (b.big ?? "").length;
  const bigSize = bigLen > 70 ? 60 : bigLen > 44 ? 68 : 80;
  return (
    <div
      style={{
        position: "absolute",
        top: 250,
        left: 84,
        right: 84,
        fontFamily: FONT,
        textAlign: align,
        opacity: out,
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
      }}
    >
      {top.length ? (
        <div style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.005em", marginBottom: 8, display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start" }}>
          {top.map((w, i) => <WordSpan key={i} w={w} t={t} p={p} big={false} />)}
        </div>
      ) : null}
      {big.length ? (
        <div style={{ fontSize: bigSize, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.02em", display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start" }}>
          {big.map((w, i) => <WordSpan key={i} w={w} t={t} p={p} big />)}
        </div>
      ) : null}
    </div>
  );
};
