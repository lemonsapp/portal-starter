"use strict";
const express = require("express");
const router = express.Router();
const db = require("../db");
const { authRequired, requireRole } = require("../auth");
const { askClaude } = require("../lib/claude");
const { getIgToken, healthcheckIgToken, getTokenStatus } = require("../lib/ig-token");
const { IG_USER_ID } = require("../lib/meta-config");

const WEBHOOK_VERIFY_TOKEN = process.env.IG_WEBHOOK_TOKEN || "lemons_ig_webhook_2026";

const LEMONS_SYSTEM_PROMPT = `Sos el asistente de Lemons Logística Internacional, una empresa argentina que trae productos de China, USA y Europa para emprendedores y particulares.

Servicios:
- Courier puerta a puerta desde China (15-25 días), USA (7-12 días), Europa (10-18 días).
- Asesoramiento aduanero, importación con o sin CUIT.
- Compras asistidas en Amazon, AliExpress, Alibaba, eBay, Shein, Temu.
- Consolidación de envíos en bodegas propias en Miami y Yiwu.

Tono: argentino, cercano, profesional, claro. Usá vos. Sin emojis excesivos (1 por mensaje máximo). Respuestas cortas, máximo 5 líneas.

Reglas:
- Si preguntan precio puntual, NO inventes números: pediles producto + link + ciudad destino y derivá a cotización formal.
- Si la consulta es compleja o de venta avanzada, sugerí pasar a WhatsApp (mencionar handoff sin dar número, el operador lo continúa).
- Nunca prometas tiempos exactos: usá rangos.
- Nunca digas que sos un bot/IA. Sos "el asistente de Lemons".
- Si te preguntan algo fuera de logística, decí amablemente que no podés ayudar.`;

const HISTORY_MAX_TURNS = 20;
const INBOUND_WINDOW_HOURS = 24;

