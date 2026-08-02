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
  type: "text";
  bind?: ReceiptDataBind | string;
  text?: string;
  fontSizePt?: number;
  align?: TextAlign;
  bold?: boolean;
  doubleSize?: boolean;
};

export type ReceiptDividerElement = {
  id?: string;
  type: "divider" | "separator";
  char?: string;
};

export type ReceiptLineItemsElement = {
  id?: string;
  type: "line_items" | "lineItems" | "items";
  showQuantity?: boolean;
  priceWidth?: number;
};

export type ReceiptKeyValueElement = {
  id?: string;
  type: "key_value" | "keyValue" | "row";
  label: string;
  bind?: ReceiptDataBind | string;
  value?: string;
  bold?: boolean;
};

export type ReceiptBarcodeElement = {
  id?: string;
  type: "barcode";
  bind?: ReceiptDataBind | string;
  showHri?: boolean;
  align?: TextAlign;
};

export type ReceiptSpacerElement = {
  id?: string;
  type: "spacer" | "space" | "feed";
  lines?: number;
};

export type ReceiptBlockElement =
  | ReceiptTextElement
  | ReceiptDividerElement
  | ReceiptLineItemsElement
  | ReceiptKeyValueElement
  | ReceiptBarcodeElement
  | ReceiptSpacerElement;

export type ReceiptLayout = {
  elements?: ReceiptBlockElement[];
  blocks?: ReceiptBlockElement[];
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
  title?: string;
  orderNumber?: string;
  date?: string;
  cashier?: string;
  customerName?: string;
  lineItems?: ReceiptLineItem[];
  subtotal?: string;
  discount?: string;
  tax?: string;
  total?: string;
  footer?: string;
  barcode?: string | null;
  paymentMethod?: string;
  blocks?: ReceiptBlockElement[] | ReceiptLayout;
  layout?: ReceiptLayout;
};

function blocksFromContainer(value: unknown): ReceiptBlockElement[] | null {
  if (Array.isArray(value) && value.length > 0) {
    return value as ReceiptBlockElement[];
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as ReceiptLayout;
  if (Array.isArray(record.elements) && record.elements.length > 0) {
    return record.elements;
  }

  if (Array.isArray(record.blocks) && record.blocks.length > 0) {
    return record.blocks;
  }

  const nested = (value as { blocks?: unknown }).blocks;
  if (Array.isArray(nested) && nested.length > 0) {
    return nested as ReceiptBlockElement[];
  }

  return null;
}

export function extractReceiptBlocks(source: {
  blocks?: unknown;
  layout?: unknown;
  template?: unknown;
  receiptTemplate?: unknown;
  receiptLayout?: unknown;
  receiptBlocks?: unknown;
  data?: unknown;
}): ReceiptBlockElement[] | null {
  const containers = [
    source.blocks,
    source.layout,
    source.template,
    source.receiptTemplate,
    source.receiptLayout,
    source.receiptBlocks,
  ];

  for (const container of containers) {
    const fromContainer = blocksFromContainer(container);
    if (fromContainer) return fromContainer;
  }

  if (source.data && typeof source.data === "object" && !Array.isArray(source.data)) {
    return extractReceiptBlocks(source.data as {
      blocks?: unknown;
      layout?: unknown;
      template?: unknown;
      receiptTemplate?: unknown;
      receiptLayout?: unknown;
    });
  }

  return null;
}

export function resolveReceiptBindText(
  bind: string,
  data: ReceiptJobData,
): string {
  switch (bind) {
    case "store_name":
    case "storeName":
      return data.storeName?.trim() ?? "";
    case "title":
      return data.title?.trim() ?? "";
    case "order_number":
    case "orderNumber":
      return data.orderNumber?.trim() ?? "";
    case "date":
      return data.date?.trim() ?? "";
    case "cashier":
      return data.cashier?.trim() ?? "";
    case "customer_name":
    case "customerName":
      return data.customerName?.trim() ?? "";
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
