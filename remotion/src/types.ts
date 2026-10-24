export type Visual =
  | "none" | "sphere" | "rings" | "bars" | "timeline" | "card" | "cards" | "compare" | "map";

export type CompareItem = { label: string; value: string; sub?: string; accent?: boolean };
export type TimelineItem = { label: string; sub?: string };

export type Scene = {
  kicker?: string;
  text?: string;            // *word* or *multi word* = highlight
  size?: number;
  number?: string | number; // big odometer
  numlbl?: string;
  visual?: Visual;
  bars?: number[];
  barLabels?: string[];
  items?: TimelineItem[];
  active?: number;
  a?: CompareItem;
  b?: CompareItem;
  source?: string;
  dur: number;              // seconds (fallback when no VO timing)
  vo?: string;              // voice-over text for this scene
  image?: string;           // public/ path, e.g. img/birmingham.jpg (monochrome photo background)
  imagePos?: string;        // CSS object-position, default "center"
  imageCredit?: string;
};

export type Palette = { bg: string; ink: string; accent: string; accent2: string; mute: string; line: string };

export type Script = {
  id: string;
  handle: string;
  palette?: Partial<Palette>;
  theme?: "light" | "dark";
  captions?: boolean;
  scenes: Scene[];
  audio?: string;   // music/sfx mix in public/audio
  vo?: string;      // voice-over file in public/audio
};

export const DEFAULT_PALETTE: Palette = {
  bg: "#F7F5EF", ink: "#141A26", accent: "#2F9E8F", accent2: "#E0A458", mute: "#6B7280", line: "rgba(20,26,38,0.08)",
};
export const DARK_PALETTE: Palette = {
  bg: "#0B0B0E", ink: "#F3F0EA", accent: "#E0312E", accent2: "#D9B86A", mute: "#9C9A94", line: "rgba(255,255,255,0.06)",
};
export const FPS = 30;
export const TRANSITION_FRAMES = 12;
