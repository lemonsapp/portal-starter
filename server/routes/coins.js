// server/routes/coins.js
const express = require("express");
const router  = express.Router();
const db      = require("../db");
const { authRequired, requireRole } = require("../auth");
const { sendEmail } = require("../mailer");
const { sanitizeText } = require("../security");

// Template HTML simple para emails de canje (descuento con cupón / premio físico).
function redemptionEmailHtml({ name, reward, couponCode }) {
  const hi = `Hola ${name || ""},`.trim();
  const wrap = (inner) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#15171c">${inner}<p style="color:#64748b;font-size:12px;margin-top:24px">Gracias por ser parte de Holistic 🌱</p></div>`;
  if (reward.kind === "descuento") {
    return wrap(`
      <h2 style="margin:0 0 12px;font-size:20px">¡Canjeaste tu descuento! 🎟️</h2>
      <p style="margin:0 0 8px">${hi}</p>
      <p style="margin:0 0 8px">Canjeaste <b>${reward.label}</b>. Acá está tu cupón de un solo uso para tu próximo pedido:</p>
      <div style="font-size:26px;font-weight:900;letter-spacing:3px;background:#f1f5f9;border:2px dashed #1FA350;border-radius:12px;padding:16px;text-align:center;color:#1FA350;margin:16px 0">${couponCode}</div>
      <p style="margin:0;font-size:14px">Aplicalo en el checkout de la tienda. Válido para una sola compra.</p>`);
  }
  return wrap(`
    <h2 style="margin:0 0 12px;font-size:20px">¡Canjeaste un premio! 🎁</h2>
    <p style="margin:0 0 8px">${hi}</p>
    <p style="margin:0 0 8px">Canjeaste <b>${reward.label}</b>.</p>
    <p style="margin:0;font-size:14px">Te vamos a contactar para coordinar el envío. ¡Disfrutalo!</p>`);
}

