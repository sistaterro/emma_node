/**
 * Register the HTTP contract migrated from the reference FastAPI server.
 *
 * Route handlers intentionally contain no implementation yet.
 *
 * @param {import("fastify").FastifyInstance} app Fastify application.
 */
export default async function serverRoutes(app) {
  app.get("/favicon.ico", async function favicon() {});

}
