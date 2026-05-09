// client/src/components/ConnectedDevicesPanel.jsx
// Sección dentro del perfil del user para listar/revocar dispositivos
// con biometría registrada (passkeys WebAuthn).
import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

export default function ConnectedDevicesPanel() {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const res = await fetch(`${API}/auth/webauthn/credentials`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error cargando");
      setCredentials(data.credentials || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveLabel(id) {
    if (!editLabel.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`${API}/auth/webauthn/credentials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ label: editLabel.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error");
      setEditingId(null); setEditLabel("");
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id, label) {
    if (!confirm(`¿Revocar "${label}"? No vas a poder usar Face ID en ese dispositivo a menos que lo activés de nuevo.`)) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch(`${API}/auth/webauthn/credentials/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error");
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function fmtDate(s) {
    if (!s) return "—";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "—";
    const diff = Date.now() - d.getTime();
    const day = 24 * 60 * 60 * 1000;
    if (diff < day) return "hoy";
    if (diff < 2 * day) return "ayer";
    if (diff < 30 * day) return `hace ${Math.floor(diff / day)} días`;
    return d.toLocaleDateString("es-AR");
  }

  return (
    <div style={panel}>
      <div style={header}>
        <div style={title}>🔐 Dispositivos conectados</div>
        <div style={subtitle}>Dispositivos que pueden ingresar con biometría</div>
      </div>

      {err && <div style={errStyle}>⚠ {err}</div>}

      {loading ? (
        <div style={empty}>Cargando…</div>
      ) : credentials.length === 0 ? (
        <div style={empty}>
          No tenés dispositivos registrados.<br/>
          Activá biometría desde el login en cualquier dispositivo nuevo.
        </div>
      ) : (
        <div>
          {credentials.map(c => (
            <div key={c.id} style={row}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === c.id ? (
                  <input
                    autoFocus
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveLabel(c.id)}
                    style={input}
                    maxLength={60}
                  />
                ) : (
                  <div style={labelStyle}>{c.device_label || "Sin nombre"}</div>
                )}
                <div style={meta}>
                  Último uso: {fmtDate(c.last_used_at)} · Registrado: {fmtDate(c.created_at)}
                </div>
              </div>
              <div style={actions}>
                {editingId === c.id ? (
                  <>
                    <button onClick={() => saveLabel(c.id)} disabled={busy} style={btnSm}>Guardar</button>
                    <button onClick={() => { setEditingId(null); setEditLabel(""); }} style={btnSmGhost}>×</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditingId(c.id); setEditLabel(c.device_label || ""); }} style={btnSmGhost}>✏</button>
                    <button onClick={() => revoke(c.id, c.device_label || "este dispositivo")} disabled={busy} style={btnSmDanger}>Revocar</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const panel = { padding: 24, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(240,236,227,0.08)", marginTop: 24 };
const header = { marginBottom: 18 };
const title = { fontFamily: "'Gotham', sans-serif", fontSize: 28, letterSpacing: -0.5, color: "var(--brand-primary, #f5e03a)", marginBottom: 4 };
const subtitle = { fontSize: 13, color: "rgba(240,236,227,.45)" };
const errStyle = { marginBottom: 14, padding: "10px 14px", background: "rgba(var(--brand-accent-rgb),.06)", border: "1px solid rgba(var(--brand-accent-rgb),.18)", color: "#ffb07a", fontSize: 13 };
const empty = { padding: "32px 16px", textAlign: "center", color: "rgba(240,236,227,.4)", fontSize: 13, lineHeight: 1.6 };
const row = { display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid rgba(240,236,227,0.06)" };
const labelStyle = { fontFamily: "'Gotham', sans-serif", fontSize: 15, fontWeight: 600, color: "#f0ece3" };
const meta = { fontSize: 11, color: "rgba(240,236,227,.4)", fontFamily: "'Gotham', monospace", marginTop: 4 };
const input = { width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid rgba(var(--brand-primary-rgb),0.3)", color: "#f0ece3", padding: "8px 10px", fontFamily: "'Gotham', sans-serif", fontSize: 14, outline: "none" };
const actions = { display: "flex", gap: 6, flexShrink: 0 };
const btnSm = { padding: "6px 12px", background: "var(--brand-primary, #f5e03a)", color: "#000", border: "none", fontFamily: "'Gotham', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" };
const btnSmGhost = { padding: "6px 12px", background: "transparent", color: "rgba(240,236,227,.6)", border: "1px solid rgba(240,236,227,0.15)", fontFamily: "'Gotham', sans-serif", fontSize: 12, cursor: "pointer" };
const btnSmDanger = { padding: "6px 12px", background: "rgba(var(--brand-accent-rgb),0.1)", color: "#ffb07a", border: "1px solid rgba(var(--brand-accent-rgb),0.3)", fontFamily: "'Gotham', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" };
