"use strict";

// Token de Instagram persistido en DB para que los refreshes no requieran tocar .env ni reiniciar.
// Fallback a process.env.IG_ACCESS_TOKEN si la fila no existe (caso primer arranque).

const db = require("../db");

let cache = { token: null, expiresAt: 0 };

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ig_runtime_secrets (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      expires_at  TIMESTAMPTZ,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getIgToken() {
  if (cache.token && cache.expiresAt > Date.now()) return cache.token;
  await ensureTable();
  const r = await db.query("SELECT value FROM ig_runtime_secrets WHERE key='ig_access_token'");
  const tok = r.rows[0]?.value || process.env.IG_ACCESS_TOKEN || "";
  cache = { token: tok, expiresAt: Date.now() + 5 * 60 * 1000 };
  return tok;
}

async function setIgToken(value, ttlSeconds) {
  if (!value || typeof value !== "string") throw new Error("token inválido");
  await ensureTable();
  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
  await db.query(
    `INSERT INTO ig_runtime_secrets (key, value, expires_at, updated_at)
     VALUES ('ig_access_token', $1, $2, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           expires_at = EXCLUDED.expires_at,
           updated_at = NOW()`,
    [value, expiresAt]
  );
  cache = { token: value, expiresAt: Date.now() + 5 * 60 * 1000 };
}

// Healthcheck del token contra Meta. Vale para Page Access Tokens (no vencen pero pueden invalidarse).
// Devuelve { ok, type, profile_id, expires_at, scopes } o tira error con detalle.
async function healthcheckIgToken() {
  const current = await getIgToken();
  if (!current) throw new Error("No hay token IG configurado (ni en DB ni en env)");
  const APP_ID = process.env.META_APP_ID;
  const APP_SECRET = process.env.META_APP_SECRET;
  if (APP_ID && APP_SECRET) {
    const url = `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(current)}&access_token=${APP_ID}%7C${APP_SECRET}`;
    const res = await fetch(url);
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.data?.is_valid) {
      throw new Error(`Token inválido según debug_token: ${j?.data?.error?.message || j?.error?.message || JSON.stringify(j).slice(0, 300)}`);
    }
    return {
      ok: true,
      type: j.data.type,
      profile_id: j.data.profile_id,
      expires_at: j.data.expires_at || 0,        // 0 = no expira (page tokens)
      data_access_expires_at: j.data.data_access_expires_at || null,
      scopes: j.data.scopes || [],
    };
  }
  // Fallback sin app secret: probar /me directo
  const r = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(current)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Token inválido vía /me: ${j?.error?.message || JSON.stringify(j).slice(0, 300)}`);
  return { ok: true, type: "unknown", profile_id: j.id, name: j.name, expires_at: null, scopes: [] };
}

async function getTokenStatus() {
  await ensureTable();
  const r = await db.query("SELECT expires_at, updated_at FROM ig_runtime_secrets WHERE key='ig_access_token'");
  const row = r.rows[0];
  return {
    has_db_token: !!row,
    has_env_fallback: !!process.env.IG_ACCESS_TOKEN,
    expires_at: row?.expires_at || null,
    updated_at: row?.updated_at || null,
    days_until_expiry: row?.expires_at ? Math.round((new Date(row.expires_at).getTime() - Date.now()) / 86400000) : null,
  };
}

module.exports = { ensureTable, getIgToken, setIgToken, healthcheckIgToken, getTokenStatus };