// Email de puntos/monedas acreditados (compra externa cargada por el admin).
function pointsCreditedEmailHtml({ name, points, newBalance, descripcion, currency = "puntos" }) {
  const hi = `Hola ${name || ""},`.trim();
  const esMonedas = currency === "monedas";
  const unidad = esMonedas ? "monedas" : "puntos";
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#15171c">
    <h2 style="margin:0 0 12px;font-size:20px">Sumaste ${unidad} ${esMonedas ? "🪙" : "💎"}</h2>
    <p style="margin:0 0 8px">${hi}</p>
    <p style="margin:0 0 8px">Se acreditaron <b>+${points} ${unidad}</b> a tu cuenta${descripcion ? ` por: ${descripcion}` : ""}.</p>
    <p style="margin:0 0 8px">Tu nuevo saldo es de <b>${newBalance} ${unidad}</b>.</p>
    <p style="margin:0;font-size:14px">${esMonedas ? "Usalas para pagar tus pedidos en la tienda." : 'Entrá a "Mis puntos" para ver tus canjes disponibles.'}</p>
    <p style="color:#64748b;font-size:12px;margin-top:24px">Gracias por ser parte de Holistic 🌱</p>
  </div>`;
}

// ── Auto-migración (Sprint 7): rename lemon_coins → coins ────────────────────
// Idempotente: si existe la vieja y NO la nueva, ALTER RENAME. Tenants nuevos
// arrancan con `coins` directo desde init-db.sql. La columna peak_balance la
// agrega profile.js con ALTER TABLE coins ADD COLUMN IF NOT EXISTS.
(async () => {
  try {
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='coins')
           AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='lemon_coins') THEN
          ALTER TABLE lemon_coins RENAME TO coins;
        END IF;
      END $$;
    `);
    console.log("[MIGRATION] coins table ready");
  } catch (e) { console.error("[MIGRATION coins ERROR]", e.message); }

  // ── F1 Sistema de Puntos: customer_code + columnas de movimiento + config ──
  try {
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_code TEXT`);
    // ── Monedas (2026-07-14): saldo SEPARADO del de puntos. Los puntos se
    // GANAN (compras + acciones en redes) y se canjean; las monedas se COMPRAN
    // (packs del shop) y sirven únicamente para pagar pedidos en el carrito.
    // Cada movimiento queda etiquetado con su moneda en coin_transactions.currency.
    await db.query(`ALTER TABLE coins ADD COLUMN IF NOT EXISTS monedas_balance BIGINT NOT NULL DEFAULT 0`);
    await db.query(`ALTER TABLE coin_transactions ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'puntos'`);
    // Una sola devolución por orden cancelada (reason = 'Devolución monedas · <public_id>').
    // El índice hace atómico el guard de refundOrderMonedas ante requests concurrentes.
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_coin_tx_devolucion_pedido
                    ON coin_transactions(reason) WHERE type = 'devolucion_pedido'`);
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_customer_code ON users(customer_code) WHERE customer_code IS NOT NULL`);
    await db.query(`ALTER TABLE coin_transactions ADD COLUMN IF NOT EXISTS canal TEXT`);
    await db.query(`ALTER TABLE coin_transactions ADD COLUMN IF NOT EXISTS operador TEXT`);
    await db.query(`ALTER TABLE coin_transactions ADD COLUMN IF NOT EXISTS amount_cents BIGINT`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS point_config (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await db.query(`INSERT INTO point_config (key, value) VALUES ('peso_per_point','4000'),('buy_price','3600'),('earn_per_point','12000') ON CONFLICT (key) DO NOTHING`);
    // Sistema de Puntos v9: se separa la TASA DE ACUMULACIÓN del VALOR DE CANJE.
    //   • earn_per_point = $12.000 → se gana 1 punto cada $12.000 gastados (compra web/externa).
    //   • peso_per_point = $4.000  → valor de canje de cada punto (equivalencia en $ del saldo).
    //   • buy_price      = $3.600  → costo de comprar 1 punto directo (10% off vs el valor de canje).
    // Migraciones acotadas al valor previo conocido → idempotentes y sin pisar
    // ediciones que el admin haya hecho a propósito desde el panel.
    await db.query(`UPDATE point_config SET value='4000', updated_at=NOW() WHERE key='peso_per_point' AND value='2000'`);
    await db.query(`UPDATE point_config SET value='3600', updated_at=NOW() WHERE key='buy_price' AND value='1600'`);
    // v1.0 → v9: en v1.0 la acumulación usaba peso_per_point ($4.000). Ahora la
    // acumulación tiene su propia clave earn_per_point ($12.000); el INSERT de arriba
    // ya la crea en deploys existentes (peso_per_point queda como valor de canje).
    // Backfill: asignar customer_code a usuarios que no tengan (bounded).
    const pend = await db.query(`SELECT id FROM users WHERE customer_code IS NULL LIMIT 5000`);
    for (const u of pend.rows) { await ensureCustomerCode(u.id); }
    console.log(`[MIGRATION] puntos ready (backfilled ${pend.rows.length} customer_code)`);
  } catch (e) { console.error("[MIGRATION puntos ERROR]", e.message); }

  // ── F2 Canjes: catálogo de premios/descuentos + tabla de canjes ──
  try {
    // promo_codes lo crea shop.js; lo aseguramos acá (idempotente, mismo schema)
    // para que el canje de descuento funcione aunque shop aún no haya migrado.
    await db.query(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('percent','fixed_cents')),
        value INT NOT NULL CHECK (value > 0),
        min_subtotal_cents INT NOT NULL DEFAULT 0,
        max_uses INT, current_uses INT NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ, active BOOLEAN NOT NULL DEFAULT TRUE, notes TEXT,
        created_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_promo_codes_code_upper ON promo_codes(UPPER(code))`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS point_rewards (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('descuento','premio')),
        label TEXT NOT NULL,
        description TEXT,
        cost_points INT NOT NULL CHECK (cost_points > 0),
        discount_pct INT,                 -- solo descuentos
        market_value_cents BIGINT,        -- solo premios (valor de mercado)
        stock INT,                        -- null = sin límite
        active BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0
      )`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS point_redemptions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reward_slug TEXT NOT NULL,
        kind TEXT NOT NULL,
        label TEXT,
        cost_points INT NOT NULL,
        discount_pct INT,
        coupon_code TEXT,
        market_value_cents BIGINT,
        status TEXT NOT NULL DEFAULT 'pending',   -- pending | fulfilled | cancelled
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fulfilled_at TIMESTAMPTZ
      )`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_point_redemptions_user ON point_redemptions(user_id, created_at DESC)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_point_redemptions_status ON point_redemptions(status, created_at DESC)`);

    // Seed del catálogo (valores del documento Holistic v1.0). Idempotente por slug.
    // Descuentos: §5.2 — 5%=150 … 40%=1.250. Premios: §5.1 — Pack/Tensores/Gel=200,
    // Dije Don Rouch=1500 (premio aspiracional máximo, valor de referencia $420.000;
    // subió de 500 a pedido del cliente 2026-07-11).
    await db.query(`
      INSERT INTO point_rewards (slug, kind, label, description, cost_points, discount_pct, market_value_cents, stock, sort_order) VALUES
        ('disc-5',  'descuento', '5% de descuento',  'Cupón de 5% off en tu próximo pedido',  150,  5,  NULL, NULL, 1),
        ('disc-10', 'descuento', '10% de descuento', 'Cupón de 10% off en tu próximo pedido', 250,  10, NULL, NULL, 2),
        ('disc-15', 'descuento', '15% de descuento', 'Cupón de 15% off en tu próximo pedido', 350,  15, NULL, NULL, 3),
        ('disc-20', 'descuento', '20% de descuento', 'Cupón de 20% off en tu próximo pedido', 480,  20, NULL, NULL, 4),
        ('disc-25', 'descuento', '25% de descuento', 'Cupón de 25% off en tu próximo pedido', 620,  25, NULL, NULL, 5),
        ('disc-30', 'descuento', '30% de descuento', 'Cupón de 30% off en tu próximo pedido', 800,  30, NULL, NULL, 6),
        ('disc-35', 'descuento', '35% de descuento', 'Cupón de 35% off en tu próximo pedido', 1000, 35, NULL, NULL, 7),
        ('disc-40', 'descuento', '40% de descuento', 'Cupón de 40% off — premio máximo',       1250, 40, NULL, NULL, 8),
        ('premio-pack',     'premio', 'Pack Accesorios Holistic', 'Pack de accesorios de marca',          200, NULL, 3500000,  NULL, 20),
        ('premio-tensores', 'premio', 'Tensores de red',          'Tensores de red para cultivo',         200, NULL, 3500000,  NULL, 21),
        ('premio-gel',      'premio', 'Gel Cloner Holistic',      'Gel enraizante de la línea Holistic',  200, NULL, 4000000,  NULL, 22),
        ('premio-dije',     'premio', 'Dije Don Rouch',           'Dije de plata 925 full ice hecho a mano', 1500, NULL, 42000000, NULL, 23)
      ON CONFLICT (slug) DO NOTHING`);

    // Migración v1.0: actualizar deploys existentes a los nuevos costos. Cada UPDATE
    // está acotado al valor previo conocido → idempotente y sin pisar ediciones que
    // el admin haya hecho a propósito desde el panel de canjes.
    await db.query(`
      UPDATE point_rewards SET cost_points=150  WHERE slug='disc-5'         AND cost_points=50;
      UPDATE point_rewards SET cost_points=250  WHERE slug='disc-10'        AND cost_points=88;
      UPDATE point_rewards SET cost_points=350  WHERE slug='disc-15'        AND cost_points=125;
      UPDATE point_rewards SET cost_points=480  WHERE slug='disc-20'        AND cost_points=175;
      UPDATE point_rewards SET cost_points=620  WHERE slug='disc-25'        AND cost_points=225;
      UPDATE point_rewards SET cost_points=800  WHERE slug='disc-30'        AND cost_points=300;
      UPDATE point_rewards SET cost_points=1000 WHERE slug='disc-35'        AND cost_points=400;
      UPDATE point_rewards SET cost_points=1250 WHERE slug='disc-40'        AND cost_points=500;
      UPDATE point_rewards SET cost_points=200  WHERE slug='premio-pack'     AND cost_points=22;
      UPDATE point_rewards SET cost_points=200  WHERE slug='premio-tensores' AND cost_points=22;
      UPDATE point_rewards SET cost_points=200  WHERE slug='premio-gel'      AND cost_points=25;
      UPDATE point_rewards SET cost_points=500, market_value_cents=42000000 WHERE slug='premio-dije' AND cost_points=88;
      -- 2026-07-11: el dije pasa de 500 a 1500 puntos + descripción real de la
      -- joya (pedido del cliente). Acotados al valor previo → si el admin los
      -- re-edita desde el panel, no se pisan.
      UPDATE point_rewards SET cost_points=1500 WHERE slug='premio-dije' AND cost_points=500;
      UPDATE point_rewards SET description='Dije de plata 925 full ice hecho a mano'
        WHERE slug='premio-dije' AND description='Joya exclusiva de la marca';
    `);
    console.log("[MIGRATION] canjes ready (point_rewards + point_redemptions)");
  } catch (e) { console.error("[MIGRATION canjes ERROR]", e.message); }

  // ── F4 Comunidad Instagram: evidencias de acciones ──
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ig_submissions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action_key TEXT NOT NULL,
        label TEXT,
        points INT NOT NULL,
        evidence_url TEXT,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
        reviewed_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ
      )`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_ig_submissions_user ON ig_submissions(user_id, created_at DESC)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_ig_submissions_status ON ig_submissions(status, created_at DESC)`);
    console.log("[MIGRATION] instagram ready (ig_submissions)");
  } catch (e) { console.error("[MIGRATION instagram ERROR]", e.message); }
})();

// Catálogo de acciones de Instagram (puntos + límite, según el documento).
// Puntos alineados al doc "holistic sistema puntos v9" — 9.2 Criterios
// específicos por acción. Todas requieren mencionar @holistic.arg.
// Ajuste 2026-07-18 (pedido del cliente): photo_plant 33 → 20.
const IG_ACTIONS = [
  { key: "like",          label: "Like a publicación oficial",       points: 2,   limit: "Máx 1 por día" },
  { key: "comment",       label: "Comentario en publicación",        points: 5,   limit: "Máx 1 por publicación" },
  { key: "story",         label: "Compartir en stories",             points: 7,   limit: "Máx 1 por publicación" },
  { key: "photo_product", label: "Foto del envase (sin planta)",     points: 17,  limit: "Máx 1 por mes", perMonth: 1 },
  { key: "photo_plant",   label: "Foto con planta y producto",       points: 20,  limit: "Máx 1 por mes", perMonth: 1 },
  { key: "stage",         label: "Compartir una etapa del ciclo",    points: 50,  limit: "Máx 1 por etapa" },
  { key: "full_cycle",    label: "Ciclo completo documentado",       points: 167, limit: "1 por ciclo (mín. 4 fotos)" },
];
const IG_ACTION_MAP = Object.fromEntries(IG_ACTIONS.map((a) => [a.key, a]));

// Genera un código de cupón único para canjes de descuento (PTS-XXXXXX).
async function generatePromoCode() {
  const CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 15; i++) {
    const code = "PTS-" + Array.from({ length: 6 }, () => CH[Math.floor(Math.random() * CH.length)]).join("");
    const ex = await db.query(`SELECT 1 FROM promo_codes WHERE UPPER(code)=UPPER($1)`, [code]);
    if (!ex.rows[0]) return code;
  }
  return "PTS-" + Date.now().toString(36).toUpperCase();
}

// ── Helpers Sistema de Puntos ────────────────────────────────────────────────
// Código de cliente HST-XXXX-XX (charset sin caracteres ambiguos 0/O/1/I).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randCustomerCode() {
  const pick = (n) => Array.from({ length: n }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  return `HST-${pick(4)}-${pick(2)}`;
}
// Asigna (idempotente) un customer_code único al usuario. Devuelve el código.
async function ensureCustomerCode(userId) {
  const cur = await db.query(`SELECT customer_code FROM users WHERE id=$1`, [userId]);
  if (cur.rows[0]?.customer_code) return cur.rows[0].customer_code;
  for (let i = 0; i < 12; i++) {
    const code = randCustomerCode();
    try {
      const u = await db.query(
        `UPDATE users SET customer_code=$1 WHERE id=$2 AND customer_code IS NULL RETURNING customer_code`,
        [code, userId]
      );
      if (u.rows[0]) return u.rows[0].customer_code;
      const rr = await db.query(`SELECT customer_code FROM users WHERE id=$1`, [userId]);
      if (rr.rows[0]?.customer_code) return rr.rows[0].customer_code;
    } catch (_) { /* colisión de unicidad → reintentar con otro código */ }
  }
  return null;
}
// Lee un parámetro de point_config con fallback numérico.
async function getPointConfig(key, fallback) {
  try {
    const r = await db.query(`SELECT value FROM point_config WHERE key=$1`, [key]);
    const v = parseInt(r.rows[0]?.value, 10);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch (_) { return fallback; }
}

// ── Constantes ────────────────────────────────────────────────────────────────
const COINS_FIRST_BONUS  = 15;

// Rewards genéricos del starter. El admin puede ampliar la lista vía DB
// (coin_redemptions queda flexible). Estas son las recompensas mínimas
// out-of-the-box; cada cliente puede customizar copy/precios.
const REWARDS = {
  badge_legend:   { coins: 9500, label: "Badge legendario en perfil", type: "cosmetic" },
  highlight_24h:  { coins: 4500, label: "Resaltado de perfil 24h",    type: "cosmetic" },
  spotlight:      { coins: 500,  label: "Spotlight en home (1h)",     type: "cosmetic" },
  custom_emoji:   { coins: 100,  label: "Emoji custom en chat (1)",   type: "cosmetic" },
};

const LEVELS = [
  { key: "gold",   label: "Oro",    min: 1500, color: "#FFD700", icon: "🥇" },
  { key: "silver", label: "Plata",  min: 500,  color: "#C0C0C0", icon: "🥈" },
  { key: "bronze", label: "Bronce", min: 0,    color: "#CD7F32", icon: "🥉" },
];

function getLevel(balance) {
  return LEVELS.find(l => balance >= l.min) || LEVELS[LEVELS.length - 1];
}

async function getOrCreateCoins(userId) {
  await db.query(
    `INSERT INTO coins (user_id, balance, total_earned)
     VALUES ($1, 0, 0) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  const r = await db.query(`SELECT * FROM coins WHERE user_id=$1`, [userId]);
  return r.rows[0];
}

