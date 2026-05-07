require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const hpp = require("hpp");

const db = require("./db");
const { authRequired, requireRole } = require("./auth");
const { sendEmail } = require("./mailer"); // ✅ mails
const { sendPaymentReceipt } = require("./lib/waReceipt");
const {
  loginSlowDown,
  noStore,
  assertJwtSecret,
  sanitizeText,
  sanitizeRichText,
} = require("./security");
const coinsRouter         = require("./routes/coins");         // ✅ Lemon Coins
const notificationsRouter = require("./routes/notifications"); // ✅ Notificaciones LIMÓN (broadcast)
const profileRouter       = require("./routes/profile");         // 👤 Perfil de usuario
const founderIntelligenceRouter = require("./routes/founderIntelligence");
const waCRMRouter        = require("./routes/waCRM");
const instagramRouter    = require("./routes/instagram");
const instagramContentRouter = require("./routes/instagram-content");
const instagramAdsRouter = require("./routes/instagram-ads");
const chatRouter         = require("./routes/chat");
const webauthnRouter     = require("./routes/webauthn");

const app = express();

// ── Seguridad: headers HTTP ──────────────────────────────────────────────────
// CSP estricta para JSON API; SPA aparte
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", "data:", "https://res.cloudinary.com", "https:"],
      "media-src": ["'self'", "data:", "blob:", "https:"],
      "connect-src": ["'self'", "https:", "wss:"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "frame-ancestors": ["'none'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

// HPP: previene HTTP Parameter Pollution (?role=admin&role=client)
app.use(hpp());

// Validación de JWT_SECRET al boot (crash si falta en producción)
assertJwtSecret();

// ── Rate limiting general (todas las rutas) ──
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,                  // máx 300 requests por IP por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intentá de nuevo en 15 minutos." },
}));

// ── Rate limiting estricto para auth ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                   // máx 10 intentos de login por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Esperá 15 minutos antes de volver a intentar." },
  skipSuccessfulRequests: true, // no cuenta los logins exitosos
});

// ── Rate limiting para forgot-password ──
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,                    // máx 5 emails por hora por IP
  message: { error: "Demasiadas solicitudes de reset. Esperá 1 hora." },
});

app.set("trust proxy", 1);
// Body size limit — previene payload bombing
app.use(express.json({ limit: "500kb" }));
app.use(express.urlencoded({ limit: "500kb", extended: false }));

// CORS abierto mientras probás
const allowedOrigins = [
  "https://lemonsarg.com",
  "https://www.lemonsarg.com",
  "https://app.lemonsarg.com",
  "https://redes.lemonsarg.com",
  "https://lemons-portal-w3of.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir requests sin origin (ej: Postman, server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

app.get("/", (req, res) => res.send("LEMON's API OK ✅ — probá /health"));

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/privacy", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Política de Privacidad — Lemon's Portal</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0a;color:#e5e5e5;line-height:1.6}
  main{max-width:720px;margin:0 auto;padding:48px 24px}
  h1{color:#f5e03a;font-size:32px;margin:0 0 8px}
  .sub{color:#888;font-size:14px;margin-bottom:32px}
  h2{color:#fff;font-size:20px;margin:32px 0 8px}
  p,li{color:#d4d4d4}
  a{color:#f5e03a}
  hr{border:none;border-top:1px solid #222;margin:32px 0}
  footer{color:#666;font-size:12px;text-align:center;margin-top:48px}
</style></head>
<body><main>
<h1>Política de Privacidad</h1>
<div class="sub">Lemon's Portal · Última actualización: 1 de mayo de 2026</div>

<h2>1. Quiénes somos</h2>
<p>Lemon's Portal es una plataforma operada por Lemon's Logística Internacional para la gestión interna de envíos courier (China, Estados Unidos, Europa) y la administración del marketing digital de la marca @lemonsarg en Instagram y Meta.</p>

<h2>2. Datos que recopilamos</h2>
<ul>
<li><b>Datos de cuenta:</b> email, nombre, rol (cliente / operador / admin) y número de cliente.</li>
<li><b>Datos operativos:</b> envíos, paquetes, cobros, gastos y métricas de logística que el usuario o el operador cargan al portal.</li>
<li><b>Datos de Meta:</b> tokens de acceso, métricas de campañas publicitarias, interacciones de Instagram (DMs, comentarios, publicaciones) y datos de WhatsApp Business asociados a cuentas que el administrador conecta voluntariamente desde el panel.</li>
</ul>

<h2>3. Uso de los datos</h2>
<p>Los datos se utilizan exclusivamente para:</p>
<ul>
<li>Operación interna del portal (cotizaciones, seguimiento de envíos, cobros).</li>
<li>Comunicación con clientes a través de los canales conectados (email, Instagram, WhatsApp).</li>
<li>Gestión y reporte de campañas publicitarias en Meta Ads.</li>
</ul>
<p>No vendemos, alquilamos ni compartimos datos personales con terceros para fines comerciales.</p>

<h2>4. Almacenamiento y seguridad</h2>
<p>Los datos se almacenan en una base de datos PostgreSQL alojada en Neon (región sa-east-1) con cifrado en tránsito (TLS) y en reposo. Los tokens de acceso de Meta se guardan cifrados y se rotan periódicamente. El acceso al portal está protegido con autenticación JWT, control de roles y permisos granulares por scope.</p>

<h2>5. Servicios de terceros</h2>
<p>Para operar el portal usamos los siguientes proveedores: Neon (base de datos), Cloudinary (almacenamiento de imágenes), Resend (envío de emails transaccionales), Meta Platforms Inc. (Instagram Graph API, Marketing API, WhatsApp Business API). Cada uno aplica sus propias políticas de privacidad.</p>

<h2>6. Derechos del usuario</h2>
<p>Tenés derecho a acceder, rectificar o eliminar tus datos personales en cualquier momento. Para ejercer estos derechos, escribinos a <a href="mailto:contacto@lemonsarg.com">contacto@lemonsarg.com</a>.</p>

<h2>7. Eliminación de datos</h2>
<p>Si querés que eliminemos tu cuenta y todos los datos asociados, escribinos a <a href="mailto:contacto@lemonsarg.com">contacto@lemonsarg.com</a> con el asunto "Eliminación de datos". Procesamos la solicitud dentro de los 30 días.</p>

<h2>8. Contacto</h2>
<p>Lemon's Logística Internacional<br>
Email: <a href="mailto:contacto@lemonsarg.com">contacto@lemonsarg.com</a><br>
Sitio: <a href="https://lemonsarg.com">lemonsarg.com</a></p>

<hr>
<footer>© 2026 Lemon's Logística Internacional</footer>
</main></body></html>`);
});

// ── WA Queue API (para bot WhatsApp en VPS) ──────────────────────────────────
function requireAIKeyHeader(req, res, next) {
  const serverKey = process.env.AI_API_KEY || "";
  const incoming = req.headers["x-ai-api-key"] || "";
  if (!serverKey) {
    return res.status(503).json({ error: "AI API key not configured" });
  }
  if (!incoming) {
    return res.status(401).json({ error: "Missing API key" });
  }
  if (incoming !== serverKey) {
    return res.status(403).json({ error: "Invalid API key" });
  }
  next();
}

app.post("/api/wa/enqueue", requireAIKeyHeader, async (req, res) => {
  try {
    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    const message = String(req.body?.message || "").trim();

    if (!phone) return res.status(400).json({ error: "phone required" });
    if (!message) return res.status(400).json({ error: "message required" });

    await db.query(`
      CREATE TABLE IF NOT EXISTS wa_notifications (
        id BIGSERIAL PRIMARY KEY,
        phone TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMPTZ
      )
    `);

    const q = await db.query(
      `INSERT INTO wa_notifications (phone, message, status, created_at)
       VALUES ($1, $2, 'pending', NOW())
       RETURNING id, phone, status, created_at`,
      [phone, message]
    );

    console.log("[WA ENQUEUE]", q.rows[0]);
    res.json({ ok: true, row: q.rows[0] });
  } catch (err) {
    console.error("[WA ENQUEUE ERROR]", err);
    res.status(500).json({ error: err.message || "enqueue error" });
  }
});

app.get("/api/wa/pending", requireAIKeyHeader, async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS wa_notifications (
        id BIGSERIAL PRIMARY KEY,
        phone TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMPTZ
      )
    `);

    const q = await db.query(
      `UPDATE wa_notifications 
       SET status = 'processing', sent_at = NOW()
       WHERE id IN (
         SELECT id FROM wa_notifications 
         WHERE status = 'pending'
         ORDER BY id ASC
         LIMIT 10
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, phone, message, status, created_at`
    );

    res.json({ ok: true, rows: q.rows });
  } catch (err) {
    console.error("[WA PENDING ERROR]", err);
    res.status(500).json({ error: err.message || "pending error" });
  }
});

app.post("/api/wa/ack", requireAIKeyHeader, async (req, res) => {
  try {
    const id = Number(req.body?.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "valid id required" });

    await db.query(`
      CREATE TABLE IF NOT EXISTS wa_notifications (
        id BIGSERIAL PRIMARY KEY,
        phone TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMPTZ
      )
    `);

    const q = await db.query(
      `UPDATE wa_notifications
       SET status = 'sent', sent_at = NOW()
       WHERE id = $1
       RETURNING id, phone, status, sent_at`,
      [id]
    );

    if (!q.rows[0]) return res.status(404).json({ error: "notification not found" });

    console.log("[WA ACK]", q.rows[0]);
    res.json({ ok: true, row: q.rows[0] });
  } catch (err) {
    console.error("[WA ACK ERROR]", err);
    res.status(500).json({ error: err.message || "ack error" });
  }
});


// ── Auto-migración al arrancar ────────────────────────────────────────────────
(async () => {
  try {
    await db.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,2) DEFAULT 0`);
    await db.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS profit_usd NUMERIC(12,2) DEFAULT 0`);
    await db.query(`ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,2) DEFAULT 0`);
    await db.query(`ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS profit_usd NUMERIC(12,2) DEFAULT 0`);
    console.log("[MIGRATION] cost_usd/profit_usd columns ready");
  } catch(e) { console.error("[MIGRATION ERROR]", e.message); }
})();

// ── Auto-migración: cash bot integration (gastos/ingresos con receipt + media en wa_messages)
(async () => {
  try {
    await db.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT`);
    await db.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC`);
    await db.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'manual'`);
    await db.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS wa_message_id BIGINT`);
    await db.query(`ALTER TABLE additional_income ADD COLUMN IF NOT EXISTS receipt_url TEXT`);
    await db.query(`ALTER TABLE additional_income ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC`);
    await db.query(`ALTER TABLE additional_income ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'manual'`);
    await db.query(`ALTER TABLE additional_income ADD COLUMN IF NOT EXISTS wa_message_id BIGINT`);
    await db.query(`ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS media_url TEXT`);
    await db.query(`ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS media_type TEXT`);
    await db.query(`ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS caption TEXT`);
    console.log("[MIGRATION] cash bot integration columns ready");
  } catch(e) { console.error("[MIGRATION cash bot ERROR]", e.message); }
})();

// ── Auto-migración: tabla ai_settings ────────────────────────────────────────
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_settings (
        key        TEXT PRIMARY KEY,
        value      TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Insertar valores iniciales sólo si no existen
    const defaults = [
      ["global_enabled",     "true"],
      ["limoncin_enabled",   "false"],  // se activa manualmente desde el panel
      ["whatsapp_enabled",   "false"],  // se activa manualmente desde el panel
      ["telegram_enabled",   "true"],
      ["blocked_wa_chats",   "[]"],
      ["op_line_usa_normal",     "on"],
      ["op_line_usa_express",    "on"],
      ["op_line_china_normal",   "on"],
      ["op_line_china_express",  "on"],
      ["op_line_europa_normal",  "off"],
    ];
    for (const [key, value] of defaults) {
      await db.query(
        `INSERT INTO ai_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }
    console.log("[MIGRATION] ai_settings table ready");
  } catch(e) { console.error("[MIGRATION ai_settings ERROR]", e.message); }
})();

// ── Auto-migración: tabla user_stories (24h) ─────────────────────────────────
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_stories (
        id          SERIAL PRIMARY KEY,
        user_id     INT NOT NULL,
        image_url   TEXT NOT NULL,
        caption     TEXT,
        bg_color    TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS user_stories_user_idx ON user_stories(user_id, expires_at DESC)`);
    await db.query(`CREATE INDEX IF NOT EXISTS user_stories_expires_idx ON user_stories(expires_at)`);
    // Vistas de stories (read receipts)
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_story_views (
        story_id    INT NOT NULL,
        viewer_id   INT NOT NULL,
        viewed_at   TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (story_id, viewer_id)
      )
    `);
    console.log("[MIGRATION] user_stories ready");
  } catch (e) { console.error("[MIGRATION user_stories ERROR]", e.message); }
})();

// ── Auto-migración: tabla coupons ────────────────────────────────────────────
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id            SERIAL PRIMARY KEY,
        code          TEXT UNIQUE NOT NULL,
        description   TEXT,
        discount_pct  INTEGER,
        discount_usd  NUMERIC(10,2),
        applies_to    TEXT DEFAULT 'all',  -- all | usa | china | europa | normal | express
        min_kg        NUMERIC(8,2) DEFAULT 0,
        max_uses      INTEGER,
        used_count    INTEGER DEFAULT 0,
        active        BOOLEAN DEFAULT TRUE,
        starts_at     TIMESTAMPTZ DEFAULT NOW(),
        expires_at    TIMESTAMPTZ,
        created_by    INT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.query(`CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id          SERIAL PRIMARY KEY,
      coupon_id   INT REFERENCES coupons(id) ON DELETE CASCADE,
      user_id     INT,
      shipment_id INT,
      amount_off  NUMERIC(10,2),
      redeemed_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    console.log("[MIGRATION] coupons ready");
  } catch (e) { console.error("[MIGRATION coupons ERROR]", e.message); }
})();

// ── Auto-migración: referidos (users.referrer_id + tabla referrals) ──────────
(async () => {
  try {
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer_id INT`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id          SERIAL PRIMARY KEY,
        referrer_id INT NOT NULL,
        referred_id INT NOT NULL UNIQUE,
        status      TEXT DEFAULT 'pending',
        coins_referrer INTEGER DEFAULT 25,
        coins_referred INTEGER DEFAULT 25,
        rewarded_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Update default coins en filas existentes pending (que aún no se pagaron)
    await db.query(`UPDATE referrals SET coins_referrer=25, coins_referred=25 WHERE status='pending'`).catch(()=>{});
    await db.query(`ALTER TABLE referrals ALTER COLUMN coins_referrer SET DEFAULT 25`).catch(()=>{});
    await db.query(`ALTER TABLE referrals ALTER COLUMN coins_referred SET DEFAULT 25`).catch(()=>{});
    await db.query(`CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_id)`);
    console.log("[MIGRATION] referrals ready");
  } catch (e) { console.error("[MIGRATION referrals ERROR]", e.message); }
})();

// ── Auto-migración: presencia (last_seen_at) ─────────────────────────────────
(async () => {
  try {
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
    await db.query(`CREATE INDEX IF NOT EXISTS users_last_seen_idx ON users(last_seen_at DESC NULLS LAST)`);
    console.log("[MIGRATION] users.last_seen_at ready");
  } catch (e) { console.error("[MIGRATION presence ERROR]", e.message); }
})();

// ── Auto-migración: tabla announcements ──────────────────────────────────────
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id          SERIAL PRIMARY KEY,
        title       TEXT NOT NULL,
        body        TEXT,
        category    TEXT DEFAULT 'general',
        emoji       TEXT,
        accent      TEXT DEFAULT '#f5e03a',
        link_url    TEXT,
        link_label  TEXT,
        pinned      BOOLEAN DEFAULT FALSE,
        active      BOOLEAN DEFAULT TRUE,
        starts_at   TIMESTAMPTZ DEFAULT NOW(),
        expires_at  TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        created_by  INT
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS announcements_active_idx ON announcements(active, pinned DESC, starts_at DESC)`);
    console.log("[MIGRATION] announcements table ready");
  } catch (e) { console.error("[MIGRATION announcements ERROR]", e.message); }
})();

// ── Migración: recalcular cost_usd y profit_usd en pagos existentes ──────────
app.post("/admin/recalc-payment-costs", authRequired, requireRole(["admin"]), async (req, res) => {
  try {
    // Asegurar columnas existen
    await db.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,2) DEFAULT 0`);
    await db.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS profit_usd NUMERIC(12,2) DEFAULT 0`);
    await db.query(`ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,2) DEFAULT 0`);
    await db.query(`ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS profit_usd NUMERIC(12,2) DEFAULT 0`);

    // Obtener costos del operador
    const costsQ = await db.query(`SELECT usa_normal, usa_express, usa_tech_premium, china_normal, china_express, europa_normal FROM operator_costs LIMIT 1`);
    const oc = costsQ.rows[0] || {};
    function getCostPerKg(origin, service) {
      if (origin === 'USA' && service === 'NORMAL')       return Number(oc.usa_normal       || 0);
      if (origin === 'USA' && service === 'EXPRESS')      return Number(oc.usa_express      || 0);
      if (origin === 'USA' && service === 'TECH_PREMIUM') return Number(oc.usa_tech_premium || 0);
      if (origin === 'CHINA' && service === 'NORMAL')     return Number(oc.china_normal     || 0);
      if (origin === 'CHINA' && service === 'EXPRESS')    return Number(oc.china_express    || 0);
      if (origin === 'EUROPA') return Number(oc.europa_normal || 0);
      return 0;
    }

    // Obtener todos los payment_items con datos del envío
    const itemsQ = await db.query(`
      SELECT pi.id AS item_id, pi.payment_id, pi.amount_usd,
             s.weight_kg, s.origin, s.service
      FROM payment_items pi
      JOIN shipments s ON s.id = pi.shipment_id
      WHERE 1=1 -- recalc all
    `);

    let updated = 0;
    const paymentTotals = {};

    for (const item of itemsQ.rows) {
      const realKg = Number(item.weight_kg || 0);
      const costPerKg = getCostPerKg(item.origin, item.service);
      const amtUsd = Number(item.amount_usd || 0);
      const minCost = costPerKg * 1;
      let effKg = Math.max(realKg, 1);
      if (amtUsd > 0 && amtUsd < minCost && realKg > 0 && realKg < 1) {
        effKg = realKg;
      }
      const cost   = Number((effKg * costPerKg).toFixed(2));
      const profit = Number((Number(item.amount_usd) - cost).toFixed(2));

      await db.query(
        `UPDATE payment_items SET cost_usd=$1, profit_usd=$2 WHERE id=$3`,
        [cost, profit, item.item_id]
      );

      if (!paymentTotals[item.payment_id]) {
        paymentTotals[item.payment_id] = { cost: 0, profit: 0 };
      }
      paymentTotals[item.payment_id].cost   += cost;
      paymentTotals[item.payment_id].profit += profit;
      updated++;
    }

    // Actualizar totales en payments
    let paymentsUpdated = 0;
    for (const [paymentId, totals] of Object.entries(paymentTotals)) {
      await db.query(
        `UPDATE payments SET cost_usd=$1, profit_usd=$2 WHERE id=$3`,
        [Number(totals.cost.toFixed(2)), Number(totals.profit.toFixed(2)), paymentId]
      );
      paymentsUpdated++;
    }

    res.json({ ok: true, items_updated: updated, payments_updated: paymentsUpdated });
  } catch(err) {
    console.error("[RECALC]", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== TARIFAS (defaults + helpers) ====================

const DEFAULT_RATES = {
  usa_normal:       45,
  usa_express:      55,
  usa_tech_premium: 75, // Tecnología Premium — solo USA
  china_normal:     58,
  china_express:    68,
  europa_normal:    58, // EUROPA siempre NORMAL
};

// ── Costos reales del operador ───────────────────────────────────────────────
const DEFAULT_OPERATOR_COSTS = {
  usa_normal:       0,
  usa_express:      0,
  usa_tech_premium: 50, // Costo real Tecnología Premium
  china_normal:     0,
  china_express:    0,
  europa_normal:    0,
};

async function getOperatorCosts() {
  try {
    const r = await db.query(
      `SELECT usa_normal, usa_express, usa_tech_premium, china_normal, china_express, europa_normal
       FROM operator_costs LIMIT 1`
    );
    return r.rows[0] || DEFAULT_OPERATOR_COSTS;
  } catch {
    return DEFAULT_OPERATOR_COSTS;
  }
}

function normalizeOrigin(origin) {
  const o = (origin || "").toUpperCase().trim();
  if (o === "USA" || o === "CHINA" || o === "EUROPA") return o;
  return null;
}

function normalizeService(service) {
  const s = (service || "").toUpperCase().trim();
  if (s === "NORMAL" || s === "EXPRESS" || s === "TECH_PREMIUM") return s;
  return null;
}

function rateKeyFor(origin, service) {
  if (origin === "EUROPA") return "europa_normal";
  if (origin === "USA" && service === "NORMAL")       return "usa_normal";
  if (origin === "USA" && service === "EXPRESS")      return "usa_express";
  if (origin === "USA" && service === "TECH_PREMIUM") return "usa_tech_premium";
  if (origin === "CHINA" && service === "NORMAL")     return "china_normal";
  if (origin === "CHINA" && service === "EXPRESS")    return "china_express";
  return null;
}

// Descuento por volumen según kg del envío individual
function volumeDiscount(kg) {
  if (kg >= 100) return 7;
  if (kg >= 50)  return 5;
  if (kg >= 10)  return 3;
  return 0;
}

function applyVolumeDiscount(baseRate, kg) {
  return Math.max(0, baseRate - volumeDiscount(kg));
}

async function getClientRatesByUserId(userId) {
  const r = await db.query(
    `SELECT user_id, usa_normal, usa_express, usa_tech_premium, china_normal, china_express, europa_normal, updated_at
     FROM client_rates
     WHERE user_id=$1`,
    [userId]
  );
  return r.rows[0] || null;
}

function resolveRateUsdPerKg({ origin, service, clientRatesRow }) {
  const key = rateKeyFor(origin, service);
  if (!key) return null;

  const v = clientRatesRow?.[key];
  if (v !== null && v !== undefined) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }

  return DEFAULT_RATES[key];
}

function toNumOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const MIN_BILLABLE_KG = 1; // Peso mínimo facturable

function billableWeight(weightKg, chargeReal = false) {
  const w = Number(weightKg);
  if (!Number.isFinite(w) || w <= 0) return null;
  if (chargeReal) return w; // peso real sin minimo
  return w < MIN_BILLABLE_KG ? MIN_BILLABLE_KG : w;
}

function computeEstimated(weightKg, rateUsdPerKg, chargeReal = false) {
  const w = billableWeight(weightKg, chargeReal);
  if (w === null) return null;
  const r = Number(rateUsdPerKg);
  if (!Number.isFinite(r) || r < 0) return null;
  return Number((w * r).toFixed(2));
}

async function computeRateAndEstimatedServer({
  userId,
  originRaw,
  serviceRaw,
  weight_kg,
  rateOverride,
  chargeRealWeight = false,
}) {
  const origin = normalizeOrigin(originRaw);
  if (!origin) {
    return {
      origin: null,
      service: null,
      rate_usd_per_kg: null,
      estimated_usd: null,
    };
  }

  let service = normalizeService(serviceRaw) || "NORMAL";
  if (origin === "EUROPA") service = "NORMAL";
  if (origin !== "USA" && service === "TECH_PREMIUM") service = "NORMAL";

  // Si chargeRealWeight=true y peso < 1kg, cobrar el peso real (no mínimo de 1kg)
  const effectiveWeight = (chargeRealWeight && Number(weight_kg) < MIN_BILLABLE_KG)
    ? Number(weight_kg)
    : weight_kg;

  const override = toNumOrNull(rateOverride);
  if (override !== null) {
    return {
      origin,
      service,
      rate_usd_per_kg: override,
      estimated_usd: computeEstimated(effectiveWeight, override),
    };
  }

  let ratesRow = null;
  try {
    ratesRow = await getClientRatesByUserId(userId);
  } catch (e) {
    console.error("READ CLIENT RATES ERROR", e);
    ratesRow = null;
  }

  const resolved = resolveRateUsdPerKg({
    origin,
    service,
    clientRatesRow: ratesRow,
  });

  // Aplicar descuento por volumen al peso individual del envío
  const kg = Number(effectiveWeight) || 0;
  const discountedRate = applyVolumeDiscount(resolved, kg);

  return {
    origin,
    service,
    rate_usd_per_kg: discountedRate,
    estimated_usd: computeEstimated(effectiveWeight, discountedRate, chargeRealWeight),
  };
}

// ==================== ✅ MAIL TEMPLATE (PRO) ====================

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function formatUsd(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return `$${n.toFixed(2)}`;
}

function formatUsdKg(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return `$${n.toFixed(2)}/kg`;
}

function formatKg(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return `${n.toFixed(2)} kg`;
}

function statusPillColor(status) {
  const s = safeStr(status).toLowerCase();
  if (s.includes("entregado")) return "#16a34a";
  if (s.includes("listo")) return "#0ea5e9";
  if (s.includes("tránsito") || s.includes("transito")) return "#f59e0b";
  if (s.includes("despachado")) return "#8b5cf6";
  if (s.includes("preparación") || s.includes("preparacion")) return "#06b6d4";
  return "#6366f1";
}

function guessTrackingUrl(trackingRaw) {
  const t = safeStr(trackingRaw).trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^www\./i.test(t)) return `https://${t}`;
  if (/^1Z[A-Z0-9]{16}$/i.test(t)) return `https://www.ups.com/track?loc=en_US&tracknum=${encodeURIComponent(t)}`;
  if (/^\d{12,15}$/.test(t)) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}`;
  if (/^\d{20,22}$/.test(t)) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(t)}`;
  return `https://www.17track.net/en/track?nums=${encodeURIComponent(t)}`;
}

