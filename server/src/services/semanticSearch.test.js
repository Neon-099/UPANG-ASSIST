const test = require("node:test");
const assert = require("node:assert/strict");
const { findSemanticReferences } = require("./semanticSearch");

const originalFetch = global.fetch;
const originalTimeout = AbortSignal.timeout;

test.after(() => {
  global.fetch = originalFetch;
  AbortSignal.timeout = originalTimeout;
});

test("semantic search bounds its embedding request", async () => {
  let timeoutMs;
  AbortSignal.timeout = (milliseconds) => {
    timeoutMs = milliseconds;
    return originalTimeout(milliseconds);
  };
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ embeddings: [[1, 0]] })
  });

  const results = await findSemanticReferences("fees", [{
    _id: "entry-1",
    embedding: [1, 0],
    searchKeywords: ["fee"]
  }]);

  assert.equal(timeoutMs, 1500);
  assert.equal(results.length, 1);
  assert.equal(results[0].reference._id, "entry-1");
});
