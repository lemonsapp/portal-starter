import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

export default function ClientUpdatePhoneCard({ onSaved }) {
  const [phone, setPhone] = useState("");
  const [currentPhone, setCurrentPhone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [okMsg, setOkMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const p = d.user?.notification_phone || d.user?.phone || "";
        setCurrentPhone(p || null);
        setPhone(p || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Si ya tiene teléfono y no está editando, no mostrar el card grande
  if (loading) return null;
  if (currentPhone && !editing) return (
    <div style={{
      background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
      borderRadius: 14, padding: "12px 16px", marginBottom: 16,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>📱</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#86efac" }}>WhatsApp de notificaciones activo</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{currentPhone}</div>
        </div>
      </div>
      <button onClick={() => setEditing(true)} style={{
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 8, padding: "5px 14px", color: "rgba(255,255,255,0.6)",
        fontSize: 12, cursor: "pointer", fontWeight: 600,
      }}>Cambiar</button>
    </div>
  );

  async function handleSubmit() {
    setOkMsg(""); setErrMsg("");
    const normalized = phone.replace(/\D/g, "");
    if (!normalized || normalized.length < 10) {
      setErrMsg("Número inválido. Ejemplo: 5491123456789"); return;
    }
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/client/update-contact-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ phone: normalized }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "No pude guardar");
      setCurrentPhone(normalized);
      setEditing(false);
      setOkMsg("");
      onSaved && onSaved(normalized);
    } catch(err) {
      setErrMsg(err.message || "Error al guardar");
    } finally { setLoading(false); }
  }

  const inputStyle = {
    width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.06)", color: "#fff", padding: "12px 14px",
    outline: "none", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, #111827 0%, #1f2937 100%)",
      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18,
      padding: 20, marginBottom: 20, color: "#fff",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>📲</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{editing ? "Cambiar WhatsApp" : "Activar notificaciones"}</div>
            <div style={{ opacity: 0.78, fontSize: 14 }}>Guardá tu WhatsApp para recibir avisos de estado.</div>
          </div>
        </div>
        {editing && (
          <button onClick={() => { setEditing(false); setPhone(currentPhone || ""); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 20 }}>✕</button>
        )}
      </div>

      {!editing && (
        <div style={{ marginBottom: 14, background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 1.6 }}>
          <div>✅ Cada cambio de estado te llega por WhatsApp.</div>
          <div>📦 Cuando el envío esté listo, te avisamos el total a abonar.</div>
          <div>📱 Formato: <b>549</b> + código de área + número (sin el 0 y sin el 15)</div>
          <div style={{ opacity: 0.6, fontSize: 12, marginTop: 4 }}>Ejemplo: 5491123456789</div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        <input value={phone} onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          placeholder="WhatsApp (ej: 5491123456789)"
          style={inputStyle} inputMode="numeric" />
        <button onClick={handleSubmit} disabled={loading} style={{
          background: loading ? "rgba(250,204,21,0.5)" : "#facc15", color: "#111827",
          border: "none", borderRadius: 12, padding: "12px 16px", fontWeight: 800,
          cursor: loading ? "not-allowed" : "pointer", fontSize: 14, fontFamily: "inherit",
        }}>
          {loading ? "Guardando..." : editing ? "Actualizar WhatsApp" : "Guardar WhatsApp de actualizaciones"}
        </button>
      </div>

      {okMsg && <div style={{ marginTop: 12, color: "#86efac", fontWeight: 600, fontSize: 14 }}>{okMsg}</div>}
      {errMsg && <div style={{ marginTop: 12, color: "#fca5a5", fontWeight: 600, fontSize: 14 }}>⚠️ {errMsg}</div>}
    </div>
  );
}
