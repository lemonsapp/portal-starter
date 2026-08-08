// server/lib/credito-atomico.js — acreditar puntos exactamente una vez, aunque
// dispares la misma operación N veces en paralelo. La escritura ES la compuerta.
//
// EL BUG QUE ESTO CIERRA (auditoría 2026-08-08, hallazgo H6): tanto la
// aprobación de evidencias de Instagram (PATCH /coins/admin/ig/:id) como el
// reembolso de canjes leían el estado con una query y acreditaban con otra. Dos
// requests concurrentes sobre el mismo id pasaban las DOS la lectura de "está
// pending" antes de que ninguna escribiera, y las DOS ejecutaban `balance + $1`.
// En full_cycle (167 pts) eran 167 × N puntos desde una sola evidencia. Es el
// mismo doble-gasto que ya está bien resuelto en el débito de /redeem-points.
//
// EL PATRÓN: `reclamar` es un UPDATE condicional único (… WHERE status='pending'
// RETURNING) cuyo propio resultado dice si ganaste. Se acredita SÓLO si ganaste.
// Como la condición y el cambio de estado viven en la MISMA sentencia atómica,
// exactamente un request en la carrera devuelve fila; el resto acredita cero.
"use strict";

/**
 * @param {() => Promise<boolean>} reclamar  UPDATE condicional atómico; true si
 *        esta llamada ganó la transición (devolvió fila), false si no.
 * @param {() => Promise<void>}   acreditar  el crédito; corre SÓLO si se ganó.
 * @returns {Promise<boolean>} si esta llamada fue la ganadora.
 */
async function acreditarSiGana(reclamar, acreditar) {
  const gano = await reclamar();
  if (gano) await acreditar();
  return gano;
}

module.exports = { acreditarSiGana };
