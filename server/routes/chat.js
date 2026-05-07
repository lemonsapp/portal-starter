const express = require("express");
const router = express.Router();
const db = require("../db");
const { authRequired } = require("../auth");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { sanitizeText } = require("../security");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo imágenes (PNG/WEBP/GIF)"));
  },
});

// ── Auto-migración custom_emojis + story likes + reply_to_story ──────────────
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS custom_emojis (
        key         TEXT PRIMARY KEY,
        url         TEXT NOT NULL,
        label       TEXT,
        kind        TEXT DEFAULT 'static',  -- static | animated
        category    TEXT DEFAULT 'general',
        created_by  INT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_story_likes (
        story_id   INT NOT NULL,
        user_id    INT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (story_id, user_id)
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_user_story_likes_story ON user_story_likes(story_id)`);
    await db.query(`ALTER TABLE chat_private_messages ADD COLUMN IF NOT EXISTS reply_to_story_id INT`);
    await db.query(`ALTER TABLE chat_private_messages ADD COLUMN IF NOT EXISTS reply_story_image_url TEXT`);
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
    // Seed sala default 'general' para que el chat funcione out-of-the-box
    // (init-db.sql ya la incluye, pero esto cubre tenants migrados desde antes).
    await db.query(`
      INSERT INTO chat_rooms (slug, name, description, icon, coins_required, is_active)
      VALUES ('general', 'Sala general', 'Charlá con toda la comunidad', '💬', 0, TRUE)
      ON CONFLICT (slug) DO NOTHING
    `);
    console.log("[MIGRATION] custom_emojis + story_likes + reply_to_story + general room ready");
  } catch (e) { console.error("[MIGRATION chat ERROR]", e.message); }
})();

// ── GET /api/chat/emojis — lista (auth) ──────────────────────────────────────
router.get("/emojis", authRequired, async (req, res) => {
  try {
    const q = await db.query(`SELECT key, url, label, kind, category FROM custom_emojis ORDER BY category, key`);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, emojis: q.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/chat/emojis — admin sube (multipart: file + key + label + category) ──
router.post("/emojis", authRequired, upload.single("file"), async (req, res) => {
  try {
    if (!["admin","operator"].includes(req.user.role)) return res.status(403).json({ error: "Sin permisos" });
    const { key, label, category } = req.body;
    if (!req.file) return res.status(400).json({ error: "Falta archivo" });
    if (!key || !/^[a-z0-9_]{2,30}$/.test(key)) return res.status(400).json({ error: "Key inválida (a-z, 0-9, _, 2-30 chars)" });
    // Validar mime más estricto (defense-in-depth)
    const allowedMime = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/apng"];
    if (!allowedMime.includes(req.file.mimetype)) return res.status(400).json({ error: "Formato no permitido" });
    const safeLabel = label ? sanitizeText(label, 40) : null;
    const safeCat   = category ? sanitizeText(category, 30) : "general";

    const isAnim = req.file.mimetype === "image/gif" || req.file.mimetype === "image/apng";
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "portal-emojis",
          public_id: `emoji_${key}`,
          overwrite: true,
          resource_type: "image",
          transformation: isAnim ? [] : [{ width: 128, height: 128, crop: "fit" }],
        },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });

    const url = result.secure_url;
    const r = await db.query(
      `INSERT INTO custom_emojis (key, url, label, kind, category, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (key) DO UPDATE SET url=$2, label=$3, kind=$4, category=$5
       RETURNING *`,
      [key, url, safeLabel, isAnim ? "animated" : "static", safeCat, req.user.id]
    );
    res.json({ ok: true, emoji: r.rows[0] });
  } catch (e) {
    console.error("[POST /emojis]", e.message);
    res.status(500).json({ error: "Error al subir" });
  }
});

// ── USER STORIES (24h) ───────────────────────────────────────────────────────
// Multer separado con límite 4MB para stories
const uploadStory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Solo imágenes (PNG/JPG/WEBP/GIF)"));
  },
});

const STORIES_DAILY_LIMIT = 5;

// GET /api/chat/stories/quota — cuántas stories del usuario están activas (max 5/24h)
router.get("/stories/quota", authRequired, async (req, res) => {
  try {
    const q = await db.query(
      `SELECT COUNT(*)::int AS used FROM user_stories
        WHERE user_id=$1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [req.user.id]
    );
    const used = q.rows[0]?.used || 0;
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, used, limit: STORIES_DAILY_LIMIT, remaining: Math.max(0, STORIES_DAILY_LIMIT - used) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/chat/stories — subir nueva story (máx 5 cada 24h por user)
router.post("/stories", authRequired, uploadStory.single("file"), async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ error: "Falta imagen" });
    const allowedMime = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowedMime.includes(req.file.mimetype)) return res.status(400).json({ error: "Formato no permitido" });

    // Cuota diaria
    const cq = await db.query(
      `SELECT COUNT(*)::int AS used FROM user_stories
        WHERE user_id=$1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );
    const used = cq.rows[0]?.used || 0;
    if (used >= STORIES_DAILY_LIMIT) {
      return res.status(429).json({ error: `Ya subiste ${STORIES_DAILY_LIMIT} historias en las últimas 24 hs. Probá más tarde.`, used, limit: STORIES_DAILY_LIMIT });
    }

    const caption = req.body.caption ? sanitizeText(req.body.caption, 200) : null;
    const bgColor = req.body.bg_color ? sanitizeText(req.body.bg_color, 20) : null;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "portal-stories",
          public_id: `story_${userId}_${Date.now()}`,
          resource_type: "image",
          transformation: [{ width: 1080, height: 1920, crop: "limit", quality: "auto" }],
        },
        (error, r) => { if (error) reject(error); else resolve(r); }
      );
      stream.end(req.file.buffer);
    });

    const ins = await db.query(
      `INSERT INTO user_stories (user_id, image_url, caption, bg_color)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [userId, result.secure_url, caption, bgColor]
    );
    res.json({ ok: true, story: ins.rows[0] });
  } catch (e) {
    console.error("[POST /stories]", e.message);
    res.status(500).json({ error: "Error al subir story" });
  }
});

