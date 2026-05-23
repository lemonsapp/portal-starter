// client/src/components/ChunkErrorBoundary.jsx
//
// Bug clásico SPA + lazy load: cuando Vercel pushea un build nuevo, los
// chunks viejos quedan referenciados en el HTML que el browser cacheó.
// Si el user navega a otra ruta lazy-loaded, el import dynamic falla con
// "Failed to fetch dynamically imported module" → React unmonta → pantalla
// gris hasta que el user refresca a mano.
//
// Este ErrorBoundary atrapa específicamente esos errores y dispara
// window.location.reload() automático. La recarga trae HTML fresco con
// los chunk hashes nuevos del último deploy, y todo vuelve a andar.
//
// Sólo actuamos en errores de chunk loading — los demás errores se
// propagan al boundary de arriba (o caen en el catch del runtime).
// Usamos un flag en sessionStorage para evitar reload loops si el chunk
// realmente no existe (no es solo cache stale).

import { Component } from "react";

const RELOAD_FLAG_KEY = "holistic.chunkReload";
const RELOAD_FLAG_TTL_MS = 10_000;  // si reload no resuelve en 10s, no insistir

function isChunkLoadError(error) {
    if (!error) return false;
    if (error.name === "ChunkLoadError") return true;
    const msg = String(error.message || "");
    return (
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Loading chunk") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("Loading CSS chunk")
    );
}

export default class ChunkErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        if (!isChunkLoadError(error)) {
            // No es chunk error — log y dejar que el boundary externo o React
            // estándar lo maneje.
            console.error("[ChunkErrorBoundary] non-chunk error:", error, info);
            return;
        }

        console.warn("[ChunkErrorBoundary] chunk load failed — reloading", error);

        // Evitar reload loop: si ya intentamos hace <10s y el chunk sigue
        // fallando, NO hacer otro reload (el chunk realmente no existe).
        const lastReload = parseInt(sessionStorage.getItem(RELOAD_FLAG_KEY) || "0", 10);
        const now = Date.now();
        if (lastReload && now - lastReload < RELOAD_FLAG_TTL_MS) {
            console.error("[ChunkErrorBoundary] reload loop detectado — abortando");
            return;
        }
        sessionStorage.setItem(RELOAD_FLAG_KEY, String(now));

        // Si hay service worker activo, decirle al SW que se update + skip cache.
        // Esto fuerza que la próxima request al HTML vaya a la red, no al cache.
        try {
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.getRegistrations().then((regs) => {
                    regs.forEach((r) => r.update());
                });
            }
        } catch {}

        // Hard reload — bypass cache. true en algunos browsers; aún si lo
        // ignora, el cambio de URL + cache headers debería traer la nueva
        // versión del index.html.
        window.location.reload();
    }

    render() {
        if (this.state.error) {
            // Mientras se gestiona el reload, render fallback simple. El user
            // ve esto sólo si el reload no se disparó (no es chunk error o
            // reload loop). Para chunk errors, el reload ocurre antes que
            // este DOM se pinte.
            return (
                <div style={{
                    minHeight: "100vh",
                    display: "grid", placeItems: "center",
                    background: "#080808", color: "#A7F5C8",
                    fontFamily: "system-ui, sans-serif",
                    padding: 24, textAlign: "center",
                }}>
                    <div>
                        <div style={{ fontSize: 14, letterSpacing: ".2em", textTransform: "uppercase", opacity: .7, marginBottom: 12 }}>
                            Recargando…
                        </div>
                        <div style={{ fontSize: 11, opacity: .5 }}>
                            Si no recargás en 2 segundos, <a href="#" onClick={(e) => { e.preventDefault(); window.location.reload(); }} style={{ color: "#A7F5C8" }}>tocá acá</a>.
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
