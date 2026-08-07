// server/routes/admin-items.js
//
// ABM de los items del perfil (avatares, marcos, banners, títulos, insignias)
// para que el cliente los cargue solo desde el panel, sin tocar la base.
// Antes sólo existía el creador de INSIGNIAS dentro del Studio; los otros
// cuatro tipos estaban sembrados en código (2026-08-06).
//
//   GET    /admin/profile-items        → lista completa (incluye ocultos) + cuántos lo tienen
//   POST   /admin/profile-items        → crear o pisar por key
//   PATCH  /admin/profile-items/:key   → editar campos sueltos (activo, costo, nombre…)
//   DELETE /admin/profile-items/:key   → borrar (BLOQUEADO si alguien lo tiene)

"use strict";

const express = require("express");
const multer = require("multer");
const db = require("../db");
const { configureCloudinary } = require("../lib/cloudinaryConfig");

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Solo se permiten imágenes")),
});

// Cómo se acomoda sola cada imagen que sube el cliente. `crop:"fill"` recorta a
// la medida exacta en vez de deformar, y `gravity:"auto"` deja que Cloudinary
// elija QUÉ parte conservar analizando la imagen: así un diseño vertical o
// cuadrado entra en el banner apaisado sin que nadie recorte a mano.
const RECORTES = {
  // El banner se ve a 300px de alto en compu y 170 en celular, a todo el ancho.
  banner: [{ width: 1200, height: 400, crop: "fill", gravity: "auto" }, { quality: "auto", fetch_format: "auto" }],
  // El avatar es un círculo: cuadrado sí o sí.
  avatar: [{ width: 400, height: 400, crop: "fill", gravity: "auto" }, { quality: "auto", fetch_format: "auto" }],
};

const TIPOS     = ["avatar", "frame", "banner", "title", "badge"];
const RAREZAS   = ["common", "rare", "epic", "legendary"];
// Los mismos 12 que sabe dibujar BannerCanvas. Si se agrega uno allá, va acá.
const EFECTOS   = ["stars","snow","lemon_rain","matrix","rainbow","lightning",
                   "vortex","fire","cyber","aurora","pulse","ocean"];

const limpiar = (v, max) => (v == null ? "" : String(v).slice(0, max).trim());

