import React, { useMemo, useState } from "react";
import { C, MONTHS, MONTHS_PT } from "../utils/constants";
import { fmt, fmtK } from "../utils/fmt";

const FIXED_COSTS = {
  "Leasys Renting": 616,
  Credibom: 341,
  "Via Verde": 79,
  Tesla: 10,
  NBiz: 369,
  Comissões: 65,
  Generali: 130,
  "AI/LLM": 128,
  "Dev Infra": 110,
  SaaS: 101,
  Moloni: 62,
  Subscrições: 45,
  Iberdrola: 15,
};
const SALARY = 1114;
const FIXED_BASE = Object.values(FIXED_COSTS).reduce((a, b) => a + b, 0); // 1957
const MONTHLY_GOAL = 20833;
const ANNUAL_GOAL = 250000;
const IRC_RATE = 0.21;
const MARGIN = 1.18;

const ONE_OFF = {
  May: [{ label: "IRC — Pagamento Por Conta", amount: 5300 }],
  Jun: [{ label: "Financiamento auto (entrada)", amount: 8000 }],
};

function revenueByMonth(data) {
  const r = {};
  for (const m of MONTHS) {
    r[m] =
      (data.paid?.[m]?.total || 0) +
      (data.billed?.[m]?.total || 0) +
      (data.so_pending?.[m]?.total || 0) +
      (data.licence_pipeline?.by_month?.[m] || 0);
  }
  return r;
}

function actualsPaidByMonth(data) {
  const r = {};
  for (const m of MONTHS) r[m] = data.paid?.[m]?.total || 0;
  return r;
}

function cogsForMonth(m, data) {
  let cogs = 0;
  for (const c of data.licence_pipeline?.monthly_clients || []) {
    if (c.status[m]) cogs += c.monthly / MARGIN;
  }
  for (const l of data.licence_pipeline?.annual_licences || []) {
    if (l.month === m) cogs += l.amount / MARGIN;
  }
  return cogs;
}

function fixedCostsForMonth(m) {
  const base = FIXED_BASE;
  const salary = m === "Jan" ? 0 : SALARY;
  return base + salary;
}

function oneOffForMonth(m) {
  return (ONE_OFF[m] || []).reduce((a, x) => a + x.amount, 0);
}

// IVA: quarterly estimated on net (revenue - cogs) at 18%
function ivaPayments(revenue, data) {
  const perMonth = MONTHS.map((m) => {
    const net = (revenue[m] || 0) - cogsForMonth(m, data);
    return Math.max(0, net) * 0.18;
  });
  const pay = { May: 0, Aug: 0, Nov: 0, Feb: 0 };
  pay.May = perMonth[0] + perMonth[1] + perMonth[2];
  pay.Aug = perMonth[3] + perMonth[4] + perMonth[5];
  pay.Nov = perMonth[6] + perMonth[7] + perMonth[8];
  pay.Feb = perMonth[9] + perMonth[10] + perMonth[11];
  return pay;
}

function computePL(data, scenario) {
  const multiplier = scenario === "conservative" ? 0.7 : scenario === "optimistic" ? 1.3 : 1.0;
  const todayIdx = new Date().getMonth(); // 0-based
  const revenue = revenueByMonth(data);
  const actuals = actualsPaidByMonth(data);

  // Apply multiplier only to future months (May+ per spec but we use today+)
  const revenueAdjusted = {};
  for (let i = 0; i < 12; i++) {
    const m = MONTHS[i];
    revenueAdjusted[m] = i <= todayIdx ? actuals[m] : (revenue[m] || 0) * multiplier;
  }

  const iva = ivaPayments(revenueAdjusted, data);

  const rows = MONTHS.map((m, i) => {
    const rev = revenueAdjusted[m];
    const fixed = fixedCostsForMonth(m);
    const cogs = cogsForMonth(m, data);
    const oneOff = oneOffForMonth(m);
    const ivaPay = iva[m] || 0;
    const preTax = rev - fixed - cogs - oneOff - ivaPay;
    const irc = preTax > 0 ? preTax * IRC_RATE : 0;
    const net = preTax - irc;
    return {
      month: m,
      monthLabel: MONTHS_PT[i],
      isPast: i <= todayIdx,
      plan: MONTHLY_GOAL,
      revenue: rev,
      variance: rev - MONTHLY_GOAL,
      fixed,
      cogs,
      oneOff,
      iva: ivaPay,
      irc,
      net,
    };
  });

  const totals = {
    revenue: rows.reduce((a, r) => a + r.revenue, 0),
    fixed: rows.reduce((a, r) => a + r.fixed, 0),
    cogs: rows.reduce((a, r) => a + r.cogs, 0),
    oneOff: rows.reduce((a, r) => a + r.oneOff, 0),
    iva: rows.reduce((a, r) => a + r.iva, 0),
    irc: rows.reduce((a, r) => a + r.irc, 0),
    net: rows.reduce((a, r) => a + r.net, 0),
  };

  return { rows, totals, multiplier, todayIdx };
}

