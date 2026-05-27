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

const crypto = require("crypto");
const db = require("../db");
const cs = require("./configStore");

const RESEND_API = "https://api.resend.com/emails";

// Resend free tier: 100/día + 1 email/segundo. Throttle conservador:
//   • 90 envíos/día por campaña (deja headroom para transaccionales)
//   • 2000ms entre envíos (= 0.5/seg, sub-tier safe)
// F4+: leer estos valores de app_config si el cliente paga tier superior.
const CAMPAIGN_DAILY_LIMIT = 90;
const CAMPAIGN_GAP_MS      = 2000;

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

// ─────────────────────────────────────────────────────────────────────────────
// Correos de envío — label + builder de URL de seguimiento por carrier.
// Las URLs son best-effort (los correos cambian sus trackers); editá acá si
// alguno deja de funcionar. "propio" no tiene tracker → coordinación por WA.
// ─────────────────────────────────────────────────────────────────────────────
const CARRIERS = {
  andreani:         { label: "Andreani",         url: (n) => `https://www.andreani.com/#!/informacionEnvio/${encodeURIComponent(n)}` },
  correo_argentino: { label: "Correo Argentino", url: (n) => `https://www.correoargentino.com.ar/formularios/e-commerce?id=${encodeURIComponent(n)}` },
  via_cargo:        { label: "Vía Cargo",        url: (n) => `https://www.viacargo.com.ar/seguimiento?guia=${encodeURIComponent(n)}` },
  propio:           { label: "Envío propio",     url: () => null },
};
const CARRIER_KEYS = Object.keys(CARRIERS);
function carrierLabel(c) { return (c && CARRIERS[c]?.label) || "Correo"; }
function trackingUrl(carrier, n) {
  const c = carrier && CARRIERS[carrier];
  return c && n ? c.url(n) : null;
}

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
  const carrier = carrierLabel(order.carrier);
  const tn = order.tracking_number;
  const url = trackingUrl(order.carrier, tn);
  const intro = `<strong>${esc(order.customer_first_name)}</strong>, tu pedido <strong>${esc(order.public_id)}</strong> ya salió.`;
  const trackingBlock = tn ? `
    <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:12px;padding:18px 20px;margin:8px 0 18px;text-align:center;">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#1d4ed8;font-weight:700;margin-bottom:6px;">Seguimiento · ${esc(carrier)}</div>
      <div style="font-family:monospace;font-size:20px;font-weight:900;color:${BRAND_DARK};letter-spacing:.03em;">${esc(tn)}</div>
      ${url
        ? `<a href="${esc(url)}" style="display:inline-block;margin-top:14px;background:${BRAND_CTA};color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:13px 28px;border-radius:999px;">🚚 Seguir mi envío →</a>`
        : `<div style="margin-top:10px;font-size:13px;color:#666;">Coordinamos la entrega con vos por WhatsApp.</div>`}
    </div>` : "";
  const body = `
    <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;padding:14px 18px;margin:8px 0 16px;text-align:center;">
      <div style="font-size:28px;line-height:1;margin-bottom:4px;">🚚</div>
      <div style="font-size:14px;font-weight:600;color:#1d4ed8;">Envío en camino${order.carrier ? ` · ${esc(carrier)}` : ""}</div>
    </div>
    ${trackingBlock}
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

// ─────────────────────────────────────────────────────────────────────────────
// F4: Email campaigns (broadcast a base de customers opt-in)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera token HMAC firmado para una send específica. Permite unsubscribe
 * + tracking sin exponer customer_id raw en URLs. Clave: MASTER_KEY del
 * configStore (mismo secret para encrypt/decrypt de credenciales). Si no
 * está seteada, fallback a un secret derivado de NODE_ENV — funciona en
 * dev pero NO debería pasar a prod.
 */
function unsubscribeSecret() {
  const k = process.env.MASTER_KEY;
  if (k && /^[0-9a-fA-F]{64}$/.test(k)) return Buffer.from(k, "hex");
  // Fallback: hash determinístico de NODE_ENV + APP_URL (estable por deploy
  // pero único entre tenants). NO seguro para prod sin MASTER_KEY real.
  return crypto.createHash("sha256").update(
    `holistic-fallback-${process.env.NODE_ENV || "dev"}-${process.env.APP_URL || ""}`
  ).digest();
}

function buildUnsubscribeToken({ campaignId, customerId, email }) {
  const payload = `${campaignId}:${customerId || 0}:${email}`;
  const hmac = crypto.createHmac("sha256", unsubscribeSecret())
    .update(payload).digest("hex").slice(0, 16);
  // Token = base64url(payload) + . + hmac. Self-contained: verificable sin DB.
  const b64 = Buffer.from(payload).toString("base64url");
  return `${b64}.${hmac}`;
}

function parseUnsubscribeToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [b64, sig] = token.split(".");
  let payload;
  try { payload = Buffer.from(b64, "base64url").toString("utf8"); }
  catch { return null; }
  const expected = crypto.createHmac("sha256", unsubscribeSecret())
    .update(payload).digest("hex").slice(0, 16);
  // timing-safe compare
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const [campaignId, customerId, ...emailParts] = payload.split(":");
  return {
    campaignId: parseInt(campaignId, 10),
    customerId: parseInt(customerId, 10) || null,
    email: emailParts.join(":"),
  };
}

function appUrlSafe() {
  return (process.env.APP_URL || "https://portal-starter.vercel.app").replace(/\/$/, "");
}

/**
 * Inyecta footer con link de unsubscribe en el HTML de la campaña. Si el
 * HTML ya tiene un placeholder {{UNSUB_URL}}, lo reemplaza in-place; si no,
 * appendea un footer compliant antes del </body>.
 */
function injectUnsubFooter(html, unsubUrl) {
  const footer = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;border-top:1px solid #e5e5e5;padding-top:16px;">
      <tr><td style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:11px;line-height:1.5;color:#999;text-align:center;">
        Recibís este email porque estás en la lista de clientes de <strong>Holistic Growshop</strong>.<br>
        ¿No querés más? <a href="${unsubUrl}" style="color:#666;text-decoration:underline;">Darse de baja</a>.
      </td></tr>
    </table>
  `;
  if (html.includes("{{UNSUB_URL}}")) {
    return html.replaceAll("{{UNSUB_URL}}", unsubUrl);
  }
  if (html.includes("</body>")) {
    return html.replace("</body>", `${footer}</body>`);
  }
  return html + footer;
}

