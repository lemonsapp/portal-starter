// server/routes/shopImageSet.js
//
// FUENTE DE VERDAD ÚNICA de las imágenes de cada producto del shop, por slug.
//
// Por qué existe: el seed de routes/shop.js inserta imágenes con
// `WHERE NOT EXISTS`, así que en la DB de PRODUCCIÓN (ya sembrada con una
// organización vieja) las URLs corregidas nunca se reescriben, y la pila de
// bloques de reconciliación depende de match EXACTO de `old_url`
// (`WHERE pi.url = old_url`): cualquier URL de prod que no coincida carácter
// por carácter queda rota (tapas flotando, plantillas "PART" a medias,
// miniaturas de galería vacías). Ver capturas store-ejemplo*.png.
//
// Solución: re-author determinístico. Para cada slug de este mapa, borramos
// sus product_images y reinsertamos el set canónico. Corre UNA sola vez por
// versión (marcador en la tabla shop_migrations) → en el próximo deploy de
// Render arregla todo, y en boots posteriores es no-op (no pisa ediciones que
// el admin haga después). Si el cliente sube renders nuevos, se sube
// IMAGE_SET_VERSION y vuelve a correr.
//
// Todos los paths se verifican contra disco con scripts/verify-shop-images.* —
// no agregar una URL acá sin que el archivo exista en landing/public.

// Subí este número cuando cambie el set de imágenes → re-author en el próximo deploy.
const IMAGE_SET_VERSION = 1;

const P = "/imagenes-web/productos";
const FP = "/imagenes-web/fotos-productos";
const UC = "/imagenes-web/ultimos-cambios";

/** Una fila de imagen: [url, alt, sort_order, is_primary]. */
const row = (url, alt, sort, primary) => [url, alt, sort, primary];

/** { slug: [ [url, alt, sort, primary], ... ] } — se llena abajo. */
const SET = {};

// ─── Kits de línea (interna "sistema completo") ────────────────────────────
// Diseño acordado 2026-06-07: familia + envases que componen la línea.
SET["linea-race"] = [
  row(`${P}/linea-race/500ml/race-unificado.png`,              "Línea Race completa — todos los potes",       0, true),
  row(`${P}/linea-race/500ml/race-1-verde-tarro-500ml.webp`,   "Race 1 — NPK (tarro verde)",                  1, false),
  row(`${P}/linea-race/500ml/race-2-celeste-tarro-500ml.webp`, "Race 2 — Calcio + Nitrógeno (tarro celeste)", 2, false),
  row(`${P}/linea-race/500ml/race-3-violeta-tarro-500ml.webp`, "Race 3 — PK en 2 partes (tarro violeta)",     3, false),
  row(`${P}/linea-race/500ml/race-4-rosa-tarro-500ml.webp`,    "Race 4 — Micro + Magnesio (tarro rosa)",      4, false),
];
SET["linea-elite"] = [
  row(`${UC}/POTE-ELITE-UNIFICADO-INTERNA.png`,    "Línea Elite completa — Part 1 + Part 2", 0, true),
  row(`${P}/linea-elite/elite-part-1.png`,         "Elite Parte 1",                          1, false),
  row(`${P}/linea-elite/elite-part-2.png`,         "Elite Parte 2",                          2, false),
];
SET["linea-pro"] = [
  row(`${P}/linea-pro/1kg/pro-unificado.png`,      "Línea Pro completa — 4 etapas", 0, true),
  row(`${P}/linea-pro/1kg/enraizante-1kg-1.png`,   "Pro Enraizante 1kg",            1, false),
  row(`${P}/linea-pro/1kg/vegetativo-1kg-1.png`,   "Pro Vegetativo 1kg",            2, false),
  row(`${P}/linea-pro/1kg/preflora-1kg-1.png`,     "Pro Preflora 1kg",              3, false),
  row(`${P}/linea-pro/1kg/flora-1kg-1.png`,        "Pro Flora 1kg",                 4, false),
];

