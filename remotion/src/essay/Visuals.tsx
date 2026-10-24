import React, { useMemo } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { geoNaturalEarth1, geoPath, geoInterpolate } from "d3-geo";
import { feature } from "topojson-client";
import land from "world-atlas/land-110m.json";
import { FONT, ARABIC } from "../fonts";
import type { Block, EssayPalette } from "./types";
import type { Palette } from "../types";
import { Timeline, Bars, Compare } from "../components/Visuals";

const out = Easing.bezier(0.16, 1, 0.3, 1);
const back = Easing.bezier(0.34, 1.3, 0.64, 1);
const C = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const PLACES: Record<string, [number, number]> = {
  Mekka: [39.826, 21.422], Medina: [39.61, 24.47], Istanbul: [28.98, 41.01], Birmingham: [-1.89, 52.48], Oxford: [-1.26, 51.75], Paris: [2.35, 48.86], Kairo: [31.24, 30.04], Bagdad: [44.36, 33.31], Mossul: [43.13, 36.34], Jerusalem: [35.21, 31.77], Damaskus: [36.29, 33.51], Cordoba: [-4.78, 37.88], Fes: [-5.0, 34.03], Berlin: [13.4, 52.52], Spanien: [-6.9, 37.2], Palos: [-6.9, 37.2], Karibik: [-74.5, 24.0], Bahamas: [-74.5, 24.0], Indien: [77.2, 20.6], Genua: [8.93, 44.41],
};

export const toOld = (p: EssayPalette): Palette => ({ bg: "#0B0B0E", ink: p.ink, accent: p.accent, accent2: "#D9B86A", mute: p.mute, line: p.line });

/* ---------- MAP with route ---------- */
export const MapRoute: React.FC<{ p: EssayPalette; from: string; to: string }> = ({ p, from, to }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const W = 1080, H = 820;
  const a = PLACES[from] ?? PLACES.Mekka, b = PLACES[to] ?? PLACES.Birmingham;
  const { path, pa, pb, route } = useMemo(() => {
    const proj = geoNaturalEarth1().fitExtent([[-W * 0.35, -H * 0.1], [W * 1.35, H * 1.2]], feature(land as any, (land as any).objects.land) as any);
    // center between a and b
    const mid = geoInterpolate(a, b)(0.5);
    proj.rotate([-mid[0], 0]).center([0, mid[1]]).scale(620).translate([W / 2, H / 2]);
    const gp = geoPath(proj);
    const path = gp(feature(land as any, (land as any).objects.land) as any) ?? "";
    const interp = geoInterpolate(a, b);
    const pts = Array.from({ length: 60 }, (_, i) => proj(interp(i / 59)) as [number, number]);
    return { path, pa: proj(a) as [number, number], pb: proj(b) as [number, number], route: pts };
  }, [from, to]);
  const draw = interpolate(frame, [0.9 * fps, 2.2 * fps], [0, 1], { ...C, easing: out });
  const n = Math.max(1, Math.floor(route.length * draw));
  const d = route.slice(0, n).map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
  const pinA = interpolate(frame, [0.2 * fps, 0.7 * fps], [0, 1], { ...C, easing: back });
  const pinB = interpolate(frame, [2.0 * fps, 2.5 * fps], [0, 1], { ...C, easing: back });
  const zoom = interpolate(frame, [0, 10 * fps], [1, 1.1], C);
  const pulse = ((frame / fps) * 0.7) % 1;
  const Pin = ({ at, k, label, acc }: { at: [number, number]; k: number; label: string; acc: boolean }) => (
    <g transform={`translate(${at[0]} ${at[1]})`} opacity={k}>
      {acc ? <circle r={12 + pulse * 36} fill="none" stroke={p.accent} strokeOpacity={0.6 * (1 - pulse)} strokeWidth={3} /> : null}
      <circle r={11} fill={acc ? p.accent : p.ink} stroke={p.bg} strokeWidth={4} transform={`scale(${k})`} />
      <text x={20} y={9} fontFamily={FONT} fontWeight={700} fontSize={26} fill={p.ink}>{label}</text>
    </g>
  );
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ transform: `scale(${zoom})`, transformOrigin: "50% 50%", WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, #000 55%, transparent 100%)", maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, #000 55%, transparent 100%)" }}>
      <path d={path} fill="#232327" stroke="#3B3B41" strokeWidth={1} />
      <path d={d} fill="none" stroke={p.accent} strokeWidth={4} strokeLinecap="round" strokeDasharray="10 8" />
      <Pin at={pa} k={pinA} label={from} acc={false} />
      <Pin at={pb} k={pinB} label={to} acc />
    </svg>
  );
};

