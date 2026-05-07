const db = require("../../db");

function buildStatusMessage({ clientName, shipmentCode, status }) {
  const safeName = clientName ? `${clientName}, ` : "";
  return `${safeName}tu envío ${shipmentCode} ahora está en estado: ${status}.`;
}

async function logAiNotification({
  clientId = null,
  shipmentId = null,
  channel,
  templateKey,
  content,
  status = "queued",
  providerResponse = null,
}) {
  const { rows } = await db.query(
    `
    INSERT INTO ai_notifications (
      client_id,
      shipment_id,
      channel,
      template_key,
      content,
      status,
      provider_response
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
    `,
    [clientId, shipmentId, channel, templateKey, content, status, providerResponse]
  );

  return rows[0];
}

async function queueWhatsAppNotification({
  phone,
  content,
  clientId = null,
  shipmentId = null,
  templateKey = "generic",
}) {
  if (!phone) {
    return logAiNotification({
      clientId,
      shipmentId,
      channel: "whatsapp",
      templateKey,
      content,
      status: "skipped",
      providerResponse: { reason: "missing_phone" },
    });
  }

  try {
    await db.query(
      `
      INSERT INTO wa_notifications (phone, message, source)
      VALUES ($1, $2, 'ai_operator')
      `,
      [phone, content]
    );

    return logAiNotification({
      clientId,
      shipmentId,
      channel: "whatsapp",
      templateKey,
      content,
      status: "queued",
      providerResponse: { queued: true },
    });
  } catch (error) {
    return logAiNotification({
      clientId,
      shipmentId,
      channel: "whatsapp",
      templateKey,
      content,
      status: "failed",
      providerResponse: { error: error.message },
    });
  }
}

async function notifyClientStatusChange({ client, shipment, status }) {
  const content = buildStatusMessage({
    clientName: client?.name || null,
    shipmentCode: shipment.code,
    status,
  });

  return queueWhatsAppNotification({
    phone: client?.phone || null,
    content,
    clientId: client?.id || null,
    shipmentId: shipment?.id || null,
    templateKey: "shipment_status_change",
  });
}

module.exports = {
  notifyClientStatusChange,
  queueWhatsAppNotification,
  logAiNotification,
};
