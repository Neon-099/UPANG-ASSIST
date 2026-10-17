const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const {
  rejectNoSqlKeys,
  sanitizeMongoInput
} = require("./middleware/noSqlSanitization");
const errorHandler = require("./middleware/errorHandler");
const taskRoutes = require("./routes/taskRoutes");
const authRoutes = require("./modules/auth/authRoutes");
const conversationRoutes = require("./modules/conversations/conversationRoutes");
const knowledgeRoutes = require("./routes/knowledgeRoutes");

const app = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

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

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.use(cookieParser());

// Reject prohibited keys before sanitizing the parsed payload.
app.use(rejectNoSqlKeys);
app.use(sanitizeMongoInput);

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
app.use("/api/admin/knowledge", knowledgeRoutes);
app.use(errorHandler);

module.exports = app;