// La key es el identificador permanente: ata el item a la gente que lo tiene.
// Se normaliza fuerte para que no entren espacios ni acentos por copy/paste.
function normalizarKey(raw) {
  return limpiar(raw, 60)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function validar(body, { esNuevo }) {
  const errores = [];
  const key = normalizarKey(body.key);
  if (esNuevo && !key) errores.push("Falta el nombre interno (key)");
  if (esNuevo && !TIPOS.includes(body.type)) errores.push(`Tipo inválido (${TIPOS.join(", ")})`);
  if (body.name != null && !limpiar(body.name, 60)) errores.push("Falta el nombre visible");
  if (body.rarity != null && !RAREZAS.includes(body.rarity)) errores.push(`Rareza inválida (${RAREZAS.join(", ")})`);
  const costo = body.cost_coins == null ? 0 : Number(body.cost_coins);
  if (!Number.isInteger(costo) || costo < 0 || costo > 1000000) errores.push("El costo tiene que ser un entero de 0 a 1.000.000");
  if (body.type === "banner" && body.data?.effect && !EFECTOS.includes(body.data.effect)) {
    errores.push(`Efecto de banner inválido (${EFECTOS.join(", ")})`);
  }
  return { errores, key, costo };
}

function build({ authRequired, requireRole }) {
  const router = express.Router();
  // Sólo admin: estos items definen la economía del portal (precios en puntos).
  const soloAdmin = [authRequired, requireRole(["admin"])];

  // Catálogo de opciones, para que el panel no las tenga hardcodeadas de su lado.
  router.get("/profile-items/opciones", ...soloAdmin, (_req, res) => {
    res.json({ ok: true, tipos: TIPOS, rarezas: RAREZAS, efectos: EFECTOS });
  });

  // ── POST /admin/profile-items/imagen ───────────────────────────────────────
  // Sube un diseño propio y devuelve la URL ya recortada a la medida del lugar
  // donde se va a ver. El cliente sube lo que tenga (vertical, cuadrado, gigante)
  // y sale acomodado solo: no hay que preparar la imagen antes.
  router.post("/profile-items/imagen", ...soloAdmin, subida.single("imagen"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No llegó ninguna imagen" });
      const tipo = RECORTES[req.body.tipo] ? req.body.tipo : "banner";
      const cloudinary = await configureCloudinary();
      const r = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "portal-items", transformation: RECORTES[tipo] },
          (err, out) => (err ? reject(err) : resolve(out))
        );
        stream.end(req.file.buffer);
      });
      res.json({ ok: true, url: r.secure_url, ancho: r.width, alto: r.height });
    } catch (e) {
      console.error("[admin/profile-items/imagen]", e.message);
      // El error de Cloudinary sirve: casi siempre es "faltan las API keys",
      // que se cargan en el asistente de configuración del panel.
      res.status(500).json({ error: `No se pudo subir la imagen: ${e.message}` });
    }
  });

  // ── GET /admin/profile-items ───────────────────────────────────────────────
  router.get("/profile-items", ...soloAdmin, async (req, res) => {
    try {
      const q = await db.query(`
        SELECT pi.*,
               (SELECT COUNT(*)::int FROM user_items ui WHERE ui.item_key = pi.key) AS lo_tienen
          FROM profile_items pi
         ORDER BY pi.type, pi.cost_coins, pi.name
      `);
      res.json({ ok: true, items: q.rows });
    } catch (e) {
      console.error("[admin/profile-items GET]", e.message);
      res.status(500).json({ error: "No se pudo leer el catálogo" });
    }
  });

  // ── POST /admin/profile-items ──────────────────────────────────────────────
  router.post("/profile-items", ...soloAdmin, async (req, res) => {
    try {
      const { errores, key, costo } = validar(req.body, { esNuevo: true });
      if (errores.length) return res.status(400).json({ error: errores.join(". ") });

      const existe = await db.query(`SELECT key FROM profile_items WHERE key=$1`, [key]);
      if (existe.rows[0] && !req.body.pisar) {
        return res.status(409).json({ error: `Ya existe un item con el nombre interno "${key}". Cambialo o marcá "sobrescribir".` });
      }

      const q = await db.query(`
        INSERT INTO profile_items (key, type, name, description, emoji, cost_coins, rarity, data, active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (key) DO UPDATE SET
          type=$2, name=$3, description=$4, emoji=$5, cost_coins=$6, rarity=$7, data=$8, active=$9
        RETURNING *`,
        [key, req.body.type, limpiar(req.body.name, 60), limpiar(req.body.description, 160),
         limpiar(req.body.emoji, 8) || null, costo, req.body.rarity || "common",
         JSON.stringify(req.body.data || {}), req.body.active !== false]);

      res.json({ ok: true, item: q.rows[0] });
    } catch (e) {
      console.error("[admin/profile-items POST]", e.message);
      res.status(500).json({ error: "No se pudo guardar el item" });
    }
  });

  // ── PATCH /admin/profile-items/:key ────────────────────────────────────────
  router.patch("/profile-items/:key", ...soloAdmin, async (req, res) => {
    try {
      const key = normalizarKey(req.params.key);
      const actual = await db.query(`SELECT * FROM profile_items WHERE key=$1`, [key]);
      if (!actual.rows[0]) return res.status(404).json({ error: "No existe ese item" });

      const { errores, costo } = validar({ ...req.body, type: actual.rows[0].type }, { esNuevo: false });
      if (errores.length) return res.status(400).json({ error: errores.join(". ") });

      // Aviso, no bloqueo: ocultar un item PAGO que alguien compró le impide
      // seguir equipándolo (el front arma la lista de equipables con los
      // activos). Gratis no importa: se puede volver a obtener.
      let aviso = null;
      if (req.body.active === false && actual.rows[0].cost_coins > 0) {
        const due = await db.query(`SELECT COUNT(*)::int AS n FROM user_items WHERE item_key=$1`, [key]);
        if (due.rows[0].n) aviso = `Ojo: ${due.rows[0].n} usuario(s) compraron este item y al ocultarlo no van a poder equiparlo.`;
      }

      const campos = [];
      const vals = [key];
      const set = (col, val) => { vals.push(val); campos.push(`${col}=$${vals.length}`); };
      if (req.body.name        !== undefined) set("name", limpiar(req.body.name, 60));
      if (req.body.description !== undefined) set("description", limpiar(req.body.description, 160));
      if (req.body.emoji       !== undefined) set("emoji", limpiar(req.body.emoji, 8) || null);
      if (req.body.cost_coins  !== undefined) set("cost_coins", costo);
      if (req.body.rarity      !== undefined) set("rarity", req.body.rarity);
      if (req.body.data        !== undefined) set("data", JSON.stringify(req.body.data || {}));
      if (req.body.active      !== undefined) set("active", !!req.body.active);
      if (!campos.length) return res.status(400).json({ error: "No mandaste ningún cambio" });

      const q = await db.query(`UPDATE profile_items SET ${campos.join(", ")} WHERE key=$1 RETURNING *`, vals);
      res.json({ ok: true, item: q.rows[0], aviso });
    } catch (e) {
      console.error("[admin/profile-items PATCH]", e.message);
      res.status(500).json({ error: "No se pudo actualizar el item" });
    }
  });

  // ── DELETE /admin/profile-items/:key ───────────────────────────────────────
  // Borrar un item que alguien tiene equipado lo dejaría con un item fantasma,
  // así que se bloquea y se ofrece ocultarlo, que es reversible.
  router.delete("/profile-items/:key", ...soloAdmin, async (req, res) => {
    try {
      const key = normalizarKey(req.params.key);
      const due = await db.query(`SELECT COUNT(*)::int AS n FROM user_items WHERE item_key=$1`, [key]);
      if (due.rows[0].n) {
        return res.status(409).json({
          error: `No se puede borrar: ${due.rows[0].n} usuario(s) ya lo tienen. Ocultalo en vez de borrarlo.`,
        });
      }
      const q = await db.query(`DELETE FROM profile_items WHERE key=$1 RETURNING key`, [key]);
      if (!q.rows[0]) return res.status(404).json({ error: "No existe ese item" });
      res.json({ ok: true });
    } catch (e) {
      console.error("[admin/profile-items DELETE]", e.message);
      res.status(500).json({ error: "No se pudo borrar el item" });
    }
  });

  return router;
}

module.exports = { build, TIPOS, RAREZAS, EFECTOS };
