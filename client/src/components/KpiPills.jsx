import React from "react";
import { C } from "../utils/constants";
import { fmt } from "../utils/fmt";

function Pill({ label, value, bg, fg, border }) {
  return (
    <div
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        borderRadius: 999,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 13,
      }}
    >
      <span style={{ opacity: 0.8 }}>{label}</span>
      <strong style={{ fontSize: 14 }}>{value}</strong>
    </div>
  );
}

export default function KpiPills({ data, netResult }) {
  if (!data) return null;
  const t = data.totals || {};
  const totalForecast = (t.paid || 0) + (t.billed || 0) + (t.so_pending || 0) + (t.licence_pipeline || 0);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Pill label="Pago YTD" value={fmt(t.paid)} bg={C.greenLight} fg={C.greenText} border={C.greenBorder} />
      <Pill label="Faturado / por pagar" value={fmt(t.billed)} bg={C.blueLight} fg={C.blueText} border={C.blueBorder} />
      <Pill label="SOs por faturar" value={fmt(t.so_pending)} bg={C.amberLight} fg={C.amberText} border={C.amberBorder} />
      <Pill label="Licenças pipeline" value={fmt(t.licence_pipeline)} bg={C.amberLight} fg={C.amberText} border={C.amberBorder} />
      <Pill label="Previsão total" value={fmt(totalForecast)} bg={C.purpleLight} fg={C.purple} border="#d8b4fe" />
      <Pill
        label="Resultado líquido"
        value={fmt(netResult)}
        bg={netResult >= 0 ? C.greenLight : C.redLight}
        fg={netResult >= 0 ? C.greenText : C.red}
        border={netResult >= 0 ? C.greenBorder : "#fecaca"}
      />
    </div>
  );
}
