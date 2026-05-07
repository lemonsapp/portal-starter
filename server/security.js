// server/security.js — Utilidades de seguridad compartidas.
"use strict";

const sanitizeHtml = require("sanitize-html");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");

/**
 * Sanitiza texto user-generated quitando tags HTML/JS y normalizando espacios.
 * Para campos cortos (nombre, label, key, etc.). NO permite ningún tag.
 */
function sanitizeText(input, maxLen = 280) {
  if (input == null) return null;
  const str = String(input);
  const clean = sanitizeHtml(str, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    parser: { decodeEntities: true },
  });
  return clean.trim().slice(0, maxLen);
}

/**
 * Sanitiza texto largo permitiendo formato básico (negrita/itálica/links/quiebres).
 * Para body de anuncios, posts y bio.
 */
function sanitizeRichText(input, maxLen = 4000) {
  if (input == null) return null;
  const clean = sanitizeHtml(String(input), {
    allowedTags: ["b", "i", "em", "strong", "a", "br", "p", "ul", "ol", "li", "code"],
    allowedAttributes: { a: ["href", "title", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    },
  });
  return clean.trim().slice(0, maxLen);
}

/**
 * Quita HTML por completo y deja solo texto plano (para body de mensajes de chat).
 */
function stripHtml(input, maxLen = 1000) {
  return sanitizeText(input, maxLen);
}

// ── Rate limiters reutilizables ──────────────────────────────────────────────

/** Limita writes (POST/PATCH/DELETE) — 60/min por IP */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas escrituras. Esperá un minuto." },
});

/** Limita endpoints de upload — 20/hora por IP */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados uploads. Esperá una hora." },
});

/** Slow-down progresivo para login: cada intento >5 suma delay creciente */
const loginSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 5,
  delayMs: (hits) => Math.min(2000, (hits - 5) * 250),
  maxDelayMs: 5000,
  validate: { delayMs: false },
});

/**
 * Header anti-cache para endpoints sensibles (auth, datos privados).
 */
function noStore(req, res, next) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  next();
}

/**
 * Whitelist de columnas para UPDATEs dinámicos. Tirar error si una key no está.
 * Uso:
 *   const { fields, params } = buildUpdate(input, ALLOWED_USER_COLS);
 *   db.query(`UPDATE users SET ${fields.join(",")} WHERE id=$${params.length+1}`, [...params, id]);
 */
function buildUpdate(input, allowedCols) {
  const fields = [];
  const params = [];
  let i = 1;
  for (const [k, v] of Object.entries(input)) {
    if (!allowedCols.includes(k)) continue;
    fields.push(`${k}=$${i++}`);
    params.push(v);
  }
  return { fields, params };
}

/**
 * Asserts JWT_SECRET en producción.
 */
function assertJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "dev_secret_change_me") {
    if (process.env.NODE_ENV === "production") {
      console.error("[SECURITY] JWT_SECRET no está seteado en producción. Abortando.");
      process.exit(1);
    } else {
      console.warn("[SECURITY] WARNING: usando JWT_SECRET por defecto. Setealo en .env antes de prod.");
    }
  } else if (secret.length < 32) {
    console.warn("[SECURITY] JWT_SECRET es muy corto. Usá ≥32 chars (openssl rand -hex 32).");
  }
}

module.exports = {
  sanitizeText,
  sanitizeRichText,
  stripHtml,
  writeLimiter,
  uploadLimiter,
  loginSlowDown,
  noStore,
  buildUpdate,
  assertJwtSecret,
};