/* ---------- DOCUMENT card ---------- */
export const Document: React.FC<{ p: EssayPalette; title?: string; highlight?: boolean }> = ({ p, title, highlight }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pr = interpolate(frame, [0, 0.8 * fps], [0, 1], { ...C, easing: back });
  const lines = 13;
  const hl = interpolate(frame, [0.6 * fps, 1.1 * fps], [0, 1], { ...C, easing: out });
  const bob = Math.sin((frame / fps) * 0.9) * 5;
  return (
    <div style={{ width: 640, height: 780, background: p.card, borderRadius: 26, border: `1.5px solid ${p.line}`, boxShadow: "0 40px 90px rgba(0,0,0,0.55)", padding: "54px 56px", display: "flex", flexDirection: "column", gap: 0, opacity: Math.min(1, pr * 1.4), transform: `translateY(${(1 - pr) * 90 + bob}px) rotate(${(1 - pr) * -3}deg)`, fontFamily: FONT }}>
      {title ? <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: p.mute, marginBottom: 34 }}>{title}</div> : null}
      {Array.from({ length: lines }, (_, i) => {
        const k = interpolate(frame, [4 + i * 2, 4 + i * 2 + 0.5 * fps], [0, 1], { ...C, easing: out });
        const isH = highlight && i === 6;
        return (
          <div key={i} style={{ height: isH ? 10 : 7, marginBottom: 32, borderRadius: 5, background: isH ? p.accent : p.line, opacity: isH ? hl : 0.9, width: `${(55 + 45 * Math.abs(Math.sin(i * 1.9 + 0.7))) * k}%`, boxShadow: isH ? `0 0 24px ${p.accent}88` : undefined }} />
        );
      })}
    </div>
  );
};

