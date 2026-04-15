const axios = require("axios");

const BOOKS_BASE = "https://www.zohoapis.com/books/v3";
const ACCOUNTS_BASE = "https://accounts.zoho.com";

let tokenCache = { token: null, expires: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expires) {
    return tokenCache.token;
  }

  const res = await axios.post(`${ACCOUNTS_BASE}/oauth/v2/token`, null, {
    params: {
      grant_type: "refresh_token",
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    },
  });

  tokenCache = {
    token: res.data.access_token,
    expires: Date.now() + 3500 * 1000,
  };
  return tokenCache.token;
}

async function booksGet(path, params = {}) {
  const token = await getToken();
  try {
    const res = await axios.get(`${BOOKS_BASE}${path}`, {
      params: {
        organization_id: process.env.ZOHO_ORG_ID,
        ...params,
      },
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 401) {
      tokenCache = { token: null, expires: 0 };
      const token2 = await getToken();
      const res = await axios.get(`${BOOKS_BASE}${path}`, {
        params: {
          organization_id: process.env.ZOHO_ORG_ID,
          ...params,
        },
        headers: { Authorization: `Zoho-oauthtoken ${token2}` },
      });
      return res.data;
    }
    throw err;
  }
}

async function fetchInvoices(status, year) {
  const all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const data = await booksGet("/invoices", {
      status,
      date_start: `${year}-01-01`,
      date_end: `${year}-12-31`,
      per_page: 200,
      page,
    });
    if (data.invoices) all.push(...data.invoices);
    hasMore = data.page_context && data.page_context.has_more_page;
    page += 1;
    if (page > 20) break;
  }
  return all;
}

async function fetchSalesOrders(status) {
  const all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const data = await booksGet("/salesorders", {
      status,
      per_page: 200,
      page,
    });
    if (data.salesorders) all.push(...data.salesorders);
    hasMore = data.page_context && data.page_context.has_more_page;
    page += 1;
    if (page > 20) break;
  }
  return all;
}

async function fetchSalesOrderDetail(soId) {
  const data = await booksGet(`/salesorders/${soId}`);
  return data.salesorder;
}

async function healthCheck() {
  try {
    await getToken();
    await booksGet("/organizations");
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getToken,
  booksGet,
  fetchInvoices,
  fetchSalesOrders,
  fetchSalesOrderDetail,
  healthCheck,
};
