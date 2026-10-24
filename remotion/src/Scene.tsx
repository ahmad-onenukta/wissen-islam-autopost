import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT } from "./fonts";
import type { Palette, Scene as SceneT } from "./types";
import { Kicker, Kinetic, Odometer, SmallCaps } from "./components/Text";
import { Bars, Card, Compare, Globe, Rings, Sphere, Timeline } from "./components/Visuals";
import { Captions } from "./components/Captions";

export const SceneView: React.FC<{ s: SceneT; p: Palette; durationInFrames: number; captions?: boolean }> = ({ s, p, durationInFrames, captions = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hasNum = s.number !== undefined;
  const photo = !!s.image;
  const vis = s.visual ?? "none";
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.035], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const size = s.size ?? (hasNum ? 74 : (s.text?.length ?? 0) > 70 ? 84 : 96);
  const textTop = photo ? 300 : hasNum ? 440 : vis === "none" ? 760 : 470;
  const srcOp = interpolate(frame, [0.8 * fps, 1.3 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });

  const kb = interpolate(frame, [0, durationInFrames], [1.06, 1.18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const kbx = interpolate(frame, [0, durationInFrames], [0, -24], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const imgIn = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ scale: photo ? "1" : String(zoom) }}>
      {photo ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img src={staticFile(s.image!)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: s.imagePos ?? "center", filter: "grayscale(1) contrast(1.12) brightness(0.72)", scale: String(kb), translate: `${kbx}px 0`, opacity: imgIn }} />
          <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(11,11,14,0.85) 0%, rgba(11,11,14,0.25) 35%, rgba(11,11,14,0.15) 60%, rgba(11,11,14,0.92) 100%)" }} />
          {s.imageCredit ? <div style={{ position: "absolute", right: 40, top: 150, fontFamily: FONT, fontSize: 18, color: p.mute, opacity: 0.7, letterSpacing: "0.08em" }}>{s.imageCredit}</div> : null}
        </AbsoluteFill>
      ) : null}
      {/* text block */}
      <div style={{ position: "absolute", top: textTop, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 90px" }}>
        <Kicker text={s.kicker} p={p} />
        {s.text ? <Kinetic text={s.text} size={size} p={p} /> : null}
      </div>
      {/* number */}
      {hasNum ? (
        <div style={{ position: "absolute", top: 960, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Odometer value={typeof s.number === "number" ? s.number.toLocaleString("de-DE") : String(s.number)} p={p} />
          <SmallCaps text={s.numlbl} p={p} />
        </div>
      ) : null}
      {/* visual */}
      {photo ? null : <div style={{ position: "absolute", top: 940, left: 0, right: 0, height: 620, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {vis === "sphere" && <Sphere p={p} />}
        {vis === "rings" && <Rings p={p} />}
        {vis === "bars" && <Bars p={p} vals={s.bars ?? [3, 5, 8, 13]} labels={s.barLabels} />}
        {vis === "timeline" && <Timeline p={p} items={s.items ?? []} active={s.active ?? 0} />}
        {vis === "card" && <Card p={p} />}
        {vis === "cards" && (
          <div style={{ display: "flex", gap: -40, alignItems: "center" }}>
            <div style={{ translate: "40px 20px", zIndex: 1 }}><Card p={p} w={420} h={540} /></div>
            <div style={{ translate: "-40px -20px" }}><Card p={p} w={420} h={540} dir={-1} delay={5} /></div>
          </div>
        )}
        {vis === "compare" && s.a && s.b && <Compare p={p} a={s.a} b={s.b} />}
        {vis === "map" && <Globe p={p} />}
      </div>}
      {s.vo && captions ? <Captions vo={s.vo} p={p} durationInFrames={durationInFrames} /> : null}
      {/* source */}
      {s.source ? (
        <div style={{ position: "absolute", bottom: 160, left: 90, right: 90, textAlign: "center", fontFamily: FONT, fontWeight: 500, fontSize: 20, color: p.mute, opacity: srcOp }}>{s.source}</div>
      ) : null}
    </AbsoluteFill>
  );
};
