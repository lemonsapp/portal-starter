// client/src/components/ActivateBiometricModal.jsx
// Modal post-login que ofrece activar biometría (Face ID / Touch ID / Hello / huella)
// en este dispositivo. 3 opciones: Activar / Recordame en 7 días / No, gracias.
import { useState } from "react";
import {
  registerBiometric,
  detectPlatformBiometricLabel,
  markBiometricEnabled,
  dismissBiometricPrompt,
} from "../lib/webauthn";

export default function ActivateBiometricModal({ token, email, onActivated, onDismiss }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const label = detectPlatformBiometricLabel();

  async function activate() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      await registerBiometric({ token, label: undefined /* server pone default por user-agent */ });
      if (email) markBiometricEnabled(email);
      onActivated?.();
    } catch (e) {
      setErr(e?.message || "No se pudo activar");
    } finally {
      setBusy(false);
    }
  }

  function remindLater() {
    dismissBiometricPrompt("remind7days");
    onDismiss?.();
  }

  function noThanks() {
    dismissBiometricPrompt("permanent");
    onDismiss?.();
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && remindLater()}>
      <div style={modal}>
        <div style={icon}>🔐</div>
        <div style={title}>Activá {label} en este dispositivo</div>
        <div style={desc}>
          Próximos logins van a ser un toque en lugar de tipear contraseña.
          Tu password sigue funcionando como hasta ahora.
        </div>

        {err && <div style={errStyle}>⚠ {err}</div>}

        <button onClick={activate} disabled={busy} style={btnPrimary}>
          {busy ? "Activando..." : `Activar ${label}`}
        </button>
        <button onClick={remindLater} disabled={busy} style={btnGhost}>
          Recordame en 7 días
        </button>
        <button onClick={noThanks} disabled={busy} style={btnLink}>
          No, gracias
        </button>

        <div style={footer}>
          Vas a poder activarlo después desde tu perfil → Dispositivos.
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed", inset: 0, zIndex: 9999,
  background: "rgba(2,3,7,.85)", backdropFilter: "blur(8px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
};

const modal = {
  background: "#0a0c14", border: "1px solid rgba(var(--brand-primary-rgb),0.18)",
  maxWidth: 400, width: "100%", padding: "32px 28px",
  fontFamily: "'Gotham', sans-serif", color: "#f0ece3",
  textAlign: "center",
};

const icon = { fontSize: 48, marginBottom: 12 };
const title = {
  fontFamily: "'Gotham', sans-serif", fontSize: 32, letterSpacing: -1,
  marginBottom: 14, color: "var(--brand-primary, #f5e03a)",
};
const desc = {
  fontSize: 14, color: "rgba(240,236,227,.55)", lineHeight: 1.6, marginBottom: 24,
};
const errStyle = {
  marginBottom: 16, padding: "10px 14px",
  background: "rgba(var(--brand-accent-rgb),.06)", border: "1px solid rgba(var(--brand-accent-rgb),.18)",
  color: "#ffb07a", fontSize: 13,
};
const btnPrimary = {
  width: "100%", padding: "16px 20px", marginBottom: 10,
  background: "var(--brand-primary, #f5e03a)", color: "#000", border: "none",
  fontFamily: "'Gotham', sans-serif", fontSize: 14, fontWeight: 800,
  letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
};
const btnGhost = {
  width: "100%", padding: "14px 20px", marginBottom: 8,
  background: "transparent", color: "#f0ece3",
  border: "1px solid rgba(240,236,227,0.15)",
  fontFamily: "'Gotham', sans-serif", fontSize: 13, fontWeight: 600,
  letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer",
};
const btnLink = {
  width: "100%", padding: "10px",
  background: "transparent", color: "rgba(240,236,227,.4)",
  border: "none", fontFamily: "'Gotham', monospace",
  fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
  cursor: "pointer", textDecoration: "underline",
};
const footer = {
  marginTop: 16, fontSize: 11, color: "rgba(240,236,227,.3)",
  fontFamily: "'Gotham', monospace", letterSpacing: 1,
};
