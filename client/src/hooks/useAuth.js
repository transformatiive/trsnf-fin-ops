import { useCallback, useEffect, useState } from "react";

// Access is granted by a token in the URL: ?token=…
// The token is captured on load and persisted so refreshes/navigation keep working.
const STORAGE_KEY = "trnsf_access_token";

function tokenFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get("token");
  } catch {
    return null;
  }
}

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(t) {
  try {
    if (t) localStorage.setItem(STORAGE_KEY, t);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function useAuth() {
  const initial = tokenFromUrl() || readStored();
  const [token, setToken] = useState(initial);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const t = tokenFromUrl() || readStored();
    if (!t) {
      setChecking(false);
      setError("Sem token de acesso. Acede via o link com ?token=…");
      return;
    }
    fetch(`/api/session?token=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((body) => {
        if (!alive) return;
        if (body.valid) {
          writeStored(t);
          setToken(t);
        } else {
          writeStored(null);
          setToken(null);
          setError("Token inválido.");
        }
      })
      .catch(() => {
        // Network hiccup — keep the token, let API calls retry.
        if (alive) setToken(t);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const logout = useCallback(() => {
    writeStored(null);
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

  return { token, checking, error, logout, authedFetch };
}
