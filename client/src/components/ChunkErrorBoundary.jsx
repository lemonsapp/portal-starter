// client/src/components/ChunkErrorBoundary.jsx
//
// Bug clásico SPA + lazy load: cuando Vercel pushea un build nuevo, los
// chunks viejos quedan referenciados en el HTML que el browser cacheó.
// Si el user navega a otra ruta lazy-loaded, el import dynamic falla con
// "Failed to fetch dynamically imported module" → React unmonta → pantalla
// gris hasta que el user refresca a mano.
//
// Este ErrorBoundary atrapa esos errores y recarga la página CON UN QUERY
// PARAM ÚNICO (_r=<ts>). Un reload() pelado puede volver a servir el MISMO
// HTML viejo (webview de Instagram/WhatsApp, PWA anclada en iOS, proxies):
// eso dejaba al usuario clavado en "Recargando…" tocando un link que
// repetía el mismo ciclo — visto en producción con el admin de Holistic el
// 2026-08-09. Al cambiar la URL, cualquier caché intermedia falla el match
// y el HTML llega fresco con los chunk hashes nuevos. main.jsx limpia el
// _r de la barra de direcciones al arrancar.
//
// Sólo se auto-recarga en errores de chunk. Un error de runtime cualquiera
// muestra una pantalla honesta de error (antes decía "Recargando…" aunque
// no fuera a recargar nada). El flag en sessionStorage evita el loop si el
// chunk realmente no existe: tras 2 intentos automáticos, queda el botón.

import { Component } from "react";

const RELOAD_FLAG_KEY = "holistic.chunkReload";
const RELOAD_FLAG_TTL_MS = 15_000;  // ventana para contar intentos seguidos
const MAX_AUTO_RELOADS = 2;         // después, sólo reintento manual

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

// Recarga con URL única: revienta cualquier caché de HTML en el camino.
export function recargarSinCache() {
    try {
        const u = new URL(window.location.href);
        u.searchParams.set("_r", Date.now().toString(36));
        window.location.replace(u.toString());
    } catch {
        window.location.reload();
    }
}

function leerFlag() {
    try {
        const raw = sessionStorage.getItem(RELOAD_FLAG_KEY);
        if (!raw) return null;
        const f = JSON.parse(raw);
        return (f && typeof f.t === "number") ? f : null;
    } catch { return null; }
}

export default class ChunkErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null, agotado: false };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        if (!isChunkLoadError(error)) {
            // No es chunk error — pantalla de error honesta, sin auto-reload.
            console.error("[ChunkErrorBoundary] non-chunk error:", error, info);
            return;
        }

        console.warn("[ChunkErrorBoundary] chunk load failed", error);

        // Contar intentos dentro de la ventana. Fuera de la ventana, el
        // contador arranca de nuevo (un deploy nuevo días después no hereda
        // los intentos de aquella vez).
        const now = Date.now();
        const flag = leerFlag();
        const intentos = (flag && now - flag.t < RELOAD_FLAG_TTL_MS) ? flag.n : 0;

        if (intentos >= MAX_AUTO_RELOADS) {
            console.error("[ChunkErrorBoundary] chunk sigue fallando tras recargas — queda el botón");
            this.setState({ agotado: true });
            return;
        }
        try { sessionStorage.setItem(RELOAD_FLAG_KEY, JSON.stringify({ t: now, n: intentos + 1 })); } catch {}

        // Si hay service worker activo, pedirle update por las dudas.
        try {
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.getRegistrations().then((regs) => {
                    regs.forEach((r) => r.update());
                });
            }
        } catch {}

        recargarSinCache();
    }

    render() {
        if (this.state.error) {
            const esChunk = isChunkLoadError(this.state.error);
            const wrap = {
                minHeight: "100vh",
                display: "grid", placeItems: "center",
                background: "#080808", color: "#A7F5C8",
                fontFamily: "system-ui, sans-serif",
                padding: 24, textAlign: "center",
            };
            const btn = {
                marginTop: 14, padding: "10px 22px", borderRadius: 999,
                border: "1px solid #A7F5C855", background: "transparent",
                color: "#A7F5C8", fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
            };

            if (esChunk) {
                // Auto-recarga en curso (o agotada). El botón siempre hace la
                // recarga cache-busteada — nunca el reload() que podía volver
                // a traer el mismo HTML viejo.
                return (
                    <div style={wrap}>
                        <div>
                            <div style={{ fontSize: 14, letterSpacing: ".2em", textTransform: "uppercase", opacity: .7, marginBottom: 12 }}>
                                {this.state.agotado ? "Hay una versión nueva" : "Actualizando…"}
                            </div>
                            <div style={{ fontSize: 11, opacity: .5 }}>
                                {this.state.agotado
                                    ? "No pudimos traerla solos. Tocá el botón para reintentar."
                                    : "Salió una versión nueva del portal, la estamos cargando."}
                            </div>
                            <button style={btn} onClick={recargarSinCache}>Recargar ahora</button>
                        </div>
                    </div>
                );
            }

            // Error de runtime: no mentir con "Recargando…" — acá no se
            // recarga nada solo. Recargar igual suele destrabar.
            return (
                <div style={wrap}>
                    <div>
                        <div style={{ fontSize: 14, letterSpacing: ".2em", textTransform: "uppercase", opacity: .7, marginBottom: 12 }}>
                            Algo se rompió
                        </div>
                        <div style={{ fontSize: 11, opacity: .5 }}>
                            Un error inesperado cortó esta pantalla. Probá recargar.
                        </div>
                        <button style={btn} onClick={recargarSinCache}>Recargar</button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
