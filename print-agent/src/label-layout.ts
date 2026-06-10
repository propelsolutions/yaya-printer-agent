export type TextAlign = "left" | "center" | "right";

export type LabelDataBind =
  | "product_name"
  | "sku"
  | "code"
  | "barcode"
  | "options"
  | "route";

export type LabelTextElement = {
  id: string;
  type: "text";
  bind: LabelDataBind;
  fontSizePt: number;
  align: TextAlign;
};

export type LabelBarcodeElement = {
  id: string;
  type: "barcode";
  bind: "barcode";
  heightMm: number;
  showHri: boolean;
  hriFontSizePt: number;
  align: TextAlign;
};

export type LabelQuantityTableElement = {
  id: string;
  type: "quantity_table";
  columns: number;
  cellHeightMm: number;
};

export type LabelLayoutElement =
  | LabelTextElement
  | LabelBarcodeElement
  | LabelQuantityTableElement;

export type LabelLayout = {
  elements: LabelLayoutElement[];
};

export type LabelPrintConfig = {
  widthMm: number;
  heightMm: number;
  gapMm: number;
  paddingMm: number;
  protocol?: "tspl" | "escpos";
  renderMode?: "image" | "text";
};

export type LabelJobData = {
  productName?: string | null;
  sku?: string | null;
  barcode?: string | null;
  code?: string | null;
  options?: string | null;
  route?: string | null;
  originName?: string | null;
  destinationName?: string | null;
  locationName?: string | null;
  zone?: string | null;
  boxQuantity?: number | null;
};

import { printableEntityCode } from "./entity-code.js";

export type LabelBuilderJobType =
  | "variant_box_label"
  | "variant_watch_label"
  | "bin_label"
  | "transfer_label";

export function resolveBarcodeValue(
  jobType: LabelBuilderJobType,
  data: LabelJobData,
): string {
  const code = printableEntityCode(data.code ?? data.sku ?? "");
  if (jobType === "bin_label" || jobType === "transfer_label") {
    return code || printableEntityCode(data.barcode ?? "");
  }

  return printableEntityCode(data.barcode ?? data.sku ?? "");
}

export function resolveBindText(
  bind: LabelDataBind,
  jobType: LabelBuilderJobType,
  data: LabelJobData,
): string {
  switch (bind) {
    case "product_name": {
      let productName = data.productName?.trim() || "";
      if (jobType === "bin_label") {
        const code = (data.code ?? "").trim().toUpperCase();
        const locationName = data.locationName?.trim();
        const zone = data.zone?.trim();
        productName = locationName || zone || code;
        if (locationName && zone) {
          productName = `${locationName} · ${zone}`;
        }
      }
      return productName;
    }
    case "sku":
      return (data.sku ?? data.code ?? "").trim();
    case "code":
      return printableEntityCode(data.code ?? data.sku ?? "").toUpperCase();
    case "barcode":
      return resolveBarcodeValue(jobType, data);
    case "options":
      return data.options?.trim() || "";
    case "route": {
      if (data.route?.trim()) return data.route.trim();
      const origin = data.originName?.trim();
      const destination = data.destinationName?.trim();
      if (origin && destination) return `${origin} -> ${destination}`;
      if (origin) return origin;
      if (destination) return destination;
      return "";
    }
    default:
      return "";
  }
}
