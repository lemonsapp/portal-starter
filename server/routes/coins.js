// server/routes/coins.js
const express = require("express");
const router  = express.Router();
const db      = require("../db");
const { authRequired, requireRole } = require("../auth");

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
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_customer_code ON users(customer_code) WHERE customer_code IS NOT NULL`);
    await db.query(`ALTER TABLE coin_transactions ADD COLUMN IF NOT EXISTS canal TEXT`);
    await db.query(`ALTER TABLE coin_transactions ADD COLUMN IF NOT EXISTS operador TEXT`);
    await db.query(`ALTER TABLE coin_transactions ADD COLUMN IF NOT EXISTS amount_cents BIGINT`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS point_config (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await db.query(`INSERT INTO point_config (key, value) VALUES ('peso_per_point','2000'),('buy_price','1600') ON CONFLICT (key) DO NOTHING`);
    // Backfill: asignar customer_code a usuarios que no tengan (bounded).
    const pend = await db.query(`SELECT id FROM users WHERE customer_code IS NULL LIMIT 5000`);
    for (const u of pend.rows) { await ensureCustomerCode(u.id); }
    console.log(`[MIGRATION] puntos ready (backfilled ${pend.rows.length} customer_code)`);
  } catch (e) { console.error("[MIGRATION puntos ERROR]", e.message); }
})();

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

    // Sistema de Puntos: código de cliente (lazy) + valor del punto en $.
    const customerCode = await ensureCustomerCode(userId);
    const pesoPerPoint = await getPointConfig("peso_per_point", 2000);

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

    res.json({
      balance:               coins.balance,
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
      has_delivered_shipment: false,    // legacy contract; el starter no tiene shipments
      first_bonus_claimed:   true,      // legacy contract; el starter no tiene bonus de primer envío
    });
  } catch (e) {
    console.error("COINS GET USER ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /coins/earn — otorgar coins manual ───────────────────────────────────

// ── POST /coins/redeem — canjear coins ───────────────────────────────────────
router.post("/redeem", authRequired, async (req, res) => {
  try {
    const { user_id, reward_key, shipment_id, notes } = req.body;
    const reward = REWARDS[reward_key];
    if (!reward) return res.status(400).json({ error: "Recompensa inválida" });

    const isOwner = req.user.id === parseInt(user_id);
    const isStaff = ["operator","admin"].includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ error: "No autorizado" });

    const coins = await getOrCreateCoins(user_id);
    if (coins.balance < reward.coins) {
      return res.status(400).json({
        error: `Coins insuficientes. Tenés ${coins.balance}, necesitás ${reward.coins}`
      });
    }

    await db.query(
      `UPDATE coins SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2`,
      [reward.coins, user_id]
    );
    await db.query(
      `INSERT INTO coin_transactions (user_id, type, amount, reason, shipment_id)
       VALUES ($1,'redeem',$2,$3,$4)`,
      [user_id, -reward.coins, `Canje: ${reward.label}`, shipment_id || null]
    );
    const redQ = await db.query(
      `INSERT INTO coin_redemptions (user_id, reward_key, coins_spent, shipment_id, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [user_id, reward_key, reward.coins, shipment_id || null, notes || null]
    );
    const updQ = await db.query(`SELECT * FROM coins WHERE user_id=$1`, [user_id]);

    res.json({
      success:     true,
      redemption:  redQ.rows[0],
      new_balance: updQ.rows[0].balance,
      level:       getLevel(updQ.rows[0].balance),
    });
  } catch (e) {
    console.error("COINS REDEEM ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

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

// ── PATCH /coins/redemptions/:id — aplicar o cancelar canje ─────────────────
router.patch("/redemptions/:id", authRequired, requireRole(["operator","admin"]), async (req, res) => {
  try {
    const { status, shipment_id } = req.body;
    if (!["applied","cancelled"].includes(status)) return res.status(400).json({ error: "Estado inválido" });

    const redQ = await db.query(`SELECT * FROM coin_redemptions WHERE id=$1`, [req.params.id]);
    const red  = redQ.rows[0];
    if (!red) return res.status(404).json({ error: "Canje no encontrado" });

    if (status === "cancelled" && red.status === "pending") {
      await db.query(
        `UPDATE coins SET balance=balance+$1, updated_at=NOW() WHERE user_id=$2`,
        [red.coins_spent, red.user_id]
      );
      await db.query(
        `INSERT INTO coin_transactions (user_id, type, amount, reason) VALUES ($1,'adjust',$2,'Devolución por canje cancelado')`,
        [red.user_id, red.coins_spent]
      );
    }

    await db.query(
      `UPDATE coin_redemptions SET status=$1, shipment_id=COALESCE($2,shipment_id) WHERE id=$3`,
      [status, shipment_id || null, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    console.error("COINS REDEMPTION PATCH ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /coins/lookup/:code — buscar cliente por código (panel Gaia) ──────────
// 2 segmentos → no colisiona con GET /:userId. Solo staff.
router.get("/lookup/:code", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "Falta el código" });
    const uq = await db.query(
      `SELECT u.id, u.name, u.email, u.customer_code, COALESCE(c.balance, 0) AS balance
       FROM users u LEFT JOIN coins c ON c.user_id = u.id
       WHERE u.customer_code = $1`,
      [code]
    );
    if (!uq.rows[0]) return res.status(404).json({ error: "Cliente no encontrado" });
    const pesoPerPoint = await getPointConfig("peso_per_point", 2000);
    res.json({ user: uq.rows[0], peso_per_point: pesoPerPoint });
  } catch (e) {
    console.error("COINS LOOKUP ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /coins/manual-credit — carga manual de puntos por compra externa ─────
// Body: { customer_code, amount_pesos?, canal?, descripcion?, points_override? }
// Puntos = floor(amount_pesos / peso_per_point), o points_override si se envía.
router.post("/manual-credit", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const { customer_code, amount_pesos, canal, descripcion, points_override } = req.body;
    const code = String(customer_code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "Falta el código de cliente" });

    const uq = await db.query(`SELECT id, name, customer_code FROM users WHERE customer_code=$1`, [code]);
    const u = uq.rows[0];
    if (!u) return res.status(404).json({ error: "Cliente no encontrado" });

    const pesoPerPoint = await getPointConfig("peso_per_point", 2000);
    const pesos = Math.max(0, Math.floor(Number(amount_pesos) || 0));
    let points;
    if (points_override !== undefined && points_override !== null && points_override !== "") {
      points = Math.max(0, Math.floor(Number(points_override)));
    } else {
      points = Math.floor(pesos / pesoPerPoint); // redondeo hacia abajo (regla del spec)
    }
    if (points <= 0) return res.status(400).json({ error: "Los puntos a acreditar dan 0 — revisá el monto." });

    await getOrCreateCoins(u.id);
    await db.query(
      `UPDATE coins
         SET balance = balance + $1,
             total_earned = total_earned + $1,
             peak_balance = GREATEST(peak_balance, balance + $1),
             updated_at = NOW()
       WHERE user_id = $2`,
      [points, u.id]
    );
    await db.query(
      `INSERT INTO coin_transactions (user_id, type, amount, reason, canal, operador, amount_cents)
       VALUES ($1, 'compra_externa', $2, $3, $4, $5, $6)`,
      [u.id, points, descripcion || "Compra externa", canal || "admin",
       req.user.email || "admin", pesos > 0 ? pesos * 100 : null]
    );
    const updQ = await db.query(`SELECT balance FROM coins WHERE user_id=$1`, [u.id]);
    res.json({
      success: true,
      user: { id: u.id, name: u.name, customer_code: u.customer_code },
      points_credited: points,
      new_balance: updQ.rows[0].balance,
    });
  } catch (e) {
    console.error("COINS MANUAL-CREDIT ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;