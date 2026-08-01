import type { LabelLayout, LabelPrintConfig } from "./label-layout.js";
import type { ReceiptJobData, ReceiptLayout, ReceiptPrintConfig } from "./receipt-layout.js";

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

export type ReceiptJobFields = {
  receiptConfig?: ReceiptPrintConfig;
  layout?: ReceiptLayout;
  blocks?: unknown;
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
};

export type ReceiptJob = ReceiptJobFields & {
  jobType: "receipt";
  data: ReceiptJobData & {
    lineItems?: Array<{
      name: string;
      quantity?: number;
      total: string;
    }>;
    total?: string;
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

export type TestReceiptJob = ReceiptJobFields & {
  jobType: "test_receipt";
  data?: ReceiptJobData;
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
  labelPrinterName?: string;
  receiptPrinterName?: string;
};

const RECEIPT_ENVELOPE_KEYS = [
  "receiptConfig",
  "layout",
  "blocks",
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

function isReceiptLikeJob(job: PrintJob): boolean {
  return job.jobType === "receipt" || job.jobType === "test_receipt";
}

function mergeReceiptEnvelopeIntoJob(
  job: PrintJob,
  envelope: Record<string, unknown>,
): PrintJob {
  if (!isReceiptLikeJob(job)) return job;

  const merged = { ...job } as PrintJob & ReceiptJobFields;
  for (const key of RECEIPT_ENVELOPE_KEYS) {
    const envelopeValue = envelope[key];
    if (envelopeValue === undefined) continue;
    if ((merged as Record<string, unknown>)[key] !== undefined) continue;
    (merged as Record<string, unknown>)[key] = envelopeValue;
  }

  return merged;
}

export function isPrintBatchRequest(value: unknown): value is PrintBatchRequest {
  if (!value || typeof value !== "object") return false;
  const jobs = (value as { jobs?: unknown }).jobs;
  return Array.isArray(jobs) && jobs.length > 0 && jobs.every(isPrintJob);
}

function extractPrintRequestOptions(record: Record<string, unknown>): {
  labelPrinterName?: string;
  receiptPrinterName?: string;
} {
  return {
    labelPrinterName:
      typeof record.labelPrinterName === "string"
        ? record.labelPrinterName
        : undefined,
    receiptPrinterName:
      typeof record.receiptPrinterName === "string"
        ? record.receiptPrinterName
        : undefined,
  };
}

export function parsePrintRequest(
  value: unknown,
): { job: PrintJob; options: { labelPrinterName?: string; receiptPrinterName?: string } } {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid print job payload.");
  }

  const record = value as Record<string, unknown>;
  const nestedJob = record.job;

  // Yayastore sends { jobType, receiptPrinterName, job: { data: { layout: { blocks } } } }
  if (isPrintJob(nestedJob)) {
    return {
      job: mergeReceiptEnvelopeIntoJob(nestedJob, record),
      options: extractPrintRequestOptions(record),
    };
  }

  if (isPrintJob(value)) {
    return {
      job: mergeReceiptEnvelopeIntoJob(value as PrintJob, record),
      options: extractPrintRequestOptions(record),
    };
  }

  throw new Error("Invalid print job payload.");
}

export function parsePrintBatchRequest(
  value: unknown,
): {
  jobs: PrintJob[];
  options: { labelPrinterName?: string; receiptPrinterName?: string };
} {
  if (!isPrintBatchRequest(value)) {
    throw new Error("Invalid batch print payload.");
  }

  return {
    jobs: value.jobs,
    options: {
      labelPrinterName: value.labelPrinterName,
      receiptPrinterName: value.receiptPrinterName,
    },
  };
}
