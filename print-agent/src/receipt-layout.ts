import type { TextAlign } from "./label-layout.js";

export type ReceiptDataBind =
  | "store_name"
  | "storeName"
  | "title"
  | "order_number"
  | "orderNumber"
  | "date"
  | "cashier"
  | "customer_name"
  | "customerName"
  | "line_items"
  | "lineItems"
  | "subtotal"
  | "discount"
  | "tax"
  | "total"
  | "footer"
  | "barcode"
  | "payment_method"
  | "paymentMethod";

export type ReceiptTextElement = {
  id?: string;
  type?: string;
  kind?: string;
  bind?: ReceiptDataBind | string;
  text?: string;
  fontSizePt?: number;
  align?: TextAlign;
  bold?: boolean;
  doubleSize?: boolean;
};

export type ReceiptDividerElement = {
  id?: string;
  type?: string;
  kind?: string;
  char?: string;
};

export type ReceiptLineItemsElement = {
  id?: string;
  type?: string;
  kind?: string;
  showQuantity?: boolean;
  priceWidth?: number;
};

export type ReceiptKeyValueElement = {
  id?: string;
  type?: string;
  kind?: string;
  label: string;
  bind?: ReceiptDataBind | string;
  value?: string;
  bold?: boolean;
};

export type ReceiptBarcodeElement = {
  id?: string;
  type?: string;
  kind?: string;
  bind?: ReceiptDataBind | string;
  showHri?: boolean;
  align?: TextAlign;
};

export type ReceiptSpacerElement = {
  id?: string;
  type?: string;
  kind?: string;
  lines?: number;
};

export type ReceiptColumnsElement = {
  id?: string;
  type?: string;
  kind?: string;
  left?: string;
  right?: string;
  leftBind?: string;
  rightBind?: string;
  bold?: boolean;
};

export type ReceiptBlockElement =
  | ReceiptTextElement
  | ReceiptDividerElement
  | ReceiptLineItemsElement
  | ReceiptKeyValueElement
  | ReceiptBarcodeElement
  | ReceiptSpacerElement
  | ReceiptColumnsElement;

export type ReceiptLayout = {
  elements?: ReceiptBlockElement[];
  blocks?: ReceiptBlockElement[];
  rows?: ReceiptBlockElement[];
  sections?: ReceiptBlockElement[];
};

export type ReceiptPrintConfig = {
  widthMm?: number;
  paddingMm?: number;
};

export type ReceiptLineItem = {
  name: string;
  quantity?: number;
  total: string;
};

export const DEFAULT_TEST_RECEIPT_DATA: ReceiptJobData = {
  storeName: "YAYA STORE",
  title: "Test Receipt",
  lineItems: [
    { name: "Item A", quantity: 1, total: "10.000" },
    { name: "Item B", quantity: 2, total: "25.500" },
  ],
  total: "35.500",
  footer: "Thank you",
  barcode: "9780201379624",
};

export type ReceiptJobData = {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  title?: string;
  orderNumber?: string;
  orderCode?: string;
  qrPayload?: string;
  date?: string;
  dateTime?: string;
  cashier?: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  paymentStatus?: string;
  lineItems?: ReceiptLineItem[];
  payments?: Array<{
    method?: string;
    paymentMethod?: string;
    amount?: string;
    total?: string;
  }>;
  subtotal?: string;
  discount?: string;
  tax?: string;
  total?: string;
  footer?: string;
  barcode?: string | null;
  paymentMethod?: string;
  widthMm?: number;
  isWalkIn?: boolean;
  blocks?: ReceiptBlockElement[] | ReceiptLayout;
  layout?: ReceiptLayout;
};

const BLOCK_CONTAINER_KEYS = [
  "blocks",
  "layout",
  "template",
  "receiptTemplate",
  "receiptLayout",
  "receiptBlocks",
  "blocksLayout",
  "content",
  "body",
  "definition",
  "preset",
  "printPreset",
  "receiptPreset",
] as const;

function looksLikeBlockArray(value: unknown[]): boolean {
  if (value.length === 0) return false;

  const first = value[0];
  if (!first || typeof first !== "object") return false;

  const record = first as Record<string, unknown>;
  return typeof record.type === "string" || typeof record.kind === "string";
}