/**
 * Envía una campaña a su segmento. Bloqueante pero non-fatal — corre
 * en background (caller no espera). Throttle:
 *   • CAMPAIGN_GAP_MS entre envíos (default 2000ms)
 *   • CAMPAIGN_DAILY_LIMIT total (default 90, free Resend tier)
 *
 * Update progresivo de email_campaigns.sent_count + failed_count para que
 * el admin vea el progreso live. email_sends queda con row por destinatario
 * (audit + retry futuro).
 */
async function sendCampaign(campaignId) {
  const { rows: cRows } = await db.query(`SELECT * FROM email_campaigns WHERE id = $1`, [campaignId]);
  const camp = cRows[0];
  if (!camp) { console.error(`[campaign] ${campaignId} no encontrada`); return; }
  if (camp.status !== "draft" && camp.status !== "sending") {
    console.error(`[campaign ${campaignId}] status ${camp.status} no permite envío`);
    return;
  }

  // 1. Resolver segmento: snapshot de destinatarios.
  let segmentQuery = `SELECT id, email, first_name FROM customers WHERE opted_in_marketing = TRUE`;
  if (camp.segment === "all") {
    segmentQuery = `SELECT id, email, first_name FROM customers`;
  }
  const { rows: recipients } = await db.query(segmentQuery + ` ORDER BY id`);

  // Aplicar daily limit
  const limit = Math.min(recipients.length, CAMPAIGN_DAILY_LIMIT);
  const batch = recipients.slice(0, limit);

  // 2. Marcar campaign como sending + total snapshot.
  await db.query(
    `UPDATE email_campaigns
     SET status='sending', started_at=NOW(), total_count=$1, updated_at=NOW()
     WHERE id=$2`,
    [batch.length, campaignId]
  );

  // 3. Pre-crear email_sends rows con tokens. Permite cancel/resume + audit
  //    aunque el server se reinicie a la mitad.
  for (const r of batch) {
    const token = buildUnsubscribeToken({ campaignId, customerId: r.id, email: r.email });
    await db.query(
      `INSERT INTO email_sends (campaign_id, customer_id, email_snapshot, status, unsubscribe_token)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [campaignId, r.id, r.email, token]
    );
  }

  // 4. Loop con throttle.
  console.log(`[campaign ${campaignId}] empezando envío a ${batch.length} destinatarios`);
  const cfg = await getResendConfig();
  if (!cfg.apiKey || !cfg.from) {
    console.error(`[campaign ${campaignId}] Resend no configurado — campaña marcada failed`);
    await db.query(
      `UPDATE email_campaigns SET status='failed', finished_at=NOW(), updated_at=NOW() WHERE id=$1`,
      [campaignId]
    );
    return;
  }

  const { rows: sendRows } = await db.query(
    `SELECT * FROM email_sends WHERE campaign_id=$1 AND status='pending' ORDER BY id`,
    [campaignId]
  );

  let sentCount = 0, failedCount = 0;
  for (const s of sendRows) {
    // Verificar que la campaña no fue cancelada mid-flight.
    const { rows: stRows } = await db.query(`SELECT status FROM email_campaigns WHERE id=$1`, [campaignId]);
    if (stRows[0]?.status === "cancelled") {
      console.log(`[campaign ${campaignId}] cancelada — interrumpiendo loop`);
      break;
    }

    const unsubUrl = `${appUrlSafe()}/api/shop/unsubscribe?token=${encodeURIComponent(s.unsubscribe_token)}`;
    const htmlFinal = injectUnsubFooter(camp.body_html || "", unsubUrl);

    const result = await sendResendEmail({
      to: s.email_snapshot,
      subject: camp.subject,
      html: htmlFinal,
    });

    if (result.ok) {
      sentCount++;
      await db.query(
        `UPDATE email_sends SET status='sent', sent_at=NOW(), resend_message_id=$1 WHERE id=$2`,
        [result.id || null, s.id]
      );
    } else {
      failedCount++;
      await db.query(
        `UPDATE email_sends SET status='failed', error_message=$1 WHERE id=$2`,
        [String(result.error || "unknown").slice(0, 500), s.id]
      );
    }

    // Update counters cada N envíos para que el admin vea progreso live
    if ((sentCount + failedCount) % 5 === 0 || sendRows.indexOf(s) === sendRows.length - 1) {
      await db.query(
        `UPDATE email_campaigns SET sent_count=$1, failed_count=$2, updated_at=NOW() WHERE id=$3`,
        [sentCount, failedCount, campaignId]
      );
    }

    // Throttle entre sends.
    if (sendRows.indexOf(s) < sendRows.length - 1) {
      await new Promise((r) => setTimeout(r, CAMPAIGN_GAP_MS));
    }
  }

  // 5. Final update.
  await db.query(
    `UPDATE email_campaigns
     SET status='sent', finished_at=NOW(),
         sent_count=$1, failed_count=$2, updated_at=NOW()
     WHERE id=$3 AND status != 'cancelled'`,
    [sentCount, failedCount, campaignId]
  );
  console.log(`[campaign ${campaignId}] terminado: ${sentCount} sent, ${failedCount} failed`);
}

/**
 * Marca un customer como unsubscribed via su token.
 * Retorna { ok, email } | { ok: false, reason }.
 */
async function applyUnsubscribe(token) {
  const parsed = parseUnsubscribeToken(token);
  if (!parsed) return { ok: false, reason: "invalid_token" };

  // Actualizar customer si existe
  if (parsed.customerId) {
    await db.query(
      `UPDATE customers
       SET opted_in_marketing = FALSE,
           unsubscribed_at = COALESCE(unsubscribed_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [parsed.customerId]
    );
  } else {
    // Fallback: match por email (caso pre-customers, raro)
    await db.query(
      `UPDATE customers
       SET opted_in_marketing = FALSE,
           unsubscribed_at = COALESCE(unsubscribed_at, NOW()),
           updated_at = NOW()
       WHERE LOWER(email) = LOWER($1)`,
      [parsed.email]
    );
  }

  // Marcar send específico como unsubscribed (audit)
  await db.query(
    `UPDATE email_sends SET status = 'unsubscribed' WHERE unsubscribe_token = $1 AND status = 'sent'`,
    [token]
  );

  return { ok: true, email: parsed.email };
}

module.exports = {
  upsertCustomer,
  onOrderCreated,
  onOrderPaid,
  onOrderDispatched,
  notifyAdminInApp,
  // F4 exports
  sendCampaign,
  applyUnsubscribe,
  buildUnsubscribeToken,
  parseUnsubscribeToken,
  // helpers exportados por si otro módulo los necesita
  sendResendEmail,
  formatARS,
  // Carriers / tracking
  CARRIERS,
  CARRIER_KEYS,
  carrierLabel,
  trackingUrl,
};
