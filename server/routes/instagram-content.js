"use strict";
const express = require("express");
const router = express.Router();
const db = require("../db");
const { authRequired, requireRole } = require("../auth");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const igMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB (reels/videos)
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Solo imágenes o videos"));
  },
});

let tablesEnsured = false;
async function ensureTables() {
  if (tablesEnsured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ig_content_ideas (
      id BIGSERIAL PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('post','reel','carousel','story')),
      hook TEXT,
      caption TEXT NOT NULL,
      hashtags TEXT,
      script TEXT,
      visual_brief TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','rejected','scheduled','published')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      approved_at TIMESTAMPTZ,
      approved_by INT REFERENCES users(id) ON DELETE SET NULL,
      batch_id TEXT
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS ig_content_ideas_status_created_idx ON ig_content_ideas (status, created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ig_content_ideas_batch_idx ON ig_content_ideas (batch_id)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ig_scheduled_posts (
      id BIGSERIAL PRIMARY KEY,
      idea_id BIGINT REFERENCES ig_content_ideas(id) ON DELETE SET NULL,
      kind TEXT NOT NULL CHECK (kind IN ('image','reel','carousel','story_image','story_video')),
      caption TEXT,
      media_urls TEXT[] NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','publishing','published','failed','cancelled')),
      attempts INT NOT NULL DEFAULT 0,
      ig_media_id TEXT,
      ig_creation_id TEXT,
      last_error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      created_by INT REFERENCES users(id) ON DELETE SET NULL,
      published_at TIMESTAMPTZ
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS ig_scheduled_posts_status_sched_idx ON ig_scheduled_posts (status, scheduled_at)`);
  await db.query(`CREATE INDEX IF NOT EXISTS ig_scheduled_posts_idea_idx ON ig_scheduled_posts (idea_id)`);

  await db.query(`ALTER TABLE ig_content_ideas ADD COLUMN IF NOT EXISTS frameworks_used TEXT[]`);
  await db.query(`ALTER TABLE ig_content_ideas ADD COLUMN IF NOT EXISTS source TEXT`);

  tablesEnsured = true;
}

const KIND_ALIAS = { carrusel: "carousel", carousel: "carousel", post: "post", reel: "reel", story: "story" };

function _hashtagsToText(hashtags) {
  if (!hashtags) return null;
  if (Array.isArray(hashtags)) return hashtags.map(h => `#${String(h).replace(/^#/, "").trim()}`).filter(t => t.length > 1).join(" ");
  if (typeof hashtags === "string") return hashtags.trim() || null;
  return null;
}

async function insertIdeaFromGenerated({ kind, generated, source, frameworks_used, userId }) {
  const k = KIND_ALIAS[String(kind || "").toLowerCase()] || "post";
  const hook = typeof generated?.hook === "string" ? generated.hook : null;
  let caption = typeof generated?.caption === "string" ? generated.caption.trim() : "";
  const cta = typeof generated?.cta === "string" ? generated.cta.trim() : "";
  if (cta) caption = caption ? `${caption}\n\n${cta}` : cta;
  if (!caption) throw new Error("caption requerido");
  const hashtagsText = _hashtagsToText(generated?.hashtags);
  const visual = typeof generated?.visual_brief === "string" && generated.visual_brief.trim()
    ? generated.visual_brief.trim()
    : (hook || caption.slice(0, 200));
  const fwUsed = Array.isArray(frameworks_used) ? frameworks_used.filter(x => typeof x === "string" && x).slice(0, 12) : null;

  const ins = await db.query(
    `INSERT INTO ig_content_ideas (kind, hook, caption, hashtags, visual_brief, frameworks_used, source, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft')
     RETURNING *`,
    [k, hook, caption, hashtagsText, visual, fwUsed, source || null]
  );
  return ins.rows[0];
}

const VALID_SCHEDULED_KINDS = new Set(["image","reel","carousel","story_image","story_video"]);

// POST /ideas/generate — dispara generación manual
router.post("/ideas/generate", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const { generateIdeasBatch } = require("../jobs/content-ideas");
    const out = await generateIdeasBatch({ trigger: "manual", userId: req.user?.id || null });
    res.json({ ok: true, ...out });
  } catch (e) {
    console.error("[IG-CONTENT generate ERROR]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /stories/generate — story diaria manual
router.post("/stories/generate", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const { generateDailyStory } = require("../jobs/stories");
    const out = await generateDailyStory({ trigger: "manual" });
    res.json({ ok: true, ...out });
  } catch (e) {
    console.error("[IG-STORIES generate ERROR]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /ideas — lista paginada DESC
router.get("/ideas", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const { status, batch_id } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const conds = [];
    const params = [];
    if (status) {
      params.push(String(status));
      conds.push(`status = $${params.length}`);
    }
    if (batch_id) {
      params.push(String(batch_id));
      conds.push(`batch_id = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const totalQ = await db.query(`SELECT COUNT(*)::int AS total FROM ig_content_ideas ${where}`, params);
    params.push(limit);
    const q = await db.query(
      `SELECT * FROM ig_content_ideas ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    res.json({ ok: true, rows: q.rows, total: totalQ.rows[0]?.total || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /ideas/:id
router.get("/ideas/:id", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
    const q = await db.query(`SELECT * FROM ig_content_ideas WHERE id = $1`, [id]);
    if (!q.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /ideas/:id — editar antes de aprobar (solo draft)
router.patch("/ideas/:id", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

    const cur = await db.query(`SELECT status FROM ig_content_ideas WHERE id = $1`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: "No encontrado" });
    if (cur.rows[0].status !== "draft") {
      return res.status(409).json({ error: "Solo se pueden editar ideas en estado draft" });
    }

    const { caption, hashtags, script, visual_brief } = req.body || {};
    const q = await db.query(
      `UPDATE ig_content_ideas SET
         caption = COALESCE($1, caption),
         hashtags = COALESCE($2, hashtags),
         script = COALESCE($3, script),
         visual_brief = COALESCE($4, visual_brief)
       WHERE id = $5
       RETURNING *`,
      [
        typeof caption === "string" ? caption : null,
        typeof hashtags === "string" ? hashtags : null,
        typeof script === "string" ? script : null,
        typeof visual_brief === "string" ? visual_brief : null,
        id,
      ]
    );
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /ideas/:id/approve
router.post("/ideas/:id/approve", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
    const q = await db.query(
      `UPDATE ig_content_ideas
         SET status = 'approved', approved_at = NOW(), approved_by = $1
         WHERE id = $2
         RETURNING *`,
      [req.user?.id || null, id]
    );
    if (!q.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /ideas/:id/reject
router.post("/ideas/:id/reject", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
    const q = await db.query(
      `UPDATE ig_content_ideas SET status = 'rejected' WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!q.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /ideas/bulk — bulk approve o reject sobre un array de ids (solo afecta drafts).
// Body: { action: "approve" | "reject", ids: number[] }
router.post("/ideas/bulk", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const { action, ids } = req.body || {};
    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({ error: "action debe ser 'approve' o 'reject'" });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids debe ser un array no vacío" });
    }
    const cleanIds = ids.map(n => parseInt(n, 10)).filter(Number.isFinite);
    if (cleanIds.length === 0) return res.status(400).json({ error: "ids inválidos" });
    if (cleanIds.length > 200) return res.status(400).json({ error: "máximo 200 ids por bulk" });

    let q;
    if (action === "approve") {
      q = await db.query(
        `UPDATE ig_content_ideas
           SET status = 'approved', approved_at = NOW(), approved_by = $1
           WHERE id = ANY($2::bigint[]) AND status = 'draft'
           RETURNING id`,
        [req.user?.id || null, cleanIds]
      );
    } else {
      q = await db.query(
        `UPDATE ig_content_ideas
           SET status = 'rejected'
           WHERE id = ANY($1::bigint[]) AND status = 'draft'
           RETURNING id`,
        [cleanIds]
      );
    }
    res.json({ ok: true, action, affected: q.rowCount, ids: q.rows.map(r => r.id) });
  } catch (e) {
    console.error("[IG-CONTENT bulk ERROR]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /ideas/:id — admin only, hard delete
router.delete("/ideas/:id", authRequired, requireRole(["admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
    const q = await db.query(`DELETE FROM ig_content_ideas WHERE id = $1 RETURNING id`, [id]);
    if (!q.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Cola de publicación ──────────────────────────────────────────────────────

// POST /scheduled/tick-now — admin debug. Definido ANTES de /scheduled/:id para evitar shadow.
router.post("/scheduled/tick-now", authRequired, requireRole(["admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const { tickPublisher } = require("../jobs/publisher");
    const out = await tickPublisher();
    res.json({ ok: true, ...out });
  } catch (e) {
    console.error("[IG-PUBLISHER tick-now ERROR]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /schedule — encolar un post
async function _scheduleIdeaPost(body, userId) {
  await ensureTables();
  const { idea_id, kind, caption, media_urls, scheduled_at } = body || {};

  if (!VALID_SCHEDULED_KINDS.has(kind)) {
    const e = new Error(`kind inválido. Esperado: ${[...VALID_SCHEDULED_KINDS].join(", ")}`); e.status = 400; throw e;
  }
  if (!Array.isArray(media_urls) || media_urls.length === 0) {
    const e = new Error("media_urls requerido (array no vacío con URLs públicas HTTPS)"); e.status = 400; throw e;
  }
  for (const url of media_urls) {
    if (typeof url !== "string" || !/^https:\/\//i.test(url)) {
      const e = new Error("media_urls deben ser strings HTTPS accesibles públicamente"); e.status = 400; throw e;
    }
  }
  if (!scheduled_at) { const e = new Error("scheduled_at requerido (ISO timestamp)"); e.status = 400; throw e; }
  const when = new Date(scheduled_at);
  if (Number.isNaN(when.getTime())) { const e = new Error("scheduled_at inválido"); e.status = 400; throw e; }
  if (when.getTime() < Date.now() - 60 * 1000) { const e = new Error("scheduled_at debe ser en el futuro (o ahora)"); e.status = 400; throw e; }
  if (kind === "carousel" && (media_urls.length < 2 || media_urls.length > 10)) {
    const e = new Error("carousel requiere entre 2 y 10 medios"); e.status = 400; throw e;
  }
  if (kind !== "carousel" && media_urls.length !== 1) {
    const e = new Error(`kind=${kind} acepta exactamente 1 media_url`); e.status = 400; throw e;
  }

  const isVideoUrl = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
  const isImageUrl = (url) => /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
  const VIDEO_KINDS = new Set(["reel", "story_video"]);
  const IMAGE_KINDS = new Set(["image", "carousel", "story_image"]);
  const firstUrl = media_urls[0];
  if (VIDEO_KINDS.has(kind) && isImageUrl(firstUrl)) { const e = new Error(`kind=${kind} requiere video, pero el media es imagen.`); e.status = 400; throw e; }
  if (IMAGE_KINDS.has(kind) && isVideoUrl(firstUrl)) { const e = new Error(`kind=${kind} requiere imagen, pero el media es video.`); e.status = 400; throw e; }

  const ideaId = idea_id ? parseInt(idea_id, 10) : null;
  if (idea_id && !Number.isFinite(ideaId)) { const e = new Error("idea_id inválido"); e.status = 400; throw e; }

  const ins = await db.query(
    `INSERT INTO ig_scheduled_posts (idea_id, kind, caption, media_urls, scheduled_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [ideaId, kind, typeof caption === "string" ? caption : null, media_urls, when.toISOString(), userId || null]
  );

  if (ideaId) {
    await db.query(
      `UPDATE ig_content_ideas SET status = 'scheduled'
        WHERE id = $1 AND status IN ('approved','draft')`,
      [ideaId]
    );
  }
  return ins.rows[0];
}

router.post("/schedule", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const row = await _scheduleIdeaPost(req.body, req.user?.id);
    res.json({ ok: true, row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[IG-CONTENT schedule ERROR]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /scheduled — lista filtrable
router.get("/scheduled", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const { status, from, to } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const conds = [];
    const params = [];
    if (status) {
      params.push(String(status));
      conds.push(`status = $${params.length}`);
    }
    if (from) {
      params.push(new Date(from).toISOString());
      conds.push(`scheduled_at >= $${params.length}`);
    }
    if (to) {
      params.push(new Date(to).toISOString());
      conds.push(`scheduled_at <= $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const totalQ = await db.query(`SELECT COUNT(*)::int AS total FROM ig_scheduled_posts ${where}`, params);
    params.push(limit);
    const q = await db.query(
      `SELECT * FROM ig_scheduled_posts ${where} ORDER BY scheduled_at DESC LIMIT $${params.length}`,
      params
    );
    res.json({ ok: true, rows: q.rows, total: totalQ.rows[0]?.total || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /scheduled/:id
router.get("/scheduled/:id", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
    const q = await db.query(`SELECT * FROM ig_scheduled_posts WHERE id = $1`, [id]);
    if (!q.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /scheduled/:id/status — alias liviano para polling del panel
router.get("/scheduled/:id/status", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
    const q = await db.query(
      `SELECT id, status, attempts, ig_media_id, ig_creation_id, last_error, scheduled_at, published_at
         FROM ig_scheduled_posts WHERE id = $1`,
      [id]
    );
    if (!q.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /scheduled/:id (solo si pending)
router.patch("/scheduled/:id", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

    const cur = await db.query(`SELECT status FROM ig_scheduled_posts WHERE id = $1`, [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: "No encontrado" });
    if (cur.rows[0].status !== "pending") {
      return res.status(409).json({ error: "Solo se pueden editar posts pending" });
    }

    const { caption, scheduled_at, media_urls } = req.body || {};
    let whenIso = null;
    if (typeof scheduled_at !== "undefined") {
      const when = new Date(scheduled_at);
      if (Number.isNaN(when.getTime())) return res.status(400).json({ error: "scheduled_at inválido" });
      whenIso = when.toISOString();
    }
    if (typeof media_urls !== "undefined") {
      if (!Array.isArray(media_urls) || media_urls.length === 0) {
        return res.status(400).json({ error: "media_urls debe ser array no vacío" });
      }
      for (const url of media_urls) {
        if (typeof url !== "string" || !/^https:\/\//i.test(url)) {
          return res.status(400).json({ error: "media_urls deben ser HTTPS" });
        }
      }
    }

    const q = await db.query(
      `UPDATE ig_scheduled_posts SET
         caption = COALESCE($1, caption),
         scheduled_at = COALESCE($2, scheduled_at),
         media_urls = COALESCE($3, media_urls)
       WHERE id = $4
       RETURNING *`,
      [
        typeof caption === "string" ? caption : null,
        whenIso,
        Array.isArray(media_urls) ? media_urls : null,
        id,
      ]
    );
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /scheduled/:id → cancelled (soft, mantiene historial)
router.delete("/scheduled/:id", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
    const q = await db.query(
      `UPDATE ig_scheduled_posts
         SET status = 'cancelled'
       WHERE id = $1 AND status IN ('pending','failed')
       RETURNING *`,
      [id]
    );
    if (!q.rows[0]) {
      const cur = await db.query(`SELECT status FROM ig_scheduled_posts WHERE id = $1`, [id]);
      if (!cur.rows[0]) return res.status(404).json({ error: "No encontrado" });
      return res.status(409).json({ error: `No se puede cancelar un post en estado ${cur.rows[0].status}` });
    }
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /scheduled/:id/publish-now — adelanta scheduled_at y dispara tick
router.post("/scheduled/:id/publish-now", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

    const upd = await db.query(
      `UPDATE ig_scheduled_posts
         SET scheduled_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id]
    );
    if (!upd.rows[0]) {
      const cur = await db.query(`SELECT status FROM ig_scheduled_posts WHERE id = $1`, [id]);
      if (!cur.rows[0]) return res.status(404).json({ error: "No encontrado" });
      return res.status(409).json({ error: `Solo se puede forzar publicación de posts pending (estado actual: ${cur.rows[0].status})` });
    }

    const { tickPublisher } = require("../jobs/publisher");
    // No await el tick para no bloquear la HTTP response, pero capturamos errores en log.
    tickPublisher().catch(e => console.error("[IG-PUBLISHER publish-now ERROR]", e.message));

    res.json({ ok: true, row: upd.rows[0], note: "tick disparado en background — pollear /status" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /scheduled/:id/retry — resetea attempts y vuelve a pending (solo si failed)
router.post("/scheduled/:id/retry", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
    const upd = await db.query(
      `UPDATE ig_scheduled_posts
         SET status = 'pending', attempts = 0, last_error = NULL, scheduled_at = NOW()
       WHERE id = $1 AND status = 'failed'
       RETURNING *`,
      [id]
    );
    if (!upd.rows[0]) {
      const cur = await db.query(`SELECT status FROM ig_scheduled_posts WHERE id = $1`, [id]);
      if (!cur.rows[0]) return res.status(404).json({ error: "No encontrado" });
      return res.status(409).json({ error: `Solo se reintentan posts failed (estado actual: ${cur.rows[0].status})` });
    }
    res.json({ ok: true, row: upd.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /media/upload — sube imagen/video a Cloudinary y devuelve URL HTTPS
router.post(
  "/media/upload",
  authRequired,
  requireRole(["operator", "admin"], "instagram"),
  igMediaUpload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Falta archivo" });
      const isVideo = req.file.mimetype.startsWith("video/");
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "lemons-ig/content",
            resource_type: isVideo ? "video" : "image",
          },
          (err, out) => (err ? reject(err) : resolve(out))
        );
        stream.end(req.file.buffer);
      });
      res.json({
        ok: true,
        url: result.secure_url,
        kind: isVideo ? "video" : "image",
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        duration: result.duration || null,
      });
    } catch (e) {
      console.error("[IG-CONTENT media/upload ERROR]", e.message);
      res.status(500).json({ error: e.message || "Error al subir" });
    }
  }
);

// Bloque de estilo de marca FIJO. Se pre-pendea siempre al prompt final que va a
// gpt-image-1, no es editable por el operador. La variante específica (titular,
// pose, iconografía) la arma Claude por separado.
const LEMONS_BASE_STYLE_PROMPT = `Ultra high quality 3D render, modern logistics advertisement, vibrant yellow background (#FFC700), clean minimal composition, premium branding style.

Main subject (when a character is needed): a 3D animated lemon character in Pixar style, smooth soft textures, glossy skin, expressive big eyes, small eyebrows, cute smile, slightly blushed cheeks, green leaves on top of head acting as hair, friendly and energetic personality.

Character pose options: dynamic walking motion or context-appropriate pose, joyful expression, conveying movement and efficiency.

Boxes: realistic kraft cardboard color with subtle branding details, minimal black tape, small logo marks. Discount tags are blue with percentage symbols when applicable.

Lighting: soft studio lighting with warm tones, subtle shadows, slight rim light to enhance edges, high-end commercial look.

Background: solid bright yellow (#FFC700) with rounded blue gradient panels behind characters or focal elements (deep blue to lighter blue), smooth rounded corners, creating contrast and depth.

Typography:
- Titles in uppercase, thick sans-serif, white letters inside rounded blue pill-shaped containers (#2D4BFF).
- Subtitles in uppercase, same font, inside light gray rounded containers (#F1F1F1).
- Body copy in Spanish, minimal sans-serif, dark text (#1A1A1A) on light backgrounds.

Color palette (strict):
- Primary yellow: #FFC700
- Deep blue: #2D4BFF
- Light gray: #F1F1F1
- Text dark: #1A1A1A
- Accent blue for tags

Composition rules: clean spacing, strong visual hierarchy, centered layout, premium branding feel, high contrast, modern UI + 3D hybrid design.

Rendering style: ultra detailed, 4K quality, global illumination, soft shadows, subtle depth of field.

Mood: friendly, trustworthy, efficient, startup logistics brand, modern and scalable.

NO watermarks, NO third-party logos, NO illegible text, NO realistic human faces.`;

// URLs de referencias de marca (subidas a Cloudinary, hardcoded ON purpose)
const LEMONS_BRAND_REFS = [
  "https://res.cloudinary.com/dxcmxwbia/image/upload/v1777428980/lemons-ig/brand-refs/ads-mascot-pricing.jpg",
  "https://res.cloudinary.com/dxcmxwbia/image/upload/v1777428980/lemons-ig/brand-refs/typography-story.jpg",
];

// ── Translation cache (ES → EN) ──────────────────────────────────────────────
// Image generation models work much better with English prompts. We translate
// user-provided briefs (idea.visual_brief, hook, caption, prompt_override) to
// English before passing to Flux/gpt-image-1/Gemini.
const _translationCache = new Map(); // key: md5(text), value: english string

function _md5(s) {
  return require("crypto").createHash("md5").update(String(s || "")).digest("hex");
}

// Heurística rápida para detectar si el texto contiene español. Evita llamadas
// innecesarias a la API cuando el texto ya está en inglés.
function _likelyContainsSpanish(text) {
  if (!text || typeof text !== "string") return false;
  // Caracteres exclusivos de español
  if (/[ñáéíóúüÁÉÍÓÚÜÑ¿¡]/.test(text)) return true;
  // Palabras comunes en español (boundary check)
  if (/\b(el|la|los|las|una|uno|está|son|qué|cómo|para|con|por|del|este|esta|fue|ser|hacer|que|pero|también|cuando|donde|porque|sobre|hasta|desde|nuestro|nuestra|tu|tus|sus)\b/i.test(text)) return true;
  return false;
}

// Traduce a inglés si parece estar en español. Usa Claude (ANTHROPIC_KEY).
// Cachea por hash MD5 del input (mismo brief → 1 sola call de traducción).
// Falla silenciosamente devolviendo el original si no hay key o la API falla.
async function translateToEnglish(text) {
  if (!text || typeof text !== "string") return text || "";
  if (!_likelyContainsSpanish(text)) return text;

  const key = _md5(text);
  if (_translationCache.has(key)) return _translationCache.get(key);

  if (!process.env.ANTHROPIC_KEY) return text;

  try {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 8000); // 8s — translation should be < 2s normally
    let res;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [{
            role: "user",
            content: `Translate the following text to English. Preserve all formatting, line breaks, special characters, hex codes, and proper names. Output ONLY the translation, no commentary, no quotes around it.\n\nText to translate:\n---\n${text}\n---`,
          }],
        }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    const data = await res.json();
    const translated = data?.content?.[0]?.text?.trim();
    if (!translated) {
      console.warn("[IG-CONTENT translate] empty response, fallback to original");
      return text;
    }
    _translationCache.set(key, translated);
    return translated;
  } catch (e) {
    console.warn("[IG-CONTENT translate ERROR, fallback to original]", e.message);
    return text;
  }
}

// Pre-pass: descripción detallada del estilo de marca, generada con GPT-4o-mini Vision
// y cacheada en memoria del proceso (24h). Forzar refresco con POST /brand-style/refresh.
let _brandStyleDescription = null;
let _brandStyleDescribedAt = 0;
const BRAND_STYLE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function getBrandStyleDescription() {
  if (_brandStyleDescription && (Date.now() - _brandStyleDescribedAt) < BRAND_STYLE_TTL_MS) {
    return _brandStyleDescription;
  }
  if (!process.env.OPENAI_API_KEY) return "";
  try {
    const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 700,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe IN DETAIL the visual brand style shared by these two reference images. Cover: exact palette (approximate hex codes), typography (weight, uppercase, alignment), shapes and composition (pill badges, backgrounds, layout), iconography (3D lemon mascot — describe how it looks), how spaces are used. This description will be used as a prompt for image generation models (gpt-image-1, Flux, Gemini), so be concrete, technical and specific. Respond in English, without enumerating 'first' / 'second' — describe the COMMON STYLE as a brand guide."
            },
            ...LEMONS_BRAND_REFS.map(url => ({ type: "image_url", image_url: { url, detail: "high" } })),
          ],
        }],
      }),
    });
    const data = await visionRes.json();
    const desc = data?.choices?.[0]?.message?.content?.trim();
    if (desc) {
      _brandStyleDescription = desc;
      _brandStyleDescribedAt = Date.now();
      console.log("[IG-CONTENT brand-style] descripción generada (" + desc.length + " chars)");
    }
    return desc || "";
  } catch (e) {
    console.error("[IG-CONTENT brand-style ERROR]", e.message);
    return "";
  }
}

// POST /ideas/:id/generate-image — genera imagen con gpt-image-1 + refs + brand-style cache
router.post(
  "/ideas/:id/generate-image",
  authRequired,
  requireRole(["operator", "admin"], "instagram"),
  async (req, res) => {
    try {
      const { kind: kindOverride, prompt_override } = req.body || {};
      const ideaId = parseInt(req.params.id, 10);
      if (!Number.isFinite(ideaId)) return res.status(400).json({ error: "id inválido" });

      const ideaQ = await db.query(
        `SELECT id, kind, hook, caption, visual_brief FROM ig_content_ideas WHERE id=$1`,
        [ideaId]
      );
      const idea = ideaQ.rows[0];
      if (!idea) return res.status(404).json({ error: "Idea no encontrada" });

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "OPENAI_API_KEY no configurada" });
      }

      const targetKind = kindOverride || idea.kind || "post";
      const isVertical = ["story", "story_image", "story_video", "reel"].includes(targetKind);
      const size = isVertical ? "1024x1536" : "1024x1024";

      const brief = (idea.visual_brief || idea.hook || idea.caption || "Imagen para Instagram de logística internacional Lemons").trim();

      // Pre-pass: descripción detallada de la marca (cacheada 24h)
      const brandStyle = await getBrandStyleDescription();

      // Traducir brief y prompt_override a inglés (cacheado, no-op si ya están en inglés)
      const briefEn = await translateToEnglish(brief);
      const prompt_overrideEn = prompt_override ? await translateToEnglish(prompt_override) : prompt_override;

      const variantPrompt = (typeof prompt_overrideEn === "string" && prompt_overrideEn.trim().length > 50)
        ? prompt_overrideEn.trim()
        : [
            "CRITICAL INSTRUCTION: Reproduce EXACTLY the visual style of the attached reference images. The new image must look as if it were designed by the same team that created the references. DO NOT deviate from the palette, typography, or composition.",
            "",
            "LEMONS BRAND GUIDE (derived from the references):",
            brandStyle || "Bright yellow palette (#FFD60A) and navy blue (#1A2B6E). Thick uppercase sans-serif typography, white on blue backgrounds. Pill-shaped badges. Mascot: 3D Pixar-style lemon with green leaves on top, expressive face, yellow arms and legs. Clean composition with clear visual hierarchy.",
            "",
            "PIECE TO DESIGN:",
            briefEn,
            "",
            targetKind.includes("story") ? "FORMAT: Instagram Story vertical 9:16 (1024x1536)." : "FORMAT: Instagram square feed 1:1 (1024x1024).",
            "",
            "GENERATION REQUIREMENTS:",
            "- Full-bleed background yellow (#FFD60A) or navy blue (#1A2B6E), never plain white",
            "- If the brief implies a character, use the lemon mascot with the SAME 3D aesthetic as the references",
            "- Typography: thick sans-serif, uppercase, inside pill-shaped badges when text is highlighted",
            "- Iconography: cardboard boxes with Lemon's logo, flags, planes, ships as appropriate",
            "- DO NOT include watermarks, third-party logos, or illegible text",
            "- Polished, professional composition, ready to publish on Instagram without retouching",
          ].join("\n");

      // El base style siempre se pre-pendea (inmutable, no editable por operador)
      const prompt = [
        "═══ BASE STYLE (always apply, immutable) ═══",
        LEMONS_BASE_STYLE_PROMPT,
        "",
        "═══ THIS PIECE (specific variant) ═══",
        variantPrompt,
      ].join("\n");

      // Descargar refs como Buffers
      const refBuffers = [];
      for (const url of LEMONS_BRAND_REFS) {
        const r = await fetch(url);
        if (!r.ok) {
          console.warn("[IG-CONTENT generate-image] ref no descargada:", url);
          continue;
        }
        const buf = Buffer.from(await r.arrayBuffer());
        refBuffers.push({ buf, url });
      }
      if (refBuffers.length === 0) {
        return res.status(500).json({ error: "No se pudieron cargar las referencias de marca" });
      }

      // FormData nativo
      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append("prompt", prompt.slice(0, 32000));
      form.append("size", size);
      form.append("quality", "high"); // calidad alta — vale la pena los ~$0.17/img
      form.append("n", "1");
      refBuffers.forEach((r, i) => {
        const filename = (r.url.split("/").pop() || `ref${i}.jpg`).split("?")[0];
        const lower = filename.toLowerCase();
        const mime = lower.endsWith(".png") ? "image/png"
                  : lower.endsWith(".webp") ? "image/webp"
                  : "image/jpeg";
        const blob = new Blob([r.buf], { type: mime });
        form.append("image[]", blob, filename);
      });

      const oaiRes = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
      });
      const oaiData = await oaiRes.json();
      if (!oaiRes.ok || !oaiData?.data?.[0]?.b64_json) {
        console.error("[IG-CONTENT generate-image GPT-IMAGE-1 ERROR]", JSON.stringify(oaiData).slice(0, 500));
        // Status 422 (no 502) para que Cloudflare no intercepte y devuelva su HTML de error
        return res.status(422).json({ error: oaiData?.error?.message || "Error generando imagen", status: oaiRes.status });
      }

      const imgBuffer = Buffer.from(oaiData.data[0].b64_json, "base64");

      // Subir a Cloudinary
      const uploadRes = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "lemons-ig/ai-generated",
            public_id: `idea_${ideaId}_${Date.now()}`,
            resource_type: "image",
          },
          (err, out) => (err ? reject(err) : resolve(out))
        );
        stream.end(imgBuffer);
      });

      res.json({
        ok: true,
        url: uploadRes.secure_url,
        size,
        bytes: uploadRes.bytes,
        model: "gpt-image-1",
        quality: "high",
        refs_used: refBuffers.length,
        brand_style_chars: (brandStyle || "").length,
      });
    } catch (e) {
      console.error("[IG-CONTENT generate-image ERROR]", e.message);
      res.status(500).json({ error: e.message || "Error interno" });
    }
  }
);

// POST /ideas/:id/generate-image-nano — genera imagen con Gemini 2.5 Flash Image (Nano Banana)
// Mismo contrato que /generate-image (input/output). Costo ~$0.04/img vs ~$0.17, velocidad ~5-10s.
// Reusa LEMONS_BRAND_REFS, LEMONS_BASE_STYLE_PROMPT y getBrandStyleDescription().
router.post(
  "/ideas/:id/generate-image-nano",
  authRequired,
  requireRole(["operator", "admin"], "instagram"),
  async (req, res) => {
    try {
      const { kind: kindOverride, prompt_override } = req.body || {};
      const ideaId = parseInt(req.params.id, 10);
      if (!Number.isFinite(ideaId)) return res.status(400).json({ error: "id inválido" });

      const ideaQ = await db.query(
        `SELECT id, kind, hook, caption, visual_brief FROM ig_content_ideas WHERE id=$1`,
        [ideaId]
      );
      const idea = ideaQ.rows[0];
      if (!idea) return res.status(404).json({ error: "Idea no encontrada" });

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY no configurada en Render" });
      }

      const targetKind = kindOverride || idea.kind || "post";
      const isVertical = ["story", "story_image", "story_video", "reel"].includes(targetKind);
      const aspectRatio = isVertical ? "9:16" : "1:1";
      const sizeLabel = isVertical ? "auto-9:16" : "auto-1:1";

      const brief = (idea.visual_brief || idea.hook || idea.caption || "Imagen para Instagram de logística internacional Lemons").trim();

      // Brand style cacheado 24h (compartido con endpoint OpenAI)
      const brandStyle = await getBrandStyleDescription();

      // Traducir brief y prompt_override a inglés (cacheado, no-op si ya están en inglés)
      const briefEn = await translateToEnglish(brief);
      const prompt_overrideEn = prompt_override ? await translateToEnglish(prompt_override) : prompt_override;

      const variantPrompt = (typeof prompt_overrideEn === "string" && prompt_overrideEn.trim().length > 50)
        ? prompt_overrideEn.trim()
        : [
            "CRITICAL INSTRUCTION: Reproduce EXACTLY the visual style of the attached reference images. The new image must look as if it were designed by the same team that created the references. DO NOT deviate from the palette, typography, or composition.",
            "",
            "LEMONS BRAND GUIDE (derived from the references):",
            brandStyle || "Bright yellow palette (#FFD60A) and navy blue (#1A2B6E). Thick uppercase sans-serif typography, white on blue backgrounds. Pill-shaped badges. Mascot: 3D Pixar-style lemon with green leaves on top, expressive face, yellow arms and legs. Clean composition with clear visual hierarchy.",
            "",
            "PIECE TO DESIGN:",
            briefEn,
            "",
            `FORMAT: aspect ratio ${aspectRatio} ${isVertical ? "(Instagram Story vertical 9:16)" : "(Instagram square feed 1:1)"}.`,
            "",
            "GENERATION REQUIREMENTS:",
            "- Full-bleed background yellow (#FFD60A) or navy blue (#1A2B6E), never plain white",
            "- If the brief implies a character, use the lemon mascot with the SAME 3D aesthetic as the references",
            "- Typography: thick sans-serif, uppercase, inside pill-shaped badges when text is highlighted",
            "- Iconography: cardboard boxes with Lemon's logo, flags, planes, ships as appropriate",
            "- DO NOT include watermarks, third-party logos, or illegible text",
            "- Polished, professional composition, ready to publish on Instagram without retouching",
          ].join("\n");

      // Mismo prompt structure que el endpoint OpenAI
      const prompt = [
        "═══ BASE STYLE (always apply, immutable) ═══",
        LEMONS_BASE_STYLE_PROMPT,
        "",
        "═══ THIS PIECE (specific variant) ═══",
        variantPrompt,
        "",
        `Output aspect ratio: ${aspectRatio}.`,
      ].join("\n");

      // Descargar refs como inline_data base64 (formato Gemini)
      const refParts = [];
      for (const url of LEMONS_BRAND_REFS) {
        const r = await fetch(url);
        if (!r.ok) {
          console.warn("[IG-CONTENT generate-image-nano] ref no descargada:", url);
          continue;
        }
        const buf = Buffer.from(await r.arrayBuffer());
        const lower = url.toLowerCase().split("?")[0];
        const mime = lower.endsWith(".png") ? "image/png"
                  : lower.endsWith(".webp") ? "image/webp"
                  : "image/jpeg";
        refParts.push({ inline_data: { mime_type: mime, data: buf.toString("base64") } });
      }
      if (refParts.length === 0) {
        return res.status(500).json({ error: "No se pudieron cargar las referencias de marca" });
      }

      // Llamada a Gemini 2.5 Flash Image (Nano Banana)
      // Modelo overridable por env var por si Google renombra o sale Gemini 3
      const geminiModel = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
      const gemBody = {
        contents: [{
          role: "user",
          parts: [
            { text: prompt.slice(0, 32000) },
            ...refParts,
          ],
        }],
        generationConfig: {
          responseModalities: ["IMAGE"],
        },
      };

      const gemRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gemBody),
      });
      const gemData = await gemRes.json();

      const parts = gemData?.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find(p => p?.inline_data?.data);
      if (!gemRes.ok || !imgPart) {
        console.error("[IG-CONTENT generate-image-nano GEMINI ERROR]", JSON.stringify(gemData).slice(0, 500));
        const errMsg = gemData?.error?.message || gemData?.candidates?.[0]?.finishReason || "Error generando imagen";
        // Status 422 (no 502) para que Cloudflare no intercepte y devuelva su HTML de error;
        // el browser recibe nuestro JSON con el mensaje real.
        return res.status(422).json({ error: errMsg, model: geminiModel, status: gemRes.status });
      }

      const imgBuffer = Buffer.from(imgPart.inline_data.data, "base64");

      // Subir a Cloudinary (mismo folder que OpenAI, public_id distinto para identificar)
      const uploadRes = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "lemons-ig/ai-generated",
            public_id: `idea_${ideaId}_nano_${Date.now()}`,
            resource_type: "image",
          },
          (err, out) => (err ? reject(err) : resolve(out))
        );
        stream.end(imgBuffer);
      });

      res.json({
        ok: true,
        url: uploadRes.secure_url,
        size: uploadRes.width && uploadRes.height ? `${uploadRes.width}x${uploadRes.height}` : sizeLabel,
        bytes: uploadRes.bytes,
        model: geminiModel,
        engine: "nano",
        refs_used: refParts.length,
        brand_style_chars: (brandStyle || "").length,
      });
    } catch (e) {
      console.error("[IG-CONTENT generate-image-nano ERROR]", e.message);
      res.status(500).json({ error: e.message || "Error interno" });
    }
  }
);

