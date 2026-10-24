import React from "react";
import { AbsoluteFill } from "remotion";
import { ESSAY_PALETTE, LIGHT_PALETTE } from "./types";
import { FONT } from "../fonts";

/**
 * Cover-Standbild fuer das Profilraster.
 *
 * Instagram schneidet Reel-Cover im Raster quadratisch aus der Mitte zu. Deshalb
 * steht hier alles mittig statt oben links wie im Reel selbst: Was ausserhalb
 * des mittleren 1080x1080-Fensters liegt, sieht im Profil niemand.
 */
export type CoverProps = {
  line: string;          // Haupttext, *Wort* wird rot
  kicker?: string;       // kleine Zeile darueber
  handle?: string;
  light?: boolean;       // heller Hintergrund statt dunkel
};

const SAFE_TOP = 420;    // oberhalb davon schneidet der quadratische Crop ab
const SAFE_H = 1080;

export const Cover: React.FC<CoverProps> = ({
  line,
  kicker,
  handle = "@nurwissen_official",
  light = false,
}) => {
  const p = light ? LIGHT_PALETTE : ESSAY_PALETTE;
  const parts = line.split(/\*(.+?)\*/g); // ungerade Indizes sind betont

  // Schriftgroesse nach Textlaenge, damit lange Zeilen nicht aus dem Rahmen laufen
  const n = line.replace(/\*/g, "").length;
  const size = n > 90 ? 76 : n > 60 ? 92 : n > 36 ? 110 : 128;

  return (
    <AbsoluteFill style={{ background: p.bg, fontFamily: FONT }}>
      {/* leichter Lichtkegel hinter dem Text */}
      <AbsoluteFill
        style={{
          background: light
            ? "radial-gradient(ellipse 90% 60% at 50% 50%, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)"
            : "radial-gradient(ellipse 90% 60% at 50% 50%, rgba(255,255,255,0.07), rgba(255,255,255,0) 70%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: SAFE_TOP,
          left: 0,
          width: 1080,
          height: SAFE_H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 86px",
          textAlign: "center",
          gap: 34,
        }}
      >
        <div style={{ width: 90, height: 5, background: p.accent, borderRadius: 3 }} />

        {kicker ? (
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: p.dim,
            }}
          >
            {kicker}
          </div>
        ) : null}

        <div
          style={{
            fontSize: size,
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: p.ink,
            textWrap: "balance",
          }}
        >
          {parts.map((t, i) =>
            i % 2 === 1 ? (
              <span key={i} style={{ color: p.accent }}>
                {t}
              </span>
            ) : (
              <span key={i}>{t}</span>
            ),
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 92,
          width: 1080,
          textAlign: "center",
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: "0.16em",
          color: p.mute,
        }}
      >
        {handle}
      </div>
    </AbsoluteFill>
  );
};
