// useBranding — hook que aplica defaults de marca en runtime.
//
// Sprint 1 (esqueleto): lee defaults locales y los aplica como CSS vars +
// document.title. En Sprint 2 se conecta a /api/config/public, que devuelve
// los valores guardados por el setup wizard (con fallback a estos defaults
// si el backend está caído o sin configurar).
//
// Las CSS vars expuestas en :root son:
//   --brand-primary, --brand-accent, --brand-bg, --brand-text, --brand-font
//
// Cualquier componente que necesite el branding debe leer de ahí (CSS) o
// del objeto retornado (JS).

import { useEffect, useState } from "react";

// Defaults inlined — debe espejar /branding.json del repo. Sprint 2 los
// reemplaza con fetch a /api/config/public; este import sigue como fallback.
const DEFAULTS = {
  name: "Mi Portal",
  slogan: "Tu comunidad en un solo lugar",
  logo_url: "",
  favicon_url: "",
  color_primary: "#3B82F6",
  color_accent:  "#F59E0B",
  color_bg:      "#080808",
  color_text:    "#EDE9E0",
  font_preset:   "moderna",
  fonts: {
    moderna:  "Inter, sans-serif",
    clasica:  "Georgia, serif",
    tech:     "JetBrains Mono, monospace",
    friendly: "Quicksand, sans-serif",
  },
};

function applyToDOM(b) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", b.color_primary);
  root.style.setProperty("--brand-accent",  b.color_accent);
  root.style.setProperty("--brand-bg",      b.color_bg);
  root.style.setProperty("--brand-text",    b.color_text);
  root.style.setProperty("--brand-font",    b.fonts[b.font_preset] || b.fonts.moderna);
  if (b.name)        document.title = b.name;
  if (b.favicon_url) {
    let link = document.querySelector("link[rel='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = b.favicon_url;
  }
}

export function useBranding() {
  const [branding, setBranding] = useState(DEFAULTS);

  useEffect(() => {
    // Aplicar defaults inmediatamente (sin esperar fetch)
    applyToDOM(DEFAULTS);

    // Pull overrides del wizard (Sprint 2). Si el backend está caído o el
    // wizard no fue completado, mantenemos los defaults sin romper.
    const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
    fetch(`${API}/api/config/public`)
      .then(r => r.ok ? r.json() : null)
      .then(remote => {
        if (!remote?.branding) return;
        // Merge: cualquier campo no vacío del backend pisa al default.
        const merged = { ...DEFAULTS };
        for (const k of Object.keys(remote.branding)) {
          const v = remote.branding[k];
          if (v !== null && v !== undefined && v !== "") merged[k] = v;
        }
        setBranding(merged);
        applyToDOM(merged);
      })
      .catch(() => { /* mantener defaults */ });
  }, []);

  return branding;
}

export const BRANDING_DEFAULTS = DEFAULTS;
