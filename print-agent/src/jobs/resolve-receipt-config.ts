import type { PrintAgentConfig } from "../config.js";
import type { ReceiptPrintConfig, ReceiptJobData } from "../receipt-layout.js";
import { extractReceiptBlocks } from "../receipt-layout.js";
import type { PrintJob, ReceiptJob } from "../types.js";

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
  const data =
    job.jobType === "receipt" || job.jobType === "test_receipt"
      ? ((job as ReceiptJob).data as ReceiptJobData | undefined)
      : undefined;

  return (
    job.receiptConfig?.widthMm ??
    data?.widthMm ??
    config.receipt.widthMm ??
    80
  );
}
