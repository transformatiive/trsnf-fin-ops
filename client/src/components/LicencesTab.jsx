import React from "react";
import { C, MONTHS, MONTHS_PT, ST } from "../utils/constants";
import { fmt } from "../utils/fmt";

function MonthBadge({ status, label }) {
  const s = status ? ST[status] : ST.none;
  return (
    <div
      style={{
        padding: "4px 6px",
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border === "transparent" ? C.border : s.border}`,
        borderRadius: 6,
        fontSize: 10,
        textAlign: "center",
        fontWeight: 500,
      }}
      title={s.label}
    >
      {label}
    </div>
  );
}

function MonthlyCard({ c }) {
  const yearTotal = Object.values(c.status).filter(Boolean).length * c.monthly;
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.client}</div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {c.service}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt(c.monthly)}</div>
          <div style={{ fontSize: 10, color: C.muted }}>por mês</div>
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 4,
        }}
      >
        {MONTHS.map((m, i) => (
          <MonthBadge key={m} status={c.status[m]} label={MONTHS_PT[i]} />
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
        Total anual: <strong style={{ color: C.text }}>{fmt(yearTotal)}</strong>
      </div>
    </div>
  );
}

function AnnualCard({ l }) {
  const s = ST[l.status] || ST.pending;
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{l.client}</div>
          <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {l.service}
          </div>
        </div>
        <span
          style={{
            padding: "3px 8px",
            background: s.bg,
            color: s.fg,
            border: `1px solid ${s.border === "transparent" ? C.border : s.border}`,
            borderRadius: 10,
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          {s.label}
        </span>
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted }}>Renovação</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{MONTHS_PT[MONTHS.indexOf(l.month)] || l.month}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(l.amount)}</div>
          <div style={{ fontSize: 10, color: C.muted }}>COGS {fmt(l.reseller_price)}</div>
        </div>
      </div>
      {l.already_in_books && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.green }}>✓ SO já criado em Books</div>
      )}
    </div>
  );
}

export default function LicencesTab({ data }) {
  const monthly = data.licence_pipeline?.monthly_clients || [];
  const annual = (data.licence_pipeline?.annual_licences || [])
    .slice()
    .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));

  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
        Clientes Mensais ({monthly.length})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {monthly.map((c) => (
          <MonthlyCard key={c.key} c={c} />
        ))}
      </div>

      <div
        style={{
          fontSize: 12,
          color: C.muted,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginTop: 24,
          marginBottom: 10,
        }}
      >
        Renovações Anuais ({annual.length})
      </div>
      {annual.length === 0 ? (
        <div style={{ padding: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 13 }}>
          Sem renovações anuais nos próximos 365 dias (ou Partner Store indisponível).
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {annual.map((l, i) => (
            <AnnualCard key={i} l={l} />
          ))}
        </div>
      )}
    </div>
  );
}
