/**
 * Register the health-check endpoint.
 *
 * @param {import("fastify").FastifyInstance} app Fastify application.
 */
export default async function healthRoutes(app) {
  app.get("/health", async () => ({
    status: "ok",
  }));
}
