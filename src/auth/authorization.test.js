import { describe, expect, it } from "vitest";

import { normalizeRole, requireAdmin, requireUploadAccess } from "./authorization.js";
import { bearerToken } from "./sessions.js";

describe("authorization policies", () => {
  it("normalizes supported role aliases and rejects unknown roles", () => {
    expect(normalizeRole("Read Only")).toBe("read_only");
    expect(normalizeRole("readonly")).toBe("read_only");
    expect(() => normalizeRole("owner")).toThrow("Invalid role");
  });

  it("enforces admin and upload permissions", () => {
    expect(() => requireAdmin({ role: "user" })).toThrow("Only admins");
    expect(() => requireAdmin({ role: "admin" })).not.toThrow();
    expect(() => requireUploadAccess({ role: "read_only" })).toThrow("cannot manage files");
  });

  it("accepts only strict bearer authorization values", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("Basic abc123")).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
});
