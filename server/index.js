// Carga .env buscando primero en server/.env, luego en la raíz del repo.
// Permite tanto setup standalone (server/.env) como monorepo (.env en raíz).
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
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
const {
  loginSlowDown,
  noStore,
  assertJwtSecret,
  sanitizeText,
  sanitizeRichText,
} = require("./security");
const coinsRouter         = require("./routes/coins");         // ✅ Coins
const notificationsRouter = require("./routes/notifications"); // ✅ Notificaciones in-app (broadcast)
const profileRouter       = require("./routes/profile");         // 👤 Perfil de usuario
const chatRouter         = require("./routes/chat");
const webauthnRouter     = require("./routes/webauthn");
const adminConfig        = require("./routes/admin-config");    // 🪄 Setup wizard endpoints
const adminFeed          = require("./routes/admin-feed");      // 📰 Feed editor del admin
const adminUsers         = require("./routes/admin-users");     // 👥 Coins manager + lista users
const shop               = require("./routes/shop");             // 🛒 Shop fase 1: catálogo + admin productos
const checkout           = require("./routes/checkout");          // 💳 Shop fase 2: checkout + MercadoPago + orders
const { requireFeature } = require("./lib/featureFlags");        // 🚦 Toggle de features
const { REFERRAL_MAX_PER_USER } = require("./lib/referrals");    // 🤝 Tope de invitaciones
const configStore = require("./lib/configStore");                // ⚙️ Reglas del wizard (signup_mode)

const app = express();

// Versión vigente de los documentos legales (Términos y Condiciones + Privacidad).
// Se guarda junto a la aceptación de cada usuario como evidencia de qué texto aceptó.
const TERMS_VERSION = "2026-06-27";

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

// CORS — orígenes permitidos. En dev permitimos localhost y Codespaces
// (cualquier subdominio *.app.github.dev). En prod sumamos APP_URL del .env
// y su variante www (el apex y www redirigen entre sí a nivel Vercel, pero
// durante la ventana del redirect el browser manda el Origin en el que está).
const APP_ORIGIN = (process.env.APP_URL || "").replace(/\/+$/, "");
const APP_ORIGIN_WWW = APP_ORIGIN.replace(/^https:\/\/(?!www\.)/, "https://www.");
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",   // vite preview
  APP_ORIGIN,
  APP_ORIGIN_WWW !== APP_ORIGIN ? APP_ORIGIN_WWW : null,
].filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;                            // server-to-server (curl, Postman)
  if (allowedOrigins.includes(origin)) return true;
  // Codespaces dev: *.app.github.dev
  if (/^https:\/\/[a-z0-9-]+-\d+\.app\.github\.dev$/.test(origin)) return true;
  return false;
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// Branding: carga inicial síncrona del JSON para endpoints sync (/, /privacy).
// Para emails y otros lugares async, se usa getBranding() que pulla de
// configStore (con overrides del wizard) — ver server/lib/branding.js.
let BRANDING = { name: "Mi Portal", color_primary: "#3B82F6", color_accent: "#F59E0B" };
try { BRANDING = require("../branding.json"); } catch (e) { /* fallback in-memory */ }
const { getBranding } = require("./lib/branding");

// Nota: NO definimos un handler para "/" acá — ese path lo atiende el SPA
// fallback al final del archivo (sirve index.html del cliente con branding
// server-side rendered). Para health-check usá /health.

app.get("/health", (_req, res) => res.json({ ok: true }));

// Versión desplegada: Render expone RENDER_GIT_COMMIT en runtime. Sirve para
// verificar de afuera qué commit corre la API (ej. tras un "Deploy latest
// commit"): curl https://<api>/api/version. Si dice "unknown", o no está este
// endpoint, la API corre código anterior a este commit.
app.get("/api/version", (_req, res) =>
  res.json({
    commit: process.env.RENDER_GIT_COMMIT || "unknown",
    branch: process.env.RENDER_GIT_BRANCH || null,
    service: process.env.RENDER_SERVICE_NAME || null,
  })
);

