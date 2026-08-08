// server/lib/ranking-publico.test.js — el armado del ranking público: lo único
// que separa la base de datos de un visitante sin login. Corrida (sin DB):
//   cd server && node lib/ranking-publico.test.js
//
// EL BUG QUE ESTO PREVIENE (auditoría 2026-08-08, hallazgo C1): GET
// /profile/ranking no pide login y devolvía, confirmado en vivo contra
// api.hgrowshop.com con un curl sin credenciales, filas con `client_number`,
// `role`, `balance`, `total_earned` y `monedas_balance` de los primeros clientes
// de HOLISTIC — con las banderas privacy_* ni miradas. Era la misma cosecha del
// padrón que se filtraba por /profile/u/:username, por la puerta de al lado.
"use strict";

const assert = require("node:assert");
const { armarRankingPublico, armarFilaRanking, normalizarLimite, LIMITE_MAXIMO } = require("./ranking-publico");

let fallas = 0;
function ok(msg) { console.log(`✓ ${msg}`); }
function mal(msg) { fallas++; console.error(`✗ ${msg}`); }

// Una fila como la que devuelve el JOIN de users + coins + user_profiles.
function fila(extra = {}) {
  return {
    id: 3,
    name: "Renzo Ricci",
    client_number: 3,
    role: "client",
    email: "renzo@ejemplo.com",
    balance: "1200",
    total_earned: "3000",
    monedas_balance: "450",
    name_color: "#f5e03a",
    name_glow: 8,
    name_glow_color: "#fff",
    name_grad_from: null,
    name_grad_to: null,
    nickname: "el cultivador",
    nick_color: "#888",
    nick_glow: 0,
    icon_slug: "rocket",
    avatar_url: "https://cdn/renzo.png",
    avatar_key: "avatar_lemon",
    frame_key: "frame_gold",
    badges: ["badge_first"],
    privacy_coins: true,
    privacy_envios: true,
    posts_count: "12",
    friends_count: "8",
    ...extra,
  };
}

function apareceEnAlgunLado(obj, campo) {
  return JSON.stringify(obj).includes(`"${campo}"`);
}

// ── Lo innegociable: los datos de cuenta nunca salen ─────────────
// Da igual cómo estén las banderas, y da igual que el SQL los traiga: un ranking
// no es lugar para el número de cliente, el email ni el rol.
const COMBINACIONES = [
  {},
  { privacy_coins: true,  privacy_envios: true },
  { privacy_coins: true,  privacy_envios: false },
  { privacy_coins: null,  privacy_envios: null },
  { privacy_coins: undefined, privacy_envios: undefined },
];
try {
  for (const combo of COMBINACIONES) {
    const out = armarRankingPublico([fila(combo)]);
    assert.strictEqual(out.length, 1, `la fila debería aparecer con ${JSON.stringify(combo)}`);
    for (const campo of ["email", "role", "client_number"]) {
      assert.ok(!apareceEnAlgunLado(out, campo), `${campo} apareció con ${JSON.stringify(combo)}`);
    }
  }
  ok("email, role y client_number NUNCA salen del ranking, con cualquier bandera");
} catch (e) { mal(`fuga de datos de cuenta: ${e.message}`); }

// ── is_staff: el booleano sí, el rol no ──────────────────
try {
  for (const role of ["admin", "operator"]) {
    const out = armarFilaRanking(fila({ role }));
    assert.strictEqual(out.is_staff, true, `${role} debería ser staff`);
    assert.ok(!apareceEnAlgunLado(out, "role"), `el rol ${role} se coló en la respuesta`);
  }
  ok("admin y operator salen con is_staff=true, y sin el rol crudo");
} catch (e) { mal(`is_staff no marca al staff: ${e.message}`); }

try {
  for (const role of ["client", "", null, undefined, "ADMIN", "operador"]) {
    const out = armarFilaRanking(fila({ role }));
    assert.strictEqual(out.is_staff, false, `${JSON.stringify(role)} no es staff`);
  }
  ok("cualquier otro rol (y el rol ausente) sale con is_staff=false, nunca undefined");
} catch (e) { mal(`is_staff marca de más: ${e.message}`); }

