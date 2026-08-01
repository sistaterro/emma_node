/**
 * Register the HTTP contract migrated from the reference FastAPI server.
 *
 * @param {import("fastify").FastifyInstance} app Fastify application.
 */
export default async function serverRoutes(app) {
  app.get("/favicon.ico", async function favicon(_request, reply) {
    return reply.code(204).send();
  });

}
