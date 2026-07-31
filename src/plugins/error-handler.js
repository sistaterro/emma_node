import { HttpError } from "../errors.js";
import { persistExceptionLog } from "../logging/exception-log.js";

/**
 * Register consistent HTTP errors, exception auditing, and HTML cache policy.
 * @param {import("fastify").FastifyInstance} app
 * @param {{config: ReturnType<typeof import("../config.js").createConfig>}} options
 */
export default function errorHandlerPlugin(app, options) {
  const { config } = options;

  app.addHook("onSend", async (request, reply, payload) => {
    if (request.headers.accept?.includes("text/html")) reply.header("Cache-Control", "no-store");
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ detail: error.detail });
    }

    const reportedError = error instanceof Error ? error : new Error(String(error));
    const errorWithStatus = /** @type {Error & {statusCode?: number}} */ (reportedError);
    const statusCode = typeof errorWithStatus.statusCode === "number" && errorWithStatus.statusCode < 500
      ? errorWithStatus.statusCode
      : 500;
    if (statusCode >= 500) {
      persistExceptionLog(config.exceptionLogDir, reportedError, {
        source: "http",
        method: request.method,
        url: request.url,
        path: request.routeOptions?.url,
        client: request.ip,
      });
      request.log.error({ err: reportedError }, "Unhandled HTTP exception");
    }
    const detail = statusCode >= 500 ? "Internal server error" : reportedError.message;
    return reply.code(statusCode).send({ detail });
  });
}
