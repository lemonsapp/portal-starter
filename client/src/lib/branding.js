// client/src/lib/branding.js
//
// useBranding() + useFeatureFlag() — hooks para branding y feature flags.
//
// Ambos comparten un fetch único a /api/config/public (cacheado en módulo).
// El primer hook que monta dispara el fetch; los siguientes reusan el cache.
//
// useBranding aplica defaults inmediatos a CSS vars (sin esperar fetch),
// y al recibir overrides remotos los re-aplica.

import { useEffect, useState } from "react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

// Defaults inlined — espejar /branding.json del repo. Se aplican antes del
// fetch a /api/config/public para evitar flash. Si actualizás branding.json,
// actualizá acá también (no hay import directo porque está fuera del root
// de Vite y queremos zero-build-step).
const BRANDING_DEFAULTS = {
  name: "Holistic",
  // Espejo EXACTO del slogan configurado en app_config: el default se pinta
  // antes del fetch a /api/config/public — si difiere del remoto, el usuario
  // ve el texto viejo un instante y después el cambio (flash en el login).
  slogan: "Nutricion Superior",
  logo_url: "/portal/icons/holistic-logo.svg",
  // icon.svg = H blanca sobre cuadrado negro (misma marca que la web);
  // holistic-logo.svg es H negra sobre transparente y desaparece en tabs oscuras.
  favicon_url: "/portal/icons/icon.svg",
  color_primary: "#52b788",
  color_accent:  "#d4a574",
  color_bg:      "#080808",
  color_text:    "#EDE9E0",
  font_preset:   "moderna",
  // Gotham es la única familia self-hosted del portal Holistic. Los presets
  // legacy quedan apuntando a Gotham con stacks distintos para que el admin
  // pueda elegir "look" sin instalar más fonts. Si en el futuro otro cliente
  // quiere otra familia, ampliar acá + cargar @font-face en styles.css.
  fonts: {
    moderna:  "'Gotham', ui-sans-serif, system-ui, -apple-system, sans-serif",
    clasica:  "'Gotham', ui-serif, Georgia, serif",
    tech:     "'Gotham', ui-monospace, 'JetBrains Mono', monospace",
    friendly: "'Gotham Rounded', 'Gotham', ui-sans-serif, sans-serif",
  },
};
const FEATURE_DEFAULTS = { chat: true, stories: true, friends: true, coins: true, webauthn: true, shop: true };
const RULE_DEFAULTS    = { signup_mode: "open", email_verify_required: false, coins_on_register: 3 };

// ── Cache singleton ──────────────────────────────────────────────────────────
let cachedConfig = null;       // { branding, features, rules } en estado actual (defaults o remoto)
let inflight = null;            // Promise del fetch actual (de-dup)
const subscribers = new Set();  // listeners para notificar cuando llega remoto

function notify() {
  for (const cb of subscribers) cb(cachedConfig);
}

