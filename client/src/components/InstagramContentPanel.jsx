import { useState, useEffect, useCallback, useRef, useMemo, Component } from "react";
import SkillBadges from "./SkillBadges.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

// Captura errores de render del subárbol y muestra mensaje en lugar de quedar en blanco/negro.
class ModalErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[ModalErrorBoundary]", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, color: "#fca5a5", fontFamily: "monospace", fontSize: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#ef4444", marginBottom: 8 }}>
            ⚠ Error renderizando la modal
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>Mensaje:</strong> {String(this.state.error?.message || this.state.error)}
          </div>
          <details>
            <summary style={{ cursor: "pointer", color: "#fca5a5" }}>Stack</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 10, marginTop: 6 }}>{String(this.state.error?.stack || "")}</pre>
          </details>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button onClick={() => this.setState({ error: null })} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Reintentar</button>
            {this.props.onClose && <button onClick={this.props.onClose} style={{ padding: "6px 12px", background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Cerrar</button>}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const C = {
  lemon: "#f5e03a",
  orange: "#ff5500",
  surface: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.08)",
  ghost: "rgba(255,255,255,0.45)",
  faint: "rgba(255,255,255,0.07)",
};

const KIND_BADGE = {
  // ideas
  post:     { bg: "rgba(96,165,250,0.15)",  fg: "#60a5fa", label: "📷 Post" },
  reel:     { bg: "rgba(168,85,247,0.15)",  fg: "#c084fc", label: "🎬 Reel" },
  carousel: { bg: "rgba(245,224,58,0.15)",  fg: "#f5e03a", label: "🖼️ Carousel" },
  story:    { bg: "rgba(34,197,94,0.15)",   fg: "#86efac", label: "⚡ Story" },
  // scheduled (kinds técnicos)
  image:        { bg: "rgba(96,165,250,0.15)", fg: "#60a5fa", label: "📷 Imagen" },
  story_image:  { bg: "rgba(34,197,94,0.15)",  fg: "#86efac", label: "⚡ Story img" },
  story_video:  { bg: "rgba(34,197,94,0.15)",  fg: "#86efac", label: "⚡ Story video" },
};

const STATUS_BADGE = {
  // ideas
  draft:     { bg: "rgba(255,255,255,0.1)",  fg: "#fff",    label: "Borrador" },
  approved:  { bg: "rgba(34,197,94,0.15)",   fg: "#86efac", label: "Aprobada" },
  rejected:  { bg: "rgba(239,68,68,0.15)",   fg: "#fca5a5", label: "Rechazada" },
  scheduled: { bg: "rgba(245,224,58,0.15)",  fg: "#f5e03a", label: "Programada" },
  published: { bg: "rgba(96,165,250,0.15)",  fg: "#60a5fa", label: "Publicada" },
  // scheduled
  pending:    { bg: "rgba(255,255,255,0.1)", fg: "#fff",    label: "Pendiente" },
  publishing: { bg: "rgba(245,224,58,0.15)", fg: "#f5e03a", label: "Publicando…" },
  failed:     { bg: "rgba(239,68,68,0.15)",  fg: "#fca5a5", label: "Falló" },
  cancelled:  { bg: "rgba(255,255,255,0.06)", fg: "rgba(255,255,255,0.4)", label: "Cancelada" },
};

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", color: C.ghost, marginBottom: 6 }}>{children}</div>;
}

function Badge({ map, k }) {
  const b = map[k] || { bg: "rgba(255,255,255,0.08)", fg: "#fff", label: k };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: b.bg, color: b.fg, whiteSpace: "nowrap" }}>
      {b.label}
    </span>
  );
}

function relativeTime(iso) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const min = Math.round(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const days = Math.round(hr / 24);
  if (days < 30) return `hace ${days} d`;
  const months = Math.round(days / 30);
  if (months < 12) return `hace ${months} m`;
  return `hace ${Math.round(months / 12)} a`;
}

function formatARDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isoForDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local quiere YYYY-MM-DDTHH:mm en hora local
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

const inputStyle = {
  width: "100%", borderRadius: 10, border: `1px solid ${C.border}`,
  background: "rgba(255,255,255,0.06)", color: "#fff",
  padding: "10px 12px", fontSize: 13, outline: "none",
  fontFamily: "inherit", boxSizing: "border-box",
};

const btnPrimary = {
  height: 38, padding: "0 16px", borderRadius: 10, border: "none", cursor: "pointer",
  background: "linear-gradient(135deg,#f5e03a,#ff5500)",
  color: "#0b1020", fontWeight: 800, fontSize: 13, fontFamily: "inherit",
};

const btnGhost = {
  height: 30, padding: "0 12px", borderRadius: 8, border: `1px solid ${C.border}`,
  background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 12,
  fontFamily: "inherit",
};

const btnDanger = {
  height: 30, padding: "0 12px", borderRadius: 8,
  border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)",
  color: "#fca5a5", cursor: "pointer", fontSize: 12, fontFamily: "inherit",
};

