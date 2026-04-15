import React from "react";
import { C } from "../utils/constants";

const TABS = [
  { key: "actions", label: "O que fazer" },
  { key: "pl", label: "P&L Forecast" },
  { key: "licences", label: "Licenças" },
];

export default function TabBar({ tab, setTab }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
      {TABS.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderBottom: active ? `2px solid ${C.text}` : "2px solid transparent",
              color: active ? C.text : C.muted,
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
