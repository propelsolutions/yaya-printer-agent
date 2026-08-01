import { usesWindowsPrintSpooler } from "../platform.js";
import { listCupsPrinters, printRawCups } from "./cups-raw.js";
import {
  listWindowsPrinters,
  printRawUsb,
  warmUpWindowsPrintWorker,
} from "./usb-raw.js";

export { warmUpWindowsPrintWorker };

const PRINTER_LIST_CACHE_TTL_MS = 30_000;

let cachedPrinters: string[] | null = null;
let cachedPrintersExpiry = 0;

export async function listPrinters(): Promise<string[]> {
  const now = Date.now();
  if (cachedPrinters && now < cachedPrintersExpiry) {
    return cachedPrinters;
  }

  const printers = usesWindowsPrintSpooler()
    ? await listWindowsPrinters()
    : await listCupsPrinters();

  cachedPrinters = printers;
  cachedPrintersExpiry = now + PRINTER_LIST_CACHE_TTL_MS;
  return printers;
}

export async function printRaw(
  printerName: string,
  data: Buffer | string,
): Promise<void> {
  if (usesWindowsPrintSpooler()) {
    await printRawUsb(printerName, data);
    return;
  }

  await printRawCups(printerName, data);
}

export async function isPrinterAvailable(printerName: string): Promise<boolean> {
  const printers = await listPrinters();
  return printers.some(
    (name) =>
      name.localeCompare(printerName, undefined, { sensitivity: "accent" }) === 0,
  );
}
