// server/routes/admin-config.js
//
// Endpoints del setup wizard. Spec § 8.4.
//
//   GET    /api/admin/config/status            → { branding: ✅, cloudinary: ✅, ... }
//   GET    /api/admin/config/:section          → vista admin (secretos enmascarados)
//   POST   /api/admin/config/:section          → set 1+ keys: { key: value, ... }
//   POST   /api/admin/config/test/:provider    → test de conexión real (cloudinary | resend | telegram)
//   DELETE /api/admin/config/:section/:key     → borra una entrada (vuelve a default)
//
// Todos requieren role=admin (excepto /api/config/public que va por separado
// montado al raíz, y NO autenticado).

"use strict";

const express = require("express");
const cs = require("../lib/configStore");

const router = express.Router();

// ── Auth: todos los endpoints abajo requieren role=admin ─────────────────────
function requireAdminMiddleware(authRequired, requireRole) {
  return [authRequired, requireRole(["admin"])];
}

const VALID_SECTIONS = ["branding", "cloudinary", "resend", "telegram", "rules", "features", "mercadopago", "shop"];

function validateSection(req, res, next) {
  const s = req.params.section;
  if (!VALID_SECTIONS.includes(s)) {
    return res.status(400).json({ error: `Sección inválida: ${s}. Válidas: ${VALID_SECTIONS.join(", ")}` });
  }
  next();
}

