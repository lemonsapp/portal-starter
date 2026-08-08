// server/lib/canje-estados.js — la máquina de estados de un canje de puntos
// (point_redemptions). Define qué transiciones son legales y cuáles reembolsan,
// para que ningún ciclo devuelva puntos más de una vez.
//
// EL BUG QUE ESTO CIERRA (auditoría 2026-08-08, hallazgo H2): PATCH
// /coins/admin/redemptions/:id sólo miraba "que no esté ya cancelado" antes de
// reembolsar. Nada impedía el ciclo cancelled → fulfilled → cancelled → … y cada
// vuelta por `cancelled` devolvía cost_points otra vez (y +1 de stock). Un canje
// de 1500 pts hecho una sola vez acuñaba 1500 pts por iteración, sin techo.
//
// LA REGLA: `cancelled` es TERMINAL — nunca se sale de cancelado. El reembolso
// ocurre al ENTRAR a cancelled desde pending o fulfilled, y una sola vez (el
// route lo blinda además con `refunded_at IS NULL` en el UPDATE guardado). Sin
// forma de volver de cancelled, no hay ciclo, y sin ciclo no hay minteo.
"use strict";

const ESTADOS = ["pending", "fulfilled", "cancelled"];

// Desde → { hacia: { reembolsa } }. Lo que no está acá, no se permite.
//   pending → fulfilled : entregar/marcar cumplido, sin mover puntos.
//   pending → cancelled : cancelar antes de cumplir, reembolsa.
//   fulfilled → cancelled: revertir un canje ya cumplido (ej. cupón sin usar),
//                          reembolsa una sola vez.
//   cancelled → *       : nada. Estado terminal.
const TRANSICIONES = {
  pending:   { fulfilled: { reembolsa: false }, cancelled: { reembolsa: true } },
  fulfilled: { cancelled: { reembolsa: true } },
  cancelled: {},
};

// Devuelve { permitido, reembolsa }. hasOwnProperty para que un estado con
// nombre de método de Object ("constructor", "toString") no pesque nada del
// prototipo.
function planearTransicionCanje(actual, nuevo) {
  const desde = TRANSICIONES[actual];
  if (!desde || !Object.prototype.hasOwnProperty.call(desde, nuevo)) {
    return { permitido: false, reembolsa: false };
  }
  return { permitido: true, reembolsa: desde[nuevo].reembolsa };
}

// Estados desde los que se PUEDE entrar a `nuevo` (para armar el WHERE del
// UPDATE atómico del route sin duplicar la tabla de arriba).
function estadosOrigenPara(nuevo) {
  return ESTADOS.filter((e) => planearTransicionCanje(e, nuevo).permitido);
}

module.exports = {
  ESTADOS,
  TRANSICIONES,
  planearTransicionCanje,
  estadosOrigenPara,
};
