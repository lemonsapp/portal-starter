// ══════════════════════════════════════════════════════════════════════════════
// Generador de JWT de larga duración para los bots
// Correr en el Codespace: node generate-bot-jwt.js
// Archivo: /workspaces/lemons-portal/generate-bot-jwt.js
// ══════════════════════════════════════════════════════════════════════════════

require("dotenv").config({ path: "./server/.env" });
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET no encontrado. Asegurate de correrlo desde /workspaces/lemons-portal");
  console.error("   o seteá la variable: JWT_SECRET=tu_secreto node generate-bot-jwt.js");
  process.exit(1);
}

// Token para los bots — rol admin, id 1 (Lemon), expira en 1 año
const token = jwt.sign(
  { id: 1, role: "admin" },
  JWT_SECRET,
  { expiresIn: "365d" }
);

const decoded = jwt.decode(token);
const expDate = new Date(decoded.exp * 1000).toISOString();

console.log("\n🍋 JWT de larga duración generado:");
console.log("─────────────────────────────────────────");
console.log(token);
console.log("─────────────────────────────────────────");
console.log(`✅ Expira: ${expDate}`);
console.log("\n📋 Copiá esto en /home/ubuntu/.env-lemons:");
console.log(`BOT_SETTINGS_JWT="${token}"`);