// GET /api/chat/stories/feed — mis stories + de mis amigos (follows mutuos + chat friends)
router.get("/stories/feed", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    // Limpiar expirados (best-effort)
    db.query(`DELETE FROM user_stories WHERE expires_at < NOW()`).catch(() => {});

    // IDs de amigos (incluye yo mismo)
    const friendsQ = await db.query(
      `WITH related AS (
         SELECT followee_id AS id FROM user_follows WHERE follower_id=$1
         UNION
         SELECT follower_id  AS id FROM user_follows WHERE followee_id=$1
         UNION
         SELECT CASE WHEN user_id=$1 THEN friend_id ELSE user_id END AS id
           FROM chat_friendships
          WHERE (user_id=$1 OR friend_id=$1) AND status='accepted'
       ) SELECT DISTINCT id FROM related`,
      [userId]
    );
    const ids = [userId, ...friendsQ.rows.map(r => r.id)];

    const q = await db.query(
      `SELECT s.id, s.user_id, s.image_url, s.caption, s.bg_color, s.created_at, s.expires_at,
              u.name, u.username, u.last_seen_at, up.avatar_url, up.name_color, up.name_glow, up.name_glow_color,
              EXISTS(SELECT 1 FROM user_story_views v WHERE v.story_id=s.id AND v.viewer_id=$1) AS viewed,
              (SELECT COUNT(*)::int FROM user_story_likes l WHERE l.story_id=s.id) AS like_count,
              EXISTS(SELECT 1 FROM user_story_likes l WHERE l.story_id=s.id AND l.user_id=$1) AS liked_by_me
         FROM user_stories s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN user_profiles up ON up.user_id = s.user_id
        WHERE s.user_id = ANY($2) AND s.expires_at > NOW()
        ORDER BY s.created_at DESC
        LIMIT 200`,
      [userId, ids]
    );

    const now = Date.now();
    // Agrupar por user
    const groups = {};
    for (const r of q.rows) {
      if (!groups[r.user_id]) {
        groups[r.user_id] = {
          user_id: r.user_id, name: r.name, username: r.username,
          avatar_url: r.avatar_url, name_color: r.name_color,
          name_glow: r.name_glow, name_glow_color: r.name_glow_color,
          online: r.last_seen_at && (now - new Date(r.last_seen_at).getTime() < 90_000),
          is_self: r.user_id === userId,
          stories: [],
          all_viewed: true,
        };
      }
      groups[r.user_id].stories.push({
        id: r.id, image_url: r.image_url, caption: r.caption,
        bg_color: r.bg_color, created_at: r.created_at, expires_at: r.expires_at,
        viewed: r.viewed,
        like_count: r.like_count, liked_by_me: r.liked_by_me,
      });
      if (!r.viewed) groups[r.user_id].all_viewed = false;
    }
    // Cronológico ascendente dentro de cada user
    for (const g of Object.values(groups)) g.stories.reverse();

    // Self primero, después los con stories no vistas, después con todas vistas
    const arr = Object.values(groups).sort((a, b) => {
      if (a.is_self && !b.is_self) return -1;
      if (!a.is_self && b.is_self) return 1;
      if (a.all_viewed !== b.all_viewed) return a.all_viewed ? 1 : -1;
      return 0;
    });

    res.set("Cache-Control", "no-store");
    res.json({ ok: true, groups: arr });
  } catch (e) {
    console.error("[/stories/feed]", e.message);
    res.status(500).json({ error: "Error" });
  }
});

