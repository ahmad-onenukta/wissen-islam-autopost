import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { FONT } from "../fonts";
import { ESSAY_PALETTE, LIGHT_PALETTE, FPS, type Block, type EssayScript } from "./types";
import { WordSync } from "./WordSync";
import { VisualFor } from "./Visuals";

export const essayFrames = (s: EssayScript) => Math.round(s.duration * FPS);

const sig = (b: Block) => JSON.stringify([b.visual, b.mapFrom, b.mapTo, b.docTitle, b.docHighlight, b.number, b.items, b.active, b.a, b.b, b.ca, b.cb, b.quote, b.cardText, b.ar, b.de, b.sources, b.light, b.letters, b.stat, b.slider, b.acrostic]);
const bgSig = (b: Block) => JSON.stringify([b.image ?? null, !!b.light]);

const Photo: React.FC<{ src: string; pos?: string; frames: number }> = ({ src, pos, frames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const kb = interpolate(frame, [0, frames], [1.06, 1.18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kbx = interpolate(frame, [0, frames], [0, -26], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const inK = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outK = interpolate(frame, [frames - 0.4 * fps, frames - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity: inK * outK }}>
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: pos ?? "center", filter: "grayscale(1) contrast(1.1) brightness(0.62)", transform: `scale(${kb}) translateX(${kbx}px)` }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(13,13,15,0.88) 0%, rgba(13,13,15,0.35) 30%, rgba(13,13,15,0.25) 60%, rgba(13,13,15,0.92) 100%)" }} />
    </AbsoluteFill>
  );
};

const LightBeat: React.FC<{ frames: number }> = ({ frames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inK = interpolate(frame, [0, 0.35 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outK = interpolate(frame, [frames - 0.3 * fps, frames - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: inK * outK, background: "radial-gradient(ellipse 100% 86% at 50% 48%, #F4F2ED 0%, #F1EFEA 58%, rgba(241,239,234,0.0) 100%)" }} />;
};

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.07 }}>
      <svg width="100%" height="100%"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 40} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#n)" /></svg>
    </AbsoluteFill>
  );
};

const VisualRun: React.FC<{ b: Block; p: typeof ESSAY_PALETTE; handle: string; frames: number }> = ({ b, p, handle, frames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inK = interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outK = interpolate(frame, [frames - 0.25 * fps, frames - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ top: 700, height: 1000, display: "flex", alignItems: "center", justifyContent: "center", opacity: inK * outK, transform: `translateY(${(1 - inK) * 30}px)` }}>
      <VisualFor b={b} p={p} handle={handle} />
    </AbsoluteFill>
  );
};

export const Essay: React.FC<{ script: EssayScript }> = ({ script }) => {
  const p = { ...ESSAY_PALETTE, ...(script.palette ?? {}) };
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const align = script.align ?? "left";
  // group visuals into runs
  const runs: { b: Block; start: number; end: number }[] = [];
  for (const b of script.blocks) {
    const last = runs[runs.length - 1];
    if (last && sig(last.b) === sig(b)) last.end = b.end; else runs.push({ b, start: b.start, end: b.end });
  }
  const bgRuns: { b: Block; start: number; end: number }[] = [];
  for (const b of script.blocks) {
    const last = bgRuns[bgRuns.length - 1];
    if (last && bgSig(last.b) === bgSig(b)) last.end = b.end; else bgRuns.push({ b, start: b.start, end: b.end });
  }
  const pal = (b: Block) => (b.light ? LIGHT_PALETTE : p);
  return (
    <AbsoluteFill style={{ background: p.bg }}>
      {/* soft top light like reference */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%)" }} />
      {bgRuns.map((r, i) => {
        if (!r.b.image && !r.b.light) return null;
        const from = Math.round(r.start * FPS), len = Math.max(2, Math.round((r.end - r.start) * FPS));
        return (
          <Sequence key={`b${i}`} from={from} durationInFrames={len} layout="none">
            {r.b.light ? <LightBeat frames={len} /> : <Photo src={r.b.image!} pos={r.b.imagePos} frames={len} />}
          </Sequence>
        );
      })}
      {runs.map((r, i) => {
        const from = Math.round(r.start * FPS), len = Math.max(2, Math.round((r.end - r.start) * FPS));
        return (
          <Sequence key={`v${i}`} from={from} durationInFrames={len} layout="none">
            <VisualRun b={r.b} p={pal(r.b)} handle={script.handle} frames={len} />
          </Sequence>
        );
      })}
      {script.blocks.map((b, i) => {
        const from = Math.round(b.start * FPS), len = Math.max(2, Math.round((b.end - b.start) * FPS));
        return (
          <Sequence key={`t${i}`} from={from} durationInFrames={len} layout="none">
            <WordSync b={b} p={pal(b)} align={align} />
          </Sequence>
        );
      })}
      {/* progress + handle */}
      <div style={{ position: "absolute", top: 150, left: 84, width: 912, height: 3, background: "rgba(255,255,255,0.12)" }}>
        <div style={{ height: 3, width: `${(frame / durationInFrames) * 100}%`, background: p.accent }} />
      </div>
      <div style={{ position: "absolute", bottom: 96, left: 0, right: 0, textAlign: "center", fontFamily: FONT, fontWeight: 700, fontSize: 26, color: p.mute, letterSpacing: "0.02em" }}>{script.handle}</div>
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.5) 100%)" }} />
      <Grain />
      {script.audio ? <Audio src={staticFile(script.audio)} volume={0.1} /> : null}
      {script.vo ? <Audio src={staticFile(script.vo)} /> : null}
    </AbsoluteFill>
  );
};
