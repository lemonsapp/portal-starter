// server/routes/admin-users.js
//
// Endpoints admin para gestionar users + coins desde el AdminPanel.
// Spec § 9.1.
//
//   GET  /admin/users               → lista users + balance + last_seen
//   POST /admin/users/:id/coins     → regalar/ajustar coins (action: gift|adjust)
//   GET  /admin/users/:id/transactions → historial coins de un user

"use strict";

const express = require("express");
const { z } = require("zod");
const db = require("../db");

function build({ authRequired, requireRole }) {
  const router = express.Router();
  const adminMw = [authRequired, requireRole(["admin", "operator"])];

  // ── GET /admin/users ─────────────────────────────────────────────────────
  router.get("/users", ...adminMw, async (req, res) => {
    try {
      const search = (req.query.search || "").trim().toLowerCase();
      const params = [];
      let where = "";
      if (search) {
        params.push(`%${search}%`);
        where = `WHERE LOWER(u.email) LIKE $1 OR LOWER(u.name) LIKE $1`;
      }

      const r = await db.query(
        `SELECT
           u.id, u.client_number, u.name, u.email, u.role,
           u.email_verified, u.active, u.last_seen_at, u.created_at,
           COALESCE(lc.balance, 0)     AS balance,
           COALESCE(lc.total_earned, 0) AS total_earned
         FROM users u
         LEFT JOIN lemon_coins lc ON lc.user_id = u.id
         ${where}
         ORDER BY u.created_at DESC
         LIMIT 200`,
        params
      );
      res.json({ ok: true, users: r.rows });
    } catch (e) {
      console.error("[admin-users list]", e);
      res.status(500).json({ error: "Error al cargar users" });
    }
  });

  // ── POST /admin/users/:id/coins ──────────────────────────────────────────
  router.post("/users/:id/coins", ...adminMw, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (!Number.isFinite(userId)) return res.status(400).json({ error: "ID inválido" });

      const schema = z.object({
        action:  z.enum(["gift", "adjust"]),  // gift: regalar (positivo); adjust: ajustar saldo (+/-)
        amount:  z.number().int(),
        reason:  z.string().min(1).max(200),
      });
      const p = schema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: "Datos inválidos" });

      const { action, amount, reason } = p.data;
      if (action === "gift" && amount <= 0) return res.status(400).json({ error: "gift requiere amount > 0" });

      // Asegurar lemon_coins row existe
      await db.query(
        `INSERT INTO lemon_coins (user_id, balance, total_earned) VALUES ($1, 0, 0) ON CONFLICT DO NOTHING`,
        [userId]
      );

      // Insertar transaction
      const txType = action === "gift" ? "gift" : "adjust";
      await db.query(
        `INSERT INTO coin_transactions (user_id, type, amount, reason) VALUES ($1, $2, $3, $4)`,
        [userId, txType, amount, `[admin:${req.user.id}] ${reason}`]
      );

      // Actualizar balance + total_earned
      if (amount > 0) {
        await db.query(
          `UPDATE lemon_coins
             SET balance = balance + $1,
                 total_earned = total_earned + $1,
                 peak_balance = GREATEST(peak_balance, balance + $1),
                 updated_at = NOW()
           WHERE user_id = $2`,
          [amount, userId]
        );
      } else {
        // amount negativo (sólo en adjust)
        await db.query(
          `UPDATE lemon_coins
             SET balance = GREATEST(0, balance + $1),
                 updated_at = NOW()
           WHERE user_id = $2`,
          [amount, userId]
        );
      }

      // Si es gift, también lo registramos en coin_gifts para audit
      if (action === "gift") {
        await db.query(
          `INSERT INTO coin_gifts (from_user, to_user, amount, message) VALUES ($1, $2, $3, $4)`,
          [req.user.id, userId, amount, reason]
        );
      }

      // Devolver balance actualizado
      const balR = await db.query("SELECT balance, total_earned FROM lemon_coins WHERE user_id=$1", [userId]);
      res.json({ ok: true, balance: balR.rows[0]?.balance ?? 0, total_earned: balR.rows[0]?.total_earned ?? 0 });
    } catch (e) {
      console.error("[admin-users coins]", e);
      res.status(500).json({ error: "Error al modificar coins" });
    }
  });

  // ── GET /admin/users/:id/transactions ────────────────────────────────────
  router.get("/users/:id/transactions", ...adminMw, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (!Number.isFinite(userId)) return res.status(400).json({ error: "ID inválido" });
      const r = await db.query(
        `SELECT id, type, amount, reason, created_at
         FROM coin_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [userId]
      );
      res.json({ ok: true, transactions: r.rows });
    } catch (e) {
      console.error("[admin-users tx]", e);
      res.status(500).json({ error: "Error al cargar historial" });
    }
  });

  return router;
}

module.exports = { build };
