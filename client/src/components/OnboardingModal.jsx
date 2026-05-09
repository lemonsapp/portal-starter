import { useEffect, useState } from "react";
import { Pop } from "./MotionPop.jsx";
import { motion, AnimatePresence } from "framer-motion";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

/**
 * Modal de onboarding que aparece si el user no tiene username o phone configurado.
 * Bloquea el resto de la app hasta que complete los datos requeridos.
 */
export default function OnboardingModal({ user, onComplete }) {
  const needsUsername = !user?.username;
  const needsPhone    = !user?.phone;
  const [open, setOpen] = useState(needsUsername || needsPhone);
  const [username, setUsername] = useState(user?.username || "");
  const [phone, setPhone]       = useState(user?.phone || "");
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");

  useEffect(() => {
    setOpen(!user?.username || !user?.phone);
    setUsername(user?.username || "");
    setPhone(user?.phone || "");
  }, [user?.username, user?.phone]);

  const valid = (!needsUsername || /^[a-z0-9_]{3,30}$/.test(username)) &&
                (!needsPhone || phone.replace(/\D/g, "").length >= 8);

  async function save() {
    setErr("");
    if (!valid) {
      setErr(needsUsername && !/^[a-z0-9_]{3,30}$/.test(username)
        ? "Username: 3-30 caracteres, solo letras, números y _"
        : "Teléfono inválido (mín 8 dígitos)");
      return;
    }
    setSaving(true);
    try {
      const body = {};
      if (needsUsername) body.username = username.toLowerCase();
      if (needsPhone)    body.phone    = phone.replace(/[^\d+]/g, "");
      const r = await fetch(`${API}/auth/setup-profile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setErr(d.error || "Error guardando");
        setSaving(false);
        return;
      }
      setOpen(false);
      onComplete?.(d.user);
    } catch {
      setErr("Error de red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: "fixed", inset: 0, background: "rgba(2,3,7,0.92)", backdropFilter: "blur(14px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <motion.div
            initial={{ scale: .92, y: 18, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: .94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{ width: "100%", maxWidth: 460, background: "linear-gradient(180deg,rgba(8,9,16,.98),rgba(2,3,7,.98))", border: "1px solid rgba(var(--brand-primary-rgb),.22)", borderRadius: 22, padding: "32px 28px 28px", position: "relative", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,.7)" }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a))", backgroundSize: "200% 100%", animation: "obBar 3s linear infinite" }} />
            <style>{`@keyframes obBar{from{background-position:0 0}to{background-position:200% 0}}`}</style>

            <div style={{ fontSize: 56, marginBottom: 18, lineHeight: 1, filter: "drop-shadow(0 0 16px rgba(var(--brand-primary-rgb),.5))" }}>🪙</div>

            <div style={{ fontFamily: "'Gotham', monospace", fontSize: 10, letterSpacing: "3px", textTransform: "uppercase", color: "var(--brand-accent, #ff8c2a)", marginBottom: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 22, height: 1, background: "var(--brand-accent, #ff8c2a)" }} />
              Bienvenido
            </div>

            <div style={{ fontFamily: "'Gotham', sans-serif", fontSize: 36, lineHeight: .95, letterSpacing: "1.5px", color: "#fff", marginBottom: 12 }}>
              {needsUsername && needsPhone ? "Completá tu perfil" : needsUsername ? "Elegí tu @ usuario" : "Falta tu teléfono"}
            </div>

            <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", lineHeight: 1.6, marginBottom: 24 }}>
              {needsUsername && needsPhone
                ? "Necesitamos tu @ y teléfono para que otros usuarios te encuentren y para coordinar entregas."
                : needsUsername
                  ? "Tu @ se usa en tu perfil público y en el chat. Solo letras, números y guión bajo."
                  : "Lo usamos para coordinar entregas. No se muestra públicamente."}
            </div>

            {needsUsername && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontFamily: "'Gotham', monospace", fontSize: 9, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,.4)", display: "block", marginBottom: 6, fontWeight: 600 }}>
                  Tu @ usuario *
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(var(--brand-primary-rgb),.22)", borderRadius: 12 }}>
                  <span style={{ color: "rgba(255,255,255,.4)", fontSize: 16 }}>@</span>
                  <input
                    autoFocus
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="tu_username"
                    maxLength={30}
                    style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: 16, fontWeight: 700, outline: "none", fontFamily: "inherit" }}
                  />
                </div>
              </div>
            )}

            {needsPhone && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontFamily: "'Gotham', monospace", fontSize: 9, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,.4)", display: "block", marginBottom: 6, fontWeight: 600 }}>
                  Tu teléfono *
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(var(--brand-primary-rgb),.22)", borderRadius: 12 }}>
                  <span style={{ color: "rgba(255,255,255,.4)", fontSize: 16 }}>📞</span>
                  <input
                    autoFocus={!needsUsername}
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+54 9 11 1234-5678"
                    maxLength={20}
                    style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, outline: "none", fontFamily: "inherit" }}
                  />
                </div>
              </div>
            )}

            {err && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 10, color: "#fca5a5", fontSize: 12, fontWeight: 600, marginBottom: 14, lineHeight: 1.4 }}>
                {err}
              </div>
            )}

            <Pop as="button" onClick={save} disabled={!valid || saving}
              style={{ width: "100%", padding: "14px", background: valid ? "linear-gradient(135deg,var(--brand-primary, #f5e03a),#ff8c00)" : "rgba(255,255,255,.05)", color: valid ? "#000" : "#444", border: "none", borderRadius: 12, fontFamily: "'Gotham', sans-serif", fontSize: 18, letterSpacing: "2px", textTransform: "uppercase", fontWeight: 700, cursor: valid ? "pointer" : "not-allowed", boxShadow: valid ? "0 8px 24px rgba(var(--brand-primary-rgb),.4)" : "none" }}>
              {saving ? "Guardando…" : "Guardar y continuar →"}
            </Pop>

            <div style={{ marginTop: 14, fontSize: 10, color: "rgba(255,255,255,.3)", textAlign: "center", fontFamily: "'Gotham', monospace", letterSpacing: "1.2px", lineHeight: 1.5 }}>
              Podés editarlo después desde tu perfil
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
