const axios = require("axios");

// Credential vault: n8n webhook built for the Transformatiive Claude project.
// See Credentials Addendum — we pull from three epics:
//   - TRNSF-INTERNAL    → Zoho Books + Moloni
//   - TRNSF-PARTNER-EU  → Partner Store EU
//   - TRNSF-PARTNER-COM → Partner Store COM
const VAULT_URL =
  process.env.CREDENTIAL_VAULT_URL ||
  "https://trnsf.up.railway.app/webhook/credential-vault";

const EPICS = [
  process.env.CREDENTIAL_VAULT_EPIC_INTERNAL || "TRNSF-INTERNAL",
  process.env.CREDENTIAL_VAULT_EPIC_PARTNER_EU || "TRNSF-PARTNER-EU",
  process.env.CREDENTIAL_VAULT_EPIC_PARTNER_COM || "TRNSF-PARTNER-COM",
];

// Per-epic field maps. The vault scopes keys by epic — e.g. TRNSF-PARTNER-EU
// returns a `zoho_client_id` that must be mapped to PARTNER_EU_CLIENT_ID
// (not the main Books ZOHO_CLIENT_ID).
const INTERNAL_MAP = {
  zoho_client_id: "ZOHO_CLIENT_ID",
  zoho_client_secret: "ZOHO_CLIENT_SECRET",
  zoho_refresh_token: "ZOHO_REFRESH_TOKEN",
  zoho_org_id: "ZOHO_ORG_ID",
  zoho_organization_id: "ZOHO_ORG_ID",
  zoho_accounts_url: "ZOHO_ACCOUNTS_URL",
  zoho_api_base: "ZOHO_API_BASE",
  zoho_domain: "ZOHO_API_BASE",

  moloni_client_id: "MOLONI_CLIENT_ID",
  moloni_developer_id: "MOLONI_CLIENT_ID",
  moloni_client_secret: "MOLONI_CLIENT_SECRET",
  moloni_username: "MOLONI_USERNAME",
  moloni_password: "MOLONI_PASSWORD",
  moloni_company_id: "MOLONI_COMPANY_ID",
  moloni_refresh_token: "MOLONI_REFRESH_TOKEN",
  moloni_document_set_id: "MOLONI_DOCUMENT_SET_ID",
  moloni_document_set_name: "MOLONI_DOCUMENT_SET_NAME",
  moloni_tax_normal_id: "MOLONI_TAX_NORMAL_ID",

  anthropic_api_key: "ANTHROPIC_API_KEY",
  claude_api_key: "ANTHROPIC_API_KEY",
  app_password: "APP_PASSWORD",
  dashboard_password: "APP_PASSWORD",
};

function partnerMap(prefix) {
  return {
    zoho_client_id: `${prefix}_CLIENT_ID`,
    zoho_client_secret: `${prefix}_CLIENT_SECRET`,
    zoho_refresh_token: `${prefix}_REFRESH_TOKEN`,
    zoho_accounts_url: `${prefix}_ACCOUNTS_URL`,
    zoho_api_base: `${prefix}_API_BASE`,
    zoho_domain: `${prefix}_API_BASE`,
    client_id: `${prefix}_CLIENT_ID`,
    client_secret: `${prefix}_CLIENT_SECRET`,
    refresh_token: `${prefix}_REFRESH_TOKEN`,
    accounts_url: `${prefix}_ACCOUNTS_URL`,
    api_base: `${prefix}_API_BASE`,
    domain: `${prefix}_API_BASE`,
    email: `${prefix}_EMAIL`,
    password: `${prefix}_PASSWORD`,
  };
}

const EPIC_MAPS = {
  "TRNSF-INTERNAL": INTERNAL_MAP,
  "TRNSF-PARTNER-EU": partnerMap("PARTNER_EU"),
  "TRNSF-PARTNER-COM": partnerMap("PARTNER_COM"),
};

function normalizeBag(bag) {
  if (!bag || typeof bag !== "object") return {};
  if (bag.credentials && typeof bag.credentials === "object") return normalizeBag(bag.credentials);
  if (bag.fields && typeof bag.fields === "object") return normalizeBag(bag.fields);
  if (bag.data && typeof bag.data === "object") return normalizeBag(bag.data);
  if (Array.isArray(bag.results)) {
    const out = {};
    for (const r of bag.results) if (r?.key) out[r.key] = r.value;
    return out;
  }
  if (Array.isArray(bag)) {
    const out = {};
    for (const r of bag) if (r?.key) out[r.key] = r.value;
    return out;
  }
  return bag;
}

function applyBag(bag, epic, { overwrite }) {
  const map = EPIC_MAPS[epic] || INTERNAL_MAP;
  let applied = 0;
  for (const [rawKey, value] of Object.entries(bag)) {
    if (value == null || value === "") continue;
    if (typeof value === "object") continue;

    const envKey = map[rawKey.toLowerCase()];
    if (!envKey) continue;

    if (!overwrite && process.env[envKey]) continue;
    process.env[envKey] = typeof value === "string" ? value : String(value);
    applied += 1;
  }
  return applied;
}

async function loadEpic(epic, { overwrite }) {
  const url = `${VAULT_URL}?action=get&epic_key=${encodeURIComponent(epic)}`;
  try {
    const res = await axios.get(url, { timeout: 15000 });
    const bag = normalizeBag(res.data);
    const applied = applyBag(bag, epic, { overwrite });
    console.log(`[vault] ${epic}: applied ${applied} credentials`);
    return applied;
  } catch (err) {
    const msg = err.response
      ? `HTTP ${err.response.status} ${JSON.stringify(err.response.data).slice(0, 200)}`
      : err.message;
    console.error(`[vault] ${epic}: failed — ${msg}`);
    return 0;
  }
}

async function loadCredentials({ overwrite = false } = {}) {
  let total = 0;
  for (const epic of EPICS) {
    total += await loadEpic(epic, { overwrite });
  }

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
    "PARTNER_EU_CLIENT_ID",
    "PARTNER_EU_CLIENT_SECRET",
    "PARTNER_EU_REFRESH_TOKEN",
    "PARTNER_COM_CLIENT_ID",
    "PARTNER_COM_CLIENT_SECRET",
    "PARTNER_COM_REFRESH_TOKEN",
  ];
  const missing = expectedFromVault.filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn(`[vault] still missing after load: ${missing.join(", ")}`);
  }

  const envOnly = [];
  if (!process.env.ANTHROPIC_API_KEY) envOnly.push("ANTHROPIC_API_KEY");
  if (envOnly.length) {
    console.warn(`[vault] must be set as env var (not in vault): ${envOnly.join(", ")}`);
  }

  return { applied: total, missing };
}

module.exports = { loadCredentials };
