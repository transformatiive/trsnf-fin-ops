import React from "react";
import { ST } from "../utils/constants";
import { fmtK } from "../utils/fmt";

export default function Cell({ status = null, amount = 0, compact = false }) {
  const style = status ? ST[status] || ST.none : ST.none;
  const show = amount || status;
  return (
    <td
      style={{
        textAlign: "right",
        padding: compact ? "4px 6px" : "6px 8px",
        background: style.bg,
        color: style.fg,
        border: style.border !== "transparent" ? `1px solid ${style.border}` : "1px solid transparent",
        borderRadius: 4,
        fontSize: 12,
        fontVariantNumeric: "tabular-nums",
        minWidth: 60,
        whiteSpace: "nowrap",
      }}
    >
      {show ? (amount ? fmtK(amount) : "—") : "—"}
    </td>
  );
}
