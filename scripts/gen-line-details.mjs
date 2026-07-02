// scripts/gen-line-details.mjs
//
// Genera client/src/data/lineDetails.js desde la fuente de verdad de cada
// interna (landing/src/data/productDetails.js). El shop usa lineDetails como
// contenido por defecto de la ficha (intro + "Por qué elegirlo" + características
// + specs) cuando el admin no cargó un meta.editorial propio.
//
// Uso:  node scripts/gen-line-details.mjs
//
// Mapeo interna → ficha shop:
//   intro    ← hero.claim
//   benefits ← highlights[] · { title, body }          (las tarjetas "Por qué elegirlo")
//   features ← features[]   · { title, body, emoji }
//   specs    ← techSpecs[]  · { label, value }

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "../landing/src/data/productDetails.js");
const OUT = resolve(__dirname, "../client/src/data/lineDetails.js");

const { productDetails } = await import(SRC);

// Orden canónico de líneas en la ficha del shop.
const KEYS = ["linea-elite", "linea-pro", "linea-race", "bio-estimulante", "cloner", "day-0"];

function pick(arr, fields) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((o) => {
      const out = {};
      for (const f of fields) if (o && o[f] != null && o[f] !== "") out[f] = o[f];
      return out;
    })
    .filter((o) => Object.keys(o).length > 0);
}

const result = {};
for (const key of KEYS) {
  const d = productDetails[key];
  if (!d) continue;
  result[key] = {
    intro: (d.hero && d.hero.claim) || "",
    benefits: pick(d.highlights, ["title", "body"]),
    features: pick(d.features, ["title", "body", "emoji"]),
    specs: pick(d.techSpecs, ["label", "value"]),
  };
}

const header = `// client/src/data/lineDetails.js
//
// Info por línea REUSADA de la web (landing/src/data/productDetails.js) para
// armar la interna de producto del shop por secciones: intro, beneficios,
// características y especificaciones.
//
// ⚠ GENERADO — no editar a mano. Corré:  node scripts/gen-line-details.mjs
//   (la fuente de verdad es landing/src/data/productDetails.js)
//
// Keys: linea-race | linea-elite | linea-pro | bio-estimulante | cloner | day-0

export const lineDetails = ${JSON.stringify(result, null, 2)};

// Resuelve la key de línea de un producto del shop (slug directo, meta.linea, o
// prefijo del slug). Usado por ShopProduct.jsx para elegir el default correcto.
export function lineKeyFor(product) {
  if (!product) return null;
  if (lineDetails[product.slug]) return product.slug;
  const l = product.meta && product.meta.linea;
  if (l && lineDetails["linea-" + l]) return "linea-" + l;
  const k = Object.keys(lineDetails).find(key => (product.slug||"").startsWith(key));
  return k || null;
}
`;

writeFileSync(OUT, header, "utf8");
console.log(`✅ lineDetails.js regenerado desde productDetails.js (${Object.keys(result).length} líneas)`);
for (const k of Object.keys(result)) {
  const r = result[k];
  console.log(`   ${k.padEnd(18)} intro:${r.intro ? "✓" : "—"}  benefits:${r.benefits.length}  features:${r.features.length}  specs:${r.specs.length}`);
}
