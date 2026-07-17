// server/routes/profile.js — Sistema de perfiles con Coins
"use strict";
const express = require("express");
const router  = express.Router();
const db      = require("../db");
const { authRequired } = require("../auth");
const { sanitizeText } = require("../security");
const multer = require('multer');
// Sprint 14 fix: el SDK de Cloudinary se configura por request leyendo
// las API keys de configStore (DB encriptada via wizard /admin/setup),
// no de process.env. Antes el config se hacia al require() con env vars
// vacias en Render → "Must supply api_key" en cada upload.
const { configureCloudinary } = require('../lib/cloudinaryConfig');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

// ── Auto-migración ────────────────────────────────────────────────────────────
async function migrate() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS profile_items (
      id          SERIAL PRIMARY KEY,
      key         TEXT UNIQUE NOT NULL,
      type        TEXT NOT NULL,  -- avatar | frame | title | badge
      name        TEXT NOT NULL,
      description TEXT,
      emoji       TEXT,
      data        JSONB DEFAULT '{}',
      cost_coins  INTEGER NOT NULL DEFAULT 0,
      rarity      TEXT DEFAULT 'common', -- common | rare | epic | legendary
      active      BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id       INTEGER PRIMARY KEY REFERENCES users(id),
      avatar_key    TEXT DEFAULT 'default',
      frame_key     TEXT DEFAULT NULL,
      title_key     TEXT DEFAULT NULL,
      badges        TEXT[] DEFAULT '{}',
      bio           TEXT DEFAULT NULL,
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_items (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id),
      item_key    TEXT NOT NULL,
      acquired_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, item_key)
    )
  `);
  // Agregar peak_balance a coins si no existe
  await db.query(`ALTER TABLE coins ADD COLUMN IF NOT EXISTS peak_balance INTEGER DEFAULT 0`).catch(() => {});
  await db.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS privacy_envios BOOLEAN DEFAULT TRUE`).catch(() => {});
  await db.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS privacy_coins BOOLEAN DEFAULT TRUE`).catch(() => {});
  await db.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS privacy_logros BOOLEAN DEFAULT TRUE`).catch(() => {});
  await db.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS privacy_posts BOOLEAN DEFAULT TRUE`).catch(() => {});
  await db.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS privacy_amigos BOOLEAN DEFAULT FALSE`).catch(() => {});
  // Sprint 11: cols del chat-style/profile-decoration que la query del
  // ranking + endpoints de chat asumen pero no estaban en init-db.sql.
  // Idempotentes: si ya existen no hacen nada. Sin estas cols /profile/ranking
  // crashea con 'column up.name_color does not exist'.
  for (const col of [
    "name_color TEXT",
    "name_glow INT",
    "name_glow_color TEXT",
    "name_grad_from TEXT",
    "name_grad_to TEXT",
    "nickname TEXT",
    "nick_color TEXT",
    "nick_glow INT",
    "nick_glow_color TEXT",
    "icon_slug TEXT",
    "avatar_url TEXT",
    "custom_name TEXT",
    "banner_key TEXT",
    "banner_effect TEXT",
    "banner_color1 TEXT",
    "banner_color2 TEXT",
    "features_unlocked TEXT[]",
  ]) {
    await db.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ${col}`).catch(() => {});
  }

  // Seed items si no hay
  if (true) {
    await db.query(`
      INSERT INTO profile_items (key, type, name, description, emoji, cost_coins, rarity, data) VALUES
      -- Avatares
      ('avatar_lemon',    'avatar', 'Coin Dorado',     'El clásico del portal',             '🪙', 0,    'common',    '{"bg":"#f5e03a","emoji":"🪙"}'),
      ('avatar_rocket',   'avatar', 'Rocketero',       'Para los que van rápido',           '🚀', 200,  'common',    '{"bg":"#3b82f6","emoji":"🚀"}'),
      ('avatar_globe',    'avatar', 'Viajero Global',  'Conectado al mundo',                '🌍', 300,  'common',    '{"bg":"#22c55e","emoji":"🌍"}'),
      ('avatar_diamond',  'avatar', 'Diamante',        'Estilo de lujo',                    '💎', 800,  'rare',      '{"bg":"#a78bfa","emoji":"💎"}'),
      ('avatar_fire',     'avatar', 'On Fire',         'Siempre activo',                    '🔥', 500,  'rare',      '{"bg":"#ff6200","emoji":"🔥"}'),
      ('avatar_crown',    'avatar', 'La Corona',       'Para los reyes',                    '👑', 2000, 'epic',      '{"bg":"#f5e03a","emoji":"👑"}'),
      ('avatar_lemon_fly','avatar', 'Coin Volador',    'Edición especial limitada',         '🪙', 5000, 'legendary', '{"bg":"linear-gradient(135deg,#f5e03a,#ff6200)","emoji":"🪙✈️"}'),
      -- Marcos
      ('frame_gold',      'frame',  'Marco Dorado',    'Un clásico elegante',               '⭐', 400,  'rare',      '{"border":"2px solid #f5e03a","shadow":"0 0 12px rgba(245,224,58,.5)"}'),
      ('frame_fire',      'frame',  'Marco Llamas',    'Ardiente y poderoso',               '🔥', 600,  'rare',      '{"border":"2px solid #ff6200","shadow":"0 0 14px rgba(255,98,0,.6)"}'),
      ('frame_rainbow',   'frame',  'Marco Arcoíris',  'Edición colorida',                  '🌈', 1200, 'epic',      '{"border":"2px solid transparent","gradient":"linear-gradient(45deg,#f5e03a,#ff6200,#a78bfa,#22c55e)"}'),
      ('frame_diamond',   'frame',  'Marco Diamante',  'Solo para los mejores',             '💎', 3000, 'legendary', '{"border":"2px solid #a78bfa","shadow":"0 0 20px rgba(167,139,250,.7)","pulse":true}'),
      -- Títulos
      ('title_importer',  'title',  'Pro',             'Para los que ya tienen experiencia','📦', 300,  'common',    '{"color":"#ede9e0"}'),
      ('title_fast',      'title',  'Velocista',       'Siempre rápido',                    '⚡', 500,  'rare',      '{"color":"#f5e03a"}'),
      ('title_global',    'title',  'Global',          'Conectado al mundo',                '🌍', 800,  'rare',      '{"color":"#60a5fa"}'),
      ('title_legend',    'title',  'Leyenda',         'El título más exclusivo',           '🏆', 4000, 'legendary', '{"color":"#f5e03a","gradient":true}'),
      -- Insignias
      ('badge_first',     'badge',  'Bienvenida',      'Completaste tu primer paso',        '🎯', 0,    'common',    '{"color":"#f5e03a"}'),
      ('badge_x10',       'badge',  '10 Posts',        'Activo en el feed',                 '📦', 0,    'rare',      '{"color":"#22c55e"}'),
      ('badge_whale',     'badge',  'Ballena',         'Top contribuidor',                  '🐋', 0,    'epic',      '{"color":"#3b82f6"}'),
      ('badge_loyal',     'badge',  'Leal',            'Más de 1 año en la comunidad',      '💛', 0,    'rare',      '{"color":"#f5e03a"}'),
      ('badge_express',   'badge',  'Experto',         'Acción frecuente en el portal',     '⚡', 150,  'common',    '{"color":"#f5e03a"}')
      ON CONFLICT (key) DO NOTHING
    `);
    // Badges especiales animadas
    await db.query(`
      INSERT INTO profile_items (key, type, name, description, emoji, cost_coins, rarity, data) VALUES
      ('badge_creator',  'badge', 'CREATOR',    'Creador del portal',                  '⚡', 0,    'legendary', '{"color":"#f5e03a","animated":true,"effect":"lightning","grantOnly":true}'),
      ('badge_mod',      'badge', 'MOD',         'Moderador oficial',                  '🛡️', 0,    'legendary', '{"color":"#60a5fa","animated":true,"effect":"shield","grantOnly":true}'),
      ('badge_bot',      'badge', 'BOT',         'Agente automatizado',                '🤖', 0,    'legendary', '{"color":"#a78bfa","animated":true,"effect":"pulse","grantOnly":true}'),
      ('badge_beta',     'badge', 'BETA',        'Early adopter — primeros meses',     '🧪', 0,    'legendary', '{"color":"#22c55e","animated":true,"effect":"glow","claimable":true}'),
      ('badge_vip',      'badge', 'VIP',         'Miembro VIP',                        '💎', 2000, 'legendary', '{"color":"#f5e03a","animated":true,"effect":"sparkle"}'),
      ('badge_thunder',  'badge', 'THUNDER',     'Veloz — siempre rápido',             '⚡', 800,  'epic',      '{"color":"#fbbf24","animated":true,"effect":"lightning"}'),
      ('badge_phantom',  'badge', 'PHANTOM',     'El que actúa en silencio',           '👻', 600,  'epic',      '{"color":"#818cf8","animated":true,"effect":"float"}'),
      ('badge_gold_star','badge', 'GOLD STAR',   'Excelencia en cada acción',          '🌟', 1500, 'legendary', '{"color":"#f5e03a","animated":true,"effect":"spin"}')
      ON CONFLICT (key) DO NOTHING
    `);
    // Banners preset
    await db.query(`
      INSERT INTO profile_items (key, type, name, description, emoji, cost_coins, rarity, data) VALUES
      ('banner_lemon_rain', 'banner', 'Lluvia de Coins',    'Banner animado clásico',     '🪙', 3,   'common',    '{"effect":"lemon_rain","color1":"#f5e03a","color2":"#ff6200","category":"classic"}'),
      ('banner_lightning',  'banner', 'Tormenta Eléctrica','Energía pura en tu perfil',     '⚡', 5,   'rare',      '{"effect":"lightning","color1":"#f5e03a","color2":"#fbbf24","category":"tech"}'),
      ('banner_fire',       'banner', 'Llamas',            'El poder del fuego',            '🔥', 5,   'rare',      '{"effect":"fire","color1":"#ff6200","color2":"#f5e03a","category":"tech"}'),
      ('banner_matrix',     'banner', 'Matrix',            'Estilo hacker futurista',       '👾', 7,   'epic',      '{"effect":"matrix","color1":"#22c55e","color2":"#14532d","category":"tech"}'),
      ('banner_stars',      'banner', 'Estrellas',         'El universo a tu favor',        '✨', 4,   'common',    '{"effect":"stars","color1":"#a78bfa","color2":"#312e81","category":"space"}'),
      ('banner_rainbow',    'banner', 'Arcoíris',          'Todos los colores del mundo',   '🌈', 6,   'epic',      '{"effect":"rainbow","color1":"#f5e03a","color2":"#a78bfa","category":"nature"}'),
      ('banner_snow',       'banner', 'Nevada',            'Tranquilidad y elegancia',      '❄', 4,   'common',    '{"effect":"snow","color1":"#bae6fd","color2":"#0ea5e9","category":"nature"}')
      ON CONFLICT (key) DO NOTHING
    `);
  }
}
migrate().catch(e => console.error("[PROFILE MIGRATE]", e));

// ── helper: stats sociales reales ────────────────────────────────────────────
// Reemplaza el { total_shipments, delivered, total_usd } legacy con counts
// que reflejan actividad social del user. Sprint 11. Si una tabla falta
// (deploys viejos) cada count cae a 0 sin romper el endpoint.
async function getSocialStats(userId) {
  const queries = [
    // Posts del user
    db.query(`SELECT COUNT(*)::int AS c FROM user_posts WHERE user_id=$1`, [userId]).catch(() => ({ rows: [{ c: 0 }] })),
    // Comentarios escritos por el user
    db.query(`SELECT COUNT(*)::int AS c FROM post_comments WHERE user_id=$1`, [userId]).catch(() => ({ rows: [{ c: 0 }] })),
    // Likes recibidos en posts del user
    db.query(`SELECT COUNT(*)::int AS c FROM post_likes pl JOIN user_posts p ON p.id=pl.post_id WHERE p.user_id=$1`, [userId]).catch(() => ({ rows: [{ c: 0 }] })),
    // Friends accepted (bidireccional: chequea ambos lados)
    db.query(`SELECT COUNT(*)::int AS c FROM chat_friendships WHERE status='accepted' AND (user_id=$1 OR friend_id=$1)`, [userId]).catch(() => ({ rows: [{ c: 0 }] })),
    // Followers / Following
    db.query(`SELECT COUNT(*)::int AS c FROM user_follows WHERE followee_id=$1`, [userId]).catch(() => ({ rows: [{ c: 0 }] })),
    db.query(`SELECT COUNT(*)::int AS c FROM user_follows WHERE follower_id=$1`, [userId]).catch(() => ({ rows: [{ c: 0 }] })),
    // Dias activo en la plataforma
    db.query(`SELECT GREATEST(0, EXTRACT(DAY FROM NOW() - created_at)::int) AS c FROM users WHERE id=$1`, [userId]).catch(() => ({ rows: [{ c: 0 }] })),
  ];
  const [posts, comments, likes, friends, followers, following, days] = await Promise.all(queries);
  return {
    posts:        posts.rows[0]?.c     || 0,
    comments:     comments.rows[0]?.c  || 0,
    likes:        likes.rows[0]?.c     || 0,
    friends:      friends.rows[0]?.c   || 0,
    followers:    followers.rows[0]?.c || 0,
    following:    following.rows[0]?.c || 0,
    days_active:  days.rows[0]?.c      || 0,
    // Legacy contract — Sprint 12 los borra. Mantenerlos en 0 para no romper
    // clients viejos que aun lean stats.total_shipments / delivered / total_usd.
    total_shipments: 0, delivered: 0, total_usd: 0,
  };
}

// ── GET /profile — perfil del usuario actual ──────────────────────────────────
router.get("/", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    // Crear perfil si no existe
    await db.query(`
      INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING
    `, [userId]);

    const [profileQ, coinsQ, userQ, itemsQ, stats] = await Promise.all([
      db.query(`SELECT * FROM user_profiles WHERE user_id=$1`, [userId]),
      db.query(`SELECT balance, total_earned, peak_balance FROM coins WHERE user_id=$1`, [userId]),
      db.query(`SELECT id, name, email, client_number, role, username, created_at FROM users WHERE id=$1`, [userId]),
      db.query(`SELECT item_key FROM user_items WHERE user_id=$1`, [userId]),
      getSocialStats(userId),
    ]);

    const profile = profileQ.rows[0];
    const coins   = coinsQ.rows[0] || { balance: 0, total_earned: 0 };
    const user    = userQ.rows[0];
    const items   = itemsQ.rows.map(r => r.item_key);

    // Calcular nivel
    const balance  = Number(coins.balance);
    const peak     = Number(coins.peak_balance || Math.max(balance, Number(coins.total_earned) || 0));
    const level    = peak >= 1500 ? "gold" : peak >= 500 ? "silver" : "bronze";

    // Sprint 11: stats sociales reales. Auto-badges basadas en posts/likes/
    // friends ahora que tenemos counts reales — la lista vive en ProfilePage
    // y se evalua client-side contra stats.posts / stats.likes / etc.
    const allItems = items;

    res.json({
      user:    { ...user, level },
      profile: { ...profile, owned_items: allItems },
      coins:   { balance, total_earned: Number(coins.total_earned), peak_balance: peak },
      stats,
    });
  } catch(e) { console.error("[PROFILE GET]", e); res.status(500).json({ error: e.message }); }
});

// ── GET /profile/shop — catálogo de items ─────────────────────────────────────
router.get("/shop", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const [itemsQ, ownedQ] = await Promise.all([
      db.query(`SELECT * FROM profile_items WHERE active=true ORDER BY cost_coins ASC`),
      db.query(`SELECT item_key FROM user_items WHERE user_id=$1`, [userId]),
    ]);
    const owned = ownedQ.rows.map(r => r.item_key);
    res.json({
      items: itemsQ.rows.map(i => ({ ...i, owned: owned.includes(i.key) })),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /profile/buy — comprar item con coins ────────────────────────────────
router.post("/buy", authRequired, async (req, res) => {
  try {
    const userId  = req.user.id;
    const { item_key } = req.body;
    if (!item_key) return res.status(400).json({ error: "item_key requerido" });

    // Verificar item
    const itemQ = await db.query(`SELECT * FROM profile_items WHERE key=$1 AND active=true`, [item_key]);
    if (!itemQ.rows[0]) return res.status(404).json({ error: "Item no encontrado" });
    const item = itemQ.rows[0];

    // Verificar que no lo tenga ya
    const ownedQ = await db.query(`SELECT id FROM user_items WHERE user_id=$1 AND item_key=$2`, [userId, item_key]);
    if (ownedQ.rows[0]) return res.status(400).json({ error: "Ya tenés este item" });

    // Verificar coins
    if (item.cost_coins > 0) {
      await db.query(`INSERT INTO coins (user_id,balance,total_earned) VALUES ($1,0,0) ON CONFLICT (user_id) DO NOTHING`, [userId]);
      const coinsQ = await db.query(`SELECT balance FROM coins WHERE user_id=$1`, [userId]);
      const balance = Number(coinsQ.rows[0]?.balance || 0);
      if (balance < item.cost_coins) {
        return res.status(400).json({ error: `Coins insuficientes. Tenés ${balance}, necesitás ${item.cost_coins}` });
      }
      // Descontar coins — atómico con guard (evita doble gasto por concurrencia).
      const debit = await db.query(`UPDATE coins SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2 AND balance>=$1 RETURNING balance`, [item.cost_coins, userId]);
      if (!debit.rows[0]) return res.status(400).json({ error: "Coins insuficientes." });
      await db.query(`INSERT INTO coin_transactions (user_id,type,amount,reason) VALUES ($1,'redeem',$2,$3)`,
        [userId, -item.cost_coins, `Compra de perfil: ${item.name}`]);
    }

    // Dar item
    await db.query(`INSERT INTO user_items (user_id, item_key) VALUES ($1, $2)`, [userId, item_key]);

    const newBalance = item.cost_coins > 0
      ? (await db.query(`SELECT balance FROM coins WHERE user_id=$1`, [userId])).rows[0]?.balance
      : null;

    res.json({ ok: true, item, new_balance: newBalance ? Number(newBalance) : null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /profile — actualizar perfil activo ─────────────────────────────────
router.patch("/", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatar_key, frame_key, title_key, badges, bio,
            name_color, name_glow_color, name_glow,
            name_grad_from, name_grad_to,
            nickname, nick_color, nick_glow, icon_slug,
            privacy_envios, privacy_coins, privacy_logros, privacy_posts, privacy_amigos } = req.body;

    // Verificar powers del chat si quiere cambiar nombre/chat config
    const chatFields = { name_color, name_glow_color, name_glow, name_grad_from, name_grad_to, nickname, nick_color, nick_glow, icon_slug };
    const hasChatChanges = Object.values(chatFields).some(v => v !== undefined);
    if (hasChatChanges) {
      const powersQ = await db.query(`SELECT power_slug FROM user_chat_powers WHERE user_id=$1`, [userId]);
      const owned = powersQ.rows.map(r => r.power_slug);
      const roleQ = await db.query(`SELECT role FROM users WHERE id=$1`, [userId]);
      const isStaff = ['admin','operator'].includes(roleQ.rows[0]?.role);
      if (!isStaff) {
        if (name_color !== undefined && !owned.includes('namecolor')) return res.status(403).json({ error: "Necesitás el power namecolor" });
        if ((name_grad_from || name_grad_to) && !owned.includes('namegrad')) return res.status(403).json({ error: "Necesitás el power namegrad" });
        if (name_glow !== undefined && !owned.includes('nameglow')) return res.status(403).json({ error: "Necesitás el power nameglow" });
        if (nickname !== undefined && !owned.includes('nickname')) return res.status(403).json({ error: "Necesitás el power nickname" });
        if (nick_color !== undefined && !owned.includes('nickcolor')) return res.status(403).json({ error: "Necesitás el power nickcolor" });
        if (nick_glow !== undefined && !owned.includes('nickglow')) return res.status(403).json({ error: "Necesitás el power nickglow" });
        if (icon_slug !== undefined && !owned.includes(icon_slug)) return res.status(403).json({ error: "Necesitás el power " + icon_slug });
      }
      // Guardar en user_profiles
      await db.query(`
        INSERT INTO user_profiles (user_id, name_color, name_glow_color, name_glow,
          name_grad_from, name_grad_to, nickname, nick_color, nick_glow, icon_slug, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          name_color      = COALESCE($2, user_profiles.name_color),
          name_glow_color = COALESCE($3, user_profiles.name_glow_color),
          name_glow       = COALESCE($4, user_profiles.name_glow),
          name_grad_from  = COALESCE($5, user_profiles.name_grad_from),
          name_grad_to    = COALESCE($6, user_profiles.name_grad_to),
          nickname        = COALESCE($7, user_profiles.nickname),
          nick_color      = COALESCE($8, user_profiles.nick_color),
          nick_glow       = COALESCE($9, user_profiles.nick_glow),
          icon_slug       = COALESCE($10, user_profiles.icon_slug),
          updated_at      = NOW()
      `, [userId, name_color||null, name_glow_color||null, name_glow!=null?name_glow:null,
          name_grad_from||null, name_grad_to||null, nickname||null,
          nick_color||null, nick_glow!=null?nick_glow:null, icon_slug||null]);
    }

    // Verificar que el usuario tiene los items que quiere equipar
    async function hasItem(key) {
      if (!key) return true;
      const q = await db.query(`SELECT id FROM user_items WHERE user_id=$1 AND item_key=$2`, [userId, key]);
      return !!q.rows[0];
    }

    if (avatar_key && !(await hasItem(avatar_key))) return res.status(403).json({ error: "No tenés ese avatar" });
    if (frame_key  && !(await hasItem(frame_key)))  return res.status(403).json({ error: "No tenés ese marco" });
    if (title_key  && !(await hasItem(title_key)))  return res.status(403).json({ error: "No tenés ese título" });

    await db.query(`
      INSERT INTO user_profiles (user_id, avatar_key, frame_key, title_key, badges, bio,
        privacy_envios, privacy_coins, privacy_logros, privacy_posts, privacy_amigos, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        avatar_key      = COALESCE($2, user_profiles.avatar_key),
        frame_key       = $3,
        title_key       = $4,
        badges          = COALESCE($5, user_profiles.badges),
        bio             = COALESCE($6, user_profiles.bio),
        privacy_envios  = COALESCE($7, user_profiles.privacy_envios),
        privacy_coins   = COALESCE($8, user_profiles.privacy_coins),
        privacy_logros  = COALESCE($9, user_profiles.privacy_logros),
        privacy_posts   = COALESCE($10, user_profiles.privacy_posts),
        privacy_amigos  = COALESCE($11, user_profiles.privacy_amigos),
        updated_at      = NOW()
    `, [userId, avatar_key||null, frame_key||null, title_key||null,
        badges ? `{${badges.join(",")}}` : null, bio||null,
        privacy_envios!=null?privacy_envios:null,
        privacy_coins!=null?privacy_coins:null,
        privacy_logros!=null?privacy_logros:null,
        privacy_posts!=null?privacy_posts:null,
        privacy_amigos!=null?privacy_amigos:null]);

    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ── POST /profile/studio — guardar config del studio (solo admin) ─────────────
router.post("/studio", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("[STUDIO] user:", userId, "body:", JSON.stringify(req.body));
    const me = await db.query(`SELECT role FROM users WHERE id=$1`, [userId]);
    console.log("[STUDIO] role:", me.rows[0]?.role);
    if (me.rows[0]?.role !== "admin") return res.status(403).json({ error: "Solo admin" });

    const { name_color, name_glow_color, name_glow, custom_name, banner_effect, banner_color1, banner_color2 } = req.body;

    await db.query(`
      INSERT INTO user_profiles (user_id, name_color, name_glow_color, name_glow, custom_name, banner_effect, banner_color1, banner_color2, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        name_color      = COALESCE($2, user_profiles.name_color),
        name_glow_color = COALESCE($3, user_profiles.name_glow_color),
        name_glow       = COALESCE($4, user_profiles.name_glow),
        custom_name     = COALESCE($5, user_profiles.custom_name),
        banner_effect   = COALESCE($6, user_profiles.banner_effect),
        banner_color1   = COALESCE($7, user_profiles.banner_color1),
        banner_color2   = COALESCE($8, user_profiles.banner_color2),
        updated_at      = NOW()
    `, [userId, name_color||null, name_glow_color||null, name_glow!=null?name_glow:null, custom_name||null,
        banner_effect||null, banner_color1||null, banner_color2||null]);

    // Actualizar nombre si viene
    if (custom_name) {
      await db.query(`UPDATE users SET name=$1 WHERE id=$2`, [custom_name, userId]);
    }

    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /profile/studio/badge — crear badge custom (solo admin) ──────────────
router.post("/studio/badge", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const me = await db.query(`SELECT role FROM users WHERE id=$1`, [userId]);
    if (me.rows[0]?.role !== "admin") return res.status(403).json({ error: "Solo admin" });

    const { key, name, description, emoji, cost_coins, rarity, data } = req.body;
    if (!key || !name) return res.status(400).json({ error: "key y name requeridos" });

    await db.query(`
      INSERT INTO profile_items (key, type, name, description, emoji, cost_coins, rarity, data, active)
      VALUES ($1, 'badge', $2, $3, $4, $5, $6, $7, true)
      ON CONFLICT (key) DO UPDATE SET
        name=$2, description=$3, emoji=$4, cost_coins=$5, rarity=$6, data=$7, active=true
    `, [key, name, description||"", emoji||"⚡", cost_coins||0, rarity||"legendary", JSON.stringify(data||{})]);

    // Auto-dar la badge al admin
    await db.query(`INSERT INTO user_items (user_id, item_key) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [userId, key]);

    res.json({ ok: true, key });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ── POST /profile/unlock — desbloquear feature o comprar banner preset ────────
router.post("/unlock", authRequired, async (req, res) => {
  try {
    const userId   = req.user.id;
    const { item_key } = req.body;
    if (!item_key) return res.status(400).json({ error: "item_key requerido" });

    // Verificar item existe y es feature o banner
    const itemQ = await db.query(
      `SELECT * FROM profile_items WHERE key=$1 AND active=true AND type IN ('feature','banner')`,
      [item_key]
    );
    if (!itemQ.rows[0]) return res.status(404).json({ error: "Item no encontrado" });
    const item = itemQ.rows[0];

    // Verificar que no lo tenga ya
    const ownedQ = await db.query(
      `SELECT id FROM user_items WHERE user_id=$1 AND item_key=$2`,
      [userId, item_key]
    );
    if (ownedQ.rows[0]) return res.status(400).json({ error: "Ya tenés este item" });

    // Verificar y descontar coins
    await db.query(
      `INSERT INTO coins (user_id,balance,total_earned) VALUES ($1,0,0) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    const coinsQ = await db.query(`SELECT balance FROM coins WHERE user_id=$1`, [userId]);
    const balance = Number(coinsQ.rows[0]?.balance || 0);
    if (balance < item.cost_coins) {
      return res.status(400).json({ error: `Coins insuficientes. Tenés ${balance}, necesitás ${item.cost_coins}` });
    }

    // Cobro atómico con guard (evita doble gasto / balance negativo por concurrencia).
    const debit = await db.query(
      `UPDATE coins SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2 AND balance>=$1 RETURNING balance`,
      [item.cost_coins, userId]
    );
    if (!debit.rows[0]) return res.status(400).json({ error: "Coins insuficientes." });

    // Dar item
    await db.query(`INSERT INTO user_items (user_id, item_key) VALUES ($1, $2)`, [userId, item_key]);

    // Si es feature, agregarlo a features_unlocked del perfil
    if (item.type === 'feature') {
      const data = item.data || {};
      await db.query(`
        INSERT INTO user_profiles (user_id, features_unlocked, updated_at)
        VALUES ($1, ARRAY[$2::text], NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          features_unlocked = array_append(
            COALESCE(user_profiles.features_unlocked, '{}'),
            $2::text
          ),
          updated_at = NOW()
      `, [userId, data.feature || item_key]);
    }

    const newBalance = (await db.query(`SELECT balance FROM coins WHERE user_id=$1`, [userId])).rows[0]?.balance;
    res.json({ ok: true, item, new_balance: Number(newBalance) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /profile/banner — equipar banner preset ─────────────────────────────
router.patch("/banner", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { banner_key } = req.body;

    if (!banner_key) {
      // Desequipar banner — volver a ninguno
      await db.query(`
        INSERT INTO user_profiles (user_id, banner_key, banner_effect, updated_at)
        VALUES ($1, NULL, 'none', NOW())
        ON CONFLICT (user_id) DO UPDATE SET banner_key=NULL, banner_effect='none', updated_at=NOW()
      `, [userId]);
      return res.json({ ok: true });
    }

    // Verificar que el usuario lo tiene
    const has = await db.query(
      `SELECT id FROM user_items WHERE user_id=$1 AND item_key=$2`,
      [userId, banner_key]
    );
    if (!has.rows[0]) return res.status(403).json({ error: "No tenés ese banner" });

    // Leer el data del banner para extraer effect y colors
    const itemQ = await db.query(
      `SELECT data FROM profile_items WHERE key=$1`,
      [banner_key]
    );
    const data = itemQ.rows[0]?.data || {};

    // Guardar banner_key + actualizar effect/colors para que el perfil lo muestre
    await db.query(`
      INSERT INTO user_profiles (user_id, banner_key, banner_effect, banner_color1, banner_color2, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        banner_key    = $2,
        banner_effect = $3,
        banner_color1 = $4,
        banner_color2 = $5,
        updated_at    = NOW()
    `, [userId, banner_key, data.effect || "none", data.color1 || "#f5e03a", data.color2 || "#ff6200"]);

    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /profile/ranking ──────────────────────────────────────────────────────
router.get("/ranking", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit)||20, 50);
    // Sprint 11: ranking incluye posts_count + friends_count reales en lugar
    // de total_shipments/delivered legacy. Subqueries son baratas (count(*)
    // sobre indexed cols) y limit es <= 50.
    const q = await db.query(`
      SELECT u.id, u.name, u.client_number, u.role,
        lc.balance, lc.total_earned,
        up.name_color, up.name_glow, up.name_glow_color, up.name_grad_from, up.name_grad_to,
        up.nickname, up.nick_color, up.nick_glow, up.icon_slug, up.avatar_url, up.avatar_key,
        up.frame_key, up.badges,
        (SELECT COUNT(*)::int FROM user_posts      WHERE user_id = u.id) AS posts_count,
        (SELECT COUNT(*)::int FROM chat_friendships WHERE status='accepted' AND (user_id=u.id OR friend_id=u.id)) AS friends_count
      FROM users u
      JOIN coins lc ON lc.user_id = u.id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.role != 'operator'
      ORDER BY lc.total_earned DESC
      LIMIT $1
    `, [limit]);
    res.json({ ok: true, ranking: q.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /profile/spin ─────────────────────────────────────────────────────────
router.get("/spin", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const last = await db.query(`SELECT * FROM daily_spin WHERE user_id=$1 ORDER BY spun_at DESC LIMIT 1`, [userId]);
    const lastSpin = last.rows[0];
    const canSpin = !lastSpin || (new Date() - new Date(lastSpin.spun_at)) > 24*60*60*1000;
    res.json({ ok: true, can_spin: canSpin, last_spin: lastSpin || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /profile/spin ────────────────────────────────────────────────────────
router.post("/spin", authRequired, async (req, res) => {
  const client = await db.connect();
  try {
    const userId = req.user.id;
    // Serializamos los giros del mismo usuario con un advisory lock transaccional:
    // evita que N requests concurrentes pasen el chequeo de cooldown a la vez.
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [userId]);
    const last = await client.query(`SELECT spun_at FROM daily_spin WHERE user_id=$1 ORDER BY spun_at DESC LIMIT 1`, [userId]);
    const lastSpin = last.rows[0];
    if (lastSpin && (new Date() - new Date(lastSpin.spun_at)) < 24*60*60*1000) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Ya giraste hoy. Volvé mañana!" });
    }
    // ORDEN EXACTO igual al frontend (8 segmentos). Escala acorde al sistema de
    // puntos (1 punto = valor de canje real; el descuento más barato = 150 pts):
    // ~92% cae en 0/1/2 y 3/5/10/25/50 son deliberadamente muy improbables.
    // probs suman 100 (rand = Math.random()*100).
    const prizes = [
      { label:"Vuelve 24hs", coins:0,  prob:33   },
      { label:"1",           coins:1,  prob:45   },
      { label:"2",           coins:2,  prob:14   },
      { label:"3",           coins:3,  prob:4    },
      { label:"5",           coins:5,  prob:2    },
      { label:"10",          coins:10, prob:1.4  },
      { label:"25",          coins:25, prob:0.5  },
      { label:"50",          coins:50, prob:0.1  },
    ];
    const rand = Math.random() * 100;
    let cumulative = 0, wonIdx = 0;
    for (let i = 0; i < prizes.length; i++) {
      cumulative += prizes[i].prob;
      if (rand <= cumulative) { wonIdx = i; break; }
      if (i === prizes.length - 1) wonIdx = i;
    }
    const won = prizes[wonIdx];
    await client.query(`INSERT INTO coins (user_id,balance,total_earned) VALUES ($1,0,0) ON CONFLICT (user_id) DO NOTHING`, [userId]);
    await client.query(`UPDATE coins SET balance=balance+$1, total_earned=total_earned+$1, updated_at=NOW() WHERE user_id=$2`, [won.coins, userId]);
    await client.query(`INSERT INTO coin_transactions (user_id, type, amount, reason) VALUES ($1,'earn',$2,$3)`, [userId, won.coins, 'Ruleta diaria: ' + won.label]);
    await client.query(`INSERT INTO daily_spin (user_id, coins_won, prize_label) VALUES ($1,$2,$3)`, [userId, won.coins, won.label]);
    await client.query("COMMIT");
    const prizeIndex = wonIdx;
    res.json({ ok: true, prize: won, prize_index: prizeIndex, prizes });
  } catch(e) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("SPIN ERROR:", e);
    res.status(500).json({ error: "Error interno" });
  } finally {
    client.release();
  }
});

// ── GET /profile/missions ─────────────────────────────────────────────────────
router.get("/missions", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0,10);
    const weekNum = Math.ceil(new Date().getDate()/7);
    const week = new Date().getFullYear() + '-W' + String(weekNum).padStart(2,'0');
    const q = await db.query(`
      SELECT m.*,
        um.progress, um.completed_at, um.claimed_at, um.period
      FROM coin_missions m
      LEFT JOIN user_missions um ON um.mission_slug = m.slug AND um.user_id = $1
        AND (
          (m.mission_type = 'daily'   AND um.period = $2) OR
          (m.mission_type = 'weekly'  AND um.period = $3) OR
          (m.mission_type = 'onetime')
        )
      WHERE m.is_active = TRUE
      ORDER BY m.mission_type, m.coins_reward DESC
    `, [userId, today, week]);
    res.json({ ok: true, missions: q.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /profile/missions/:slug/claim ───────────────────────────────────────
router.post("/missions/:slug/claim", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { slug } = req.params;
    const today = new Date().toISOString().slice(0,10);
    const weekNum = Math.ceil(new Date().getDate()/7);
    const week = new Date().getFullYear() + '-W' + String(weekNum).padStart(2,'0');
    const mQ = await db.query(`SELECT * FROM coin_missions WHERE slug=$1`, [slug]);
    const mission = mQ.rows[0];
    if (!mission) return res.status(404).json({ error: "Misión no encontrada" });
    const period = mission.mission_type==='daily' ? today : mission.mission_type==='weekly' ? week : 'forever';
    const umQ = await db.query(`SELECT * FROM user_missions WHERE user_id=$1 AND mission_slug=$2 AND period=$3`, [userId, slug, period]);
    const um = umQ.rows[0];
    if (!um?.completed_at) return res.status(400).json({ error: "Misión no completada aún" });
    if (um.claimed_at) return res.status(400).json({ error: "Ya reclamaste esta misión" });
    // Claim atómico: el guard `claimed_at IS NULL` evita cobrar dos veces la misma
    // misión con requests concurrentes. Si no devuelve fila, ya se reclamó.
    const claim = await db.query(`UPDATE user_missions SET claimed_at=NOW() WHERE user_id=$1 AND mission_slug=$2 AND period=$3 AND claimed_at IS NULL RETURNING id`, [userId, slug, period]);
    if (!claim.rows[0]) return res.status(400).json({ error: "Ya reclamaste esta misión" });
    await db.query(`INSERT INTO coins (user_id,balance,total_earned) VALUES ($1,0,0) ON CONFLICT (user_id) DO NOTHING`, [userId]);
    await db.query(`UPDATE coins SET balance=balance+$1, total_earned=total_earned+$1, updated_at=NOW() WHERE user_id=$2`, [mission.coins_reward, userId]);
    await db.query(`INSERT INTO coin_transactions (user_id, type, amount, reason) VALUES ($1,'earn',$2,$3)`, [userId, mission.coins_reward, 'Misión: ' + mission.title]);

    // La racha de login ya NO se toca acá: se actualiza al ENTRAR a la app
    // (checkMissions('login'), disparado por /auth/me y /auth/login). Reclamar
    // la misión diaria sólo paga sus coins.
    res.json({ ok: true, coins_earned: mission.coins_reward });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET /profile/referrals — link único + stats ──────────────────────────────
router.get("/referrals", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const userQ = await db.query(`SELECT username FROM users WHERE id=$1`, [userId]);
    const username = userQ.rows[0]?.username;
    const base = process.env.APP_URL || "http://localhost:5173";
    const link = username ? `${base}/register?r=${username}` : null;

    const refsQ = await db.query(
      `SELECT r.*, u.name AS referred_name, u.username AS referred_username, u.created_at AS referred_signup
         FROM referrals r
         JOIN users u ON u.id = r.referred_id
        WHERE r.referrer_id=$1
        ORDER BY r.created_at DESC`,
      [userId]
    );
    const refs = refsQ.rows;
    const pending  = refs.filter(r => r.status === "pending").length;
    const rewarded = refs.filter(r => r.status === "rewarded").length;
    const totalCoins = refs
      .filter(r => r.status === "rewarded")
      .reduce((s, r) => s + (Number(r.coins_referrer) || 0), 0);

    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      username, link,
      stats: { total: refs.length, pending, rewarded, total_coins_earned: totalCoins },
      referrals: refs,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /profile/streak ───────────────────────────────────────────────────────
// Devuelve streak actual + array de últimos 7 días con flag claimed/missed.
router.get("/streak", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().slice(0,10);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0,10);

    // last_login como texto (evita ambigüedad Date/string del driver pg).
    const sQ = await db.query(
      `SELECT streak, to_char(last_login,'YYYY-MM-DD') AS last_login FROM login_streaks WHERE user_id=$1`,
      [userId]
    );
    const row = sQ.rows[0] || { streak: 0, last_login: null };
    // Racha efectiva: sólo vale si entró hoy o ayer; si se salteó un día está
    // rota → 0 (aunque el valor guardado no se haya reseteado aún).
    const streakVal = (row.last_login === today || row.last_login === yesterday)
      ? (row.streak || 0) : 0;

    // Fechas YYYY-MM-DD de los últimos 7 días (inclusive hoy)
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0,10));
    }
    // Días en que ENTRÓ (misión daily_login completada) dentro del rango.
    const seenQ = await db.query(
      `SELECT period FROM user_missions
        WHERE user_id=$1 AND mission_slug='daily_login' AND completed_at IS NOT NULL
          AND period = ANY($2)`,
      [userId, days]
    );
    const seenSet = new Set(seenQ.rows.map(r => r.period));
    const week = days.map(d => ({
      date: d,
      day_short: new Date(d).toLocaleDateString("es-AR", { weekday: "short" }).slice(0,3).toUpperCase(),
      claimed: seenSet.has(d),   // "claimed" = entró ese día (el front lo pinta con ✅)
      is_today: d === today,
    }));

    res.set("Cache-Control", "no-store");
    res.json({ ok: true, streak: streakVal, last_login: row.last_login, week });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /profile/gift ────────────────────────────────────────────────────────
router.post("/gift", authRequired, async (req, res) => {
  try {
    const fromId = req.user.id;
    const { to_client_number, message } = req.body;
    // Validar monto: entero positivo, mínimo 10, con tope defensivo (evita floats/negativos/gigantes).
    const amount = Number(req.body.amount);
    if (!Number.isInteger(amount) || amount < 10 || amount > 1000000) return res.status(400).json({ error: "Monto inválido (mínimo 10 coins)" });
    const giftMsg = message ? sanitizeText(String(message), 200) : null;
    const toQ = await db.query(`SELECT id, name FROM users WHERE client_number=$1`, [to_client_number]);
    if (!toQ.rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });
    const toUser = toQ.rows[0];
    if (toUser.id === fromId) return res.status(400).json({ error: "No podés regalarte a vos mismo" });
    // Cobro atómico con guard (evita doble gasto / balance negativo por concurrencia).
    const debit = await db.query(`UPDATE coins SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2 AND balance>=$1 RETURNING balance`, [amount, fromId]);
    if (!debit.rows[0]) return res.status(400).json({ error: "Coins insuficientes" });
    await db.query(`UPDATE coins SET balance=balance+$1, total_earned=total_earned+$1, updated_at=NOW() WHERE user_id=$2`, [amount, toUser.id]);
    await db.query(`INSERT INTO coin_transactions (user_id, type, amount, reason) VALUES ($1,'spend',$2,$3)`, [fromId, amount, 'Gift a ' + toUser.name]);
    await db.query(`INSERT INTO coin_transactions (user_id, type, amount, reason) VALUES ($1,'earn',$2,$3)`, [toUser.id, amount, 'Gift de ' + req.user.name]);
    await db.query(`INSERT INTO coin_gifts (from_user_id, to_user_id, amount, message) VALUES ($1,$2,$3,$4)`, [fromId, toUser.id, amount, giftMsg]);
    res.json({ ok: true, message: '🎁 Regalaste ' + amount + ' coins a ' + toUser.name });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ── GET /profile/:id — ver perfil de otro usuario (solo staff) ───────────────
router.get("/:id", authRequired, async (req, res) => {
  try {
    const requesterId = req.user.id;
    const targetId    = parseInt(req.params.id);

    // Cualquier user autenticado puede ver perfiles públicos.
    // Sólo el propio user o staff ven el email.
    const requesterQ = await db.query(`SELECT role FROM users WHERE id=$1`, [requesterId]);
    const role = requesterQ.rows[0]?.role;
    const isOwnerOrStaff = requesterId === targetId || role === "operator" || role === "admin";

    await db.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [targetId]);

    const [profileQ, coinsQ, userQ, itemsQ, stats] = await Promise.all([
      db.query(`SELECT * FROM user_profiles WHERE user_id=$1`, [targetId]),
      db.query(`SELECT balance, total_earned FROM coins WHERE user_id=$1`, [targetId]),
      db.query(`SELECT id, name, email, client_number, role, username, created_at, last_seen_at FROM users WHERE id=$1`, [targetId]),
      db.query(`SELECT item_key FROM user_items WHERE user_id=$1`, [targetId]),
      getSocialStats(targetId),
    ]);

    if (!userQ.rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });

    const coins  = coinsQ.rows[0] || { balance:0, total_earned:0 };
    const balance  = Number(coins.balance);
    const peak     = Number(coins.peak_balance || Math.max(balance, Number(coins.total_earned) || 0));
    const level    = peak >= 1500 ? "gold" : peak >= 500 ? "silver" : "bronze";
    const items    = itemsQ.rows.map(r => r.item_key);

    // Sprint 11: stats sociales reales (posts/comments/likes/friends/follows/days).
    // Sanitize: no leak email a otros users.
    const userOut = { ...userQ.rows[0], level };
    if (!isOwnerOrStaff) delete userOut.email;

    // Privacidad server-side: los flags NO se pueden aplicar sólo en el cliente
    // (los datos ya salieron). Para no-dueño/no-staff ocultamos lo que el usuario
    // marcó como privado. Polaridad (igual que el cliente):
    //   coins/posts visibles si el flag !== false; amigos visible sólo si === true.
    const prof = profileQ.rows[0] || {};
    let coinsOut = { balance, total_earned: Number(coins.total_earned), peak_balance: peak };
    let statsOut = stats;
    if (!isOwnerOrStaff) {
      if (prof.privacy_coins === false) coinsOut = null;
      if (prof.privacy_posts === false) statsOut = { ...statsOut, posts: null, comments: null, likes: null };
      if (prof.privacy_amigos !== true)  statsOut = { ...statsOut, friends: null, followers: null, following: null };
    }

    res.json({
      user:    userOut,
      profile: { ...prof, owned_items: items },
      coins:   coinsOut,
      stats:   statsOut,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST /profile/avatar-upload ──────────────────────────────────────────────
router.post("/avatar-upload", authRequired, upload.single("avatar"), async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ error: "No se recibió ninguna imagen" });

    // Sprint 14: configurar SDK por request (lee creds de configStore)
    const cloudinary = await configureCloudinary();

    // Subir a Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "portal-avatars", public_id: `avatar_${userId}`, overwrite: true, transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }] },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });

    const url = result.secure_url;

    // Guardar en DB
    await db.query(
      `INSERT INTO user_profiles (user_id, avatar_url, updated_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (user_id) DO UPDATE SET avatar_url=$2, updated_at=NOW()`,
      [userId, url]
    );

    // Completar mision perfil completo
    try {
      const profileQ = await db.query(`SELECT bio, avatar_url FROM user_profiles WHERE user_id=$1`, [userId]);
      const p = profileQ.rows[0];
      if (p?.bio && p?.avatar_url) {
        const today = new Date().toISOString().slice(0,10);
        await db.query(
          `INSERT INTO user_missions (user_id, mission_slug, progress, completed_at, period)
           VALUES ($1,'onetime_profile',1,NOW(),'forever')
           ON CONFLICT (user_id, mission_slug, period) DO UPDATE SET completed_at=NOW(), progress=1
           WHERE user_missions.completed_at IS NULL`,
          [userId]
        );
      }
    } catch(me) { console.log("[MISSION] profile check error:", me.message); }

    res.json({ ok: true, url });
  } catch(e) {
    console.error("[AVATAR UPLOAD]", e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
