import React, { useState } from "react";
import { C, MONTHS, MONTHS_PT } from "../utils/constants";
import { DEFAULT_BUDGET } from "../hooks/useBudget";

function Field({ label, value, onChange, prefix = "€", step = 1, min = 0, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${C.border}`, borderRadius: 7, background: C.bg, overflow: "hidden" }}>
        {prefix && (
          <span style={{ padding: "0 10px", fontSize: 12, color: C.faint, borderRight: `1px solid ${C.border}`, lineHeight: "36px" }}>{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, border: "none", background: "transparent", padding: "8px 10px", fontSize: 13, color: C.text, outline: "none" }}
        />
      </div>
      {hint && <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 20, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
      {children}
    </div>
  );
}

export default function BudgetEditor({ budget, onSave, onClose }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(budget)));

  function setField(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setFixedCost(name, value) {
    setDraft((d) => ({
      ...d,
      fixed_costs: { ...d.fixed_costs, [name]: value },
    }));
  }

  function addFixedCost() {
    const name = prompt("Nome do custo fixo:");
    if (!name || !name.trim()) return;
    setDraft((d) => ({
      ...d,
      fixed_costs: { ...d.fixed_costs, [name.trim()]: 0 },
    }));
  }

  function removeFixedCost(name) {
    setDraft((d) => {
      const next = { ...d.fixed_costs };
      delete next[name];
      return { ...d, fixed_costs: next };
    });
  }

  function setOneOff(month, index, field, value) {
    setDraft((d) => {
      const items = [...(d.one_off[month] || [])];
      items[index] = { ...items[index], [field]: field === "amount" ? Number(value) : value };
      return { ...d, one_off: { ...d.one_off, [month]: items } };
    });
  }

  function addOneOff(month) {
    setDraft((d) => {
      const items = [...(d.one_off[month] || []), { label: "Nova saída", amount: 0 }];
      return { ...d, one_off: { ...d.one_off, [month]: items } };
    });
  }

  function removeOneOff(month, index) {
    setDraft((d) => {
      const items = [...(d.one_off[month] || [])];
      items.splice(index, 1);
      const next = { ...d.one_off };
      if (items.length === 0) delete next[month];
      else next[month] = items;
      return { ...d, one_off: next };
    });
  }

  const fixedBase = Object.values(draft.fixed_costs).reduce((a, b) => a + b, 0);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
        background: "rgba(0,0,0,0.35)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%", maxWidth: 480, height: "90dvh",
          background: C.surface, borderRadius: "14px 14px 0 0",
          display: "flex", flexDirection: "column",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Editar Orçamento</div>
            <div style={{ fontSize: 11, color: C.faint }}>Valores guardados localmente</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setDraft(JSON.parse(JSON.stringify(DEFAULT_BUDGET))); }}
              style={{ padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 7, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer" }}
            >
              Repor
            </button>
            <button
              onClick={onClose}
              style={{ padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 7, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <SectionTitle>Metas</SectionTitle>
          <Field label="Meta anual" value={draft.annual_goal} onChange={(v) => setField("annual_goal", v)} />
          <Field label="Meta mensal" value={draft.monthly_goal} onChange={(v) => setField("monthly_goal", v)} hint={`Anual ÷ 12 = €${Math.round(draft.annual_goal / 12).toLocaleString("pt-PT")}`} />

          <SectionTitle>Salário & Impostos</SectionTitle>
          <Field label="Salário mensal (Fev–Dez)" value={draft.salary} onChange={(v) => setField("salary", v)} />
          <Field
            label="Taxa IRC"
            value={Math.round(draft.irc_rate * 100)}
            onChange={(v) => setField("irc_rate", v / 100)}
            prefix="%"
            step={1}
            hint="Aplicado ao resultado positivo antes de impostos"
          />
          <Field
            label="Margem Zoho (pass-through)"
            value={Math.round(draft.margin * 100)}
            onChange={(v) => setField("margin", v / 100)}
            prefix="%"
            step={1}
            hint={`COGS = valor cliente ÷ ${draft.margin.toFixed(2)}`}
          />

          <SectionTitle>Custos Fixos Mensais — Total: €{fixedBase.toLocaleString("pt-PT")}</SectionTitle>
          {Object.entries(draft.fixed_costs).map(([name, val]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
              <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.border}`, borderRadius: 7, background: C.bg, overflow: "hidden" }}>
                <span style={{ padding: "0 8px", fontSize: 12, color: C.faint, borderRight: `1px solid ${C.border}`, lineHeight: "34px" }}>€</span>
                <input
                  type="number"
                  value={val}
                  min={0}
                  onChange={(e) => setFixedCost(name, Number(e.target.value))}
                  style={{ width: 72, border: "none", background: "transparent", padding: "7px 8px", fontSize: 12, color: C.text, outline: "none" }}
                />
              </div>
              <button
                onClick={() => removeFixedCost(name)}
                style={{ padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 7, background: "transparent", color: C.red, fontSize: 13, cursor: "pointer", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addFixedCost}
            style={{ width: "100%", padding: "8px", border: `1px dashed ${C.border}`, borderRadius: 7, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer", marginTop: 4 }}
          >
            + Adicionar custo fixo
          </button>

          <SectionTitle>Saídas Extraordinárias (por mês)</SectionTitle>
          {MONTHS.map((m, i) => {
            const items = draft.one_off[m] || [];
            return (
              <div key={m} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: C.faint, marginBottom: 4 }}>{MONTHS_PT[i]}</div>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) => setOneOff(m, idx, "label", e.target.value)}
                      style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 8px", fontSize: 12, color: C.text, background: C.bg, outline: "none" }}
                    />
                    <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.border}`, borderRadius: 7, background: C.bg, overflow: "hidden" }}>
                      <span style={{ padding: "0 6px", fontSize: 12, color: C.faint, borderRight: `1px solid ${C.border}`, lineHeight: "32px" }}>€</span>
                      <input
                        type="number"
                        value={item.amount}
                        min={0}
                        onChange={(e) => setOneOff(m, idx, "amount", e.target.value)}
                        style={{ width: 72, border: "none", background: "transparent", padding: "6px 8px", fontSize: 12, color: C.text, outline: "none" }}
                      />
                    </div>
                    <button
                      onClick={() => removeOneOff(m, idx)}
                      style={{ padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 7, background: "transparent", color: C.red, fontSize: 13, cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addOneOff(m)}
                  style={{ fontSize: 11, color: C.muted, background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
                >
                  + Adicionar saída em {MONTHS_PT[i]}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "11px", border: `1px solid ${C.border}`, borderRadius: 9, background: "transparent", color: C.text, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => { onSave(draft); onClose(); }}
            style={{ flex: 2, padding: "11px", border: "none", borderRadius: 9, background: C.text, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
