// client/src/components/InstallHolistic.jsx
//
// Bloque de instalación PWA para el inicio. Reemplaza el banner que aparecía
// solo. Si el navegador soporta instalación nativa (Chrome/Android/desktop),
// el botón dispara el prompt (agrega el ícono a la pantalla de inicio). Si no
// (típico iOS/Safari), muestra las instrucciones manuales para "Agregar a
// inicio". Si la app ya está instalada, no se muestra.

import { useState } from "react";
import { usePWA } from "../hooks/usePWA";
import { useBranding } from "../lib/branding.js";

const isIOS = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function InstallHolistic() {
  const branding = useBranding();
  const { canInstall, isInstalled, promptInstall } = usePWA();
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  if (isInstalled || installed) return null; // ya la tenés → no molestar

  // El branding.name puede venir con tagline ("Holistic | Nutricion Superior");
  // acá usamos solo la marca corta.
  const name = (branding.name || "Holistic").split("|")[0].trim() || "Holistic";
  const ios = isIOS();

  async function handleClick() {
    if (canInstall) {
      const ok = await promptInstall();
      if (ok) setInstalled(true);
    } else {
      setShowHelp((v) => !v);
    }
  }

  return (
    <div style={S.card}>
      <div style={S.glow} aria-hidden="true" />
      <div style={S.row}>
        <div style={S.iconWrap}>
          {branding.logo_url
            ? <img src={branding.logo_url} alt="" style={S.icon} />
            : <span style={{ fontSize: 26 }}>📲</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.eyebrow}>App</div>
          <div style={S.title}>Instalá {name}</div>
          <div style={S.sub}>Acceso directo desde tu pantalla de inicio — más rápido y sin buscar el link.</div>
        </div>
        <button style={S.btn} onClick={handleClick}>
          {canInstall ? "Instalar" : (showHelp ? "Ocultar" : "Cómo instalar")}
        </button>
      </div>

      {showHelp && !canInstall && (
        <div style={S.help}>
          {ios ? (
            <>
              <div style={S.helpTitle}>📱 En iPhone / iPad (Safari)</div>
              <ol style={S.ol}>
                <li>Tocá el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba ↑), en la barra de abajo.</li>
                <li>Deslizá y elegí <b>“Agregar a inicio”</b> (Add to Home Screen).</li>
                <li>Tocá <b>Agregar</b>. El ícono de {name} queda en tu pantalla, como una app.</li>
              </ol>
            </>
          ) : (
            <>
              <div style={S.helpTitle}>📱 En Android (Chrome)</div>
              <ol style={S.ol}>
                <li>Tocá el menú <b>⋮</b> (arriba a la derecha).</li>
                <li>Elegí <b>“Instalar app”</b> o <b>“Agregar a pantalla de inicio”</b>.</li>
                <li>Confirmá. El ícono de {name} queda en tu inicio.</li>
              </ol>
              <div style={{ ...S.helpTitle, marginTop: 14 }}>💻 En computadora (Chrome / Edge)</div>
              <ol style={S.ol}>
                <li>En la barra de direcciones, tocá el ícono de <b>instalar</b> (un monitor con una flecha ⤓).</li>
                <li>Confirmá <b>Instalar</b>. Queda como app de escritorio.</li>
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  card: {
    position: "relative", overflow: "hidden",
    background: "linear-gradient(135deg, rgba(var(--brand-primary-rgb,245,224,58),.10), rgba(var(--brand-accent-rgb,255,140,42),.05))",
    border: "1px solid rgba(var(--brand-primary-rgb,245,224,58),.28)",
    borderRadius: 18, padding: "18px 20px", marginBottom: 22,
  },
  glow: {
    position: "absolute", top: -60, right: -40, width: 200, height: 200, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(var(--brand-primary-rgb,245,224,58),.18), transparent 65%)",
    pointerEvents: "none",
  },
  row: { position: "relative", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" },
  iconWrap: {
    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
    background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.1)",
    display: "grid", placeItems: "center", overflow: "hidden",
  },
  icon: { width: 40, height: 40, objectFit: "contain" },
  eyebrow: {
    fontFamily: "'Gotham', monospace", fontSize: 9, letterSpacing: "2.5px",
    textTransform: "uppercase", color: "var(--brand-primary, #f5e03a)", fontWeight: 700, marginBottom: 4,
  },
  title: {
    fontFamily: "'Gotham', sans-serif", fontSize: 18, fontWeight: 900, color: "#fff",
    lineHeight: 1.15, letterSpacing: "-.01em",
  },
  sub: { fontSize: 12.5, color: "rgba(255,255,255,.6)", marginTop: 4, lineHeight: 1.45 },
  btn: {
    flexShrink: 0, padding: "11px 20px", borderRadius: 999, border: "none",
    background: "var(--brand-primary, #f5e03a)", color: "#000",
    fontFamily: "inherit", fontWeight: 900, fontSize: 13, letterSpacing: ".4px", cursor: "pointer",
    boxShadow: "0 8px 24px -8px rgba(var(--brand-primary-rgb,245,224,58),.6)",
  },
  help: {
    position: "relative", marginTop: 16, paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,.1)",
  },
  helpTitle: { fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 6 },
  ol: { margin: 0, paddingLeft: 20, display: "grid", gap: 6, fontSize: 13, color: "rgba(255,255,255,.75)", lineHeight: 1.5 },
};
