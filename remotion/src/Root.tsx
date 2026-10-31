import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { Reel, totalFrames } from "./Reel";
import { FPS, type Script } from "./types";
import { Essay, essayFrames } from "./essay/Essay";
import { Cover } from "./essay/Cover";
import type { EssayScript } from "./essay/types";
import "./fonts";

type Props = { script: Script };
type EProps = { script: EssayScript };

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: totalFrames(props.script), fps: FPS, width: 1080, height: 1920,
});
const calcEssay: CalculateMetadataFunction<EProps> = ({ props }) => ({
  durationInFrames: essayFrames(props.script), fps: FPS, width: 1080, height: 1920,
});

// Demo nur fuer das Remotion-Studio. Frueher wurde hier ein Script aus scripts/
// importiert - das bricht das Bundling, sobald die Datei geloescht wird.
const demo: Script = {
  id: "demo", handle: "@nurwissen_official", theme: "dark", captions: false,
  scenes: [{ kicker: "Demo", text: "Reel *Renderer*", visual: "rings", dur: 3 }],
};

const essayDemo: EssayScript = { id: "demo", handle: "@nurwissen_official", duration: 4, blocks: [{ top: "Demo", big: "Essay *Renderer*", visual: "document", start: 0, end: 4, words: [{ w: "Demo", s: 0.2, e: 0.6, line: "top" }, { w: "Essay", s: 0.8, e: 1.2, line: "big" }, { w: "Renderer", s: 1.3, e: 1.9, line: "big", accent: true }] }] };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Reel" component={Reel} durationInFrames={300} fps={FPS} width={1080} height={1920} defaultProps={{ script: demo }} calculateMetadata={calculateMetadata} />
    <Composition id="Essay" component={Essay} durationInFrames={120} fps={FPS} width={1080} height={1920} defaultProps={{ script: essayDemo }} calculateMetadata={calcEssay} />
    <Composition id="Cover" component={Cover} durationInFrames={1} fps={FPS} width={1080} height={1920} defaultProps={{ line: "Das aelteste Koran-Fragment liegt nicht in *Mekka*.", kicker: "Birmingham, England" }} />
  </>
);
