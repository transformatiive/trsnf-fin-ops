require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const { loadCredentials } = require("./services/vault");
const { buildDashboard, invalidateCache } = require("./api/dashboard");
const { streamAnalysis } = require("./api/analysis");
const { healthCheck } = require("./api/health");

const PORT = process.env.PORT || 3000;

// App password default. This is intentionally baked in per product owner request;
// can still be overridden via APP_PASSWORD env var or the credential vault.
const DEFAULT_APP_PASSWORD = "!TransformatiiveAdmin2026#";

const app = express();
app.use(cors());
app.use(express.json());

// -------- Simple password gate --------
// Issues a signed session token valid for 12h on successful login.
// APP_PASSWORD / SESSION_SECRET are resolved lazily (after vault load).
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function getAppPassword() {
  return process.env.APP_PASSWORD || DEFAULT_APP_PASSWORD;
}

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  return crypto
    .createHash("sha256")
    .update(getAppPassword() + "::trnsf-sessions")
    .digest("hex");
}

function issueToken() {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${exp}`;
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;
  const exp = parseInt(payload, 10);
  if (!exp || Date.now() > exp) return false;
  return true;
}

function requireAuth(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.query.token;
  if (!verifyToken(token)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  if (password !== getAppPassword()) {
    return res.status(401).json({ error: "invalid_password" });
  }
  const token = issueToken();
  res.json({ token, expires_in_ms: SESSION_TTL_MS });
});

app.get("/api/session", (req, res) => {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  res.json({ valid: verifyToken(token) });
});

// -------- API routes (auth-gated) --------
app.get("/api/health", requireAuth, healthCheck);

app.get("/api/dashboard", requireAuth, async (req, res) => {
  try {
    if (req.query.refresh === "1") invalidateCache();
    const data = await buildDashboard();
    res.json(data);
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/analysis", requireAuth, streamAnalysis);

// Force re-fetch credentials from vault (useful if a secret was rotated)
app.post("/api/vault/reload", requireAuth, async (req, res) => {
  const result = await loadCredentials({ overwrite: true });
  invalidateCache();
  res.json(result);
});

// -------- Static client (production) --------
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) res.status(404).send("Not found");
  });
});

async function start() {
  console.log("[server] bootstrapping credentials from vault…");
  await loadCredentials({ overwrite: false });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] listening on http://0.0.0.0:${PORT}`);
    console.log(`[server] auth: password gate enabled`);
  });
}

start().catch((err) => {
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
