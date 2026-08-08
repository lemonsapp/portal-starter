// server/lib/perfil-publico.test.js — el armado del perfil público: lo único que
// separa la base de datos de un visitante sin login en GET /profile/u/:username.
// Corrida (sin DB): cd server && node lib/perfil-publico.test.js
//
// EL BUG QUE ESTO PREVIENE (auditoría 2026-08-08, hallazgo C1): la ruta devolvía
// `email`, `role` y `client_number` de cualquier username enumerable, sin login y
// sin mirar una sola bandera privacy_*. Con un curl y un `for` sobre los
// usernames del ranking se bajaba el padrón entero de clientes de HOLISTIC.
"use strict";

const assert = require("node:assert");
const {
  armarPerfilPublico, chapitaStaff, visibilidadPerfil,
  sinCamposPrivados, CAMPOS_PRIVADOS,
} = require("./perfil-publico");

let fallas = 0;
function ok(msg) { console.log(`✓ ${msg}`); }
function mal(msg) { fallas++; console.error(`✗ ${msg}`); }

// La fila cruda que arma el handler: users + user_profiles.
function perfilCrudo(extra = {}) {
  return {
    id: 7,
    name: "Renzo Ricci",
    email: "renzo@ejemplo.com",
    role: "client",
    client_number: 3,
    username: "renzo",
    bio: "cultivo indoor",
    avatar_key: "avatar_lemon",
    frame_key: "frame_gold",
    title_key: "title_pro",
    badges: ["badge_first"],
    avatar_url: "https://cdn/renzo.png",
    banner_effect: "none",
    banner_color1: "#f5e03a",
    banner_color2: "#ff6200",
    custom_name: null,
    name_color: "#f5e03a",
    name_glow_color: "#fff",
    name_glow: 8,
    privacy_envios: true,
    privacy_coins: true,
    privacy_logros: true,
    privacy_posts: true,
    privacy_amigos: false,
    features_unlocked: [],
    ...extra,
  };
}
const STATS  = { posts: 12, likes: 40, friends: 8, followers: 5, following: 3, days_active: 20 };
const COINS  = { balance: 1200, total_earned: 3000 };
const ITEMS  = ["avatar_lemon", "frame_gold", "badge_first"];

function apareceEnAlgunLado(obj, campo) {
  return JSON.stringify(obj).includes(`"${campo}"`);
}

// ── Lo innegociable: email, role y client_number nunca salen ──────
// Da igual cómo estén las banderas, y da igual que el SQL los traiga.
const COMBINACIONES = [
  {},
  { privacy_envios: true,  privacy_coins: true,  privacy_logros: true },
  { privacy_envios: false, privacy_coins: false, privacy_logros: false },
  { privacy_envios: null,  privacy_coins: null,  privacy_logros: null },
  { role: "admin" }, { role: "operator" },
];
try {
  for (const combo of COMBINACIONES) {
    const out = armarPerfilPublico({ perfil: perfilCrudo(combo), stats: STATS, coins: COINS, ownedItems: ITEMS });
    for (const campo of CAMPOS_PRIVADOS) {
      assert.ok(!apareceEnAlgunLado(out, campo), `${campo} apareció con ${JSON.stringify(combo)}`);
    }
  }
  ok("email, role y client_number NUNCA salen del perfil público, con cualquier bandera ni rol");
} catch (e) { mal(`fuga de datos de cuenta: ${e.message}`); }

// El rol no sale ni por su VALOR (no basta con que no aparezca la clave "role").
try {
  const out = armarPerfilPublico({ perfil: perfilCrudo({ role: "admin" }), stats: STATS, coins: COINS, ownedItems: ITEMS });
  assert.ok(!JSON.stringify(out).includes("admin"), "el valor del rol viaja en la respuesta");
  assert.ok(!JSON.stringify(out).includes("renzo@ejemplo.com"), "el email viaja en la respuesta");
  ok("ni el valor del rol ni el email viajan por ningún lado de la respuesta");
} catch (e) { mal(`el valor del dato de cuenta se coló: ${e.message}`); }

