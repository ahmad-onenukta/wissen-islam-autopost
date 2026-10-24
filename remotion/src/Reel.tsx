import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { FONT } from "./fonts";
import { DARK_PALETTE, DEFAULT_PALETTE, FPS, TRANSITION_FRAMES, type Script } from "./types";
import { SceneView } from "./Scene";

export const sceneFrames = (s: { dur: number }) => Math.max(Math.round(s.dur * FPS), TRANSITION_FRAMES + 10);
export const totalFrames = (script: Script) =>
  script.scenes.reduce((a, s) => a + sceneFrames(s), 0) - (script.scenes.length - 1) * TRANSITION_FRAMES;

const Chrome: React.FC<{ handle: string; p: typeof DEFAULT_PALETTE }> = ({ handle, p }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const off = ((frame / fps) * 12) % 90;
  return (
    <>
      {/* parallax grid */}
      <AbsoluteFill style={{ backgroundColor: p.bg, backgroundImage: `linear-gradient(${p.line} 1px, transparent 1px), linear-gradient(90deg, ${p.line} 1px, transparent 1px)`, backgroundSize: "90px 90px", backgroundPosition: `${off * 0.5}px ${off}px` }} />
      {/* progress */}
      <div style={{ position: "absolute", top: 120, left: 90, width: 900, height: 6, background: `${p.ink}1a`, borderRadius: 3 }}>
        <div style={{ height: 6, width: `${(frame / durationInFrames) * 100}%`, background: p.accent, borderRadius: 3 }} />
      </div>
      <div style={{ position: "absolute", bottom: 90, left: 0, right: 0, textAlign: "center", fontFamily: FONT, fontWeight: 700, fontSize: 28, color: p.mute }}>{handle}</div>
    </>
  );
};

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.08 }}>
      <svg width="100%" height="100%"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 50} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#n)" /></svg>
    </AbsoluteFill>
  );
};

export const Reel: React.FC<{ script: Script }> = ({ script }) => {
  const p = { ...(script.theme === "dark" ? DARK_PALETTE : DEFAULT_PALETTE), ...(script.palette ?? {}) };
  return (
    <AbsoluteFill style={{ background: p.bg }}>
      <Chrome handle={script.handle} p={p} />
      <TransitionSeries>
        {script.scenes.flatMap((s, i) => {
          const d = sceneFrames(s);
          const el = [
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={d} premountFor={FPS}>
              <SceneView s={s} p={p} durationInFrames={d} captions={script.captions !== false} />
            </TransitionSeries.Sequence>,
          ];
          if (i < script.scenes.length - 1) {
            el.push(
              <TransitionSeries.Transition key={`t${i}`} presentation={slide({ direction: "from-bottom" })} timing={springTiming({ config: { damping: 22, stiffness: 160 }, durationInFrames: TRANSITION_FRAMES })} />,
            );
          }
          return el;
        })}
      </TransitionSeries>
      <AbsoluteFill style={{ pointerEvents: "none", background: script.theme === "dark" ? "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" : "radial-gradient(ellipse at center, rgba(20,26,38,0) 55%, rgba(20,26,38,0.14) 100%)" }} />
      <Grain />
      {script.audio ? <Audio src={staticFile(script.audio)} volume={script.vo ? 0.35 : 1} /> : null}
      {script.vo ? <Sequence from={6} layout="none"><Audio src={staticFile(script.vo)} /></Sequence> : null}
    </AbsoluteFill>
  );
};
