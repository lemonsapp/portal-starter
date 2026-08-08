// server/lib/ranking-publico.js — qué ve cualquiera (incluso sin login) cuando
// abre el ranking de puntos: GET /profile/ranking.
//
// La ruta no pide token a propósito: es una tabla de posiciones, tiene que poder
// mirarse. Pero eso significa que lo que devuelve es público de verdad, así que
// la decisión de qué sale vive acá, pura y testeada (lib/ranking-publico.test.js),
// igual que perfil-publico.js hace con el perfil.
//
// EL BUG QUE ESTO CIERRA (auditoría 2026-08-08, hallazgo C1): la ruta devolvía
// `client_number` y `role` de los primeros clientes, con sus saldos de puntos y
// monedas, sin mirar una sola bandera privacy_*. Con un curl sin credenciales se
// llevaba el padrón de HOLISTIC.
"use strict";

const { sinCamposPrivados, visibilidadPerfil } = require("./perfil-publico");

const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO      = 50;

// Lo único que un ranking necesita mostrar de identidad: quién es. Todo lo demás
// de acá es cosmética del perfil (avatar, marco, colores del nombre, insignias).
// Es una lista blanca a propósito: si mañana el SQL trae una columna nueva, no
// se filtra sola — hay que agregarla acá y pensarlo. Los saldos (balance,
// total_earned, monedas_balance) y los adornos sociales (posts/friends) se
// agregan aparte, ya como números, más abajo.
const CAMPOS_VISIBLES = [
  "id", "name",
  "nickname", "nick_color", "nick_glow",
  "name_color", "name_glow", "name_glow_color", "name_grad_from", "name_grad_to",
  "icon_slug", "avatar_url", "avatar_key", "frame_key", "badges",
];

// El ranking marca a la gente de la casa con un 💎 y una chapita STAFF. Eso se
// resuelve con un BOOLEANO derivado acá, nunca devolviendo `role`: el rol es un
// dato de cuenta, con valores enumerables que sirven para segmentar el padrón;
// `is_staff` no dice nada que quien mira el ranking no vea igual en la chapita.
// La cuenta se hace en el server: al cliente no le llega el rol ni para
// calcularlo. El perfil público hace lo mismo con más detalle (staff_badge, con
// la corona del admin y el escudo del operador separados). La regla es la misma
// en las dos rutas: el rol se lee para derivar y no sale nunca.
const ROLES_STAFF = ["admin", "operator"];

function esStaff(role) {
  return ROLES_STAFF.includes(role);
}

function normalizarLimite(valor) {
  const n = parseInt(valor, 10);
  if (!Number.isFinite(n) || n < 1) return LIMITE_POR_DEFECTO;
  return Math.min(n, LIMITE_MAXIMO);
}

function aNumero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Arma una fila del ranking, o `null` si esa persona no corresponde que
 * aparezca.
 *
 * Las dos banderas se tratan distinto, y no es capricho:
 *
 *   · privacy_coins = false → la persona NO aparece. Los coins no son un dato
 *     más de la fila: son la métrica que ordena la tabla (se ordena por
 *     total_earned). Devolver la fila sin el número igual delata el valor,
 *     porque la posición lo encierra entre el de arriba y el de abajo. Un
 *     ranking es "el orden de los coins": ocultar los coins es quedarse afuera.
 *     Por eso balance, total_earned y monedas_balance sólo salen para quien
 *     dejó sus coins visibles — y si no, la fila entera se omite.
 *
 *   · privacy_envios = false → la persona SÍ aparece, sin los adornos sociales
 *     (📰 posts · 👥 amigos). Son un adorno al costado, no ordenan nada:
 *     sacarlos no dice nada de lo que sacaste.
 */
function armarFilaRanking(fila) {
  if (!fila || typeof fila !== "object") return null;

  const ver = visibilidadPerfil(fila);
  if (!ver.coins) return null;

  // Cinturón y tiradores: la lista blanca de abajo ya deja afuera email, role y
  // client_number, pero pasamos igual por el mismo helper que el perfil público
  // para que sea un solo lugar el que define "esto es dato de cuenta".
  const limpio = sinCamposPrivados(fila);

  const out = {};
  for (const campo of CAMPOS_VISIBLES) {
    if (limpio[campo] !== undefined) out[campo] = limpio[campo];
  }

  // Derivado del rol, que se queda acá: entra en la fila cruda y no sale nunca
  // en la respuesta (no está en CAMPOS_VISIBLES y sinCamposPrivados lo borra).
  out.is_staff = esStaff(fila.role);

  // Los saldos: la fila ya pasó el filtro de privacy_coins, así que salen.
  out.balance         = aNumero(limpio.balance);
  out.total_earned    = aNumero(limpio.total_earned);
  out.monedas_balance = aNumero(limpio.monedas_balance);

  if (ver.envios) {
    out.posts_count   = aNumero(limpio.posts_count);
    out.friends_count = aNumero(limpio.friends_count);
  }

  return out;
}

/** Filas crudas del SQL → el array que se manda por la ruta. */
function armarRankingPublico(filas) {
  if (!Array.isArray(filas)) return [];
  return filas.map(armarFilaRanking).filter(Boolean);
}

module.exports = {
  armarRankingPublico,
  armarFilaRanking,
  normalizarLimite,
  esStaff,
  CAMPOS_VISIBLES,
  ROLES_STAFF,
  LIMITE_MAXIMO,
  LIMITE_POR_DEFECTO,
};
