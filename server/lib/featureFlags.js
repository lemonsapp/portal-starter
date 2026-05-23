// server/lib/featureFlags.js
//
// Helper para feature flags server-side. Spec § 11.
//
//   await isFeatureEnabled("chat")  → boolean
//   requireFeature("chat")          → middleware Express; 404 si flag está OFF
//
// Las flags viven en app_config con prefijo `features.*` (ver configStore.js).
// Default es true para todas (en KEY_CATALOG).

"use strict";

const cs = require("./configStore");

const KNOWN_FLAGS = ["chat", "stories", "friends", "coins", "webauthn", "shop"];

async function isFeatureEnabled(name) {
  if (!KNOWN_FLAGS.includes(name)) {
    console.warn(`[featureFlags] flag desconocido: "${name}"`);
    return true;  // fail-open: si no se conoce, asumimos que está activa
  }
  const v = await cs.getConfig(`features.${name}`);
  // null = nunca se configuró, usar default true del catalog (cs.getConfig
  // ya lo resuelve al default si no hay row)
  return v !== false;
}

function requireFeature(name) {
  return async (req, res, next) => {
    try {
      const enabled = await isFeatureEnabled(name);
      if (!enabled) {
        return res.status(404).json({ error: `Feature "${name}" deshabilitada` });
      }
      next();
    } catch (e) {
      console.error(`[featureFlags requireFeature ${name}]`, e);
      // Fail-open en caso de error: mejor servir la feature que romper.
      next();
    }
  };
}

module.exports = { isFeatureEnabled, requireFeature, KNOWN_FLAGS };
