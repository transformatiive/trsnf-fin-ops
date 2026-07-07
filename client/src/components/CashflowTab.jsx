import React, { useMemo, useState } from "react";
import { C, MONTHS, MONTHS_PT } from "../utils/constants";
import { fmt, fmtK } from "../utils/fmt";
import { deriveMonthly } from "../utils/model";

// ─── Chart: Faturação (real + prevista) vs Despesa ───────────────────────────
function BarChart({ rows, monthlyGoal }) {
  const [hover, setHover] = useState(null);
  const H = 180;
  const max =
    Math.max(
      ...rows.map((r) => Math.max(r.revenue, r.expense)),
      monthlyGoal || 0
    ) * 1.12 || 1;

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 11, color: C.muted, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: C.green }} /> Faturação realizada
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: C.greenLight, border: `1px solid ${C.greenBorder}` }} /> Prevista (backlog/renov.)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#fca5a5" }} /> Despesa
        </span>
        {monthlyGoal ? (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 12, height: 0, borderTop: `1.5px dashed ${C.muted}` }} /> Meta mensal
          </span>
        ) : null}
      </div>

      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 6, height: H, padding: "6px 0" }}>
        {rows.map((r) => {
          const actH = Math.max(0, (r.revenueActual / max) * H);
          const fcH = Math.max(0, (r.revenueForecast / max) * H);
          const expH = Math.max(0, (r.expense / max) * H);
          const isH = hover?.month === r.month;
          return (
            <div
              key={r.month}
              onMouseEnter={() => setHover(r)}
              onMouseLeave={() => setHover(null)}
              style={{ flex: 1, display: "flex", gap: 3, alignItems: "flex-end", height: H, position: "relative", cursor: "pointer" }}
            >
              {isH && <ChartTooltip row={r} />}
              {/* Receita: barra empilhada real + prevista */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: H }}>
                {fcH > 0 && (
                  <div style={{ height: fcH, background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: "4px 4px 0 0", opacity: isH ? 1 : 0.9 }} />
                )}
                {actH > 0 && (
                  <div style={{ height: actH, background: C.green, borderRadius: fcH > 0 ? 0 : "4px 4px 0 0", opacity: isH ? 1 : 0.9 }} />
                )}
              </div>
              {/* Despesa */}
              <div style={{ flex: 1, height: expH, background: isH ? "#f87171" : "#fca5a5", border: "1px solid #f87171", borderRadius: "4px 4px 0 0", opacity: isH ? 1 : 0.85 }} />
            </div>
          );
        })}

        {monthlyGoal ? (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: `${(monthlyGoal / max) * H}px`, borderTop: `1.5px dashed ${C.muted}`, pointerEvents: "none" }} />
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        {rows.map((r) => (
          <div key={r.month} style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: hover?.month === r.month ? 700 : 400, color: hover?.month === r.month ? C.text : C.faint }}>
            {MONTHS_PT[r.i]}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartTooltip({ row }) {
  const net = row.net;
  return (
    <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#1a1a1a", color: "#fff", borderRadius: 10, padding: "10px 13px", fontSize: 12, whiteSpace: "nowrap", zIndex: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.25)", pointerEvents: "none" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{MONTHS_PT[row.i]} {row.isPast ? "" : <span style={{ fontSize: 10, opacity: 0.6 }}>previsto</span>}</div>
      <Line label="Faturação" val={fmt(row.revenueActual)} dot={C.green} />
      {row.revenueForecast > 0 && <Line label="Prevista" val={fmt(row.revenueForecast)} dot={C.greenBorder} />}
      <Line label="Despesa" val={"-" + fmt(row.expense)} dot="#f87171" />
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 5, paddingTop: 5, display: "flex", justifyContent: "space-between", gap: 24 }}>
        <span style={{ fontWeight: 600 }}>Líquido</span>
        <span style={{ fontWeight: 700, color: net >= 0 ? "#4ade80" : "#f87171" }}>{fmt(net)}</span>
      </div>
    </div>
  );
}

