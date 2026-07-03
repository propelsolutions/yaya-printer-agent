import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type PrintAgentConfig = {
  host: string;
  port: number;
  /** Legacy fallback when label/receipt names are not set. */
  usbPrinterName: string;
  /** Default label printer on this PC (overridable per browser session). */
  labelPrinterName?: string;
  /** Default receipt printer on this PC (overridable per browser session). */
  receiptPrinterName?: string;
  label: {
    widthMm: number;
    heightMm: number;
    gapMm: number;
  };
  /** Edge padding for label content (mm). */
  labelPaddingMm?: number;
  receipt: {
    widthMm: number;
  };
  /** Use "tspl" when the XP-365B is in label mode (default). Use "escpos" when in receipt mode. */
  labelProtocol?: "escpos" | "tspl";
  /** Render product labels as raster graphics (custom fonts) or TSPL text commands. */
  labelRenderMode?: "image" | "text";
  /** Maximum copies allowed per single print job. */
  maxCopiesPerJob?: number;
  /** Maximum jobs allowed in one batch print request. */
  maxBatchJobs?: number;
  corsOrigins: string[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadConfig(): PrintAgentConfig {
  const configPath = join(__dirname, "..", "print-agent.config.json");
  const raw = readFileSync(configPath, "utf8");
  return JSON.parse(raw) as PrintAgentConfig;
}
