/**
 * Register the HTTP contract migrated from the reference FastAPI server.
 *
 * Route handlers intentionally contain no implementation yet.
 *
 * @param {import("fastify").FastifyInstance} app Fastify application.
 */
export default async function serverRoutes(app) {
  app.get("/favicon.ico", async function favicon() {});

  app.post("/auth/login", async function login() {});
  app.post("/auth/logout", async function logout() {});
  app.get("/auth/me", async function me() {});
  app.post("/auth/change-password", async function changePassword() {});

  app.get("/admin/users", async function listUsers() {});
  app.post("/admin/users", async function createUser() {});
  app.patch("/admin/users/:target_user_id", async function updateUser() {});
  app.post("/admin/users/:target_user_id/reset-password", async function resetPassword() {});
  app.delete("/admin/users/:target_user_id", async function deleteUser() {});

  app.get("/health", async function health() {});

  app.get("/files", async function listFiles() {});
  app.post("/upload", async function uploadFile() {});
  app.delete("/files/:scope/:stem", async function deleteFile() {});
  app.delete("/files/:scope", async function deleteFiles() {});
  app.get("/files/:scope/:stem/download", async function downloadFile() {});

  app.get("/conversations", async function listConversations() {});
  app.post("/conversations", async function createConversation() {});
  app.get("/conversations/:conv_id", async function getConversation() {});
  app.patch("/conversations/:conv_id/title", async function updateConversationTitle() {});
  app.delete("/conversations/:conv_id", async function deleteConversation() {});

  app.post("/chat", async function chat() {});
}
