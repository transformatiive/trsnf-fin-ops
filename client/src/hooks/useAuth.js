import { useCallback, useEffect, useState } from "react";

// Persisted in localStorage so the session survives browser closes.
// The token has a 12h TTL enforced server-side, so this is safe.
const STORAGE_KEY = "trnsf_session_token";

function readToken() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeToken(t) {
  try {
    if (t) localStorage.setItem(STORAGE_KEY, t);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function useAuth() {
  const [token, setToken] = useState(() => readToken());
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    async function verify() {
      const t = readToken();
      if (!t) {
        if (alive) setChecking(false);
        return;
      }
      try {
        const res = await fetch("/api/session", {
          headers: { Authorization: `Bearer ${t}` },
        });
        const body = await res.json();
        if (!alive) return;
        if (!body.valid) {
          writeToken(null);
          setToken(null);
        } else {
          setToken(t);
        }
      } catch {
        // keep token, let API calls fail if truly broken
      } finally {
        if (alive) setChecking(false);
      }
    }
    verify();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (password) => {
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Password incorrecta");
        return false;
      }
      const body = await res.json();
      writeToken(body.token);
      setToken(body.token);
      return true;
    } catch (e) {
      setError("Erro de rede: " + e.message);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    writeToken(null);
    setToken(null);
  }, []);

  const authedFetch = useCallback(
    (url, opts = {}) => {
      const headers = { ...(opts.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch(url, { ...opts, headers });
    },
    [token]
  );

  return { token, checking, error, login, logout, authedFetch };
}
