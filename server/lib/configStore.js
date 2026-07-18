// server/lib/configStore.js
//
// Almacén central de configs runtime: lee/escribe app_config en Postgres,
// encriptando los valores marcados como secretos con AES-256-GCM contra
// MASTER_KEY del .env.
//
// API:
//   await getConfig(key)              → string | null
//   await setConfig(key, value, opts) → { ok, key, isSecret }
//   await deleteConfig(key, opts)     → { ok, key }
//   await getPublicConfig()           → { branding, features, rules } sin secretos
//   await getAllSection(section)      → { ...keys }   (para admin, devuelve secretos como '••••••')
//
// Spec § 8.3 — Encriptación:
//   Algoritmo:  AES-256-GCM
//   Key:        MASTER_KEY (32 bytes hex)
//   Formato:    iv(12B):authTag(16B):ciphertext  → base64
//
// Si MASTER_KEY no está seteada, configStore lanza al primer setSecret().
// Get sobre un valor encriptado con MASTER_KEY incorrecta loguea y devuelve
// null (la app trata el config como ausente en lugar de crashear).

"use strict";

const crypto = require("crypto");
const db = require("../db");

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

// ── Bootstrap de la master key ───────────────────────────────────────────────
function getMasterKey() {
  const hex = process.env.MASTER_KEY;
  if (!hex) {
    throw new Error(
      "[configStore] MASTER_KEY no seteada en .env. " +
      "Generar con: openssl rand -hex 32"
    );
  }
  if (hex.length !== 64) {
    throw new Error(
      `[configStore] MASTER_KEY debe ser 32 bytes (64 hex chars). ` +
      `Tiene ${hex.length} chars. Generar con: openssl rand -hex 32`
    );
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error("[configStore] MASTER_KEY no es hex válido de 32 bytes");
  }
  return buf;
}

// ── Encrypt / decrypt ────────────────────────────────────────────────────────
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: iv | tag | ciphertext, base64
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

