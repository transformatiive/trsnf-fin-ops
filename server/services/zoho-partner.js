const axios = require("axios");
const { getZohoToken } = require("./zoho-auth");

// Partner Store credentials (see Credentials Addendum).
// Two separate stores (EU + COM) each with their own client_id/secret/refresh_token.
// Partner COM happens to share client_id/client_secret with the main Books org,
// but uses a different refresh_token and a different API base.

const STORES = {
  eu: {
    key: "partnerEu",
    base: () => process.env.PARTNER_EU_API_BASE || "https://store.zoho.eu",
    accountsUrl: () => process.env.PARTNER_EU_ACCOUNTS_URL || "https://accounts.zoho.eu",
    clientId: () => process.env.PARTNER_EU_CLIENT_ID,
    clientSecret: () => process.env.PARTNER_EU_CLIENT_SECRET,
    refreshToken: () => process.env.PARTNER_EU_REFRESH_TOKEN,
  },
  com: {
    key: "partnerCom",
    base: () => process.env.PARTNER_COM_API_BASE || "https://store.zoho.com",
    accountsUrl: () => process.env.PARTNER_COM_ACCOUNTS_URL || "https://accounts.zoho.com",
    clientId: () => process.env.PARTNER_COM_CLIENT_ID,
    clientSecret: () => process.env.PARTNER_COM_CLIENT_SECRET,
    refreshToken: () => process.env.PARTNER_COM_REFRESH_TOKEN,
  },
};

async function getPartnerToken(store) {
  const cfg = STORES[store];
  if (!cfg) throw new Error("Unknown store: " + store);
  if (!cfg.refreshToken()) {
    throw new Error(`Partner Store (${store}) not configured — missing refresh token`);
  }
  return getZohoToken(
    cfg.key,
    cfg.accountsUrl(),
    cfg.clientId(),
    cfg.clientSecret(),
    cfg.refreshToken()
  );
}

async function fetchSubscriptions(store) {
  try {
    const cfg = STORES[store];
    const token = await getPartnerToken(store);
    const url = `${cfg.base()}/api/v1/partner/subscriptions`;
    console.log(`[partner:${store}] GET ${url}`);
    const res = await axios.get(url, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { per_page: 200 },
    });
    const raw = res.data;
    // Handle both array response and wrapped { subscriptions: [...] } response
    let subs;
    if (Array.isArray(raw)) {
      subs = raw;
    } else {
      subs = raw.subscriptions || raw.data || raw.subscription || [];
      // If still empty but raw has numeric keys, it's an array-like object
      if (!subs.length && raw && typeof raw === "object") {
        const vals = Object.values(raw);
        if (vals.length > 0 && typeof vals[0] === "object") subs = vals;
      }
    }
    const keys = Object.keys(raw || {});
    console.log(`[partner:${store}] response keys: [${keys.slice(0, 10).join(", ")}${keys.length > 10 ? "…" : ""}], subscriptions: ${subs.length}`);
    if (subs.length > 0) {
      // Log sample renewal fields from first sub
      const sample = subs[0];
      const renewalFields = [
        "next_recurring_date", "next_billing_date", "renewal_date",
        "expires_on", "expiry_date", "end_date",
      ];
      const found = renewalFields.filter((f) => sample[f]);
      console.log(`[partner:${store}] renewal date fields present: [${found.map((f) => `${f}=${sample[f]}`).join(", ") || "none"}]`);
    }
    return subs;
  } catch (err) {
    const msg = err.response
      ? `HTTP ${err.response.status} ${JSON.stringify(err.response.data).slice(0, 300)}`
      : err.message;
    console.error(`[partner:${store}] fetchSubscriptions failed: ${msg}`);
    return [];
  }
}

async function fetchAllSubscriptions() {
  const [eu, com] = await Promise.all([
    fetchSubscriptions("eu").catch(() => []),
    fetchSubscriptions("com").catch(() => []),
  ]);
  return [
    ...eu.map((s) => ({ ...s, _store: "eu" })),
    ...com.map((s) => ({ ...s, _store: "com" })),
  ];
}

async function healthCheck() {
  // Consider Partner Store healthy if at least one side authenticates.
  try {
    const results = await Promise.allSettled([getPartnerToken("eu"), getPartnerToken("com")]);
    return results.some((r) => r.status === "fulfilled");
  } catch {
    return false;
  }
}

module.exports = { getPartnerToken, fetchSubscriptions, fetchAllSubscriptions, healthCheck };
