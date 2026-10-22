const test = require("node:test");
const assert = require("node:assert/strict");
const { OLLAMA_KEEP_ALIVE, warmOllamaModels } = require("./ollamaWarmup");
const { createEmbedding } = require("./knowledgeIndex");

const originalFetch = global.fetch;
let requests = [];

test.after(() => {
  global.fetch = originalFetch;
});

test("warms both models once and keeps them resident", async () => {
  requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({}) };
  };

  await Promise.all([warmOllamaModels(), warmOllamaModels()]);

  assert.equal(requests.length, 2);
  const chatRequest = requests.find(({ url }) => url.endsWith("/api/chat"));
  const embeddingRequest = requests.find(({ url }) => url.endsWith("/api/embed"));
  assert.equal(chatRequest.body.model, process.env.OLLAMA_MODEL || "llama3.2:1b");
  assert.equal(chatRequest.body.keep_alive, OLLAMA_KEEP_ALIVE);
  assert.equal(chatRequest.body.options.num_predict, 1);
  assert.equal(embeddingRequest.body.model, process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text");
  assert.equal(embeddingRequest.body.keep_alive, OLLAMA_KEEP_ALIVE);
});

test("question embeddings keep the model resident", async () => {
  let requestBody;
  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ embeddings: [[0.1, 0.2]] }) };
  };

  await createEmbedding("first prompt");

  assert.equal(requestBody.keep_alive, OLLAMA_KEEP_ALIVE);
});
