// server/lib/htmlBranding.js
//
// Transform server-side del index.html para que <title>, metas PWA,
// theme-color y open-graph reflejen el branding actual del wizard antes
// de que el JS arranque. Esto cubre:
//   - Tab title en la primera pintura (sin flash de "Mi Portal" → nombre real)
//   - Crawlers que NO ejecutan JS (Twitter card, WhatsApp link preview,
//     LinkedIn unfurl, Slack, etc.)
//   - PWA install prompt
//
// Estrategia: regex sobre el HTML crudo. Los tags ya están en el index.html
// con valores starter ("Mi Portal", etc.); los reemplazamos por los del
// branding live. Cache del HTML transformado por 30s para no rehacer regex
// en cada request.
//
//   const html = await brandHtml(rawHtml);
//
"use strict";

const { getBranding } = require("./branding");

const TTL_MS = 30_000;
let cache = null;
let cacheKey = null;
let cacheAt = 0;

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Reemplaza el `content="..."` del primer match de `<meta {selector} ...>`,
// o lo agrega antes de </head> si no existe.
function replaceMeta(html, selector, value) {
  const safe = escapeHtml(value);
  // intentamos match con name= o property= (ambos son válidos para metas)
  const re = new RegExp(
    `(<meta\\s+(?:name|property)="${selector}"\\s+content=")[^"]*(")`,
    "i"
  );
  if (re.test(html)) return html.replace(re, `$1${safe}$2`);
  // fallback: insert antes de </head>
  const tag = `<meta ${
    /^og:|^twitter:/.test(selector) ? "property" : "name"
  }="${selector}" content="${safe}" />`;
  return html.replace(/<\/head>/i, `  ${tag}\n  </head>`);
}

async function brandHtml(rawHtml) {
  const now = Date.now();
  // Mismo HTML + cache válido → retornamos cache
  const key = rawHtml.length + ":" + rawHtml.slice(0, 64);
  if (cache && cacheKey === key && now - cacheAt < TTL_MS) return cache;

  const b = await getBranding();
  const name = b.name || "Mi Portal";
  const slogan = b.slogan || "";
  const themeColor = b.color_primary || "#3B82F6";
  const tileColor = b.color_bg || "#04060d";
  const ogImage = b.logo_url || "/icons/icon-512.png";

  let html = rawHtml;
  // <title>
  html = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${escapeHtml(name)}</title>`
  );
  // PWA name metas
  html = replaceMeta(html, "application-name", name);
  html = replaceMeta(html, "apple-mobile-web-app-title", name);
  html = replaceMeta(html, "theme-color", themeColor);
  html = replaceMeta(html, "msapplication-TileColor", tileColor);
  html = replaceMeta(html, "description", slogan);
  // Open Graph + Twitter
  html = replaceMeta(html, "og:title", name);
  html = replaceMeta(html, "og:description", slogan);
  html = replaceMeta(html, "og:image", ogImage);
  html = replaceMeta(html, "twitter:title", name);
  html = replaceMeta(html, "twitter:description", slogan);

  cache = html;
  cacheKey = key;
  cacheAt = now;
  return html;
}

function invalidateCache() {
  cache = null;
  cacheKey = null;
  cacheAt = 0;
}

// Genera el contenido completo de /manifest.json a partir del branding actual.
// Reemplaza el archivo estático con un endpoint dinámico — el admin cambia el
// nombre/colores en el wizard y el manifest se actualiza sin redeploy.
async function brandManifest() {
  const b = await getBranding();
  const name = b.name || "Mi Portal";
  const shortName = name.length > 12 ? (name.split(/\s+/)[0] || name.slice(0, 12)) : name;

  const icons = [];
  // Si hay logo_url custom subido al wizard, usarlo como primer icono
  // (PWA usa el primer "any" como app icon principal en algunos browsers).
  if (b.logo_url) {
    icons.push({
      src: b.logo_url,
      sizes: "any",
      type: b.logo_url.endsWith(".svg") ? "image/svg+xml" : "image/png",
      purpose: "any",
    });
  }
  icons.push(
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    { src: "/icons/icon.svg",     sizes: "any",     type: "image/svg+xml", purpose: "any" }
  );

  return {
    name,
    short_name: shortName,
    description: b.slogan || "Portal de la comunidad",
    start_url: "/",
    display: "standalone",
    background_color: b.color_bg || "#080808",
    theme_color: b.color_primary || "#3B82F6",
    orientation: "portrait-primary",
    lang: "es",
    categories: ["productivity", "social"],
    icons,
    shortcuts: [
      { name: "Inicio", short_name: "Inicio", url: "/inicio",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Perfil", short_name: "Perfil", url: "/profile",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

module.exports = { brandHtml, brandManifest, invalidateCache };
