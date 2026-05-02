import { useCallback, useState } from "react";

const STORAGE_KEY = "trnsf_budget_v1";

export const DEFAULT_BUDGET = {
  annual_goal: 250000,
  monthly_goal: 20833,
  salary: 1114,
  irc_rate: 0.21,
  margin: 1.18,
  fixed_costs: {
    "Leasys Renting": 616,
    "Credibom": 341,
    "Via Verde": 79,
    "Tesla": 10,
    "NBiz": 369,
    "Comissões": 65,
    "Generali": 130,
    "AI/LLM": 128,
    "Dev Infra": 110,
    "SaaS": 101,
    "Moloni": 62,
    "Subscrições": 45,
    "Iberdrola": 15,
  },
  one_off: {
    May: [{ label: "IRC — Pagamento Por Conta", amount: 5300 }],
    Jun: [{ label: "Financiamento auto (entrada)", amount: 8000 }],
  },
};

function readBudget() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BUDGET;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_BUDGET, ...parsed };
  } catch {
    return DEFAULT_BUDGET;
  }
}

function writeBudget(b) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {}
}

export function useBudget() {
  const [budget, setBudgetState] = useState(() => readBudget());

  const setBudget = useCallback((next) => {
    const resolved = typeof next === "function" ? next(budget) : next;
    writeBudget(resolved);
    setBudgetState(resolved);
  }, [budget]);

  const resetBudget = useCallback(() => {
    writeBudget(DEFAULT_BUDGET);
    setBudgetState(DEFAULT_BUDGET);
  }, []);

  return { budget, setBudget, resetBudget };
}
