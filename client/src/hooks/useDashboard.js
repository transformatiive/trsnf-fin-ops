import { useCallback, useEffect, useState } from "react";

export function useDashboard(authedFetch, enabled, year) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(
    async (force = false) => {
      if (!enabled) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (year) params.set("year", String(year));
        if (force) params.set("refresh", "1");
        const qs = params.toString();
        const res = await authedFetch("/api/dashboard" + (qs ? `?${qs}` : ""));
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
        }
        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [authedFetch, enabled, year]
  );

  useEffect(() => {
    if (enabled) load(false);
  }, [enabled, load]);

  return { data, loading, error, lastRefresh, reload: () => load(true) };
}
