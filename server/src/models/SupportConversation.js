const mongoose = require("mongoose");

const supportMessageSchema = new mongoose.Schema({
  clientMessageId: { type: String, required: true, trim: true, maxlength: 120 },
  sender: { type: String, enum: ["student", "assistant", "admin", "system"], required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  senderName: { type: String, trim: true, maxlength: 120, default: "" },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const supportConversationSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  ownerName: { type: String, required: true, trim: true, maxlength: 120 },
  ownerEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  question: { type: String, required: true, trim: true, maxlength: 2000 },
  status: {
    type: String,
    enum: ["waiting_for_support", "assigned", "live_chat", "resolved", "ended_by_student"],
    default: "waiting_for_support",
    index: true
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  messages: { type: [supportMessageSchema], default: [] },
  lastMessageAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

supportConversationSchema.index({ owner: 1, lastMessageAt: -1 });
supportConversationSchema.index({ status: 1, lastMessageAt: -1 });

module.exports = mongoose.model("SupportConversation", supportConversationSchema);
