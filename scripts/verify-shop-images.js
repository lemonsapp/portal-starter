#!/usr/bin/env node
// scripts/verify-shop-images.js
//
// Verifica el set canónico de imágenes del shop (server/routes/shopImageSet.js):
//   1. cada URL existe como archivo en landing/public (o client/public mirror)
//   2. cada slug tiene exactamente una imagen primaria
// Salida no-cero si algo falla → usable en CI / pre-commit.
//
//   node scripts/verify-shop-images.js

"use strict";

const fs = require("fs");
const path = require("path");
const { CANONICAL_PRODUCT_IMAGES: SET, IMAGE_SET_VERSION } = require("../server/routes/shopImageSet");

const ROOT = path.resolve(__dirname, "..");
const ROOTS = [path.join(ROOT, "landing/public"), path.join(ROOT, "client/public")];

const exists = (url) => ROOTS.some((base) => fs.existsSync(path.join(base, url)));

let missing = 0;
let badPrimary = 0;
let totalImgs = 0;

for (const [slug, imgs] of Object.entries(SET)) {
  const primaries = imgs.filter(([, , , primary]) => primary).length;
  if (primaries !== 1) {
    console.error(`✗ ${slug}: tiene ${primaries} primarias (debe ser 1)`);
    badPrimary += 1;
  }
  for (const [url] of imgs) {
    totalImgs += 1;
    if (!exists(url)) {
      console.error(`✗ ${slug}: archivo faltante → ${url}`);
      missing += 1;
    }
  }
}

const slugs = Object.keys(SET).length;
console.log(
  `image_set v${IMAGE_SET_VERSION} — ${slugs} slugs, ${totalImgs} imágenes, ` +
    `${missing} faltantes, ${badPrimary} primarias mal`
);

if (missing || badPrimary) {
  console.error("VERIFICACIÓN FALLIDA");
  process.exit(1);
}
console.log("OK");
