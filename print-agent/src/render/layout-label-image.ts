import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import bwipjs from "bwip-js";

import type { PrintAgentConfig } from "../config.js";
import {
  resolveBarcodeValue,
  resolveBindText,
  type LabelBarcodeElement,
  type LabelBuilderJobType,
  type LabelJobData,
  type LabelLayout,
  type LabelLayoutElement,
  type LabelTextElement,
  type TextAlign,
} from "../label-layout.js";
import { fitCode128RenderScale } from "./code128-fit.js";
import { ensureLabelFonts } from "./label-fonts.js";
import { canvasToTsplBitmap, wrapBitmapInTspl } from "./tspl-bitmap.js";

const LABEL_DPI = 203;
const PT_TO_PX = LABEL_DPI / 72;
const MAX_LABEL_TEXT_LINES = 2;
const ELLIPSIS = "…";

function mmToPx(mm: number): number {
  return Math.round((mm * LABEL_DPI) / 25.4);
}

function ptToPx(pt: number): number {
  return Math.round(pt * PT_TO_PX);
}

function truncateLineToWidth(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (ctx.measureText(trimmed).width <= maxWidth) return trimmed;

  let result = trimmed;
  while (
    result.length > 0 &&
    ctx.measureText(`${result}${ELLIPSIS}`).width > maxWidth
  ) {
    result = result.slice(0, -1);
  }

  return result ? `${result}${ELLIPSIS}` : ELLIPSIS;
}

function breakLongTokenLines(
  ctx: SKRSContext2D,
  token: string,
  maxWidth: number,
  lineBudget: number,
): string[] {
  if (lineBudget <= 0) return [];

  const result: string[] = [];
  let rest = token;

  while (rest.length > 0 && result.length < lineBudget) {
    if (ctx.measureText(rest).width <= maxWidth) {
      result.push(rest);
      return result;
    }

    let end = rest.length;
    while (end > 1 && ctx.measureText(rest.slice(0, end)).width > maxWidth) {
      end -= 1;
    }

    result.push(rest.slice(0, end));
    rest = rest.slice(end);
  }

  if (rest.length > 0 && result.length > 0) {
    const lastIndex = result.length - 1;
    result[lastIndex] = truncateLineToWidth(
      ctx,
      `${result[lastIndex] ?? ""}${rest}`,
      maxWidth,
    );
  }

  return result;
}

function appendTokenLines(
  ctx: SKRSContext2D,
  lines: string[],
  token: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const tokenLines = breakLongTokenLines(
    ctx,
    token,
    maxWidth,
    maxLines - lines.length,
  );

  for (const tokenLine of tokenLines) {
    if (lines.length >= maxLines) break;
    lines.push(tokenLine);
  }

  return lines;
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
  maxLines: number = MAX_LABEL_TEXT_LINES,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [""];

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let line = "";

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? "";
    const candidate = line ? `${line} ${word}` : word;

    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) {
      lines.push(line);
      if (lines.length >= maxLines) {
        const overflow = [word, ...words.slice(index + 1)].join(" ");
        const lastLine = lines[maxLines - 1] ?? "";
        lines[maxLines - 1] = truncateLineToWidth(
          ctx,
          `${lastLine} ${overflow}`.trim(),
          maxWidth,
        );
        return lines;
      }
      line = word;
      continue;
    }

    appendTokenLines(ctx, lines, word, maxWidth, maxLines);
    if (lines.length >= maxLines) {
      const overflow = words.slice(index + 1).join(" ");
      if (overflow) {
        const last = lines[maxLines - 1] ?? "";
        const base = last.endsWith(ELLIPSIS) ? last.slice(0, -1).trimEnd() : last;
        lines[maxLines - 1] = truncateLineToWidth(
          ctx,
          `${base} ${overflow}`.trim(),
          maxWidth,
        );
      }
      return lines;
    }
    line = "";
  }

  if (line) {
    if (ctx.measureText(line).width > maxWidth) {
      appendTokenLines(ctx, lines, line, maxWidth, maxLines);
    } else if (lines.length < maxLines) {
      lines.push(line);
    } else {
      lines[maxLines - 1] = truncateLineToWidth(
        ctx,
        `${lines[maxLines - 1] ?? ""} ${line}`.trim(),
        maxWidth,
      );
    }
  }

  return lines.length > 0 ? lines : [""];
}

