import type { PrintAgentConfig } from "./config.js";
import type { PrintJob } from "./types.js";

export type PrintRequestOptions = {
  labelPrinterName?: string;
  receiptPrinterName?: string;
};

function trimName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveLabelPrinterName(
  config: PrintAgentConfig,
  options?: PrintRequestOptions,
): string {
  return (
    trimName(options?.labelPrinterName) ??
    trimName(config.labelPrinterName) ??
    config.usbPrinterName
  );
}

export function resolveReceiptPrinterName(
  config: PrintAgentConfig,
  options?: PrintRequestOptions,
): string {
  return (
    trimName(options?.receiptPrinterName) ??
    trimName(config.receiptPrinterName) ??
    config.usbPrinterName
  );
}

export function isReceiptJob(job: PrintJob): boolean {
  return (
    job.jobType === "transfer_pick_list" ||
    job.jobType === "receipt" ||
    job.jobType === "test_receipt"
  );
}

export function resolvePrinterNameForJob(
  config: PrintAgentConfig,
  job: PrintJob,
  options?: PrintRequestOptions,
): string {
  return isReceiptJob(job)
    ? resolveReceiptPrinterName(config, options)
    : resolveLabelPrinterName(config, options);
}

export function extractPrintRequestOptions(
  record: Record<string, unknown>,
): PrintRequestOptions {
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
