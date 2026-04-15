const books = require("../services/zoho-books");
const moloni = require("../services/moloni");

async function healthCheck(req, res) {
  const [zoho, mol] = await Promise.all([
    books.healthCheck().catch(() => false),
    moloni.healthCheck().catch(() => false),
  ]);

  res.json({
    status: "ok",
    zoho,
    moloni: mol,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { healthCheck };
