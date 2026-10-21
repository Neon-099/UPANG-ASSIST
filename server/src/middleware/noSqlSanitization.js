const mongoSanitize = require("express-mongo-sanitize");

/**
 * Reject malformed typed fields and any prohibited keys left after sanitizing.
 * Walk arrays and nested objects so payloads cannot hide a prohibited key.
 */
function rejectNoSqlKeys(req, res, next) {
  const stringFields = new Set(["email", "username", "googleId"]);
  const hasInvalidKey = (value) => {
    if (Array.isArray(value)) return value.some(hasInvalidKey);
    if (!value || typeof value !== "object") return false;

    return Object.entries(value).some(([key, child]) => {
      if (key.startsWith("$") || key.includes(".")) return true;
      if (stringFields.has(key) && (typeof child !== "string")) return true;
      return hasInvalidKey(child);
    });
  };

  if ([req.body, req.query, req.params].some(hasInvalidKey)) {
    return res.status(400).json({ error: "Invalid payload format." });
  }
  return next();
}

// express-mongo-sanitize v2 assigns req.query, which is read-only in Express 5.
// Apply its sanitizer to each parsed object and install a sanitized own query
// property so downstream handlers see the cleaned query without that assignment.
function sanitizeMongoInput(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = mongoSanitize.sanitize(req.body);
  }
  if (req.params && typeof req.params === "object") {
    req.params = mongoSanitize.sanitize(req.params);
  }
  if (req.query && typeof req.query === "object") {
    const sanitizedQuery = mongoSanitize.sanitize({ ...req.query });
    Object.defineProperty(req, "query", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: sanitizedQuery
    });
  }
  return next();
}

module.exports = { rejectNoSqlKeys, sanitizeMongoInput };