// POST /ideas/:id/generate-image-flux — genera imagen con Replicate Flux Kontext Pro
// Mismo contrato que /generate-image y /generate-image-nano. Usa Flux Kontext Pro porque
// acepta input_image (1 ref de marca Lemons como guía visual), manteniendo consistencia
// con la estética de marca. Costo ~$0.05/img, velocidad ~8s.
router.post(
  "/ideas/:id/generate-image-flux",
  authRequired,
  requireRole(["operator", "admin"], "instagram"),
  async (req, res) => {
    try {
      const { kind: kindOverride, prompt_override } = req.body || {};
      const ideaId = parseInt(req.params.id, 10);
      if (!Number.isFinite(ideaId)) return res.status(400).json({ error: "id inválido" });

      const ideaQ = await db.query(
        `SELECT id, kind, hook, caption, visual_brief FROM ig_content_ideas WHERE id=$1`,
        [ideaId]
      );
      const idea = ideaQ.rows[0];
      if (!idea) return res.status(404).json({ error: "Idea no encontrada" });

      if (!process.env.REPLICATE_API_TOKEN) {
        return res.status(500).json({ error: "REPLICATE_API_TOKEN no configurada en Render" });
      }

      const targetKind = kindOverride || idea.kind || "post";
      const isVertical = ["story", "story_image", "story_video", "reel"].includes(targetKind);
      const aspectRatio = isVertical ? "9:16" : "1:1";

      const brief = (idea.visual_brief || idea.hook || idea.caption || "Imagen para Instagram de logística internacional Lemons").trim();

      // Brand style cacheado 24h (compartido con endpoints OpenAI y Nano Banana)
      const brandStyle = await getBrandStyleDescription();

      // Traducir brief y prompt_override a inglés (cacheado, no-op si ya están en inglés)
      const briefEn = await translateToEnglish(brief);
      const prompt_overrideEn = prompt_override ? await translateToEnglish(prompt_override) : prompt_override;

      const variantPrompt = (typeof prompt_overrideEn === "string" && prompt_overrideEn.trim().length > 50)
        ? prompt_overrideEn.trim()
        : [
            "CRITICAL INSTRUCTION: Reproduce EXACTLY the visual style of the attached reference image. The new image must look as if it were designed by the same team. DO NOT deviate from the palette, typography, or composition.",
            "",
            "LEMONS BRAND GUIDE (derived from the references):",
            brandStyle || "Bright yellow palette (#FFD60A) and navy blue (#1A2B6E). Thick uppercase sans-serif typography, white on blue backgrounds. Pill-shaped badges. Mascot: 3D Pixar-style lemon with green leaves on top, expressive face, yellow arms and legs. Clean composition with clear visual hierarchy.",
            "",
            "PIECE TO DESIGN:",
            briefEn,
            "",
            isVertical ? "FORMAT: Instagram Story vertical 9:16." : "FORMAT: Instagram square feed 1:1.",
            "",
            "GENERATION REQUIREMENTS:",
            "- Full-bleed background yellow (#FFD60A) or navy blue (#1A2B6E), never plain white",
            "- If the brief implies a character, use the lemon mascot with the SAME 3D aesthetic as the reference",
            "- Typography: thick sans-serif, uppercase, inside pill-shaped badges when text is highlighted",
            "- Iconography: cardboard boxes with Lemon's logo, flags, planes, ships as appropriate",
            "- DO NOT include watermarks, third-party logos, or illegible text",
            "- Polished, professional composition, ready to publish on Instagram without retouching",
          ].join("\n");

      // Mismo prompt structure que los otros endpoints
      const prompt = [
        "═══ BASE STYLE (always apply, immutable) ═══",
        LEMONS_BASE_STYLE_PROMPT,
        "",
        "═══ THIS PIECE (specific variant) ═══",
        variantPrompt,
      ].join("\n");

      // Flux 1.1 Pro: genera desde cero usando solo el prompt. Mejor para layouts editoriales
      // complejos (cards, badges, mascot posicionada) que Kontext Pro, que estaba "atado" a
      // la ref de marca y modificaba sutilmente en lugar de crear lo que pide el prompt.
      // La consistencia de marca queda cubierta por LEMONS_BASE_STYLE_PROMPT + brandStyle
      // que ya van pre-pendeados al prompt textual.

      // Llamada a Replicate (modo síncrono con Prefer: wait — espera hasta 60s la predicción)
      const replicateUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions";
      const repBody = {
        input: {
          prompt: prompt.slice(0, 8000),
          aspect_ratio: aspectRatio,
          output_format: "jpg",
          safety_tolerance: 2,
          // NOTA: Flux 1.1 Pro no usa input_image. Removed para que el modelo cree desde cero.
        },
      };

      // LOG temporal: ver qué prompt llega realmente al modelo (debug user "no tiene que ver con prompt")
      console.log("[IG-CONTENT generate-image-flux PROMPT FINAL]", {
        idea_id: ideaId,
        prompt_length: prompt.length,
        aspect_ratio: aspectRatio,
        prompt_first_500: prompt.slice(0, 500),
        prompt_last_500: prompt.slice(-500),
        had_prompt_override: !!prompt_override,
        translation_used: prompt_overrideEn !== prompt_override || briefEn !== brief,
      });

      const repRes = await fetch(replicateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          "Prefer": "wait=60",
        },
        body: JSON.stringify(repBody),
      });
      const repData = await repRes.json();

      // Flux Kontext Pro devuelve `output` como string (URL de la imagen) cuando succeeded.
      // Si el modelo todavía está procesando (status starting/processing), `output` será null.
      // Con Prefer: wait=60 deberíamos siempre tener succeeded o failed.
      if (!repRes.ok || repData.status !== "succeeded" || typeof repData.output !== "string") {
        console.error("[IG-CONTENT generate-image-flux REPLICATE ERROR]", JSON.stringify(repData).slice(0, 500));
        const errMsg = repData?.error || repData?.detail || `Replicate status: ${repData?.status || "unknown"}`;
        return res.status(422).json({ error: errMsg, status: repRes.status, replicate_status: repData?.status });
      }

      // Descargar la imagen generada como Buffer
      const imgRes = await fetch(repData.output);
      if (!imgRes.ok) {
        console.error("[IG-CONTENT generate-image-flux] no se pudo descargar output:", repData.output);
        return res.status(502).json({ error: "No se pudo descargar la imagen generada" });
      }
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

      // Subir a Cloudinary (mismo folder, public_id con sufijo _flux para identificar)
      const uploadRes = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "lemons-ig/ai-generated",
            public_id: `idea_${ideaId}_flux_${Date.now()}`,
            resource_type: "image",
          },
          (err, out) => (err ? reject(err) : resolve(out))
        );
        stream.end(imgBuffer);
      });

      res.json({
        ok: true,
        url: uploadRes.secure_url,
        size: uploadRes.width && uploadRes.height ? `${uploadRes.width}x${uploadRes.height}` : `auto-${aspectRatio}`,
        bytes: uploadRes.bytes,
        model: "black-forest-labs/flux-1.1-pro",
        engine: "flux",
        refs_used: 0, // Flux 1.1 Pro no usa input_image, solo prompt textual
        brand_style_chars: (brandStyle || "").length,
      });
    } catch (e) {
      console.error("[IG-CONTENT generate-image-flux ERROR]", e.message);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// POST /ideas/:id/build-image-prompt — usa Claude para armar el prompt óptimo de image-gen
router.post(
  "/ideas/:id/build-image-prompt",
  authRequired,
  requireRole(["operator", "admin"], "instagram"),
  async (req, res) => {
    try {
      const { kind: kindOverride } = req.body || {};
      const ideaId = parseInt(req.params.id, 10);
      if (!Number.isFinite(ideaId)) return res.status(400).json({ error: "id inválido" });

      const ideaQ = await db.query(
        `SELECT id, kind, hook, caption, hashtags, script, visual_brief FROM ig_content_ideas WHERE id=$1`,
        [ideaId]
      );
      const idea = ideaQ.rows[0];
      if (!idea) return res.status(404).json({ error: "Idea no encontrada" });

      const targetKind = kindOverride || idea.kind || "post";
      const isVertical = ["story", "story_image", "story_video", "reel"].includes(targetKind);
      const size = isVertical ? "1024x1536" : "1024x1024";
      const formatLabel = isVertical ? "Instagram Story vertical 9:16" : "Instagram feed cuadrado 1:1";

      // Pre-pass: descripción de marca (cacheada). Reusa el helper existente.
      const brandStyle = await getBrandStyleDescription();

      // Meta-prompt para Claude: solo la VARIANTE específica. La guía de estilo
      // base (paleta, render 3D Pixar, lighting, mood) se pre-pendea aparte en
      // /generate-image — Claude no debe repetirla.
      const claudeMeta = [
        "You are an expert art director specialized in branding and Instagram for Lemons Logistics (Argentine international shipping company). I'll give you a content idea. Return an OPTIMIZED PROMPT in ENGLISH that describes ONLY the SPECIFIC VARIANT of this piece (which literal headline goes, in which badge, what pose the mascot has if it appears, which iconography to add, where each element goes).",
        "",
        "IMPORTANT: DO NOT repeat the base style guide (palette, 3D Pixar render, lighting, mood, composition rules) — that's already fixed and will be pre-pended to the final prompt automatically. Focus ONLY on what's specific to this piece.",
        "",
        "What you MUST include:",
        "- Literal text in quotes for headlines and subtitles. KEEP THESE QUOTED TEXTS IN SPANISH (they will be rendered visible on the image for the Argentine market). Example: a headline like \"ENVÍOS DESDE USA\" stays in Spanish, but the surrounding instructions describing where it goes are in English.",
        "- Specific pose and expression of the lemon mascot if it makes sense for the brief (otherwise omit the mascot)",
        "- Contextual iconography (boxes, flags, planes, ships, maps, etc.)",
        "- Layout: where each element goes (top/center/bottom, left/right)",
        "- Any concrete data from the brief that must appear (prices, dates, countries)",
        "",
        "Return ONLY the prompt in ENGLISH (with quoted Spanish headlines preserved as described above), direct, no preamble, no explanation, max 400 words.",
        "",
        "─── BRAND BRIEF (reference, do not repeat) ───",
        brandStyle || "(see hardcoded base guide on server)",
        "",
        "─── CONTENT IDEA (provided in Spanish, you must understand and produce English prompt for image generation) ───",
        `Type: ${targetKind} (${formatLabel})`,
        `Hook/Hashtag: ${idea.hook || "-"}`,
        `Caption: ${idea.caption || "-"}`,
        idea.hashtags ? `Hashtags: ${idea.hashtags}` : "",
        idea.script ? `Script (if reel): ${idea.script}` : "",
        `Original visual brief: ${idea.visual_brief || "-"}`,
      ].filter(Boolean).join("\n");

      const { askClaude } = require("../lib/claude");
      const out = await askClaude({
        system: "You are a professional art director. You return direct, specific prompts in English for image generation models (gpt-image-1, Flux, Gemini), preserving any literal Spanish text in quotes that needs to appear visually in the image.",
        messages: [{ role: "user", content: claudeMeta }],
        max_tokens: 1200,
      });

      const promptText = (out?.text || "").trim();
      if (!promptText) {
        return res.status(502).json({ error: "Claude no devolvió prompt" });
      }

      res.json({
        ok: true,
        prompt: promptText,
        kind: targetKind,
        size,
        format_label: formatLabel,
      });
    } catch (e) {
      console.error("[IG-CONTENT build-image-prompt ERROR]", e.message);
      res.status(500).json({ error: e.message || "Error interno" });
    }
  }
);

// POST /brand-style/refresh — admin: fuerza re-generar la descripción de marca cacheada
router.post(
  "/brand-style/refresh",
  authRequired,
  requireRole(["admin"], "instagram"),
  async (req, res) => {
    _brandStyleDescription = null;
    _brandStyleDescribedAt = 0;
    const desc = await getBrandStyleDescription();
    res.json({ ok: true, length: (desc || "").length, preview: (desc || "").slice(0, 300) });
  }
);

// ─── TEMPLATES ──────────────────────────────────────────────────────────────
const { renderTemplate, listTemplates, TEMPLATES } = require("../lib/templateRenderer");

router.get(
  "/templates",
  authRequired,
  requireRole(["operator", "admin"], "instagram"),
  (req, res) => {
    res.json({ ok: true, templates: listTemplates() });
  }
);

// GET /mascots — listado de mascotas para el dropdown del modal de templates.
// Lee server/lib/mascots-manifest.json (cargado en memoria por templateRenderer).
router.get(
  "/mascots",
  authRequired,
  requireRole(["operator", "admin"], "instagram"),
  (req, res) => {
    const { listMascots } = require("../lib/templateRenderer");
    res.json({ ok: true, mascots: listMascots() });
  }
);

router.post(
  "/templates/:id/render",
  authRequired,
  requireRole(["operator", "admin"], "instagram"),
  async (req, res) => {
    try {
      const { fields = {} } = req.body || {};
      const buf = await renderTemplate(req.params.id, fields);

      const uploadRes = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "lemons-ig/templates",
            public_id: `${req.params.id}_${Date.now()}`,
            resource_type: "image",
          },
          (err, out) => (err ? reject(err) : resolve(out))
        );
        stream.end(buf);
      });

      const tpl = TEMPLATES[req.params.id];
      res.json({
        ok: true,
        url: uploadRes.secure_url,
        bytes: uploadRes.bytes,
        width: uploadRes.width,
        height: uploadRes.height,
        recommended_kind: tpl?.kind || null,
      });
    } catch (e) {
      console.error("[IG-CONTENT templates/render ERROR]", e.message);
      res.status(500).json({ error: e.message || "Error renderizando" });
    }
  }
);

