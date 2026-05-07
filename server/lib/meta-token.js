"use strict";

// User Access Token de Meta para Marketing API (Ads).
// Distinto del Page Access Token de IG en ig-token.js.
// Se persiste en la misma tabla ig_runtime_secrets pero con key='meta_user_token'.

const db = require("../db");
const { META_PAGE_ID } = require("./meta-config");

let cache = { token: null, expiresAt: 0 };

async function getMetaUserToken() {
  if (cache.token && cache.expiresAt > Date.now()) return cache.token;
  const r = await db.query("SELECT value FROM ig_runtime_secrets WHERE key='meta_user_token'");
  const tok = r.rows[0]?.value || "";
  cache = { token: tok, expiresAt: Date.now() + 5 * 60 * 1000 };
  return tok;
}

async function setMetaUserToken(value) {
  if (!value || typeof value !== "string") throw new Error("token inválido");
  await db.query(
    `INSERT INTO ig_runtime_secrets (key, value, updated_at)
     VALUES ('meta_user_token', $1, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
  cache = { token: value, expiresAt: Date.now() + 5 * 60 * 1000 };
}

async function getDefaultAdAccountId() {
  const r = await db.query("SELECT value FROM ig_runtime_secrets WHERE key='meta_ad_account_id'");
  return r.rows[0]?.value || "";
}

async function setDefaultAdAccountId(value) {
  if (!value || typeof value !== "string") throw new Error("ad_account_id inválido");
  if (!value.startsWith("act_")) value = "act_" + value;
  await db.query(
    `INSERT INTO ig_runtime_secrets (key, value, updated_at)
     VALUES ('meta_ad_account_id', $1, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
}

// Page ID de la Facebook Page conectada al IG. Default: Lemon's Store.
async function getMetaPageId() {
  const r = await db.query("SELECT value FROM ig_runtime_secrets WHERE key='meta_page_id'");
  return r.rows[0]?.value || META_PAGE_ID;
}
async function setMetaPageId(value) {
  if (!value || typeof value !== "string") throw new Error("page_id inválido");
  await db.query(
    `INSERT INTO ig_runtime_secrets (key, value, updated_at)
     VALUES ('meta_page_id', $1, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
    [value]
  );
}

async function healthcheckMetaUserToken() {
  const current = await getMetaUserToken();
  if (!current) throw new Error("No hay meta_user_token configurado en DB");
  const APP_ID = process.env.META_APP_ID;
  const APP_SECRET = process.env.META_APP_SECRET;
  if (APP_ID && APP_SECRET) {
    const url = `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(current)}&access_token=${APP_ID}%7C${APP_SECRET}`;
    const res = await fetch(url);
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.data?.is_valid) {
      throw new Error(`Token Meta inválido: ${j?.data?.error?.message || j?.error?.message || JSON.stringify(j).slice(0, 300)}`);
    }
    return {
      ok: true,
      type: j.data.type,
      user_id: j.data.user_id,
      expires_at: j.data.expires_at || 0,
      data_access_expires_at: j.data.data_access_expires_at || null,
      scopes: j.data.scopes || [],
      has_ads_management: (j.data.scopes || []).includes("ads_management"),
      has_ads_read: (j.data.scopes || []).includes("ads_read"),
      has_business_management: (j.data.scopes || []).includes("business_management"),
    };
  }
  const r = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(current)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Token Meta inválido vía /me: ${j?.error?.message || JSON.stringify(j).slice(0, 300)}`);
  return { ok: true, type: "unknown", user_id: j.id, name: j.name, expires_at: null, scopes: [] };
}

module.exports = {
  getMetaUserToken,
  setMetaUserToken,
  getDefaultAdAccountId,
  setDefaultAdAccountId,
  getMetaPageId,
  setMetaPageId,
  healthcheckMetaUserToken,
};
