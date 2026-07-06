const books = require("../services/zoho-books");
const partner = require("../services/zoho-partner");
const forex = require("../services/forex");
const config = require("../config");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Cache per fiscal year.
const cacheByYear = new Map(); // year -> { data, expires }
const CACHE_TTL = 5 * 60 * 1000;

function monthIdx(dateStr) {
  if (!dateStr) return -1;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return -1;
  return d.getMonth();
}

function monthKey(dateStr) {
  const i = monthIdx(dateStr);
  return i === -1 ? null : MONTHS[i];
}

function emptyByMonth(extra = {}) {
  const m = {};
  MONTHS.forEach((k) => (m[k] = { total: 0, items: [], ...JSON.parse(JSON.stringify(extra)) }));
  return m;
}

function sumTotals(byMonth) {
  return Math.round(MONTHS.reduce((a, k) => a + (byMonth[k]?.total || 0), 0));
}

// ─── Line-item classification: licença vs serviço ────────────────────────────
function isLicenceText(txt) {
  const t = (txt || "").toLowerCase();
  return config.licence_keywords.some((k) => t.includes(k));
}

function classifyLine(li) {
  const txt = `${li.name || ""} ${li.description || ""} ${li.item_type || ""}`;
  return isLicenceText(txt) ? "licence" : "service";
}

