// server/lib/items-mp.js — los renglones que se mandan a MercadoPago.
//
// EL BUG QUE ESTO CIERRA (reporte de la tienda, 2026-11-04): la preferencia
// llevaba cada producto a precio de lista y nunca el descuento ni el envío.
// La orden guardaba bien total_cents ($88.830 con 10% off), pero MP cobraba la
// suma de los productos ($98.700). Venía así desde el primer checkout con MP.
//
// REGLA: lo que suman los renglones es SIEMPRE order.total_cents, al centavo.
// - Sin descuento: el detalle por producto, y el envío como un renglón más.
// - Con descuento (MP no acepta precios negativos): un solo renglón con el
//   total del pedido; el detalle sigue en la orden, el mail y el panel.
"use strict";

function urlDeImagen(url, appUrl) {
  if (!url) return undefined;
  return url.startsWith("http") ? url : `${appUrl}${url}`;
}

function sumaCents(mpItems) {
  return mpItems.reduce((s, it) => s + Math.round(it.unit_price * 100) * it.quantity, 0);
}

function itemsParaMp({ order, items, appUrl }) {
  const total = Number(order.total_cents) || 0;
  const descuento = Number(order.discount_cents) || 0;
  const envio = Number(order.shipping_cents) || 0;

  const resumen = () => [{
    id: String(order.public_id),
    title: items.length === 1
      ? `${items[0].name_snapshot}${items[0].quantity > 1 ? ` x${items[0].quantity}` : ""} · pedido ${order.public_id}`
      : `Pedido HOLISTIC ${order.public_id} (${items.length} productos)`,
    quantity: 1,
    currency_id: "ARS",
    unit_price: total / 100,
    picture_url: urlDeImagen(items[0] && items[0].image_url_snapshot, appUrl),
  }];

  if (descuento > 0) return resumen();

  const detalle = items.map((it) => ({
    id: String(it.product_id || it.product_slug),
    title: it.name_snapshot,
    quantity: it.quantity,
    currency_id: "ARS",
    unit_price: it.price_cents_snapshot / 100,
    picture_url: urlDeImagen(it.image_url_snapshot, appUrl),
  }));
  if (envio > 0) {
    detalle.push({ id: "envio", title: "Envío", quantity: 1, currency_id: "ARS", unit_price: envio / 100 });
  }

  // Cinturón: si por cualquier motivo el detalle no da el total, manda el total.
  return sumaCents(detalle) === total ? detalle : resumen();
}

module.exports = { itemsParaMp };
