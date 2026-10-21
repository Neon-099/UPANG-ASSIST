const { Server } = require("socket.io");
const User = require("../models/User");
const SupportConversation = require("../models/SupportConversation");
const { verifyAccessToken } = require("../utils/jwt");
const { isAllowedSchoolEmail } = require("../utils/emailPolicy");

function readCookie(header, name) {
  const entry = (header || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return null; }
}

function isAllowedSocketOrigin(origin, configuredOrigin) {
  // Same-origin polling requests may omit Origin. Every socket still has to
  // pass the signed-in account check below before it can connect.
  if (!origin || origin === configuredOrigin) return true;
  if (process.env.NODE_ENV === "production") return false;

  // Local development commonly alternates between localhost and 127.0.0.1.
  try {
    const actual = new URL(origin);
    const configured = new URL(configuredOrigin);
    const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
    return localHosts.has(actual.hostname) && localHosts.has(configured.hostname) &&
      actual.protocol === configured.protocol && actual.port === configured.port;
  } catch {
    return false;
  }
}

function attachSupportSocket(httpServer) {
  const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, isAllowedSocketOrigin(origin, frontendOrigin)),
      credentials: true
    },
    allowRequest: (request, callback) => callback(null, isAllowedSocketOrigin(request.headers.origin, frontendOrigin))
  });

  io.use(async (socket, next) => {
    try {
      const cookieName = process.env.COOKIE_NAME || "upang_access_token";
      const token = readCookie(socket.request.headers.cookie, cookieName);
      if (!token) return next(new Error("Authentication required"));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select("_id name email emailVerifiedAt role status");
      const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
      if (!user || user.status !== "active" || !user.emailVerifiedAt || !isAllowedSchoolEmail(email) || email.split("@").at(-1) !== "phinmaed.com") {
        return next(new Error("Valid active school account required"));
      }
      socket.data.user = user;
      socket.data.expiresAt = payload.exp ? payload.exp * 1000 : null;
      next();
    } catch {
      next(new Error("Invalid or expired authentication"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.data.expiresAt) {
      const expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.expiresAt - Date.now()));
      socket.once("disconnect", () => clearTimeout(expiryTimer));
    }
    if (socket.data.user.role === "admin") socket.join("support:admins");

    socket.on("support:join", async ({ conversationId } = {}, acknowledge = () => {}) => {
      try {
        if (typeof conversationId !== "string" || !/^[a-f\d]{24}$/i.test(conversationId)) return acknowledge({ ok: false, error: "Invalid conversation ID" });
        const conversation = await SupportConversation.findById(conversationId).select("owner assignedTo status");
        if (!conversation) return acknowledge({ ok: false, error: "Conversation not found" });
        const user = socket.data.user;
        const isOwner = String(conversation.owner) === String(user._id);
        // Admins receive queue change notifications and load transcripts via REST.
        // Only the student owner joins the message room, preventing stale
        // memberships from leaking a chat after its assignment changes.
        const isAllowedAdmin = user.role === "admin" && conversation.assignedTo && String(conversation.assignedTo) === String(user._id);
        if (!isOwner && !isAllowedAdmin) return acknowledge({ ok: false, error: "Not authorized for this conversation" });
        await socket.join(`support:${conversationId}`);
        acknowledge({ ok: true });
      } catch { acknowledge({ ok: false, error: "Unable to join conversation" }); }
    });

    socket.on("support:leave", ({ conversationId } = {}) => {
      if (typeof conversationId === "string") socket.leave(`support:${conversationId}`);
    });
  });

  return io;
}

module.exports = attachSupportSocket;
