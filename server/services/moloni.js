const axios = require("axios");

const MOLONI_BASE = "https://api.moloni.pt/v1";

let tokenCache = { token: null, expires: 0 };

async function getMoloniToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) {
    return tokenCache.token;
  }

  const params = new URLSearchParams({
    grant_type: "password",
    client_id: process.env.MOLONI_CLIENT_ID,
    client_secret: process.env.MOLONI_CLIENT_SECRET,
    username: process.env.MOLONI_USERNAME,
    password: process.env.MOLONI_PASSWORD,
  });

  // CRITICAL: Moloni requires GET for the grant endpoint
  const res = await axios.get(`${MOLONI_BASE}/grant/?${params}`);

  tokenCache = {
    token: res.data.access_token,
    expires: Date.now() + (res.data.expires_in ? res.data.expires_in * 1000 : 3500 * 1000),
  };
  return tokenCache.token;
}

async function getReceipts(year) {
  const token = await getMoloniToken();
  const companyId = process.env.MOLONI_COMPANY_ID;

  try {
    const res = await axios.post(
      `${MOLONI_BASE}/receipts/getAll/?access_token=${token}`,
      {
        company_id: Number(companyId),
        date_start: `${year}-01-01`,
        date_end: `${year}-12-31`,
        qty: 200,
        offset: 0,
      }
    );
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    if (err.response && err.response.status === 401) {
      tokenCache = { token: null, expires: 0 };
    }
    console.error("Moloni getReceipts failed:", err.message);
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

module.exports = { getMoloniToken, getReceipts, healthCheck };
