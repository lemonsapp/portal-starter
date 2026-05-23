// client/src/pages/SetupAdmin.jsx
//
// Pantalla de bootstrap del primer admin. Se muestra cuando la DB no tiene
// users (la URL recién deployada). Spec § 8.1 step 4.
//
// Una sola vez por deploy: una vez que existe al menos un user, /auth/bootstrap-admin
// devuelve 403. El frontend redirecta a /login normalmente.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export default function SetupAdmin() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Defensa-en-profundidad: si esta página se abre cuando ya hay users,
  // redirect a /
  useEffect(() => {
    fetch(`${API}/auth/needs-bootstrap`)
      .then(r => r.json())
      .then(d => {
        if (!d.needs_bootstrap) navigate("/", { replace: true });
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg("");
    if (!name.trim() || !email.trim() || password.length < 8) {
      setMsg("Completá todos los campos. Password mínimo 8 chars.");
      return;
    }
    if (password !== pw2) {
      setMsg("Las passwords no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/bootstrap-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error || "Error al crear admin");
        setLoading(false);
        return;
      }
      // Guardar token + redirect al setup wizard
      localStorage.setItem("token", d.token);
      navigate("/admin/setup", { replace: true });
    } catch (err) {
      setMsg("Error de red");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div style={shellStyle}>
        <div style={{ color: "rgba(255,255,255,.5)", fontSize: 13 }}>Verificando estado…</div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--brand-primary, #3B82F6)", marginBottom: 8 }}>
          Setup inicial
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px 0" }}>Creá tu cuenta de administrador</h1>
        <p style={{ color: "rgba(237,233,224,.55)", fontSize: 14, margin: "0 0 24px 0" }}>
          Es la primera vez que entrás a este portal. Esta cuenta queda con role <code style={{ background: "rgba(255,255,255,.06)", padding: "2px 6px", borderRadius: 4 }}>admin</code> y puede gestionar todo.
        </p>

        <form onSubmit={onSubmit}>
          <Field label="Nombre" value={name} onChange={setName} placeholder="Juan Pérez" />
          <Field label="Email" value={email} onChange={setEmail} placeholder="admin@tucliente.com" type="email" />
          <Field label="Password (min 8)" value={password} onChange={setPassword} type="password" />
          <Field label="Repetir password" value={pw2} onChange={setPw2} type="password" />

          {msg && <div style={errorStyle}>{msg}</div>}

          <button type="submit" disabled={loading} style={{ ...btnStyle, marginTop: 18 }}>
            {loading ? "Creando…" : "Crear admin y empezar setup →"}
          </button>
        </form>

        <div style={{ marginTop: 18, padding: 12, background: "rgba(34,197,94,.04)", border: "1px solid rgba(34,197,94,.18)", borderRadius: 8, fontSize: 12, color: "rgba(237,233,224,.6)", lineHeight: 1.5 }}>
          ✓ Después del registro vas directo al wizard de configuración (5 pasos). Podés saltar lo que quieras y completarlo después desde /admin.
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={type === "password" ? "new-password" : "off"}
        required
        style={{
          width: "100%", padding: "11px 14px",
          background: "rgba(255,255,255,.03)",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 8,
          color: "var(--brand-text, #ede9e0)", fontSize: 14, fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

const shellStyle = {
  minHeight: "100vh",
  background: "var(--brand-bg, #080808)",
  color: "var(--brand-text, #ede9e0)",
  fontFamily: "var(--brand-font, Inter, sans-serif)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "24px 16px",
};
const cardStyle = {
  width: "100%", maxWidth: 460,
  padding: 32,
  background: "rgba(255,255,255,.02)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 14,
};
const btnStyle = {
  width: "100%", padding: "13px 22px",
  background: "var(--brand-primary, #3B82F6)",
  color: "#fff",
  border: "none", borderRadius: 8,
  fontWeight: 800, fontSize: 14, letterSpacing: 1,
  cursor: "pointer", fontFamily: "inherit",
};
const errorStyle = {
  marginTop: 14, padding: "10px 12px",
  background: "rgba(239,68,68,.08)",
  border: "1px solid rgba(239,68,68,.3)",
  borderRadius: 8, fontSize: 13, color: "#fca5a5",
};
