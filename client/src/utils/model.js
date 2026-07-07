import { MONTHS } from "./constants";
import { getOccurrenceMonths } from "../hooks/useBudget";

// Salário: pago a partir de Fevereiro (índice 1).
const SALARY_START_IDX = 1;

export function fixedCostsForMonth(m, budget) {
  const costs = Array.isArray(budget.fixed_costs)
    ? budget.fixed_costs
    : Object.entries(budget.fixed_costs).map(([name, amount]) => ({ name, amount, frequency: "monthly", start_month: "Jan" }));
  const base = costs.reduce((a, c) => {
    const months = getOccurrenceMonths(c.frequency || "monthly", c.start_month || "Jan");
    return a + (months.includes(m) ? Number(c.amount) : 0);
  }, 0);
  const idx = MONTHS.indexOf(m);
  const salary = idx >= SALARY_START_IDX ? (budget.salary || 0) : 0;
  return base + salary;
}

export function oneOffForMonth(m, budget) {
  return (budget.one_off?.[m] || []).reduce((a, x) => a + Number(x.amount || 0), 0);
}

// Custos SEM IVA dedutível (não entram na base de dedução do IVA): financiamento
// (juros isentos), leasing financeiro, seguros (isentos), salários, impostos,
// encargos bancários. Renting operacional e eletricidade TÊM IVA (não excluídos).
const IVA_NONDEDUCTIBLE = [
  "credibom", "financiamento", "prestaç", "leasing", "seguro", "generali",
  "imposto", "salár", "banco", "juros",
];
function isVatable(name) {
  const n = (name || "").toLowerCase();
  return !IVA_NONDEDUCTIBLE.some((k) => n.includes(k));
}

// Opex com IVA dedutível no mês (exclui salário e rubricas sem IVA).
export function vatableOpexForMonth(m, budget) {
  const costs = Array.isArray(budget.fixed_costs)
    ? budget.fixed_costs
    : Object.entries(budget.fixed_costs).map(([name, amount]) => ({ name, amount, frequency: "monthly", start_month: "Jan" }));
  return costs.reduce((a, c) => {
    if (!isVatable(c.name)) return a;
    const months = getOccurrenceMonths(c.frequency || "monthly", c.start_month || "Jan");
    return a + (months.includes(m) ? Number(c.amount) : 0);
  }, 0);
}

