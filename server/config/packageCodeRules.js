const PACKAGE_CODE_RULES = {
  CHINA: {
    NORMAL: (clientName) => `HY-AUREL-LEMON-${clientName}`,
    EXPRESS: (clientName) => `1504-CN-${clientName}`,
  },
  USA: {
    NORMAL: (clientName) => `IC105/IC/LEMON-${clientName}`,
    EXPRESS: (clientName) => `1504-U-${clientName}`,
  },
  EUROPA: {
    NORMAL: (clientName) => `${clientName}`,
  },
};

function normalizeClientName(name = "") {
  return String(name)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function buildPackageCode({ origin, service, clientName }) {
  const o = String(origin || "").trim().toUpperCase();
  const s = String(service || "").trim().toUpperCase();
  const n = normalizeClientName(clientName);

  if (o === "EUROPA" && s === "EXPRESS") {
    throw new Error("Europa no tiene servicio Express");
  }

  const byOrigin = PACKAGE_CODE_RULES[o];
  if (!byOrigin) {
    throw new Error(`Origen inválido: ${origin}`);
  }

  const formatter = byOrigin[s];
  if (!formatter) {
    throw new Error(`Servicio inválido para ${origin}: ${service}`);
  }

  return formatter(n);
}

module.exports = {
  PACKAGE_CODE_RULES,
  normalizeClientName,
  buildPackageCode,
};
