import React, { useState } from "react";
import { C, MONTHS, MONTHS_PT, SECTION_COLORS, ST } from "../utils/constants";
import { fmt, fmtK } from "../utils/fmt";
import Cell from "./Cell";

function Chevron({ open }) {
  return (
    <span style={{ display: "inline-block", width: 12, marginRight: 6, color: C.muted, fontSize: 10 }}>
      {open ? "▼" : "▶"}
    </span>
  );
}

function MonthHeader() {
  return (
    <thead>
      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
        <th
          className="col-label"
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
            minWidth: 320,
            zIndex: 2,
          }}
        >
          Cliente / Documento
        </th>
        {MONTHS_PT.map((m) => (
          <th
            key={m}
            className="col-month"
            style={{
              textAlign: "right",
              padding: "8px 6px",
              fontSize: 11,
              fontWeight: 600,
              color: C.muted,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              minWidth: 68,
            }}
          >
            {m}
          </th>
        ))}
        <th
          style={{
            textAlign: "right",
            padding: "8px 10px",
            fontSize: 11,
            fontWeight: 700,
            color: C.text,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Total
        </th>
      </tr>
    </thead>
  );
}

function SummaryRow({ label, byMonth, color, open, onToggle, clickable = true }) {
  const rowTotal = Object.values(byMonth || {}).reduce((a, m) => a + (m.total || 0), 0);
  return (
    <tr
      style={{ background: color.bg, cursor: clickable ? "pointer" : "default", borderBottom: `1px solid ${color.border}` }}
      onClick={clickable ? onToggle : undefined}
    >
      <td
        className="col-label"
        style={{
          padding: "8px 10px",
          fontWeight: 600,
          color: color.text,
          fontSize: 13,
          position: "sticky",
          left: 0,
          background: color.bg,
          zIndex: 1,
        }}
      >
        {clickable && <Chevron open={open} />}
        {label}
      </td>
      {MONTHS.map((m) => {
        const v = byMonth?.[m]?.total || 0;
        return (
          <td
            key={m}
            className="col-month"
            style={{
              textAlign: "right",
              padding: "6px 6px",
              color: color.text,
              fontSize: 12,
              fontWeight: v ? 600 : 400,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {v ? fmtK(v) : "—"}
          </td>
        );
      })}
      <td
        style={{
          textAlign: "right",
          padding: "8px 10px",
          color: color.text,
          fontWeight: 700,
          fontSize: 13,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmt(rowTotal)}
      </td>
    </tr>
  );
}

function ItemRow({ label, byMonthAmounts, statusFn }) {
  // byMonthAmounts: { Jan: amount, ... } — amounts are the cells this row contributes
  const total = Object.values(byMonthAmounts).reduce((a, n) => a + (n || 0), 0);
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td
        className="col-label"
        style={{
          padding: "6px 10px 6px 28px",
          fontSize: 12,
          color: C.muted,
          position: "sticky",
          left: 0,
          background: C.surface,
          zIndex: 1,
        }}
      >
        {label}
      </td>
      {MONTHS.map((m) => (
        <Cell key={m} amount={byMonthAmounts[m] || 0} status={byMonthAmounts[m] ? statusFn(m) : null} compact />
      ))}
      <td style={{ textAlign: "right", padding: "6px 10px", fontSize: 12, color: C.text, fontVariantNumeric: "tabular-nums" }}>
        {total ? fmt(total) : "—"}
      </td>
    </tr>
  );
}

// Build per-item rows from { month: { items: [...] } }
function itemsToRows(byMonth, statusKey, labelFn) {
  // Group by invoice_id / salesorder_id so the same doc appears in one row
  const map = new Map();
  for (const m of MONTHS) {
    for (const it of byMonth?.[m]?.items || []) {
      const id = it.invoice_id || it.salesorder_id || `${it.client}-${it.number || it.so_number}`;
      if (!map.has(id)) {
        map.set(id, { label: labelFn(it), months: {} });
      }
      map.get(id).months[m] = (map.get(id).months[m] || 0) + (it.amount || 0);
    }
  }
  return [...map.values()].map((row) => ({
    label: row.label,
    months: row.months,
    statusFn: () => statusKey,
  }));
}

function Section({ sectionKey, label, byMonth, defaultOpen = false, rowsBuilder }) {
  const [open, setOpen] = useState(defaultOpen);
  const color = SECTION_COLORS[sectionKey];
  const rows = open ? rowsBuilder() : [];

  return (
    <>
      <SummaryRow
        label={label}
        byMonth={byMonth}
        color={color}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open &&
        rows.map((r, i) => (
          <ItemRow key={i} label={r.label} byMonthAmounts={r.months} statusFn={r.statusFn} />
        ))}
    </>
  );
}

function GrandTotalRow({ data }) {
  const totals = {};
  for (const m of MONTHS) {
    totals[m] =
      (data.paid?.[m]?.total || 0) +
      (data.billed?.[m]?.total || 0) +
      (data.so_pending?.[m]?.total || 0) +
      (data.licence_pipeline?.by_month?.[m] || 0);
  }
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <tr style={{ background: "#f0ede6", borderTop: `2px solid ${C.borderStrong}`, borderBottom: `2px solid ${C.borderStrong}` }}>
      <td
        className="col-label"
        style={{
          padding: "10px",
          fontWeight: 700,
          fontSize: 13,
          position: "sticky",
          left: 0,
          background: "#f0ede6",
        }}
      >
        Total Mensal
      </td>
      {MONTHS.map((m) => (
        <td
          key={m}
          className="col-month"
          style={{
            textAlign: "right",
            padding: "10px 6px",
            fontWeight: 700,
            fontSize: 12,
            color: C.text,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {totals[m] ? fmtK(totals[m]) : "—"}
        </td>
      ))}
      <td style={{ textAlign: "right", padding: "10px", fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
        {fmt(grand)}
      </td>
    </tr>
  );
}

function LicencesSection({ data }) {
  const [open, setOpen] = useState(false);
  const color = SECTION_COLORS.licences;
  const byMonth = {};
  for (const m of MONTHS) byMonth[m] = { total: data.licence_pipeline?.by_month?.[m] || 0 };

  return (
    <>
      <SummaryRow
        label="Licenças Pipeline"
        byMonth={byMonth}
        color={color}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open && (
        <>
          <tr>
            <td colSpan={14} style={{ padding: "6px 28px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Mensais
            </td>
          </tr>
          {(data.licence_pipeline?.monthly_clients || []).map((c, i) => {
            const byMonthAmounts = {};
            for (const m of MONTHS) {
              byMonthAmounts[m] = c.status[m] ? c.monthly : 0;
            }
            return (
              <tr key={`mc${i}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td
                  className="col-label"
                  style={{
                    padding: "6px 10px 6px 28px",
                    fontSize: 12,
                    color: C.muted,
                    position: "sticky",
                    left: 0,
                    background: C.surface,
                    zIndex: 1,
                  }}
                >
                  {c.client} · {c.service}
                </td>
                {MONTHS.map((m) => (
                  <Cell key={m} amount={byMonthAmounts[m]} status={c.status[m]} compact />
                ))}
                <td style={{ textAlign: "right", padding: "6px 10px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(Object.values(byMonthAmounts).reduce((a, b) => a + b, 0))}
                </td>
              </tr>
            );
          })}
          <tr>
            <td colSpan={14} style={{ padding: "6px 28px", fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Anuais
            </td>
          </tr>
          {(data.licence_pipeline?.annual_licences || []).map((l, i) => {
            const byMonthAmounts = {};
            for (const m of MONTHS) byMonthAmounts[m] = m === l.month ? l.amount : 0;
            return (
              <tr key={`al${i}`} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td
                  className="col-label"
                  style={{
                    padding: "6px 10px 6px 28px",
                    fontSize: 12,
                    color: C.muted,
                    position: "sticky",
                    left: 0,
                    background: C.surface,
                    zIndex: 1,
                  }}
                >
                  {l.client} · {l.service}
                  {l.already_in_books && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: C.green }}>✓ SO</span>
                  )}
                </td>
                {MONTHS.map((m) => (
                  <Cell key={m} amount={byMonthAmounts[m]} status={byMonthAmounts[m] ? l.status : null} compact />
                ))}
                <td style={{ textAlign: "right", padding: "6px 10px", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(l.amount)}
                </td>
              </tr>
            );
          })}
        </>
      )}
    </>
  );
}

export default function ActionsTab({ data }) {
  return (
    <div className="table-scroll" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
      <table className="dash-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <MonthHeader />
        <tbody>
          <Section
            sectionKey="paid"
            label="Pago"
            byMonth={data.paid}
            defaultOpen={false}
            rowsBuilder={() =>
              itemsToRows(data.paid, "paid", (it) =>
                `${it.client || "—"} · ${it.number || ""}${it.receipted ? " ✓" : ""}`
              )
            }
          />
          <Section
            sectionKey="billed"
            label="Faturado / Por Pagar"
            byMonth={data.billed}
            defaultOpen={true}
            rowsBuilder={() =>
              itemsToRows(data.billed, "billed", (it) =>
                `${it.client || "—"} · ${it.number || ""}${it.is_overdue ? " ⚠" : ""}`
              )
            }
          />
          <Section
            sectionKey="so"
            label="SOs Por Faturar"
            byMonth={data.so_pending}
            defaultOpen={true}
            rowsBuilder={() =>
              itemsToRows(data.so_pending, "pending", (it) =>
                `${it.client || "—"} (${it.so_number || ""})${it.desc ? " — " + it.desc : ""}`
              )
            }
          />
          <LicencesSection data={data} />
          <GrandTotalRow data={data} />
        </tbody>
      </table>
    </div>
  );
}
