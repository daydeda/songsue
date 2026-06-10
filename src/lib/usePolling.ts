import { useEffect, useRef } from "react";

/**
 * Lightweight polling hook used in place of a websocket/SSE real-time layer.
 *
 * Why polling: on the Supabase free tier, Realtime is capped at 200 concurrent
 * connections — a single busy event could exceed that with student devices alone.
 * Polling has no connection cap, needs no extra infrastructure, and costs $0 on
 * Vercel Hobby + Supabase free.
 *
 * Free-tier friendly behaviour:
 *  - Fires `callback` immediately on mount (when the tab is visible) and again
 *    each time the tab regains focus, so data is fresh the moment the user looks.
 *  - Polls every `intervalMs` only while the tab is visible.
 *  - Pauses entirely when the tab is hidden, so idle background tabs don't burn
 *    function invocations or database queries.
 *
 * The callback is read from a ref, so passing a fresh inline function each render
 * is fine — the interval always invokes the latest version without restarting.
 */
export function usePolling(callback: () => void, intervalMs: number) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const start = () => {
      if (timer) return;
      timer = setInterval(() => savedCallback.current(), intervalMs);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        savedCallback.current();
        start();
      } else {
        stop();
      }
    };

    // Kick off based on the current visibility state.
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs]);
}
