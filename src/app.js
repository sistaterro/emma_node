import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import healthRoutes from "./routes/health.js";

const frontendRoot = fileURLToPath(new URL("../dist", import.meta.url));

export function buildApp(options = {}) {
  const app = Fastify({
    logger: true,
    ...options,
  });

  app.register(healthRoutes);

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