const btnAction = {
  height: 30, padding: "0 12px", borderRadius: 8,
  border: "1px solid rgba(245,224,58,0.3)", background: "rgba(245,224,58,0.08)",
  color: C.lemon, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
};

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* noop */ }
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export default function InstagramContentPanel() {
  const [tab, setTab] = useState("ideas");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Ideas
  const [ideas, setIdeas] = useState([]);
  const [ideasFilter, setIdeasFilter] = useState("all");
  const [editingIdeaId, setEditingIdeaId] = useState(null);
  const [editIdeaForm, setEditIdeaForm] = useState({});
  const [expandedIdea, setExpandedIdea] = useState(null);
  const [scheduleModal, setScheduleModal] = useState(null); // { idea } o null

  // Scheduled
  const [scheduled, setScheduled] = useState([]);
  const [schedFilter, setSchedFilter] = useState("all");
  const [editScheduledModal, setEditScheduledModal] = useState(null);

  // Conversations
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null); // detalle

  // Insights counts
  const [insights, setInsights] = useState({ draftIdeas: 0, pendingPosts: 0, publishedRecent: 0, activeConvs: 0 });

  function notify(text, isError = false) {
    setMsg(isError ? `⚠ ${text}` : text);
    setTimeout(() => setMsg(""), 4000);
  }

  const loadIdeas = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (ideasFilter !== "all") params.set("status", ideasFilter);
      const data = await api(`/api/instagram-content/ideas?${params.toString()}`);
      setIdeas(data.rows || []);
    } catch (e) { notify(`Error cargando ideas: ${e.message}`, true); }
  }, [ideasFilter]);

  const loadScheduled = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (schedFilter !== "all") params.set("status", schedFilter);
      const data = await api(`/api/instagram-content/scheduled?${params.toString()}`);
      setScheduled(data.rows || []);
    } catch (e) { notify(`Error cargando programados: ${e.message}`, true); }
  }, [schedFilter]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api(`/api/instagram/conversations`);
      setConversations(data.rows || []);
    } catch (e) { notify(`Error cargando conversaciones: ${e.message}`, true); }
  }, []);

  const loadInsights = useCallback(async () => {
    try {
      const cutoff30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const cutoff24h = Date.now() - 24 * 3600 * 1000;
      const [draftIdeas, pendingPosts, publishedRecent, convs] = await Promise.all([
        api(`/api/instagram-content/ideas?status=draft&limit=1`),
        api(`/api/instagram-content/scheduled?status=pending&limit=1`),
        api(`/api/instagram-content/scheduled?status=published&from=${encodeURIComponent(cutoff30)}&limit=1`),
        api(`/api/instagram/conversations`),
      ]);
      const activeConvs = (convs.rows || []).filter(c => c.last_inbound_at && new Date(c.last_inbound_at).getTime() >= cutoff24h).length;
      setInsights({
        draftIdeas: draftIdeas.total || 0,
        pendingPosts: pendingPosts.total || 0,
        publishedRecent: publishedRecent.total || 0,
        activeConvs,
      });
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => { loadIdeas(); }, [loadIdeas]);
  useEffect(() => { loadScheduled(); }, [loadScheduled]);
  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { loadInsights(); }, [loadInsights]);

  // ───────────────── Ideas actions ─────────────────
  async function generateIdeas() {
    setBusy(true);
    try {
      const out = await api(`/api/instagram-content/ideas/generate`, { method: "POST" });
      notify(`✅ 7 ideas generadas (batch ${out.batch_id?.slice(0, 8)}…)`);
      await loadIdeas();
      await loadInsights();
    } catch (e) { notify(e.message, true); }
    setBusy(false);
  }

  async function generateStory() {
    setBusy(true);
    try {
      const out = await api(`/api/instagram-content/stories/generate`, { method: "POST" });
      notify(`✅ Story creada (${out.template_name || out.template_id})`);
      await loadIdeas();
      await loadInsights();
    } catch (e) { notify(e.message, true); }
    setBusy(false);
  }

  async function approveIdea(id, { openScheduleAfter = true } = {}) {
    try {
      const res = await api(`/api/instagram-content/ideas/${id}/approve`, { method: "POST" });
      notify("Idea aprobada");
      await loadIdeas();
      // Encadenar: tras aprobar, abrir directamente la modal de programar para que la idea no quede colgada en 'approved'.
      if (openScheduleAfter && res?.row) {
        setScheduleModal({ idea: res.row });
      }
    } catch (e) { notify(e.message, true); }
  }

  async function rejectIdea(id) {
    if (!confirm("¿Rechazar esta idea?")) return;
    try {
      await api(`/api/instagram-content/ideas/${id}/reject`, { method: "POST" });
      notify("Idea rechazada");
      await loadIdeas();
    } catch (e) { notify(e.message, true); }
  }

  async function bulkAction(action, ids) {
    if (!ids?.length) return;
    const verb = action === "approve" ? "aprobar" : "rechazar";
    if (!confirm(`¿${verb.charAt(0).toUpperCase() + verb.slice(1)} ${ids.length} ideas en draft?`)) return;
    try {
      const res = await api(`/api/instagram-content/ideas/bulk`, { method: "POST", body: { action, ids } });
      notify(`${res.affected || 0} ideas ${action === "approve" ? "aprobadas" : "rechazadas"}`);
      await loadIdeas();
    } catch (e) { notify(e.message, true); }
  }

  async function saveIdeaEdit() {
    if (!editingIdeaId) return;
    try {
      await api(`/api/instagram-content/ideas/${editingIdeaId}`, { method: "PATCH", body: editIdeaForm });
      notify("Idea actualizada");
      setEditingIdeaId(null);
      setEditIdeaForm({});
      await loadIdeas();
    } catch (e) { notify(e.message, true); }
  }

  // ───────────────── Schedule from idea ─────────────────
  async function submitSchedule({ idea_id, kind, caption, media_urls, scheduled_at }) {
    try {
      await api(`/api/instagram-content/schedule`, {
        method: "POST",
        body: { idea_id, kind, caption, media_urls, scheduled_at },
      });
      notify("✅ Programado");
      setScheduleModal(null);
      await loadIdeas();
      await loadScheduled();
      await loadInsights();
    } catch (e) { notify(e.message, true); }
  }

  // ───────────────── Scheduled actions ─────────────────
  async function publishNow(id) {
    try {
      await api(`/api/instagram-content/scheduled/${id}/publish-now`, { method: "POST" });
      notify("Publicación disparada — refrescá en unos segundos");
      setTimeout(loadScheduled, 2500);
    } catch (e) { notify(e.message, true); }
  }

  async function cancelScheduled(id) {
    if (!confirm("¿Cancelar este post programado?")) return;
    try {
      await api(`/api/instagram-content/scheduled/${id}`, { method: "DELETE" });
      notify("Post cancelado");
      await loadScheduled();
      await loadInsights();
    } catch (e) { notify(e.message, true); }
  }

  async function retryScheduled(id) {
    try {
      await api(`/api/instagram-content/scheduled/${id}/retry`, { method: "POST" });
      notify("Reintento programado");
      await loadScheduled();
    } catch (e) { notify(e.message, true); }
  }

  async function saveScheduledEdit() {
    if (!editScheduledModal) return;
    const { id, caption, scheduled_at, media_urls } = editScheduledModal;
    const urlsArr = String(media_urls || "").split("\n").map(s => s.trim()).filter(Boolean);
    if (urlsArr.length === 0) return notify("Pegá al menos una URL", true);
    try {
      await api(`/api/instagram-content/scheduled/${id}`, {
        method: "PATCH",
        body: {
          caption,
          scheduled_at: new Date(scheduled_at).toISOString(),
          media_urls: urlsArr,
        },
      });
      notify("Actualizado");
      setEditScheduledModal(null);
      await loadScheduled();
    } catch (e) { notify(e.message, true); }
  }

  // ───────────────── Conversations actions ─────────────────
  async function openConversation(senderId) {
    try {
      const data = await api(`/api/instagram/conversations/${senderId}`);
      setActiveConv(data.row);
    } catch (e) { notify(e.message, true); }
  }

  async function toggleHandoff(conv) {
    try {
      if (conv.human_handoff) {
        await api(`/api/instagram/handoff/${conv.sender_id}`, { method: "DELETE" });
      } else {
        await api(`/api/instagram/handoff/${conv.sender_id}`, { method: "POST" });
      }
      await loadConversations();
      if (activeConv?.sender_id === conv.sender_id) await openConversation(conv.sender_id);
    } catch (e) { notify(e.message, true); }
  }

  // ───────────────── Render ─────────────────
  return (
    <div style={{ padding: "16px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "2px", color: C.ghost, textTransform: "uppercase" }}>Instagram · contenido</div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: "0.5px" }}>
            CONTENIDO &amp; CONVERSACIONES
          </div>
        </div>
        {tab === "ideas" && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={generateIdeas} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "↻ Generando…" : "✨ Generar 7 nuevas ideas"}
            </button>
            <button onClick={generateStory} disabled={busy} style={{
              height: 38, padding: "0 16px", borderRadius: 10, border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.05)", color: "#fff", cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 800, fontSize: 13, fontFamily: "inherit", opacity: busy ? 0.6 : 1,
            }}>
              📱 Generar story del día
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {msg && (
        <div onClick={() => setMsg("")} style={{
          padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, marginBottom: 12, cursor: "pointer",
          background: msg.startsWith("⚠") ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
          border: `1px solid ${msg.startsWith("⚠") ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
          color: msg.startsWith("⚠") ? "#fca5a5" : "#86efac",
        }}>{msg} <span style={{ opacity: 0.5 }}>✕</span></div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { k: "ideas",      l: "💡 Ideas" },
          { k: "queue",      l: "📅 Programadas" },
          { k: "convos",     l: "💬 Conversaciones" },
          { k: "insights",   l: "📊 Insights" },
          { k: "frameworks", l: "✨ Frameworks" },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            height: 36, padding: "0 16px", borderRadius: 10, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 13, transition: "all .15s",
            background: tab === t.k ? "linear-gradient(135deg,#f5e03a,#ff5500)" : "rgba(255,255,255,0.06)",
            color: tab === t.k ? "#0b1020" : "rgba(255,255,255,0.55)",
          }}>{t.l}</button>
        ))}
      </div>

      {tab === "ideas" && (
        <IdeasTab
          ideas={ideas}
          ideasFilter={ideasFilter}
          setIdeasFilter={setIdeasFilter}
          expandedIdea={expandedIdea}
          setExpandedIdea={setExpandedIdea}
          editingIdeaId={editingIdeaId}
          setEditingIdeaId={setEditingIdeaId}
          editIdeaForm={editIdeaForm}
          setEditIdeaForm={setEditIdeaForm}
          approveIdea={approveIdea}
          rejectIdea={rejectIdea}
          saveIdeaEdit={saveIdeaEdit}
          openSchedule={(idea) => setScheduleModal({ idea })}
          bulkAction={bulkAction}
        />
      )}

      {tab === "queue" && (
        <QueueTab
          scheduled={scheduled}
          schedFilter={schedFilter}
          setSchedFilter={setSchedFilter}
          publishNow={publishNow}
          cancelScheduled={cancelScheduled}
          retryScheduled={retryScheduled}
          openEdit={(p) => setEditScheduledModal({
            id: p.id,
            caption: p.caption || "",
            scheduled_at: isoForDatetimeLocal(p.scheduled_at),
            media_urls: (p.media_urls || []).join("\n"),
          })}
        />
      )}

      {tab === "convos" && (
        <ConversationsTab
          conversations={conversations}
          activeConv={activeConv}
          openConversation={openConversation}
          toggleHandoff={toggleHandoff}
          closeConv={() => setActiveConv(null)}
        />
      )}

      {tab === "insights" && <InsightsTab insights={insights} />}

      {tab === "frameworks" && <FrameworksTab />}

      {scheduleModal && (
        <Modal onClose={() => setScheduleModal(null)}>
          <ModalErrorBoundary onClose={() => setScheduleModal(null)}>
            <ScheduleModalInner
              idea={scheduleModal.idea}
              onClose={() => setScheduleModal(null)}
              onSubmit={submitSchedule}
            />
          </ModalErrorBoundary>
        </Modal>
      )}

      {editScheduledModal && (
        <EditScheduledModal
          state={editScheduledModal}
          setState={setEditScheduledModal}
          onSave={saveScheduledEdit}
        />
      )}
    </div>
  );
}

// ============================ IDEAS TAB ============================

function IdeasTab({ ideas, ideasFilter, setIdeasFilter, expandedIdea, setExpandedIdea, editingIdeaId, setEditingIdeaId, editIdeaForm, setEditIdeaForm, approveIdea, rejectIdea, saveIdeaEdit, openSchedule, bulkAction }) {
  const filters = ["all", "draft", "approved", "rejected", "scheduled", "published"];
  const draftIds = ideas.filter(i => i.status === "draft").map(i => i.id);
  const showBulk = draftIds.length > 0 && (ideasFilter === "draft" || ideasFilter === "all");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {filters.map(f => (
          <button key={f} onClick={() => setIdeasFilter(f)} style={{
            height: 28, padding: "0 12px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px",
            background: ideasFilter === f ? "rgba(245,224,58,0.18)" : "rgba(255,255,255,0.05)",
            color: ideasFilter === f ? C.lemon : "rgba(255,255,255,0.5)",
          }}>{f === "all" ? "Todas" : f}</button>
        ))}
        {showBulk && bulkAction && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button onClick={() => bulkAction("approve", draftIds)} style={{
              height: 28, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(34,197,94,0.4)", cursor: "pointer",
              fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px",
              background: "rgba(34,197,94,0.15)", color: "#86efac",
            }}>✓ Aprobar todas ({draftIds.length})</button>
            <button onClick={() => bulkAction("reject", draftIds)} style={{
              height: 28, padding: "0 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)", cursor: "pointer",
              fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px",
              background: "rgba(239,68,68,0.12)", color: "#fca5a5",
            }}>✕ Rechazar todas ({draftIds.length})</button>
          </div>
        )}
      </div>

      {ideas.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: C.ghost, fontSize: 13, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
          Sin ideas todavía. Generá un batch nuevo arriba.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {ideas.map(idea => {
            const isEditing = editingIdeaId === idea.id;
            const isExpanded = expandedIdea === idea.id;
            const captionShort = (idea.caption || "").length > 200 ? `${(idea.caption || "").slice(0, 200)}…` : idea.caption;
            return (
              <div key={idea.id} style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16,
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <Badge map={KIND_BADGE} k={idea.kind} />
                  <Badge map={STATUS_BADGE} k={idea.status} />
                  <span style={{ marginLeft: "auto", fontSize: 11, color: C.ghost }}>
                    {formatARDate(idea.created_at)}
                  </span>
                </div>

                {isEditing ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div>
                      <Label>Caption</Label>
                      <textarea value={editIdeaForm.caption || ""} onChange={e => setEditIdeaForm(f => ({ ...f, caption: e.target.value }))} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
                    </div>
                    <div>
                      <Label>Hashtags (sin #, separados por espacio)</Label>
                      <input value={editIdeaForm.hashtags || ""} onChange={e => setEditIdeaForm(f => ({ ...f, hashtags: e.target.value }))} style={inputStyle} />
                    </div>
                    {idea.kind === "reel" && (
                      <div>
                        <Label>Script (reel)</Label>
                        <textarea value={editIdeaForm.script || ""} onChange={e => setEditIdeaForm(f => ({ ...f, script: e.target.value }))} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
                      </div>
                    )}
                    <div>
                      <Label>Visual brief</Label>
                      <textarea value={editIdeaForm.visual_brief || ""} onChange={e => setEditIdeaForm(f => ({ ...f, visual_brief: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={saveIdeaEdit} style={btnPrimary}>Guardar</button>
                      <button onClick={() => { setEditingIdeaId(null); setEditIdeaForm({}); }} style={btnGhost}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {idea.hook && (
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.lemon, marginBottom: 8, lineHeight: 1.3 }}>
                        “{idea.hook}”
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.5, whiteSpace: "pre-wrap", marginBottom: 8 }}>
                      {isExpanded ? idea.caption : captionShort}
                      {(idea.caption || "").length > 200 && (
                        <button onClick={() => setExpandedIdea(isExpanded ? null : idea.id)} style={{ marginLeft: 8, background: "none", border: "none", color: C.lemon, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0 }}>
                          {isExpanded ? "ver menos" : "ver más"}
                        </button>
                      )}
                    </div>

                    {idea.hashtags && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {idea.hashtags.split(/\s+/).filter(Boolean).map((h, i) => (
                          <span key={i} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "rgba(96,165,250,0.1)", color: "#93c5fd" }}>
                            #{h.replace(/^#/, "")}
                          </span>
                        ))}
                      </div>
                    )}

                    {isExpanded && idea.script && (
                      <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.7)", whiteSpace: "pre-wrap" }}>
                        <Label>Script reel</Label>
                        {idea.script}
                      </div>
                    )}
                    {isExpanded && (
                      <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(245,224,58,0.05)", border: "1px solid rgba(245,224,58,0.18)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                        <Label>Visual brief</Label>
                        {idea.visual_brief}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      {idea.status === "draft" && (
                        <>
                          <button onClick={() => approveIdea(idea.id)} style={btnAction}>✓ Aprobar</button>
                          <button onClick={() => { setEditingIdeaId(idea.id); setEditIdeaForm({ caption: idea.caption, hashtags: idea.hashtags, script: idea.script, visual_brief: idea.visual_brief }); }} style={btnGhost}>✏ Editar</button>
                          <button onClick={() => rejectIdea(idea.id)} style={btnDanger}>✕ Rechazar</button>
                        </>
                      )}
                      {idea.status === "approved" && (
                        <button onClick={() => openSchedule(idea)} style={btnAction}>📅 Programar</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================ QUEUE TAB ============================

function QueueTab({ scheduled, schedFilter, setSchedFilter, publishNow, cancelScheduled, retryScheduled, openEdit }) {
  const filters = ["all", "pending", "publishing", "published", "failed", "cancelled"];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {filters.map(f => (
          <button key={f} onClick={() => setSchedFilter(f)} style={{
            height: 28, padding: "0 12px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px",
            background: schedFilter === f ? "rgba(245,224,58,0.18)" : "rgba(255,255,255,0.05)",
            color: schedFilter === f ? C.lemon : "rgba(255,255,255,0.5)",
          }}>{f === "all" ? "Todos" : f}</button>
        ))}
      </div>

      {scheduled.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: C.ghost, fontSize: 13, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
          No hay posts programados con ese filtro.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {scheduled.map(p => (
            <div key={p.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <Badge map={KIND_BADGE} k={p.kind} />
                <Badge map={STATUS_BADGE} k={p.status} />
                {p.attempts > 0 && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#fca5a5", fontWeight: 700 }}>
                    intentos: {p.attempts}
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 11, color: C.ghost }}>
                  {formatARDate(p.scheduled_at)}
                </span>
              </div>

              {p.caption && (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.4, marginBottom: 8, whiteSpace: "pre-wrap" }}>
                  {p.caption.length > 280 ? `${p.caption.slice(0, 280)}…` : p.caption}
                </div>
              )}

              {p.media_urls && p.media_urls.length > 0 && (
                <div style={{ fontSize: 11, color: C.ghost, marginBottom: 8, fontFamily: "monospace" }}>
                  {p.media_urls.length} medio{p.media_urls.length === 1 ? "" : "s"} · {p.media_urls[0].slice(0, 60)}{p.media_urls[0].length > 60 ? "…" : ""}
                </div>
              )}

              {p.status === "failed" && p.last_error && (
                <div style={{ marginBottom: 8, padding: "8px 10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 11, color: "#fca5a5", fontFamily: "monospace" }}>
                  {p.last_error.slice(0, 200)}
                </div>
              )}

              {p.status === "published" && p.ig_media_id && (
                <div style={{ fontSize: 11, color: "#86efac", marginBottom: 8 }}>
                  IG media id: <code style={{ fontFamily: "monospace" }}>{p.ig_media_id}</code>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {p.status === "pending" && (
                  <>
                    <button onClick={() => openEdit(p)} style={btnGhost}>✏ Editar</button>
                    <button onClick={() => publishNow(p.id)} style={btnAction}>🚀 Publicar ahora</button>
                    <button onClick={() => cancelScheduled(p.id)} style={btnDanger}>✕ Cancelar</button>
                  </>
                )}
                {p.status === "publishing" && (
                  <span style={{ fontSize: 12, color: C.lemon, fontWeight: 700 }}>↻ Publicando…</span>
                )}
                {p.status === "failed" && (
                  <>
                    <button onClick={() => retryScheduled(p.id)} style={btnAction}>↻ Reintentar</button>
                    <button onClick={() => cancelScheduled(p.id)} style={btnDanger}>✕ Cancelar</button>
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

// ============================ CONVERSATIONS TAB ============================

function ConversationsTab({ conversations, activeConv, openConversation, toggleHandoff, closeConv }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: activeConv ? "1fr 1fr" : "1fr", gap: 14 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.faint}`, fontWeight: 800, fontSize: 13 }}>
          💬 Conversaciones
        </div>
        {conversations.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: C.ghost, fontSize: 13 }}>Sin conversaciones todavía.</div>
        ) : (
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {conversations.map(c => (
              <div
                key={c.sender_id}
                style={{
                  padding: "12px 14px", borderBottom: `1px solid ${C.faint}`,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  background: activeConv?.sender_id === c.sender_id ? "rgba(245,224,58,0.06)" : "transparent",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }} onClick={() => openConversation(c.sender_id)}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#fff" }}>
                    …{String(c.sender_id).slice(-8)}
                  </div>
                  <div style={{ fontSize: 11, color: C.ghost, marginTop: 2 }}>
                    último IN: {relativeTime(c.last_inbound_at)} · turnos: {c.turns ?? "?"}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleHandoff(c); }}
                  title={c.human_handoff ? "Handoff humano ON — click para devolver a IA" : "IA atendiendo — click para tomar conversación"}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                    background: c.human_handoff ? "#22c55e" : "rgba(255,255,255,0.12)",
                    position: "relative", transition: "background .2s",
                  }}>
                  <div style={{ position: "absolute", top: 2, left: c.human_handoff ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeConv && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 580 }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.faint}`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, fontWeight: 800, fontSize: 13, fontFamily: "monospace" }}>
              …{String(activeConv.sender_id).slice(-8)}
            </div>
            {activeConv.human_handoff && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "rgba(34,197,94,0.15)", color: "#86efac", fontWeight: 800 }}>HANDOFF</span>
            )}
            <button onClick={closeConv} style={btnGhost}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {(activeConv.history || []).length === 0 ? (
              <div style={{ color: C.ghost, fontSize: 13, textAlign: "center", padding: 24 }}>Sin historial.</div>
            ) : (
              activeConv.history.map((t, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: t.role === "user" ? "flex-start" : "flex-end", marginBottom: 8,
                }}>
                  <div style={{
                    maxWidth: "75%", padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.4, whiteSpace: "pre-wrap",
                    background: t.role === "user" ? "rgba(255,255,255,0.06)" : "rgba(245,224,58,0.1)",
                    color: t.role === "user" ? "#fff" : "#fffbea",
                    border: t.role === "user" ? `1px solid ${C.faint}` : "1px solid rgba(245,224,58,0.2)",
                  }}>
                    {t.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================ INSIGHTS TAB ============================

function InsightsTab({ insights }) {
  const cards = [
    { icon: "💡", label: "Ideas en borrador", value: insights.draftIdeas, hint: "esperando aprobación" },
    { icon: "📅", label: "Programados pendientes", value: insights.pendingPosts, hint: "se publicarán en su horario" },
    { icon: "🚀", label: "Publicados (30 días)", value: insights.publishedRecent, hint: "vía esta cola" },
    { icon: "💬", label: "Conversaciones activas (24h)", value: insights.activeConvs, hint: "con inbound reciente" },
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1, color: C.lemon }}>{c.value}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>{c.label}</div>
            <div style={{ fontSize: 10, color: C.ghost, marginTop: 4 }}>{c.hint}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, padding: "14px 18px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 14, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
        Próximamente: insights detallados con Meta Insights API (alcance, impresiones, engagement por post).
      </div>
    </div>
  );
}

// ============================ MODALS ============================

function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20, zIndex: 9999,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#0b1020", border: `1px solid ${C.border}`, borderRadius: 16,
        padding: 22, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
      }}>
        {children}
      </div>
    </div>
  );
}

// Qué medios admite cada kind. carousel = mixed (image+video), el resto es estricto.
const MEDIA_RULES = {
  image:        { accept: "image/*",        label: "imagen",       expects: "image" },
  reel:         { accept: "video/*",        label: "video",        expects: "video" },
  carousel:     { accept: "image/*,video/*",label: "imagen/video", expects: "mixed" },
  story_image:  { accept: "image/*",        label: "imagen",       expects: "image" },
  story_video:  { accept: "video/*",        label: "video",        expects: "video" },
};

function fileMatchesKind(file, kind) {
  const rule = MEDIA_RULES[kind];
  if (!rule) return true;
  if (rule.expects === "image") return file.type.startsWith("image/");
  if (rule.expects === "video") return file.type.startsWith("video/");
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

function ScheduleModalInner({ idea, onClose, onSubmit }) {
  // Defaults: kind=image (post→image, reel→reel, carousel→carousel, story→story_image)
  const defaultKind =
    idea.kind === "post"     ? "image"      :
    idea.kind === "reel"     ? "reel"       :
    idea.kind === "carousel" ? "carousel"   :
    idea.kind === "story"    ? "story_image": "image";

  const [kind, setKind] = useState(defaultKind);
  const [caption, setCaption] = useState(buildCaptionWithHashtags(idea));
  const [mediaUrlsText, setMediaUrlsText] = useState("");
  const [scheduledAt, setScheduledAt] = useState(isoForDatetimeLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString()));
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { current, total } o null
  const [generating, setGenerating] = useState(false);          // mientras corre el image-gen
  const [buildingPrompt, setBuildingPrompt] = useState(false);  // mientras Claude arma el prompt
  const [promptDraft, setPromptDraft] = useState("");           // prompt editable
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [imageEngine, setImageEngine] = useState("openai"); // "openai" (gpt-image-1) | "nano" (Gemini 2.5 Flash Image)
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewSize, setPreviewSize] = useState("");
  const [templates, setTemplates] = useState([]);
  const [mascots, setMascots] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateFields, setTemplateFields] = useState({});
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [templatePreviewUrl, setTemplatePreviewUrl] = useState("");

  function buildCaptionWithHashtags(i) {
    if (!i) return "";
    const cap = i.caption || "";
    if (i.hashtags && !cap.includes("#")) {
      const tags = i.hashtags.split(/\s+/).filter(Boolean).map(t => `#${t.replace(/^#/, "")}`).join(" ");
      return `${cap}\n\n${tags}`;
    }
    return cap;
  }

  async function submit() {
    const urls = mediaUrlsText.split("\n").map(s => s.trim()).filter(Boolean);
    if (urls.length === 0) return alert("Pegá al menos una URL HTTPS pública (Cloudinary, S3, etc.).");
    if (!scheduledAt) return alert("Elegí una fecha y hora.");
    const VIDEO_KINDS = new Set(["reel", "story_video"]);
    const IMAGE_KINDS = new Set(["image", "carousel", "story_image"]);
    const isImg = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i;
    const isVid = /\.(mp4|mov|webm|m4v)(\?|$)/i;
    if (VIDEO_KINDS.has(kind) && isImg.test(urls[0])) {
      return alert(`Tipo "${kind}" requiere video pero subiste una imagen. Cambiá a "Imagen (feed)" o "Story imagen".`);
    }
    if (IMAGE_KINDS.has(kind) && isVid.test(urls[0])) {
      return alert(`Tipo "${kind}" requiere imagen pero subiste un video. Cambiá a "Reel" o "Story video".`);
    }
    setSubmitting(true);
    await onSubmit({
      idea_id: idea.id,
      kind,
      caption,
      media_urls: urls,
      scheduled_at: new Date(scheduledAt).toISOString(),
    });
    setSubmitting(false);
  }

  return (
    <>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>📅 Programar publicación</div>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <Label>Tipo</Label>
          <select value={kind} onChange={e => setKind(e.target.value)} style={inputStyle}>
            <option value="image">Imagen (feed)</option>
            <option value="reel">Reel</option>
            <option value="carousel">Carousel (2-10 medios)</option>
            <option value="story_image">Story imagen</option>
            <option value="story_video">Story video</option>
          </select>
        </div>
        <div>
          <Label>Caption</Label>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div>
          <Label>Medios</Label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept={MEDIA_RULES[kind]?.accept || "image/*,video/*"}
              multiple={kind === "carousel"}
              style={{ display: "none" }}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = "";
                if (files.length === 0) return;
                // Validar todos antes de empezar a subir
                for (const f of files) {
                  if (!fileMatchesKind(f, kind)) {
                    alert(`"${f.name}" no es ${MEDIA_RULES[kind].label} (es ${f.type || "desconocido"}). Cancelado.`);
                    return;
                  }
                }
                // Carousel: respeta tope de 10 medios totales
                if (kind === "carousel") {
                  const existing = mediaUrlsText.split("\n").filter(s => s.trim()).length;
                  if (existing + files.length > 10) {
                    alert(`Carousel admite hasta 10 medios. Ya tenés ${existing}, intentás sumar ${files.length}.`);
                    return;
                  }
                }
                setUploading(true);
                setUploadProgress({ current: 0, total: files.length });
                const uploadedUrls = [];
                try {
                  for (let i = 0; i < files.length; i++) {
                    setUploadProgress({ current: i + 1, total: files.length });
                    const fd = new FormData();
                    fd.append("file", files[i]);
                    const res = await fetch(`${API}/api/instagram-content/media/upload`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${getToken()}` },
                      body: fd,
                    });
                    const data = await res.json();
                    if (!res.ok || !data.url) throw new Error(data.error || `Error subiendo "${files[i].name}"`);
                    uploadedUrls.push(data.url);
                  }
                  if (uploadedUrls.length > 0) {
                    setMediaUrlsText(prev => {
                      const newLines = uploadedUrls.join("\n");
                      return prev ? prev.trimEnd() + "\n" + newLines : newLines;
                    });
                  }
                } catch (err) {
                  // Mantener lo que se subió antes del error en mediaUrlsText
                  if (uploadedUrls.length > 0) {
                    setMediaUrlsText(prev => {
                      const newLines = uploadedUrls.join("\n");
                      return prev ? prev.trimEnd() + "\n" + newLines : newLines;
                    });
                  }
                  alert("Falló la subida: " + (err.message || err));
                } finally {
                  setUploading(false);
                  setUploadProgress(null);
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || generating}
              style={{ ...btnPrimary, opacity: (uploading || generating) ? 0.6 : 1 }}
            >
              {uploading
                ? (uploadProgress ? `Subiendo ${uploadProgress.current}/${uploadProgress.total}…` : "Subiendo…")
                : (kind === "carousel" ? "📤 Subir medios (varios)" : "📤 Subir imagen/video")}
            </button>
            <button
              type="button"
              disabled={generating || uploading || buildingPrompt || MEDIA_RULES[kind]?.expects === "video"}
              title={MEDIA_RULES[kind]?.expects === "video" ? "La IA solo genera imágenes — no aplica a kind de video" : ""}
              onClick={async () => {
                if (!idea?.id) return alert("Falta idea_id");
                setBuildingPrompt(true);
                try {
                  const data = await api(`/api/instagram-content/ideas/${idea.id}/build-image-prompt`, {
                    method: "POST",
                    body: { kind },
                  });
                  if (!data?.prompt) throw new Error("No se generó prompt");
                  setPromptDraft(data.prompt);
                  setShowPromptEditor(true);
                } catch (err) {
                  alert("Falló armar prompt: " + (err.message || err));
                } finally {
                  setBuildingPrompt(false);
                }
              }}
              style={{ ...btnPrimary, opacity: (generating || uploading || buildingPrompt || MEDIA_RULES[kind]?.expects === "video") ? 0.6 : 1 }}
            >
              {buildingPrompt ? "Armando prompt…" : "🎨 Generar con IA"}
            </button>
            <button
              type="button"
              disabled={uploading || generating || buildingPrompt || rendering || MEDIA_RULES[kind]?.expects === "video"}
              title={MEDIA_RULES[kind]?.expects === "video" ? "Los templates rinden imagen — no aplica a kind de video" : ""}
              onClick={async () => {
                if (templates.length === 0) {
                  try {
                    const data = await api(`/api/instagram-content/templates`);
                    setTemplates(data.templates || []);
                  } catch (e) { return alert("No se pudieron cargar los templates: " + e.message); }
                }
                if (mascots.length === 0) {
                  try {
                    const data = await api(`/api/instagram-content/mascots`);
                    setMascots(data.mascots || []);
                  } catch (e) {
                    console.warn("No se pudieron cargar las mascotas:", e.message);
                    // No bloquea la UI: el form va a fallback a inputs de texto si mascots está vacío.
                  }
                }
                setShowTemplatePicker(true);
              }}
              style={{ ...btnPrimary, opacity: (rendering || MEDIA_RULES[kind]?.expects === "video") ? 0.6 : 1 }}
            >
              🧱 Usar template
            </button>
            <span style={{ fontSize: 11, color: C.ghost }}>
              {MEDIA_RULES[kind]?.expects === "video"
                ? "Reel/story video: subí un archivo de video o pegá URL"
                : "o subí archivo / pegá URLs / generá con IA / usá template"}
            </span>
          </div>
          <textarea
            value={mediaUrlsText}
            onChange={e => setMediaUrlsText(e.target.value)}
            rows={3}
            placeholder="https://res.cloudinary.com/.../mi-imagen.jpg"
            style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 11 }}
          />
          <div style={{ fontSize: 10, color: C.ghost, marginTop: 4, display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>Una URL por línea. carousel = 2 a 10; otros = 1.</span>
            {(() => {
              const count = mediaUrlsText.split("\n").filter(s => s.trim()).length;
              if (kind === "carousel") {
                const ok = count >= 2 && count <= 10;
                return <span style={{ color: ok ? "#86efac" : (count > 10 ? "#fca5a5" : C.ghost) }}>{count}/10 medios</span>;
              }
              if (count > 0) return <span style={{ color: count === 1 ? "#86efac" : "#fca5a5" }}>{count} URL{count === 1 ? "" : "s"}</span>;
              return null;
            })()}
          </div>
        </div>
        <div>
          <Label>Cuándo publicar</Label>
          <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={submit} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Programando…" : "✓ Programar"}
          </button>
          <button onClick={onClose} style={btnGhost}>Cancelar</button>
        </div>
      </div>
      {showPromptEditor && (
        <div style={{
          marginTop: 16,
          padding: 12,
          background: "rgba(250,204,21,0.08)",
          border: "1px solid rgba(250,204,21,0.3)",
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>📝 Prompt para la IA (revisalo y editalo si querés)</div>
          <textarea
            value={promptDraft}
            onChange={e => setPromptDraft(e.target.value)}
            rows={12}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 11 }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.ghost, fontWeight: 700 }}>Motor:</span>
            <select
              value={imageEngine}
              onChange={e => setImageEngine(e.target.value)}
              disabled={generating}
              style={{ ...inputStyle, padding: "4px 8px", fontSize: 11, width: "auto", minWidth: 280 }}
            >
              <option value="openai">OpenAI gpt-image-1 (~$0.17, calidad alta)</option>
              <option value="nano">🍌 Google Nano Banana (~$0.04, rápido)</option>
              <option value="flux">🎨 Replicate Flux 1.1 Pro (~$0.04, layouts custom)</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              disabled={generating}
              onClick={async () => {
                if (!idea?.id) return;
                if (promptDraft.trim().length < 50) return alert("El prompt está muy corto.");
                setGenerating(true);
                setPreviewUrl(""); // limpiar preview previo
                try {
                  const ep = imageEngine === "nano" ? "generate-image-nano"
                           : imageEngine === "flux" ? "generate-image-flux"
                           : "generate-image";
                  const data = await api(`/api/instagram-content/ideas/${idea.id}/${ep}`, {
                    method: "POST",
                    body: { kind, prompt_override: promptDraft },
                  });
                  if (!data?.url) throw new Error("No se generó imagen");
                  setPreviewUrl(data.url);
                  setPreviewSize(data.size || "");
                } catch (err) {
                  alert("Falló la generación: " + (err.message || err));
                } finally {
                  setGenerating(false);
                }
              }}
              style={{ ...btnPrimary, opacity: generating ? 0.6 : 1 }}
            >
              {generating ? "Generando imagen…" : "✓ Generar imagen con este prompt"}
            </button>
            <button
              type="button"
              onClick={() => { setShowPromptEditor(false); setPromptDraft(""); setPreviewUrl(""); setPreviewSize(""); }}
              disabled={generating}
              style={btnGhost}
            >
              Cancelar
            </button>
          </div>
          <div style={{ fontSize: 10, color: C.ghost, marginTop: 6 }}>
            El prompt fue armado por Claude usando la guía de marca + tu idea. Editar acá te deja afinar antes de pagar la generación (~{imageEngine === "nano" ? "$0.04" : imageEngine === "flux" ? "$0.04" : "$0.17"} USD con {imageEngine === "nano" ? "Nano Banana" : imageEngine === "flux" ? "Flux 1.1 Pro" : "gpt-image-1"}).
          </div>
          {previewUrl && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(250,204,21,0.3)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>🖼 Preview de la imagen generada</div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 480,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "#000",
                    objectFit: "contain",
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: C.ghost, textAlign: "center", marginBottom: 10 }}>
                Tamaño: {previewSize || "-"} · {previewUrl}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setMediaUrlsText(prev => (prev ? prev.trimEnd() + "\n" + previewUrl : previewUrl));
                    setShowPromptEditor(false);
                    setPromptDraft("");
                    setPreviewUrl("");
                    setPreviewSize("");
                  }}
                  style={btnPrimary}
                >
                  ✓ Usar esta imagen
                </button>
                <button
                  type="button"
                  disabled={generating}
                  onClick={async () => {
                    if (!idea?.id) return;
                    setGenerating(true);
                    setPreviewUrl("");
                    try {
                      const ep = imageEngine === "nano" ? "generate-image-nano"
                               : imageEngine === "flux" ? "generate-image-flux"
                               : "generate-image";
                      const data = await api(`/api/instagram-content/ideas/${idea.id}/${ep}`, {
                        method: "POST",
                        body: { kind, prompt_override: promptDraft },
                      });
                      if (!data?.url) throw new Error("No se generó imagen");
                      setPreviewUrl(data.url);
                      setPreviewSize(data.size || "");
                    } catch (err) {
                      alert("Falló la regeneración: " + (err.message || err));
                    } finally {
                      setGenerating(false);
                    }
                  }}
                  style={{ ...btnGhost, opacity: generating ? 0.6 : 1 }}
                >
                  {generating ? "Generando…" : "🔄 Generar otra (mismo prompt)"}
                </button>
                <button
                  type="button"
                  onClick={() => { setPreviewUrl(""); setPreviewSize(""); }}
                  style={btnGhost}
                >
                  ✏ Volver a editar prompt
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {showTemplatePicker && (
        <div style={{
          marginTop: 16, padding: 12,
          background: "rgba(45,75,255,0.08)",
          border: "1px solid rgba(45,75,255,0.3)",
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>🧱 Templates de marca</div>

          {!selectedTemplate ? (
            <div style={{ display: "grid", gap: 8 }}>
              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(t);
                    const def = {};
                    for (const f of t.fields) def[f.name] = f.default || "";
                    setTemplateFields(def);
                  }}
                  style={{ ...btnGhost, textAlign: "left", padding: 10 }}
                >
                  <div style={{ fontWeight: 700 }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: C.ghost }}>{t.description}</div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{selectedTemplate.label}</div>
              {selectedTemplate.fields.map(f => (
                <div key={f.name}>
                  <Label>{f.label}</Label>
                  {f.type === "mascot" && mascots.length > 0 ? (
                    <div style={{
                      display:"grid",
                      gridTemplateColumns:"repeat(auto-fill, minmax(72px, 1fr))",
                      gap:6,
                      maxHeight:260,
                      overflowY:"auto",
                      padding:4,
                      background:"#fff",
                      border:"1px solid #eee",
                      borderRadius:8,
                    }}>
                      {/* Opción "sin mascot" sólo si el default del field es vacío (caso tip_del_dia) */}
                      {f.default === "" && (
                        <button
                          type="button"
                          onClick={() => setTemplateFields(prev => ({ ...prev, [f.name]: "" }))}
                          style={{
                            height:88, border: (templateFields[f.name] || "") === "" ? "3px solid #FFC700" : "2px solid #ddd",
                            borderRadius:8, background:"#fafafa", cursor:"pointer", padding:0, fontSize:11, color:"#666",
                            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                          }}
                          title="Sin mascota"
                        >
                          <div style={{ fontSize:22, lineHeight:1 }}>∅</div>
                          <div style={{ fontSize:9, marginTop:4 }}>sin mascota</div>
                        </button>
                      )}
                      {mascots.map(m => (
                        <button
                          key={m.slug}
                          type="button"
                          onClick={() => setTemplateFields(prev => ({ ...prev, [f.name]: m.slug }))}
                          style={{
                            height:88,
                            border: (templateFields[f.name] || f.default) === m.slug ? "3px solid #FFC700" : "2px solid #ddd",
                            borderRadius:8, background:"#fff", cursor:"pointer", padding:0, overflow:"hidden",
                            display:"flex", flexDirection:"column",
                          }}
                          title={m.label}
                        >
                          <img src={m.thumb_url} alt={m.label} style={{ width:"100%", height:64, objectFit:"contain", flex:"0 0 auto" }} />
                          <div style={{ fontSize:9, padding:"2px 4px", color:"#444", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", textAlign:"center" }}>{m.label}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={templateFields[f.name] || ""}
                      onChange={e => setTemplateFields(prev => ({ ...prev, [f.name]: e.target.value }))}
                      maxLength={f.maxLen || 200}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={rendering}
                  onClick={async () => {
                    setRendering(true);
                    setTemplatePreviewUrl("");
                    try {
                      const data = await api(`/api/instagram-content/templates/${selectedTemplate.id}/render`, {
                        method: "POST",
                        body: { fields: templateFields },
                      });
                      if (!data?.url) throw new Error("No se renderizó");
                      setTemplatePreviewUrl(data.url);
                      if (data.recommended_kind) setKind(data.recommended_kind);
                    } catch (err) {
                      alert("Falló render: " + (err.message || err));
                    } finally {
                      setRendering(false);
                    }
                  }}
                  style={{ ...btnPrimary, opacity: rendering ? 0.6 : 1 }}
                >
                  {rendering ? "Renderizando…" : "🖼 Renderizar"}
                </button>
                <button type="button" onClick={() => { setSelectedTemplate(null); setTemplateFields({}); setTemplatePreviewUrl(""); }} style={btnGhost}>← Volver</button>
              </div>

              {templatePreviewUrl && (
                <div style={{ marginTop: 10 }}>
                  <img src={templatePreviewUrl} alt="preview" style={{ maxWidth: "100%", maxHeight: 480, borderRadius: 8 }} />
                  <div style={{ fontSize: 10, color: C.ghost, textAlign: "center", marginTop: 4 }}>{templatePreviewUrl}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setMediaUrlsText(prev => (prev ? prev.trimEnd() + "\n" + templatePreviewUrl : templatePreviewUrl));
                        setShowTemplatePicker(false);
                        setSelectedTemplate(null);
                        setTemplateFields({});
                        setTemplatePreviewUrl("");
                      }}
                      style={btnPrimary}
                    >
                      ✓ Usar esta imagen
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplatePreviewUrl("")}
                      style={btnGhost}
                    >
                      ✏ Volver a editar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => { setShowTemplatePicker(false); setSelectedTemplate(null); setTemplateFields({}); setTemplatePreviewUrl(""); }}
              style={btnGhost}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function EditScheduledModal({ state, setState, onSave }) {
  return (
    <Modal onClose={() => setState(null)}>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>✏ Editar post programado</div>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <Label>Caption</Label>
          <textarea value={state.caption} onChange={e => setState(s => ({ ...s, caption: e.target.value }))} rows={5} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div>
          <Label>URLs (una por línea)</Label>
          <textarea value={state.media_urls} onChange={e => setState(s => ({ ...s, media_urls: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 11 }} />
        </div>
        <div>
          <Label>Cuándo</Label>
          <input type="datetime-local" value={state.scheduled_at} onChange={e => setState(s => ({ ...s, scheduled_at: e.target.value }))} style={inputStyle} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSave} style={btnPrimary}>Guardar</button>
          <button onClick={() => setState(null)} style={btnGhost}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ✨ FRAMEWORKS TAB — Generación con clawfu-skills
// ─────────────────────────────────────────────────────────────────────────────

function copyToClipboard(text, onDone) {
  try {
    navigator.clipboard.writeText(String(text || ""));
    if (onDone) onDone();
  } catch (e) { console.error("[copy]", e.message); }
}

function FrameworksTab() {
  const [form, setForm] = useState({
    objetivo: "",
    tono: "argentino cercano profesional",
    formato: "post",
    audiencia: "emprendedores que importan productos a Argentina",
    producto: "Lemon's Logística — courier puerta a puerta desde China/USA/Europa",
  });
  const [allSkills, setAllSkills] = useState([]);
  const [forcedSkills, setForcedSkills] = useState([]); // array of names
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [skillFilter, setSkillFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [savingIdea, setSavingIdea] = useState(false);
  const [savedIdeaId, setSavedIdeaId] = useState(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/instagram-content/skills?lang=es`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(d => setAllSkills(d?.skills || []))
      .catch(() => {});
  }, []);

  async function saveAsIdea() {
    if (!result?.generated) return;
    setSavingIdea(true);
    setSaveError("");
    try {
      const r = await fetch(`${API}/api/instagram-content/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          kind: form.formato,
          generated: result.generated,
          frameworks_used: (result.skills_used || []).map(s => s.name_es || s.name),
          source: "frameworks_tab",
        }),
      });
      const d = await r.json();
      if (!r.ok) { setSaveError(d?.error || "Error al guardar"); return; }
      setSavedIdeaId(d?.row?.id || null);
    } catch { setSaveError("Error de red"); }
    finally { setSavingIdea(false); }
  }

  const filteredSkills = useMemo(() => {
    const q = skillFilter.trim().toLowerCase();
    if (!q) return allSkills.slice(0, 60);
    return allSkills.filter(s =>
      (s.name_es || s.name).toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.category_es || s.category).toLowerCase().includes(q) ||
      (s.description_es || s.description || "").toLowerCase().includes(q)
    ).slice(0, 60);
  }, [allSkills, skillFilter]);

  function toggleSkill(name) {
    setForcedSkills(s => s.includes(name) ? s.filter(n => n !== name) : (s.length >= 5 ? s : [...s, name]));
  }

  async function generate() {
    if (!form.objetivo.trim()) { setError("Ingresá un objetivo"); return; }
    setError("");
    setLoading(true);
    setResult(null);
    setSavedIdeaId(null);
    setSaveError("");
    try {
      const body = { ...form, lang: "es" };
      if (forcedSkills.length) body.skill_names = forcedSkills;
      const r = await fetch(`${API}/api/instagram-content/generate-skill-driven`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setError(d?.error || "Error al generar"); return; }
      setResult(d);
    } catch (e) { setError("Error de red"); }
    finally { setLoading(false); }
  }

  function flash(key) {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(c => c === key ? null : c), 1200);
  }

  const g = result?.generated || {};
  const isRaw = !!g.raw && !g.hook;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: "linear-gradient(135deg,rgba(245,224,58,0.08),rgba(255,85,0,0.04))",
        border: "1px solid rgba(245,224,58,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: "1.5px", padding: "2px 8px",
            borderRadius: 6, background: "#f5e03a", color: "#0b1020",
          }}>NUEVO</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>✨ Generador con frameworks expertos</span>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
          Usa la biblioteca clawfu-skills (173 frameworks de marketing) para guiar a Claude en la generación. El sistema elige automáticamente los frameworks más relevantes para tu objetivo, o forzá los que quieras desde el selector.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
        <div>
          <Label>Objetivo *</Label>
          <textarea
            value={form.objetivo}
            onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}
            placeholder="Ej: post para anunciar nueva ruta de courier desde Yiwu con tiempos reducidos"
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <Label>Formato</Label>
            <select value={form.formato} onChange={e => setForm(f => ({ ...f, formato: e.target.value }))} style={inputStyle}>
              <option value="post">📷 Post</option>
              <option value="story">📱 Story</option>
              <option value="carrusel">🎠 Carrusel</option>
              <option value="reel">🎬 Reel</option>
            </select>
          </div>
          <div>
            <Label>Tono</Label>
            <input value={form.tono} onChange={e => setForm(f => ({ ...f, tono: e.target.value }))} style={inputStyle} />
          </div>
        </div>
        <div>
          <Label>Audiencia</Label>
          <input value={form.audiencia} onChange={e => setForm(f => ({ ...f, audiencia: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <Label>Producto / contexto</Label>
          <input value={form.producto} onChange={e => setForm(f => ({ ...f, producto: e.target.value }))} style={inputStyle} />
        </div>

        <div>
          <button
            onClick={() => setSkillsExpanded(s => !s)}
            style={{ ...btnGhost, width: "100%", height: 36, textAlign: "left", padding: "0 12px" }}
          >
            {skillsExpanded ? "▾" : "▸"} Forzar skills específicos ({forcedSkills.length} elegidos · max 5) — opcional, sino se eligen automáticamente
          </button>
          {skillsExpanded && (
            <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.25)", border: `1px solid ${C.border}` }}>
              <input
                placeholder="Buscar por nombre, categoría, descripción…"
                value={skillFilter}
                onChange={e => setSkillFilter(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
              <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredSkills.map(s => {
                  const checked = forcedSkills.includes(s.name);
                  const dispName = s.name_es || s.name;
                  const dispCat = (s.category_es || s.category).replace(/^skills\//i, "");
                  const dispDesc = s.description_es || s.description || "";
                  return (
                    <label key={s.name} style={{
                      display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px", borderRadius: 6,
                      background: checked ? "rgba(245,224,58,0.08)" : "transparent",
                      cursor: "pointer", fontSize: 11,
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSkill(s.name)} style={{ marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: "#fff" }}>{dispName} <span style={{ fontWeight: 400, opacity: 0.5, fontSize: 10 }}>· {dispCat}</span></div>
                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 2, lineHeight: 1.3 }}>{dispDesc.slice(0, 200)}{dispDesc.length > 200 ? "…" : ""}</div>
                      </div>
                    </label>
                  );
                })}
                {!filteredSkills.length && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", padding: 8 }}>No hay skills que coincidan</div>}
              </div>
            </div>
          )}
        </div>

        {error && <div style={{ padding: 10, borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 12 }}>{error}</div>}

        <button onClick={generate} disabled={loading || !form.objetivo.trim()} style={{ ...btnPrimary, height: 44, opacity: (loading || !form.objetivo.trim()) ? 0.5 : 1 }}>
          {loading ? "✨ Generando con Claude…" : "✨ Generar con frameworks expertos"}
        </button>
      </div>

      {result && (
        <div style={{ padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245,224,58,0.2)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 700 }}>Resultado</div>

          {result.warning && (
            <div style={{ padding: 8, borderRadius: 6, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", fontSize: 11 }}>⚠ {result.warning}</div>
          )}

          {isRaw ? (
            <div>
              <Label>Output crudo (Claude no devolvió JSON)</Label>
              <textarea readOnly value={g.raw} rows={8} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 11, resize: "vertical" }} />
            </div>
          ) : (
            <>
              {g.hook && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <Label>Hook</Label>
                    <button onClick={() => { copyToClipboard(g.hook); flash("hook"); }} style={btnGhost}>{copiedKey === "hook" ? "✓ copiado" : "📋 copiar"}</button>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.35, padding: 12, borderRadius: 8, background: "rgba(245,224,58,0.06)", border: "1px solid rgba(245,224,58,0.2)" }}>{g.hook}</div>
                </div>
              )}

              {g.caption && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <Label>Caption</Label>
                    <button onClick={() => { copyToClipboard(g.caption); flash("caption"); }} style={btnGhost}>{copiedKey === "caption" ? "✓ copiado" : "📋 copiar"}</button>
                  </div>
                  <textarea readOnly value={g.caption} rows={6} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
              )}

              {Array.isArray(g.hashtags) && g.hashtags.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <Label>Hashtags</Label>
                    <button onClick={() => { copyToClipboard(g.hashtags.map(h => `#${String(h).replace(/^#/, "")}`).join(" ")); flash("hashtags"); }} style={btnGhost}>{copiedKey === "hashtags" ? "✓ copiados" : "📋 copiar todos"}</button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {g.hashtags.map((h, i) => {
                      const tag = `#${String(h).replace(/^#/, "")}`;
                      return (
                        <span key={i} onClick={() => { copyToClipboard(tag); flash(`tag-${i}`); }}
                          style={{ padding: "4px 10px", borderRadius: 999, background: copiedKey === `tag-${i}` ? "rgba(34,197,94,0.2)" : "rgba(99,102,241,0.12)", border: `1px solid ${copiedKey === `tag-${i}` ? "rgba(34,197,94,0.4)" : "rgba(99,102,241,0.3)"}`, color: copiedKey === `tag-${i}` ? "#86efac" : "#a5b4fc", fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {g.cta && (
                <div>
                  <Label>CTA</Label>
                  <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: 8, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac", fontSize: 12, fontWeight: 700 }}>{g.cta}</span>
                </div>
              )}

              {g.visual_brief && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <Label>Visual brief (para diseñar la imagen)</Label>
                    <button onClick={() => { copyToClipboard(g.visual_brief); flash("vb"); }} style={btnGhost}>{copiedKey === "vb" ? "✓ copiado" : "📋 copiar"}</button>
                  </div>
                  <div style={{ padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.25)", border: `1px solid ${C.border}`, fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, fontStyle: "italic" }}>{g.visual_brief}</div>
                </div>
              )}
            </>
          )}

          <div>
            <Label>Frameworks aplicados</Label>
            <SkillBadges skills={result.skills_used} />
          </div>

          {!isRaw && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4, borderTop: `1px dashed ${C.border}` }}>
              {saveError && <div style={{ padding: 8, borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 11 }}>{saveError}</div>}
              {savedIdeaId ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.35)" }}>
                  <div style={{ fontSize: 12, color: "#86efac", fontWeight: 700 }}>✓ Guardado como idea #{savedIdeaId} (estado: draft). Andá a "Drafts" para aprobar y programar.</div>
                  <button onClick={() => { setSavedIdeaId(null); }} style={{ ...btnGhost, fontSize: 11 }}>↻ Guardar otra vez</button>
                </div>
              ) : (
                <button onClick={saveAsIdea} disabled={savingIdea} style={{ ...btnPrimary, height: 40, opacity: savingIdea ? 0.5 : 1 }}>
                  {savingIdea ? "💾 Guardando…" : "💾 Guardar como idea (entra al flujo de aprobación)"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