// ── staff_badge: la chapita dibujada, derivada del rol ──────────
try {
  const admin = armarPerfilPublico({ perfil: perfilCrudo({ role: "admin" }), stats: STATS, coins: COINS, ownedItems: ITEMS });
  assert.strictEqual(admin.user.staff_badge.icon, "👑", "corona del admin");
  assert.strictEqual(admin.user.staff_badge.label, "ADMIN");
  const op = armarPerfilPublico({ perfil: perfilCrudo({ role: "operator" }), stats: STATS, coins: COINS, ownedItems: ITEMS });
  assert.strictEqual(op.user.staff_badge.icon, "🛡", "escudo del operador");
  assert.strictEqual(op.user.staff_badge.label, "OP");
  const cli = armarPerfilPublico({ perfil: perfilCrudo({ role: "client" }), stats: STATS, coins: COINS, ownedItems: ITEMS });
  assert.strictEqual(cli.user.staff_badge, null, "un cliente no tiene chapita");
  ok("staff_badge sale ya dibujada para admin/operator, y null para el resto");
} catch (e) { mal(`staff_badge mal derivada: ${e.message}`); }

// No se puede inyectar una chapita desde la fila cruda: se deriva del rol y nada
// más. Un staff_badge que venga en el crudo se descarta.
try {
  const out = armarPerfilPublico({
    perfil: perfilCrudo({ role: "client", staff_badge: { icon: "👑", label: "ADMIN" } }),
    stats: STATS, coins: COINS, ownedItems: ITEMS,
  });
  assert.strictEqual(out.user.staff_badge, null, "la chapita inyectada sobrevivió");
  assert.ok(!apareceEnAlgunLado(out.profile, "staff_badge"), "quedó una chapita colada en profile");
  ok("una staff_badge inyectada en la fila cruda se descarta: sólo la deriva el server");
} catch (e) { mal(`chapita inyectable: ${e.message}`); }

// hasOwnProperty: un rol tipo "constructor"/"toString" no pesca nada del prototipo.
try {
  for (const role of ["constructor", "toString", "hasOwnProperty"]) {
    assert.strictEqual(chapitaStaff(role), null, `${role} no debería dar chapita`);
  }
  ok("un rol con nombre de método de Object no engancha una chapita fantasma");
} catch (e) { mal(`chapitaStaff pescó del prototipo: ${e.message}`); }

// ── Banderas: withhold real de cada bloque ───────────────
try {
  const out = armarPerfilPublico({ perfil: perfilCrudo(), stats: STATS, coins: COINS, ownedItems: ITEMS });
  assert.deepStrictEqual(out.stats, STATS, "envios=true → stats visibles");
  assert.deepStrictEqual(out.coins, COINS, "coins=true → coins visibles");
  assert.deepStrictEqual(out.profile.owned_items, ITEMS, "logros=true → colección visible");
  ok("con las banderas en true salen stats, coins y la colección");
} catch (e) { mal(`las banderas públicas deberían dejar pasar: ${e.message}`); }

try {
  const out = armarPerfilPublico({
    perfil: perfilCrudo({ privacy_envios: false, privacy_coins: false, privacy_logros: false }),
    stats: STATS, coins: COINS, ownedItems: ITEMS,
  });
  assert.strictEqual(out.stats, null, "envios=false → stats retenidas");
  assert.strictEqual(out.coins, null, "coins=false → coins retenidos");
  assert.deepStrictEqual(out.profile.owned_items, [], "logros=false → colección retenida");
  // Pero el perfil sigue existiendo y con su cosmética.
  assert.strictEqual(out.user.name, "Renzo Ricci", "el nombre sigue");
  assert.strictEqual(out.profile.avatar_url, "https://cdn/renzo.png", "el avatar sigue");
  assert.deepStrictEqual(out.profile.badges, ["badge_first"], "las insignias equipadas siguen");
  ok("una bandera en false RETIENE de verdad su bloque, sin romper el perfil");
} catch (e) { mal(`las banderas privadas no retuvieron: ${e.message}`); }

