import React from "react";
import { C } from "../utils/constants";
import { renderAI } from "../utils/renderAI.jsx";

export default function AnalysisPanel({ tab, text, loading, error, onReload }) {
  const title =
    tab === "pl" ? "Análise — P&L Forecast" : "Análise — Prioridades da Semana";
  return (
    <div
      style={{
        marginTop: 24,
        background: C.purpleLight,
        border: `1px solid #ddd6fe`,
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: C.purple, fontWeight: 700, fontSize: 14 }}>✦ {title}</span>
          {loading && (
            <span style={{ fontSize: 12, color: C.purple, opacity: 0.7 }}>a gerar…</span>
          )}
        </div>
        <button
          onClick={onReload}
          disabled={loading}
          style={{
            background: "transparent",
            border: `1px solid ${C.purple}`,
            color: C.purple,
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 12,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          ↻ Atualizar
        </button>
      </div>

      <div style={{ color: C.text, fontSize: 13 }}>
        {error && <div style={{ color: C.red, fontSize: 12 }}>{error}</div>}
        {text ? renderAI(text) : loading ? <span style={{ color: C.muted }}>A analisar dados financeiros…</span> : null}
      </div>
    </div>
  );
}