/* ---------- QUOTE CARDS multiplying ---------- */
const QuoteCard: React.FC<{ p: EssayPalette; w: number; text: string; ref_: string; k: number; small?: boolean }> = ({ p, w, text, ref_, k, small }) => (
  <div style={{ width: w, background: p.card, borderRadius: 16, border: `1.5px solid ${p.line}`, borderLeft: `5px solid ${p.accent}`, padding: small ? "16px 18px" : "26px 30px", fontFamily: FONT, color: p.ink, opacity: k, transform: `scale(${0.85 + 0.15 * k})`, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
    <div style={{ fontSize: small ? 18 : 26, fontWeight: 600, lineHeight: 1.3 }}>{text}</div>
    <div style={{ fontSize: small ? 12 : 16, fontWeight: 700, letterSpacing: "0.14em", color: p.mute, marginTop: small ? 8 : 14 }}>{ref_}</div>
  </div>
);

export const Cards: React.FC<{ p: EssayPalette; text?: string; ref_?: string }> = ({ p, text = "Zwei Pergamentblätter · Hidschasi", ref_ = "MINGANA 1572a" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = (d: number) => interpolate(frame, [d, d + 0.6 * fps], [0, 1], { ...C, easing: back });
  const pos: [number, number, number][] = [[-290, -230, 0.5 * fps], [290, -230, 0.7 * fps], [-290, 230, 0.9 * fps], [290, 230, 1.1 * fps]];
  return (
    <div style={{ position: "relative", width: 900, height: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {pos.map(([x, y, d], i) => (
        <div key={i} style={{ position: "absolute", transform: `translate(${x}px, ${y}px)` }}>
          <QuoteCard p={p} w={330} text={text} ref_={ref_} k={k(d)} small />
        </div>
      ))}
      <QuoteCard p={p} w={480} text={text} ref_={ref_} k={k(0)} />
    </div>
  );
};

/* ---------- QUOTE (single, big) ---------- */
export const Quote: React.FC<{ p: EssayPalette; text: string; ref_: string }> = ({ p, text, ref_ }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0, 0.8 * fps], [0, 1], { ...C, easing: back });
  const lines = 9;
  return (
    <div style={{ position: "relative", width: 760 }}>
      <div style={{ width: 760, background: p.card, borderRadius: 26, border: `1.5px solid ${p.line}`, padding: "50px 56px", fontFamily: FONT, opacity: k, transform: `translateY(${(1 - k) * 80}px)`, boxShadow: "0 40px 90px rgba(0,0,0,0.55)" }}>
        {Array.from({ length: lines }, (_, i) => {
          const isH = i === 4;
          return isH ? (
            <div key={i} style={{ margin: "18px 0 24px", padding: "22px 26px", background: p.accent, borderRadius: 14, color: "#fff", fontSize: 30, fontWeight: 700, lineHeight: 1.3, transform: `scale(${0.9 + 0.1 * k})` }}>
              {text}
              <div style={{ fontSize: 16, letterSpacing: "0.16em", marginTop: 12, opacity: 0.85 }}>{ref_}</div>
            </div>
          ) : (
            <div key={i} style={{ height: 7, marginBottom: 30, borderRadius: 5, background: p.line, width: `${55 + 45 * Math.abs(Math.sin(i * 1.9 + 0.7))}%` }} />
          );
        })}
      </div>
    </div>
  );
};

/* ---------- COUNTER ---------- */
export const Counter: React.FC<{ p: EssayPalette; n: number; label?: string }> = ({ p, n, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0.2 * fps, 1.8 * fps], [0, 1], { ...C, easing: out });
  const v = Math.round(n * k);
  const s = String(v).padStart(String(n).length, "0");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: FONT }}>
      <div style={{ fontSize: 260, fontWeight: 900, letterSpacing: "-0.04em", color: p.ink, lineHeight: 1, fontVariantNumeric: "tabular-nums", textShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>{s}</div>
      {label ? <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.3em", color: p.mute, marginTop: 20 }}>{label}</div> : null}
    </div>
  );
};

/* ---------- RANGE 568 ——— 645 ---------- */
export const Range: React.FC<{ p: EssayPalette; a: string; b: string; sub?: string }> = ({ p, a, b, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ka = interpolate(frame, [0, 0.6 * fps], [0, 1], { ...C, easing: back });
  const bar = interpolate(frame, [0.5 * fps, 1.6 * fps], [0, 1], { ...C, easing: out });
  const kb = interpolate(frame, [1.4 * fps, 2.0 * fps], [0, 1], { ...C, easing: back });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: FONT, width: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: 900 }}>
        <div style={{ fontSize: 150, fontWeight: 900, color: p.ink, letterSpacing: "-0.04em", opacity: ka, transform: `translateY(${(1 - ka) * 40}px)` }}>{a}</div>
        <div style={{ flex: 1, margin: "0 30px", height: 8, background: p.line, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${bar * 100}%`, height: 8, background: p.accent }} /></div>
        <div style={{ fontSize: 150, fontWeight: 900, color: p.accent, letterSpacing: "-0.04em", opacity: kb, transform: `translateY(${(1 - kb) * 40}px)` }}>{b}</div>
      </div>
      {sub ? <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.22em", color: p.mute, marginTop: 24, opacity: kb }}>{sub}</div> : null}
    </div>
  );
};

/* ---------- QUESTION boxes ---------- */
export const Question: React.FC<{ p: EssayPalette; n?: number }> = ({ p, n = 5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", gap: 22 }}>
      {Array.from({ length: n }, (_, i) => {
        const k = interpolate(frame, [0.2 * fps + i * 4, 0.2 * fps + i * 4 + 0.5 * fps], [0, 1], { ...C, easing: back });
        const blink = Math.sin(frame / fps * 2 + i) > 0.6 ? 1 : 0.55;
        return <div key={i} style={{ width: 140, height: 170, borderRadius: 18, background: p.card, border: `1.5px solid ${p.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 900, fontSize: 90, color: i === 2 ? p.accent : p.dim, opacity: k * blink, transform: `scale(${k}) translateY(${(1 - k) * 40}px)` }}>?</div>;
      })}
    </div>
  );
};

/* ---------- SPOTLIGHT ---------- */
export const Spotlight: React.FC<{ p: EssayPalette }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0, 1.2 * fps], [0, 1], { ...C, easing: out });
  return <div style={{ width: 1100, height: 1100, borderRadius: "50%", background: `radial-gradient(circle, rgba(255,255,255,${0.28 * k}) 0%, rgba(255,255,255,${0.08 * k}) 35%, rgba(255,255,255,0) 70%)`, transform: `scale(${0.6 + 0.4 * k})` }} />;
};

