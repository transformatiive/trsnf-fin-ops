import React, { useMemo } from "react";
import { C } from "../utils/constants";
import { fmt } from "../utils/fmt";

function daysUntil(dateStr) {
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00Z");
  return Math.round((d - new Date()) / 86400000);
}

function fmtDate(dateStr) {
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00Z");
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function SummaryCard({ label, out, income, accent, light, border }) {
  const gap = income - out;
  return (
    <div style={{ background: light, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 16px", flex: "1 1 180px", minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: accent, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent, lineHeight: 1 }}>-{fmt(out)}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
        Recebes {fmt(income)} · margem <strong style={{ color: gap >= 0 ? C.greenText : C.red }}>{gap >= 0 ? "+" : ""}{fmt(gap)}</strong>
      </div>
    </div>
  );
}

export default function TimingTab({ data }) {
  const cal = data.licence_renewals?.calendar || [];

  const windows = useMemo(() => {
    const w = { 30: { out: 0, in: 0 }, 60: { out: 0, in: 0 }, 90: { out: 0, in: 0 }, 365: { out: 0, in: 0 } };
    for (const r of cal) {
      const dd = daysUntil(r.date);
      for (const k of [30, 60, 90, 365]) {
        if (dd <= k) { w[k].out += r.zoho_out; w[k].in += r.client_in; }
      }
    }
    return w;
  }, [cal]);

  if (!cal.length) {
    return (
      <div style={{ padding: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 13 }}>
        Sem compromissos Zoho nos próximos 365 dias (ou Partner Store indisponível).
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.5 }}>
        <strong style={{ color: C.text }}>Timing Zoho</strong> — quando tens de <strong>pagar ao Zoho</strong> (COGS das licenças) vs. o que <strong>recebes do cliente</strong>. O risco de tesouraria é pagares antes de receberes.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <SummaryCard label="Próximos 30 dias" out={windows[30].out} income={windows[30].in} accent={C.red} light={C.redLight} border={C.redBorder} />
        <SummaryCard label="Próximos 60 dias" out={windows[60].out} income={windows[60].in} accent={C.amberText} light={C.amberLight} border={C.amberBorder} />
        <SummaryCard label="Próximos 90 dias" out={windows[90].out} income={windows[90].in} accent={C.amberText} light={C.amberLight} border={C.amberBorder} />
        <SummaryCard label="Próximos 365 dias" out={windows[365].out} income={windows[365].in} accent={C.blueText} light={C.blueLight} border={C.blueBorder} />
      </div>

      <div className="table-scroll" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Data Zoho", "Cliente", "Pagas ao Zoho", "Recebes", "Margem", "Estado"].map((h, i) => (
                <th key={h} style={{ textAlign: i >= 2 && i <= 4 ? "right" : "left", padding: "8px 10px", fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cal.map((r, i) => {
              const dd = daysUntil(r.date);
              const soon = dd <= 30;
              const state = r.is_own
                ? { label: "Própria (custo)", color: C.muted, bg: C.surfaceAlt }
                : r.already_in_books
                ? { label: "Já em SO", color: C.greenText, bg: C.greenLight }
                : r.is_recurring
                ? { label: "Avença mensal", color: C.blueText, bg: C.blueLight }
                : { label: "A faturar", color: C.amberText, bg: C.amberLight };
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, background: soon && !r.is_own ? "#fff8f6" : "transparent" }}>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: C.text }}>
                    {fmtDate(r.date)}
                    <span style={{ color: soon ? C.red : C.faint, fontSize: 10, marginLeft: 6 }}>{dd}d</span>
                  </td>
                  <td style={{ padding: "8px 10px", color: C.text }}>
                    {r.client}
                    {r.orig_currency && r.orig_currency !== "EUR" && <span style={{ color: C.faint, fontSize: 10 }}> · {r.orig_currency}</span>}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: C.red, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>-{fmt(r.zoho_out)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: r.client_in ? C.greenText : C.faint, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{r.client_in ? fmt(r.client_in) : "—"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: r.margin >= 0 ? C.greenText : C.red, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{r.margin ? (r.margin > 0 ? "+" : "") + fmt(r.margin) : "—"}</td>
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: state.bg, color: state.color }}>{state.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, padding: 12, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
        <strong style={{ color: C.text }}>Como ler:</strong> cada linha é uma renovação Zoho. "Pagas ao Zoho" é o custo reseller que sai; "Recebes" é o que faturas ao cliente (0 nas subscrições próprias). "A faturar" = ainda sem SO — precisas de garantir o recebimento antes/à volta da data de pagamento ao Zoho.
      </div>
    </div>
  );
}
