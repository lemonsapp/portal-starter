import { useEffect } from "react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

/**
 * Heartbeat de presencia. Hace ping a /api/presence/ping:
 *   - inmediatamente al montar
 *   - cada `intervalMs`
 *   - al volver a foco (visibilitychange)
 *   - en eventos de actividad (focus, click, keydown) con debounce
 * Mantiene users.last_seen_at actualizado mientras el usuario está activo.
 */
export default function usePresence(intervalMs = 45000) {
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let abort = false;
    let lastPing = 0;
    function ping(force = false) {
      if (abort) return;
      if (!force && document.hidden) return;
      const now = Date.now();
      // throttle: no más de 1 ping cada 8s
      if (!force && now - lastPing < 8000) return;
      lastPing = now;
      fetch(`${API}/api/chat/presence/ping`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    }

    // ping inmediato al montar
    ping(true);

    // intervalo regular
    const iv = setInterval(() => ping(true), intervalMs);

    // gain focus / visibilitychange
    const onVis = () => { if (!document.hidden) ping(true); };
    const onFocus = () => ping(true);
    const onActivity = () => ping(false);

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("click", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });

    return () => {
      abort = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [intervalMs]);
}
