/**
 * Standard application error carrying an HTTP status code.
 * Throw this from controllers/services; the error middleware
 * turns it into a consistent { success:false, message } response.
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isApiError = true;
  }
}

module.exports = ApiError;
