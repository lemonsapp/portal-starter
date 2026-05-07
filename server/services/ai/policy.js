function normalizeWhatsAppId(value) {
  if (!value) return null;
  return String(value).split("@")[0].replace(/[^\d]/g, "") || null;
}

function normalizeTelegramId(value) {
  if (!value) return null;
  return String(value).trim();
}

function resolveActorScope({ channel, actorRole = "guest" }) {
  const role = String(actorRole || "guest").toLowerCase();

  if (channel === "internal") return "private_operator";
  if (role === "admin" || role === "founder" || role === "operator") {
    return "private_operator";
  }

  return "public_customer";
}

function getBlockedMessage(intent) {
  switch (intent) {
    case "find_client":
      return "Puedo atender consultas generales y de cliente, pero no compartir información privada de otros clientes.";
    case "create_shipment":
      return "Puedo ayudarte como cliente, tomar tus datos y derivarte, pero la carga operativa interna de envíos la maneja el equipo.";
    case "update_shipment_status":
      return "Los cambios internos de estado los realiza el equipo autorizado de Lemon’s.";
    default:
      return "Puedo ayudarte como cliente, pero la información privada e interna queda reservada para el equipo autorizado.";
  }
}

function canPublicReadShipment({ actorContext, shipment }) {
  if (!actorContext?.clientId || !shipment?.user_id) return false;
  return Number(actorContext.clientId) === Number(shipment.user_id);
}

module.exports = {
  normalizeWhatsAppId,
  normalizeTelegramId,
  resolveActorScope,
  getBlockedMessage,
  canPublicReadShipment,
};
