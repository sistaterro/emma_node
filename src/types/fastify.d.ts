import type Database from "better-sqlite3";

declare module "fastify" {
  interface FastifyRequest {
    emmaToken: string | null;
    emmaUser: {
      id: number;
      username: string;
      full_name: string;
      role: string;
      must_change_password: boolean;
    } | null;
  }

  interface FastifyInstance {
    emmaConfig: ReturnType<typeof import("../config.js").createConfig>;
    emmaDb: Database.Database | null;
    emmaModels: ReturnType<typeof import("../models/catalog.js").createModelCatalog>;
  }
}
