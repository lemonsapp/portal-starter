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
const multer = require("multer");
const { z } = require("zod");
const db = require("../db");
const cs = require("../lib/configStore");
const shopNotify = require("../lib/shopNotify");
const { configureCloudinary } = require("../lib/cloudinaryConfig");
const { uploadLimiter } = require("../security");
const { authOptional } = require("../auth");
const rateLimit = require("express-rate-limit");

// Limita el sondeo de códigos promo (validate-code es público): 20/min por IP.
const codeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, reason: "rate_limited" },
});

// Comprobantes de transferencia: el comprador sube una foto/captura desde la
// success page. Allow-list explícita de formatos raster — nada de SVG (puede
// embeber <script> y el admin lo abre en el navegador). 10MB alcanza de sobra
// (una captura de home banking pesa <1MB).
const MAX_RECEIPT_MB = 10;
const RECEIPT_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (RECEIPT_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error("Formato no soportado — subí una foto o captura (JPG/PNG/WebP/HEIC)"));
  },
});

// Extrae el public_id de una URL de Cloudinary para poder borrar el asset
// viejo cuando el comprador reemplaza el comprobante (evita huérfanos).
// Ej: https://res.cloudinary.com/x/image/upload/v123/portal-receipts/abc.png
//     → portal-receipts/abc
function cloudinaryPublicId(url) {
  const m = /\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url || "");
  return m ? m[1] : null;
}

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

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────────────────────────
// Promo codes — helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida un código contra subtotal_cents y devuelve descuento aplicable.
 * Returns:
 *   { ok: true,  promo: row, discount_cents }
 *   { ok: false, reason: "not_found" | "inactive" | "expired" | "max_uses" | "min_subtotal" }
 *
 * NO incrementa current_uses — eso lo hace finalizeCheckoutCode al checkout.
 */
