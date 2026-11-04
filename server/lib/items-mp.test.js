// server/lib/items-mp.test.js — lo que MercadoPago cobra tiene que ser el total
// de la orden. Corrida (sin DB):
//   cd server && node lib/items-mp.test.js
//
// EL CASO REAL (reporte de la tienda, 2026-11-04): un pedido de Línea Pro a
// $98.700 con 10% off mostraba total $88.830, pero la preferencia de MP llevaba
// el producto a precio de lista y el cliente pagaba $98.700.
"use strict";

const assert = require("node:assert");
const { itemsParaMp } = require("./items-mp");

const suma = (items) => items.reduce((s, i) => s + Math.round(i.unit_price * 100) * i.quantity, 0);

const lineaPro = {
  product_id: 7, product_slug: "linea-pro", name_snapshot: "Línea Pro — 4 etapas hidrosolubles · 100g",
  price_cents_snapshot: 9870000, quantity: 1, line_total_cents: 9870000, image_url_snapshot: "/img/lp.jpg",
};

// 1. El caso real: con descuento, MP cobra el total de la orden.
{
  const order = { public_id: "HG-ABC", subtotal_cents: 9870000, discount_cents: 987000, shipping_cents: 0, total_cents: 8883000 };
  const items = itemsParaMp({ order, items: [lineaPro], appUrl: "https://hgrowshop.com" });
  assert.strictEqual(suma(items), 8883000, "MP tiene que cobrar $88.830, no $98.700");
}

// 2. Sin descuento ni envío: queda el detalle por producto, como hoy.
{
  const dos = { ...lineaPro, quantity: 2, line_total_cents: 19740000 };
  const order = { public_id: "HG-1", subtotal_cents: 19740000, discount_cents: 0, shipping_cents: 0, total_cents: 19740000 };
  const items = itemsParaMp({ order, items: [dos], appUrl: "https://hgrowshop.com" });
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].quantity, 2);
  assert.strictEqual(items[0].unit_price, 98700);
  assert.strictEqual(items[0].picture_url, "https://hgrowshop.com/img/lp.jpg");
}

// 3. Con envío y sin descuento: el envío también se cobra.
{
  const order = { public_id: "HG-2", subtotal_cents: 9870000, discount_cents: 0, shipping_cents: 500000, total_cents: 10370000 };
  const items = itemsParaMp({ order, items: [lineaPro], appUrl: "" });
  assert.strictEqual(suma(items), 10370000, "el envío entra en lo que cobra MP");
}

// 4. Descuento + envío: total exacto.
{
  const order = { public_id: "HG-3", subtotal_cents: 9870000, discount_cents: 987000, shipping_cents: 500000, total_cents: 9383000 };
  assert.strictEqual(suma(itemsParaMp({ order, items: [lineaPro], appUrl: "" })), 9383000);
}

// 5. Descuento en pesos que deja centavos raros: nunca se cobra ni un centavo distinto.
{
  const order = { public_id: "HG-4", subtotal_cents: 333333, discount_cents: 33333, shipping_cents: 0, total_cents: 300000 };
  const it = { ...lineaPro, price_cents_snapshot: 111111, quantity: 3, line_total_cents: 333333 };
  assert.strictEqual(suma(itemsParaMp({ order, items: [it], appUrl: "" })), 300000);
}

// 6. Si los renglones no suman el total por cualquier motivo, manda el total.
{
  const order = { public_id: "HG-5", subtotal_cents: 9870000, discount_cents: 0, shipping_cents: 0, total_cents: 9000000 };
  assert.strictEqual(suma(itemsParaMp({ order, items: [lineaPro], appUrl: "" })), 9000000);
}

console.log("items-mp: 6/6 ok");
