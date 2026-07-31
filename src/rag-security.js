import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, parse } from "node:path";
import { randomBytes } from "node:crypto";

import { buildRagSecurityPrompt } from "./prompts.js";

/** @typedef {{has_any?: unknown, risk?: unknown, summary?: unknown, matches?: unknown, status?: unknown, checked_at?: unknown}} SecurityRecord */
/** @typedef {{signal: string, severity: "medium" | "high", excerpt: string}} SecurityMatch */
/** @typedef {Record<string, any>} ModelRecord */
/** @typedef {() => Array<ModelRecord & {id: string}>} AvailableModels */
/** @typedef {(id: string) => ModelRecord} ResolveModel */
/** @typedef {(model: ModelRecord, messages: Array<{role: string, content: string}>) => Promise<string>} GenerateAiReply */
/** @typedef {(error: unknown, context: Record<string, unknown>) => void} ExceptionLogger */

/**
 * Remove security-index entries whose source text files no longer exist.
 *
 * @param {string} baseDir
 * @returns {Record<string, SecurityRecord>}
 */
export function pruneSecurityIndexEntries(baseDir) {
  const indexPath = join(baseDir, "security_index.json");
  if (!existsSync(indexPath)) return {};

  /** @type {unknown} */
  let parsedIndex;
  try {
    parsedIndex = JSON.parse(readFileSync(indexPath, "utf8"));
  } catch {
    return {};
  }
  if (!isPlainObject(parsedIndex)) return {};

  const validStems = new Set(
    readdirSync(baseDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".txt")
      .map((entry) => parse(entry.name).name),
  );
  const cleaned = Object.fromEntries(Object.entries(parsedIndex).filter(([stem]) => validStems.has(stem)));
  if (Object.keys(cleaned).length !== Object.keys(parsedIndex).length) writeJson(indexPath, cleaned);
  return /** @type {Record<string, SecurityRecord>} */ (cleaned);
}

/**
 * Extract a JSON object from a model response when possible.
 *
 * @param {string} text
 * @returns {Record<string, unknown> | null}
 */
export function extractJsonObject(text) {
  if (!text) return null;
  const trimmed = text.trim();
  const candidates = [trimmed];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(trimmed.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (isPlainObject(parsed)) return parsed;
    } catch {
      // Try the next possible JSON object.
    }
  }
  return null;
}

/**
 * Normalize raw model output into Emma's persisted RAG security schema.
 *
 * @param {Record<string, unknown> | null} parsed
 * @param {string} [rawReply]
 */
export function normalizeRagSecurityAssessment(parsed, rawReply = "") {
  if (!isPlainObject(parsed)) {
    return {
      has_any: true,
      risk: "medium",
      matches: [{
        signal: "model_security_parse_error",
        severity: "medium",
        excerpt: (rawReply || "Model did not return valid JSON").slice(0, 500),
      }],
      status: "checked",
    };
  }

  const rawRisk = String(parsed.risk ?? "").trim().toLowerCase();
  let risk = ["none", "medium", "high"].includes(rawRisk) ? rawRisk : "medium";
  const rawMatches = Array.isArray(parsed.matches) ? parsed.matches : [];
  /** @type {SecurityMatch[]} */
  const matches = [];

  for (const item of rawMatches.slice(0, 10)) {
    if (!isPlainObject(item)) continue;
    let severity = String(item.severity ?? risk).trim().toLowerCase();
    if (!['medium', 'high'].includes(severity)) severity = risk === "medium" ? "medium" : "high";
    const signal = String(item.signal ?? "model_detected_prompt_injection").trim();
    const excerpt = String(item.excerpt ?? parsed.summary ?? signal).trim();
    matches.push({
      signal: signal.slice(0, 120) || "model_detected_prompt_injection",
      severity: /** @type {"medium" | "high"} */ (severity),
      excerpt: excerpt.slice(0, 500),
    });
  }

  const hasAny = Boolean(parsed.has_any) || risk === "medium" || risk === "high" || matches.length > 0;
  if (hasAny && risk === "none") risk = "medium";
  if (hasAny && matches.length === 0) {
    matches.push({
      signal: "model_detected_prompt_injection",
      severity: risk === "medium" ? "medium" : "high",
      excerpt: String(parsed.summary || "Model detected prompt-injection risk").slice(0, 500),
    });
  }
  if (!hasAny) return { has_any: false, risk: "none", matches: [], status: "checked" };
  return { has_any: true, risk, matches, status: "checked" };
}

