const books = require("../services/zoho-books");
const moloni = require("../services/moloni");
const partner = require("../services/zoho-partner");
const forex = require("../services/forex");
const config = require("../config");
const CLIENT_MAP = require("../client-map");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let cache = { data: null, expires: 0 };
const CACHE_TTL = 5 * 60 * 1000;

function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return MONTHS[d.getMonth()];
}

function bucketMonthForOverdue(dateStr, today = new Date()) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  if (d < today) return MONTHS[today.getMonth()];
  return MONTHS[d.getMonth()];
}

function emptyMonthMap() {
  const m = {};
  MONTHS.forEach((k) => (m[k] = { total: 0, items: [] }));
  return m;
}

function sumMonthMap(m) {
  let t = 0;
  for (const k of Object.keys(m)) t += m[k].total || 0;
  return Math.round(t);
}

function buildSoDesc(lineItems) {
  if (!lineItems || !lineItems.length) return "";
  const descs = lineItems
    .map((li) => (li.description || li.name || "").trim().slice(0, 45))
    .filter(Boolean)
    .slice(0, 2);
  const suffix = lineItems.length > 2 ? ` +${lineItems.length - 2}` : "";
  return descs.join(" · ") + suffix;
}

async function buildPaid(year, receipts) {
  const paid = await books.fetchInvoices("paid", year).catch(() => []);
  const byMonth = emptyMonthMap();
  const receiptedInvoiceIds = new Set();
  if (Array.isArray(receipts)) {
    for (const r of receipts) {
      const docs = r.associated_documents || r.documents || [];
      for (const doc of docs) {
        if (doc.reference) receiptedInvoiceIds.add(String(doc.reference));
        if (doc.number) receiptedInvoiceIds.add(String(doc.number));
      }
    }
  }

  for (const inv of paid) {
    if (inv.customer_name === "TESTE") continue;
    const mk = monthKey(inv.date || inv.invoice_date);
    if (!mk) continue;
    const amount = Number(inv.total || 0);
    byMonth[mk].total += amount;
    byMonth[mk].items.push({
      invoice_id: inv.invoice_id,
      number: inv.invoice_number,
      client: inv.customer_name,
      amount,
      date: inv.date,
      receipted: receiptedInvoiceIds.has(String(inv.invoice_number)),
      moloni_id: CLIENT_MAP[inv.customer_name]?.moloni_id || null,
    });
  }
  return byMonth;
}

async function buildBilled(year) {
  const today = new Date();
  const [unpaid, overdue] = await Promise.all([
    books.fetchInvoices("unpaid", year).catch(() => []),
    books.fetchInvoices("overdue", year).catch(() => []),
  ]);

  const seen = new Set();
  const all = [];
  for (const inv of [...unpaid, ...overdue]) {
    if (seen.has(inv.invoice_id)) continue;
    seen.add(inv.invoice_id);
    all.push(inv);
  }

  const byMonth = emptyMonthMap();
  for (const inv of all) {
    if (inv.customer_name === "TESTE") continue;
    const mk = bucketMonthForOverdue(inv.due_date || inv.date, today);
    if (!mk) continue;
    const amount = Number(inv.balance || inv.total || 0);
    byMonth[mk].total += amount;
    byMonth[mk].items.push({
      invoice_id: inv.invoice_id,
      number: inv.invoice_number,
      client: inv.customer_name,
      amount,
      due_date: inv.due_date,
      status: inv.status,
      is_overdue: inv.status === "overdue",
    });
  }
  return byMonth;
}