function ScenarioSelector({ scenario, setScenario }) {
  const opts = [
    { key: "conservative", label: "Conservador ×0.7" },
    { key: "base", label: "Base ×1.0" },
    { key: "optimistic", label: "Otimista ×1.3" },
  ];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {opts.map((o) => {
        const active = scenario === o.key;
        return (
          <button
            key={o.key}
            onClick={() => setScenario(o.key)}
            style={{
              padding: "6px 12px",
              border: `1px solid ${active ? C.text : C.border}`,
              background: active ? C.text : C.surface,
              color: active ? "#fff" : C.text,
              fontSize: 12,
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: active ? 600 : 500,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ProgressBar({ forecast }) {
  const pct = Math.min(100, Math.round((forecast / ANNUAL_GOAL) * 100));
  const good = pct >= 80;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 4 }}>
        <span>Progresso para €250.000</span>
        <span>{pct}% · {fmt(forecast)}</span>
      </div>
      <div style={{ background: C.border, height: 8, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: good ? C.green : C.amber, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function BarChart({ rows }) {
  const maxRev = Math.max(...rows.map((r) => r.revenue), MONTHLY_GOAL);
  const maxCost = Math.max(...rows.map((r) => r.fixed + r.cogs + r.oneOff + r.iva));
  const max = Math.max(maxRev, maxCost) * 1.1;
  const H = 160;
  const [hover, setHover] = useState(null);

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 6, height: H, padding: "6px 0" }}>
        {rows.map((r) => {
          const revH = (r.revenue / max) * H;
          const costH = ((r.fixed + r.cogs + r.oneOff + r.iva) / max) * H;
          return (
            <div
              key={r.month}
              onMouseEnter={() => setHover(r)}
              onMouseLeave={() => setHover(null)}
              style={{ flex: 1, display: "flex", gap: 2, alignItems: "flex-end", height: H, position: "relative", cursor: "pointer" }}
            >
              <div
                style={{
                  flex: 1,
                  height: revH,
                  background: r.isPast ? C.green : C.greenLight,
                  border: `1px solid ${C.greenBorder}`,
                  borderRadius: "3px 3px 0 0",
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: costH,
                  background: C.redLight,
                  border: `1px solid #fecaca`,
                  borderRadius: "3px 3px 0 0",
                }}
              />
            </div>
          );
        })}
        {/* goal line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: `${(MONTHLY_GOAL / max) * H}px`,
            borderTop: `1px dashed ${C.muted}`,
            pointerEvents: "none",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        {rows.map((r) => (
          <div key={r.month} style={{ flex: 1, textAlign: "center", fontSize: 10, color: C.muted }}>
            {r.monthLabel}
          </div>
        ))}
      </div>
      {hover && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>
          <strong>{hover.monthLabel}:</strong> Receita {fmt(hover.revenue)} · Custos{" "}
          {fmt(hover.fixed + hover.cogs + hover.oneOff + hover.iva)} · Líquido {fmt(hover.net)}
        </div>
      )}
    </div>
  );
}

function VariancePill({ value, faded }) {
  const positive = value >= 0;
  return (
    <span
      style={{
        padding: "2px 6px",
        background: positive ? C.greenLight : C.redLight,
        color: positive ? C.greenText : C.red,
        border: `1px solid ${positive ? C.greenBorder : "#fecaca"}`,
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 600,
        opacity: faded ? 0.5 : 1,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {positive ? "+" : ""}
      {fmtK(value)}
    </span>
  );
}

function PLRow({ label, values, total, bold, italic, color, indent = 0, clickable, open, onToggle }) {
  return (
    <tr
      onClick={clickable ? onToggle : undefined}
      style={{
        borderBottom: `1px solid ${C.border}`,
        cursor: clickable ? "pointer" : "default",
        fontStyle: italic ? "italic" : "normal",
        color: color || C.text,
        fontWeight: bold ? 700 : 500,
      }}
    >
      <td
        style={{
          padding: "7px 10px",
          paddingLeft: 10 + indent,
          fontSize: 12,
          position: "sticky",
          left: 0,
          background: C.surface,
          zIndex: 1,
        }}
      >
        {clickable && (
          <span style={{ marginRight: 4, color: C.muted, fontSize: 10 }}>{open ? "▼" : "▶"}</span>
        )}
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          style={{
            textAlign: "right",
            padding: "7px 6px",
            fontSize: 12,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {v}
        </td>
      ))}
      <td style={{ textAlign: "right", padding: "7px 10px", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {total}
      </td>
    </tr>
  );
}

function PLTable({ rows, totals, data }) {
  const [openFixed, setOpenFixed] = useState(false);
  const [openCogs, setOpenCogs] = useState(false);

  return (
    <div style={{ overflowX: "auto", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <th
              style={{
                textAlign: "left",
                padding: "8px 10px",
                fontSize: 11,
                fontWeight: 600,
                color: C.muted,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                position: "sticky",
                left: 0,
                background: C.surface,
                minWidth: 260,
                zIndex: 2,
              }}
            >
              Linha
            </th>
            {MONTHS_PT.map((m) => (
              <th key={m} style={{ textAlign: "right", padding: "8px 6px", fontSize: 11, fontWeight: 600, color: C.muted, minWidth: 64 }}>
                {m}
              </th>
            ))}
            <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: C.text }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <PLRow
            label="Plano (meta mensal)"
            italic
            color={C.muted}
            values={rows.map(() => fmt(MONTHLY_GOAL))}
            total={fmt(ANNUAL_GOAL)}
          />
          <PLRow
            label="Receita Real / Prevista"
            values={rows.map((r) => (
              <span style={{ color: r.isPast ? C.greenText : C.green, fontWeight: r.isPast ? 700 : 500 }}>
                {fmtK(r.revenue)}
              </span>
            ))}
            total={<span style={{ color: C.greenText, fontWeight: 700 }}>{fmt(totals.revenue)}</span>}
            bold
          />
          <PLRow
            label="Variância vs Plano"
            values={rows.map((r) => <VariancePill value={r.variance} faded={!r.isPast} />)}
            total={<VariancePill value={totals.revenue - ANNUAL_GOAL} />}
          />

          {/* Fixed costs */}
          <PLRow
            label="Custos Fixos"
            clickable
            open={openFixed}
            onToggle={() => setOpenFixed(!openFixed)}
            values={rows.map((r) => <span style={{ color: C.red }}>-{fmtK(r.fixed)}</span>)}
            total={<span style={{ color: C.red, fontWeight: 700 }}>-{fmt(totals.fixed)}</span>}
          />
          {openFixed &&
            Object.entries(FIXED_COSTS).map(([k, v]) => (
              <PLRow
                key={k}
                label={k}
                indent={16}
                color={C.muted}
                values={rows.map(() => "-" + fmtK(v))}
                total={"-" + fmt(v * 12)}
              />
            ))}
          {openFixed && (
            <PLRow
              label="Salário"
              indent={16}
              color={C.muted}
              values={rows.map((r) => (r.month === "Jan" ? "—" : "-" + fmtK(SALARY)))}
              total={"-" + fmt(SALARY * 11)}
            />
          )}

          {/* COGS */}
          <PLRow
            label="COGS Licenças Zoho"
            clickable
            open={openCogs}
            onToggle={() => setOpenCogs(!openCogs)}
            values={rows.map((r) => <span style={{ color: C.red }}>-{fmtK(r.cogs)}</span>)}
            total={<span style={{ color: C.red, fontWeight: 700 }}>-{fmt(totals.cogs)}</span>}
          />
          {openCogs &&
            (data.licence_pipeline?.monthly_clients || []).map((c) => (
              <PLRow
                key={c.key}
                label={`${c.client} (mensal)`}
                indent={16}
                color={C.muted}
                values={rows.map((r) => (c.status[r.month] ? "-" + fmtK(c.monthly / MARGIN) : "—"))}
                total={"-" + fmt(
                  Object.keys(c.status).filter((m) => c.status[m]).length * (c.monthly / MARGIN)
                )}
              />
            ))}
          {openCogs &&
            (data.licence_pipeline?.annual_licences || []).map((l, i) => (
              <PLRow
                key={`al${i}`}
                label={`${l.client} (renovação)`}
                indent={16}
                color={C.muted}
                values={rows.map((r) => (r.month === l.month ? "-" + fmtK(l.amount / MARGIN) : "—"))}
                total={"-" + fmt(l.amount / MARGIN)}
              />
            ))}

          <PLRow
            label="IVA (est.)"
            values={rows.map((r) => (r.iva ? <span style={{ color: C.red }}>-{fmtK(r.iva)}</span> : "—"))}
            total={<span style={{ color: C.red }}>-{fmt(totals.iva)}</span>}
          />
          <PLRow
            label="IRC + Saídas Extra"
            values={rows.map((r) => {
              const extra = r.oneOff + r.irc;
              return extra ? <span style={{ color: C.red }}>-{fmtK(extra)}</span> : "—";
            })}
            total={<span style={{ color: C.red }}>-{fmt(totals.oneOff + totals.irc)}</span>}
          />

          <PLRow
            label="Resultado Líquido (IRC 21%)"
            bold
            values={rows.map((r) => (
              <span style={{ color: r.net >= 0 ? C.greenText : C.red, fontWeight: 700 }}>
                {fmtK(r.net)}
              </span>
            ))}
            total={
              <span style={{ color: totals.net >= 0 ? C.greenText : C.red, fontWeight: 700 }}>
                {fmt(totals.net)}
              </span>
            }
          />
        </tbody>
      </table>
    </div>
  );
}

export default function PLTab({ data, scenario, setScenario }) {
  const pl = useMemo(() => computePL(data, scenario), [data, scenario]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: C.muted }}>
          Cenário aplicado a meses futuros. Meta anual: <strong>{fmt(ANNUAL_GOAL)}</strong> · Previsto:{" "}
          <strong style={{ color: C.text }}>{fmt(pl.totals.revenue)}</strong>
        </div>
        <ScenarioSelector scenario={scenario} setScenario={setScenario} />
      </div>

      <ProgressBar forecast={pl.totals.revenue} />

      <div style={{ marginTop: 14, padding: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Receita vs Custos por mês</div>
        <BarChart rows={pl.rows} />
      </div>

      <PLTable rows={pl.rows} totals={pl.totals} data={data} />

      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: C.amberLight,
          border: `1px solid ${C.amberBorder}`,
          borderRadius: 8,
          fontSize: 12,
          color: C.amberText,
          lineHeight: 1.6,
        }}
      >
        <strong>Nota COGS:</strong> As licenças Zoho são pass-through com margem garantida de 18%. COGS representa{" "}
        <strong>risco de timing de cashflow</strong> (pagar Zoho antes de receber do cliente), não problema de margem.
        Especialmente relevante em <strong>Novembro</strong> (Leasys PT: saída ~€57k antes de receber ~€67k).
      </div>
    </div>
  );
}
