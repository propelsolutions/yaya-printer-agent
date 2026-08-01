import type { TextAlign } from "../label-layout.js";
import {
  extractReceiptBlocks,
  resolveReceiptBindText,
  resolveReceiptBlockType,
  type ReceiptBlocksSource,
  resolveReceiptBlockType,
  type ReceiptBlockElement,
  type ReceiptColumnsElement,
  type ReceiptJobData,
  type ReceiptKeyValueElement,
  type ReceiptLineItemsElement,
  type ReceiptTextElement,
} from "../receipt-layout.js";

const ESC = 0x1b;
const GS = 0x1d;

function concat(chunks: Buffer[]): Buffer {
  return Buffer.concat(chunks);
}

function text(value: string): Buffer {
  return Buffer.from(value, "ascii");
}

function init(): Buffer {
  return Buffer.from([ESC, 0x40]);
}

function align(mode: 0 | 1 | 2): Buffer {
  return Buffer.from([ESC, 0x61, mode]);
}

function bold(on: boolean): Buffer {
  return Buffer.from([ESC, 0x45, on ? 1 : 0]);
}

function size(width: number, height: number): Buffer {
  const n = ((width & 0x0f) << 4) | (height & 0x0f);
  return Buffer.from([GS, 0x21, n]);
}

function normalSize(): Buffer {
  return size(0, 0);
}

function doubleSize(): Buffer {
  return size(1, 1);
}

function line(value = ""): Buffer {
  return text(`${value}\n`);
}

function feed(lines = 3): Buffer {
  return Buffer.from([ESC, 0x64, Math.min(Math.max(lines, 1), 255)]);
}

function setLineSpacing(dots: number): Buffer {
  return Buffer.from([ESC, 0x33, Math.min(Math.max(dots, 0), 255)]);
}

function resetLineSpacing(): Buffer {
  return setLineSpacing(30);
}

function divider(char: string, width: number): Buffer {
  return line(char.repeat(width));
}

function setHriPosition(position: 0 | 1 | 2 | 3): Buffer {
  return Buffer.from([GS, 0x48, position]);
}

function setBarcodeHeight(dots: number): Buffer {
  return Buffer.from([GS, 0x68, dots]);
}

function setBarcodeWidth(module: number): Buffer {
  return Buffer.from([GS, 0x77, module]);
}

const BARCODE_HEIGHT = 120;
const BARCODE_WIDTH = 3;

function setHriFont(): Buffer {
  return Buffer.from([GS, 0x66, 0x00]);
}

function barcodeStyle(): Buffer[] {
  return [
    setHriPosition(2),
    setBarcodeHeight(BARCODE_HEIGHT),
    setBarcodeWidth(BARCODE_WIDTH),
    setHriFont(),
  ];
}

function resetTextStyle(): Buffer[] {
  return [normalSize(), bold(false), align(0), resetLineSpacing()];
}

function ean13Barcode(digits: string): Buffer {
  const normalized = digits.replace(/\D/g, "");
  if (normalized.length !== 12 && normalized.length !== 13) {
    throw new Error("EAN13 barcode requires 12 or 13 digits.");
  }

  const bytes = Buffer.from(normalized, "ascii");

  return Buffer.concat([
    ...barcodeStyle(),
    Buffer.from([GS, 0x6b, 2]),
    bytes,
    Buffer.from([0x00]),
  ]);
}

function code128Barcode(data: string): Buffer {
  const trimmed = data.slice(0, 40);
  const payload = Buffer.from(`{B${trimmed}`, "ascii");
  if (payload.length < 3) {
    throw new Error("Barcode data is required.");
  }

  return Buffer.concat([
    ...barcodeStyle(),
    Buffer.from([GS, 0x6b, 73, payload.length]),
    payload,
  ]);
}

function buildEscposBarcode(data: string): Buffer {
  const trimmed = data.trim();
  const digits = trimmed.replace(/\s/g, "");

  if (/^\d{12,13}$/.test(digits)) {
    return ean13Barcode(digits);
  }

  return code128Barcode(trimmed);
}

function receiptBarcode(data?: string | null): Buffer[] {
  const value = data?.trim();
  if (!value) return [];

  return [
    feed(1),
    align(1),
    buildEscposBarcode(value),
    feed(6),
    ...resetTextStyle(),
  ];
}

function finishReceipt(): Buffer[] {
  return [
    feed(8),
    Buffer.from([GS, 0x56, 66, 40]),
  ];
}

