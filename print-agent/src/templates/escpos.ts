import { printableEntityCode } from "../entity-code.js";
import { fitCode128NarrowBarWidth } from "../render/code128-fit.js";

const ESC = 0x1b;
const GS = 0x1d;

// Safe printable width for 80 mm receipt paper (Font A).
const RECEIPT_WIDTH = 42;
const PRICE_WIDTH = 12;
const NAME_WIDTH = RECEIPT_WIDTH - PRICE_WIDTH;

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

function divider(char = "-"): Buffer {
  return line(char.repeat(RECEIPT_WIDTH));
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

  // Format 2: GS k 73 n d1...dn
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

  // Alphanumeric SKUs (e.g. P100056) use Code128 to avoid Code39 * start/stop marks.
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
    // Feed before cut so barcode/footer are fully printed before paper stops.
    Buffer.from([GS, 0x56, 66, 40]),
  ];
}

function formatItemLine(name: string, total: string): Buffer[] {
  const trimmedTotal = total.trim();
  const chunks: Buffer[] = [];
  const maxNameLength = NAME_WIDTH;

  if (name.length <= maxNameLength) {
    chunks.push(
      line(`${name.padEnd(NAME_WIDTH, " ")}${trimmedTotal.padStart(PRICE_WIDTH, " ")}`),
    );
    return chunks;
  }

  chunks.push(line(name.slice(0, maxNameLength)));
  chunks.push(
    line(`${"".padEnd(NAME_WIDTH, " ")}${trimmedTotal.padStart(PRICE_WIDTH, " ")}`),
  );
  return chunks;
}

export function buildTestReceiptEscpos(): Buffer {
  return concat([
    init(),
    resetLineSpacing(),
    align(1),
    doubleSize(),
    bold(true),
    line("YAYA STORE"),
    bold(false),
    normalSize(),
    line("Test Receipt"),
    ...resetTextStyle(),
    feed(1),
    divider(),
    line("80mm receipt mode"),
    line("XP-365B USB print agent"),
    divider(),
    line(`${"Item A".padEnd(NAME_WIDTH, " ")}${"10.000".padStart(PRICE_WIDTH, " ")}`),
    line(`${"Item B".padEnd(NAME_WIDTH, " ")}${"25.500".padStart(PRICE_WIDTH, " ")}`),
    divider(),
    bold(true),
    line(`${"TOTAL".padEnd(NAME_WIDTH, " ")}${"35.500".padStart(PRICE_WIDTH, " ")}`),
    bold(false),
    ...receiptBarcode("9780201379624"),
    align(1),
    line("Thank you"),
    ...finishReceipt(),
  ]);
}

export type ReceiptLineItem = {
  name: string;
  quantity?: number;
  total: string;
};

export function buildReceiptEscpos(data: {
  storeName?: string;
  title?: string;
  lineItems: ReceiptLineItem[];
  subtotal?: string;
  total: string;
  footer?: string;
  barcode?: string | null;
}): Buffer {
  const storeName = truncateReceiptText(data.storeName ?? "YAYA STORE", RECEIPT_WIDTH);
  const title = truncateReceiptText(data.title ?? "Receipt", RECEIPT_WIDTH);
  const chunks: Buffer[] = [
    init(),
    resetLineSpacing(),
    align(1),
    doubleSize(),
    bold(true),
    line(storeName),
    bold(false),
    normalSize(),
    line(title),
    ...resetTextStyle(),
    feed(1),
    divider(),
  ];

  for (const item of data.lineItems) {
    const qtyPrefix =
      item.quantity && item.quantity !== 1 ? `${item.quantity}x ` : "";
    const name = truncateReceiptText(`${qtyPrefix}${item.name}`, RECEIPT_WIDTH);
    chunks.push(...formatItemLine(name, item.total));
  }

  chunks.push(divider());

  if (data.subtotal) {
    chunks.push(
      line(
        `${"Subtotal".padEnd(NAME_WIDTH, " ")}${data.subtotal.padStart(PRICE_WIDTH, " ")}`,
      ),
    );
  }

  chunks.push(
    bold(true),
    line(`${"TOTAL".padEnd(NAME_WIDTH, " ")}${data.total.padStart(PRICE_WIDTH, " ")}`),
    bold(false),
    ...receiptBarcode(data.barcode),
  );

  if (data.footer?.trim()) {
    chunks.push(align(1), line(truncateReceiptText(data.footer.trim(), RECEIPT_WIDTH)));
  }

  chunks.push(...finishReceipt());
  return concat(chunks);
}

