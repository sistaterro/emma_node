import { z } from "zod";

import { authenticateRequest, currentUser, requireDatabase } from "../auth/sessions.js";
import { changeConversationModel, createConversation, deleteConversation, getConversation, listConversations, renameConversation } from "../db/conversations.js";
import { parseInput } from "../http/validation.js";

const idSchema = z.string().trim().min(1).max(200);
const createSchema = z.object({ title: z.string().trim().min(1).max(200), model: z.string().trim().min(1).max(200) });
const titleSchema = z.object({ title: z.string().trim().min(1).max(200) });
const modelSchema = z.object({ model: z.string().trim().min(1).max(200) });

/** @param {import("fastify").FastifyInstance} app */
export default function conversationRoutes(app) {
  const authenticate = (/** @type {import("fastify").FastifyRequest} */ request) => authenticateRequest(app, request);
  const context = (/** @type {import("fastify").FastifyRequest} */ request) => ({ database: requireDatabase(app), user: currentUser(request) });
  const conversationId = (/** @type {import("fastify").FastifyRequest} */ request) => parseInput(idSchema, /** @type {{conv_id: string}} */ (request.params).conv_id);

  app.get("/conversations", { preHandler: authenticate }, async (request) => {
    const { database, user } = context(request);
    return { conversations: listConversations(database, user.id) };
  });
  app.post("/conversations", { preHandler: authenticate }, async (request) => {
    const { database, user } = context(request);
    return createConversation(database, user.id, parseInput(createSchema, request.body));
  });
  app.get("/conversations/:conv_id", { preHandler: authenticate }, async (request) => {
    const { database, user } = context(request);
    return getConversation(database, user.id, conversationId(request));
  });
  app.patch("/conversations/:conv_id/title", { preHandler: authenticate }, async (request) => {
    const { database, user } = context(request);
    const { title } = parseInput(titleSchema, request.body);
    return { status: "ok", updated_at: renameConversation(database, user.id, conversationId(request), title) };
  });
  app.patch("/conversations/:conv_id/model", { preHandler: authenticate }, async (request) => {
    const { database, user } = context(request);
    const { model } = parseInput(modelSchema, request.body);
    await app.emmaModels.resolveModel(model);
    return { status: "ok", updated_at: changeConversationModel(database, user.id, conversationId(request), model) };
  });
  app.delete("/conversations/:conv_id", { preHandler: authenticate }, async (request) => {
    const { database, user } = context(request);
    deleteConversation(database, user.id, conversationId(request));
    return { status: "ok" };
  });
}
