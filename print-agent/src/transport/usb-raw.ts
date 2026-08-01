import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const workerScript = join(__dirname, "..", "..", "scripts", "raw-print-worker.ps1");

type PendingPrint = {
  resolve: () => void;
  reject: (error: Error) => void;
};

let worker: ChildProcessWithoutNullStreams | null = null;
let workerReader: ReadlineInterface | null = null;
let workerReady: Promise<void> | null = null;
const pending = new Map<number, PendingPrint>();
let nextId = 0;

function rejectAllPending(error: Error) {
  for (const entry of pending.values()) {
    entry.reject(error);
  }
  pending.clear();
}

function resetWorkerState() {
  worker?.kill();
  worker = null;
  workerReader?.close();
  workerReader = null;
  workerReady = null;
}

function handleWorkerResponse(line: string) {
  try {
    const payload = JSON.parse(line) as {
      id: number;
      ok: boolean;
      error?: string;
    };
    const entry = pending.get(payload.id);
    if (!entry) return;

    pending.delete(payload.id);
    if (payload.ok) {
      entry.resolve();
      return;
    }

    entry.reject(new Error(payload.error?.trim() || "Print failed."));
  } catch {
    // Ignore malformed worker responses.
  }
}

function startWorker(): Promise<void> {
  if (workerReady) return workerReady;

  workerReady = new Promise<void>((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", workerScript],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    worker = child;
    const reader = createInterface({ input: child.stdout });
    workerReader = reader;

    const timeout = setTimeout(() => {
      resetWorkerState();
      reject(new Error("Print worker failed to start in time."));
    }, 30000);

    reader.once("line", (line) => {
      if (line.trim() !== "READY") {
        clearTimeout(timeout);
        resetWorkerState();
        reject(new Error(`Unexpected print worker output: ${line}`));
        return;
      }

      clearTimeout(timeout);
      reader.on("line", handleWorkerResponse);
      resolve();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const message = chunk.toString("utf8").trim();
      if (message) {
        console.error(`[print-worker] ${message}`);
      }
    });

    child.on("exit", (code) => {
      rejectAllPending(
        new Error(`Print worker exited (${code ?? "unknown"}).`),
      );
      resetWorkerState();
    });
  }).catch((error) => {
    workerReady = null;
    throw error;
  });

  return workerReady;
}

/** Load the Windows RAW print helper once at agent startup. */
export function warmUpWindowsPrintWorker(): void {
  void startWorker().catch((error) => {
    console.warn("Failed to warm up Windows print worker:", error);
  });
}

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

  try {
    await startWorker();
  } catch (error) {
    resetWorkerState();
    throw error instanceof Error ? error : new Error("Print worker unavailable.");
  }

  if (!worker?.stdin.writable) {
    resetWorkerState();
    await startWorker();
  }

  const id = ++nextId;
  const payload = JSON.stringify({
    id,
    printerName,
    dataBase64: buffer.toString("base64"),
  });

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });

    worker!.stdin.write(`${payload}\n`, (error) => {
      if (!error) return;

      pending.delete(id);
      reject(error);
    });
  });
}
