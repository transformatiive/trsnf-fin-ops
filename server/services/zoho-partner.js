const axios = require("axios");

// Zoho Partner Store uses email/password for OAuth token (resource owner flow).
// There are two separate stores (EU + COM) with separate credentials.

const STORES = {
  eu: {
    base: "https://store.zoho.eu/api/v1",
    email: () => process.env.PARTNER_EU_EMAIL,
    password: () => process.env.PARTNER_EU_PASSWORD,
  },
  com: {
    base: "https://store.zoho.com/api/v1",
    email: () => process.env.PARTNER_COM_EMAIL,
    password: () => process.env.PARTNER_COM_PASSWORD,
  },
};

const tokenCache = { eu: null, com: null };

async function getPartnerToken(store) {
  const cfg = STORES[store];
  if (!cfg) throw new Error("Unknown store: " + store);

  const cached = tokenCache[store];
  if (cached && Date.now() < cached.expires) {
    return cached.token;
  }

  try {
    const res = await axios.post(`${cfg.base}/oauth/token`, {
      username: cfg.email(),
      password: cfg.password(),
      grant_type: "password",
    });
    tokenCache[store] = {
      token: res.data.access_token,
      expires: Date.now() + 3500 * 1000,
    };
    return tokenCache[store].token;
  } catch (err) {
    console.error(`Partner Store (${store}) auth failed:`, err.message);
    throw err;
  }
}

async function fetchSubscriptions(store) {
  try {
    const token = await getPartnerToken(store);
    const cfg = STORES[store];
    const res = await axios.get(`${cfg.base}/subscriptions`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { per_page: 200 },
    });
    return res.data.subscriptions || res.data.data || [];
  } catch (err) {
    console.error(`Partner Store (${store}) fetchSubscriptions failed:`, err.message);
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
  try {
    await Promise.race([
      Promise.any([getPartnerToken("eu"), getPartnerToken("com")]),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

module.exports = { getPartnerToken, fetchSubscriptions, fetchAllSubscriptions, healthCheck };
