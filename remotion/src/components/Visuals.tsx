import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "../fonts";
import type { CompareItem, Palette, TimelineItem } from "../types";

const out = Easing.bezier(0.16, 1, 0.3, 1);
const back = Easing.bezier(0.34, 1.4, 0.64, 1);
const clampOpt = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const fmt = (n: number) => n.toLocaleString("de-DE");

/** Hatched wireframe sphere, draws in line by line, rotates slowly */
export const Sphere: React.FC<{ p: Palette; r?: number }> = ({ p, r = 250 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = interpolate(frame, [0, 0.9 * fps], [0, 1], { ...clampOpt, easing: out });
  const rot = frame / fps;
  const n = 28, tilt = 0.5;
  const lines = [];
  for (let i = 0; i < n; i++) {
    if (i / n > draw) break;
    const ph = (i / n) * Math.PI - Math.PI / 2 + rot * 0.35;
    const y = Math.sin(ph) * r, rr = Math.cos(ph) * r;
    if (rr <= 1) continue;
    const depth = (Math.cos(ph + Math.PI / 2) + 1) / 2;
    lines.push(<ellipse key={i} cx={0} cy={y * Math.cos(tilt)} rx={rr} ry={rr * Math.sin(tilt)} fill="none" stroke={p.accent} strokeOpacity={0.25 + 0.6 * depth} strokeWidth={2.5 + depth * 1.5} />);
  }
  const bob = Math.sin(rot * 1.3) * 8;
  return (
    <svg width={r * 3.6} height={r * 3.6} viewBox={`${-r * 1.8} ${-r * 1.8} ${r * 3.6} ${r * 3.6}`} style={{ translate: `0 ${bob}px` }}>
      <defs><radialGradient id="g"><stop offset="0" stopColor={p.accent} stopOpacity={0.16} /><stop offset="1" stopColor={p.accent} stopOpacity={0} /></radialGradient></defs>
      <circle r={r * 1.7} fill="url(#g)" />
      {lines}
      <circle r={r * draw} fill="none" stroke={p.ink} strokeOpacity={0.5} strokeWidth={3} />
    </svg>
  );
};

export const Rings: React.FC<{ p: Palette }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <svg width={1000} height={600} viewBox="-500 -300 1000 600">
      {Array.from({ length: 6 }, (_, i) => {
        const pr = interpolate(frame, [i * 4, i * 4 + 0.9 * fps], [0, 1], { ...clampOpt, easing: out });
        const r = 40 + (100 + i * 70) * pr;
        return <ellipse key={i} rx={r * 1.6} ry={r * 0.55} fill="none" stroke={p.accent} strokeOpacity={(0.85 - i * 0.12) * pr} strokeWidth={3} transform={`rotate(${Math.sin(frame / fps * 0.3) * 6})`} />;
      })}
    </svg>
  );
};

export const Bars: React.FC<{ p: Palette; vals: number[]; labels?: string[] }> = ({ p, vals, labels }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mx = Math.max(...vals);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 34, height: 520, borderBottom: `2px solid ${p.ink}40`, padding: "0 20px" }}>
      {vals.map((v, i) => {
        const pr = interpolate(frame, [5 + i * 4, 5 + i * 4 + 0.9 * fps], [0, 1], { ...clampOpt, easing: back });
        const cnt = Math.round(v * interpolate(frame, [5 + i * 4, 5 + i * 4 + 1.3 * fps], [0, 1], { ...clampOpt, easing: out }));
        const last = i === vals.length - 1;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 130, fontFamily: FONT }}>
            <div style={{ fontWeight: 800, fontSize: 34, color: last ? p.ink : p.mute, marginBottom: 12, opacity: interpolate(frame, [15 + i * 4, 27 + i * 4], [0, 1], clampOpt) }}>{fmt(cnt)}</div>
            <div style={{ width: 130, height: (v / mx) * 420 * pr, background: p.accent, opacity: last ? 1 : 0.32, borderRadius: "14px 14px 0 0" }} />
            {labels?.[i] ? <div style={{ position: "absolute", marginTop: 8, fontWeight: 600, fontSize: 24, color: p.mute, translate: "0 560px" }}>{labels[i]}</div> : null}
          </div>
        );
      })}
    </div>
  );
};