// ─── CLAWFU SKILLS — generación con frameworks expertos ─────────────────────
const { listSkills, loadSkill, findSkillsForObjective, buildSkillsPrompt } = require("../lib/clawfu");
const { askClaude } = require("../lib/claude");

const _CLAWFU_AI_KEY = process.env.AI_API_KEY || null;
function _requireAIKeyClawfu(req, res, next) {
  const key = req.headers["x-ai-api-key"] || req.query._key;
  if (!_CLAWFU_AI_KEY || key !== _CLAWFU_AI_KEY) return res.status(403).json({ error: "Invalid API key" });
  next();
}

const LEMONS_BRAND_PROMPT = `Sos el asistente de marketing de Lemon's Logística Internacional, una empresa argentina que trae productos de China, USA y Europa para emprendedores y particulares.

Servicios:
- Courier puerta a puerta desde China (15-25 días), USA (7-12 días), Europa (10-18 días).
- Asesoramiento aduanero, importación con o sin CUIT.
- Compras asistidas en Amazon, AliExpress, Alibaba, eBay, Shein, Temu.
- Consolidación de envíos en bodegas propias en Miami y Yiwu.

Tono: argentino, cercano, profesional, claro. Usá vos. Sin emojis excesivos.`;

async function runSkillDrivenGenerator(body, res) {
  try {
    const {
      objetivo,
      tono = "argentino cercano profesional",
      formato = "post",
      audiencia = "emprendedores que importan productos a Argentina",
      producto = "Lemon's Logística — courier puerta a puerta desde China/USA/Europa",
      skill_names,
      lang,
    } = body || {};

    if (!objetivo || typeof objetivo !== "string") return res.status(400).json({ error: "objetivo requerido (string)" });

    let skills = [];
    if (Array.isArray(skill_names) && skill_names.length) {
      skills = skill_names.map(n => loadSkill(n, lang || null)).filter(Boolean);
    }
    if (!skills.length) {
      skills = findSkillsForObjective(objetivo, 4, ["content", "strategy", "acquisition", "funnels", "branding", "growth", "sales"], lang || null);
    }

    const systemPrompt = LEMONS_BRAND_PROMPT + buildSkillsPrompt(skills) +
      `\n\nFormato de output: SOLO JSON válido sin markdown ni texto extra. Schema: { "hook": string, "caption": string, "hashtags": string[], "visual_brief": string, "cta": string }.`;

    const userMessage = `Generá un ${formato} sobre: ${objetivo}.\nTono: ${tono}.\nAudiencia: ${audiencia}.\nProducto/contexto: ${producto}.\n\nDevolvé JSON válido con: { hook (gancho corto), caption (texto principal del post), hashtags (array de 5-10 hashtags relevantes sin #), visual_brief (descripción concreta de la imagen ideal), cta (call to action) }.`;

    const { text } = await askClaude({
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 2000,
    });

    let generated = null;
    let parseWarning = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      generated = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      parseWarning = "JSON inválido en respuesta de Claude — devuelvo raw text";
      generated = { raw: text };
    }

    res.json({
      ok: true,
      generated,
      skills_used: skills.map(s => ({
        name: s.name,
        category: s.category,
        description: s.description,
        ...(s.name_es ? { name_es: s.name_es } : {}),
        ...(s.description_es ? { description_es: s.description_es } : {}),
        ...(s.category_es ? { category_es: s.category_es } : {}),
      })),
      ...(parseWarning ? { warning: parseWarning } : {}),
    });
  } catch (e) {
    console.error("[generate-skill-driven ERROR]", e.message);
    res.status(500).json({ error: e.message || "Error generando contenido" });
  }
}