function renderCode128(value: string, scale: number, barHeight: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: "code128",
        text: value,
        scale,
        height: barHeight,
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

function alignX(
  align: TextAlign,
  widthPx: number,
  padX: number,
  contentWidth: number,
): number {
  if (align === "left") return padX;
  if (align === "right") return padX + contentWidth;
  return widthPx / 2;
}

type MeasuredBlock =
  | {
      kind: "text";
      lines: string[];
      font: string;
      lineHeight: number;
      align: TextAlign;
      height: number;
    }
  | {
      kind: "barcode";
      value: string;
      image: Awaited<ReturnType<typeof loadImage>>;
      width: number;
      height: number;
      hriFont?: string;
      hriLines?: string[];
      hriLineHeight?: number;
      align: TextAlign;
      blockHeight: number;
    }
  | {
      kind: "quantity_table";
      columns: number;
      cellHeight: number;
      firstCell: string;
      height: number;
    };

async function measureElement(
  ctx: SKRSContext2D,
  element: LabelLayoutElement,
  jobType: LabelBuilderJobType,
  data: LabelJobData,
  fonts: ReturnType<typeof ensureLabelFonts>,
  contentWidth: number,
): Promise<MeasuredBlock | null> {
  if (element.type === "text") {
    return measureTextElement(
      ctx,
      element,
      jobType,
      data,
      fonts,
      contentWidth,
    );
  }

  if (element.type === "barcode") {
    return measureBarcodeElement(
      ctx,
      element,
      jobType,
      data,
      fonts,
      contentWidth,
    );
  }

  const cellHeight = mmToPx(element.cellHeightMm);
  const firstCell = String(data.boxQuantity ?? "").trim();

  return {
    kind: "quantity_table",
    columns: element.columns,
    cellHeight,
    firstCell,
    height: cellHeight,
  };
}

function measureTextElement(
  ctx: SKRSContext2D,
  element: LabelTextElement,
  jobType: LabelBuilderJobType,
  data: LabelJobData,
  fonts: ReturnType<typeof ensureLabelFonts>,
  contentWidth: number,
): MeasuredBlock {
  const text = resolveBindText(element.bind, jobType, data);
  const fontSizePx = ptToPx(element.fontSizePt);
  const font = `${fontSizePx}px ${fonts.print}`;
  ctx.font = font;
  const lines = wrapText(ctx, text, contentWidth, MAX_LABEL_TEXT_LINES);
  const lineHeight = measureLineHeight(ctx, font);
  return {
    kind: "text",
    lines,
    font,
    lineHeight,
    align: element.align,
    height: lines.length * lineHeight,
  };
}

async function measureBarcodeElement(
  ctx: SKRSContext2D,
  element: LabelBarcodeElement,
  jobType: LabelBuilderJobType,
  data: LabelJobData,
  fonts: ReturnType<typeof ensureLabelFonts>,
  contentWidth: number,
): Promise<MeasuredBlock> {
  const value = resolveBarcodeValue(jobType, data);
  const barHeightMm = element.heightMm;
  const barHeight = Math.max(4, Math.round(barHeightMm * 2.5));
  const barcodeRenderScale = fitCode128RenderScale(value, contentWidth, 3);
  const barcodePng = await renderCode128(value, barcodeRenderScale, barHeight);
  const image = await loadImage(barcodePng);
  const barcodeScale = Math.min(1, contentWidth / image.width);
  const width = Math.round(image.width * barcodeScale);
  const height = Math.round(image.height * barcodeScale);

  let hriFont: string | undefined;
  let hriLines: string[] | undefined;
  let hriLineHeight: number | undefined;
  let blockHeight = height;

  if (element.showHri) {
    hriFont = `${ptToPx(element.hriFontSizePt)}px ${fonts.print}`;
    ctx.font = hriFont;
    hriLines = wrapText(ctx, value, contentWidth, MAX_LABEL_TEXT_LINES);
    hriLineHeight = measureLineHeight(ctx, hriFont);
    blockHeight += mmToPx(0.5) + hriLines.length * hriLineHeight;
  }

  return {
    kind: "barcode",
    value,
    image,
    width,
    height,
    hriFont,
    hriLines,
    hriLineHeight,
    align: element.align,
    blockHeight,
  };
}

function drawTextBlock(
  ctx: SKRSContext2D,
  block: Extract<MeasuredBlock, { kind: "text" }>,
  x: number,
  y: number,
) {
  ctx.font = block.font;
  ctx.textAlign =
    block.align === "left" ? "left" : block.align === "right" ? "right" : "center";
  ctx.textBaseline = "top";

  let lineY = y;
  for (const line of block.lines) {
    ctx.fillText(line, x, lineY);
    lineY += block.lineHeight;
  }
}

function drawBarcodeBlock(
  ctx: SKRSContext2D,
  block: Extract<MeasuredBlock, { kind: "barcode" }>,
  widthPx: number,
  padX: number,
  contentWidth: number,
  y: number,
) {
  let barcodeX = widthPx / 2 - block.width / 2;
  if (block.align === "left") barcodeX = padX;
  if (block.align === "right") barcodeX = padX + contentWidth - block.width;

  ctx.drawImage(
    block.image,
    Math.round(barcodeX),
    y,
    block.width,
    block.height,
  );

  let lineY = y + block.height + mmToPx(0.5);
  if (block.hriFont && block.hriLineHeight && block.hriLines?.length) {
    ctx.font = block.hriFont;
    ctx.textAlign =
      block.align === "left"
        ? "left"
        : block.align === "right"
          ? "right"
          : "center";
    ctx.textBaseline = "top";
    for (const hriLine of block.hriLines) {
      ctx.fillText(
        hriLine,
        alignX(block.align, widthPx, padX, contentWidth),
        lineY,
      );
      lineY += block.hriLineHeight;
    }
  }

  return lineY;
}

function drawQuantityTable(
  ctx: SKRSContext2D,
  block: Extract<MeasuredBlock, { kind: "quantity_table" }>,
  widthPx: number,
  y: number,
  fonts: ReturnType<typeof ensureLabelFonts>,
) {
  const cellWidth = widthPx / block.columns;
  const font = `${ptToPx(10)}px ${fonts.print}`;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, y, widthPx, block.cellHeight);

  for (let column = 1; column < block.columns; column += 1) {
    const x = column * cellWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + block.cellHeight);
    ctx.stroke();
  }

  if (block.firstCell) {
    ctx.fillText(
      block.firstCell,
      cellWidth / 2,
      y + block.cellHeight / 2,
    );
  }
}

