import type { PrintAgentConfig } from "../config.js";

const LABEL_HEADER_LINES = (config: PrintAgentConfig) => [
  "CODEPAGE 1252",
  `SIZE ${config.label.widthMm} mm, ${config.label.heightMm} mm`,
  `GAP ${config.label.gapMm} mm, 0 mm`,
  "SPEED 4",
  "DENSITY 10",
  "DIRECTION 1",
  "REFERENCE 0,0",
  "OFFSET 0 mm",
  "SET PEEL OFF",
  "SET CUTTER OFF",
  "SET PARTIAL_CUTTER OFF",
  "SET TEAR ON",
  "CLS",
];

export function canvasToTsplBitmap(
  widthPx: number,
  heightPx: number,
  rgba: Uint8ClampedArray,
): Buffer {
  const widthBytes = Math.ceil(widthPx / 8);
  const rows: Buffer[] = [];

  for (let y = 0; y < heightPx; y += 1) {
    const row = Buffer.alloc(widthBytes);
    for (let x = 0; x < widthPx; x += 1) {
      const index = (y * widthPx + x) * 4;
      const red = rgba[index] ?? 255;
      const green = rgba[index + 1] ?? 255;
      const blue = rgba[index + 2] ?? 255;
      const alpha = rgba[index + 3] ?? 255;
      const luminance = (red + green + blue) / 3;
      const shouldPrint = alpha > 64 && luminance < 200;

      if (shouldPrint) {
        const byteIndex = Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        row[byteIndex] |= 1 << bitIndex;
      }
    }

    // XP-365B TSPL expects 0 = print, 1 = no print (inverted vs canvas bits).
    for (let byteIndex = 0; byteIndex < row.length; byteIndex += 1) {
      row[byteIndex] ^= 0xff;
    }

    rows.push(row);
  }

  return Buffer.concat(rows);
}

export function wrapBitmapInTspl(
  config: PrintAgentConfig,
  widthPx: number,
  heightPx: number,
  bitmapData: Buffer,
): Buffer {
  const widthBytes = Math.ceil(widthPx / 8);
  const header = Buffer.from(
    [...LABEL_HEADER_LINES(config), `BITMAP 0,0,${widthBytes},${heightPx},0,`].join(
      "\r\n",
    ),
    "ascii",
  );
  const footer = Buffer.from("\r\nPRINT 1,1\r\n", "ascii");

  return Buffer.concat([header, bitmapData, footer]);
}
