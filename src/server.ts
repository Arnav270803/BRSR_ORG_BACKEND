import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.API_PORT, "0.0.0.0", () => {
  console.log(`BRSR backend listening on port ${env.API_PORT}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}. Closing HTTP server.`);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
