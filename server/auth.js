const jwt = require("jsonwebtoken");
const db = require("./db");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autenticado" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// Cache simple de scopes por user_id (TTL 5min). El JWT solo tiene id+role;
// los scopes viven en DB y pueden cambiar — con TTL corto evitamos tener que rotar tokens.
const scopesCache = new Map();
const SCOPES_TTL_MS = 5 * 60 * 1000;

async function getUserScopes(userId) {
  const hit = scopesCache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit.scopes;
  try {
    const r = await db.query("SELECT scopes FROM users WHERE id=$1", [userId]);
    const scopes = r.rows[0]?.scopes || null;
    scopesCache.set(userId, { scopes, expiresAt: Date.now() + SCOPES_TTL_MS });
    return scopes;
  } catch (e) {
    console.error("[getUserScopes] error", e.message);
    return null;
  }
}

function invalidateUserScopesCache(userId) {
  scopesCache.delete(userId);
}

// requireRole(roles, scope?) — `scope` por defecto "general". Admins y operadores sin scopes restrictivos pasan.
// Los operadores con scopes específicos solo pasan si su array incluye el scope pedido (o "*").
function requireRole(roles = [], scope = "general") {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "No autorizado" });
    if (req.user.role === "admin") return next();
    if (scope === "*") return next();
    const scopes = await getUserScopes(req.user.id);
    if (!scopes || scopes.length === 0 || scopes.includes("*")) return next();
    if (scopes.includes(scope)) return next();
    return res.status(403).json({ error: "Sin permiso para esta operación", required_scope: scope });
  };
}

module.exports = { authRequired, requireRole, getUserScopes, invalidateUserScopesCache };