async function validatePromoCode(code, subtotalCents) {
  if (!code || typeof code !== "string") return { ok: false, reason: "not_found" };
  const { rows } = await db.query(
    `SELECT * FROM promo_codes WHERE UPPER(code) = UPPER($1) LIMIT 1`,
    [code.trim()]
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (!row.active) return { ok: false, reason: "inactive" };
  if (row.expires_at && new Date(row.expires_at) < new Date()) return { ok: false, reason: "expired" };
  if (row.max_uses != null && row.current_uses >= row.max_uses) return { ok: false, reason: "max_uses" };
  if (subtotalCents < row.min_subtotal_cents) {
    return { ok: false, reason: "min_subtotal", min_subtotal_cents: row.min_subtotal_cents };
  }
  const discount = row.kind === "percent"
    ? Math.floor((subtotalCents * row.value) / 100)
    : Math.min(row.value, subtotalCents);  // fixed cents — capped al subtotal
  return { ok: true, promo: row, discount_cents: discount };
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
    payment_method: order.payment_method || "mercadopago",
    transfer_receipt_url: order.transfer_receipt_url || null,
    paid_at: order.paid_at,
    dispatched_at: order.dispatched_at,
    completed_at: order.completed_at,
    carrier: order.carrier || null,
    carrier_label: order.carrier ? shopNotify.carrierLabel(order.carrier) : null,
    tracking_number: order.tracking_number || null,
    tracking_url: shopNotify.trackingUrl(order.carrier, order.tracking_number),
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

  // El webhook tiene que pegarle a la API (Render), no al sitio (Vercel):
  // el dominio público no tiene rewrite /api/* → Render, así que un
  // notification_url con appUrl daría 404 y las órdenes quedarían
  // pending_payment para siempre.
  const apiUrl = getApiPublicUrl() || appUrl;
  if (!getApiPublicUrl()) {
    console.warn("[checkout] Sin API_PUBLIC_URL ni RENDER_EXTERNAL_URL — notification_url cae a APP_URL; si el sitio no proxya /api, el webhook de MP no va a llegar");
  }
  const notificationUrl = webhookSecret
    ? `${apiUrl}/api/webhooks/mercadopago?secret=${encodeURIComponent(webhookSecret)}`
    : `${apiUrl}/api/webhooks/mercadopago`;

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

// Datos bancarios para transferencia, normalizados: whitespace-only = no
// configurado (la opción no se ofrece en el checkout).
async function getTransferDetails() {
  const raw = await cs.getConfig("shop.transfer_details");
  const trimmed = String(raw || "").trim();
  return trimmed || null;
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

// Base pública de la API (para notification_url del webhook MP).
// API_PUBLIC_URL manda si está seteada; RENDER_EXTERNAL_URL la setea Render
// automáticamente (https://<servicio>.onrender.com). Si no hay ninguna
// (dev local), el caller cae a appUrl.
function getApiPublicUrl() {
  const url = process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  return url ? url.replace(/\/$/, "") : null;
}

// Determina la base URL del deploy para back_urls (success/failure del
// checkout — páginas del SITIO, no de la API).
// Prioridad: APP_URL del env → header `origin` del request → fallback localhost.
function getAppUrl(req) {
  // Sólo confiamos en el env configurado del deploy. NO derivamos la base de
  // headers del request (Origin/Referer): son controlables por el atacante y se
  // usan para back_urls y como fallback del notification_url de MercadoPago —
  // confiar en ellos permitiría redirect a phishing y fuga del secret del webhook.
  const fromEnv = process.env.APP_URL || process.env.PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  console.warn("[checkout] APP_URL/PUBLIC_APP_URL no seteado — usando fallback localhost. Seteá APP_URL en prod.");
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
    // Tope alto para soportar "puntos a medida" (1 punto = 1 unidad). El handler
    // re-acota a 99 los productos que NO son packs de puntos.
    quantity: z.number().int().positive().max(2000),
    // Kit vendido como pack por medida (ej "500ml"): el precio NO se toma del
    // request — el server lo resuelve desde meta.precio_por_medida del kit.
    kit_formato: z.string().trim().min(1).max(20).optional(),
  })).min(1).max(40),
  // F5: código de promoción opcional
  promo_code: z.string().trim().max(40).optional().nullable(),
  // Transferencia bancaria: la orden queda pending_payment, el comprador ve
  // los datos bancarios y sube el comprobante; el admin aprueba a mano.
  // Monedas: saldo comprado en la tienda (packs) — requiere sesión; la orden
  // nace paid con el débito atómico del saldo.
  payment_method: z.enum(["mercadopago", "transfer", "monedas"]).optional().default("mercadopago"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Public router — sin auth (guest checkout)
// ─────────────────────────────────────────────────────────────────────────────

function publicRouter({ authRequired } = {}) {
  const router = express.Router();

  // Auth condicional: sólo el pago con monedas exige sesión (hay que saber de
  // qué cuenta debitar). El resto del checkout sigue siendo guest, pero si el
  // comprador tiene sesión la linkeamos igual (authOptional → orders.user_id):
  // así la acreditación de puntos/monedas no depende de que el email tipeado
  // coincida con el de la cuenta.
  const authIfMonedas = (req, res, next) => {
    if (req.body?.payment_method === "monedas") return authRequired(req, res, next);
    return authOptional(req, res, next);
  };

  // POST /api/shop/checkout
  router.post("/checkout", authIfMonedas, async (req, res) => {
    let body;
    try { body = checkoutSchema.parse(req.body); }
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.issues }); }

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
        // Solo los packs de puntos admiten cantidades grandes (1 unidad = 1 punto).
        // El resto de los productos sigue acotado a 99 por línea.
        const isPointsPack = !!(p.meta && (p.meta.points_pack || p.meta.points_custom));
        if (!isPointsPack && reqItem.quantity > 99) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: `Cantidad máxima por producto: 99 (${p.name})` });
        }
        // Stock: descuento atómico con guard. Antes sólo se comparaba y nunca se
        // decrementaba (oversell + chequeo obsoleto). Ahora el UPDATE toma lock de
        // la fila y falla si no alcanza, evitando venta concurrente por encima del
        // stock. stock=null = producto sin control de stock (packs de puntos, etc.).
        if (p.stock != null) {
          const dec = await client.query(
            `UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING stock`,
            [reqItem.quantity, p.id]
          );
          if (!dec.rows[0]) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: `Sin stock suficiente de "${p.name}". Disponible: ${p.stock}` });
          }
        }

        // Precio y nombre por defecto = los del producto. Si es una línea de
        // "kit por medida", el precio se resuelve server-side desde el kit
        // (nunca desde el request) para que no se pueda manipular el monto.
        let unitPriceCents = p.price_cents;
        let nameSnapshot = p.name;
        if (reqItem.kit_formato) {
          const priceMap = (p.meta && typeof p.meta.precio_por_medida === "object" && p.meta.precio_por_medida) || {};
          const raw = priceMap[reqItem.kit_formato];
          const cents = typeof raw === "number" ? raw : parseInt(raw, 10);
          if (!p.meta?.bundle || !Number.isFinite(cents) || cents <= 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: `El pack "${p.name}" no está disponible en la medida ${reqItem.kit_formato}` });
          }
          unitPriceCents = Math.round(cents);
          nameSnapshot = `${p.name} · ${reqItem.kit_formato}`;
        }

        const lineTotal = unitPriceCents * reqItem.quantity;
        subtotalCents += lineTotal;
        lineItems.push({
          product_id: p.id,
          product_slug: p.slug,
          name_snapshot: nameSnapshot,
          price_cents_snapshot: unitPriceCents,
          quantity: reqItem.quantity,
          line_total_cents: lineTotal,
          image_url_snapshot: p.primary_image || null,
        });
      }

      // F5: validar + aplicar promo_code si vino
      let discountCents = 0;
      let appliedPromoCode = null;
      if (body.promo_code) {
        const promoResult = await validatePromoCode(body.promo_code, subtotalCents);
        if (!promoResult.ok) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: `Código promocional inválido: ${promoResult.reason}`,
            promo_invalid: true,
          });
        }
        discountCents = promoResult.discount_cents;
        appliedPromoCode = promoResult.promo.code;
      }

      // Envío: costo fijo de config, con dos excepciones (2026-07-14):
      //  • Carrito 100% digital (sólo packs de monedas): no hay nada que
      //    despachar, no corresponde cobrar envío.
      //  • Código que cubre todo el subtotal (comp/giveaway 100% off): la
      //    orden es una cortesía — cobrar sólo el envío dejaría un pago
      //    residual en MP y rompería la auto-aprobación (total=0 → paid).
      const cartAllPacks = lineItems.every((li) => {
        const meta = productMap.get(li.product_id)?.meta;
        return !!(meta && (meta.points_pack || meta.points_custom));
      });
      const isFullComp = subtotalCents > 0 && discountCents >= subtotalCents;
      const shippingCents = (cartAllPacks || isFullComp)
        ? 0
        : (parseInt(await cs.getConfig("shop.shipping_cost_cents"), 10) || 0);

      const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);

      // ── Pago con monedas (2026-07-14) ─────────────────────────────────────
      // 1 moneda vale peso_per_point ($4.000) al pagar; se compra a buy_price
      // ($3.600) vía packs — mismo spread 10% del sistema v9. El débito es
      // atómico dentro de la transacción, después de crear la orden.
      const isMonedasOrder = body.payment_method === "monedas" && totalCents > 0;
      let costMonedas = 0;
      if (isMonedasOrder) {
        // Los packs de monedas no se pueden pagar con monedas: comprarlas a
        // $3.600 y gastarlas a $4.000 imprimiría saldo infinito (9 → 10).
        const hasPack = lineItems.some((li) => {
          const meta = productMap.get(li.product_id)?.meta;
          return !!(meta && (meta.points_pack || meta.points_custom));
        });
        if (hasPack) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Los packs de monedas no se pueden pagar con monedas" });
        }
        let pesoPerPoint = 4000;
        try {
          const cfg = await client.query(`SELECT value FROM point_config WHERE key='peso_per_point'`);
          const v = parseInt(cfg.rows[0]?.value, 10);
          if (Number.isFinite(v) && v > 0) pesoPerPoint = v;
        } catch (_) {}
        costMonedas = Math.ceil(totalCents / (pesoPerPoint * 100));
      }

      // F5+: si el descuento cubre el 100% (total=0), la orden se marca
      // directamente como pagada — no hay nada que cobrar via MP.
      // Caso de uso: códigos 100% off (giveaways, comp tester, etc.)
      const isFreeOrder = totalCents === 0;
      const initialStatus = (isFreeOrder || isMonedasOrder) ? "paid" : "pending_payment";

      // 2. Crear orden con public_id único.
      let publicId;
      let inserted;
      for (let attempt = 0; attempt < 5; attempt++) {
        publicId = generatePublicId();
        try {
          const { rows } = await client.query(
            `INSERT INTO orders
               (public_id, status, customer_email, customer_first_name, customer_last_name,
                customer_phone, shipping_address, subtotal_cents, shipping_cents, total_cents,
                promo_code, discount_cents, payment_method, user_id,
                paid_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                     CASE WHEN $2 = 'paid' THEN NOW() ELSE NULL END)
             RETURNING *`,
            [publicId, initialStatus,
             body.customer.email,
             body.customer.first_name,
             body.customer.last_name,
             body.customer.phone,
             JSON.stringify(body.shipping_address),
             subtotalCents, shippingCents, totalCents,
             appliedPromoCode, discountCents,
             body.payment_method,
             req.user?.id || null]
          );
          inserted = rows[0];
          break;
        } catch (e) {
          if (e.code === "23505") continue;  // collision, retry
          throw e;
        }
      }
      if (!inserted) throw new Error("No se pudo generar public_id único");

      // F5: incrementar current_uses del código, atómico y con re-chequeo de
      // max_uses/expiración DENTRO de la transacción. Esto cierra la race donde
      // N requests concurrentes con el mismo código (ej: 100% off de un solo uso)
      // pasan todas la validación previa: el UPDATE toma lock de la fila y sólo
      // una gana; las demás no matchean y revierten la orden entera.
      if (appliedPromoCode) {
        const upd = await client.query(
          `UPDATE promo_codes SET current_uses = current_uses + 1, updated_at = NOW()
            WHERE UPPER(code) = UPPER($1) AND active
              AND (expires_at IS NULL OR expires_at > NOW())
              AND (max_uses IS NULL OR current_uses < max_uses)
            RETURNING current_uses`,
          [appliedPromoCode]
        );
        if (!upd.rows[0]) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "El código promocional ya no está disponible.",
            promo_invalid: true,
          });
        }
      }

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

      // 3b. Pago con monedas: débito atómico del saldo — si no alcanza, el
      //     UPDATE no matchea y la orden entera se revierte (ROLLBACK).
      if (isMonedasOrder) {
        const deb = await client.query(
          `UPDATE coins SET monedas_balance = monedas_balance - $1, updated_at = NOW()
           WHERE user_id = $2 AND monedas_balance >= $1
           RETURNING monedas_balance`,
          [costMonedas, req.user.id]
        );
        if (!deb.rows[0]) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: `Monedas insuficientes: este pedido cuesta ${costMonedas} monedas. Comprá más en la tienda.`,
            monedas_needed: costMonedas,
          });
        }
        await client.query(
          `INSERT INTO coin_transactions (user_id, type, amount, reason, canal, operador, currency, amount_cents)
           VALUES ($1, 'pago_pedido', $2, $3, 'web', 'sistema', 'monedas', $4)`,
          [req.user.id, -costMonedas, `Pago con monedas · ${inserted.public_id}`, totalCents]
        );
      }

      await client.query("COMMIT");

      // 4. Capture customer (UPSERT) — para marketing F4. Acumula
      //    orders_count + total_spent + actualiza last_address.
      await shopNotify.upsertCustomer({
        email: body.customer.email,
        first_name: body.customer.first_name,
        last_name: body.customer.last_name,
        phone: body.customer.phone,
        address: body.shipping_address,
        totalCents: totalCents,
      });

      // 5. Notificaciones: email al cliente + email al admin + broadcast
      //    in-app target=admin. Non-blocking, fail-silent si Resend no
      //    está configurado.
      shopNotify.onOrderCreated(inserted, lineItems).catch(() => {});

      // 5b. Free order (100% off): la orden ya está marcada paid
      //     directamente al INSERT (sin pasar por MP). Disparar el flow
      //     de "pago confirmado" — email + broadcast — y devolver al
      //     frontend que vaya directo al success page.
      if (isFreeOrder) {
        shopNotify.onOrderPaid(inserted, lineItems).catch(() => {});
        return res.json({
          public_id: inserted.public_id,
          init_point: null,
          free: true,           // flag → frontend redirige a success directo
          total_cents: 0,
        });
      }

      // 5c'. Pago con monedas: la orden ya nació paid y el saldo se debitó en
      //      la transacción. Disparar flow de pago confirmado (acredita los
      //      puntos que la compra GANA + emails) y mandar al success directo.
      if (isMonedasOrder) {
        shopNotify.onOrderPaid(inserted, lineItems).catch(() => {});
        return res.json({
          public_id: inserted.public_id,
          init_point: null,
          monedas: true,
          monedas_spent: costMonedas,
          total_cents: totalCents,
        });
      }

      // 5c. Transferencia bancaria: no hay preferencia MP. La orden queda
      //     pending_payment; el frontend muestra los datos bancarios y la
      //     success page permite subir el comprobante para que el admin
      //     apruebe con "Marcar pagado".
      if (body.payment_method === "transfer") {
        const transferDetails = await getTransferDetails();
        return res.json({
          public_id: inserted.public_id,
          init_point: null,
          transfer: true,
          transfer_details: transferDetails || null,
          total_cents: totalCents,
        });
      }

      // 6. Crear preference en MercadoPago (con graceful fallback).
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

  // ── GET /api/shop/unsubscribe?token=XXX — público (link en footer emails)
  // Aplica opt-out + página HTML de confirmación. Token validado con HMAC
  // del MASTER_KEY — no requiere DB lookup para verificar autenticidad.
  router.get("/unsubscribe", async (req, res) => {
    const token = String(req.query.token || "");
    const result = await shopNotify.applyUnsubscribe(token);

    const page = (title, msg, color = "#A7F5C8") => `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Holistic</title>
<style>
body{margin:0;padding:40px 20px;background:#0a0a0a;color:#ede9e0;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:grid;place-items:center;}
.card{max-width:520px;width:100%;background:rgba(255,255,255,.03);border:1px solid ${color}33;border-radius:18px;padding:40px 32px;text-align:center;box-shadow:0 0 80px ${color}11;}
.icon{font-size:48px;margin-bottom:14px;}
h1{margin:0 0 12px;font-size:24px;font-weight:900;letter-spacing:-.01em;text-transform:uppercase;}
p{margin:0 0 18px;color:rgba(237,233,224,.78);font-size:15px;line-height:1.55;}
.eyebrow{font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:${color};margin-bottom:10px;}
a{color:${color};text-decoration:underline dotted;}
.cta{display:inline-block;margin-top:14px;padding:12px 22px;border-radius:999px;background:linear-gradient(135deg,#25D366 0%,#2E8F6E 100%);color:#fff;text-decoration:none;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;}
</style></head>
<body><div class="card">
  <div class="eyebrow">· Holistic ·</div>
  <div class="icon">${result.ok ? "👋" : "⚠️"}</div>
  <h1>${title}</h1>
  ${msg}
  <a class="cta" href="/shop">Volver al catálogo</a>
</div></body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (result.ok) {
      res.send(page(
        "Te diste de baja",
        `<p>Dejamos de mandar emails de marketing a <strong>${esc(result.email)}</strong>.<br>Vas a seguir recibiendo solo confirmaciones de pedidos.</p>
         <p style="font-size:13px;color:rgba(237,233,224,.5);">Si fue por error, escribinos por WhatsApp y te volvemos a suscribir.</p>`,
        "#A7F5C8"
      ));
    } else {
      res.status(400).send(page(
        "Link inválido",
        `<p>El link de baja no es válido o ya fue usado. Si seguís recibiendo emails que no querés, escribinos por WhatsApp.</p>`,
        "#fca5a5"
      ));
    }
  });

  // ── POST /api/shop/checkout/validate-code — preview de descuento
  // Permite al cliente probar un código antes de finalizar checkout.
  // Body: { code: "TEST10", subtotal_cents: 1000000 }
  router.post("/checkout/validate-code", codeLimiter, async (req, res) => {
    const { code, subtotal_cents } = req.body || {};
    const subtotal = parseInt(subtotal_cents, 10) || 0;
    const result = await validatePromoCode(code, subtotal);
    if (!result.ok) {
      const messages = {
        not_found: "Código no válido",
        inactive: "Código desactivado",
        expired: "Código expirado",
        max_uses: "Código agotado",
        min_subtotal: `Compra mínima de ${formatARS(result.min_subtotal_cents)} para usar este código`,
      };
      return res.status(400).json({
        ok: false,
        error: messages[result.reason] || "Código inválido",
      });
    }
    res.json({
      ok: true,
      code: result.promo.code,
      kind: result.promo.kind,
      value: result.promo.value,
      discount_cents: result.discount_cents,
      discount_formatted: formatARS(result.discount_cents),
      new_total_cents: subtotal - result.discount_cents,
      new_total_formatted: formatARS(subtotal - result.discount_cents),
    });
  });

  // GET /api/shop/payment-methods — público. Le dice al checkout qué opciones
  // ofrecer: MP si hay access_token cargado, transferencia si hay datos
  // bancarios en shop.transfer_details (los datos son públicos por diseño:
  // el comprador los necesita para transferir).
  router.get("/payment-methods", async (_req, res) => {
    try {
      const mpToken = await cs.getConfig("mercadopago.access_token");
      const transferDetails = await getTransferDetails();
      res.json({
        mercadopago: !!mpToken,
        transfer: !!transferDetails,
        transfer_details: transferDetails || null,
      });
    } catch (e) {
      console.error("[checkout payment-methods]", e);
      res.status(500).json({ error: "Error al consultar métodos de pago" });
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
      // Orden por transferencia pendiente: adjuntar los datos bancarios para
      // que la success page pueda re-mostrarlos (refresh, link del email).
      if (safe.payment_method === "transfer" && safe.status === "pending_payment") {
        safe.transfer_details = await getTransferDetails();
      }
      res.json({ order: safe });
    } catch (e) {
      console.error("[checkout get order]", e);
      res.status(500).json({ error: "Error al consultar la orden" });
    }
  });

  // POST /api/shop/orders/:public_id/receipt — el comprador sube el comprobante
  // de la transferencia (imagen, multipart campo `receipt`). Público: la llave
  // es el public_id (no adivinable). Solo órdenes por transferencia pendientes;
  // re-subir reemplaza el comprobante (caso "me equivoqué de captura").
  router.post(
    "/orders/:public_id/receipt",
    uploadLimiter,
    (req, res, next) => {
      uploadReceipt.single("receipt")(req, res, (err) => {
        if (err) {
          const msg = err.code === "LIMIT_FILE_SIZE"
            ? `La imagen supera el límite de ${MAX_RECEIPT_MB}MB. Probá con una captura más liviana.`
            : err.message;
          return res.status(400).json({ error: msg });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        const pid = String(req.params.public_id || "");
        if (!req.file) return res.status(400).json({ error: "No se recibió el comprobante" });
        const { rows } = await db.query(`SELECT * FROM orders WHERE public_id = $1`, [pid]);
        const order = rows[0];
        if (!order) return res.status(404).json({ error: "Orden no encontrada" });
        if (order.payment_method !== "transfer" || order.status !== "pending_payment") {
          return res.status(409).json({ error: "Esta orden no está esperando un comprobante" });
        }

        const cloudinary = await configureCloudinary();
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "portal-receipts", resource_type: "image" },
            (error, out) => { if (error) reject(error); else resolve(out); }
          );
          stream.end(req.file.buffer);
        });

        await db.query(
          `UPDATE orders SET transfer_receipt_url = $1, updated_at = NOW() WHERE id = $2`,
          [result.secure_url, order.id]
        );

        // Reemplazo: borrar el comprobante anterior de Cloudinary (best-effort,
        // fail-silent — un huérfano no es crítico pero suma costo de storage).
        if (order.transfer_receipt_url) {
          const oldId = cloudinaryPublicId(order.transfer_receipt_url);
          if (oldId && oldId !== cloudinaryPublicId(result.secure_url)) {
            cloudinary.uploader.destroy(oldId).catch(() => {});
          }
        }

        // Aviso in-app al admin para que revise y apruebe. Fail-silent.
        db.query(
          `INSERT INTO broadcast_notifications (message, emoji, type, active, target_role)
           VALUES ($1, '🏦', 'order', TRUE, 'admin')`,
          [`Comprobante de transferencia subido · ${order.public_id} · ${formatARS(order.total_cents)} — revisar y aprobar`]
        ).catch(() => {});

        const data = await loadOrderById(order.id);
        const safe = serializeOrder(data.order, data.items);
        delete safe.admin_notes;
        delete safe.mp_status_raw;
        res.json({ ok: true, order: safe });
      } catch (e) {
        console.error("[checkout receipt upload]", e);
        if (e.code === "CLOUDINARY_NOT_CONFIGURED") {
          return res.status(503).json({ error: "La subida de comprobantes no está disponible en este momento — mandanos el comprobante por WhatsApp y lo validamos igual." });
        }
        res.status(500).json({ error: "No se pudo subir el comprobante. Intentá de nuevo." });
      }
    }
  );

  // POST /api/shop/orders/:public_id/received — el cliente confirma que recibió
  // el pedido (despachado → entregado). Público: el public_id es la llave y sólo
  // permite avanzar dispatched → completed (idempotente, bajo riesgo).
  router.post("/orders/:public_id/received", async (req, res) => {
    try {
      const pid = String(req.params.public_id || "");
      const { rows } = await db.query(
        `UPDATE orders
            SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
          WHERE public_id = $1 AND status = 'dispatched'
          RETURNING id`,
        [pid]
      );
      const data = rows[0]
        ? await loadOrderById(rows[0].id)
        : await loadOrderByPublicId(pid);
      if (!data) return res.status(404).json({ error: "Orden no encontrada" });
      const safe = serializeOrder(data.order, data.items);
      delete safe.admin_notes;
      delete safe.mp_status_raw;
      res.json({ order: safe });
    } catch (e) {
      console.error("[checkout order received]", e);
      res.status(500).json({ error: "No se pudo confirmar la recepción" });
    }
  });

  // GET /api/shop/my-orders — pedidos del usuario logueado (seguimiento).
  // El checkout es "guest" (sin user_id), así que matcheamos por el email de
  // la cuenta. Devuelve la lista con estado + tracking para el panel del cliente.
  if (authRequired) {
    router.get("/my-orders", authRequired, async (req, res) => {
      try {
        const u = await db.query("SELECT email FROM users WHERE id = $1", [req.user.id]);
        const email = u.rows[0]?.email;
        if (!email) return res.json({ orders: [], email: null });
        const { rows } = await db.query(
          `SELECT o.*,
                  (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count
             FROM orders o
            WHERE LOWER(o.customer_email) = LOWER($1)
            ORDER BY o.created_at DESC
            LIMIT 50`,
          [email]
        );
        const orders = rows.map((o) => {
          const s = serializeOrder(o, []);
          delete s.admin_notes;
          delete s.mp_status_raw;
          delete s.mp_payment_id;
          s.item_count = o.item_count;
          return s;
        });
        res.json({ orders, email });
      } catch (e) {
        console.error("[checkout my-orders]", e);
        res.status(500).json({ error: "Error al consultar tus pedidos" });
      }
    });
  }

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

      // Idempotencia: MP reintenta webhooks. Guardamos el estado previo para no
      // reprocesar (email/broadcast duplicados, paid_at pisado) una orden ya pagada.
      const prevQ = await db.query(`SELECT status FROM orders WHERE public_id = $1`, [externalRef]);
      const prevStatus = prevQ.rows[0]?.status;

      if (newStatus === "paid") {
        updateCols.push("status = 'paid'", "paid_at = COALESCE(paid_at, NOW())");
      } else if (newStatus === "failed") {
        updateCols.push("status = 'failed'");
      }

      updateParams.push(externalRef);
      await db.query(
        `UPDATE orders SET ${updateCols.join(", ")} WHERE public_id = $${updateParams.length}`,
        updateParams
      );

      // F3: sólo al TRANSICIONAR a 'paid' (no en cada reintento) disparamos el
      //     email de confirmación al cliente + broadcast admin "pago confirmado".
      if (newStatus === "paid" && prevStatus !== "paid") {
        const data = await loadOrderByPublicId(externalRef);
        if (data) {
          shopNotify.onOrderPaid(data.order, data.items).catch(() => {});
        }
      }

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
        carrier: z.enum(["andreani", "correo_argentino", "via_cargo", "propio"]).optional().nullable(),
        tracking_number: z.string().max(120).optional().nullable(),
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
      // Tracking de envío — el admin elige carrier + nº al despachar.
      if (body.carrier !== undefined) {
        params.push(body.carrier);
        sets.push(`carrier = $${params.length}`);
      }
      if (body.tracking_number !== undefined) {
        params.push(body.tracking_number);
        sets.push(`tracking_number = $${params.length}`);
      }
      params.push(id);
      const prevStatusRes = await db.query(`SELECT status FROM orders WHERE id = $1`, [id]);
      const prevStatus = prevStatusRes.rows[0]?.status;

      const { rows } = await db.query(
        `UPDATE orders SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "Orden no encontrada" });
      const data = await loadOrderById(id);

      // F3 triggers per transición. Solo disparamos email si efectivamente
      // cambió a ese estado (no spam al hacer "save" sin cambio real).
      if (body.status !== prevStatus) {
        if (body.status === "paid") {
          shopNotify.onOrderPaid(data.order, data.items).catch(() => {});
        } else if (body.status === "dispatched") {
          shopNotify.onOrderDispatched(data.order, data.items).catch(() => {});
        } else if (body.status === "cancelled" || body.status === "failed") {
          // Orden pagada con monedas → devolver el saldo (idempotente).
          shopNotify.refundOrderMonedas(data.order).catch(() => {});
        }
      }

      res.json({ order: serializeOrder(data.order, data.items) });
    } catch (e) {
      if (e.issues) return res.status(400).json({ error: "Status inválido", issues: e.issues });
      console.error("[admin order status]", e);
      res.status(500).json({ error: "Error al cambiar estado" });
    }
  });

  // POST /api/admin/shop/test-email — envía un email de prueba y devuelve el
  // resultado REAL de Resend (para diagnosticar si el envío está configurado).
  router.post("/test-email", ...readMw, async (req, res) => {
    try {
      const to = String(req.body?.to || "").trim();
      if (!/^\S+@\S+\.\S+$/.test(to)) return res.status(400).json({ error: "Email inválido" });
      const result = await shopNotify.sendResendEmail({
        to,
        subject: "✅ Test de email del portal",
        html: `<div style="font-family:sans-serif;padding:24px;max-width:480px">
                 <h2 style="margin:0 0 8px">Funciona 🎉</h2>
                 <p style="color:#444;line-height:1.5">Si estás leyendo esto, el envío de emails desde el portal está configurado correctamente (Resend).</p>
               </div>`,
      });
      res.json({ result });
    } catch (e) {
      console.error("[test-email]", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/admin/shop/customers?search=&marketing=
  // Lista clientes con métricas acumuladas. Soporta filtro por
  // marketing_opt (TRUE = solo opt-in para campañas F4).
  router.get("/customers", ...readMw, async (req, res) => {
    try {
      const { search, marketing, limit, offset } = req.query;
      const params = [];
      const where = [];
      if (search) {
        params.push(`%${String(search).toLowerCase()}%`);
        const i = params.length;
        where.push(`(LOWER(email) LIKE $${i} OR LOWER(COALESCE(first_name,'')) LIKE $${i} OR LOWER(COALESCE(last_name,'')) LIKE $${i})`);
      }
      if (marketing === "1") where.push(`opted_in_marketing = TRUE`);
      if (marketing === "0") where.push(`opted_in_marketing = FALSE`);

      const lim = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
      const off = Math.max(0, parseInt(offset, 10) || 0);
      params.push(lim, off);

      const sql = `
        SELECT id, email, first_name, last_name, phone,
               last_address, orders_count, total_spent_cents,
               last_order_at, first_order_at,
               opted_in_marketing, unsubscribed_at,
               created_at
        FROM customers
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY last_order_at DESC NULLS LAST, id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;
      const { rows } = await db.query(sql, params);
      const total = await db.query(`SELECT COUNT(*)::int AS n FROM customers`);
      const marketingCount = await db.query(`SELECT COUNT(*)::int AS n FROM customers WHERE opted_in_marketing = TRUE`);
      res.json({
        customers: rows.map((r) => ({
          ...r,
          total_spent_formatted: r.total_spent_cents != null
            ? (r.total_spent_cents / 100).toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 })
            : "—",
        })),
        total: total.rows[0]?.n || 0,
        marketing_count: marketingCount.rows[0]?.n || 0,
      });
    } catch (e) {
      console.error("[admin customers list]", e);
      res.status(500).json({ error: "Error al listar clientes" });
    }
  });

  // ── GET /api/admin/shop/customers/export.csv — para campañas externas
  router.get("/customers/export.csv", ...readMw, async (req, res) => {
    try {
      const onlyMarketing = req.query.marketing === "1";
      const { rows } = await db.query(
        `SELECT email, first_name, last_name, phone, orders_count,
                total_spent_cents, last_order_at, opted_in_marketing
         FROM customers
         ${onlyMarketing ? `WHERE opted_in_marketing = TRUE` : ""}
         ORDER BY last_order_at DESC NULLS LAST`
      );
      // Escapa cada celda para CSV: comillas dobladas + wrap en comillas, y
      // prefija `'` si empieza con =/+/-/@ (o tab/CR) para neutralizar formula
      // injection al abrir el CSV en Excel/Sheets.
      const csvCell = (v) => {
        let s = v == null ? "" : String(v);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return `"${s.replace(/"/g, '""')}"`;
      };
      const header = "email,first_name,last_name,phone,orders_count,total_spent_ars,last_order_at,opted_in_marketing";
      const csv = [header, ...rows.map((r) => [
        r.email,
        r.first_name || "",
        r.last_name || "",
        r.phone || "",
        r.orders_count,
        (r.total_spent_cents || 0) / 100,
        r.last_order_at ? new Date(r.last_order_at).toISOString() : "",
        r.opted_in_marketing ? "yes" : "no",
      ].map(csvCell).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="holistic-customers-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (e) {
      console.error("[admin customers export]", e);
      res.status(500).json({ error: "Error al exportar" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // F5: PROMO CODES (admin CRUD)
  // ═════════════════════════════════════════════════════════════════════════

  const promoCodeSchema = z.object({
    code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/i, "código solo letras, números, _ y -")
      .transform((s) => s.toUpperCase()),
    kind: z.enum(["percent", "fixed_cents"]),
    value: z.number().int().positive(),
    min_subtotal_cents: z.number().int().min(0).optional().nullable(),
    max_uses: z.number().int().positive().optional().nullable(),
    expires_at: z.string().datetime().optional().nullable(),
    active: z.boolean().optional(),
    notes: z.string().max(500).optional().nullable(),
  });

  router.get("/promo-codes", ...readMw, async (_req, res) => {
    try {
      const { rows } = await db.query(`SELECT * FROM promo_codes ORDER BY created_at DESC`);
      res.json({
        promo_codes: rows.map((r) => ({
          ...r,
          discount_display: r.kind === "percent" ? `${r.value}%` : formatARS(r.value),
          uses_display: r.max_uses != null ? `${r.current_uses}/${r.max_uses}` : `${r.current_uses}`,
        })),
      });
    } catch (e) {
      console.error("[admin promo-codes list]", e);
      res.status(500).json({ error: "Error al listar códigos" });
    }
  });

  router.post("/promo-codes", ...writeMw, async (req, res) => {
    let body;
    try { body = promoCodeSchema.parse(req.body); }
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.issues }); }

    // Validar value según kind
    if (body.kind === "percent" && (body.value < 1 || body.value > 100)) {
      return res.status(400).json({ error: "Porcentaje debe estar entre 1 y 100" });
    }
    try {
      const { rows } = await db.query(
        `INSERT INTO promo_codes
           (code, kind, value, min_subtotal_cents, max_uses, expires_at, active, notes, created_by)
         VALUES ($1, $2, $3, COALESCE($4, 0), $5, $6, COALESCE($7, TRUE), $8, $9)
         RETURNING *`,
        [body.code, body.kind, body.value,
         body.min_subtotal_cents, body.max_uses, body.expires_at,
         body.active, body.notes, req.user?.id || null]
      );
      res.status(201).json({ promo_code: rows[0] });
    } catch (e) {
      console.error("[admin promo-codes create]", e);
      if (e.code === "23505") return res.status(409).json({ error: "Código duplicado" });
      res.status(500).json({ error: "Error al crear código" });
    }
  });

  router.put("/promo-codes/:id", ...writeMw, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    let body;
    try { body = promoCodeSchema.partial().parse(req.body); }
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.issues }); }

    const sets = ["updated_at = NOW()"];
    const params = [];
    for (const k of ["code", "kind", "value", "min_subtotal_cents", "max_uses", "expires_at", "active", "notes"]) {
      if (body[k] !== undefined) {
        params.push(body[k]);
        sets.push(`${k} = $${params.length}`);
      }
    }
    params.push(id);
    try {
      const { rows } = await db.query(
        `UPDATE promo_codes SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
      res.json({ promo_code: rows[0] });
    } catch (e) {
      console.error("[admin promo-codes update]", e);
      if (e.code === "23505") return res.status(409).json({ error: "Código duplicado" });
      res.status(500).json({ error: "Error al actualizar" });
    }
  });

  router.delete("/promo-codes/:id", ...writeMw, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
      const r = await db.query(`DELETE FROM promo_codes WHERE id = $1`, [id]);
      if (r.rowCount === 0) return res.status(404).json({ error: "No encontrado" });
      res.json({ ok: true });
    } catch (e) {
      console.error("[admin promo-codes delete]", e);
      res.status(500).json({ error: "Error al borrar" });
    }
  });

  // ── POST /api/admin/shop/customers/:id/marketing — toggle opt-in
  router.post("/customers/:id/marketing", ...writeMw, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const optIn = req.body?.opted_in === true;
      const { rows } = await db.query(
        `UPDATE customers
         SET opted_in_marketing = $1,
             unsubscribed_at = CASE WHEN $1 = TRUE THEN NULL ELSE COALESCE(unsubscribed_at, NOW()) END,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, opted_in_marketing, unsubscribed_at`,
        [optIn, id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Cliente no encontrado" });
      res.json({ customer: rows[0] });
    } catch (e) {
      console.error("[admin customer marketing]", e);
      res.status(500).json({ error: "Error al actualizar" });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  // F4: EMAIL CAMPAIGNS (admin)
  // ═════════════════════════════════════════════════════════════════════════

  const campaignSchema = z.object({
    name: z.string().trim().min(1).max(200),
    subject: z.string().trim().min(1).max(300),
    body_html: z.string().min(1),
    body_text: z.string().optional().nullable(),
    preheader: z.string().max(200).optional().nullable(),
    template_kind: z.enum(["promo", "anuncio", "newsletter", "custom"]).optional(),
    segment: z.enum(["all", "opt_in"]).optional(),
  });

  // ── GET /api/admin/shop/campaigns — listar
  router.get("/campaigns", ...readMw, async (_req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT id, name, subject, template_kind, segment, status,
                total_count, sent_count, failed_count,
                started_at, finished_at, created_at, updated_at
         FROM email_campaigns
         ORDER BY created_at DESC
         LIMIT 100`
      );
      // Conteos de cada segmento para preview en el form
      const optInRes = await db.query(`SELECT COUNT(*)::int AS n FROM customers WHERE opted_in_marketing = TRUE`);
      const allRes = await db.query(`SELECT COUNT(*)::int AS n FROM customers`);
      res.json({
        campaigns: rows,
        segments: {
          opt_in: optInRes.rows[0]?.n || 0,
          all: allRes.rows[0]?.n || 0,
        },
      });
    } catch (e) {
      console.error("[admin campaigns list]", e);
      res.status(500).json({ error: "Error al listar campañas" });
    }
  });

  // ── GET /api/admin/shop/campaigns/:id — detalle + últimos sends
  router.get("/campaigns/:id", ...readMw, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { rows } = await db.query(`SELECT * FROM email_campaigns WHERE id=$1`, [id]);
      if (!rows[0]) return res.status(404).json({ error: "Campaña no encontrada" });
      const { rows: sends } = await db.query(
        `SELECT id, email_snapshot, status, sent_at, error_message
         FROM email_sends WHERE campaign_id=$1
         ORDER BY id DESC LIMIT 200`,
        [id]
      );
      res.json({ campaign: rows[0], sends });
    } catch (e) {
      console.error("[admin campaign detail]", e);
      res.status(500).json({ error: "Error al obtener campaña" });
    }
  });

  // ── POST /api/admin/shop/campaigns — crear draft
  router.post("/campaigns", ...writeMw, async (req, res) => {
    let body;
    try { body = campaignSchema.parse(req.body); }
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.issues }); }
    try {
      const { rows } = await db.query(
        `INSERT INTO email_campaigns
           (name, subject, body_html, body_text, preheader,
            template_kind, segment, status, created_by)
         VALUES ($1, $2, $3, $4, $5,
                 COALESCE($6, 'custom'), COALESCE($7, 'opt_in'), 'draft', $8)
         RETURNING *`,
        [body.name, body.subject, body.body_html, body.body_text || null,
         body.preheader || null, body.template_kind, body.segment,
         req.user?.id || null]
      );
      res.status(201).json({ campaign: rows[0] });
    } catch (e) {
      console.error("[admin campaigns create]", e);
      res.status(500).json({ error: "Error al crear campaña" });
    }
  });

  // ── PUT /api/admin/shop/campaigns/:id — editar draft
  router.put("/campaigns/:id", ...writeMw, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    let body;
    try { body = campaignSchema.partial().parse(req.body); }
    catch (e) { return res.status(400).json({ error: "Datos inválidos", issues: e.issues }); }
    try {
      const cur = await db.query(`SELECT status FROM email_campaigns WHERE id=$1`, [id]);
      if (!cur.rows[0]) return res.status(404).json({ error: "No encontrada" });
      if (cur.rows[0].status !== "draft") {
        return res.status(409).json({ error: "Solo se pueden editar campañas en draft" });
      }
      const sets = ["updated_at = NOW()"];
      const params = [];
      for (const k of ["name","subject","body_html","body_text","preheader","template_kind","segment"]) {
        if (body[k] !== undefined) {
          params.push(body[k]);
          sets.push(`${k} = $${params.length}`);
        }
      }
      params.push(id);
      const { rows } = await db.query(
        `UPDATE email_campaigns SET ${sets.join(", ")} WHERE id=$${params.length} RETURNING *`,
        params
      );
      res.json({ campaign: rows[0] });
    } catch (e) {
      console.error("[admin campaigns update]", e);
      res.status(500).json({ error: "Error al actualizar campaña" });
    }
  });

  // ── POST /api/admin/shop/campaigns/:id/send — kickoff
  // Devuelve inmediatamente, el sender corre en background. Throttle
  // y daily limit dentro de sendCampaign.
  router.post("/campaigns/:id/send", ...writeMw, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
      const cur = await db.query(`SELECT status FROM email_campaigns WHERE id=$1`, [id]);
      if (!cur.rows[0]) return res.status(404).json({ error: "No encontrada" });
      if (cur.rows[0].status !== "draft") {
        return res.status(409).json({ error: `No se puede enviar en status '${cur.rows[0].status}'` });
      }
      // Background kickoff (non-blocking) — la response vuelve enseguida.
      setImmediate(() => {
        shopNotify.sendCampaign(id).catch((e) => {
          console.error(`[campaign ${id} send] error`, e);
        });
      });
      res.json({ ok: true, message: "Campaña en envío. Refrescá para ver progreso." });
    } catch (e) {
      console.error("[admin campaigns send]", e);
      res.status(500).json({ error: "Error al disparar envío" });
    }
  });

  // ── POST /api/admin/shop/campaigns/:id/cancel — interrumpir
  router.post("/campaigns/:id/cancel", ...writeMw, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
      const { rows } = await db.query(
        `UPDATE email_campaigns
         SET status='cancelled', finished_at=NOW(), updated_at=NOW()
         WHERE id=$1 AND status IN ('draft','sending')
         RETURNING *`,
        [id]
      );
      if (!rows[0]) return res.status(404).json({ error: "No encontrada o ya terminó" });
      res.json({ campaign: rows[0] });
    } catch (e) {
      console.error("[admin campaigns cancel]", e);
      res.status(500).json({ error: "Error al cancelar" });
    }
  });

  // ── DELETE /api/admin/shop/campaigns/:id — borrar draft
  router.delete("/campaigns/:id", ...writeMw, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
      const r = await db.query(`DELETE FROM email_campaigns WHERE id=$1 AND status='draft'`, [id]);
      if (r.rowCount === 0) return res.status(409).json({ error: "Solo se pueden borrar drafts" });
      res.json({ ok: true });
    } catch (e) {
      console.error("[admin campaigns delete]", e);
      res.status(500).json({ error: "Error al borrar" });
    }
  });

  return router;
}

module.exports = { publicRouter, webhookRouter, adminRouter };
