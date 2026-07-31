import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import serverRoutes from "./routes/server.js";
import { config as defaultConfig } from "./config.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import databasePlugin from "./plugins/database.js";
import { createModelCatalog } from "./models/catalog.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import { ensureRuntimeDirectories } from "./runtime.js";

const frontendRoot = fileURLToPath(new URL("../dist", import.meta.url));

/**
 * @param {import("fastify").FastifyServerOptions} [options]
 * @param {{config?: ReturnType<typeof import("./config.js").createConfig>, modelCatalog?: ReturnType<typeof import("./models/catalog.js").createModelCatalog>}} [dependencies]
 */
export function buildApp(options = {}, dependencies = {}) {
  const runtimeConfig = dependencies.config ?? defaultConfig;
  const modelCatalog = dependencies.modelCatalog ?? createModelCatalog(runtimeConfig);
  const app = Fastify({
    logger: true,
    ...options,
  });

  app.decorate("emmaConfig", runtimeConfig);
  app.decorate("emmaModels", modelCatalog);
  app.register(fastifyCors, { origin: true, methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"] });
  errorHandlerPlugin(app, { config: runtimeConfig });
  databasePlugin(app, { config: runtimeConfig });
  authRoutes(app);
  healthRoutes(app);
  app.register(serverRoutes);
  app.addHook("onReady", async () => ensureRuntimeDirectories(runtimeConfig));

  if (existsSync(frontendRoot)) {
    app.register(fastifyStatic, { root: frontendRoot });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && request.headers.accept?.includes("text/html")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ message: "Route not found" });
    });
  }

  return app;
}