function Line({ label, val, dot }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginTop: 2 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, opacity: 0.85 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: dot }} /> {label}
      </span>
      <span style={{ fontWeight: 600 }}>{val}</span>
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────
function Row({ label, cells, total, bold, color, indent = 0, italic, clickable, open, onToggle }) {
  return (
    <tr
      onClick={clickable ? onToggle : undefined}
      style={{ borderBottom: `1px solid ${C.border}`, cursor: clickable ? "pointer" : "default", fontStyle: italic ? "italic" : "normal", color: color || C.text, fontWeight: bold ? 700 : 500 }}
    >
      <td className="col-label" style={{ padding: "7px 10px", paddingLeft: 10 + indent, fontSize: 12, position: "sticky", left: 0, background: C.surface, zIndex: 1 }}>
        {clickable && <span style={{ marginRight: 4, color: C.muted, fontSize: 10 }}>{open ? "▼" : "▶"}</span>}
        {label}
      </td>
      {cells.map((v, i) => (
        <td key={i} className="col-month" style={{ textAlign: "right", padding: "7px 6px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{v}</td>
      ))}
      <td style={{ textAlign: "right", padding: "7px 10px", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{total}</td>
    </tr>
  );
}

function CostBreakdown({ data, rows, which, budget }) {
  const mapKey = which === "cogs" ? "cogs_by_month" : "opex_by_month";
  const cats = useMemo(() => {
    const set = new Set();
    for (const m of MONTHS) {
      const bc = data.expenses?.[mapKey]?.[m]?.by_category || {};
      Object.keys(bc).forEach((k) => set.add(k));
    }
    return [...set].sort();
  }, [data, mapKey]);

  const rowsOut = cats.map((cat) => {
    const perMonth = MONTHS.map((m) => data.expenses?.[mapKey]?.[m]?.by_category?.[cat] || 0);
    const tot = perMonth.reduce((a, b) => a + b, 0);
    return (
      <Row key={cat} indent={16} color={C.muted}
        label={cat}
        cells={perMonth.map((v) => (v ? "-" + fmtK(v) : "—"))}
        total={"-" + fmt(tot)}
      />
    );
  });

  // Opex: mostrar também o orçamento previsto usado nos meses futuros.
  if (which === "opex" && budget) {
    const anyForecast = rows.some((r) => !r.isPast);
    if (anyForecast) {
      rowsOut.push(
        <Row key="__budget" indent={16} color={C.faint} italic
          label="Orçamento previsto (meses futuros)"
          cells={rows.map((r) => (!r.isPast ? "-" + fmtK(r.opexBudget) : "—"))}
          total={"-" + fmt(rows.filter((r) => !r.isPast).reduce((a, r) => a + r.opexBudget, 0))}
        />
      );
    }
  }
  if (which === "cogs") {
    const anyForecast = rows.some((r) => !r.isPast && r.cogsForecast > 0);
    if (anyForecast) {
      rowsOut.push(
        <Row key="__cogsfc" indent={16} color={C.faint} italic
          label="Compra prevista de licenças (futuro)"
          cells={rows.map((r) => (!r.isPast && r.cogsForecast ? "-" + fmtK(r.cogsForecast) : "—"))}
          total={"-" + fmt(rows.filter((r) => !r.isPast).reduce((a, r) => a + r.cogsForecast, 0))}
        />
      );
    }
  }
  if (!rowsOut.length) {
    return (
      <Row indent={16} color={C.muted} italic label="Sem movimentos" cells={rows.map(() => "—")} total="—" />
    );
  }
  return <>{rowsOut}</>;
}

function RevenueBreakdown({ rows }) {
  const line = (label, pick, colorDot) => (
    <Row indent={16} color={C.muted}
      label={label}
      cells={rows.map((r) => (pick(r) ? fmtK(pick(r)) : "—"))}
      total={fmt(rows.reduce((a, r) => a + pick(r), 0))}
    />
  );
  return (
    <>
      {line("Faturado real", (r) => r.invoiced)}
      {line("SOs por faturar", (r) => r.backlog)}
      {line("Renovações Zoho", (r) => r.renewals)}
      {line("Recorrentes previstos", (r) => r.recurring)}
    </>
  );
}

// ─── Detalhe: faturas emitidas (o que já foi faturado, uma a uma) ────────────
function invoiceState(it) {
  if ((it.balance || 0) <= 0.01) return { label: "Pago", color: C.greenText, bg: C.greenLight };
  if (it.status === "overdue") return { label: "Em atraso", color: C.red, bg: C.redLight };
  return { label: "Por pagar", color: C.blueText, bg: C.blueLight };
}

function InvoiceDetail({ data }) {
  const [open, setOpen] = useState(false);
  const rows = [];
  for (const m of MONTHS) {
    for (const it of data.invoiced?.[m]?.items || []) {
      rows.push({ ...it, month: m, mi: MONTHS.indexOf(m) });
    }
  }
  rows.sort((a, b) => a.mi - b.mi || b.amount - a.amount);
  const total = rows.reduce((a, r) => a + (r.amount || 0), 0);

  return (
    <div style={{ marginTop: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", cursor: "pointer" }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          <span style={{ marginRight: 6, color: C.muted, fontSize: 10 }}>{open ? "▼" : "▶"}</span>
          Detalhe — Faturas emitidas ({rows.length})
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.greenText, fontVariantNumeric: "tabular-nums" }}>{fmt(total)}</div>
      </div>
      {open && (
        <div className="table-scroll" style={{ borderTop: `1px solid ${C.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Mês", "Cliente", "Documento", "Valor", "Estado"].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 3 ? "right" : "left", padding: "8px 10px", fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 16, color: C.muted, textAlign: "center" }}>Sem faturas emitidas neste ano.</td></tr>
              )}
              {rows.map((it, i) => {
                const s = invoiceState(it);
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "7px 10px", color: C.muted, whiteSpace: "nowrap" }}>{MONTHS_PT[it.mi]}{it.date ? <span style={{ color: C.faint }}> · {it.date.slice(8, 10)}</span> : null}</td>
                    <td style={{ padding: "7px 10px", color: C.text }}>{it.client || "—"}</td>
                    <td style={{ padding: "7px 10px", color: C.muted, whiteSpace: "nowrap" }}>{it.number || "—"}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(it.amount)}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CashflowTab({ data, budget }) {
  const model = useMemo(() => deriveMonthly(data, budget), [data, budget]);
  const { rows, totals } = model;
  const [openRev, setOpenRev] = useState(false);
  const [openCogs, setOpenCogs] = useState(false);
  const [openCost, setOpenCost] = useState(false);
  const monthlyGoal = budget.monthly_goal || Math.round((budget.annual_goal || 0) / 12);

  return (
    <div>
      <div style={{ padding: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Faturação vs Despesa · {data.fiscal_year}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
          Realizado nos meses passados; barras claras são previsão (backlog de SOs, renovações Zoho e recorrentes).
        </div>
        <BarChart rows={rows} monthlyGoal={monthlyGoal} />
      </div>

      <div className="table-scroll" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 16 }}>
        <table className="dash-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              <th className="col-label" style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, position: "sticky", left: 0, background: C.surface, minWidth: 240, zIndex: 2 }}>Linha</th>
              {MONTHS_PT.map((m) => (
                <th key={m} className="col-month" style={{ textAlign: "right", padding: "8px 6px", fontSize: 11, fontWeight: 600, color: C.muted, minWidth: 62 }}>{m}</th>
              ))}
              <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: C.text }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="Faturação (real + prevista)" bold
              clickable open={openRev} onToggle={() => setOpenRev(!openRev)}
              cells={rows.map((r) => (
                <span style={{ color: r.isPast ? C.greenText : C.green, fontWeight: r.isPast ? 700 : 500 }}>{fmtK(r.revenue)}</span>
              ))}
              total={<span style={{ color: C.greenText, fontWeight: 700 }}>{fmt(totals.revenue)}</span>}
            />
            {openRev && <RevenueBreakdown rows={rows} />}

            <Row
              label="− Compra de licenças (COGS Zoho)" bold
              clickable open={openCogs} onToggle={() => setOpenCogs(!openCogs)}
              cells={rows.map((r) => (r.cogs ? <span style={{ color: C.orange }}>-{fmtK(r.cogs)}</span> : <span style={{ color: C.faint }}>—</span>))}
              total={<span style={{ color: C.orange, fontWeight: 700 }}>-{fmt(totals.cogs)}</span>}
            />
            {openCogs && <CostBreakdown data={data} rows={rows} which="cogs" />}

            <Row
              label="= Margem bruta" bold color={C.muted}
              cells={rows.map((r) => <span style={{ color: r.grossMargin >= 0 ? C.greenText : C.red }}>{fmtK(r.grossMargin)}</span>)}
              total={<span style={{ color: totals.grossMargin >= 0 ? C.greenText : C.red, fontWeight: 700 }}>{fmt(totals.grossMargin)}</span>}
            />

            <Row
              label="− Opex operacional (real / orçamento)" bold
              clickable open={openCost} onToggle={() => setOpenCost(!openCost)}
              cells={rows.map((r) => <span style={{ color: C.red }}>-{fmtK(r.opex)}</span>)}
              total={<span style={{ color: C.red, fontWeight: 700 }}>-{fmt(totals.opex)}</span>}
            />
            {openCost && <CostBreakdown data={data} rows={rows} which="opex" budget={budget} />}

            <Row
              label="= Resultado Líquido" bold
              cells={rows.map((r) => (
                <span style={{ color: r.net >= 0 ? C.greenText : C.red, fontWeight: 700 }}>{fmtK(r.net)}</span>
              ))}
              total={<span style={{ color: totals.net >= 0 ? C.greenText : C.red, fontWeight: 700 }}>{fmt(totals.net)}</span>}
            />
            <Row
              label="Margem Líquida %" italic color={C.muted}
              cells={rows.map((r) => {
                if (!r.revenue) return <span style={{ color: C.faint }}>—</span>;
                const p = (r.net / r.revenue) * 100;
                return <span style={{ color: p >= 0 ? C.greenText : C.red }}>{p.toFixed(0)}%</span>;
              })}
              total={totals.revenue ? <span style={{ color: totals.net >= 0 ? C.greenText : C.red, fontWeight: 700 }}>{((totals.net / totals.revenue) * 100).toFixed(0)}%</span> : "—"}
            />
          </tbody>
        </table>
      </div>

      <InvoiceDetail data={data} />

      <div style={{ marginTop: 12, padding: 12, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
        <strong style={{ color: C.text }}>Como ler:</strong> faturação = faturas reais (passado) + SOs adjudicados por faturar + renovações Zoho sem SO + recorrentes previstos (futuro), <strong>sem sobreposições</strong> e filtrado ao ano.
        A <strong>compra de licenças (COGS Zoho)</strong> é o pass-through pago ao Zoho — real no passado, previsto no futuro (reseller_price) — separada do <strong>opex</strong> operacional. Margem bruta = faturação − COGS; líquido = margem bruta − opex.
      </div>
    </div>
  );
}
