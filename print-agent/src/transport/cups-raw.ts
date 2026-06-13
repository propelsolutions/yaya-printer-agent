import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function listCupsPrinters(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("lpstat", ["-a"], { timeout: 15000 });

    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(.+?)\s+accepting requests/i);
        return match?.[1]?.trim() ?? "";
      })
      .filter(Boolean);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("No destinations added")) {
      return [];
    }

    throw error;
  }
}

export async function printRawCups(
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
      "lp",
      ["-d", printerName, "-o", "raw", tempFile],
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