async function buildSoPending() {
  const today = new Date();
  const [open, partial] = await Promise.all([
    books.fetchSalesOrders("open").catch(() => []),
    books.fetchSalesOrders("partially_invoiced").catch(() => []),
  ]);

  const seen = new Set();
  const all = [];
  for (const so of [...open, ...partial]) {
    if (seen.has(so.salesorder_id)) continue;
    seen.add(so.salesorder_id);
    all.push(so);
  }

  // Filter out partner & TESTE
  const filtered = all.filter((so) => {
    const ref = (so.reference_number || "").toUpperCase();
    if (ref.includes("PARTNER")) return false;
    if (so.customer_name === "TESTE") return false;
    return true;
  });

  // Fetch line items detail in parallel (limit concurrency)
  const detailed = await Promise.all(
    filtered.map(async (so) => {
      try {
        const d = await books.fetchSalesOrderDetail(so.salesorder_id);
        return { ...so, line_items: d?.line_items || [] };
      } catch {
        return { ...so, line_items: [] };
      }
    })
  );

  const byMonth = emptyMonthMap();
  for (const so of detailed) {
    const remaining = Number(so.total || 0) - Number(so.invoiced_amount || 0);
    if (remaining <= 0) continue;
    const mk = bucketMonthForOverdue(so.shipment_date || so.date, today);
    if (!mk) continue;
    byMonth[mk].total += remaining;
    byMonth[mk].items.push({
      salesorder_id: so.salesorder_id,
      so_number: so.salesorder_number,
      client: so.customer_name,
      amount: remaining,
      shipment_date: so.shipment_date,
      desc: buildSoDesc(so.line_items),
    });
  }
  return byMonth;
}

async function buildLicencePipeline(year, booksSoNumbers) {
  const pipeline = {
    monthly_clients: [],
    annual_licences: [],
    by_month: {},
  };
  MONTHS.forEach((m) => (pipeline.by_month[m] = 0));

  // MONTHLY CLIENTS — derive status per month via Books invoices lookup
  // Status is populated by caller (needs invoice context); keep structure for now
  for (const c of config.monthly_clients) {
    const startIdx = MONTHS.indexOf(c.start || "Jan");
    const status = {};
    for (let i = 0; i < 12; i++) {
      status[MONTHS[i]] = i < startIdx ? null : "pending";
    }
    pipeline.monthly_clients.push({
      ...c,
      status,
    });
  }

  // ANNUAL RENEWALS from Partner Store
  try {
    const subs = await partner.fetchAllSubscriptions();
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 365);

    let included = 0;
    for (const sub of subs) {
      // Only include active subscriptions (Zoho status "live")
      const st = (sub.status || "").toLowerCase();
      if (!["live", "active"].includes(st)) continue;

      // Partner Store uses next_recurring_date as the renewal date field
      const renewalRaw =
        sub.next_recurring_date ||
        sub.next_billing_date ||
        sub.renewal_date ||
        sub.expires_on ||
        sub.expiry_date ||
        sub.end_date;
      if (!renewalRaw) continue;
      // Zoho dates are YYYY-MM-DD — parse as UTC midnight to avoid timezone shift
      const d = renewalRaw.includes("T") ? new Date(renewalRaw) : new Date(renewalRaw + "T00:00:00Z");
      if (isNaN(d) || d < now || d > horizon) continue;

      const origCurrency = (sub.currency || "EUR").toUpperCase();
      const origAmount = Number(
        sub.next_recurring_amount ||
          sub.total ||
          sub.amount ||
          sub.net_amount ||
          sub.reseller_price ||
          sub.price ||
          0
      );
      // Convert reseller price to EUR at today's live rate
      const resellerPriceEUR = Math.round((await forex.toEUR(origAmount, origCurrency)) * 100) / 100;
      const clientPrice = Math.round(resellerPriceEUR * config.zoho_licence_margin * 100) / 100;
      const mk = MONTHS[d.getMonth()];
      // Partner Store uses customer_company_name
      const clientName =
        sub.customer_company_name ||
        sub.customer_name ||
        sub.contact_name ||
        sub.company_name ||
        sub.email_id ||
        sub.email ||
        "—";
      const service =
        sub.service_name || sub.product_name || sub.plan_name || sub.plan_code || sub.service || "—";

      const soMatch = booksSoNumbers && booksSoNumbers.has(clientName);

      // e.g. "2026-04" for April 2026 — used to group on the client
      const month_key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

      pipeline.annual_licences.push({
        store: sub._store,
        client: clientName,
        service,
        month: mk,
        month_key,
        year: d.getUTCFullYear(),
        amount: clientPrice,
        reseller_price: resellerPriceEUR,
        orig_amount: origAmount,
        orig_currency: origCurrency,
        renewal_date: renewalRaw,
        already_in_books: !!soMatch,
        status: sub.status || "live",
      });

      pipeline.by_month[mk] = (pipeline.by_month[mk] || 0) + clientPrice;
      included++;
    }
    console.log(`[partner] ${subs.length} subs fetched, ${included} within 365-day horizon`);
  } catch (err) {
    console.error("Partner subs error:", err.message);
  }

  // Add monthly clients to by_month
  for (const c of pipeline.monthly_clients) {
    const startIdx = MONTHS.indexOf(c.start || "Jan");
    for (let i = 0; i < 12; i++) {
      if (i < startIdx) continue;
      pipeline.by_month[MONTHS[i]] = (pipeline.by_month[MONTHS[i]] || 0) + c.monthly;
    }
  }

  return pipeline;
}

