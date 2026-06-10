import { createHash } from "node:crypto";

import type { PrintAgentConfig } from "../config.js";
import type { PrintJob } from "../types.js";

const CACHE_MAX_ENTRIES = 256;

const cache = new Map<string, Buffer>();

export function buildJobCacheKey(
  config: PrintAgentConfig,
  job: PrintJob,
  labelProtocol: "escpos" | "tspl",
): string {
  const { copies: _copies, ...jobWithoutCopies } = job as PrintJob & {
    copies?: number;
  };

  return createHash("sha256")
    .update(
      JSON.stringify({
        labelRenderMode: config.labelRenderMode ?? "image",
        label: config.label,
        labelPaddingMm: config.labelPaddingMm ?? 1.5,
        receipt: config.receipt,
        labelProtocol,
        job: jobWithoutCopies,
      }),
    )
    .digest("hex");
}

export function getCachedPrintBuffer(key: string): Buffer | undefined {
  const cached = cache.get(key);
  if (!cached) return undefined;

  cache.delete(key);
  cache.set(key, cached);
  return cached;
}

export function setCachedPrintBuffer(key: string, buffer: Buffer): void {
  if (cache.has(key)) {
    cache.delete(key);
  }

  cache.set(key, buffer);

  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

export function clearPrintBufferCache(): void {
  cache.clear();
}
