// server/lib/badges-propias.test.js — el filtro que impide que un usuario se
// ponga insignias que no posee. Corrida (sin DB):
//   cd server && node lib/badges-propias.test.js
//
// EL BUG QUE ESTO PREVIENE (auditoría 2026-08-08, hallazgo H5): PATCH /profile
// escribía el array `badges` del body tal cual, así que cualquier autenticado
// (registro abierto = cualquiera) se ponía las de staff grantOnly (badge_creator/
// badge_mod/badge_bot) y la paga badge_vip sin tenerlas — base de una estafa de
// soporte falso en el chat.
"use strict";

const assert = require("node:assert");
const { filtrarBadgesPropias } = require("./badges-propias");

let fallas = 0;
function ok(msg) { console.log(`✓ ${msg}`); }
function mal(msg) { fallas++; console.error(`✗ ${msg}`); }

// Lo que el usuario tiene de verdad en user_items (su propiedad real).
const OWNED = ["badge_first", "badge_vip", "avatar_lemon", "frame_gold"];

// — se descartan las de staff/pagas que NO posee —
try {
  const out = filtrarBadgesPropias(["badge_creator", "badge_mod", "badge_bot"], OWNED);
  assert.deepStrictEqual(out, []);
  ok("staff grantOnly (CREATOR/MOD/BOT) que no posee: DESCARTADAS todas");
} catch { mal("las insignias de staff no poseídas deberían descartarse"); }

// — la paga que no posee también cae —
try {
  const out = filtrarBadgesPropias(["badge_vip", "badge_thunder"], OWNED);
  assert.deepStrictEqual(out, ["badge_vip"]);
  ok("mezcla: se queda con badge_vip (la tiene) y descarta badge_thunder (no)");
} catch { mal("debería conservar sólo las poseídas de una mezcla"); }

// — NO romper la elección legítima entre las que sí posee —
try {
  const out = filtrarBadgesPropias(["badge_first", "badge_vip"], OWNED);
  assert.deepStrictEqual(out, ["badge_first", "badge_vip"]);
  ok("elección legítima entre insignias propias: se respeta intacta y en orden");
} catch { mal("no debería tocar una elección de insignias que el usuario posee"); }

// — attacker que se pone SÓLO las de staff: queda sin ninguna —
try {
  const out = filtrarBadgesPropias(["badge_mod"], []);
  assert.deepStrictEqual(out, []);
  ok("usuario sin nada intentando badge_mod: queda con []");
} catch { mal("un usuario sin items no debería poder equipar badge_mod"); }

// — sin duplicados, preservando el orden de aparición —
try {
  const out = filtrarBadgesPropias(["badge_vip", "badge_first", "badge_vip"], OWNED);
  assert.deepStrictEqual(out, ["badge_vip", "badge_first"]);
  ok("duplicados colapsados, orden preservado");
} catch { mal("debería deduplicar preservando el orden"); }

// — basura defensiva: no-array → null (el caller mantiene lo que ya tenía) —
try {
  assert.strictEqual(filtrarBadgesPropias(undefined, OWNED), null);
  assert.strictEqual(filtrarBadgesPropias("badge_mod", OWNED), null);
  ok("badges no-array → null (no revienta el .join, no pisa lo puesto)");
} catch { mal("un badges no-array debería devolver null, no romper"); }

// — se ignoran entradas no-string y las que traen sintaxis de array de PG —
try {
  const out = filtrarBadgesPropias(["badge_first", 123, null, 'badge_x","badge_mod'], OWNED);
  assert.deepStrictEqual(out, ["badge_first"]);
  ok("entradas no-string / con comillas y llaves: ignoradas (cierra la inyección de array)");
} catch { mal("debería ignorar no-strings y claves inventadas con sintaxis de array"); }

if (fallas) { console.error(`\n${fallas} falla(s)`); process.exit(1); }
console.log("\nTodo verde ✓");
