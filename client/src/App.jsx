import React, { useMemo, useState } from "react";
import Login from "./components/Login";
import KpiPills from "./components/KpiPills";
import TabBar from "./components/TabBar";
import Legend from "./components/Legend";
import ActionsTab from "./components/ActionsTab";
import PLTab from "./components/PLTab";
import LicencesTab from "./components/LicencesTab";
import AnalysisPanel from "./components/AnalysisPanel";
import { useAuth } from "./hooks/useAuth";
import { useDashboard } from "./hooks/useDashboard";
import { useAnalysis } from "./hooks/useAnalysis";
import { C } from "./utils/constants";
import { fmt } from "./utils/fmt";

const MONTHLY_GOAL = 20833;
const ANNUAL_GOAL = 250000;
const IRC_RATE = 0.21;
const MARGIN = 1.18;

function computeNetResult(data) {
  if (!data) return 0;
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
  // Rough total costs
  const FIXED_BASE = 1957;
  const SALARY = 1114;
  const fixed = FIXED_BASE * 12 + SALARY * 11;
  let cogs = 0;
  for (const c of data.licence_pipeline?.monthly_clients || []) {
    for (const m of MONTHS) if (c.status[m]) cogs += c.monthly / MARGIN;
  }
  for (const l of data.licence_pipeline?.annual_licences || []) cogs += l.amount / MARGIN;
  const oneOff = 5300 + 8000;
  const net = revenue - fixed - cogs - oneOff;
  const preTax = Math.max(0, net);
  return Math.round(net - preTax * IRC_RATE);
}

function Header({ data, lastRefresh, loading, onReload, onLogout }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>
          Transformatiive Lda
        </div>
        <h1 style={{ margin: "4px 0 2px", fontSize: 24 }}>Financial Dashboard</h1>
        <div style={{ fontSize: 12, color: C.muted }}>
          {data?.fiscal_year || 2026} · Meta anual {fmt(ANNUAL_GOAL)}
          {lastRefresh && (
            <> · Atualizado {new Date(lastRefresh).toLocaleTimeString("pt-PT")}</>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onReload}
          disabled={loading}
          style={{
            padding: "8px 14px",
            border: `1px solid ${C.borderStrong}`,
            background: C.surface,
            color: C.text,
            borderRadius: 8,
            fontSize: 13,
            cursor: loading ? "wait" : "pointer",
            fontWeight: 500,
          }}
        >
          {loading ? "A atualizar…" : "↻ Atualizar dados"}
        </button>
        <button
          onClick={onLogout}
          style={{
            padding: "8px 14px",
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.muted,
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}

function LoadingScreen({ error }) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
      {error ? (
        <div style={{ color: C.red }}>
          Erro ao carregar dados: {error}
          <div style={{ fontSize: 12, marginTop: 8, color: C.muted }}>
            Verifica os secrets do Replit (Zoho, Moloni, Anthropic).
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 14 }}>A carregar dados financeiros…</div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>
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

  const { data, loading, error, lastRefresh, reload } = useDashboard(authedFetch, !!token);
  const analysis = useAnalysis(token, tab === "pl" ? "pl" : "actions", !!token && !!data && tab !== "licences");

  const netResult = useMemo(() => computeNetResult(data), [data]);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
        …
      </div>
    );
  }

  if (!token) {
    return <Login onLogin={login} error={authError} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 24px 60px" }}>
        <Header
          data={data}
          lastRefresh={lastRefresh}
          loading={loading}
          onReload={reload}
          onLogout={logout}
        />

        {data && <KpiPills data={data} netResult={netResult} />}

        <div style={{ marginTop: 20 }}>
          <TabBar tab={tab} setTab={setTab} />
        </div>

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
                <PLTab data={data} scenario={scenario} setScenario={setScenario} />
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
    </div>
  );
}
