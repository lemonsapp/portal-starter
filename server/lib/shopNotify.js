// server/lib/shopNotify.js
//
// Notificaciones del shop (Sprint 14 F3, 2026-05-23). Combina:
//   • Email transaccional al cliente (confirmación, pago, despacho)
//   • Email de aviso al admin (pedido nuevo)
//   • Broadcast in-app target_role=admin (bell counter del panel)
//
// Todas son non-fatal: si Resend no está configurado o falla, el llamador
// no rompe. Logs en consola + intenta seguir.
//
// Lee de configStore (DB encriptado): resend.api_key, resend.from_email,
// resend.from_name. Fallback a env vars RESEND_API_KEY / MAIL_FROM si el
// configStore está vacío (back-compat con deploys que setearon el .env
// antes de tener el wizard).

"use strict";

const db = require("../db");
const cs = require("./configStore");

const RESEND_API = "https://api.resend.com/emails";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatARS(cents) {
  if (cents == null) return "—";
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

async function getResendConfig() {
  // Prefer configStore (admin wizard); fallback a env si está seteado.
  const [csKey, csFromEmail, csFromName] = await Promise.all([
    cs.getConfig("resend.api_key").catch(() => null),
    cs.getConfig("resend.from_email").catch(() => null),
    cs.getConfig("resend.from_name").catch(() => null),
  ]);
  const apiKey = csKey || process.env.RESEND_API_KEY || null;
  const fromEmail = csFromEmail || (process.env.MAIL_FROM || "").match(/<([^>]+)>/)?.[1] || process.env.MAIL_FROM || null;
  const fromName = csFromName || (process.env.MAIL_FROM || "").match(/^([^<]+)/)?.[1]?.trim() || "Holistic Growshop";
  return {
    apiKey,
    from: apiKey && fromEmail ? `${fromName} <${fromEmail}>` : null,
  };
}

/**
 * Envío directo a Resend REST API. Devuelve { ok, id|error }.
 * No tira excepción — el caller decide qué hacer si falla.
 */
async function sendResendEmail({ to, subject, html, replyTo }) {
  const { apiKey, from } = await getResendConfig();
  if (!apiKey || !from) {
    console.log(`[shopNotify] resend no configurado — skipping email "${subject}" a ${to}`);
    return { ok: false, skipped: true, reason: "not_configured" };
  }
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from, to, subject, html,
        reply_to: replyTo || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[shopNotify resend error]", res.status, data);
      return { ok: false, error: data.message || `HTTP ${res.status}` };
    }
    console.log(`[shopNotify] email "${subject}" enviado a ${to}, id=${data.id}`);
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[shopNotify resend exception]", e);
    return { ok: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email templates — HTML inline (sin React Email — más simple, sin build deps)
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_COLOR = "#A7F5C8";
const BRAND_DARK  = "#0a0a0a";
const BRAND_CTA   = "#25D366";

function emailShell({ heading, intro, body, footer }) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(heading)}</title></head>
<body style="margin:0;padding:24px 0;background:#f4f1ec;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.06);">
    <tr><td style="background:${BRAND_DARK};padding:24px 32px;text-align:center;color:#fff;">
      <div style="font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:${BRAND_COLOR};">HOLISTIC · GROWSHOP</div>
      <h1 style="margin:8px 0 0;font-size:24px;font-weight:900;letter-spacing:-.01em;">${esc(heading)}</h1>
    </td></tr>
    <tr><td style="padding:32px;">
      ${intro ? `<p style="margin:0 0 18px;font-size:16px;line-height:1.55;color:#333;">${intro}</p>` : ""}
      ${body || ""}
    </td></tr>
    <tr><td style="padding:20px 32px;background:#f9f6f0;border-top:1px solid #ece8e0;font-size:12px;line-height:1.5;color:#666;">
      ${footer || `<strong>Holistic Growshop</strong> · Soporte: <a href="https://wa.me/" style="color:${BRAND_CTA};">WhatsApp</a><br>
      Si no esperabas este email, ignoralo o respondé y lo revisamos.`}
    </td></tr>
  </table>
</body></html>`;
}

function renderItemsTable(items) {
  const rows = items.map((it) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:14px;">
        <strong>${esc(it.name_snapshot)}</strong>
        <div style="font-size:12px;color:#888;">Cantidad: ${it.quantity}</div>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:14px;text-align:right;white-space:nowrap;">
        ${esc(formatARS(it.line_total_cents))}
      </td>
    </tr>
  `).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:14px 0;">${rows}</table>`;
}

function renderAddress(addr) {
  if (!addr || !addr.street) return "";
  return `
    <div style="background:#f6f9f7;border-left:3px solid ${BRAND_COLOR};padding:12px 16px;margin:14px 0;border-radius:0 8px 8px 0;">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#666;margin-bottom:6px;font-weight:700;">Dirección de envío</div>
      <div style="font-size:14px;line-height:1.5;color:#333;">
        ${esc(addr.street)} ${esc(addr.number)}${addr.apartment ? ` · Dpto ${esc(addr.apartment)}` : ""}<br>
        ${esc(addr.city)}, ${esc(addr.province)}<br>
        CP ${esc(addr.postal_code)} · ${esc(addr.country || "Argentina")}
        ${addr.notes ? `<br><em style="color:#666;">"${esc(addr.notes)}"</em>` : ""}
      </div>
    </div>
  `;
}

