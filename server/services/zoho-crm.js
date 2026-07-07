const axios = require("axios");
const books = require("./zoho-books");

// Zoho CRM (mesma org .com que o Books). Reutiliza o token do Books — requer que
// o refresh token tenha scope de CRM (ZohoCRM.modules.deals.READ). Se não tiver,
// as chamadas devolvem OAUTH_SCOPE_MISMATCH e degradamos para [].
const API_BASE = process.env.ZOHO_API_BASE || "https://www.zohoapis.com";

async function crmGet(path, params = {}) {
  const token = await books.getToken();
  const url = `${API_BASE}/crm/v2${path}`;
  try {
    const res = await axios.get(url, {
      params,
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    return res.data;
  } catch (err) {
    const status = err.response?.status;
    const body = JSON.stringify(err.response?.data || {}).slice(0, 200);
    if (status === 204) return { data: [] }; // no content
    console.error(`[zoho-crm] GET ${path} failed: HTTP ${status} ${body}`);
    throw err;
  }
}

// Deals abertos (não fechados). Paginado.
async function fetchOpenDeals() {
  const all = [];
  let page = 1;
  let more = true;
  while (more) {
    let data;
    try {
      data = await crmGet("/Deals", {
        fields: "Deal_Name,Stage,Amount,Closing_Date,Account_Name,Probability,Currency",
        per_page: 200,
        page,
      });
    } catch {
      break; // scope/permission — degrada
    }
    if (data && Array.isArray(data.data)) all.push(...data.data);
    more = !!(data && data.info && data.info.more_records);
    page += 1;
    if (page > 10) break;
  }
  return all;
}

async function healthCheck() {
  try {
    await crmGet("/Deals", { per_page: 1 });
    return true;
  } catch {
    return false;
  }
}

module.exports = { crmGet, fetchOpenDeals, healthCheck };
