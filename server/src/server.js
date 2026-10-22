require("./config/environment");

const mongoose = require("mongoose");
const http = require("node:http");
const rateLimit = require("express-rate-limit");
const app = require("./app");
const attachSupportSocket = require("./services/supportSocket");
const { optionalAuth } = require("./middleware/authMiddleware");
const { connectDatabase, logDatabaseConnectionError } = require("./config/database");
const { requireAuth } = require("./middleware/authMiddleware");
const { sanitizeChatText, sanitizeChatInput } = require("./utils/sanitizeChatText");
const Conversation = require("./models/Conversation");
const ConversationVersion = require("./models/ConversationVersion");
const User = require("./models/User");
const { findSemanticReferences } = require("./services/semanticSearch");
const {
  getKnowledgeBase,
  refreshKnowledgeBase,
  initializeKnowledgeBase,
  backfillKnowledgeSearchData
} = require("./services/knowledgeBase");
const { getKeywordRelevance } = require("./services/knowledgeIndex");
const { deleteExpiredArchivedAnnouncements } = require("./services/announcementCleanup");
const { OLLAMA_KEEP_ALIVE, warmOllamaModels } = require("./services/ollamaWarmup");
const {
  buildChatSystemPrompt,
  isPersonalContextQuestion,
  toModelHistory
} = require("./services/chatPrompt");
const MIN_KEYWORD_RELEVANCE = 0.48;
const MIN_SEMANTIC_RELEVANCE = 0.48;
const MIN_COMBINED_RELEVANCE = 0.4;
const CAMPUS_SPECIFIC_TERMS = /\b(upang|phinma|university of pangasinan|enroll(?:ment)?|enrolment|registration|admission|registrar|tuition|fees?|scholarships?|financial aid|hawak kamay|academic calendar|class schedule|office|department|course offerings?|student id|uniform|campus policy|school policy|school requirements|clearance|graduation|curriculum|school year|student services|library|faculty)\b/i;
const ANSWER_FALLBACK = "I couldn't generate a response just now. Please try again.";
const GUEST_SCOPE_RESPONSE = "I can answer questions covered by UPang Assist's approved public information. Please try a public campus question, or sign in for student-specific assistance.";
const GUEST_PERSONAL_DATA_RESPONSE = "I can't help with personal student information in public chat. Please sign in with your verified university account for student-specific assistance.";
const GUEST_PERSONAL_DATA_TERMS = /\b(my|mine|personal|account|student id|grades?|gpa|balance|payment history|registration status|enrollment status|class schedule|attendance|records?)\b/i;
const guestChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => Boolean(req.user),
  message: { error: "Guest chat limit reached. Sign in for continued use, or try again later." }
});

function findKeywordReferences(question, knowledgeEntries) {
  return knowledgeEntries.map((reference) => ({
    reference,
    keywordScore: getKeywordRelevance(question, reference)
  }));
}

async function retrieveKnowledgeReferences(question, history, knowledgeEntries = getKnowledgeBase()) {
  const keywordMatches = findKeywordReferences(question, knowledgeEntries);
  const keywordRanked = [...keywordMatches].sort((first, second) => second.keywordScore - first.keywordScore);
  const topKeywordMatch = keywordRanked[0];
  const secondKeywordMatch = keywordRanked[1];
  const hasKeywordMatch = topKeywordMatch?.keywordScore >= MIN_KEYWORD_RELEVANCE;
  const hasConfidentKeywordMatch = topKeywordMatch?.keywordScore >= 0.75 &&
    (!secondKeywordMatch || topKeywordMatch.keywordScore - secondKeywordMatch.keywordScore >= 0.2);
  let semanticMatches = [];
  if (!hasKeywordMatch && needsVerifiedCampusKnowledge(question)) {
    try {
      semanticMatches = await findSemanticReferences(question, knowledgeEntries, {
        limit: 10,
        minScore: MIN_SEMANTIC_RELEVANCE
      });
    } catch (error) {
      console.warn("Semantic search unavailable; using keyword retrieval:", error.message);
    }
  }

  const semanticById = new Map(semanticMatches.map((item) => [String(item.reference._id), item]));
  const ranked = keywordMatches.map(({ reference, keywordScore }) => {
    const semanticScore = semanticById.get(String(reference._id))?.semanticScore || 0;
    const combinedScore = Math.max(
      semanticScore * 0.85,
      keywordScore * 0.85,
      semanticScore * 0.65 + keywordScore * 0.35
    );
    const hasStrongSignal = semanticScore >= MIN_SEMANTIC_RELEVANCE || keywordScore >= MIN_KEYWORD_RELEVANCE;
    return { reference, semanticScore, keywordScore, combinedScore, hasStrongSignal };
  }).filter((item) => item.hasStrongSignal && item.combinedScore >= MIN_COMBINED_RELEVANCE)
    .sort((first, second) => second.combinedScore - first.combinedScore);

  const followUpReferences = findConversationReferences(question, history, knowledgeEntries);
  const references = mergeReferences(followUpReferences, ranked.slice(0, 3).map((item) => item.reference));
  return {
    references,
    bestScore: ranked[0]?.combinedScore || (followUpReferences.length ? MIN_COMBINED_RELEVANCE : 0),
    fastAnswer: hasConfidentKeywordMatch && !followUpReferences.length
      ? topKeywordMatch.reference.answer
      : null
  };
}

