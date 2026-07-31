import { openDatabase } from "../db/index.js";

/**
 * Attach one managed SQLite connection to the Fastify lifecycle.
 * @param {import("fastify").FastifyInstance} app
 * @param {{config: ReturnType<typeof import("../config.js").createConfig>}} options
 */
export default function databasePlugin(app, options) {
  app.decorate("emmaDb", null);
  app.decorateRequest("emmaToken", null);
  app.decorateRequest("emmaUser", null);
  app.addHook("onReady", async () => {
    app.emmaDb = openDatabase(options.config.databasePath);
  });
  app.addHook("onClose", async () => {
    if (app.emmaDb?.open) app.emmaDb.close();
    app.emmaDb = null;
  });
}