router.get("/skills", authRequired, async (req, res) => {
  try {
    const { category, lang } = req.query;
    res.json({ ok: true, skills: listSkills(category || null, lang || null) });
  } catch (e) {
    console.error("[clawfu /skills ERROR]", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post("/generate-skill-driven", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  await runSkillDrivenGenerator(req.body, res);
});

router.post("/ai/generate-skill-driven", _requireAIKeyClawfu, async (req, res) => {
  await runSkillDrivenGenerator(req.body, res);
});

// POST /ideas — guardar idea desde frontend (resultado del FrameworksTab u otro)
router.post("/ideas", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const { kind = "post", generated, frameworks_used, source = "frameworks_tab" } = req.body || {};
    if (!generated || typeof generated !== "object") return res.status(400).json({ error: "generated requerido" });
    const row = await insertIdeaFromGenerated({ kind, generated, source, frameworks_used, userId: req.user?.id || null });
    res.json({ ok: true, row });
  } catch (e) {
    console.error("[IG-CONTENT POST /ideas ERROR]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /ai/ideas — bot ETZ: lista ideas filtrables (status, limit)
router.get("/ai/ideas", _requireAIKeyClawfu, async (req, res) => {
  try {
    await ensureTables();
    const { status } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const conds = [];
    const params = [];
    if (status) { params.push(String(status)); conds.push(`status = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    params.push(limit);
    const q = await db.query(
      `SELECT id, kind, hook, caption, hashtags, status, frameworks_used, source, created_at
         FROM ig_content_ideas ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    res.json({ ok: true, rows: q.rows, total: q.rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /ai/ideas/:id/approve — bot ETZ: aprobar idea
router.post("/ai/ideas/:id/approve", _requireAIKeyClawfu, async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
    const q = await db.query(
      `UPDATE ig_content_ideas SET status = 'approved', approved_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (!q.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /ai/ideas/:id/reject — bot ETZ
router.post("/ai/ideas/:id/reject", _requireAIKeyClawfu, async (req, res) => {
  try {
    await ensureTables();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
    const q = await db.query(`UPDATE ig_content_ideas SET status='rejected' WHERE id=$1 RETURNING *`, [id]);
    if (!q.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /ai/schedule — bot ETZ: programar idea (asume idea ya aprobada o draft + media subida)
router.post("/ai/schedule", _requireAIKeyClawfu, async (req, res) => {
  try {
    const row = await _scheduleIdeaPost(req.body, null);
    res.json({ ok: true, row });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error("[IG-CONTENT /ai/schedule ERROR]", e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /ai/ideas-from-skill — bot ETZ: genera con frameworks Y guarda como draft en una llamada
router.post("/ai/ideas-from-skill", _requireAIKeyClawfu, async (req, res) => {
  try {
    await ensureTables();
    const {
      objetivo,
      tono = "argentino cercano profesional",
      formato = "post",
      audiencia = "emprendedores que importan productos a Argentina",
      producto = "Lemon's Logística — courier puerta a puerta desde China/USA/Europa",
      skill_names,
      lang = "es",
    } = req.body || {};
    if (!objetivo || typeof objetivo !== "string") return res.status(400).json({ error: "objetivo requerido (string)" });

    let skills = [];
    if (Array.isArray(skill_names) && skill_names.length) {
      skills = skill_names.map(n => loadSkill(n, lang)).filter(Boolean);
    }
    if (!skills.length) {
      skills = findSkillsForObjective(objetivo, 4, ["content","strategy","acquisition","funnels","branding","growth","sales"], lang);
    }

    const systemPrompt = LEMONS_BRAND_PROMPT + buildSkillsPrompt(skills) +
      `\n\nFormato de output: SOLO JSON válido sin markdown ni texto extra. Schema: { "hook": string, "caption": string, "hashtags": string[], "visual_brief": string, "cta": string }.`;
    const userMessage = `Generá un ${formato} sobre: ${objetivo}.\nTono: ${tono}.\nAudiencia: ${audiencia}.\nProducto/contexto: ${producto}.\n\nDevolvé JSON válido con: { hook, caption, hashtags (array sin #), visual_brief, cta }.`;

    const { text } = await askClaude({
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 2000,
    });

    let generated = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      generated = JSON.parse(m ? m[0] : text);
    } catch {
      return res.status(502).json({ error: "Claude no devolvió JSON válido", raw: text.slice(0, 800) });
    }

    const frameworks_used = skills.map(s => s.name_es || s.name);
    const row = await insertIdeaFromGenerated({
      kind: formato,
      generated,
      source: "wa_bot",
      frameworks_used,
      userId: null,
    });

    res.json({
      ok: true,
      idea_id: row.id,
      row,
      generated,
      skills_used: skills.map(s => ({ name: s.name, name_es: s.name_es || null, category: s.category })),
    });
  } catch (e) {
    console.error("[IG-CONTENT /ai/ideas-from-skill ERROR]", e.message);
    res.status(500).json({ error: e.message || "Error generando/guardando idea" });
  }
});

module.exports = router;
module.exports.ensureTables = ensureTables;
