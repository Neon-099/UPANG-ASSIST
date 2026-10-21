const HTML_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'"
};

function decodeHtmlEntities(value) {
  return value
    .replace(/&(#x[\da-f]{1,6}|#\d{1,7}|amp|lt|gt|quot|apos|#39);/gi, (entity, code) => {
      if (code[0] === "#") {
        const number = code[1].toLowerCase() === "x"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
        if (Number.isInteger(number) && number > 0 && number <= 0x10ffff) {
          try { return String.fromCodePoint(number); } catch { return ""; }
        }
        return "";
      }
      return HTML_ENTITIES[code.toLowerCase()] ?? entity;
    });
}

function sanitizeChatText(value) {
  if (typeof value !== "string") return "";
  let text = value.normalize("NFC");

  // Decode entities before stripping so encoded tags and schemes are handled too.
  for (let pass = 0; pass < 3; pass += 1) {
    text = decodeHtmlEntities(text);
    text = text
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style|iframe|object|embed|svg|math|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<(script|style|iframe|object|embed|svg|math|noscript|template)\b[^>]*\/?\s*>/gi, " ")
      .replace(/<\/?[a-z][^>]*>/gi, " ");
  }

  // Normalize controls before checking schemes so embedded controls cannot split them.
  return text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/(?:java\s*script|vb\s*script)\s*:/gi, "")
    .replace(/data\s*:\s*text\s*\/\s*html/gi, "")
    .trim();
}

function sanitizeChatInput(req, res, next) {
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    for (const key of ["message", "question", "content"]) {
      if (typeof req.body[key] === "string") req.body[key] = sanitizeChatText(req.body[key]);
    }
  }
  next();
}

module.exports = { sanitizeChatText, sanitizeChatInput };
