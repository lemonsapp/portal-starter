// server/lib/permisos-objetivo.js — ¿quién puede tocar la cuenta de quién?
//
// Las rutas /operator/clients/:id (editar datos, resetear contraseña, suspender)
// están tras requireRole(["operator","admin"]) pero NO miraban el rol del
// OBJETIVO. Un operador podía resetearle la contraseña a un admin y entrar como
// admin, o cambiarle el email para robar el reseteo. Escalación operador→admin.
//
// EL BUG QUE ESTO CIERRA (auditoría 2026-08-08, hallazgo H4): PATCH
// /operator/clients/:id/password y el cambio de email/nombre/client_number en
// el PATCH hermano corrían `UPDATE users ... WHERE id=$N` sin una sola guarda
// sobre el rol de la fila objetivo. La ruta DELETE hermana (index.js) SÍ tenía
// la guarda; ésta la copia y la afina por rol del que llama.
//
// LA REGLA: un caller que no es admin sólo puede actuar sobre un objetivo con
// rol `client`. Sólo un admin puede modificar a otro admin o a un operador.
// Fail-closed: cualquier rol de objetivo desconocido/nulo lo bloquea para un
// caller no-admin.
//
// Corrida (sin DB):  cd server && node lib/permisos-objetivo.test.js
"use strict";

function puedeActuarSobreObjetivo(callerRole, targetRole) {
  if (callerRole === "admin") return true;   // el admin puede tocar a cualquiera
  return targetRole === "client";            // el resto, sólo clientes
}

module.exports = { puedeActuarSobreObjetivo };