function blocksFromContainer(value: unknown): ReceiptBlockElement[] | null {
  if (Array.isArray(value)) {
    return looksLikeBlockArray(value) ? (value as ReceiptBlockElement[]) : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as ReceiptLayout & Record<string, unknown>;

  for (const key of ["elements", "blocks", "rows", "sections"] as const) {
    const candidate = record[key];
    if (Array.isArray(candidate) && looksLikeBlockArray(candidate)) {
      return candidate as ReceiptBlockElement[];
    }
  }

  for (const key of BLOCK_CONTAINER_KEYS) {
    if (key === "blocks" || key === "layout") continue;
    const nested = blocksFromContainer(record[key]);
    if (nested) return nested;
  }

  return null;
}

function deepFindBlocks(value: unknown, depth = 0): ReceiptBlockElement[] | null {
  if (depth > 5) return null;

  const direct = blocksFromContainer(value);
  if (direct) return direct;

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    const nested = deepFindBlocks(child, depth + 1);
    if (nested) return nested;
  }

  return null;
}

export type ReceiptBlocksSource = {
  blocks?: unknown;
  layout?: unknown;
  template?: unknown;
  receiptTemplate?: unknown;
  receiptLayout?: unknown;
  receiptBlocks?: unknown;
  blocksLayout?: unknown;
  content?: unknown;
  body?: unknown;
  definition?: unknown;
  preset?: unknown;
  printPreset?: unknown;
  receiptPreset?: unknown;
  data?: unknown;
  job?: unknown;
};

export function extractReceiptBlocks(source: ReceiptBlocksSource): ReceiptBlockElement[] | null {
  for (const key of BLOCK_CONTAINER_KEYS) {
    const fromContainer = blocksFromContainer(source[key]);
    if (fromContainer) return fromContainer;
  }

  const fromJob =
    source.job && typeof source.job === "object" && !Array.isArray(source.job)
      ? extractReceiptBlocks(source.job as ReceiptBlocksSource)
      : null;
  if (fromJob) return fromJob;

  if (source.data && typeof source.data === "object" && !Array.isArray(source.data)) {
    const fromData = extractReceiptBlocks(source.data as ReceiptBlocksSource);
    if (fromData) return fromData;
  }

  return deepFindBlocks(source);
}

export function resolveReceiptBlockType(block: ReceiptBlockElement): string {
  const record = block as ReceiptTextElement;
  const type = record.type ?? record.kind;
  return typeof type === "string" ? type.trim().toLowerCase() : "";
}

export function resolveReceiptBindText(
  bind: string,
  data: ReceiptJobData,
): string {
  switch (bind) {
    case "store_name":
    case "storeName":
      return data.storeName?.trim() ?? "";
    case "store_address":
    case "storeAddress":
      return data.storeAddress?.trim() ?? "";
    case "store_phone":
    case "storePhone":
      return data.storePhone?.trim() ?? "";
    case "title":
      return data.title?.trim() ?? "";
    case "order_number":
    case "orderNumber":
    case "order_code":
    case "orderCode":
      return data.orderNumber?.trim() ?? data.orderCode?.trim() ?? "";
    case "qr_payload":
    case "qrPayload":
      return data.qrPayload?.trim() ?? data.orderCode?.trim() ?? "";
    case "date":
    case "date_time":
    case "dateTime":
      return data.dateTime?.trim() ?? data.date?.trim() ?? "";
    case "cashier":
    case "cashier_name":
    case "cashierName":
      return data.cashierName?.trim() ?? data.cashier?.trim() ?? "";
    case "customer_name":
    case "customerName":
      return data.customerName?.trim() ?? "";
    case "customer_phone":
    case "customerPhone":
      return data.customerPhone?.trim() ?? "";
    case "payment_status":
    case "paymentStatus":
      return data.paymentStatus?.trim() ?? "";
    case "subtotal":
      return data.subtotal?.trim() ?? "";
    case "discount":
      return data.discount?.trim() ?? "";
    case "tax":
      return data.tax?.trim() ?? "";
    case "total":
      return data.total?.trim() ?? "";
    case "footer":
      return data.footer?.trim() ?? "";
    case "barcode":
      return data.barcode?.trim() ?? "";
    case "payment_method":
    case "paymentMethod":
      return data.paymentMethod?.trim() ?? "";
    default: {
      const record = data as Record<string, unknown>;
      const value = record[bind];
      if (typeof value === "string") return value.trim();
      if (typeof value === "number") return String(value);
      return "";
    }
  }
}
