import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../fonts";
import type { Palette } from "../types";

const spring = Easing.bezier(0.16, 1, 0.3, 1);

type Tok = { w: string; hl: boolean };
export function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  let hl = false;
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    let w = raw;
    let open = false, close = false;
    if (w.startsWith("*")) { open = true; w = w.slice(1); }
    if (/\*[.,!?:;„“”"]*$/.test(w)) { close = true; w = w.replace(/\*([.,!?:;„“”"]*)$/, "$1"); }
    if (open) hl = true;
    out.push({ w, hl });
    if (close) hl = false;
  }
  return out;
}

export const Kinetic: React.FC<{
  text: string; size: number; p: Palette; stagger?: number; start?: number; width?: number; align?: "center";
}> = ({ text, size, p, stagger = 2, start = 3, width = 900 }) => {
  const frame = useCurrentFrame();
  const toks = tokenize(text);
  return (
    <div style={{ width, display: "flex", flexWrap: "wrap", justifyContent: "center", columnGap: size * 0.26, rowGap: size * 0.1, fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.02em", color: p.ink, textAlign: "center" }}>
      {toks.map((t, i) => {
        const t0 = start + i * stagger;
        const op = interpolate(frame, [t0, t0 + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring });
        const y = interpolate(frame, [t0, t0 + 14], [size * 0.45, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring });
        const sc = interpolate(frame, [t0, t0 + 16], [0.72, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
        const wipe = interpolate(frame, [t0 + 4, t0 + 14], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring });
        return (
          <span key={i} style={{ position: "relative", display: "inline-block", opacity: op, translate: `0 ${y}px`, scale: String(sc), padding: t.hl ? `0 ${size * 0.12}px` : 0, whiteSpace: "nowrap" }}>
            {t.hl && (
              <span style={{ position: "absolute", left: 0, top: size * 0.02, bottom: -size * 0.02, width: `${wipe}%`, background: p.accent, borderRadius: size * 0.08, zIndex: 0 }} />
            )}
            <span style={{ position: "relative", zIndex: 1, color: t.hl ? "#fff" : p.ink }}>{t.w}</span>
          </span>
        );
      })}
    </div>
  );
};

export const Kicker: React.FC<{ text?: string; p: Palette }> = ({ text, p }) => {
  const frame = useCurrentFrame();
  if (!text) return null;
  const op = interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring });
  const ls = interpolate(frame, [0, 20], [0.5, 0.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring });
  return (
    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: p.mute, textTransform: "uppercase", letterSpacing: `${ls}em`, opacity: op, marginBottom: 26 }}>
      {text}
    </div>
  );
};

export const Odometer: React.FC<{ value: string; p: Palette }> = ({ value, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = [...value];
  const size = value.length > 7 ? 150 : value.length > 4 ? 210 : 300;
  const h = size * 1.0;
  const u = interpolate(frame, [0.7 * fps, 1.2 * fps], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: "-0.04em", color: p.ink, fontVariantNumeric: "tabular-nums" }}>
        {chars.map((c, i) => {
          if (!/\d/.test(c)) return <span key={i} style={{ height: h, display: "flex", alignItems: "center" }}>{c}</span>;
          const target = +c + 30;
          const prog = interpolate(frame, [3 + i * 2, 3 + i * 2 + 1.0 * fps], [0, target], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.2, 0.9, 0.2, 1) });
          const cur = prog % 10;
          return (
            <span key={i} style={{ height: h, overflow: "hidden", display: "inline-block", width: size * 0.6 }}>
              <span style={{ display: "block", translate: `0 ${-cur * h}px` }}>
                {Array.from({ length: 11 }, (_, d) => (
                  <span key={d} style={{ display: "flex", height: h, alignItems: "center", justifyContent: "center" }}>{d % 10}</span>
                ))}
              </span>
            </span>
          );
        })}
      </div>
      <div style={{ height: 10, width: `${u}%`, maxWidth: 820, background: p.accent, marginTop: 10, borderRadius: 5 }} />
    </div>
  );
};

export const SmallCaps: React.FC<{ text?: string; p: Palette; delay?: number }> = ({ text, p, delay = 15 }) => {
  const frame = useCurrentFrame();
  if (!text) return null;
  const op = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: p.mute, textTransform: "uppercase", letterSpacing: "0.25em", opacity: op, marginTop: 24 }}>{text}</div>;
};