function splitLineItems(lineItems) {
  let services = 0;
  let licences = 0;
  for (const li of lineItems || []) {
    const amt = Number(li.item_total ?? li.total ?? 0);
    if (classifyLine(li) === "licence") licences += amt;
    else services += amt;
  }
  return { services, licences };
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

// ─── FATURAÇÃO (actual invoiced, by invoice date) ────────────────────────────
async function buildInvoiced(year) {
  const invoices = await books.fetchAllInvoices(year).catch(() => []);
  const invoiced = emptyByMonth();
  const paid = emptyByMonth();
  const receivable = { total: 0, overdue: 0, current: 0, by_due_month: emptyByMonth({ overdue: 0 }) };

  const today = new Date();

  for (const inv of invoices) {
    if (inv.customer_name === "TESTE") continue;
    const mk = monthKey(inv.date || inv.invoice_date);
    if (!mk) continue;
    const total = Number(inv.total || 0);
    const balance = Number(inv.balance || 0);
    const status = (inv.status || "").toLowerCase();

    invoiced[mk].total += total;
    invoiced[mk].items.push({
      invoice_id: inv.invoice_id,
      number: inv.invoice_number,
      client: inv.customer_name,
      amount: total,
      balance,
      date: inv.date,
      due_date: inv.due_date,
      status,
    });

    // Cash view: amount actually received = total - balance.
    const received = total - balance;
    if (received > 0) {
      paid[mk].total += received;
      paid[mk].items.push({
        invoice_id: inv.invoice_id,
        number: inv.invoice_number,
        client: inv.customer_name,
        amount: received,
        date: inv.date,
      });
    }

    // AR: outstanding balances.
    if (balance > 0.01) {
      const isOverdue = status === "overdue" || (inv.due_date && new Date(inv.due_date) < today);
      receivable.total += balance;
      if (isOverdue) receivable.overdue += balance;
      else receivable.current += balance;
      const dueMk = monthKey(inv.due_date || inv.date) || mk;
      receivable.by_due_month[dueMk].total += balance;
      if (isOverdue) receivable.by_due_month[dueMk].overdue += balance;
      receivable.by_due_month[dueMk].items.push({
        invoice_id: inv.invoice_id,
        number: inv.invoice_number,
        client: inv.customer_name,
        amount: balance,
        due_date: inv.due_date,
        is_overdue: isOverdue,
      });
    }
  }

  return { invoiced, paid, receivable };
}

// ─── POR FATURAR (open SO backlog, split serviços/licenças) ──────────────────
async function buildToInvoice() {
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

  const filtered = all.filter((so) => {
    const ref = (so.reference_number || "").toUpperCase();
    if (ref.includes("PARTNER")) return false;
    if (so.customer_name === "TESTE") return false;
    return true;
  });

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

  const byMonth = emptyByMonth({ services: 0, licences: 0 });
  const items = [];

  for (const so of detailed) {
    const total = Number(so.total || 0);
    const invoicedAmt = Number(so.invoiced_amount || 0);
    const remaining = total - invoicedAmt;
    if (remaining <= 0.01) continue;

    const mk = monthKey(so.shipment_date || so.date) || monthKey(so.date);
    if (!mk) continue;

    // Split remaining pro-rata by the SO's services/licences composition.
    const { services: svcFull, licences: licFull } = splitLineItems(so.line_items);
    const gross = svcFull + licFull || total;
    const ratioLic = gross > 0 ? licFull / gross : 0;
    const licences = Math.round(remaining * ratioLic * 100) / 100;
    const services = Math.round((remaining - licences) * 100) / 100;

    byMonth[mk].total += remaining;
    byMonth[mk].services += services;
    byMonth[mk].licences += licences;
    const item = {
      salesorder_id: so.salesorder_id,
      so_number: so.salesorder_number,
      client: so.customer_name,
      amount: remaining,
      services,
      licences,
      shipment_date: so.shipment_date,
      desc: buildSoDesc(so.line_items),
    };
    byMonth[mk].items.push(item);
    items.push({ ...item, month: mk });
  }

  return {
    by_month: byMonth,
    items,
    total: sumTotals(byMonth),
    services_total: Math.round(MONTHS.reduce((a, m) => a + byMonth[m].services, 0)),
    licences_total: Math.round(MONTHS.reduce((a, m) => a + byMonth[m].licences, 0)),
  };
}

// ─── RENOVAÇÕES ZOHO (Partner Store) ─────────────────────────────────────────
async function buildLicenceRenewals(booksSoCustomers) {
  const byMonth = {};
  MONTHS.forEach((m) => (byMonth[m] = 0));
  const items = [];
  let alreadyInBooksTotal = 0;

  try {
    const subs = await partner.fetchAllSubscriptions();
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 365);

    for (const sub of subs) {
      const st = (sub.status || "").toLowerCase();
      if (!["live", "active"].includes(st)) continue;

      const renewalRaw =
        sub.next_recurring_date || sub.next_billing_date || sub.renewal_date ||
        sub.expires_on || sub.expiry_date || sub.end_date;
      if (!renewalRaw) continue;
      const d = renewalRaw.includes("T") ? new Date(renewalRaw) : new Date(renewalRaw + "T00:00:00Z");
      if (isNaN(d) || d < now || d > horizon) continue;

      const origCurrency = (sub.currency || "EUR").toUpperCase();
      const origAmount = Number(
        sub.next_recurring_amount || sub.total || sub.amount || sub.net_amount ||
        sub.reseller_price || sub.price || 0
      );
      const resellerPriceEUR = Math.round((await forex.toEUR(origAmount, origCurrency)) * 100) / 100;
      const clientPrice = Math.round(resellerPriceEUR * config.zoho_licence_margin * 100) / 100;
      const mk = MONTHS[d.getUTCMonth()];
      const clientName =
        sub.customer_company_name || sub.customer_name || sub.contact_name ||
        sub.company_name || sub.email_id || sub.email || "—";
      const service =
        sub.service_name || sub.product_name || sub.plan_name || sub.plan_code || sub.service || "—";

      const alreadyInBooks = booksSoCustomers && booksSoCustomers.has(clientName);

      items.push({
        store: sub._store,
        client: clientName,
        service,
        month: mk,
        year: d.getUTCFullYear(),
        amount: clientPrice,
        reseller_price: resellerPriceEUR,
        margin: Math.round((clientPrice - resellerPriceEUR)),
        orig_amount: origAmount,
        orig_currency: origCurrency,
        renewal_date: renewalRaw,
        already_in_books: !!alreadyInBooks,
        status: sub.status || "live",
      });

      // Only count renewals NOT already captured as a Books SO (avoids double count).
      if (alreadyInBooks) {
        alreadyInBooksTotal += clientPrice;
      } else {
        byMonth[mk] += clientPrice;
      }
    }
  } catch (err) {
    console.error("Partner subs error:", err.message);
  }

  return {
    by_month: byMonth,
    items: items.sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)),
    total: Math.round(MONTHS.reduce((a, m) => a + byMonth[m], 0)),
    already_in_books_total: Math.round(alreadyInBooksTotal),
  };
}

