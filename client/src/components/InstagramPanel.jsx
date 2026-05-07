import { useState, useEffect } from "react";
import EditorialHero from "./EditorialHero.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const TRIGGER_TYPES = [
  { value: "dm", label: "💬 Mensaje directo (DM)" },
  { value: "comment", label: "💭 Comentario en publicación" },
];

const MATCH_TYPES = [
  { value: "contains", label: "Contiene la palabra" },
  { value: "exact", label: "Es exactamente" },
  { value: "starts_with", label: "Empieza con" },
];

const C = {
  lemon: "#f5e03a", orange: "#ff5500",
  surface: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  ghost: "rgba(255,255,255,0.45)",
  faint: "rgba(255,255,255,0.07)",
};

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: C.ghost, marginBottom: 6 }}>{children}</div>;
}

export default function InstagramPanel() {
  const [automations, setAutomations] = useState([]);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState("automations");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Form nuevo
  const [form, setForm] = useState({ trigger_type: "dm", keyword: "", match_type: "contains", response_text: "" });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  async function loadAll() {
    setLoading(true);
    try {
      const [aRes, eRes, sRes] = await Promise.all([
        fetch(`${API}/api/instagram/automations`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API}/api/instagram/events`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API}/api/instagram/status`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const [aData, eData, sData] = await Promise.all([aRes.json(), eRes.json(), sRes.json()]);
      if (aData.ok) setAutomations(aData.rows || []);
      if (eData.ok) setEvents(eData.rows || []);
      setStatus(sData);
    } catch (e) { setMsg("Error cargando datos"); }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function createAutomation() {
    setMsg("");
    if (!form.keyword.trim() || !form.response_text.trim()) return setMsg("Completá palabra clave y respuesta");
    try {
      const res = await fetch(`${API}/api/instagram/automations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) return setMsg(data.error || "Error");
      setMsg("✅ Automatización creada");
      setForm({ trigger_type: "dm", keyword: "", match_type: "contains", response_text: "" });
      loadAll();
    } catch (e) { setMsg("Error"); }
  }

  async function toggleActive(id, current) {
    try {
      await fetch(`${API}/api/instagram/automations/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ active: !current }),
      });
      loadAll();
    } catch (e) { setMsg("Error"); }
  }

  async function deleteAutomation(id) {
    if (!confirm("¿Eliminar esta automatización?")) return;
    try {
      await fetch(`${API}/api/instagram/automations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setMsg("Eliminada");
      loadAll();
    } catch (e) { setMsg("Error"); }
  }

  async function saveEdit(id) {
    try {
      const res = await fetch(`${API}/api/instagram/automations/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!data.ok) return setMsg(data.error || "Error");
      setMsg("✅ Guardado");
      setEditId(null);
      loadAll();
    } catch (e) { setMsg("Error"); }
  }

  const inputStyle = {
    width: "100%", borderRadius: 10, border: `1px solid ${C.border}`,
    background: "rgba(255,255,255,0.06)", color: "#fff",
    padding: "10px 12px", fontSize: 13, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };

  const dmAutos = automations.filter(a => a.trigger_type === "dm");
  const commentAutos = automations.filter(a => a.trigger_type === "comment");

  return (
    <div style={{ padding: "16px 0" }}>
      <EditorialHero
        eyebrow="Social automation"
        title="INSTAGRAM"
        em="AUTOMATIONS"
        watermark="@LEMONS"
        live={!!status?.ig_user?.username}
        meta={[
          status?.ig_user?.username ? `Conectado · @${status.ig_user.username}` : "No conectado",
          "Reglas · Triggers · Actividad",
        ]}
        actions={
          <button onClick={loadAll} disabled={loading} style={{ height:42, padding:"0 22px", border:"none", cursor:loading?"not-allowed":"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:13, letterSpacing:"2px", textTransform:"uppercase", background:"#f5e03a", color:"#000", opacity:loading?.5:1, transition:"all .25s" }}>
            {loading ? "↻ Cargando…" : "↻ Actualizar"}
          </button>
        }
      />

      {msg && (
        <div onClick={() => setMsg("")} style={{
          padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, marginBottom: 12,
          cursor: "pointer",
          background: msg.includes("Error") || msg.includes("⚠") ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
          border: `1px solid ${msg.includes("Error") || msg.includes("⚠") ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
          color: msg.includes("Error") || msg.includes("⚠") ? "#fca5a5" : "#86efac",
        }}>{msg} <span style={{ opacity: 0.5 }}>✕</span></div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { k: "automations", l: "⚡ Automatizaciones" },
          { k: "new", l: "➕ Nueva automatización" },
          { k: "events", l: "📋 Actividad reciente" },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            height: 36, padding: "0 16px", borderRadius: 10, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13, transition: "all .15s",
            background: tab === t.k ? "linear-gradient(135deg,#f5e03a,#ff5500)" : "rgba(255,255,255,0.06)",
            color: tab === t.k ? "#0b1020" : "rgba(255,255,255,0.55)",
          }}>{t.l}</button>
        ))}
      </div>

      {/* TAB: NUEVA AUTOMATIZACIÓN */}
      {tab === "new" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>➕ Nueva automatización</div>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Label>Tipo de trigger</Label>
                <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))} style={inputStyle}>
                  {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Tipo de coincidencia</Label>
                <select value={form.match_type} onChange={e => setForm(f => ({ ...f, match_type: e.target.value }))} style={inputStyle}>
                  {MATCH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>Palabra clave que activa la respuesta</Label>
              <input
                value={form.keyword}
                onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
                placeholder='Ej: "precio", "info", "quiero comprar"'
                style={inputStyle}
              />
            </div>
            <div>
              <Label>Respuesta automática</Label>
              <textarea
                value={form.response_text}
                onChange={e => setForm(f => ({ ...f, response_text: e.target.value }))}
                placeholder="Hola! Para más información escribinos a..."
                rows={4}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />
            </div>
            <button onClick={createAutomation} style={{
              height: 46, borderRadius: 12, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg,#f5e03a,#ff5500)",
              color: "#0b1020", fontWeight: 900, fontSize: 15, fontFamily: "inherit",
            }}>
              ✓ Crear automatización
            </button>
          </div>
        </div>
      )}

      {/* TAB: AUTOMATIZACIONES */}
      {tab === "automations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* DMs */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.faint}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>Mensajes Directos (DM)</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "rgba(245,224,58,0.15)", color: C.lemon, fontWeight: 800 }}>{dmAutos.length}</span>
            </div>
            {dmAutos.length === 0
              ? <div style={{ padding: 24, textAlign: "center", color: C.ghost, fontSize: 13 }}>Sin automatizaciones de DM. Creá una en "Nueva automatización".</div>
              : dmAutos.map(a => <AutoRow key={a.id} auto={a} editId={editId} editForm={editForm} setEditId={setEditId} setEditForm={setEditForm} toggleActive={toggleActive} deleteAutomation={deleteAutomation} saveEdit={saveEdit} inputStyle={inputStyle} />)
            }
          </div>

          {/* Comentarios */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.faint}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>💭</span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>Comentarios en publicaciones</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "rgba(245,224,58,0.15)", color: C.lemon, fontWeight: 800 }}>{commentAutos.length}</span>
            </div>
            {commentAutos.length === 0
              ? <div style={{ padding: 24, textAlign: "center", color: C.ghost, fontSize: 13 }}>Sin automatizaciones de comentarios. Creá una en "Nueva automatización".</div>
              : commentAutos.map(a => <AutoRow key={a.id} auto={a} editId={editId} editForm={editForm} setEditId={setEditId} setEditForm={setEditForm} toggleActive={toggleActive} deleteAutomation={deleteAutomation} saveEdit={saveEdit} inputStyle={inputStyle} />)
            }
          </div>
        </div>
      )}

      {/* TAB: EVENTOS */}
      {tab === "events" && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.faint}`, fontWeight: 800, fontSize: 14 }}>
            📋 Últimos 100 eventos
          </div>
          {events.length === 0
            ? <div style={{ padding: 32, textAlign: "center", color: C.ghost, fontSize: 13 }}>Sin actividad registrada todavía.</div>
            : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.faint}` }}>
                      {["Tipo", "Sender ID", "Mensaje", "Keyword", "Respuesta enviada", "Fecha"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.ghost, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(e => (
                      <tr key={e.id} style={{ borderBottom: `1px solid ${C.faint}` }}>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: e.event_type === "dm" ? "rgba(245,224,58,0.15)" : "rgba(96,165,250,0.15)",
                            color: e.event_type === "dm" ? C.lemon : "#60a5fa" }}>
                            {e.event_type === "dm" ? "💬 DM" : "💭 Comentario"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: C.ghost, fontFamily: "monospace" }}>{e.sender_id?.slice(-8) || "-"}</td>
                        <td style={{ padding: "10px 14px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.message_text || "-"}</td>
                        <td style={{ padding: "10px 14px" }}>
                          {e.matched_keyword
                            ? <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(34,197,94,0.15)", color: "#86efac", fontSize: 11, fontWeight: 700 }}>{e.matched_keyword}</span>
                            : <span style={{ color: C.ghost }}>Sin match</span>
                          }
                        </td>
                        <td style={{ padding: "10px 14px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: e.response_sent ? "#86efac" : C.ghost }}>
                          {e.response_sent || "—"}
                        </td>
                        <td style={{ padding: "10px 14px", color: C.ghost, whiteSpace: "nowrap" }}>
                          {e.created_at ? new Date(e.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* Info webhook */}
      <div style={{ marginTop: 16, padding: "14px 18px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 14, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
        <b style={{ color: "#60a5fa" }}>📡 URL del Webhook:</b> <code style={{ color: "#93c5fd" }}>https://api.lemonsarg.com/api/instagram/webhook</code>
        <br /><b style={{ color: "#60a5fa" }}>🔑 Verify Token:</b> <code style={{ color: "#93c5fd" }}>lemons_ig_webhook_2026</code>
        <br /><span style={{ marginTop: 4, display: "block" }}>Configurá estos valores en Meta for Developers → tu app → Webhooks.</span>
      </div>
    </div>
  );
}

function AutoRow({ auto, editId, editForm, setEditId, setEditForm, toggleActive, deleteAutomation, saveEdit, inputStyle }) {
  const isEditing = editId === auto.id;
  return (
    <div style={{
      padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)",
      background: isEditing ? "rgba(245,224,58,0.03)" : "transparent",
    }}>
      {isEditing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>PALABRA CLAVE</div>
              <input value={editForm.keyword || ""} onChange={e => setEditForm(f => ({ ...f, keyword: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>COINCIDENCIA</div>
              <select value={editForm.match_type || "contains"} onChange={e => setEditForm(f => ({ ...f, match_type: e.target.value }))} style={inputStyle}>
                <option value="contains">Contiene</option>
                <option value="exact">Exacta</option>
                <option value="starts_with">Empieza con</option>
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>RESPUESTA</div>
            <textarea value={editForm.response_text || ""} onChange={e => setEditForm(f => ({ ...f, response_text: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => saveEdit(auto.id)} style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#f5e03a,#ff5500)", color: "#0b1020", fontWeight: 800, fontSize: 13 }}>Guardar</button>
            <button onClick={() => setEditId(null)} style={{ height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: "rgba(245,224,58,0.15)", color: "#f5e03a" }}>
                {auto.keyword}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                {auto.match_type === "contains" ? "contiene" : auto.match_type === "exact" ? "exacta" : "empieza con"}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
              → {auto.response_text}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Toggle activo */}
            <button onClick={() => toggleActive(auto.id, auto.active)} style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              background: auto.active ? "#22c55e" : "rgba(255,255,255,0.12)", position: "relative", transition: "background .2s",
            }}>
              <div style={{ position: "absolute", top: 2, left: auto.active ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
            </button>
            <button onClick={() => { setEditId(auto.id); setEditForm({ keyword: auto.keyword, match_type: auto.match_type, response_text: auto.response_text }); }}
              style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 12 }}>
              ✏ Editar
            </button>
            <button onClick={() => deleteAutomation(auto.id)}
              style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", color: "#fca5a5", cursor: "pointer", fontSize: 12 }}>
              🗑
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
