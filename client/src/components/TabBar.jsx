import React from "react";
import { C } from "../utils/constants";

const TABS = [
  { key: "cashflow", label: "Tesouraria" },
  { key: "backlog", label: "Por Faturar" },
  { key: "licences", label: "Licenças" },
];

export default function TabBar({ tab, setTab }) {
  return (
    <div style={{ display: "flex", gap: 2, borderBottom: `1.5px solid ${C.border}`, marginBottom: 20 }}>
      {TABS.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 18px",
              background: "transparent",
              border: "none",
              borderBottom: active ? `2px solid ${C.text}` : "2px solid transparent",
              color: active ? C.text : C.muted,
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              marginBottom: -1.5,
              letterSpacing: active ? -0.1 : 0,
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
