"use strict";

// Centralizado: leer de env, con fallback razonable.
// El día que cambien, se modifica solo acá o se setea env en Render.
module.exports = {
  IG_USER_ID:    process.env.IG_USER_ID    || "17841402140259298",
  META_PAGE_ID:  process.env.META_PAGE_ID  || "536983209502584",
};
