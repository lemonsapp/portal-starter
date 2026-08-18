// server/lib/entregaCloudinary.test.js
//
// Tests de optimizarEntrega. Corre así:
//   cd server && node lib/entregaCloudinary.test.js
//
// Puro, sin DB ni red.

"use strict";

const assert = require("assert/strict");
const { optimizarEntrega } = require("./entregaCloudinary");

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

const BASE = "https://res.cloudinary.com/drdha21z8/image/upload";

test("inyecta f_auto,q_auto,w_1000,c_limit en una URL de entrega sin transformación", () => {
  assert.equal(
    optimizarEntrega(`${BASE}/v1783397976/portal-shop/abc.png`),
    `${BASE}/f_auto,q_auto,w_1000,c_limit/v1783397976/portal-shop/abc.png`
  );
});

test("respeta un ancho custom", () => {
  assert.equal(
    optimizarEntrega(`${BASE}/v1/portal-shop/abc.png`, 400),
    `${BASE}/f_auto,q_auto,w_400,c_limit/v1/portal-shop/abc.png`
  );
});

test("no toca una URL que ya trae transformación", () => {
  const ya = `${BASE}/w_300,h_300,c_fill/v1/portal-items/x.png`;
  assert.equal(optimizarEntrega(ya), ya);
});

test("no toca una URL sin versión pero ya transformada (una sola transformación)", () => {
  const ya = `${BASE}/f_auto/v1/portal-shop/x.png`;
  assert.equal(optimizarEntrega(ya), ya);
});

test("no toca rutas locales del bundle", () => {
  const local = "/imagenes-web/productos/linea-race/500ml/race-unificado.png";
  assert.equal(optimizarEntrega(local), local);
});

test("no toca URLs de otros dominios", () => {
  const otra = "https://example.com/image/upload/v1/foo.png";
  assert.equal(optimizarEntrega(otra), otra);
});

test("no toca videos de Cloudinary", () => {
  const video = "https://res.cloudinary.com/drdha21z8/video/upload/v1/clip.mp4";
  assert.equal(optimizarEntrega(video), video);
});

test("devuelve intacto lo que no es string", () => {
  assert.equal(optimizarEntrega(null), null);
  assert.equal(optimizarEntrega(undefined), undefined);
  assert.equal(optimizarEntrega(42), 42);
});

test("URL sin carpeta de versión (public id directo) también se optimiza", () => {
  assert.equal(
    optimizarEntrega(`${BASE}/portal-shop/abc.png`),
    `${BASE}/f_auto,q_auto,w_1000,c_limit/portal-shop/abc.png`
  );
});

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