export async function buildLayoutLabelImageTspl(
  config: PrintAgentConfig,
  jobType: LabelBuilderJobType,
  layout: LabelLayout,
  data: LabelJobData,
): Promise<Buffer> {
  const fonts = ensureLabelFonts();
  const widthPx = Math.ceil(mmToPx(config.label.widthMm) / 8) * 8;
  const heightPx = mmToPx(config.label.heightMm);
  const canvas = createCanvas(widthPx, heightPx);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, widthPx, heightPx);
  ctx.fillStyle = "#000000";

  const padX = mmToPx(config.labelPaddingMm ?? 1.5);
  const contentWidth = widthPx - padX * 2;
  const gapAfterElement = mmToPx(0.8);

  const blocks: MeasuredBlock[] = [];
  for (const element of layout.elements) {
    const block = await measureElement(
      ctx,
      element,
      jobType,
      data,
      fonts,
      contentWidth,
    );
    if (block) blocks.push(block);
  }

  const stackHeight =
    blocks.reduce((sum, block) => sum + ("blockHeight" in block ? block.blockHeight : block.height), 0) +
    Math.max(0, blocks.length - 1) * gapAfterElement;

  let y = Math.max(padX, Math.round((heightPx - stackHeight) / 2));

  for (const block of blocks) {
    if (block.kind === "text") {
      drawTextBlock(
        ctx,
        block,
        alignX(block.align, widthPx, padX, contentWidth),
        y,
      );
      y += block.height + gapAfterElement;
      continue;
    }

    if (block.kind === "barcode") {
      drawBarcodeBlock(ctx, block, widthPx, padX, contentWidth, y);
      y += block.blockHeight + gapAfterElement;
      continue;
    }

    drawQuantityTable(ctx, block, widthPx, y, fonts);
    y += block.height + gapAfterElement;
  }

  const imageData = ctx.getImageData(0, 0, widthPx, heightPx);
  const bitmapData = canvasToTsplBitmap(widthPx, heightPx, imageData.data);

  return wrapBitmapInTspl(config, widthPx, heightPx, bitmapData);
}
