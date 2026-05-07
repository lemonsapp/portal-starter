"use strict";

const cron = require("node-cron");
const { healthcheckMetaUserToken } = require("../lib/meta-token");
const telegram = require("../services/telegram");

const SEVEN_DAYS_SECS = 7 * 24 * 60 * 60;

let cronTask = null;
function startMetaTokenHealthcheckCron() {
  if (cronTask) return cronTask;
  // Diario 04:00 UTC. Marketing API user tokens pueden expirar (60 días por default si no son long-lived).
  // Si el token está roto o expira en <7 días, alerta a Telegram para evitar que explote una campaña en vivo.
  cronTask = cron.schedule(
    "0 4 * * *",
    async () => {
      try {
        const out = await healthcheckMetaUserToken();
        const expiresAt = Number(out?.expires_at || 0);
        const now = Math.floor(Date.now() / 1000);

        if (expiresAt === 0) {
          console.log("[META-TOKEN healthcheck cron] OK (no expira)", { user_id: out.user_id, scopes: out.scopes?.length });
          return;
        }

        const secsLeft = expiresAt - now;
        const daysLeft = Math.floor(secsLeft / 86400);

        if (secsLeft <= 0) {
          console.error("[META-TOKEN healthcheck cron] EXPIRADO");
          await telegram.notify(
            `⚠️ <b>Marketing API token EXPIRADO</b>\n` +
            `Renovar el meta_user_token desde el panel Ads (admin).\n` +
            `<b>Time:</b> ${new Date().toISOString()}`
          ).catch(() => {});
          return;
        }

        if (secsLeft < SEVEN_DAYS_SECS) {
          console.warn("[META-TOKEN healthcheck cron] expira pronto", { daysLeft });
          await telegram.notify(
            `⚠️ <b>Marketing API token expira pronto</b>\n` +
            `<b>Días restantes:</b> ${daysLeft}\n` +
            `<b>Expires at:</b> ${new Date(expiresAt * 1000).toISOString()}\n` +
            `Renovar desde el panel Ads (admin).`
          ).catch(() => {});
          return;
        }

        console.log("[META-TOKEN healthcheck cron] OK", { daysLeft });
      } catch (e) {
        console.error("[META-TOKEN healthcheck cron ERROR]", e.message);
        await telegram.notify(
          `⚠️ <b>Marketing API token inválido</b>\n` +
          `<b>Detalle:</b> ${String(e.message || e).slice(0, 500)}\n` +
          `<b>Time:</b> ${new Date().toISOString()}`
        ).catch(() => {});
      }
    },
    { timezone: "UTC" }
  );
  return cronTask;
}

module.exports = { startMetaTokenHealthcheckCron };
