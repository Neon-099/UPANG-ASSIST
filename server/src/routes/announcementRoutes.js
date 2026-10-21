const express = require("express");
const mongoose = require("mongoose");
const Announcement = require("../models/Announcement");
const NotificationReceipt = require("../models/NotificationReceipt");
const { deleteExpiredArchivedAnnouncements } = require("../services/announcementCleanup");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("admin")];
const studentOnly = [requireAuth, requireRole("student")];
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
const categories = new Set(["campus", "academic", "urgent", "events"]);
const statuses = new Set(["draft", "published", "archived"]);

function parseAnnouncement(body = {}, current = {}) {
  const title = typeof body.title === "string" ? body.title.trim() : current.title || "";
  const message = typeof body.message === "string" ? body.message.trim() : current.message || "";
  const category = body.category === undefined ? (current.category || "campus") : body.category;
  const link = body.link === undefined ? (current.link || "") : (typeof body.link === "string" ? body.link.trim() : null);
  const status = body.status === undefined ? (current.status || "draft") : body.status;
  const rawExpiry = body.expiresAt === undefined ? current.expiresAt : body.expiresAt;
  const expiresAt = rawExpiry ? new Date(rawExpiry) : null;
  if (!title || title.length > TITLE_MAX_LENGTH) return { error: `Title is required and must be at most ${TITLE_MAX_LENGTH} characters` };
  if (!message || message.length > DESCRIPTION_MAX_LENGTH) return { error: `Description is required and must be at most ${DESCRIPTION_MAX_LENGTH} characters` };
  if (!categories.has(category)) return { error: "Choose a valid announcement category" };
  if (link === null || link.length > 500 || (link && !/^https:\/\//i.test(link) && (!link.startsWith("/") || link.startsWith("//")))) return { error: "Link must be a relative path or an HTTPS URL" };
  if (!statuses.has(status)) return { error: "Choose a valid announcement status" };
  if (rawExpiry && Number.isNaN(expiresAt.getTime())) return { error: "Expiry date is invalid" };
  return { announcement: { title, message, category, link, status, expiresAt } };
}

router.get("/admin", ...adminOnly, async (_req, res) => {
  try {
    await deleteExpiredArchivedAnnouncements();
    const announcements = await Announcement.find().populate("author", "name email").sort({ updatedAt: -1 }).lean();
    return res.json({ announcements });
  } catch { return res.status(500).json({ error: "Unable to load announcements" }); }
});

router.post("/admin", ...adminOnly, async (req, res) => {
  const { announcement, error } = parseAnnouncement(req.body);
  if (error) return res.status(400).json({ error });
  try {
    if (announcement.status === "published") announcement.publishedAt = new Date();
    if (announcement.status === "archived") announcement.archivedAt = new Date();
    const created = await Announcement.create({ ...announcement, author: req.user._id });
    return res.status(201).json({ announcement: created });
  } catch { return res.status(500).json({ error: "Unable to save announcement" }); }
});

router.patch("/admin/:id", ...adminOnly, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid announcement ID" });
  try {
    const existing = await Announcement.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Announcement not found" });
    const { announcement, error } = parseAnnouncement(req.body, existing);
    if (error) return res.status(400).json({ error });
    if (existing.status === "archived" && announcement.status !== "archived") {
      return res.status(409).json({ error: "Archived announcements cannot be published again" });
    }
    if (existing.status === "published" && announcement.status === "draft") {
      return res.status(409).json({ error: "Published announcements can only be archived" });
    }
    if (existing.status !== "archived" && announcement.status === "archived") existing.archivedAt = new Date();
    if (announcement.status === "published" && existing.status !== "published") announcement.publishedAt = new Date();
    else announcement.publishedAt = existing.publishedAt;
    Object.assign(existing, announcement);
    await existing.save();
    return res.json({ announcement: existing });
  } catch { return res.status(500).json({ error: "Unable to update announcement" }); }
});

router.post("/admin/:id/restore", ...adminOnly, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid announcement ID" });
  try {
    await deleteExpiredArchivedAnnouncements();
    const announcement = await Announcement.findOneAndUpdate(
      { _id: req.params.id, status: "archived" },
      { $set: { status: "draft", archivedAt: null, publishedAt: null } },
      { new: true, runValidators: true }
    );
    if (!announcement) return res.status(404).json({ error: "Archived announcement not found or its 3-day restore period has ended" });
    return res.json({ announcement });
  } catch { return res.status(500).json({ error: "Unable to restore announcement" }); }
});

