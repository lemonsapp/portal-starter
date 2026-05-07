// server/lib/configStore.test.js
//
// Tests del configStore. Corre así:
//   cd server && node lib/configStore.test.js
//
// Requiere DATABASE_URL + MASTER_KEY en .env. Usa la DB real pero sólo
// toca app_config con keys de test (las limpia al final).

"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const assert = require("assert/strict");
const cs = require("./configStore");
const db = require("../db");

let pass = 0, fail = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log("✅", name); pass++; })
    .catch(e => { console.error("❌", name, "—", e.message); fail++; });
}

(async () => {
  console.log("→ Running configStore tests against", process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || "?");

  // ── crypto round-trip (no DB) ─────────────────────────────────────────────
  await test("encrypt → decrypt round-trip", () => {
    const plain = "super-secret-api-key-12345";
    const blob = cs.encrypt(plain);
    assert.notEqual(blob, plain, "blob should not equal plaintext");
    assert.equal(cs.decrypt(blob), plain);
  });

  await test("encrypt produces different ciphertext each call (random IV)", () => {
    const a = cs.encrypt("same-input");
    const b = cs.encrypt("same-input");
    assert.notEqual(a, b);
    assert.equal(cs.decrypt(a), "same-input");
    assert.equal(cs.decrypt(b), "same-input");
  });

  await test("decrypt with corrupted blob returns null (not crash)", () => {
    const tamper = "invalid-base64-or-corrupted-blob-zzz";
    assert.equal(cs.decrypt(tamper), null);
  });

  await test("decrypt with tampered authTag returns null", () => {
    const blob = cs.encrypt("test");
    // Flip last byte of base64 to break authTag
    const buf = Buffer.from(blob, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    assert.equal(cs.decrypt(tampered), null);
  });

  await test("sha256Hex stable + handles null", () => {
    assert.equal(cs.sha256Hex(null), null);
    assert.equal(cs.sha256Hex("abc"), cs.sha256Hex("abc"));
    assert.notEqual(cs.sha256Hex("abc"), cs.sha256Hex("abd"));
  });

  await test("isKnownKey + isSecretKey", () => {
    assert.equal(cs.isKnownKey("cloudinary.api_secret"), true);
    assert.equal(cs.isKnownKey("nonsense.key"), false);
    assert.equal(cs.isSecretKey("cloudinary.api_secret"), true);
    assert.equal(cs.isSecretKey("branding.name"), false);
  });

  await test("castFromString respects type", () => {
    assert.equal(cs.castFromString("rules.coins_on_register", "100"), 100);
    assert.equal(cs.castFromString("rules.signup_mode", "invite"), "invite");
    assert.equal(cs.castFromString("features.chat", "true"), true);
    assert.equal(cs.castFromString("features.chat", "false"), false);
  });

  // ── DB round-trip — usa keys reales de catalog (no test-only) ─────────────
  // Key de prueba que no toca producción: usamos cloudinary.folder_base
  // (no secreto, easy de limpiar) y resend.api_key (secreto, encriptado).
  const TEST_NONSECRET = "cloudinary.folder_base";
  const TEST_SECRET    = "resend.api_key";

  // Snapshot pre-test
  const snap = {
    [TEST_NONSECRET]: await cs.getConfig(TEST_NONSECRET),
    [TEST_SECRET]:    await cs.getConfig(TEST_SECRET),
  };

  await test("setConfig + getConfig (no-secret)", async () => {
    await cs.setConfig(TEST_NONSECRET, "test-folder-xyz");
    assert.equal(await cs.getConfig(TEST_NONSECRET), "test-folder-xyz");
  });

  await test("setConfig + getConfig (secret) round-trips through encryption", async () => {
    await cs.setConfig(TEST_SECRET, "re_test_FAKE_KEY_AAA111BBB222");
    assert.equal(await cs.getConfig(TEST_SECRET), "re_test_FAKE_KEY_AAA111BBB222");
  });

  await test("getAllSection masks secrets", async () => {
    const section = await cs.getAllSection("resend");
    assert.equal(section.api_key, "••••••", "secret key should be masked");
  });

  await test("getAllSection returns plain non-secrets", async () => {
    await cs.setConfig("cloudinary.cloud_name", "starter-test");
    const section = await cs.getAllSection("cloudinary");
    assert.equal(section.cloud_name, "starter-test");
    assert.equal(section.api_secret, null);  // not set
  });

  await test("getStatus reflects state", async () => {
    const s = await cs.getStatus();
    assert.equal(typeof s.cloudinary, "boolean");
    assert.equal(typeof s.resend,     "boolean");
    assert.equal(s.resend, true, "resend should be true (api_key set above)");
  });

  await test("getPublicConfig has no secrets", async () => {
    const pub = await cs.getPublicConfig();
    assert.ok(pub.branding,  "must have branding");
    assert.ok(pub.features,  "must have features");
    assert.equal(pub.cloudinary, undefined, "must NOT expose cloudinary");
    assert.equal(pub.resend,     undefined, "must NOT expose resend");
    assert.equal(pub.telegram,   undefined, "must NOT expose telegram");
  });

  await test("deleteConfig removes value", async () => {
    await cs.setConfig(TEST_NONSECRET, "to-delete");
    await cs.deleteConfig(TEST_NONSECRET);
    // Después de delete debería volver al default (null para folder_base)
    assert.equal(await cs.getConfig(TEST_NONSECRET), null);
  });

  await test("setConfig writes to history table", async () => {
    await cs.setConfig(TEST_NONSECRET, "history-1");
    await cs.setConfig(TEST_NONSECRET, "history-2");
    const r = await db.query(
      "SELECT old_value_hash, new_value_hash FROM app_config_history WHERE key=$1 ORDER BY id DESC LIMIT 1",
      [TEST_NONSECRET]
    );
    assert.ok(r.rows[0], "should have history row");
    // Ambos hashes deben existir y ser diferentes
    assert.notEqual(r.rows[0].old_value_hash, r.rows[0].new_value_hash);
  });

  // ── cleanup: restaurar valores originales o dejarlos null ─────────────────
  if (snap[TEST_NONSECRET] === null) await cs.deleteConfig(TEST_NONSECRET);
  else await cs.setConfig(TEST_NONSECRET, snap[TEST_NONSECRET]);
  if (snap[TEST_SECRET] === null) await cs.deleteConfig(TEST_SECRET);
  else await cs.setConfig(TEST_SECRET, snap[TEST_SECRET]);
  // cloudinary.cloud_name dejado seteado para retro-compat con seguir testing
  await cs.deleteConfig("cloudinary.cloud_name").catch(() => {});

  // Cierre
  console.log(`\n${pass} pass · ${fail} fail`);
  await db.pool?.end?.().catch(() => {});
  process.exit(fail === 0 ? 0 : 1);
})();
