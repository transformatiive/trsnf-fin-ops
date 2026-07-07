const books = require("../services/zoho-books");
const partner = require("../services/zoho-partner");
const crm = require("../services/zoho-crm");
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
// Serviço vence (trabalho não tem COGS), depois licença, senão serviço.
function classifyLine(li) {
  const txt = `${li.name || ""} ${li.description || ""}`.toLowerCase();
  if ((config.service_keywords || []).some((k) => txt.includes(k))) return "service";
  if ((config.licence_keywords || []).some((k) => txt.includes(k))) return "licence";
  return "service";
}

function isOwnEntity(name) {
  const n = (name || "").toLowerCase();
  return (config.own_entity_patterns || []).some((p) => n.includes(p));
}

// Subscrição em que o cliente paga o Zoho diretamente (não é revenda nossa).
function isDirectPay(clientName, serviceName) {
  const c = (clientName || "").toLowerCase();
  const s = (serviceName || "").toLowerCase();
  return (config.direct_pay_rules || []).some((r) => {
    if (r.client && !c.includes(r.client.toLowerCase())) return false;
    if (r.service && !s.includes(r.service.toLowerCase())) return false;
    return true;
  });
}

const MONTHLY_CLIENT_MATCHERS = {
  hifly: (n) => n.includes("hi fly") || n.includes("hifly"),
  unicenter: (n) => n.includes("unicenter"),
  yourbranding: (n) => n.includes("yourbranding") || n.includes("your branding") || n.includes("your orange"),
  art: (n) => n.includes("automated retail") || n.includes("automated rt"),
};
function matchesMonthlyClient(name) {
  const n = (name || "").toLowerCase();
  return config.monthly_clients.some((c) => (MONTHLY_CLIENT_MATCHERS[c.key] || (() => false))(n));
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
async function buildToInvoice(year) {
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

    const dateStr = so.shipment_date || so.date;
    const mk = monthKey(dateStr);
    if (!mk) continue;
    // Só o ano fiscal selecionado (evita SOs de outro ano na vista).
    const soYear = new Date(dateStr).getFullYear();
    if (soYear !== year) continue;

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
const normName = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function buildLicenceRenewals(booksSoCustomers, year) {
  const byMonth = {};              // receita cliente das renovações contadas
  const resellerByMonth = {};      // custo reseller (COGS) dessas mesmas renovações
  MONTHS.forEach((m) => { byMonth[m] = 0; resellerByMonth[m] = 0; });
  const items = [];
  const calendar = [];             // compromissos Zoho próximos 365 dias
  let alreadyInBooksTotal = 0;
  let ownTotal = 0;                // subscrições próprias (custo interno, não receita)
  let recurringOverlapTotal = 0;   // já cobertas por recurring_forecast

  const soNorm = new Set([...(booksSoCustomers || [])].map(normName));

  try {
    const subs = await partner.fetchAllSubscriptions();
    const now = new Date();
    const yStart = new Date(Date.UTC(year, 0, 1));
    const yEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    const lower = now > yStart ? now : yStart; // não incluir renovações já passadas
    const horizon365 = new Date(now.getTime() + 365 * 86400000);

    for (const sub of subs) {
      const st = (sub.status || "").toLowerCase();
      if (!["live", "active"].includes(st)) continue;

      const renewalRaw =
        sub.next_recurring_date || sub.next_billing_date || sub.renewal_date ||
        sub.expires_on || sub.expiry_date || sub.end_date;
      if (!renewalRaw) continue;
      const d = renewalRaw.includes("T") ? new Date(renewalRaw) : new Date(renewalRaw + "T00:00:00Z");
      if (isNaN(d) || d < now) continue; // só renovações futuras

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

      const isOwn = isOwnEntity(clientName);
      const isRecurring = matchesMonthlyClient(clientName);
      const isDirect = isDirectPay(clientName, service);
      const alreadyInBooks = soNorm.has(normName(clientName));

      // Pagamento direto: o cliente paga o Zoho — não é cashflow nosso. Fora do
      // calendário, do COGS e do alerta de gerar SO.
      if (isDirect) continue;

      // Calendário de tesouraria Zoho (próximos 365 dias, independente do ano
      // fiscal): quando pagas ao Zoho vs quanto recebes do cliente.
      if (d <= horizon365) {
        calendar.push({
          date: renewalRaw,
          client: clientName,
          service,
          zoho_out: resellerPriceEUR,        // pagamento ao Zoho (COGS)
          client_in: isOwn ? 0 : clientPrice, // receita do cliente (0 se própria)
          margin: isOwn ? 0 : Math.round(clientPrice - resellerPriceEUR),
          already_in_books: !!alreadyInBooks,
          is_own: isOwn,
          is_recurring: isRecurring,
          orig_currency: origCurrency,
        });
      }

      // Pipeline do ANO fiscal selecionado (corrige o bug das renovações de 2027
      // aparecerem em 2026).
      if (d < lower || d > yEnd) continue;

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
        is_own: isOwn,
        is_recurring: isRecurring,
        counted: !(isOwn || isRecurring || alreadyInBooks),
        status: sub.status || "live",
      });

      // Exclusões (evitam dupla contagem / receita falsa):
      if (isOwn) { ownTotal += clientPrice; continue; }                    // própria empresa
      if (isRecurring) { recurringOverlapTotal += clientPrice; continue; } // já em recurring_forecast
      if (alreadyInBooks) { alreadyInBooksTotal += clientPrice; continue; }// já adjudicado (SO)
      byMonth[mk] += clientPrice;
      resellerByMonth[mk] += resellerPriceEUR;
    }
  } catch (err) {
    console.error("Partner subs error:", err.message);
  }

  return {
    by_month: byMonth,
    reseller_by_month: resellerByMonth,
    items: items.sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)),
    calendar: calendar.sort((a, b) => new Date(a.date) - new Date(b.date)),
    total: Math.round(MONTHS.reduce((a, m) => a + byMonth[m], 0)),
    already_in_books_total: Math.round(alreadyInBooksTotal),
    own_total: Math.round(ownTotal),
    recurring_overlap_total: Math.round(recurringOverlapTotal),
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
// Classifica uma despesa como COGS de licenças (pass-through Zoho) ou opex.
function isCogsExpense(category, label) {
  if ((config.cogs_expense_categories || []).includes(category)) return true;
  const txt = `${category || ""} ${label || ""}`.toLowerCase();
  // Ferramentas próprias → opex (mesmo dentro de "Licenciamento").
  if ((config.opex_software_keywords || []).some((k) => txt.includes(k))) return false;
  if ((config.cogs_label_keywords || []).some((k) => txt.includes(k))) return true;
  return false;
}

