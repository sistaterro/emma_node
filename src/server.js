import { buildApp } from "./app.js";

const app = buildApp();
const port = Number.parseInt(process.env.PORT ?? "8650", 10);
const host = process.env.HOST ?? "127.0.0.1";

async function start() {
  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
