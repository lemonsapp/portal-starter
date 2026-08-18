// server/lib/entregaCloudinary.js
//
// Optimiza URLs de ENTREGA de Cloudinary inyectando f_auto,q_auto,w_<ancho>,
// c_limit. Nació el 2026-08-18: los renders de producto se subieron como PNG
// crudos (hasta 5.3 MB) y cada visita al Shop quemaba el bandwidth del plan
// — fue lo que dejó la cuenta deshabilitada y la tienda sin imágenes.
// Con la transformación, la misma imagen sale como webp/avif de ~90 KB.
//
// Sólo toca URLs https://res.cloudinary.com/<cloud>/image/upload/... que no
// traigan ya una transformación; el resto (rutas locales del bundle, videos,
// URLs ajenas, no-strings) pasa intacto. La imagen original en Cloudinary no
// se modifica: es una variante de entrega, cacheada en su CDN.

"use strict";

const PREFIJO = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/;

// Un segmento de transformación es "algo_valor" o varios separados por coma
// (w_300,h_300,c_fill). Un public id o carpeta normal no tiene esa forma.
const YA_TRANSFORMADA = /^[a-z]{1,4}_[^/]+$/;

function optimizarEntrega(url, ancho = 1000) {
  if (typeof url !== "string") return url;
  const m = url.match(PREFIJO);
  if (!m) return url;

  const primerSegmento = m[2].split("/")[0];
  if (YA_TRANSFORMADA.test(primerSegmento)) return url;

  return `${m[1]}f_auto,q_auto,w_${ancho},c_limit/${m[2]}`;
}

module.exports = { optimizarEntrega };
