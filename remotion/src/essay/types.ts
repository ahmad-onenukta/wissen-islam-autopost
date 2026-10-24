export type Word = { w: string; s: number; e: number; accent?: boolean; line: "top" | "big" };

export type Block = {
  top?: string;
  big?: string;
  visual?: string;
  start: number; // seconds (absolute in video)
  end: number;
  words: Word[];
  // visual params
  mapFrom?: string; mapTo?: string;
  docTitle?: string; docHighlight?: boolean;
  number?: number; numlbl?: string;
  items?: { label: string; sub?: string }[]; active?: number;
  a?: string; b?: string; sub?: string;
  ca?: { label: string; value: string; accent?: boolean }; cb?: { label: string; value: string; accent?: boolean };
  quote?: string; quoteRef?: string;
  cardText?: string; cardRef?: string;
  ar?: string; de?: string; ref?: string;   // ayah card: Arabic with *highlight*, German meaning, reference
  sources?: string[];
  image?: string; imagePos?: string;        // monochrome photo background for this block (run)
  light?: boolean;                          // inverted "spotlight" beat (light bg, dark text)
  letters?: { word: string; active?: number; revealed?: number; label?: string };
  stat?: { value: string; unit?: string; sub?: string };
  slider?: { a: string; b: string; pos?: number; label?: string };
  acrostic?: { l: string; w: string; s?: string }[];
};

export type EssayScript = {
  id: string;
  handle: string;
  palette?: Partial<EssayPalette>;
  align?: "left" | "center";
  blocks: Block[];
  vo?: string;
  audio?: string;
  duration: number; // seconds
};

export type EssayPalette = { bg: string; ink: string; dim: string; accent: string; card: string; line: string; mute: string };

export const ESSAY_PALETTE: EssayPalette = {
  bg: "#0D0D0F", ink: "#F4F2EE", dim: "#A9A6A0", accent: "#E3302C", card: "#1A1A1E", line: "#3A3A40", mute: "#7A7872",
};
export const LIGHT_PALETTE: EssayPalette = {
  bg: "#F1EFEA", ink: "#141416", dim: "#5E5C58", accent: "#E3302C", card: "#FFFFFF", line: "#D9D6CF", mute: "#8A8782",
};
export const FPS = 30;
