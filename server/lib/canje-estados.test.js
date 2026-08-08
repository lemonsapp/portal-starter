// server/lib/canje-estados.test.js — la máquina de estados del canje: qué
// transiciones son legales y cuáles reembolsan. Corrida (sin DB):
//   cd server && node lib/canje-estados.test.js
//
// EL CASO REAL (auditoría 2026-08-08, hallazgo H2): PATCH
// /coins/admin/redemptions/:id sólo chequeaba "que no esté ya cancelado", así
// que el ciclo cancelled → fulfilled → cancelled → … reembolsaba cost_points en
// cada vuelta, sin techo. Acá se prueba que `cancelled` es terminal: sin vuelta
// desde cancelled no hay ciclo, y el reembolso ocurre a lo sumo una vez.
"use strict";

const assert = require("node:assert");
const {
  ESTADOS, planearTransicionCanje, estadosOrigenPara,
} = require("./canje-estados");

let fallas = 0;
function ok(msg) { console.log(`✓ ${msg}`); }
function mal(msg) { fallas++; console.error(`✗ ${msg}`); }

// ── Transiciones legales ────────────────────────────────
try {
  assert.deepStrictEqual(planearTransicionCanje("pending", "fulfilled"), { permitido: true, reembolsa: false },
    "pending→fulfilled: entregar, sin mover puntos");
  assert.deepStrictEqual(planearTransicionCanje("pending", "cancelled"), { permitido: true, reembolsa: true },
    "pending→cancelled: reembolsa");
  assert.deepStrictEqual(planearTransicionCanje("fulfilled", "cancelled"), { permitido: true, reembolsa: true },
    "fulfilled→cancelled: reembolsa una vez (ej. cupón sin usar)");
  ok("las tres transiciones legales dan el reembolso correcto");
} catch (e) { mal(`transiciones legales: ${e.message}`); }

// ── cancelled es TERMINAL: acá se corta el minteo ───────────────
try {
  assert.strictEqual(planearTransicionCanje("cancelled", "fulfilled").permitido, false,
    "no se sale de cancelled (esto rompía el ciclo de minteo)");
  assert.strictEqual(planearTransicionCanje("cancelled", "cancelled").permitido, false,
    "no se re-cancela un cancelado");
  assert.strictEqual(planearTransicionCanje("cancelled", "pending").permitido, false,
    "no se revive un cancelado");
  ok("cancelled es terminal: ninguna transición sale de ahí");
} catch (e) { mal(`cancelled terminal: ${e.message}`); }

// ── Transiciones sin sentido, rechazadas ────────────────
try {
  for (const [a, b] of [["fulfilled", "pending"], ["fulfilled", "fulfilled"], ["pending", "pending"]]) {
    assert.strictEqual(planearTransicionCanje(a, b).permitido, false, `${a}→${b} no debe permitirse`);
  }
  ok("re-entrar al mismo estado y volver a pending están prohibidos");
} catch (e) { mal(`transiciones inválidas: ${e.message}`); }

// EL NÚCLEO DE H2: el ciclo cancelled→fulfilled→cancelled no puede reembolsar
// dos veces. Simulamos el ciclo desde una tenencia real y contamos reembolsos.
try {
  let estado = "pending";
  let reembolsos = 0;
  // secuencia de intentos que un atacante haría para farmear el reembolso:
  const intentos = ["cancelled", "fulfilled", "cancelled", "fulfilled", "cancelled"];
  for (const nuevo of intentos) {
    const plan = planearTransicionCanje(estado, nuevo);
    if (plan.permitido) {
      if (plan.reembolsa) reembolsos++;
      estado = nuevo; // sólo avanza si fue legal
    }
  }
  assert.strictEqual(reembolsos, 1, "el ciclo reembolsa exactamente una vez, no una por vuelta");
  assert.strictEqual(estado, "cancelled", "queda clavado en cancelled");
  ok("H2: cancelled→fulfilled→cancelled… reembolsa UNA sola vez (queda terminal en cancelled)");
} catch (e) { mal(`H2 ciclo: ${e.message}`); }

// ── estadosOrigenPara: lo que el route mete en el WHERE del UPDATE ──
try {
  assert.deepStrictEqual(estadosOrigenPara("cancelled").sort(), ["fulfilled", "pending"],
    "se cancela desde pending o fulfilled");
  assert.deepStrictEqual(estadosOrigenPara("fulfilled"), ["pending"],
    "sólo se cumple desde pending");
  ok("estadosOrigenPara da los orígenes legales para el UPDATE guardado del route");
} catch (e) { mal(`estadosOrigenPara: ${e.message}`); }

// ── Prototype pollution: un estado con nombre de método de Object ──
try {
  for (const basura of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
    assert.strictEqual(planearTransicionCanje(basura, "cancelled").permitido, false,
      `${basura} como estado actual no debe enganchar nada`);
    assert.strictEqual(planearTransicionCanje("pending", basura).permitido, false,
      `${basura} como estado nuevo no debe enganchar nada`);
  }
  ok("un estado con nombre de método de Object no pesca transiciones del prototipo");
} catch (e) { mal(`prototype pollution: ${e.message}`); }

// ── Bordes ──────────────────────────────────
try {
  assert.strictEqual(planearTransicionCanje(undefined, "cancelled").permitido, false, "actual undefined");
  assert.strictEqual(planearTransicionCanje("pending", undefined).permitido, false, "nuevo undefined");
  assert.deepStrictEqual(ESTADOS, ["pending", "fulfilled", "cancelled"], "los tres estados del schema");
  ok("bordes: estados ausentes se rechazan");
} catch (e) { mal(`bordes: ${e.message}`); }

if (fallas > 0) {
  console.error(`\n${fallas} fallas.`);
  process.exit(1);
}
console.log("\nTodo verde.");
