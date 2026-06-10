import type { PrintAgentConfig } from "../config.js";
import type { LabelBuilderJobType, LabelLayout } from "../label-layout.js";
import type { LabelJobFields, PrintJob } from "../types.js";

const LAYOUT_JOB_TYPES = new Set<string>([
  "variant_box_label",
  "variant_watch_label",
  "bin_label",
  "transfer_label",
]);

function hasRenderableLayout(layout: unknown): layout is LabelLayout {
  if (!layout || typeof layout !== "object" || Array.isArray(layout)) {
    return false;
  }

  const elements = (layout as LabelLayout).elements;
  return Array.isArray(elements) && elements.length > 0;
}

export function isLayoutLabelJob(
  job: PrintJob,
): job is PrintJob & LabelJobFields & { jobType: LabelBuilderJobType } {
  return (
    LAYOUT_JOB_TYPES.has(job.jobType) &&
    "layout" in job &&
    hasRenderableLayout(job.layout) &&
    "labelConfig" in job &&
    Boolean(job.labelConfig)
  );
}

export function resolveLabelRenderMode(
  config: PrintAgentConfig,
  job: PrintJob,
): "image" | "text" {
  if ("labelConfig" in job && job.labelConfig?.renderMode) {
    return job.labelConfig.renderMode;
  }

  return config.labelRenderMode ?? "image";
}

export function resolveJobPrintConfig(
  config: PrintAgentConfig,
  job: PrintJob,
): PrintAgentConfig {
  if (!("labelConfig" in job) || !job.labelConfig) {
    return config;
  }

  const labelConfig = job.labelConfig;

  return {
    ...config,
    label: {
      widthMm: labelConfig.widthMm,
      heightMm: labelConfig.heightMm,
      gapMm: labelConfig.gapMm,
    },
    labelPaddingMm: labelConfig.paddingMm,
    labelProtocol: labelConfig.protocol ?? config.labelProtocol,
    labelRenderMode: labelConfig.renderMode ?? config.labelRenderMode,
  };
}

export function shouldUseLayoutRenderer(
  config: PrintAgentConfig,
  job: PrintJob,
): boolean {
  return (
    isLayoutLabelJob(job) && resolveLabelRenderMode(config, job) === "image"
  );
}
