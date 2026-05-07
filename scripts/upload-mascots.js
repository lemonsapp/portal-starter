// scripts/upload-mascots.js
// Sube los PNG de tmp/mascots-upload/ a Cloudinary lemons-ig/mascots/<slug>.png
// Solo los slugs que están en MAPPING. Resto se ignora.
// Uso: node scripts/upload-mascots.js
"use strict";
require("../server/node_modules/dotenv").config({ path: require("path").join(__dirname, "..", "server", ".env") });
const cloudinary = require("../server/node_modules/cloudinary").v2;
const fs = require("fs");
const path = require("path");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// filename → slug
const MAPPING = {
  "LIMON-SEÑALANDO.png": "apuntando",
  "Sin título.png": "cajas_pulgar",
  "Sin título (1).png": "caja_frente",
  "Sin título (3).png": "dos_cajas",
  "Sin título (6).png": "auriculares",
  "Sin título (13).png": "caja_saludo",
  "Sin título (41).png": "victoria_cajas",
  "Sin título (42).png": "avion",
  "Sin título (44).png": "apuntando_arriba",
  "freepik__3d-cartoon-lemon-character-in-pixar-style-smiling-__99973.png": "asomando",
  "freepik__cute-3d-cartoon-lemon-character-in-pixar-style-sta__27080.png": "paquete_llego",
  "freepik__cute-3d-cartoon-lemon-character-pixar-style-big-ex__86331.png": "gamer",
  "freepik__cute-3d-cartoon-lemon-character-pixarstyle-big-exp__99972.png": "saludo",
  "freepik__cute-3d-lemon-mascot-character-same-style-and-prop__7340.png": "cupido",
};

const SRC_DIR = path.join(__dirname, "..", "tmp", "mascots-upload");
const FOLDER = "lemons-ig/mascots";
const MANIFEST_PATH = path.join(__dirname, "..", "server", "lib", "mascots-manifest.json");

(async () => {
  const results = [];
  const errors = [];
  for (const [filename, slug] of Object.entries(MAPPING)) {
    const fullPath = path.join(SRC_DIR, filename);
    if (!fs.existsSync(fullPath)) {
      console.warn(`[SKIP] no encontrado: ${filename}`);
      continue;
    }
    try {
      console.log(`[UPLOAD] ${filename} → ${FOLDER}/${slug}`);
      const res = await cloudinary.uploader.upload(fullPath, {
        folder: FOLDER,
        public_id: slug,
        overwrite: true,
        resource_type: "image",
        format: "png",
      });
      results.push({
        slug,
        filename,
        url: res.secure_url,
        width: res.width,
        height: res.height,
        bytes: res.bytes,
        public_id: res.public_id,
      });
      console.log(`  ✓ ${res.secure_url}`);
    } catch (e) {
      console.error(`  ✗ ERROR ${filename}: ${e.message}`);
      errors.push({ filename, slug, error: e.message });
    }
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({ uploaded_at: new Date().toISOString(), folder: FOLDER, mascots: results, errors }, null, 2));
  console.log(`\n=== RESUMEN ===`);
  console.log(`Subidas OK:  ${results.length}`);
  console.log(`Errores:     ${errors.length}`);
  console.log(`Manifest:    ${MANIFEST_PATH}`);
})();
