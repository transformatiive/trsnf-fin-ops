import React from "react";
import { C } from "../utils/constants";
import { fmt } from "../utils/fmt";

function StatCard({ label, value, sub, accent, light, border }) {
  return (
    <div
      style={{
        background: light || C.surface,
        border: `1px solid ${border || C.border}`,
        borderRadius: 12,
        padding: "16px 20px",
        flex: "1 1 160px",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: accent || C.muted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || C.text, letterSpacing: -0.5, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

export default function KpiPills({ data, netResult }) {
  if (!data) return null;
  const t = data.totals || {};
  const totalForecast = (t.paid || 0) + (t.billed || 0) + (t.so_pending || 0) + (t.licence_pipeline || 0);
  const ANNUAL_GOAL = 250000;
  const pct = Math.min(100, Math.round((totalForecast / ANNUAL_GOAL) * 100));

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <StatCard
          label="Pago YTD"
          value={fmt(t.paid)}
          accent={C.greenText}
          light={C.greenLight}
          border={C.greenBorder}
        />
        <StatCard
          label="Faturado / por pagar"
          value={fmt(t.billed)}
          accent={C.blueText}
          light={C.blueLight}
          border={C.blueBorder}
        />
        <StatCard
          label="Sales Orders por Faturar"
          value={fmt(t.so_pending)}
          accent={C.amberText}
          light={C.amberLight}
          border={C.amberBorder}
        />
        <StatCard
          label="Licenças pipeline"
          value={fmt(t.licence_pipeline)}
          accent={C.amberText}
          light={C.amberLight}
          border={C.amberBorder}
        />
        <StatCard
          label="Previsão total"
          value={fmt(totalForecast)}
          sub={`${pct}% da meta anual`}
          accent={C.purple}
          light={C.purpleLight}
          border={C.purpleBorder}
        />
        <StatCard
          label="Resultado líquido est."
          value={fmt(netResult)}
          accent={netResult >= 0 ? C.greenText : C.redText}
          light={netResult >= 0 ? C.greenLight : C.redLight}
          border={netResult >= 0 ? C.greenBorder : C.redBorder}
        />
      </div>

      <div style={{ background: C.border, height: 6, borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: pct >= 80 ? C.green : pct >= 50 ? C.amber : C.red,
            borderRadius: 4,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.faint, marginTop: 4 }}>
        <span>Progresso para meta anual €250.000</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}
