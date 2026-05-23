// server/routes/checkout.js
//
// Shop F2 (2026-05-23): checkout + MercadoPago integration.
//
// Endpoints:
//   POST /api/shop/checkout                → crea orden + preferencia MP
//   GET  /api/shop/orders/:public_id       → consulta estado de orden (público,
//                                              por public_id solo)
//   POST /api/webhooks/mercadopago         → webhook MP, marca orden paid
//   GET  /api/admin/shop/orders            → admin: lista órdenes
//   GET  /api/admin/shop/orders/:id        → admin: detalle
//   POST /api/admin/shop/orders/:id/status → admin: cambiar estado lifecycle
//
// MercadoPago integration: REST API directo (sin SDK). Endpoints:
//   POST https://api.mercadopago.com/checkout/preferences (Bearer access_token)
//   GET  https://api.mercadopago.com/v1/payments/:id     (para webhook lookup)
//
// Graceful degradation: si mercadopago.access_token no está configurado,
// la orden se crea igual con status pending_payment + init_point=null.
// El frontend redirige al success page con un aviso de "coordinación manual".

"use strict";

const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const db = require("../db");
const cs = require("../lib/configStore");

const MP_API = "https://api.mercadopago.com";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generatePublicId() {
  // Short, URL-safe, no I/l/0/O para evitar typos cuando el cliente lee al
  // operador su número de pedido. Formato: HLS-XXXX-XXXX (8 chars).
  const alpha = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () => alpha[Math.floor(Math.random() * alpha.length)];
  return `HLS-${pick()}${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}${pick()}`;
}

function formatARS(cents) {
  if (cents == null) return null;
  return (cents / 100).toLocaleString("es-AR", {
    style: "currency", currency: "ARS",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

function serializeOrder(order, items = []) {
  return {
    id: order.id,
    public_id: order.public_id,
    status: order.status,
    user_id: order.user_id,
    customer_email: order.customer_email,
    customer_first_name: order.customer_first_name,
    customer_last_name: order.customer_last_name,
    customer_phone: order.customer_phone,
    shipping_address: order.shipping_address || {},
    subtotal_cents: order.subtotal_cents,
    shipping_cents: order.shipping_cents,
    total_cents: order.total_cents,
    total_formatted: formatARS(order.total_cents),
    currency: order.currency,
    mp_preference_id: order.mp_preference_id,
    mp_payment_id: order.mp_payment_id,
    mp_status_raw: order.mp_status_raw,
    paid_at: order.paid_at,
    dispatched_at: order.dispatched_at,
    completed_at: order.completed_at,
    admin_notes: order.admin_notes,
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: items.map((it) => ({
      id: it.id,
      product_id: it.product_id,
      product_slug: it.product_slug,
      name: it.name_snapshot,
      price_cents: it.price_cents_snapshot,
      quantity: it.quantity,
      line_total_cents: it.line_total_cents,
      image_url: it.image_url_snapshot,
    })),
  };
}

async function loadOrderById(id) {
  const { rows } = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const { rows: items } = await db.query(
    `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`, [id]
  );
  return { order: rows[0], items };
}

async function loadOrderByPublicId(public_id) {
  const { rows } = await db.query(`SELECT * FROM orders WHERE public_id = $1`, [public_id]);
  if (!rows[0]) return null;
  const { rows: items } = await db.query(
    `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`, [rows[0].id]
  );
  return { order: rows[0], items };
}

// Crea preference en MercadoPago. Devuelve { id, init_point, sandbox_init_point }.
// Si access_token no está configurado, retorna null y el caller maneja el fallback.
async function createMpPreference({ order, items, appUrl, webhookSecret }) {
  const accessToken = await cs.getConfig("mercadopago.access_token");
  if (!accessToken) {
    console.warn("[checkout] mercadopago.access_token no configurado — orden en modo manual");
    return null;
  }

  const mpItems = items.map((it) => ({
    id: String(it.product_id || it.product_slug),
    title: it.name_snapshot,
    quantity: it.quantity,
    currency_id: "ARS",
    unit_price: it.price_cents_snapshot / 100,
    picture_url: it.image_url_snapshot
      ? (it.image_url_snapshot.startsWith("http") ? it.image_url_snapshot : `${appUrl}${it.image_url_snapshot}`)
      : undefined,
  }));

  const notificationUrl = webhookSecret
    ? `${appUrl}/api/webhooks/mercadopago?secret=${encodeURIComponent(webhookSecret)}`
    : `${appUrl}/api/webhooks/mercadopago`;

  const body = {
    items: mpItems,
    payer: {
      email: order.customer_email,
      name: order.customer_first_name,
      surname: order.customer_last_name || undefined,
      phone: order.customer_phone ? { number: order.customer_phone } : undefined,
    },
    external_reference: order.public_id,
    notification_url: notificationUrl,
    back_urls: {
      success: `${appUrl}/shop/checkout/success?order=${encodeURIComponent(order.public_id)}`,
      failure: `${appUrl}/shop/checkout/failure?order=${encodeURIComponent(order.public_id)}`,
      pending: `${appUrl}/shop/checkout/success?order=${encodeURIComponent(order.public_id)}&pending=1`,
    },
    auto_return: "approved",
    statement_descriptor: "HOLISTIC",
    metadata: { order_public_id: order.public_id },
  };

  try {
    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[checkout] MP preference error", res.status, data);
      return null;
    }
    return { id: data.id, init_point: data.init_point, sandbox_init_point: data.sandbox_init_point };
  } catch (e) {
    console.error("[checkout] MP fetch failure", e);
    return null;
  }
}

// Lookup de pago en MP API para confirmar status real.
async function fetchMpPayment(paymentId) {
  const accessToken = await cs.getConfig("mercadopago.access_token");
  if (!accessToken) return null;
  try {
    const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error("[checkout] MP payment lookup", res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error("[checkout] MP payment fetch", e);
    return null;
  }
}

// Determina la base URL del deploy para back_urls + notification_url.
// Prioridad: header `origin` del request → APP_URL del env → fallback localhost.
function getAppUrl(req) {
  const fromEnv = process.env.APP_URL || process.env.PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    try { return new URL(origin).origin; } catch {}
  }
  return "http://localhost:5173";
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const checkoutSchema = z.object({
  customer: z.object({
    email: z.string().email().transform((s) => s.toLowerCase().trim()),
    first_name: z.string().trim().min(1).max(120),
    last_name: z.string().trim().max(120).optional().nullable(),
    phone: z.string().trim().min(4).max(40),
  }),
  shipping_address: z.object({
    street: z.string().trim().min(1).max(200),
    number: z.string().trim().min(1).max(20),
    apartment: z.string().trim().max(40).optional().nullable(),
    city: z.string().trim().min(1).max(120),
    province: z.string().trim().min(1).max(80),
    postal_code: z.string().trim().min(2).max(20),
    country: z.string().trim().max(4).optional().default("AR"),
    notes: z.string().trim().max(800).optional().nullable(),
  }),
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    quantity: z.number().int().positive().max(99),
  })).min(1).max(40),
});

