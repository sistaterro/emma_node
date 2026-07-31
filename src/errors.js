/** Error carrying an intentional public HTTP response. */
export class HttpError extends Error {
  /** @param {number} statusCode @param {string} detail @param {ErrorOptions} [options] */
  constructor(statusCode, detail, options) {
    super(detail, options);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.detail = detail;
  }
}
