const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  category: { type: String, enum: ["campus", "academic", "urgent", "events"], default: "campus", index: true },
  link: { type: String, trim: true, maxlength: 500, default: "" },
  status: { type: String, enum: ["draft", "published", "archived"], default: "draft", index: true },
  publishedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null, index: true },
  expiresAt: { type: Date, default: null },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

announcementSchema.index({ status: 1, publishedAt: -1, expiresAt: 1 });

module.exports = mongoose.model("Announcement", announcementSchema);
