// server/lib/descuento-packs.js — la regla de plata más cara del checkout:
// un código de descuento NUNCA toca un pack de monedas, y una orden que quede
// en total 0 y tenga un pack NO se auto-marca pagada.
//
// EL BUG QUE ESTO CIERRA (auditoría 2026-08-08, hallazgo H1): los packs de
// monedas se compran a $3.600 y se gastan a $4.000 (spread del 10%). El
// checkout aplicaba el descuento al subtotal ENTERO, packs incluidos, así que:
//   • con un código ≥10% comprabas monedas a ≤$3.240 y las gastabas a $4.000
//     → arbitraje neto por vuelta, repetible hasta 2000 unidades;
//   • con un código 100% off el total caía a 0, la orden nacía `paid` sin que
//     pasara un peso, y creditOrderPoints acreditaba las monedas reales gratis.
// El sistema ya prohíbe pagar packs CON monedas (checkout.js) por exactamente
// esta razón; faltaba el mismo criterio en el camino del descuento.
//
// DECISIÓN DE INTENCIÓN: los cupones son "X% off tu próximo pedido" — nacen del
// canje de puntos (coins.js) y de promos para producto físico. Un pack de
// monedas es comprar saldo de tienda; descontarlo es imprimir dinero. Por eso la
// regla es dura: los packs se excluyen de la base descontable, siempre.
"use strict";

// ¿Esta línea es un pack de monedas? Mismo criterio en todo el checkout: lo
// marca meta.points_pack (pack fijo) o meta.points_custom (puntos a medida).
function esLineaPack(meta) {
  return !!(meta && (meta.points_pack || meta.points_custom));
}

// Centavos sobre los que un código PUEDE descontar: el subtotal sin las líneas
// de pack. items: [{ line_total_cents, es_pack }].
function centavosDescontables(items) {
  if (!Array.isArray(items)) return 0;
  let sum = 0;
  for (const it of items) {
    if (it && !it.es_pack) sum += Number(it.line_total_cents) || 0;
  }
  return sum;
}

// Descuento en centavos, calculado SIEMPRE sobre la base descontable (packs ya
// afuera). `percent` = value% de la base; cualquier otro kind (fixed_cents) =
// value acotado a la base. Nunca negativo, nunca mayor a la base.
function calcularDescuento({ kind, value, descontableCents }) {
  const base = Math.max(0, Math.floor(Number(descontableCents) || 0));
  const v = Math.max(0, Number(value) || 0);
  if (kind === "percent") return Math.floor((base * v) / 100);
  return Math.min(Math.floor(v), base);
}

// Estado inicial de la orden. Una orden gratis (total 0) que contiene un pack de
// monedas NO puede auto-acreditarse: el pack acredita monedas reales, así que
// total 0 + pack = minteo gratis. En ese caso queda pendiente para revisión
// manual — nunca `paid` de una. Post-exclusión de packs esto es casi imposible
// (el valor del pack sobrevive al descuento), pero es el cinturón que garantiza
// que la propiedad de seguridad no dependa de la aritmética de arriba.
function estadoInicialOrden({ totalCents, isMonedasOrder, hayPack }) {
  const gratis = (Number(totalCents) || 0) === 0;
  if (gratis && hayPack) return "pending_payment";
  if (gratis || isMonedasOrder) return "paid";
  return "pending_payment";
}

module.exports = {
  esLineaPack,
  centavosDescontables,
  calcularDescuento,
  estadoInicialOrden,
};
