import React, { useState } from "react";
import { C, MONTHS, MONTHS_PT } from "../utils/constants";
import { fmt, fmtK } from "../utils/fmt";

// Mês já passado no ano fiscal em vista (SO com esta data e ainda aberto = atrasado a faturar).
function isPastMonth(mi, fiscalYear) {
  const now = new Date();
  const y = now.getUTCFullYear();
  return fiscalYear < y || (fiscalYear === y && mi < now.getUTCMonth());
}

function MonthGridHeader({ firstColLabel }) {
  return (
    <thead>
      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
        <th className="col-label" style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, position: "sticky", left: 0, background: C.surface, minWidth: 300, zIndex: 2 }}>
          {firstColLabel}
        </th>
        {MONTHS_PT.map((m) => (
          <th key={m} className="col-month" style={{ textAlign: "right", padding: "8px 6px", fontSize: 11, fontWeight: 600, color: C.muted, minWidth: 62 }}>{m}</th>
        ))}
        <th style={{ textAlign: "right", padding: "8px 10px", fontSize: 11, fontWeight: 700, color: C.text }}>Total</th>
      </tr>
    </thead>
  );
}

function GridRow({ label, byMonth, total, color, bold, indent = 0, sub }) {
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td className="col-label" style={{ padding: "7px 10px", paddingLeft: 10 + indent, fontSize: 12, position: "sticky", left: 0, background: C.surface, zIndex: 1, color: color || C.text, fontWeight: bold ? 700 : 500 }}>
        {label}
        {sub && <span style={{ color: C.faint, fontWeight: 400 }}> · {sub}</span>}
      </td>
      {MONTHS.map((m) => (
        <td key={m} className="col-month" style={{ textAlign: "right", padding: "7px 6px", fontSize: 12, color: color || C.text, fontWeight: bold ? 700 : 500, fontVariantNumeric: "tabular-nums" }}>
          {byMonth[m] ? fmtK(byMonth[m]) : "—"}
        </td>
      ))}
      <td style={{ textAlign: "right", padding: "7px 10px", fontSize: 12, fontWeight: 700, color: color || C.text, fontVariantNumeric: "tabular-nums" }}>
        {total ? fmt(total) : "—"}
      </td>
    </tr>
  );
}