// El campo nuevo no reintroduce el rol: is_staff es un booleano, no el rol
// disfrazado — ni el nombre ni el VALOR del rol viajan por él.
try {
  for (const role of ["admin", "operator", "client"]) {
    const out = armarFilaRanking(fila({ role }));
    assert.strictEqual(typeof out.is_staff, "boolean", "is_staff tiene que ser booleano");
    assert.ok(!JSON.stringify(out).includes(role), `el valor del rol (${role}) viaja en la respuesta`);
  }
  ok("is_staff es un booleano: ni el nombre ni el VALOR del rol viajan por el campo nuevo");
} catch (e) { mal(`is_staff reintrodujo el rol: ${e.message}`); }

// Aunque el SQL cambie y empiece a traer basura nueva, la lista blanca la corta.
try {
  const out = armarFilaRanking(fila({ password_hash: "$2b$xx", last_seen_at: "2026-08-07", customer_code: "HST-0003-XY" }));
  for (const campo of ["password_hash", "last_seen_at", "customer_code"]) {
    assert.ok(!apareceEnAlgunLado(out, campo), `${campo} se coló`);
  }
  ok("es lista blanca: una columna nueva del SQL no se filtra sola");
} catch (e) { mal(`la lista blanca dejó pasar algo: ${e.message}`); }

// ── Banderas en true: se ve todo lo que un ranking muestra ───────────
try {
  const out = armarFilaRanking(fila());
  assert.strictEqual(out.balance, 1200, "balance");
  assert.strictEqual(out.total_earned, 3000, "total_earned");
  assert.strictEqual(out.monedas_balance, 450, "monedas");
  assert.strictEqual(out.posts_count, 12, "posts");
  assert.strictEqual(out.friends_count, 8, "amigos");
  ok("con las banderas en true salen los saldos y los adornos sociales, ya como números");
} catch (e) { mal(`las banderas públicas deberían dejar pasar: ${e.message}`); }

// ── privacy_envios=false: aparece, sin los adornos sociales ─────────
// Posts y amigos son un adorno al costado, no ordenan la tabla: se retienen y la
// persona sigue en su puesto con sus saldos.
try {
  const out = armarFilaRanking(fila({ privacy_envios: false }));
  assert.ok(out, "la fila sigue estando");
  assert.strictEqual(out.posts_count, undefined, "posts retenidos");
  assert.strictEqual(out.friends_count, undefined, "amigos retenidos");
  assert.strictEqual(out.total_earned, 3000, "los coins no se tocan");
  assert.strictEqual(out.monedas_balance, 450, "las monedas no se tocan");
  assert.strictEqual(out.name, "Renzo Ricci", "el nombre no se toca");
  ok("privacy_envios=false retiene posts/amigos pero la persona sigue en el ranking");
} catch (e) { mal(`privacy_envios no retuvo: ${e.message}`); }

// ── privacy_coins=false: no aparece ────────────────────
// Los coins ORDENAN la tabla: mostrar la fila sin el número igual lo delata,
// porque la posición lo encierra entre el de arriba y el de abajo. Se OMITE.
try {
  const out = armarRankingPublico([fila({ id: 1 }), fila({ id: 2, privacy_coins: false }), fila({ id: 3 })]);
  assert.strictEqual(out.length, 2, "el que ocultó sus coins no está");
  assert.deepStrictEqual(out.map(r => r.id), [1, 3], "quedan los otros dos, en orden");
  ok("privacy_coins=false saca a la persona del ranking entero (omitir, no retener)");
} catch (e) { mal(`privacy_coins no omitió: ${e.message}`); }

try {
  const out = armarRankingPublico([fila({ privacy_coins: false, privacy_envios: false })]);
  assert.deepStrictEqual(out, [], "no queda ni la cáscara");
  ok("con los coins ocultos no sale ni el nombre: la fila entera desaparece");
} catch (e) { mal(`quedó un resto de la fila omitida: ${e.message}`); }

