const axios = require("axios");

const MOLONI_BASE = "https://api.moloni.pt/v1";

let tokenCache = { token: null, expires: 0, refresh: null };

// CRITICAL: Moloni's /grant/ endpoint requires GET with query params
// (POST returns invalid_request).
async function getMoloniToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) {
    return tokenCache.token;
  }

  const res = await axios.get(`${MOLONI_BASE}/grant/`, {
    params: {
      grant_type: "password",
      client_id: process.env.MOLONI_CLIENT_ID,
      client_secret: process.env.MOLONI_CLIENT_SECRET,
      username: process.env.MOLONI_USERNAME,
      password: process.env.MOLONI_PASSWORD,
    },
  });

  tokenCache = {
    token: res.data.access_token,
    refresh: res.data.refresh_token,
    expires: Date.now() + ((res.data.expires_in || 3600) - 60) * 1000,
  };
  return tokenCache.token;
}

// CRITICAL: all other Moloni endpoints are POST with form-encoded body
// (JSON returns errors). The access_token goes on the query string.
async function moloniPost(path, body = {}) {
  const token = await getMoloniToken();
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v == null) continue;
    params.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  try {
    const res = await axios.post(
      `${MOLONI_BASE}${path}?access_token=${token}`,
      params,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 401) {
      tokenCache = { token: null, expires: 0, refresh: null };
    }
    throw err;
  }
}

async function getReceipts(year) {
  const companyId = process.env.MOLONI_COMPANY_ID;
  try {
    const data = await moloniPost("/receipts/getAll/", {
      company_id: Number(companyId),
      date_start: `${year}-01-01`,
      date_end: `${year}-12-31`,
      qty: 200,
      offset: 0,
    });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[moloni] getReceipts failed:", err.message);
    return [];
  }
}

async function healthCheck() {
  try {
    await getMoloniToken();
    return true;
  } catch {
    return false;
  }
}

module.exports = { getMoloniToken, moloniPost, getReceipts, healthCheck };
