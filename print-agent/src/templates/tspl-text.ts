import type { PrintAgentConfig } from "../config.js";
import { printableEntityCode } from "../entity-code.js";
import {
  estimateCode128WidthDots,
  fitCode128NarrowBarWidth,
} from "../render/code128-fit.js";

const DOTS_PER_MM = 8;
const SIDE_MARGIN_DOTS = 2 * DOTS_PER_MM;

const FONT_CHAR_WIDTH: Record<string, number> = {
  "1": 8,
  "2": 12,
  "3": 16,
  "4": 24,
  "5": 32,
};

const FONT_CHAR_HEIGHT: Record<string, number> = {
  "1": 12,
  "2": 20,
  "3": 24,
  "4": 32,
  "5": 48,
};

type TsplTextStyle = {
  font: string;
  xMul: number;
  yMul: number;
};

const PRODUCT_TITLE_STYLE: TsplTextStyle = { font: "4", xMul: 1, yMul: 1 };
const PRODUCT_SKU_STYLE: TsplTextStyle = { font: "1", xMul: 1, yMul: 1 };
const BARCODE_HRI_STYLE: TsplTextStyle = { font: "2", xMul: 1, yMul: 1 };
const TRANSFER_CODE_STYLE: TsplTextStyle = { font: "4", xMul: 1, yMul: 1 };
const TRANSFER_ROUTE_STYLE: TsplTextStyle = { font: "2", xMul: 1, yMul: 1 };

const BARCODE_HEIGHT = 58;
const BARCODE_NARROW = 2;
const BARCODE_WIDE = 5;
const GAP_AFTER_BARCODE = 4;