async function buildExpenses(year) {
  const [bills, expenses] = await Promise.all([
    books.fetchBills(year).catch(() => []),
    books.fetchExpenses(year).catch(() => []),
  ]);

  const byMonth = emptyByMonth({ by_category: {} });   // total (compat)
  const cogsByMonth = emptyByMonth({ by_category: {} }); // COGS licenças
  const opexByMonth = emptyByMonth({ by_category: {} }); // overhead operacional

  const add = (mk, amount, category, label, source) => {
    if (!mk || !(amount > 0)) return;
    const bucket = isCogsExpense(category, label) ? cogsByMonth : opexByMonth;
    for (const target of [byMonth, bucket]) {
      target[mk].total += amount;
      target[mk].by_category[category] = (target[mk].by_category[category] || 0) + amount;
      target[mk].items.push({ amount, category, label, source });
    }
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

  for (const map of [byMonth, cogsByMonth, opexByMonth]) {
    for (const m of MONTHS) {
      for (const k of Object.keys(map[m].by_category)) {
        map[m].by_category[k] = Math.round(map[m].by_category[k]);
      }
    }
  }

  return {
    actual_by_month: byMonth,
    cogs_by_month: cogsByMonth,
    opex_by_month: opexByMonth,
    actual_total: sumTotals(byMonth),
    cogs_total: sumTotals(cogsByMonth),
    opex_total: sumTotals(opexByMonth),
    bills_count: bills.length,
    expenses_count: expenses.length,
  };
}

// Forecast de compra de licenças ao Zoho (COGS) para meses futuros do ano fiscal.
// = custo reseller das renovações contadas + COGS das licenças em SO + COGS dos
//   recorrentes previstos. Só para meses sem despesa real ainda (futuro).
function buildLicenceCogsForecast(licence_renewals, to_invoice, recurring_forecast, year) {
  const byMonth = {};
  MONTHS.forEach((m) => (byMonth[m] = 0));
  const margin = config.zoho_licence_margin || 1.18;

  for (const m of MONTHS) {
    // Renovações Zoho contadas → custo reseller real.
    byMonth[m] += licence_renewals.reseller_by_month?.[m] || 0;
    // Licenças em SO adjudicadas → COGS = valor licença / margem.
    byMonth[m] += (to_invoice.by_month?.[m]?.licences || 0) / margin;
  }
  // Recorrentes previstos: parte-licença de cada cliente / margem.
  for (const c of recurring_forecast.clients || []) {
    const share = c.licence_share != null ? c.licence_share : 1;
    for (const m of MONTHS) {
      if (c.months[m] === "forecast") byMonth[m] += (c.monthly * share) / margin;
    }
  }
  MONTHS.forEach((m) => (byMonth[m] = Math.round(byMonth[m])));
  return { by_month: byMonth, total: Math.round(MONTHS.reduce((a, m) => a + byMonth[m], 0)) };
}

// ─── DEALS PREVISTOS (CRM, Negociação/Revisão — ainda não adjudicados) ───────
async function buildForecastDeals(year) {
  const deals = await crm.fetchOpenDeals().catch(() => []);
  const stages = config.deal_forecast_stages || [];
  const byMonth = emptyByMonth();
  const items = [];
  let scope_ok = true;

  for (const dl of deals) {
    const stage = (dl.Stage || "").toLowerCase();
    if (/closed|won|lost|ganho|perdido/.test(stage)) continue; // Won→SO, Lost fora
    if (stages.length && !stages.some((s) => stage.includes(s))) continue;
    const amount = Number(dl.Amount || 0);
    if (!(amount > 0)) continue;

    const closing = dl.Closing_Date || null;
    const mk = monthKey(closing);
    const yr = closing ? new Date(closing).getFullYear() : null;
    const client =
      (dl.Account_Name && (dl.Account_Name.name || dl.Account_Name)) || dl.Deal_Name || "—";

    const item = {
      name: dl.Deal_Name,
      client,
      amount,
      stage: dl.Stage,
      probability: dl.Probability != null ? Number(dl.Probability) : null,
      closing_date: closing,
      month: mk,
      year: yr,
    };
    items.push(item);
    if (mk && yr === year) {
      byMonth[mk].total += amount;
      byMonth[mk].items.push(item);
    }
  }

  return {
    by_month: byMonth,
    items: items.sort((a, b) => new Date(a.closing_date || 0) - new Date(b.closing_date || 0)),
    total: sumTotals(byMonth),
    total_all: Math.round(items.reduce((a, d) => a + d.amount, 0)),
    count: items.length,
    scope_ok,
  };
}

// ─── ORCHESTRATION ───────────────────────────────────────────────────────────
async function buildDashboard(year) {
  year = Number(year) || config.fiscal_year;

  const cached = cacheByYear.get(year);
  if (cached && Date.now() < cached.expires) return cached.data;

  const soList = await books.fetchSalesOrders("open").catch(() => []);
  const booksSoCustomers = new Set(soList.map((so) => so.customer_name).filter(Boolean));

  const [{ invoiced, paid, receivable }, to_invoice, licence_renewals, expenses, forecast_deals] = await Promise.all([
    buildInvoiced(year),
    buildToInvoice(year),
    buildLicenceRenewals(booksSoCustomers, year),
    buildExpenses(year),
    buildForecastDeals(year),
  ]);

  const recurring_forecast = buildRecurringForecast(invoiced, year);
  const licence_cogs_forecast = buildLicenceCogsForecast(licence_renewals, to_invoice, recurring_forecast, year);

  const totals = {
    invoiced: sumTotals(invoiced),
    paid: sumTotals(paid),
    receivable: Math.round(receivable.total),
    receivable_overdue: Math.round(receivable.overdue),
    to_invoice: to_invoice.total,
    to_invoice_services: to_invoice.services_total,
    to_invoice_licences: to_invoice.licences_total,
    licence_renewals: licence_renewals.total,
    licence_renewals_own: licence_renewals.own_total,
    recurring_forecast: recurring_forecast.total,
    expenses_actual: expenses.actual_total,
    expenses_cogs: expenses.cogs_total,
    expenses_opex: expenses.opex_total,
    licence_cogs_forecast: licence_cogs_forecast.total,
    forecast_deals: forecast_deals.total,
    forecast_deals_count: forecast_deals.count,
  };
  // Faturação total prevista (sem sobreposição): já faturado + SOs adjudicados +
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
    licence_cogs_forecast,
    forecast_deals,
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
