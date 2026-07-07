require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { loadCredentials } = require("./services/vault");
const { buildDashboard, invalidateCache } = require("./api/dashboard");
const { streamAnalysis } = require("./api/analysis");
const { healthCheck } = require("./api/health");
const { getBudget, saveBudget } = require("./api/budget");

const PORT = process.env.PORT || 3000;

// Access token comes ONLY from the environment (ACCESS_TOKEN / APP_PASSWORD).
// No baked-in default: if unset, the gate fails closed (denies everything).
const app = express();
app.use(cors());
app.use(express.json());

// -------- Token gate --------
function getAccessToken() {
  return process.env.ACCESS_TOKEN || process.env.APP_PASSWORD || null;
}

function verifyToken(token) {
  const expected = getAccessToken();
  if (!expected) return false; // fail-closed: sem ACCESS_TOKEN configurado, nega tudo
  if (!token || typeof token !== "string") return false;
  if (token.length !== expected.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function extractToken(req) {
  const auth = req.headers["authorization"] || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.query.token || null;
}

function requireAuth(req, res, next) {
  if (!verifyToken(extractToken(req))) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.get("/api/session", (req, res) => {
  res.json({ valid: verifyToken(extractToken(req)) });
});

// -------- API routes (auth-gated) --------
app.get("/api/health", requireAuth, healthCheck);

app.get("/api/dashboard", requireAuth, async (req, res) => {
  try {
    if (req.query.refresh === "1") invalidateCache();
    const data = await buildDashboard(req.query.year);
    res.json(data);
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/analysis", requireAuth, streamAnalysis);

app.get("/api/budget", requireAuth, getBudget);
app.post("/api/budget", requireAuth, saveBudget);

// Force re-fetch credentials from vault (useful if a secret was rotated)
app.post("/api/vault/reload", requireAuth, async (req, res) => {
  const result = await loadCredentials({ overwrite: true });
  invalidateCache();
  res.json(result);
});

// Debug: raw Partner Store subscriptions (helps diagnose empty annual licences)
app.get("/api/debug/partner", requireAuth, async (req, res) => {
  const { fetchAllSubscriptions } = require("./services/zoho-partner");
  try {
    const subs = await fetchAllSubscriptions();
    res.json({ count: subs.length, subscriptions: subs.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    if (getAccessToken()) {
      console.log(`[server] auth: URL token gate enabled (?token=…)`);
    } else {
      console.warn(`[server] ⚠ ACCESS_TOKEN not set — all /api requests will be denied (fail-closed)`);
    }
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      console.log(`[server] public domain: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
    }
  });
}

start().catch((err) => {
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
