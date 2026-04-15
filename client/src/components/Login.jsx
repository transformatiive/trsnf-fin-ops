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
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 380,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 32,
          boxShadow: "0 6px 24px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ fontSize: 13, color: C.muted, letterSpacing: 1, textTransform: "uppercase" }}>
          Transformatiive
        </div>
        <h1 style={{ margin: "8px 0 24px", fontSize: 22 }}>Financial Dashboard</h1>

        <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6 }}>
          Password
        </label>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="••••••••••••"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: `1px solid ${C.borderStrong}`,
            borderRadius: 8,
            fontSize: 14,
            outline: "none",
            background: "#fafaf7",
          }}
        />
        {error && (
          <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={submitting || !pw}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "10px 14px",
            background: submitting ? C.faint : C.text,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "A verificar…" : "Entrar"}
        </button>

        <div style={{ fontSize: 11, color: C.faint, marginTop: 16, lineHeight: 1.6 }}>
          Acesso restrito a Transformatiive Lda.
        </div>
      </form>
    </div>
  );
}
