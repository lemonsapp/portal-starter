const db = require("../../db");

function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).replace(/[^\d+]/g, "").trim();
}

function digitsOnly(phone) {
  if (!phone) return null;
  return String(phone).replace(/[^0-9]/g, "");
}

function phoneCandidates(phone) {
  const raw = String(phone || "");
  const normalized = normalizePhone(raw);
  const digits = digitsOnly(raw);

  const set = new Set();

  if (normalized) set.add(normalized);
  if (digits) set.add(digits);
  if (digits && !digits.startsWith("+")) set.add(`+${digits}`);

  if (digits.length >= 8) set.add(digits.slice(-8));
  if (digits.length >= 10) set.add(digits.slice(-10));
  if (digits.length >= 11) set.add(digits.slice(-11));
  if (digits.length >= 13) set.add(digits.slice(-13));

  return Array.from(set).filter(Boolean);
}

async function findClientByPhone(phone) {
  const candidates = phoneCandidates(phone);
  if (!candidates.length) return null;

  for (const candidate of candidates) {
    const candidateDigits = digitsOnly(candidate);

    const { rows } = await db.query(
      `
      SELECT *
      FROM users
      WHERE
        regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = $1
        OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $2
        OR RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 8) = RIGHT($2, 8)
        OR RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = RIGHT($2, 10)
        OR RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 11) = RIGHT($2, 11)
        OR RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 13) = RIGHT($2, 13)
      ORDER BY id DESC
      LIMIT 1
      `,
      [candidate, candidateDigits || ""]
    );

    if (rows[0]) return rows[0];
  }

  return null;
}

async function findClientByName(name) {
  if (!name) return [];
  const { rows } = await db.query(
    `
    SELECT *
    FROM users
    WHERE name ILIKE $1
    ORDER BY id DESC
    LIMIT 10
    `,
    [`%${name.trim()}%`]
  );

  return rows;
}

async function findClient({ phone = null, name = null, id = null }) {
  if (id) {
    const byId = await db.query(
      `SELECT * FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    return byId.rows[0] || null;
  }

  if (phone) {
    const byPhone = await findClientByPhone(phone);
    if (byPhone) return byPhone;
  }

  if (name) {
    const matches = await findClientByName(name);
    if (matches.length === 1) return matches[0];
  }

  return null;
}

async function getNextClientNumber() {
  const { rows } = await db.query(`
    SELECT COALESCE(MAX(client_number), 0) + 1 AS next_number
    FROM users
  `);

  return Number(rows[0]?.next_number || 1);
}

function buildFallbackEmail({ name, phone, clientNumber }) {
  const cleanName = String(name || "cliente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 30) || "cliente";

  const cleanPhone = String(phone || "")
    .replace(/[^0-9]/g, "")
    .slice(-8);

  const suffix = cleanPhone || String(clientNumber || Date.now());
  return `${cleanName}.${suffix}@clients.lemons.local`;
}

const FALLBACK_PASSWORD_HASH = "$2b$10$7oE0o7K2Y0xD6xQ3mSxR6eW0YxA0r0mX0g2B8zQnQ2VYQx3m5rJ8C";

async function createClient({
  name,
  phone = null,
  email = null,
  role = "client",
}) {
  if (!name || !name.trim()) {
    throw new Error("Falta nombre del cliente");
  }

  const normalizedPhone = normalizePhone(phone);

  if (normalizedPhone) {
    const existing = await findClientByPhone(normalizedPhone);
    if (existing) {
      return {
        created: false,
        duplicated: true,
        client: existing,
      };
    }
  }

  const clientNumber = await getNextClientNumber();
  const safeEmail = (email && String(email).trim()) || buildFallbackEmail({
    name: name.trim(),
    phone: normalizedPhone,
    clientNumber,
  });

  const { rows } = await db.query(
    `
    INSERT INTO users (name, phone, email, role, client_number, password_hash)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [name.trim(), normalizedPhone, safeEmail, role, clientNumber, FALLBACK_PASSWORD_HASH]
  );

  return {
    created: true,
    duplicated: false,
    client: rows[0],
  };
}

async function updateClient(id, patch = {}) {
  const current = await db.query(
    `SELECT * FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );

  if (!current.rows[0]) {
    throw new Error("Cliente no encontrado");
  }

  const existing = current.rows[0];
  const fields = [];
  const values = [];
  let index = 1;

  if (patch.name !== undefined) {
    fields.push(`name = $${index++}`);
    values.push(patch.name?.trim() || existing.name);
  }

  if (patch.phone !== undefined) {
    fields.push(`phone = $${index++}`);
    values.push(normalizePhone(patch.phone));
  }

  if (patch.email !== undefined) {
    const nextEmail =
      patch.email?.trim() ||
      existing.email ||
      buildFallbackEmail({
        name: patch.name || existing.name,
        phone: patch.phone || existing.phone,
        clientNumber: existing.client_number,
      });

    fields.push(`email = $${index++}`);
    values.push(nextEmail);
  }

  if (!fields.length) {
    throw new Error("No hay campos para actualizar");
  }

  values.push(id);

  const { rows } = await db.query(
    `
    UPDATE users
    SET ${fields.join(", ")}
    WHERE id = $${index}
    RETURNING *
    `,
    values
  );

  return rows[0] || null;
}

module.exports = {
  normalizePhone,
  digitsOnly,
  phoneCandidates,
  findClient,
  findClientByPhone,
  findClientByName,
  createClient,
  updateClient,
};
