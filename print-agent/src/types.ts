import type { LabelLayout, LabelPrintConfig } from "./label-layout.js";

export type LabelProtocol = "escpos" | "tspl";

export type LabelJobFields = {
  labelConfig?: LabelPrintConfig;
  layout?: LabelLayout;
};

export type TransferLabelJob = LabelJobFields & {
  jobType: "transfer_label";
  labelProtocol?: LabelProtocol;
  data: {
    code: string;
    route?: string | null;
    originName?: string | null;
    destinationName?: string | null;
  };
  copies?: number;
};

export type BinLabelJob = LabelJobFields & {
  jobType: "bin_label";
  labelProtocol?: LabelProtocol;
  data: {
    code: string;
    locationName?: string | null;
    zone?: string | null;
  };
  copies?: number;
};

export type VariantBoxLabelJob = LabelJobFields & {
  jobType: "variant_box_label";
  labelProtocol?: LabelProtocol;
  data: {
    productName: string;
    sku: string;
    barcode?: string | null;
    options?: string | null;
    boxQuantity?: number | null;
  };
  copies?: number;
};

export type VariantWatchLabelJob = LabelJobFields & {
  jobType: "variant_watch_label";
  labelProtocol?: LabelProtocol;
  data: {
    productName: string;
    sku: string;
    barcode?: string | null;
    options?: string | null;
  };
  copies?: number;
};

export type ReceiptJob = {
  jobType: "receipt";
  data: {
    storeName?: string;
    title?: string;
    lineItems: Array<{
      name: string;
      quantity?: number;
      total: string;
    }>;
    subtotal?: string;
    total: string;
    footer?: string;
    barcode?: string | null;
  };
  copies?: number;
};

export type TransferPickListLine = {
  productName: string;
  sku?: string | null;
  barcode?: string | null;
  fromBinCode?: string | null;
  fromBinZone?: string | null;
  quantity: number;
  sequence?: number | null;
};

export type TransferPickListJob = {
  jobType: "transfer_pick_list";
  data: {
    code: string;
    originName?: string | null;
    destinationName?: string | null;
    lines: TransferPickListLine[];
  };
  copies?: number;
};

export type TestLabelJob = LabelJobFields & {
  jobType: "test_label";
  labelProtocol?: LabelProtocol;
  copies?: number;
};

export type TestReceiptJob = {
  jobType: "test_receipt";
  copies?: number;
};

export type PrintJob =
  | TransferLabelJob
  | BinLabelJob
  | VariantBoxLabelJob
  | VariantWatchLabelJob
  | TransferPickListJob
  | ReceiptJob
  | TestLabelJob
  | TestReceiptJob;

export function isPrintJob(value: unknown): value is PrintJob {
  if (!value || typeof value !== "object") return false;
  const jobType = (value as { jobType?: unknown }).jobType;
  return (
    jobType === "transfer_label" ||
    jobType === "bin_label" ||
    jobType === "variant_box_label" ||
    jobType === "variant_watch_label" ||
    jobType === "transfer_pick_list" ||
    jobType === "receipt" ||
    jobType === "test_label" ||
    jobType === "test_receipt"
  );
}

export type PrintBatchRequest = {
  jobs: PrintJob[];
};

export function isPrintBatchRequest(value: unknown): value is PrintBatchRequest {
  if (!value || typeof value !== "object") return false;
  const jobs = (value as { jobs?: unknown }).jobs;
  return Array.isArray(jobs) && jobs.length > 0 && jobs.every(isPrintJob);
}
