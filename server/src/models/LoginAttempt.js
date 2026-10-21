const mongoose = require("mongoose");

const loginAttemptSchema = new mongoose.Schema({
  // Store a keyed digest so the database never contains raw client IP addresses.
  ipHash: { type: String, required: true, unique: true },
  failures: { type: Number, required: true, default: 0 },
  blockedUntil: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true });

module.exports = mongoose.model("LoginAttempt", loginAttemptSchema);
