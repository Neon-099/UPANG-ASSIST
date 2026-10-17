const dns = require("node:dns");
const mongoose = require("mongoose");
const { requireEnvironmentVariable } = require("./environment");

function configureDnsServers() {
  const servers = (process.env.MONGODB_DNS_SERVERS || "")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length) {
    dns.setServers(servers);
    console.log(`MongoDB DNS servers configured: ${servers.join(", ")}`);
  }
}

function redactMongoCredentials(value) {
  return String(value).replace(
    /(mongodb(?:\+srv)?:\/\/[^:\s/@]+:)[^@\s]+@/gi,
    "$1[REDACTED]@"
  );
}

async function connectDatabase() {
  configureDnsServers();
  await mongoose.connect(requireEnvironmentVariable("MONGODB_URI"));
  console.log(`MongoDB connected to ${mongoose.connection.name}`);
  return mongoose.connection;
}

function logDatabaseConnectionError(error) {
  console.error(
    "MongoDB connection error:",
    error.name,
    redactMongoCredentials(error.message)
  );
  if (error.reason?.message) {
    console.error(
      "MongoDB connection details:",
      redactMongoCredentials(error.reason.message)
    );
  }
}

module.exports = { connectDatabase, logDatabaseConnectionError };