// ─── Línea Race — SKUs individuales ────────────────────────────────────────
// 250ml/500ml/1L: el envase real es el TARRO dosificador (primaria); la
// botella con palanca queda como 2ª foto de galería.
// 5L/10L/20L: bidón (render F1, única foto). R3 1ª y 2ª comparten arte de
// tarro violeta; la distinción A/B vive en la botella.
const RACE = [
  { key: "race-1-npk",             tarro: "race-1-verde",   botella: "race-1-verde",     label: "Race 1 NPK (verde)" },
  { key: "race-2-calcio-nitrogeno",tarro: "race-2-celeste", botella: "race-2-celeste",   label: "Race 2 Calcio + Nitrógeno (celeste)" },
  { key: "race-3-pk-1",            tarro: "race-3-violeta", botella: "race-3-violeta-a", label: "Race 3 PK 1ª parte (violeta)" },
  { key: "race-3-pk-2",            tarro: "race-3-violeta", botella: "race-3-violeta-b", label: "Race 3 PK 2ª parte (violeta)" },
  { key: "race-4-micro-magnesio",  tarro: "race-4-rosa",    botella: "race-4-rosa",      label: "Race 4 Micro + Magnesio (rosa)" },
];
// Botella 500ml: Race 1 y Race 4 no tienen render F1 500ml → conservan el .png.
const RACE_500_BOTELLA = {
  "race-1-npk":              `${P}/linea-race/500ml/race-1-verde-500ml.png`,
  "race-2-calcio-nitrogeno": `${P}/linea-race/500ml/race-2-celeste-500ml-f1.webp`,
  "race-3-pk-1":             `${P}/linea-race/500ml/race-3-violeta-a-500ml-f1.webp`,
  "race-3-pk-2":             `${P}/linea-race/500ml/race-3-violeta-b-500ml-f1.webp`,
  "race-4-micro-magnesio":   `${P}/linea-race/500ml/race-4-rosa-500ml.png`,
};
for (const f of RACE) {
  // 250ml — tarro + botella F1
  SET[`${f.key}-250ml`] = [
    row(`${P}/linea-race/250ml/${f.tarro}-tarro.webp`, `${f.label} — tarro dosificador`, 0, true),
    row(`${P}/linea-race/250ml/${f.botella}-f1.webp`,  `${f.label} — botella 250ml`,     1, false),
  ];
  // 500ml — tarro + botella (png/F1 según familia)
  SET[`${f.key}-500ml`] = [
    row(`${P}/linea-race/500ml/${f.tarro}-tarro-500ml.webp`, `${f.label} — tarro dosificador`, 0, true),
    row(RACE_500_BOTELLA[f.key],                            `${f.label} — botella 500ml`,     1, false),
  ];
  // 1L — tarro + botella F1
  SET[`${f.key}-1l`] = [
    row(`${P}/linea-race/1l/${f.tarro}-tarro-1l.webp`, `${f.label} — tarro dosificador 1L`, 0, true),
    row(`${P}/linea-race/1l/${f.botella}-1l-f1.webp`,  `${f.label} — botella 1L`,           1, false),
  ];
  // 5L / 10L — bidón F1 (única foto)
  for (const size of ["5l", "10l"]) {
    SET[`${f.key}-${size}`] = [
      row(`${P}/linea-race/${size}/${f.botella}-${size}-f1.webp`, `${f.label} — bidón ${size.toUpperCase()}`, 0, true),
    ];
  }
  // 20L — bidón F1; Race 3 Parte B no tiene render 20L (el SKU tampoco existe).
  if (f.key !== "race-3-pk-2") {
    SET[`${f.key}-20l`] = [
      row(`${P}/linea-race/20l/${f.botella}-20l-f1.webp`, `${f.label} — bidón 20L`, 0, true),
    ];
  }
}