function logChatTiming(startedAt, phase) {
  console.info(`[chat timing] ${phase}: ${Date.now() - startedAt}ms`);
}

function needsVerifiedCampusKnowledge(question) {
  return CAMPUS_SPECIFIC_TERMS.test(question);
}

async function findConversation(req) {
  const conversationId = req.body?.conversationId;
  if (conversationId !== undefined && !mongoose.isValidObjectId(conversationId)) {
    const error = new Error("Invalid conversation ID");
    error.status = 400;
    throw error;
  }
  if (conversationId) {
    const conversation = await Conversation.findOne({ _id: conversationId, owner: req.user._id });
    if (!conversation) {
      const error = new Error("Conversation not found");
      error.status = 404;
      throw error;
    }
    return conversation;
  }
  return null;
}

function createConversation(owner, question) {
  return Conversation.create({ owner, title: sanitizeChatText(question).slice(0, 120) });
}

async function saveChatTurn(conversation, question, answer, references = []) {
  conversation.messages.push(
    { role: "user", content: sanitizeChatText(question) },
    {
      role: "assistant",
      content: sanitizeChatText(answer),
      references: references.map(({ category, question: topic }) => ({ category: sanitizeChatText(category), question: sanitizeChatText(topic) }))
    }
  );
  await conversation.save();
}

function isFollowUpQuestion(question) {
  return /^(what about|how about|and what|and how|what if|does that|is that|can i also|can they|what then|why is that|how does that|where is that|when is that|tell me more|more about|and then|also)\b/i.test(question.trim()) ||
    /\b(it|that|those|these|they|them|there|same|also)\b/i.test(question);
}

function findConversationReferences(question, history, knowledgeEntries = getKnowledgeBase()) {
  if (!isFollowUpQuestion(question)) return [];
  const previousAssistant = [...history].reverse().find((message) => message.role === "assistant");
  if (!previousAssistant?.references?.length) return [];

  return previousAssistant.references
    .map((storedReference) => knowledgeEntries.find((entry) =>
      entry.category === storedReference.category && entry.question === storedReference.question
    ))
    .filter(Boolean);
}

function mergeReferences(first, second, limit = 3) {
  const merged = [];
  const seen = new Set();
  for (const reference of [...first, ...second]) {
    const key = String(reference._id);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(reference);
    if (merged.length === limit) break;
  }
  return merged;
}