/* ---------- SOURCES ---------- */
export const Sources: React.FC<{ p: EssayPalette; items: string[]; handle: string }> = ({ p, items, handle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 26, fontFamily: FONT, width: 900 }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.22em", color: p.mute }}>QUELLEN</div>
      {items.map((s, i) => {
        const k = interpolate(frame, [0.3 * fps + i * 8, 0.3 * fps + i * 8 + 0.5 * fps], [0, 1], { ...C, easing: out });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, opacity: k, transform: `translateX(${(1 - k) * -30}px)` }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: p.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 24 }}>✓</div>
            <div style={{ fontSize: 32, fontWeight: 600, color: p.ink }}>{s}</div>
          </div>
        );
      })}
      <div style={{ fontSize: 30, fontWeight: 800, color: p.dim, marginTop: 40 }}>{handle}</div>
    </div>
  );
};


/* ---------- AYAH card: Arabic + German ---------- */
export const Ayah: React.FC<{ p: EssayPalette; ar: string; de?: string; ref_?: string }> = ({ p, ar, de, ref_ }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0, 0.7 * fps], [0, 1], { ...C, easing: back });
  const words = ar.split(/\s+/).filter(Boolean);
  let acc = false;
  const toks = words.map((w) => { const st = w.startsWith("*"); const en = w.endsWith("*") || /\*[^\p{L}]*$/u.test(w); if (st) acc = true; const t = { w: w.replace(/\*/g, ""), acc }; if (en) acc = false; return t; });
  const deK = interpolate(frame, [0.9 * fps, 1.5 * fps], [0, 1], { ...C, easing: out });
  const long = ar.length > 90;
  return (
    <div style={{ width: 920, background: p.card, borderRadius: 28, border: `1.5px solid ${p.line}`, boxShadow: "0 40px 90px rgba(0,0,0,0.55)", padding: "44px 52px 40px", opacity: k, transform: `translateY(${(1 - k) * 70}px)`, fontFamily: FONT }}>
      <div dir="rtl" lang="ar" style={{ fontFamily: ARABIC, fontSize: long ? 58 : 68, lineHeight: 1.8, color: p.ink, textAlign: "right", display: "flex", flexWrap: "wrap", justifyContent: "flex-start", columnGap: "0.32em" }}>
        {toks.map((t, i) => {
          const wk = interpolate(frame, [0.15 * fps + i * 2.2, 0.15 * fps + i * 2.2 + 0.35 * fps], [0, 1], { ...C, easing: out });
          return <span key={i} style={{ color: t.acc ? p.accent : p.ink, opacity: wk, filter: `blur(${(1 - wk) * 6}px)`, textShadow: t.acc ? `0 0 28px ${p.accent}66` : undefined }}>{t.w}</span>;
        })}
      </div>
      <div style={{ height: 1.5, background: p.line, margin: "26px 0 22px", transform: `scaleX(${deK})`, transformOrigin: "left" }} />
      {de ? <div style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.35, color: p.dim, opacity: deK, transform: `translateY(${(1 - deK) * 12}px)` }}>{de}</div> : null}
      {ref_ ? <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.18em", color: p.accent, marginTop: 20, opacity: deK }}>{ref_}</div> : null}
    </div>
  );
};


