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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function booksGet(path, params = {}) {
  const c = cfg();
  let lastErr;
  // Até 3 tentativas: 401 → refresh token; transitórios (429/5xx/rede/timeout)
  // → backoff. Evita que uma falha momentânea do Zoho devolva dados vazios
  // (que depois ficariam em cache 5 min).
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const token = await getToken();
      const res = await axios.get(`${c.base}${path}`, {
        params: { organization_id: c.orgId, ...params },
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        timeout: 20000,
      });
      return res.data;
    } catch (err) {
      lastErr = err;
      const status = err.response && err.response.status;
      if (status === 401) {
        invalidateZohoToken("books");
        continue; // novo token na próxima tentativa
      }
      const transient = !status || status === 429 || status >= 500 || err.code === "ECONNABORTED" || err.code === "ETIMEDOUT";
      if (transient && attempt < 2) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function fetchInvoices(status, year) {
  const all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const params = {
      date_start: `${year}-01-01`,
      date_end: `${year}-12-31`,
      per_page: 200,
      page,
    };
    // status omitted → all invoices for the period (used for actual faturação)
    if (status && status !== "all") params.status = status;
    const data = await booksGet("/invoices", params);
    if (data.invoices) all.push(...data.invoices);
    hasMore = data.page_context && data.page_context.has_more_page;
    page += 1;
    if (page > 20) break;
  }
  return all;
}

// All non-draft, non-void invoices issued in the year — the source of truth for
// "faturação" (invoiced revenue), regardless of payment state.
async function fetchAllInvoices(year) {
  const all = await fetchInvoices("all", year);
  return all.filter((inv) => !["draft", "void"].includes((inv.status || "").toLowerCase()));
}

// Vendor bills (accounts payable) for the year — real expense side.
async function fetchBills(year) {
  const all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const data = await booksGet("/bills", {
      date_start: `${year}-01-01`,
      date_end: `${year}-12-31`,
      per_page: 200,
      page,
    });
    if (data.bills) all.push(...data.bills);
    hasMore = data.page_context && data.page_context.has_more_page;
    page += 1;
    if (page > 20) break;
  }
  return all.filter((b) => !["draft", "void"].includes((b.status || "").toLowerCase()));
}

// Direct expenses (petty cash, cards, etc.) for the year.
async function fetchExpenses(year) {
  const all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const data = await booksGet("/expenses", {
      date_start: `${year}-01-01`,
      date_end: `${year}-12-31`,
      per_page: 200,
      page,
    });
    if (data.expenses) all.push(...data.expenses);
    hasMore = data.page_context && data.page_context.has_more_page;
    page += 1;
    if (page > 20) break;
  }
  return all.filter((e) => (e.status || "").toLowerCase() !== "void");
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

async function fetchInvoiceDetail(invId) {
  const data = await booksGet(`/invoices/${invId}`);
  return data.invoice;
}

// Corre uma lista de tarefas async com concorrência limitada (evita rajadas
// que rebentem o rate-limit do Zoho).
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
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
  fetchAllInvoices,
  fetchBills,
  fetchExpenses,
  fetchSalesOrders,
  fetchSalesOrderDetail,
  fetchInvoiceDetail,
  mapLimit,
  healthCheck,
};
