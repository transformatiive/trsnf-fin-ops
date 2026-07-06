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
        flex: "1 1 150px",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: accent || C.muted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || C.text, letterSpacing: -0.5, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function KpiPills({ data, netResult, annualGoal = 250000 }) {
  if (!data) return null;
  const t = data.totals || {};
  const forecast = t.forecast_billing || 0;
  const pct = Math.min(100, Math.round((forecast / annualGoal) * 100));

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <StatCard
          label="Faturado YTD"
          value={fmt(t.invoiced)}
          sub={`Recebido ${fmt(t.paid)}`}
          accent={C.greenText}
          light={C.greenLight}
          border={C.greenBorder}
        />
        <StatCard
          label="A receber"
          value={fmt(t.receivable)}
          sub={t.receivable_overdue ? `${fmt(t.receivable_overdue)} em atraso` : "sem atrasos"}
          accent={C.blueText}
          light={C.blueLight}
          border={C.blueBorder}
        />
        <StatCard
          label="Por faturar (SOs)"
          value={fmt(t.to_invoice)}
          sub={`Serv. ${fmt(t.to_invoice_services)} · Lic. ${fmt(t.to_invoice_licences)}`}
          accent={C.amberText}
          light={C.amberLight}
          border={C.amberBorder}
        />
        <StatCard
          label="Renovações Zoho"
          value={fmt(t.licence_renewals)}
          sub={t.recurring_forecast ? `Recorrentes ${fmt(t.recurring_forecast)}` : "próximos 365 dias"}
          accent={C.orange}
          light="#fff7ed"
          border="#fed7aa"
        />
        <StatCard
          label="Previsão total"
          value={fmt(forecast)}
          sub={`${pct}% da meta ${fmt(annualGoal)}`}
          accent={C.purple}
          light={C.purpleLight}
          border={C.purpleBorder}
        />
        <StatCard
          label="Resultado líquido est."
          value={fmt(netResult)}
          sub="Faturação − custos"
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
        <span>Progresso para meta anual {fmt(annualGoal)}</span>
        <span>{pct}%</span>
      </div>
    </div>
  );
}
