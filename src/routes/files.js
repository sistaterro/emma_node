import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "node:path";
import { z } from "zod";
import { authenticateRequest, currentUser, requireDatabase } from "../auth/sessions.js";
import { requireUploadAccess } from "../auth/authorization.js";
import { deleteStoredFile, deleteStoredFiles, globalStorage, listStoredFiles, resolveDownload, sanitizeFilename, userStorage } from "../files/storage.js";
import { processRagFile } from "../rag/ingestion.js";
import { HttpError } from "../errors.js";
import { parseInput } from "../http/validation.js";
import { assessRagPromptInjection, persistSuspiciousRagAuditLog, saveSecurityToIndex } from "../rag-security.js";

const querySchema = z.object({ scope: z.enum(["global", "user"]).default("user"), owner_id: z.coerce.number().int().positive().optional() });
/** @param {import("fastify").FastifyInstance} app */
export default function fileRoutes(app) {
  const authenticate = (/** @type {import("fastify").FastifyRequest} */ request) => authenticateRequest(app, request);
  app.get("/files", { preHandler: authenticate }, async (request) => {
    const user = currentUser(request); const result = listStoredFiles(app.emmaConfig.globalFilesDir, app.emmaConfig.globalChunksDir, "global", null, null);
    if (user.role === "admin") { const rows = /** @type {Array<{id:number,username:string}>} */ (requireDatabase(app).prepare("SELECT id, username FROM users ORDER BY id").all()); for (const row of rows) { const paths = userStorage(app.emmaConfig, row.id); result.push(...listStoredFiles(paths.filesDir, paths.chunksDir, "user", row.id, row.username)); } }
    else { const paths = userStorage(app.emmaConfig, user.id); result.push(...listStoredFiles(paths.filesDir, paths.chunksDir, "user", user.id, user.username)); }
    return { files: result };
  });
  app.post("/upload", { preHandler: authenticate }, async (request) => {
    const user = currentUser(request); requireUploadAccess(user); const query = parseInput(querySchema, request.query); const storage = resolveStorage(app, user, query.scope, query.owner_id);
    const file = await request.file(); if (!file?.filename) throw new HttpError(400, "A file is required"); const safeName = sanitizeFilename(file.filename); const bytes = await file.toBuffer();
    mkdirSync(storage.filesDir, { recursive: true }); mkdirSync(storage.chunksDir, { recursive: true }); const path = `${storage.filesDir}\\${safeName}`; const duplicateName = (await import("node:fs")).existsSync(path); writeFileSync(path, bytes); const output = processRagFile(path, storage.chunksDir, query.scope, storage.ownerId);
    const models=await app.emmaModels.availableModels();let security={has_any:false,risk:"none",matches:[],status:"unavailable"};if(models[0]){const resolve=(/** @type {string} */ id)=>{const found=models.find(item=>item.id===id);if(!found)throw new HttpError(400,"Unsupported model");return found;};security=/** @type {any} */(await assessRagPromptInjection(bytes.toString("utf8"),safeName,models[0],()=>models,resolve,(model,messages)=>app.emmaGeneration.generate(model,messages)));saveSecurityToIndex(storage.filesDir,parse(safeName).name,security);persistSuspiciousRagAuditLog(app.emmaConfig.ragAuditDir,path,query.scope,storage.ownerId,security);}
    return { status: "ok", file: file.filename, stored_as: safeName, scope: query.scope, message: "File received and split into chunks.", duplicate_name: duplicateName, inconsistencies: [], security, chunks: output?.total ?? 0 };
  });
  app.delete("/files/:scope/:stem", { preHandler: authenticate }, async (request) => { const user = currentUser(request); requireUploadAccess(user); const params = /** @type {{scope:string,stem:string}} */ (request.params); const query = parseInput(z.object({ owner_id: z.coerce.number().int().positive().optional() }), request.query); const storage = resolveStorage(app, user, params.scope, query.owner_id); return { status: "ok", deleted: deleteStoredFile(storage.filesDir, storage.chunksDir, params.stem) }; });
  app.delete("/files/:scope", { preHandler: authenticate }, async (request) => { const user = currentUser(request); requireUploadAccess(user); const params = /** @type {{scope:string}} */ (request.params); const query = parseInput(z.object({ owner_id: z.coerce.number().int().positive().optional() }), request.query); const storage = resolveStorage(app, user, params.scope, query.owner_id); return { status: "ok", scope: params.scope, deleted_count: deleteStoredFiles(storage.filesDir, storage.chunksDir) }; });
  app.get("/files/:scope/:stem/download", { preHandler: authenticate }, async (request, reply) => { const user = currentUser(request); requireUploadAccess(user); const params = /** @type {{scope:string,stem:string}} */ (request.params); const query = parseInput(z.object({ owner_id: z.coerce.number().int().positive().optional() }), request.query); const storage = resolveStorage(app, user, params.scope, query.owner_id); const path = resolveDownload(storage.filesDir, params.stem); return reply.type("text/plain; charset=utf-8").header("content-disposition", `attachment; filename="${parse(path).base}"`).send(readFileSync(path)); });
}
/** @param {import("fastify").FastifyInstance} app @param {{id:number,role:string}} user @param {string} scope @param {number|undefined} ownerId */
function resolveStorage(app, user, scope, ownerId) { if (scope === "global") { if (user.role !== "admin") throw new HttpError(403, "Only admins can manage global files"); return globalStorage(app.emmaConfig); } if (scope !== "user") throw new HttpError(400, "Invalid scope"); if (ownerId !== undefined && user.role !== "admin" && ownerId !== user.id) throw new HttpError(403, "Cannot manage another user's files"); const target = user.role === "admin" && ownerId !== undefined ? ownerId : user.id; if (!requireDatabase(app).prepare("SELECT 1 FROM users WHERE id = ?").get(target)) throw new HttpError(404, "User not found"); return userStorage(app.emmaConfig, target); }