// "#f5e03a" → "245, 224, 58" (formato listo para usar dentro de rgba()).
// Acepta también #fff (3 dígitos). Si el input es inválido devuelve null.
function hexToRgbTriplet(hex) {
  if (!hex || typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// Setea o actualiza un <meta {selector}> con el value dado (lo agrega si no existe).
function setMeta(selector, attr, value) {
  if (!value) return;
  let el = document.head.querySelector(`meta[${selector}]`);
  if (!el) {
    el = document.createElement("meta");
    const [k, v] = selector.split("=");
    el.setAttribute(k, v.replace(/['"]/g, ""));
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function applyToDOM(b) {
  if (typeof document === "undefined") return;
  // Sprint 14 (2026-05-23): los colores y la tipografía quedaron CONGELADOS
  // en el design system fijo del client/index.html. Ya no se aplican en
  // runtime — el wizard de admin sigue editando branding.name/slogan/logo
  // pero esos campos NO modifican los tokens visuales. Esto garantiza
  // consistencia visual y evita "branding wars" entre tenants.
  //
  // Lo que SÍ sigue aplicándose en runtime: title + meta tags + favicon
  // (afectan SEO + chrome del browser, no el visual del producto).

  // Title
  if (b.name) document.title = b.name;

  // Metas PWA (también las renderiza el server al servir el HTML — esto
  // cubre el caso dev con Vite o el caso "admin acaba de cambiar el nombre,
  // navegó a otra página y queremos refrescar los metas en vivo").
  if (b.name) {
    setMeta("name='application-name'",         "content", b.name);
    setMeta("name='apple-mobile-web-app-title'", "content", b.name);
    setMeta("property='og:title'",              "content", b.name);
    setMeta("name='twitter:title'",             "content", b.name);
  }
  if (b.slogan) {
    setMeta("name='description'",         "content", b.slogan);
    setMeta("property='og:description'",  "content", b.slogan);
    setMeta("name='twitter:description'", "content", b.slogan);
  }
  // theme-color y msapplication-TileColor hardcoded al design system fijo
  // (mismos valores que :root del index.html). Antes se ataban al wizard
  // pero ahora los colores están congelados.
  setMeta("name='theme-color'", "content", "#06070A");
  setMeta("name='msapplication-TileColor'", "content", "#06070A");
  if (b.logo_url) setMeta("property='og:image'", "content", b.logo_url);

  // Favicon (si el admin subió uno custom). Si es el default no se toca el
  // DOM: el index.html ya trae el par SVG + PNG 192 correcto y pisarlo acá
  // rompería el fallback PNG (mobile Chrome prefiere el PNG para la tab).
  if (b.favicon_url && b.favicon_url !== BRANDING_DEFAULTS.favicon_url) {
    // Un favicon custom reemplaza TODOS los links de icono: si quedara el
    // PNG default al lado, varios browsers (mobile sobre todo) lo eligen
    // por tamaño y el custom nunca se ve.
    for (const link of document.querySelectorAll("link[rel='icon']")) link.remove();
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = b.favicon_url;
    document.head.appendChild(link);
  }
}

// ── Reparación de valores legacy guardados por el wizard en la DB ────────────
// 1. URLs absolutas al dominio del deploy viejo → path relativo, para que
//    resuelvan contra el dominio actual (hgrowshop.com) y no crucen origen.
// 2. holistic-logo.svg como favicon → icon.svg: el logo es H negra sobre
//    transparente y desaparece en tabs oscuras; el favicon real es la H
//    blanca sobre cuadrado negro.
const LEGACY_ORIGIN = "https://portal-starter.vercel.app";

function normalizeBranding(remote) {
  const out = { ...remote };
  for (const k of ["logo_url", "favicon_url"]) {
    if (typeof out[k] === "string" && out[k].startsWith(LEGACY_ORIGIN)) {
      out[k] = out[k].slice(LEGACY_ORIGIN.length);
    }
  }
  if (typeof out.favicon_url === "string" && out.favicon_url.endsWith("/holistic-logo.svg")) {
    out.favicon_url = BRANDING_DEFAULTS.favicon_url;
  }
  return out;
}

function ensureCachedDefaults() {
  if (cachedConfig) return;
  cachedConfig = { branding: BRANDING_DEFAULTS, features: FEATURE_DEFAULTS, rules: RULE_DEFAULTS };
  applyToDOM(cachedConfig.branding);
}

function fetchOnce() {
  if (inflight) return inflight;
  inflight = fetch(`${API}/api/config/public`)
    .then(r => r.ok ? r.json() : null)
    .then(remote => {
      if (remote && (remote.branding || remote.features || remote.rules)) {
        const branding = mergeDefined(BRANDING_DEFAULTS, normalizeBranding(remote.branding || {}));
        const features = { ...FEATURE_DEFAULTS, ...(remote.features || {}) };
        const rules    = { ...RULE_DEFAULTS,    ...(remote.rules    || {}) };
        cachedConfig = { branding, features, rules };
        applyToDOM(branding);
        notify();
      }
    })
    .catch(() => { /* mantener defaults */ })
    .finally(() => { inflight = null; });
  return inflight;
}

function mergeDefined(base, overrides) {
  const out = { ...base };
  for (const k of Object.keys(overrides)) {
    const v = overrides[k];
    if (v !== null && v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

// ── useBranding ──────────────────────────────────────────────────────────────
export function useBranding() {
  ensureCachedDefaults();
  const [b, setB] = useState(cachedConfig.branding);
  useEffect(() => {
    const cb = (c) => setB(c.branding);
    subscribers.add(cb);
    fetchOnce();
    return () => { subscribers.delete(cb); };
  }, []);
  return b;
}

// ── useFeatureFlag ───────────────────────────────────────────────────────────
export function useFeatureFlag(name) {
  ensureCachedDefaults();
  const [enabled, setEnabled] = useState(cachedConfig.features[name] ?? true);
  useEffect(() => {
    const cb = (c) => setEnabled(c.features[name] ?? true);
    subscribers.add(cb);
    fetchOnce();
    return () => { subscribers.delete(cb); };
  }, [name]);
  return enabled;
}

// ── useRules ─────────────────────────────────────────────────────────────────
export function useRules() {
  ensureCachedDefaults();
  const [r, setR] = useState(cachedConfig.rules);
  useEffect(() => {
    const cb = (c) => setR(c.rules);
    subscribers.add(cb);
    fetchOnce();
    return () => { subscribers.delete(cb); };
  }, []);
  return r;
}

export const KNOWN_FEATURE_FLAGS = Object.keys(FEATURE_DEFAULTS);
export { BRANDING_DEFAULTS, FEATURE_DEFAULTS, RULE_DEFAULTS };
