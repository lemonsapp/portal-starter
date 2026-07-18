// server/mailer.js — mails transaccionales de auth (verificación, reset, etc.)
//
// La config de Resend se resuelve con la MISMA cadena que los mails del shop
// (lib/shopNotify.getResendConfig): primero configStore (API key que el admin
// pega en el wizard, encriptada en app_config), fallback a env
// (RESEND_API_KEY + MAIL_FROM). Antes este archivo sólo miraba env: si la key
// vivía en el wizard, los mails de verificación salían "simulados" y no
// llegaban nunca.
const { render } = require("@react-email/render");
const { getResendConfig } = require("./lib/shopNotify");

const RESEND_API = "https://api.resend.com/emails";

async function sendEmail({ to, subject, html, react }) {
  console.log("[MAIL] Intentando enviar a:", to, "subject:", subject);

  const { apiKey, from } = await getResendConfig();
  if (!apiKey || !from) {
    console.log("[MAIL] Resend no configurado (ni wizard ni env). (simulado)");
    return;
  }

  // MAIL_TEST_TO: desvía todo a una casilla de prueba (sólo para debugging)
  const testTo = process.env.MAIL_TEST_TO;
  const finalTo = testTo ? testTo : to;

  // Podés mandar html directo o un componente React
  const finalHtml = react ? render(react) : html;

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: finalTo, subject, html: finalHtml }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.log("[MAIL] ERROR:", res.status, data);
      throw new Error(data.message || `Resend HTTP ${res.status}`);
    }

    console.log("[MAIL] OK! id:", data?.id, "to:", finalTo);
  } catch (e) {
    console.log("[MAIL] EXCEPCIÓN:", e.message);
    throw e;
  }
}

module.exports = { sendEmail };
