const db = require("../../db");

const VALID_ORIGINS = ["USA", "CHINA", "EUROPA"];
const VALID_STATUSES = [
  "Recibido en depósito",
  "En preparación",
  "Despachado",
  "En tránsito",
  "Listo para entrega",
  "Entregado",
];

const SERVICES_BY_ORIGIN = {
  USA: ["NORMAL", "EXPRESS"],
  CHINA: ["NORMAL", "EXPRESS"],
  EUROPA: ["NORMAL"],
};

function normalizeOrigin(origin) {
  if (!origin) return null;
  const value = String(origin).trim().toUpperCase();
  if (value === "CHN") return "CHINA";
  if (value === "EUR") return "EUROPA";
  return value;
}

function normalizeService(service) {
  if (!service) return null;
  return String(service).trim().toUpperCase();
}

function getOriginPrefix(origin) {
  switch (origin) {
    case "USA":
      return "USA";
    case "CHINA":
      return "CHN";
    case "EUROPA":
      return "EUR";
    default:
      throw new Error("Origen inválido");
  }
}

function getServicePrefix(service) {
  if (service === "NORMAL") return "N";
  if (service === "EXPRESS") return "E";
  throw new Error("Servicio inválido");
}

async function generateShipmentCode(origin, service) {
  const originNorm = normalizeOrigin(origin);
  const serviceNorm = normalizeService(service);

  const originPrefix = getOriginPrefix(originNorm);
  const servicePrefix = getServicePrefix(serviceNorm);

  const { rows } = await db.query(
    `
    SELECT code
    FROM shipments
    WHERE code LIKE $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [`${originPrefix}-${servicePrefix}-%`]
  );

  let nextNumber = 1;

  if (rows[0]?.code) {
    const parts = rows[0].code.split("-");
    const lastNumeric = Number(parts[2]);
    if (!Number.isNaN(lastNumeric)) {
      nextNumber = lastNumeric + 1;
    }
  }

  return `${originPrefix}-${servicePrefix}-${String(nextNumber).padStart(4, "0")}`;
}

async function findShipmentByCode(code) {
  if (!code) return null;
  const { rows } = await db.query(
    `
    SELECT s.*, u.name AS client_name, u.phone AS client_phone
    FROM shipments s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.code = $1
    LIMIT 1
    `,
    [code.trim()]
  );

  return rows[0] || null;
}

async function listShipmentsByClientId(clientId) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM shipments
    WHERE user_id = $1
    ORDER BY id DESC
    LIMIT 20
    `,
    [clientId]
  );

  return rows;
}

async function createShipment({
  userId,
  origin,
  service,
  weightKg,
  description = null,
  status = "Recibido en depósito",
}) {
  const originNorm = normalizeOrigin(origin);
  const serviceNorm = normalizeService(service);

  if (!VALID_ORIGINS.includes(originNorm)) {
    throw new Error("Origen inválido. Usá USA, CHINA o EUROPA");
  }

  if (!SERVICES_BY_ORIGIN[originNorm].includes(serviceNorm)) {
    throw new Error(`Servicio inválido para ${originNorm}`);
  }

  const numericWeight = Number(weightKg);
  if (!numericWeight || numericWeight <= 0) {
    throw new Error("El peso debe ser mayor a 0");
  }

  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Estado inicial inválido");
  }

  const code = await generateShipmentCode(originNorm, serviceNorm);

  const { rows } = await db.query(
    `
    INSERT INTO shipments (
      user_id,
      code,
      origin,
      service,
      weight_kg,
      description,
      status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
    `,
    [userId, code, originNorm, serviceNorm, numericWeight, description, status]
  );

  return rows[0];
}

async function createShipmentEventIfTableExists({
  shipmentId,
  status,
  note = null,
}) {
  try {
    await db.query(
      `
      INSERT INTO shipment_events (shipment_id, status, note)
      VALUES ($1, $2, $3)
      `,
      [shipmentId, status, note]
    );
  } catch (error) {
    if (
      String(error.message || "").includes('relation "shipment_events" does not exist')
    ) {
      return;
    }
    throw error;
  }
}

async function updateShipmentStatus({
  shipmentId,
  status,
  note = null,
}) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Estado inválido");
  }

  const current = await db.query(
    `SELECT * FROM shipments WHERE id = $1 LIMIT 1`,
    [shipmentId]
  );

  if (!current.rows[0]) {
    throw new Error("Shipment no encontrado");
  }

  const { rows } = await db.query(
    `
    UPDATE shipments
    SET status = $2
    WHERE id = $1
    RETURNING *
    `,
    [shipmentId, status]
  );

  await createShipmentEventIfTableExists({
    shipmentId,
    status,
    note,
  });

  return {
    previous: current.rows[0],
    updated: rows[0],
  };
}

async function searchShipments({
  code = null,
  userId = null,
  status = null,
  limit = 20,
}) {
  const filters = [];
  const values = [];
  let i = 1;

  if (code) {
    filters.push(`s.code ILIKE $${i++}`);
    values.push(`%${code.trim()}%`);
  }

  if (userId) {
    filters.push(`s.user_id = $${i++}`);
    values.push(userId);
  }

  if (status) {
    filters.push(`s.status = $${i++}`);
    values.push(status);
  }

  values.push(limit);

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const { rows } = await db.query(
    `
    SELECT s.*, u.name AS client_name, u.phone AS client_phone
    FROM shipments s
    LEFT JOIN users u ON u.id = s.user_id
    ${where}
    ORDER BY s.id DESC
    LIMIT $${i}
    `,
    values
  );

  return rows;
}

module.exports = {
  VALID_STATUSES,
  createShipment,
  updateShipmentStatus,
  searchShipments,
  findShipmentByCode,
  listShipmentsByClientId,
  generateShipmentCode,
};
