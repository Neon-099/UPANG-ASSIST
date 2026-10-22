const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildChatSystemPrompt,
  formatKnowledgeContext,
  isPersonalContextQuestion,
  toModelHistory
} = require("./chatPrompt");

test("generation context includes at most two concise references", () => {
  const references = Array.from({ length: 3 }, (_, index) => ({
    category: `Category ${index}`,
    question: `Question ${index}`,
    answer: "a".repeat(1200)
  }));
  const context = formatKnowledgeContext(references);

  assert.match(context, /Question 0/);
  assert.match(context, /Question 1/);
  assert.doesNotMatch(context, /Question 2/);
  assert.equal(context.length, "1. Question 0\n".length + 1100 + 2 + "2. Question 1\n".length + 1100);
});

test("follow-up generation history is limited to two short messages", () => {
  const history = Array.from({ length: 5 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `${index}: ${"x".repeat(400)}`
  }));
  const modelHistory = toModelHistory(history);

  assert.equal(modelHistory.length, 2);
  assert.equal(modelHistory[0].content.length, 300);
  assert.match(modelHistory[0].content, /^3:/);
  assert.match(modelHistory[1].content, /^4:/);
});

test("campus prompt retains verified-fact guardrails", () => {
  const prompt = buildChatSystemPrompt([], true);

  assert.match(prompt, /never guess unsupported campus details/i);
  assert.match(prompt, /do not answer its campus fact from general knowledge/i);
  assert.match(prompt, /No matching references/);
});

test("personal-detail questions include recent conversation without requiring verification", () => {
  assert.equal(isPersonalContextQuestion("What is my name?"), true);
  assert.equal(isPersonalContextQuestion("Do you remember my name?"), true);
  assert.equal(isPersonalContextQuestion("What are the enrollment requirements?"), false);
  assert.match(buildChatSystemPrompt([], false), /self-reported details do not require external verification/i);
});
