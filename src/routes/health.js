import { authenticateRequest } from "../auth/sessions.js";

/** @param {import("fastify").FastifyInstance} app Register provider and model availability without exposing keys. */
export default function healthRoutes(app) {
  app.get("/health", { preHandler: (request) => authenticateRequest(app, request) }, async () => {
    const models = await app.emmaModels.availableModels();
    return {
      status: "ok",
      models,
      providers: [...new Set(models.map((model) => model.provider))].sort(),
      sources: [...new Set(models.map((model) => model.source || "external_apis"))].sort(),
      local_models: models.filter((model) => model.source === "local"),
      external_api_models: models.filter((model) => model.source === "external_apis"),
    };
  });
}
