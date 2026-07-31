import Fastify from "fastify";

import healthRoutes from "./routes/health.js";

export function buildApp(options = {}) {
  const app = Fastify({
    logger: true,
    ...options,
  });

  app.register(healthRoutes);

  return app;
}