/**
 * Choose the model used for RAG security checks.
 * @param {ModelRecord | null | undefined} model @param {AvailableModels} availableModels
 * @param {ResolveModel} resolveModel @returns {ModelRecord | null}
 */
export function resolveRagSecurityModel(model, availableModels, resolveModel) {
  if (isPlainObject(model)) return model;
  const models = availableModels();
  const firstModel = models[0];
  if (!firstModel) return null;
  return resolveModel(firstModel.id);
}

/**
 * Run model-based prompt-injection screening for a RAG document.
 * @param {string} text @param {string} fileName @param {ModelRecord | null | undefined} model
 * @param {AvailableModels} availableModels @param {ResolveModel} resolveModel @param {GenerateAiReply} generateAiReply
 */
export async function assessRagPromptInjection(
  text,
  fileName,
  model,
  availableModels,
  resolveModel,
  generateAiReply,
) {
  const securityModel = resolveRagSecurityModel(model, availableModels, resolveModel);
  if (securityModel === null) return { has_any: false, risk: "none", matches: [], status: "unavailable" };

  const prompt = buildRagSecurityPrompt(fileName, text || "");
  const reply = await generateAiReply(securityModel, [{ role: "user", content: prompt }]);
  return normalizeRagSecurityAssessment(extractJsonObject(reply), reply);
}

/** @param {string} baseDir @param {string} stem @param {SecurityRecord} assessment Persist a RAG security assessment. */
export function saveSecurityToIndex(baseDir, stem, assessment) {
  if (!existsSync(join(baseDir, `${stem}.txt`))) return;
  const indexPath = join(baseDir, "security_index.json");
  const index = pruneSecurityIndexEntries(baseDir);
  index[stem] = {
    has_any: Boolean(assessment.has_any),
    risk: assessment.risk || "none",
    matches: Array.isArray(assessment.matches) ? assessment.matches : [],
    status: "checked",
    checked_at: new Date().toISOString(),
  };
  writeJson(indexPath, index);
}

/** @param {SecurityRecord | null | undefined} record @param {string} [status] Return a frontend-safe security record. */
export function securityResponse(record, status = "unchecked") {
  if (!isPlainObject(record)) return { has_any: false, risk: "none", matches: [], status };
  const matches = Array.isArray(record.matches) ? record.matches : [];
  const response = {
    has_any: Boolean(record.has_any) && matches.length > 0,
    risk: record.risk || (matches.length ? "medium" : "none"),
    matches,
    status: record.status || status,
  };
  if (record.checked_at) return { ...response, checked_at: record.checked_at };
  return response;
}

/** @param {SecurityRecord | null | undefined} record Return whether a RAG must be excluded from chat. */
export function isHighRiskRagSecurity(record) {
  const security = securityResponse(record);
  return Boolean(security.has_any) && security.risk === "high";
}

/** @param {string} auditDir @param {number} [maxFiles] @param {number} [deleteCount] Rotate RAG audit logs. */
export function rotateRagAuditLogs(auditDir, maxFiles = 500, deleteCount = 50) {
  try {
    const files = existsSync(auditDir)
      ? readdirSync(auditDir)
          .filter((name) => extname(name).toLowerCase() === ".json")
          .map((name) => join(auditDir, name))
          .sort((left, right) => statSync(left).mtimeMs - statSync(right).mtimeMs)
      : [];
    if (files.length < maxFiles) return;
    for (const filePath of files.slice(0, deleteCount)) unlinkSync(filePath);
  } catch (error) {
    console.error(`[rag-audit] failed to rotate audit logs: ${errorMessage(error)}`);
  }
}

