// server/routes/coins.js
const express = require("express");
const router  = express.Router();
const db      = require("../db");
const { authRequired, requireRole } = require("../auth");

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
    `INSERT INTO lemon_coins (user_id, balance, total_earned)
     VALUES ($1, 0, 0) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  const r = await db.query(`SELECT * FROM lemon_coins WHERE user_id=$1`, [userId]);
  return r.rows[0];
}

// ── GET /coins — ranking (operador) ──────────────────────────────────────────
router.get("/", authRequired, requireRole(["operator", "admin"]), async (req, res) => {
  try {
    const q = await db.query(`
      SELECT lc.*, u.name, u.client_number, u.email
      FROM lemon_coins lc
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
      `UPDATE lemon_coins SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2`,
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
    const updQ = await db.query(`SELECT * FROM lemon_coins WHERE user_id=$1`, [user_id]);

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
      `UPDATE lemon_coins
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
    const updQ = await db.query(`SELECT * FROM lemon_coins WHERE user_id=$1`, [user_id]);
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
        `UPDATE lemon_coins SET balance=balance+$1, updated_at=NOW() WHERE user_id=$2`,
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

module.exports = router;