function escapeHtml(str) {
  return safeStr(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function trackingHtml(trackingRaw) {
  const t = safeStr(trackingRaw).trim();
  if (!t) return "-";
  const url = guessTrackingUrl(t);
  const label = escapeHtml(t);
  if (!url) return label;
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"
    style="color:#c7d2fe; font-weight:800; text-decoration:underline;">${label}</a>`;
}

function shipmentUpdateEmailHtml({
  brand = "LEMON'S PORTAL",
  clientName = "",
  clientNumber = "",
  code = "",
  oldStatus = "",
  newStatus = "",
  origin = "",
  service = "",
  weightKg = null,
  rateUsdKg = null,
  estimatedUsd = null,
  tracking = "",
  boxCode = "",
  ctaUrl = "",
}) {
  const pill = statusPillColor(newStatus);
  const preview = `Tu envío #${code} pasó a "${newStatus}".`;
  const showCta = Boolean(ctaUrl && String(ctaUrl).trim().length > 0);
  const trackingBlock = trackingHtml(tracking);

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>${brand}</title>
  <style>
    @media (max-width: 600px) {
      .container { width: 100% !important; }
      .px { padding-left: 16px !important; padding-right: 16px !important; }
      .grid td { display:block !important; width:100% !important; }
      .btn { width: 100% !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#0b1020;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
    ${preview}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1020; padding:24px 0;">
    <tr>
      <td align="center" class="px" style="padding: 0 24px;">
        <table role="presentation" width="600" class="container" cellspacing="0" cellpadding="0" style="width:600px; max-width:600px;">
          
          <tr>
            <td style="padding: 8px 0 16px 0;">
              <div style="font-family: Arial, sans-serif; color:#c7d2fe; font-size:12px; letter-spacing:0.12em; text-transform:uppercase;">
                ${brand}
              </div>
              <div style="font-family: Arial, sans-serif; color:#ffffff; font-size:22px; font-weight:800; margin-top:6px;">
                Actualización de tu envío
              </div>
            </td>
          </tr>

          <tr>
            <td style="background: rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10); border-radius:16px; overflow:hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                
                <tr>
                  <td style="padding:16px; background: linear-gradient(135deg, rgba(99,102,241,0.35), rgba(168,85,247,0.20)); border-bottom:1px solid rgba(255,255,255,0.10);">
                    <table role="presentation" width="100%">
                      <tr>
                        <td style="font-family: Arial, sans-serif; color:#ffffff; font-size:14px;">
                          Hola <b>${safeStr(clientName) || "👋"}</b>
                          ${clientNumber ? `<span style="color:#cbd5e1;">(Cliente #${safeStr(clientNumber)})</span>` : ""}
                        </td>
                        <td align="right" style="font-family: Arial, sans-serif;">
                          <span style="display:inline-block; padding:8px 10px; border-radius:999px; background:${pill}; color:#0b1020; font-weight:800; font-size:12px;">
                            ${safeStr(newStatus)}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <div style="font-family: Arial, sans-serif; color:#e5e7eb; font-size:13px; margin-top:10px;">
                      Tu envío <b style="color:#fff;">#${safeStr(code)}</b> cambió de estado:
                      <div style="margin-top:8px; font-size:14px;">
                        <span style="display:inline-block; padding:6px 10px; border-radius:10px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.10); color:#e5e7eb;">
                          ${safeStr(oldStatus)}
                        </span>
                        <span style="color:#c7d2fe; font-weight:800; margin:0 8px;">→</span>
                        <span style="display:inline-block; padding:6px 10px; border-radius:10px; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.14); color:#ffffff; font-weight:800;">
                          ${safeStr(newStatus)}
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="grid" style="font-family: Arial, sans-serif; font-size:13px; color:#e5e7eb;">
                      <tr>
                        <td style="padding:10px; width:50%; vertical-align:top; background:rgba(255,255,255,0.04); border-radius:12px;">
                          <div style="color:#94a3b8; font-size:12px;">Origen / Servicio</div>
                          <div style="margin-top:4px; font-weight:800; color:#fff;">
                            ${safeStr(origin) || "-"} · ${safeStr(service) || "-"}
                          </div>
                        </td>
                        <td style="padding:10px; width:50%; vertical-align:top;">
                          <div style="background:rgba(255,255,255,0.04); border-radius:12px; padding:10px;">
                            <div style="color:#94a3b8; font-size:12px;">Peso</div>
                            <div style="margin-top:4px; font-weight:800; color:#fff;">
                              ${formatKg(weightKg)}
                            </div>
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:10px; width:50%; vertical-align:top;">
                          <div style="background:rgba(255,255,255,0.04); border-radius:12px; padding:10px;">
                            <div style="color:#94a3b8; font-size:12px;">Tarifa</div>
                            <div style="margin-top:4px; font-weight:800; color:#fff;">
                              ${formatUsdKg(rateUsdKg)}
                            </div>
                          </div>
                        </td>
                        <td style="padding:10px; width:50%; vertical-align:top;">
                          <div style="background:rgba(255,255,255,0.04); border-radius:12px; padding:10px;">
                            <div style="color:#94a3b8; font-size:12px;">Estimado</div>
                            <div style="margin-top:4px; font-weight:900; color:#fff; font-size:16px;">
                              ${formatUsd(estimatedUsd)}
                            </div>
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:10px; width:50%; vertical-align:top;">
                          <div style="background:rgba(255,255,255,0.04); border-radius:12px; padding:10px;">
                            <div style="color:#94a3b8; font-size:12px;">Tracking</div>
                            <div style="margin-top:4px; font-weight:800; color:#fff;">
                              ${trackingBlock}
                            </div>
                          </div>
                        </td>
                        <td style="padding:10px; width:50%; vertical-align:top;">
                          <div style="background:rgba(255,255,255,0.04); border-radius:12px; padding:10px;">
                            <div style="color:#94a3b8; font-size:12px;">Caja</div>
                            <div style="margin-top:4px; font-weight:800; color:#fff;">
                              ${safeStr(boxCode) || "-"}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>

                    ${
                      showCta
                        ? `
                      <div style="margin-top:16px;">
                        <a class="btn" href="${ctaUrl}"
                           style="display:inline-block; text-decoration:none; font-family: Arial, sans-serif;
                           background: linear-gradient(135deg, #6366f1, #a855f7);
                           color:#ffffff; padding:12px 16px; border-radius:12px; font-weight:900;">
                          Ver mis envíos
                        </a>
                      </div>
                    `
                        : ""
                    }

                    <div style="margin-top:14px; font-family: Arial, sans-serif; color:#94a3b8; font-size:12px;">
                      Si vos no solicitaste este aviso, podés ignorarlo.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 14px 0 0 0; font-family: Arial, sans-serif; color:#64748b; font-size:12px;">
              © ${new Date().getFullYear()} ${brand}. Todos los derechos reservados.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}


// ==================== SHIPMENT STATUS AUTOMATION + WA ====================

async function getShipmentWithClientById(shipmentId) {
  const q = await db.query(
    `SELECT
       s.*,
       u.name AS client_name,
       u.client_number,
       u.email AS client_email,
       u.phone AS client_phone
     FROM shipments s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1
     LIMIT 1`,
    [shipmentId]
  );
  return q.rows[0] || null;
}

async function enqueueWhatsappToClient(phone, message) {
  const normalized = String(phone || "").replace(/\D/g, "");
  if (!normalized || !message) return false;

  await db.query(
    `INSERT INTO wa_notifications (phone, message, status, created_at)
     VALUES ($1, $2, 'pending', NOW())`,
    [normalized, String(message)]
  );

  return true;
}

function addBusinessDays(baseDate, businessDays) {
  const d = new Date(baseDate);
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
}

function nextAutoTransitionForShipment(shipment) {
  const status = String(shipment.status || "");
  const origin = String(shipment.origin || "").toUpperCase();
  const service = String(shipment.service || "NORMAL").toUpperCase();
  const lastAt = new Date(shipment.last_status_at || shipment.date_in || shipment.updated_at || Date.now());

  if (status === "Recibido en depósito") {
    return {
      newStatus: "En preparación",
      dueAt: new Date(lastAt.getTime() + 12 * 60 * 60 * 1000),
    };
  }

  if (status === "En preparación") {
    return {
      newStatus: "En tránsito",
      dueAt: new Date(lastAt.getTime() + 12 * 60 * 60 * 1000),
    };
  }

  // "En tránsito" es el último estado automático — el operador avanza manualmente a "Listo para entrega"
  if (status === "En tránsito") {
    return null;
  }

  return null;
}

function buildShipmentWhatsappMessage({ shipment, oldStatus, newStatus }) {
  // Mensaje especial para entrega exitosa
  if (newStatus === "Entregado") {
    const clientName = shipment.client_name || shipment.contact_name || "";
    return [
      `🍋 ¡Hola${clientName ? " " + clientName.split(" ")[0] : ""}! Tu carga *${shipment.code}* fue entregada con éxito 🎉`,
      ``,
      `¡Gracias por elegirnos para traer tu carga! Fue un placer trabajar con vos.`,
      ``,
      `💬 ¿Cómo te pareció el servicio? Tu opinión nos ayuda a mejorar — respondé este mensaje y contanos tu experiencia.`,
      ``,
      `¡Hasta el próximo envío! 🍋`
    ].join("\n");
  }
  const code = shipment.code || shipment.id || "-";
  const lines = [
    `📦 Actualización de tu envío #${code}`,
    "",
    `Estado anterior: ${oldStatus || "Creado"}`,
    `Nuevo estado: ${newStatus}`,
    `Origen: ${shipment.origin || "-"}`,
    `Servicio: ${shipment.service || "-"}`,
  ];

  if (shipment.tracking) lines.push(`Tracking: ${shipment.tracking}`);
  if (shipment.weight_kg !== null && shipment.weight_kg !== undefined) {
    lines.push(`Peso: ${Number(shipment.weight_kg).toFixed(2)} kg`);
  }

  if (newStatus === "Listo para entrega" && shipment.estimated_usd !== null && shipment.estimated_usd !== undefined) {
    lines.push("");
    lines.push(`💵 Total a abonar: USD ${Number(shipment.estimated_usd).toFixed(2)}`);
  }

  lines.push("");
  lines.push("Cualquier duda, respondé este mensaje y te ayudamos.");
  return lines.join("\n");
}

async function notifyShipmentStatusWhatsapp({ shipment, oldStatus, newStatus }) {
  if (!shipment || !shipment.client_phone) return false;
  const msg = buildShipmentWhatsappMessage({ shipment, oldStatus, newStatus });
  return enqueueWhatsappToClient(shipment.client_phone, msg);
}

async function sendShipmentStatusEmail(shipment, oldStatus, newStatus) {
  try {
    if (!shipment?.client_email) return;

    const code = shipment?.code || shipment?.id || "";
    const ctaUrl =
      process.env.APP_URL && String(process.env.APP_URL).trim()
        ? `${String(process.env.APP_URL).replace(/\/$/, "")}/client/shipments`
        : "";

    const html = shipmentUpdateEmailHtml({
      brand: "LEMON'S PORTAL",
      clientName: shipment.client_name || "",
      clientNumber: shipment.client_number || "",
      code,
      oldStatus,
      newStatus,
      origin: shipment.origin || "",
      service: shipment.service || "",
      weightKg: shipment.weight_kg ?? null,
      rateUsdKg: shipment.rate_usd_per_kg ?? null,
      estimatedUsd: shipment.estimated_usd ?? null,
      tracking: shipment.tracking || "",
      boxCode: shipment.box_code || "",
      ctaUrl,
    });

    await sendEmail({
      to: shipment.client_email,
      subject: `Actualización de envío #${code}`,
      html,
    });
  } catch (e) {
    console.log("[MAIL] Falló envío update automático (no rompemos flujo):", e?.message || e);
  }
}

async function applyShipmentStatusChange({ shipmentId, oldStatus, newStatus, source = "auto" }) {
  const upd = await db.query(
    `UPDATE shipments
     SET status = $1,
         updated_at = NOW(),
         delivered_at = CASE WHEN $1='Entregado' THEN NOW() ELSE delivered_at END
     WHERE id = $2 AND status = $3
     RETURNING *`,
    [newStatus, shipmentId, oldStatus]
  );

  if (!upd.rows[0]) return null;

  await db.query(
    `INSERT INTO shipment_events (shipment_id, old_status, new_status) VALUES ($1,$2,$3)`,
    [shipmentId, oldStatus, newStatus]
  );

  const fresh = await getShipmentWithClientById(shipmentId);
  if (fresh) {
    await sendShipmentStatusEmail(fresh, oldStatus, newStatus);
    await notifyShipmentStatusWhatsapp({ shipment: fresh, oldStatus, newStatus });
  }

  console.log(`[AUTO STATUS] shipment ${shipmentId}: ${oldStatus} -> ${newStatus} (${source})`);
  return fresh;
}

async function processAutomaticShipmentStatuses() {
  const q = await db.query(`
    SELECT
      s.*,
      u.name AS client_name,
      u.client_number,
      u.email AS client_email,
      u.phone AS client_phone,
      COALESCE(last_evt.created_at, s.date_in, s.updated_at, NOW()) AS last_status_at
    FROM shipments s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN LATERAL (
      SELECT created_at
      FROM shipment_events se
      WHERE se.shipment_id = s.id
      ORDER BY se.created_at DESC
      LIMIT 1
    ) last_evt ON true
    WHERE s.status IN ('Recibido en depósito', 'En preparación', 'En tránsito')
    ORDER BY s.id ASC
  `);

  const now = new Date();

  for (const row of q.rows) {
    const plan = nextAutoTransitionForShipment(row);
    if (!plan) continue;
    if (plan.dueAt > now) continue;

    try {
      await applyShipmentStatusChange({
        shipmentId: row.id,
        oldStatus: row.status,
        newStatus: plan.newStatus,
        source: "scheduler",
      });
    } catch (e) {
      console.error("[AUTO STATUS ERROR]", row.id, e?.message || e);
    }
  }
}


// ══ MISIONES AUTO-CHECK ═══════════════════════════════════════════════════════
async function checkMissions(userId, eventType, extraData = {}) {
  try {
    const today = new Date().toISOString().slice(0,10);
    const weekNum = Math.ceil(new Date().getDate()/7);
    const week = new Date().getFullYear() + '-W' + String(weekNum).padStart(2,'0');

    async function completeMission(slug, period) {
      const mQ = await db.query(`SELECT * FROM coin_missions WHERE slug=$1 AND is_active=true`, [slug]);
      const mission = mQ.rows[0];
      if (!mission) return;
      const existing = await db.query(
        `SELECT * FROM user_missions WHERE user_id=$1 AND mission_slug=$2 AND period=$3`,
        [userId, slug, period]
      );
      if (existing.rows[0]?.completed_at) return; // ya completada
      if (existing.rows[0]) {
        await db.query(
          `UPDATE user_missions SET completed_at=NOW() WHERE user_id=$1 AND mission_slug=$2 AND period=$3`,
          [userId, slug, period]
        );
      } else {
        await db.query(
          `INSERT INTO user_missions (user_id, mission_slug, progress, completed_at, period)
           VALUES ($1,$2,$3,NOW(),$4) ON CONFLICT DO NOTHING`,
          [userId, slug, 1, period]
        );
      }
      console.log(`[MISSIONS] ${slug} completada para user ${userId}`);
    }

    async function incrementProgress(slug, period, increment, target) {
      const mQ = await db.query(`SELECT * FROM coin_missions WHERE slug=$1 AND is_active=true`, [slug]);
      if (!mQ.rows[0]) return;
      // Upsert: si existe actualiza, si no inserta
      await db.query(`
        INSERT INTO user_missions (user_id, mission_slug, progress, completed_at, period)
        VALUES ($1, $2, $3, CASE WHEN $3 >= $4 THEN NOW() ELSE NULL END, $5)
        ON CONFLICT (user_id, mission_slug, period) DO UPDATE SET
          progress = CASE WHEN user_missions.completed_at IS NOT NULL THEN user_missions.progress
                         ELSE LEAST(user_missions.progress + $3, $4) END,
          completed_at = CASE WHEN user_missions.completed_at IS NOT NULL THEN user_missions.completed_at
                              WHEN user_missions.progress + $3 >= $4 THEN NOW()
                              ELSE NULL END
      `, [userId, slug, increment, target, period]);
    }

    if (eventType === 'login') {
      // Login diario: SOLO marca la misión como completada (sin pagar coins automáticos).
      // Los coins se pagan al hacer click en "Reclamar" desde /coins/misiones.
      // Esto evita el doble-crédito y deja un único pago por día.
      const existing = await db.query(
        `SELECT * FROM user_missions WHERE user_id=$1 AND mission_slug='daily_login' AND period=$2`,
        [userId, today]
      );
      if (!existing.rows[0]) {
        await db.query(
          `INSERT INTO user_missions (user_id, mission_slug, progress, completed_at, period)
           VALUES ($1,'daily_login',1,NOW(),$2) ON CONFLICT DO NOTHING`,
          [userId, today]
        );
      }
    }

    if (eventType === 'chat_message') {
      await incrementProgress('daily_chat', today, 1, 10);
      // Chat streak semanal
      const streakQ = await db.query(`SELECT * FROM login_streaks WHERE user_id=$1`, [userId]);
      const todayDay = new Date().getDay();
      const weekDays = streakQ.rows[0]?.week_days || [];
      if (!weekDays.includes(today)) {
        const newDays = [...weekDays, today];
        await db.query(`UPDATE login_streaks SET week_days=$1, updated_at=NOW() WHERE user_id=$2`, [JSON.stringify(newDays), userId]);
        if (newDays.length >= 3) await completeMission('weekly_chat_streak', week);
      }
    }

    if (eventType === 'friend_added') {
      await completeMission('daily_friend', today);
    }

    if (eventType === 'power_bought') {
      await completeMission('onetime_power', 'forever');
    }

    if (eventType === 'profile_complete') {
      await completeMission('onetime_profile', 'forever');
    }

    if (eventType === 'shipment_delivered') {
      const { weight_kg, user_id } = extraData;
      // Calcular kg totales del cliente
      const kgQ = await db.query(
        `SELECT COALESCE(SUM(weight_kg),0) AS total_kg FROM shipments WHERE user_id=$1 AND status='Entregado'`,
        [user_id || userId]
      );
      const totalKg = Number(kgQ.rows[0]?.total_kg || 0);

      // Primer envio
      if (totalKg >= 1) await completeMission('onetime_ship1', 'forever');
      // KG milestones
      if (totalKg >= 5)   await completeMission('onetime_kg5',   'forever');
      if (totalKg >= 10)  await completeMission('onetime_kg10',  'forever');
      if (totalKg >= 50)  await completeMission('onetime_kg50',  'forever');
      if (totalKg >= 100) {
        await completeMission('onetime_kg100', 'forever');
        // Dar badge 100KG
        await db.query(
          `INSERT INTO user_items (user_id, item_key) VALUES ($1,'badge_100kg') ON CONFLICT DO NOTHING`,
          [user_id || userId]
        );
      }
    }

  } catch(e) {
    console.error('[MISSIONS CHECK ERROR]', e.message);
  }
}
// ═════════════════════════════════════════════════════════════════════════════


// ══ MISIONES AUTO-CHECK ═══════════════════════════════════════════════════════
async function checkMissions(userId, eventType, extraData = {}) {
  try {
    const today = new Date().toISOString().slice(0,10);
    const weekNum = Math.ceil(new Date().getDate()/7);
    const week = new Date().getFullYear() + '-W' + String(weekNum).padStart(2,'0');

    async function completeMission(slug, period) {
      const mQ = await db.query(`SELECT * FROM coin_missions WHERE slug=$1 AND is_active=true`, [slug]);
      const mission = mQ.rows[0];
      if (!mission) return;
      const existing = await db.query(
        `SELECT * FROM user_missions WHERE user_id=$1 AND mission_slug=$2 AND period=$3`,
        [userId, slug, period]
      );
      if (existing.rows[0]?.completed_at) return; // ya completada
      if (existing.rows[0]) {
        await db.query(
          `UPDATE user_missions SET completed_at=NOW() WHERE user_id=$1 AND mission_slug=$2 AND period=$3`,
          [userId, slug, period]
        );
      } else {
        await db.query(
          `INSERT INTO user_missions (user_id, mission_slug, progress, completed_at, period)
           VALUES ($1,$2,$3,NOW(),$4) ON CONFLICT DO NOTHING`,
          [userId, slug, 1, period]
        );
      }
      console.log(`[MISSIONS] ${slug} completada para user ${userId}`);
    }

    async function incrementProgress(slug, period, increment, target) {
      const mQ = await db.query(`SELECT * FROM coin_missions WHERE slug=$1 AND is_active=true`, [slug]);
      if (!mQ.rows[0]) return;
      // Upsert: si existe actualiza, si no inserta
      await db.query(`
        INSERT INTO user_missions (user_id, mission_slug, progress, completed_at, period)
        VALUES ($1, $2, $3, CASE WHEN $3 >= $4 THEN NOW() ELSE NULL END, $5)
        ON CONFLICT (user_id, mission_slug, period) DO UPDATE SET
          progress = CASE WHEN user_missions.completed_at IS NOT NULL THEN user_missions.progress
                         ELSE LEAST(user_missions.progress + $3, $4) END,
          completed_at = CASE WHEN user_missions.completed_at IS NOT NULL THEN user_missions.completed_at
                              WHEN user_missions.progress + $3 >= $4 THEN NOW()
                              ELSE NULL END
      `, [userId, slug, increment, target, period]);
    }

    if (eventType === 'login') {
      // Login diario: SOLO marca la misión como completada (sin pagar coins automáticos).
      // Los coins se pagan al hacer click en "Reclamar" desde /coins/misiones.
      // Esto evita el doble-crédito y deja un único pago por día.
      const existing = await db.query(
        `SELECT * FROM user_missions WHERE user_id=$1 AND mission_slug='daily_login' AND period=$2`,
        [userId, today]
      );
      if (!existing.rows[0]) {
        await db.query(
          `INSERT INTO user_missions (user_id, mission_slug, progress, completed_at, period)
           VALUES ($1,'daily_login',1,NOW(),$2) ON CONFLICT DO NOTHING`,
          [userId, today]
        );
      }
    }

    if (eventType === 'chat_message') {
      await incrementProgress('daily_chat', today, 1, 10);
      // Chat streak semanal
      const streakQ = await db.query(`SELECT * FROM login_streaks WHERE user_id=$1`, [userId]);
      const todayDay = new Date().getDay();
      const weekDays = streakQ.rows[0]?.week_days || [];
      if (!weekDays.includes(today)) {
        const newDays = [...weekDays, today];
        await db.query(`UPDATE login_streaks SET week_days=$1, updated_at=NOW() WHERE user_id=$2`, [JSON.stringify(newDays), userId]);
        if (newDays.length >= 3) await completeMission('weekly_chat_streak', week);
      }
    }

    if (eventType === 'friend_added') {
      await completeMission('daily_friend', today);
    }

    if (eventType === 'power_bought') {
      await completeMission('onetime_power', 'forever');
    }

    if (eventType === 'profile_complete') {
      await completeMission('onetime_profile', 'forever');
    }

    if (eventType === 'shipment_delivered') {
      const { weight_kg, user_id } = extraData;
      // Calcular kg totales del cliente
      const kgQ = await db.query(
        `SELECT COALESCE(SUM(weight_kg),0) AS total_kg FROM shipments WHERE user_id=$1 AND status='Entregado'`,
        [user_id || userId]
      );
      const totalKg = Number(kgQ.rows[0]?.total_kg || 0);

      // Primer envio
      if (totalKg >= 1) await completeMission('onetime_ship1', 'forever');
      // KG milestones
      if (totalKg >= 5)   await completeMission('onetime_kg5',   'forever');
      if (totalKg >= 10)  await completeMission('onetime_kg10',  'forever');
      if (totalKg >= 50)  await completeMission('onetime_kg50',  'forever');
      if (totalKg >= 100) {
        await completeMission('onetime_kg100', 'forever');
        // Dar badge 100KG
        await db.query(
          `INSERT INTO user_items (user_id, item_key) VALUES ($1,'badge_100kg') ON CONFLICT DO NOTHING`,
          [user_id || userId]
        );
      }
    }

  } catch(e) {
    console.error('[MISSIONS CHECK ERROR]', e.message);
  }
}
// ═════════════════════════════════════════════════════════════════════════════


// ══ INVITE CODES + REGISTRO ═══════════════════════════════════════════════════

function buildVerifyEmailHtml(name, verifyUrl) {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#080808;">
<table width="100%" cellspacing="0" cellpadding="0" style="background:#080808;padding:40px 20px;">
  <tr><td align="center">
    <table width="480" cellspacing="0" cellpadding="0" style="width:480px;max-width:480px;">
      <tr><td style="padding-bottom:32px;text-align:center;">
        <div style="font-family:Arial,sans-serif;font-size:28px;margin-bottom:8px;">🍋</div>
        <div style="font-family:Arial,sans-serif;color:#f5a623;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Lemon's Portal</div>
      </td></tr>
      <tr><td style="background:rgba(245,166,35,0.06);border:2px solid rgba(245,166,35,0.2);border-radius:20px;overflow:hidden;">
        <div style="padding:32px;background:linear-gradient(135deg,rgba(245,166,35,0.1),transparent);border-bottom:1px solid rgba(245,166,35,0.1);">
          <div style="font-family:Arial,sans-serif;color:#fff;font-size:22px;font-weight:900;margin-bottom:8px;">Bienvenido, ${name}! 👋</div>
          <div style="font-family:Arial,sans-serif;color:rgba(255,255,255,0.6);font-size:14px;">Ya casi estás listo para importar con Lemon's.</div>
        </div>
        <div style="padding:28px 32px;">
          <p style="font-family:Arial,sans-serif;color:#ccc;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Hacé click en el botón para verificar tu cuenta. El link es válido por <b style="color:#f5a623;">24 horas</b>.
          </p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${verifyUrl}" style="display:inline-block;padding:16px 40px;border-radius:14px;background:linear-gradient(135deg,#f5a623,#ff6200);color:#000;text-decoration:none;font-family:Arial,sans-serif;font-weight:900;font-size:16px;letter-spacing:1px;">
              VERIFICAR CUENTA ✓
            </a>
          </div>
          <p style="font-family:Arial,sans-serif;color:rgba(255,255,255,0.3);font-size:12px;margin:0;">
            Si no creaste esta cuenta, ignorá este email.
          </p>
        </div>
      </td></tr>
      <tr><td style="padding:20px 0 0;text-align:center;font-family:Arial,sans-serif;color:#333;font-size:12px;">
        © ${new Date().getFullYear()} Lemon's Portal
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── POST /auth/register ───────────────────────────────────────────────────────
app.post("/auth/register", authLimiter, noStore, async (req, res) => {
  try {
    const schema = z.object({
      invite_code: z.string().min(1),
      name:        z.string().min(2),
      email:       z.string().email(),
      password:    z.string().min(6),
      referrer:    z.string().min(2).max(40).optional(),  // username del que invitó
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    const { invite_code, name, email, password, referrer } = p.data;

    // Verificar código
    const codeQ = await db.query(
      `SELECT * FROM invite_codes WHERE code=$1 AND used_by IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
      [invite_code.toUpperCase().trim()]
    );
    if (!codeQ.rows[0]) return res.status(400).json({ error: "Código de invitación inválido o ya usado" });

    // Verificar email no existe
    const existQ = await db.query(`SELECT id FROM users WHERE email=$1`, [email.toLowerCase()]);
    if (existQ.rows[0]) return res.status(400).json({ error: "Este email ya está registrado" });

    // Siguiente número de cliente
    const maxQ = await db.query(`SELECT COALESCE(MAX(client_number),0)+1 AS next FROM users`);
    const clientNumber = maxQ.rows[0].next;

    // Crear usuario
    const hash = await bcrypt.hash(password, 10);
    const userQ = await db.query(
      `INSERT INTO users (client_number, name, email, password_hash, role, invite_code, email_verified)
       VALUES ($1,$2,$3,$4,'client',$5,false) RETURNING id, client_number, name, email`,
      [clientNumber, name.trim(), email.toLowerCase(), hash, invite_code.toUpperCase().trim()]
    );
    const user = userQ.rows[0];

    // Marcar código como usado
    await db.query(
      `UPDATE invite_codes SET used_by=$1, used_at=NOW() WHERE code=$2`,
      [user.id, invite_code.toUpperCase().trim()]
    );

    // Registrar referido si vino con referrer (username del que lo invitó)
    if (referrer) {
      try {
        const refQ = await db.query(`SELECT id FROM users WHERE LOWER(username)=LOWER($1) AND id<>$2`, [referrer.trim(), user.id]);
        if (refQ.rows[0]) {
          const referrerId = refQ.rows[0].id;
          await db.query(`UPDATE users SET referrer_id=$1 WHERE id=$2`, [referrerId, user.id]);
          await db.query(
            `INSERT INTO referrals (referrer_id, referred_id, status) VALUES ($1,$2,'pending') ON CONFLICT (referred_id) DO NOTHING`,
            [referrerId, user.id]
          );
        }
      } catch (e) { console.warn("[register referrer]", e.message); }
    }

    // Crear lemon_coins
    await db.query(
      `INSERT INTO lemon_coins (user_id, balance, total_earned) VALUES ($1, 0, 0) ON CONFLICT DO NOTHING`,
      [user.id]
    );

    // Crear perfil
    await db.query(
      `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [user.id]
    );

    // Generar token de verificación (plano para email, bcrypt en DB)
    const token = require("crypto").randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(token, 10);
    const expires = new Date(Date.now() + 24*60*60*1000);
    await db.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
      [user.id, tokenHash, expires]
    );

    // Enviar email de verificación
    const base = process.env.APP_URL || "https://app.lemonsarg.com";
    const verifyUrl = `${base}/verify-email?token=${token}`;
    try {
      await sendEmail({
        to: user.email,
        subject: "Verificá tu cuenta — Lemon's Portal",
        html: buildVerifyEmailHtml(name, verifyUrl),
      });
    } catch(e) {
      console.log("[MAIL] verify email falló:", e?.message);
    }

    res.json({ ok: true, message: "Cuenta creada. Revisá tu email para verificar.", client_number: user.client_number });
  } catch(e) {
    console.error("[REGISTER]", e);
    if (String(e?.message||"").includes("duplicate")) return res.status(400).json({ error: "Email ya registrado" });
    res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /auth/verify-email ────────────────────────────────────────────────────
app.get("/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Token requerido" });

    // Path 1: tokens viejos en plano (compat con emails ya enviados antes del hash)
    let row = (await db.query(
      `SELECT * FROM email_verifications WHERE token=$1 AND verified_at IS NULL AND expires_at > NOW()`,
      [token]
    )).rows[0];

    // Path 2: tokens nuevos hasheados — loop con bcrypt.compare sobre candidatos activos
    if (!row) {
      const candidates = await db.query(
        `SELECT * FROM email_verifications WHERE token_hash IS NOT NULL AND verified_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 50`
      );
      for (const c of candidates.rows) {
        if (await bcrypt.compare(token, c.token_hash)) { row = c; break; }
      }
    }

    if (!row) return res.status(400).json({ error: "Token inválido o vencido" });

    await db.query(`UPDATE users SET email_verified=true WHERE id=$1`, [row.user_id]);
    await db.query(`UPDATE email_verifications SET verified_at=NOW() WHERE id=$1`, [row.id]);

    // Dar coins de bienvenida (15 por verificar email)
    await db.query(`UPDATE lemon_coins SET balance=balance+15, total_earned=total_earned+15 WHERE user_id=$1`, [row.user_id]);
    await db.query(`INSERT INTO coin_transactions (user_id,type,amount,reason) VALUES ($1,'earn',15,'Bienvenido a Lemons Portal!')`, [row.user_id]);

    res.json({ ok: true, message: "Email verificado. Ya podés ingresar." });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /admin/invite-codes ──────────────────────────────────────────────────
app.post("/admin/invite-codes", authRequired, requireRole(["admin"]), async (req, res) => {
  try {
    const { notes, expires_days, quantity = 1 } = req.body;
    const crypto = require("crypto");
    const codes = [];
    const expires = expires_days ? new Date(Date.now() + expires_days*24*60*60*1000) : null;

    for (let i = 0; i < Math.min(quantity, 50); i++) {
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      const q = await db.query(
        `INSERT INTO invite_codes (code, created_by, notes, expires_at) VALUES ($1,$2,$3,$4) RETURNING *`,
        [code, req.user.id, notes||null, expires]
      );
      codes.push(q.rows[0]);
    }

    res.json({ ok: true, codes });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /admin/invite-codes ───────────────────────────────────────────────────
app.get("/admin/invite-codes", authRequired, requireRole(["admin"]), async (req, res) => {
  try {
    const q = await db.query(`
      SELECT ic.*, u.name AS used_by_name, u.email AS used_by_email
      FROM invite_codes ic
      LEFT JOIN users u ON u.id = ic.used_by
      ORDER BY ic.created_at DESC
    `);
    res.json({ ok: true, codes: q.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /admin/invite-codes/:id ───────────────────────────────────────────
app.delete("/admin/invite-codes/:id", authRequired, requireRole(["admin"]), async (req, res) => {
  try {
    await db.query(`DELETE FROM invite_codes WHERE id=$1 AND used_by IS NULL`, [req.params.id]);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
// ═════════════════════════════════════════════════════════════════════════════

function startShipmentAutomationLoop() {
  if (global.__LEMONS_SHIPMENT_AUTOMATION_STARTED__) return;
  global.__LEMONS_SHIPMENT_AUTOMATION_STARTED__ = true;

  const run = async () => {
    try {
      await processAutomaticShipmentStatuses();
    } catch (e) {
      console.error("[AUTO STATUS LOOP ERROR]", e?.message || e);
    }
  };

  setTimeout(run, 15000);
  setInterval(run, 10 * 60 * 1000);
  console.log("[AUTO STATUS] Loop iniciado");
}

// ==================== AUTH ====================


// ── ETZ AI — datos completos del negocio ────────────────────────────────────
app.get("/api/etz/business-data", async (req, res) => {
  const key = req.headers["x-ai-api-key"] || req.query.key;
  if (key !== "lemons_ai_2026KENOPAZENENE_xK9mPqR7vL3nZ") return res.status(401).json({ error: "No autorizado" });
  try {
    const [shipmentStats, recentShipments, clientStats, topClients, paymentStats, expenseStats, waStats, pendingDelivery, shipmentByOrigin] = await Promise.all([
      db.query(`SELECT status, COUNT(*) as count, COALESCE(SUM(weight_kg),0) as kg FROM shipments GROUP BY status ORDER BY count DESC`),
      db.query(`SELECT s.code, s.status, s.origin, s.service, s.weight_kg, s.tracking, u.name as client_name, s.created_at FROM shipments s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT 20`),
      db.query(`SELECT role, COUNT(*) as count FROM users GROUP BY role`),
      db.query(`SELECT u.name, u.client_number, u.phone, COUNT(s.id) as envios, COALESCE(SUM(s.weight_kg),0) as kg_total FROM users u LEFT JOIN shipments s ON s.user_id=u.id WHERE u.role='client' GROUP BY u.id, u.name, u.client_number, u.phone ORDER BY envios DESC LIMIT 15`),
      db.query(`SELECT COUNT(*) as total, COALESCE(SUM(amount_usd),0) as ingresos, COALESCE(SUM(profit_usd),0) as ganancia, COALESCE(AVG(amount_usd),0) as promedio FROM payments WHERE created_at > NOW() - INTERVAL '30 days'`),
      db.query(`SELECT category, COALESCE(SUM(CASE WHEN currency='ARS' THEN amount/1400 ELSE amount END),0) as total_usd FROM expenses WHERE date > NOW() - INTERVAL '30 days' GROUP BY category ORDER BY total_usd DESC`),
      db.query(`SELECT mode, COUNT(*) as count, COALESCE(SUM(unread_count),0) as unread FROM wa_conversations GROUP BY mode`),
      db.query(`SELECT s.code, s.status, s.origin, s.service, s.weight_kg, u.name as client_name FROM shipments s LEFT JOIN users u ON u.id=s.user_id WHERE s.status IN ('Listo para entrega','En tránsito') ORDER BY s.created_at DESC`),
      db.query(`SELECT origin, service, COUNT(*) as count FROM shipments GROUP BY origin, service ORDER BY count DESC`),
    ]);
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      shipments: {
        byStatus: shipmentStats.rows,
        recent: recentShipments.rows,
        byOrigin: shipmentByOrigin.rows,
        pending: pendingDelivery.rows,
        totals: {
          total: shipmentStats.rows.reduce((a,r)=>a+Number(r.count),0),
          enTransito: Number(shipmentStats.rows.find(r=>r.status==="En tránsito")?.count||0),
          listoEntrega: Number(shipmentStats.rows.find(r=>r.status==="Listo para entrega")?.count||0),
          entregados: Number(shipmentStats.rows.find(r=>r.status==="Entregado")?.count||0),
        }
      },
      clients: { total: clientStats.rows.find(r=>r.role==="client")?.count||0, top: topClients.rows },
      finances: { last30days: paymentStats.rows[0], expensesByCategory: expenseStats.rows, fxRate: 1400 },
      whatsapp: {
        byMode: waStats.rows,
        waiting: Number(waStats.rows.find(r=>r.mode==="waiting_operator")?.count||0),
        withOperator: Number(waStats.rows.find(r=>r.mode==="operator")?.count||0),
        bot: Number(waStats.rows.find(r=>r.mode==="bot")?.count||0),
        totalUnread: waStats.rows.reduce((a,r)=>a+Number(r.unread||0),0),
      }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Public stats para landing ────────────────────────────────────────────────
app.get("/public/stats", async (req, res) => {
  try {
    const sq = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'Entregado')::int AS delivered,
        COUNT(DISTINCT user_id)::int AS active_clients
      FROM shipments
    `);
    res.json({
      ok: true,
      delivered: sq.rows[0]?.delivered || 0,
      active_clients: sq.rows[0]?.active_clients || 0,
    });
  } catch(e) {
    res.json({ ok: false, delivered: 0, active_clients: 0 });
  }
});

// ── GET /public/operations-status — estado ON/OFF + nota de demora por línea ─
const OP_LINE_FIELDS = ["usa_normal","usa_express","china_normal","china_express","europa_normal"];
const OP_LINE_KEYS  = OP_LINE_FIELDS.map(f => `op_line_${f}`);
const OP_NOTE_KEYS  = OP_LINE_FIELDS.map(f => `op_line_${f}_note`);
const OP_ALL_KEYS   = [...OP_LINE_KEYS, ...OP_NOTE_KEYS];
const OP_LINE_DEFAULTS = {
  op_line_usa_normal:    "on",
  op_line_usa_express:   "on",
  op_line_china_normal:  "on",
  op_line_china_express: "on",
  op_line_europa_normal: "off",
};
function shapeOpLines(map) {
  const v = (k) => ((map[k] ?? OP_LINE_DEFAULTS[k]) === "on");
  const lines = Object.fromEntries(OP_LINE_FIELDS.map(f => [f, v(`op_line_${f}`)]));
  const notes = Object.fromEntries(OP_LINE_FIELDS.map(f => [f, (map[`op_line_${f}_note`] || "").trim()]));
  const countries = {
    usa:    lines.usa_normal    || lines.usa_express,
    china:  lines.china_normal  || lines.china_express,
    europa: lines.europa_normal,
  };
  return { lines, countries, notes };
}

app.get("/public/operations-status", async (req, res) => {
  try {
    const q = await db.query(
      `SELECT key, value FROM ai_settings WHERE key = ANY($1)`,
      [OP_ALL_KEYS]
    );
    const map = Object.fromEntries(q.rows.map(r => [r.key, r.value]));
    const { lines, countries, notes } = shapeOpLines(map);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, lines, countries, notes, updated_at: new Date().toISOString() });
  } catch (e) {
    console.error("[/public/operations-status]", e.message);
    const { lines, countries, notes } = shapeOpLines({});
    res.json({ ok: false, lines, countries, notes });
  }
});

// ── PUT /operator/operations-status — togglear líneas + notas ────────────────
app.put("/operator/operations-status", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const lineSchema = z.object(Object.fromEntries(OP_LINE_FIELDS.map(f => [f, z.boolean().optional()])));
    const noteSchema = z.object(Object.fromEntries(OP_LINE_FIELDS.map(f => [f, z.string().max(80).optional()])));
    const schema = lineSchema.extend({ notes: noteSchema.optional() });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    for (const f of OP_LINE_FIELDS) {
      if (p.data[f] === undefined) continue;
      await db.query(
        `INSERT INTO ai_settings (key, value, updated_at) VALUES ($1,$2,NOW())
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
        [`op_line_${f}`, p.data[f] ? "on" : "off"]
      );
    }
    if (p.data.notes) {
      for (const f of OP_LINE_FIELDS) {
        if (p.data.notes[f] === undefined) continue;
        const note = sanitizeText((p.data.notes[f] || "").trim()).slice(0, 80);
        await db.query(
          `INSERT INTO ai_settings (key, value, updated_at) VALUES ($1,$2,NOW())
           ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
          [`op_line_${f}_note`, note]
        );
      }
    }
    const q = await db.query(
      `SELECT key, value FROM ai_settings WHERE key = ANY($1)`,
      [OP_ALL_KEYS]
    );
    const map = Object.fromEntries(q.rows.map(r => [r.key, r.value]));
    const { lines, countries, notes } = shapeOpLines(map);
    res.json({ ok: true, lines, countries, notes });
  } catch (e) {
    console.error("[PUT /operator/operations-status]", e.message);
    res.status(500).json({ error: "Error guardando estado" });
  }
});

// ── CUPONES ──────────────────────────────────────────────────────────────────
const COUPON_APPLIES = ["all","usa","china","europa","normal","express","usa_normal","usa_express","china_normal","china_express","europa_normal"];

// GET /admin/coupons — staff
app.get("/admin/coupons", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const q = await db.query(
      `SELECT c.*, COALESCE(u.name, '') as created_by_name
         FROM coupons c
         LEFT JOIN users u ON u.id = c.created_by
        ORDER BY c.created_at DESC LIMIT 200`
    );
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, coupons: q.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /admin/coupons — crear
app.post("/admin/coupons", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const schema = z.object({
      code:         z.string().min(3).max(40).regex(/^[A-Z0-9_-]+$/i),
      description:  z.string().max(200).optional().nullable(),
      discount_pct: z.number().min(1).max(100).optional().nullable(),
      discount_usd: z.number().min(0).max(10000).optional().nullable(),
      applies_to:   z.enum(COUPON_APPLIES).optional(),
      min_kg:       z.number().min(0).optional(),
      max_uses:     z.number().int().min(1).optional().nullable(),
      expires_at:   z.string().optional().nullable(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });
    const d = p.data;
    if (!d.discount_pct && !d.discount_usd) return res.status(400).json({ error: "Definí descuento (% o USD)" });
    const r = await db.query(
      `INSERT INTO coupons (code, description, discount_pct, discount_usd, applies_to, min_kg, max_uses, expires_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [d.code.toUpperCase(), sanitizeText(d.description, 200), d.discount_pct || null,
       d.discount_usd || null, d.applies_to || "all", d.min_kg || 0,
       d.max_uses || null, d.expires_at || null, req.user.id]
    );
    res.json({ ok: true, coupon: r.rows[0] });
  } catch (e) {
    if (e.code === "23505") return res.status(409).json({ error: "Ese código ya existe" });
    console.error("[POST /admin/coupons]", e.message);
    res.status(500).json({ error: "Error al crear cupón" });
  }
});

// PATCH /admin/coupons/:id — toggle active / editar
app.patch("/admin/coupons/:id", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const { active, expires_at, max_uses } = req.body;
    const fields = []; const params = []; let i = 1;
    if (active     !== undefined) { fields.push(`active=$${i++}`);     params.push(!!active); }
    if (expires_at !== undefined) { fields.push(`expires_at=$${i++}`); params.push(expires_at || null); }
    if (max_uses   !== undefined) { fields.push(`max_uses=$${i++}`);   params.push(max_uses || null); }
    if (!fields.length) return res.json({ ok: true, noop: true });
    params.push(id);
    const r = await db.query(`UPDATE coupons SET ${fields.join(", ")} WHERE id=$${i} RETURNING *`, params);
    res.json({ ok: true, coupon: r.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /admin/coupons/:id
app.delete("/admin/coupons/:id", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    await db.query(`DELETE FROM coupons WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /coupons/validate — cliente valida un código antes de cotizar/pagar
app.post("/coupons/validate", authRequired, async (req, res) => {
  try {
    const schema = z.object({
      code:    z.string().min(1).max(40),
      origin:  z.string().optional(),  // USA | CHINA | EUROPA
      service: z.string().optional(),  // NORMAL | EXPRESS | TECH_PREMIUM
      kg:      z.number().min(0).optional(),
      amount_usd: z.number().min(0).optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ ok: false, error: "Datos inválidos" });
    const { code, origin, service, kg = 0, amount_usd = 0 } = p.data;
    const q = await db.query(`SELECT * FROM coupons WHERE LOWER(code)=LOWER($1)`, [code]);
    const c = q.rows[0];
    if (!c) return res.status(404).json({ ok: false, error: "Código inválido" });
    if (!c.active) return res.status(400).json({ ok: false, error: "Cupón desactivado" });
    if (c.expires_at && new Date(c.expires_at) < new Date()) return res.status(400).json({ ok: false, error: "Cupón expirado" });
    if (c.max_uses && c.used_count >= c.max_uses) return res.status(400).json({ ok: false, error: "Cupón agotado" });
    if (kg < Number(c.min_kg || 0)) return res.status(400).json({ ok: false, error: `Mínimo ${c.min_kg}kg` });

    // Validar applies_to
    const lane = `${(origin||"").toLowerCase()}_${(service||"").toLowerCase()}`;
    const okLane =
      c.applies_to === "all" ||
      c.applies_to === (origin||"").toLowerCase() ||
      c.applies_to === (service||"").toLowerCase() ||
      c.applies_to === lane;
    if (!okLane) return res.status(400).json({ ok: false, error: `Solo aplica a ${c.applies_to}` });

    // Calcular descuento
    let discount = 0;
    if (c.discount_pct) discount = (amount_usd * Number(c.discount_pct)) / 100;
    else if (c.discount_usd) discount = Math.min(Number(c.discount_usd), amount_usd);

    res.json({
      ok: true,
      coupon: {
        id: c.id, code: c.code, description: c.description,
        discount_pct: c.discount_pct, discount_usd: c.discount_usd,
        applies_to: c.applies_to,
      },
      discount: Number(discount.toFixed(2)),
      final_usd: Number((amount_usd - discount).toFixed(2)),
    });
  } catch (e) {
    console.error("[/coupons/validate]", e.message);
    res.status(500).json({ ok: false, error: "Error validando" });
  }
});

// ── QUOTE — Estimación rápida desde link ─────────────────────────────────────
// Detecta país de origen del dominio, calcula con rates actuales, aplica cupón.
const ORIGIN_DOMAINS = {
  USA:    ["amazon.com","ebay.com","walmart.com","bestbuy.com","target.com","apple.com","newegg.com","macys.com","nike.com","etsy.com"],
  CHINA:  ["aliexpress.com","alibaba.com","taobao.com","1688.com","shein.com","dhgate.com","tmall.com","temu.com"],
  EUROPA: ["amazon.es","amazon.de","amazon.fr","amazon.it","amazon.co.uk","zalando.com","asos.com","mango.com","zara.com"],
};
function detectOriginFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    for (const [origin, domains] of Object.entries(ORIGIN_DOMAINS)) {
      if (domains.some(d => host === d || host.endsWith("." + d))) return origin;
    }
  } catch {}
  return null;
}
// ── Scraper de producto con dos estrategias ─────────────────────────────────
// 1. Fetch directo con UA de Chrome real (funciona en MercadoLibre, AliExpress,
//    Shein, eBay, etc).
// 2. Fallback Microlink API (free tier 50/día sin auth, gratis con MICROLINK_API_KEY).
//    Microlink rotea proxies y resuelve sitios con anti-bot (Amazon, Walmart, etc).
const MICROLINK_KEY = process.env.MICROLINK_API_KEY || null;

async function scrapDirect(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Ch-Ua": '"Chromium";v="127", "Not)A;Brand";v="99"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const html = (await res.text()).slice(0, 400_000);

    function meta(name) {
      const re  = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
      const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${name}["']`, "i");
      return (html.match(re) || html.match(re2) || [])[1] || null;
    }

    let image = meta("og:image") || meta("og:image:url") || meta("twitter:image") || meta("twitter:image:src") || meta("image");
    let title = meta("og:title") || meta("twitter:title") || (html.match(/<title>([^<]+)<\/title>/i) || [])[1];
    let description = meta("og:description") || meta("twitter:description") || meta("description");
    let priceRaw = meta("og:price:amount") || meta("product:price:amount") || meta("twitter:data1") || meta("price");
    let priceCurrency = meta("og:price:currency") || meta("product:price:currency") || null;

    // JSON-LD schema.org Product
    if (!priceRaw || !image || !title) {
      const ldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const m of ldMatches) {
        try {
          const json = JSON.parse(m[1].trim().replace(/[ -]/g, ""));
          const arr = Array.isArray(json) ? json : [json];
          for (const node of arr) {
            const items = node["@graph"] || [node];
            for (const it of items) {
              if (!it || typeof it !== "object") continue;
              const t = (it["@type"] || "").toString().toLowerCase();
              if (t.includes("product")) {
                if (!title && it.name) title = it.name;
                if (!description && it.description) description = it.description;
                if (!image) image = Array.isArray(it.image) ? it.image[0] : (typeof it.image === "string" ? it.image : it.image?.url);
                const offer = Array.isArray(it.offers) ? it.offers[0] : it.offers;
                if (!priceRaw && offer?.price) priceRaw = offer.price;
                if (!priceCurrency && offer?.priceCurrency) priceCurrency = offer.priceCurrency;
              }
            }
          }
        } catch {}
      }
    }

    if (!image && !title) return { ok: false, reason: "no_meta" };
    return {
      ok: true,
      data: {
        title: title ? String(title).replace(/\s+/g, " ").trim().slice(0, 160) : null,
        description: description ? String(description).replace(/\s+/g, " ").trim().slice(0, 280) : null,
        image: image || null,
        price: priceRaw ? Number(String(priceRaw).replace(/[^\d.,]/g, "").replace(",", ".")) || null : null,
        currency: priceCurrency || null,
      },
    };
  } catch (e) {
    return { ok: false, reason: e.name === "AbortError" ? "timeout" : "fetch_fail" };
  }
}

async function scrapMicrolink(url) {
  try {
    const params = new URLSearchParams({ url, meta: "true" });
    const headers = {};
    if (MICROLINK_KEY) headers["x-api-key"] = MICROLINK_KEY;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(`https://api.microlink.io/?${params}`, { signal: ctrl.signal, headers });
    clearTimeout(t);
    if (!res.ok) return { ok: false, reason: `microlink_${res.status}` };
    const json = await res.json();
    if (json.status !== "success" || !json.data) return { ok: false, reason: "microlink_no_data" };
    const d = json.data;
    return {
      ok: true,
      data: {
        title: d.title ? String(d.title).slice(0, 160) : null,
        description: d.description ? String(d.description).slice(0, 280) : null,
        image: d.image?.url || null,
        price: null,
        currency: null,
      },
    };
  } catch (e) {
    return { ok: false, reason: e.name === "AbortError" ? "microlink_timeout" : "microlink_fail" };
  }
}

async function scrapProductMeta(url) {
  // Estrategia 1: scrape directo (rápido, funciona para muchos sitios)
  const direct = await scrapDirect(url);
  if (direct.ok && direct.data && (direct.data.title || direct.data.image)) {
    console.log("[scrap] direct OK:", url, "→", direct.data.title?.slice(0, 40));
    return direct.data;
  }
  console.log("[scrap] direct fail:", url, "→", direct.reason);

  // Estrategia 2: Microlink fallback
  const ml = await scrapMicrolink(url);
  if (ml.ok && ml.data && (ml.data.title || ml.data.image)) {
    console.log("[scrap] microlink OK:", url);
    return ml.data;
  }
  console.log("[scrap] microlink fail:", url, "→", ml.reason);

  return null;
}

async function fetchOpStatus() {
  try {
    const q = await db.query(
      `SELECT key, value FROM ai_settings WHERE key = ANY($1)`,
      [["op_line_usa_normal","op_line_usa_express","op_line_china_normal","op_line_china_express","op_line_europa_normal"]]
    );
    return Object.fromEntries(q.rows.map(r => [r.key, r.value]));
  } catch { return {}; }
}

app.post("/api/quote/estimate-link", authRequired, async (req, res) => {
  try {
    const schema = z.object({
      url:        z.string().url(),
      weight_kg:  z.number().min(0.1).max(500),
      origin:     z.enum(["USA","CHINA","EUROPA"]).optional(),
      service:    z.enum(["NORMAL","EXPRESS","TECH_PREMIUM"]).optional(),
      coupon:     z.string().max(40).optional().nullable(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos. Pegá un link válido y un peso en kg." });
    const { url, weight_kg, coupon } = p.data;

    // Detectar origen automáticamente si no vino
    const origin = p.data.origin || detectOriginFromUrl(url) || "USA";
    // Default service según origen
    const service = p.data.service || (origin === "EUROPA" ? "NORMAL" : "EXPRESS");

    // Verificar línea operativa
    const opStatus = await fetchOpStatus();
    const lineKey = `op_line_${origin.toLowerCase()}_${service.toLowerCase()}`;
    const lineActive = (opStatus[lineKey] || (origin === "EUROPA" ? "off" : "on")) === "on";

    // Rates actuales
    const costsQ = await db.query(
      `SELECT usa_normal, usa_express, usa_tech_premium, china_normal, china_express, europa_normal
         FROM operator_costs LIMIT 1`
    );
    const c = costsQ.rows[0] || {};
    const rateMap = {
      USA_NORMAL:        Number(c.usa_normal)        || 45,
      USA_EXPRESS:       Number(c.usa_express)       || 55,
      USA_TECH_PREMIUM:  Number(c.usa_tech_premium)  || 75,
      CHINA_NORMAL:      Number(c.china_normal)      || 58,
      CHINA_EXPRESS:     Number(c.china_express)     || 68,
      EUROPA_NORMAL:     Number(c.europa_normal)     || 58,
    };
    const rate = rateMap[`${origin}_${service}`] || rateMap[`${origin}_NORMAL`] || 50;

    // Cálculo (aplica mínimo 1kg facturable)
    const MIN_BILLABLE = 1;
    const billable_kg = Math.max(weight_kg, MIN_BILLABLE);
    const subtotal = billable_kg * rate;

    // Cupón
    let discount = 0;
    let coupon_info = null;
    if (coupon) {
      const cQ = await db.query(`SELECT * FROM coupons WHERE LOWER(code)=LOWER($1) AND active=true`, [coupon]);
      const cp = cQ.rows[0];
      if (cp && (!cp.expires_at || new Date(cp.expires_at) > new Date()) && (!cp.max_uses || cp.used_count < cp.max_uses)) {
        const lane = `${origin.toLowerCase()}_${service.toLowerCase()}`;
        const ok = cp.applies_to === "all" || cp.applies_to === origin.toLowerCase() || cp.applies_to === service.toLowerCase() || cp.applies_to === lane;
        if (ok && billable_kg >= Number(cp.min_kg || 0)) {
          if (cp.discount_pct) discount = subtotal * Number(cp.discount_pct) / 100;
          else if (cp.discount_usd) discount = Math.min(Number(cp.discount_usd), subtotal);
          coupon_info = { code: cp.code, description: cp.description, discount_pct: cp.discount_pct, discount_usd: cp.discount_usd };
        }
      }
    }

    const total = Math.max(0, subtotal - discount);
    const eta = service === "EXPRESS"
      ? (origin === "USA" ? "72 hs hábiles" : "~7 días hábiles")
      : (origin === "USA" ? "7-10 días hábiles" : origin === "EUROPA" ? "18-20 días" : "~18 días");

    // Scrap del producto en paralelo (no bloquea cálculo si falla)
    const product = await scrapProductMeta(url).catch(() => null);

    res.json({
      ok: true,
      detected: { origin, service, line_active: lineActive },
      input:    { url, weight_kg, billable_kg },
      rate_usd_per_kg: rate,
      subtotal_usd: Number(subtotal.toFixed(2)),
      discount_usd: Number(discount.toFixed(2)),
      total_usd:    Number(total.toFixed(2)),
      eta,
      coupon: coupon_info,
      product, // { title, description, image, price, currency } o null
      warning: !lineActive ? `La línea ${origin} ${service} está pausada momentáneamente. Igual te dejo la cotización para cuando vuelva.` : null,
    });
  } catch (e) {
    console.error("[/api/quote/estimate-link]", e.message);
    res.status(500).json({ error: "Error calculando" });
  }
});

// ── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
// GET /api/announcements — listado (auth requerida; clientes ven solo activos)
app.get("/api/announcements", authRequired, async (req, res) => {
  try {
    const isStaff = req.user.role === "operator" || req.user.role === "admin";
    const showAll = isStaff && req.query.all === "1";
    let q;
    if (showAll) {
      q = await db.query(
        `SELECT id, title, body, category, emoji, accent, link_url, link_label,
                pinned, active, starts_at, expires_at, created_at
           FROM announcements
          ORDER BY pinned DESC, starts_at DESC, id DESC
          LIMIT 100`
      );
    } else {
      q = await db.query(
        `SELECT id, title, body, category, emoji, accent, link_url, link_label,
                pinned, starts_at, expires_at, created_at
           FROM announcements
          WHERE active = TRUE
            AND starts_at <= NOW()
            AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY pinned DESC, starts_at DESC, id DESC
          LIMIT 30`
      );
    }
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, announcements: q.rows });
  } catch (e) {
    console.error("[GET /api/announcements]", e.message);
    res.status(500).json({ error: "Error al cargar anuncios" });
  }
});

// POST /api/announcements — staff
app.post("/api/announcements", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const schema = z.object({
      title:      z.string().min(1).max(140),
      body:       z.string().max(2000).optional().nullable(),
      category:   z.enum(["general","urgente","linea","feriado","tip","novedad"]).optional(),
      emoji:      z.string().max(8).optional().nullable(),
      accent:     z.string().max(20).optional().nullable(),
      link_url:   z.string().url().optional().nullable(),
      link_label: z.string().max(40).optional().nullable(),
      pinned:     z.boolean().optional(),
      expires_at: z.string().optional().nullable(),
      notify:     z.boolean().optional(),  // si true, dispara notificaciones a todos
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });
    const d = p.data;
    // Sanitizar inputs user-generated antes de guardar
    const safeTitle = sanitizeText(d.title, 140);
    const safeBody  = d.body ? sanitizeText(d.body, 2000) : null;
    const safeEmoji = d.emoji ? sanitizeText(d.emoji, 8) : null;
    const safeLinkLabel = d.link_label ? sanitizeText(d.link_label, 40) : null;
    if (!safeTitle) return res.status(400).json({ error: "Título inválido" });
    const r = await db.query(
      `INSERT INTO announcements
        (title, body, category, emoji, accent, link_url, link_label, pinned, expires_at, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *`,
      [safeTitle, safeBody, d.category || "general", safeEmoji,
       d.accent || "#f5e03a", d.link_url || null, safeLinkLabel,
       !!d.pinned, d.expires_at || null, req.user.id]
    );
    const created = r.rows[0];

    // Fan-out a notifications de todos los usuarios (default: true)
    let notifiedCount = 0;
    if (d.notify !== false) {
      try {
        const fan = await db.query(
          `INSERT INTO notifications (user_id, type, title, body, link)
             SELECT id, $1, $2, $3, $4 FROM users
            RETURNING id`,
          [`ann_${created.category}`, created.title, created.body || "", `/inicio?ann=${created.id}`]
        );
        notifiedCount = fan.rowCount || 0;
      } catch (e) {
        console.error("[announcement fan-out]", e.message);
      }
    }
    res.json({ ok: true, announcement: created, notified: notifiedCount });
  } catch (e) {
    console.error("[POST /api/announcements]", e.message);
    res.status(500).json({ error: "Error al crear" });
  }
});

// PATCH /api/announcements/:id — staff (toggle active/pinned o editar)
app.patch("/api/announcements/:id", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const schema = z.object({
      title:      z.string().min(1).max(140).optional(),
      body:       z.string().max(2000).optional().nullable(),
      category:   z.enum(["general","urgente","linea","feriado","tip","novedad"]).optional(),
      emoji:      z.string().max(8).optional().nullable(),
      accent:     z.string().max(20).optional().nullable(),
      link_url:   z.string().url().optional().nullable(),
      link_label: z.string().max(40).optional().nullable(),
      pinned:     z.boolean().optional(),
      active:     z.boolean().optional(),
      expires_at: z.string().optional().nullable(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });
    const d = p.data;
    // Sanitizar campos de texto antes de guardar
    if (d.title       !== undefined) d.title       = sanitizeText(d.title, 140);
    if (d.body        !== undefined && d.body !== null) d.body = sanitizeText(d.body, 2000);
    if (d.emoji       !== undefined && d.emoji !== null) d.emoji = sanitizeText(d.emoji, 8);
    if (d.link_label  !== undefined && d.link_label !== null) d.link_label = sanitizeText(d.link_label, 40);
    const fields = [];
    const params = [];
    let i = 1;
    // Whitelist estricta de columnas — NO usa keys del input
    for (const k of ["title","body","category","emoji","accent","link_url","link_label","pinned","active","expires_at"]) {
      if (d[k] !== undefined) { fields.push(`${k}=$${i++}`); params.push(d[k]); }
    }
    if (!fields.length) return res.json({ ok: true, noop: true });
    params.push(id);
    const r = await db.query(
      `UPDATE announcements SET ${fields.join(", ")} WHERE id=$${i} RETURNING *`,
      params
    );
    if (!r.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, announcement: r.rows[0] });
  } catch (e) {
    console.error("[PATCH /api/announcements/:id]", e.message);
    res.status(500).json({ error: "Error al actualizar" });
  }
});

// DELETE /api/announcements/:id — staff
app.delete("/api/announcements/:id", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    await db.query(`DELETE FROM announcements WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/announcements/:id]", e.message);
    res.status(500).json({ error: "Error al eliminar" });
  }
});

// ── PRESENCE / FRIENDS ───────────────────────────────────────────────────────
// Heartbeat: marca al user como activo.
app.post("/api/presence/ping", authRequired, async (req, res) => {
  try {
    await db.query(`UPDATE users SET last_seen_at=NOW() WHERE id=$1`, [req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("[/api/presence/ping]", e.message);
    res.json({ ok: false });
  }
});

// Lista de "amigos": combina user_follows (sigo o me siguen) + chat_friendships aceptadas.
app.get("/api/friends", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = await db.query(
      `WITH related_ids AS (
         SELECT following_id AS other_id FROM user_follows WHERE follower_id = $1
         UNION
         SELECT follower_id  AS other_id FROM user_follows WHERE following_id = $1
         UNION
         SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END AS other_id
           FROM chat_friendships
          WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'
       )
       SELECT u.id, u.name, u.username, u.last_seen_at, u.role,
              up.avatar_url, up.avatar_key, up.name_color, up.name_glow_color,
              up.name_glow, up.name_grad_from, up.name_grad_to,
              EXISTS(
                SELECT 1 FROM user_follows
                 WHERE follower_id = $1 AND following_id = u.id
              ) AS i_follow,
              EXISTS(
                SELECT 1 FROM user_follows
                 WHERE follower_id = u.id AND following_id = $1
              ) AS follows_me,
              EXISTS(
                SELECT 1 FROM chat_friendships
                 WHERE ((user_id = $1 AND friend_id = u.id) OR (user_id = u.id AND friend_id = $1))
                   AND status = 'accepted'
              ) AS chat_friend
         FROM related_ids ri
         JOIN users u ON u.id = ri.other_id
         LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE u.id <> $1
        ORDER BY (u.last_seen_at > NOW() - INTERVAL '2 minutes') DESC NULLS LAST,
                 u.last_seen_at DESC NULLS LAST,
                 u.name ASC
        LIMIT 100`,
      [userId]
    );
    const now = Date.now();
    const friends = q.rows.map(r => {
      const seenMs = r.last_seen_at ? new Date(r.last_seen_at).getTime() : 0;
      const isOnline = seenMs > 0 && (now - seenMs) < 2 * 60 * 1000;
      return {
        ...r,
        is_online: isOnline,
        is_mutual: !!(r.i_follow && r.follows_me) || !!r.chat_friend,
      };
    });
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      friends,
      online: friends.filter(f => f.is_online).length,
      total: friends.length,
    });
  } catch (e) {
    console.error("[/api/friends]", e.message);
    res.status(500).json({ error: "Error al cargar amigos" });
  }
});

app.post("/auth/login", authLimiter, loginSlowDown, noStore, async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
      remember: z.boolean().optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    const { email, password } = p.data;

    const u = await db.query(
      "SELECT id, email, name, role, client_number, password_hash, email_verified, scopes FROM users WHERE email=$1",
      [email.toLowerCase()]
    );

    const user = u.rows[0];
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

    if (user.role === "client" && !user.email_verified) {
      return res.status(403).json({
        error: "Tenés que verificar tu email para entrar. Revisá tu bandeja.",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email,
      });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    // Mision login diario
    checkMissions(user.id, 'login').catch(()=>{});

    // Detectar si el user todavía no tiene biometría activada (para que el frontend
    // pueda ofrecer el modal de activación post-login). NO bloquea ni cambia auth.
    let promptBiometricSetup = false;
    try {
      const hasCredsQ = await db.query(
        `SELECT 1 FROM webauthn_credentials WHERE user_id=$1 AND revoked_at IS NULL LIMIT 1`,
        [user.id]
      );
      promptBiometricSetup = hasCredsQ.rows.length === 0;
    } catch (e) {
      // Si la tabla no existe (deploy parcial) o hay error, no romper login. Default false.
      console.warn("[AUTH login] prompt_biometric_setup query failed:", e.message);
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        client_number: user.client_number,
        scopes: user.scopes || null,
      },
      prompt_biometric_setup: promptBiometricSetup,
    });
  } catch (e) {
    console.error("LOGIN ERROR", e);
    res.status(500).json({ error: "Error interno" });
  }
});

app.get("/auth/me", authRequired, noStore, async (req, res) => {
  try {
    const u = await db.query(
      "SELECT id, email, name, role, client_number, username, phone, scopes FROM users WHERE id=$1",
      [req.user.id]
    );
    const user = u.rows[0];
    if (!user) return res.status(404).json({ error: "Usuario no existe" });
    res.json({ user });
  } catch (e) {
    console.error("ME ERROR", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// ── POST /auth/setup-profile — completa username + phone (onboarding obligatorio) ──
app.post("/auth/setup-profile", authRequired, noStore, async (req, res) => {
  try {
    const schema = z.object({
      username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).optional(),
      phone:    z.string().min(8).max(20).optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos. Username solo letras/números/_, min 3" });
    const { username, phone } = p.data;
    const updates = [];
    const params = [];
    let i = 1;
    if (username) {
      // Doble validación: regex (zod) + sanitize por defensa en profundidad
      const safeU = sanitizeText(username, 30).toLowerCase();
      if (!/^[a-z0-9_]{3,30}$/.test(safeU)) return res.status(400).json({ error: "Username inválido" });
      // Validar único
      const dup = await db.query(`SELECT id FROM users WHERE LOWER(username)=LOWER($1) AND id<>$2`, [safeU, req.user.id]);
      if (dup.rows[0]) return res.status(409).json({ error: "Ese username ya está en uso" });
      updates.push(`username=$${i++}`); params.push(safeU);
    }
    if (phone) {
      const cleanPhone = String(phone).replace(/[^\d+]/g, "").slice(0, 20);
      if (cleanPhone.length < 8) return res.status(400).json({ error: "Teléfono inválido" });
      updates.push(`phone=$${i++}`); params.push(cleanPhone);
    }
    if (!updates.length) return res.status(400).json({ error: "Nada para actualizar" });
    params.push(req.user.id);
    // updates contiene SOLO keys hardcoded ('username','phone') — no inyectables
    await db.query(`UPDATE users SET ${updates.join(", ")} WHERE id=$${i}`, params);
    const u = await db.query("SELECT id, email, name, role, client_number, username, phone FROM users WHERE id=$1", [req.user.id]);
    res.json({ ok: true, user: u.rows[0] });
  } catch (e) {
    console.error("[setup-profile]", e.message);
    res.status(500).json({ error: "Error guardando datos" });
  }
});

// ==================== PASSWORD RESET ====================

function isEmail(x) {
  return typeof x === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
}

function makeResetToken() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

async function hashToken(token) {
  return bcrypt.hash(token, 10);
}

async function compareToken(token, hash) {
  return bcrypt.compare(token, hash);
}

app.post("/auth/forgot-password", forgotLimiter, async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Email inválido" });

    const email = p.data.email.toLowerCase();
    const okResponse = { ok: true, message: "Si el email existe, te enviamos un link." };

    const u = await db.query("SELECT id, email, name FROM users WHERE email=$1", [email]);
    const user = u.rows[0];
    if (!user) return res.json(okResponse);

    const rawToken = makeResetToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at, used_at, created_at)
       VALUES ($1,$2,$3,NULL,NOW())`,
      [user.id, tokenHash, expiresAt]
    );

    const base =
      process.env.APP_URL && String(process.env.APP_URL).trim()
        ? String(process.env.APP_URL).replace(/\/$/, "")
        : "http://localhost:5173";

    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Restablecer tu contraseña — Lemon's Portal",
        html: `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0b1020;">
<table width="100%" cellspacing="0" cellpadding="0" style="background:#0b1020;padding:40px 20px;">
  <tr><td align="center">
    <table width="480" cellspacing="0" cellpadding="0" style="width:480px;max-width:480px;">
      <tr><td style="padding-bottom:32px;text-align:center;">
        <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#ffd200,#ff8a00);display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px;">🍋</div>
        <div style="font-family:Arial,sans-serif;color:#ffd200;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Lemon's Portal</div>
      </td></tr>
      <tr><td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:20px;overflow:hidden;">
        <div style="padding:32px 32px 24px;background:linear-gradient(135deg,rgba(99,102,241,0.25),rgba(168,85,247,0.15));border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="font-family:Arial,sans-serif;color:#ffffff;font-size:22px;font-weight:900;margin-bottom:8px;">Restablecer contraseña</div>
          <div style="font-family:Arial,sans-serif;color:#94a3b8;font-size:14px;">Hola <b style="color:#e2e8f0;">${user.name || "usuario"}</b>, recibimos un pedido para cambiar tu contraseña.</div>
        </div>
        <div style="padding:28px 32px;">
          <p style="font-family:Arial,sans-serif;color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Hacé click en el botón para crear una nueva contraseña. Este link es válido por <b style="color:#ffd200;">30 minutos</b>.
          </p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,#ffd200,#ff8a00);color:#0b1020;text-decoration:none;font-family:Arial,sans-serif;font-weight:900;font-size:15px;">
              Restablecer contraseña
            </a>
          </div>
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 16px;margin-bottom:20px;">
            <div style="font-family:Arial,sans-serif;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">O copiá este link en tu navegador</div>
            <div style="font-family:monospace;color:#94a3b8;font-size:11px;word-break:break-all;">${resetUrl}</div>
          </div>
          <p style="font-family:Arial,sans-serif;color:#64748b;font-size:12px;margin:0;line-height:1.6;">
            Si no solicitaste este cambio, podés ignorar este mensaje. Tu contraseña no cambiará.
          </p>
        </div>
      </td></tr>
      <tr><td style="padding:20px 0 0;text-align:center;font-family:Arial,sans-serif;color:#334155;font-size:12px;">
        © ${new Date().getFullYear()} Lemon's Portal. Todos los derechos reservados.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
      });
    } catch (e) {
      console.log("[MAIL] forgot-password falló (no rompe flujo):", e?.message || e);
    }

    return res.json(okResponse);
  } catch (e) {
    console.error("FORGOT PASSWORD ERROR", e);
    res.status(500).json({ error: "Error interno" });
  }
});

app.post("/auth/resend-verification", authLimiter, async (req, res) => {
  const okResponse = { ok: true, message: "Si el email existe, te reenviamos el link." };
  try {
    const schema = z.object({ email: z.string().email() });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Email inválido" });

    const email = p.data.email.toLowerCase();

    const u = await db.query(
      "SELECT id, name, email, email_verified FROM users WHERE LOWER(email)=LOWER($1)",
      [email]
    );
    const user = u.rows[0];
    if (!user) return res.json(okResponse);
    if (user.email_verified) return res.json(okResponse);

    const last = await db.query(
      `SELECT created_at FROM email_verifications
       WHERE user_id=$1 AND verified_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    if (last.rows[0]) {
      const ageMs = Date.now() - new Date(last.rows[0].created_at).getTime();
      if (ageMs < 5 * 60 * 1000) return res.json(okResponse);
    }

    await db.query(
      `UPDATE email_verifications SET expires_at=NOW()
       WHERE user_id=$1 AND verified_at IS NULL`,
      [user.id]
    );

    const token = require("crypto").randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(token, 10);
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
      [user.id, tokenHash, expires]
    );

    const base = process.env.APP_URL || "https://app.lemonsarg.com";
    const verifyUrl = `${base}/verify-email?token=${token}`;
    try {
      await sendEmail({
        to: user.email,
        subject: "Verificá tu cuenta — Lemon's Portal",
        html: buildVerifyEmailHtml(user.name || "", verifyUrl),
      });
    } catch (e) {
      console.log("[MAIL] resend-verification falló:", e?.message);
    }

    return res.json(okResponse);
  } catch (e) {
    console.error("RESEND VERIFICATION ERROR", e);
    return res.json(okResponse);
  }
});

app.post("/auth/reset-password", async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      token: z.string().min(10),
      new_password: z.string().min(6),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    const email = p.data.email.toLowerCase();
    const { token, new_password } = p.data;

    const u = await db.query("SELECT id FROM users WHERE email=$1", [email]);
    const user = u.rows[0];
    if (!user) return res.status(400).json({ error: "Token inválido o vencido" });

    const r = await db.query(
      `SELECT id, token_hash, expires_at, used_at
       FROM password_resets
       WHERE user_id=$1
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY id DESC
       LIMIT 10`,
      [user.id]
    );

    const rows = r.rows || [];
    let match = null;

    for (const row of rows) {
      const ok = await compareToken(token, row.token_hash);
      if (ok) {
        match = row;
        break;
      }
    }

    if (!match) return res.status(400).json({ error: "Token inválido o vencido" });

    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [password_hash, user.id]);
    await db.query("UPDATE password_resets SET used_at=NOW() WHERE id=$1", [match.id]);

    res.json({ ok: true });
  } catch (e) {
    console.error("RESET PASSWORD ERROR", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// ==================== OPERATOR / ADMIN ====================

app.post(
  "/operator/clients",
  authRequired,
  requireRole(["operator", "admin"]),
  async (req, res) => {
    try {
      const schema = z.object({
        client_number: z.number().int().min(0),
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["client", "operator", "admin"]).optional(),
      });

      const p = schema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

      const d = p.data;
      const password_hash = await bcrypt.hash(d.password, 10);
      const role = d.role || "client";

      const ins = await db.query(
        `INSERT INTO users (client_number, name, email, password_hash, role)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, client_number, name, email, role`,
        [d.client_number, d.name, d.email.toLowerCase(), password_hash, role]
      );

      res.json({ user: ins.rows[0] });
    } catch (e) {
      console.error("CREATE CLIENT ERROR", e);
      if (String(e?.message || "").includes("duplicate")) {
        return res.status(400).json({ error: "Email o client_number ya existe" });
      }
      res.status(500).json({ error: "Error interno" });
    }
  }
);

app.get(
  "/operator/clients",
  authRequired,
  requireRole(["operator", "admin"]),
  async (req, res) => {
    try {
      const n = Number(req.query.client_number);
      if (Number.isNaN(n)) return res.status(400).json({ error: "client_number inválido" });

      const q = await db.query(
        "SELECT id, client_number, name, email, role FROM users WHERE client_number=$1",
        [n]
      );

      const user = q.rows[0] || null;
      if (!user) return res.json({ user: null, rates: null, defaults: DEFAULT_RATES });

      let ratesRow = null;
      try {
        ratesRow = await getClientRatesByUserId(user.id);
      } catch (e) {
        console.error("GET CLIENT RATES ERROR", e);
        return res.status(500).json({
          error: "No se pudieron leer tarifas. Verificá que exista la tabla client_rates (migración pendiente).",
        });
      }

      const rates = ratesRow
        ? {
            usa_normal: ratesRow.usa_normal,
            usa_express: ratesRow.usa_express,
            china_normal: ratesRow.china_normal,
            china_express: ratesRow.china_express,
            europa_normal: ratesRow.europa_normal,
            updated_at: ratesRow.updated_at,
          }
        : null;

      res.json({ user, rates, defaults: DEFAULT_RATES });
    } catch (e) {
      console.error("GET CLIENT ERROR", e);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// ── GET /users — buscar usuario por client_number (para CoinsOperator) ──
app.get("/users", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const { client_number } = req.query;
    if (!client_number) return res.status(400).json({ error: "client_number requerido" });
    const q = await db.query(
      "SELECT id, client_number, name, email, role FROM users WHERE client_number=$1",
      [parseInt(client_number, 10)]
    );
    res.json({ users: q.rows });
  } catch (e) {
    res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /operator/clients/all — listar todos los clientes con stats ──
app.get("/operator/clients/all", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    // Agregar columna active si no existe
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE").catch(() => {});

    const q = await db.query(`
      SELECT
        u.id, u.client_number, u.name, u.email, u.role,
        COALESCE(u.active, true) AS active,
        COUNT(s.id)                              AS shipment_count,
        COALESCE(SUM(s.estimated_usd), 0)        AS total_billed,
        MAX(s.date_in)                           AS last_shipment
      FROM users u
      LEFT JOIN shipments s ON s.user_id = u.id
      WHERE u.role IN ('client', 'operator')
      GROUP BY u.id, u.client_number, u.name, u.email, u.role, u.active
      ORDER BY u.client_number ASC
    `);
    res.json({ clients: q.rows });
  } catch (e) {
    console.error("GET ALL CLIENTS ERROR", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// ── PATCH /operator/clients/:id — editar datos del cliente ──
app.patch("/operator/clients/:id", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const schema = z.object({
      name:          z.string().min(1).optional(),
      email:         z.string().email().optional(),
      client_number: z.number().int().min(0).optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    const fields = []; const vals = []; let pi = 1;
    if (p.data.name          !== undefined) { fields.push(`name=$${pi++}`);          vals.push(sanitizeText(p.data.name, 80)); }
    if (p.data.email         !== undefined) { fields.push(`email=$${pi++}`);         vals.push(p.data.email.toLowerCase()); }
    if (p.data.client_number !== undefined) { fields.push(`client_number=$${pi++}`); vals.push(p.data.client_number); }

    if (fields.length === 0) return res.status(400).json({ error: "Nada para actualizar" });
    vals.push(id);

    const r = await db.query(
      `UPDATE users SET ${fields.join(",")} WHERE id=$${pi} RETURNING id, client_number, name, email, role`,
      vals
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Cliente no existe" });
    res.json({ user: r.rows[0] });
  } catch (e) {
    console.error("PATCH CLIENT ERROR", e);
    if (String(e?.message || "").includes("duplicate"))
      return res.status(400).json({ error: "Email o número de cliente ya existe" });
    res.status(500).json({ error: "Error interno" });
  }
});

// ── PATCH /operator/clients/:id/password — resetear contraseña ──
app.patch("/operator/clients/:id/password", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const { new_password } = req.body;
    if (!new_password || String(new_password).length < 6)
      return res.status(400).json({ error: "Contraseña debe tener mínimo 6 caracteres" });

    const hash = await bcrypt.hash(new_password, 10);
    const r = await db.query(
      "UPDATE users SET password_hash=$1 WHERE id=$2 RETURNING id",
      [hash, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Cliente no existe" });
    res.json({ ok: true });
  } catch (e) {
    console.error("RESET PWD ERROR", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// ── PATCH /operator/clients/:id/status — suspender / activar ──
app.patch("/operator/clients/:id/status", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    const schema = z.object({ active: z.boolean() });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    // Asegurarse de que la columna exista (add IF NOT EXISTS en runtime si falta)
    try {
      await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE");
    } catch (_) { /* ya existe */ }

    const r = await db.query(
      "UPDATE users SET active=$1 WHERE id=$2 RETURNING id, active",
      [p.data.active, id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Cliente no existe" });
    res.json({ ok: true, active: r.rows[0].active });
  } catch (e) {
    console.error("TOGGLE STATUS ERROR", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// ── DELETE /operator/clients/:id — eliminar cliente ──
app.delete("/operator/clients/:id", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

    // No permitir eliminar admins ni operators
    const check = await db.query("SELECT role FROM users WHERE id=$1", [id]);
    if (!check.rows[0]) return res.status(404).json({ error: "Usuario no existe" });
    if (["admin", "operator"].includes(check.rows[0].role))
      return res.status(403).json({ error: "No se puede eliminar un admin u operador" });

    await db.query("DELETE FROM users WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE CLIENT ERROR", e);
    if (String(e?.message || "").includes("foreign key") || String(e?.message || "").includes("violates"))
      return res.status(400).json({ error: "No se puede eliminar: el cliente tiene envíos asociados. Suspendélo en su lugar." });
    res.status(500).json({ error: "Error interno" });
  }
});

app.put(
  "/operator/clients/:id/rates",
  authRequired,
  requireRole(["operator", "admin"]),
  async (req, res) => {
    try {
      const userId = Number(req.params.id);
      if (Number.isNaN(userId)) return res.status(400).json({ error: "ID inválido" });

      const schema = z.object({
        usa_normal:       z.number().min(0).nullable().optional(),
        usa_express:      z.number().min(0).nullable().optional(),
        usa_tech_premium: z.number().min(0).nullable().optional(),
        china_normal:     z.number().min(0).nullable().optional(),
        china_express:    z.number().min(0).nullable().optional(),
        europa_normal:    z.number().min(0).nullable().optional(),
      });

      const p = schema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

      const u = await db.query("SELECT id, role FROM users WHERE id=$1", [userId]);
      const user = u.rows[0];
      if (!user) return res.status(404).json({ error: "Cliente no existe" });

      let up;
      try {
        up = await db.query(
          `INSERT INTO client_rates (user_id, usa_normal, usa_express, usa_tech_premium, china_normal, china_express, europa_normal, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
           ON CONFLICT (user_id)
           DO UPDATE SET
             usa_normal       = EXCLUDED.usa_normal,
             usa_express      = EXCLUDED.usa_express,
             usa_tech_premium = EXCLUDED.usa_tech_premium,
             china_normal     = EXCLUDED.china_normal,
             china_express    = EXCLUDED.china_express,
             europa_normal    = EXCLUDED.europa_normal,
             updated_at       = NOW()
           RETURNING user_id, usa_normal, usa_express, usa_tech_premium, china_normal, china_express, europa_normal, updated_at`,
          [
            userId,
            p.data.usa_normal       ?? null,
            p.data.usa_express      ?? null,
            p.data.usa_tech_premium ?? null,
            p.data.china_normal     ?? null,
            p.data.china_express    ?? null,
            p.data.europa_normal    ?? null,
          ]
        );
      } catch (e) {
        console.error("UPSERT CLIENT RATES ERROR", e);
        return res.status(500).json({
          error: "No se pudieron guardar tarifas. Verificá que exista la tabla client_rates (migración pendiente).",
        });
      }

      res.json({
        rates: {
          usa_normal:       up.rows[0].usa_normal,
          usa_express:      up.rows[0].usa_express,
          usa_tech_premium: up.rows[0].usa_tech_premium,
          china_normal:     up.rows[0].china_normal,
          china_express:    up.rows[0].china_express,
          europa_normal:    up.rows[0].europa_normal,
          updated_at: up.rows[0].updated_at,
        },
        defaults: DEFAULT_RATES,
      });
    } catch (e) {
      console.error("PUT CLIENT RATES ERROR", e);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

app.post(
  "/operator/shipments",
  authRequired,
  requireRole(["operator", "admin"]),
  async (req, res) => {
    try {
      const schema = z.object({
        client_number: z.number().int().min(0),
        package_code: z.string().min(1),
        description: z.string().min(1),
        box_code: z.string().nullable().optional(),
        tracking: z.string().nullable().optional(),
        weight_kg: z.number().min(0),
        status: z.string().min(1),
        origin: z.enum(["USA", "CHINA", "EUROPA"]).optional(),
        service: z.enum(["NORMAL", "EXPRESS", "TECH_PREMIUM"]).optional(),
        rate_usd_per_kg: z.number().min(0).nullable().optional(),
        estimated_usd: z.number().min(0).nullable().optional(),
        charge_real_weight: z.boolean().optional(), // si true y peso <1kg, cobra el peso real
      });

      const p = schema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

      const d = p.data;

      const u = await db.query(
        "SELECT id, email, name, client_number FROM users WHERE client_number=$1",
        [d.client_number]
      );
      const user = u.rows[0];
      if (!user) return res.status(404).json({ error: "Cliente no existe" });

      const calc = await computeRateAndEstimatedServer({
        userId: user.id,
        originRaw: d.origin ?? null,
        serviceRaw: d.service ?? null,
        weight_kg: d.weight_kg,
        rateOverride: d.rate_usd_per_kg ?? null,
        chargeRealWeight: d.charge_real_weight ?? false,
      });

      // Si el operador puso tarifa 0 o manual, guardar cost_usd=0 para no distorsionar el dashboard
      const isZeroCost = (d.rate_usd_per_kg !== null && d.rate_usd_per_kg !== undefined && Number(d.rate_usd_per_kg) === 0) ||
                         (calc.rate_usd_per_kg !== null && Number(calc.rate_usd_per_kg) === 0);

      const ins = await db.query(
        `INSERT INTO shipments
         (user_id, code, description, box_code, tracking, weight_kg, status, date_in, origin, service, rate_usd_per_kg, estimated_usd, charge_real_weight, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, NOW(), $8, $9, $10, $11, $12, NOW())
         RETURNING *`,
        [
          user.id,
          d.package_code,
          d.description,
          d.box_code ?? null,
          d.tracking ?? null,
          d.weight_kg,
          d.status,
          calc.origin,
          calc.service,
          calc.rate_usd_per_kg,
          calc.estimated_usd,
          d.charge_real_weight ?? false,
        ]
      );

      await db.query(
        `INSERT INTO shipment_events (shipment_id, old_status, new_status) VALUES ($1,$2,$3)`,
        [ins.rows[0].id, null, d.status]
      );

      try {
        const created = ins.rows[0];
        const code = created?.code || d.package_code || created?.id;
        const ctaUrl =
          process.env.APP_URL && String(process.env.APP_URL).trim()
            ? `${String(process.env.APP_URL).replace(/\/$/, "")}/client/shipments`
            : "";

        const html = shipmentUpdateEmailHtml({
          brand: "LEMON'S PORTAL",
          clientName: user.name || "",
          clientNumber: user.client_number || "",
          code,
          oldStatus: "Creado",
          newStatus: created.status || d.status || "Recibido en depósito",
          origin: created.origin || calc.origin || "",
          service: created.service || calc.service || "",
          weightKg: created.weight_kg,
          rateUsdKg: created.rate_usd_per_kg,
          estimatedUsd: created.estimated_usd,
          tracking: created.tracking || "",
          boxCode: created.box_code || "",
          ctaUrl,
        });

        await sendEmail({ to: user.email, subject: `Envío creado #${code}`, html });
      } catch (e) {
        console.log("[MAIL] Falló envío creación (no rompemos flujo):", e?.message || e);
      }

      try {
        const freshShipment = await getShipmentWithClientById(ins.rows[0].id);
        if (freshShipment) {
          await notifyShipmentStatusWhatsapp({
            shipment: freshShipment,
            oldStatus: "Creado",
            newStatus: freshShipment.status || "Recibido en depósito",
          });
        }
      } catch (e) {
        console.log("[WA] Falló aviso creación (no rompemos flujo):", e?.message || e);
      }

      res.json({ shipment: ins.rows[0] });
    } catch (e) {
      console.error("CREATE SHIPMENT ERROR", e);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// ── DELETE /operator/shipments/:id ──────────────────────────────────────────────
app.delete("/operator/shipments/:id", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });
    // Borrar dependencias primero
    await db.query("DELETE FROM payment_items WHERE shipment_id=$1", [id]);
    await db.query("DELETE FROM shipment_events WHERE shipment_id=$1", [id]);
    await db.query("DELETE FROM shipments WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch(e) {
    console.error("DELETE SHIPMENT ERROR", e);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /operator/shipments/by-tracking ──────────────────────────────────────
app.get("/operator/shipments/by-tracking", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const tracking = String(req.query.tracking || "").trim();
    if (!tracking) return res.status(400).json({ error: "tracking required" });
    const q = await db.query(`
      SELECT s.*, u.name AS client_name, u.client_number, u.phone AS client_phone
      FROM shipments s JOIN users u ON u.id = s.user_id
      WHERE s.tracking ILIKE $1 OR s.box_code ILIKE $1
      ORDER BY s.id DESC LIMIT 1
    `, [`%${tracking}%`]);
    res.json({ shipment: q.rows[0] || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ✅ GET /operator/shipments — con filtros avanzados (fecha, estado, origen, servicio)
app.get(
  "/operator/shipments",
  authRequired,
  requireRole(["operator", "admin"]),
  async (req, res) => {
    try {
      const search        = (req.query.search        || "").trim();
      const clientNumber  = (req.query.client_number || "").trim();
      const dateFrom      = (req.query.date_from     || "").trim();
      const dateTo        = (req.query.date_to       || "").trim();
      const statusFilter  = (req.query.status        || "").trim();
      const originFilter  = (req.query.origin        || "").trim();
      const serviceFilter = (req.query.service       || "").trim();

      const params = [];
      let where = "WHERE 1=1";

      if (clientNumber !== "") {
        const n = Number(clientNumber);
        if (!Number.isNaN(n)) {
          params.push(n);
          where += ` AND u.client_number = $${params.length}`;
        }
      }

      if (search) {
        params.push(`%${search}%`);
        const p1 = params.length;
        params.push(`%${search}%`);
        const p2 = params.length;
        params.push(`%${search}%`);
        const p3 = params.length;
        where += ` AND (sh.code ILIKE $${p1} OR sh.description ILIKE $${p2} OR sh.tracking ILIKE $${p3})`;
      }

      if (dateFrom) {
        params.push(dateFrom);
        where += ` AND sh.date_in >= $${params.length}`;
      }
      if (dateTo) {
        params.push(dateTo);
        where += ` AND sh.date_in <= $${params.length}::date + INTERVAL '1 day'`;
      }
      if (statusFilter) {
        params.push(statusFilter);
        where += ` AND sh.status = $${params.length}`;
      }
      if (originFilter) {
        params.push(originFilter);
        where += ` AND sh.origin = $${params.length}`;
      }
      if (serviceFilter) {
        params.push(serviceFilter);
        where += ` AND sh.service = $${params.length}`;
      }

      const q = await db.query(
        `SELECT sh.*, u.client_number, u.name, u.email
         FROM shipments sh
         JOIN users u ON u.id = sh.user_id
         ${where}
         ORDER BY sh.id DESC
         LIMIT 500`,
        params
      );

      res.json({ rows: q.rows });
    } catch (e) {
      console.error("OP SHIPMENTS ERROR", e);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

app.patch(
  "/operator/shipments/:id",
  authRequired,
  requireRole(["operator", "admin"]),
  async (req, res) => {
    try {
      const schema = z.object({
        package_code: z.string().min(1),
        description: z.string().min(1),
        box_code: z.string().nullable().optional(),
        tracking: z.string().nullable().optional(),
        weight_kg: z.number().min(0),
        origin: z.string().nullable().optional(),
        service: z.string().nullable().optional(),
        rate_usd_per_kg: z.number().nullable().optional(),
        estimated_usd: z.number().nullable().optional(),
      });

      const p = schema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const cur = await db.query(`SELECT id, user_id FROM shipments WHERE id=$1`, [id]);
      const current = cur.rows[0];
      if (!current) return res.status(404).json({ error: "Envío no existe" });

      const calc = await computeRateAndEstimatedServer({
        userId: current.user_id,
        originRaw: p.data.origin ?? null,
        serviceRaw: p.data.service ?? null,
        weight_kg: p.data.weight_kg,
        rateOverride: p.data.rate_usd_per_kg ?? null,
      });

      const upd = await db.query(
        `UPDATE shipments
         SET code=$1, description=$2, box_code=$3, tracking=$4, weight_kg=$5,
             origin=$6, service=$7, rate_usd_per_kg=$8, estimated_usd=$9, updated_at=NOW()
         WHERE id=$10
         RETURNING *`,
        [
          p.data.package_code,
          p.data.description,
          p.data.box_code ?? null,
          p.data.tracking ?? null,
          p.data.weight_kg,
          calc.origin,
          calc.service,
          calc.rate_usd_per_kg,
          calc.estimated_usd,
          id,
        ]
      );

      res.json({ shipment: upd.rows[0] });
    } catch (e) {
      console.error("PATCH SHIPMENT ERROR", e);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

app.patch(
  "/operator/shipments/:id/status",
  authRequired,
  requireRole(["operator", "admin"]),
  async (req, res) => {
    try {
      const schema = z.object({ status: z.string().min(1) });
      const p = schema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

      const shipmentId = Number(req.params.id);
      if (Number.isNaN(shipmentId)) return res.status(400).json({ error: "ID inválido" });

      const s = await db.query(
        `SELECT sh.*, u.email, u.name, u.client_number, u.phone AS client_phone
         FROM shipments sh
         JOIN users u ON u.id = sh.user_id
         WHERE sh.id=$1`,
        [shipmentId]
      );

      const current = s.rows[0];
      if (!current) return res.status(404).json({ error: "Envío no existe" });

      const oldStatus = current.status;
      const newStatus = p.data.status;

      if (oldStatus === newStatus) {
        return res.json({ shipment: current });
      }

      const upd = await db.query(
        `UPDATE shipments
         SET status=$1, updated_at=NOW(),
             delivered_at = CASE WHEN $1='Entregado' THEN NOW() ELSE delivered_at END
         WHERE id=$2
         RETURNING *`,
        [newStatus, shipmentId]
      );

      await db.query(
        `INSERT INTO shipment_events (shipment_id, old_status, new_status) VALUES ($1,$2,$3)`,
        [shipmentId, oldStatus, newStatus]
      );

      // ✅ mail pro update
      try {
        const updated = upd.rows[0] || current;
        const code = updated?.code || current.code || shipmentId;
        const ctaUrl =
          process.env.APP_URL && String(process.env.APP_URL).trim()
            ? `${String(process.env.APP_URL).replace(/\/$/, "")}/client/shipments`
            : "";

        const html = shipmentUpdateEmailHtml({
          brand: "LEMON'S PORTAL",
          clientName: current.name || "",
          clientNumber: current.client_number || "",
          code,
          oldStatus,
          newStatus,
          origin: updated.origin || current.origin || "",
          service: updated.service || current.service || "",
          weightKg: updated.weight_kg ?? current.weight_kg ?? null,
          rateUsdKg: updated.rate_usd_per_kg ?? current.rate_usd_per_kg ?? null,
          estimatedUsd: updated.estimated_usd ?? current.estimated_usd ?? null,
          tracking: updated.tracking || current.tracking || "",
          boxCode: updated.box_code || current.box_code || "",
          ctaUrl,
        });

        await sendEmail({ to: current.email, subject: `Actualización de envío #${code}`, html });
      } catch (e) {
        console.log("[MAIL] Falló envío (no rompemos flujo):", e?.message || e);
      }

      try {
        const freshShipment = await getShipmentWithClientById(shipmentId);
        const waShipment = freshShipment || {
          ...updated,
          ...current,
          id: shipmentId,
          code: updated?.code || current?.code || shipmentId,
          tracking: updated?.tracking || current?.tracking || "",
          description: updated?.description || current?.description || "",
          origin: updated?.origin || current?.origin || "",
          service: updated?.service || current?.service || "",
          weight_kg: updated?.weight_kg ?? current?.weight_kg ?? null,
          estimated_usd: updated?.estimated_usd ?? current?.estimated_usd ?? null,
          client_phone: current?.client_phone || ""
        };

        const phoneToUse = (waShipment?.client_phone || current?.client_phone || "").replace(/\D/g, "");

        console.log("[MANUAL STATUS WA DEBUG]", {
          shipmentId,
          oldStatus,
          newStatus,
          phoneToUse,
          hasFresh: !!freshShipment
        });

        if (phoneToUse) {
          const waMessage = buildShipmentWhatsappMessage({
            shipment: { ...waShipment, client_phone: phoneToUse },
            oldStatus,
            newStatus,
          });

          await enqueueWhatsappToClient(phoneToUse, waMessage);
          console.log("[MANUAL STATUS WA ENQUEUED]", { shipmentId, phoneToUse });
        } else {
          console.log("[MANUAL STATUS WA SKIPPED] sin phone", { shipmentId });
        }
      } catch (e) {
        console.log("[WA] Falló aviso update manual (no rompemos flujo):", e?.message || e);
      }

      // CRM ownership: limpiar waiting_operator cuando operador cambia estado
      try {
        const crmPhone = (current?.client_phone || '').replace(/\D/g, '');
        if (crmPhone) {
          await db.query(
            `UPDATE wa_conversations SET needs_operator=FALSE, updated_at=NOW() WHERE phone=$1 AND mode='waiting_operator'`,
            [crmPhone]
          );
        }
      } catch (crmErr) {
        console.log('[CRM] Fallo ownership en status change:', crmErr?.message || crmErr);
      }

      // ══ AUTO LEMON COINS al entregar ══════════════════════════════
      if (newStatus === "Entregado") {
        try {
          const existQ = await db.query(
            `SELECT id FROM coin_transactions WHERE shipment_id=$1 AND type='earn' AND reason NOT LIKE '%primer envío%' LIMIT 1`,
            [shipmentId]
          );
          if (!existQ.rows[0]) {
            const shipFull = (await db.query(
              `SELECT s.*, u.first_shipment_bonus_given
               FROM shipments s JOIN users u ON u.id = s.user_id
               WHERE s.id=$1`, [shipmentId]
            )).rows[0];

            if (shipFull) {
              const kg        = parseFloat(shipFull.weight_kg     || 0);
              const usd       = parseFloat(shipFull.estimated_usd || 0);
              const coinsByKg = Math.floor(kg * 3);
              const coinsBig  = usd >= 500 ? 10 : 0;
              // Bonus primer envío (15 coins) NO se otorga automáticamente — el cliente lo reclama
              const total     = coinsByKg + coinsBig;

              if (total > 0) {
                const breakdown = [];
                if (coinsByKg > 0) breakdown.push(`${coinsByKg} por ${kg.toFixed(2)}kg`);
                if (coinsBig  > 0) breakdown.push(`${coinsBig} bonus envío grande`);

                await db.query(
                  `INSERT INTO lemon_coins (user_id, balance, total_earned)
                   VALUES ($1,0,0) ON CONFLICT (user_id) DO NOTHING`,
                  [shipFull.user_id]
                );
                await db.query(
                  `INSERT INTO coin_transactions (user_id, type, amount, reason, shipment_id)
                   VALUES ($1,'earn',$2,$3,$4)`,
                  [shipFull.user_id, total, `Envío completado — ${breakdown.join(", ")}`, shipmentId]
                );
                await db.query(
                  `UPDATE lemon_coins
                   SET balance=balance+$1, total_earned=total_earned+$1, updated_at=NOW()
                   WHERE user_id=$2`,
                  [total, shipFull.user_id]
                );
                console.log(`[COINS] +${total} coins → user ${shipFull.user_id} (envío ${shipmentId})`);
              }
            }
          }
        } catch (coinErr) {
          console.error("[COINS] Error otorgando coins:", coinErr.message);
        }
        // Misiones de envio entregado
        try {
          const shipForMission = await db.query(`SELECT user_id, weight_kg FROM shipments WHERE id=$1`, [shipmentId]);
          if (shipForMission.rows[0]) {
            await checkMissions(shipForMission.rows[0].user_id, 'shipment_delivered', {
              user_id: shipForMission.rows[0].user_id,
              weight_kg: shipForMission.rows[0].weight_kg
            });
          }
        } catch(me) { console.error('[MISSIONS] shipment_delivered error:', me.message); }

        // Bonus de referido al primer envío entregado
        try {
          const shipUserQ = await db.query(`SELECT user_id FROM shipments WHERE id=$1`, [shipmentId]);
          const referredId = shipUserQ.rows[0]?.user_id;
          if (referredId) {
            const refQ = await db.query(
              `SELECT * FROM referrals WHERE referred_id=$1 AND status='pending'`,
              [referredId]
            );
            const ref = refQ.rows[0];
            if (ref) {
              // Es el primer envío entregado de un referido → bonificar a ambos
              await db.query(`INSERT INTO lemon_coins (user_id,balance,total_earned) VALUES ($1,0,0) ON CONFLICT DO NOTHING`, [ref.referrer_id]);
              await db.query(`UPDATE lemon_coins SET balance=balance+$1, total_earned=total_earned+$1, updated_at=NOW() WHERE user_id=$2`, [ref.coins_referrer, ref.referrer_id]);
              await db.query(`INSERT INTO coin_transactions (user_id,type,amount,reason) VALUES ($1,'earn',$2,'Referido completó primer envío')`, [ref.referrer_id, ref.coins_referrer]);

              await db.query(`UPDATE lemon_coins SET balance=balance+$1, total_earned=total_earned+$1, updated_at=NOW() WHERE user_id=$2`, [ref.coins_referred, ref.referred_id]);
              await db.query(`INSERT INTO coin_transactions (user_id,type,amount,reason) VALUES ($1,'earn',$2,'Bonus de bienvenida (referido)')`, [ref.referred_id, ref.coins_referred]);

              await db.query(`UPDATE referrals SET status='rewarded', rewarded_at=NOW() WHERE id=$1`, [ref.id]);

              // Notificación al referrer
              await db.query(
                `INSERT INTO notifications (user_id, type, title, body, link)
                 VALUES ($1,'referral_reward','🎉 Tu referido completó su primer envío',$2,'/coins')`,
                [ref.referrer_id, `+${ref.coins_referrer} 🍋 LC acreditados a tu balance`]
              );
            }
          }
        } catch(re) { console.error('[REFERRAL] reward error:', re.message); }

        // Notificación in-app al cliente
        try {
          const shipForNotif = await db.query(`SELECT user_id, code FROM shipments WHERE id=$1`, [shipmentId]);
          if (shipForNotif.rows[0]) {
            await db.query(
              "INSERT INTO notifications(user_id, type, title, body, link) VALUES($1,$2,$3,$4,$5)",
              [shipForNotif.rows[0].user_id, "delivery", "📦 Envío entregado", `Tu carga #${shipForNotif.rows[0].code} fue entregada exitosamente.`, "/client/shipments"]
            );
          }
        } catch(ne) { console.error('[NOTIF] entrega error:', ne.message); }
      }
        // [REMOVED] Mensaje duplicado de entrega — ya lo maneja enqueueWhatsappToClient en línea 2510
      // ═════════════════════════════════════════════════════════════

      res.json({ shipment: upd.rows[0] });
    } catch (e) {
      console.error("PATCH STATUS ERROR", e);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// ==================== CLIENT ====================

app.get("/client/shipments", authRequired, async (req, res) => {
  try {
    const q = await db.query(
      `SELECT id, code, description, box_code, tracking, weight_kg, status, date_in,
              origin, service, rate_usd_per_kg, estimated_usd
       FROM shipments
       WHERE user_id=$1
       ORDER BY id DESC`,
      [req.user.id]
    );
    res.json({ rows: q.rows });
  } catch (e) {
    console.error("CLIENT SHIPMENTS ERROR", e);
    res.status(500).json({ error: "Error interno" });
  }
});

app.get("/shipments/:id/events", authRequired, async (req, res) => {
  try {
    const shipmentId = Number(req.params.id);
    if (Number.isNaN(shipmentId)) return res.status(400).json({ error: "ID inválido" });

    const sh = await db.query("SELECT id, user_id FROM shipments WHERE id=$1", [shipmentId]);
    const shipment = sh.rows[0];
    if (!shipment) return res.status(404).json({ error: "Envío no existe" });

    const role = req.user.role;
    const isOwner = req.user.id === shipment.user_id;
    const isStaff = role === "operator" || role === "admin";
    if (!isOwner && !isStaff) return res.status(403).json({ error: "No autorizado" });

    const ev = await db.query(
      `SELECT shipment_id, old_status, new_status, created_at
       FROM shipment_events
       WHERE shipment_id=$1
       ORDER BY created_at ASC`,
      [shipmentId]
    );

    res.json({ rows: ev.rows });
  } catch (e) {
    console.error("EVENTS ERROR", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// ── GET /operator/costs ──────────────────────────────────────────────────────
app.get("/operator/costs", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const costs = await getOperatorCosts();
    res.json({ costs, defaults: DEFAULT_OPERATOR_COSTS });
  } catch (err) {
    console.error("GET COSTS ERROR:", err);
    res.status(500).json({ error: "Error leyendo costos" });
  }
});

// ── PUT /operator/costs ──────────────────────────────────────────────────────
app.put("/operator/costs", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const schema = z.object({
      usa_normal:       z.number().min(0),
      usa_express:      z.number().min(0),
      usa_tech_premium: z.number().min(0),
      china_normal:     z.number().min(0),
      china_express:    z.number().min(0),
      europa_normal:    z.number().min(0),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    const d = p.data;
    await db.query(
      `INSERT INTO operator_costs (id, usa_normal, usa_express, usa_tech_premium, china_normal, china_express, europa_normal, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET
         usa_normal       = EXCLUDED.usa_normal,
         usa_express      = EXCLUDED.usa_express,
         usa_tech_premium = EXCLUDED.usa_tech_premium,
         china_normal     = EXCLUDED.china_normal,
         china_express    = EXCLUDED.china_express,
         europa_normal    = EXCLUDED.europa_normal,
         updated_at       = NOW()`,
      [d.usa_normal, d.usa_express, d.usa_tech_premium, d.china_normal, d.china_express, d.europa_normal]
    );
    res.json({ ok: true, costs: d });
  } catch (err) {
    console.error("PUT COSTS ERROR:", err);
    res.status(500).json({ error: "Error guardando costos" });
  }
});

// ── GET /operator/dashboard ──────────────────────────────────────────────────
app.get("/operator/dashboard", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const statsQ = await db.query(`
      SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE status='Recibido en depósito')            AS received,
        COUNT(*) FILTER (WHERE status='En preparación')                  AS prep,
        COUNT(*) FILTER (WHERE status='Despachado')                      AS sent,
        COUNT(*) FILTER (WHERE status='En tránsito')                     AS transit,
        COUNT(*) FILTER (WHERE status='Listo para entrega')              AS ready,
        COUNT(*) FILTER (WHERE status='Entregado')                       AS delivered,
        COALESCE(SUM(weight_kg), 0)                                      AS total_weight,
        COALESCE(SUM(estimated_usd), 0)                                  AS total_revenue,
        COALESCE(SUM(estimated_usd) FILTER (WHERE status='Entregado'),0) AS delivered_revenue,
        COUNT(DISTINCT user_id)                                           AS active_clients
      FROM shipments
    `);

    const byOriginQ = await db.query(`
      SELECT COALESCE(origin, 'Sin origen') AS origin, COUNT(*) AS count, COALESCE(SUM(weight_kg), 0) AS weight
      FROM shipments GROUP BY origin ORDER BY count DESC
    `);

    const byServiceQ = await db.query(`
      SELECT COALESCE(service, 'NORMAL') AS service, COUNT(*) AS count
      FROM shipments GROUP BY service ORDER BY count DESC
    `);

    const operatorCosts = await getOperatorCosts();
    const costsParams = [
      Number(operatorCosts.usa_normal)       || 0,
      Number(operatorCosts.usa_express)      || 0,
      Number(operatorCosts.usa_tech_premium) || 0,
      Number(operatorCosts.china_normal)     || 0,
      Number(operatorCosts.china_express)    || 0,
      Number(operatorCosts.europa_normal)    || 0,
    ];

    const byMonthQ = await db.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', date_in), 'YYYY-MM') AS month,
        COUNT(*) AS count,
        COALESCE(SUM(estimated_usd), 0) AS revenue,
        COALESCE(SUM(CASE WHEN COALESCE(rate_usd_per_kg,0) > 0 THEN weight_kg * CASE
          WHEN origin='USA'   AND service='NORMAL'       THEN $1::numeric
          WHEN origin='USA'   AND service='EXPRESS'      THEN $2::numeric
          WHEN origin='USA'   AND service='TECH_PREMIUM' THEN $3::numeric
          WHEN origin='CHINA' AND service='NORMAL'       THEN $4::numeric
          WHEN origin='CHINA' AND service='EXPRESS'      THEN $5::numeric
          WHEN origin='EUROPA'                            THEN $6::numeric
          ELSE 0 END ELSE 0 END), 0) AS cost,
        COALESCE(SUM(estimated_usd), 0) - COALESCE(SUM(CASE WHEN COALESCE(rate_usd_per_kg,0) > 0 THEN weight_kg * CASE
          WHEN origin='USA'   AND service='NORMAL'       THEN $1::numeric
          WHEN origin='USA'   AND service='EXPRESS'      THEN $2::numeric
          WHEN origin='USA'   AND service='TECH_PREMIUM' THEN $3::numeric
          WHEN origin='CHINA' AND service='NORMAL'       THEN $4::numeric
          WHEN origin='CHINA' AND service='EXPRESS'      THEN $5::numeric
          WHEN origin='EUROPA'                            THEN $6::numeric
          ELSE 0 END ELSE 0 END), 0) AS profit
      FROM shipments
      WHERE date_in >= NOW() - INTERVAL '8 months'
      GROUP BY DATE_TRUNC('month', date_in)
      ORDER BY DATE_TRUNC('month', date_in)
    `, costsParams);

    const byLaneQ = await db.query(`
      SELECT
        COALESCE(origin, '-') AS origin, COALESCE(service, '-') AS service,
        COUNT(*) AS count,
        COALESCE(SUM(estimated_usd), 0) AS revenue,
        COALESCE(SUM(CASE WHEN COALESCE(rate_usd_per_kg,0) > 0 THEN weight_kg * CASE
          WHEN origin='USA'   AND service='NORMAL'       THEN $1::numeric
          WHEN origin='USA'   AND service='EXPRESS'      THEN $2::numeric
          WHEN origin='USA'   AND service='TECH_PREMIUM' THEN $3::numeric
          WHEN origin='CHINA' AND service='NORMAL'       THEN $4::numeric
          WHEN origin='CHINA' AND service='EXPRESS'      THEN $5::numeric
          WHEN origin='EUROPA'                            THEN $6::numeric
          ELSE 0 END ELSE 0 END), 0) AS cost,
        COALESCE(SUM(estimated_usd), 0) - COALESCE(SUM(CASE WHEN COALESCE(rate_usd_per_kg,0) > 0 THEN weight_kg * CASE
          WHEN origin='USA'   AND service='NORMAL'       THEN $1::numeric
          WHEN origin='USA'   AND service='EXPRESS'      THEN $2::numeric
          WHEN origin='USA'   AND service='TECH_PREMIUM' THEN $3::numeric
          WHEN origin='CHINA' AND service='NORMAL'       THEN $4::numeric
          WHEN origin='CHINA' AND service='EXPRESS'      THEN $5::numeric
          WHEN origin='EUROPA'                            THEN $6::numeric
          ELSE 0 END ELSE 0 END), 0) AS profit
      FROM shipments GROUP BY origin, service ORDER BY revenue DESC
    `, costsParams);

    const topClientsQ = await db.query(`
      SELECT u.client_number, u.name, COUNT(s.id) AS shipments, COALESCE(SUM(s.estimated_usd),0) AS revenue
      FROM shipments s JOIN users u ON u.id = s.user_id
      GROUP BY u.id, u.client_number, u.name ORDER BY shipments DESC LIMIT 5
    `);

    const recentQ = await db.query(`
      SELECT s.id, s.code, s.description, s.status, s.date_in, s.origin, s.estimated_usd,
             u.client_number, u.name AS client_name
      FROM shipments s JOIN users u ON u.id = s.user_id
      ORDER BY s.date_in DESC LIMIT 5
    `);

    res.json({
      stats:          statsQ.rows[0],
      by_origin:      byOriginQ.rows,
      by_service:     byServiceQ.rows,
      by_month:       byMonthQ.rows,
      by_lane:        byLaneQ.rows,
      top_clients:    topClientsQ.rows,
      recent:         recentQ.rows,
      operator_costs: operatorCosts,
    });
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).json({ error: "Error dashboard" });
  }
});

// ════════════════════════════════════════════════════════════════════
// MÓDULO CAJA — pagos y gastos
// ════════════════════════════════════════════════════════════════════

const PAYMENT_METHODS = ["USD_CASH", "USDT", "ARS_TRANSFER", "ARS_CASH"];
const EXPENSE_CATEGORIES = [
  "Alquiler / Oficina", "Sueldos / Personal", "Logística / Flete",
  "Marketing", "Servicios", "Otros"
];

app.get("/cash/pending/:clientNumber", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const cn = parseInt(req.params.clientNumber, 10);
    if (!Number.isFinite(cn)) return res.status(400).json({ error: "Número de cliente inválido" });

    const uq = await db.query(
      "SELECT id, client_number, name, email FROM users WHERE client_number=$1", [cn]
    );
    if (!uq.rows[0]) return res.status(404).json({ error: "Cliente no encontrado" });
    const user = uq.rows[0];

    const sq = await db.query(`
      SELECT s.id, s.code, s.description, s.weight_kg, s.origin, s.service,
             s.status, s.estimated_usd, s.date_in
      FROM shipments s
      WHERE s.user_id = $1
        AND s.estimated_usd IS NOT NULL
        AND s.id NOT IN (SELECT shipment_id FROM payment_items)
      ORDER BY s.date_in DESC
    `, [user.id]);

    res.json({ user, shipments: sq.rows });
  } catch (err) {
    console.error("GET PENDING ERROR:", err);
    res.status(500).json({ error: "Error obteniendo pendientes" });
  }
});

app.post("/cash/payments", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const schema = z.object({
      user_id:       z.number().int().positive(),
      shipment_ids:  z.array(z.number().int().positive()).min(1),
      method:        z.enum(["USD_CASH", "USDT", "ARS_TRANSFER", "ARS_CASH"]),
      exchange_rate: z.number().min(0).nullable().optional(),
      amount_ars:    z.number().min(0).nullable().optional(),
      notes:         z.string().nullable().optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos", details: p.error.issues });

    const { user_id, shipment_ids, method, exchange_rate, amount_ars, notes } = p.data;
    const operator_id = req.user?.id || null;

    const sq = await db.query(
      `SELECT s.id, s.code, s.estimated_usd, s.weight_kg, s.origin, s.service, s.rate_usd_per_kg, s.charge_real_weight
       FROM shipments s WHERE s.id = ANY($1::int[]) AND s.user_id = $2`,
      [shipment_ids, user_id]
    );
    if (sq.rows.length !== shipment_ids.length) {
      return res.status(400).json({ error: "Algunos paquetes no pertenecen al cliente o no existen" });
    }
    const total_usd = sq.rows.reduce((a, r) => a + Number(r.estimated_usd || 0), 0);

    // Obtener costos del operador para calcular costo real y ganancia
    const costsQ = await db.query(`SELECT usa_normal, usa_express, usa_tech_premium, china_normal, china_express, europa_normal FROM operator_costs LIMIT 1`);
    const oc = costsQ.rows[0] || {};
    function getCostPerKg(origin, service) {
      if (origin === 'USA' && service === 'NORMAL')       return Number(oc.usa_normal       || 0);
      if (origin === 'USA' && service === 'EXPRESS')      return Number(oc.usa_express      || 0);
      if (origin === 'USA' && service === 'TECH_PREMIUM') return Number(oc.usa_tech_premium || 0);
      if (origin === 'CHINA' && service === 'NORMAL')     return Number(oc.china_normal     || 0);
      if (origin === 'CHINA' && service === 'EXPRESS')    return Number(oc.china_express    || 0);
      if (origin === 'EUROPA') return Number(oc.europa_normal || 0);
      return 0;
    }
    const total_cost = sq.rows.reduce((a, r) => {
      const realKg = Number(r.weight_kg || 0);
      const costPerKg = getCostPerKg(r.origin, r.service);
      const estimatedUsd = Number(r.estimated_usd || 0);
      if (estimatedUsd === 0 || costPerKg === 0) return a;
      // Usar charge_real_weight directamente si está disponible
      const chargedByReal = r.charge_real_weight === true || r.charge_real_weight === "true";
      let effectiveKg = chargedByReal ? realKg : Math.max(realKg, 1);
      return a + (effectiveKg * costPerKg);
    }, 0);
    const total_profit = total_usd - total_cost;

    const client = null;
    try {
      // Agregar columnas cost_usd y profit_usd si no existen
      await db.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,2) DEFAULT 0`).catch(() => {});
      await db.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS profit_usd NUMERIC(12,2) DEFAULT 0`).catch(() => {});

      const payRes = await db.query(
        `INSERT INTO payments (user_id, operator_id, amount_usd, method, exchange_rate, amount_ars, notes, cost_usd, profit_usd)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [user_id, operator_id, total_usd, method, exchange_rate ?? null, amount_ars ?? null, notes ?? null,
         Number(total_cost.toFixed(2)), Number(total_profit.toFixed(2))]
      );
      const payment = payRes.rows[0];

      for (const sid of shipment_ids) {
        const shipAmt = sq.rows.find(r => r.id === sid)?.estimated_usd || 0;
        const shipRow = sq.rows.find(r => r.id === sid);
        const shipRealKg = Number(shipRow?.weight_kg || 0);
        const shipRatePerKg = Number(shipRow?.rate_usd_per_kg || 0);
        const shipCostPerKg = getCostPerKg(shipRow?.origin, shipRow?.service);
        // Detectar si se cobró por peso real
        const shipChargedByReal = shipRow?.charge_real_weight === true || shipRow?.charge_real_weight === "true";
        let shipEffKg = shipChargedByReal ? shipRealKg : Math.max(shipRealKg, 1);
        const shipCost = Number((shipEffKg * shipCostPerKg).toFixed(2));
        const shipProfit = Number((Number(shipAmt) - shipCost).toFixed(2));
        // Add columns if needed
        await db.query(`ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12,2) DEFAULT 0`).catch(() => {});
        await db.query(`ALTER TABLE payment_items ADD COLUMN IF NOT EXISTS profit_usd NUMERIC(12,2) DEFAULT 0`).catch(() => {});
        await db.query(
          `INSERT INTO payment_items (payment_id, shipment_id, amount_usd, cost_usd, profit_usd) VALUES ($1, $2, $3, $4, $5)`,
          [payment.id, sid, shipAmt, shipCost, shipProfit]
        );
        const prevQ = await db.query(`SELECT status FROM shipments WHERE id=$1`, [sid]);
        const prevStatus = prevQ.rows[0]?.status || null;
        if (prevStatus !== "Entregado") {
          await db.query(`UPDATE shipments SET status='Entregado', updated_at=NOW() WHERE id=$1`, [sid]);
          await db.query(
            `INSERT INTO shipment_events (shipment_id, old_status, new_status) VALUES ($1, $2, $3)`,
            [sid, prevStatus, "Entregado"]
          );

          // ── Auto Lemon Coins al cobrar (también marca entregado) ──
          try {
            const existQ = await db.query(
              `SELECT id FROM coin_transactions WHERE shipment_id=$1 AND type='earn' LIMIT 1`, [sid]
            );
            if (!existQ.rows[0]) {
              const shipFull = (await db.query(
                `SELECT s.*, u.first_shipment_bonus_given FROM shipments s JOIN users u ON u.id=s.user_id WHERE s.id=$1`, [sid]
              )).rows[0];
              if (shipFull) {
                const kg = parseFloat(shipFull.weight_kg || 0);
                const usd = parseFloat(shipFull.estimated_usd || 0);
                const coinsByKg = Math.floor(kg * 3);
                const coinsBig = usd >= 500 ? 10 : 0;
                const coinsFirst = !shipFull.first_shipment_bonus_given ? 15 : 0;
                const total = coinsByKg + coinsBig + coinsFirst;
                if (total > 0) {
                  const bd = [];
                  if (coinsByKg  > 0) bd.push(`${coinsByKg} por ${kg.toFixed(2)}kg`);
                  if (coinsBig   > 0) bd.push(`${coinsBig} bonus envío grande`);
                  if (coinsFirst > 0) bd.push(`${coinsFirst} bonus primer envío`);
                  await db.query(`INSERT INTO lemon_coins (user_id,balance,total_earned) VALUES ($1,0,0) ON CONFLICT (user_id) DO NOTHING`, [shipFull.user_id]);
                  await db.query(`INSERT INTO coin_transactions (user_id,type,amount,reason,shipment_id) VALUES ($1,'earn',$2,$3,$4)`, [shipFull.user_id, total, `Envío completado — ${bd.join(", ")}`, sid]);
                  await db.query(`UPDATE lemon_coins SET balance=balance+$1,total_earned=total_earned+$1,updated_at=NOW() WHERE user_id=$2`, [total, shipFull.user_id]);
                  if (coinsFirst > 0) await db.query(`UPDATE users SET first_shipment_bonus_given=TRUE WHERE id=$1`, [shipFull.user_id]);
                }
              }
            }
          } catch (coinErr) { console.error("[COINS] Error en cash/payments:", coinErr.message); }
        }
      }

      if (req.body.account_id) {
        const aid = parseInt(req.body.account_id, 10);
        if (Number.isFinite(aid)) {
          const accQ = await db.query(`SELECT balance FROM accounts WHERE id=$1`, [aid]);
          if (accQ.rows[0]) {
            const newBal = Number(accQ.rows[0].balance) + total_usd;
            await db.query(`UPDATE accounts SET balance=$1, updated_at=NOW() WHERE id=$2`, [newBal, aid]);
            await db.query(
              `INSERT INTO account_movements (account_id, operator_id, direction, amount, description, ref_type, ref_id, balance_after)
               VALUES ($1,$2,'in',$3,$4,'payment',$5,$6)`,
              [aid, operator_id, total_usd, `Cobro paquetes — cliente #${user_id}`, payment.id, newBal]
            );
            await db.query(`UPDATE payments SET account_id=$1 WHERE id=$2`, [aid, payment.id]);
          }
        }
      }

      // CRM: al cobrar exitosamente limpiar waiting_operator del cliente
      try {
        const uPhoneQ = await db.query(`SELECT phone FROM users WHERE id=$1 LIMIT 1`, [user_id]);
        const uPhone = (uPhoneQ.rows[0]?.phone || '').replace(/\D/g, '');
        if (uPhone) {
          await db.query(
            `UPDATE wa_conversations SET needs_operator=FALSE, updated_at=NOW() WHERE phone=$1 AND mode='waiting_operator'`,
            [uPhone]
          );
        }
      } catch (crmPayErr) {
        console.log('[CRM] Fallo ownership en cobro:', crmPayErr?.message || crmPayErr);
      }

      // WA: 1 solo recibo consolidado por cobro
      try {
        const uq = await db.query(`SELECT name, phone FROM users WHERE id=$1 LIMIT 1`, [user_id]);
        const u = uq.rows[0];
        if (u?.phone) {
          await sendPaymentReceipt({
            phone: u.phone,
            clientName: u.name,
            shipments: sq.rows.map(r => ({ code: r.code, amount: Number(r.estimated_usd || 0), weight: Number(r.weight_kg || 0) })),
            totalUsd: total_usd,
            method,
            send: enqueueWhatsappToClient,
          });
        }
      } catch (waRecErr) {
        console.log("[WA] Fallo recibo consolidado:", waRecErr?.message || waRecErr);
      }

      res.json({ ok: true, payment });
    } finally {
      if (client) client.release();
    }
  } catch (err) {
    console.error("POST PAYMENT ERROR:", err);
    res.status(500).json({ error: "Error registrando pago" });
  }
});

app.get("/cash/payments", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const { from, to, method, client_number } = req.query;
    const conditions = ["1=1"];
    const params = [];
    let pi = 1;

    if (from)   { conditions.push(`p.created_at >= $${pi++}`); params.push(from); }
    if (to)     { conditions.push(`p.created_at <  $${pi++}`); params.push(to + "T23:59:59"); }
    if (method) { conditions.push(`p.method = $${pi++}`);      params.push(method); }
    if (client_number) {
      conditions.push(`u.client_number = $${pi++}`);
      params.push(parseInt(client_number, 10));
    }

    const q = await db.query(`
      SELECT
        p.id, p.amount_usd,
        COALESCE(p.cost_usd, 0)   AS cost_usd,
        COALESCE(p.profit_usd, 0) AS profit_usd,
        p.method, p.exchange_rate, p.amount_ars,
        p.notes, p.created_at,
        u.client_number, u.name AS client_name,
        op.name AS operator_name,
        (
          SELECT json_agg(json_build_object(
            'shipment_id', pi2.shipment_id,
            'amount_usd',  pi2.amount_usd,
            'cost_usd',    COALESCE(pi2.cost_usd, 0),
            'profit_usd',  COALESCE(pi2.profit_usd, 0),
            'code',        s.code,
            'description', s.description
          ))
          FROM payment_items pi2
          JOIN shipments s ON s.id = pi2.shipment_id
          WHERE pi2.payment_id = p.id
        ) AS items
      FROM payments p
      JOIN users u  ON u.id = p.user_id
      LEFT JOIN users op ON op.id = p.operator_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.created_at DESC
      LIMIT 200
    `, params);

    res.json({ rows: q.rows });
  } catch (err) {
    console.error("GET PAYMENTS ERROR:", err);
    res.status(500).json({ error: "Error obteniendo pagos" });
  }
});

app.delete("/cash/payments/:id", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query("DELETE FROM payment_items WHERE payment_id=$1", [id]);
    await db.query("DELETE FROM payments WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE PAYMENT ERROR:", err);
    res.status(500).json({ error: "Error anulando pago" });
  }
});

app.post("/cash/expenses", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const schema = z.object({
      type:        z.enum(["empresa", "personal"]),
      category:    z.string().min(1),
      description: z.string().min(1),
      amount:      z.number().min(0.01),
      currency:    z.enum(["USD", "ARS"]),
      date:        z.string().optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    const { type, category, description, amount, currency, date } = p.data;
    const operator_id = req.user?.id || null;

    const r = await db.query(
      `INSERT INTO expenses (operator_id, type, category, description, amount, currency, date, account_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [operator_id, type, category, description, amount, currency,
       date || new Date().toISOString().slice(0, 10), req.body.account_id || null]
    );

    if (req.body.account_id) {
      const aid = parseInt(req.body.account_id, 10);
      if (Number.isFinite(aid)) {
        const accQ = await db.query(`SELECT balance FROM accounts WHERE id=$1`, [aid]);
        if (accQ.rows[0]) {
          const newBal = Number(accQ.rows[0].balance) - amount;
          await db.query(`UPDATE accounts SET balance=$1, updated_at=NOW() WHERE id=$2`, [newBal, aid]);
          await db.query(
            `INSERT INTO account_movements (account_id, operator_id, direction, amount, description, ref_type, ref_id, balance_after)
             VALUES ($1,$2,'out',$3,$4,'expense',$5,$6)`,
            [aid, operator_id, amount, `${type} — ${category}: ${description}`, r.rows[0].id, newBal]
          );
        }
      }
    }
    res.json({ ok: true, expense: r.rows[0] });
  } catch (err) {
    console.error("POST EXPENSE ERROR:", err);
    res.status(500).json({ error: "Error registrando gasto" });
  }
});

app.get("/cash/expenses", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const { from, to, type, currency } = req.query;
    const conditions = ["1=1"];
    const params = [];
    let pi = 1;

    if (from)     { conditions.push(`e.date >= $${pi++}`);    params.push(from); }
    if (to)       { conditions.push(`e.date <= $${pi++}`);    params.push(to); }
    if (type)     { conditions.push(`e.type = $${pi++}`);     params.push(type); }
    if (currency) { conditions.push(`e.currency = $${pi++}`); params.push(currency); }

    const q = await db.query(`
      SELECT e.*, u.name AS operator_name
      FROM expenses e
      LEFT JOIN users u ON u.id = e.operator_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY e.date DESC, e.created_at DESC
      LIMIT 500
    `, params);

    const totals = q.rows.reduce((acc, r) => {
      const k = r.currency;
      acc[k] = (acc[k] || 0) + Number(r.amount);
      if (r.type === "empresa")  acc[`empresa_${k}`]  = (acc[`empresa_${k}`]  || 0) + Number(r.amount);
      if (r.type === "personal") acc[`personal_${k}`] = (acc[`personal_${k}`] || 0) + Number(r.amount);
      return acc;
    }, {});

    res.json({ rows: q.rows, totals });
  } catch (err) {
    console.error("GET EXPENSES ERROR:", err);
    res.status(500).json({ error: "Error obteniendo gastos" });
  }
});

app.delete("/cash/expenses/:id", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    await db.query("DELETE FROM expenses WHERE id=$1", [parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error eliminando gasto" });
  }
});

// ════════════════════════════════════════════════════════════════════
// PRESUPUESTADOR
// ════════════════════════════════════════════════════════════════════

const DEFAULT_RATES_FALLBACK = {
  usa_normal: 45, usa_express: 55, usa_tech_premium: 75,
  china_normal: 58, china_express: 68, europa_normal: 58,
};

app.get("/quote/rates", async (req, res) => {
  try {
    const [costsQ, fxQ] = await Promise.all([
      db.query(`SELECT * FROM operator_costs WHERE id=1`),
      db.query(`SELECT value FROM app_settings WHERE key='fx_usd_ars'`),
    ]);
    const rates = costsQ.rows[0] || DEFAULT_RATES_FALLBACK;
    const fx    = fxQ.rows[0] ? Number(fxQ.rows[0].value) : null;
    res.json({ rates, fx_rate: fx });
  } catch(err) { res.status(500).json({ error: "Error obteniendo tarifas" }); }
});

app.get("/quote/my-rates", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const [ratesQ, fxQ] = await Promise.all([
      db.query(`SELECT * FROM client_rates WHERE user_id=$1`, [userId]),
      db.query(`SELECT value FROM app_settings WHERE key='fx_usd_ars'`),
    ]);
    const defaults = DEFAULT_RATES_FALLBACK;
    const custom   = ratesQ.rows[0] || {};
    const rates = {
      usa_normal:        Number(custom.usa_normal        ?? defaults.usa_normal),
      usa_express:       Number(custom.usa_express       ?? defaults.usa_express),
      usa_tech_premium:  Number(custom.usa_tech_premium  ?? defaults.usa_tech_premium),
      china_normal:      Number(custom.china_normal      ?? defaults.china_normal),
      china_express:     Number(custom.china_express     ?? defaults.china_express),
      europa_normal:     Number(custom.europa_normal     ?? defaults.europa_normal),
    };
    const fx = fxQ.rows[0] ? Number(fxQ.rows[0].value) : null;
    res.json({
      rates,
      fx_rate: fx,
      personalized: !!ratesQ.rows[0],
      volume_discounts: [
        { min_kg: 1,   max_kg: 9,   discount: 0, label: "1–9 kg" },
        { min_kg: 10,  max_kg: 49,  discount: 3, label: "10–49 kg (−$3/kg)" },
        { min_kg: 50,  max_kg: 99,  discount: 5, label: "50–99 kg (−$5/kg)" },
        { min_kg: 100, max_kg: null, discount: 7, label: "100+ kg (−$7/kg)" },
      ],
    });
  } catch(err) { res.status(500).json({ error: "Error obteniendo tarifas" }); }
});

app.post("/quote/request", authRequired, async (req, res) => {
  try {
    const schema = z.object({
      origin:        z.enum(["usa","china","europa","USA","CHINA","EUROPA"]),
      service:       z.enum(["NORMAL","EXPRESS","TECH_PREMIUM","normal","express"]),
      weight_kg:     z.number().min(0.01),
      description:   z.string().min(1),
      estimated_usd: z.number().min(0),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    const userId  = req.user.id;
    const origin  = p.data.origin.toUpperCase();
    const service = p.data.service.toUpperCase();
    const { weight_kg, description, estimated_usd } = p.data;

    await db.query(`
      CREATE TABLE IF NOT EXISTS quote_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        code TEXT UNIQUE,
        origin TEXT, service TEXT,
        weight_kg NUMERIC, description TEXT,
        estimated_usd NUMERIC,
        status TEXT DEFAULT 'pendiente',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const code = `SOL-${Date.now().toString(36).toUpperCase()}`;
    const r = await db.query(`
      INSERT INTO quote_requests
        (user_id, code, origin, service, weight_kg, description, estimated_usd, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pendiente')
      RETURNING *
    `, [userId, code, origin, service, weight_kg, description, estimated_usd]);

    res.json({ ok: true, code, request: r.rows[0] });
  } catch(err) {
    console.error("[QUOTE REQUEST]", err);
    res.status(500).json({ error: "Error creando solicitud" });
  }
});

// ── GET solicitudes (operador) ─────────────────────────────────────
app.get("/quote/requests", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS quote_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        code TEXT UNIQUE,
        origin TEXT, service TEXT,
        weight_kg NUMERIC, description TEXT,
        estimated_usd NUMERIC,
        status TEXT DEFAULT 'pendiente',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const q = await db.query(`
      SELECT qr.*, u.name AS client_name, u.client_number, u.email AS client_email
      FROM quote_requests qr
      JOIN users u ON u.id = qr.user_id
      ORDER BY qr.created_at DESC
    `);
    res.json({ requests: q.rows });
  } catch(err) {
    console.error("[QUOTE REQUESTS GET]", err);
    res.status(500).json({ error: "Error obteniendo solicitudes" });
  }
});

// ── PATCH solicitud (operador) ─────────────────────────────────────
app.patch("/quote/requests/:id", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const { id } = req.params;
    const q = await db.query(`
      UPDATE quote_requests
      SET status=COALESCE($1,status), notes=COALESCE($2,notes), updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [status || null, notes !== undefined ? notes : null, id]);
    if (!q.rows[0]) return res.status(404).json({ error: "Solicitud no encontrada" });
    res.json({ ok: true, request: q.rows[0] });
  } catch(err) {
    res.status(500).json({ error: "Error actualizando solicitud" });
  }
});
// ════════════════════════════════════════════════════════════════════
// TIPO DE CAMBIO
// ════════════════════════════════════════════════════════════════════

app.get("/settings/fx", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const q = await db.query(`SELECT value, updated_at FROM app_settings WHERE key='fx_usd_ars'`);
    const rate = q.rows[0] ? Number(q.rows[0].value) : null;
    res.json({ rate, updated_at: q.rows[0]?.updated_at || null });
  } catch(err) { res.status(500).json({ error: "Error leyendo tipo de cambio" }); }
});

app.put("/settings/fx", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const { rate } = req.body;
    const n = Number(rate);
    if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: "Tipo de cambio inválido" });
    await db.query(`
      INSERT INTO app_settings (key, value, updated_at) VALUES ('fx_usd_ars', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()
    `, [String(n)]);
    res.json({ ok: true, rate: n });
  } catch(err) { res.status(500).json({ error: "Error guardando tipo de cambio" }); }
});

// ════════════════════════════════════════════════════════════════════
// MÓDULO CUENTAS / FONDOS
// ════════════════════════════════════════════════════════════════════

app.get("/accounts", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const q = await db.query(`
      SELECT a.*,
        COALESCE((SELECT SUM(CASE WHEN direction='in' THEN amount ELSE -amount END)
                  FROM account_movements WHERE account_id=a.id), 0) AS movements_balance
      FROM accounts a WHERE a.active=true ORDER BY a.id
    `);
    res.json({ accounts: q.rows });
  } catch(err) { res.status(500).json({ error: "Error obteniendo cuentas" }); }
});

app.post("/accounts", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const schema = z.object({
      name:     z.string().min(1),
      type:     z.enum(["usd_cash","usdt","bank_ars","bank_usd","prepaid","other"]),
      currency: z.enum(["USD","ARS","USDT"]),
      balance:  z.number().default(0),
      notes:    z.string().nullable().optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });
    const r = await db.query(
      `INSERT INTO accounts (name,type,currency,balance,notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [p.data.name, p.data.type, p.data.currency, p.data.balance, p.data.notes||null]
    );
    res.json({ ok: true, account: r.rows[0] });
  } catch(err) { res.status(500).json({ error: "Error creando cuenta" }); }
});

app.put("/accounts/:id", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const schema = z.object({
      name:    z.string().min(1).optional(),
      balance: z.number().optional(),
      notes:   z.string().nullable().optional(),
      active:  z.boolean().optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    const fields = []; const vals = []; let pi = 1;
    if (p.data.name    !== undefined) { fields.push(`name=$${pi++}`);    vals.push(p.data.name); }
    if (p.data.balance !== undefined) { fields.push(`balance=$${pi++}`); vals.push(p.data.balance); }
    if (p.data.notes   !== undefined) { fields.push(`notes=$${pi++}`);   vals.push(p.data.notes); }
    if (p.data.active  !== undefined) { fields.push(`active=$${pi++}`);  vals.push(p.data.active); }
    fields.push(`updated_at=NOW()`);
    vals.push(id);

    const r = await db.query(`UPDATE accounts SET ${fields.join(",")} WHERE id=$${pi} RETURNING *`, vals);
    if (p.data.balance !== undefined) {
      await db.query(
        `INSERT INTO account_movements (account_id, operator_id, direction, amount, description, ref_type, balance_after)
         VALUES ($1,$2,'in',$3,'Ajuste manual de saldo','manual',$4)`,
        [id, req.user?.id||null, p.data.balance, p.data.balance]
      );
    }
    res.json({ ok: true, account: r.rows[0] });
  } catch(err) { res.status(500).json({ error: "Error actualizando cuenta" }); }
});

app.delete("/accounts/:id", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    await db.query(`UPDATE accounts SET active=false WHERE id=$1`, [parseInt(req.params.id,10)]);
    res.json({ ok: true });
  } catch(err) { res.status(500).json({ error: "Error eliminando cuenta" }); }
});

app.post("/accounts/:id/movements", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const account_id = parseInt(req.params.id, 10);
    const schema = z.object({
      direction:   z.enum(["in","out"]),
      amount:      z.number().min(0.01),
      description: z.string().min(1),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    const accQ = await db.query(`SELECT balance FROM accounts WHERE id=$1`, [account_id]);
    if (!accQ.rows[0]) return res.status(404).json({ error: "Cuenta no encontrada" });
    const current = Number(accQ.rows[0].balance);
    const delta = p.data.direction === 'in' ? p.data.amount : -p.data.amount;
    const newBalance = current + delta;

    await db.query(`UPDATE accounts SET balance=$1, updated_at=NOW() WHERE id=$2`, [newBalance, account_id]);
    const mv = await db.query(
      `INSERT INTO account_movements (account_id, operator_id, direction, amount, description, ref_type, balance_after)
       VALUES ($1,$2,$3,$4,$5,'manual',$6) RETURNING *`,
      [account_id, req.user?.id||null, p.data.direction, p.data.amount, p.data.description, newBalance]
    );
    res.json({ ok: true, movement: mv.rows[0], balance: newBalance });
  } catch(err) { res.status(500).json({ error: "Error registrando movimiento" }); }
});

app.get("/accounts/:id/movements", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const q = await db.query(`
      SELECT m.*, u.name AS operator_name
      FROM account_movements m
      LEFT JOIN users u ON u.id = m.operator_id
      WHERE m.account_id = $1
      ORDER BY m.created_at DESC LIMIT 100
    `, [parseInt(req.params.id,10)]);
    res.json({ rows: q.rows });
  } catch(err) { res.status(500).json({ error: "Error obteniendo movimientos" }); }
});

app.get("/accounts/summary", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const q = await db.query(`
      SELECT a.*, (SELECT COUNT(*) FROM account_movements WHERE account_id=a.id) AS movement_count
      FROM accounts a WHERE a.active=true ORDER BY a.id
    `);
    const fxQ = await db.query(`SELECT value FROM app_settings WHERE key='fx_usd_ars'`);
    const fxRate = fxQ.rows[0] ? Number(fxQ.rows[0].value) : null;

    const totals = q.rows.reduce((acc, r) => {
      acc[r.currency] = (acc[r.currency]||0) + Number(r.balance);
      return acc;
    }, {});

    let totalCapitalUsd = 0;
    q.rows.forEach(a => {
      if (a.currency === 'USD')  totalCapitalUsd += Number(a.balance);
      if (a.currency === 'USDT') totalCapitalUsd += Number(a.balance);
      if (a.currency === 'ARS' && fxRate) totalCapitalUsd += Number(a.balance) / fxRate;
    });

    res.json({ accounts: q.rows, totals, fx_rate: fxRate, total_capital_usd: Number(totalCapitalUsd.toFixed(2)) });
  } catch(err) { res.status(500).json({ error: "Error summary fondos" }); }
});

app.post("/cash/income", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const schema = z.object({
      category:    z.string().min(1),
      description: z.string().min(1),
      amount:      z.number().min(0.01),
      currency:    z.enum(["USD", "ARS"]),
      date:        z.string().optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });
    const { category, description, amount, currency, date } = p.data;
    const operator_id = req.user?.id || null;
    const r = await db.query(
      `INSERT INTO additional_income (operator_id, category, description, amount, currency, date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [operator_id, category, description, amount, currency, date || new Date().toISOString().slice(0,10)]
    );
    res.json({ ok: true, income: r.rows[0] });
  } catch (err) {
    console.error("POST INCOME ERROR:", err);
    res.status(500).json({ error: "Error registrando ingreso" });
  }
});

app.get("/cash/income", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const { from, to, currency } = req.query;
    const conditions = ["1=1"];
    const params = [];
    let pi = 1;
    if (from)     { conditions.push(`i.date >= $${pi++}`);    params.push(from); }
    if (to)       { conditions.push(`i.date <= $${pi++}`);    params.push(to); }
    if (currency) { conditions.push(`i.currency = $${pi++}`); params.push(currency); }

    const q = await db.query(`
      SELECT i.*, u.name AS operator_name
      FROM additional_income i
      LEFT JOIN users u ON u.id = i.operator_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY i.date DESC, i.created_at DESC
      LIMIT 500
    `, params);

    const totals = q.rows.reduce((acc, r) => {
      acc[r.currency] = (acc[r.currency] || 0) + Number(r.amount);
      return acc;
    }, {});

    res.json({ rows: q.rows, totals });
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo ingresos" });
  }
});

app.delete("/cash/income/:id", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    await db.query("DELETE FROM additional_income WHERE id=$1", [parseInt(req.params.id,10)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error eliminando ingreso" });
  }
});

app.get("/cash/fx-current", authRequired, requireRole(["operator", "admin"]), async (_req, res) => {
  try {
    const q = await db.query("SELECT value, updated_at FROM app_settings WHERE key='fx_usd_ars' LIMIT 1");
    const row = q.rows[0];
    res.json({
      ok: true,
      fx: row ? Number(row.value) : null,
      updated_at: row ? row.updated_at : null,
    });
  } catch (err) {
    console.error("[/cash/fx-current ERROR]", err.message);
    res.status(500).json({ error: "Error leyendo tipo de cambio" });
  }
});

// ── GET /dashboard/metrics — métricas completas para el founder dashboard ──────


app.get("/dashboard/metrics", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const requestedMonth = String(req.query.month || "").trim();
    const month =
      /^\d{4}-\d{2}$/.test(requestedMonth)
        ? requestedMonth
        : new Date().toISOString().slice(0, 7);

    const from = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const to = new Date(y, m, 0).toISOString().slice(0, 10);

    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const prevFrom = `${prevMonth}-01`;
    const prevTo = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).toISOString().slice(0, 10);

    async function runMetricsRange(dateFrom, dateTo) {
      const [
        courierQ,
        externalQ,
        incomeQ,
        expensesQ,
        shipQ,
        clientsQ
      ] = await Promise.all([
        db.query(`
          SELECT
            COALESCE(SUM(amount_usd), 0)              AS collected,
            COALESCE(SUM(COALESCE(cost_usd, 0)), 0)   AS cost_usd,
            COALESCE(SUM(COALESCE(profit_usd, 0)), 0) AS profit_usd
          FROM payments
          WHERE created_at >= $1 AND created_at <= $2::date + INTERVAL '1 day'
        `, [dateFrom, dateTo]),

        db.query(`
          SELECT
            COALESCE(SUM(i.weight_kg * i.tariff_per_kg) FILTER (WHERE i.is_commission = TRUE), 0) AS commission_usd,
            COALESCE(SUM(i.weight_kg) FILTER (WHERE i.is_commission = TRUE), 0) AS commission_kg,
            COALESCE(SUM(i.weight_kg), 0) AS total_kg
          FROM ext_items i
          JOIN ext_boxes b ON b.id = i.box_id
          WHERE b.date_received >= $1 AND b.date_received <= $2
        `, [dateFrom, dateTo]),

        db.query(`
          SELECT COALESCE(SUM(amount) FILTER (WHERE currency='USD'), 0) AS income_usd
          FROM additional_income
          WHERE date >= $1 AND date <= $2
        `, [dateFrom, dateTo]),

        db.query(`
          SELECT
            COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND type='empresa'), 0)  AS empresa_usd,
            COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND type='personal'), 0) AS personal_usd,
            COALESCE(SUM(amount) FILTER (WHERE currency='ARS' AND type='empresa'), 0)  AS empresa_ars,
            COALESCE(SUM(amount) FILTER (WHERE currency='ARS' AND type='personal'), 0) AS personal_ars
          FROM expenses
          WHERE date >= $1 AND date <= $2
        `, [dateFrom, dateTo]),

        db.query(`
          SELECT
            COUNT(*) AS total_shipments,
            COUNT(*) FILTER (WHERE status='Entregado') AS delivered,
            COALESCE(SUM(weight_kg), 0) AS total_kg
          FROM shipments
          WHERE date_in >= $1 AND date_in <= $2
        `, [dateFrom, dateTo]),

        db.query(`
          SELECT COUNT(DISTINCT user_id) AS active_clients
          FROM shipments
          WHERE date_in >= $1 AND date_in <= $2
        `, [dateFrom, dateTo]),
      ]);

      const courier = courierQ.rows[0];
      const external = externalQ.rows[0];
      const income = incomeQ.rows[0];
      const expenses = expensesQ.rows[0];
      const ships = shipQ.rows[0];
      const clients = clientsQ.rows[0];

      const collected       = Number(courier.collected       || 0);
      const cost_usd        = Number(courier.cost_usd        || 0);
      const courier_profit  = Number(courier.profit_usd      || 0);
      const commission_usd  = Number(external.commission_usd || 0);
      const commission_kg   = Number(external.commission_kg  || 0);
      const income_usd      = Number(income.income_usd       || 0);
      const empresa_usd     = Number(expenses.empresa_usd    || 0);
      const personal_usd    = Number(expenses.personal_usd   || 0);
      const empresa_ars     = Number(expenses.empresa_ars    || 0);
      const personal_ars    = Number(expenses.personal_ars   || 0);
      const courier_kg      = Number(ships.total_kg          || 0);
      // Convertir gastos ARS a USD usando el tipo de cambio actual
      const fxQ = await db.query(`SELECT value FROM app_settings WHERE key='fx_usd_ars'`);
      const fx = fxQ.rows[0] ? Number(fxQ.rows[0].value) : null;
      const empresa_ars_usd  = fx && fx > 0 ? empresa_ars / fx : 0;
      const personal_ars_usd = fx && fx > 0 ? personal_ars / fx : 0;
      const empresa_total_usd  = empresa_usd + empresa_ars_usd;
      const personal_total_usd = personal_usd + personal_ars_usd;

      const total_income = collected + commission_usd + income_usd;
      const total_out    = cost_usd + empresa_total_usd + personal_total_usd;
      const net_profit   = total_income - total_out;
      const margin       = total_income > 0 ? (net_profit / total_income * 100) : 0;
      const executive_total_profit = courier_profit + commission_usd + income_usd;
      const total_kg = courier_kg + commission_kg;

      return {
        total_income,
        collected,
        commission_usd,
        income_usd,
        additional_income_usd: income_usd,
        total_out,
        cost_usd,
        empresa_usd: empresa_total_usd,
        personal_usd: personal_total_usd,
        empresa_usd_raw: empresa_usd,
        personal_usd_raw: personal_usd,
        empresa_ars,
        personal_ars,
        fx_rate: fx,
        net_profit,
        total_profit: net_profit,
        executive_total_profit,
        courier_profit,
        external_profit: commission_usd,
        margin: Number(margin.toFixed(1)),
        courier_kg,
        commission_kg,
        external_kg: commission_kg,
        total_kg,
        total_shipments: Number(ships.total_shipments || 0),
        delivered: Number(ships.delivered || 0),
        active_clients: Number(clients.active_clients || 0),
      };
    }

    async function runMetricsAllTime() {
      const [
        courierQ,
        externalQ,
        incomeQ,
        expensesQ,
        shipQ,
        clientsQ
      ] = await Promise.all([
        db.query(`
          SELECT
            COALESCE(SUM(amount_usd), 0)              AS collected,
            COALESCE(SUM(COALESCE(cost_usd, 0)), 0)   AS cost_usd,
            COALESCE(SUM(COALESCE(profit_usd, 0)), 0) AS profit_usd
          FROM payments
        `),
        db.query(`
          SELECT
            COALESCE(SUM(i.weight_kg * i.tariff_per_kg) FILTER (WHERE i.is_commission = TRUE), 0) AS commission_usd,
            COALESCE(SUM(i.weight_kg) FILTER (WHERE i.is_commission = TRUE), 0) AS commission_kg,
            COALESCE(SUM(i.weight_kg), 0) AS total_kg
          FROM ext_items i
          JOIN ext_boxes b ON b.id = i.box_id
        `),
        db.query(`
          SELECT COALESCE(SUM(amount) FILTER (WHERE currency='USD'), 0) AS income_usd
          FROM additional_income
        `),
        db.query(`
          SELECT
            COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND type='empresa'), 0)  AS empresa_usd,
            COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND type='personal'), 0) AS personal_usd,
            COALESCE(SUM(amount) FILTER (WHERE currency='ARS' AND type='empresa'), 0)  AS empresa_ars,
            COALESCE(SUM(amount) FILTER (WHERE currency='ARS' AND type='personal'), 0) AS personal_ars
          FROM expenses
        `),
        db.query(`
          SELECT
            COUNT(*) AS total_shipments,
            COUNT(*) FILTER (WHERE status='Entregado') AS delivered,
            COALESCE(SUM(weight_kg), 0) AS total_kg
          FROM shipments
        `),
        db.query(`
          SELECT COUNT(DISTINCT user_id) AS active_clients
          FROM shipments
        `),
      ]);

      const courier = courierQ.rows[0];
      const external = externalQ.rows[0];
      const income = incomeQ.rows[0];
      const expenses = expensesQ.rows[0];
      const ships = shipQ.rows[0];
      const clients = clientsQ.rows[0];

      const collected       = Number(courier.collected       || 0);
      const cost_usd        = Number(courier.cost_usd        || 0);
      const courier_profit  = Number(courier.profit_usd      || 0);
      const commission_usd  = Number(external.commission_usd || 0);
      const commission_kg   = Number(external.commission_kg  || 0);
      const income_usd      = Number(income.income_usd       || 0);
      const empresa_usd     = Number(expenses.empresa_usd    || 0);
      const personal_usd    = Number(expenses.personal_usd   || 0);
      const empresa_ars     = Number(expenses.empresa_ars    || 0);
      const personal_ars    = Number(expenses.personal_ars   || 0);
      const courier_kg      = Number(ships.total_kg          || 0);
      // Convertir gastos ARS a USD usando el tipo de cambio actual
      const fxQ = await db.query(`SELECT value FROM app_settings WHERE key='fx_usd_ars'`);
      const fx = fxQ.rows[0] ? Number(fxQ.rows[0].value) : null;
      const empresa_ars_usd  = fx && fx > 0 ? empresa_ars / fx : 0;
      const personal_ars_usd = fx && fx > 0 ? personal_ars / fx : 0;
      const empresa_total_usd  = empresa_usd + empresa_ars_usd;
      const personal_total_usd = personal_usd + personal_ars_usd;

      const total_income = collected + commission_usd + income_usd;
      const total_out    = cost_usd + empresa_total_usd + personal_total_usd;
      const net_profit   = total_income - total_out;
      const margin       = total_income > 0 ? (net_profit / total_income * 100) : 0;
      const executive_total_profit = courier_profit + commission_usd + income_usd;
      const total_kg = courier_kg + commission_kg;

      return {
        total_income,
        collected,
        commission_usd,
        income_usd,
        additional_income_usd: income_usd,
        total_out,
        cost_usd,
        empresa_usd: empresa_total_usd,
        personal_usd: personal_total_usd,
        net_profit,
        total_profit: net_profit,
        executive_total_profit,
        courier_profit,
        external_profit: commission_usd,
        margin: Number(margin.toFixed(1)),
        courier_kg,
        commission_kg,
        external_kg: commission_kg,
        total_kg,
        total_shipments: Number(ships.total_shipments || 0),
        delivered: Number(ships.delivered || 0),
        active_clients: Number(clients.active_clients || 0),
      };
    }

    const [month_metrics, previous_month_metrics, all_time] = await Promise.all([
      runMetricsRange(from, to),
      runMetricsRange(prevFrom, prevTo),
      runMetricsAllTime(),
    ]);

    res.json({
      month,
      previous_month: prevMonth,
      ...month_metrics,
      month_metrics,
      previous_month_metrics,
      all_time,
    });
  } catch(err) {
    console.error("METRICS ERROR:", err);
    res.status(500).json({ error: "Error obteniendo métricas" });
  }
});

app.get("/cash/monthly", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    // Tipo de cambio para convertir ARS
    const fxQMonthly = await db.query(`SELECT value FROM app_settings WHERE key='fx_usd_ars'`);
    const fxRateMonthly = fxQMonthly.rows[0] ? Number(fxQMonthly.rows[0].value) : 0;
    // Cobros de courier
    const paymentsQ = await db.query(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        COALESCE(SUM(amount_usd), 0)              AS collected,
        COALESCE(SUM(COALESCE(cost_usd, 0)), 0)   AS total_cost,
        COALESCE(SUM(COALESCE(profit_usd, 0)), 0) AS total_profit
      FROM payments
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC LIMIT 24
    `);

    // Gastos
    const expensesQ = await db.query(`
      SELECT TO_CHAR(date, 'YYYY-MM') AS month,
        COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND type='empresa'), 0)  AS empresa_usd,
        COALESCE(SUM(amount) FILTER (WHERE currency='ARS' AND type='empresa'), 0)  AS empresa_ars,
        COALESCE(SUM(amount) FILTER (WHERE currency='USD' AND type='personal'), 0) AS personal_usd,
        COALESCE(SUM(amount) FILTER (WHERE currency='ARS' AND type='personal'), 0) AS personal_ars
      FROM expenses GROUP BY TO_CHAR(date, 'YYYY-MM') ORDER BY month DESC LIMIT 24
    `);

    // Ingresos adicionales manuales (caja)
    const incomeQ = await db.query(`
      SELECT TO_CHAR(date, 'YYYY-MM') AS month,
        COALESCE(SUM(amount) FILTER (WHERE currency='USD'), 0) AS income_usd,
        COALESCE(SUM(amount) FILTER (WHERE currency='ARS'), 0) AS income_ars
      FROM additional_income GROUP BY TO_CHAR(date, 'YYYY-MM') ORDER BY month DESC LIMIT 24
    `);

    // Comisiones de cargas externas (por mes del ítem entregado)
    const externalQ = await db.query(`
      SELECT
        TO_CHAR(b.date_received, 'YYYY-MM') AS month,
        COALESCE(SUM(i.weight_kg * i.tariff_per_kg) FILTER (WHERE i.is_commission = TRUE), 0) AS commission_usd
      FROM ext_items i
      JOIN ext_boxes b ON b.id = i.box_id
      GROUP BY TO_CHAR(b.date_received, 'YYYY-MM')
      ORDER BY month DESC LIMIT 24
    `);

    const months = new Set([
      ...paymentsQ.rows.map(r => r.month),
      ...expensesQ.rows.map(r => r.month),
      ...incomeQ.rows.map(r => r.month),
      ...externalQ.rows.map(r => r.month),
    ]);

    const result = [...months].sort((a,b) => b.localeCompare(a)).map(month => {
      const pay = paymentsQ.rows.find(r => r.month === month) || {};
      const exp = expensesQ.rows.find(r => r.month === month) || {};
      const inc = incomeQ.rows.find(r => r.month === month) || {};
      const ext = externalQ.rows.find(r => r.month === month) || {};

      const collected     = Number(pay.collected    || 0);
      const income_usd    = Number(inc.income_usd   || 0);
      const commission_usd= Number(ext.commission_usd || 0);
      const empresa_usd   = Number(exp.empresa_usd  || 0);
      const empresa_ars   = Number(exp.empresa_ars  || 0);
      const personal_usd  = Number(exp.personal_usd || 0);
      const personal_ars  = Number(exp.personal_ars || 0);
      const totalCost     = Number(pay.total_cost   || 0);
      const totalProfit   = Number(pay.total_profit || 0);
      // Convertir ARS a USD
      const empresa_ars_usd   = fxRateMonthly > 0 ? empresa_ars / fxRateMonthly : 0;
      const personal_ars_usd  = fxRateMonthly > 0 ? personal_ars / fxRateMonthly : 0;

      const total_income = collected + income_usd + commission_usd;
      const total_out    = totalCost + empresa_usd + empresa_ars_usd + personal_usd + personal_ars_usd;
      // RESULTADO = entró - salió
      const net          = total_income - total_out;
      const margin       = total_income > 0 ? (net / total_income * 100) : 0;

      return {
        month,
        collected,          // cobros courier
        income_usd,         // ingresos adicionales manuales
        commission_usd,     // comisiones cargas externas
        income_ars:   Number(inc.income_ars || 0),
        empresa_usd, empresa_ars, personal_usd, personal_ars,
        total_income,       // ENTRÓ total
        total_out:    Number(total_out.toFixed(2)),    // SALIÓ total
        net:          Number(net.toFixed(2)),           // RESULTADO
        margin:       Number(margin.toFixed(1)),
        cost_usd:     Number(totalCost.toFixed(2)),
        profit_usd:   Number(totalProfit.toFixed(2)),
      };
    });

    res.json({ rows: result });
  } catch (err) {
    console.error("MONTHLY ERROR:", err);
    res.status(500).json({ error: "Error obteniendo P&L mensual" });
  }
});

app.get("/cash/summary", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const from = `${month}-01`;
    const to   = new Date(new Date(from).getFullYear(), new Date(from).getMonth() + 1, 0).toISOString().slice(0, 10);

    const payQ = await db.query(`
      SELECT COUNT(*) AS payment_count, COALESCE(SUM(amount_usd), 0) AS total_usd,
             COALESCE(SUM(amount_usd) FILTER (WHERE method='USD_CASH'),    0) AS usd_cash,
             COALESCE(SUM(amount_usd) FILTER (WHERE method='USDT'),        0) AS usdt,
             COALESCE(SUM(amount_usd) FILTER (WHERE method='ARS_TRANSFER'),0) AS ars_transfer_usd,
             COALESCE(SUM(amount_usd) FILTER (WHERE method='ARS_CASH'),    0) AS ars_cash_usd
      FROM payments WHERE created_at >= $1 AND created_at <= $2::date + INTERVAL '1 day'
    `, [from, to]);

    const expQ = await db.query(`
      SELECT COUNT(*) AS expense_count,
             COALESCE(SUM(amount) FILTER (WHERE currency='USD'), 0) AS total_usd,
             COALESCE(SUM(amount) FILTER (WHERE currency='ARS'), 0) AS total_ars,
             COALESCE(SUM(amount) FILTER (WHERE type='empresa'  AND currency='USD'), 0) AS empresa_usd,
             COALESCE(SUM(amount) FILTER (WHERE type='empresa'  AND currency='ARS'), 0) AS empresa_ars,
             COALESCE(SUM(amount) FILTER (WHERE type='personal' AND currency='USD'), 0) AS personal_usd,
             COALESCE(SUM(amount) FILTER (WHERE type='personal' AND currency='ARS'), 0) AS personal_ars
      FROM expenses WHERE date >= $1 AND date <= $2
    `, [from, to]);

    const byDayQ = await db.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, COALESCE(SUM(amount_usd), 0) AS collected
      FROM payments WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD') ORDER BY day
    `);

    const pendQ = await db.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(s.estimated_usd), 0) AS total
      FROM shipments s
      WHERE s.estimated_usd IS NOT NULL AND s.id NOT IN (SELECT shipment_id FROM payment_items)
    `);

    const incQ = await db.query(`
      SELECT COUNT(*) AS income_count,
             COALESCE(SUM(amount) FILTER (WHERE currency='USD'), 0) AS total_usd,
             COALESCE(SUM(amount) FILTER (WHERE currency='ARS'), 0) AS total_ars
      FROM additional_income WHERE date >= $1 AND date <= $2
    `, [from, to]);

    res.json({ month, payments: payQ.rows[0], expenses: expQ.rows[0], by_day: byDayQ.rows, pending: pendQ.rows[0], income: incQ.rows[0] });
  } catch (err) {
    console.error("CASH SUMMARY ERROR:", err);
    res.status(500).json({ error: "Error summary caja" });
  }
});

app.get(
  "/operator/next-code",
  authRequired,
  requireRole(["operator", "admin"]),
  async (req, res) => {
    try {
      const origin  = (req.query.origin  || "USA").toUpperCase().trim();
      const service = (req.query.service || "NORMAL").toUpperCase().trim();

      const originPfx  = origin === "CHINA" ? "CHN" : origin === "EUROPA" ? "EUR" : "USA";
      const servicePfx = service === "EXPRESS" ? "E" : service === "TECH_PREMIUM" ? "T" : "N";
      const prefix     = `${originPfx}-${servicePfx}-`;

      const q = await db.query(
        `SELECT COUNT(*) AS cnt FROM shipments WHERE code LIKE $1`,
        [`${prefix}%`]
      );
      const next = Number(q.rows[0]?.cnt || 0) + 1;
      const code = `${prefix}${String(next).padStart(4, "0")}`;

      const exists = await db.query(`SELECT id FROM shipments WHERE code = $1`, [code]);
      if (exists.rows[0]) {
        const maxQ = await db.query(
          `SELECT code FROM shipments WHERE code LIKE $1 ORDER BY code DESC LIMIT 1`,
          [`${prefix}%`]
        );
        const lastNum = parseInt(
          (maxQ.rows[0]?.code || `${prefix}0000`).replace(prefix, ""), 10
        ) || 0;
        return res.json({ code: `${prefix}${String(lastNum + 1).padStart(4, "0")}`, prefix });
      }

      res.json({ code, prefix });
    } catch (e) {
      console.error("NEXT CODE ERROR", e);
      res.status(500).json({ error: "Error generando código" });
    }
  }
);

// ════════════════════════════════════════════════════════════════════
// ✅ LEMON COINS ROUTER
// ════════════════════════════════════════════════════════════════════
app.use("/coins",         coinsRouter);
app.use("/notifications", notificationsRouter);
app.use("/",             founderIntelligenceRouter);
// ── Rutas AI settings — JWT operador/admin (van ANTES del aiRouter) ──────────
function verifyJwtOperator(req) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw new Error("No autorizado");
  const decoded = jwt.verify(token, JWT_SECRET);
  if (!["operator","admin"].includes(decoded.role)) throw new Error("Sin permisos");
  return decoded;
}

app.get("/api/ai/settings", async (req, res) => {
  try {
    verifyJwtOperator(req);
    const rows = await db.query(`SELECT key, value FROM ai_settings`);
    const raw = {};
    rows.rows.forEach(r => { raw[r.key] = r.value; });
    const settings = {
      global_enabled:   raw.global_enabled   === "true",
      limoncin_enabled: raw.limoncin_enabled  === "true",
      whatsapp_enabled: raw.whatsapp_enabled  === "true",
      telegram_enabled: raw.telegram_enabled  === "true",
      blocked_wa_chats: JSON.parse(raw.blocked_wa_chats || "[]"),
    };
    res.json({ ok: true, settings });
  } catch(e) { res.status(401).json({ error: e.message }); }
});

app.post("/api/ai/settings", async (req, res) => {
  try {
    verifyJwtOperator(req);
    const allowed = ["global_enabled","limoncin_enabled","whatsapp_enabled","telegram_enabled"];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    for (const [key, val] of updates) {
      await db.query(
        `INSERT INTO ai_settings (key,value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [key, String(val)]
      );
    }
    res.json({ ok: true });
  } catch(e) { res.status(401).json({ error: e.message }); }
});

app.post("/api/ai/settings/block-chat", async (req, res) => {
  try {
    verifyJwtOperator(req);
    const { jid, label } = req.body;
    if (!jid?.trim()) return res.status(400).json({ error: "Requerido: jid" });
    const q = await db.query(`SELECT value FROM ai_settings WHERE key='blocked_wa_chats'`);
    let blocked = [];
    try { blocked = JSON.parse(q.rows[0]?.value || "[]"); } catch { blocked = []; }
    if (!blocked.find(b => b.jid === jid.trim())) {
      blocked.push({ jid: jid.trim(), label: label?.trim() || jid.trim() });
    }
    await db.query(
      `INSERT INTO ai_settings (key,value) VALUES ('blocked_wa_chats',$1)
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [JSON.stringify(blocked)]
    );
    res.json({ ok: true, blocked });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/ai/settings/unblock-chat", async (req, res) => {
  try {
    verifyJwtOperator(req);
    const { jid } = req.body;
    if (!jid?.trim()) return res.status(400).json({ error: "Requerido: jid" });
    const q = await db.query(`SELECT value FROM ai_settings WHERE key='blocked_wa_chats'`);
    let blocked = [];
    try { blocked = JSON.parse(q.rows[0]?.value || "[]"); } catch { blocked = []; }
    blocked = blocked.filter(b => b.jid !== jid.trim());
    await db.query(
      `INSERT INTO ai_settings (key,value) VALUES ('blocked_wa_chats',$1)
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [JSON.stringify(blocked)]
    );
    res.json({ ok: true, blocked });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
// ─────────────────────────────────────────────────────────────────────────────

app.use("/api/wa/crm", waCRMRouter);
app.use("/api/instagram", instagramRouter);
app.use("/api/instagram-content", instagramContentRouter);
app.use("/api/instagram-ads", instagramAdsRouter);
app.use("/api/chat", chatRouter);
app.use("/profile",       profileRouter);
app.use("/auth/webauthn", webauthnRouter);

// ── Reclamar bonus primer envío (cliente) ──────────────────────────
app.post("/coins/claim-first-bonus", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    // Verificar que el cliente tiene al menos un envío entregado
    const shipQ = await db.query(
      `SELECT id FROM shipments WHERE user_id=$1 AND status='Entregado' LIMIT 1`,
      [userId]
    );
    if (!shipQ.rows[0]) {
      return res.status(400).json({ error: "No tenés envíos entregados todavía." });
    }

    // Verificar que no se otorgó antes
    const userQ = await db.query(
      `SELECT first_shipment_bonus_given FROM users WHERE id=$1`,
      [userId]
    );
    if (userQ.rows[0]?.first_shipment_bonus_given) {
      return res.status(400).json({ error: "Ya reclamaste el bonus de primer envío." });
    }

    // Verificar que no existe ya una transacción de este tipo
    const txQ = await db.query(
      `SELECT id FROM coin_transactions WHERE user_id=$1 AND reason LIKE '%primer envío%' LIMIT 1`,
      [userId]
    );
    if (txQ.rows[0]) {
      return res.status(400).json({ error: "Ya reclamaste el bonus de primer envío." });
    }

    const BONUS = 15;

    await db.query(
      `INSERT INTO lemon_coins (user_id, balance, total_earned)
       VALUES ($1,0,0) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    await db.query(
      `INSERT INTO coin_transactions (user_id, type, amount, reason)
       VALUES ($1,'earn',$2,'🎉 Bonus primer envío completado')`,
      [userId, BONUS]
    );
    await db.query(
      `UPDATE lemon_coins SET balance=balance+$1, total_earned=total_earned+$1, updated_at=NOW()
       WHERE user_id=$2`,
      [BONUS, userId]
    );
    await db.query(
      `UPDATE users SET first_shipment_bonus_given=TRUE WHERE id=$1`,
      [userId]
    );

    res.json({ ok: true, coins: BONUS, message: `+${BONUS} Lemon Coins acreditados 🎉` });
  } catch (e) {
    console.error("[COINS] claim-first-bonus error:", e.message);
    res.status(500).json({ error: "Error al reclamar bonus" });
  }
});


// ── POST /api/client/update-contact-phone — guardar número WA del cliente ──
// Funciona de dos formas:
// 1. Con JWT (cliente logueado): solo manda phone
// 2. Sin JWT: manda clientNumber + email + phone (para clientes no logueados)
app.post("/api/client/update-contact-phone", async (req, res) => {
  try {
    const { phone, clientNumber, email } = req.body || {};
    const rawPhone = String(phone || "").replace(/\D/g, "");
    if (!rawPhone || rawPhone.length < 10) {
      return res.status(400).json({ error: "Número de WhatsApp inválido. Formato: 549..." });
    }

    let userId = null;

    // Intentar autenticación por JWT primero
    const auth = req.headers["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch {}
    }

    // Si no hay JWT, buscar por clientNumber + email
    if (!userId) {
      if (!clientNumber || !email) {
        return res.status(400).json({ error: "Ingresá número de cliente y email" });
      }
      const u = await db.query(
        "SELECT id FROM users WHERE client_number=$1 AND email=$2",
        [parseInt(clientNumber, 10), email.toLowerCase().trim()]
      );
      if (!u.rows[0]) {
        return res.status(404).json({ error: "No encontramos una cuenta con esos datos" });
      }
      userId = u.rows[0].id;
    }

    // Agregar columna si no existe
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT").catch(() => {});

    await db.query("UPDATE users SET phone=$1 WHERE id=$2", [rawPhone, userId]);
    console.log("[PHONE UPDATE]", { userId, phone: rawPhone });

    // Verificar mision perfil completo (telefono + bio + foto)
    try {
      const profileQ = await db.query(
        `SELECT up.bio, up.avatar_url, u.phone
         FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id
         WHERE u.id=$1`, [userId]
      );
      const p = profileQ.rows[0];
      if (p?.bio && (p?.avatar_url || rawPhone)) {
        await db.query(
          `INSERT INTO user_missions (user_id, mission_slug, progress, completed_at, period)
           VALUES ($1,'onetime_profile',1,NOW(),'forever')
           ON CONFLICT (user_id, mission_slug, period) DO UPDATE
           SET completed_at=COALESCE(user_missions.completed_at, NOW()), progress=1`,
          [userId]
        );
      }
    } catch(me) { console.log("[MISSION] phone profile check:", me.message); }

    res.json({ ok: true, phone: rawPhone });
  } catch (e) {
    console.error("[PHONE UPDATE ERROR]", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

startShipmentAutomationLoop();

// Limpiar invite codes vencidos cada hora
setInterval(async () => {
  try {
    const r = await db.query(`DELETE FROM invite_codes WHERE expires_at < NOW() AND used_by IS NULL`);
    if (r.rowCount > 0) console.log(`[INVITES] ${r.rowCount} códigos vencidos eliminados`);
  } catch(e) { console.error("[INVITES CLEANUP]", e.message); }
}, 60 * 60 * 1000);

const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, credentials: true }
});
app.set("io", io);

// ── Socket.io auth middleware ─────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No autorizado"));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch {
    next(new Error("Token inválido"));
  }
});

// ── Socket.io chat handler ────────────────────────────────────────────────────
io.on("connection", (socket) => {
  const user = socket.user;
  console.log("[CHAT] conectado:", user.id);

  socket.on("join_room", async ({ slug }) => {
    try {
      const roomQ = await db.query(`SELECT * FROM chat_rooms WHERE slug=$1`, [slug]);
      const room = roomQ.rows[0];
      if (!room) return;

      // Verificar acceso
      if (room.coins_required > 0) {
        const accessQ = await db.query(
          `SELECT id FROM chat_room_access WHERE user_id=$1 AND room_id=$2`,
          [user.id, room.id]
        );
        if (!accessQ.rows[0]) {
          socket.emit("error", { message: "Sin acceso a este room" });
          return;
        }
      }

      socket.join(`room:${slug}`);

      // Avisar a todos que alguien entró
      const uQ = await db.query(`
        SELECT u.name, u.client_number, u.role AS user_role,
               up.name_color, up.name_glow_color, up.name_glow,
               up.name_grad_from, up.name_grad_to,
               up.nickname, up.nick_color, up.nick_glow, up.icon_slug,
               up.avatar_key, up.frame_key, up.avatar_url,
               COALESCE(cr.role, 'member') AS chat_role
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN chat_user_roles cr ON cr.user_id = u.id AND cr.room_id = (
          SELECT id FROM chat_rooms WHERE slug=$2 LIMIT 1
        )
        WHERE u.id = $1
      `, [user.id, slug]);
      io.to(`room:${slug}`).emit("user_joined", {
        user_id: user.id,
        user_name: uQ.rows[0]?.name,
        client_number: uQ.rows[0]?.client_number,
        user_role: uQ.rows[0]?.user_role,
        chat_role: uQ.rows[0]?.chat_role,
        name_color: uQ.rows[0]?.name_color,
        name_glow_color: uQ.rows[0]?.name_glow_color,
        name_glow: uQ.rows[0]?.name_glow,
        name_grad_from: uQ.rows[0]?.name_grad_from,
        name_grad_to: uQ.rows[0]?.name_grad_to,
        nickname: uQ.rows[0]?.nickname,
        nick_color: uQ.rows[0]?.nick_color,
        nick_glow: uQ.rows[0]?.nick_glow,
        icon_slug: uQ.rows[0]?.icon_slug,
        avatar_key: uQ.rows[0]?.avatar_key,
        avatar_url: uQ.rows[0]?.avatar_url,
      });

      console.log("[CHAT] user", user.id, "joined room:", slug);

      // Enviar al nuevo usuario la lista de todos los ya conectados en el room
      const roomSockets = await io.in(`room:${slug}`).fetchSockets();
      const connectedUserIds = roomSockets
        .map(s => s.user?.id)
        .filter(id => id && id !== user.id);

      if (connectedUserIds.length > 0) {
        const usersQ = await db.query(`
          SELECT u.id AS user_id, u.name AS user_name, u.client_number, u.role AS user_role,
                 up.name_color, up.name_glow_color, up.name_glow,
                 up.name_grad_from, up.name_grad_to,
                 up.nickname, up.nick_color, up.nick_glow, up.icon_slug,
                 COALESCE(cr.role, 'member') AS chat_role
          FROM users u
          LEFT JOIN user_profiles up ON up.user_id = u.id
          LEFT JOIN chat_user_roles cr ON cr.user_id = u.id AND cr.room_id = $2
          WHERE u.id = ANY($1)
        `, [connectedUserIds, room.id]);

        socket.emit("room_users", { users: usersQ.rows });
      }
    } catch (e) {
      console.error("[CHAT JOIN ERROR]", e.message);
    }
  });

  socket.on("leave_room", ({ slug }) => {
    socket.leave(`room:${slug}`);
    io.to(`room:${slug}`).emit("user_left", { user_id: user.id });
  });

  socket.on("send_message", async ({ slug, message }) => {
    try {
      // Sanitize estricto: trim, max 1000, sin tags HTML/scripts
      const msg = sanitizeText(message, 1000);
      if (!msg || !slug || typeof slug !== "string" || slug.length > 60) return;

      const roomQ = await db.query(`SELECT * FROM chat_rooms WHERE slug=$1`, [slug]);
      const room = roomQ.rows[0];
      if (!room) return;

      // Verificar acceso
      if (room.coins_required > 0) {
        const accessQ = await db.query(
          `SELECT id FROM chat_room_access WHERE user_id=$1 AND room_id=$2`,
          [user.id, room.id]
        );
        if (!accessQ.rows[0]) return;
      }

      // Guardar mensaje
      const ins = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, message) VALUES ($1,$2,$3) RETURNING id, created_at`,
        [room.id, user.id, msg]
      );

      const uQ = await db.query(`
        SELECT u.name, u.client_number, u.role AS user_role,
               up.name_color, up.name_glow_color, up.name_glow,
               up.name_grad_from, up.name_grad_to,
               up.nickname, up.nick_color, up.nick_glow, up.icon_slug, up.avatar_url,
               COALESCE(cr.role, 'member') AS chat_role
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        LEFT JOIN chat_user_roles cr ON cr.user_id = u.id AND cr.room_id = $2
        WHERE u.id = $1
      `, [user.id, room.id]);

      const payload = {
        id: ins.rows[0].id,
        message: msg,
        created_at: ins.rows[0].created_at,
        user_id: user.id,
        user_name: uQ.rows[0]?.name,
        client_number: uQ.rows[0]?.client_number,
        user_role: uQ.rows[0]?.user_role,
        chat_role: uQ.rows[0]?.chat_role,
        name_color: uQ.rows[0]?.name_color,
        name_glow_color: uQ.rows[0]?.name_glow_color,
        name_glow: uQ.rows[0]?.name_glow,
        name_grad_from: uQ.rows[0]?.name_grad_from,
        name_grad_to: uQ.rows[0]?.name_grad_to,
        nickname: uQ.rows[0]?.nickname,
        nick_color: uQ.rows[0]?.nick_color,
        nick_glow: uQ.rows[0]?.nick_glow,
        icon_slug: uQ.rows[0]?.icon_slug,
        avatar_url: uQ.rows[0]?.avatar_url,
      };

      io.to(`room:${slug}`).emit("new_message", payload);
      // Mision chat diario
      checkMissions(user.id, 'chat_message').catch(()=>{});
    } catch (e) {
      console.error("[CHAT MSG ERROR]", e.message);
    }
  });

  // ── Mensaje privado ──────────────────────────────────────────────────────────
  socket.on("private_message", async ({ to_user_id, message }) => {
    try {
      const msg = String(message || "").trim().slice(0, 1000);
      if (!msg || !to_user_id) return;

      // Guardar en DB
      const ins = await db.query(`
        INSERT INTO chat_private_messages (from_user_id, to_user_id, message)
        VALUES ($1,$2,$3) RETURNING id, created_at
      `, [user.id, to_user_id, msg]);

      const uQ = await db.query(`
        SELECT u.name, u.client_number, u.role,
               up.name_color, up.name_glow, up.name_glow_color, up.icon_slug, up.nickname
        FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id WHERE u.id=$1
      `, [user.id]);

      const payload = {
        id: ins.rows[0].id,
        message: msg,
        created_at: ins.rows[0].created_at,
        from_user_id: user.id,
        to_user_id,
        from_name: uQ.rows[0]?.name,
        client_number: uQ.rows[0]?.client_number,
        user_role: uQ.rows[0]?.role,
        name_color: uQ.rows[0]?.name_color,
        name_glow: uQ.rows[0]?.name_glow,
        icon_slug: uQ.rows[0]?.icon_slug,
        nickname: uQ.rows[0]?.nickname,
      };

      // Emitir al destinatario si está conectado
      const allSockets = await io.fetchSockets();
      const targetSocket = allSockets.find(s => s.user?.id === to_user_id);
      if (targetSocket) targetSocket.emit("private_message", payload);

      // Confirmar al emisor
      socket.emit("private_message", payload);

    } catch (e) {
      console.error("[PRIVATE MSG ERROR]", e.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("[CHAT] desconectado:", user.id);
  });
});

// Limpiar mensajes de más de 24hs cada hora
setInterval(async () => {
  try {
    const r = await db.query(`DELETE FROM chat_messages WHERE created_at < NOW() - INTERVAL '24 hours'`);
    if (r.rowCount > 0) console.log("[CHAT CLEANUP]", r.rowCount, "mensajes eliminados");
  } catch (e) {
    console.error("[CHAT CLEANUP ERROR]", e.message);
  }
}, 60 * 60 * 1000);

httpServer.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});

// Servir frontend
const path = require("path");
const distPath = path.join(__dirname, "../client/dist");
// ── POSTS / FEED ─────────────────────────────────────────────────────────────
app.get("/api/posts/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { rows } = await db.query(`
      SELECT p.*, u.name as author_name,
        (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id) as likes,
        (SELECT COUNT(*) FROM post_comments WHERE post_id=p.id) as comments,
        (SELECT EXISTS(SELECT 1 FROM post_likes WHERE post_id=p.id AND user_id=$2)) as liked
      FROM user_posts p JOIN users u ON u.id=p.user_id
      WHERE p.user_id=$1 ORDER BY p.created_at DESC LIMIT 50
    `, [userId, req.user?.id || 0]);
    res.json({ ok: true, posts: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/posts", authRequired, async (req, res) => {
  try {
    const { body, category } = req.body;
    const safeBody = sanitizeText(body, 2000);
    if (!safeBody) return res.status(400).json({ error: "Cuerpo vacío" });
    const safeCat = sanitizeText(category || "Texto", 30);
    const { rows } = await db.query(
      `INSERT INTO user_posts(user_id,body,category) VALUES($1,$2,$3) RETURNING *`,
      [req.user.id, safeBody, safeCat]
    );
    res.json({ ok: true, post: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/post/:id", authRequired, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT user_id FROM user_posts WHERE id=$1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    if (rows[0].user_id !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Sin permiso" });
    await db.query(`DELETE FROM user_posts WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/post/:id/like", authRequired, async (req, res) => {
  try {
    const exists = await db.query(`SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    if (exists.rows.length) {
      await db.query(`DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    } else {
      await db.query(`INSERT INTO post_likes(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, req.user.id]);
      // Notificar al dueño del post
      try {
        const post = await db.query(`SELECT user_id FROM user_posts WHERE id=$1`, [req.params.id]);
        const liker = await db.query(`SELECT name, username FROM users WHERE id=$1`, [req.user.id]);
        if (post.rows[0] && post.rows[0].user_id !== req.user.id) {
          const lname = liker.rows[0]?.name || "Alguien";
          await db.query(
            "INSERT INTO notifications(user_id, type, title, body, link, actor_id) VALUES($1,$2,$3,$4,$5,$6)",
            [post.rows[0].user_id, "like", "❤️ Nuevo like", `${lname} le dio like a tu post`, liker.rows[0]?.username ? `/perfil/${liker.rows[0].username}` : null, req.user.id]
          );
        }
      } catch(ne) { console.error("[NOTIF like]", ne.message); }
    }
    const { rows } = await db.query(`SELECT COUNT(*) as likes FROM post_likes WHERE post_id=$1`, [req.params.id]);
    res.json({ ok: true, likes: Number(rows[0].likes), liked: !exists.rows.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/post/:id/comments", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*, u.name as author_name, u.username,
        up.avatar_url, up.name_color, up.name_glow_color, up.name_glow,
        up.name_grad_from, up.name_grad_to
      FROM post_comments c
      JOIN users u ON u.id=c.user_id
      LEFT JOIN user_profiles up ON up.user_id=c.user_id
      WHERE c.post_id=$1 ORDER BY c.created_at ASC
    `, [req.params.id]);
    res.json({ ok: true, comments: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/post/:id/comments", authRequired, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    if (!postId) return res.status(400).json({ error: "ID inválido" });
    const safeBody = sanitizeText(req.body?.body, 800);
    if (!safeBody) return res.status(400).json({ error: "Comentario vacío" });
    const { rows } = await db.query(
      `INSERT INTO post_comments(post_id,user_id,body) VALUES($1,$2,$3) RETURNING *`,
      [postId, req.user.id, safeBody]
    );
    // Notificar al dueño del post
    try {
      const post = await db.query(`SELECT user_id FROM user_posts WHERE id=$1`, [req.params.id]);
      const commenter = await db.query(`SELECT name, username FROM users WHERE id=$1`, [req.user.id]);
      if (post.rows[0] && post.rows[0].user_id !== req.user.id) {
        const cname = commenter.rows[0]?.name || "Alguien";
        await db.query(
          "INSERT INTO notifications(user_id, type, title, body, link, actor_id) VALUES($1,$2,$3,$4,$5,$6)",
          [post.rows[0].user_id, "comment", "💬 Nuevo comentario", `${cname} comentó en tu post`, commenter.rows[0]?.username ? `/perfil/${commenter.rows[0].username}` : null, req.user.id]
        );
      }
    } catch(ne) { console.error("[NOTIF comment]", ne.message); }
    res.json({ ok: true, comment: rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── USERNAME / PERFIL PUBLICO ─────────────────────────────────────────────────
app.patch("/profile/username", authRequired, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username?.trim()) return res.status(400).json({ error: "Username vacío" });
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (clean.length < 3) return res.status(400).json({ error: "Mínimo 3 caracteres" });
    const exists = await db.query("SELECT id FROM users WHERE username=$1 AND id!=$2", [clean, req.user.id]);
    if (exists.rows.length) return res.status(400).json({ error: "Ese username ya está en uso" });
    await db.query("UPDATE users SET username=$1 WHERE id=$2", [clean, req.user.id]);
    res.json({ ok: true, username: clean });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/profile/u/:username", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT id FROM users WHERE username=$1", [req.params.username.toLowerCase()]);
    if (!rows.length) return res.status(404).json({ error: "Usuario no encontrado" });
    const uid = rows[0].id;
    const { rows: profile } = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.client_number, u.username,
        up.bio, up.avatar_key, up.frame_key, up.title_key, up.badges, up.avatar_url,
        up.banner_effect, up.banner_color1, up.banner_color2,
        up.custom_name, up.name_color, up.name_glow_color, up.name_glow,
        up.privacy_envios, up.privacy_coins, up.privacy_logros, up.privacy_posts, up.privacy_amigos,
        up.features_unlocked
      FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id
      WHERE u.id=$1
    `, [uid]);
    if (!profile.length) return res.status(404).json({ error: "Perfil no encontrado" });
    const p = profile[0];
    const { rows: stats } = await db.query(`
      SELECT COUNT(*)::int as total_shipments,
        COUNT(*) FILTER (WHERE status='Entregado')::int as delivered,
        COALESCE(SUM(estimated_usd),0)::float as total_usd
      FROM shipments WHERE user_id=$1
    `, [uid]);
    const { rows: coins } = await db.query("SELECT COALESCE(balance,0) as balance, COALESCE(total_earned,0) as total_earned FROM lemon_coins WHERE user_id=$1", [uid]);
    const { rows: items } = await db.query("SELECT item_key FROM user_items WHERE user_id=$1", [uid]);
    const owned_items = items.map(i => i.item_key);
    res.json({ user: p, profile: { ...p, owned_items }, stats: stats[0], coins: coins[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── FOLLOWS ──────────────────────────────────────────────────────────────────
app.post("/api/follow/:userId", authRequired, async (req, res) => {
  try {
    const followingId = Number(req.params.userId);
    if (followingId === req.user.id) return res.status(400).json({ error: "No podés seguirte a vos mismo" });
    const result = await db.query(
      "INSERT INTO user_follows(follower_id, following_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id",
      [req.user.id, followingId]
    );
    // Notificación al usuario seguido
    if (result.rows.length) {
      const follower = await db.query("SELECT name, username FROM users WHERE id=$1", [req.user.id]);
      const fname = follower.rows[0]?.name || "Alguien";
      const fusername = follower.rows[0]?.username;
      await db.query(
        "INSERT INTO notifications(user_id, type, title, body, link) VALUES($1,$2,$3,$4,$5)",
        [followingId, "follow", "Nuevo seguidor", `${fname} empezó a seguirte`, fusername ? `/perfil/${fusername}` : null]
      );
    }
    const { rows } = await db.query("SELECT COUNT(*) as cnt FROM user_follows WHERE following_id=$1", [followingId]);
    res.json({ ok: true, followers: Number(rows[0].cnt) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/follow/:userId", authRequired, async (req, res) => {
  try {
    const followingId = Number(req.params.userId);
    await db.query("DELETE FROM user_follows WHERE follower_id=$1 AND following_id=$2", [req.user.id, followingId]);
    const { rows } = await db.query("SELECT COUNT(*) as cnt FROM user_follows WHERE following_id=$1", [followingId]);
    res.json({ ok: true, followers: Number(rows[0].cnt) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/follow/:userId", authRequired, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const [fwrs, fwing, isFollowing] = await Promise.all([
      db.query("SELECT COUNT(*) as cnt FROM user_follows WHERE following_id=$1", [userId]),
      db.query("SELECT COUNT(*) as cnt FROM user_follows WHERE follower_id=$1", [userId]),
      db.query("SELECT 1 FROM user_follows WHERE follower_id=$1 AND following_id=$2", [req.user.id, userId]),
    ]);
    res.json({ ok: true, followers: Number(fwrs.rows[0].cnt), following: Number(fwing.rows[0].cnt), isFollowing: isFollowing.rows.length > 0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
app.get("/api/notifications", authRequired, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT n.*, 
        actor.name as actor_name, actor.username as actor_username,
        up.avatar_url as actor_avatar, up.name_color as actor_name_color,
        up.name_glow_color as actor_glow_color, up.name_glow as actor_glow,
        up.name_grad_from as actor_grad_from, up.name_grad_to as actor_grad_to
      FROM notifications n
      LEFT JOIN users actor ON actor.id = n.actor_id
      LEFT JOIN user_profiles up ON up.user_id = actor.id
      WHERE n.user_id=$1 
      ORDER BY n.created_at DESC LIMIT 50
    `, [req.user.id]);
    const unread = rows.filter(r => !r.read).length;
    res.json({ ok: true, notifications: rows, unread });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/notifications/read", authRequired, async (req, res) => {
  try {
    const { ids } = req.body;
    if (ids && ids.length) {
      await db.query("UPDATE notifications SET read=TRUE WHERE id=ANY($1) AND user_id=$2", [ids, req.user.id]);
    } else {
      await db.query("UPDATE notifications SET read=TRUE WHERE user_id=$1", [req.user.id]);
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static(distPath));
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ── Error handler global → Telegram + log ─────────────────────────────────────
const telegram = require("./services/telegram");
app.use((err, req, res, next) => {
  // CORS error → 403 sin notificar (es spam)
  if (err && err.message && err.message.startsWith("Not allowed by CORS")) {
    return res.status(403).json({ error: "Origin no permitido" });
  }
  const status = err.status || err.statusCode || 500;
  // Solo 5xx van a Telegram (4xx son errores de cliente)
  if (status >= 500) {
    console.error(`[ERROR ${status}] ${req.method} ${req.originalUrl}`, err.message);
    telegram.notifyError({
      method: req.method,
      url: req.originalUrl,
      status,
      message: err.message || String(err),
      stack: err.stack,
      userId: req.user?.id,
      ip: req.ip,
    }).catch(() => {});
  }
  res.status(status).json({ error: status >= 500 ? "Error interno" : (err.message || "Error") });
});

// Aviso al boot — confirma config
if (telegram.isConfigured()) {
  telegram.notify(`✅ <b>${process.env.APP_NAME || "Lemon's Portal"}</b> backend iniciado · ${new Date().toISOString()}`).catch(()=>{});
} else {
  console.warn("[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no seteados — notificaciones desactivadas.");
}
// ── Migraciones post-arranque ─────────────────────────────────────────────────
(async () => {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS ai_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())`);
    const defaults = [
      ["global_enabled",   "true"],
      ["limoncin_enabled", "false"],
      ["whatsapp_enabled", "false"],
      ["telegram_enabled", "true"],
      ["blocked_wa_chats", "[]"],
    ];
    for (const [key, value] of defaults) {
      await db.query(`INSERT INTO ai_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`, [key, value]);
    }
    console.log("[MIGRATION] ai_settings table ready");
  } catch(e) { console.error("[MIGRATION ai_settings ERROR]", e.message); }
})();

// ── Crons IG (FASE B/C) ───────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production" || process.env.IG_ENABLE_CRON === "true") {
  try {
    require("./jobs/content-ideas").startContentIdeasCron();
    console.log("[IG-CONTENT] cron de ideas iniciado (TZ America/Argentina/Buenos_Aires, 7am)");
  } catch (e) {
    console.error("[IG-CONTENT cron init ERROR]", e.message);
  }
  try {
    require("./jobs/publisher").startPublisherCron();
    console.log("[IG-PUBLISHER] cron iniciado (cada 1 min)");
  } catch (e) {
    console.error("[IG-PUBLISHER cron init ERROR]", e.message);
  }
  try {
    require("./jobs/stories").startStoriesCron();
    console.log("[IG-STORIES] cron iniciado (11am BA, daily)");
  } catch (e) {
    console.error("[IG-STORIES cron init ERROR]", e.message);
  }
  try {
    require("./jobs/ig-token-refresh").startIgTokenRefreshCron();
    console.log("[IG-TOKEN] cron healthcheck iniciado (diario 4am BA)");
  } catch (e) {
    console.error("[IG-TOKEN cron init ERROR]", e.message);
  }
  try {
    require("./jobs/meta-token-refresh").startMetaTokenHealthcheckCron();
    console.log("[META-TOKEN] cron healthcheck iniciado (diario 4am UTC)");
  } catch (e) {
    console.error("[META-TOKEN cron init ERROR]", e.message);
  }
} else {
  console.log("[IG-CONTENT] cron deshabilitado");
  console.log("[IG-PUBLISHER] cron deshabilitado");
  console.log("[IG-STORIES] cron deshabilitado");
  console.log("[META-TOKEN] cron deshabilitado");
}
// force redeploy Sun Apr 19 00:33:45 UTC 2026
