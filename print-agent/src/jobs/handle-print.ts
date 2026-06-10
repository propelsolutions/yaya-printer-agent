import type { PrintAgentConfig } from "../config.js";
import { PartialPrintError } from "./partial-print-error.js";
import { createXp365bAdapter } from "../printers/xp-365b.js";
import type { PrintJob } from "../types.js";
import {
  buildPrintJobBuffer,
  resolveLabelProtocol,
  type PrintPayloadKind,
  type PrintRenderer,
} from "./build-print-buffer.js";
import {
  resolveJobPrintConfig,
  shouldUseLayoutRenderer,
} from "./resolve-label-config.js";
import {
  buildJobCacheKey,
  getCachedPrintBuffer,
  setCachedPrintBuffer,
} from "./label-cache.js";

export type PrintJobResult = {
  ok: boolean;
  copiesRequested: number;
  copiesPrinted: number;
  cacheHit: boolean;
  renderer?: PrintRenderer;
  error?: string;
};

export function normalizeCopies(
  config: PrintAgentConfig,
  copies: number | undefined,
): number {
  const maxCopies = config.maxCopiesPerJob ?? 500;
  const requested = copies ?? 1;
  return Math.max(1, Math.min(requested, maxCopies));
}

function payloadKind(job: PrintJob): PrintPayloadKind {
  switch (job.jobType) {
    case "transfer_pick_list":
    case "receipt":
    case "test_receipt":
      return "receipt";
    default:
      return "label";
  }
}

async function resolvePrintPayload(config: PrintAgentConfig, job: PrintJob) {
  const resolvedConfig = resolveJobPrintConfig(config, job);
  const labelProtocol = resolveLabelProtocol(resolvedConfig, job);
  const cacheKey = buildJobCacheKey(resolvedConfig, job, labelProtocol);
  const cached = getCachedPrintBuffer(cacheKey);
  const kind = payloadKind(job);

  if (cached) {
    return {
      buffer: cached,
      kind,
      renderer: shouldUseLayoutRenderer(resolvedConfig, job) ? "layout" : "legacy",
      cacheHit: true,
    };
  }

  const payload = await buildPrintJobBuffer(resolvedConfig, job);
  setCachedPrintBuffer(cacheKey, payload.buffer);

  return {
    buffer: payload.buffer,
    kind: payload.kind,
    renderer: payload.renderer,
    cacheHit: false,
  };
}

export async function handlePrintJob(
  config: PrintAgentConfig,
  job: PrintJob,
): Promise<PrintJobResult> {
  const adapter = createXp365bAdapter(config);
  const copies = normalizeCopies(config, job.copies);
  const payload = await resolvePrintPayload(config, job);

  try {
    const copiesPrinted =
      payload.kind === "label"
        ? await adapter.printLabel(payload.buffer, copies)
        : await adapter.printReceipt(payload.buffer, copies);

    return {
      ok: true,
      copiesRequested: copies,
      copiesPrinted,
      cacheHit: payload.cacheHit,
      renderer: payload.renderer,
    };
  } catch (error) {
    const partial =
      error instanceof PartialPrintError
        ? error
        : null;

    if (partial) {
      return {
        ok: false,
        copiesRequested: copies,
        copiesPrinted: partial.copiesPrinted,
        cacheHit: payload.cacheHit,
        renderer: payload.renderer,
        error: partial.message,
      };
    }

    throw error;
  }
}

export async function handlePrintBatch(
  config: PrintAgentConfig,
  jobs: PrintJob[],
): Promise<{ jobs: number; copiesPrinted: number; cacheHits: number }> {
  const maxBatchJobs = config.maxBatchJobs ?? 500;

  if (jobs.length === 0) {
    throw new Error("Batch print requires at least one job.");
  }

  if (jobs.length > maxBatchJobs) {
    throw new Error(`Batch print is limited to ${maxBatchJobs} jobs per request.`);
  }

  let copiesPrinted = 0;
  let cacheHits = 0;

  for (const job of jobs) {
    const result = await handlePrintJob(config, job);
    copiesPrinted += result.copiesPrinted;
    if (result.cacheHit) cacheHits += 1;
  }

  return {
    jobs: jobs.length,
    copiesPrinted,
    cacheHits,
  };
}
