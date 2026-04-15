const axios = require("axios");

// Credential vault: n8n webhook built for the Transformatiive Claude project.
// See spec §15 — skill `credential-vault`.
const VAULT_URL =
  process.env.CREDENTIAL_VAULT_URL ||
  "https://trnsf.up.railway.app/webhook/credential-vault";
const EPIC_KEY = process.env.CREDENTIAL_VAULT_EPIC || "TRNSF-INTERNAL";

// Maps vault field names (lowercase) → env var names we use in this app.
// Tolerant of a few naming variations the vault may return.
const FIELD_MAP = {
  zoho_client_id: "ZOHO_CLIENT_ID",
  zoho_client_secret: "ZOHO_CLIENT_SECRET",
  zoho_refresh_token: "ZOHO_REFRESH_TOKEN",
  zoho_org_id: "ZOHO_ORG_ID",
  zoho_organization_id: "ZOHO_ORG_ID",

  partner_eu_email: "PARTNER_EU_EMAIL",
  partner_eu_password: "PARTNER_EU_PASSWORD",
  partner_com_email: "PARTNER_COM_EMAIL",
  partner_com_password: "PARTNER_COM_PASSWORD",

  moloni_client_id: "MOLONI_CLIENT_ID",
  moloni_developer_id: "MOLONI_CLIENT_ID", // vault names it developer_id
  moloni_client_secret: "MOLONI_CLIENT_SECRET",
  moloni_username: "MOLONI_USERNAME",
  moloni_password: "MOLONI_PASSWORD",
  moloni_company_id: "MOLONI_COMPANY_ID",
  moloni_refresh_token: "MOLONI_REFRESH_TOKEN",
  moloni_document_set_id: "MOLONI_DOCUMENT_SET_ID",
  moloni_tax_normal_id: "MOLONI_TAX_NORMAL_ID",

  anthropic_api_key: "ANTHROPIC_API_KEY",
  claude_api_key: "ANTHROPIC_API_KEY",

  app_password: "APP_PASSWORD",
  dashboard_password: "APP_PASSWORD",
};

function normalizeBag(bag) {
  // Accept several shapes:
  //  { credentials: {...} }
  //  { fields: {...} }
  //  { data: {...} }
  //  { results: [{key, value}, ...] }
  //  { ...creds directly }
  if (!bag || typeof bag !== "object") return {};

  if (bag.credentials && typeof bag.credentials === "object") return normalizeBag(bag.credentials);
  if (bag.fields && typeof bag.fields === "object") return normalizeBag(bag.fields);
  if (bag.data && typeof bag.data === "object") return normalizeBag(bag.data);
  if (Array.isArray(bag.results)) {
    const out = {};
    for (const r of bag.results) {
      if (r && r.key) out[r.key] = r.value;
      else if (r && r.name) out[r.name] = r.value;
    }
    return out;
  }
  if (Array.isArray(bag)) {
    const out = {};
    for (const r of bag) {
      if (r && r.key) out[r.key] = r.value;
      else if (r && r.name) out[r.name] = r.value;
    }
    return out;
  }
  return bag;
}

async function loadCredentials({ overwrite = false } = {}) {
  try {
    const url = `${VAULT_URL}?action=get&epic_key=${encodeURIComponent(EPIC_KEY)}`;
    const res = await axios.get(url, { timeout: 15000 });
    const bag = normalizeBag(res.data);

    let applied = 0;
    const missing = [];
    for (const [rawKey, value] of Object.entries(bag)) {
      if (value == null || value === "") continue;
      const envKey = FIELD_MAP[rawKey.toLowerCase()] || rawKey.toUpperCase();
      if (!overwrite && process.env[envKey]) continue;
      process.env[envKey] = typeof value === "string" ? value : String(value);
      applied += 1;
    }

    // Vault-provided credentials
    const expectedFromVault = [
      "ZOHO_CLIENT_ID",
      "ZOHO_CLIENT_SECRET",
      "ZOHO_REFRESH_TOKEN",
      "ZOHO_ORG_ID",
      "MOLONI_CLIENT_ID",
      "MOLONI_CLIENT_SECRET",
      "MOLONI_USERNAME",
      "MOLONI_PASSWORD",
      "MOLONI_COMPANY_ID",
    ];
    for (const k of expectedFromVault) if (!process.env[k]) missing.push(k);

    // Things that must come from Replit Secrets (not in vault):
    //  - ANTHROPIC_API_KEY  → Anthropic API
    //  - PARTNER_EU_EMAIL / PARTNER_EU_PASSWORD (if Partner Store EU used)
    //  - PARTNER_COM_EMAIL / PARTNER_COM_PASSWORD (if Partner Store COM used)
    const envOnly = [];
    if (!process.env.ANTHROPIC_API_KEY) envOnly.push("ANTHROPIC_API_KEY");
    if (envOnly.length) {
      console.warn(`[vault] must be set as env var (not in vault): ${envOnly.join(", ")}`);
    }

    console.log(`[vault] loaded ${applied} credentials from ${VAULT_URL}`);
    if (missing.length) {
      console.warn(`[vault] still missing: ${missing.join(", ")}`);
    }
    return { applied, missing };
  } catch (err) {
    const msg = err.response
      ? `HTTP ${err.response.status} ${JSON.stringify(err.response.data).slice(0, 200)}`
      : err.message;
    console.error(`[vault] failed to load credentials: ${msg}`);
    return { applied: 0, error: msg };
  }
}

module.exports = { loadCredentials };
