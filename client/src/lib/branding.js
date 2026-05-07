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

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Defaults inlined — espejar /branding.json del repo.
const BRANDING_DEFAULTS = {
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
const FEATURE_DEFAULTS = { chat: true, stories: true, friends: true, coins: true, webauthn: true };
const RULE_DEFAULTS    = { signup_mode: "open", email_verify_required: true };

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

function applyToDOM(b) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", b.color_primary);
  root.style.setProperty("--brand-accent",  b.color_accent);
  root.style.setProperty("--brand-bg",      b.color_bg);
  root.style.setProperty("--brand-text",    b.color_text);
  root.style.setProperty("--brand-font",    BRANDING_DEFAULTS.fonts[b.font_preset] || BRANDING_DEFAULTS.fonts.moderna);
  // RGB triplets para componer rgba() en CSS sin perder customización.
  // Uso: rgba(var(--brand-primary-rgb), 0.5)
  const primaryRgb = hexToRgbTriplet(b.color_primary);
  const accentRgb  = hexToRgbTriplet(b.color_accent);
  if (primaryRgb) root.style.setProperty("--brand-primary-rgb", primaryRgb);
  if (accentRgb)  root.style.setProperty("--brand-accent-rgb",  accentRgb);
  if (b.name)        document.title = b.name;
  if (b.favicon_url) {
    let link = document.querySelector("link[rel='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = b.favicon_url;
  }
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
        const branding = mergeDefined(BRANDING_DEFAULTS, remote.branding || {});
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