router.post("/admin/bulk-archive", ...adminOnly, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids)] : [];
  if (!ids.length || ids.length > 500 || ids.some((id) => !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ error: "Provide between 1 and 500 valid announcement IDs" });
  }
  try {
    const result = await Announcement.updateMany(
      { _id: { $in: ids }, status: { $ne: "archived" } },
      { $set: { status: "archived", archivedAt: new Date() } },
      { runValidators: true }
    );
    return res.json({ archivedCount: result.modifiedCount, unchangedCount: ids.length - result.modifiedCount });
  } catch {
    return res.status(500).json({ error: "Unable to archive selected announcements" });
  }
});

router.delete("/admin/bulk", ...adminOnly, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids)] : [];
  if (!ids.length || ids.length > 500 || ids.some((id) => !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ error: "Provide between 1 and 500 valid announcement IDs" });
  }
  try {
    const deleted = await Announcement.deleteMany({ _id: { $in: ids } });
    await NotificationReceipt.deleteMany({ announcement: { $in: ids } });
    return res.json({ deletedCount: deleted.deletedCount });
  } catch { return res.status(500).json({ error: "Unable to delete announcements" }); }
});

router.get("/", ...studentOnly, async (req, res) => {
  try {
    const now = new Date();
    const announcements = await Announcement.find({ status: "published", publishedAt: { $lte: now }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] })
      .sort({ publishedAt: -1 }).limit(100).lean();
    const receipts = await NotificationReceipt.find({ user: req.user._id, announcement: { $in: announcements.map((item) => item._id) } }).lean();
    const byAnnouncement = new Map(receipts.map((receipt) => [String(receipt.announcement), receipt]));
    const items = announcements.map((announcement) => {
      const receipt = byAnnouncement.get(String(announcement._id));
      return { ...announcement, unread: !receipt?.readAt, dismissed: Boolean(receipt?.dismissedAt) };
    }).filter((item) => !item.dismissed);
    return res.json({ notifications: items, unreadCount: items.filter((item) => item.unread).length });
  } catch { return res.status(500).json({ error: "Unable to load notifications" }); }
});

async function updateReceipts(req, res, kind, all = false) {
  const now = new Date();
  let ids;
  if (all) {
    const announcements = await Announcement.find({ status: "published", publishedAt: { $lte: now }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).select("_id").lean();
    ids = announcements.map(({ _id }) => _id);
  } else {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid announcement ID" });
    const announcement = await Announcement.findOne({ _id: req.params.id, status: "published" }).select("_id");
    if (!announcement) return res.status(404).json({ error: "Announcement not found" });
    ids = [announcement._id];
  }
  if (ids.length) {
    const field = kind === "read" ? "readAt" : "dismissedAt";
    await NotificationReceipt.bulkWrite(ids.map((announcement) => ({
      updateOne: {
        filter: { user: req.user._id, announcement },
        update: { $set: { [field]: now }, $setOnInsert: { user: req.user._id, announcement } },
        upsert: true
      }
    })));
  }
  return res.json({ success: true });
}

router.patch("/:id/read", ...studentOnly, (req, res) => updateReceipts(req, res, "read"));
router.patch("/:id/dismiss", ...studentOnly, (req, res) => updateReceipts(req, res, "dismiss"));
router.post("/read-all", ...studentOnly, (req, res) => updateReceipts(req, res, "read", true));
router.post("/dismiss-all", ...studentOnly, (req, res) => updateReceipts(req, res, "dismiss", true));

module.exports = router;
