const crypto = require('crypto');

// Unified admin API envelope (spec: data-api §3).
//
// Success: { success: true, data, meta: { requestId } }
// Failure: { success: false, error: { code, message, fields }, meta: { requestId } }
//
// Stable error codes; UI copy is localized from these codes, not from message.
const ERROR_CODES = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REVISION_CONFLICT: 409,
  REFERENCE_EXISTS: 409,
  UPLOAD_REJECTED: 400,
  OSS_CONNECTION_FAILED: 400,
  STORAGE_UPLOAD_FAILED: 502,
  PUBLISH_CHECK_FAILED: 422,
  PUBLISH_TRANSACTION_FAILED: 500,
  INTERNAL_ERROR: 500,
};

// Express middleware for the new admin APIs: assigns a request id and mounts
// res.ok / res.fail helpers. Legacy routes stay untouched.
function requestContext(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.ok = (data, status = 200) => {
    res.status(status).json({ success: true, data, meta: { requestId: req.requestId } });
  };
  res.fail = (code, message, fields = [], statusOverride) => {
    const status = statusOverride ?? ERROR_CODES[code] ?? 500;
    res.status(status).json({
      success: false,
      error: { code, message, fields },
      meta: { requestId: req.requestId },
    });
  };
  next();
}

module.exports = { requestContext, ERROR_CODES };
