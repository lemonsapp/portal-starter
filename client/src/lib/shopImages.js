// client/src/lib/shopImages.js
//
// Normalización de URLs de imágenes de producto en el cliente.
//
// Por qué: la DB de producción quedó con filas product_images de una
// organización vieja de la línea Race (floración part-a/b, pk-rosa, race-4
// celeste) que apuntan a archivos que ya no existen → 404 / imagen en blanco.
// El server ya tiene una migración de reconciliación (server/routes/shop.js),
// pero hasta que el backend redeploye seguimos recibiendo los paths viejos.
// Este mapa los corrige en el cliente para que el catálogo se vea bien YA.
//
// Espeja exactamente el mapeo del server (por color: verde/celeste/violeta/rosa
// son los 5 únicos renders por tamaño que existen). Idempotente: si el path ya
// está bien, lo devuelve sin tocar.

const RACE_IMG_FIXES = {
  // 250ml
  "/img/productos/linea-race/250ml/race-2-part-a.png": "/img/productos/linea-race/250ml/race-3-violeta-a.png",
  "/img/productos/linea-race/250ml/race-2-part-b.png": "/img/productos/linea-race/250ml/race-3-violeta-b.png",
  "/img/productos/linea-race/250ml/race-3-rosa.png": "/img/productos/linea-race/250ml/race-4-rosa.png",
  "/img/productos/linea-race/250ml/race-4-celeste.png": "/img/productos/linea-race/250ml/race-4-rosa.png",
  // 500ml
  "/img/productos/linea-race/500ml/race-2-part-a-500ml.png": "/img/productos/linea-race/500ml/race-3-violeta-a-500ml.png",
  "/img/productos/linea-race/500ml/race-2-part-b-500ml.png": "/img/productos/linea-race/500ml/race-3-violeta-b-500ml.png",
  "/img/productos/linea-race/500ml/race-3-rosa-500ml.png": "/img/productos/linea-race/500ml/race-4-rosa-500ml.png",
  "/img/productos/linea-race/500ml/race-4-celeste-500ml.png": "/img/productos/linea-race/500ml/race-4-rosa-500ml.png",
};

// SVG on-brand para productos sin imagen (ej. packs de puntos en backend viejo).
export const PRODUCT_FALLBACK_IMG = "/img/productos/puntos/pack-puntos.svg";

/** Devuelve la URL corregida si era un path Race viejo; si no, la original. */
export function fixImageUrl(url) {
  if (!url) return url;
  return RACE_IMG_FIXES[url] || url;
}
