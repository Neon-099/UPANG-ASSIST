const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const dns = require("node:dns");
const KnowledgeEntry = require("./models/KnowledgeEntry");
const entries = [
  ...require("./data/universityPublicKnowledge.json"),
  ...require("./data/universityPublicSupplementalFaq.json")
];

async function seedUniversityPublicKnowledge() {
  const uri = process.env.MONGODB_URI || process.env.LOCAL_MONGODB_URI || "mongodb://127.0.0.1:27017/upang-assist";
  const dnsServers = (process.env.MONGODB_DNS_SERVERS || "")
    .split(",").map((server) => server.trim()).filter(Boolean);
  if (dnsServers.length) dns.setServers(dnsServers);

  const today = new Date().toISOString().slice(0, 10);
  for (const [index, entry] of entries.entries()) {
    if (!entry.category || !entry.question || !entry.answer) {
      throw new Error(`Public knowledge entry ${index + 1} is missing category, question, or answer`);
    }
    if (entry.category.length > 100 || entry.question.length > 500 || entry.answer.length > 10000) {
      throw new Error(`Public knowledge entry ${index + 1} exceeds the knowledge schema field limits`);
    }
  }

  await mongoose.connect(uri);
  try {
    const operations = entries.map((entry) => ({
      updateOne: {
        filter: { category: entry.category, question: entry.question },
        update: { $set: { answer: entry.answer, visibility: "public", lastUpdated: today } },
        upsert: true
      }
    }));
    const result = await KnowledgeEntry.bulkWrite(operations, { ordered: true });
    console.log(
      `Public knowledge seed complete: ${entries.length} entries processed, ` +
      `${result.upsertedCount} inserted, ${result.modifiedCount} updated, ` +
      `${result.matchedCount - result.modifiedCount} unchanged.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

seedUniversityPublicKnowledge().catch((error) => {
  console.error("Public knowledge seed failed:", error.message);
  process.exitCode = 1;
});