app.get("/privacy", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  const today = new Date().toISOString().slice(0, 10);
  res.send(`<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Política de Privacidad — ${BRANDING.name}</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0a0a0a;color:#e5e5e5;line-height:1.6}
  main{max-width:720px;margin:0 auto;padding:48px 24px}
  h1{color:${BRANDING.color_primary};font-size:32px;margin:0 0 8px}
  .sub{color:#888;font-size:14px;margin-bottom:32px}
  h2{color:#fff;font-size:20px;margin:32px 0 8px}
  p,li{color:#d4d4d4}
  a{color:${BRANDING.color_primary}}
  hr{border:none;border-top:1px solid #222;margin:32px 0}
  .placeholder{padding:14px 18px;border:1px dashed #444;border-radius:8px;color:#999;font-size:13px;background:#111;margin:18px 0}
  footer{color:#666;font-size:12px;text-align:center;margin-top:48px}
</style></head>
<body><main>
<h1>Política de Privacidad</h1>
<div class="sub">${BRANDING.name} · Última actualización: ${today}</div>

<div class="placeholder">
⚠ Plantilla genérica. Reemplazá con tu propia política antes de salir a
producción. El admin puede editar este texto en /admin/settings (cuando
el wizard del Sprint 2/3 esté activo).
</div>

<h2>1. Quiénes somos</h2>
<p>${BRANDING.name} es una plataforma de comunidad/portal para usuarios registrados.</p>

<h2>2. Datos que recopilamos</h2>
<ul>
<li><b>Datos de cuenta:</b> email, nombre, rol (cliente / operador / admin).</li>
<li><b>Datos de uso:</b> mensajes, posts, fotos de perfil, interacciones sociales (likes, follows, comentarios) que cargás voluntariamente.</li>
<li><b>Datos técnicos:</b> dirección IP, user agent, timestamps de actividad para detección de abuso y métricas básicas.</li>
</ul>

<h2>3. Uso de los datos</h2>
<p>Los datos se utilizan exclusivamente para:</p>
<ul>
<li>Operar el portal (autenticación, perfiles, mensajería entre usuarios).</li>
<li>Notificaciones por email transaccionales (verificación, reset de contraseña).</li>
<li>Métricas internas para mejorar el producto (sin venta a terceros).</li>
</ul>
<p>No vendemos, alquilamos ni compartimos datos personales con terceros para fines comerciales.</p>

<h2>4. Almacenamiento y seguridad</h2>
<p>Los datos se almacenan en una base de datos PostgreSQL con cifrado en tránsito (TLS) y en reposo. El acceso al portal está protegido con autenticación JWT y control de roles. Las API keys de proveedores externos están cifradas con AES-256-GCM en la base de datos.</p>

<h2>5. Servicios de terceros</h2>
<p>Según las features que el admin tenga habilitadas, podemos usar: Neon (base de datos), Cloudinary (imágenes), Resend (emails transaccionales). Cada uno aplica sus propias políticas de privacidad.</p>

<h2>6. Derechos del usuario</h2>
<p>Tenés derecho a acceder, rectificar o eliminar tus datos personales en cualquier momento. Para ejercer estos derechos, contactá al administrador del portal.</p>

<h2>7. Eliminación de datos</h2>
<p>Podés solicitar la eliminación de tu cuenta y todos los datos asociados al administrador del portal. Procesamos la solicitud dentro de los 30 días.</p>

<h2>8. Contacto</h2>
<p>Administrador de ${BRANDING.name}.<br>
<i>Reemplazá este bloque con datos de contacto reales antes de producción.</i></p>

<hr>
<footer>© ${new Date().getFullYear()} ${BRANDING.name}</footer>
</main></body></html>`);
});

// ── WA Queue API (para bot WhatsApp en VPS) ──────────────────────────────────



// ── Auto-migraciones inline al arrancar ─────────────────────────────────────
// Las migrations principales viven en scripts/init-db.sql (se aplica una vez
// en setup). Estas inline son ALTER/CREATE idempotentes para tablas que
// pueden no existir todavía en clones viejos.

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

