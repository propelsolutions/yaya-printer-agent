import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import bwipjs from "bwip-js";

import type { PrintAgentConfig } from "../config.js";
import { fitCode128RenderScale } from "./code128-fit.js";
import { ensureLabelFonts } from "./label-fonts.js";
import { canvasToTsplBitmap, wrapBitmapInTspl } from "./tspl-bitmap.js";

const LABEL_DPI = 203;

const TITLE_FONT_SIZE = 26;
const SKU_FONT_SIZE = 24;
const HRI_FONT_SIZE = 24;
const BARCODE_SCALE = 3;
const BARCODE_BAR_HEIGHT = 10;

function mmToPx(mm: number): number {
  return Math.round((mm * LABEL_DPI) / 25.4);
}

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1))}...`;
}

function measureLineHeight(ctx: SKRSContext2D, font: string): number {
  ctx.font = font;
  const metrics = ctx.measureText("Mg");
  return Math.ceil(
    (metrics.actualBoundingBoxAscent || 12) +
      (metrics.actualBoundingBoxDescent || 3),
  );
}

function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = candidate;
    }
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] = truncateText(last, Math.max(8, last.length - 1));
  }

  return lines.slice(0, maxLines);
}

function renderCode128(value: string, scale: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: value,
        scale,
        height: BARCODE_BAR_HEIGHT,
        includetext: false,
        backgroundcolor: "FFFFFF",
      },
      (error, png) => {
        if (error) reject(error);
        else resolve(png);
      },
    );
  });
}

function fitCenteredTextFont(
  ctx: SKRSContext2D,
  text: string,
  fontFamily: string,
  maxWidth: number,
  preferredSize: number,
  minSize = 14,
): string {
  let size = preferredSize;

  while (size >= minSize) {
    const font = `${size}px ${fontFamily}`;
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return font;
    size -= 2;
  }

  return `${minSize}px ${fontFamily}`;
}

export type ProductLabelData = {
  productName: string;
  sku: string;
  barcode?: string | null;
};

export async function buildProductLabelImageTspl(
  config: PrintAgentConfig,
  data: ProductLabelData,
): Promise<Buffer> {
  const fonts = ensureLabelFonts();
  const widthPx = Math.ceil(mmToPx(config.label.widthMm) / 8) * 8;
  const heightPx = mmToPx(config.label.heightMm);
  const canvas = createCanvas(widthPx, heightPx);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, widthPx, heightPx);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const padX = mmToPx(1.5);
  const contentWidth = widthPx - padX * 2;
  const centerX = widthPx / 2;

  const productName = data.productName.trim();
  const sku = truncateText(data.sku.trim(), 30);
  const barcodeValue = (data.barcode?.trim() || data.sku.trim());

  const titleFont = `${TITLE_FONT_SIZE}px ${fonts.print}`;
  const skuFont = `${SKU_FONT_SIZE}px ${fonts.print}`;

  ctx.font = titleFont;
  const titleLines = wrapText(ctx, productName, contentWidth, 2);
  const titleLineHeight = measureLineHeight(ctx, titleFont);

  ctx.font = skuFont;
  const skuLineHeight = measureLineHeight(ctx, skuFont);

  const barcodeRenderScale = fitCode128RenderScale(
    barcodeValue,
    contentWidth,
    BARCODE_SCALE,
  );
  const barcodePng = await renderCode128(barcodeValue, barcodeRenderScale);
  const barcodeImage = await loadImage(barcodePng);
  const barcodeScale = Math.min(1, contentWidth / barcodeImage.width);
  const barcodeWidth = Math.round(barcodeImage.width * barcodeScale);
  const barcodeHeight = Math.round(barcodeImage.height * barcodeScale);

  const hriFont = fitCenteredTextFont(
    ctx,
    barcodeValue,
    fonts.print,
    contentWidth,
    HRI_FONT_SIZE,
  );
  const hriLineHeight = measureLineHeight(ctx, hriFont);

  const gapAfterTitle = mmToPx(0.8);
  const gapAfterSku = mmToPx(1);
  const gapAfterBarcode = mmToPx(0.5);

  const stackHeight =
    titleLines.length * titleLineHeight +
    gapAfterTitle +
    skuLineHeight +
    gapAfterSku +
    barcodeHeight +
    gapAfterBarcode +
    hriLineHeight;

  let y = Math.max(mmToPx(1), Math.round((heightPx - stackHeight) / 2));

  ctx.font = titleFont;
  for (const line of titleLines) {
    ctx.fillText(line, centerX, y);
    y += titleLineHeight;
  }

  y += gapAfterTitle;
  ctx.font = skuFont;
  ctx.fillText(sku, centerX, y);
  y += skuLineHeight + gapAfterSku;

  ctx.drawImage(
    barcodeImage,
    Math.round(centerX - barcodeWidth / 2),
    y,
    barcodeWidth,
    barcodeHeight,
  );
  y += barcodeHeight + gapAfterBarcode;

  ctx.font = hriFont;
  ctx.fillText(barcodeValue, centerX, y);

  const imageData = ctx.getImageData(0, 0, widthPx, heightPx);
  const bitmapData = canvasToTsplBitmap(widthPx, heightPx, imageData.data);

  return wrapBitmapInTspl(config, widthPx, heightPx, bitmapData);
}
