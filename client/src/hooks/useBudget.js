import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "trnsf_budget_v2";
const UPDATED_AT_KEY = "trnsf_budget_updated_at";

export const FREQUENCIES = [
  { key: "monthly",    label: "Mensal",      occurrences: 12 },
  { key: "quarterly",  label: "Trimestral",  occurrences: 4  },
  { key: "semi_annual",label: "Semestral",   occurrences: 2  },
  { key: "annual",     label: "Anual",       occurrences: 1  },
];

export const MONTHS_ENG = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function getOccurrenceMonths(frequency, start_month = "Jan") {
  const startIdx = MONTHS_ENG.indexOf(start_month);
  if (startIdx === -1) return MONTHS_ENG;
  switch (frequency) {
    case "quarterly":   return [0,3,6,9].map((d) => MONTHS_ENG[(startIdx + d) % 12]);
    case "semi_annual": return [0,6].map((d) => MONTHS_ENG[(startIdx + d) % 12]);
    case "annual":      return [MONTHS_ENG[startIdx]];
    default:            return [...MONTHS_ENG];
  }
}

export function annualOccurrences(frequency) {
  return FREQUENCIES.find((f) => f.key === frequency)?.occurrences ?? 12;
}

export const DEFAULT_BUDGET = {
  annual_goal: 250000,
  monthly_goal: 20833,
  salary: 1114,
  irc_rate: 0.21,
  iva_rate: 0.23, // IVA standard PT — estimativa trimestral
  margin: 1.18,
  fixed_costs: [
    { name: "Leasys Renting", amount: 616,  frequency: "monthly",    start_month: "Jan" },
    { name: "Credibom",       amount: 341,  frequency: "monthly",    start_month: "Jan" },
    { name: "Via Verde",      amount: 79,   frequency: "monthly",    start_month: "Jan" },
    { name: "Tesla",          amount: 10,   frequency: "monthly",    start_month: "Jan" },
    { name: "NBiz",           amount: 369,  frequency: "monthly",    start_month: "Jan" },
    { name: "Comissões",      amount: 65,   frequency: "monthly",    start_month: "Jan" },
    { name: "Generali",       amount: 130,  frequency: "monthly",    start_month: "Jan" },
    { name: "AI/LLM",         amount: 128,  frequency: "monthly",    start_month: "Jan" },
    { name: "Dev Infra",      amount: 110,  frequency: "monthly",    start_month: "Jan" },
    { name: "SaaS",           amount: 101,  frequency: "monthly",    start_month: "Jan" },
    { name: "Moloni",         amount: 62,   frequency: "monthly",    start_month: "Jan" },
    { name: "Subscrições",    amount: 45,   frequency: "monthly",    start_month: "Jan" },
    { name: "Iberdrola",      amount: 15,   frequency: "monthly",    start_month: "Jan" },
  ],
  one_off: {
    May: [{ label: "IRC — Pagamento Por Conta", amount: 5300 }],
    Jun: [{ label: "Financiamento auto (entrada)", amount: 8000 }],
  },
};

// Migrate old {name: amount} object format to new array format
function migrateBudget(parsed) {
  if (parsed.fixed_costs && !Array.isArray(parsed.fixed_costs)) {
    parsed.fixed_costs = Object.entries(parsed.fixed_costs).map(([name, amount]) => ({
      name, amount: Number(amount), frequency: "monthly", start_month: "Jan",
    }));
  }
  return parsed;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Try migrating from old storage key
      const oldRaw = localStorage.getItem("trnsf_budget_v1");
      if (oldRaw) {
        const migrated = migrateBudget({ ...DEFAULT_BUDGET, ...JSON.parse(oldRaw) });
        return { budget: migrated, updated_at: localStorage.getItem(UPDATED_AT_KEY) };
      }
      return { budget: DEFAULT_BUDGET, updated_at: null };
    }
    const parsed = migrateBudget({ ...DEFAULT_BUDGET, ...JSON.parse(raw) });
    return { budget: parsed, updated_at: localStorage.getItem(UPDATED_AT_KEY) };
  } catch {
    return { budget: DEFAULT_BUDGET, updated_at: null };
  }
}

function writeLocal(budget, updated_at) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budget));
    if (updated_at) localStorage.setItem(UPDATED_AT_KEY, updated_at);
    else localStorage.removeItem(UPDATED_AT_KEY);
  } catch {}
}

export function useBudget(authedFetch) {
  const local = readLocal();
  const [budget, setBudgetState] = useState(local.budget);
  const localUpdatedAt = useRef(local.updated_at);

  useEffect(() => {
    if (!authedFetch) return;
    let cancelled = false;
    authedFetch("/api/budget")
      .then((r) => r.json())
      .then(({ budget: serverBudget, updated_at: serverTs }) => {
        if (cancelled || !serverBudget) return;
        const localTs = localUpdatedAt.current;
        if (!localTs || new Date(serverTs) > new Date(localTs)) {
          const merged = migrateBudget({ ...DEFAULT_BUDGET, ...serverBudget });
          writeLocal(merged, serverTs);
          localUpdatedAt.current = serverTs;
          setBudgetState(merged);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [authedFetch]);

  const setBudget = useCallback(async (next) => {
    const resolved = typeof next === "function" ? next(budget) : next;
    const now = new Date().toISOString();
    writeLocal(resolved, now);
    localUpdatedAt.current = now;
    setBudgetState(resolved);
    if (authedFetch) {
      authedFetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget: resolved }),
      }).catch(() => {});
    }
  }, [budget, authedFetch]);

  const resetBudget = useCallback(async () => {
    const now = new Date().toISOString();
    writeLocal(DEFAULT_BUDGET, now);
    localUpdatedAt.current = now;
    setBudgetState(DEFAULT_BUDGET);
    if (authedFetch) {
      authedFetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget: DEFAULT_BUDGET }),
      }).catch(() => {});
    }
  }, [authedFetch]);

  return { budget, setBudget, resetBudget };
}