// Las insignias EQUIPADAS son cosmética: siguen aunque logros esté oculto.
try {
  const out = armarPerfilPublico({ perfil: perfilCrudo({ privacy_logros: false }), stats: STATS, coins: COINS, ownedItems: ITEMS });
  assert.deepStrictEqual(out.profile.badges, ["badge_first"], "las badges equipadas se ocultaron de más");
  assert.deepStrictEqual(out.profile.owned_items, [], "la colección sí se oculta");
  ok("logros=false tapa la colección pero no las insignias equipadas (son cosmética)");
} catch (e) { mal(`badges equipadas: ${e.message}`); }

// ── Defaults: null vale el default de la columna ─────────
try {
  const vis = visibilidadPerfil(perfilCrudo({ privacy_envios: null, privacy_coins: undefined, privacy_amigos: null }));
  assert.strictEqual(vis.envios, true, "envios null → default true");
  assert.strictEqual(vis.coins, true, "coins undefined → default true");
  assert.strictEqual(vis.amigos, false, "amigos null → default false");
  ok("null/undefined en las banderas cae al default de la columna");
} catch (e) { mal(`defaults de visibilidad: ${e.message}`); }

// Sólo `true` habilita: un 1 o un "true" no alcanzan.
try {
  const out = armarPerfilPublico({ perfil: perfilCrudo({ privacy_coins: 1 }), stats: STATS, coins: COINS, ownedItems: ITEMS });
  assert.strictEqual(out.coins, null, "un 1 no habilita los coins");
  ok("sólo el booleano true habilita un bloque: valores raros se tratan como oculto");
} catch (e) { mal(`un valor no booleano habilitó un bloque: ${e.message}`); }

// ── Lo que tiene que seguir funcionando ──────────────
try {
  const out = armarPerfilPublico({ perfil: perfilCrudo(), stats: STATS, coins: COINS, ownedItems: ITEMS });
  assert.strictEqual(out.user.id, 7, "el front lo usa de key");
  assert.strictEqual(out.user.name, "Renzo Ricci");
  assert.strictEqual(out.user.username, "renzo");
  assert.strictEqual(out.profile.bio, "cultivo indoor");
  assert.strictEqual(out.profile.avatar_key, "avatar_lemon");
  assert.strictEqual(out.profile.frame_key, "frame_gold");
  assert.strictEqual(out.profile.title_key, "title_pro");
  assert.strictEqual(out.profile.name_color, "#f5e03a");
  // Las banderas viajan para que el front sepa qué toggles pintar.
  assert.strictEqual(out.profile.privacy_posts, true);
  ok("siguen id, nombre, username, bio, avatar, marco, título, colores y las banderas");
} catch (e) { mal(`se rompió el perfil público: ${e.message}`); }

// ── Bordes ───────────────────────────
try {
  assert.strictEqual(armarPerfilPublico({ perfil: null }), null, "sin perfil devuelve null");
  assert.strictEqual(armarPerfilPublico(), null, "sin argumentos devuelve null");
  const original = perfilCrudo();
  armarPerfilPublico({ perfil: original, stats: STATS, coins: COINS, ownedItems: ITEMS });
  assert.strictEqual(original.email, "renzo@ejemplo.com", "no muta la fila original");
  assert.strictEqual(original.role, "client", "no muta la fila original");
  ok("bordes: sin perfil devuelve null y no muta la fila cruda de la base");
} catch (e) { mal(`bordes: ${e.message}`); }

// sinCamposPrivados es idempotente y no muta.
try {
  const src = { email: "x@y.z", role: "admin", client_number: 1, name: "N" };
  const out = sinCamposPrivados(src);
  assert.deepStrictEqual(out, { name: "N" });
  assert.strictEqual(src.email, "x@y.z", "mutó el input");
  ok("sinCamposPrivados borra email/role/client_number y no muta el original");
} catch (e) { mal(`sinCamposPrivados: ${e.message}`); }

if (fallas > 0) {
  console.error(`\n${fallas} fallas.`);
  process.exit(1);
}
console.log("\nTodo verde.");
