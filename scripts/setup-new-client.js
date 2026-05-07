#!/usr/bin/env node
//
// scripts/setup-new-client.js
//
// Helper para arrancar un deploy nuevo. Genera los 2 secrets críticos
// (JWT_SECRET + MASTER_KEY) y arma un .env válido en la raíz del repo.
//
// Uso:
//   node scripts/setup-new-client.js
//   node scripts/setup-new-client.js --print          (solo imprime, no escribe)
//   node scripts/setup-new-client.js --force          (sobrescribe .env existente)
//
// Spec § 6 ('scripts/setup-new-client.js — genera secrets, prepara branding inicial').

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

const args = process.argv.slice(2);
const PRINT_ONLY = args.includes("--print");
const FORCE      = args.includes("--force");

function genSecret() {
  return crypto.randomBytes(32).toString("hex");
}

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, ans => { rl.close(); resolve(ans.trim()); });
  });
}

function colorize(text, color) {
  const codes = { red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, gray: 90, bold: 1 };
  return `\x1b[${codes[color] || 0}m${text}\x1b[0m`;
}

(async () => {
  console.log(colorize("\n  portal-starter · setup-new-client\n", "bold"));
  console.log("  Vamos a generar el .env mínimo para que el server arranque.\n");
  console.log("  Lo que se necesita:");
  console.log("    1. " + colorize("DATABASE_URL", "cyan") + " — la connection string de Neon (https://console.neon.tech)");
  console.log("    2. " + colorize("APP_URL", "cyan") + "      — URL pública del frontend (ej. https://portal.tucliente.com)");
  console.log("    3. " + colorize("JWT_SECRET", "cyan") + "   — generado automáticamente abajo");
  console.log("    4. " + colorize("MASTER_KEY", "cyan") + "   — generado automáticamente abajo\n");

  // Check si ya existe .env
  if (fs.existsSync(ENV_PATH) && !FORCE && !PRINT_ONLY) {
    console.log(colorize("⚠ Ya existe " + ENV_PATH, "yellow"));
    const ans = await ask("  Sobrescribir? [y/N]: ");
    if (ans.toLowerCase() !== "y") {
      console.log(colorize("\n  Cancelado. Usá --force para sobrescribir.\n", "gray"));
      process.exit(0);
    }
  }

  let DATABASE_URL = "";
  let APP_URL      = "http://localhost:5173";

  if (!PRINT_ONLY) {
    DATABASE_URL = await ask(colorize("  DATABASE_URL", "cyan") + " (Neon connection string): ");
    if (!DATABASE_URL) {
      console.log(colorize("\n  ⚠ Sin DATABASE_URL el server no arranca. Pegala desde Neon dashboard.\n", "red"));
      process.exit(1);
    }
    if (!/^postgres(ql)?:\/\//.test(DATABASE_URL)) {
      console.log(colorize("\n  ⚠ DATABASE_URL debe empezar con postgres:// o postgresql://\n", "red"));
      process.exit(1);
    }
    if (!/sslmode=/.test(DATABASE_URL)) {
      console.log(colorize("  ℹ Tip: agregá ?sslmode=require a la URL para conexiones seguras a Neon.", "gray"));
    }

    const appUrlAns = await ask(colorize("  APP_URL", "cyan") + ` (default ${APP_URL}): `);
    if (appUrlAns) APP_URL = appUrlAns;
  }

  const JWT_SECRET = genSecret();
  const MASTER_KEY = genSecret();

  const envContent = `# portal-starter — generado por scripts/setup-new-client.js
# Fecha: ${new Date().toISOString()}
#
# CRÍTICO: este archivo contiene secretos. NUNCA lo commitees.
# Si lo perdés, generá uno nuevo con: node scripts/setup-new-client.js
# Pero si MASTER_KEY cambia, hay que re-pegar todas las API keys del wizard
# (porque el contenido encriptado se vuelve ilegible).

DATABASE_URL=${DATABASE_URL || "postgres://user:pass@host/db?sslmode=require"}

JWT_SECRET=${JWT_SECRET}
MASTER_KEY=${MASTER_KEY}

NODE_ENV=development
PORT=4000
APP_URL=${APP_URL}

# ── Telegram fallback (opcional) ─────────────────────────────────────────────
# El cliente final puede pegar bot_token y chat_id desde el wizard de admin
# (se guardan encriptados con MASTER_KEY). Estos vars solo son fallback de
# bootstrap para alertas tempranas — vacíos = no se manda nada.
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
`;

  if (PRINT_ONLY) {
    console.log("\n" + colorize("  ── Contenido del .env (NO escrito): ──", "blue"));
    console.log(envContent);
    console.log(colorize("  Copialo manualmente o corré sin --print para escribir.\n", "gray"));
    process.exit(0);
  }

  fs.writeFileSync(ENV_PATH, envContent, { mode: 0o600 });
  console.log("\n" + colorize("  ✓ Generado " + ENV_PATH, "green"));
  console.log(colorize("  ✓ Permisos: 600 (solo el owner puede leer)", "green"));

  console.log("\n  " + colorize("Próximos pasos:", "bold"));
  console.log("    1. Aplicar el schema:    " + colorize("psql $DATABASE_URL < scripts/init-db.sql", "cyan"));
  console.log("    2. Instalar deps:        " + colorize("cd client && npm install && cd ../server && npm install", "cyan"));
  console.log("    3. Arrancar el server:   " + colorize("cd server && node index.js", "cyan"));
  console.log("    4. Arrancar el client:   " + colorize("cd client && npm run dev", "cyan"));
  console.log("    5. Abrir browser:        " + colorize(APP_URL, "cyan"));
  console.log("    6. Crear primer admin → completar wizard.\n");

  console.log(colorize("  ⚠ IMPORTANTE: guardá una copia de MASTER_KEY en password manager", "yellow"));
  console.log(colorize("    (1Password, Bitwarden). Si la perdés, hay que reconfigurar el wizard.\n", "yellow"));
})().catch(e => {
  console.error("\n" + colorize("✗ Error: " + e.message, "red") + "\n");
  process.exit(1);
});