/* ---------- LETTERS (acrostic boxes) ---------- */
export const Letters: React.FC<{ p: EssayPalette; word: string; active?: number; revealed?: number; label?: string }> = ({ p, word, active, revealed, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = word.split("");
  // Ohne active/revealed ist das Wort kein Akronym-Raetsel, sondern einfach ein
  // Wort: dann alle Buchstaben zeigen statt Fragezeichen-Kacheln.
  const plain = active === undefined && revealed === undefined;
  const act = active ?? -1;
  const rev = plain ? chars.length : revealed ?? 0;
  // Kachelbreite an die Wortlaenge anpassen, sonst laeuft es aus dem 1080er Bild.
  const gap = chars.length > 6 ? 10 : 20;
  const tile = Math.min(150, Math.floor((940 - gap * (chars.length - 1)) / chars.length));
  const fsz = Math.round(tile * 0.64);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36, fontFamily: FONT }}>
      <div style={{ display: "flex", gap }}>
        {chars.map((c, i) => {
          const k = interpolate(frame, [0.1 * fps + i * 3, 0.1 * fps + i * 3 + 0.45 * fps], [0, 1], { ...C, easing: back });
          const shown = i < rev;
          const isA = i === act;
          const pop = isA ? interpolate(frame, [0.4 * fps, 0.75 * fps], [0.8, 1], { ...C, easing: back }) : 1;
          return (
            <div key={i} style={{ width: tile, height: Math.round(tile * 1.2), borderRadius: 20, background: isA ? p.accent : p.card, border: `1.5px solid ${isA ? p.accent : p.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: fsz, color: isA ? "#fff" : shown ? p.ink : p.mute, opacity: k, transform: `scale(${k * pop}) translateY(${(1 - k) * 40}px)`, boxShadow: isA ? `0 0 60px ${p.accent}66` : "0 20px 50px rgba(0,0,0,0.35)" }}>
              {shown || isA ? c : "?"}
            </div>
          );
        })}
      </div>
      {label ? <div style={{ fontSize: 84, fontWeight: 800, color: p.ink, letterSpacing: "-0.02em", opacity: interpolate(frame, [0.6 * fps, 1.0 * fps], [0, 1], C) }}>{label}</div> : null}
    </div>
  );
};

/* ---------- COMPASS ---------- */
export const Compass: React.FC<{ p: EssayPalette }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0, 0.8 * fps], [0, 1], { ...C, easing: back });
  const t = frame / fps;
  const settle = interpolate(t, [0.3, 2.2], [-140, 32], { ...C, easing: Easing.bezier(0.2, 0.9, 0.2, 1.05) });
  const wobble = Math.sin(t * 2.3) * 3 * Math.exp(-t * 0.6);
  const ang = settle + wobble;
  return (
    <svg width={620} height={620} viewBox="-310 -310 620 620" style={{ opacity: k, transform: `scale(${0.8 + 0.2 * k})` }}>
      <circle r={290} fill={p.card} stroke={p.line} strokeWidth={3} />
      <circle r={250} fill="none" stroke={p.line} strokeWidth={1.5} />
      {Array.from({ length: 60 }, (_, i) => (
        <line key={i} x1={0} y1={-282} x2={0} y2={i % 5 === 0 ? -258 : -270} stroke={i % 5 === 0 ? p.ink : p.mute} strokeWidth={i % 5 === 0 ? 4 : 2} transform={`rotate(${i * 6})`} />
      ))}
      {["N", "O", "S", "W"].map((d, i) => (
        <text key={d} x={0} y={-205} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={40} fill={i === 0 ? p.accent : p.dim} transform={`rotate(${i * 90})`}>{d}</text>
      ))}
      <g transform={`rotate(${ang})`}>
        <polygon points="0,-230 -26,0 26,0" fill={p.accent} />
        <polygon points="0,230 -26,0 26,0" fill={p.dim} opacity={0.6} />
      </g>
      <circle r={22} fill={p.ink} />
      <circle r={9} fill={p.card} />
    </svg>
  );
};

/* ---------- STAT ---------- */
export const Stat: React.FC<{ p: EssayPalette; value: string; unit?: string; sub?: string }> = ({ p, value, unit, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0.1 * fps, 0.9 * fps], [0, 1], { ...C, easing: out });
  // Nur echte Einzelzahlen hochzaehlen. Spannen ("0-9", "1 - 2") und alles
  // mit Buchstaben bleiben stehen, sonst wird aus "0-9" die Zahl 9.
  const pure = /^\s*\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?\s*$/.test(value);
  const num = pure ? parseFloat(value.replace(/[^0-9,]/g, "").replace(",", ".")) : NaN;
  const shown = isNaN(num) ? value : Math.round(num * k).toLocaleString("de-DE");
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <div style={{ fontSize: 230, fontWeight: 900, letterSpacing: "-0.04em", color: p.accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{shown}</div>
        {unit ? <div style={{ fontSize: 80, fontWeight: 800, color: p.ink, opacity: k }}>{unit}</div> : null}
      </div>
      {sub ? <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.22em", color: p.mute, marginTop: 20, opacity: k }}>{sub}</div> : null}
    </div>
  );
};

/* ---------- SLIDER ---------- */
export const Slider: React.FC<{ p: EssayPalette; a: string; b: string; pos?: number; label?: string }> = ({ p, a, b, pos = 0.62, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = interpolate(frame, [0.2 * fps, 1.4 * fps], [0, pos], { ...C, easing: out });
  return (
    <div style={{ width: 880, fontFamily: FONT }}>
      {label ? <div style={{ fontSize: 30, fontWeight: 700, color: p.dim, marginBottom: 28 }}>{label}</div> : null}
      <div style={{ position: "relative", height: 26, background: p.line, borderRadius: 13 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: 26, width: `${k * 100}%`, background: p.ink, borderRadius: 13 }} />
        <div style={{ position: "absolute", left: `${k * 100}%`, top: -22, width: 6, height: 70, background: p.accent, borderRadius: 3, transform: "translateX(-3px)", boxShadow: `0 0 24px ${p.accent}` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontSize: 24, fontWeight: 700, letterSpacing: "0.14em", color: p.mute }}><span>{a}</span><span>{b}</span></div>
    </div>
  );
};

/* ---------- ACROSTIC (vertical) ---------- */
export const Acrostic: React.FC<{ p: EssayPalette; items: { l: string; w: string; s?: string }[] }> = ({ p, items }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, fontFamily: FONT, width: 760 }}>
      {items.map((it, i) => {
        const k = interpolate(frame, [0.2 * fps + i * 9, 0.2 * fps + i * 9 + 0.5 * fps], [0, 1], { ...C, easing: out });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 34, opacity: k, transform: `translateX(${(1 - k) * -40}px)` }}>
            <div style={{ width: 92, fontSize: 92, fontWeight: 900, color: p.accent, lineHeight: 1 }}>{it.l}</div>
            <div><div style={{ fontSize: 46, fontWeight: 800, color: p.ink, lineHeight: 1.05 }}>{it.w}</div>{it.s ? <div style={{ fontSize: 24, fontWeight: 600, color: p.mute, marginTop: 4 }}>{it.s}</div> : null}</div>
          </div>
        );
      })}
    </div>
  );
};

/* ---------- dispatcher ---------- */
export const VisualFor: React.FC<{ b: Block; p: EssayPalette; handle: string }> = ({ b, p, handle }) => {
  const po = toOld(p);
  switch (b.visual) {
    case "map": return <MapRoute p={p} from={b.mapFrom ?? "Mekka"} to={b.mapTo ?? "Birmingham"} />;
    case "document": return <Document p={p} title={b.docTitle} highlight={b.docHighlight} />;
    case "cards": return <Cards p={p} text={b.cardText} ref_={b.cardRef} />;
    case "quote": return <Quote p={p} text={b.quote ?? ""} ref_={b.quoteRef ?? ""} />;
    case "counter": return <Counter p={p} n={b.number ?? 0} label={b.numlbl} />;
    case "range": return <Range p={p} a={b.a ?? ""} b={b.b ?? ""} sub={b.sub} />;
    case "question": return <Question p={p} />;
    case "spotlight": return <Spotlight p={p} />;
    case "timeline": return <div style={{ transform: `scale(${(b.items?.length ?? 0) > 3 ? 1.0 : 1.3})` }}><Timeline p={po} items={b.items ?? []} active={b.active ?? 0} /></div>;
    case "bars": return <Bars p={po} vals={[2, 4, 7, 11, 16]} labels={["", "", "", "", "C14"]} />;
    case "compare": return b.ca && b.cb ? <Compare p={po} a={b.ca} b={b.cb} /> : null;
    case "ayah": return <Ayah p={p} ar={b.ar ?? ""} de={b.de} ref_={b.ref} />;
    case "letters": return b.letters ? <Letters p={p} word={b.letters.word} active={b.letters.active} revealed={b.letters.revealed} label={b.letters.label} /> : null;
    case "compass": return <Compass p={p} />;
    case "stat": return b.stat ? <Stat p={p} value={b.stat.value} unit={b.stat.unit} sub={b.stat.sub} /> : null;
    case "slider": return b.slider ? <Slider p={p} a={b.slider.a} b={b.slider.b} pos={b.slider.pos} label={b.slider.label} /> : null;
    case "acrostic": return b.acrostic ? <Acrostic p={p} items={b.acrostic} /> : null;
    case "sources": return <Sources p={p} items={b.sources ?? []} handle={handle} />;
    default: return null;
  }
};
