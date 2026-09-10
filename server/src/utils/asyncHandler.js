/**
 * Wraps an async Express route handler so that any thrown error
 * (or rejected promise) is forwarded to next(), letting the
 * centralized error handler middleware deal with it.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