function emailOrderCreated(order, items) {
  const intro = `¡Hola <strong>${esc(order.customer_first_name)}</strong>! Recibimos tu pedido y lo estamos procesando.`;
  const body = `
    <div style="background:#f9f6f0;border-radius:10px;padding:18px 22px;margin:8px 0 18px;">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#666;margin-bottom:4px;font-weight:700;">Número de orden</div>
      <div style="font-family:monospace;font-size:22px;font-weight:900;color:${BRAND_DARK};letter-spacing:.04em;">${esc(order.public_id)}</div>
    </div>
    <h3 style="margin:18px 0 4px;font-size:16px;">Tu pedido</h3>
    ${renderItemsTable(items)}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;">
      <tr><td style="font-size:14px;color:#666;">Subtotal</td><td style="text-align:right;font-size:14px;">${esc(formatARS(order.subtotal_cents))}</td></tr>
      <tr><td style="font-size:14px;color:#666;">Envío</td><td style="text-align:right;font-size:14px;">${order.shipping_cents > 0 ? esc(formatARS(order.shipping_cents)) : "A coordinar"}</td></tr>
      <tr><td style="padding-top:10px;font-size:16px;font-weight:700;">Total</td><td style="padding-top:10px;text-align:right;font-size:22px;font-weight:900;color:${BRAND_CTA};">${esc(formatARS(order.total_cents))}</td></tr>
    </table>
    ${renderAddress(order.shipping_address)}
    <p style="margin:20px 0 6px;font-size:14px;line-height:1.55;color:#333;">
      Te avisamos por email cuando confirmemos el pago. Si elegiste pagar con
      MercadoPago, completá el checkout para finalizar; si quedó pendiente,
      te contactamos por WhatsApp para coordinar.
    </p>
  `;
  return emailShell({
    heading: "Recibimos tu pedido",
    intro, body,
  });
}

function emailOrderPaid(order, items) {
  const intro = `¡<strong>${esc(order.customer_first_name)}</strong>, confirmamos tu pago!`;
  const body = `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 18px;margin:8px 0 16px;text-align:center;">
      <div style="font-size:28px;line-height:1;margin-bottom:4px;">✅</div>
      <div style="font-size:14px;font-weight:600;color:#15803d;">Pago acreditado · Orden ${esc(order.public_id)}</div>
    </div>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Empezamos a preparar tu envío. Te avisamos cuando se despache.</p>
    ${renderItemsTable(items)}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="padding-top:10px;font-size:16px;font-weight:700;">Total pagado</td><td style="padding-top:10px;text-align:right;font-size:22px;font-weight:900;color:${BRAND_CTA};">${esc(formatARS(order.total_cents))}</td></tr>
    </table>
    ${renderAddress(order.shipping_address)}
  `;
  return emailShell({ heading: "¡Tu pedido está confirmado!", intro, body });
}

function emailOrderDispatched(order, items) {
  const intro = `<strong>${esc(order.customer_first_name)}</strong>, tu pedido <strong>${esc(order.public_id)}</strong> ya salió.`;
  const body = `
    <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;padding:14px 18px;margin:8px 0 16px;text-align:center;">
      <div style="font-size:28px;line-height:1;margin-bottom:4px;">🚚</div>
      <div style="font-size:14px;font-weight:600;color:#1d4ed8;">Envío en camino</div>
    </div>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Llega en las próximas 24-48 hs hábiles. Te contactamos por WhatsApp si necesitamos coordinar la entrega.</p>
    ${renderAddress(order.shipping_address)}
  `;
  return emailShell({ heading: "Tu pedido está en camino", intro, body });
}

