// server/services/telegram.js — Notificaciones a Telegram (errors, alerts).
// Si TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no están seteados, las llamadas son
// no-op (no rompen el flujo, solo no envían).
"use strict";

const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
// APP_NAME se lee dinámicamente del branding (configStore + branding.json):
// si el admin renombra el portal vía wizard, las alerts próximas usan el
// nombre nuevo. Cache de 30s en getBranding evita pegar a DB en cada error.
const { getBranding } = require("../lib/branding");
async function getAppName() {
  return process.env.APP_NAME || (await getBranding()).name;
}

// Throttle: evita spam si un endpoint tira 500 muchas veces seguidas.
const recent = new Map(); // key -> ts
const THROTTLE_MS = 60_000; // 1 minuto

function shouldSend(key) {
  const now = Date.now();
  const last = recent.get(key) || 0;
  if (now - last < THROTTLE_MS) return false;
  recent.set(key, now);
  // Cleanup viejas
  if (recent.size > 200) {
    for (const [k, ts] of recent) if (now - ts > 5 * 60_000) recent.delete(k);
  }
  return true;
}

async function send(text, opts = {}) {
  if (!TOKEN || !CHAT_ID) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...opts,
      }),
    });
    return r.ok;
  } catch (e) {
    console.error("[telegram]", e.message);
    return false;
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Notificación de error 5xx desde Express. */
async function notifyError({ method, url, status, message, stack, userId, ip }) {
  const key = `${method}:${url}:${message?.slice(0, 80)}`;
  if (!shouldSend(key)) return;

  const stackShort = stack ? stack.split("\n").slice(0, 3).join("\n") : "";
  const appName = await getAppName();
  const text =
    `🚨 <b>${appName} · Error ${status || 500}</b>\n` +
    `<code>${escapeHtml(method)} ${escapeHtml(url)}</code>\n\n` +
    `<b>Message:</b> ${escapeHtml(message)}\n` +
    (userId ? `<b>User:</b> #${userId}\n` : "") +
    (ip ? `<b>IP:</b> ${escapeHtml(ip)}\n` : "") +
    `<b>Time:</b> ${new Date().toISOString()}\n` +
    (stackShort ? `\n<pre>${escapeHtml(stackShort)}</pre>` : "");

  await send(text);
}

/** Notificación genérica (uso libre). */
async function notify(text) {
  return send(text);
}

/** Notificación de evento de negocio (orden, pago, signup grande, etc). */
async function notifyEvent(emoji, title, lines = []) {
  const body = lines.map(([k, v]) => `<b>${escapeHtml(k)}:</b> ${escapeHtml(v)}`).join("\n");
  return send(`${emoji} <b>${escapeHtml(title)}</b>\n\n${body}`);
}

function isConfigured() {
  return !!(TOKEN && CHAT_ID);
}

module.exports = { send, notify, notifyError, notifyEvent, isConfigured };
