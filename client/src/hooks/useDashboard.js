import { useCallback, useEffect, useState } from "react";

export function useDashboard(authedFetch, enabled) {
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
        const url = "/api/dashboard" + (force ? "?refresh=1" : "");
        const res = await authedFetch(url);
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
    [authedFetch, enabled]
  );

  useEffect(() => {
    if (enabled) load(false);
  }, [enabled, load]);

  return { data, loading, error, lastRefresh, reload: () => load(true) };
}
