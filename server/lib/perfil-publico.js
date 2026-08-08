// server/lib/perfil-publico.js — qué ve alguien que NO está logueado cuando abre
// un perfil público (GET /profile/u/:username).
//
// La lógica vive acá, pura y sin base de datos, por dos motivos:
//   1. se puede testear (lib/perfil-publico.test.js),
//   2. hay un solo lugar donde decidir qué sale y qué no — antes estaba
//      desparramado en el handler y las banderas de privacidad ni se miraban.
//
// EL BUG QUE ESTO CIERRA (auditoría 2026-08-08, hallazgo C1): la ruta devolvía
// email, role y client_number de cualquier username enumerable, sin login y sin
// mirar una sola bandera privacy_*. Con un curl y un `for` se llevaba el padrón
// entero de clientes de HOLISTIC.
"use strict";

// Campos que NUNCA salen de un perfil público, pase lo que pase con las
// banderas de privacidad. No son "datos de perfil": son datos de la cuenta.
// El email y el client_number identifican a la persona; el role dice qué puede
// hacer adentro del portal. Nada de eso es asunto de un visitante anónimo.
const CAMPOS_PRIVADOS = ["email", "role", "client_number"];

// Campos que SÓLO puede poner esta función. Si vienen en la fila cruda —una
// columna nueva de la base, un objeto que alguien arme en el handler— se
// descartan antes de armar la respuesta: la chapita se deriva del rol acá y en
// ningún otro lado, así no hay forma de inyectar una desde afuera.
const CAMPOS_DERIVADOS = ["staff_badge"];

// La chapita de la casa: la corona del admin y el escudo del operador que la
// página de perfil dibuja al lado del nombre. Es lo ÚNICO que esa pantalla
// necesita del rol, y sale ya dibujada — emoji, textos y colores — no como el
// rol para que el cliente decida.
//
// Por qué no es `role` con otro nombre: no toma los valores del rol ("admin",
// "operator", "client") ni se usa igual. El cliente no ramifica sobre ella: la
// pinta. Lo que viaja es exactamente lo que cualquiera que abra la página ve
// dibujado, ni un dato más sobre la posición de esa cuenta en el portal.
//
// Los valores (emoji, colores, labels) son EXACTAMENTE los que ProfilePage.jsx
// ya dibujaba a mano a partir del rol: 👑/ADMIN en rojo, 🛡/OP en naranja.
const CHAPITAS_STAFF = {
  admin: {
    icon: "👑",
    label: "ADMIN",         // la chapita corta al lado del nombre
    title: "ADMIN",         // el title del peón sobre el avatar
    color: "#ef4444",       // color base: peón, borde, nombre
    text_color: "#fca5a5",  // el texto de la chapita, más claro
    color_dark: "#dc2626",  // el segundo color del degradé del peón
  },
  operator: {
    icon: "🛡",
    label: "OP",
    title: "OPERADOR",
    color: "#fb923c",
    text_color: "#fb923c",
    color_dark: "#f97316",
  },
};

/**
 * Traduce un rol a la chapita que le corresponde, o null si no es de la casa.
 * Devuelve una copia: la tabla de arriba no se toca desde afuera.
 *
 * El `hasOwnProperty` no es paranoia de más: sin él, un rol llamado "toString"
 * o "constructor" pescaría algo del prototipo de Object y saldría una chapita
 * vacía donde no hay staff.
 */
function chapitaStaff(role) {
  if (typeof role !== "string") return null;
  if (!Object.prototype.hasOwnProperty.call(CHAPITAS_STAFF, role)) return null;
  return { ...CHAPITAS_STAFF[role] };
}

// Las banderas de la tabla user_profiles significan VISIBLE, no "privado":
// privacy_envios = true  → las stats se ven.
// Defaults de la columna: envios/coins/logros/posts en TRUE, amigos en FALSE.
// null/undefined = el usuario todavía no eligió → vale el default de la columna.
// Es la misma lectura que hace el cliente (ProfilePage.jsx), así no se
// contradicen el toggle que ve el dueño y lo que devuelve la API.
const DEFAULTS = {
  envios: true,
  coins: true,
  logros: true,
  posts: true,
  amigos: false,
};

function bandera(valor, porDefecto) {
  if (valor === null || valor === undefined) return porDefecto;
  return valor === true;
}

/**
 * Traduce las columnas privacy_* de un perfil a un objeto de visibilidad.
 * Sirve tanto para el perfil público como para el ranking.
 */
function visibilidadPerfil(perfil) {
  const p = perfil || {};
  return {
    envios: bandera(p.privacy_envios, DEFAULTS.envios),
    coins: bandera(p.privacy_coins, DEFAULTS.coins),
    logros: bandera(p.privacy_logros, DEFAULTS.logros),
    posts: bandera(p.privacy_posts, DEFAULTS.posts),
    amigos: bandera(p.privacy_amigos, DEFAULTS.amigos),
  };
}

/** Devuelve una copia del objeto sin los campos de cuenta. */
function sinCamposPrivados(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = { ...obj };
  for (const campo of CAMPOS_PRIVADOS) delete out[campo];
  return out;
}

/** Devuelve una copia del objeto sin los campos que sólo puede poner esta lib. */
function sinCamposDerivados(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = { ...obj };
  for (const campo of CAMPOS_DERIVADOS) delete out[campo];
  return out;
}

/**
 * Arma la respuesta de un perfil público a partir de las filas crudas de la
 * base. Recibe todo junto y decide qué se muestra:
 *
 *   - envios  → stats (en HOLISTIC son las stats sociales: posts, likes,
 *               amigos, seguidores, días activo — no hay envíos en este portal,
 *               la bandera legacy gobierna igual ese bloque de actividad)
 *   - coins   → coins (balance y total ganado)
 *   - logros  → owned_items (todo lo que desbloqueó)
 *
 * Las insignias EQUIPADAS (`badges`) son cosmética del perfil, como el marco o
 * el título: siguen visibles aunque los logros estén ocultos. Lo que la
 * bandera `logros` tapa es la colección completa de desbloqueos.
 *
 * `posts` y `amigos` viajan como banderas para que el front sepa qué pedir,
 * pero esos datos NO salen por esta ruta (tienen endpoints propios).
 *
 * `staff_badge` se deriva del rol de la fila cruda y sale ya dibujada. El rol
 * entra acá y no sale: no está en `user`, y `sinCamposPrivados` lo borra de
 * `profile`.
 */
function armarPerfilPublico({ perfil, stats, coins, ownedItems } = {}) {
  if (!perfil) return null;

  const ver = visibilidadPerfil(perfil);
  const limpio = sinCamposDerivados(sinCamposPrivados(perfil));

  return {
    user: {
      id: limpio.id,
      name: limpio.name,
      username: limpio.username,
      // Del crudo, no de `limpio`: ahí el rol ya no está. Se lee para dibujar
      // la chapita y muere en esta línea.
      staff_badge: chapitaStaff(perfil.role),
    },
    profile: {
      ...limpio,
      owned_items: ver.logros ? ownedItems || [] : [],
    },
    stats: ver.envios ? stats || null : null,
    coins: ver.coins ? coins || null : null,
  };
}

module.exports = {
  CAMPOS_PRIVADOS,
  CAMPOS_DERIVADOS,
  CHAPITAS_STAFF,
  armarPerfilPublico,
  chapitaStaff,
  visibilidadPerfil,
  sinCamposPrivados,
  sinCamposDerivados,
};
