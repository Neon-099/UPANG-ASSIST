const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || "30m";

let warmupPromise = null;
let chatWarmupPromise = null;
let embeddingWarmupPromise = null;

async function requestOllama(path, body) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Ollama warm-up request failed (${response.status})`);
  }
}

function warmOllamaChatModel() {
  if (!chatWarmupPromise) {
    const model = process.env.OLLAMA_MODEL || "llama3.2:1b";
    chatWarmupPromise = requestOllama("/api/chat", {
      model,
      messages: [{ role: "user", content: "Reply with ready." }],
      options: { num_predict: 1 },
      stream: false,
      keep_alive: OLLAMA_KEEP_ALIVE
    }).catch((error) => {
      chatWarmupPromise = null;
      throw error;
    });
  }
  return chatWarmupPromise;
}

function warmOllamaEmbeddingModel() {
  if (!embeddingWarmupPromise) {
    const model = process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";
    embeddingWarmupPromise = requestOllama("/api/embed", {
      model,
      input: "UPangAssist model warm-up",
      keep_alive: OLLAMA_KEEP_ALIVE
    }).catch((error) => {
      embeddingWarmupPromise = null;
      throw error;
    });
  }
  return embeddingWarmupPromise;
}

function warmOllamaModels() {
  if (!warmupPromise) {
    warmupPromise = Promise.all([warmOllamaChatModel(), warmOllamaEmbeddingModel()])
      .then(() => undefined).catch((error) => {
        warmupPromise = null;
        throw error;
      });
  }
  return warmupPromise;
}

module.exports = { OLLAMA_KEEP_ALIVE, warmOllamaChatModel, warmOllamaModels };