// ─── Por Faturar (SOs abertas) ───────────────────────────────────────────────
function ToInvoiceSection({ data }) {
  const [open, setOpen] = useState(true);
  const bm = data.to_invoice?.by_month || {};
  const services = {}, licences = {}, totalM = {};
  for (const m of MONTHS) {
    services[m] = bm[m]?.services || 0;
    licences[m] = bm[m]?.licences || 0;
    totalM[m] = bm[m]?.total || 0;
  }
  const t = data.totals || {};
  const items = (data.to_invoice?.items || []).slice().sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
  const overdueTotal = items.filter((it) => isPastMonth(MONTHS.indexOf(it.month), data.fiscal_year)).reduce((a, it) => a + it.amount, 0);

  return (
    <div style={{ marginBottom: 20 }}>
      {overdueTotal > 0 && (
        <div style={{ padding: "10px 14px", background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 10, marginBottom: 10, fontSize: 12, color: C.red, fontWeight: 600 }}>
          ⚠ {fmt(overdueTotal)} em SOs de meses passados ainda por faturar — devias já ter faturado (ver linhas a vermelho).
        </div>
      )}
      <div className="table-scroll" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
      <table className="dash-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <MonthGridHeader firstColLabel="Por Faturar — SOs abertas" />
        <tbody>
          <GridRow label="Serviços" byMonth={services} total={t.to_invoice_services} color={C.blueText} />
          <GridRow label="Licenças" byMonth={licences} total={t.to_invoice_licences} color={C.amberText} />
          <tr style={{ background: C.surfaceAlt, borderTop: `1.5px solid ${C.borderStrong}`, borderBottom: `1px solid ${C.border}` }}>
            <td className="col-label" style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, position: "sticky", left: 0, background: C.surfaceAlt, cursor: "pointer" }} onClick={() => setOpen(!open)}>
              <span style={{ marginRight: 4, color: C.muted, fontSize: 10 }}>{open ? "▼" : "▶"}</span>
              Total por faturar
            </td>
            {MONTHS.map((m) => (
              <td key={m} className="col-month" style={{ textAlign: "right", padding: "8px 6px", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{totalM[m] ? fmtK(totalM[m]) : "—"}</td>
            ))}
            <td style={{ textAlign: "right", padding: "8px 10px", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(t.to_invoice)}</td>
          </tr>
          {open && items.map((it, i) => {
            const bmItem = {}; MONTHS.forEach((m) => (bmItem[m] = m === it.month ? it.amount : 0));
            const mix = it.licences > 0 && it.services > 0 ? "misto" : it.licences > 0 ? "licença" : "serviço";
            const overdue = isPastMonth(MONTHS.indexOf(it.month), data.fiscal_year);
            return (
              <GridRow key={i} indent={16} color={overdue ? C.red : C.muted}
                label={`${overdue ? "⚠ " : ""}${it.client} (${it.so_number || "—"})`}
                sub={`${overdue ? "atrasado a faturar · " : ""}${mix}${it.desc ? " · " + it.desc : ""}`}
                byMonth={bmItem} total={it.amount}
              />
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ─── A Receber (AR) ──────────────────────────────────────────────────────────
function ReceivableSection({ data }) {
  const [open, setOpen] = useState(false);
  const r = data.receivable || {};
  const bm = r.by_due_month || {};
  const byMonth = {}; MONTHS.forEach((m) => (byMonth[m] = bm[m]?.total || 0));
  const allItems = [];
  for (const m of MONTHS) for (const it of bm[m]?.items || []) allItems.push({ ...it, month: m });
  allItems.sort((a, b) => (b.is_overdue - a.is_overdue) || (b.amount - a.amount));

  return (
    <div className="table-scroll" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 20 }}>
      <table className="dash-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <MonthGridHeader firstColLabel="A Receber — por data de vencimento" />
        <tbody>
          <tr style={{ background: C.blueLight, borderBottom: `1px solid ${C.blueBorder}` }}>
            <td className="col-label" style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, color: C.blueText, position: "sticky", left: 0, background: C.blueLight, cursor: "pointer" }} onClick={() => setOpen(!open)}>
              <span style={{ marginRight: 4, fontSize: 10 }}>{open ? "▼" : "▶"}</span>
              Contas por cobrar {r.overdue > 0 && <span style={{ color: C.red, fontWeight: 700 }}>· {fmt(r.overdue)} em atraso</span>}
            </td>
            {MONTHS.map((m) => (
              <td key={m} className="col-month" style={{ textAlign: "right", padding: "8px 6px", fontSize: 12, fontWeight: 700, color: C.blueText, fontVariantNumeric: "tabular-nums" }}>{byMonth[m] ? fmtK(byMonth[m]) : "—"}</td>
            ))}
            <td style={{ textAlign: "right", padding: "8px 10px", fontSize: 13, fontWeight: 700, color: C.blueText, fontVariantNumeric: "tabular-nums" }}>{fmt(r.total)}</td>
          </tr>
          {open && allItems.map((it, i) => {
            const bmItem = {}; MONTHS.forEach((m) => (bmItem[m] = m === it.month ? it.amount : 0));
            return (
              <GridRow key={i} indent={16} color={it.is_overdue ? C.red : C.muted}
                label={`${it.client} · ${it.number || ""}`}
                sub={it.is_overdue ? "⚠ em atraso" : it.due_date ? `vence ${it.due_date}` : ""}
                byMonth={bmItem} total={it.amount}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Renovações Zoho por cobrar ──────────────────────────────────────────────
function RenewalsSection({ data }) {
  const items = (data.licence_renewals?.items || []);
  const pending = items.filter((l) => !l.already_in_books);
  const inBooks = items.filter((l) => l.already_in_books);

  if (!items.length) {
    return (
      <div style={{ padding: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 13 }}>
        Sem renovações Zoho nos próximos 365 dias (ou Partner Store indisponível).
      </div>
    );
  }

  const Card = ({ l }) => (
    <div style={{ background: C.surface, border: `1px solid ${l.already_in_books ? C.greenBorder : C.border}`, borderRadius: 10, padding: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{l.client}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{l.service} · {l.store?.toUpperCase()}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(l.amount)}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{MONTHS_PT[MONTHS.indexOf(l.month)] || l.month}</div>
        </div>
      </div>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted }}>
        <span>Custo Zoho {fmt(l.reseller_price)}</span>
        <span style={{ color: C.greenText }}>Margem +{fmt(l.margin)}</span>
      </div>
      {l.already_in_books && <div style={{ marginTop: 6, fontSize: 11, color: C.greenText }}>✓ Já tem SO em Books (não somado à previsão)</div>}
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
        A cobrar ({pending.length}) · {fmt(data.totals?.licence_renewals || 0)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 12 }}>
        {pending.map((l, i) => <Card key={i} l={l} />)}
      </div>
      {inBooks.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, margin: "20px 0 10px" }}>
            Já em Books ({inBooks.length}) · excluídas da previsão
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 12 }}>
            {inBooks.map((l, i) => <Card key={i} l={l} />)}
          </div>
        </>
      )}
    </div>
  );
}

function ForecastDealsSection({ data }) {
  const fd = data.forecast_deals || {};
  const items = fd.items || [];
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Deals previstos — Negociação/Revisão ({items.length})</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.purple }}>{fmt(fd.total_all || 0)}</div>
      </div>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 3, marginBottom: 10 }}>
        Pipeline do Zoho CRM ainda não adjudicado. Quando um deal é ganho, passa a SO (Por Faturar).
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: C.muted, padding: "8px 0" }}>
          Sem deals em Negociação/Revisão (ou o token Zoho ainda não tem scope de CRM — nesse caso adiciona <code>ZohoCRM.modules.deals.READ</code> ao OAuth).
        </div>
      ) : (
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 520 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Deal / Cliente", "Fecho previsto", "Prob.", "Valor"].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 2 ? "right" : "left", padding: "7px 10px", fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((d, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "7px 10px", color: C.text }}>
                    {d.client}{d.name && d.name !== d.client ? <span style={{ color: C.faint }}> · {d.name}</span> : null}
                    <span style={{ marginLeft: 6, fontSize: 10, color: C.purple }}>{d.stage}</span>
                  </td>
                  <td style={{ padding: "7px 10px", color: C.muted, whiteSpace: "nowrap" }}>{d.closing_date || "—"}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: C.muted, whiteSpace: "nowrap" }}>{d.probability != null ? d.probability + "%" : "—"}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BacklogTab({ data }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
        <strong style={{ color: C.text }}>Por Faturar</strong> = Sales Orders adjudicados mas ainda não faturados (faturação prevista), por mês do SO.
      </div>
      <ToInvoiceSection data={data} />
      <ReceivableSection data={data} />
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: "4px 0 12px" }}>Renovações Zoho (Partner Store)</div>
      <RenewalsSection data={data} />
      <div style={{ marginTop: 20 }}>
        <ForecastDealsSection data={data} />
      </div>
    </div>
  );
}
