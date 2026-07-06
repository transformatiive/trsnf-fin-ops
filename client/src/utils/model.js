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

// Central per-month model. Revenue components are non-overlapping by construction
// (see server/api/dashboard.js): invoiced = faturação real; backlog = SOs por
// faturar; renewals = renovações Zoho sem SO; recurring = recorrentes previstos
// para meses futuros ainda não faturados.
export function deriveMonthly(data, budget) {
  const cur = new Date();
  const curYear = cur.getFullYear();
  const curIdx = data.fiscal_year < curYear ? 11 : data.fiscal_year > curYear ? -1 : cur.getMonth();

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

    const expenseActual = data.expenses?.actual_by_month?.[m]?.total || 0;
    const expenseBudget = fixedCostsForMonth(m, budget) + oneOffForMonth(m, budget);

    const isPast = i <= curIdx;
    // Passado/corrente → despesa real do Books (se ainda não sincronizada, cai no orçamento).
    // Futuro → orçamento previsto.
    const expense = isPast ? (expenseActual > 0 ? expenseActual : expenseBudget) : expenseBudget;

    const net = revenue - expense;

    return {
      month: m, i, isPast,
      invoiced, paid,
      backlog, backlogSvc, backlogLic, renewals, recurring,
      revenueActual, revenueForecast, revenue,
      expenseActual, expenseBudget, expense,
      net,
    };
  });

  const sum = (f) => Math.round(rows.reduce((a, r) => a + f(r), 0));
  const totals = {
    invoiced: sum((r) => r.invoiced),
    paid: sum((r) => r.paid),
    revenue: sum((r) => r.revenue),
    revenueActual: sum((r) => r.revenueActual),
    revenueForecast: sum((r) => r.revenueForecast),
    expenseActual: sum((r) => r.expenseActual),
    expenseBudget: sum((r) => r.expenseBudget),
    expense: sum((r) => r.expense),
    net: sum((r) => r.net),
  };

  return { rows, totals, curIdx };
}
