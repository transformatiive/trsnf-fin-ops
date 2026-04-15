import React, { useState } from "react";
import { C } from "../utils/constants";

export default function Login({ onLogin, error }) {
  const [pw, setPw] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    await onLogin(pw);
    setSubmitting(false);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: C.bg,
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              background: C.text,
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
            Transformatiive
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: -0.5 }}>
            Financial Dashboard
          </h1>
        </div>

        <form
          onSubmit={submit}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            padding: 32,
            boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8, letterSpacing: 0.3 }}>
            PALAVRA-PASSE
          </label>
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••••••••••"
            style={{
              width: "100%",
              padding: "11px 14px",
              border: `1.5px solid ${error ? C.red : C.border}`,
              borderRadius: 10,
              fontSize: 15,
              outline: "none",
              background: C.surfaceAlt,
              color: C.text,
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => { e.target.style.borderColor = C.text; }}
            onBlur={(e) => { e.target.style.borderColor = error ? C.red : C.border; }}
          />
          {error && (
            <div style={{ color: C.red, fontSize: 13, marginTop: 8, fontWeight: 500 }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={submitting || !pw}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "12px 14px",
              background: submitting || !pw ? C.faint : C.text,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting || !pw ? "not-allowed" : "pointer",
              letterSpacing: 0.2,
              transition: "background 0.15s, transform 0.1s",
            }}
          >
            {submitting ? "A verificar…" : "Entrar"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 11, color: C.faint, marginTop: 20 }}>
          Acesso restrito a Transformatiive Lda.
        </div>
      </div>
    </div>
  );
}
