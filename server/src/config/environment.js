const path = require("node:path");
const dotenv = require("dotenv");

// Keep the backend's local environment file at server/.env. Variables already
// supplied by the hosting environment take precedence over values in that file.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
// Preserve support for the legacy server/src/.env location. The server/.env
// values remain preferred because dotenv does not overwrite existing values.
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function requireEnvironmentVariable(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured in server/.env`);
  }
  return value;
}

module.exports = { requireEnvironmentVariable };
