const books = require("../services/zoho-books");
const moloni = require("../services/moloni");
const crm = require("../services/zoho-crm");

async function healthCheck(req, res) {
  const [zoho, mol, crmOk] = await Promise.all([
    books.healthCheck().catch(() => false),
    moloni.healthCheck().catch(() => false),
    crm.healthCheck().catch(() => false),
  ]);

  res.json({
    status: "ok",
    zoho,
    zoho_crm: crmOk,
    moloni: mol,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { healthCheck };
