const axios = require("axios");

// Shared refresh-token helper for all three Zoho token families
// (Books, Partner EU, Partner COM). See Credentials Addendum.
const tokenCache = {};

async function getZohoToken(key, accountsUrl, clientId, clientSecret, refreshToken) {
  if (!accountsUrl || !clientId || !clientSecret || !refreshToken) {
    throw new Error(`getZohoToken(${key}): missing credentials`);
  }

  const cached = tokenCache[key];
  if (cached && Date.now() < cached.expires) return cached.token;

  const res = await axios.post(`${accountsUrl}/oauth/v2/token`, null, {
    params: {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    },
  });

  if (!res.data.access_token) {
    throw new Error(`getZohoToken(${key}): no access_token in response — ${JSON.stringify(res.data).slice(0, 200)}`);
  }

  tokenCache[key] = {
    token: res.data.access_token,
    // 60s safety margin before Zoho's declared expiry
    expires: Date.now() + ((res.data.expires_in || 3600) - 60) * 1000,
  };
  return tokenCache[key].token;
}

function invalidateZohoToken(key) {
  delete tokenCache[key];
}

module.exports = { getZohoToken, invalidateZohoToken };