function deriveMonthlyClientStatus(pipeline, paidData, billedData) {
  // Given paid+billed invoice lists, set status for each (client, month) pair
  const matchClient = (clientKey, invoiceClient) => {
    if (!invoiceClient) return false;
    const ic = invoiceClient.toLowerCase();
    if (clientKey === "hifly") return ic.includes("hi fly");
    if (clientKey === "unicenter") return ic.includes("unicenter");
    if (clientKey === "yourbranding") return ic.includes("yourbranding") || ic.includes("your orange");
    if (clientKey === "art") return ic.includes("automated retail") || ic.includes("automated rt");
    return false;
  };

  for (const c of pipeline.monthly_clients) {
    for (const m of MONTHS) {
      if (c.status[m] === null) continue;
      // check paid
      const paidItems = paidData[m]?.items || [];
      if (paidItems.some((it) => matchClient(c.key, it.client))) {
        c.status[m] = "paid";
        continue;
      }
      const billedItems = billedData[m]?.items || [];
      if (billedItems.some((it) => matchClient(c.key, it.client))) {
        c.status[m] = "billed";
        continue;
      }
      // otherwise pending (default)
    }
  }
}

function buildArSummary(billed) {
  const today = new Date();
  let overdue = 0;
  let dueFuture = 0;
  for (const mk of MONTHS) {
    for (const it of billed[mk]?.items || []) {
      if (it.is_overdue) overdue += it.amount;
      else dueFuture += it.amount;
    }
  }
  return {
    total: Math.round(overdue + dueFuture),
    overdue: Math.round(overdue),
    due_future: Math.round(dueFuture),
  };
}

async function buildDashboard() {
  if (cache.data && Date.now() < cache.expires) {
    return cache.data;
  }

  const year = config.fiscal_year;

  const [receipts, soList] = await Promise.all([
    moloni.getReceipts(year).catch(() => []),
    books.fetchSalesOrders("open").catch(() => []),
  ]);

  const booksSoNumbers = new Set(soList.map((so) => so.customer_name).filter(Boolean));

  const [paid, billed, so_pending, licence_pipeline] = await Promise.all([
    buildPaid(year, receipts),
    buildBilled(year),
    buildSoPending(),
    buildLicencePipeline(year, booksSoNumbers),
  ]);

  deriveMonthlyClientStatus(licence_pipeline, paid, billed);

  const ar_summary = buildArSummary(billed);
  const ytd_paid = sumMonthMap(paid);

  const data = {
    refreshed_at: new Date().toISOString(),
    fiscal_year: year,
    paid,
    billed,
    so_pending,
    licence_pipeline,
    ar_summary,
    ytd_paid,
    totals: {
      paid: sumMonthMap(paid),
      billed: sumMonthMap(billed),
      so_pending: sumMonthMap(so_pending),
      licence_pipeline: Object.values(licence_pipeline.by_month).reduce((a, b) => a + b, 0),
    },
  };

  cache = { data, expires: Date.now() + CACHE_TTL };
  return data;
}

function invalidateCache() {
  cache = { data: null, expires: 0 };
}

module.exports = { buildDashboard, invalidateCache, MONTHS };
