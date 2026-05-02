const { Pool } = require("pg");

let pool = null;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      return null;
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

async function ensureTable() {
  const p = getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getConfig(key) {
  const p = getPool();
  if (!p) return null;
  const res = await p.query("SELECT value, updated_at FROM app_config WHERE key = $1", [key]);
  if (!res.rows.length) return null;
  return { value: res.rows[0].value, updated_at: res.rows[0].updated_at };
}

async function setConfig(key, value) {
  const p = getPool();
  if (!p) return;
  await p.query(
    `INSERT INTO app_config (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

module.exports = { getPool, ensureTable, getConfig, setConfig };
