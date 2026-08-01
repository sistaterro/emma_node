import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, parse } from "node:path";

export const CHUNK_MIN_WORDS = 80;
export const CHUNK_MAX_CHARS = 4000;

/** @param {string} text */
export function normalizeDocumentText(text) { return text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); }
/** @param {string} text */
export function isQualityChunk(text) { const words = text.match(/[\p{L}\p{N}_]+/gu) ?? []; const alpha = [...text].filter((char) => /\p{L}/u.test(char)).length; return text.trim().length >= 80 && words.length >= 12 && alpha / Math.max(text.length, 1) >= 0.35; }
/** @param {string} text @param {number} [maxChars] */
export function splitLongChunk(text, maxChars = CHUNK_MAX_CHARS) { const parts = []; let rest = text.trim(); while (rest.length > maxChars) { let at = rest.lastIndexOf("\n", maxChars); if (at < maxChars / 2) at = rest.lastIndexOf(". ", maxChars); if (at < maxChars / 2) at = maxChars; parts.push(rest.slice(0, at).trim()); rest = rest.slice(at).trim(); } if (rest) parts.push(rest); return parts.filter(Boolean); }
/** @param {string} text @param {number} [minWords] */
export function chunkText(text, minWords = CHUNK_MIN_WORDS) { const chunks = []; let buffer = ""; for (const paragraph of normalizeDocumentText(text).split(/\n\s*\n/)) { if (!paragraph.trim()) continue; buffer = buffer ? `${buffer}\n\n${paragraph.trim()}` : paragraph.trim(); if ((buffer.match(/\S+/g) ?? []).length >= minWords) { chunks.push(...splitLongChunk(buffer).filter(isQualityChunk)); buffer = ""; } } if (buffer) chunks.push(...splitLongChunk(buffer).filter(isQualityChunk)); return chunks; }
/** @param {string} text @param {number} [maxChars] */
export function buildDocumentDescription(text, maxChars = 260) { const clean = normalizeDocumentText(text).replace(/\s+/g, " "); return clean.length <= maxChars ? clean : `${clean.slice(0, maxChars - 3).trimEnd()}...`; }

/** Synchronously derive JSON-only chunks; source existence is checked before every write. @param {string} txtPath @param {string} chunksDir @param {string} scope @param {number|null} ownerId */
export function processRagFile(txtPath, chunksDir, scope, ownerId) {
  if (!existsSync(txtPath)) return null;
  const text = readFileSync(txtPath, "utf8"); const stem = parse(txtPath).name; const chunks = chunkText(text);
  const output = { schema_version: 1, source: parse(txtPath).base, stem, scope, owner_id: ownerId, processed_at: new Date().toISOString(), chunking: { strategy: "paragraph_buffer", min_words: CHUNK_MIN_WORDS, max_chars: CHUNK_MAX_CHARS }, total: chunks.length, chunks: chunks.map((value, index) => ({ id: `${stem}:${String(index).padStart(4, "0")}`, index, source: parse(txtPath).base, scope, owner_id: ownerId, text: value })) };
  if (!existsSync(txtPath)) return null;
  writeFileSync(join(chunksDir, `${stem}.json`), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  if (!existsSync(txtPath)) return null;
  const indexPath = join(parse(txtPath).dir, "files_index.json"); const index = readJson(indexPath); index[stem] = buildDocumentDescription(text); writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return output;
}
/** @param {string} path */ function readJson(path) { try { const value = JSON.parse(readFileSync(path, "utf8")); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; } }
