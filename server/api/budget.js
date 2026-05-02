const { ensureTable, getConfig, setConfig } = require("../services/db");

const BUDGET_KEY = "budget_v1";

async function getBudget(req, res) {
  try {
    await ensureTable();
    const row = await getConfig(BUDGET_KEY);
    if (!row) return res.json({ budget: null, updated_at: null });
    res.json({ budget: row.value, updated_at: row.updated_at });
  } catch (err) {
    console.error("[budget] GET error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

async function saveBudget(req, res) {
  try {
    const { budget } = req.body || {};
    if (!budget || typeof budget !== "object") {
      return res.status(400).json({ error: "invalid_budget" });
    }
    await ensureTable();
    await setConfig(BUDGET_KEY, budget);
    res.json({ ok: true });
  } catch (err) {
    console.error("[budget] POST error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getBudget, saveBudget };
