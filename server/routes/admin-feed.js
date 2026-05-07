// server/routes/admin-feed.js
//
// Endpoints del feed editor del admin (spec § 9.2). El feed reemplaza al
// "Lo último" del HomeClient — el admin postea actualizaciones
// (permanentes, stories de 24hs, o updates destacadas).
//
//   GET    /feed                    → posts activos (no auth — público para HomeClient)
//   POST   /admin/feed              → crear post (admin)
//   PATCH  /admin/feed/:id          → editar post (admin)
//   DELETE /admin/feed/:id          → borrar post (admin)
//   GET    /admin/feed              → todos los posts (incluyendo expirados, admin)

"use strict";

const express = require("express");
const { z } = require("zod");
const db = require("../db");

const VALID_TYPES = ["post", "story", "update"];

function build({ authRequired, requireRole }) {
  const router = express.Router();
  const adminMw = [authRequired, requireRole(["admin", "operator"])];

  // ── Public: lista de posts activos (no expirados) ──────────────────────────
  router.get("/feed", async (_req, res) => {
    try {
      const r = await db.query(
        `SELECT id, type, title, body, media_url, author_id, created_at, expires_at
         FROM feed_posts
         WHERE expires_at IS NULL OR expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 50`
      );
      res.json({ ok: true, posts: r.rows });
    } catch (e) {
      console.error("[feed list]", e);
      res.status(500).json({ error: "Error al cargar feed" });
    }
  });

  // ── Admin: lista completa (incluyendo expirados) ───────────────────────────
  router.get("/admin/feed", ...adminMw, async (_req, res) => {
    try {
      const r = await db.query(
        `SELECT id, type, title, body, media_url, author_id, created_at, expires_at
         FROM feed_posts ORDER BY created_at DESC LIMIT 200`
      );
      res.json({ ok: true, posts: r.rows });
    } catch (e) {
      console.error("[admin-feed list]", e);
      res.status(500).json({ error: "Error al cargar feed" });
    }
  });

  // ── Admin: crear post ──────────────────────────────────────────────────────
  router.post("/admin/feed", ...adminMw, async (req, res) => {
    try {
      const schema = z.object({
        type:      z.enum(VALID_TYPES).default("post"),
        title:     z.string().max(200).optional().nullable(),
        body:      z.string().max(8000).optional().nullable(),
        media_url: z.string().url().optional().nullable(),
        // Si type=story, expires_at se setea a NOW()+24h automáticamente si
        // no viene. Si viene y no es story, se respeta como expiración manual.
        expires_at: z.string().datetime().optional().nullable(),
      });
      const p = schema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "Datos inválidos", details: p.error.flatten() });
      const { type, title, body, media_url } = p.data;
      let { expires_at } = p.data;

      if (type === "story" && !expires_at) {
        expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }

      if (!title && !body && !media_url) {
        return res.status(400).json({ error: "Al menos un campo (title/body/media_url) es requerido" });
      }

      const r = await db.query(
        `INSERT INTO feed_posts (type, title, body, media_url, author_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, type, title, body, media_url, author_id, created_at, expires_at`,
        [type, title || null, body || null, media_url || null, req.user.id, expires_at || null]
      );
      res.json({ ok: true, post: r.rows[0] });
    } catch (e) {
      console.error("[admin-feed create]", e);
      res.status(500).json({ error: "Error al crear post" });
    }
  });

  // ── Admin: editar post ─────────────────────────────────────────────────────
  router.patch("/admin/feed/:id", ...adminMw, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });

      const schema = z.object({
        type:       z.enum(VALID_TYPES).optional(),
        title:      z.string().max(200).optional().nullable(),
        body:       z.string().max(8000).optional().nullable(),
        media_url:  z.string().url().optional().nullable(),
        expires_at: z.string().datetime().optional().nullable(),
      });
      const p = schema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

      // Build dynamic UPDATE
      const updates = [];
      const values = [];
      let i = 1;
      for (const [k, v] of Object.entries(p.data)) {
        if (v === undefined) continue;
        updates.push(`${k} = $${i++}`);
        values.push(v);
      }
      if (!updates.length) return res.status(400).json({ error: "Nada que actualizar" });
      values.push(id);
      const r = await db.query(
        `UPDATE feed_posts SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
        values
      );
      if (!r.rows[0]) return res.status(404).json({ error: "Post no encontrado" });
      res.json({ ok: true, post: r.rows[0] });
    } catch (e) {
      console.error("[admin-feed update]", e);
      res.status(500).json({ error: "Error al actualizar" });
    }
  });

  // ── Admin: borrar post ─────────────────────────────────────────────────────
  router.delete("/admin/feed/:id", ...adminMw, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });
      const r = await db.query(`DELETE FROM feed_posts WHERE id = $1 RETURNING id`, [id]);
      if (!r.rows[0]) return res.status(404).json({ error: "Post no encontrado" });
      res.json({ ok: true, deleted: r.rows[0].id });
    } catch (e) {
      console.error("[admin-feed delete]", e);
      res.status(500).json({ error: "Error al borrar" });
    }
  });

  return router;
}

module.exports = { build };