// ─────────────────────────────────────────────────────────────────────────────
// Public router — sin auth (guest checkout)
// ─────────────────────────────────────────────────────────────────────────────

function publicRouter() {
  const router = express.Router();

  // POST /api/shop/checkout
  router.post("/checkout", async (req, res) => {
    let body;
    try { body = checkoutSchema.parse(req.body); }
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.errors }); }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // 1. Cargar productos solicitados + validar stock + tomar snapshots.
      const productIds = body.items.map((i) => i.product_id);
      const { rows: products } = await client.query(
        `SELECT p.*,
                (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) AS primary_image
         FROM products p
         WHERE p.id = ANY($1::int[]) AND p.active = TRUE`,
        [productIds]
      );
      const productMap = new Map(products.map((p) => [p.id, p]));

      const lineItems = [];
      let subtotalCents = 0;
      for (const reqItem of body.items) {
        const p = productMap.get(reqItem.product_id);
        if (!p) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: `Producto ${reqItem.product_id} no disponible` });
        }
        if (p.stock != null && p.stock < reqItem.quantity) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: `Sin stock suficiente de "${p.name}". Disponible: ${p.stock}` });
        }
        const lineTotal = p.price_cents * reqItem.quantity;
        subtotalCents += lineTotal;
        lineItems.push({
          product_id: p.id,
          product_slug: p.slug,
          name_snapshot: p.name,
          price_cents_snapshot: p.price_cents,
          quantity: reqItem.quantity,
          line_total_cents: lineTotal,
          image_url_snapshot: p.primary_image || null,
        });
      }

      const shippingCents = parseInt(await cs.getConfig("shop.shipping_cost_cents"), 10) || 0;
      const totalCents = subtotalCents + shippingCents;

      // 2. Crear orden con public_id único.
      let publicId;
      let inserted;
      for (let attempt = 0; attempt < 5; attempt++) {
        publicId = generatePublicId();
        try {
          const { rows } = await client.query(
            `INSERT INTO orders
               (public_id, status, customer_email, customer_first_name, customer_last_name,
                customer_phone, shipping_address, subtotal_cents, shipping_cents, total_cents)
             VALUES ($1, 'pending_payment', $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [publicId,
             body.customer.email,
             body.customer.first_name,
             body.customer.last_name,
             body.customer.phone,
             JSON.stringify(body.shipping_address),
             subtotalCents, shippingCents, totalCents]
          );
          inserted = rows[0];
          break;
        } catch (e) {
          if (e.code === "23505") continue;  // collision, retry
          throw e;
        }
      }
      if (!inserted) throw new Error("No se pudo generar public_id único");

      // 3. Insertar order_items.
      for (const li of lineItems) {
        await client.query(
          `INSERT INTO order_items
             (order_id, product_id, product_slug, name_snapshot, price_cents_snapshot,
              quantity, line_total_cents, image_url_snapshot)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [inserted.id, li.product_id, li.product_slug, li.name_snapshot,
           li.price_cents_snapshot, li.quantity, li.line_total_cents, li.image_url_snapshot]
        );
      }

      await client.query("COMMIT");

      // 4. Crear preference en MercadoPago (con graceful fallback).
      const appUrl = getAppUrl(req);
      const webhookSecret = await cs.getConfig("mercadopago.webhook_secret");
      const mp = await createMpPreference({
        order: inserted,
        items: lineItems,
        appUrl,
        webhookSecret,
      });

      if (mp) {
        await db.query(
          `UPDATE orders SET mp_preference_id = $1, updated_at = NOW() WHERE id = $2`,
          [mp.id, inserted.id]
        );
        return res.json({
          public_id: inserted.public_id,
          init_point: mp.init_point,
          mp_preference_id: mp.id,
        });
      }

      // Fallback: MP no configurado. La orden quedó en pending_payment;
      // el admin la confirma manualmente desde el panel.
      return res.json({
        public_id: inserted.public_id,
        init_point: null,
        manual: true,
      });
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[checkout]", e);
      res.status(500).json({ error: "Error al procesar la orden" });
    } finally {
      client.release();
    }
  });

  // GET /api/shop/orders/:public_id — consulta pública (para success page)
  router.get("/orders/:public_id", async (req, res) => {
    try {
      const data = await loadOrderByPublicId(String(req.params.public_id || ""));
      if (!data) return res.status(404).json({ error: "Orden no encontrada" });
      // Sanitize: no devolver admin_notes ni mp_payment_id raw al frontend
      // público para evitar leak de datos internos.
      const safe = serializeOrder(data.order, data.items);
      delete safe.admin_notes;
      delete safe.mp_status_raw;
      res.json({ order: safe });
    } catch (e) {
      console.error("[checkout get order]", e);
      res.status(500).json({ error: "Error al consultar la orden" });
    }
  });

  return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook router — sin auth, pero protegido con secret opcional
