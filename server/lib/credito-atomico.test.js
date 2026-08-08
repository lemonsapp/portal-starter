// server/lib/credito-atomico.test.js — la compuerta atómica de crédito, disparada
// EN PARALELO contra un fake que serializa como un row lock de Postgres. Corrida:
//   cd server && node lib/credito-atomico.test.js
//
// EL CASO REAL (auditoría 2026-08-08, hallazgo H6): aprobar una evidencia de IG
// (full_cycle = 167 pts) o reembolsar un canje leía el estado con una query y
// acreditaba con otra. Dos requests concurrentes pasaban las DOS el chequeo de
// "está pending" y acreditaban las DOS. Un test secuencial no lo ve: cada llamada
// por separado hace lo correcto. Hay que dispararlas encimadas y contar créditos.
//
// El fake modela la carrera con un yield real (microtask) ANTES de la operación:
//   • claimSiPending() hace check+set SIN await en el medio → atómico como
//     `UPDATE … WHERE status='pending' RETURNING` (compuerta correcta).
//   • getEstado()/setEstado() son dos pasos con hueco → el patrón roto (TOCTOU).
"use strict";

const assert = require("node:assert");
const { acreditarSiGana } = require("./credito-atomico");

let fallas = 0;
function ok(msg) { console.log(`✓ ${msg}`); }
function mal(msg) { fallas++; console.error(`✗ ${msg}`); }

const tick = () => new Promise((r) => setTimeout(r, 0));

// Una fila con un estado, que serializa como una fila de Postgres bajo lock.
function filaConcurrente(estadoInicial) {
  let estado = estadoInicial;
  return {
    // Compuerta ATÓMICA: el check y el set ocurren en el mismo turno síncrono,
    // sin await entre medio → equivale al UPDATE condicional con RETURNING.
    async claimSiPending(nuevo) {
      await tick();                 // espera la "query" (cede el hilo)
      if (estado === "pending") {   // check + set atómicos: nadie se cuela acá
        estado = nuevo;
        return true;
      }
      return false;
    },
    // Patrón ROTO (TOCTOU): leer y escribir en pasos separados, con hueco.
    async getEstado() { await tick(); return estado; },
    async setEstado(s) { await tick(); estado = s; },
    verEstado() { return estado; },
  };
}

// ── EL FIX: acreditarSiGana + claim atómico, en paralelo → exactamente 1 ─────
async function testFix() {
  const fila = filaConcurrente("pending");
  let creditos = 0;
  const aprobar = () => acreditarSiGana(
    () => fila.claimSiPending("approved"),
    async () => { await tick(); creditos += 167; }   // el crédito de full_cycle
  );
  // Dos aprobaciones de la MISMA evidencia, encimadas.
  const [a, b] = await Promise.all([aprobar(), aprobar()]);
  assert.strictEqual(creditos, 167, "sólo un crédito de 167, no 334");
  assert.strictEqual([a, b].filter(Boolean).length, 1, "exactamente una llamada gana");
  assert.strictEqual(fila.verEstado(), "approved", "la evidencia queda aprobada una vez");
}

// ── Refuerzo con más concurrencia: 10 requests, un solo crédito ──────────────
async function testFixDiez() {
  const fila = filaConcurrente("pending");
  let creditos = 0;
  const aprobar = () => acreditarSiGana(
    () => fila.claimSiPending("approved"),
    async () => { creditos += 1; }
  );
  const res = await Promise.all(Array.from({ length: 10 }, aprobar));
  assert.strictEqual(creditos, 1, "10 requests → un solo crédito");
  assert.strictEqual(res.filter(Boolean).length, 1, "sólo una ganadora entre diez");
}

// ── LA MUTACIÓN QUE PRUEBA QUE EL TEST MUERDE: el patrón roto (read-then-write)
// deja pasar a las dos → 334. Si esto NO fallara, el test de arriba no valdría.
async function aprobarRoto(fila, onCredit) {
  const st = await fila.getEstado();         // read
  if (st !== "pending") return false;
  await onCredit();                          // hueco: la otra request corre acá
  await fila.setEstado("approved");          // write
  return true;
}
async function testRotoDobleAcredita() {
  const fila = filaConcurrente("pending");
  let creditos = 0;
  const [a, b] = await Promise.all([
    aprobarRoto(fila, async () => { await tick(); creditos += 167; }),
    aprobarRoto(fila, async () => { await tick(); creditos += 167; }),
  ]);
  // Demostración del bug: el patrón viejo acredita DOS veces.
  assert.strictEqual(creditos, 334, "el patrón roto SÍ doble-acredita (por eso hizo falta el fix)");
  assert.strictEqual([a, b].filter(Boolean).length, 2, "las dos creen haber ganado");
}

(async () => {
  try { await testFix(); ok("H6 fix: dos aprobaciones en paralelo acreditan 167 UNA sola vez"); }
  catch (e) { mal(`el fix no serializó: ${e.message}`); }

  try { await testFixDiez(); ok("H6 fix: 10 requests concurrentes → un único crédito, una única ganadora"); }
  catch (e) { mal(`el fix falló con más concurrencia: ${e.message}`); }

  try { await testRotoDobleAcredita(); ok("mutación: el patrón read-then-write doble-acredita (334) — el test muerde"); }
  catch (e) { mal(`la mutación no reprodujo el doble-gasto: ${e.message}`); }

  if (fallas > 0) {
    console.error(`\n${fallas} fallas.`);
    process.exit(1);
  }
  console.log("\nTodo verde.");
})();
