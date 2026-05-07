const db = require("../../db");

async function createConversation({
  channel,
  externalUserId = null,
  clientId = null,
  operatorUserId = null,
  roleDetected = "guest",
}) {
  const { rows } = await db.query(
    `
    INSERT INTO ai_conversations (
      channel,
      external_user_id,
      client_id,
      operator_user_id,
      role_detected
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [channel, externalUserId, clientId, operatorUserId, roleDetected]
  );

  return rows[0];
}

async function getOrCreateConversation({
  channel,
  externalUserId = null,
  clientId = null,
  operatorUserId = null,
  roleDetected = "guest",
}) {
  if (externalUserId) {
    const existing = await db.query(
      `
      SELECT *
      FROM ai_conversations
      WHERE channel = $1
        AND external_user_id = $2
        AND status = 'active'
      ORDER BY id DESC
      LIMIT 1
      `,
      [channel, externalUserId]
    );

    if (existing.rows.length) {
      const conversation = existing.rows[0];

      await db.query(
        `
        UPDATE ai_conversations
        SET
          client_id = COALESCE($2, client_id),
          operator_user_id = COALESCE($3, operator_user_id),
          role_detected = COALESCE($4, role_detected),
          last_message_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        `,
        [conversation.id, clientId, operatorUserId, roleDetected]
      );

      return {
        ...conversation,
        client_id: clientId ?? conversation.client_id,
        operator_user_id: operatorUserId ?? conversation.operator_user_id,
        role_detected: roleDetected ?? conversation.role_detected,
      };
    }
  }

  return createConversation({
    channel,
    externalUserId,
    clientId,
    operatorUserId,
    roleDetected,
  });
}

async function createMessage({
  conversationId,
  direction,
  channel,
  content,
  rawPayload = null,
  messageType = "text",
}) {
  const { rows } = await db.query(
    `
    INSERT INTO ai_messages (
      conversation_id,
      direction,
      channel,
      message_type,
      content,
      raw_payload
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [conversationId, direction, channel, messageType, content, rawPayload]
  );

  await db.query(
    `
    UPDATE ai_conversations
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = $1
    `,
    [conversationId]
  );

  return rows[0];
}

async function createActionLog({
  conversationId = null,
  actorType = "ai",
  actorId = null,
  actionName,
  targetType = null,
  targetId = null,
  inputJson = null,
  outputJson = null,
  status,
  errorMessage = null,
}) {
  const { rows } = await db.query(
    `
    INSERT INTO ai_action_logs (
      conversation_id,
      actor_type,
      actor_id,
      action_name,
      target_type,
      target_id,
      input_json,
      output_json,
      status,
      error_message
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
    `,
    [
      conversationId,
      actorType,
      actorId,
      actionName,
      targetType,
      targetId,
      inputJson,
      outputJson,
      status,
      errorMessage,
    ]
  );

  return rows[0];
}

module.exports = {
  getOrCreateConversation,
  createMessage,
  createActionLog,
};
