import React from "react";
import { C, ST } from "../utils/constants";

function Dot({ style }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        borderRadius: 3,
        background: style.bg,
        border: `1px solid ${style.border}`,
        marginRight: 6,
        verticalAlign: "middle",
      }}
    />
  );
}

export default function Legend() {
  return (
    <div style={{ display: "flex", gap: 18, fontSize: 12, color: C.muted, marginBottom: 10 }}>
      <span>
        <Dot style={ST.paid} />
        Pago
      </span>
      <span>
        <Dot style={ST.billed} />
        Faturado
      </span>
      <span>
        <Dot style={ST.pending} />
        Pendente
      </span>
      <span style={{ color: C.faint }}>— sem movimento</span>
    </div>
  );
}
