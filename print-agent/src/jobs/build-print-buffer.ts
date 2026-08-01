import type { PrintAgentConfig } from "../config.js";
import { printableEntityCode } from "../entity-code.js";
import {
  buildReceiptEscpos,
  buildTestLabelEscpos,
  buildTestReceiptEscpos,
  buildTransferLabelEscpos,
  buildTransferPickListEscpos,
  buildVariantBoxLabelEscpos,
  buildVariantWatchLabelEscpos,
} from "../templates/escpos.js";
import {
  buildTestLabelTspl,
  buildTransferLabelTspl,
  buildVariantBoxLabelTspl,
  buildVariantWatchLabelTspl,
} from "../templates/tspl.js";
import type { LabelBuilderJobType } from "../label-layout.js";
import type {
  BinLabelJob,
  LabelJobFields,
  LabelProtocol,
  PrintJob,
  ReceiptJob,
} from "../types.js";
import { buildLayoutLabelImageTspl } from "../render/layout-label-image.js";
import {
  resolveJobPrintConfig,
  shouldUseLayoutRenderer,
} from "./resolve-label-config.js";
import {
  resolveReceiptWidthMm,
  shouldUseReceiptBlocksRenderer,
} from "./resolve-receipt-config.js";
import { buildReceiptJobEscpos } from "../templates/escpos-receipt-blocks.js";
import { DEFAULT_TEST_RECEIPT_DATA } from "../receipt-layout.js";

export type PrintPayloadKind = "label" | "receipt";

export type PrintRenderer = "layout" | "legacy" | "blocks";

export type PrintPayload = {
  buffer: Buffer;
  kind: PrintPayloadKind;
  renderer: PrintRenderer;
};

export function resolveLabelProtocol(
  config: PrintAgentConfig,
  job: PrintJob,
): LabelProtocol {
  if ("labelProtocol" in job && job.labelProtocol) {
    return job.labelProtocol;
  }

  return config.labelProtocol ?? "tspl";
}

function useTsplLabels(config: PrintAgentConfig, job: PrintJob): boolean {
  return resolveLabelProtocol(config, job) === "tspl";
}

function buildBinLabelVariantData(data: BinLabelJob["data"]) {
  const code = printableEntityCode(data.code).toUpperCase();
  const locationName = data.locationName?.trim();
  const zone = data.zone?.trim();

  let productName = locationName || zone || code;
  if (locationName && zone) {
    productName = `${locationName} · ${zone}`;
  }

  return {
    productName,
    sku: code,
    barcode: code,
  };
}

function buildTransferRoute(data: PrintJob & { jobType: "transfer_label" }) {
  if (data.data.route?.trim()) return data.data.route.trim();

  const origin = data.data.originName?.trim();
  const destination = data.data.destinationName?.trim();
  if (origin && destination) return `${origin} -> ${destination}`;
  if (origin) return origin;
  if (destination) return destination;
  return null;
}

async function buildLayoutLabelBuffer(
  config: PrintAgentConfig,
  job: PrintJob & { layout: NonNullable<LabelJobFields["layout"]> },
): Promise<PrintPayload> {
  const resolvedConfig = resolveJobPrintConfig(config, job);

  if (!("data" in job)) {
    throw new Error(`Layout label job missing data: ${job.jobType}`);
  }

  return {
    kind: "label",
    renderer: "layout",
    buffer: await buildLayoutLabelImageTspl(
      resolvedConfig,
      job.jobType as LabelBuilderJobType,
      job.layout,
      job.data,
    ),
  };
}

export async function buildPrintJobBuffer(
  config: PrintAgentConfig,
  job: PrintJob,
): Promise<PrintPayload> {
  const resolvedConfig = resolveJobPrintConfig(config, job);

  if (shouldUseLayoutRenderer(resolvedConfig, job)) {
    return buildLayoutLabelBuffer(
      resolvedConfig,
      job as PrintJob & { layout: NonNullable<LabelJobFields["layout"]> },
    );
  }

  const tsplLabels = useTsplLabels(resolvedConfig, job);
  const legacyPayload = (payload: Omit<PrintPayload, "renderer">): PrintPayload => ({
    ...payload,
    renderer: "legacy",
  });

  switch (job.jobType) {
    case "bin_label": {
      const variantData = buildBinLabelVariantData(job.data);

      if (tsplLabels) {
        return legacyPayload({
          kind: "label",
          buffer: await buildVariantBoxLabelTspl(resolvedConfig, variantData),
        });
      }

      return legacyPayload({
        kind: "label",
        buffer: buildVariantBoxLabelEscpos(variantData),
      });
    }
    case "transfer_label": {
      if (tsplLabels) {
        return legacyPayload({
          kind: "label",
          buffer: await buildTransferLabelTspl(resolvedConfig, {
            code: job.data.code,
            route: buildTransferRoute(job),
          }),
        });
      }

      return legacyPayload({
        kind: "label",
        buffer: buildTransferLabelEscpos({
          code: job.data.code,
          route: buildTransferRoute(job),
        }),
      });
    }
    case "variant_box_label": {
      if (tsplLabels) {
        return legacyPayload({
          kind: "label",
          buffer: await buildVariantBoxLabelTspl(resolvedConfig, job.data),
        });
      }

      return legacyPayload({
        kind: "label",
        buffer: buildVariantBoxLabelEscpos(job.data),
      });
    }
    case "variant_watch_label": {
      if (tsplLabels) {
        return legacyPayload({
          kind: "label",
          buffer: await buildVariantWatchLabelTspl(resolvedConfig, job.data),
        });
      }

      return legacyPayload({
        kind: "label",
        buffer: buildVariantWatchLabelEscpos(job.data),
      });
    }
    case "transfer_pick_list": {
      return legacyPayload({
        kind: "receipt",
        buffer: buildTransferPickListEscpos(job.data),
      });
    }
    case "receipt": {
      if (shouldUseReceiptBlocksRenderer(job)) {
        return {
          kind: "receipt",
          renderer: "blocks",
          buffer: buildReceiptJobEscpos({
            ...job,
            data: job.data,
            receiptConfig: {
              ...job.receiptConfig,
              widthMm: resolveReceiptWidthMm(resolvedConfig, job),
            },
          }),
        };
      }

      const lineItems = job.data.lineItems ?? [];
      const total = job.data.total ?? "";

      return legacyPayload({
        kind: "receipt",
        buffer: buildReceiptEscpos({
          ...job.data,
          lineItems,
          total,
        }),
      });
    }
    case "test_label": {
      if (tsplLabels) {
        return legacyPayload({
          kind: "label",
          buffer: await buildTestLabelTspl(resolvedConfig),
        });
      }

      return legacyPayload({
        kind: "label",
        buffer: buildTestLabelEscpos(),
      });
    }
    case "test_receipt": {
      if (shouldUseReceiptBlocksRenderer(job)) {
        const testJob = job as ReceiptJob;
        const data = testJob.data ?? DEFAULT_TEST_RECEIPT_DATA;

        return {
          kind: "receipt",
          renderer: "blocks",
          buffer: buildReceiptJobEscpos({
            ...testJob,
            data,
          }),
        };
      }

      return legacyPayload({
        kind: "receipt",
        buffer: buildTestReceiptEscpos(),
      });
    }
    default: {
      const exhaustive: never = job;
      throw new Error(`Unsupported print job: ${(exhaustive as PrintJob).jobType}`);
    }
  }
}