/**
 * Build a JSON-serializable suspicious RAG audit record.
 * @param {string} txtPath @param {string} scope @param {number | null} ownerId @param {SecurityRecord} assessment
 */
export function buildRagAuditRecord(txtPath, scope, ownerId, assessment) {
  return {
    timestamp: new Date().toISOString(),
    audit_type: "suspicious_rag",
    file: {
      name: basename(txtPath),
      stem: parse(txtPath).name,
      scope,
      owner_id: ownerId,
      path: txtPath,
    },
    security: securityResponse(assessment, "checked"),
  };
}

/**
 * Write an audit log for a suspicious RAG assessment.
 * @param {string} auditDir @param {string} txtPath @param {string} scope
 * @param {number | null} ownerId @param {SecurityRecord} assessment
 */
export function persistSuspiciousRagAuditLog(auditDir, txtPath, scope, ownerId, assessment) {
  if (!assessment.has_any) return;
  try {
    mkdirSync(auditDir, { recursive: true });
    rotateRagAuditLogs(auditDir);
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
    const safeStem = parse(txtPath).name.replace(/[^\p{L}\p{N}_.-]+/gu, "_").replace(/^_+|_+$/g, "") || "rag";
    const auditPath = join(auditDir, `suspicious_rag_${timestamp}_${safeStem}_${randomBytes(4).toString("hex")}.json`);
    writeJson(auditPath, buildRagAuditRecord(txtPath, scope, ownerId, assessment));
  } catch (error) {
    console.error(`[rag-audit] failed to persist audit log: ${errorMessage(error)}`);
  }
}

/**
 * Load or lazily create the security record for a RAG file.
 * @param {string} txtPath @param {string} scope @param {number | null} ownerId
 * @param {ModelRecord | null | undefined} model @param {string} auditDir
 * @param {AvailableModels} availableModels @param {ResolveModel} resolveModel
 * @param {GenerateAiReply} generateAiReply @param {ExceptionLogger | null} [exceptionLogger]
 */
export async function getOrCreateRagSecurityRecord(
  txtPath,
  scope,
  ownerId,
  model,
  auditDir,
  availableModels,
  resolveModel,
  generateAiReply,
  exceptionLogger = null,
) {
  const filesDir = dirname(txtPath);
  const security = pruneSecurityIndexEntries(filesDir);
  const existing = security[parse(txtPath).name];
  if (isPlainObject(existing)) return existing;
  if (!existsSync(txtPath)) return {};

  try {
    const assessment = await assessRagPromptInjection(
      readFileSync(txtPath, "utf8"),
      basename(txtPath),
      model,
      availableModels,
      resolveModel,
      generateAiReply,
    );
    saveSecurityToIndex(filesDir, parse(txtPath).name, assessment);
    persistSuspiciousRagAuditLog(auditDir, txtPath, scope, ownerId, assessment);
    return assessment;
  } catch (error) {
    exceptionLogger?.(error, {
      operation: "rag_security_assessment_for_chat",
      path: txtPath,
      scope,
      owner_id: ownerId,
    });
    return {};
  }
}

/**
 * Return whether a RAG file should be withheld from chat context.
 * @param {string} txtPath @param {string} scope @param {number | null} ownerId
 * @param {ModelRecord | null | undefined} model @param {string} auditDir
 * @param {AvailableModels} availableModels @param {ResolveModel} resolveModel
 * @param {GenerateAiReply} generateAiReply @param {ExceptionLogger | null} [exceptionLogger]
 */
export async function shouldExcludeRagFromChat(
  txtPath,
  scope,
  ownerId,
  model,
  auditDir,
  availableModels,
  resolveModel,
  generateAiReply,
  exceptionLogger = null,
) {
  const record = await getOrCreateRagSecurityRecord(
    txtPath,
    scope,
    ownerId,
    model,
    auditDir,
    availableModels,
    resolveModel,
    generateAiReply,
    exceptionLogger,
  );
  return isHighRiskRagSecurity(record);
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {string} filePath @param {unknown} value */
function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