function emailAdminNewOrder(order, items, statusLabel) {
  const intro = `Nuevo pedido entró al sistema. Status actual: <strong>${esc(statusLabel)}</strong>.`;
  const body = `
    <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:14px 18px;margin:8px 0 18px;">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#92400e;margin-bottom:4px;font-weight:700;">Orden ${esc(order.public_id)}</div>
      <div style="font-size:16px;font-weight:600;">${esc(order.customer_first_name)} ${esc(order.customer_last_name || "")} · ${esc(order.customer_email)}</div>
      <div style="font-size:13px;color:#666;margin-top:2px;">📱 ${esc(order.customer_phone || "—")}</div>
    </div>
    ${renderItemsTable(items)}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="padding-top:10px;font-size:14px;color:#666;">Subtotal</td><td style="text-align:right;font-size:14px;">${esc(formatARS(order.subtotal_cents))}</td></tr>
      <tr><td style="padding-top:6px;font-size:16px;font-weight:700;">Total</td><td style="padding-top:6px;text-align:right;font-size:20px;font-weight:900;color:${BRAND_DARK};">${esc(formatARS(order.total_cents))}</td></tr>
    </table>
    ${renderAddress(order.shipping_address)}
    <p style="margin:24px 0 0;font-size:13px;color:#666;text-align:center;">Gestioná esta orden desde el panel admin → pestaña Pedidos.</p>
  `;
  return emailShell({
    heading: "📦 Nuevo pedido",
    intro, body,
    footer: `Notificación interna — Panel admin: <code>/admin</code>`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer upsert + admin in-app broadcast + email entrypoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UPSERT del customer post-checkout. Idempotente: si email ya existe,
 * acumula orders_count + total_spent_cents + actualiza last_order_at +
 * pisa last_address con la última usada.
 */
async function upsertCustomer({ email, first_name, last_name, phone, address, totalCents }) {
  try {
    await db.query(
      `INSERT INTO customers
         (email, first_name, last_name, phone, last_address,
          orders_count, total_spent_cents, last_order_at, first_order_at)
       VALUES (LOWER($1), $2, $3, $4, $5::jsonb, 1, $6, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         first_name        = COALESCE(customers.first_name, EXCLUDED.first_name),
         last_name         = COALESCE(customers.last_name,  EXCLUDED.last_name),
         phone             = COALESCE(EXCLUDED.phone, customers.phone),
         last_address      = EXCLUDED.last_address,
         orders_count      = customers.orders_count + 1,
         total_spent_cents = customers.total_spent_cents + EXCLUDED.total_spent_cents,
         last_order_at     = NOW(),
         updated_at        = NOW()`,
      [email, first_name, last_name || null, phone || null,
       JSON.stringify(address || {}), totalCents]
    );
  } catch (e) {
    console.error("[shopNotify upsertCustomer]", e);
  }
}

/**
 * Notificación in-app para admin: crea row en broadcast_notifications con
 * target_role='admin'. El bell counter del panel la levanta vía
 * /notifications/active (existing endpoint).
 */
async function notifyAdminInApp(order) {
  try {
    await db.query(
      `INSERT INTO broadcast_notifications
         (message, emoji, type, active, target_role)
       VALUES ($1, '📦', 'order', TRUE, 'admin')`,
      [`Nuevo pedido ${order.public_id} · ${order.customer_first_name} · ${formatARS(order.total_cents)}`]
    );
  } catch (e) {
    console.error("[shopNotify notifyAdminInApp]", e);
  }
}

/**
 * Disparado al crear orden. Envía:
 *   • Email de confirmación al cliente (status pending_payment)
 *   • Email al admin (alerta de nuevo pedido)
 *   • Broadcast in-app target=admin
 * Todo non-blocking — los emails fallan silencioso si Resend no está.
 */
async function onOrderCreated(order, items) {
  // Cliente
  sendResendEmail({
    to: order.customer_email,
    subject: `Recibimos tu pedido — ${order.public_id}`,
    html: emailOrderCreated(order, items),
  }).catch(() => {});

  // Admin email (a la propia from_email del seller — recibe en su inbox)
  const cfg = await getResendConfig();
  if (cfg.from) {
    const adminTo = process.env.ADMIN_NOTIFY_EMAIL || (cfg.from.match(/<([^>]+)>/)?.[1]) || null;
    if (adminTo) {
      sendResendEmail({
        to: adminTo,
        subject: `📦 Nuevo pedido ${order.public_id} · ${formatARS(order.total_cents)}`,
        html: emailAdminNewOrder(order, items, "Pendiente de pago"),
        replyTo: order.customer_email,
      }).catch(() => {});
    }
  }

  // Broadcast in-app
  notifyAdminInApp(order).catch(() => {});
}

/**
 * Disparado por webhook MP cuando status pasa a paid.
 * Envía email confirmando pago al cliente + actualiza broadcast admin.
 */
async function onOrderPaid(order, items) {
  sendResendEmail({
    to: order.customer_email,
    subject: `Pago confirmado · ${order.public_id}`,
    html: emailOrderPaid(order, items),
  }).catch(() => {});

  try {
    await db.query(
      `INSERT INTO broadcast_notifications (message, emoji, type, active, target_role)
       VALUES ($1, '💰', 'order', TRUE, 'admin')`,
      [`Pago confirmado ${order.public_id} · ${formatARS(order.total_cents)}`]
    );
  } catch (e) {
    console.error("[shopNotify onOrderPaid broadcast]", e);
  }
}

/**
 * Disparado por admin cuando marca despachado.
 */
async function onOrderDispatched(order, items) {
  sendResendEmail({
    to: order.customer_email,
    subject: `Tu pedido salió · ${order.public_id}`,
    html: emailOrderDispatched(order, items),
  }).catch(() => {});
}

module.exports = {
  upsertCustomer,
  onOrderCreated,
  onOrderPaid,
  onOrderDispatched,
  notifyAdminInApp,
  // helpers exportados por si otro módulo los necesita
  sendResendEmail,
  formatARS,
};
