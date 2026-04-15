require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");

const { buildDashboard, invalidateCache } = require("./api/dashboard");
const { streamAnalysis } = require("./api/analysis");
const { healthCheck } = require("./api/health");

const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || "!TransformatiiveAdmin2026#";

const app = express();
app.use(cors());
app.use(express.json());

// -------- Simple password gate --------
// Issues a signed session token valid for 12h on successful login.
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash("sha256").update(APP_PASSWORD + "::trnsf-sessions").digest("hex");
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function issueToken() {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${exp}`;
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
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
  if (password !== APP_PASSWORD) {
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

// -------- Static client (production) --------
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) res.status(404).send("Not found");
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] listening on http://0.0.0.0:${PORT}`);
  console.log(`[server] auth: password gate enabled`);
});