// ── Auto-migración: aceptación de Términos y Privacidad (evidencia legal) ─────
(async () => {
  try {
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_ip TEXT`);
    console.log("[MIGRATION] users.terms_accepted_* ready");
  } catch (e) { console.error("[MIGRATION terms ERROR]", e.message); }
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

// ==================== TARIFAS (defaults + helpers) ====================


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


// Descuento por volumen según kg del envío individual




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
      // 1) Marca la misión diaria como completada por ENTRAR (los coins se
      //    reclaman aparte desde /coins → Misiones; un único pago por día).
      await db.query(
        `INSERT INTO user_missions (user_id, mission_slug, progress, completed_at, period)
         VALUES ($1,'daily_login',1,NOW(),$2) ON CONFLICT DO NOTHING`,
        [userId, today]
      );

      // 2) Racha de días consecutivos — se guarda por ENTRAR (no por reclamar).
      //    Upsert ATÓMICO (evita doble conteo con requests concurrentes) e
      //    idempotente por día:
      //      · ya entró hoy      → no-op (WHERE last_login DISTINCT FROM hoy)
      //      · entró ayer        → streak + 1
      //      · se salteó un día  → reset a 1 (hoy arranca de nuevo)
      //    RETURNING sólo devuelve fila cuando REALMENTE avanzó hoy, así el
      //    bonus se evalúa una sola vez por día.
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const up = await db.query(
        `INSERT INTO login_streaks (user_id, streak, last_login)
         VALUES ($1, 1, $2::date)
         ON CONFLICT (user_id) DO UPDATE SET
           streak = CASE WHEN login_streaks.last_login = $3::date
                         THEN login_streaks.streak + 1 ELSE 1 END,
           last_login = $2::date,
           updated_at = NOW()
         WHERE login_streaks.last_login IS DISTINCT FROM $2::date
         RETURNING streak`,
        [userId, today, yesterday]
      );
      const newStreak = up.rows[0]?.streak;
      // Bonus recurrente cada 7 días seguidos (+10) — sin cortar la racha.
      if (newStreak && newStreak % 7 === 0) {
        await db.query(`INSERT INTO coins (user_id,balance,total_earned) VALUES ($1,0,0) ON CONFLICT (user_id) DO NOTHING`, [userId]);
        await db.query(`UPDATE coins SET balance=balance+10, total_earned=total_earned+10, updated_at=NOW() WHERE user_id=$1`, [userId]);
        await db.query(`INSERT INTO coin_transactions (user_id,type,amount,reason) VALUES ($1,'earn',10,$2)`, [userId, 'Bonus racha ' + newStreak + ' días']);
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
      // 1) Marca la misión diaria como completada por ENTRAR (los coins se
      //    reclaman aparte desde /coins → Misiones; un único pago por día).
      await db.query(
        `INSERT INTO user_missions (user_id, mission_slug, progress, completed_at, period)
         VALUES ($1,'daily_login',1,NOW(),$2) ON CONFLICT DO NOTHING`,
        [userId, today]
      );

      // 2) Racha de días consecutivos — se guarda por ENTRAR (no por reclamar).
      //    Upsert ATÓMICO (evita doble conteo con requests concurrentes) e
      //    idempotente por día:
      //      · ya entró hoy      → no-op (WHERE last_login DISTINCT FROM hoy)
      //      · entró ayer        → streak + 1
      //      · se salteó un día  → reset a 1 (hoy arranca de nuevo)
      //    RETURNING sólo devuelve fila cuando REALMENTE avanzó hoy, así el
      //    bonus se evalúa una sola vez por día.
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const up = await db.query(
        `INSERT INTO login_streaks (user_id, streak, last_login)
         VALUES ($1, 1, $2::date)
         ON CONFLICT (user_id) DO UPDATE SET
           streak = CASE WHEN login_streaks.last_login = $3::date
                         THEN login_streaks.streak + 1 ELSE 1 END,
           last_login = $2::date,
           updated_at = NOW()
         WHERE login_streaks.last_login IS DISTINCT FROM $2::date
         RETURNING streak`,
        [userId, today, yesterday]
      );
      const newStreak = up.rows[0]?.streak;
      // Bonus recurrente cada 7 días seguidos (+10) — sin cortar la racha.
      if (newStreak && newStreak % 7 === 0) {
        await db.query(`INSERT INTO coins (user_id,balance,total_earned) VALUES ($1,0,0) ON CONFLICT (user_id) DO NOTHING`, [userId]);
        await db.query(`UPDATE coins SET balance=balance+10, total_earned=total_earned+10, updated_at=NOW() WHERE user_id=$1`, [userId]);
        await db.query(`INSERT INTO coin_transactions (user_id,type,amount,reason) VALUES ($1,'earn',10,$2)`, [userId, 'Bonus racha ' + newStreak + ' días']);
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

function buildVerifyEmailHtml(name, verifyUrl, brand = BRANDING) {
  const primary = brand.color_primary || "#3B82F6";
  const accent  = brand.color_accent  || "#F59E0B";
  const appName = brand.name || "Mi Portal";
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#080808;">
<table width="100%" cellspacing="0" cellpadding="0" style="background:#080808;padding:40px 20px;">
  <tr><td align="center">
    <table width="480" cellspacing="0" cellpadding="0" style="width:480px;max-width:480px;">
      <tr><td style="padding-bottom:32px;text-align:center;">
        ${brand.logo_url ? `<img src="${brand.logo_url}" alt="${appName}" style="max-height:48px;margin-bottom:8px;"/>` : `<div style="font-family:Arial,sans-serif;font-size:28px;margin-bottom:8px;">✨</div>`}
        <div style="font-family:Arial,sans-serif;color:${primary};font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">${appName}</div>
      </td></tr>
      <tr><td style="background:rgba(255,255,255,0.04);border:2px solid ${primary}33;border-radius:20px;overflow:hidden;">
        <div style="padding:32px;background:linear-gradient(135deg,${primary}1a,transparent);border-bottom:1px solid ${primary}1a;">
          <div style="font-family:Arial,sans-serif;color:#fff;font-size:22px;font-weight:900;margin-bottom:8px;">Bienvenido, ${name}! 👋</div>
          <div style="font-family:Arial,sans-serif;color:rgba(255,255,255,0.6);font-size:14px;">Ya casi estás listo para usar el portal.</div>
        </div>
        <div style="padding:28px 32px;">
          <p style="font-family:Arial,sans-serif;color:#ccc;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Hacé click en el botón para verificar tu cuenta. El link es válido por <b style="color:${primary};">24 horas</b>.
          </p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${verifyUrl}" style="display:inline-block;padding:16px 40px;border-radius:14px;background:linear-gradient(135deg,${primary},${accent});color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-weight:900;font-size:16px;letter-spacing:1px;">
              VERIFICAR CUENTA ✓
            </a>
          </div>
          <p style="font-family:Arial,sans-serif;color:rgba(255,255,255,0.3);font-size:12px;margin:0;">
            Si no creaste esta cuenta, ignorá este email.
          </p>
        </div>
      </td></tr>
      <tr><td style="padding:20px 0 0;text-align:center;font-family:Arial,sans-serif;color:#333;font-size:12px;">
        © ${new Date().getFullYear()} ${appName}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── GET /auth/needs-bootstrap ────────────────────────────────────────────────
// Devuelve { needs_bootstrap: true } si la DB no tiene users; el frontend
// usa esto para mostrar 'Crear cuenta de administrador' en lugar del login.
app.get("/auth/needs-bootstrap", async (_req, res) => {
  try {
    const r = await db.query("SELECT COUNT(*)::int AS n FROM users");
    res.json({ needs_bootstrap: r.rows[0].n === 0 });
  } catch (e) {
    console.error("[needs-bootstrap]", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// ── POST /auth/bootstrap-admin ───────────────────────────────────────────────
// Crea el primer admin SIN requerir invite_code, sólo si la DB está vacía.
// Idempotente contra abuso: el segundo intento (con users existentes) falla 403.
app.post("/auth/bootstrap-admin", authLimiter, noStore, async (req, res) => {
  try {
    const schema = z.object({
      name:     z.string().min(2).max(80),
      email:    z.string().email(),
      password: z.string().min(8).max(128),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    // Race-safe: tx con SELECT FOR UPDATE no aplica acá (no hay row), pero
    // chequear count() inmediatamente antes del insert reduce la ventana de
    // race a microsegundos. Si dos requests entran a la vez, sólo uno
    // succeed (UNIQUE en email se encarga del resto).
    const cnt = await db.query("SELECT COUNT(*)::int AS n FROM users");
    if (cnt.rows[0].n > 0) {
      return res.status(403).json({ error: "Ya existe al menos un usuario; bootstrap deshabilitado" });
    }

    const { name, email, password } = p.data;
    const hash = await bcrypt.hash(password, 10);
    const ins = await db.query(
      `INSERT INTO users (client_number, name, email, password_hash, role, email_verified, active)
       VALUES (1, $1, $2, $3, 'admin', TRUE, TRUE)
       RETURNING id, name, email, role`,
      [name.trim(), email.toLowerCase(), hash]
    );
    const user = ins.rows[0];

    // Crear coins balance + perfil vacío (idempotentes)
    await db.query(`INSERT INTO coins (user_id, balance, total_earned) VALUES ($1, 0, 0) ON CONFLICT DO NOTHING`, [user.id]);
    await db.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]);

    // Token directo (no hay verificación de email — admin bootstrap es trusted)
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ ok: true, token, user });
  } catch (e) {
    console.error("[bootstrap-admin]", e);
    if (String(e?.message || "").includes("duplicate")) {
      return res.status(400).json({ error: "Email ya registrado" });
    }
    res.status(500).json({ error: "Error interno" });
  }
});

// ── POST /auth/register ───────────────────────────────────────────────────────
// ── Captcha matemático (VERIFICÁ QUE SOS HUMANO) ─────────────────────────────
// Anti-bot del registro mientras la verificación por email está apagada
// (rules.email_verify_required = false). El token JWT lleva el HASH de la
// respuesta (no la respuesta) y vence a los 15 min; /auth/register lo valida
// server-side — validar sólo en el front no frena ningún bot.
function hashCaptchaAnswer(answer) {
  return require("crypto").createHash("sha256")
    .update(`captcha|${String(answer).trim()}|${JWT_SECRET}`)
    .digest("hex");
}
app.get("/auth/captcha", authLimiter, noStore, (_req, res) => {
  const a = 2 + Math.floor(Math.random() * 8);   // 2..9
  const b = 2 + Math.floor(Math.random() * 8);   // 2..9
  const token = jwt.sign(
    { t: "captcha", h: hashCaptchaAnswer(a + b) },
    JWT_SECRET,
    { expiresIn: "15m" }
  );
  res.json({ question: `${a} + ${b}`, token });
});

app.post("/auth/register", authLimiter, noStore, async (req, res) => {
  try {
    const schema = z.object({
      invite_code: z.string().min(1).optional(),
      name:        z.string().min(2),
      email:       z.string().email(),
      password:    z.string().min(6),
      referrer:    z.string().min(2).max(40).optional(),  // username del que invitó
      terms_accepted: z.boolean().optional(),             // aceptación de T&C + Privacidad
      terms_version:  z.string().max(40).optional(),
      // Captcha: opcionales en el schema (clients viejos cacheados no los
      // mandan y el error de abajo es más claro que "Datos inválidos"),
      // pero obligatorios en la lógica.
      captcha_token:  z.string().max(600).optional(),
      captcha_answer: z.union([z.string().max(10), z.number()]).optional(),
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

    const { invite_code, name, email, password, referrer, terms_accepted, captcha_token, captcha_answer } = p.data;

    // Verificación anti-bot: la cuenta matemática tiene que estar bien.
    let captchaOk = false;
    if (captcha_token && captcha_answer !== undefined && captcha_answer !== "") {
      try {
        const dec = jwt.verify(captcha_token, JWT_SECRET);
        captchaOk = dec.t === "captcha" && dec.h === hashCaptchaAnswer(captcha_answer);
      } catch (_) { /* token inválido o vencido → captchaOk queda false */ }
    }
    if (!captchaOk) {
      return res.status(400).json({
        error: "La verificación no es correcta. Resolvé la cuenta e intentá de nuevo.",
        code: "CAPTCHA_FAILED",
      });
    }

    // Aceptación de Términos y Condiciones + Privacidad: obligatoria para registrarse
    if (terms_accepted !== true) {
      return res.status(400).json({ error: "Tenés que aceptar los Términos y Condiciones y la Política de Privacidad para registrarte" });
    }
    const termsVersion = p.data.terms_version || TERMS_VERSION;
    const termsIp = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim() || null;

    // Modo de registro (regla del wizard, rules.signup_mode):
    //   'open'   → registro libre, sin código (default)
    //   'invite' → código de invitación obligatorio
    // Antes el endpoint ignoraba la regla y siempre exigía código.
    let signupMode = "open";
    try { signupMode = (await configStore.getConfig("rules.signup_mode")) || "open"; }
    catch (e) { console.warn("[register signup_mode]", e.message); }
    const inviteRequired = signupMode === "invite";
    const normalizedCode = invite_code ? invite_code.toUpperCase().trim() : null;

    // Verificación por email (regla del wizard, rules.email_verify_required):
    // apagada → el usuario nace verificado, las coins de bienvenida se
    // acreditan acá mismo y no se manda mail. El captcha de arriba es el
    // reemplazo anti-bot mientras tanto.
    let verifyRequired = false;
    try { verifyRequired = (await configStore.getConfig("rules.email_verify_required")) === true; }
    catch (e) { console.warn("[register email_verify_required]", e.message); }

    // Verificar código (sólo en modo invitación)
    if (inviteRequired) {
      if (!normalizedCode) return res.status(400).json({ error: "Ingresá tu código de invitación" });
      const codeQ = await db.query(
        `SELECT * FROM invite_codes WHERE code=$1 AND used_by IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
        [normalizedCode]
      );
      if (!codeQ.rows[0]) return res.status(400).json({ error: "Código de invitación inválido o ya usado" });
    }

    // Verificar email no existe
    const existQ = await db.query(`SELECT id FROM users WHERE email=$1`, [email.toLowerCase()]);
    if (existQ.rows[0]) return res.status(400).json({ error: "Este email ya está registrado" });

    // Siguiente número de cliente
    const maxQ = await db.query(`SELECT COALESCE(MAX(client_number),0)+1 AS next FROM users`);
    const clientNumber = maxQ.rows[0].next;

    // Crear usuario
    const hash = await bcrypt.hash(password, 10);
    const userQ = await db.query(
      `INSERT INTO users (client_number, name, email, password_hash, role, invite_code, email_verified,
                          terms_accepted_at, terms_version, terms_accepted_ip)
       VALUES ($1,$2,$3,$4,'client',$5,$8, NOW(), $6, $7)
       RETURNING id, client_number, name, email`,
      [clientNumber, name.trim(), email.toLowerCase(), hash, inviteRequired ? normalizedCode : null, termsVersion, termsIp, !verifyRequired]
    );
    const user = userQ.rows[0];

    // Marcar código como usado — atómico: si otra request lo tomó primero,
    // used_by IS NULL falla y no se consume dos veces el mismo código.
    if (inviteRequired) {
      const claimQ = await db.query(
        `UPDATE invite_codes SET used_by=$1, used_at=NOW() WHERE code=$2 AND used_by IS NULL RETURNING code`,
        [user.id, normalizedCode]
      );
      if (!claimQ.rows[0]) {
        // Perdió la carrera: revertir el usuario recién creado.
        await db.query(`DELETE FROM users WHERE id=$1`, [user.id]);
        return res.status(400).json({ error: "Código de invitación inválido o ya usado" });
      }
    }

    // Registrar referido si vino con referrer (username del que lo invitó).
    // Tope: REFERRAL_MAX_PER_USER invitaciones por usuario — pasado el tope,
    // el registro sigue normal pero sin crédito de referido para nadie.
    if (referrer) {
      try {
        const refQ = await db.query(`SELECT id FROM users WHERE LOWER(username)=LOWER($1) AND id<>$2`, [referrer.trim(), user.id]);
        if (refQ.rows[0]) {
          const referrerId = refQ.rows[0].id;
          const countQ = await db.query(
            `SELECT COUNT(*)::int AS n FROM referrals WHERE referrer_id=$1`,
            [referrerId]
          );
          if (countQ.rows[0].n < REFERRAL_MAX_PER_USER) {
            await db.query(`UPDATE users SET referrer_id=$1 WHERE id=$2`, [referrerId, user.id]);
            await db.query(
              `INSERT INTO referrals (referrer_id, referred_id, status) VALUES ($1,$2,'pending') ON CONFLICT (referred_id) DO NOTHING`,
              [referrerId, user.id]
            );
          }
        }
      } catch (e) { console.warn("[register referrer]", e.message); }
    }

    // Crear coins
    await db.query(
      `INSERT INTO coins (user_id, balance, total_earned) VALUES ($1, 0, 0) ON CONFLICT DO NOTHING`,
      [user.id]
    );

    // Crear perfil
    await db.query(
      `INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [user.id]
    );

    if (!verifyRequired) {
      // Sin verificación por email: coins de bienvenida al toque y a loguearse.
      let welcomeCoins = 3;
      try {
        const v = await configStore.getConfig("rules.coins_on_register");
        if (v !== null && v !== undefined && Number.isFinite(Number(v))) welcomeCoins = Math.max(0, Number(v));
      } catch (e) { console.warn("[register coins_on_register]", e.message); }
      if (welcomeCoins > 0) {
        await db.query(`UPDATE coins SET balance=balance+$2, total_earned=total_earned+$2 WHERE user_id=$1`, [user.id, welcomeCoins]);
        await db.query(`INSERT INTO coin_transactions (user_id,type,amount,reason) VALUES ($1,'earn',$2,'¡Bienvenido! Cuenta creada')`, [user.id, welcomeCoins]);
      }
      return res.json({ ok: true, verified: true, message: "Cuenta creada. Ya podés iniciar sesión.", client_number: user.client_number });
    }

    // Generar token de verificación (plano para email, bcrypt en DB)
    const token = require("crypto").randomBytes(32).toString("hex");
    const tokenHash = await bcrypt.hash(token, 10);
    const expires = new Date(Date.now() + 24*60*60*1000);
    await db.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
      [user.id, tokenHash, expires]
    );

    // Enviar email de verificación (subject + HTML usan el branding del wizard)
    const base = process.env.APP_URL || "http://localhost:5173";
    const verifyUrl = `${base}/verify-email?token=${token}`;
    const brand = await getBranding();
    try {
      await sendEmail({
        to: user.email,
        subject: `Verificá tu cuenta — ${brand.name}`,
        html: buildVerifyEmailHtml(name, verifyUrl, brand),
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

    // Coins de bienvenida al verificar email — monto configurable desde el
    // wizard (rules.coins_on_register, paso 5). Antes estaba hardcodeado en 15.
    let welcomeCoins = 3;
    try {
      const v = await configStore.getConfig("rules.coins_on_register");
      if (v !== null && v !== undefined && Number.isFinite(Number(v))) welcomeCoins = Math.max(0, Number(v));
    } catch (e) { console.warn("[verify-email coins_on_register]", e.message); }
    // Guard anti doble-crédito: si ya cobró la bienvenida (ej. se registró
    // con la verificación apagada, que acredita en /auth/register) no se
    // vuelve a acreditar al tocar un link de verificación.
    const alreadyWelcomed = (await db.query(
      `SELECT 1 FROM coin_transactions WHERE user_id=$1 AND type='earn' AND reason LIKE '¡Bienvenido!%' LIMIT 1`,
      [row.user_id]
    )).rows[0];
    if (welcomeCoins > 0 && !alreadyWelcomed) {
      await db.query(`UPDATE coins SET balance=balance+$2, total_earned=total_earned+$2 WHERE user_id=$1`, [row.user_id, welcomeCoins]);
      await db.query(`INSERT INTO coin_transactions (user_id,type,amount,reason) VALUES ($1,'earn',$2,'¡Bienvenido! Email verificado')`, [row.user_id, welcomeCoins]);
    }

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


// ==================== AUTH ====================


// ── ETZ AI — datos completos del negocio ────────────────────────────────────

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


// ── CUPONES ──────────────────────────────────────────────────────────────────
const COUPON_APPLIES = ["all","usa","china","europa","normal","express","usa_normal","usa_express","china_normal","china_express","europa_normal"];

// GET /admin/coupons — staff

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
         SELECT followee_id AS other_id FROM user_follows WHERE follower_id = $1
         UNION
         SELECT follower_id  AS other_id FROM user_follows WHERE followee_id = $1
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
                 WHERE follower_id = $1 AND followee_id = u.id
              ) AS i_follow,
              EXISTS(
                SELECT 1 FROM user_follows
                 WHERE follower_id = u.id AND followee_id = $1
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
      // Sólo bloquea si la regla del wizard exige verificación. Con la regla
      // apagada (rules.email_verify_required=false) entran también los users
      // viejos que quedaron sin verificar cuando el mail no salía.
      let verifyRequired = false;
      try { verifyRequired = (await configStore.getConfig("rules.email_verify_required")) === true; }
      catch (e) { console.warn("[login email_verify_required]", e.message); }
      if (verifyRequired) {
        return res.status(403).json({
          error: "Tenés que verificar tu email para entrar. Revisá tu bandeja.",
          code: "EMAIL_NOT_VERIFIED",
          email: user.email,
        });
      }
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
    // Cuenta la racha al ENTRAR a la app (con JWT de 7 días el usuario no
    // re-loguea cada día, pero sí carga /auth/me). Idempotente por día; se
    // espera antes de responder para que un GET /profile/streak posterior lea
    // el valor ya actualizado.
    await checkMissions(user.id, 'login').catch(() => {});
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
  // CSPRNG — nunca Math.random() para un secreto de account-takeover.
  return require("crypto").randomBytes(32).toString("hex");
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
    const brand = await getBranding();
    const primary = brand.color_primary || "#3B82F6";
    const accent  = brand.color_accent  || "#F59E0B";
    const appName = brand.name || "Mi Portal";

    try {
      await sendEmail({
        to: user.email,
        subject: `Restablecer tu contraseña — ${appName}`,
        html: `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0b1020;">
<table width="100%" cellspacing="0" cellpadding="0" style="background:#0b1020;padding:40px 20px;">
  <tr><td align="center">
    <table width="480" cellspacing="0" cellpadding="0" style="width:480px;max-width:480px;">
      <tr><td style="padding-bottom:32px;text-align:center;">
        ${brand.logo_url
          ? `<img src="${brand.logo_url}" alt="${appName}" style="max-height:56px;margin-bottom:12px;"/>`
          : `<div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,${primary},${accent});display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px;">🔐</div>`}
        <div style="font-family:Arial,sans-serif;color:${primary};font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">${appName}</div>
      </td></tr>
      <tr><td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:20px;overflow:hidden;">
        <div style="padding:32px 32px 24px;background:linear-gradient(135deg,${primary}40,${accent}26);border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="font-family:Arial,sans-serif;color:#ffffff;font-size:22px;font-weight:900;margin-bottom:8px;">Restablecer contraseña</div>
          <div style="font-family:Arial,sans-serif;color:#94a3b8;font-size:14px;">Hola <b style="color:#e2e8f0;">${user.name || "usuario"}</b>, recibimos un pedido para cambiar tu contraseña.</div>
        </div>
        <div style="padding:28px 32px;">
          <p style="font-family:Arial,sans-serif;color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            Hacé click en el botón para crear una nueva contraseña. Este link es válido por <b style="color:${primary};">30 minutos</b>.
          </p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;border-radius:12px;background:linear-gradient(135deg,${primary},${accent});color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-weight:900;font-size:15px;">
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
        © ${new Date().getFullYear()} ${appName}. Todos los derechos reservados.
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

    const base = process.env.APP_URL || "http://localhost:5173";
    const verifyUrl = `${base}/verify-email?token=${token}`;
    const brand = await getBranding();
    try {
      await sendEmail({
        to: user.email,
        subject: `Verificá tu cuenta — ${brand.name}`,
        html: buildVerifyEmailHtml(user.name || "", verifyUrl, brand),
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

app.post("/auth/reset-password", forgotLimiter, async (req, res) => {
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
      // Escalada de privilegios: sólo un admin puede crear cuentas operator/admin.
      // Un operator sólo puede crear clientes, ignorando cualquier `role` elevado del body.
      let role = d.role || "client";
      if (role !== "client" && req.user.role !== "admin") {
        return res.status(403).json({ error: "Sólo un admin puede crear cuentas de staff" });
      }
      const password_hash = await bcrypt.hash(d.password, 12);

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


// ── GET /operator/shipments/by-tracking ──────────────────────────────────────

// ✅ GET /operator/shipments — con filtros avanzados (fecha, estado, origen, servicio)


// ── GET /operator/costs ──────────────────────────────────────────────────────

// ── PUT /operator/costs ──────────────────────────────────────────────────────

// ── GET /operator/dashboard ──────────────────────────────────────────────────

// ════════════════════════════════════════════════════════════════════
// MÓDULO CAJA — pagos y gastos
// ════════════════════════════════════════════════════════════════════

const PAYMENT_METHODS = ["USD_CASH", "USDT", "ARS_TRANSFER", "ARS_CASH"];
const EXPENSE_CATEGORIES = [
  "Alquiler / Oficina", "Sueldos / Personal", "Logística / Flete",
  "Marketing", "Servicios", "Otros"
];








// ════════════════════════════════════════════════════════════════════
// PRESUPUESTADOR
// ════════════════════════════════════════════════════════════════════





// ── GET solicitudes (operador) ─────────────────────────────────────

// ── PATCH solicitud (operador) ─────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
// TIPO DE CAMBIO
// ════════════════════════════════════════════════════════════════════



// ════════════════════════════════════════════════════════════════════
// MÓDULO CUENTAS / FONDOS
// ════════════════════════════════════════════════════════════════════












// ── GET /dashboard/metrics — métricas completas para el founder dashboard ──────






// ════════════════════════════════════════════════════════════════════
// ✅ COINS ROUTER
// ════════════════════════════════════════════════════════════════════
app.use("/coins",         requireFeature("coins"), coinsRouter);
app.use("/notifications", notificationsRouter);




// ─────────────────────────────────────────────────────────────────────────────

app.use("/api/chat", requireFeature("chat"), chatRouter);
app.use("/profile",       profileRouter);
app.use("/auth/webauthn", requireFeature("webauthn"), webauthnRouter);

// ── Setup wizard endpoints (Sprint 2) ────────────────────────────────────────
app.use("/api/admin/config", adminConfig.build({ authRequired, requireRole }));
app.use("/api/config/public", adminConfig.publicRouter());

// ── Feed editor (Sprint 3) ────────────────────────────────────────────────────
// Monta /feed (público) + /admin/feed (admin) en la raíz; mismo router maneja
// ambos prefijos vía sus paths internos.
app.use("/", adminFeed.build({ authRequired, requireRole }));

// ── Admin users + coins manager (Sprint 3) ────────────────────────────────────
app.use("/admin", adminUsers.build({ authRequired, requireRole }));

// ── Shop fase 1 (Sprint 14, 2026-05-23) ───────────────────────────────────────
// Catálogo público + CRUD admin. Feature flag features.shop (default true).
app.use("/api/shop",       requireFeature("shop"), shop.publicRouter());
app.use("/api/admin/shop", requireFeature("shop"), shop.build({ authRequired, requireRole }));

// ── Shop fase 2 (Sprint 14 F2, 2026-05-23): checkout + MercadoPago ────────────
// Public router monta /checkout y /orders/:public_id bajo /api/shop.
// Admin router agrega /orders endpoints bajo /api/admin/shop.
// Webhook MP se monta sin feature flag (MP necesita poder llamarlo siempre
// si hay órdenes pendientes, aunque el shop esté en mantenimiento momentáneo).
app.use("/api/shop",       requireFeature("shop"), checkout.publicRouter({ authRequired }));
app.use("/api/admin/shop", requireFeature("shop"), checkout.adminRouter({ authRequired, requireRole }));
app.use("/api/webhooks",   checkout.webhookRouter());

// ── Reclamar bonus primer envío (cliente) ──────────────────────────


// ── POST /api/client/update-contact-phone — guardar número WA del cliente ──
// Funciona de dos formas:
// 1. Con JWT (cliente logueado): solo manda phone
// 2. Sin JWT: manda clientNumber + email + phone (para clientes no logueados)


// Limpiar invite codes vencidos cada hora
setInterval(async () => {
  try {
    const r = await db.query(`DELETE FROM invite_codes WHERE expires_at < NOW() AND used_by IS NULL`);
    if (r.rowCount > 0) console.log(`[INVITES] ${r.rowCount} códigos vencidos eliminados`);
  } catch(e) { console.error("[INVITES CLEANUP]", e.message); }
}, 60 * 60 * 1000);

// Auto-completar pedidos: si un pedido está "despachado" y el cliente no
// confirmó la recepción en 2 días, se marca "entregado" (completed) solo.
async function autoCompleteDispatchedOrders() {
  try {
    const r = await db.query(
      `UPDATE orders
          SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
        WHERE status = 'dispatched' AND dispatched_at < NOW() - INTERVAL '2 days'`
    );
    if (r.rowCount > 0) console.log(`[ORDERS] ${r.rowCount} pedidos auto-completados (2 días sin confirmar)`);
  } catch (e) { console.error("[ORDERS AUTO-COMPLETE]", e.message); }
}
setInterval(autoCompleteDispatchedOrders, 6 * 60 * 60 * 1000); // cada 6 hs
setTimeout(autoCompleteDispatchedOrders, 30 * 1000);           // una vez al arrancar

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
      const msg = sanitizeText(String(message || ""), 1000).trim();
      if (!msg || !to_user_id) return;

      // Respetar bloqueos: si cualquiera de los dos bloqueó al otro, se descarta.
      const blockQ = await db.query(
        `SELECT 1 FROM chat_friendships
          WHERE status='blocked'
            AND ((user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1))
          LIMIT 1`,
        [user.id, to_user_id]
      );
      if (blockQ.rows[0]) return;

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

// Servir frontend (path ya declarado al tope para dotenv)
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
    const { rows: coins } = await db.query("SELECT COALESCE(balance,0) as balance, COALESCE(total_earned,0) as total_earned FROM coins WHERE user_id=$1", [uid]);
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
      "INSERT INTO user_follows(follower_id, followee_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id",
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
    const { rows } = await db.query("SELECT COUNT(*) as cnt FROM user_follows WHERE followee_id=$1", [followingId]);
    res.json({ ok: true, followers: Number(rows[0].cnt) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/follow/:userId", authRequired, async (req, res) => {
  try {
    const followingId = Number(req.params.userId);
    await db.query("DELETE FROM user_follows WHERE follower_id=$1 AND followee_id=$2", [req.user.id, followingId]);
    const { rows } = await db.query("SELECT COUNT(*) as cnt FROM user_follows WHERE followee_id=$1", [followingId]);
    res.json({ ok: true, followers: Number(rows[0].cnt) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/follow/:userId", authRequired, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const [fwrs, fwing, isFollowing] = await Promise.all([
      db.query("SELECT COUNT(*) as cnt FROM user_follows WHERE followee_id=$1", [userId]),
      db.query("SELECT COUNT(*) as cnt FROM user_follows WHERE follower_id=$1", [userId]),
      db.query("SELECT 1 FROM user_follows WHERE follower_id=$1 AND followee_id=$2", [req.user.id, userId]),
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

// ── Manifest PWA dinámico (lee branding del wizard) ──────────────────────────
// Tiene que ir ANTES del express.static para ganarle al manifest.json estático
// que vite copia desde public/.
const fs = require("fs");
const { brandHtml, brandManifest } = require("./lib/htmlBranding");

app.get("/manifest.json", async (_req, res) => {
  try {
    const m = await brandManifest();
    res.set("Cache-Control", "public, max-age=60");
    res.json(m);
  } catch (e) {
    console.error("[manifest]", e.message);
    res.status(500).json({ error: "manifest unavailable" });
  }
});

app.use(express.static(distPath, { index: false })); // no servir index.html acá; lo hace nuestro handler
// SPA fallback: lee index.html de dist y lo transforma con el branding actual
// (title + metas PWA + theme-color + og:image) — así crawlers y la primera
// pintura ya muestran el nombre/colores del tenant sin esperar al JS.
let _indexHtmlCache = null;
function readIndexHtml() {
  if (_indexHtmlCache) return _indexHtmlCache;
  try { _indexHtmlCache = fs.readFileSync(path.join(distPath, "index.html"), "utf8"); }
  catch { _indexHtmlCache = null; }
  return _indexHtmlCache;
}
app.get("/{*path}", async (req, res) => {
  const raw = readIndexHtml();
  // Modo API-only (deploy split frontend/backend, ej. Vercel + Render): el
  // dist del client no esta presente. Respondemos JSON descriptivo en /
  // y JSON 404 para otras rutas — no tiramos 503 porque el server esta sano.
  if (!raw) {
    if (req.path === "/") {
      return res.json({
        ok: true,
        service: process.env.APP_NAME || "portal-starter",
        mode: "api-only",
        frontend: process.env.APP_URL || null,
        endpoints: ["/health", "/auth/*", "/profile/*", "/coins/*", "/api/config/public", "/manifest.json"],
      });
    }
    return res.status(404).json({ error: "Not found", hint: "Esta es la API. El frontend vive en " + (process.env.APP_URL || "tu hosting separado") });
  }
  try {
    const html = await brandHtml(raw);
    res.set("Cache-Control", "no-cache, must-revalidate");
    res.type("html").send(html);
  } catch (e) {
    console.error("[brandHtml]", e.message);
    res.type("html").send(raw); // fallback: servir crudo
  }
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
  telegram.notify(`✅ <b>${process.env.APP_NAME || "Mi Portal"}</b> backend iniciado · ${new Date().toISOString()}`).catch(()=>{});
} else {
  console.warn("[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no seteados — notificaciones desactivadas.");
}
// ── Migraciones post-arranque ─────────────────────────────────────────────────

// force redeploy Sun Apr 19 00:33:45 UTC 2026
