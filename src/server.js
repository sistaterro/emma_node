import { buildApp } from "./app.js";
import { config } from "./config.js";

const app = buildApp();

async function start() {
  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