function build({ authRequired, requireRole }) {
  const adminMw = requireAdminMiddleware(authRequired, requireRole);

  // ── GET /api/admin/config/status ───────────────────────────────────────────
  router.get("/status", ...adminMw, async (_req, res) => {
    try {
      const status = await cs.getStatus();
      res.json({ ok: true, status });
    } catch (e) {
      console.error("[admin-config status]", e);
      res.status(500).json({ error: "Error al leer status" });
    }
  });

  // ── GET /api/admin/config/:section ─────────────────────────────────────────
  router.get("/:section", ...adminMw, validateSection, async (req, res) => {
    try {
      const section = await cs.getAllSection(req.params.section);
      res.json({ ok: true, section: req.params.section, values: section });
    } catch (e) {
      console.error("[admin-config get section]", e);
      res.status(500).json({ error: "Error al leer sección" });
    }
  });

  // ── POST /api/admin/config/:section ────────────────────────────────────────
  // Body: { key1: value1, key2: value2, ... }   (sin el prefijo de sección)
  router.post("/:section", ...adminMw, validateSection, async (req, res) => {
    try {
      const section = req.params.section;
      const body = req.body || {};
      const updates = [];
      const errors  = [];

      for (const [shortKey, value] of Object.entries(body)) {
        const fullKey = `${section}.${shortKey}`;
        if (!cs.isKnownKey(fullKey)) {
          errors.push({ key: shortKey, error: "key desconocida" });
          continue;
        }
        try {
          await cs.setConfig(fullKey, value, { userId: req.user?.id });
          updates.push({ key: shortKey, isSecret: cs.isSecretKey(fullKey) });
        } catch (e) {
          errors.push({ key: shortKey, error: e.message });
        }
      }

      // Si tocamos branding, invalidar caches dependientes (server-side
      // brandHtml de 30s + getBranding de 30s) para que el admin vea el
      // cambio reflejado en title/metas/manifest sin esperar el TTL.
      if (section === "branding" && updates.length > 0) {
        try {
          require("../lib/branding").invalidateCache();
          require("../lib/htmlBranding").invalidateCache();
        } catch { /* non-fatal */ }
      }

      // Si tocamos cloudinary, invalidar el SDK cache para que el proximo
      // upload use las creds nuevas sin restart del server (Sprint 14 fix).
      if (section === "cloudinary" && updates.length > 0) {
        try { require("../lib/cloudinaryConfig").invalidateCache(); }
        catch { /* non-fatal */ }
      }

      res.json({
        ok: errors.length === 0,
        updates,
        ...(errors.length ? { errors } : {}),
      });
    } catch (e) {
      console.error("[admin-config post section]", e);
      res.status(500).json({ error: "Error al guardar" });
    }
  });

  // ── DELETE /api/admin/config/:section/:key ─────────────────────────────────
  router.delete("/:section/:key", ...adminMw, validateSection, async (req, res) => {
    try {
      const fullKey = `${req.params.section}.${req.params.key}`;
      if (!cs.isKnownKey(fullKey)) {
        return res.status(400).json({ error: `key desconocida: ${fullKey}` });
      }
      await cs.deleteConfig(fullKey, { userId: req.user?.id });
      res.json({ ok: true, key: fullKey });
    } catch (e) {
      console.error("[admin-config delete]", e);
      res.status(500).json({ error: "Error al borrar" });
    }
  });

  // ── POST /api/admin/config/test/:provider ──────────────────────────────────
  // Testea conexión al provider con las credenciales actualmente guardadas.
  // Implementación: stubs que devuelven ok:true (Sprint 2.5 implementa
  // los tests reales contra cada SDK).
  router.post("/test/:provider", ...adminMw, async (req, res) => {
    const provider = req.params.provider;
    try {
      let result;
      switch (provider) {
        case "cloudinary":  result = await testCloudinary();  break;
        case "resend":      result = await testResend();      break;
        case "telegram":    result = await testTelegram();    break;
        case "mercadopago": result = await testMercadoPago(); break;
        default:
          return res.status(400).json({ error: `Provider desconocido: ${provider}` });
      }
      res.json(result);
    } catch (e) {
      console.error(`[admin-config test ${provider}]`, e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}

// ── Provider tests ──────────────────────────────────────────────────────────
// Cada uno carga las credenciales del configStore y hace UN ping ligero al
// provider. Devuelven { ok: bool, message: string, details?: any }.

async function testCloudinary() {
  const cloudName = await cs.getConfig("cloudinary.cloud_name");
  const apiKey    = await cs.getConfig("cloudinary.api_key");
  const apiSecret = await cs.getConfig("cloudinary.api_secret");
  if (!cloudName || !apiKey || !apiSecret) {
    return { ok: false, message: "Faltan credenciales de Cloudinary" };
  }
  // Ping al endpoint /resources de la API de Cloudinary (lista <=1 recurso)
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?max_results=1`;
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  try {
    const r = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (r.ok)  return { ok: true,  message: "Cloudinary OK" };
    if (r.status === 401) return { ok: false, message: "Credenciales Cloudinary inválidas (401)" };
    return { ok: false, message: `Cloudinary respondió ${r.status}` };
  } catch (e) {
    return { ok: false, message: `Error de red al testear Cloudinary: ${e.message}` };
  }
}

async function testResend() {
  const key = await cs.getConfig("resend.api_key");
  if (!key) return { ok: false, message: "Falta resend.api_key" };
  // Endpoint barato: GET /domains
  try {
    const r = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (r.ok) return { ok: true, message: "Resend OK" };
    if (r.status === 401) return { ok: false, message: "Resend api_key inválida (401)" };
    return { ok: false, message: `Resend respondió ${r.status}` };
  } catch (e) {
    return { ok: false, message: `Error de red al testear Resend: ${e.message}` };
  }
}

async function testTelegram() {
  const token  = await cs.getConfig("telegram.bot_token");
  const chatId = await cs.getConfig("telegram.chat_id");
  if (!token) return { ok: false, message: "Falta telegram.bot_token" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const d = await r.json().catch(() => ({}));
    if (!d.ok) return { ok: false, message: `Telegram getMe falló: ${d.description || r.status}` };
    if (!chatId) return { ok: true, message: `Bot @${d.result?.username} OK (sin chat_id)` };
    // Si hay chat_id, mandamos un mensaje de test
    const msg = `✅ ${process.env.APP_NAME || "Portal"} — test de conexión desde wizard`;
    const sendR = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg }),
    });
    const sendD = await sendR.json().catch(() => ({}));
    if (!sendD.ok) return { ok: false, message: `Mensaje a chat_id falló: ${sendD.description}` };
    return { ok: true, message: `Bot @${d.result?.username} OK · mensaje enviado a chat_id` };
  } catch (e) {
    return { ok: false, message: `Error de red al testear Telegram: ${e.message}` };
  }
}

async function testMercadoPago() {
  const token = await cs.getConfig("mercadopago.access_token");
  if (!token) return { ok: false, message: "Falta mercadopago.access_token" };
  const isSandbox = token.startsWith("TEST-");
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) {
      return { ok: false, message: "Access token de MercadoPago inválido o vencido (revisá que sea el de la app correcta)" };
    }
    if (!r.ok) return { ok: false, message: `MercadoPago respondió ${r.status}` };
    const who = d.nickname || d.email || `user ${d.id}`;
    const mode = isSandbox ? "🧪 credenciales de PRUEBA (los pagos no son reales)" : "credenciales de producción";
    return { ok: true, message: `MercadoPago OK · cuenta ${who} (${d.site_id || "?"}) · ${mode}` };
  } catch (e) {
    return { ok: false, message: `Error de red al testear MercadoPago: ${e.message}` };
  }
}

// ── Router público ──────────────────────────────────────────────────────────
// /api/config/public — no auth. Devuelve sólo branding + features + rules
// non-sensitive. Usado por el frontend al cargar para aplicar branding sin
// requerir login.
function publicRouter() {
  const r = express.Router();
  r.get("/", async (_req, res) => {
    try {
      const cfg = await cs.getPublicConfig();
      res.json(cfg);
    } catch (e) {
      console.error("[public-config]", e);
      // Fallback: defaults del branding.json (no fail catastrófico)
      try {
        const defaults = require("../../branding.json");
        res.json({ branding: defaults, features: {}, rules: {} });
      } catch {
        res.status(500).json({ error: "Error leyendo config" });
      }
    }
  });
  return r;
}

module.exports = { build, publicRouter };