function truncateReceiptText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1))}…`;
}

const LABEL_TEXT_WIDTH = 22;
const PRODUCT_LABEL_BARCODE_HEIGHT = 65;
const PRODUCT_LABEL_BARCODE_WIDTH = 2;
/** Approximate printable width on a 40mm label in ESC/POS dot units. */
const LABEL_BARCODE_MAX_WIDTH_DOTS = 320;

function productLabelBarcodeStyle(moduleWidth: number): Buffer[] {
  return [
    setHriPosition(2),
    setBarcodeHeight(PRODUCT_LABEL_BARCODE_HEIGHT),
    setBarcodeWidth(moduleWidth),
    setHriFont(),
  ];
}

function fitEscposBarcodeModuleWidth(data: string): number {
  const { narrow } = fitCode128NarrowBarWidth(
    data,
    LABEL_BARCODE_MAX_WIDTH_DOTS,
    PRODUCT_LABEL_BARCODE_WIDTH,
    4,
  );
  return narrow;
}

function buildProductLabelEscposBarcode(data: string): Buffer {
  const trimmed = data.trim().replace(/^#/, "");
  const digits = trimmed.replace(/\s/g, "");
  const moduleWidth = fitEscposBarcodeModuleWidth(trimmed);

  if (/^\d{12,13}$/.test(digits)) {
    const bytes = Buffer.from(digits, "ascii");
    return Buffer.concat([
      ...productLabelBarcodeStyle(moduleWidth),
      Buffer.from([GS, 0x6b, 2]),
      bytes,
      Buffer.from([0x00]),
    ]);
  }

  const payload = Buffer.from(`{B${trimmed}`, "ascii");
  return Buffer.concat([
    ...productLabelBarcodeStyle(moduleWidth),
    Buffer.from([GS, 0x6b, 73, payload.length]),
    payload,
  ]);
}

function productLabelBarcode(value?: string | null): Buffer[] {
  const trimmed = value?.trim().replace(/^#/, "");
  if (!trimmed) return [];

  return [
    feed(1),
    align(1),
    buildProductLabelEscposBarcode(trimmed),
    feed(1),
    ...resetTextStyle(),
  ];
}

function finishLabel(): Buffer[] {
  return [feed(6)];
}

export function buildProductBarcodeLabelEscpos(data: {
  productName: string;
  sku: string;
  barcode?: string | null;
}): Buffer {
  const productName = truncateReceiptText(data.productName.trim(), LABEL_TEXT_WIDTH);
  const sku = truncateReceiptText(data.sku.trim(), LABEL_TEXT_WIDTH);
  const barcodeValue = data.barcode?.trim() || data.sku.trim();

  return concat([
    init(),
    resetLineSpacing(),
    align(1),
    bold(true),
    doubleSize(),
    line(productName),
    normalSize(),
    line(sku),
    bold(false),
    ...productLabelBarcode(barcodeValue),
    ...finishLabel(),
  ]);
}

export function buildTransferLabelEscpos(data: {
  code: string;
  route?: string | null;
}): Buffer {
  const printableCode = printableEntityCode(data.code).toUpperCase();
  const code = truncateReceiptText(printableCode, 16);
  const route = data.route?.trim()
    ? truncateReceiptText(data.route.trim(), LABEL_TEXT_WIDTH)
    : null;

  return concat([
    init(),
    resetLineSpacing(),
    align(1),
    doubleSize(),
    bold(true),
    line(code),
    bold(false),
    normalSize(),
    ...(route ? [line(route)] : []),
    ...productLabelBarcode(printableCode),
    ...finishLabel(),
  ]);
}

export function buildVariantBoxLabelEscpos(data: {
  productName: string;
  sku: string;
  barcode?: string | null;
  options?: string | null;
}): Buffer {
  return buildProductBarcodeLabelEscpos(data);
}

export function buildVariantWatchLabelEscpos(data: {
  productName?: string | null;
  sku: string;
  barcode?: string | null;
}): Buffer {
  return buildProductBarcodeLabelEscpos({
    productName: data.productName?.trim() || data.sku,
    sku: data.sku,
    barcode: data.barcode,
  });
}

export function buildTestLabelEscpos(): Buffer {
  return buildTransferLabelEscpos({
    code: "TEST-LABEL",
    route: "Yaya Store",
  });
}

export type TransferPickListLine = {
  productName: string;
  sku?: string | null;
  barcode?: string | null;
  fromBinCode?: string | null;
  fromBinZone?: string | null;
  quantity: number;
  sequence?: number | null;
};

function formatPickQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(3);
}

const PICK_BARCODE_HEIGHT = 40;
const PICK_BARCODE_WIDTH = 2;

function pickListBarcodeStyle(): Buffer[] {
  return [
    setHriPosition(2),
    setBarcodeHeight(PICK_BARCODE_HEIGHT),
    setBarcodeWidth(PICK_BARCODE_WIDTH),
    setHriFont(),
  ];
}

function buildPickListLineBarcode(value: string): Buffer {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\s/g, "");

  if (/^\d{12,13}$/.test(digits)) {
    const bytes = Buffer.from(digits, "ascii");
    return Buffer.concat([
      ...pickListBarcodeStyle(),
      Buffer.from([GS, 0x6b, 2]),
      bytes,
      Buffer.from([0x00]),
    ]);
  }

  const payload = Buffer.from(`{B${trimmed.slice(0, 24)}`, "ascii");
  return Buffer.concat([
    ...pickListBarcodeStyle(),
    Buffer.from([GS, 0x6b, 73, payload.length]),
    payload,
  ]);
}

function pickListLineBarcode(value?: string | null): Buffer[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];

  return [
    align(1),
    buildPickListLineBarcode(trimmed),
    feed(1),
    ...resetTextStyle(),
  ];
}

export function buildTransferPickListEscpos(data: {
  code: string;
  originName?: string | null;
  destinationName?: string | null;
  lines: TransferPickListLine[];
}): Buffer {
  const code = truncateReceiptText(
    printableEntityCode(data.code).toUpperCase(),
    RECEIPT_WIDTH,
  );
  const origin = data.originName?.trim();
  const destination = data.destinationName?.trim();
  const route =
    origin && destination
      ? truncateReceiptText(`${origin} -> ${destination}`, RECEIPT_WIDTH)
      : origin ?? destination ?? null;

  const sortedLines = [...data.lines].sort(
    (left, right) => (left.sequence ?? 0) - (right.sequence ?? 0),
  );

  const chunks: Buffer[] = [
    init(),
    resetLineSpacing(),
    align(1),
    bold(true),
    line("PICK LIST"),
    bold(false),
    normalSize(),
    line(code),
    ...(route ? [line(route)] : []),
    ...resetTextStyle(),
    feed(1),
    divider(),
    bold(true),
    line(
      `${"#".padEnd(3, " ")}${"BIN".padEnd(10, " ")}${"SKU".padEnd(14, " ")}${"QTY".padStart(5, " ")}`,
    ),
    bold(false),
    divider("="),
  ];

  sortedLines.forEach((pickLine, index) => {
    const lineNumber = String(pickLine.sequence ?? index + 1).padStart(2, " ");
    const binCode = truncateReceiptText(
      pickLine.fromBinCode?.trim().toUpperCase() ?? "—",
      10,
    ).padEnd(10, " ");
    const sku = truncateReceiptText(pickLine.sku?.trim().toUpperCase() ?? "—", 14).padEnd(
      14,
      " ",
    );
    const qty = formatPickQuantity(pickLine.quantity).padStart(5, " ");
    chunks.push(line(`${lineNumber} ${binCode}${sku}${qty}`));
    chunks.push(
      line(`   ${truncateReceiptText(pickLine.productName.trim(), RECEIPT_WIDTH - 3)}`),
    );
    if (pickLine.fromBinZone?.trim()) {
      chunks.push(line(`   Zone ${pickLine.fromBinZone.trim()}`));
    }
    chunks.push(
      ...pickListLineBarcode(pickLine.barcode?.trim() || pickLine.sku?.trim()),
    );
    chunks.push(line(""));
  });

  chunks.push(
    divider(),
    line(`${sortedLines.length} pick line${sortedLines.length === 1 ? "" : "s"}`),
    ...finishReceipt(),
  );

  return concat(chunks);
}
