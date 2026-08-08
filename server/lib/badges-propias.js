// server/lib/badges-propias.js — qué insignias puede EQUIPAR de verdad un usuario.
//
// PATCH /profile escribía el array `badges` del body directo a
// user_profiles.badges, sin validar propiedad. Cualquier autenticado (y con el
// registro abierto, cualquiera con un email descartable) se ponía las insignias
// de staff `grantOnly` (CREATOR / MOD / BOT) y las pagas (VIP) sin tenerlas — el
// prerrequisito clásico de una estafa de soporte falso en el chat.
//
// EL BUG QUE ESTO CIERRA (auditoría 2026-08-08, hallazgo H5): faltaba el
// `hasItem()` que sí tienen avatar_key / frame_key / title_key. La FUENTE DE
// PROPIEDAD es la tabla `user_items` (item_key) — es donde caen TODAS las
// insignias que se pueden equipar legítimamente: las pagas y las gratis por
// /profile/buy, las grant-only que da un admin (/profile/studio/badge y el grant
// de admin), y es exactamente lo que el cliente refleja como `owned_items`.
//
// Se INTERSECTA lo pedido contra lo que el usuario posee y se descartan en
// silencio las que no. Como la salida es un subconjunto de claves reales de
// user_items, de paso se cierra la inyección del literal de array de Postgres
// que denunciaba la auditoría (una badge con `,` `"` o `}` nunca sale de la DB).
//
// Corrida (sin DB):  cd server && node lib/badges-propias.test.js
"use strict";

// requested: el array `badges` que mandó el cliente (puede venir cualquier cosa).
// owned:     las item_key que el usuario tiene en user_items.
// Devuelve el subconjunto de requested que el usuario realmente posee, sin
// duplicados y respetando el orden en que las pidió. Si `requested` no es un
// array, devuelve null → el caller lo trata como "no vino el campo" (COALESCE
// mantiene lo que ya tenía puesto), en vez de reventar el .join en un 500.
function filtrarBadgesPropias(requested, owned) {
  if (!Array.isArray(requested)) return null;
  const propias = new Set(Array.isArray(owned) ? owned : []);
  const vistas  = new Set();
  const out = [];
  for (const b of requested) {
    if (typeof b !== "string") continue;   // sólo claves string válidas
    if (!propias.has(b)) continue;         // no la tiene → se descarta en silencio
    if (vistas.has(b)) continue;           // sin duplicados
    vistas.add(b);
    out.push(b);
  }
  return out;
}

module.exports = { filtrarBadgesPropias };
