import { HttpError } from "../errors.js";

/**
 * Parse a request value with Zod and expose only concise validation details.
 * @template T @param {import("zod").ZodType<T>} schema @param {unknown} value @returns {T}
 */
export function parseInput(schema, value) {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const detail = result.error.issues[0]?.message || "Invalid request";
  throw new HttpError(400, detail);
}
