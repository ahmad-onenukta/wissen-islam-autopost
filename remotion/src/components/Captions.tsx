import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../fonts";
import type { Palette } from "../types";

/** Karaoke caption for one scene: words of `vo` highlighted proportionally over the scene (fallback when no word timings). */
export const Captions: React.FC<{ vo?: string; p: Palette; durationInFrames: number; words?: { w: string; s: number; e: number }[] }> = ({ vo, p, durationInFrames, words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!vo && !words) return null;
  const toks = words ?? (() => {
    const ws = (vo ?? "").replace(/\[pause\]/g, "").split(/\s+/).filter(Boolean);
    const weights = ws.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 1.5);
    const total = weights.reduce((a, b) => a + b, 0);
    const usable = (durationInFrames - 6) / fps; let t = 0.15;
    return ws.map((w, i) => { const d = (weights[i] / total) * usable; const o = { w, s: t, e: t + d }; t += d; return o; });
  })();
  const t = frame / fps;
  // sliding window: show ~7 words around the current one
  const cur = Math.max(0, toks.findIndex((x) => t < x.e));
  const idx = cur === -1 ? toks.length - 1 : cur;
  const start = Math.max(0, Math.min(idx - 2, toks.length - 7));
  const win = toks.slice(start, start + 7);
  return (
    <div style={{ position: "absolute", left: 90, right: 90, bottom: 200, display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: 14, rowGap: 6, fontFamily: FONT, fontWeight: 700, fontSize: 40, lineHeight: 1.15, textAlign: "center" }}>
      {win.map((x, i) => {
        const gi = start + i;
        const said = t >= x.s;
        const now = t >= x.s && t < x.e;
        return (
          <span key={gi} style={{ color: now ? p.accent : said ? p.ink : `${p.ink}66`, scale: now ? "1.08" : "1", transition: "none" }}>{x.w}</span>
        );
      })}
    </div>
  );
};
