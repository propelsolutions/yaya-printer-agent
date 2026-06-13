import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rawPrintScript = join(__dirname, "..", "..", "scripts", "raw-print.ps1");

export async function listWindowsPrinters(): Promise<string[]> {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "Get-Printer | Select-Object -ExpandProperty Name",
    ],
    { timeout: 15000 },
  );

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function printRawUsb(
  printerName: string,
  data: Buffer | string,
): Promise<void> {
  const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  const tempFile = join(
    tmpdir(),
    `yaya-print-${randomBytes(8).toString("hex")}.bin`,
  );

  writeFileSync(tempFile, buffer);

  try {
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        rawPrintScript,
        "-PrinterName",
        printerName,
        "-FilePath",
        tempFile,
      ],
      { timeout: 30000 },
    );
  } finally {
    try {
      unlinkSync(tempFile);
    } catch {
      // Ignore cleanup errors.
    }
  }
}

