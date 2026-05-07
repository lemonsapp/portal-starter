"use strict";
const fs = require("fs");
const path = require("path");
const satori = require("satori").default;
const { html } = require("satori-html");
const { Resvg } = require("@resvg/resvg-js");

// ─── Fuentes (cargadas una vez al boot) ──────────────────────────────────────
const FONTS_DIR = path.join(__dirname, "fonts");
const INTER_REGULAR = fs.readFileSync(path.join(FONTS_DIR, "Inter-Regular.woff"));
const INTER_BOLD    = fs.readFileSync(path.join(FONTS_DIR, "Inter-Bold.woff"));
const INTER_BLACK   = fs.readFileSync(path.join(FONTS_DIR, "Inter-Black.woff"));

const SATORI_FONTS = [
  { name: "Inter", data: INTER_REGULAR, weight: 400, style: "normal" },
  { name: "Inter", data: INTER_BOLD,    weight: 700, style: "normal" },
  { name: "Inter", data: INTER_BLACK,   weight: 900, style: "normal" },
];

// ─── Paleta de marca ─────────────────────────────────────────────────────────
const COLORS = {
  yellow: "#FFC700",
  deepBlue: "#2D4BFF",
  blueDark: "#1A2B6E",
  textDark: "#1A1A1A",
  white: "#FFFFFF",
  lightGray: "#F1F1F1",
};

const MASCOT_CART_URL = "https://res.cloudinary.com/dxcmxwbia/image/upload/v1777435388/lemons-ig/assets/mascot-cart.png";

// ─── Manifest de mascotas (cargado al boot, sin red en runtime) ──────────────
let MASCOTS_MANIFEST = { mascots: [] };
try {
  MASCOTS_MANIFEST = require("./mascots-manifest.json");
} catch (e) {
  console.warn("[templateRenderer] mascots-manifest.json no encontrado, mascotas seguirán mostrando el cart hasta que se corra scripts/upload-mascots.js");
}

// Override de labels para slugs cuya capitalización automática queda fea.
const LABELS_OVERRIDE = {
  cajas_pulgar:     "Pulgar arriba 👍",
  paquete_llego:    "Llegó lo bueno 📦",
  apuntando_arriba: "Atención ☝️",
  caja_saludo:      "Saludando con caja 👋",
  victoria_cajas:   "Victoria 🎉",
  caja_frente:      "Caja al frente 📦",
  dos_cajas:        "Dos cajas 📦📦",
  cupido:           "Cupido 💘",
  gamer:            "Gamer 🎮",
  asomando:         "Asomando 👀",
  apuntando:        "Apuntando 👉",
  saludo:           "Saludo 👋",
  avion:            "Avión ✈️",
  auriculares:      "Auriculares 🎧",
};

function prettify(slug) {
  return slug.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Devuelve URL Cloudinary con transform que cap-ea ancho a 1080 y aplica f_auto/q_auto.
// Slug inexistente o vacío → fallback al cart histórico.
function getMascotUrl(slug) {
  const m = (slug && MASCOTS_MANIFEST.mascots) ? MASCOTS_MANIFEST.mascots.find(x => x.slug === slug) : null;
  const raw = m ? m.url : MASCOT_CART_URL;
  return raw.replace("/upload/", "/upload/c_limit,w_1080,f_auto,q_auto/");
}

// Listado para el endpoint /mascots y la UI. Incluye thumb_url 96x96 y label legible.
function listMascots() {
  return (MASCOTS_MANIFEST.mascots || []).map(m => ({
    slug: m.slug,
    url: m.url,
    thumb_url: m.url.replace("/upload/", "/upload/w_96,h_96,c_fit,f_auto,q_auto/"),
    label: LABELS_OVERRIDE[m.slug] || prettify(m.slug),
    width: m.width,
    height: m.height,
  }));
}

// ─── Render core: HTML markup → PNG buffer ───────────────────────────────────
async function renderHtmlToPng(markup, width, height) {
  const tree = html(markup);
  const svg = await satori(tree, { width, height, fonts: SATORI_FONTS });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width } });
  return resvg.render().asPng();
}

