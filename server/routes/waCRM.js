"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");
const { authRequired, requireRole } = require("../auth");

const AI_API_KEY = process.env.AI_API_KEY || null;

function requireOperatorOrAdmin(req, res, next) {
  return authRequired(req, res, () => requireRole(["operator", "admin"])(req, res, next));
}

function requireAIKey(req, res, next) {
  const key = req.headers["x-ai-api-key"] || req.query._key;
  if (!AI_API_KEY || key !== AI_API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }
  next();
}

async function isAdminPhone(phone) {
  if (!phone) return false;
  const d = String(phone).replace(/\D/g, "");
  const list = (process.env.ADMIN_PHONES || "").split(",").map(s => s.trim().replace(/\D/g, "")).filter(Boolean);
  if (list.includes(d)) return true;
  try {
    const r = await db.query(
      "SELECT 1 FROM users WHERE role='admin' AND regexp_replace(COALESCE(phone,''),'\\D','','g')=$1 LIMIT 1",
      [d]
    );
    return r.rows.length > 0;
  } catch (e) {
    console.error("[isAdminPhone] error:", e.message);
    return false;
  }
}

function digits(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeIntentText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectEntryIntent(rawText) {
  const text = normalizeIntentText(rawText);

  const operatorPatterns = [
    /\boperador\b/, /\basesor\b/, /\bpersona\b/, /\bhumano\b/, /\bhumana\b/,
    /\besperar\b/, /\bespero\b/, /\bespera\b/,
    /quiero.*hablar/, /hablar.*alguien/, /hablar.*persona/, /hablar.*operador/,
    /pasame.*operador/, /atencion.*operador/, /prefiero.*operador/,
    /prefiero.*esperar/, /que.*conteste/, /con.*operador/, /un.*operador/,
    /\bop\b/,
  ];

  const botPatterns = [
    /\bguia\b/, /\bguiame\b/, /\bguia\s?me\b/, /\bme\s?guia\b/, /\bguias\b/,
    /\bayuda\b/, /\bayudame\b/, /\bayuda\s?me\b/,
    /\bbot\b/, /\basistente\b/, /\bcotizar\b/, /\bcotizacion\b/,
    /\bimportar\b/, /\benvio\b/, /\benvios\b/,
    /\bprecio\b/, /\bprecios\b/, /\btarifa\b/, /\btarifas\b/,
    /\btracking\b/, /\bseguimiento\b/, /\binformacion\b/,
    /quiero.*cotizar/, /quiero.*traer/, /quiero.*importar/, /quiero.*saber/,
    /como.*funciona/, /como.*traer/, /necesito.*ayuda/, /me.*ayudas/,
  ];

  if (!text) return "unknown";
  if (operatorPatterns.some((r) => r.test(text))) return "operator";
  if (botPatterns.some((r) => r.test(text))) return "bot";
  if (/(cotiz|import|envi|carga|precio|tarifa|compra|traer|seguimiento|tracking|pedido|china|usa|europa)/.test(text)) return "bot";
  if (/(hablar|respuesta|responda|atienda).*(persona|humano|operador)/.test(text)) return "operator";
  if (/^(hola|buenas|buen dia|buenas tardes|buenas noches|hello|hi|menu|inicio|start|que tal|buenos dias)$/.test(text)) return "greeting";
  return "unknown";
}

function isDirectBusinessIntent(rawText) {
  const text = normalizeIntentText(rawText);
  return /(cotiz|import|envi|carga|precio|tarifa|compra|traer|seguimiento|tracking|pedido|china|usa|europa)/.test(text);
}

async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS wa_conversations (
      id BIGSERIAL PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      client_id INTEGER,
      contact_name TEXT,
      chat_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      mode TEXT NOT NULL DEFAULT 'bot',
      gate_stage TEXT NOT NULL DEFAULT 'new',
      assigned_operator_id INTEGER,
      needs_operator BOOLEAN NOT NULL DEFAULT FALSE,
      priority TEXT NOT NULL DEFAULT 'normal',
      source TEXT NOT NULL DEFAULT 'whatsapp',
      last_message TEXT,
      last_message_at TIMESTAMPTZ,
      unread_count INTEGER NOT NULL DEFAULT 0,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS wa_messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id BIGINT NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
      direction TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      message TEXT,
      raw JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS wa_events (
      id BIGSERIAL PRIMARY KEY,
      conversation_id BIGINT NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS wa_notifications (
      id BIGSERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      chat_id TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ
    )
  `);

  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS client_id INTEGER`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS contact_name TEXT`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS chat_id TEXT`);
  await db.query(`ALTER TABLE wa_notifications ADD COLUMN IF NOT EXISTS chat_id TEXT`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'bot'`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS gate_stage TEXT NOT NULL DEFAULT 'new'`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS assigned_operator_id INTEGER`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS needs_operator BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'whatsapp'`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS last_message TEXT`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await db.query(`ALTER TABLE wa_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await db.query(`ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS raw JSONB DEFAULT '{}'::jsonb`);
  await db.query(`ALTER TABLE wa_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await db.query(`ALTER TABLE wa_events ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb`);
  await db.query(`ALTER TABLE wa_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await db.query(`ALTER TABLE wa_notifications ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'`);
  await db.query(`ALTER TABLE wa_notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wa_conversations_last_message_at ON wa_conversations(last_message_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wa_conversations_mode ON wa_conversations(mode)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation_id ON wa_messages(conversation_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_wa_messages_created_at ON wa_messages(created_at DESC)`);
}

async function logEvent(conversationId, eventType, payload = {}) {
  await db.query(
    `INSERT INTO wa_events (conversation_id, event_type, payload) VALUES ($1, $2, $3)`,
    [conversationId, eventType, JSON.stringify(payload)]
  );
}

async function getOrCreateConversation({ phone, contactName = null, chatId = null }) {
  const normalizedPhone = digits(phone || chatId || "");
  let found = await db.query(`SELECT * FROM wa_conversations WHERE phone = $1 LIMIT 1`, [normalizedPhone]);

  if (found.rows[0]) {
    await db.query(
      `UPDATE wa_conversations
       SET contact_name = COALESCE($2, contact_name),
           chat_id = COALESCE($3, chat_id),
           updated_at = NOW()
       WHERE id = $1`,
      [found.rows[0].id, contactName, chatId]
    );
    const fresh = await db.query(`SELECT * FROM wa_conversations WHERE id = $1 LIMIT 1`, [found.rows[0].id]);
    return fresh.rows[0];
  }

  const inserted = await db.query(
    `INSERT INTO wa_conversations (phone, contact_name, chat_id, last_message_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING *`,
    [normalizedPhone, contactName, chatId]
  );
  return inserted.rows[0];
}

router.get("/summary", requireOperatorOrAdmin, async (req, res) => {
  try {
    const q = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE mode = 'waiting_operator')::int AS waiting_operator,
        COUNT(*) FILTER (WHERE mode = 'operator')::int AS operator_active,
        COUNT(*) FILTER (WHERE mode = 'bot')::int AS bot_active,
        COUNT(*) FILTER (WHERE unread_count > 0)::int AS unread,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
      FROM wa_conversations
    `);
    res.json({ ok: true, summary: q.rows[0] || {} });
  } catch (err) {
    console.error("[WA CRM SUMMARY ERROR]", err);
    res.status(500).json({ error: err.message || "summary error" });
  }
});

router.get("/conversations", requireOperatorOrAdmin, async (req, res) => {
  try {
    const qText = String(req.query.q || "").trim();
    const mode = String(req.query.mode || "").trim();
    const onlyPending = String(req.query.only_pending || "").trim() === "1";

    const clauses = [];
    const params = [];
    let idx = 1;

    if (qText) {
      clauses.push(`(phone ILIKE $${idx} OR COALESCE(contact_name,'') ILIKE $${idx} OR COALESCE(last_message,'') ILIKE $${idx})`);
      params.push(`%${qText}%`);
      idx++;
    }

    if (mode) {
      clauses.push(`mode = $${idx}`);
      params.push(mode);
      idx++;
    }

    if (onlyPending) clauses.push(`needs_operator = TRUE`);
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const q = await db.query(
      `SELECT * FROM wa_conversations
       ${where}
       ORDER BY last_message_at DESC NULLS LAST
       LIMIT 200`,
      params
    );

    res.json({ ok: true, rows: q.rows });
  } catch (err) {
    console.error("[WA CRM CONVERSATIONS ERROR]", err);
    res.status(500).json({ error: err.message || "conversations error" });
  }
});

router.get("/conversations/:id/messages", requireOperatorOrAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const q = await db.query(
      `SELECT * FROM wa_messages WHERE conversation_id = $1 ORDER BY created_at ASC, id ASC`,
      [id]
    );
    res.json({ ok: true, rows: q.rows });
  } catch (err) {
    console.error("[WA CRM MESSAGES ERROR]", err);
    res.status(500).json({ error: err.message || "messages error" });
  }
});

router.post("/conversations/:id/read", requireOperatorOrAdmin, async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    await db.query(`UPDATE wa_conversations SET unread_count = 0, updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA CRM READ ERROR]", err);
    res.status(500).json({ error: err.message || "read error" });
  }
});

router.post("/conversations/:id/take", requireOperatorOrAdmin, async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    await db.query(
      `UPDATE wa_conversations
       SET mode = 'operator',
           gate_stage = 'done',
           needs_operator = FALSE,
           assigned_operator_id = $2,
           unread_count = 0,
           updated_at = NOW()
       WHERE id = $1`,
      [id, req.user?.id || null]
    );
    await logEvent(id, "taken_by_operator", { operator_id: req.user?.id || null });
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA CRM TAKE ERROR]", err);
    res.status(500).json({ error: err.message || "take error" });
  }
});

