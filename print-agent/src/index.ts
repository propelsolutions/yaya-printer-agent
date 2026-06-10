import { loadConfig } from "./config.js";
import { createPrintAgentServer } from "./server.js";

const config = loadConfig();
const server = createPrintAgentServer(config);

server.listen(config.port, config.host, () => {
  console.log(
    `Yaya print agent listening on http://${config.host}:${config.port}`,
  );
  console.log(`Configured printer: ${config.usbPrinterName}`);
  console.log("Label layout renderer: enabled");
});