function truncateReceiptText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1))}…`;
}

function receiptCharWidth(widthMm: number): number {
  return widthMm <= 58 ? 32 : 42;
}

function alignMode(align: TextAlign | undefined): 0 | 1 | 2 {
  switch (align) {
    case "center":
      return 1;
    case "right":
      return 2;
    default:
      return 0;
  }
}

function formatItemLine(
  name: string,
  total: string,
  charWidth: number,
  priceWidth: number,
): Buffer[] {
  const trimmedTotal = total.trim();
  const nameWidth = charWidth - priceWidth;
  const chunks: Buffer[] = [];

  if (name.length <= nameWidth) {
    chunks.push(
      line(
        `${name.padEnd(nameWidth, " ")}${trimmedTotal.padStart(priceWidth, " ")}`,
      ),
    );
    return chunks;
  }

  chunks.push(line(name.slice(0, nameWidth)));
  chunks.push(
    line(`${"".padEnd(nameWidth, " ")}${trimmedTotal.padStart(priceWidth, " ")}`),
  );
  return chunks;
}

function renderTextBlock(
  block: ReceiptTextElement,
  data: ReceiptJobData,
  charWidth: number,
): Buffer[] {
  const content =
    block.text?.trim() ||
    resolveReceiptBindText(block.bind ?? "", data);
  if (!content) return [];

  const useDouble =
    block.doubleSize === true || (block.fontSizePt ?? 12) >= 14;
  const chunks: Buffer[] = [
    ...resetTextStyle(),
    align(alignMode(block.align)),
  ];

  if (useDouble) chunks.push(doubleSize());
  if (block.bold) chunks.push(bold(true));
  chunks.push(line(truncateReceiptText(content, charWidth)));
  chunks.push(...resetTextStyle());

  return chunks;
}

function renderLineItemsBlock(
  block: ReceiptLineItemsElement,
  data: ReceiptJobData,
  charWidth: number,
): Buffer[] {
  const items = data.lineItems ?? [];
  if (items.length === 0) return [];

  const priceWidth = block.priceWidth ?? 12;
  const showQuantity = block.showQuantity ?? true;
  const chunks: Buffer[] = [];

  for (const item of items) {
    const qtyPrefix =
      showQuantity && item.quantity && item.quantity !== 1
        ? `${item.quantity}x `
        : "";
    const name = truncateReceiptText(`${qtyPrefix}${item.name}`, charWidth);
    chunks.push(...formatItemLine(name, item.total, charWidth, priceWidth));
  }

  return chunks;
}

function renderKeyValueBlock(
  block: ReceiptKeyValueElement,
  data: ReceiptJobData,
  charWidth: number,
): Buffer[] {
  const value =
    block.value?.trim() ??
    resolveReceiptBindText(block.bind ?? "", data);
  if (!value && !block.label?.trim()) return [];

  const priceWidth = 12;
  const nameWidth = charWidth - priceWidth;
  const label = truncateReceiptText(block.label, nameWidth);

  return [
    bold(block.bold ?? false),
    line(
      `${label.padEnd(nameWidth, " ").slice(0, nameWidth)}${value.padStart(priceWidth, " ")}`,
    ),
    bold(false),
  ];
}

function renderPaymentsBlock(
  data: ReceiptJobData,
  charWidth: number,
): Buffer[] {
  const payments = data.payments;
  if (!Array.isArray(payments) || payments.length === 0) return [];

  const priceWidth = 12;
  const chunks: Buffer[] = [];

  for (const payment of payments) {
    const label = payment.method?.trim() || payment.paymentMethod?.trim() || "Payment";
    const amount = payment.amount?.trim() || payment.total?.trim() || "";
    if (!amount) continue;
    chunks.push(...formatItemLine(label, amount, charWidth, priceWidth));
  }

  return chunks;
}

function renderColumnsBlock(
  block: ReceiptColumnsElement,
  data: ReceiptJobData,
  charWidth: number,
): Buffer[] {
  const left =
    block.left?.trim() ??
    resolveReceiptBindText(block.leftBind ?? "", data);
  const right =
    block.right?.trim() ??
    resolveReceiptBindText(block.rightBind ?? "", data);
  if (!left && !right) return [];

  const priceWidth = 12;
  const nameWidth = charWidth - priceWidth;
  const leftText = truncateReceiptText(left, nameWidth);

  return [
    bold(block.bold ?? false),
    line(
      `${leftText.padEnd(nameWidth, " ").slice(0, nameWidth)}${right.padStart(priceWidth, " ")}`,
    ),
    bold(false),
  ];
}

function renderBlock(
  block: ReceiptBlockElement,
  data: ReceiptJobData,
  charWidth: number,
): Buffer[] {
  const blockType = resolveReceiptBlockType(block);

  switch (blockType) {
    case "text":
    case "title":
    case "subtitle":
    case "heading":
    case "label":
      return renderTextBlock(block as ReceiptTextElement, data, charWidth);
    case "divider":
    case "separator":
    case "rule":
      return [divider((block as ReceiptDividerElement).char ?? "-", charWidth)];
    case "line_items":
    case "lineitems":
    case "items":
    case "item_list":
    case "item_list_block":
      return renderLineItemsBlock(block as ReceiptLineItemsElement, data, charWidth);
    case "payments":
    case "payment_list":
      return renderPaymentsBlock(data, charWidth);
    case "key_value":
    case "keyvalue":
    case "row":
    case "total_row":
    case "summary_row":
      return renderKeyValueBlock(block as ReceiptKeyValueElement, data, charWidth);
    case "columns":
    case "two_column":
    case "two_columns":
    case "column_row":
      return renderColumnsBlock(block as ReceiptColumnsElement, data, charWidth);
    case "barcode": {
      const bind = (block as ReceiptBarcodeElement).bind ?? "barcode";
      const value = resolveReceiptBindText(bind, data);
      return value ? receiptBarcode(value) : [];
    }
    case "spacer":
    case "space":
    case "feed":
    case "blank":
      return [feed((block as ReceiptSpacerElement).lines ?? 1)];
    default:
      return [];
  }
}

export function buildReceiptBlocksEscpos(options: {
  blocks: ReceiptBlockElement[];
  data: ReceiptJobData;
  widthMm?: number;
}): Buffer {
  const charWidth = receiptCharWidth(options.widthMm ?? 80);
  const chunks: Buffer[] = [init(), resetLineSpacing()];

  for (const block of options.blocks) {
    chunks.push(...renderBlock(block, options.data, charWidth));
  }

  chunks.push(...finishReceipt());
  return concat(chunks);
}

export function buildReceiptJobEscpos(
  job: ReceiptBlocksSource & {
    data: ReceiptJobData;
    receiptConfig?: { widthMm?: number };
  },
): Buffer {
  const blocks = extractReceiptBlocks(job);
  if (!blocks) {
    throw new Error("Receipt blocks layout is required.");
  }

  return buildReceiptBlocksEscpos({
    blocks,
    data: job.data,
    widthMm: job.receiptConfig?.widthMm,
  });
}