// ─── Línea Pro — 4 etapas × 4 formatos ─────────────────────────────────────
// El naming de archivo es irregular por etapa/formato → mapa explícito (de
// los renders reales en disco). Cada SKU es una sola foto.
const PRO_FILES = {
  "pro-enraizante-25gr":  `${P}/linea-pro/25gr/enraizante-25gr-1.png`,
  "pro-enraizante-100gr": `${P}/linea-pro/100gr/enraizante-100gr-1.png`,
  "pro-enraizante-500gr": `${P}/linea-pro/500gr/enraizante-500gr-1.png`,
  "pro-enraizante-1kg":   `${P}/linea-pro/1kg/enraizante-1kg-1.png`,
  "pro-vegetativo-25gr":  `${P}/linea-pro/25gr/vegetativo-25gr-1.png`,
  "pro-vegetativo-100gr": `${P}/linea-pro/100gr/vegetativo-100gr-1.png`,
  "pro-vegetativo-500gr": `${P}/linea-pro/500gr/vegetativo-500gr-1.png`,
  "pro-vegetativo-1kg":   `${P}/linea-pro/1kg/vegetativo-1kg-1.png`,
  "pro-preflora-25gr":    `${P}/linea-pro/25gr/prefloracion-25gr-1.png`,
  "pro-preflora-100gr":   `${P}/linea-pro/100gr/pre-floracion-100gr-1.png`,
  "pro-preflora-500gr":   `${P}/linea-pro/500gr/pre-flora-500gr-1.png`,
  "pro-preflora-1kg":     `${P}/linea-pro/1kg/preflora-1kg-1.png`,
  "pro-flora-25gr":       `${P}/linea-pro/25gr/floracion-25gr-1.png`,
  "pro-flora-100gr":      `${P}/linea-pro/100gr/floracion-100gr-1.png`,
  "pro-flora-500gr":      `${P}/linea-pro/500gr/flora-500gr-1.png`,
  "pro-flora-1kg":        `${P}/linea-pro/1kg/flora-1kg-1.png`,
};
const PRO_LABELS = { enraizante: "Pro Enraizante", vegetativo: "Pro Vegetativo", preflora: "Pro Preflora", flora: "Pro Flora" };
for (const [slug, url] of Object.entries(PRO_FILES)) {
  const etapa = slug.split("-")[1];
  const formato = slug.split("-").slice(2).join("-");
  SET[slug] = [row(url, `${PRO_LABELS[etapa]} ${formato}`, 0, true)];
}

// ─── Línea Elite — SKUs activos (pares + Max). Las partes sueltas y los
// "Parte B" están desactivados (no se venden así) → no necesitan imagen. ────
SET["elite-juntos-250ml"] = [row(`${FP}/elite250-juntos.jpg`,    "Elite Parte 1 + Parte 2 — 250ml", 0, true)];
SET["elite-juntos-500ml"] = [row(`${FP}/elite500ml-juntos.jpg`,  "Elite Parte 1 + Parte 2 — 500ml", 0, true)];
SET["elite-juntos-1l"]    = [row(`${P}/linea-elite/1l/juntos-1l.png`, "Elite Parte 1 + Parte 2 — 1L", 0, true)];
SET["elite-max-5l"]       = [row(`${FP}/5lts-juntos.jpg`,        "Elite Max 5L — Parte 1 + Parte 2",  0, true)];
SET["elite-max-10l"]      = [row(`${FP}/10-litros-juntos.jpg`,   "Elite Max 10L — Parte 1 + Parte 2", 0, true)];
SET["elite-max-20l"]      = [row(`${FP}/max20ltjuntos.jpg`,      "Elite Max 20L — Parte 1 + Parte 2", 0, true)];

// ─── Bio Estimulante — 3 renders sin fondo (rosa) ──────────────────────────
const BIO_PERS1 = `${P}/bio-estimulante/perspectiva-1-grande-rosa-sin-fondo.png`;
const BIO_PERS2 = `${P}/bio-estimulante/perspectiva-2-grande-rosa-sin-fondo.png`;
const BIO_LAT   = `${P}/bio-estimulante/lateral-grande-rosa-sin-fondo.png`;
SET["bio-estimulante"] = [
  row(BIO_PERS1, "Bio Estimulante — perspectiva", 0, true),
  row(BIO_PERS2, "Bio Estimulante — perspectiva 2", 1, false),
  row(BIO_LAT,   "Bio Estimulante — lateral", 2, false),
];
SET["bio-estimulante-1l"] = [
  row(BIO_PERS1, "Bio Estimulante 1L — perspectiva", 0, true),
  row(BIO_PERS2, "Bio Estimulante 1L — perspectiva 2", 1, false),
  row(BIO_LAT,   "Bio Estimulante 1L — lateral", 2, false),
];
SET["bio-estimulante-500ml"] = [
  row(BIO_LAT,   "Bio Estimulante 500ml — lateral", 0, true),
  row(BIO_PERS1, "Bio Estimulante 500ml — perspectiva", 1, false),
];
SET["bio-estimulante-250ml"] = [row(`${FP}/bio-250gr1.jpg`, "Bio Estimulante 250ml", 0, true)];

