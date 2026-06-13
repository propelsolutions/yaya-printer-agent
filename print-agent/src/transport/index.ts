import { usesWindowsPrintSpooler } from "../platform.js";
import { listCupsPrinters, printRawCups } from "./cups-raw.js";
import { listWindowsPrinters, printRawUsb } from "./usb-raw.js";

export async function listPrinters(): Promise<string[]> {
  if (usesWindowsPrintSpooler()) {
    return listWindowsPrinters();
  }

  return listCupsPrinters();
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
