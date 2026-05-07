import React, { useMemo, useRef, useState } from "react";
import { C, MONTHS, MONTHS_PT } from "../utils/constants";
import { fmt, fmtK } from "../utils/fmt";
import { getOccurrenceMonths, annualOccurrences } from "../hooks/useBudget";

// ─── Data helpers ────────────────────────────────────────────────────────────

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

function cogsForMonth(m, data, margin) {
  let cogs = 0;
  for (const c of data.licence_pipeline?.monthly_clients || []) {
    if (c.status[m]) cogs += c.monthly / margin;
  }
  for (const l of data.licence_pipeline?.annual_licences || []) {
    if (l.month === m) cogs += l.amount / margin;
  }
  return cogs;
}

function annualCogsForMonth(m, data, margin) {
  return (data.licence_pipeline?.annual_licences || [])
    .filter((l) => l.month === m)
    .reduce((a, l) => a + l.amount / margin, 0);
}

function fixedCostsForMonth(m, budget) {
  const costs = Array.isArray(budget.fixed_costs)
    ? budget.fixed_costs
    : Object.entries(budget.fixed_costs).map(([name, amount]) => ({ name, amount, frequency: "monthly", start_month: "Jan" }));
  const base = costs.reduce((a, c) => {
    const months = getOccurrenceMonths(c.frequency || "monthly", c.start_month || "Jan");
    return a + (months.includes(m) ? c.amount : 0);
  }, 0);
  const salary = m === "Jan" ? 0 : budget.salary;
  return base + salary;
}

function oneOffForMonth(m, budget) {
  return (budget.one_off[m] || []).reduce((a, x) => a + x.amount, 0);
}

function ivaPayments(revenue, data, margin) {
  const perMonth = MONTHS.map((m) => {
    const net = (revenue[m] || 0) - cogsForMonth(m, data, margin);
    return Math.max(0, net) * 0.18;
  });
  const pay = { May: 0, Aug: 0, Nov: 0, Feb: 0 };
  pay.May = perMonth[0] + perMonth[1] + perMonth[2];
  pay.Aug = perMonth[3] + perMonth[4] + perMonth[5];
  pay.Nov = perMonth[6] + perMonth[7] + perMonth[8];
  pay.Feb = perMonth[9] + perMonth[10] + perMonth[11];
  return pay;
}

