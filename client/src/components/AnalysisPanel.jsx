import React from "react";
import { C } from "../utils/constants";
import { renderAI } from "../utils/renderAI.jsx";

export default function AnalysisPanel({ tab, text, loading, error, onReload }) {
  const title =
    tab === "pl" ? "Análise P&L Forecast" : "Prioridades da Semana";

  return (
    <div
      style={{
        marginTop: 24,
        background: C.purpleLight,
        border: `1px solid ${C.purpleBorder}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: `1px solid ${C.purpleBorder}`,
          background: "rgba(124,58,237,0.05)",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>✦</span>
          <span style={{ color: C.purple, fontWeight: 700, fontSize: 14, letterSpacing: -0.2 }}>
            {title}
          </span>
          {loading && (
            <span style={{ fontSize: 12, color: C.purple, opacity: 0.6, fontStyle: "italic" }}>
              a gerar…
            </span>
          )}
        </div>
        <button
          onClick={onReload}
          disabled={loading}
          style={{
            background: "transparent",
            border: `1.5px solid ${C.purpleBorder}`,
            color: C.purple,
            borderRadius: 8,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
            transition: "opacity 0.15s",
          }}
        >
          ↻ Atualizar
        </button>
      </div>

      <div style={{ padding: "16px 18px", color: C.text, fontSize: 13, lineHeight: 1.7 }}>
        {error && (
          <div
            style={{
              color: C.red,
              fontSize: 12,
              padding: "8px 12px",
              background: C.redLight,
              border: `1px solid ${C.redBorder}`,
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            {error}
          </div>
        )}
        {text
          ? renderAI(text)
          : loading
          ? (
            <span style={{ color: C.faint, fontStyle: "italic" }}>
              A analisar dados financeiros…
            </span>
          )
          : null}
      </div>
    </div>
  );
}