// ─── RECORRENTES PREVISTOS (monthly clients, future months not yet invoiced) ─
function buildRecurringForecast(invoiced, year) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentIdx = year < currentYear ? 12 : year > currentYear ? -1 : now.getMonth();

  const matchClient = (key, name) => {
    if (!name) return false;
    const ic = name.toLowerCase();
    if (key === "hifly") return ic.includes("hi fly") || ic.includes("hifly");
    if (key === "unicenter") return ic.includes("unicenter");
    if (key === "yourbranding") return ic.includes("yourbranding") || ic.includes("your orange") || ic.includes("your branding");
    if (key === "art") return ic.includes("automated retail") || ic.includes("automated rt");
    return false;
  };

  const byMonth = {};
  MONTHS.forEach((m) => (byMonth[m] = 0));
  const clients = [];

  for (const c of config.monthly_clients) {
    const startIdx = MONTHS.indexOf(c.start || "Jan");
    const months = {};
    for (let i = 0; i < 12; i++) {
      const m = MONTHS[i];
      if (i < startIdx) { months[m] = null; continue; }
      const invoicedThis = (invoiced[m]?.items || []).some((it) => matchClient(c.key, it.client));
      if (invoicedThis) {
        months[m] = "invoiced"; // already in real faturação — não somar
      } else if (i >= currentIdx) {
        months[m] = "forecast"; // futuro/corrente sem fatura → previsão
        byMonth[m] += c.monthly;
      } else {
        months[m] = "missing"; // passado sem fatura → não faturado (a acompanhar)
      }
    }
    clients.push({ ...c, months });
  }

  return {
    by_month: byMonth,
    clients,
    total: Math.round(MONTHS.reduce((a, m) => a + byMonth[m], 0)),
  };
}

// ─── DESPESA REAL (Books bills + expenses, by date) ──────────────────────────
async function buildExpenses(year) {
  const [bills, expenses] = await Promise.all([
    books.fetchBills(year).catch(() => []),
    books.fetchExpenses(year).catch(() => []),
  ]);

  const byMonth = emptyByMonth({ by_category: {} });

  const add = (mk, amount, category, label, source) => {
    if (!mk || !(amount > 0)) return;
    byMonth[mk].total += amount;
    byMonth[mk].by_category[category] = (byMonth[mk].by_category[category] || 0) + amount;
    byMonth[mk].items.push({ amount, category, label, source });
  };

  for (const b of bills) {
    const mk = monthKey(b.date);
    add(mk, Number(b.total || 0), b.vendor_name || "Fornecedor", b.vendor_name || b.bill_number, "bill");
  }
  for (const e of expenses) {
    const mk = monthKey(e.date);
    const cat = e.account_name || e.category_name || e.paid_through_account_name || "Despesa";
    add(mk, Number(e.total || 0), cat, e.description || cat, "expense");
  }

  // Round category maps.
  for (const m of MONTHS) {
    for (const k of Object.keys(byMonth[m].by_category)) {
      byMonth[m].by_category[k] = Math.round(byMonth[m].by_category[k]);
    }
  }

  return {
    actual_by_month: byMonth,
    actual_total: sumTotals(byMonth),
    bills_count: bills.length,
    expenses_count: expenses.length,
  };
}

// ─── ORCHESTRATION ───────────────────────────────────────────────────────────
async function buildDashboard(year) {
  year = Number(year) || config.fiscal_year;

  const cached = cacheByYear.get(year);
  if (cached && Date.now() < cached.expires) return cached.data;

  const soList = await books.fetchSalesOrders("open").catch(() => []);
  const booksSoCustomers = new Set(soList.map((so) => so.customer_name).filter(Boolean));

  const [{ invoiced, paid, receivable }, to_invoice, licence_renewals, expenses] = await Promise.all([
    buildInvoiced(year),
    buildToInvoice(),
    buildLicenceRenewals(booksSoCustomers),
    buildExpenses(year),
  ]);

  const recurring_forecast = buildRecurringForecast(invoiced, year);

  const totals = {
    invoiced: sumTotals(invoiced),
    paid: sumTotals(paid),
    receivable: Math.round(receivable.total),
    receivable_overdue: Math.round(receivable.overdue),
    to_invoice: to_invoice.total,
    to_invoice_services: to_invoice.services_total,
    to_invoice_licences: to_invoice.licences_total,
    licence_renewals: licence_renewals.total,
    recurring_forecast: recurring_forecast.total,
    expenses_actual: expenses.actual_total,
  };
  // Faturação total prevista (sem sobreposição): já faturado + backlog de SOs +
  // renovações Zoho ainda sem SO + recorrentes previstos para meses futuros.
  totals.forecast_billing =
    totals.invoiced + totals.to_invoice + totals.licence_renewals + totals.recurring_forecast;

  const now = new Date();
  const currentYear = now.getFullYear();
  const available_years = [];
  for (let y = currentYear + 1; y >= currentYear - 2; y--) available_years.push(y);

  const data = {
    refreshed_at: new Date().toISOString(),
    fiscal_year: year,
    available_years,
    months: MONTHS,
    invoiced,
    paid,
    receivable,
    to_invoice,
    licence_renewals,
    recurring_forecast,
    expenses,
    totals,
  };

  cacheByYear.set(year, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

function invalidateCache() {
  cacheByYear.clear();
}

module.exports = { buildDashboard, invalidateCache, MONTHS };
