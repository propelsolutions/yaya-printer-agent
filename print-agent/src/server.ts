import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { PrintAgentConfig } from "./config.js";
import { PRINT_AGENT_BUILD, PRINT_AGENT_VERSION } from "./agent-version.js";
import { buildPrintJobBuffer } from "./jobs/build-print-buffer.js";
import { handlePrintBatch, handlePrintJob } from "./jobs/handle-print.js";
import { resolveJobPrintConfig } from "./jobs/resolve-label-config.js";
import { getPrintHostPlatform } from "./platform.js";
import {
  resolveLabelPrinterName,
  resolveReceiptPrinterName,
  resolvePrinterNameForJob,
  type PrintRequestOptions,
} from "./resolve-printer.js";
import {
  isPrintJob,
  parsePrintBatchRequest,
  parsePrintRequest,
  type PrintJob,
} from "./types.js";
import { isPrinterAvailable, listPrinters } from "./transport/index.js";

function setCorsHeaders(
  res: ServerResponse,
  config: PrintAgentConfig,
  origin: string | undefined,
  req?: IncomingMessage,
) {
  if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    // Required for Chrome when an HTTPS admin site calls http://127.0.0.1 (print POST).
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Access-Control-Request-Private-Network",
  );

  if (req?.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return null;

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw) as unknown;
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
  config: PrintAgentConfig,
  origin: string | undefined,
  req?: IncomingMessage,
) {
  setCorsHeaders(res, config, origin, req);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}


let recentPrinterChecks = new Map<
  string,
  { available: boolean; checkedAt: number }
>();
const PRINTER_CHECK_CACHE_TTL_MS = 60_000;

async function ensurePrinterAvailableCached(
  printerName: string,
): Promise<string | null> {
  const now = Date.now();
  const cached = recentPrinterChecks.get(printerName);
  if (cached && now - cached.checkedAt < PRINTER_CHECK_CACHE_TTL_MS) {
    return cached.available ? null : printerName;
  }

  const available = await isPrinterAvailable(printerName);
  recentPrinterChecks.set(printerName, { available, checkedAt: now });
  return available ? null : printerName;
}

async function ensurePrintersForJob(
  config: PrintAgentConfig,
  job: Parameters<typeof handlePrintJob>[1],
  options: PrintRequestOptions,
): Promise<string | null> {
  return ensurePrinterAvailableCached(resolvePrinterNameForJob(config, job, options));
}

async function ensurePrintersForBatch(
  config: PrintAgentConfig,
  jobs: Parameters<typeof handlePrintBatch>[1],
  options: PrintRequestOptions,
): Promise<string | null> {
  const names = new Set(
    jobs.map((job) => resolvePrinterNameForJob(config, job, options)),
  );

  for (const printerName of names) {
    const missing = await ensurePrinterAvailableCached(printerName);
    if (missing) return missing;
  }

  return null;
}

export function createPrintAgentServer(config: PrintAgentConfig) {
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    const url = new URL(req.url ?? "/", `http://${config.host}:${config.port}`);
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      setCorsHeaders(res, config, origin, req);
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      if (method === "GET" && url.pathname === "/v1/health") {
        const printers = await listPrinters();
        const labelPrinterName = resolveLabelPrinterName(config);
        const receiptPrinterName = resolveReceiptPrinterName(config);
        const labelPrinterConfigured =
          await isPrinterAvailable(labelPrinterName);
        const receiptPrinterConfigured =
          await isPrinterAvailable(receiptPrinterName);

        sendJson(
          res,
          200,
          {
            ok: true,
            platform: getPrintHostPlatform(),
            labelPrinterName,
            receiptPrinterName,
            labelPrinterConfigured,
            receiptPrinterConfigured,
            printerConfigured:
              labelPrinterConfigured || receiptPrinterConfigured,
            printerName: labelPrinterName,
            availablePrinters: printers,
            version: PRINT_AGENT_VERSION,
            agentVersion: PRINT_AGENT_VERSION,
            build: PRINT_AGENT_BUILD,
            features: {
              labelLayout: true,
              receiptBlocks: true,
            },
            capabilities: {
              labelLayout: true,
              receiptBlocks: true,
            },
          },
          config,
          origin,
          req,
        );
        return;
      }

      if (method === "GET" && url.pathname === "/v1/config") {
        const labelPrinterName = resolveLabelPrinterName(config);
        const receiptPrinterName = resolveReceiptPrinterName(config);

        sendJson(
          res,
          200,
          {
            host: config.host,
            port: config.port,
            usbPrinterName: config.usbPrinterName,
            labelPrinterName,
            receiptPrinterName,
            label: config.label,
            receipt: config.receipt,
            labelProtocol: config.labelProtocol ?? "tspl",
            labelRenderMode: config.labelRenderMode ?? "image",
            maxCopiesPerJob: config.maxCopiesPerJob ?? 500,
            maxBatchJobs: config.maxBatchJobs ?? 500,
          },
          config,
          origin,
          req,
        );
        return;
      }

      if (method === "POST" && url.pathname === "/v1/preview") {
        const body = await readJsonBody(req);

        let previewJob: PrintJob;
        if (isPrintJob(body)) {
          previewJob = body;
        } else {
          try {
            previewJob = parsePrintRequest(body).job;
          } catch {
            sendJson(
              res,
              400,
              { error: "Invalid print job payload." },
              config,
              origin,
              req,
            );
            return;
          }
        }

        const resolvedConfig = resolveJobPrintConfig(config, previewJob);
        const payload = await buildPrintJobBuffer(resolvedConfig, previewJob);

        sendJson(
          res,
          200,
          {
            ok: true,
            renderer: payload.renderer,
            bufferLength: payload.buffer.length,
            kind: payload.kind,
          },
          config,
          origin,
          req,
        );
        return;
      }

      if (method === "POST" && url.pathname === "/v1/print") {
        const body = await readJsonBody(req);

        let parsed;
        try {
          parsed = parsePrintRequest(body);
        } catch (error) {
          sendJson(
            res,
            400,
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Invalid print job payload.",
            },
            config,
            origin,
            req,
          );
          return;
        }

        const result = await handlePrintJob(config, parsed.job, parsed.options);
        sendJson(res, 200, result, config, origin, req);
        return;
      }

      if (method === "POST" && url.pathname === "/v1/print/batch") {
        const body = await readJsonBody(req);

        let parsed;
        try {
          parsed = parsePrintBatchRequest(body);
        } catch (error) {
          sendJson(
            res,
            400,
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Invalid batch print payload.",
            },
            config,
            origin,
            req,
          );
          return;
        }

        const missingPrinter = await ensurePrintersForBatch(
          config,
          parsed.jobs,
          parsed.options,
        );
        if (missingPrinter) {
          sendJson(
            res,
            503,
            {
              error: `Printer '${missingPrinter}' is not available on this PC.`,
            },
            config,
            origin,
            req,
          );
          return;
        }

        const result = await handlePrintBatch(
          config,
          parsed.jobs,
          parsed.options,
        );
        sendJson(res, 200, { ok: true, ...result }, config, origin, req);
        return;
      }

      sendJson(res, 404, { error: "Not found." }, config, origin, req);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected print agent error.";
      sendJson(res, 500, { error: message }, config, origin, req);
    }
  });
}