router.post("/conversations/:id/release", requireOperatorOrAdmin, async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    await db.query(
      `UPDATE wa_conversations
       SET mode = 'bot',
           gate_stage = 'done',
           needs_operator = FALSE,
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    await logEvent(id, "released_to_bot", { operator_id: req.user?.id || null });
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA CRM RELEASE ERROR]", err);
    res.status(500).json({ error: err.message || "release error" });
  }
});

router.post("/conversations/:id/close", requireOperatorOrAdmin, async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    await db.query(
      `UPDATE wa_conversations
       SET status = 'closed',
           needs_operator = FALSE,
           unread_count = 0,
           closed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    await logEvent(id, "closed", { operator_id: req.user?.id || null });
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA CRM CLOSE ERROR]", err);
    res.status(500).json({ error: err.message || "close error" });
  }
});

router.post("/send", requireOperatorOrAdmin, async (req, res) => {
  try {
    await ensureTables();
    const conversationId = Number(req.body?.conversation_id);
    const message = String(req.body?.message || "").trim();
    if (!conversationId) return res.status(400).json({ error: "conversation_id required" });
    if (!message) return res.status(400).json({ error: "message required" });

    const convQ = await db.query(`SELECT * FROM wa_conversations WHERE id = $1 LIMIT 1`, [conversationId]);
    const conv = convQ.rows[0];
    if (!conv) return res.status(404).json({ error: "conversation not found" });

    if (!conv.chat_id) {
      return res.status(400).json({ error: "Esta conversacion todavia no tiene chat_id real. El cliente debe escribir al bot al menos una vez." });
    }

    const nQ = await db.query(
      `INSERT INTO wa_notifications (phone, chat_id, message, status, created_at)
       VALUES ($1, $2, $3, 'pending', NOW())
       RETURNING id`,
      [conv.phone, conv.chat_id, message]
    );

    await db.query(
      `INSERT INTO wa_messages (conversation_id, direction, sender_type, message, raw)
       VALUES ($1, 'outbound', 'operator', $2, $3)`,
      [conversationId, message, JSON.stringify({ notification_id: nQ.rows[0]?.id || null, source: "operator_manual_send" })]
    );

    await db.query(
      `UPDATE wa_conversations
       SET mode = 'operator',
           gate_stage = 'done',
           needs_operator = FALSE,
           last_message = $2,
           last_message_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [conversationId, message]
    );

    await logEvent(conversationId, "operator_message_queued", { operator_id: req.user?.id || null, message });
    res.json({ ok: true });
  } catch (err) {
    console.error("[WA CRM SEND ERROR]", err);
    res.status(500).json({ error: err.message || "send error" });
  }
});

router.post("/inbound", requireAIKey, async (req, res) => {
  try {
    await ensureTables();

    const phone = digits(req.body?.phone || req.body?.chatId || req.body?.from || "");
    let message = String(req.body?.message || "").trim();
    const contactName = String(req.body?.actorName || "").trim() || null;
    const chatId = String(req.body?.chatId || req.body?.from || "").trim() || null;
    const sessionKey = String(req.body?.sessionKey || phone).trim() || phone;
    const actorRole = String(req.body?.actorRole || "guest").trim() || "guest";
    const mediaUrl = String(req.body?.media_url || "").trim() || null;
    const mediaType = String(req.body?.media_type || "").trim() || null;
    const caption = req.body?.caption != null ? String(req.body.caption) : null;

    if (!phone) return res.status(400).json({ error: "phone required" });
    if (!message && mediaUrl) message = "[" + (mediaType || "media") + "]";
    if (!message) return res.status(400).json({ error: "message required" });

    let conversation = await getOrCreateConversation({ phone, contactName, chatId });

    const insMsg = await db.query(
      `INSERT INTO wa_messages (conversation_id, direction, sender_type, message, raw, media_url, media_type, caption)
       VALUES ($1, 'inbound', 'client', $2, $3, $4, $5, $6) RETURNING id`,
      [conversation.id, message, JSON.stringify({ sessionKey, actorRole, actorName: contactName }),
       mediaUrl, mediaType, caption]
    );
    const waMessageId = insMsg.rows[0]?.id || null;

    if (await isAdminPhone(phone)) {
      await db.query(
        `UPDATE wa_conversations SET mode='admin', gate_stage='done', last_message_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [conversation.id]
      ).catch(e => console.error("[admin upsert]", e.message));
      return res.json({
        ok: true,
        conversationId: conversation.id,
        waMessageId,
        isAdmin: true,
        mode: "admin",
        allowPortal: true,
        shouldReply: false,
        replyText: null,
      });
    }

    await db.query(
      `UPDATE wa_conversations
       SET contact_name = COALESCE($2, contact_name),
           chat_id = COALESCE($3, chat_id),
           last_message = $4,
           last_message_at = NOW(),
           unread_count = unread_count + 1,
           status = CASE WHEN status = 'closed' THEN 'active' ELSE status END,
           updated_at = NOW()
       WHERE id = $1`,
      [conversation.id, contactName, chatId, message]
    );

    const refreshed = await db.query(`SELECT * FROM wa_conversations WHERE id = $1 LIMIT 1`, [conversation.id]);
    conversation = refreshed.rows[0];

    const intent = detectEntryIntent(message);

    // Si ya esta en manos del operador o esperando — no interrumpir con el bot
    if (conversation.mode === "operator" || conversation.mode === "waiting_operator") {
      await db.query(
        `UPDATE wa_conversations SET needs_operator = TRUE, updated_at = NOW() WHERE id = $1`,
        [conversation.id]
      );
      return res.json({
        ok: true,
        conversationId: conversation.id,
        allowPortal: false,
        shouldReply: false,
        mode: conversation.mode
      });
    }

    // Gate inicial — primera vez que escribe
    if (conversation.gate_stage !== "done") {
      if (intent === "operator") {
        await db.query(
          `UPDATE wa_conversations
           SET mode = 'waiting_operator',
               gate_stage = 'done',
               needs_operator = TRUE,
               updated_at = NOW()
           WHERE id = $1`,
          [conversation.id]
        );
        await logEvent(conversation.id, "waiting_operator", { source: "entry_gate", message });

        // Notificar al operador
        try {
          const OP = process.env.OPERATOR_PHONE || "5491126497979";
          const notifMsg = "Cliente esperando operador\n\nTelefono: " + phone +
            "\nNombre: " + (contactName || "-") +
            "\nMensaje: " + message +
            "\n\nEs cliente nuevo. Entra al CRM para atenderlo.";
          await db.query(
            `INSERT INTO wa_notifications (phone, chat_id, message, status, created_at) VALUES ($1, $2, $3, 'pending', NOW())`,
            [OP, null, notifMsg]
          );
        } catch (ne) { console.log("[NOTIF ERR]", ne?.message); }

        return res.json({
          ok: true,
          conversationId: conversation.id,
          allowPortal: false,
          shouldReply: true,
          replyText: "Perfecto! El operador te va a contestar a la brevedad.",
          mode: "waiting_operator"
        });
      }

      if (intent === "bot") {
        await db.query(
          `UPDATE wa_conversations
           SET mode = 'bot',
               gate_stage = 'done',
               needs_operator = FALSE,
               updated_at = NOW()
           WHERE id = $1`,
          [conversation.id]
        );
        await logEvent(conversation.id, "bot_enabled", { source: "entry_gate", message, direct: isDirectBusinessIntent(message) });

        if (isDirectBusinessIntent(message)) {
          return res.json({
            ok: true,
            conversationId: conversation.id,
            allowPortal: true,
            shouldReply: false,
            mode: "bot"
          });
        }

        return res.json({
          ok: true,
          conversationId: conversation.id,
          allowPortal: true,
          shouldReply: false,
          mode: "bot"
        });
      }

      // Ir directo al portal sin gate intermedio
      await db.query(
        `UPDATE wa_conversations SET mode='bot', gate_stage='done', needs_operator=FALSE, updated_at=NOW() WHERE id=$1`,
        [conversation.id]
      );
      return res.json({
        ok: true,
        conversationId: conversation.id,
        allowPortal: true,
        shouldReply: false,
        mode: "bot"
      });
    }

    // Gate ya resuelto — cliente recurrente
    // Solo mostrar gate de cliente recurrente si el modo actual NO es bot
    // Si ya eligio bot, dejar que el portal maneje el flujo sin interrumpir
    const hadOperator = conversation.assigned_operator_id != null &&
      conversation.mode !== "bot" &&
      conversation.mode !== "operator" &&
      conversation.mode !== "waiting_operator";

    if (hadOperator) {
      if (intent === "operator") {
        await db.query(
          `UPDATE wa_conversations
           SET mode = 'waiting_operator',
               needs_operator = TRUE,
               updated_at = NOW()
           WHERE id = $1`,
          [conversation.id]
        );
        await logEvent(conversation.id, "returning_client_wants_operator", { message });
        try {
          const OP = process.env.OPERATOR_PHONE || "5491126497979";
          const notifMsg = "Cliente recurrente esperando operador\n\nTelefono: " + phone +
            "\nNombre: " + (contactName || "-") +
            "\nMensaje: " + message +
            "\n\nTiene conversacion previa. Entra al CRM.";
          await db.query(
            `INSERT INTO wa_notifications (phone, chat_id, message, status, created_at) VALUES ($1, $2, $3, 'pending', NOW())`,
            [OP, null, notifMsg]
          );
        } catch (ne) { console.log("[NOTIF ERR2]", ne?.message); }
        return res.json({
          ok: true,
          conversationId: conversation.id,
          allowPortal: false,
          shouldReply: true,
          replyText: "Perfecto! El operador te va a contestar a la brevedad.\n\nPodes dejarnos tu numero de cliente y mail para que pueda atenderte mas rapido.",
          mode: "waiting_operator"
        });
      }

      if (intent === "bot") {
        await db.query(
          `UPDATE wa_conversations
           SET mode = 'bot',
               needs_operator = FALSE,
               updated_at = NOW()
           WHERE id = $1`,
          [conversation.id]
        );
        await logEvent(conversation.id, "returning_client_chose_bot", { message });
        return res.json({
          ok: true,
          conversationId: conversation.id,
          allowPortal: true,
          shouldReply: false,
          mode: "bot"
        });
      }

      // Sin intent claro — mostrar gate de eleccion
      return res.json({
        ok: true,
        conversationId: conversation.id,
        allowPortal: false,
        shouldReply: true,
        replyText: null,
        mode: conversation.mode || "bot",
        showReturningGate: true
      });
    }

    // Cliente en modo bot activo — chequear si quiere operador en cualquier momento
    if (intent === "operator") {
      await db.query(
        `UPDATE wa_conversations
         SET mode = 'waiting_operator',
             needs_operator = TRUE,
             updated_at = NOW()
         WHERE id = $1`,
        [conversation.id]
      );
      await logEvent(conversation.id, "bot_interrupted_wants_operator", { message });
      try {
        const OP = process.env.OPERATOR_PHONE || "5491126497979";
        const notifMsg = "⚡ Cliente pidió operador durante el flujo del bot\n\nTeléfono: " + phone +
          "\nNombre: " + (contactName || "-") +
          "\nMensaje: " + message +
          "\n\nEntrá al CRM para atenderlo.";
        await db.query(
          `INSERT INTO wa_notifications (phone, chat_id, message, status, created_at) VALUES ($1, $2, $3, 'pending', NOW())`,
          [OP, null, notifMsg]
        );
      } catch (ne) { console.log("[NOTIF ERR OPERATOR]", ne?.message); }

      return res.json({
        ok: true,
        conversationId: conversation.id,
        allowPortal: false,
        shouldReply: true,
        replyText: "Perfecto! Un operador te va a contestar a la brevedad. 🙌",
        mode: "waiting_operator"
      });
    }

    return res.json({
      ok: true,
      conversationId: conversation.id,
      allowPortal: true,
      shouldReply: false,
      mode: conversation.mode || "bot"
    });
  } catch (err) {
    console.error("[WA CRM INBOUND ERROR]", err);
    res.status(500).json({ error: err.message || "inbound error" });
  }
});

