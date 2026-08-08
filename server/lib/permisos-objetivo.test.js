// server/lib/permisos-objetivo.test.js — la guarda de rol del objetivo que
// impide la escalación operador→admin. Corrida (sin DB):
//   cd server && node lib/permisos-objetivo.test.js
//
// EL BUG QUE ESTO PREVIENE (auditoría 2026-08-08, hallazgo H4): PATCH
// /operator/clients/:id/password y el cambio de email hermano corrían
// `UPDATE users ... WHERE id=$N` sin mirar el rol de la fila objetivo, así que
// un operador le reseteaba la contraseña a un admin y entraba como admin.
"use strict";

const assert = require("node:assert");
const { puedeActuarSobreObjetivo } = require("./permisos-objetivo");

let fallas = 0;
function ok(msg) { console.log(`✓ ${msg}`); }
function mal(msg) { fallas++; console.error(`✗ ${msg}`); }

// — el operador NO puede tocar a un admin —
try {
  assert.strictEqual(puedeActuarSobreObjetivo("operator", "admin"), false);
  ok("operador → admin: BLOQUEADO (no puede resetear la contraseña de un admin)");
} catch { mal("operador → admin: debería estar bloqueado y no lo está"); }

// — el operador NO puede tocar a otro operador —
try {
  assert.strictEqual(puedeActuarSobreObjetivo("operator", "operator"), false);
  ok("operador → operador: BLOQUEADO");
} catch { mal("operador → operador: debería estar bloqueado y no lo está"); }

// — el operador SÍ puede tocar a un cliente (acción legítima, no romperla) —
try {
  assert.strictEqual(puedeActuarSobreObjetivo("operator", "client"), true);
  ok("operador → cliente: PERMITIDO (la operación legítima sigue funcionando)");
} catch { mal("operador → cliente: debería estar permitido y no lo está"); }

// — el admin puede tocar a cualquiera —
try {
  assert.strictEqual(puedeActuarSobreObjetivo("admin", "admin"), true);
  assert.strictEqual(puedeActuarSobreObjetivo("admin", "operator"), true);
  assert.strictEqual(puedeActuarSobreObjetivo("admin", "client"), true);
  ok("admin → admin/operador/cliente: PERMITIDO (sólo el admin modifica staff)");
} catch { mal("admin → cualquiera: debería estar permitido y no lo está"); }

// — fail-closed: rol de objetivo desconocido/nulo, caller no-admin → bloqueado —
try {
  assert.strictEqual(puedeActuarSobreObjetivo("operator", undefined), false);
  assert.strictEqual(puedeActuarSobreObjetivo("operator", null), false);
  assert.strictEqual(puedeActuarSobreObjetivo("operator", "superadmin"), false);
  ok("operador → rol raro/nulo: BLOQUEADO (fail-closed)");
} catch { mal("operador → rol raro/nulo: debería bloquear por defecto"); }

if (fallas) { console.error(`\n${fallas} falla(s)`); process.exit(1); }
console.log("\nTodo verde ✓");
