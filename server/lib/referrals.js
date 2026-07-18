// server/lib/referrals.js
// Constantes del programa de referidos compartidas entre el registro
// (server/index.js) y las stats del perfil (server/routes/profile.js).

"use strict";

// Máximo de invitaciones (referidos) que puede acumular un usuario.
// Pedido cliente Holistic 2026-07-18: tope de 2.
const REFERRAL_MAX_PER_USER = 2;

module.exports = { REFERRAL_MAX_PER_USER };
