import React from "react";
import { C, MONTHS, MONTHS_PT } from "../utils/constants";
import { fmt } from "../utils/fmt";

const MONTH_STATE = {
  invoiced: { bg: C.greenLight, fg: C.greenText, border: C.greenBorder, label: "Faturado" },
  forecast: { bg: C.amberLight, fg: C.amberText, border: C.amberBorder, label: "Previsto" },
  missing:  { bg: C.redLight,   fg: C.red,       border: C.redBorder,   label: "Em falta" },
  none:     { bg: "transparent", fg: C.faint,    border: "transparent", label: "—" },
};

function MonthBadge({ state, label }) {
  const s = MONTH_STATE[state] || MONTH_STATE.none;
  return (
    <div title={s.label} style={{ padding: "4px 6px", background: s.bg, color: s.fg, border: `1px solid ${s.border === "transparent" ? C.border : s.border}`, borderRadius: 6, fontSize: 10, textAlign: "center", fontWeight: 500 }}>
      {label}
    </div>
  );
}

function MonthlyCard({ c }) {
  const activeMonths = Object.values(c.months).filter((v) => v && v !== "missing").length;
  const yearTotal = Object.values(c.months).filter(Boolean).length * c.monthly;
  const invoicedCount = Object.values(c.months).filter((v) => v === "invoiced").length;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.client}</div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{c.service}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt(c.monthly)}</div>
          <div style={{ fontSize: 10, color: C.muted }}>por mês</div>
        </div>
      </div>
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
        {MONTHS.map((m, i) => <MonthBadge key={m} state={c.months[m]} label={MONTHS_PT[i]} />)}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
        <span>{invoicedCount} faturados</span>
        <span>Anual: <strong style={{ color: C.text }}>{fmt(yearTotal)}</strong></span>
      </div>
    </div>
  );
}

function AnnualCard({ l }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${l.already_in_books ? C.greenBorder : C.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{l.client}</div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{l.service}</div>
        </div>
        <span style={{ padding: "3px 8px", background: l.already_in_books ? C.greenLight : C.amberLight, color: l.already_in_books ? C.greenText : C.amberText, border: `1px solid ${l.already_in_books ? C.greenBorder : C.amberBorder}`, borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
          {l.already_in_books ? "Em Books" : "A cobrar"}
        </span>
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted }}>Renovação</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{MONTHS_PT[MONTHS.indexOf(l.month)] || l.month}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(l.amount)}</div>
          <div style={{ fontSize: 10, color: C.muted }}>Custo {fmt(l.reseller_price)} · +{fmt(l.margin)}</div>
        </div>
      </div>
    </div>
  );
}

export default function LicencesTab({ data }) {
  const monthly = data.recurring_forecast?.clients || [];
  const annual = (data.licence_renewals?.items || [])
    .slice()
    .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));

  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
        Recorrentes Mensais ({monthly.length})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))", gap: 12 }}>
        {monthly.map((c) => <MonthlyCard key={c.key} c={c} />)}
      </div>

      <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 24, marginBottom: 10 }}>
        Renovações Anuais Zoho ({annual.length})
      </div>
      {annual.length === 0 ? (
        <div style={{ padding: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 13 }}>
          Sem renovações anuais nos próximos 365 dias (ou Partner Store indisponível).
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 12 }}>
          {annual.map((l, i) => <AnnualCard key={i} l={l} />)}
        </div>
      )}
    </div>
  );
}
