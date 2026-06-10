import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { PrintAgentConfig } from "./config.js";
import { buildPrintJobBuffer } from "./jobs/build-print-buffer.js";
import { handlePrintBatch, handlePrintJob } from "./jobs/handle-print.js";
import { resolveJobPrintConfig } from "./jobs/resolve-label-config.js";
import { isPrintBatchRequest, isPrintJob } from "./types.js";
import { isPrinterAvailable, listWindowsPrinters } from "./transport/usb-raw.js";

function setCorsHeaders(
  res: ServerResponse,
  config: PrintAgentConfig,
  origin: string | undefined,
) {
  if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
) {
  setCorsHeaders(res, config, origin);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function createPrintAgentServer(config: PrintAgentConfig) {
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    const url = new URL(req.url ?? "/", `http://${config.host}:${config.port}`);
    const method = req.method ?? "GET";

    if (method === "OPTIONS") {
      setCorsHeaders(res, config, origin);
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      if (method === "GET" && url.pathname === "/v1/health") {
        const printers = await listWindowsPrinters();
        const printerConfigured = await isPrinterAvailable(config.usbPrinterName);

        sendJson(
          res,
          200,
          {
            ok: true,
            printerConfigured,
            printerName: config.usbPrinterName,
            availablePrinters: printers,
          },
          config,
          origin,
        );
        return;
      }

      if (method === "GET" && url.pathname === "/v1/config") {
        sendJson(
          res,
          200,
          {
            host: config.host,
            port: config.port,
            usbPrinterName: config.usbPrinterName,
            label: config.label,
            receipt: config.receipt,
            labelProtocol: config.labelProtocol ?? "tspl",
            labelRenderMode: config.labelRenderMode ?? "image",
            maxCopiesPerJob: config.maxCopiesPerJob ?? 500,
            maxBatchJobs: config.maxBatchJobs ?? 500,
          },
          config,
          origin,
        );
        return;
      }

      if (method === "POST" && url.pathname === "/v1/preview") {
        const body = await readJsonBody(req);

        if (!isPrintJob(body)) {
          sendJson(
            res,
            400,
            { error: "Invalid print job payload." },
            config,
            origin,
          );
          return;
        }

        const resolvedConfig = resolveJobPrintConfig(config, body);
        const payload = await buildPrintJobBuffer(resolvedConfig, body);

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
        );
        return;
      }

      if (method === "POST" && url.pathname === "/v1/print") {
        const body = await readJsonBody(req);

        if (!isPrintJob(body)) {
          sendJson(
            res,
            400,
            { error: "Invalid print job payload." },
            config,
            origin,
          );
          return;
        }

        const printerConfigured = await isPrinterAvailable(config.usbPrinterName);
        if (!printerConfigured) {
          sendJson(
            res,
            503,
            {
              error: `Printer '${config.usbPrinterName}' is not available on this PC.`,
            },
            config,
            origin,
          );
          return;
        }

        const result = await handlePrintJob(config, body);
        sendJson(res, 200, result, config, origin);
        return;
      }

      if (method === "POST" && url.pathname === "/v1/print/batch") {
        const body = await readJsonBody(req);

        if (!isPrintBatchRequest(body)) {
          sendJson(
            res,
            400,
            { error: "Invalid batch print payload." },
            config,
            origin,
          );
          return;
        }

        const printerConfigured = await isPrinterAvailable(config.usbPrinterName);
        if (!printerConfigured) {
          sendJson(
            res,
            503,
            {
              error: `Printer '${config.usbPrinterName}' is not available on this PC.`,
            },
            config,
            origin,
          );
          return;
        }

        const result = await handlePrintBatch(config, body.jobs);
        sendJson(res, 200, { ok: true, ...result }, config, origin);
        return;
      }

      sendJson(res, 404, { error: "Not found." }, config, origin);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected print agent error.";
      sendJson(res, 500, { error: message }, config, origin);
    }
  });
}