export const Timeline: React.FC<{ p: Palette; items: TimelineItem[]; active: number }> = ({ p, items, active }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = items.length, span = Math.min(860, n * 220);
  const lp = interpolate(frame, [0, 0.8 * fps], [0, 1], { ...clampOpt, easing: out });
  return (
    <div style={{ position: "relative", width: span, height: 220 }}>
      <div style={{ position: "absolute", top: 110, left: 0, width: span * lp, height: 4, background: `${p.ink}4d` }} />
      {items.map((it, i) => {
        const x = n > 1 ? (span * i) / (n - 1) : span / 2;
        const pr = interpolate(frame, [6 + i * 4, 6 + i * 4 + 0.7 * fps], [0, 1], { ...clampOpt, easing: back });
        const isA = i === active;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: 110, translate: `-50% ${(1 - pr) * 60 - 50}%`, opacity: pr, display: "flex", flexDirection: "column", alignItems: "center", fontFamily: FONT }}>
            <div style={{ fontWeight: isA ? 800 : 600, fontSize: isA ? 40 : 28, color: isA ? p.ink : p.mute, marginBottom: 14, whiteSpace: "nowrap" }}>{it.label}</div>
            <div style={{ width: isA ? 44 : 28, height: isA ? 44 : 28, borderRadius: "50%", background: isA ? p.accent : p.bg, border: `4px solid ${isA ? p.accent : p.ink}`, scale: String(pr) }} />
            {it.sub ? <div style={{ fontWeight: 500, fontSize: 24, color: p.mute, marginTop: 14, whiteSpace: "nowrap" }}>{it.sub}</div> : null}
          </div>
        );
      })}
    </div>
  );
};

export const Card: React.FC<{ p: Palette; w?: number; h?: number; dir?: 1 | -1; delay?: number }> = ({ p, w = 520, h = 620, dir = 1, delay = 0 }) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const pr = interpolate(frame, [0, 0.9 * fps], [0, 1], { ...clampOpt, easing: back });
  const reveal = interpolate(frame, [0.3 * fps, 1.5 * fps], [0, 14], { ...clampOpt, easing: out });
  const bob = Math.sin((frame / fps) * 1.1) * 6;
  return (
    <div style={{ width: w, height: h, background: p.bg === "#0B0B0E" ? "#19191E" : "#FBF8F1", borderRadius: 22, border: `2px solid ${p.ink}1f`, boxShadow: "0 30px 60px rgba(0,0,0,0.25)", translate: `${(1 - pr) * dir * -600}px ${bob}px`, rotate: `${-0.18 * dir + 0.14 * dir * pr}rad`, opacity: Math.min(1, pr * 1.5), padding: 50, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} style={{ height: 5, borderRadius: 3, background: p.ink, opacity: i < reveal ? 0.5 : 0, width: `${55 + 45 * Math.abs(Math.sin(i * 1.7 + 1))}%`, alignSelf: "flex-end" }} />
      ))}
    </div>
  );
};

export const Compare: React.FC<{ p: Palette; a: CompareItem; b: CompareItem }> = ({ p, a, b }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vs = interpolate(frame, [0.6 * fps, 1.0 * fps], [0, 1], { ...clampOpt, easing: out });
  const box = (it: CompareItem, dir: -1 | 1, d: number) => {
    const pr = interpolate(frame, [d, d + 0.8 * fps], [0, 1], { ...clampOpt, easing: back });
    return (
      <div style={{ width: 400, height: 300, borderRadius: 28, background: it.accent ? p.accent : (p.bg === "#0B0B0E" ? "#19191E" : "#FBF8F1"), border: `2px solid ${it.accent ? p.accent : p.ink + "26"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: FONT, translate: `${(1 - pr) * dir * 500}px 0`, opacity: Math.min(1, pr * 1.4), boxShadow: "0 24px 50px rgba(20,26,38,0.12)" }}>
        <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: "0.14em", textTransform: "uppercase", color: it.accent ? "#fff" : p.mute }}>{it.label}</div>
        <div style={{ fontWeight: 900, fontSize: it.value.length > 6 ? 62 : 84, color: it.accent ? "#fff" : p.ink, letterSpacing: "-0.03em" }}>{it.value}</div>
        {it.sub ? <div style={{ fontWeight: 500, fontSize: 24, color: it.accent ? "rgba(255,255,255,.85)" : p.mute }}>{it.sub}</div> : null}
      </div>
    );
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
      {box(a, -1, 3)}
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: p.ink, opacity: vs, scale: String(vs) }}>VS</div>
      {box(b, 1, 10)}
    </div>
  );
};

export const Globe: React.FC<{ p: Palette }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pr = interpolate(frame, [0, 1.0 * fps], [0, 1], { ...clampOpt, easing: out });
  const pin = interpolate(frame, [0.5 * fps, 1.2 * fps], [0, 1], { ...clampOpt, easing: back });
  const pulse = ((frame / fps) * 0.8) % 1;
  return (
    <svg width={620} height={620} viewBox="-310 -310 620 620">
      {Array.from({ length: 13 }, (_, k) => k - 6).map((i) => (
        <g key={i} stroke={p.ink} strokeOpacity={0.12} strokeWidth={2} fill="none">
          <ellipse rx={Math.abs(i) < 6 ? 260 : 1} ry={Math.abs(i * 40)} />
          <ellipse rx={Math.abs(i * 42)} ry={260} />
        </g>
      ))}
      <circle r={260 * pr} fill="none" stroke={p.ink} strokeOpacity={0.4} strokeWidth={3} />
      <g transform={`translate(40 ${-60 - (1 - pin) * 200})`} opacity={pin}>
        <circle r={18} fill={p.accent} />
        <circle r={18 + pulse * 50} fill="none" stroke={p.accent} strokeOpacity={0.5 * (1 - pulse)} strokeWidth={4} />
      </g>
    </svg>
  );
};