// ─── REGISTRY ────────────────────────────────────────────────────────────────
const TEMPLATES = {
  // 1) Aviso tipográfico (story 9:16) — sin mascota
  aviso_typographic: {
    id: "aviso_typographic",
    label: "Aviso tipográfico",
    description: "Story con eyebrow + titular grande en badge + caption + footer. Sin mascota.",
    kind: "story_image",
    width: 1080,
    height: 1920,
    fields: [
      { name: "eyebrow",  label: "Eyebrow (top pill)",       type: "text", default: "AVISO IMPORTANTE", maxLen: 40 },
      { name: "title",    label: "Titular (badge azul)",     type: "text", default: "1 al 5 de MAYO",   maxLen: 60 },
      { name: "subtitle", label: "Subtítulo (dentro badge)", type: "text", default: "No estaremos recibiendo cargas en China", maxLen: 120 },
      { name: "caption",  label: "Caption (bajo badge)",     type: "text", default: "Feriado en CHINA por día del trabajo", maxLen: 100 },
      { name: "footer",   label: "Footer (bottom small)",    type: "text", default: "Coordiná tus envíos con anticipación para evitar demoras.", maxLen: 200 },
    ],
    async render(f) {
      const markup = `
        <div style="display:flex; flex-direction:column; align-items:center; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:60px;">
          <div style="margin-top:160px; padding:24px 56px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; font-size:36px; font-weight:700; letter-spacing:2px; text-transform:uppercase;">
            ${escapeHtml(f.eyebrow)}
          </div>
          <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; margin-top:60px; width:100%; padding:60px 50px; background:${COLORS.blueDark}; color:${COLORS.white}; border-radius:80px; text-align:center;">
            <div style="font-size:120px; font-weight:900; line-height:1.05; letter-spacing:-2px;">${escapeHtml(f.title)}</div>
            <div style="margin-top:40px; font-size:38px; font-weight:700; line-height:1.2; opacity:0.95;">${escapeHtml(f.subtitle)}</div>
          </div>
          <div style="margin-top:80px; font-size:46px; font-weight:700; color:${COLORS.blueDark}; text-align:center; line-height:1.25;">${escapeHtml(f.caption)}</div>
          <div style="margin-top:auto; margin-bottom:40px; font-size:26px; font-weight:400; color:${COLORS.blueDark}; text-align:center; line-height:1.4; max-width:760px;">${escapeHtml(f.footer)}</div>
        </div>
      `;
      return renderHtmlToPng(markup, 1080, 1920);
    },
  },

  // 2) Descuentos por país (story 9:16) — con mascota + cart
  descuentos_pais: {
    id: "descuentos_pais",
    label: "Descuentos por país",
    description: "Story con titular en badge + 3 filas de precios USA/CHN/EUR + mascota empujando carrito + footer.",
    kind: "story_image",
    width: 1080,
    height: 1920,
    fields: [
      { name: "title",      label: "Titular (badge azul)",  type: "text", default: "DESCUENTOS",   maxLen: 30 },
      { name: "subtitle",   label: "Subtítulo (badge gris)", type: "text", default: "EN ENVÍOS",   maxLen: 30 },
      { name: "usa_old",    label: "USA precio antes",      type: "text", default: "$45",          maxLen: 10 },
      { name: "usa_new",    label: "USA precio ahora",      type: "text", default: "US$42",        maxLen: 10 },
      { name: "chn_old",    label: "CHN precio antes",      type: "text", default: "$58",          maxLen: 10 },
      { name: "chn_new",    label: "CHN precio ahora",      type: "text", default: "US$55",        maxLen: 10 },
      { name: "eur_old",    label: "EUR precio antes",      type: "text", default: "$58",          maxLen: 10 },
      { name: "eur_new",    label: "EUR precio ahora",      type: "text", default: "US$55",        maxLen: 10 },
      { name: "footer",     label: "Footer (bottom small)", type: "text", default: "Todas tus cargas cuentan con garantía y seguro. Coordiná tu envío y nos encargamos del resto.", maxLen: 220 },
      { name: "mascot_id",  label: "Mascota",                type: "mascot", default: "dos_cajas" },
    ],
    async render(f) {
      const row = (code, oldP, newP) => `
        <div style="display:flex; align-items:center; justify-content:space-between; width:760px; height:100px; background:${COLORS.white}; border-radius:9999px; box-shadow:0 6px 14px rgba(0,0,0,0.08); padding:0 12px 0 12px; margin-bottom:24px;">
          <div style="display:flex; align-items:center; justify-content:center; height:80px; padding:0 36px; background:${COLORS.deepBlue}; color:${COLORS.white}; font-size:42px; font-weight:900; border-radius:9999px; letter-spacing:2px;">${code}</div>
          <div style="display:flex; align-items:center; gap:16px; padding-right:32px;">
            <span style="font-size:34px; color:#9CA3AF; text-decoration:line-through;">${escapeHtml(oldP)}</span>
            <span style="font-size:48px; font-weight:900; color:${COLORS.textDark};">${escapeHtml(newP)}</span>
          </div>
        </div>`;

      const markup = `
        <div style="display:flex; flex-direction:column; align-items:center; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:80px 60px 40px 60px;">
          <div style="margin-top:60px; padding:30px 70px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; font-size:78px; font-weight:900; letter-spacing:-1px; text-transform:uppercase;">
            ${escapeHtml(f.title)}
          </div>
          <div style="margin-top:24px; padding:18px 50px; background:${COLORS.lightGray}; color:${COLORS.deepBlue}; border-radius:9999px; font-size:42px; font-weight:900; letter-spacing:1px; text-transform:uppercase;">
            ${escapeHtml(f.subtitle)}
          </div>
          <div style="display:flex; flex-direction:column; align-items:center; margin-top:80px;">
            ${row("USA", f.usa_old, f.usa_new)}
            ${row("CHN", f.chn_old, f.chn_new)}
            ${row("EUR", f.eur_old, f.eur_new)}
          </div>
          <img src="${getMascotUrl(f.mascot_id)}" style="width:980px; height:780px; margin-top:30px; object-fit:contain;" />
          <div style="margin-top:auto; margin-bottom:30px; font-size:24px; font-weight:400; color:${COLORS.textDark}; text-align:center; line-height:1.4; max-width:780px;">${escapeHtml(f.footer)}</div>
        </div>
      `;
      return renderHtmlToPng(markup, 1080, 1920);
    },
  },

  // 3) Tip del día — post 1:1
  tip_del_dia: {
    id: "tip_del_dia",
    label: "Tip del día",
    description: "Post cuadrado con número de tip, título grande y body text. Ideal para serie de consejos.",
    kind: "image",
    width: 1080,
    height: 1080,
    fields: [
      { name: "tip_number", label: "Número de tip", type: "text", default: "01", maxLen: 4 },
      { name: "title",      label: "Título grande", type: "text", default: "Cómo declarar correctamente tus envíos", maxLen: 80 },
      { name: "body",       label: "Cuerpo del tip", type: "text", default: "Declarar el valor real de tus paquetes evita demoras en aduana y multas. Si tenés dudas, escribinos antes de despachar.", maxLen: 280 },
      { name: "mascot_id",  label: "Mascota (opcional)", type: "mascot", default: "" },
    ],
    async render(f) {
      const hasMascot = !!(f.mascot_id && f.mascot_id.trim());
      // Layout sin mascot: mantiene el original (column, title-arriba/body-abajo).
      // Layout con mascot: title+body en columna izquierda + mascot a la derecha.
      const innerLeft = `
          <div style="display:flex; align-items:center; padding:20px 50px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; align-self:flex-start; font-size:36px; font-weight:900; letter-spacing:2px;">
            TIP #${escapeHtml(f.tip_number)}
          </div>
          <div style="margin-top:60px; font-size:88px; font-weight:900; color:${COLORS.blueDark}; line-height:1.05; letter-spacing:-2px;">
            ${escapeHtml(f.title)}
          </div>
          <div style="margin-top:50px; font-size:36px; font-weight:400; color:${COLORS.textDark}; line-height:1.4; max-width:880px;">
            ${escapeHtml(f.body)}
          </div>`;

      const markup = hasMascot
        ? `
        <div style="display:flex; flex-direction:row; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:80px;">
          <div style="display:flex; flex-direction:column; width:560px;">${innerLeft}</div>
          <img src="${getMascotUrl(f.mascot_id)}" style="width:400px; height:400px; margin-left:auto; margin-top:auto; object-fit:contain;" />
        </div>`
        : `
        <div style="display:flex; flex-direction:column; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:80px;">${innerLeft}
        </div>`;

      return renderHtmlToPng(markup, 1080, 1080);
    },
  },

  // 4) Comparativa (2 columnas) — story 9:16
  comparativa: {
    id: "comparativa",
    label: "Comparativa (2 columnas)",
    description: "Story con titular + dos columnas para comparar opciones (Courier vs Correo, China vs USA, etc).",
    kind: "story_image",
    width: 1080,
    height: 1920,
    fields: [
      { name: "title",       label: "Titular",         type: "text", default: "COURIER VS CORREO", maxLen: 50 },
      { name: "left_label",  label: "Header columna izq",  type: "text", default: "COURIER", maxLen: 20 },
      { name: "left_items",  label: "Bullets izq (uno por línea)", type: "text", default: "Más rápido\nTrazabilidad real\nSeguro incluido\nDoor to door", maxLen: 400 },
      { name: "right_label", label: "Header columna der",  type: "text", default: "CORREO OFICIAL", maxLen: 20 },
      { name: "right_items", label: "Bullets der (uno por línea)", type: "text", default: "Más barato\nDemoras frecuentes\nSin garantía\nA retirar", maxLen: 400 },
      { name: "mascot_id",  label: "Mascota",                          type: "mascot", default: "apuntando_arriba" },
    ],
    async render(f) {
      const renderItems = (raw) => raw.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 6)
        .map(item => `<div style="display:flex; font-size:32px; font-weight:600; color:${COLORS.white}; line-height:1.3; margin-bottom:18px;">• ${escapeHtml(item)}</div>`).join("");
      const markup = `
        <div style="display:flex; flex-direction:column; align-items:center; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:80px 60px;">
          <div style="margin-top:80px; padding:30px 60px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; font-size:64px; font-weight:900; letter-spacing:-1px; text-transform:uppercase; text-align:center;">
            ${escapeHtml(f.title)}
          </div>
          <div style="display:flex; flex-direction:row; margin-top:80px; gap:30px;">
            <div style="display:flex; flex-direction:column; width:460px; padding:40px 30px; background:${COLORS.blueDark}; border-radius:50px;">
              <div style="font-size:42px; font-weight:900; color:${COLORS.white}; text-align:center; margin-bottom:30px; letter-spacing:1px;">${escapeHtml(f.left_label)}</div>
              ${renderItems(f.left_items)}
            </div>
            <div style="display:flex; flex-direction:column; width:460px; padding:40px 30px; background:${COLORS.deepBlue}; border-radius:50px;">
              <div style="font-size:42px; font-weight:900; color:${COLORS.white}; text-align:center; margin-bottom:30px; letter-spacing:1px;">${escapeHtml(f.right_label)}</div>
              ${renderItems(f.right_items)}
            </div>
          </div>
          <img src="${getMascotUrl(f.mascot_id)}" style="width:920px; height:680px; margin-top:auto; object-fit:contain;" />
        </div>
      `;
      return renderHtmlToPng(markup, 1080, 1920);
    },
  },

  // 5) Bienvenida / Saludo — story 9:16
  bienvenida: {
    id: "bienvenida",
    label: "Bienvenida / Saludo",
    description: "Story de saludo (Buenos días / Buen lunes / etc) con mensaje y mascota.",
    kind: "story_image",
    width: 1080,
    height: 1920,
    fields: [
      { name: "greeting", label: "Saludo grande",      type: "text", default: "BUEN LUNES",         maxLen: 30 },
      { name: "message",  label: "Mensaje (1-2 líneas)", type: "text", default: "Arrancamos la semana enviando cargas a todo el mundo 🍋", maxLen: 140 },
      { name: "footer",   label: "Footer (CTA)",       type: "text", default: "Mandanos tu consulta y te ayudamos.", maxLen: 100 },
      { name: "mascot_id", label: "Mascota",        type: "mascot", default: "saludo" },
    ],
    async render(f) {
      const markup = `
        <div style="display:flex; flex-direction:column; align-items:center; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:60px;">
          <div style="margin-top:200px; padding:40px 80px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; font-size:96px; font-weight:900; letter-spacing:-2px; text-transform:uppercase;">
            ${escapeHtml(f.greeting)}
          </div>
          <div style="margin-top:80px; font-size:44px; font-weight:700; color:${COLORS.blueDark}; line-height:1.3; text-align:center; max-width:860px;">
            ${escapeHtml(f.message)}
          </div>
          <img src="${getMascotUrl(f.mascot_id)}" style="width:960px; height:760px; margin-top:auto; object-fit:contain;" />
          <div style="margin-bottom:50px; font-size:30px; font-weight:600; color:${COLORS.blueDark}; text-align:center;">${escapeHtml(f.footer)}</div>
        </div>
      `;
      return renderHtmlToPng(markup, 1080, 1920);
    },
  },

  // 6) Entrega exitosa — post 1:1
  entrega_exitosa: {
    id: "entrega_exitosa",
    label: "Entrega exitosa",
    description: "Post cuadrado para celebrar entrega completada. Incluye nombre cliente y código de paquete.",
    kind: "image",
    width: 1080,
    height: 1080,
    fields: [
      { name: "customer_name", label: "Nombre cliente",     type: "text", default: "Juan",         maxLen: 40 },
      { name: "package_code",  label: "Código de envío",    type: "text", default: "USA-N-0042",   maxLen: 30 },
      { name: "subtitle",      label: "Subtítulo (CTA)",    type: "text", default: "Otra carga entregada con éxito 🍋", maxLen: 80 },
      { name: "mascot_id",      label: "Mascota",          type: "mascot", default: "paquete_llego" },
    ],
    async render(f) {
      const markup = `
        <div style="display:flex; flex-direction:column; align-items:center; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:60px;">
          <div style="margin-top:50px; padding:30px 70px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; font-size:54px; font-weight:900; letter-spacing:-1px; text-transform:uppercase;">
            ENTREGA EXITOSA
          </div>
          <div style="margin-top:50px; font-size:80px; font-weight:900; color:${COLORS.blueDark}; line-height:1.0;">
            ${escapeHtml(f.customer_name)}
          </div>
          <div style="margin-top:14px; padding:14px 36px; background:${COLORS.lightGray}; color:${COLORS.deepBlue}; border-radius:9999px; font-size:36px; font-weight:900; letter-spacing:1px;">
            ${escapeHtml(f.package_code)}
          </div>
          <img src="${getMascotUrl(f.mascot_id)}" style="width:760px; height:560px; margin-top:auto; object-fit:contain;" />
          <div style="margin-bottom:30px; font-size:32px; font-weight:600; color:${COLORS.blueDark}; text-align:center;">${escapeHtml(f.subtitle)}</div>
        </div>
      `;
      return renderHtmlToPng(markup, 1080, 1080);
    },
  },
  // 7) Guía de N pasos (4 cards) — story 9:16
  guia_n_pasos: {
    id: "guia_n_pasos",
    label: "Guía de 4 pasos",
    description: "Story con eyebrow + titular + grid 2x2 de cards (número + título + descripción) + mascota + footer.",
    kind: "story_image",
    width: 1080,
    height: 1920,
    fields: [
      { name: "eyebrow",     label: "Eyebrow (top pill)",     type: "text",   default: "GUÍA RÁPIDA",          maxLen: 30 },
      { name: "title",       label: "Titular",                type: "text",   default: "Regímenes de aduana",  maxLen: 80 },
      { name: "step1_title", label: "Paso 1 — título",        type: "text",   default: "Courier",              maxLen: 30 },
      { name: "step1_desc",  label: "Paso 1 — descripción",   type: "text",   default: "Hasta US$ 3.000, sin trámite", maxLen: 90 },
      { name: "step2_title", label: "Paso 2 — título",        type: "text",   default: "Particular",           maxLen: 30 },
      { name: "step2_desc",  label: "Paso 2 — descripción",   type: "text",   default: "Hasta US$ 1.000 al año", maxLen: 90 },
      { name: "step3_title", label: "Paso 3 — título",        type: "text",   default: "Comercial",            maxLen: 30 },
      { name: "step3_desc",  label: "Paso 3 — descripción",   type: "text",   default: "Sin tope, requiere Aduana", maxLen: 90 },
      { name: "step4_title", label: "Paso 4 — título",        type: "text",   default: "Equipaje",             maxLen: 30 },
      { name: "step4_desc",  label: "Paso 4 — descripción",   type: "text",   default: "Hasta US$ 500",        maxLen: 90 },
      { name: "mascot_id",   label: "Mascota",                type: "mascot", default: "apuntando" },
      { name: "footer",      label: "Footer (bottom small)",  type: "text",   default: "Cualquier duda escribinos y te orientamos.", maxLen: 200 },
    ],
    async render(f) {
      const card = (num, title, desc) => `
        <div style="display:flex; flex-direction:column; width:430px; height:290px; background:${COLORS.white}; border-radius:40px; padding:30px; box-shadow:0 8px 16px rgba(0,0,0,0.10);">
          <div style="display:flex; align-items:center; justify-content:center; width:80px; height:80px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; font-size:48px; font-weight:900;">${num}</div>
          <div style="margin-top:20px; font-size:38px; font-weight:900; color:${COLORS.blueDark}; line-height:1.05;">${escapeHtml(title)}</div>
          <div style="margin-top:14px; font-size:24px; font-weight:400; color:${COLORS.textDark}; line-height:1.3;">${escapeHtml(desc)}</div>
        </div>`;
      const markup = `
        <div style="display:flex; flex-direction:column; align-items:center; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:60px 50px;">
          <div style="margin-top:40px; padding:20px 50px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; font-size:32px; font-weight:700; letter-spacing:2px; text-transform:uppercase;">
            ${escapeHtml(f.eyebrow)}
          </div>
          <div style="display:flex; align-items:center; justify-content:center; margin-top:30px; padding:40px 50px; background:${COLORS.blueDark}; color:${COLORS.white}; border-radius:60px; text-align:center; max-width:920px;">
            <div style="font-size:80px; font-weight:900; line-height:1.05; letter-spacing:-2px;">${escapeHtml(f.title)}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:24px; margin-top:50px;">
            <div style="display:flex; flex-direction:row; gap:24px;">
              ${card("1", f.step1_title, f.step1_desc)}
              ${card("2", f.step2_title, f.step2_desc)}
            </div>
            <div style="display:flex; flex-direction:row; gap:24px;">
              ${card("3", f.step3_title, f.step3_desc)}
              ${card("4", f.step4_title, f.step4_desc)}
            </div>
          </div>
          <img src="${getMascotUrl(f.mascot_id)}" style="width:560px; height:560px; margin-top:30px; align-self:center; object-fit:contain;" />
          <div style="margin-top:auto; margin-bottom:30px; font-size:24px; font-weight:400; color:${COLORS.blueDark}; text-align:center; line-height:1.4; max-width:780px;">${escapeHtml(f.footer)}</div>
        </div>
      `;
      return renderHtmlToPng(markup, 1080, 1920);
    },
  },

  // 8) Tarifa post — post 1:1
  tarifa_post: {
    id: "tarifa_post",
    label: "Tarifa post",
    description: "Post cuadrado con eyebrow + ruta + precio destacado + 3 condiciones + CTA + mascota.",
    kind: "image",
    width: 1080,
    height: 1080,
    fields: [
      { name: "eyebrow",     label: "Eyebrow (top pill)",       type: "text",   default: "TARIFA",                maxLen: 20 },
      { name: "route",       label: "Ruta (USA » AR, etc.)",    type: "text",   default: "USA » AR",              maxLen: 30 },
      { name: "price_big",   label: "Precio (gigante)",          type: "text",   default: "US$ 42",                maxLen: 10 },
      { name: "price_unit",  label: "Unidad (/kg, /pie³, etc.)", type: "text",   default: "/kg",                   maxLen: 8 },
      { name: "condition_1", label: "Condición 1",               type: "text",   default: "Door to door",          maxLen: 60 },
      { name: "condition_2", label: "Condición 2",               type: "text",   default: "Seguro incluido",       maxLen: 60 },
      { name: "condition_3", label: "Condición 3",               type: "text",   default: "Trazabilidad real",     maxLen: 60 },
      { name: "cta",         label: "CTA (footer)",              type: "text",   default: "Coordiná tu envío",     maxLen: 40 },
      { name: "mascot_id",   label: "Mascota",                   type: "mascot", default: "caja_frente" },
    ],
    async render(f) {
      const cond = (txt) => `<div style="font-size:30px; font-weight:600; color:${COLORS.blueDark}; line-height:1.3; margin-bottom:14px;">• ${escapeHtml(txt)}</div>`;
      const markup = `
        <div style="display:flex; flex-direction:row; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:60px;">
          <div style="display:flex; flex-direction:column; width:580px;">
            <div style="padding:18px 44px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; align-self:flex-start; font-size:30px; font-weight:700; letter-spacing:2px; text-transform:uppercase;">
              ${escapeHtml(f.eyebrow)}
            </div>
            <div style="margin-top:30px; font-size:54px; font-weight:900; color:${COLORS.blueDark}; letter-spacing:-1px;">${escapeHtml(f.route)}</div>
            <div style="display:flex; flex-direction:row; align-items:flex-end; margin-top:20px;">
              <div style="font-size:130px; font-weight:900; color:${COLORS.deepBlue}; line-height:0.95; letter-spacing:-3px;">${escapeHtml(f.price_big)}</div>
              <div style="font-size:38px; font-weight:700; color:${COLORS.blueDark}; margin-left:12px; margin-bottom:20px;">${escapeHtml(f.price_unit)}</div>
            </div>
            <div style="display:flex; flex-direction:column; margin-top:30px;">
              ${cond(f.condition_1)}
              ${cond(f.condition_2)}
              ${cond(f.condition_3)}
            </div>
            <div style="margin-top:auto; padding:20px 44px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; align-self:flex-start; font-size:32px; font-weight:900;">
              ${escapeHtml(f.cta)}
            </div>
          </div>
          <img src="${getMascotUrl(f.mascot_id)}" style="width:380px; height:380px; margin-left:auto; margin-top:auto; object-fit:contain;" />
        </div>
      `;
      return renderHtmlToPng(markup, 1080, 1080);
    },
  },

  // 9) Stats del mes — story 9:16
  stats_mes: {
    id: "stats_mes",
    label: "Stats del mes",
    description: "Story con titular + 3 stats (número grande + label) + mascota + footer.",
    kind: "story_image",
    width: 1080,
    height: 1920,
    fields: [
      { name: "title",       label: "Titular",            type: "text",   default: "MAYO EN NÚMEROS",     maxLen: 30 },
      { name: "stat1_num",   label: "Stat 1 — número",    type: "text",   default: "+1.200",              maxLen: 10 },
      { name: "stat1_label", label: "Stat 1 — label",     type: "text",   default: "PAQUETES ENVIADOS",   maxLen: 30 },
      { name: "stat2_num",   label: "Stat 2 — número",    type: "text",   default: "98%",                 maxLen: 10 },
      { name: "stat2_label", label: "Stat 2 — label",     type: "text",   default: "ENTREGAS A TIEMPO",   maxLen: 30 },
      { name: "stat3_num",   label: "Stat 3 — número",    type: "text",   default: "37",                  maxLen: 10 },
      { name: "stat3_label", label: "Stat 3 — label",     type: "text",   default: "PAÍSES ALCANZADOS",   maxLen: 30 },
      { name: "mascot_id",   label: "Mascota",            type: "mascot", default: "victoria_cajas" },
      { name: "footer",      label: "Footer",             type: "text",   default: "Gracias por elegirnos cada día 🍋", maxLen: 200 },
    ],
    async render(f) {
      const stat = (num, label) => `
        <div style="display:flex; flex-direction:column; align-items:center; padding:30px 0; border-bottom:4px solid ${COLORS.deepBlue}; width:880px;">
          <div style="font-size:180px; font-weight:900; color:${COLORS.deepBlue}; line-height:0.95; letter-spacing:-4px;">${escapeHtml(num)}</div>
          <div style="margin-top:14px; font-size:36px; font-weight:700; color:${COLORS.blueDark}; letter-spacing:2px; text-transform:uppercase;">${escapeHtml(label)}</div>
        </div>`;
      const markup = `
        <div style="display:flex; flex-direction:column; align-items:center; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:60px;">
          <div style="margin-top:60px; padding:24px 56px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; font-size:54px; font-weight:900; letter-spacing:1px; text-transform:uppercase; text-align:center;">
            ${escapeHtml(f.title)}
          </div>
          <div style="display:flex; flex-direction:column; align-items:center; margin-top:60px;">
            ${stat(f.stat1_num, f.stat1_label)}
            ${stat(f.stat2_num, f.stat2_label)}
            ${stat(f.stat3_num, f.stat3_label)}
          </div>
          <img src="${getMascotUrl(f.mascot_id)}" style="width:560px; height:560px; margin-top:30px; object-fit:contain;" />
          <div style="margin-top:auto; margin-bottom:30px; font-size:30px; font-weight:600; color:${COLORS.blueDark}; text-align:center; line-height:1.4; max-width:880px;">${escapeHtml(f.footer)}</div>
        </div>
      `;
      return renderHtmlToPng(markup, 1080, 1920);
    },
  },

  // 10) Quote / testimonio cliente — post 1:1
  quote_testimonio: {
    id: "quote_testimonio",
    label: "Quote / Testimonio",
    description: "Post cuadrado con quote grande, autor y mascota. Para testimonios o frases de marca.",
    kind: "image",
    width: 1080,
    height: 1080,
    fields: [
      { name: "quote",         label: "Quote (texto entre comillas)", type: "text",   default: "Llegó perfecto y antes de tiempo, los recomiendo a ojos cerrados.", maxLen: 220 },
      { name: "author_name",   label: "Nombre autor",                  type: "text",   default: "Cliente Lemons",       maxLen: 40 },
      { name: "author_origin", label: "Origen / contexto",             type: "text",   default: "Cliente Buenos Aires", maxLen: 50 },
      { name: "mascot_id",     label: "Mascota",                       type: "mascot", default: "saludo" },
    ],
    async render(f) {
      const markup = `
        <div style="display:flex; flex-direction:row; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:60px;">
          <div style="display:flex; flex-direction:column; width:580px;">
            <div style="display:flex; font-size:240px; font-weight:900; color:${COLORS.deepBlue}; line-height:0.6; height:140px;">"</div>
            <div style="display:flex; margin-top:0; font-size:42px; font-weight:700; color:${COLORS.blueDark}; line-height:1.3; max-width:580px;">${escapeHtml(f.quote)}</div>
            <div style="display:flex; margin-top:50px; height:4px; width:200px; background:${COLORS.deepBlue};"></div>
            <div style="display:flex; margin-top:30px; font-size:34px; font-weight:900; color:${COLORS.deepBlue}; text-transform:uppercase; letter-spacing:1px;">${escapeHtml(f.author_name)}</div>
            <div style="display:flex; margin-top:6px; font-size:24px; font-weight:400; color:${COLORS.textDark};">${escapeHtml(f.author_origin)}</div>
          </div>
          <img src="${getMascotUrl(f.mascot_id)}" style="width:380px; height:380px; margin-left:auto; margin-top:auto; object-fit:contain;" />
        </div>
      `;
      return renderHtmlToPng(markup, 1080, 1080);
    },
  },

  // 11) Hero announcement — story 9:16
  hero_announcement: {
    id: "hero_announcement",
    label: "Hero announcement",
    description: "Story con eyebrow + titular gigante 1-2 líneas + subtitle + mascota grande + CTA. Para anuncios de impacto.",
    kind: "story_image",
    width: 1080,
    height: 1920,
    fields: [
      { name: "eyebrow",      label: "Eyebrow (top pill)",      type: "text",   default: "ATENCIÓN",         maxLen: 30 },
      { name: "title_line_1", label: "Titular línea 1",         type: "text",   default: "ENVÍOS",           maxLen: 22 },
      { name: "title_line_2", label: "Titular línea 2 (opc)",   type: "text",   default: "",                 maxLen: 22 },
      { name: "subtitle",     label: "Subtítulo",                type: "text",   default: "Reducimos los tiempos en ruta", maxLen: 100 },
      { name: "cta",          label: "CTA (footer)",             type: "text",   default: "Coordiná tu envío", maxLen: 40 },
      { name: "mascot_id",    label: "Mascota",                  type: "mascot", default: "cajas_pulgar" },
    ],
    async render(f) {
      const hasLine2 = !!(f.title_line_2 && f.title_line_2.trim());
      const titleBlock = `
        <div style="display:flex; font-size:130px; font-weight:900; color:${COLORS.blueDark}; line-height:0.95; letter-spacing:-3px; text-transform:uppercase;">${escapeHtml(f.title_line_1)}</div>
        ${hasLine2 ? `<div style="display:flex; font-size:130px; font-weight:900; color:${COLORS.blueDark}; line-height:0.95; letter-spacing:-3px; text-transform:uppercase;">${escapeHtml(f.title_line_2)}</div>` : ""}`;
      const markup = `
        <div style="display:flex; flex-direction:column; align-items:center; width:100%; height:100%; background:${COLORS.yellow}; font-family:Inter; padding:60px;">
          <div style="display:flex; margin-top:80px; padding:24px 56px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; font-size:36px; font-weight:700; letter-spacing:2px; text-transform:uppercase;">
            ${escapeHtml(f.eyebrow)}
          </div>
          <div style="display:flex; flex-direction:column; align-items:center; margin-top:60px; text-align:center;">
            ${titleBlock}
          </div>
          <div style="display:flex; margin-top:40px; padding:30px 50px; background:${COLORS.blueDark}; color:${COLORS.white}; border-radius:50px; font-size:34px; font-weight:600; line-height:1.3; text-align:center; max-width:880px;">
            ${escapeHtml(f.subtitle)}
          </div>
          <img src="${getMascotUrl(f.mascot_id)}" style="width:880px; height:880px; margin-top:auto; object-fit:contain;" />
          <div style="display:flex; padding:24px 56px; background:${COLORS.deepBlue}; color:${COLORS.white}; border-radius:9999px; font-size:36px; font-weight:900; margin-bottom:40px;">
            ${escapeHtml(f.cta)}
          </div>
        </div>
      `;
      return renderHtmlToPng(markup, 1080, 1920);
    },
  },
};

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function renderTemplate(templateId, fields) {
  const t = TEMPLATES[templateId];
  if (!t) throw new Error(`Template no encontrado: ${templateId}`);
  const merged = {};
  for (const fld of t.fields) merged[fld.name] = (fields[fld.name] || fld.default || "").toString().slice(0, fld.maxLen || 1000);
  return t.render(merged);
}

function listTemplates() {
  return Object.values(TEMPLATES).map(t => ({
    id: t.id,
    label: t.label,
    description: t.description,
    kind: t.kind,
    width: t.width,
    height: t.height,
    fields: t.fields,
  }));
}

module.exports = { renderTemplate, listTemplates, TEMPLATES, COLORS, getMascotUrl, listMascots };
