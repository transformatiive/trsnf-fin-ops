import { useCallback, useEffect, useRef, useState } from "react";

export function useAnalysis(token, tab, enabled) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const run = useCallback(async () => {
    if (!enabled || !token) return;
    setLoading(true);
    setError(null);
    setText("");

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      // SSE over fetch (EventSource doesn't support auth headers)
      const res = await fetch(`/api/analysis?tab=${tab}&token=${encodeURIComponent(token)}`, {
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") {
            setLoading(false);
            return;
          }
          try {
            const { text: chunk } = JSON.parse(payload);
            if (chunk) setText((prev) => prev + chunk);
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [enabled, token, tab]);

  useEffect(() => {
    if (enabled) run();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, enabled]);

  return { text, loading, error, reload: run };
}