async function generateConversationalAnswer(question, references, history = [], campusKnowledgeMissing = false, onToken) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2:1b";
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: buildChatSystemPrompt(references, campusKnowledgeMissing)
        },
        ...(isFollowUpQuestion(question) || isPersonalContextQuestion(question)
          ? toModelHistory(history)
          : []),
        { role: "user", content: question }
      ],
      options: { num_predict: 80, temperature: 0.2 },
      stream: Boolean(onToken),
      keep_alive: OLLAMA_KEEP_ALIVE
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed (${response.status})`);
  }
  if (onToken) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    const consumeLine = (line) => {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.error) throw new Error(event.error);
      const content = event.message?.content || "";
      if (content) {
        answer += content;
        onToken(content);
      }
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) consumeLine(line);
      }
      buffer += decoder.decode();
      consumeLine(buffer);
    } finally {
      reader.releaseLock();
    }
    if (!answer.trim()) throw new Error("Ollama returned an empty answer");
    return answer.trim();
  }
  const data = await response.json();
  const answer = data.message?.content?.trim();
  if (!answer) throw new Error("Ollama returned an empty answer");
  return answer;
}

async function generateAnswer(question, references, history = [], campusKnowledgeMissing = false, onToken) {
  try {
    const generatedAnswer = await generateConversationalAnswer(question, references, history, campusKnowledgeMissing, onToken);
    return { answer: generatedAnswer, provider: "ollama_conversational" };
  } catch (error) {
    console.warn("Ollama answer generation failed:", error.message);
    if (onToken) onToken(ANSWER_FALLBACK);
  }

  return { answer: ANSWER_FALLBACK, provider: "response_fallback" };
}

app.post("/api/chat", sanitizeChatInput, optionalAuth, guestChatLimiter, async (req, res) => {
  const startedAt = Date.now();
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const isGuest = !req.user;

  const maxQuestionLength = isGuest ? 1000 : 12000;
  if (!question || question.length > maxQuestionLength) {
    return res.status(400).json({ error: `question is required and must be at most ${maxQuestionLength} characters` });
  }
  if (isGuest && req.body?.conversationId !== undefined) {
    return res.status(403).json({ error: "Sign in to use saved conversations" });
  }
  const wantsStreaming = !isGuest && req.body?.stream === true;
  const writeEvent = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  if (wantsStreaming) {
    res.status(200);
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();
    writeEvent({ ready: true });
  }

  let conversation;
  if (!isGuest) {
    try {
      conversation = await findConversation(req);
    } catch (error) {
      if (wantsStreaming) {
        writeEvent({ error: error.message || "Unable to load conversation memory" });
        return res.end();
      }
      return res.status(error.status || 500).json({ error: error.status ? error.message : "Unable to load conversation memory" });
    }
  }
  const history = (conversation?.messages || []).map((message) => ({
    ...message.toObject(),
    content: sanitizeChatText(message.content),
    references: (message.references || []).map((reference) => ({
      category: sanitizeChatText(reference.category),
      question: sanitizeChatText(reference.question)
    }))
  }));
  logChatTiming(startedAt, "conversation loaded");

  try {
    await refreshKnowledgeBase();
  } catch (error) {
    console.error("Knowledge database read failed:", error.message);
    if (wantsStreaming) {
      writeEvent({ error: "Knowledge database unavailable" });
      return res.end();
    }
    return res.status(503).json({ error: "Knowledge database unavailable" });
  }

  const knowledgeEntries = isGuest
    ? getKnowledgeBase().filter((entry) => entry.visibility === "public")
    : getKnowledgeBase();
  if (isGuest && GUEST_PERSONAL_DATA_TERMS.test(question)) {
    return res.json({ text: sanitizeChatText(GUEST_PERSONAL_DATA_RESPONSE), provider: "scope_guard" });
  }
  const { references, bestScore, fastAnswer } = await retrieveKnowledgeReferences(question, history, knowledgeEntries);
  logChatTiming(startedAt, "knowledge retrieval complete");
  if (isGuest && !references.length) {
    return res.json({ text: sanitizeChatText(GUEST_SCOPE_RESPONSE), provider: "scope_guard" });
  }
  if (isGuest) return res.json({ text: sanitizeChatText(references[0].answer), provider: "public_knowledge", references: references.map(({ category, question }) => ({ category: sanitizeChatText(category), question: sanitizeChatText(question) })) });
  const campusKnowledgeMissing = needsVerifiedCampusKnowledge(question) &&
    (!references.length || bestScore < MIN_COMBINED_RELEVANCE);
  let generatedFirstTokenLogged = false;
  let generated;
  if (fastAnswer) {
    if (wantsStreaming) {
      logChatTiming(startedAt, "first answer token");
      writeEvent({ token: fastAnswer });
    }
    generated = { answer: fastAnswer, provider: "keyword_knowledge" };
  } else {
    generated = await generateAnswer(
      question,
      references,
      history,
      campusKnowledgeMissing,
      wantsStreaming ? (token) => {
        if (!generatedFirstTokenLogged) {
          generatedFirstTokenLogged = true;
          logChatTiming(startedAt, "first answer token");
        }
        writeEvent({ token });
      } : undefined
    );
  }
  logChatTiming(startedAt, "answer generation complete");
  const answer = sanitizeChatText(generated.answer);
  const { provider } = generated;

  try {
    if (!conversation) conversation = await createConversation(req.user._id, question);
    await saveChatTurn(conversation, question, answer, references);
    logChatTiming(startedAt, "conversation saved");
    const result = { text: answer, provider, conversationId: conversation._id, references: references.map(({ category, question }) => ({ category: sanitizeChatText(category), question: sanitizeChatText(question) })) };
    if (wantsStreaming) {
      writeEvent({ done: true, ...result });
      return res.end();
    }
    return res.json(result);
  } catch (error) {
    if (wantsStreaming) {
      writeEvent({ error: error.message || "Unable to save conversation" });
      return res.end();
    }
    return res.status(error.status || 500).json({ error: error.status ? error.message : "Unable to save conversation" });
  }
});

app.post("/api/conversations/:id/edit", sanitizeChatInput, requireAuth, async (req, res) => {
  const { id } = req.params;
  const messageId = req.body?.messageId;
  const editedContent = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(messageId)) {
    return res.status(400).json({ error: "Invalid conversation or message ID" });
  }
  if (!editedContent || editedContent.length > 12000) {
    return res.status(400).json({ error: "Edited message must be 1 to 12000 characters" });
  }
  try {
    const conversation = await Conversation.findOne({ _id: id, owner: req.user._id });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    const messageIndex = conversation.messages.findIndex((message) => message._id.toString() === messageId);
    if (messageIndex < 0 || conversation.messages[messageIndex].role !== "user") {
      return res.status(404).json({ error: "User message not found in this conversation" });
    }
    const latestUserMessageIndex = conversation.messages.findLastIndex((message) => message.role === "user");
    if (messageIndex !== latestUserMessageIndex) {
      return res.status(409).json({ error: "Only the latest user message can be edited" });
    }

    const history = conversation.messages.slice(0, messageIndex).map((message) => ({
      ...message.toObject(),
      content: sanitizeChatText(message.content)
    }));
    await refreshKnowledgeBase();
    const { references, bestScore } = await retrieveKnowledgeReferences(editedContent, history);
    const campusKnowledgeMissing = needsVerifiedCampusKnowledge(editedContent) &&
      (!references.length || bestScore < MIN_COMBINED_RELEVANCE);
    const { answer: generatedAnswer } = await generateAnswer(editedContent, references, history, campusKnowledgeMissing);
    const answer = sanitizeChatText(generatedAnswer);

    const priorMessages = conversation.messages.map((message) => {
      const priorMessage = message.toObject({ depopulate: true });
      return { ...priorMessage, content: sanitizeChatText(priorMessage.content) };
    });
    const previousVersionCount = await ConversationVersion.countDocuments({ conversation: conversation._id, owner: req.user._id });
    const savedVersion = await ConversationVersion.create({
      conversation: conversation._id,
      owner: req.user._id,
      versionNumber: previousVersionCount + 1,
      editedMessageId: conversation.messages[messageIndex]._id,
      messages: priorMessages
    });

    try {
      conversation.messages.splice(messageIndex + 1);
      conversation.messages[messageIndex].content = editedContent;
      conversation.messages.push({ role: "assistant", content: answer, references });
      if (messageIndex === 0) conversation.title = sanitizeChatText(editedContent).slice(0, 120);
      await conversation.save();
    } catch (error) {
      await ConversationVersion.deleteOne({ _id: savedVersion._id, owner: req.user._id });
      throw error;
    }

    return res.json({
      id: conversation._id,
      title: sanitizeChatText(conversation.title),
      messages: conversation.messages.map((message) => ({
        ...message.toObject(),
        content: sanitizeChatText(message.content),
        references: (message.references || []).map((reference) => ({
          category: sanitizeChatText(reference.category),
          question: sanitizeChatText(reference.question)
        }))
      })),
      versionIndex: 0,
      versionCount: previousVersionCount + 2,
      createdVersion: previousVersionCount + 1
    });
  } catch (error) {
    console.error("Conversation edit failed:", error.message);
    return res.status(500).json({ error: "Unable to edit conversation and regenerate its answer" });
  }
});


async function startServer() {
  const modelWarmup = warmOllamaModels()
    .then(() => console.log("Ollama chat and embedding models are ready"))
    .catch((error) => {
      console.warn("Ollama model warm-up failed:", error.message);
    });

  try {
    // Do not accept requests until MongoDB is connected. Otherwise Mongoose
    // could buffer route writes before the database is ready.
    await connectDatabase();
    await deleteExpiredArchivedAnnouncements();
    const announcementCleanupTimer = setInterval(() => {
      deleteExpiredArchivedAnnouncements().catch((error) => console.error("Archived announcement cleanup failed:", error.message));
    }, 60 * 1000);
    announcementCleanupTimer.unref();
    await User.updateMany({ status: { $in: ["disabled", "archived"] } }, { $set: { status: "inactive" } });
    await initializeKnowledgeBase();
    console.log(`Chatbot knowledge loaded (${getKnowledgeBase().length} entries)`);
    await modelWarmup;

    const port = process.env.PORT || 3000;
    const httpServer = http.createServer(app);
    const io = attachSupportSocket(httpServer);
    app.set("io", io);
    httpServer.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      void backfillKnowledgeSearchData()
        .then(({ total, indexed }) => console.log(`Knowledge search index ready (${indexed} updated, ${total} total entries)`))
        .catch((error) => console.error("Knowledge search index backfill failed:", error.message));
    });
  } catch (error) {
    logDatabaseConnectionError(error);
    process.exit(1);
  }
}

startServer();
