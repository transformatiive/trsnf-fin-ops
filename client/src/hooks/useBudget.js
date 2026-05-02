import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "trnsf_budget_v1";
const UPDATED_AT_KEY = "trnsf_budget_updated_at";

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

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { budget: DEFAULT_BUDGET, updated_at: null };
    return { budget: { ...DEFAULT_BUDGET, ...JSON.parse(raw) }, updated_at: localStorage.getItem(UPDATED_AT_KEY) };
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

  // On mount: background sync — if server has a newer version, pull it in silently
  useEffect(() => {
    if (!authedFetch) return;
    let cancelled = false;
    authedFetch("/api/budget")
      .then((r) => r.json())
      .then(({ budget: serverBudget, updated_at: serverTs }) => {
        if (cancelled || !serverBudget) return;
        const localTs = localUpdatedAt.current;
        // Use server version if it's newer than what's stored locally
        if (!localTs || new Date(serverTs) > new Date(localTs)) {
          const merged = { ...DEFAULT_BUDGET, ...serverBudget };
          writeLocal(merged, serverTs);
          localUpdatedAt.current = serverTs;
          setBudgetState(merged);
        }
      })
      .catch(() => {}); // silent — local fallback is fine
    return () => { cancelled = true; };
  }, [authedFetch]);

  const setBudget = useCallback(async (next) => {
    const resolved = typeof next === "function" ? next(budget) : next;
    const now = new Date().toISOString();
    writeLocal(resolved, now);
    localUpdatedAt.current = now;
    setBudgetState(resolved);
    // Push to server in background (best-effort)
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
