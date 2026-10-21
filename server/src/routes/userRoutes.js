const express = require("express");
const User = require("../models/User");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

router.get("/", async (req, res) => {
  const pageInput = typeof req.query.page === "string" && /^\d+$/.test(req.query.page) ? Number.parseInt(req.query.page, 10) : 1;
  const limitInput = typeof req.query.limit === "string" && /^\d+$/.test(req.query.limit) ? Number.parseInt(req.query.limit, 10) : 10;
  const page = Math.max(1, Math.min(100000, pageInput));
  const limit = Math.max(1, Math.min(50, limitInput));
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const role = typeof req.query.role === "string" && ["student", "admin"].includes(req.query.role) ? req.query.role : "all";
  const status = typeof req.query.status === "string" && ["active", "inactive"].includes(req.query.status) ? req.query.status : "all";
  const filter = {};
  if (role !== "all") filter.role = role;
  if (status === "active") filter.status = "active";
  if (status === "inactive") filter.status = { $ne: "active" };
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
      { course: { $regex: escaped, $options: "i" } }
    ];
  }
  try {
    const [total, users, roleCounts, activeCount] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select("name email course role status authProvider lastLoginAt createdAt").sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      User.countDocuments({ status: "active" })
    ]);
    const countMap = (rows) => Object.fromEntries(rows.map(({ _id, count }) => [_id, count]));
    const allTotal = await User.countDocuments();
    const roles = countMap(roleCounts);
    const normalizedUsers = users.map((user) => ({ ...user, status: user.status === "active" ? "active" : "inactive" }));
    return res.json({ users: normalizedUsers, pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }, counts: { total: allTotal, roles, statuses: { active: activeCount, inactive: allTotal - activeCount } } });
  } catch {
    return res.status(500).json({ error: "Unable to load user accounts" });
  }
});

router.patch("/:id", async (req, res) => {
  const mongoose = require("mongoose");
  if (typeof req.params.id !== "string" || !mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid user ID" });
  const updates = {};
  if (req.body?.role !== undefined) {
    if (typeof req.body.role !== "string" || !["student", "admin"].includes(req.body.role)) return res.status(400).json({ error: "Choose a valid role" });
    updates.role = req.body.role;
  }
  if (req.body?.status !== undefined) {
    if (typeof req.body.status !== "string" || !["active", "inactive"].includes(req.body.status)) return res.status(400).json({ error: "Choose a valid account status" });
    updates.status = req.body.status;
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: "Provide a role or status to update" });
  if (String(req.params.id) === String(req.user._id) && (updates.role === "student" || updates.status === "inactive")) {
    return res.status(400).json({ error: "You cannot remove your own administrator access" });
  }
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const removesActiveAdmin = user.role === "admin" && user.status === "active"
      && (updates.role === "student" || (updates.status && updates.status !== "active"));
    if (removesActiveAdmin && await User.countDocuments({ role: "admin", status: "active" }) <= 1) {
      return res.status(400).json({ error: "The last active administrator cannot be removed" });
    }
    Object.assign(user, updates);
    await user.save();
    return res.json({ user: { _id: user._id, name: user.name, email: user.email, course: user.course, role: user.role, status: user.status, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt } });
  } catch {
    return res.status(500).json({ error: "Unable to update user account" });
  }
});

module.exports = router;