// GET /api/chat/stories/user/:userId — stories activas de un user (para ProfilePage)
router.get("/stories/user/:userId", authRequired, async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId, 10);
    if (!targetId) return res.status(400).json({ error: "ID inválido" });
    const viewerId = req.user.id;
    const q = await db.query(
      `SELECT s.id, s.user_id, s.image_url, s.caption, s.bg_color, s.created_at, s.expires_at,
              u.name, u.username, u.last_seen_at, up.avatar_url, up.name_color, up.name_glow, up.name_glow_color,
              EXISTS(SELECT 1 FROM user_story_views v WHERE v.story_id=s.id AND v.viewer_id=$1) AS viewed,
              (SELECT COUNT(*)::int FROM user_story_likes l WHERE l.story_id=s.id) AS like_count,
              EXISTS(SELECT 1 FROM user_story_likes l WHERE l.story_id=s.id AND l.user_id=$1) AS liked_by_me
         FROM user_stories s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN user_profiles up ON up.user_id = s.user_id
        WHERE s.user_id = $2 AND s.expires_at > NOW()
        ORDER BY s.created_at ASC
        LIMIT 50`,
      [viewerId, targetId]
    );
    if (!q.rows.length) return res.json({ ok: true, group: null });
    const first = q.rows[0];
    const allViewed = q.rows.every(r => r.viewed);
    const online = first.last_seen_at && (Date.now() - new Date(first.last_seen_at).getTime() < 90_000);
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      group: {
        user_id: first.user_id,
        name: first.name,
        username: first.username,
        avatar_url: first.avatar_url,
        name_color: first.name_color,
        name_glow: first.name_glow,
        name_glow_color: first.name_glow_color,
        is_self: viewerId === targetId,
        all_viewed: allViewed,
        online: !!online,
        stories: q.rows.map(r => ({
          id: r.id,
          image_url: r.image_url,
          caption: r.caption,
          bg_color: r.bg_color,
          created_at: r.created_at,
          expires_at: r.expires_at,
          viewed: r.viewed,
          like_count: r.like_count,
          liked_by_me: r.liked_by_me,
        })),
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/chat/stories/:id/view — marcar como vista
router.post("/stories/:id/view", authRequired, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    await db.query(
      `INSERT INTO user_story_views (story_id, viewer_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/chat/stories/:id — autor o staff
router.delete("/stories/:id", authRequired, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const q = await db.query(`SELECT user_id FROM user_stories WHERE id=$1`, [id]);
    if (!q.rows[0]) return res.status(404).json({ error: "No existe" });
    const isOwner = q.rows[0].user_id === req.user.id;
    const isStaff = ["admin","operator"].includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ error: "Sin permiso" });
    await db.query(`DELETE FROM user_stories WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/chat/emojis/:key — admin elimina ─────────────────────────────
router.delete("/emojis/:key", authRequired, async (req, res) => {
  try {
    if (!["admin","operator"].includes(req.user.role)) return res.status(403).json({ error: "Sin permisos" });
    const { key } = req.params;
    if (!/^[a-z0-9_]{2,30}$/.test(key)) return res.status(400).json({ error: "Key inválida" });
    await db.query(`DELETE FROM custom_emojis WHERE key=$1`, [key]);
    try { await cloudinary.uploader.destroy(`portal-emojis/emoji_${key}`); } catch {}
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/rooms", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = await db.query(`
      SELECT r.*,
        CASE WHEN r.coins_required = 0 THEN TRUE
             WHEN a.id IS NOT NULL THEN TRUE
             ELSE FALSE END AS has_access,
        COALESCE(lc.balance, 0) AS user_coins
      FROM chat_rooms r
      LEFT JOIN chat_room_access a ON a.room_id = r.id AND a.user_id = $1
      LEFT JOIN coins lc ON lc.user_id = $1
      WHERE r.is_active = TRUE ORDER BY r.coins_required ASC
    `, [userId]);
    res.json({ ok: true, rooms: q.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/rooms/:slug/join", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { slug } = req.params;
    const roomQ = await db.query(`SELECT * FROM chat_rooms WHERE slug=$1 AND is_active=TRUE`, [slug]);
    const room = roomQ.rows[0];
    if (!room) return res.status(404).json({ error: "Room no encontrado" });
    if (room.coins_required === 0) {
      await db.query(`INSERT INTO chat_room_access (user_id, room_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [userId, room.id]);
      return res.json({ ok: true, message: "Acceso concedido" });
    }
    const accessQ = await db.query(`SELECT id FROM chat_room_access WHERE user_id=$1 AND room_id=$2`, [userId, room.id]);
    if (accessQ.rows[0]) return res.json({ ok: true, message: "Ya tenes acceso" });
    const coinsQ = await db.query(`SELECT balance FROM coins WHERE user_id=$1`, [userId]);
    const balance = Number(coinsQ.rows[0]?.balance || 0);
    if (balance < room.coins_required)
      return res.status(400).json({ error: `Necesitas ${room.coins_required} Coins. Tenes ${balance}.` });
    await db.query(`UPDATE coins SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2`, [room.coins_required, userId]);
    await db.query(`INSERT INTO coin_transactions (user_id, type, amount, reason) VALUES ($1,'spend',$2,$3)`,
      [userId, room.coins_required, `Acceso a room: ${room.name}`]);
    await db.query(`INSERT INTO chat_room_access (user_id, room_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [userId, room.id]);
    res.json({ ok: true, message: `Acceso a ${room.name} desbloqueado por ${room.coins_required} coins` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/rooms/:slug/messages", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { slug } = req.params;
    const roomQ = await db.query(`SELECT * FROM chat_rooms WHERE slug=$1`, [slug]);
    const room = roomQ.rows[0];
    if (!room) return res.status(404).json({ error: "Room no encontrado" });
    if (room.coins_required > 0) {
      const accessQ = await db.query(`SELECT id FROM chat_room_access WHERE user_id=$1 AND room_id=$2`, [userId, room.id]);
      if (!accessQ.rows[0]) return res.status(403).json({ error: "Sin acceso a este room" });
    }
    const msgs = await db.query(`
      SELECT m.id, m.message, m.created_at,
        u.id AS user_id, u.name AS user_name, u.client_number, u.role AS user_role, u.username,
        COALESCE(cr.role, 'member') AS chat_role,
        up.name_color, up.name_glow_color, up.name_glow,
        up.name_grad_from, up.name_grad_to,
        up.nickname, up.nick_color, up.nick_glow, up.nick_glow_color, up.icon_slug, up.avatar_url
      FROM chat_messages m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN user_profiles up ON up.user_id = m.user_id
      LEFT JOIN chat_user_roles cr ON cr.user_id = m.user_id AND cr.room_id = m.room_id
      WHERE m.room_id = $1 AND m.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY m.created_at ASC LIMIT 200
    `, [room.id]);
    res.json({ ok: true, messages: msgs.rows, room });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/rooms/:slug/role", authRequired, async (req, res) => {
  try {
    const { role: myRole } = req.user;
    if (!["admin", "operator"].includes(myRole)) return res.status(403).json({ error: "Sin permisos" });
    const { slug } = req.params;
    const { user_id, role } = req.body;
    const roomQ = await db.query(`SELECT id FROM chat_rooms WHERE slug=$1`, [slug]);
    const room = roomQ.rows[0];
    if (!room) return res.status(404).json({ error: "Room no encontrado" });
    await db.query(`INSERT INTO chat_user_roles (user_id, room_id, role) VALUES ($1,$2,$3)
      ON CONFLICT (user_id, room_id) DO UPDATE SET role=$3, assigned_at=NOW()`, [user_id, room.id, role]);
    await db.query(`INSERT INTO chat_room_access (user_id, room_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [user_id, room.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/messages/:id", authRequired, async (req, res) => {
  try {
    const { role } = req.user;
    if (!["admin", "operator"].includes(role)) return res.status(403).json({ error: "Sin permisos" });
    await db.query(`DELETE FROM chat_messages WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── STORY LIKES ──────────────────────────────────────────────────────────────
// POST /api/chat/stories/:id/like — dar like
router.post("/stories/:id/like", authRequired, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const story = await db.query(`SELECT user_id FROM user_stories WHERE id=$1 AND expires_at > NOW()`, [id]);
    if (!story.rows[0]) return res.status(404).json({ error: "Story no existe o expiró" });
    if (story.rows[0].user_id === req.user.id) return res.status(400).json({ error: "No podés likear tu propia story" });
    const ins = await db.query(
      `INSERT INTO user_story_likes (story_id, user_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING RETURNING story_id`,
      [id, req.user.id]
    );
    // Notificar al dueño solo si fue insert nuevo
    if (ins.rows[0]) {
      try {
        await db.query(
          `INSERT INTO notifications (user_id, actor_id, type, title, body, link)
           VALUES ($1, $2, 'story_like', '❤ Nuevo like', $3, $4)`,
          [story.rows[0].user_id, req.user.id, `Likeó tu historia`, `/inicio`]
        );
      } catch {}
    }
    const c = await db.query(`SELECT COUNT(*)::int AS n FROM user_story_likes WHERE story_id=$1`, [id]);
    res.json({ ok: true, like_count: c.rows[0].n, liked_by_me: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/chat/stories/:id/like — sacar like
router.delete("/stories/:id/like", authRequired, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    await db.query(`DELETE FROM user_story_likes WHERE story_id=$1 AND user_id=$2`, [id, req.user.id]);
    const c = await db.query(`SELECT COUNT(*)::int AS n FROM user_story_likes WHERE story_id=$1`, [id]);
    res.json({ ok: true, like_count: c.rows[0].n, liked_by_me: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/chat/stories/:id/likes — count siempre, lista de users sólo si soy el dueño
router.get("/stories/:id/likes", authRequired, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const story = await db.query(`SELECT user_id FROM user_stories WHERE id=$1`, [id]);
    if (!story.rows[0]) return res.status(404).json({ error: "Story no existe" });
    const isOwner = story.rows[0].user_id === req.user.id;
    const c = await db.query(`SELECT COUNT(*)::int AS n FROM user_story_likes WHERE story_id=$1`, [id]);
    const likedQ = await db.query(`SELECT 1 FROM user_story_likes WHERE story_id=$1 AND user_id=$2`, [id, req.user.id]);
    let users = null;
    if (isOwner) {
      const lq = await db.query(
        `SELECT u.id, u.name, u.username, up.avatar_url, up.name_color, l.created_at
           FROM user_story_likes l
           JOIN users u ON u.id = l.user_id
           LEFT JOIN user_profiles up ON up.user_id = u.id
          WHERE l.story_id=$1
          ORDER BY l.created_at DESC LIMIT 200`,
        [id]
      );
      users = lq.rows;
    }
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, like_count: c.rows[0].n, liked_by_me: !!likedQ.rows[0], users, is_owner: isOwner });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/chat/stories/:id/reply — comentar = mensaje privado al dueño con cita de la story
router.post("/stories/:id/reply", authRequired, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const text = sanitizeText(String(req.body?.message || "").trim(), 500);
    if (!text) return res.status(400).json({ error: "Mensaje vacío" });
    const story = await db.query(`SELECT id, user_id, image_url FROM user_stories WHERE id=$1 AND expires_at > NOW()`, [id]);
    if (!story.rows[0]) return res.status(404).json({ error: "Story no existe o expiró" });
    if (story.rows[0].user_id === req.user.id) return res.status(400).json({ error: "No podés responderte a vos mismo" });

    const ins = await db.query(
      `INSERT INTO chat_private_messages (from_user_id, to_user_id, message, reply_to_story_id, reply_story_image_url, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
      [req.user.id, story.rows[0].user_id, text, id, story.rows[0].image_url]
    );

    // Realtime: emitir el mensaje vía socket al destinatario y al emisor (si están conectados)
    const io = req.app.get("io");
    if (io) {
      try {
        const sockets = await io.fetchSockets();
        const payload = {
          id: ins.rows[0].id,
          from_user_id: req.user.id,
          to_user_id: story.rows[0].user_id,
          message: text,
          created_at: ins.rows[0].created_at,
          reply_to_story_id: id,
          reply_story_image_url: story.rows[0].image_url,
          from_name: req.user.name,
        };
        const target = sockets.find(s => s.user?.id === story.rows[0].user_id);
        if (target) target.emit("private_message", payload);
        const sender = sockets.find(s => s.user?.id === req.user.id);
        if (sender) sender.emit("private_message", payload);
      } catch {}
    }

    try {
      await db.query(
        `INSERT INTO notifications (user_id, actor_id, type, title, body, link)
         VALUES ($1, $2, 'story_reply', '💬 Respuesta a tu historia', $3, $4)`,
        [story.rows[0].user_id, req.user.id, text.slice(0, 120), `/chats/${req.user.id}`]
      );
    } catch {}
    res.json({ ok: true, message: ins.rows[0] });
  } catch (e) { console.error("[POST /stories/:id/reply]", e.message); res.status(500).json({ error: e.message }); }
});

// ── PRESENCE ─────────────────────────────────────────────────────────────────
// POST /api/chat/presence/ping — heartbeat
router.post("/presence/ping", authRequired, async (req, res) => {
  try {
    await db.query(`UPDATE users SET last_seen_at=NOW() WHERE id=$1`, [req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/chat/presence/:userId — devuelve si está en línea (last_seen_at < 90s)
router.get("/presence/:userId", authRequired, async (req, res) => {
  try {
    const id = parseInt(req.params.userId, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const q = await db.query(`SELECT last_seen_at FROM users WHERE id=$1`, [id]);
    if (!q.rows[0]) return res.status(404).json({ error: "User no existe" });
    const last = q.rows[0].last_seen_at;
    const online = last && (Date.now() - new Date(last).getTime() < 90_000);
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, online: !!online, last_seen_at: last });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PRIVATE CHATS — lista de conversaciones ──────────────────────────────────
// GET /api/chat/private/conversations — todos mis chats 1-a-1
router.get("/private/conversations", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = await db.query(
      `WITH pairs AS (
         SELECT
           CASE WHEN from_user_id=$1 THEN to_user_id ELSE from_user_id END AS other_id,
           id, message, created_at, read_at, from_user_id, to_user_id, reply_to_story_id, reply_story_image_url
         FROM chat_private_messages
         WHERE from_user_id=$1 OR to_user_id=$1
       ),
       last_per AS (
         SELECT DISTINCT ON (other_id)
           other_id, id, message, created_at, from_user_id, reply_to_story_id, reply_story_image_url
         FROM pairs
         ORDER BY other_id, created_at DESC
       ),
       unread AS (
         SELECT
           CASE WHEN from_user_id=$1 THEN to_user_id ELSE from_user_id END AS other_id,
           COUNT(*) FILTER (WHERE to_user_id=$1 AND read_at IS NULL)::int AS unread_count
         FROM chat_private_messages
         WHERE from_user_id=$1 OR to_user_id=$1
         GROUP BY 1
       )
       SELECT lp.other_id, lp.message AS last_message, lp.created_at AS last_at,
              lp.from_user_id AS last_from, lp.reply_to_story_id, lp.reply_story_image_url,
              COALESCE(un.unread_count, 0) AS unread,
              u.name, u.username, u.last_seen_at,
              up.avatar_url, up.name_color, up.nickname
         FROM last_per lp
         JOIN users u ON u.id = lp.other_id
         LEFT JOIN user_profiles up ON up.user_id = lp.other_id
         LEFT JOIN unread un ON un.other_id = lp.other_id
        ORDER BY lp.created_at DESC LIMIT 100`,
      [userId]
    );
    const now = Date.now();
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      conversations: q.rows.map(r => ({
        other_id: r.other_id,
        name: r.name,
        username: r.username,
        avatar_url: r.avatar_url,
        name_color: r.name_color,
        nickname: r.nickname,
        last_message: r.last_message,
        last_at: r.last_at,
        last_from: r.last_from,
        unread: r.unread,
        reply_to_story_id: r.reply_to_story_id,
        reply_story_image_url: r.reply_story_image_url,
        online: r.last_seen_at && (now - new Date(r.last_seen_at).getTime() < 90_000),
      })),
    });
  } catch (e) { console.error("[/private/conversations]", e.message); res.status(500).json({ error: e.message }); }
});

// POST /api/chat/private/:targetId — enviar mensaje (HTTP fallback al socket)
router.post("/private/:targetId", authRequired, async (req, res) => {
  try {
    const targetId = parseInt(req.params.targetId, 10);
    if (!targetId) return res.status(400).json({ error: "ID inválido" });
    const text = sanitizeText(String(req.body?.message || "").trim(), 500);
    if (!text) return res.status(400).json({ error: "Mensaje vacío" });
    const ins = await db.query(
      `INSERT INTO chat_private_messages (from_user_id, to_user_id, message, created_at)
       VALUES ($1,$2,$3,NOW()) RETURNING *`,
      [req.user.id, targetId, text]
    );
    res.json({ ok: true, message: ins.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /chat/unread — total mensajes nuevos en últimas 24hs ─────────────────
router.get("/unread", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    // Contar mensajes de las últimas 24hs en rooms donde el usuario tiene acceso
    const q = await db.query(`
      SELECT COUNT(m.id)::int AS total
      FROM chat_messages m
      JOIN chat_rooms r ON r.id = m.room_id
      LEFT JOIN chat_room_access a ON a.room_id = r.id AND a.user_id = $1
      WHERE m.created_at > NOW() - INTERVAL '24 hours'
        AND m.user_id != $1
        AND (r.coins_required = 0 OR a.id IS NOT NULL)
    `, [userId]);
    res.json({ ok: true, total: q.rows[0]?.total || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

// ── GET /chat/powers — listar todos los powers ────────────────────────────────
router.get("/powers", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = await db.query(`
      SELECT p.*,
        CASE WHEN up.id IS NOT NULL THEN TRUE ELSE FALSE END AS owned,
        COALESCE(lc.balance, 0) AS user_coins
      FROM chat_powers p
      LEFT JOIN user_chat_powers up ON up.power_slug = p.slug AND up.user_id = $1
      LEFT JOIN coins lc ON lc.user_id = $1
      WHERE p.is_active = TRUE
      ORDER BY p.category, p.coins_price
    `, [userId]);
    res.json({ ok: true, powers: q.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /chat/powers/:slug/buy — comprar un power ────────────────────────────
router.post("/powers/:slug/buy", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { slug } = req.params;

    const powerQ = await db.query(`SELECT * FROM chat_powers WHERE slug=$1 AND is_active=TRUE`, [slug]);
    const power = powerQ.rows[0];
    if (!power) return res.status(404).json({ error: "Power no encontrado" });

    // Verificar si ya lo tiene
    const ownQ = await db.query(`SELECT id FROM user_chat_powers WHERE user_id=$1 AND power_slug=$2`, [userId, slug]);
    if (ownQ.rows[0]) return res.status(400).json({ error: "Ya tenés este power" });

    // Verificar coins
    const coinsQ = await db.query(`SELECT balance FROM coins WHERE user_id=$1`, [userId]);
    const balance = Number(coinsQ.rows[0]?.balance || 0);
    if (balance < power.coins_price)
      return res.status(400).json({ error: `Necesitás ${power.coins_price} coins. Tenés ${balance}.` });

    // Descontar coins
    await db.query(`UPDATE coins SET balance=balance-$1, updated_at=NOW() WHERE user_id=$2`, [power.coins_price, userId]);
    await db.query(`INSERT INTO coin_transactions (user_id, type, amount, reason) VALUES ($1,'spend',$2,$3)`,
      [userId, power.coins_price, `Power comprado: ${power.name}`]);

    // Dar power
    await db.query(`INSERT INTO user_chat_powers (user_id, power_slug) VALUES ($1,$2)`, [userId, slug]);

    res.json({ ok: true, message: `${power.icon} ${power.name} desbloqueado!` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /chat/config — obtener config del usuario ─────────────────────────────
router.get("/config", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = await db.query(`SELECT * FROM user_profiles WHERE user_id=$1`, [userId]);
    res.json({ ok: true, config: q.rows[0] || {} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /chat/config — guardar config del usuario ────────────────────────────
router.post("/config", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name_color, name_grad_from, name_grad_to, name_glow, name_glow_color, nickname, nick_color, nick_glow, nick_glow_color, icon_slug } = req.body;

    // Verificar que tiene los powers necesarios
    const ownedQ = await db.query(`SELECT power_slug FROM user_chat_powers WHERE user_id=$1`, [userId]);
    const owned = ownedQ.rows.map(r => r.power_slug);

    const checks = [
      [name_color, 'namecolor'], [name_grad_from, 'namegrad'], [name_glow, 'nameglow'],
      [nickname, 'nickname'], [nick_color, 'nickcolor'], [nick_glow, 'nickglow'],
      [icon_slug, icon_slug],
    ];
    for (const [val, slug] of checks) {
      if (val && slug && !owned.includes(slug) && !['admin','operator'].includes(req.user.role)) {
        return res.status(403).json({ error: `No tenés el power: ${slug}` });
      }
    }

    // Primero asegurar que existe la fila
    await db.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
    // Actualizar todos los campos
    await db.query(`UPDATE user_profiles SET
      name_color=$2, name_grad_from=$3, name_grad_to=$4,
      name_glow=$5, name_glow_color=$6,
      nickname=NULLIF($7,''), nick_color=$8,
      nick_glow=$9, nick_glow_color=$10,
      icon_slug=$11, updated_at=NOW()
      WHERE user_id=$1`,
      [userId,
       name_color||null, name_grad_from||null, name_grad_to||null,
       name_glow!=null?name_glow:null, name_glow_color||null,
       nickname||'', nick_color||null,
       nick_glow!=null?nick_glow:null, nick_glow_color||null,
       icon_slug||null
      ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /chat/powers/:slug/price — cambiar precio (solo admin) ──────────────
router.patch("/powers/:slug/price", authRequired, async (req, res) => {
  try {
    if (!["admin","operator"].includes(req.user.role)) return res.status(403).json({ error: "Sin permisos" });
    const { price } = req.body;
    await db.query(`UPDATE chat_powers SET coins_price=$1 WHERE slug=$2`, [Number(price), req.params.slug]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /chat/friends — lista de amigos ───────────────────────────────────────
router.get("/friends", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = await db.query(`
      SELECT f.id, f.status, f.created_at,
        CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END AS other_id,
        u.name AS other_name, u.client_number AS other_client_number,
        up.name_color, up.name_glow, up.name_glow_color, up.nickname, up.icon_slug
      FROM chat_friendships f
      JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status != 'blocked'
      ORDER BY f.status ASC, f.updated_at DESC
    `, [userId]);
    res.json({ ok: true, friends: q.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /chat/friends/:userId/request — enviar solicitud ────────────────────
router.post("/friends/:targetId/request", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const targetId = parseInt(req.params.targetId);
    if (userId === targetId) return res.status(400).json({ error: "No podés agregarte a vos mismo" });

    const targetQ = await db.query(`SELECT id, name FROM users WHERE id=$1`, [targetId]);
    if (!targetQ.rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });

    // Verificar si ya existe
    const existQ = await db.query(`
      SELECT id, status FROM chat_friendships 
      WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)
    `, [userId, targetId]);

    if (existQ.rows[0]) {
      if (existQ.rows[0].status === 'accepted') return res.status(400).json({ error: "Ya son amigos" });
      if (existQ.rows[0].status === 'pending') return res.status(400).json({ error: "Solicitud ya enviada" });
    }

    await db.query(`
      INSERT INTO chat_friendships (user_id, friend_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (user_id, friend_id) DO UPDATE SET status='pending', updated_at=NOW()
    `, [userId, targetId]);

    res.json({ ok: true, message: `Solicitud enviada a ${targetQ.rows[0].name}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /chat/friends/:userId/accept — aceptar solicitud ────────────────────
router.post("/friends/:targetId/accept", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const targetId = parseInt(req.params.targetId);

    const r = await db.query(`
      UPDATE chat_friendships SET status='accepted', updated_at=NOW()
      WHERE user_id=$1 AND friend_id=$2 AND status='pending'
      RETURNING id
    `, [targetId, userId]);

    if (!r.rows[0]) return res.status(404).json({ error: "Solicitud no encontrada" });
    // Mision amigo agregado - via DB directo
    try {
      const today = new Date().toISOString().slice(0,10);
      const db2 = require("../db");
      const mQ = await db2.query("SELECT * FROM coin_missions WHERE slug='daily_friend' AND is_active=true");
      if (mQ.rows[0]) {
        await db2.query(
          "INSERT INTO user_missions (user_id, mission_slug, progress, completed_at, period) VALUES ($1,'daily_friend',1,NOW(),$2) ON CONFLICT DO NOTHING",
          [userId, today]
        );
      }
    } catch(_) {}
    res.json({ ok: true, message: "Solicitud aceptada" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /chat/friends/:userId — eliminar amigo ─────────────────────────────
router.delete("/friends/:targetId", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const targetId = parseInt(req.params.targetId);
    await db.query(`
      DELETE FROM chat_friendships
      WHERE (user_id=$1 AND friend_id=$2) OR (user_id=$2 AND friend_id=$1)
    `, [userId, targetId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /chat/private/:userId — historial de mensajes privados ────────────────
router.get("/private/:targetId", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const targetId = parseInt(req.params.targetId);

    const msgs = await db.query(`
      SELECT m.id, m.message, m.created_at, m.read_at,
        m.from_user_id, m.to_user_id,
        m.reply_to_story_id, m.reply_story_image_url,
        u.name AS from_name,
        up.name_color, up.name_glow, up.icon_slug
      FROM chat_private_messages m
      JOIN users u ON u.id = m.from_user_id
      LEFT JOIN user_profiles up ON up.user_id = m.from_user_id
      WHERE (m.from_user_id=$1 AND m.to_user_id=$2)
         OR (m.from_user_id=$2 AND m.to_user_id=$1)
      ORDER BY m.created_at ASC LIMIT 100
    `, [userId, targetId]);

    // Marcar como leídos
    await db.query(`
      UPDATE chat_private_messages SET read_at=NOW()
      WHERE to_user_id=$1 AND from_user_id=$2 AND read_at IS NULL
    `, [userId, targetId]);

    const target = await db.query(`
      SELECT u.id, u.name, u.username, u.client_number, u.last_seen_at,
             up.name_color, up.nickname, up.icon_slug, up.avatar_url
      FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id WHERE u.id=$1
    `, [targetId]);

    res.json({ ok: true, messages: msgs.rows, target: target.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /chat/private/unread — mensajes no leídos ────────────────────────────
router.get("/private/unread/count", authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = await db.query(`
      SELECT COUNT(*)::int AS total FROM chat_private_messages
      WHERE to_user_id=$1 AND read_at IS NULL
    `, [userId]);
    res.json({ ok: true, total: q.rows[0]?.total || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Wed Apr  8 03:53:10 UTC 2026
