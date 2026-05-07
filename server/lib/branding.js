// server/lib/branding.js
//
// Helper para leer branding en runtime, combinando defaults del archivo
// /branding.json con overrides del wizard (configStore.app_config).
//
//   const b = await getBranding();
//   b.name, b.color_primary, etc.
//
// Cache de 30 segundos para evitar pegar contra Postgres en cada request
// que use branding (eg. cada email enviado). Si el admin acaba de guardar,
// los emails siguientes durante 30s usan el valor viejo — aceptable; los
// emails de verificación no son tiempo-real.

"use strict";

const path = require("path");
const cs = require("./configStore");

let DEFAULTS = {
  name: "Mi Portal",
  slogan: "Tu comunidad en un solo lugar",
  logo_url: "",
  favicon_url: "",
  color_primary: "#3B82F6",
  color_accent:  "#F59E0B",
  font_preset:   "moderna",
};
try { DEFAULTS = { ...DEFAULTS, ...require(path.join(__dirname, "..", "..", "branding.json")) }; } catch {}

const TTL_MS = 30_000;
let cache = null;
let cacheAt = 0;

async function getBranding() {
  const now = Date.now();
  if (cache && (now - cacheAt < TTL_MS)) return cache;

  const out = { ...DEFAULTS };
  try {
    for (const k of ["name","slogan","logo_url","favicon_url","color_primary","color_accent","font_preset"]) {
      const v = await cs.getConfig(`branding.${k}`);
      if (v !== null && v !== undefined && v !== "") out[k] = v;
    }
  } catch (e) {
    // Si configStore no responde (DB caída/MASTER_KEY mal), seguimos con defaults.
    console.warn("[branding] getBranding failed, using defaults:", e.message);
  }
  cache = out;
  cacheAt = now;
  return out;
}

function invalidateCache() {
  cache = null;
  cacheAt = 0;
}

module.exports = { getBranding, invalidateCache, DEFAULTS };
