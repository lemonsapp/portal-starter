"use strict";

const cron = require("node-cron");
const { healthcheckIgToken } = require("../lib/ig-token");

let cronTask = null;
function startIgTokenHealthcheckCron() {
  if (cronTask) return cronTask;
  // Diario 04:00 BA. Page tokens no expiran, pero pueden invalidarse (cambio de password, revocación de scopes).
  // Si falla, queda en journalctl como ERROR para alertar antes de que el publisher rompa publicaciones.
  cronTask = cron.schedule(
    "0 4 * * *",
    async () => {
      try {
        const out = await healthcheckIgToken();
        console.log("[IG-TOKEN healthcheck cron] OK", out);
      } catch (e) {
        console.error("[IG-TOKEN healthcheck cron ERROR]", e.message);
      }
    },
    { timezone: "America/Argentina/Buenos_Aires" }
  );
  return cronTask;
}

// Alias por compat con el require previo en index.js (PR #21).
const startIgTokenRefreshCron = startIgTokenHealthcheckCron;

module.exports = { startIgTokenHealthcheckCron, startIgTokenRefreshCron };
