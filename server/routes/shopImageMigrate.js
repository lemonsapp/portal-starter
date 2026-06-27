"use strict";

// Migración one-shot: sube a Cloudinary (upload-by-URL) las imágenes de
// product_images que todavía son paths estáticos servidos por el host público
// (ej: /imagenes-web/productos/...) y reapunta cada fila a la URL de Cloudinary.
//
// Por qué: hasta ahora las imágenes de producto quedaban "fijas" como archivos
// de carpeta, así que un operador no podía sacar/poner/reemplazar desde el panel
// (lo que edita no matchea lo que se muestra, porque el cliente reescribe paths).
// Tras migrarlas a Cloudinary, cada producto/medida tiene sus filas editables de
// punta a punta desde el admin (agregar, quitar, reordenar, marcar destacada).
//
// Idempotente: saltea las filas que ya son Cloudinary, así re-correrla no duplica.
// Dedupe por URL de origen (varias filas comparten un mismo render → 1 sola subida).
// Reversible: guarda la url vieja de cada fila en product_images_backup.

// Espeja los rewrites de prefijos viejos (vercel.json / fixImageUrl del cliente),
// por si alguna fila quedó con un path del esquema anterior.
const PREFIX_MOVES = [
  ["/img/", "/imagenes-web/"],
  ["/assets/productos/", "/imagenes-web/fotos-productos/"],
  ["/ultimos-cambios/", "/imagenes-web/ultimos-cambios/"],
];

function normalizePath(url) {
  for (const [oldP, newP] of PREFIX_MOVES) {
    if (url.startsWith(oldP)) return newP + url.slice(oldP.length);
  }
  return url;
}

function isCloudinary(url) {
  return /res\.cloudinary\.com/.test(url || "");
}

/**
 * @param {object} db        pool con .query
 * @param {object} cloudinary  SDK ya configurado (configureCloudinary())
 * @param {object} opts       { host } — origen público de las imágenes (ej https://hgrowshop.com)
 * @returns {Promise<{total,updated,uploadedFiles,skipped,failed,errors}>}
 */
async function migrateImagesToCloudinary(db, cloudinary, { host } = {}) {
  if (!host) throw new Error("Falta host (origen público de las imágenes)");
  const base = String(host).replace(/\/+$/, "");

  await db.query(`
    CREATE TABLE IF NOT EXISTS product_images_backup (
      id          SERIAL PRIMARY KEY,
      image_id    INT NOT NULL,
      old_url     TEXT NOT NULL,
      new_url     TEXT,
      migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

  const { rows } = await db.query(
    `SELECT pi.id, pi.url, p.slug
     FROM product_images pi JOIN products p ON p.id = pi.product_id
     ORDER BY pi.id`);

  const cache = new Map(); // remoteUrl -> secure_url (dedupe de subidas)
  let updated = 0, uploadedFiles = 0, skipped = 0, failed = 0;
  const errors = [];

  for (const r of rows) {
    if (isCloudinary(r.url)) { skipped++; continue; }
    const src = normalizePath(r.url);
    const remote = src.startsWith("http") ? src : base + src;
    try {
      let secure = cache.get(remote);
      if (!secure) {
        const out = await cloudinary.uploader.upload(remote, {
          folder: "portal-shop",
          resource_type: "image",
        });
        secure = out.secure_url;
        cache.set(remote, secure);
        uploadedFiles++;
      }
      await db.query(
        `INSERT INTO product_images_backup (image_id, old_url, new_url) VALUES ($1, $2, $3)`,
        [r.id, r.url, secure]);
      await db.query(`UPDATE product_images SET url = $1 WHERE id = $2`, [secure, r.id]);
      updated++;
    } catch (e) {
      failed++;
      if (errors.length < 25) errors.push({ slug: r.slug, url: r.url, error: e.message });
    }
  }

  return { total: rows.length, updated, uploadedFiles, skipped, failed, errors };
}

module.exports = { migrateImagesToCloudinary };
