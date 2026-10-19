const mongoose = require("mongoose");

const notificationReceiptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  announcement: { type: mongoose.Schema.Types.ObjectId, ref: "Announcement", required: true },
  readAt: { type: Date, default: null },
  dismissedAt: { type: Date, default: null }
}, { timestamps: true });

notificationReceiptSchema.index({ user: 1, announcement: 1 }, { unique: true });

module.exports = mongoose.model("NotificationReceipt", notificationReceiptSchema);
