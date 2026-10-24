import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const FONT = "InterReel";
export const ARABIC = "AmiriReel";
export const fontsReady = Promise.all([
  ...(["500", "700", "800", "900"] as const).map((weight) =>
    loadFont({ family: FONT, url: staticFile(`fonts/inter-latin-${weight}-normal.woff2`), weight }),
  ),
  ...(["400", "700"] as const).map((weight) =>
    loadFont({ family: ARABIC, url: staticFile(`fonts/amiri-arabic-${weight}-normal.woff2`), weight }),
  ),
]);
