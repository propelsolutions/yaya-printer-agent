import type { PrintAgentConfig } from "../config.js";
import { buildProductLabelImageTspl } from "../render/product-label-image.js";
import {
  buildVariantBoxLabelTsplText,
  buildVariantWatchLabelTsplText,
  buildTransferLabelTsplText,
  buildTestLabelTsplText,
} from "./tspl-text.js";

function useImageLabels(config: PrintAgentConfig): boolean {
  return (config.labelRenderMode ?? "image") === "image";
}

export async function buildTransferLabelTspl(
  config: PrintAgentConfig,
  data: { code: string; route?: string | null },
): Promise<Buffer> {
  return Buffer.from(buildTransferLabelTsplText(config, data), "ascii");
}

export async function buildVariantBoxLabelTspl(
  config: PrintAgentConfig,
  data: {
    productName: string;
    sku: string;
    barcode?: string | null;
    options?: string | null;
  },
): Promise<Buffer> {
  if (useImageLabels(config)) {
    return buildProductLabelImageTspl(config, data);
  }

  return Buffer.from(buildVariantBoxLabelTsplText(config, data), "ascii");
}

export async function buildVariantWatchLabelTspl(
  config: PrintAgentConfig,
  data: {
    productName?: string | null;
    sku: string;
    barcode?: string | null;
  },
): Promise<Buffer> {
  if (useImageLabels(config)) {
    return buildProductLabelImageTspl(config, {
      productName: data.productName?.trim() || data.sku,
      sku: data.sku,
      barcode: data.barcode,
    });
  }

  return Buffer.from(buildVariantWatchLabelTsplText(config, data), "ascii");
}

export async function buildTestLabelTspl(
  config: PrintAgentConfig,
): Promise<Buffer> {
  if (useImageLabels(config)) {
    return buildProductLabelImageTspl(config, {
      productName: "AL-fajri (WS-O8)",
      sku: "AF-(WA-08)-BR-GD",
      barcode: "P10097",
    });
  }

  return Buffer.from(buildTestLabelTsplText(config), "ascii");
}

// Re-export text helpers for tests or fallback tooling.
export {
  buildTransferLabelTsplText,
  buildVariantBoxLabelTsplText,
  buildVariantWatchLabelTsplText,
  buildTestLabelTsplText,
} from "./tspl-text.js";

export { escapeTsplString, truncateTsplText } from "./tspl-text.js";