function computePL(data, scenario, budget, accrualMode) {
  const multiplier = scenario === "conservative" ? 0.7 : scenario === "optimistic" ? 1.3 : 1.0;
  const todayIdx = new Date().getMonth();
  const revenue = revenueByMonth(data);
  const actuals = actualsPaidByMonth(data);

  const revenueAdjusted = {};
  for (let i = 0; i < 12; i++) {
    const m = MONTHS[i];
    if (accrualMode === "cash") {
      revenueAdjusted[m] = actuals[m];
    } else {
      revenueAdjusted[m] = i <= todayIdx ? actuals[m] : (revenue[m] || 0) * multiplier;
    }
  }

  const iva = ivaPayments(revenueAdjusted, data, budget.margin);

  const rows = MONTHS.map((m, i) => {
    const rev = revenueAdjusted[m];
    const fixed = fixedCostsForMonth(m, budget);
    const cogs = cogsForMonth(m, data, budget.margin);
    const oneOff = oneOffForMonth(m, budget);
    const ivaPay = iva[m] || 0;
    const preTax = rev - fixed - cogs - oneOff - ivaPay;
    const irc = preTax > 0 ? preTax * budget.irc_rate : 0;
    const net = preTax - irc;
    return {
      month: m,
      monthLabel: MONTHS_PT[i],
      isPast: i <= todayIdx,
      plan: budget.monthly_goal,
      revenue: rev,
      variance: rev - budget.monthly_goal,
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

// ─── UI components ────────────────────────────────────────────────────────────

function AccrualToggle({ mode, setMode }) {
  const opts = [
    { key: "accrual", label: "Accrual" },
    { key: "cash",    label: "Cash" },
  ];
  return (
    <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 7, overflow: "hidden" }}>
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => setMode(o.key)}
          title={o.key === "accrual" ? "Faturado + pipeline" : "Apenas recebido"}
          style={{
            padding: "5px 14px",
            border: "none",
            borderRight: o.key === "accrual" ? `1px solid ${C.border}` : "none",
            background: mode === o.key ? C.text : "transparent",
            color: mode === o.key ? "#fff" : C.muted,
            fontSize: 12,
            fontWeight: mode === o.key ? 700 : 500,
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
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

function ProgressBar({ forecast, annualGoal }) {
  const pct = Math.min(100, Math.round((forecast / annualGoal) * 100));
  const good = pct >= 80;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginBottom: 4 }}>
        <span>Progresso para {fmt(annualGoal)}</span>
        <span>{pct}% · {fmt(forecast)}</span>
      </div>
      <div style={{ background: C.border, height: 8, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: good ? C.green : C.amber, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function Tooltip({ row, anchorRef, monthlyGoal }) {
  if (!row || !anchorRef.current) return null;
  const costs = row.fixed + row.cogs + row.oneOff + row.iva;
  const netPositive = row.net >= 0;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#1a1a1a",
        color: "#fff",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        whiteSpace: "nowrap",
        zIndex: 20,
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 7, fontSize: 13, letterSpacing: -0.2 }}>
        {row.monthLabel} {row.isPast ? "" : <span style={{ fontSize: 10, opacity: 0.6 }}>previsto</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: row.isPast ? C.green : C.greenBorder, display: "inline-block" }} />
            Receita
          </span>
          <span style={{ fontWeight: 600 }}>{fmt(row.revenue)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#f87171", display: "inline-block" }} />
            Custos totais
          </span>
          <span style={{ fontWeight: 600 }}>-{fmt(costs)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
          <span style={{ opacity: 0.8 }}>vs Meta {fmt(monthlyGoal)}</span>
          <span style={{ fontWeight: 600, color: row.revenue >= monthlyGoal ? "#4ade80" : "#f87171" }}>
            {row.revenue >= monthlyGoal ? "+" : ""}{fmt(row.revenue - monthlyGoal)}
          </span>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", gap: 24 }}>
          <span style={{ fontWeight: 600 }}>Líquido</span>
          <span style={{ fontWeight: 700, color: netPositive ? "#4ade80" : "#f87171" }}>{fmt(row.net)}</span>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 10, height: 10, background: "#1a1a1a", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
    </div>
  );
}

function BarChart({ rows, monthlyGoal }) {
  const maxRev = Math.max(...rows.map((r) => r.revenue), monthlyGoal);
  const maxCost = Math.max(...rows.map((r) => r.fixed + r.cogs + r.oneOff + r.iva));
  const max = Math.max(maxRev, maxCost) * 1.1;
  const H = 170;
  const [hover, setHover] = useState(null);
  const anchorRef = useRef(null);

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 11, color: C.muted, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: C.green, display: "inline-block" }} />
          Receita realizada
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: C.greenLight, border: `1px solid ${C.greenBorder}`, display: "inline-block" }} />
          Receita prevista
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#fecaca", display: "inline-block" }} />
          Custos totais
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 2, background: C.muted, display: "inline-block", borderTop: `1px dashed ${C.muted}` }} />
          Meta mensal
        </span>
      </div>

      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 5, height: H, padding: "6px 0" }}>
        {rows.map((r) => {
          const revH = Math.max(2, (r.revenue / max) * H);
          const costH = Math.max(2, ((r.fixed + r.cogs + r.oneOff + r.iva) / max) * H);
          const isHovered = hover?.month === r.month;
          return (
            <div
              key={r.month}
              ref={isHovered ? anchorRef : null}
              onMouseEnter={() => setHover(r)}
              onMouseLeave={() => setHover(null)}
              style={{ flex: 1, display: "flex", gap: 2, alignItems: "flex-end", height: H, position: "relative", cursor: "pointer" }}
            >
              {isHovered && <Tooltip row={r} anchorRef={anchorRef} monthlyGoal={monthlyGoal} />}
              <div style={{ flex: 1, height: revH, background: r.isPast ? C.green : C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: "4px 4px 0 0", opacity: isHovered ? 1 : 0.85, transition: "opacity 0.1s, height 0.2s" }} />
              <div style={{ flex: 1, height: costH, background: isHovered ? "#fca5a5" : "#fecaca", border: "1px solid #fca5a5", borderRadius: "4px 4px 0 0", opacity: isHovered ? 1 : 0.8, transition: "opacity 0.1s" }} />
            </div>
          );
        })}

        <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(monthlyGoal / max) * H}px`, borderTop: `1.5px dashed ${C.muted}`, pointerEvents: "none" }}>
          <span style={{ position: "absolute", right: 0, top: -16, fontSize: 9, color: C.muted, fontWeight: 600, background: C.surface, padding: "1px 4px", borderRadius: 3 }}>
            META
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
        {rows.map((r) => (
          <div key={r.month} style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: hover?.month === r.month ? 700 : 400, color: hover?.month === r.month ? C.text : C.faint, transition: "color 0.1s, font-weight 0.1s" }}>
            {r.monthLabel}
          </div>
        ))}
      </div>
    </div>
  );
}

function VariancePill({ value, faded }) {
  const positive = value >= 0;
  return (
    <span style={{ padding: "2px 6px", background: positive ? C.greenLight : C.redLight, color: positive ? C.greenText : C.red, border: `1px solid ${positive ? C.greenBorder : "#fecaca"}`, borderRadius: 10, fontSize: 10, fontWeight: 600, opacity: faded ? 0.5 : 1, fontVariantNumeric: "tabular-nums" }}>
      {positive ? "+" : ""}{fmtK(value)}
    </span>
  );
}

function CashflowRiskBadge({ annualCogs, clients }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", cursor: "help", marginRight: 3, fontSize: 11 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      ⚠️
      {show && (
        <span style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, background: "#1a1a1a", color: "#fff", borderRadius: 8, padding: "9px 12px", fontSize: 11, whiteSpace: "nowrap", zIndex: 50, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", display: "block" }}>
          <span style={{ display: "block", fontWeight: 700, marginBottom: 5 }}>⚠️ Risco de cashflow</span>
          {clients.map((c, i) => (
            <span key={i} style={{ display: "block", opacity: 0.85 }}>{c.client}: COGS {fmt(c.cogs)}</span>
          ))}
          <span style={{ display: "block", marginTop: 5, opacity: 0.6, fontSize: 10 }}>Pagamento Zoho precede recebimento do cliente</span>
        </span>
      )}
    </span>
  );
}

function PLRow({ label, values, total, bold, italic, color, indent = 0, clickable, open, onToggle }) {
  return (
    <tr
      onClick={clickable ? onToggle : undefined}
      style={{ borderBottom: `1px solid ${C.border}`, cursor: clickable ? "pointer" : "default", fontStyle: italic ? "italic" : "normal", color: color || C.text, fontWeight: bold ? 700 : 500 }}
    >
      <td className="col-label" style={{ padding: "7px 10px", paddingLeft: 10 + indent, fontSize: 12, position: "sticky", left: 0, background: C.surface, zIndex: 1 }}>
        {clickable && <span style={{ marginRight: 4, color: C.muted, fontSize: 10 }}>{open ? "▼" : "▶"}</span>}
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className="col-month" style={{ textAlign: "right", padding: "7px 6px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          {v}
        </td>
      ))}
      <td style={{ textAlign: "right", padding: "7px 10px", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {total}
      </td>
    </tr>
  );
}

function PLTable({ rows, totals, data, budget, accrualMode }) {
  const [openFixed, setOpenFixed] = useState(false);
  const [openCogs, setOpenCogs] = useState(false);

  const revenueLabel = accrualMode === "cash" ? "Receita Recebida (Cash)" : "Receita Faturada / Prevista (Accrual)";

  return (
    <div className="table-scroll" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 16 }}>
      <table className="dash-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <th className="col-label" style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, position: "sticky", left: 0, background: C.surface, minWidth: 260, zIndex: 2 }}>
              Linha
            </th>
            {MONTHS_PT.map((m) => (
              <th key={m} className="col-month" style={{ textAlign: "right", padding: "8px 6px", fontSize: 11, fontWeight: 600, color: C.muted, minWidth: 64 }}>
                {m}
              </th>
            ))}
            <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: C.text }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <PLRow
            label="Plano (meta mensal)"
            italic color={C.muted}
            values={rows.map(() => fmt(budget.monthly_goal))}
            total={fmt(budget.annual_goal)}
          />
          <PLRow
            label={revenueLabel}
            bold
            values={rows.map((r) => (
              <span style={{ color: r.isPast ? C.greenText : C.green, fontWeight: r.isPast ? 700 : 500 }}>{fmtK(r.revenue)}</span>
            ))}
            total={<span style={{ color: C.greenText, fontWeight: 700 }}>{fmt(totals.revenue)}</span>}
          />
          <PLRow
            label="Variância vs Plano"
            values={rows.map((r) => <VariancePill value={r.variance} faded={!r.isPast} />)}
            total={<VariancePill value={totals.revenue - budget.annual_goal} />}
          />

          <PLRow
            label="Custos Fixos"
            clickable open={openFixed} onToggle={() => setOpenFixed(!openFixed)}
            values={rows.map((r) => <span style={{ color: C.red }}>-{fmtK(r.fixed)}</span>)}
            total={<span style={{ color: C.red, fontWeight: 700 }}>-{fmt(totals.fixed)}</span>}
          />
          {openFixed && (() => {
            const costs = Array.isArray(budget.fixed_costs)
              ? budget.fixed_costs
              : Object.entries(budget.fixed_costs).map(([name, amount]) => ({ name, amount, frequency: "monthly", start_month: "Jan" }));
            const freqLabel = { monthly: "M", quarterly: "T", semi_annual: "S", annual: "A" };
            return costs.map((c, i) => {
              const occMonths = getOccurrenceMonths(c.frequency || "monthly", c.start_month || "Jan");
              const occ = annualOccurrences(c.frequency || "monthly");
              return (
                <PLRow key={i} indent={16} color={C.muted}
                  label={<span>{c.name} <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 6, background: C.border, color: C.muted, marginLeft: 3 }}>{freqLabel[c.frequency] || "M"}</span></span>}
                  values={rows.map((r) => occMonths.includes(r.month) ? "-" + fmtK(c.amount) : "—")}
                  total={"-" + fmt(c.amount * occ)}
                />
              );
            });
          })()}
          {openFixed && (
            <PLRow
              label="Salário" indent={16} color={C.muted}
              values={rows.map((r) => (r.month === "Jan" ? "—" : "-" + fmtK(budget.salary)))}
              total={"-" + fmt(budget.salary * 11)}
            />
          )}

          <PLRow
            label="COGS Licenças Zoho"
            clickable open={openCogs} onToggle={() => setOpenCogs(!openCogs)}
            values={rows.map((r) => {
              const annualRisk = (data.licence_pipeline?.annual_licences || [])
                .filter((l) => l.month === r.month)
                .map((l) => ({ client: l.client, cogs: l.amount / budget.margin }));
              return (
                <span style={{ color: C.red, display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                  {annualRisk.length > 0 && <CashflowRiskBadge annualCogs={annualRisk.reduce((a, c) => a + c.cogs, 0)} clients={annualRisk} />}
                  -{fmtK(r.cogs)}
                </span>
              );
            })}
            total={<span style={{ color: C.red, fontWeight: 700 }}>-{fmt(totals.cogs)}</span>}
          />
          {openCogs &&
            (data.licence_pipeline?.monthly_clients || []).map((c) => (
              <PLRow
                key={c.key}
                label={`${c.client} (mensal)`}
                indent={16} color={C.muted}
                values={rows.map((r) => (c.status[r.month] ? "-" + fmtK(c.monthly / budget.margin) : "—"))}
                total={"-" + fmt(Object.keys(c.status).filter((m) => c.status[m]).length * (c.monthly / budget.margin))}
              />
            ))}
          {openCogs &&
            (data.licence_pipeline?.annual_licences || []).map((l, i) => (
              <PLRow
                key={`al${i}`}
                label={`${l.client} (renovação anual)`}
                indent={16} color={C.muted}
                values={rows.map((r) => (r.month === l.month ? "-" + fmtK(l.amount / budget.margin) : "—"))}
                total={"-" + fmt(l.amount / budget.margin)}
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
            label={`Resultado Líquido (IRC ${Math.round(budget.irc_rate * 100)}%)`}
            bold
            values={rows.map((r) => (
              <span style={{ color: r.net >= 0 ? C.greenText : C.red, fontWeight: 700 }}>{fmtK(r.net)}</span>
            ))}
            total={<span style={{ color: totals.net >= 0 ? C.greenText : C.red, fontWeight: 700 }}>{fmt(totals.net)}</span>}
          />

          <PLRow
            label="Margem Líquida %"
            italic color={C.muted}
            values={rows.map((r) => {
              if (!r.revenue) return <span style={{ color: C.faint }}>—</span>;
              const pct = (r.net / r.revenue) * 100;
              return <span style={{ color: pct >= 0 ? C.greenText : C.red, fontStyle: "italic" }}>{pct.toFixed(1)}%</span>;
            })}
            total={(() => {
              if (!totals.revenue) return <span style={{ color: C.faint }}>—</span>;
              const pct = (totals.net / totals.revenue) * 100;
              return <span style={{ color: pct >= 0 ? C.greenText : C.red, fontWeight: 700 }}>{pct.toFixed(1)}%</span>;
            })()}
          />
        </tbody>
      </table>
    </div>
  );
}

export default function PLTab({ data, scenario, setScenario, budget }) {
  const [accrualMode, setAccrualMode] = useState("accrual");
  const pl = useMemo(() => computePL(data, scenario, budget, accrualMode), [data, scenario, budget, accrualMode]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: C.muted }}>
          Cenário aplicado a meses futuros. Meta anual: <strong>{fmt(budget.annual_goal)}</strong> · Previsto:{" "}
          <strong style={{ color: C.text }}>{fmt(pl.totals.revenue)}</strong>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <AccrualToggle mode={accrualMode} setMode={setAccrualMode} />
          <ScenarioSelector scenario={scenario} setScenario={setScenario} />
        </div>
      </div>

      <ProgressBar forecast={pl.totals.revenue} annualGoal={budget.annual_goal} />

      <div style={{ marginTop: 14, padding: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Receita vs Custos por mês</div>
        <BarChart rows={pl.rows} monthlyGoal={budget.monthly_goal} />
      </div>

      <PLTable rows={pl.rows} totals={pl.totals} data={data} budget={budget} accrualMode={accrualMode} />

      <div style={{ marginTop: 12, padding: 12, background: C.amberLight, border: `1px solid ${C.amberBorder}`, borderRadius: 8, fontSize: 12, color: C.amberText, lineHeight: 1.6 }}>
        <strong>Nota COGS:</strong> As licenças Zoho são pass-through com margem garantida de {Math.round((budget.margin - 1) * 100)}%. COGS representa{" "}
        <strong>risco de timing de cashflow</strong> (pagar Zoho antes de receber do cliente), não problema de margem.
        Meses com renovações anuais estão assinalados com ⚠️ na linha COGS.
      </div>
    </div>
  );
}
