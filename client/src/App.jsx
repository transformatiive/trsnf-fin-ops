import React, { useMemo, useState } from "react";
import "./styles.css";
import KpiPills from "./components/KpiPills";
import TabBar from "./components/TabBar";
import CashflowTab from "./components/CashflowTab";
import BacklogTab from "./components/BacklogTab";
import TimingTab from "./components/TimingTab";
import LicencesTab from "./components/LicencesTab";
import AnalysisPanel from "./components/AnalysisPanel";
import BudgetEditor from "./components/BudgetEditor";
import { useAuth } from "./hooks/useAuth";
import { useDashboard } from "./hooks/useDashboard";
import { useAnalysis } from "./hooks/useAnalysis";
import { useBudget } from "./hooks/useBudget";
import { C } from "./utils/constants";
import { fmt } from "./utils/fmt";
import { deriveMonthly } from "./utils/model";

function YearSelector({ years, year, setYear }) {
  if (!years || years.length < 2) return null;
  return (
    <select
      value={year}
      onChange={(e) => setYear(Number(e.target.value))}
      style={{ padding: "8px 10px", border: `1.5px solid ${C.border}`, background: C.surface, color: C.text, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
    >
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
  );
}

function Header({ data, lastRefresh, loading, onReload, annualGoal, onEditBudget, year, setYear }) {
  return (
    <div className="header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          Transformatiive Lda
        </div>
        <h1 style={{ margin: "0 0 3px", fontSize: "clamp(20px, 4vw, 26px)", fontWeight: 800, letterSpacing: -0.8, color: C.text, lineHeight: 1.1 }}>
          Financial Dashboard
        </h1>
        <div style={{ fontSize: 12, color: C.faint }}>
          {data?.fiscal_year || year} · Meta anual {fmt(annualGoal)}
          {lastRefresh && <> · Atualizado {new Date(lastRefresh).toLocaleTimeString("pt-PT")}</>}
        </div>
      </div>

      <div className="header-actions" style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
        <YearSelector years={data?.available_years} year={year} setYear={setYear} />
        <button onClick={onEditBudget} style={{ padding: "8px 14px", border: `1.5px solid ${C.border}`, background: C.surface, color: C.muted, borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
          ✏️ Orçamento
        </button>
        <button onClick={onReload} disabled={loading} style={{ padding: "8px 14px", border: `1.5px solid ${C.borderStrong}`, background: C.surface, color: C.text, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1, whiteSpace: "nowrap" }}>
          {loading ? "A atualizar…" : "↻ Atualizar"}
        </button>
      </div>
    </div>
  );
}

function TopBar() {
  return <div style={{ background: C.text, height: 3, position: "fixed", top: 0, left: 0, right: 0, zIndex: 100 }} />;
}

function AccessDenied({ message }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 16 }}>Acesso restrito</div>
        <div style={{ fontSize: 13, marginTop: 8, color: C.muted }}>
          {message || "Acede ao dashboard através do link com o token de acesso."}
        </div>
        <div style={{ fontSize: 12, marginTop: 10, color: C.faint }}>
          Formato: <code>?token=…</code> no URL.
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({ error }) {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center", color: C.muted }}>
      {error ? (
        <div>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: C.red, fontWeight: 600, fontSize: 15 }}>Erro ao carregar dados</div>
          <div style={{ fontSize: 13, marginTop: 8, color: C.muted, maxWidth: 340, margin: "8px auto 0" }}>{error}</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>A carregar dados financeiros…</div>
          <div style={{ fontSize: 12, color: C.faint, marginTop: 6 }}>Books · Partner Store · Despesas</div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { token, checking, error: authError, authedFetch } = useAuth();
  const [tab, setTab] = useState("cashflow");
  const [year, setYear] = useState(new Date().getFullYear());
  const [budgetEditorOpen, setBudgetEditorOpen] = useState(false);

  const { budget, setBudget } = useBudget(authedFetch);
  const { data, loading, error, lastRefresh, reload } = useDashboard(authedFetch, !!token, year);
  const analysis = useAnalysis(token, tab === "cashflow" ? "pl" : "actions", !!token && !!data && (tab === "cashflow" || tab === "backlog"));

  const netResult = useMemo(() => (data ? deriveMonthly(data, budget).totals.net : 0), [data, budget]);

  if (checking) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontSize: 20 }}>…</div>;
  }

  if (!token) {
    return <AccessDenied message={authError} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingTop: 3 }}>
      <TopBar />
      <div className="main-container" style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 24px 80px" }}>
        <Header
          data={data}
          lastRefresh={lastRefresh}
          loading={loading}
          onReload={reload}
          annualGoal={budget.annual_goal}
          onEditBudget={() => setBudgetEditorOpen(true)}
          year={year}
          setYear={setYear}
        />

        {data && (
          <div style={{ marginBottom: 24 }}>
            <KpiPills data={data} netResult={netResult} annualGoal={budget.annual_goal} />
          </div>
        )}

        <TabBar tab={tab} setTab={setTab} />

        {!data ? (
          <LoadingScreen error={error} />
        ) : (
          <>
            {tab === "cashflow" && (
              <>
                <CashflowTab data={data} budget={budget} />
                <AnalysisPanel tab="pl" text={analysis.text} loading={analysis.loading} error={analysis.error} onReload={analysis.reload} />
              </>
            )}
            {tab === "backlog" && (
              <>
                <BacklogTab data={data} />
                <AnalysisPanel tab="actions" text={analysis.text} loading={analysis.loading} error={analysis.error} onReload={analysis.reload} />
              </>
            )}
            {tab === "timing" && <TimingTab data={data} />}
            {tab === "licences" && <LicencesTab data={data} />}
          </>
        )}
      </div>

      {budgetEditorOpen && (
        <BudgetEditor budget={budget} onSave={setBudget} onClose={() => setBudgetEditorOpen(false)} />
      )}
    </div>
  );
}
