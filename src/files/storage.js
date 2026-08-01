import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, parse, resolve } from "node:path";
import { HttpError } from "../errors.js";
import { conflictsResponse, pruneOrphanedConflicts } from "../rag/inconsistencies.js";
import { pruneSecurityIndexEntries, securityResponse } from "../rag-security.js";

/** @param {ReturnType<typeof import("../config.js").createConfig>} config @param {number} userId */
export function userStorage(config, userId) { return { filesDir: join(config.filesRoot, `user_${userId}`), chunksDir: join(config.chunksRoot, `user_${userId}`), ownerId: userId }; }
/** @param {ReturnType<typeof import("../config.js").createConfig>} config */
export function globalStorage(config) { return { filesDir: config.globalFilesDir, chunksDir: config.globalChunksDir, ownerId: null }; }
/** @param {string} filename */
export function sanitizeFilename(filename) { const safe = basename(filename.trim()).replace(/[^\p{L}\p{N}_.-]/gu, "_").replace(/_+/g, "_").toLowerCase(); if (!safe.endsWith(".txt") || parse(safe).name.length === 0) throw new HttpError(400, "Only .txt files are accepted"); return safe; }
/** @param {string} stem */
export function sanitizeStem(stem) { const clean = stem.trim(); if (!clean || clean !== basename(clean) || !/^[\p{L}\p{N}_.-]+$/u.test(clean)) throw new HttpError(400, "Invalid file stem"); return clean; }
/** @param {string} filesDir @param {string} chunksDir @param {string} scope @param {number|null} ownerId @param {string|null} ownerUsername */
export function listStoredFiles(filesDir, chunksDir, scope, ownerId, ownerUsername) { mkdirSync(filesDir, { recursive: true }); mkdirSync(chunksDir, { recursive: true }); const descriptions = readIndex(join(filesDir, "files_index.json")); const conflicts=pruneOrphanedConflicts(filesDir);const security=pruneSecurityIndexEntries(filesDir); return readdirSync(filesDir).filter((name) => name.toLowerCase().endsWith(".txt")).sort().map((name) => { const stem = parse(name).name; const chunkPath = join(chunksDir, `${stem}.json`); const data = readIndex(chunkPath); return { name, stem, scope, owner_id: ownerId, owner_username: ownerUsername, indexed: existsSync(chunkPath), status: existsSync(chunkPath) ? "indexed" : "indexing", chunks: Number(data.total ?? 0), description: descriptions[stem] ?? "", inconsistencies: conflictsResponse(conflicts[stem],existsSync(chunkPath)?"unchecked":"unindexed"), security: securityResponse(security[stem],existsSync(chunkPath)?"unchecked":"unindexed") }; }); }
/** @param {string} filesDir @param {string} chunksDir @param {string} stem */
export function deleteStoredFile(filesDir, chunksDir, stem) { stem = sanitizeStem(stem); const deleted = []; for (const path of [join(filesDir, `${stem}.txt`), join(chunksDir, `${stem}.json`)]) if (existsSync(path)) { rmSync(path); deleted.push(basename(path)); } for (const name of ["files_index.json", "conflicts_index.json", "security_index.json"]) pruneIndex(join(filesDir, name), stem); pruneOrphanedConflicts(filesDir); if (!deleted.length) throw new HttpError(404, `File '${stem}' not found`); return deleted; }
/** @param {string} filesDir @param {string} chunksDir */
export function deleteStoredFiles(filesDir, chunksDir) { let count = 0; for (const item of listStoredFiles(filesDir, chunksDir, "", null, null)) count += deleteStoredFile(filesDir, chunksDir, item.stem).length; return count; }
/** @param {string} filesDir @param {string} stem */
export function resolveDownload(filesDir, stem) { const path = resolve(filesDir, `${sanitizeStem(stem)}.txt`); if (!path.startsWith(`${resolve(filesDir)}\\`) || !existsSync(path) || !statSync(path).isFile()) throw new HttpError(404, `File '${stem}' not found`); return path; }
/** @param {string} path */ export function readIndex(path) { try { const value = JSON.parse(readFileSync(path, "utf8")); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; } }
/** @param {string} path @param {string} stem */ function pruneIndex(path, stem) { if (!existsSync(path)) return; const index = readIndex(path); delete index[stem]; writeFileSync(path, `${JSON.stringify(index, null, 2)}\n`, "utf8"); }
