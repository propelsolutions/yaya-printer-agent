import type { PrintAgentConfig } from "../config.js";
import type { ReceiptPrintConfig } from "../receipt-layout.js";
import { extractReceiptBlocks } from "../receipt-layout.js";
import type { PrintJob } from "../types.js";

export function isReceiptBlocksJob(job: PrintJob): boolean {
  if (job.jobType !== "receipt" && job.jobType !== "test_receipt") {
    return false;
  }
  return extractReceiptBlocks(job) !== null;
}

export function shouldUseReceiptBlocksRenderer(job: PrintJob): boolean {
  return isReceiptBlocksJob(job);
}

export function resolveReceiptWidthMm(
  config: PrintAgentConfig,
  job: PrintJob & { receiptConfig?: ReceiptPrintConfig },
): number {
  return job.receiptConfig?.widthMm ?? config.receipt.widthMm ?? 80;
}
