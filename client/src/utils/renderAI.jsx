import React from "react";
import { C } from "./constants";

function renderInline(text, keyPrefix = "") {
  // Split on **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-b${i}`} style={{ color: C.text }}>
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t${i}`}>{p}</React.Fragment>;
  });
}

export function renderAI(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const nodes = [];

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      nodes.push(<div key={`sp${idx}`} style={{ height: 6 }} />);
      return;
    }
    if (line.startsWith("## ")) {
      nodes.push(
        <div
          key={`h${idx}`}
          style={{ fontWeight: 700, color: C.purple, marginTop: 10, marginBottom: 4, fontSize: 14 }}
        >
          {renderInline(line.slice(3), `h${idx}`)}
        </div>
      );
      return;
    }
    // Numbered list "1. ..."
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      nodes.push(
        <div key={`n${idx}`} style={{ display: "flex", gap: 8, margin: "6px 0", lineHeight: 1.6 }}>
          <span style={{ color: C.purple, fontWeight: 700, minWidth: 16 }}>{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2], `n${idx}`)}</span>
        </div>
      );
      return;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      nodes.push(
        <div key={`li${idx}`} style={{ display: "flex", gap: 8, margin: "4px 0", lineHeight: 1.6 }}>
          <span style={{ color: C.purple, fontWeight: 700 }}>→</span>
          <span>{renderInline(line.slice(2), `li${idx}`)}</span>
        </div>
      );
      return;
    }
    nodes.push(
      <div key={`p${idx}`} style={{ lineHeight: 1.8, margin: "4px 0" }}>
        {renderInline(line, `p${idx}`)}
      </div>
    );
  });

  return nodes;
}
