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

const IMG_FIXES = {
  // 250ml
  "/img/productos/linea-race/250ml/race-2-part-a.png": "/img/productos/linea-race/250ml/race-3-violeta-a.png",
  "/img/productos/linea-race/250ml/race-2-part-b.png": "/img/productos/linea-race/250ml/race-3-violeta-b.png",
  "/img/productos/linea-race/250ml/race-3-rosa.png": "/img/productos/linea-race/250ml/race-4-rosa.png",
  // race-4-celeste es el path que tiene el SKU VIVO de R4 250ml en prod →
  // directo al tarro (fixImageUrl es de una sola pasada, no re-encadena).
  "/img/productos/linea-race/250ml/race-4-celeste.png": "/imagenes-web/productos/linea-race/250ml/race-4-rosa-tarro.webp",
  // 500ml
  "/img/productos/linea-race/500ml/race-2-part-a-500ml.png": "/img/productos/linea-race/500ml/race-3-violeta-a-500ml.png",
  "/img/productos/linea-race/500ml/race-2-part-b-500ml.png": "/img/productos/linea-race/500ml/race-3-violeta-b-500ml.png",
  "/img/productos/linea-race/500ml/race-3-rosa-500ml.png": "/img/productos/linea-race/500ml/race-4-rosa-500ml.png",
  // Ídem 250ml: path vivo del SKU R4 500ml en prod → tarro directo.
  "/img/productos/linea-race/500ml/race-4-celeste-500ml.png": "/imagenes-web/productos/linea-race/250ml/race-4-rosa-tarro.webp",
  // Cloner: render viejo (cloner2) → render holográfico del home
  // (mismo pote que ComplementosIdeales en el inicio, 2026-06-05).
  "/assets/productos/cloner2.png": "/ultimos-cambios/POTE-CLONER-HOME.png",
  // Auditoría de fotos 2026-06-05 (espeja la reconciliación del server):
  // kit Elite mostraba bidones Max · Parte 1 500ml sin "PART 1" visible ·
  // Elite Max 5L B apuntaba a un render "a-" (Parte A).
  "/img/productos/linea-elite/elite-unificado.png": "/ultimos-cambios/POTE-ELITE-UNIFICADO-INTERNA.png",
  "/img/productos/linea-elite/500gr/parte-1-lateral.png": "/img/productos/linea-elite/elite-part-1.png",
  "/img/productos/elite-max/a-5-lts-perspectiva-2.png": "/img/productos/elite-max/b-5-lts-perspectiva-1.png",

  // Tarros Race de costado (2026-06-07, pedido del cliente): mientras el
  // server no redeploye su migración (routes/shop.js), la DB sigue mandando
  // los paths viejos de Race. Acá los mapeamos al TARRO dosificador de cada
  // fórmula (el envase real de 250ml/500ml/1L). R3 A y B comparten el tarro
  // violeta; 500ml de R3/R4 reusan el arte 250 (la medida no se ve en el
  // render). Cuando el server redeploye manda -tarro.webp directo y estas
  // keys dejan de matchear solas.
  "/img/productos/linea-race/250ml/race-1-verde.png":         "/imagenes-web/productos/linea-race/250ml/race-1-verde-tarro.webp",
  "/img/productos/linea-race/250ml/race-2-celeste.png":       "/imagenes-web/productos/linea-race/250ml/race-2-celeste-tarro.webp",
  "/img/productos/linea-race/250ml/race-3-violeta-a.png":     "/imagenes-web/productos/linea-race/250ml/race-3-violeta-tarro.webp",
  "/img/productos/linea-race/250ml/race-3-violeta-b.png":     "/imagenes-web/productos/linea-race/250ml/race-3-violeta-tarro.webp",
  "/img/productos/linea-race/250ml/race-4-rosa.png":          "/imagenes-web/productos/linea-race/250ml/race-4-rosa-tarro.webp",
  "/img/productos/linea-race/500ml/race-2-celeste-500ml.png": "/imagenes-web/productos/linea-race/500ml/race-2-celeste-tarro-500ml.webp",
  "/img/productos/linea-race/500ml/race-3-violeta-a-500ml.png": "/imagenes-web/productos/linea-race/250ml/race-3-violeta-tarro.webp",
  "/img/productos/linea-race/500ml/race-3-violeta-b-500ml.png": "/imagenes-web/productos/linea-race/250ml/race-3-violeta-tarro.webp",
  "/img/productos/linea-race/500ml/race-4-rosa-500ml.png":    "/imagenes-web/productos/linea-race/250ml/race-4-rosa-tarro.webp",
  // El kit linea-race en prod tiene como primaria la botella R1 500ml suelta
  // → mostramos la foto familia (los 5 potes). Efecto colateral menor: el SKU
  // race-1-npk-500ml comparte URL y muestra la familia hasta el redeploy.
  "/img/productos/linea-race/500ml/race-1-verde-500ml.png":   "/imagenes-web/productos/linea-race/500ml/race-unificado.png",
};

// SVG on-brand para productos sin imagen (ej. packs de puntos en backend viejo).
export const PRODUCT_FALLBACK_IMG = "/imagenes-web/productos/puntos/pack-puntos.svg";

// Consolidación 2026-06-06: TODAS las imágenes servidas viven ahora en
// landing/public/imagenes-web/. La DB de producción puede seguir devolviendo
// los prefijos viejos hasta que el server redeploye su migración (routes/
// shop.js), así que normalizamos acá. Espeja los rewrites de vercel.json.
const PREFIX_MOVES = [
  ["/img/",               "/imagenes-web/"],
  ["/assets/productos/",  "/imagenes-web/fotos-productos/"],
  ["/ultimos-cambios/",   "/imagenes-web/ultimos-cambios/"],
];

/** Devuelve la URL corregida (path viejo → render real → carpeta nueva). */
export function fixImageUrl(url) {
  if (!url) return url;
  const fixed = IMG_FIXES[url] || url;
  for (const [oldPrefix, newPrefix] of PREFIX_MOVES) {
    if (fixed.startsWith(oldPrefix)) return newPrefix + fixed.slice(oldPrefix.length);
  }
  return fixed;
}

// Productos Race fantasma del esquema viejo que quedaron en la DB de
// producción (duplican a los SKUs actuales con nombres/colores incorrectos,
// ej. "Race 2 — Floración" con la botella violeta que hoy es Race 3).
// El server los desactiva al redeployar (migración en routes/shop.js);
// este set los oculta en el cliente mientras tanto. Mismo patrón espejo
// que IMG_FIXES.
export const STALE_PRODUCT_SLUGS = new Set([
  "race-1-vegetativo-250ml", "race-1-vegetativo-500ml",
  "race-2-floracion-part-a-250ml", "race-2-floracion-part-a-500ml",
  "race-2-floracion-part-b-250ml", "race-2-floracion-part-b-500ml",
  "race-3-pk-rosa-250ml", "race-3-pk-rosa-500ml",
]);

/** true si el slug pertenece a un producto fantasma a ocultar. */
export function isStaleProduct(slug) {
  return STALE_PRODUCT_SLUGS.has(slug);
}