export function escapeTsplString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function truncateTsplText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1))}...`;
}

type LabelCanvas = {
  widthDots: number;
  heightDots: number;
};

function labelCanvas(config: PrintAgentConfig): LabelCanvas {
  return {
    widthDots: config.label.widthMm * DOTS_PER_MM,
    heightDots: config.label.heightMm * DOTS_PER_MM,
  };
}

function labelHeader(config: PrintAgentConfig): string[] {
  return [
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
}

function textLineHeight(style: TsplTextStyle): number {
  return (FONT_CHAR_HEIGHT[style.font] ?? 20) * style.yMul;
}

function textCenterX(
  canvas: LabelCanvas,
  text: string,
  style: TsplTextStyle,
): number {
  const charWidth = (FONT_CHAR_WIDTH[style.font] ?? 12) * style.xMul;
  const textWidth = text.length * charWidth;
  return Math.max(
    SIDE_MARGIN_DOTS,
    Math.round((canvas.widthDots - textWidth) / 2),
  );
}

function barcodeCenterX(
  canvas: LabelCanvas,
  data: string,
  narrow: number,
): number {
  const width = estimateCode128WidthDots(data, narrow);
  return Math.max(
    SIDE_MARGIN_DOTS,
    Math.round((canvas.widthDots - width) / 2),
  );
}

function fitBarcodeHri(
  canvas: LabelCanvas,
  value: string,
): { style: TsplTextStyle; text: string } {
  const availableWidth = canvas.widthDots - 2 * SIDE_MARGIN_DOTS;
  const styles: TsplTextStyle[] = [
    BARCODE_HRI_STYLE,
    { font: "1", xMul: 1, yMul: 1 },
  ];

  for (const style of styles) {
    const charWidth = (FONT_CHAR_WIDTH[style.font] ?? 12) * style.xMul;
    const maxChars = Math.max(1, Math.floor(availableWidth / charWidth));
    if (value.length <= maxChars) {
      return { style, text: value };
    }
  }

  const charWidth = FONT_CHAR_WIDTH["1"] ?? 8;
  const maxChars = Math.max(1, Math.floor(availableWidth / charWidth));
  return {
    style: { font: "1", xMul: 1, yMul: 1 },
    text: truncateTsplText(value, maxChars),
  };
}

function tsplText(
  canvas: LabelCanvas,
  y: number,
  style: TsplTextStyle,
  content: string,
): string {
  const x = textCenterX(canvas, content, style);
  return `TEXT ${x},${y},"${style.font}",0,${style.xMul},${style.yMul},"${escapeTsplString(content)}"`;
}

function tsplBarcode(
  canvas: LabelCanvas,
  y: number,
  content: string,
  narrow: number,
  wide: number,
): string {
  const x = barcodeCenterX(canvas, content, narrow);
  return `BARCODE ${x},${y},"128",${BARCODE_HEIGHT},0,0,${narrow},${wide},"${escapeTsplString(content)}"`;
}

function appendCenteredBarcode(
  lines: string[],
  canvas: LabelCanvas,
  y: number,
  barcodeValue: string,
): void {
  const availableWidth = canvas.widthDots - 2 * SIDE_MARGIN_DOTS;
  const { narrow, wide } = fitCode128NarrowBarWidth(
    barcodeValue,
    availableWidth,
    BARCODE_NARROW,
    BARCODE_WIDE,
  );
  const hri = fitBarcodeHri(canvas, barcodeValue);

  lines.push(tsplBarcode(canvas, y, barcodeValue, narrow, wide));
  y += BARCODE_HEIGHT + GAP_AFTER_BARCODE;
  lines.push(tsplText(canvas, y, hri.style, hri.text));
}

function stackStartY(canvas: LabelCanvas, stackHeight: number): number {
  const minTop = 2 * DOTS_PER_MM;
  const centered = Math.round((canvas.heightDots - stackHeight) / 2);
  return Math.max(minTop, centered);
}

export function buildTransferLabelTsplText(
  config: PrintAgentConfig,
  data: { code: string; route?: string | null },
): string {
  const canvas = labelCanvas(config);
  const code = truncateTsplText(
    printableEntityCode(data.code).toUpperCase(),
    14,
  );
  const route = data.route?.trim()
    ? truncateTsplText(data.route.trim(), 24)
    : null;

  const codeHeight = textLineHeight(TRANSFER_CODE_STYLE);
  const routeHeight = route ? textLineHeight(TRANSFER_ROUTE_STYLE) : 0;
  const gap = route ? 6 : 0;
  const stackHeight = codeHeight + gap + routeHeight;
  let y = stackStartY(canvas, stackHeight);

  const lines = [
    ...labelHeader(config),
    tsplText(canvas, y, TRANSFER_CODE_STYLE, code),
  ];

  if (route) {
    y += codeHeight + gap;
    lines.push(tsplText(canvas, y, TRANSFER_ROUTE_STYLE, route));
  }

  lines.push("PRINT 1,1");
  return `${lines.join("\r\n")}\r\n`;
}

export function buildVariantBoxLabelTsplText(
  config: PrintAgentConfig,
  data: {
    productName: string;
    sku: string;
    barcode?: string | null;
    options?: string | null;
  },
): string {
  const canvas = labelCanvas(config);
  const productName = truncateTsplText(data.productName, 13);
  const sku = truncateTsplText(data.sku, 28);
  const barcodeValue = data.barcode?.trim() || data.sku.trim();

  const productHeight = textLineHeight(PRODUCT_TITLE_STYLE);
  const skuHeight = textLineHeight(PRODUCT_SKU_STYLE);
  const gapAfterProduct = 2;
  const gapAfterSku = 4;
  const hri = barcodeValue ? fitBarcodeHri(canvas, barcodeValue) : null;
  const hriHeight = hri ? textLineHeight(hri.style) : 0;
  const stackHeight = barcodeValue
    ? productHeight +
      gapAfterProduct +
      skuHeight +
      gapAfterSku +
      BARCODE_HEIGHT +
      GAP_AFTER_BARCODE +
      hriHeight
    : productHeight + gapAfterProduct + skuHeight;

  let y = stackStartY(canvas, stackHeight);

  const lines = [
    ...labelHeader(config),
    tsplText(canvas, y, PRODUCT_TITLE_STYLE, productName),
  ];

  y += productHeight + gapAfterProduct;
  lines.push(tsplText(canvas, y, PRODUCT_SKU_STYLE, sku));

  if (barcodeValue) {
    y += skuHeight + gapAfterSku;
    appendCenteredBarcode(lines, canvas, y, barcodeValue);
  }

  lines.push("PRINT 1,1");
  return `${lines.join("\r\n")}\r\n`;
}

export function buildVariantWatchLabelTsplText(
  config: PrintAgentConfig,
  data: {
    productName?: string | null;
    sku: string;
    barcode?: string | null;
  },
): string {
  return buildVariantBoxLabelTsplText(config, {
    productName: data.productName?.trim() || data.sku,
    sku: data.sku,
    barcode: data.barcode,
  });
}

export function buildTestLabelTsplText(config: PrintAgentConfig): string {
  return buildVariantBoxLabelTsplText(config, {
    productName: "AL-fajri (WS-O8)",
    sku: "AF-(WA-08)-BR-GD",
    barcode: "P10097",
  });
}
