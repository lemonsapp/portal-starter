"use strict";
const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const { authRequired } = require("../auth");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");

// ── Configuración WebAuthn ───────────────────────────────────────────────────
const RP_ID = process.env.WEBAUTHN_RP_ID || "localhost";
const RP_NAME = "Mi Portal";
const EXPECTED_ORIGIN = (process.env.WEBAUTHN_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 min
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
if (!process.env.JWT_SECRET) {
  console.warn("[WEBAUTHN] WARNING: JWT_SECRET no seteado, usando fallback dev. NO usar en producción.");
}

// ── Helpers de challenges ────────────────────────────────────────────────────
// Guarda un challenge en DB con TTL. user_id es opcional (login flow no lo conoce).
async function saveChallenge({ userId, challenge, type }) {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await db.query(
    `INSERT INTO webauthn_challenges (user_id, challenge, type, expires_at) VALUES ($1, $2, $3, $4)`,
    [userId || null, challenge, type, expiresAt]
  );
  // Cleanup oportunista de challenges viejos (no bloquea, no espera)
  db.query(
    `DELETE FROM webauthn_challenges WHERE expires_at < NOW() - INTERVAL '1 day'`
  ).catch(() => {});
}

// Marca un challenge como consumido y devuelve la row si era válido (no expirado, no consumido).
// expectedUserId opcional: si pasás user_id, exige que el challenge sea de ese user.
async function consumeChallenge({ challenge, type, expectedUserId }) {
  // Atomic: UPDATE ... RETURNING garantiza single-consumer aunque haya concurrencia
  const r = await db.query(
    `UPDATE webauthn_challenges
       SET consumed_at = NOW()
     WHERE challenge=$1 AND type=$2 AND consumed_at IS NULL AND expires_at > NOW()
     RETURNING id, user_id`,
    [challenge, type]
  );
  const row = r.rows[0];
  if (!row) return null;
  // Si pedimos expectedUserId y no matchea, "deshacemos" lógicamente (igual ya consumimos
  // el challenge, lo cual está bien — un challenge mal usado debe quemarse).
  if (expectedUserId && row.user_id && Number(row.user_id) !== Number(expectedUserId)) return null;
  return row;
}

// ── Health ───────────────────────────────────────────────────────────────────
// Lo usa el frontend para saber si el backend ya tiene los endpoints WebAuthn
// (importante en ventana de deploy mixto entre Vercel y Render).
router.get("/health", (req, res) => {
  res.json({ ok: true, supported: true, rpId: RP_ID });
});

// POST /auth/webauthn/register/options
// Genera opciones para registrar un nuevo authenticator (Face ID / Touch ID / etc.) en el user logueado.
router.post("/register/options", authRequired, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    // Necesitamos email/name del user para la propiedad `user.name` que muestra el browser
    const u = await db.query(`SELECT id, email, name FROM users WHERE id=$1`, [userId]);
    const user = u.rows[0];
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // Excluir credentials que el user ya registró (evita duplicar el mismo dispositivo)
    const existingQ = await db.query(
      `SELECT credential_id, transports FROM webauthn_credentials
       WHERE user_id=$1 AND revoked_at IS NULL`,
      [userId]
    );
    const excludeCredentials = existingQ.rows.map(r => ({
      id: r.credential_id, // base64url string
      transports: r.transports || undefined,
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: Buffer.from(String(user.id)),
      userName: user.email,
      userDisplayName: user.name || user.email,
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    });

    await saveChallenge({ userId, challenge: options.challenge, type: "register" });

    res.json(options);
  } catch (e) {
    console.error("[WEBAUTHN register/options ERROR]", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /auth/webauthn/register/verify
// Verifica el response del browser y guarda la credential en DB.
router.post("/register/verify", authRequired, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const { response, label } = req.body || {};
    if (!response?.id) return res.status(400).json({ error: "Response inválida" });

    const challenge = response?.response?.clientDataJSON
      ? JSON.parse(Buffer.from(response.response.clientDataJSON, "base64url").toString()).challenge
      : null;
    if (!challenge) return res.status(400).json({ error: "Challenge no encontrado" });

    const consumed = await consumeChallenge({ challenge, type: "register", expectedUserId: userId });
    if (!consumed) return res.status(400).json({ error: "Challenge inválido o expirado" });

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        // expectedChallenge es el mismo valor que extrajimos de clientDataJSON (circular),
        // pero la seguridad real proviene de consumeChallenge (DB) + verificación de firma
        // que hace simplewebauthn internamente. La comparación string es redundante pero inofensiva.
        expectedChallenge: challenge,
        expectedOrigin: EXPECTED_ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });
    } catch (e) {
      console.error("[WEBAUTHN register/verify FAIL]", e.message);
      return res.status(400).json({ error: "Verificación fallida: " + e.message });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: "No verificado" });
    }

    // En @simplewebauthn/server v13 la estructura es registrationInfo.credential.{id, publicKey, counter}
    const cred = verification.registrationInfo.credential;
    const credentialId = cred.id; // base64url string
    const publicKey = Buffer.from(cred.publicKey); // Uint8Array → Buffer
    const counter = Number(cred.counter || 0);
    const transports = response.response?.transports || null;

    // Label default: detectar plataforma por user-agent (rough), user puede editarlo después
    const ua = req.headers["user-agent"] || "";
    const defaultLabel =
      /iPhone/i.test(ua) ? "iPhone" :
      /iPad/i.test(ua) ? "iPad" :
      /Android/i.test(ua) ? "Android" :
      /Mac/i.test(ua) ? "Mac" :
      /Windows/i.test(ua) ? "Windows" :
      "Dispositivo";

    const finalLabel = (typeof label === "string" && label.trim().length > 0)
      ? label.trim().slice(0, 60)
      : defaultLabel;

    const ins = await db.query(
      `INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, transports, device_label)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, credential_id, device_label`,
      [userId, credentialId, publicKey, counter, transports, finalLabel]
    );

    console.log("[WEBAUTHN register OK]", { user_id: userId, credential_id: credentialId, label: finalLabel });
    res.json({ ok: true, credential_id: credentialId, label: ins.rows[0].device_label });
  } catch (e) {
    // 23505 = unique_violation (duplicate credential_id). Mejor 409 + mensaje claro
    // que filtrar nombre del constraint vía e.message.
    if (e?.code === "23505") {
      return res.status(409).json({ error: "Este dispositivo ya está registrado" });
    }
    console.error("[WEBAUTHN register/verify ERROR]", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /auth/webauthn/login/options
// Genera challenge para login. Acepta email opcional para narrow-down de allowCredentials.
// Sin email, devuelve allowCredentials vacío → browser usa passkeys discoverable (passkey-only flow).
router.post("/login/options", async (req, res) => {
  try {
    const email = (req.body?.email || "").toLowerCase().trim();

    let allowCredentials = [];
    let userId = null;

    if (email) {
      const u = await db.query(`SELECT id FROM users WHERE LOWER(email)=$1`, [email]);
      const user = u.rows[0];
      if (user) {
        userId = user.id;
        const credsQ = await db.query(
          `SELECT credential_id, transports FROM webauthn_credentials
           WHERE user_id=$1 AND revoked_at IS NULL`,
          [user.id]
        );
        allowCredentials = credsQ.rows.map(r => ({
          id: r.credential_id,
          transports: r.transports || undefined,
        }));
      }
      // Si email no existe o no tiene credentials, igual generamos opts pero browser no encuentra match
      // (no leak de info — comportamiento idéntico al caso "user no existe").
    }

    // Algunos browsers viejos (iOS 15/16, Android antiguos) tratan allowCredentials:[]
    // como "no allowed credentials" y no muestran la UI de passkey. Omitirlo es semánticamente
    // equivalente para discoverable credentials y safer cross-browser.
    const authOpts = {
      rpID: RP_ID,
      userVerification: "required",
    };
    if (allowCredentials.length > 0) authOpts.allowCredentials = allowCredentials;

    const options = await generateAuthenticationOptions(authOpts);

    await saveChallenge({ userId, challenge: options.challenge, type: "login" });

    res.json(options);
  } catch (e) {
    console.error("[WEBAUTHN login/options ERROR]", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// POST /auth/webauthn/login/verify
// Verifica el response del browser y emite JWT igual que /auth/login tradicional.
router.post("/login/verify", async (req, res) => {
  try {
    const { response } = req.body || {};
    if (!response?.id) return res.status(400).json({ error: "Response inválida" });

    const challenge = response?.response?.clientDataJSON
      ? JSON.parse(Buffer.from(response.response.clientDataJSON, "base64url").toString()).challenge
      : null;
    if (!challenge) return res.status(400).json({ error: "Challenge no encontrado" });

    const consumed = await consumeChallenge({ challenge, type: "login" });
    if (!consumed) return res.status(400).json({ error: "Challenge inválido o expirado" });

    // Buscar credential por credential_id (response.id es base64url)
    const credentialId = response.id;
    const credQ = await db.query(
      `SELECT c.id, c.user_id, c.credential_id, c.public_key, c.counter, c.transports,
              u.id AS uid, u.email, u.name, u.role, u.client_number, u.email_verified, u.scopes
       FROM webauthn_credentials c
       JOIN users u ON u.id = c.user_id
       WHERE c.credential_id=$1 AND c.revoked_at IS NULL`,
      [credentialId]
    );
    const cred = credQ.rows[0];
    if (!cred) return res.status(401).json({ error: "Credencial no encontrada o revocada" });

    // Block si el user es client y todavía no verificó email (igual que /auth/login)
    if (cred.role === "client" && !cred.email_verified) {
      return res.status(403).json({
        error: "Tenés que verificar tu email para entrar. Revisá tu bandeja.",
        code: "EMAIL_NOT_VERIFIED",
        email: cred.email,
      });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        // Misma observación que en register/verify: expectedChallenge=challenge es
        // tautológico, la seguridad real viene de consumeChallenge + firma.
        expectedChallenge: challenge,
        expectedOrigin: EXPECTED_ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: cred.credential_id,
          publicKey: cred.public_key, // Buffer ya, simplewebauthn lo acepta
          counter: Number(cred.counter || 0),
          transports: cred.transports || undefined,
        },
        requireUserVerification: true,
      });
    } catch (e) {
      console.error("[WEBAUTHN login/verify FAIL]", e.message);
      return res.status(401).json({ error: "Verificación fallida" });
    }

    if (!verification.verified || !verification.authenticationInfo) {
      return res.status(401).json({ error: "No verificado" });
    }

    const newCounter = Number(verification.authenticationInfo.newCounter || 0);

    // UPDATE atómico con guard de regression. WHERE counter <= storedCounter solo permite
    // avanzar (no retroceder). rowCount=0 significa otra request ya consumió este counter
    // Counter guard: solo proteger contra regression cuando newCounter > 0 (hardware keys
    // como YubiKey siempre incrementan). Platform authenticators (Face ID/Touch ID/Hello/
    // huella) devuelven counter=0 siempre — el guard "counter < 0" sería false → 401.
    // Para counter=0 confiamos en consumeChallenge (atomic) que ya impide replay.
    const upd = await db.query(
      `UPDATE webauthn_credentials
         SET counter=$1, last_used_at=NOW()
       WHERE id=$2 AND (counter < $1 OR $1 = 0)`,
      [newCounter, cred.id]
    );
    if (upd.rowCount === 0) {
      console.error("[WEBAUTHN counter REGRESSION or RACE]", {
        user_id: cred.user_id,
        credential_id: credentialId,
        stored: cred.counter,
        attempted: newCounter,
      });
      return res.status(401).json({ error: "Contador inválido" });
    }

    // TODO(missions parity): /auth/login en index.js llama checkMissions(uid, 'login') después
    // del jwt.sign. Para mantener paridad, habría que exportar checkMissions desde index.js
    // o moverla a un módulo. Out of scope para este commit.

    // Emitir JWT igual que /auth/login
    const token = jwt.sign({ id: cred.uid, role: cred.role }, JWT_SECRET, { expiresIn: "7d" });

    console.log("[WEBAUTHN login OK]", { user_id: cred.uid, credential_id: credentialId });
    res.json({
      token,
      user: {
        id: cred.uid,
        email: cred.email,
        name: cred.name,
        role: cred.role,
        client_number: cred.client_number,
        scopes: cred.scopes || null,
      },
    });
  } catch (e) {
    console.error("[WEBAUTHN login/verify ERROR]", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// GET /auth/webauthn/credentials — lista los dispositivos del user logueado (no revocados)
router.get("/credentials", authRequired, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const r = await db.query(
      `SELECT id, credential_id, device_label, transports, created_at, last_used_at
       FROM webauthn_credentials
       WHERE user_id=$1 AND revoked_at IS NULL
       ORDER BY last_used_at DESC NULLS LAST, created_at DESC`,
      [userId]
    );
    res.json({ ok: true, credentials: r.rows });
  } catch (e) {
    console.error("[WEBAUTHN list ERROR]", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// PATCH /auth/webauthn/credentials/:id — cambia el label del dispositivo
router.patch("/credentials/:id", authRequired, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });

    const label = (req.body?.label || "").trim().slice(0, 60);
    if (label.length === 0) return res.status(400).json({ error: "Label vacío" });

    const r = await db.query(
      `UPDATE webauthn_credentials SET device_label=$1
       WHERE id=$2 AND user_id=$3 AND revoked_at IS NULL
       RETURNING id, device_label`,
      [label, id, userId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, label: r.rows[0].device_label });
  } catch (e) {
    console.error("[WEBAUTHN patch ERROR]", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

// DELETE /auth/webauthn/credentials/:id — soft delete (set revoked_at)
router.delete("/credentials/:id", authRequired, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "ID inválido" });

    const r = await db.query(
      `UPDATE webauthn_credentials SET revoked_at=NOW()
       WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL
       RETURNING id`,
      [id, userId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "No encontrado" });
    console.log("[WEBAUTHN revoke]", { user_id: userId, credential_pk: id });
    res.json({ ok: true });
  } catch (e) {
    console.error("[WEBAUTHN delete ERROR]", e.message);
    res.status(500).json({ error: "Error interno" });
  }
});

module.exports = router;
