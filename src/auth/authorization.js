import { HttpError } from "../errors.js";

/** @typedef {{role: string}} RoleUser */
export const VALID_ROLES = new Set(["admin", "user", "read_only"]);

/** @param {unknown} role Normalize and validate a user role string. */
export function normalizeRole(role) {
  let normalized = String(role || "").trim().toLowerCase().replace(/[- ]/g, "_");
  if (normalized === "readonly") normalized = "read_only";
  if (!VALID_ROLES.has(normalized)) throw new HttpError(400, "Invalid role");
  return normalized;
}

/** @param {RoleUser} user Reject a non-admin user. */
export function requireAdmin(user) {
  if (user.role !== "admin") throw new HttpError(403, "Only admins can perform this action");
}

/** @param {RoleUser} user Reject a read-only user from file management. */
export function requireUploadAccess(user) {
  if (user.role === "read_only") throw new HttpError(403, "Your user cannot manage files");
}