// Central per-month model. Revenue components are non-overlapping by construction
// (see server/api/dashboard.js): invoiced = faturação real; backlog = SOs por
// faturar; renewals = renovações Zoho sem SO; recurring = recorrentes previstos
// para meses futuros ainda não faturados.
export function deriveMonthly(data, budget) {
  const cur = new Date();
  const curYear = cur.getFullYear();
  const curIdx = data.fiscal_year < curYear ? 11 : data.fiscal_year > curYear ? -1 : cur.getMonth();

  // Run-rate real de opex a partir dos meses COMPLETOS já passados (exclui o mês
  // corrente parcial). Baseline do opex futuro = mediana desses meses, sem a
  // rubrica de impostos (que já entra na linha de IVA). Mais fiel que o orçamento
  // fixo. vatableBaseline = idem, mas só rubricas com IVA dedutível.
  const median = (arr) => {
    if (!arr.length) return null;
    const s = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return Math.round(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
  };
  const isTaxCat = (k) => /imposto/i.test(k);
  const isNonVatCat = (k) => /imposto|seguro|financ|credibom|banco|leasing|juros/i.test(k);
  const pastOpex = [];
  const pastVat = [];
  for (let i = 0; i < curIdx; i++) { // só meses completos anteriores ao atual
    const bc = data.expenses?.opex_by_month?.[MONTHS[i]]?.by_category || {};
    const total = data.expenses?.opex_by_month?.[MONTHS[i]]?.total || 0;
    if (total <= 0) continue;
    const exTax = Object.entries(bc).reduce((a, [k, v]) => a + (isTaxCat(k) ? 0 : v), 0);
    const vat = Object.entries(bc).reduce((a, [k, v]) => a + (isNonVatCat(k) ? 0 : v), 0);
    pastOpex.push(exTax);
    pastVat.push(vat);
  }
  const opexBaseline = median(pastOpex);       // opex previsto/mês (futuro)
  const vatableBaseline = median(pastVat);     // base de IVA/mês (futuro)

  const rows = MONTHS.map((m, i) => {
    const invoiced = data.invoiced?.[m]?.total || 0;
    const paid = data.paid?.[m]?.total || 0;
    const backlog = data.to_invoice?.by_month?.[m]?.total || 0;
    const backlogSvc = data.to_invoice?.by_month?.[m]?.services || 0;
    const backlogLic = data.to_invoice?.by_month?.[m]?.licences || 0;
    const renewals = data.licence_renewals?.by_month?.[m] || 0;
    const recurring = data.recurring_forecast?.by_month?.[m] || 0;

    const revenueActual = invoiced;
    const revenueForecast = backlog + renewals + recurring;
    const revenue = revenueActual + revenueForecast;

    // Despesa separada: COGS de licenças (compra ao Zoho) vs opex operacional.
    const cogsActual = data.expenses?.cogs_by_month?.[m]?.total || 0;
    const opexActual = data.expenses?.opex_by_month?.[m]?.total || 0;
    const cogsForecast = data.licence_cogs_forecast?.by_month?.[m] || 0;
    const opexBudget = fixedCostsForMonth(m, budget) + oneOffForMonth(m, budget);

    const isPast = i <= curIdx;
    // Passado/corrente → real do Books (se não sincronizado, cai no orçamento).
    // Futuro → run-rate real (mediana dos meses completos) + saídas pontuais do
    // orçamento; cai no orçamento fixo só se ainda não houver histórico.
    const opexForecast = (opexBaseline != null ? opexBaseline : fixedCostsForMonth(m, budget)) + oneOffForMonth(m, budget);
    const opex = isPast ? (opexActual > 0 ? opexActual : opexBudget) : opexForecast;
    const cogs = isPast ? cogsActual : cogsForecast;
    const expense = opex + cogs;

    const net = revenue - expense;
    const grossMargin = revenue - cogs; // margem antes de overhead
    // Base de IVA: opex com IVA (futuro = run-rate vatable; passado usa real).
    const vatableOpex = isPast ? opex : (vatableBaseline != null ? vatableBaseline : vatableOpexForMonth(m, budget));

    return {
      month: m, i, isPast,
      invoiced, paid,
      backlog, backlogSvc, backlogLic, renewals, recurring,
      revenueActual, revenueForecast, revenue,
      cogsActual, opexActual, cogsForecast, opexBudget,
      opex, cogs, vatableOpex, iva: 0, expense, net, grossMargin,
    };
  });

  // IVA estimado (regime trimestral PT, 23%). Base ≈ valor acrescentado do
  // trimestre (faturação − COGS − opex). Pago em Mai(Q1)/Ago(Q2)/Nov(Q3);
  // Q4 paga em Fev do ano seguinte (fora desta vista). Só previsto para meses
  // futuros — o passado já traz "Impostos a pagar" real no opex.
  const ivaRate = budget.iva_rate ?? 0.23;
  const quarters = [
    { months: [0, 1, 2], pay: 4 },   // Q1 → Maio
    { months: [3, 4, 5], pay: 7 },   // Q2 → Agosto
    { months: [6, 7, 8], pay: 10 },  // Q3 → Novembro
  ];
  for (const q of quarters) {
    if (q.pay <= curIdx) continue; // pagamento já passado → real no opex
    // Base ≈ valor acrescentado: faturação − COGS − opex COM IVA (exclui
    // financiamento/seguros/salário, que não têm IVA dedutível).
    const base = q.months.reduce((a, i) => a + (rows[i].revenue - rows[i].cogs - rows[i].vatableOpex), 0);
    // Ajustes manuais de IVA (deduções pontuais, ex.: compra de capital) no trimestre.
    const adj = q.months.reduce(
      (a, i) => a + (budget.iva_adjustments?.[MONTHS[i]] || []).reduce((s, x) => s + Number(x.amount || 0), 0),
      0
    );
    const iva = Math.max(0, Math.round(ivaRate * base - adj));
    const r = rows[q.pay];
    r.iva = iva;
    r.expense += iva;
    r.net -= iva;
  }

  const sum = (f) => Math.round(rows.reduce((a, r) => a + f(r), 0));
  const totals = {
    invoiced: sum((r) => r.invoiced),
    paid: sum((r) => r.paid),
    revenue: sum((r) => r.revenue),
    revenueActual: sum((r) => r.revenueActual),
    revenueForecast: sum((r) => r.revenueForecast),
    cogs: sum((r) => r.cogs),
    opex: sum((r) => r.opex),
    iva: sum((r) => r.iva),
    expense: sum((r) => r.expense),
    grossMargin: sum((r) => r.grossMargin),
    net: sum((r) => r.net),
  };

  return { rows, totals, curIdx };
}
