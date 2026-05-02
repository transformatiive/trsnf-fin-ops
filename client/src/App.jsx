import React, { useMemo, useState } from "react";
import "./styles.css";
import Login from "./components/Login";
import KpiPills from "./components/KpiPills";
import TabBar from "./components/TabBar";
import Legend from "./components/Legend";
import ActionsTab from "./components/ActionsTab";
import PLTab from "./components/PLTab";
import LicencesTab from "./components/LicencesTab";
import AnalysisPanel from "./components/AnalysisPanel";
import BudgetEditor from "./components/BudgetEditor";
import { useAuth } from "./hooks/useAuth";
import { useDashboard } from "./hooks/useDashboard";
import { useAnalysis } from "./hooks/useAnalysis";
import { useBudget } from "./hooks/useBudget";
import { C } from "./utils/constants";
import { fmt } from "./utils/fmt";

function computeNetResult(data, budget) {
  if (!data || !budget) return 0;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const revenue = MONTHS.reduce(
    (a, m) =>
      a +
      (data.paid?.[m]?.total || 0) +
      (data.billed?.[m]?.total || 0) +
      (data.so_pending?.[m]?.total || 0) +
      (data.licence_pipeline?.by_month?.[m] || 0),
    0
  );
  const OCC = { monthly: 12, quarterly: 4, semi_annual: 2, annual: 1 };
  const fixedCosts = Array.isArray(budget.fixed_costs)
    ? budget.fixed_costs
    : Object.entries(budget.fixed_costs).map(([name, amount]) => ({ name, amount, frequency: "monthly" }));
  const fixed = fixedCosts.reduce((a, c) => a + c.amount * (OCC[c.frequency] ?? 12), 0) + budget.salary * 11;
  let cogs = 0;
  for (const c of data.licence_pipeline?.monthly_clients || []) {
    for (const m of MONTHS) if (c.status[m]) cogs += c.monthly / budget.margin;
  }
  for (const l of data.licence_pipeline?.annual_licences || []) cogs += l.amount / budget.margin;
  const oneOff = MONTHS.reduce((a, m) => a + (budget.one_off[m] || []).reduce((s, x) => s + x.amount, 0), 0);
  const net = revenue - fixed - cogs - oneOff;
  const preTax = Math.max(0, net);
  return Math.round(net - preTax * budget.irc_rate);
}

function Header({ data, lastRefresh, loading, onReload, onLogout, annualGoal }) {
  return (
    <div
      className="header-row"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: C.faint,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Transformatiive Lda
        </div>
        <h1
          style={{
            margin: "0 0 3px",
            fontSize: "clamp(20px, 4vw, 26px)",
            fontWeight: 800,
            letterSpacing: -0.8,
            color: C.text,
            lineHeight: 1.1,
          }}
        >
          Financial Dashboard
        </h1>
        <div style={{ fontSize: 12, color: C.faint }}>
          {data?.fiscal_year || 2026} · Meta anual {fmt(annualGoal)}
          {lastRefresh && (
            <> · Atualizado {new Date(lastRefresh).toLocaleTimeString("pt-PT")}</>
          )}
        </div>
      </div>

      <div className="header-actions" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={onReload}
          disabled={loading}
          style={{
            padding: "8px 14px",
            border: `1.5px solid ${C.borderStrong}`,
            background: C.surface,
            color: C.text,
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "opacity 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "A atualizar…" : "↻ Atualizar"}
        </button>
        <button
          onClick={onLogout}
          style={{
            padding: "8px 14px",
            border: `1.5px solid ${C.border}`,
            background: "transparent",
            color: C.muted,
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div
      style={{
        background: C.text,
        padding: "0 24px",
        height: 3,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
      }}
    />
  );
}

function LoadingScreen({ error }) {
  return (
    <div
      style={{
        padding: "60px 20px",
        textAlign: "center",
        color: C.muted,
      }}
    >
      {error ? (
        <div>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: C.red, fontWeight: 600, fontSize: 15 }}>
            Erro ao carregar dados
          </div>
          <div style={{ fontSize: 13, marginTop: 8, color: C.muted, maxWidth: 340, margin: "8px auto 0" }}>
            {error}
          </div>
          <div style={{ fontSize: 12, marginTop: 8, color: C.faint }}>
            Verifica os secrets do Replit (Zoho, Moloni, OpenRouter).
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>A carregar dados financeiros…</div>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 6 }}>
            Books · Partner Store · Moloni
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { token, checking, error: authError, login, logout, authedFetch } = useAuth();
  const [tab, setTab] = useState("actions");
  const [scenario, setScenario] = useState("base");
  const [budgetEditorOpen, setBudgetEditorOpen] = useState(false);

  const { budget, setBudget } = useBudget(authedFetch);
  const { data, loading, error, lastRefresh, reload } = useDashboard(authedFetch, !!token);
  const analysis = useAnalysis(token, tab === "pl" ? "pl" : "actions", !!token && !!data && tab !== "licences");

  const netResult = useMemo(() => computeNetResult(data, budget), [data, budget]);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontSize: 20 }}>
        …
      </div>
    );
  }

  if (!token) {
    return <Login onLogin={login} error={authError} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingTop: 3 }}>
      <TopBar />
      <div
        className="main-container"
        style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 24px 80px" }}
      >
        <Header
          data={data}
          lastRefresh={lastRefresh}
          loading={loading}
          onReload={reload}
          onLogout={logout}
          annualGoal={budget.annual_goal}
        />

        {data && (
          <div style={{ marginBottom: 24 }}>
            <KpiPills data={data} netResult={netResult} />
          </div>
        )}

        <TabBar tab={tab} setTab={setTab} />

        {!data ? (
          <LoadingScreen error={error} />
        ) : (
          <>
            {tab === "actions" && (
              <>
                <Legend />
                <ActionsTab data={data} />
                <AnalysisPanel
                  tab="actions"
                  text={analysis.text}
                  loading={analysis.loading}
                  error={analysis.error}
                  onReload={analysis.reload}
                />
              </>
            )}
            {tab === "pl" && (
              <>
                <PLTab
                  data={data}
                  scenario={scenario}
                  setScenario={setScenario}
                  budget={budget}
                  onEditBudget={() => setBudgetEditorOpen(true)}
                />
                <AnalysisPanel
                  tab="pl"
                  text={analysis.text}
                  loading={analysis.loading}
                  error={analysis.error}
                  onReload={analysis.reload}
                />
              </>
            )}
            {tab === "licences" && <LicencesTab data={data} />}
          </>
        )}
      </div>

      {budgetEditorOpen && (
        <BudgetEditor
          budget={budget}
          onSave={setBudget}
          onClose={() => setBudgetEditorOpen(false)}
        />
      )}
    </div>
  );
}
