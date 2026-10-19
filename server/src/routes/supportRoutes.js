const express = require("express");
const mongoose = require("mongoose");
const SupportConversation = require("../models/SupportConversation");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("admin")];

function validText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function addMessage(conversation, message) {
  conversation.messages.push(message);
  conversation.lastMessageAt = message.createdAt || new Date();
}

function validateConversationId(req, res) {
  if (mongoose.isValidObjectId(req.params.id)) return true;
  res.status(400).json({ error: "Invalid support conversation ID" });
  return false;
}

async function findStudentConversation(req, res) {
  const conversation = await SupportConversation.findOne({ _id: req.params.id, owner: req.user._id });
  if (!conversation) res.status(404).json({ error: "Support conversation not found" });
  return conversation;
}

async function findAdminConversation(req, res) {
  const conversation = await SupportConversation.findById(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Support conversation not found" });
    return null;
  }
  if (conversation.assignedTo && String(conversation.assignedTo) !== String(req.user._id)) {
    res.status(409).json({ error: "This conversation is assigned to another administrator" });
    return null;
  }
  return conversation;
}

router.post("/", requireAuth, async (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (!question || question.length > 2000) {
    return res.status(400).json({ error: "Question must be 1 to 2000 characters" });
  }
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-40) : [];
  if (history.some((message) => !message || !["user", "assistant"].includes(message.sender) || !validText(message.text, 2000))) {
    return res.status(400).json({ error: "Support history contains an invalid message" });
  }

  try {
    const conversation = new SupportConversation({
      owner: req.user._id,
      ownerName: req.user.name || req.user.email,
      ownerEmail: req.user.email,
      question,
      messages: history.map((message, index) => ({
        clientMessageId: typeof message.id === "string" && message.id.trim() ? message.id.trim().slice(0, 120) : `history-${index}-${Date.now()}`,
        sender: message.sender === "user" ? "student" : "assistant",
        senderId: message.sender === "user" ? req.user._id : null,
        senderName: message.sender === "user" ? (req.user.name || "Student") : "UPangAssist",
        text: message.text.trim()
      }))
    });
    await conversation.save();
    return res.status(201).json({
      conversation,
      administratorAvailable: false,
      message: "Your inquiry has been sent. A support administrator will reply here when available."
    });
  } catch (error) {
    console.error("Support request creation failed:", error.message);
    return res.status(500).json({ error: "Unable to submit your support request" });
  }
});

router.get("/mine", requireAuth, async (req, res) => {
  try {
    const conversation = await SupportConversation.findOne({ owner: req.user._id }).sort({ lastMessageAt: -1 });
    return res.json({ conversation });
  } catch (error) {
    console.error("Support conversation lookup failed:", error.message);
    return res.status(500).json({ error: "Unable to retrieve your support conversation" });
  }
});

router.get("/", ...adminOnly, async (req, res) => {
  try {
    const conversations = await SupportConversation.find().sort({ lastMessageAt: -1 }).limit(200).lean();
    return res.json({ conversations });
  } catch (error) {
    console.error("Admin support queue lookup failed:", error.message);
    return res.status(500).json({ error: "Unable to retrieve support conversations" });
  }
});

router.post("/:id/messages", requireAuth, async (req, res) => {
  if (!validateConversationId(req, res)) return;
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const clientMessageId = typeof req.body?.clientMessageId === "string" ? req.body.clientMessageId.trim() : "";
  if (!validText(text, 2000) || !validText(clientMessageId, 120)) {
    return res.status(400).json({ error: "Message and client message ID are required" });
  }
  try {
    const conversation = await findStudentConversation(req, res);
    if (!conversation) return;
    if (["resolved", "ended_by_student"].includes(conversation.status)) {
      return res.status(409).json({ error: "Reopen this support conversation before sending a message" });
    }
    if (conversation.messages.some((message) => message.clientMessageId === clientMessageId)) {
      return res.json({ conversation });
    }
    addMessage(conversation, {
      clientMessageId,
      sender: "student",
      senderId: req.user._id,
      senderName: req.user.name || "Student",
      text
    });
    await conversation.save();
    return res.json({ conversation });
  } catch (error) {
    console.error("Student support message failed:", error.message);
    return res.status(500).json({ error: "Unable to send support message" });
  }
});

router.post("/:id/end", requireAuth, async (req, res) => {
  if (!validateConversationId(req, res)) return;
  try {
    const conversation = await findStudentConversation(req, res);
    if (!conversation) return;
    if (!conversation.status.startsWith("ended") && conversation.status !== "resolved") {
      conversation.status = "ended_by_student";
      conversation.lastMessageAt = new Date();
      await conversation.save();
    }
    return res.json({ conversation });
  } catch (error) {
    console.error("Student support conversation end failed:", error.message);
    return res.status(500).json({ error: "Unable to end support conversation" });
  }
});

router.post("/:id/accept", ...adminOnly, async (req, res) => {
  if (!validateConversationId(req, res)) return;
  try {
    const conversation = await SupportConversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: "Support conversation not found" });
    if (["resolved", "ended_by_student"].includes(conversation.status)) {
      return res.status(409).json({ error: "This conversation is already closed" });
    }
    if (conversation.assignedTo && String(conversation.assignedTo) !== String(req.user._id)) {
      return res.status(409).json({ error: "This conversation is already assigned to another administrator" });
    }
    conversation.assignedTo = req.user._id;
    conversation.status = "assigned";
    await conversation.save();
    return res.json({ conversation });
  } catch (error) {
    console.error("Admin support acceptance failed:", error.message);
    return res.status(500).json({ error: "Unable to accept support conversation" });
  }
});

router.post("/:id/reply", ...adminOnly, async (req, res) => {
  if (!validateConversationId(req, res)) return;
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const clientMessageId = typeof req.body?.clientMessageId === "string" ? req.body.clientMessageId.trim() : "";
  if (!validText(text, 2000) || !validText(clientMessageId, 120)) {
    return res.status(400).json({ error: "Reply and client message ID are required" });
  }
  try {
    const conversation = await findAdminConversation(req, res);
    if (!conversation) return;
    if (conversation.status === "waiting_for_support") return res.status(409).json({ error: "Accept this conversation before replying" });
    if (["resolved", "ended_by_student"].includes(conversation.status)) return res.status(409).json({ error: "This conversation is closed" });
    if (conversation.messages.some((message) => message.clientMessageId === clientMessageId)) return res.json({ conversation });
    addMessage(conversation, {
      clientMessageId,
      sender: "admin",
      senderId: req.user._id,
      senderName: req.user.name || "Support administrator",
      text
    });
    conversation.status = "live_chat";
    await conversation.save();
    return res.json({ conversation });
  } catch (error) {
    console.error("Admin support reply failed:", error.message);
    return res.status(500).json({ error: "Unable to send support reply" });
  }
});

router.post("/:id/resolve", ...adminOnly, async (req, res) => {
  if (!validateConversationId(req, res)) return;
  try {
    const conversation = await findAdminConversation(req, res);
    if (!conversation) return;
    conversation.status = "resolved";
    conversation.lastMessageAt = new Date();
    await conversation.save();
    return res.json({ conversation });
  } catch (error) {
    console.error("Admin support resolution failed:", error.message);
    return res.status(500).json({ error: "Unable to resolve support conversation" });
  }
});

module.exports = router;