// ── Defaults: null es "no eligió", vale el default de la columna ─────
try {
  const out = armarRankingPublico([fila({ privacy_coins: null, privacy_envios: null })]);
  assert.strictEqual(out.length, 1, "null = default TRUE, aparece");
  assert.strictEqual(out[0].posts_count, 12, "null = default TRUE, con adornos");
  ok("sin elección previa (null) la persona aparece con todo: vale el default de la columna");
} catch (e) { mal(`defaults equivocados: ${e.message}`); }

// Sólo `true` habilita: un 1, un "true" o un objeto no alcanzan.
try {
  for (const valor of [1, "true", "false", 0, {}]) {
    assert.strictEqual(armarRankingPublico([fila({ privacy_coins: valor })]).length, 0,
      `${JSON.stringify(valor)} no debería habilitar los coins`);
    assert.strictEqual(armarFilaRanking(fila({ privacy_envios: valor })).posts_count, undefined,
      `${JSON.stringify(valor)} no debería habilitar los adornos`);
  }
  ok("sólo el booleano true habilita: valores raros se tratan como oculto");
} catch (e) { mal(`un valor no booleano habilitó datos: ${e.message}`); }

// ── Lo que tiene que seguir funcionando ──────────────────
try {
  const out = armarFilaRanking(fila({ privacy_envios: false }));
  assert.strictEqual(out.name, "Renzo Ricci");
  assert.strictEqual(out.nickname, "el cultivador");
  assert.strictEqual(out.avatar_url, "https://cdn/renzo.png");
  assert.strictEqual(out.avatar_key, "avatar_lemon");
  assert.strictEqual(out.frame_key, "frame_gold");
  assert.strictEqual(out.icon_slug, "rocket");
  assert.strictEqual(out.name_color, "#f5e03a");
  assert.strictEqual(out.name_glow, 8);
  assert.deepStrictEqual(out.badges, ["badge_first"]);
  assert.strictEqual(out.id, 3, "el front lo usa de key");
  ok("siguen el nombre, el apodo, el avatar, el marco, el ícono, los colores y las insignias");
} catch (e) { mal(`se rompió la cosmética del ranking: ${e.message}`); }

// ── Bordes ────────────────────────────────
try {
  assert.deepStrictEqual(armarRankingPublico([]), [], "lista vacía");
  assert.deepStrictEqual(armarRankingPublico(null), [], "null");
  assert.deepStrictEqual(armarRankingPublico(undefined), [], "sin argumentos");
  assert.strictEqual(armarFilaRanking(null), null, "fila null");
  ok("bordes: sin filas devuelve lista vacía, sin fila devuelve null");
} catch (e) { mal(`bordes: ${e.message}`); }

try {
  const original = fila();
  armarFilaRanking(original);
  assert.strictEqual(original.client_number, 3, "no muta la fila original");
  assert.strictEqual(original.balance, "1200", "no muta la fila original");
  ok("no muta la fila que viene de la base");
} catch (e) { mal(`mutó el input: ${e.message}`); }

// Un balance nulo (cuenta recién creada) no puede escupir NaN a la pantalla.
try {
  const out = armarFilaRanking(fila({ balance: null, total_earned: undefined, monedas_balance: null, posts_count: null }));
  assert.strictEqual(out.balance, 0);
  assert.strictEqual(out.total_earned, 0);
  assert.strictEqual(out.monedas_balance, 0);
  assert.strictEqual(out.posts_count, 0);
  ok("los nulos de la base salen como 0, no como NaN");
} catch (e) { mal(`números: ${e.message}`); }

// ── El limit nunca se usa crudo ─────────────────────
try {
  assert.strictEqual(normalizarLimite("3"), 3);
  assert.strictEqual(normalizarLimite("999"), LIMITE_MAXIMO, "se acota a 50");
  assert.strictEqual(normalizarLimite("-5"), 20, "negativo cae al default");
  assert.strictEqual(normalizarLimite("hola"), 20, "basura cae al default");
  assert.strictEqual(normalizarLimite(undefined), 20, "sin limit, el default");
  ok("el limit del querystring se acota a 1..50 y nunca llega crudo al SQL");
} catch (e) { mal(`normalizarLimite: ${e.message}`); }

if (fallas > 0) {
  console.error(`\n${fallas} fallas.`);
  process.exit(1);
}
console.log("\nTodo verde.");