function decrypt(blob) {
  if (!blob) return null;
  try {
    const buf = Buffer.from(blob, "base64");
    if (buf.length < IV_LEN + TAG_LEN) {
      throw new Error("ciphertext demasiado corto");
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const key = getMasterKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch (e) {
    // No crashear: la app trata como config ausente. Spec § 8.3.
    console.error("[configStore] decrypt failed for value:", e.message);
    return null;
  }
}

function sha256Hex(s) {
  if (s === null || s === undefined) return null;
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}

// ── Catálogo de keys conocidas ───────────────────────────────────────────────
// Spec § 8.2. Marcado de is_secret define si se encripta antes de persistir.
const KEY_CATALOG = {
  // Branding (no secretos)
  "branding.name":          { type: "string", isSecret: false, defaultBranding: "name" },
  "branding.slogan":        { type: "string", isSecret: false, defaultBranding: "slogan" },
  "branding.logo_url":      { type: "string", isSecret: false, defaultBranding: "logo_url" },
  "branding.favicon_url":   { type: "string", isSecret: false, defaultBranding: "favicon_url" },
  "branding.color_primary": { type: "string", isSecret: false, defaultBranding: "color_primary" },
  "branding.color_accent":  { type: "string", isSecret: false, defaultBranding: "color_accent" },
  "branding.font_preset":   { type: "string", isSecret: false, defaultBranding: "font_preset" },

  // Cloudinary (cloud_name no es secreto, los otros sí)
  "cloudinary.cloud_name":   { type: "string", isSecret: false },
  "cloudinary.api_key":      { type: "string", isSecret: true  },
  "cloudinary.api_secret":   { type: "string", isSecret: true  },
  "cloudinary.folder_base":  { type: "string", isSecret: false },

  // Resend
  "resend.api_key":     { type: "string", isSecret: true  },
  "resend.from_email":  { type: "string", isSecret: false },
  "resend.from_name":   { type: "string", isSecret: false },

  // Telegram
  "telegram.bot_token": { type: "string", isSecret: true },
  "telegram.chat_id":   { type: "string", isSecret: true },

  // Reglas (no secretas — config del producto)
  "rules.coins_on_register":             { type: "int",  isSecret: false, default: 3 },
  "rules.coins_on_profile_complete":     { type: "int",  isSecret: false, default: 50  },
  "rules.coins_on_onboarding_complete":  { type: "int",  isSecret: false, default: 100 },
  "rules.email_verify_grace_days":       { type: "int",  isSecret: false, default: 7   },
  "rules.signup_mode":                   { type: "string", isSecret: false, default: "open" },
  "rules.email_verify_required":         { type: "bool", isSecret: false, default: true },
  "rules.allow_self_delete":             { type: "bool", isSecret: false, default: true },

  // Feature flags (no secretos)
  "features.chat":     { type: "bool", isSecret: false, default: true },
  "features.stories":  { type: "bool", isSecret: false, default: true },
  "features.friends":  { type: "bool", isSecret: false, default: true },
  "features.coins":    { type: "bool", isSecret: false, default: true },
  "features.webauthn": { type: "bool", isSecret: false, default: true },
  "features.shop":     { type: "bool", isSecret: false, default: true },

  // ── MercadoPago (Sprint 14 F2, 2026-05-23) ────────────────────────────────
  // access_token = secreto del cliente (cuenta seller). public_key es solo
  // para Bricks/Wallet en frontend (no usado en F2 — Checkout Pro redirect).
  // webhook_secret protege el endpoint /api/webhooks/mercadopago contra
  // requests fake.
  "mercadopago.access_token":   { type: "string", isSecret: true,  default: "" },
  "mercadopago.public_key":     { type: "string", isSecret: false, default: "" },
  "mercadopago.webhook_secret": { type: "string", isSecret: true,  default: "" },
  // Shop config no-secrets
  "shop.currency":              { type: "string", isSecret: false, default: "ARS" },
  "shop.shipping_cost_cents":   { type: "int",    isSecret: false, default: 0 },
  // Datos bancarios para pagar por transferencia (multilínea, se muestran
  // al comprador en el checkout/success). Vacío = la opción no se ofrece.
  "shop.transfer_details":      { type: "string", isSecret: false, default: "" },
};

function isKnownKey(key) {
  return Object.prototype.hasOwnProperty.call(KEY_CATALOG, key);
}

function isSecretKey(key) {
  return KEY_CATALOG[key]?.isSecret === true;
}

function castFromString(key, raw) {
  if (raw === null || raw === undefined) return null;
  const t = KEY_CATALOG[key]?.type || "string";
  if (t === "int")  { const n = parseInt(raw, 10); return Number.isFinite(n) ? n : null; }
  if (t === "bool") return raw === "true" || raw === "1" || raw === true;
  return String(raw);
}

function castToString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

// ── Lazy load del branding.json para defaults ───────────────────────────────
let _BRANDING_DEFAULTS = null;
function brandingDefaults() {
  if (_BRANDING_DEFAULTS) return _BRANDING_DEFAULTS;
  try {
    _BRANDING_DEFAULTS = require("../../branding.json");
  } catch {
    _BRANDING_DEFAULTS = {};
  }
  return _BRANDING_DEFAULTS;
}

function defaultFor(key) {
  const meta = KEY_CATALOG[key];
  if (!meta) return null;
  if (meta.defaultBranding) {
    return brandingDefaults()[meta.defaultBranding] ?? null;
  }
  return meta.default ?? null;
}

// ── Public API ───────────────────────────────────────────────────────────────

async function getConfig(key) {
  if (!isKnownKey(key)) return null;
  const r = await db.query(
    "SELECT value_encrypted, is_secret FROM app_config WHERE key=$1",
    [key]
  );
  const row = r.rows[0];
  if (!row || row.value_encrypted === null) {
    // Caer a default
    return defaultFor(key);
  }
  const raw = row.is_secret ? decrypt(row.value_encrypted) : row.value_encrypted;
  return castFromString(key, raw);
}

async function setConfig(key, value, opts = {}) {
  if (!isKnownKey(key)) {
    throw new Error(`[configStore] key desconocida: ${key}`);
  }
  const updatedBy = opts.userId || null;
  const stringValue = castToString(value);
  const isSecret = isSecretKey(key);
  const stored = isSecret ? encrypt(stringValue) : stringValue;

  // Audit: hashes (no valores)
  const oldRow = await db.query(
    "SELECT value_encrypted, is_secret FROM app_config WHERE key=$1",
    [key]
  );
  const oldRaw = oldRow.rows[0]
    ? (oldRow.rows[0].is_secret ? decrypt(oldRow.rows[0].value_encrypted) : oldRow.rows[0].value_encrypted)
    : null;

  await db.query(
    `INSERT INTO app_config (key, value_encrypted, is_secret, updated_at, updated_by)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (key) DO UPDATE SET
       value_encrypted=EXCLUDED.value_encrypted,
       is_secret=EXCLUDED.is_secret,
       updated_at=NOW(),
       updated_by=EXCLUDED.updated_by`,
    [key, stored, isSecret, updatedBy]
  );

  await db.query(
    `INSERT INTO app_config_history (key, old_value_hash, new_value_hash, changed_by)
     VALUES ($1, $2, $3, $4)`,
    [key, sha256Hex(oldRaw), sha256Hex(stringValue), updatedBy]
  );

  return { ok: true, key, isSecret };
}

async function deleteConfig(key, opts = {}) {
  if (!isKnownKey(key)) {
    throw new Error(`[configStore] key desconocida: ${key}`);
  }
  const oldRow = await db.query(
    "SELECT value_encrypted, is_secret FROM app_config WHERE key=$1",
    [key]
  );
  const oldRaw = oldRow.rows[0]
    ? (oldRow.rows[0].is_secret ? decrypt(oldRow.rows[0].value_encrypted) : oldRow.rows[0].value_encrypted)
    : null;

  await db.query("DELETE FROM app_config WHERE key=$1", [key]);
  await db.query(
    `INSERT INTO app_config_history (key, old_value_hash, new_value_hash, changed_by)
     VALUES ($1, $2, NULL, $3)`,
    [key, sha256Hex(oldRaw), opts.userId || null]
  );
  return { ok: true, key };
}

// ── Endpoint público (sin auth): devuelve branding + features ─────────────────
async function getPublicConfig() {
  const out = { branding: {}, features: {}, rules: {} };
  const branding = brandingDefaults();

  // Branding: defaults < DB overrides
  for (const k of Object.keys(KEY_CATALOG).filter(k => k.startsWith("branding."))) {
    const sub = k.replace("branding.", "");
    out.branding[sub] = await getConfig(k) ?? branding[sub] ?? null;
  }
  // Features (todas defaultean a true)
  for (const k of Object.keys(KEY_CATALOG).filter(k => k.startsWith("features."))) {
    const sub = k.replace("features.", "");
    out.features[sub] = await getConfig(k) ?? true;
  }
  // Rules: las non-sensitive sólo (signup_mode, email_verify_required, coins_on_register)
  out.rules.signup_mode           = await getConfig("rules.signup_mode")           ?? "open";
  out.rules.email_verify_required = await getConfig("rules.email_verify_required") ?? true;
  out.rules.coins_on_register     = await getConfig("rules.coins_on_register")     ?? 3;

  return out;
}

// ── Vista admin de una sección (secretos enmascarados) ──────────────────────
async function getAllSection(section) {
  const out = {};
  const prefix = `${section}.`;
  for (const k of Object.keys(KEY_CATALOG).filter(x => x.startsWith(prefix))) {
    const meta = KEY_CATALOG[k];
    const sub = k.replace(prefix, "");
    if (meta.isSecret) {
      // Saber si EXISTE sin exponer valor
      const r = await db.query("SELECT 1 FROM app_config WHERE key=$1 AND value_encrypted IS NOT NULL", [k]);
      out[sub] = r.rows[0] ? "••••••" : null;
    } else {
      out[sub] = await getConfig(k);
    }
  }
  return out;
}

// ── ¿Está seteado el wizard? ─────────────────────────────────────────────────
async function getStatus() {
  // "completo" = al menos cloudinary + branding + resend tienen valores set
  const status = {
    cloudinary: false, branding: false, resend: false, telegram: false, rules: true,
    mercadopago: false, shop: true,  // F4: shop tiene default features.shop=true
  };
  status.branding   = !!(await getConfig("branding.name"));  // tenemos default → siempre true salvo override
  // Para los demás chequeamos secret keys
  const cloudR = await db.query("SELECT 1 FROM app_config WHERE key='cloudinary.api_key' AND value_encrypted IS NOT NULL");
  status.cloudinary = !!cloudR.rows[0];
  const resR = await db.query("SELECT 1 FROM app_config WHERE key='resend.api_key' AND value_encrypted IS NOT NULL");
  status.resend = !!resR.rows[0];
  const tgR = await db.query("SELECT 1 FROM app_config WHERE key='telegram.bot_token' AND value_encrypted IS NOT NULL");
  status.telegram = !!tgR.rows[0];
  // Sprint 14 F2: MP configurado = access_token presente (encrypted)
  const mpR = await db.query("SELECT 1 FROM app_config WHERE key='mercadopago.access_token' AND value_encrypted IS NOT NULL");
  status.mercadopago = !!mpR.rows[0];
  return status;
}

module.exports = {
  // public API
  getConfig, setConfig, deleteConfig,
  getPublicConfig, getAllSection, getStatus,
  // helpers exportados para tests
  encrypt, decrypt, sha256Hex,
  isKnownKey, isSecretKey, castFromString, castToString,
  KEY_CATALOG,
};
