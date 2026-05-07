// Helper compartido para construir y enviar el recibo consolidado de WhatsApp
// cuando se cierra un cobro con uno o más paquetes.
//
// Cada endpoint pasa su propio transporte (`send`) porque /cash/payments
// encola en wa_notifications y /api/ai/write/payment postea directo al
// gateway local.

const METHOD_LABELS = {
  USD_CASH: "Efectivo USD",
  USDT: "USDT",
  ARS_TRANSFER: "Transferencia ARS",
  ARS_CASH: "Efectivo ARS",
};

function buildPaymentReceipt({ clientName, shipments, totalUsd, method, when }) {
  const lista = (shipments || [])
    .map(s => {
      const kg = Number(s.weight || 0);
      const kgStr = kg > 0 ? ` — ${kg.toFixed(2)}kg` : "";
      return `• ${s.code}${kgStr} — $${Number(s.amount || 0).toFixed(2)} USD`;
    })
    .join("\n");
  const labelMethod = METHOD_LABELS[method] || method;
  const fecha = (when instanceof Date ? when : new Date()).toLocaleDateString("es-AR");
  return [
    "🎉 *¡Tu envío fue entregado con éxito!*",
    "",
    `👤 ${clientName || ""}`,
    "📦 Envíos entregados:",
    lista,
    "",
    `💰 Total: *$${Number(totalUsd || 0).toFixed(2)} USD*`,
    `💳 ${labelMethod}`,
    `📅 ${fecha}`,
    "",
    "¡Gracias por elegirnos una vez más! 🍋",
    "Cualquier duda o consulta escribinos, vamos a estar disponibles.",
  ].join("\n");
}

async function sendPaymentReceipt({ phone, clientName, shipments, totalUsd, method, when, send }) {
  if (!phone || typeof send !== "function") return false;
  const msg = buildPaymentReceipt({ clientName, shipments, totalUsd, method, when });
  await send(phone, msg);
  return true;
}

module.exports = { buildPaymentReceipt, sendPaymentReceipt, METHOD_LABELS };
