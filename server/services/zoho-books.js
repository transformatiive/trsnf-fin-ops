const axios = require("axios");
const { getZohoToken, invalidateZohoToken } = require("./zoho-auth");

// Transformatiive is on the .com datacenter (not .eu).
const DEFAULT_API_BASE = "https://www.zohoapis.com";
const DEFAULT_ACCOUNTS_URL = "https://accounts.zoho.com";

function cfg() {
  return {
    base: (process.env.ZOHO_API_BASE || DEFAULT_API_BASE) + "/books/v3",
    accountsUrl: process.env.ZOHO_ACCOUNTS_URL || DEFAULT_ACCOUNTS_URL,
    clientId: process.env.ZOHO_CLIENT_ID,
    clientSecret: process.env.ZOHO_CLIENT_SECRET,
    refreshToken: process.env.ZOHO_REFRESH_TOKEN,
    orgId: process.env.ZOHO_ORG_ID,
  };
}

async function getToken() {
  const c = cfg();
  return getZohoToken("books", c.accountsUrl, c.clientId, c.clientSecret, c.refreshToken);
}

async function booksGet(path, params = {}) {
  const c = cfg();
  const token = await getToken();
  try {
    const res = await axios.get(`${c.base}${path}`, {
      params: { organization_id: c.orgId, ...params },
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    return res.data;
  } catch (err) {
    if (err.response && err.response.status === 401) {
      invalidateZohoToken("books");
      const token2 = await getToken();
      const res = await axios.get(`${c.base}${path}`, {
        params: { organization_id: c.orgId, ...params },
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
