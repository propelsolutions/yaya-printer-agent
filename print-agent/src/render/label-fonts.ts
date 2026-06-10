import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { GlobalFonts } from "@napi-rs/canvas";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PRINT_FONT_FAMILY = "YayaLabelPrint";

export type LabelFontFamilies = {
  print: string;
};

let registered: LabelFontFamilies | null = null;

function firstExisting(paths: string[]): string | null {
  for (const path of paths) {
    if (existsSync(path)) return path;
  }

  return null;
}

export function ensureLabelFonts(): LabelFontFamilies {
  if (registered) return registered;

  const assetsDir = join(__dirname, "..", "..", "assets", "fonts");
  const fontPath = firstExisting([
    join(assetsDir, "Arimo-Regular.ttf"),
    join(assetsDir, "Arial.ttf"),
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\calibri.ttf",
    "C:\\Windows\\Fonts\\segoeui.ttf",
  ]);

  if (!fontPath) {
    throw new Error(
      "No printer-friendly label font found. Expected print-agent/assets/fonts/Arimo-Regular.ttf or Arial on Windows.",
    );
  }

  GlobalFonts.registerFromPath(fontPath, PRINT_FONT_FAMILY);

  registered = { print: PRINT_FONT_FAMILY };
  return registered;
}
