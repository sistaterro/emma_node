import type Database from "better-sqlite3";

declare module "fastify" {
  interface FastifyInstance {
    emmaConfig: ReturnType<typeof import("../config.js").createConfig>;
    emmaDb: Database.Database | null;
  }
}