// ─────────────────────────────────────────────────────────────────────────────

function webhookRouter() {
  const router = express.Router();

  // POST /api/webhooks/mercadopago
  // MP envía notificaciones con shape variado según el tipo (payment, merchant_order, etc.)
  // Patrón v2 (IPN): query `topic=payment&id=PAYMENT_ID`
  // Patrón v3 (notifications): body `{ type: 'payment', data: { id: PAYMENT_ID } }`
  router.post("/mercadopago", async (req, res) => {
    try {
      // Validación de secret (si está configurado).
      const expected = await cs.getConfig("mercadopago.webhook_secret");
      if (expected) {
        const got = req.query.secret || req.headers["x-webhook-secret"];
        if (got !== expected) {
          console.warn("[mp webhook] secret mismatch");
          return res.status(401).send("Unauthorized");
        }
      }

      // Extraer payment_id del payload.
      let paymentId = null;
      if (req.query.topic === "payment" && req.query.id) {
        paymentId = String(req.query.id);
      } else if (req.body && req.body.type === "payment" && req.body.data?.id) {
        paymentId = String(req.body.data.id);
      } else if (req.body && req.body.data?.id && (req.body.action || "").includes("payment")) {
        paymentId = String(req.body.data.id);
      }

      if (!paymentId) {
        // No es un evento de pago, ack y seguir.
        return res.status(200).send("ignored");
      }

      // Lookup del payment en MP API.
      const payment = await fetchMpPayment(paymentId);
      if (!payment) {
        return res.status(200).send("payment not fetched");
      }

      const externalRef = payment.external_reference;  // = public_id de la orden
      if (!externalRef) {
        console.warn("[mp webhook] payment sin external_reference", paymentId);
        return res.status(200).send("no external_reference");
      }

      // Decidir status: approved → paid; rejected/cancelled → failed; otherwise leave as pending_payment.
      let newStatus = null;
      if (payment.status === "approved") newStatus = "paid";
      else if (payment.status === "rejected" || payment.status === "cancelled") newStatus = "failed";

      const updateCols = [
        "mp_payment_id = $1",
        "mp_status_raw = $2",
        "updated_at = NOW()",
      ];
      const updateParams = [String(paymentId), String(payment.status)];

      if (newStatus === "paid") {
        updateCols.push("status = 'paid'", "paid_at = NOW()");
      } else if (newStatus === "failed") {
        updateCols.push("status = 'failed'");
      }

      updateParams.push(externalRef);
      await db.query(
        `UPDATE orders SET ${updateCols.join(", ")} WHERE public_id = $${updateParams.length}`,
        updateParams
      );

      return res.status(200).send("ok");
    } catch (e) {
      console.error("[mp webhook]", e);
      // Importante devolver 200 igualmente — MP reintenta si no recibe ack
      // y no queremos loop infinito sobre un error nuestro.
      return res.status(200).send("error logged");
    }
  });

  return router;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin router — auth + role admin/operator
// ─────────────────────────────────────────────────────────────────────────────

function adminRouter({ authRequired, requireRole }) {
  const router = express.Router();
  const writeMw = [authRequired, requireRole(["admin"])];
  const readMw  = [authRequired, requireRole(["admin", "operator"])];

  // GET /api/admin/shop/orders?status=&limit=&offset=
  router.get("/orders", ...readMw, async (req, res) => {
    try {
      const { status, search, limit, offset } = req.query;
      const params = [];
      const where = [];
      if (status) {
        params.push(String(status));
        where.push(`status = $${params.length}`);
      }
      if (search) {
        params.push(`%${String(search).toLowerCase()}%`);
        const i = params.length;
        where.push(`(LOWER(customer_email) LIKE $${i} OR LOWER(customer_first_name) LIKE $${i} OR LOWER(public_id) LIKE $${i})`);
      }
      const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
      const off = Math.max(0, parseInt(offset, 10) || 0);
      params.push(lim, off);

      const sql = `
        SELECT * FROM orders
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;
      const { rows } = await db.query(sql, params);

      // Count por status (para los tabs/badges del UI)
      const { rows: countsRows } = await db.query(
        `SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status`
      );
      const counts = Object.fromEntries(countsRows.map((r) => [r.status, r.n]));

      res.json({
        orders: rows.map((r) => serializeOrder(r, [])),
        counts,
      });
    } catch (e) {
      console.error("[admin orders list]", e);
      res.status(500).json({ error: "Error al listar órdenes" });
    }
  });

  // GET /api/admin/shop/orders/:id — detalle completo
  router.get("/orders/:id", ...readMw, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: "ID inválido" });
      const data = await loadOrderById(id);
      if (!data) return res.status(404).json({ error: "Orden no encontrada" });
      res.json({ order: serializeOrder(data.order, data.items) });
    } catch (e) {
      console.error("[admin order detail]", e);
      res.status(500).json({ error: "Error al obtener la orden" });
    }
  });

  // POST /api/admin/shop/orders/:id/status — cambiar estado lifecycle.
  // Estados aceptados: pending_payment, paid, dispatched, completed, cancelled, failed
  // Transitions permitidas: cualquiera → cualquiera (admin puede corregir
  // errores). Cada cambio actualiza el timestamp correspondiente.
  router.post("/orders/:id/status", ...writeMw, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: "ID inválido" });
      const body = z.object({
        status: z.enum(["pending_payment", "paid", "dispatched", "completed", "cancelled", "failed"]),
        admin_notes: z.string().max(2000).optional().nullable(),
      }).parse(req.body);

      const sets = ["status = $1", "updated_at = NOW()"];
      const params = [body.status];
      if (body.status === "paid")        sets.push("paid_at = COALESCE(paid_at, NOW())");
      if (body.status === "dispatched")  sets.push("dispatched_at = COALESCE(dispatched_at, NOW())");
      if (body.status === "completed")   sets.push("completed_at = COALESCE(completed_at, NOW())");
      if (body.admin_notes !== undefined) {
        params.push(body.admin_notes);
        sets.push(`admin_notes = $${params.length}`);
      }
      params.push(id);
      const { rows } = await db.query(
        `UPDATE orders SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Orden no encontrada" });
      const data = await loadOrderById(id);
      res.json({ order: serializeOrder(data.order, data.items) });
    } catch (e) {
      if (e.issues) return res.status(400).json({ error: "Status inválido", issues: e.issues });
      console.error("[admin order status]", e);
      res.status(500).json({ error: "Error al cambiar estado" });
    }
  });

  return router;
}

module.exports = { publicRouter, webhookRouter, adminRouter };