// ─── Day-0 — 4 renders sin fondo (amarillo) ────────────────────────────────
const DAY_PERS1 = `${P}/day-0/perspectiva-1-grande-amarillo-sin-fondo.png`;
const DAY_PERS2 = `${P}/day-0/perspectiva-2-grande-amarillo-sin-fondo.png`;
const DAY_LAT   = `${P}/day-0/lateral-grande-amarillo-sin-fondo.png`;
const DAY_LAT2  = `${P}/day-0/lateral-2-grande-amarillo-sin-fondo.png`;
SET["day-0"] = [
  row(DAY_PERS1, "Day-0 — perspectiva", 0, true),
  row(DAY_PERS2, "Day-0 — perspectiva 2", 1, false),
  row(DAY_LAT,   "Day-0 — lateral", 2, false),
  row(DAY_LAT2,  "Day-0 — lateral 2", 3, false),
];
SET["day-0-1l"] = [
  row(DAY_PERS1, "Day-0 1L — perspectiva", 0, true),
  row(DAY_PERS2, "Day-0 1L — perspectiva 2", 1, false),
  row(DAY_LAT,   "Day-0 1L — lateral", 2, false),
  row(DAY_LAT2,  "Day-0 1L — lateral 2", 3, false),
];
SET["day-0-500ml"] = [
  row(DAY_LAT,   "Day-0 500ml — lateral", 0, true),
  row(DAY_LAT2,  "Day-0 500ml — lateral 2", 1, false),
  row(DAY_PERS1, "Day-0 500ml — perspectiva", 2, false),
];
SET["day-0-250ml"] = [row(`${FP}/day0250ml-1.jpg`, "Day-0 250ml", 0, true)];

// ─── Cloner ────────────────────────────────────────────────────────────────
SET["cloner"] = [row(`${UC}/POTE-CLONER-HOME.png`, "Cloner — gel enraizante", 0, true)];

// ─── Packs de puntos — SVG on-brand (no hay foto) ──────────────────────────
for (const slug of ["pack-50-puntos", "pack-100-puntos", "pack-250-puntos"]) {
  SET[slug] = [row(`${P}/puntos/pack-puntos.svg`, slug.replace(/-/g, " "), 0, true)];
}

/**
 * Re-author determinístico: por cada slug del SET, borra sus product_images y
 * reinserta el set canónico. Corre una sola vez por IMAGE_SET_VERSION
 * (marcador en shop_migrations). Devuelve { applied|skipped, slugs }.
 *
 * @param {{ query: (sql: string, params?: any[]) => Promise<{rows: any[]}> }} db
 */
async function reauthorProductImages(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS shop_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const marker = `image_set_v${IMAGE_SET_VERSION}`;
  const { rows: done } = await db.query("SELECT 1 FROM shop_migrations WHERE name = $1", [marker]);
  if (done.length) return { skipped: true, slugs: 0 };

  let touched = 0;
  for (const [slug, images] of Object.entries(SET)) {
    const { rows: pr } = await db.query("SELECT id FROM products WHERE slug = $1", [slug]);
    if (!pr.length) continue; // producto no existe en esta DB → se ignora
    const pid = pr[0].id;
    // Borrar primero evita chocar el índice único parcial de is_primary.
    await db.query("DELETE FROM product_images WHERE product_id = $1", [pid]);
    for (const [url, alt, sort, primary] of images) {
      await db.query(
        `INSERT INTO product_images (product_id, url, alt, sort_order, is_primary)
         VALUES ($1, $2, $3, $4, $5)`,
        [pid, url, alt, sort, primary]
      );
    }
    touched += 1;
  }
  await db.query(
    "INSERT INTO shop_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
    [marker]
  );
  return { applied: true, slugs: touched };
}

module.exports = { IMAGE_SET_VERSION, CANONICAL_PRODUCT_IMAGES: SET, reauthorProductImages };