// ── GET /coins — ranking (operador) ──────────────────────────────────────────
router.get("/", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const q = await db.query(`
      SELECT lc.*, u.name, u.client_number, u.email
      FROM coins lc
      JOIN users u ON u.id = lc.user_id
      ORDER BY lc.balance DESC
    `);
    res.json({ rows: q.rows.map(r => ({ ...r, level: getLevel(r.balance) })) });
  } catch (e) {
    console.error("COINS GET ALL ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /coins/rewards — catálogo de canjes (descuentos + premios) ────────────
// Definido ANTES de /:userId para no colisionar (1 segmento). ?all=1 (staff) trae
// también los inactivos (para el editor del admin).
router.get("/rewards", authRequired, async (req, res) => {
  try {
    const wantAll = (req.query.all === "1" || req.query.all === "true")
      && ["operator", "admin"].includes(req.user.role);
    const q = await db.query(
      `SELECT * FROM point_rewards ${wantAll ? "" : "WHERE active = TRUE"} ORDER BY sort_order, id`
    );
    res.json({ rewards: q.rows });
  } catch (e) {
    console.error("COINS REWARDS ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /coins/redeem-points — canjear puntos por descuento o premio ─────────
router.post("/redeem-points", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { reward_slug } = req.body;
    if (!reward_slug) return res.status(400).json({ error: "Falta el premio a canjear" });

    const rq = await db.query(`SELECT * FROM point_rewards WHERE slug=$1 AND active=TRUE`, [reward_slug]);
    const reward = rq.rows[0];
    if (!reward) return res.status(400).json({ error: "Canje inválido o no disponible" });

    const coins = await getOrCreateCoins(userId);
    if (coins.balance < reward.cost_points) {
      return res.status(400).json({ error: `Puntos insuficientes. Tenés ${coins.balance}, necesitás ${reward.cost_points}.` });
    }

    // Cobro atómico PRIMERO: el guard `balance >= costo` evita doble gasto y
    // balance negativo ante requests concurrentes (TOCTOU). Si otra request ya
    // gastó el saldo, no devuelve fila y abortamos sin generar cupón ni tocar stock.
    const debit = await db.query(
      `UPDATE coins SET balance = balance - $1, updated_at = NOW() WHERE user_id = $2 AND balance >= $1 RETURNING balance`,
      [reward.cost_points, userId]
    );
    if (!debit.rows[0]) {
      return res.status(400).json({ error: "Puntos insuficientes." });
    }
    const newBalance = debit.rows[0].balance;

    // Premio físico: stock atómico. Si quedó sin stock, devolvemos los puntos.
    if (reward.kind === "premio" && reward.stock != null) {
      const st = await db.query(
        `UPDATE point_rewards SET stock = stock - 1 WHERE id=$1 AND stock > 0 RETURNING stock`,
        [reward.id]
      );
      if (!st.rows[0]) {
        await db.query(`UPDATE coins SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`, [reward.cost_points, userId]);
        return res.status(400).json({ error: "Premio temporalmente sin stock" });
      }
    }

    // Descuento: generar cupón de 1 uso (integra con el promo del checkout).
    let couponCode = null;
    if (reward.kind === "descuento") {
      couponCode = await generatePromoCode();
      await db.query(
        `INSERT INTO promo_codes (code, kind, value, max_uses, active, created_by, notes)
         VALUES ($1, 'percent', $2, 1, TRUE, $3, $4)`,
        [couponCode, reward.discount_pct, userId, `Canje de puntos: ${reward.label}`]
      );
    }

    // Registrar movimiento y canje (el cobro ya se hizo arriba).
    await db.query(
      `INSERT INTO coin_transactions (user_id, type, amount, reason, operador)
       VALUES ($1, $2, $3, $4, 'sistema')`,
      [userId, reward.kind === "descuento" ? "canje_descuento" : "canje_premio",
       -reward.cost_points, `Canje: ${reward.label}`]
    );
    const status = reward.kind === "descuento" ? "fulfilled" : "pending";
    const redQ = await db.query(
      `INSERT INTO point_redemptions
         (user_id, reward_slug, kind, label, cost_points, discount_pct, coupon_code, market_value_cents, status, fulfilled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CASE WHEN $9='fulfilled' THEN NOW() ELSE NULL END)
       RETURNING *`,
      [userId, reward.slug, reward.kind, reward.label, reward.cost_points,
       reward.discount_pct || null, couponCode, reward.market_value_cents || null, status]
    );
    // Email de confirmación (no bloquea la respuesta si falla).
    try {
      const uq = await db.query(`SELECT name, email FROM users WHERE id=$1`, [userId]);
      const u = uq.rows[0];
      if (u?.email) {
        await sendEmail({
          to: u.email,
          subject: reward.kind === "descuento" ? "Tu cupón de canje — Holistic" : "Canjeaste un premio — Holistic",
          html: redemptionEmailHtml({ name: u.name, reward, couponCode }),
        });
      }
    } catch (mailErr) { console.error("[redeem email]", mailErr.message); }

    res.json({
      success: true,
      redemption: redQ.rows[0],
      coupon_code: couponCode,
      new_balance: newBalance,
    });
  } catch (e) {
    console.error("COINS REDEEM-POINTS ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /coins/:userId — saldo + historial ────────────────────────────────────
router.get("/:userId", authRequired, async (req, res) => {
  try {
    const userId  = parseInt(req.params.userId);
    const isOwner = req.user.id === userId;
    const isStaff = ["operator","admin"].includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ error: "No autorizado" });

    const coins = await getOrCreateCoins(userId);
    const level = getLevel(coins.balance);

    const nextLevel   = [...LEVELS].reverse().find(l => l.min > coins.balance) ?? null;
    const coinsToNext = nextLevel ? nextLevel.min - coins.balance : null;

    // Sistema de Puntos: código de cliente (lazy) + valor de canje del punto en $.
    const customerCode = await ensureCustomerCode(userId);
    const pesoPerPoint = await getPointConfig("peso_per_point", 4000);

    // Sprint 4: removida tabla shipments (legacy). Las queries no
    // joinen más; shipment_code queda como undefined en el response (los
    // consumers ya manejan undefined gracefully).
    const txQ = await db.query(`
      SELECT * FROM coin_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 50
    `, [userId]);

    const redQ = await db.query(`
      SELECT * FROM coin_redemptions
      WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 20
    `, [userId]);

    // Canjes del Sistema de Puntos (descuentos con cupón + premios).
    let pointRedemptions = [];
    try {
      const pr = await db.query(
        `SELECT * FROM point_redemptions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,
        [userId]
      );
      pointRedemptions = pr.rows;
    } catch (_) { /* tabla aún no migrada */ }

    res.json({
      balance:               coins.balance,
      monedas_balance:       Number(coins.monedas_balance) || 0,
      total_earned:          coins.total_earned,
      customer_code:         customerCode,
      peso_per_point:        pesoPerPoint,
      value_ars:             coins.balance * pesoPerPoint,   // equivalencia en $ del saldo
      level:                 { ...level, min: level.min ?? 0 },
      next_level:            nextLevel,
      coins_to_next:         coinsToNext,
      rewards:               REWARDS,
      transactions:          txQ.rows,
      redemptions:           redQ.rows,
      point_redemptions:     pointRedemptions,
      has_delivered_shipment: false,    // legacy contract; el starter no tiene shipments
      first_bonus_claimed:   true,      // legacy contract; el starter no tiene bonus de primer envío
    });
  } catch (e) {
    console.error("COINS GET USER ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /coins/earn — otorgar coins manual ───────────────────────────────────

// POST /coins/redeem se borro el 2026-08-06. Era el canje del courier de
// Lemon's: insertaba en coin_redemptions columnas que NO existen
// (reward_key, coins_spent, shipment_id, notes) contra un esquema que solo
// tiene (item_key, cost), asi que devolvia 500 siempre. El canje real de
// este portal es POST /coins/redeem-points, que usa point_redemptions.

// ── POST /coins/adjust — ajuste manual ───────────────────────────────────────
router.post("/adjust", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const { user_id, amount, reason } = req.body;
    if (!user_id || !amount || !reason) return res.status(400).json({ error: "Faltan datos" });

    await getOrCreateCoins(user_id);
    await db.query(
      `UPDATE coins
       SET balance=GREATEST(0, balance+$1),
           total_earned=CASE WHEN $1>0 THEN total_earned+$1 ELSE total_earned END,
           updated_at=NOW()
       WHERE user_id=$2`,
      [amount, user_id]
    );
    await db.query(
      `INSERT INTO coin_transactions (user_id, type, amount, reason) VALUES ($1,'adjust',$2,$3)`,
      [user_id, amount, reason]
    );
    const updQ = await db.query(`SELECT * FROM coins WHERE user_id=$1`, [user_id]);
    res.json({ balance: updQ.rows[0].balance, level: getLevel(updQ.rows[0].balance) });
  } catch (e) {
    console.error("COINS ADJUST ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /coins/redemptions/:id se borro el 2026-08-06 por lo mismo: hacia
// UPDATE coin_redemptions SET status/shipment_id, columnas que no existen.
// El equivalente vivo es PATCH /coins/admin/redemptions/:id, que es el que
// usa el panel de admin sobre point_redemptions.

// ── GET /coins/lookup/:code — buscar cliente por código (panel Gaia) ──────────
// 2 segmentos → no colisiona con GET /:userId. Solo staff.
router.get("/lookup/:code", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "Falta el código" });
    const uq = await db.query(
      `SELECT u.id, u.name, u.email, u.customer_code, COALESCE(c.balance, 0) AS balance,
              COALESCE(c.monedas_balance, 0) AS monedas_balance
       FROM users u LEFT JOIN coins c ON c.user_id = u.id
       WHERE u.customer_code = $1`,
      [code]
    );
    if (!uq.rows[0]) return res.status(404).json({ error: "Cliente no encontrado" });
    // Tasa de ACUMULACIÓN (no la de canje): el panel previsualiza puntos por compra externa.
    const earnPerPoint = await getPointConfig("earn_per_point", 12000);
    // buy_price = $ por moneda comprada (misma tasa que el pack custom del shop):
    // el panel previsualiza monedas cuando la carga manual es de monedas.
    const buyPrice = await getPointConfig("buy_price", 3600);
    res.json({ user: uq.rows[0], earn_per_point: earnPerPoint, buy_price: buyPrice });
  } catch (e) {
    console.error("COINS LOOKUP ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /coins/manual-credit — carga manual de puntos o monedas ──────────────
// Body: { customer_code, amount_pesos?, canal?, descripcion?, points_override?, currency? }
//   • puntos (default): floor(amount_pesos / earn_per_point) — compra externa (spec v9).
//   • monedas: floor(amount_pesos / buy_price) — misma tasa que el pack custom del
//     shop (venta de monedas por fuera de la web); acredita monedas_balance, que no
//     tiene total_earned/peak_balance (eso es progresión de puntos/niveles).
// points_override pisa la conversión en ambos casos.
router.post("/manual-credit", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const { customer_code, amount_pesos, canal, descripcion, points_override, currency } = req.body;
    const code = String(customer_code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "Falta el código de cliente" });
    const cur = currency === "monedas" ? "monedas" : "puntos";

    const uq = await db.query(`SELECT id, name, customer_code FROM users WHERE customer_code=$1`, [code]);
    const u = uq.rows[0];
    if (!u) return res.status(404).json({ error: "Cliente no encontrado" });

    const perUnit = cur === "monedas"
      ? await getPointConfig("buy_price", 3600)
      : await getPointConfig("earn_per_point", 12000);
    const pesos = Math.max(0, Math.floor(Number(amount_pesos) || 0));
    let points;
    if (points_override !== undefined && points_override !== null && points_override !== "") {
      points = Math.max(0, Math.floor(Number(points_override)));
    } else {
      points = Math.floor(pesos / perUnit); // redondeo hacia abajo en ambas monedas
    }
    if (points <= 0) return res.status(400).json({ error: `Las ${cur === "monedas" ? "monedas" : "puntos"} a acreditar dan 0 — revisá el monto.` });

    await getOrCreateCoins(u.id);
    if (cur === "monedas") {
      await db.query(
        `UPDATE coins SET monedas_balance = monedas_balance + $1, updated_at = NOW() WHERE user_id = $2`,
        [points, u.id]
      );
    } else {
      await db.query(
        `UPDATE coins
           SET balance = balance + $1,
               total_earned = total_earned + $1,
               peak_balance = GREATEST(peak_balance, balance + $1),
               updated_at = NOW()
         WHERE user_id = $2`,
        [points, u.id]
      );
    }
    await db.query(
      `INSERT INTO coin_transactions (user_id, type, amount, reason, canal, operador, amount_cents, currency)
       VALUES ($1, 'compra_externa', $2, $3, $4, $5, $6, $7)`,
      [u.id, points, descripcion || (cur === "monedas" ? "Compra externa de monedas" : "Compra externa"), canal || "admin",
       req.user.email || "admin", pesos > 0 ? pesos * 100 : null, cur]
    );
    const updQ = await db.query(
      `SELECT balance, COALESCE(monedas_balance,0) AS monedas_balance FROM coins WHERE user_id=$1`, [u.id]
    );
    const newBalance = cur === "monedas" ? Number(updQ.rows[0].monedas_balance) : updQ.rows[0].balance;

    // Email de acreditación (no bloquea la respuesta).
    try {
      const eq = await db.query(`SELECT email FROM users WHERE id=$1`, [u.id]);
      if (eq.rows[0]?.email) {
        await sendEmail({
          to: eq.rows[0].email,
          subject: cur === "monedas" ? "Monedas acreditadas — Holistic" : "Puntos acreditados — Holistic",
          html: pointsCreditedEmailHtml({ name: u.name, points, newBalance, descripcion, currency: cur }),
        });
      }
    } catch (mailErr) { console.error("[credit email]", mailErr.message); }

    res.json({
      success: true,
      user: { id: u.id, name: u.name, customer_code: u.customer_code },
      currency: cur,
      points_credited: points,
      new_balance: newBalance,
    });
  } catch (e) {
    console.error("COINS MANUAL-CREDIT ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: catálogo de canjes (CRUD point_rewards) ───────────────────────────
router.post("/admin/rewards", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const { slug, kind, label, description, cost_points, discount_pct, market_value_cents, stock, active, sort_order } = req.body;
    if (!slug || !["descuento", "premio"].includes(kind) || !label || !(cost_points > 0)) {
      return res.status(400).json({ error: "Faltan datos (slug, kind, label, cost_points>0)" });
    }
    const q = await db.query(
      `INSERT INTO point_rewards (slug, kind, label, description, cost_points, discount_pct, market_value_cents, stock, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,TRUE),COALESCE($10,0)) RETURNING *`,
      [String(slug).trim().toLowerCase(), kind, label, description || null, Math.floor(cost_points),
       discount_pct || null, market_value_cents || null, stock === "" || stock == null ? null : Math.floor(stock),
       active, sort_order]
    );
    res.json({ reward: q.rows[0] });
  } catch (e) {
    console.error("REWARD CREATE ERROR:", e);
    res.status(500).json({ error: e.code === "23505" ? "Ya existe un canje con ese slug" : e.message });
  }
});

router.put("/admin/rewards/:id", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const { label, description, cost_points, discount_pct, market_value_cents, stock, active, sort_order } = req.body;
    const q = await db.query(
      `UPDATE point_rewards SET
         label = COALESCE($1, label),
         description = COALESCE($2, description),
         cost_points = COALESCE($3, cost_points),
         discount_pct = $4,
         market_value_cents = $5,
         stock = $6,
         active = COALESCE($7, active),
         sort_order = COALESCE($8, sort_order)
       WHERE id = $9 RETURNING *`,
      [label ?? null, description ?? null, cost_points ?? null,
       discount_pct === undefined ? null : discount_pct,
       market_value_cents === undefined ? null : market_value_cents,
       stock === undefined ? null : (stock === "" ? null : stock),
       active ?? null, sort_order ?? null, req.params.id]
    );
    if (!q.rows[0]) return res.status(404).json({ error: "Canje no encontrado" });
    res.json({ reward: q.rows[0] });
  } catch (e) {
    console.error("REWARD UPDATE ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

router.delete("/admin/rewards/:id", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    await db.query(`DELETE FROM point_rewards WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error("REWARD DELETE ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: cola de canjes (point_redemptions) ────────────────────────────────
router.get("/admin/redemptions", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const params = [];
    let where = "";
    if (req.query.status) { params.push(req.query.status); where = `WHERE pr.status = $1`; }
    const q = await db.query(
      `SELECT pr.*, u.name AS user_name, u.email AS user_email, u.customer_code
       FROM point_redemptions pr JOIN users u ON u.id = pr.user_id
       ${where} ORDER BY pr.created_at DESC LIMIT 200`,
      params
    );
    res.json({ redemptions: q.rows });
  } catch (e) {
    console.error("REDEMPTIONS LIST ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

router.patch("/admin/redemptions/:id", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["fulfilled", "cancelled"].includes(status)) return res.status(400).json({ error: "Estado inválido" });
    const rq = await db.query(`SELECT * FROM point_redemptions WHERE id=$1`, [req.params.id]);
    const rd = rq.rows[0];
    if (!rd) return res.status(404).json({ error: "Canje no encontrado" });

    if (status === "cancelled" && rd.status !== "cancelled") {
      // Devolver puntos + stock + desactivar cupón.
      await db.query(`UPDATE coins SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`, [rd.cost_points, rd.user_id]);
      await db.query(
        `INSERT INTO coin_transactions (user_id, type, amount, reason, operador)
         VALUES ($1, 'correccion', $2, $3, $4)`,
        [rd.user_id, rd.cost_points, `Cancelación de canje: ${rd.label || rd.reward_slug}`, req.user.email || "admin"]
      );
      if (rd.kind === "premio") {
        await db.query(`UPDATE point_rewards SET stock = stock + 1 WHERE slug = $1 AND stock IS NOT NULL`, [rd.reward_slug]);
      }
      if (rd.coupon_code) {
        await db.query(`UPDATE promo_codes SET active = FALSE WHERE code = $1`, [rd.coupon_code]);
      }
    }

    await db.query(
      `UPDATE point_redemptions SET status = $1,
         fulfilled_at = CASE WHEN $1 = 'fulfilled' THEN NOW() ELSE fulfilled_at END
       WHERE id = $2`,
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error("REDEMPTION PATCH ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── Instagram: acciones disponibles + enviar evidencia + mis envíos ──────────
router.get("/ig/actions", authRequired, (_req, res) => {
  res.json({ actions: IG_ACTIONS });
});

router.post("/ig/submit", authRequired, async (req, res) => {
  try {
    const { action_key, evidence_url, note } = req.body;
    const action = IG_ACTION_MAP[action_key];
    if (!action) return res.status(400).json({ error: "Acción inválida" });
    // El link de evidencia lo abre un admin desde el panel: sólo aceptamos
    // http(s) para cerrar el XSS por `javascript:`/`data:` en el href del admin.
    let cleanUrl = null;
    if (evidence_url) {
      const raw = String(evidence_url).trim();
      if (!/^https?:\/\/\S+$/i.test(raw)) {
        return res.status(400).json({ error: "El link debe empezar con http:// o https://" });
      }
      cleanUrl = raw.slice(0, 2000);
    }
    const cleanNote = note ? sanitizeText(String(note), 500) : null;
    if (!cleanUrl && !cleanNote) return res.status(400).json({ error: "Adjuntá un link o nota como evidencia" });
    // Límite mensual por acción: los envíos pendientes/aprobados del mes en curso
    // cuentan para el tope (los rechazados no). Sólo aplica a acciones con perMonth.
    if (action.perMonth) {
      const used = await db.query(
        `SELECT COUNT(*)::int AS n FROM ig_submissions
          WHERE user_id=$1 AND action_key=$2 AND status <> 'rejected'
            AND created_at >= date_trunc('month', NOW())`,
        [req.user.id, action.key]
      );
      if (used.rows[0].n >= action.perMonth) {
        return res.status(429).json({ error: `Ya alcanzaste el límite de esta acción este mes (máx ${action.perMonth} por mes).` });
      }
    }
    const q = await db.query(
      `INSERT INTO ig_submissions (user_id, action_key, label, points, evidence_url, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, action.key, action.label, action.points, cleanUrl, cleanNote]
    );
    res.json({ submission: q.rows[0] });
  } catch (e) {
    console.error("IG SUBMIT ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/ig/mine", authRequired, async (req, res) => {
  try {
    const q = await db.query(
      `SELECT * FROM ig_submissions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`,
      [req.user.id]
    );
    res.json({ submissions: q.rows });
  } catch (e) {
    console.error("IG MINE ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: cola de evidencias IG (aprobar/rechazar) ──────────────────────────
router.get("/admin/ig", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const params = [];
    let where = "";
    if (req.query.status) { params.push(req.query.status); where = `WHERE s.status = $1`; }
    const q = await db.query(
      `SELECT s.*, u.name AS user_name, u.customer_code, u.email AS user_email
       FROM ig_submissions s JOIN users u ON u.id = s.user_id
       ${where} ORDER BY s.created_at DESC LIMIT 200`,
      params
    );
    res.json({ submissions: q.rows });
  } catch (e) {
    console.error("IG ADMIN LIST ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

router.patch("/admin/ig/:id", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Estado inválido" });
    const sq = await db.query(`SELECT * FROM ig_submissions WHERE id=$1`, [req.params.id]);
    const sub = sq.rows[0];
    if (!sub) return res.status(404).json({ error: "Evidencia no encontrada" });
    if (sub.status !== "pending") return res.status(400).json({ error: "Esta evidencia ya fue revisada" });

    if (status === "approved") {
      await getOrCreateCoins(sub.user_id);
      await db.query(
        `UPDATE coins SET balance = balance + $1, total_earned = total_earned + $1,
           peak_balance = GREATEST(peak_balance, balance + $1), updated_at = NOW()
         WHERE user_id = $2`,
        [sub.points, sub.user_id]
      );
      await db.query(
        `INSERT INTO coin_transactions (user_id, type, amount, reason, canal, operador)
         VALUES ($1, 'accion_ig', $2, $3, 'instagram', $4)`,
        [sub.user_id, sub.points, `Instagram: ${sub.label}`, req.user.email || "admin"]
      );
    }
    await db.query(
      `UPDATE ig_submissions SET status=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id=$3`,
      [status, req.user.email || "admin", req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error("IG ADMIN PATCH ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;