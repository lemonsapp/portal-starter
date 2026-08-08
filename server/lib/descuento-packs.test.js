// server/lib/descuento-packs.test.js — la exclusión de los packs de monedas del
// descuento, y la guarda de la orden gratis. Corrida (sin DB):
//   cd server && node lib/descuento-packs.test.js
//
// EL CASO REAL (auditoría 2026-08-08, hallazgo H1): un código 100% off sobre un
// pack de monedas dejaba total=0, la orden nacía `paid` y se acreditaban las
// monedas reales gratis; y cualquier código ≥10% abría arbitraje comprando
// monedas a ≤$3.240 para gastarlas a $4.000. La regla probada acá: los packs
// nunca entran en la base descontable, y una orden gratis con pack no se paga sola.
"use strict";

const assert = require("node:assert");
const {
  esLineaPack, centavosDescontables, calcularDescuento, estadoInicialOrden,
} = require("./descuento-packs");

let fallas = 0;
function ok(msg) { console.log(`✓ ${msg}`); }
function mal(msg) { fallas++; console.error(`✗ ${msg}`); }

// ── esLineaPack: qué cuenta como pack de monedas ────────────────
try {
  assert.strictEqual(esLineaPack({ points_pack: 100 }), true, "points_pack es pack");
  assert.strictEqual(esLineaPack({ points_custom: true }), true, "points_custom es pack");
  assert.strictEqual(esLineaPack({ bundle: true }), false, "un kit físico no es pack");
  assert.strictEqual(esLineaPack({}), false, "producto físico común");
  assert.strictEqual(esLineaPack(null), false, "sin meta");
  assert.strictEqual(esLineaPack(undefined), false, "meta undefined");
  ok("esLineaPack marca sólo los packs de monedas (points_pack / points_custom)");
} catch (e) { mal(`esLineaPack: ${e.message}`); }

// ── centavosDescontables: los packs salen de la base ────────────
try {
  const items = [
    { line_total_cents: 500000, es_pack: true },   // pack de monedas
    { line_total_cents: 120000, es_pack: false },  // sustrato
    { line_total_cents: 80000,  es_pack: false },  // maceta
  ];
  assert.strictEqual(centavosDescontables(items), 200000, "sólo las dos líneas físicas");
  ok("centavosDescontables suma sólo lo NO-pack (el pack no descuenta)");
} catch (e) { mal(`centavosDescontables: ${e.message}`); }

try {
  const soloPacks = [
    { line_total_cents: 500000, es_pack: true },
    { line_total_cents: 360000, es_pack: true },
  ];
  assert.strictEqual(centavosDescontables(soloPacks), 0, "carrito de puros packs no descuenta nada");
  assert.strictEqual(centavosDescontables([]), 0, "carrito vacío");
  assert.strictEqual(centavosDescontables(null), 0, "no-array");
  ok("un carrito de puros packs tiene base descontable 0");
} catch (e) { mal(`centavosDescontables packs: ${e.message}`); }

// ── calcularDescuento: siempre sobre la base descontable ────────
try {
  assert.strictEqual(calcularDescuento({ kind: "percent", value: 10, descontableCents: 200000 }), 20000, "10% de $2000");
  assert.strictEqual(calcularDescuento({ kind: "percent", value: 100, descontableCents: 200000 }), 200000, "100% del físico");
  assert.strictEqual(calcularDescuento({ kind: "fixed_cents", value: 50000, descontableCents: 200000 }), 50000, "fijo cabe");
  assert.strictEqual(calcularDescuento({ kind: "fixed_cents", value: 999999, descontableCents: 200000 }), 200000, "fijo se acota a la base");
  ok("calcularDescuento aplica percent/fixed sobre la base descontable, acotado");
} catch (e) { mal(`calcularDescuento: ${e.message}`); }

// EL NÚCLEO DE H1: un 100% off sobre un carrito de PUROS packs descuenta 0.
try {
  const base = centavosDescontables([{ line_total_cents: 500000, es_pack: true }]);
  const desc = calcularDescuento({ kind: "percent", value: 100, descontableCents: base });
  assert.strictEqual(desc, 0, "el 100% off no puede tocar el pack");
  ok("H1: un código 100% off sobre un pack descuenta 0 — no hay total=0 por cupón");
} catch (e) { mal(`H1 núcleo: ${e.message}`); }

// El arbitraje del ≥10%: descuento 0 sobre el pack → sin diferencia que raspar.
try {
  const base = centavosDescontables([{ line_total_cents: 360000, es_pack: true }]);
  assert.strictEqual(calcularDescuento({ kind: "percent", value: 10, descontableCents: base }), 0,
    "10% sobre un pack = 0, no hay arbitraje");
  ok("H1: ningún % descuenta un pack → se cierra el arbitraje compra $3.600 / gasto $4.000");
} catch (e) { mal(`H1 arbitraje: ${e.message}`); }

// ── estadoInicialOrden: la orden gratis con pack NO se paga sola ─
try {
  assert.strictEqual(estadoInicialOrden({ totalCents: 0, isMonedasOrder: false, hayPack: true }),
    "pending_payment", "gratis + pack = pendiente, nunca paid");
  assert.strictEqual(estadoInicialOrden({ totalCents: 0, isMonedasOrder: false, hayPack: false }),
    "paid", "gratis físico (100% off sin packs) sí paga — no mintea monedas");
  assert.strictEqual(estadoInicialOrden({ totalCents: 500000, isMonedasOrder: true, hayPack: false }),
    "paid", "pago con monedas nace paid");
  assert.strictEqual(estadoInicialOrden({ totalCents: 500000, isMonedasOrder: false, hayPack: false }),
    "pending_payment", "compra normal espera pago");
  ok("estadoInicialOrden: gratis+pack queda pendiente; el resto conserva su camino");
} catch (e) { mal(`estadoInicialOrden: ${e.message}`); }

// Integración: código 100% off sobre pack ⇒ total sigue siendo el precio del
// pack, estado pendiente ⇒ el pack no auto-acredita monedas.
try {
  const packCents = 500000;
  const items = [{ line_total_cents: packCents, es_pack: true }];
  const subtotal = packCents;
  const base = centavosDescontables(items);
  const desc = calcularDescuento({ kind: "percent", value: 100, descontableCents: base });
  const total = Math.max(0, subtotal - desc + 0);
  const estado = estadoInicialOrden({ totalCents: total, isMonedasOrder: false, hayPack: true });
  assert.strictEqual(desc, 0, "descuento 0");
  assert.strictEqual(total, packCents, "el total sigue siendo el precio real del pack");
  assert.notStrictEqual(estado, "paid", "no nace pagada → creditOrderPoints no corre gratis");
  ok("H1 integración: 100% off + pack ⇒ total intacto y orden NO paid ⇒ cero monedas gratis");
} catch (e) { mal(`H1 integración: ${e.message}`); }

if (fallas > 0) {
  console.error(`\n${fallas} fallas.`);
  process.exit(1);
}
console.log("\nTodo verde.");
