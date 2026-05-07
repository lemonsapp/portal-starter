
function isSystemOn(settings) {
  return settings?.ai_enabled !== false;
}

function isOperator(actorRole) {
  return actorRole === "operator";
}

function parseSimpleCommand(text) {
  const lower = text.toLowerCase();

  // activar / desactivar bot
  if (lower.includes("activar bot")) return { action: "enable_bot" };
  if (lower.includes("desactivar bot")) return { action: "disable_bot" };

  // carga simple por ID
  const match = lower.match(/carga cliente (\d+)\s+([\d\.]+)kg\s+(.*)/);

  if (match) {
    return {
      action: "create_shipment_simple",
      clientId: parseInt(match[1]),
      weight: parseFloat(match[2]),
      description: match[3]
    };
  }

  return null;
}

async function handleOperatorMessage(ctx) {
  const { text, actorRole, settings, db } = ctx;

  // 🔴 SOLO OPERADORES
  if (!isOperator(actorRole)) {
    return { text: null }; // no responde
  }

  // 🔴 SI BOT APAGADO
  if (!isSystemOn(settings)) {
    if (text.toLowerCase().includes("activar bot")) {
      await db.query(`UPDATE ai_settings SET ai_enabled = true`);
      return { text: "Bot activado." };
    }
    return { text: null };
  }

  const cmd = parseSimpleCommand(text);

  if (!cmd) {
    return { text: null }; // nada de respuestas genéricas
  }

  // 🔘 ACTIVAR / DESACTIVAR
  if (cmd.action === "enable_bot") {
    await db.query(`UPDATE ai_settings SET ai_enabled = true`);
    return { text: "Bot activado." };
  }

  if (cmd.action === "disable_bot") {
    await db.query(`UPDATE ai_settings SET ai_enabled = false`);
    return { text: "Bot desactivado." };
  }

  // 📦 CREAR ENVÍO SIMPLE
  if (cmd.action === "create_shipment_simple") {
    const { rows } = await db.query(
      `SELECT * FROM users WHERE id = $1 LIMIT 1`,
      [cmd.clientId]
    );

    if (!rows[0]) {
      return { text: "Cliente no encontrado." };
    }

    const client = rows[0];

    const { rows: shipment } = await db.query(
      `
      INSERT INTO shipments (user_id, weight_kg, description, status)
      VALUES ($1, $2, $3, 'Recibido en depósito')
      RETURNING *
      `,
      [client.id, cmd.weight, cmd.description]
    );

    return {
      text: `OK. ${client.name} - ${cmd.weight}kg cargado.`
    };
  }

  return { text: null };
}

module.exports = { handleOperatorMessage };
