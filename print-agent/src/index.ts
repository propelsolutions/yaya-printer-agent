import { loadConfig } from "./config.js";
import { createPrintAgentServer } from "./server.js";
import { resolveLabelPrinterName, resolveReceiptPrinterName } from "./resolve-printer.js";

const config = loadConfig();
const server = createPrintAgentServer(config);

server.listen(config.port, config.host, () => {
  console.log(
    `Yaya print agent listening on http://${config.host}:${config.port}`,
  );
  console.log(`Label printer: ${resolveLabelPrinterName(config)}`);
  console.log(`Receipt printer: ${resolveReceiptPrinterName(config)}`);
  console.log("Label layout renderer: enabled");
});