async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ig_automations (
      id BIGSERIAL PRIMARY KEY,
      trigger_type TEXT NOT NULL DEFAULT 'dm',
      keyword TEXT NOT NULL,
      match_type TEXT NOT NULL DEFAULT 'contains',
      response_text TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ig_events_log (
      id BIGSERIAL PRIMARY KEY,
      event_type TEXT,
      sender_id TEXT,
      message_text TEXT,
      matched_keyword TEXT,
      response_sent TEXT,
      raw JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ig_processed_events (
      event_id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    ALTER TABLE ig_events_log
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'automation'
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ig_conversations (
      sender_id TEXT PRIMARY KEY,
      history JSONB NOT NULL DEFAULT '[]'::jsonb,
      last_inbound_at TIMESTAMPTZ,
      last_outbound_at TIMESTAMPTZ,
      human_handoff BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Limpiar eventos viejos de más de 24hs para no crecer indefinidamente
  const procPurge = await db.query(`DELETE FROM ig_processed_events WHERE created_at < NOW() - INTERVAL '24 hours'`);
  if (procPurge.rowCount > 0) console.log("[IG-CLEANUP ig_processed_events]", procPurge.rowCount, "filas borradas");
  // Retención 90 días en log de eventos
  const logPurge = await db.query(`DELETE FROM ig_events_log WHERE created_at < NOW() - INTERVAL '90 days'`);
  if (logPurge.rowCount > 0) console.log("[IG-CLEANUP ig_events_log]", logPurge.rowCount, "filas borradas");
}

async function getConversation(senderId) {
  const q = await db.query(`SELECT * FROM ig_conversations WHERE sender_id = $1`, [senderId]);
  return q.rows[0] || null;
}

async function recordInbound(senderId, text) {
  const existing = await getConversation(senderId);
  const turn = { role: "user", content: text };
  if (existing) {
    const history = Array.isArray(existing.history) ? existing.history : [];
    const next = [...history, turn].slice(-HISTORY_MAX_TURNS);
    await db.query(
      `UPDATE ig_conversations SET history = $1, last_inbound_at = NOW(), updated_at = NOW() WHERE sender_id = $2`,
      [JSON.stringify(next), senderId]
    );
    return { ...existing, history: next };
  }
  const inserted = await db.query(
    `INSERT INTO ig_conversations (sender_id, history, last_inbound_at)
     VALUES ($1, $2, NOW()) RETURNING *`,
    [senderId, JSON.stringify([turn])]
  );
  return inserted.rows[0];
}

async function recordOutbound(senderId, text) {
  const existing = await getConversation(senderId);
  const turn = { role: "assistant", content: text };
  const history = Array.isArray(existing?.history) ? existing.history : [];
  const next = [...history, turn].slice(-HISTORY_MAX_TURNS);
  if (existing) {
    await db.query(
      `UPDATE ig_conversations SET history = $1, last_outbound_at = NOW(), updated_at = NOW() WHERE sender_id = $2`,
      [JSON.stringify(next), senderId]
    );
  } else {
    await db.query(
      `INSERT INTO ig_conversations (sender_id, history, last_outbound_at)
       VALUES ($1, $2, NOW())`,
      [senderId, JSON.stringify(next)]
    );
  }
}

function inside24hWindow(conv) {
  if (!conv?.last_inbound_at) return false;
  const last = new Date(conv.last_inbound_at).getTime();
  return Date.now() - last < INBOUND_WINDOW_HOURS * 60 * 60 * 1000;
}

async function generateAIReply(conv) {
  const history = Array.isArray(conv?.history) ? conv.history : [];
  const messages = history
    .filter(t => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .map(t => ({ role: t.role, content: t.content }));
  if (messages.length === 0) return null;
  if (messages[messages.length - 1].role !== "user") return null;
  const { text } = await askClaude({
    system: LEMONS_SYSTEM_PROMPT,
    messages,
    max_tokens: 512,
  });
  return text || null;
}

async function sendInstagramDM(recipientId, text) {
  const access_token = await getIgToken();
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${IG_USER_ID}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        access_token,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function replyInstagramComment(commentId, text) {
  const access_token = await getIgToken();
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${commentId}/replies`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        access_token,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function sendDMToCommenter(senderId, text) {
  // Enviar DM privado al que comentó
  try {
    const access_token = await getIgToken();
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${IG_USER_ID}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text },
          access_token,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.log("[IG DM TO COMMENTER FAILED]", JSON.stringify(data).slice(0, 200));
      return null;
    }
    return data;
  } catch(e) {
    console.log("[IG DM TO COMMENTER ERROR]", e.message);
    return null;
  }
}

async function isAlreadyProcessed(eventId) {
  if (!eventId) return false;
  try {
    const q = await db.query(
      `INSERT INTO ig_processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id`,
      [String(eventId)]
    );
    // Si no insertó nada, ya fue procesado antes
    return q.rowCount === 0;
  } catch(e) {
    console.log("[IG DEDUP ERROR]", e.message);
    return false;
  }
}

async function findMatchingAutomation(text, triggerType) {
  const automations = await db.query(
    `SELECT * FROM ig_automations WHERE active = TRUE AND trigger_type = $1 ORDER BY id ASC`,
    [triggerType]
  );
  const msg = String(text || "").toLowerCase().trim();
  for (const auto of automations.rows) {
    const keyword = String(auto.keyword || "").toLowerCase().trim();
    if (!keyword) continue;
    if (auto.match_type === "exact" && msg === keyword) return auto;
    if (auto.match_type === "contains" && msg.includes(keyword)) return auto;
    if (auto.match_type === "starts_with" && msg.startsWith(keyword)) return auto;
  }
  return null;
}

// Webhook verification
router.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    console.log("[IG WEBHOOK] Verificado OK");
    return res.status(200).send(challenge);
  }
  res.status(403).send("Forbidden");
});

// Webhook events
router.post("/webhook", async (req, res) => {
  try {
    await ensureTables();
    const body = req.body;
    console.log("[IG WEBHOOK]", JSON.stringify(body).slice(0, 300));
    if (body.object !== "instagram") return res.sendStatus(200);

    for (const entry of (body.entry || [])) {
      // DMs
      for (const messaging of (entry.messaging || [])) {
        const senderId  = messaging?.sender?.id;
        const text      = messaging?.message?.text;
        const messageId = messaging?.message?.mid || messaging?.message?.id;
        if (!senderId || !text || senderId === IG_USER_ID) continue;

        // Deduplicación — ignorar si ya fue procesado
        if (await isAlreadyProcessed(messageId || `dm_${senderId}_${text.slice(0,20)}`)) {
          console.log("[IG DM SKIP] ya procesado:", messageId);
          continue;
        }

        console.log("[IG DM]", { senderId, text: text.slice(0,50) });
        const conv = await recordInbound(senderId, text);
        const auto = await findMatchingAutomation(text, "dm");
        if (auto) {
          try {
            await sendInstagramDM(senderId, auto.response_text);
            await recordOutbound(senderId, auto.response_text);
            await db.query(
              `INSERT INTO ig_events_log (event_type, sender_id, message_text, matched_keyword, response_sent, raw, source)
               VALUES ('dm', $1, $2, $3, $4, $5, 'automation')`,
              [senderId, text, auto.keyword, auto.response_text, JSON.stringify(messaging)]
            );
            console.log("[IG DM AUTO]", auto.keyword);
          } catch (e) { console.error("[IG DM ERROR]", e.message); }
        } else if (conv?.human_handoff) {
          await db.query(
            `INSERT INTO ig_events_log (event_type, sender_id, message_text, raw, source) VALUES ('dm', $1, $2, $3, 'human')`,
            [senderId, text, JSON.stringify(messaging)]
          );
          console.log("[IG DM HANDOFF] silenciado para humano:", senderId);
        } else if (!inside24hWindow(conv)) {
          await db.query(
            `INSERT INTO ig_events_log (event_type, sender_id, message_text, raw, source) VALUES ('dm', $1, $2, $3, 'ai')`,
            [senderId, text, JSON.stringify({ ...messaging, skipped: "out_of_24h_window" })]
          );
          console.log("[IG DM SKIP] fuera de ventana 24h:", senderId);
        } else {
          try {
            const aiText = await generateAIReply(conv);
            if (aiText) {
              await sendInstagramDM(senderId, aiText);
              await recordOutbound(senderId, aiText);
              await db.query(
                `INSERT INTO ig_events_log (event_type, sender_id, message_text, response_sent, raw, source)
                 VALUES ('dm', $1, $2, $3, $4, 'ai')`,
                [senderId, text, aiText, JSON.stringify(messaging)]
              );
              console.log("[IG DM AI]", { senderId, len: aiText.length });
            } else {
              await db.query(
                `INSERT INTO ig_events_log (event_type, sender_id, message_text, raw, source) VALUES ('dm', $1, $2, $3, 'ai')`,
                [senderId, text, JSON.stringify({ ...messaging, ai: "empty_response" })]
              );
            }
          } catch (e) {
            console.error("[IG DM AI ERROR]", e.message);
            await db.query(
              `INSERT INTO ig_events_log (event_type, sender_id, message_text, raw, source) VALUES ('dm', $1, $2, $3, 'ai')`,
              [senderId, text, JSON.stringify({ ...messaging, ai_error: e.message })]
            );
          }
        }
      }

      // Comentarios
      for (const change of (entry.changes || [])) {
        if (change.field !== "comments") continue;
        const val       = change.value || {};
        const commentId = val.id;
        const senderId  = val.from?.id;
        const text      = val.text;
        if (!commentId || !text || senderId === IG_USER_ID) continue;

        // Deduplicación — ignorar si ya fue procesado
        if (await isAlreadyProcessed(`comment_${commentId}`)) {
          console.log("[IG COMMENT SKIP] ya procesado:", commentId);
          continue;
        }

        console.log("[IG COMMENT]", { commentId, text: text.slice(0,50) });
        const auto = await findMatchingAutomation(text, "comment");
        if (auto) {
          try {
            // 1. Responder públicamente bajo el comentario (mensaje corto)
            await replyInstagramComment(commentId, "¡Gracias por tu comentario! Te mandamos toda la info por privado 📩");

            // 2. Enviar DM privado con la respuesta completa del automation
            const dmResult = await sendDMToCommenter(senderId, auto.response_text);

            await db.query(
              `INSERT INTO ig_events_log (event_type, sender_id, message_text, matched_keyword, response_sent, raw)
               VALUES ('comment', $1, $2, $3, $4, $5)`,
              [senderId, text, auto.keyword, auto.response_text, JSON.stringify({ val, dm_sent: !!dmResult })]
            );
            console.log("[IG COMMENT AUTO]", { keyword: auto.keyword, dm_sent: !!dmResult });
          } catch (e) { console.error("[IG COMMENT ERROR]", e.message); }
        } else {
          await db.query(
            `INSERT INTO ig_events_log (event_type, sender_id, message_text, raw) VALUES ('comment', $1, $2, $3)`,
            [senderId, text, JSON.stringify(val)]
          );
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("[IG WEBHOOK ERROR]", err.message);
    res.sendStatus(200);
  }
});

// CRUD automatizaciones
router.get("/automations", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const q = await db.query(`SELECT * FROM ig_automations ORDER BY trigger_type, id ASC`);
    res.json({ ok: true, rows: q.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/automations", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const { trigger_type, keyword, match_type, response_text } = req.body;
    if (!keyword?.trim() || !response_text?.trim()) return res.status(400).json({ error: "keyword y response_text son requeridos" });
    const q = await db.query(
      `INSERT INTO ig_automations (trigger_type, keyword, match_type, response_text) VALUES ($1, $2, $3, $4) RETURNING *`,
      [trigger_type || "dm", keyword.trim(), match_type || "contains", response_text.trim()]
    );
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch("/automations/:id", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { keyword, match_type, response_text, active } = req.body;
    const q = await db.query(
      `UPDATE ig_automations SET
        keyword = COALESCE($1, keyword),
        match_type = COALESCE($2, match_type),
        response_text = COALESCE($3, response_text),
        active = COALESCE($4, active),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [keyword?.trim() || null, match_type || null, response_text?.trim() || null, active ?? null, id]
    );
    if (!q.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/automations/:id", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await db.query(`DELETE FROM ig_automations WHERE id = $1`, [parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Log de eventos
router.get("/events", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const q = await db.query(`SELECT * FROM ig_events_log ORDER BY created_at DESC LIMIT 100`);
    res.json({ ok: true, rows: q.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Status de conexión
router.get("/status", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    const access_token = await getIgToken();
    const igRes = await fetch(
      `https://graph.facebook.com/v21.0/${IG_USER_ID}?fields=id,username,name&access_token=${encodeURIComponent(access_token)}`
    );
    const igData = await igRes.json();
    const tokenStatus = await getTokenStatus();
    res.json({ ok: igRes.ok, ig_user: igData, ig_user_id: IG_USER_ID, token_status: tokenStatus });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Healthcheck del token IG (admin only). Pega a debug_token de Meta y devuelve validez/scopes/expiry.
router.post("/token/healthcheck", authRequired, requireRole(["admin"], "instagram"), async (req, res) => {
  try {
    const out = await healthcheckIgToken();
    res.json({ ok: true, ...out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Setear manualmente el token IG (admin only). Para cuando se regenera desde Meta y se quiere persistir sin reiniciar.
router.post("/token/set", authRequired, requireRole(["admin"], "instagram"), async (req, res) => {
  try {
    const { value, expires_in } = req.body || {};
    if (!value || typeof value !== "string") return res.status(400).json({ error: "value (token string) requerido" });
    const { setIgToken } = require("../lib/ig-token");
    await setIgToken(value, typeof expires_in === "number" ? expires_in : null);
    res.json({ ok: true, status: await getTokenStatus() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Conversaciones
router.get("/conversations", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const q = await db.query(
      `SELECT sender_id, human_handoff, last_inbound_at, last_outbound_at,
              jsonb_array_length(history) AS turns, updated_at
         FROM ig_conversations
         ORDER BY updated_at DESC
         LIMIT 200`
    );
    res.json({ ok: true, rows: q.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/conversations/:senderId", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const q = await db.query(`SELECT * FROM ig_conversations WHERE sender_id = $1`, [req.params.senderId]);
    if (!q.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/handoff/:senderId", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const senderId = String(req.params.senderId);
    const q = await db.query(
      `INSERT INTO ig_conversations (sender_id, human_handoff)
       VALUES ($1, TRUE)
       ON CONFLICT (sender_id) DO UPDATE SET human_handoff = TRUE, updated_at = NOW()
       RETURNING *`,
      [senderId]
    );
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/handoff/:senderId", authRequired, requireRole(["operator","admin"], "instagram"), async (req, res) => {
  try {
    await ensureTables();
    const senderId = String(req.params.senderId);
    const q = await db.query(
      `UPDATE ig_conversations SET human_handoff = FALSE, updated_at = NOW() WHERE sender_id = $1 RETURNING *`,
      [senderId]
    );
    if (!q.rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true, row: q.rows[0] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