router.post("/outbound", requireAIKey, async (req, res) => {
  try {
    await ensureTables();
    const phone = digits(req.body?.phone || "");
    const chatId = String(req.body?.chatId || "").trim() || null;
    const conversationIdRaw = req.body?.conversationId;
    const senderType = String(req.body?.senderType || "bot").trim() || "bot";
    const message = String(req.body?.message || "").trim();
    const raw = req.body?.raw || {};

    if (!phone && !conversationIdRaw) return res.status(400).json({ error: "phone or conversationId required" });
    if (!message) return res.status(400).json({ error: "message required" });

    let conversationId = Number(conversationIdRaw);
    let conversation = null;

    if (conversationId) {
      const q = await db.query(`SELECT * FROM wa_conversations WHERE id = $1 LIMIT 1`, [conversationId]);
      conversation = q.rows[0];
    } else {
      conversation = await getOrCreateConversation({ phone, chatId });
      conversationId = Number(conversation.id);
    }

    if (!conversation) return res.status(404).json({ error: "conversation not found" });

    await db.query(
      `INSERT INTO wa_messages (conversation_id, direction, sender_type, message, raw)
       VALUES ($1, 'outbound', $2, $3, $4)`,
      [conversationId, senderType, message, JSON.stringify(raw)]
    );

    await db.query(
      `UPDATE wa_conversations
       SET last_message = $2,
           last_message_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [conversationId, message]
    );

    res.json({ ok: true, conversationId });
  } catch (err) {
    console.error("[WA CRM OUTBOUND ERROR]", err);
    res.status(500).json({ error: err.message || "outbound error" });
  }
});

router.post("/admin/purge-broken-queue", requireAIKey, async (req, res) => {
  try {
    await ensureTables();
    const result = await db.query(`
      DELETE FROM wa_notifications
      WHERE chat_id IS NULL
         OR chat_id = ''
         OR chat_id NOT LIKE '%@%'
    `);
    return res.json({ ok: true, deleted: result.rowCount });
  } catch (err) {
    console.error("[WA CRM PURGE ERROR]", err);
    return res.status(500).json({ error: err.message || "purge error" });
  }
});

module.exports = router;