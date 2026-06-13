import type { PrintAgentConfig } from "../config.js";
import { PartialPrintError } from "../jobs/partial-print-error.js";
import { printRaw } from "../transport/index.js";

export interface PrinterAdapter {
  printLabel(data: Buffer | string, copies?: number): Promise<number>;
  printReceipt(escpos: Buffer, copies?: number): Promise<number>;
}

async function printCopies(
  printerName: string,
  data: Buffer,
  copies: number,
): Promise<number> {
  const count = Math.max(1, copies);
  let printed = 0;

  try {
    for (let index = 0; index < count; index += 1) {
      await printRaw(printerName, data);
      printed += 1;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Printer request failed.";

    if (printed > 0) {
      throw new PartialPrintError(message, printed, count);
    }

    throw error;
  }

  return printed;
}

export function createXp365bAdapter(config: PrintAgentConfig): PrinterAdapter {
  return {
    async printLabel(data, copies = 1) {
      const buffer = typeof data === "string" ? Buffer.from(data, "ascii") : data;
      return printCopies(config.usbPrinterName, buffer, copies);
    },
    async printReceipt(escpos, copies = 1) {
      return printCopies(config.usbPrinterName, escpos, copies);
    },
  };
}