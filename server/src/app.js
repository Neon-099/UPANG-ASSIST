const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const {
  rejectNoSqlKeys,
  sanitizeMongoInput
} = require("./middleware/noSqlSanitization");
const errorHandler = require("./middleware/errorHandler");
const taskRoutes = require("./routes/taskRoutes");
const authRoutes = require("./modules/auth/authRoutes");
const conversationRoutes = require("./modules/conversations/conversationRoutes");
const knowledgeRoutes = require("./routes/knowledgeRoutes");
const supportRoutes = require("./routes/supportRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);

// Trust only the configured number of reverse-proxy hops. Never enable blanket
// trust of X-Forwarded-For, which would let clients spoof the lockout IP.
if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) {
  app.set("trust proxy", trustedProxyHops);
}

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    exposedHeaders: ["X-Conversation-Id", "X-Auth-Expires-At"]
  })
);

app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.use(express.json({ limit: "20kb" }));
// Apply express-mongo-sanitize immediately after request body parsing. The
// compatibility wrapper also cleans Express 5's read-only query object.
app.use(sanitizeMongoInput);
app.use(cookieParser());

// Route params are populated only after Express matches a route, so sanitize
// them at parameter resolution time as well as sanitizing body/query globally.
app.param("id", (req, res, next) => {
  if (req.params && typeof req.params === "object") {
    const sanitizedParams = mongoSanitize.sanitize({ ...req.params });
    for (const key of Object.keys(req.params)) delete req.params[key];
    Object.assign(req.params, sanitizedParams);
  }
  return next();
});

// Reject malformed typed fields (for example email supplied as an object).
app.use(rejectNoSqlKeys);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/admin/knowledge", knowledgeRoutes);
app.use("/api/admin/users", userRoutes);
app.use(errorHandler);

module.exports = app;
