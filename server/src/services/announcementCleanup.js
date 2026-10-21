const Announcement = require("../models/Announcement");
const NotificationReceipt = require("../models/NotificationReceipt");

const ARCHIVE_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

async function deleteExpiredArchivedAnnouncements(now = new Date()) {
  const cutoff = new Date(now.getTime() - ARCHIVE_RETENTION_MS);
  await Announcement.updateMany(
    { status: "archived", archivedAt: null },
    [{ $set: { archivedAt: { $ifNull: ["$updatedAt", now] } } }],
    { updatePipeline: true }
  );
  const expired = await Announcement.find({ status: "archived", archivedAt: { $lte: cutoff } }).select("_id").lean();
  if (!expired.length) return 0;

  const deletedIds = [];
  for (const { _id } of expired) {
    const deleted = await Announcement.findOneAndDelete({ _id, status: "archived", archivedAt: { $lte: cutoff } }).select("_id").lean();
    if (deleted) deletedIds.push(deleted._id);
  }
  if (deletedIds.length) await NotificationReceipt.deleteMany({ announcement: { $in: deletedIds } });
  return deletedIds.length;
}

module.exports = { ARCHIVE_RETENTION_MS, deleteExpiredArchivedAnnouncements };
