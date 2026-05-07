// client/src/pages/AdminPanel.jsx
//
// Panel admin post-wizard. Spec § 9.
// Tabs: Coins / Feed / Settings (re-abre el wizard por sección).

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBranding } from "../lib/branding.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
const authHdr = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHdr = () => ({ ...authHdr(), "Content-Type": "application/json" });

const styles = {
  shell: {
    minHeight: "100vh",
    background: "var(--brand-bg, #080808)",
    color: "var(--brand-text, #ede9e0)",
    fontFamily: "var(--brand-font, Inter, sans-serif)",
    padding: "32px 16px",
  },
  container: { maxWidth: 1100, margin: "0 auto" },
  h1: { fontSize: 26, fontWeight: 800, margin: "0 0 6px 0" },
  sub: { color: "rgba(237,233,224,.55)", marginBottom: 22, fontSize: 14 },
  tabs: { display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid rgba(255,255,255,.08)" },
  tab: (active) => ({
    padding: "10px 18px",
    cursor: "pointer",
    fontSize: 13, fontWeight: 700, letterSpacing: 0.5,
    color: active ? "var(--brand-primary, #3B82F6)" : "rgba(237,233,224,.55)",
    background: "transparent",
    border: "none", borderBottom: active ? "2px solid var(--brand-primary, #3B82F6)" : "2px solid transparent",
    fontFamily: "inherit", marginBottom: -1,
  }),
  card: {
    padding: 20, marginBottom: 16,
    background: "rgba(255,255,255,.02)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 10,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(237,233,224,.4)", borderBottom: "1px solid rgba(255,255,255,.08)" },
  td: { padding: "12px", borderBottom: "1px solid rgba(255,255,255,.04)" },
  btn: (primary = false, danger = false) => ({
    padding: "8px 14px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    fontSize: 12, fontWeight: 700,
    background: danger ? "rgba(239,68,68,.15)" : primary ? "var(--brand-primary, #3B82F6)" : "rgba(255,255,255,.06)",
    color: danger ? "#fca5a5" : primary ? "#fff" : "rgba(237,233,224,.85)",
    fontFamily: "inherit",
  }),
  input: {
    width: "100%", padding: "9px 11px", fontSize: 13,
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 6, color: "inherit", fontFamily: "inherit",
    boxSizing: "border-box",
  },
  label: { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(237,233,224,.45)", marginBottom: 5, marginTop: 12 },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", zIndex: 9000 },
  modalCard: { background: "#0e0f15", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 420 },
};

export default function AdminPanel() {
  const [tab, setTab] = useState("coins");
  return (
    <div style={styles.shell}>
      <div style={styles.container}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={styles.h1}>Panel admin</h1>
            <div style={styles.sub}>Gestionar coins, feed y configuración del portal.</div>
          </div>
          <Link to="/inicio" style={{ ...styles.btn(), textDecoration: "none", display: "inline-block" }}>← Volver al inicio</Link>
        </div>

        <div style={styles.tabs}>
          <button style={styles.tab(tab === "coins")}    onClick={() => setTab("coins")}>🪙 Coins</button>
          <button style={styles.tab(tab === "feed")}     onClick={() => setTab("feed")}>📰 Feed</button>
          <button style={styles.tab(tab === "branding")} onClick={() => setTab("branding")}>🎨 Branding</button>
          <button style={styles.tab(tab === "settings")} onClick={() => setTab("settings")}>⚙️ Configuración</button>
        </div>

        {tab === "coins"    && <CoinsTab />}
        {tab === "feed"     && <FeedTab />}
        {tab === "branding" && <BrandingTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

// ── Tab: Coins ──────────────────────────────────────────────────────────────
function CoinsTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);  // { user, action: 'gift' | 'adjust' }

  async function load() {
    setLoading(true);
    const url = `${API}/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`;
    const r = await fetch(url, { headers: authHdr() });
    const d = await r.json();
    setUsers(d.users || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div>
      <div style={styles.card}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input style={{ ...styles.input, maxWidth: 320 }} placeholder="Buscar por nombre o email…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") load(); }} />
          <button style={styles.btn()} onClick={load}>Buscar</button>
        </div>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Nombre</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Balance</th>
              <th style={styles.th}>Total ganado</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td style={styles.td} colSpan={7}>Cargando…</td></tr>}
            {!loading && users.length === 0 && <tr><td style={styles.td} colSpan={7}>(sin users)</td></tr>}
            {users.map(u => (
              <tr key={u.id}>
                <td style={styles.td}>{u.id}</td>
                <td style={styles.td}>{u.name}</td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}><Pill>{u.role}</Pill></td>
                <td style={{ ...styles.td, fontWeight: 700, color: "var(--brand-primary, #3B82F6)" }}>{u.balance}</td>
                <td style={styles.td}>{u.total_earned}</td>
                <td style={styles.td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={styles.btn()} onClick={() => setModal({ user: u, action: "gift" })}>+ Regalar</button>
                    <button style={styles.btn()} onClick={() => setModal({ user: u, action: "adjust" })}>Ajustar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <CoinModal modal={modal} onClose={() => setModal(null)} onSuccess={() => { setModal(null); load(); }} />}
    </div>
  );
}

function CoinModal({ modal, onClose, onSuccess }) {
  const { user, action } = modal;
  const [amount, setAmount] = useState(action === "gift" ? "100" : "0");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr(""); setSubmitting(true);
    try {
      const r = await fetch(`${API}/admin/users/${user.id}/coins`, {
        method: "POST", headers: jsonHdr(),
        body: JSON.stringify({ action, amount: parseInt(amount, 10) || 0, reason: reason || (action === "gift" ? "Regalo del admin" : "Ajuste manual") }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Error"); setSubmitting(false); return; }
      onSuccess();
    } catch {
      setErr("Error de red"); setSubmitting(false);
    }
  }

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{action === "gift" ? "Regalar coins" : "Ajustar saldo"}</div>
        <div style={{ color: "rgba(237,233,224,.55)", fontSize: 13, marginBottom: 16 }}>
          {user.name} · {user.email} · balance actual: <b>{user.balance}</b>
        </div>

        <label style={styles.label}>{action === "adjust" ? "Cantidad (puede ser negativa)" : "Cantidad"}</label>
        <input style={styles.input} type="number" value={amount} onChange={e => setAmount(e.target.value)} />

        <label style={styles.label}>Razón / nota</label>
        <input style={styles.input} value={reason} onChange={e => setReason(e.target.value)} placeholder="Mision completada, ajuste, etc." />

        {err && <div style={{ marginTop: 12, padding: 10, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 6, fontSize: 12, color: "#fca5a5" }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button style={styles.btn(true)} onClick={submit} disabled={submitting}>{submitting ? "Guardando…" : "Confirmar"}</button>
          <button style={styles.btn()} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function Pill({ children }) {
  const c = children === "admin" ? "#ef4444" : children === "operator" ? "#f59e0b" : "rgba(237,233,224,.5)";
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", border: `1px solid ${c}`, color: c }}>{children}</span>;
}

// ── Tab: Feed ───────────────────────────────────────────────────────────────
function FeedTab() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ type: "post", title: "", body: "", media_url: "" });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch(`${API}/admin/feed`, { headers: authHdr() });
    const d = await r.json();
    setPosts(d.posts || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function publish() {
    setMsg(""); setSubmitting(true);
    try {
      const payload = { type: draft.type };
      if (draft.title)     payload.title     = draft.title;
      if (draft.body)      payload.body      = draft.body;
      if (draft.media_url) payload.media_url = draft.media_url;
      const r = await fetch(`${API}/admin/feed`, { method: "POST", headers: jsonHdr(), body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Error"); setSubmitting(false); return; }
      setDraft({ type: "post", title: "", body: "", media_url: "" });
      setMsg("Publicado.");
      load();
    } catch { setMsg("Error de red"); }
    finally { setSubmitting(false); }
  }

  async function remove(id) {
    if (!confirm("¿Borrar este post?")) return;
    await fetch(`${API}/admin/feed/${id}`, { method: "DELETE", headers: authHdr() });
    load();
  }

  return (
    <div>
      <div style={styles.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Nuevo post</div>
        <label style={styles.label}>Tipo</label>
        <select style={styles.input} value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}>
          <option value="post">Post (permanente)</option>
          <option value="story">Story (24hs)</option>
          <option value="update">Update destacado</option>
        </select>
        <label style={styles.label}>Título (opcional)</label>
        <input style={styles.input} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
        <label style={styles.label}>Cuerpo (markdown soportado)</label>
        <textarea style={{ ...styles.input, minHeight: 100, resize: "vertical", fontFamily: "inherit" }} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} />
        <label style={styles.label}>URL de media (opcional)</label>
        <input style={styles.input} value={draft.media_url} onChange={e => setDraft({ ...draft, media_url: e.target.value })} placeholder="https://res.cloudinary.com/..." />
        {msg && <div style={{ marginTop: 12, padding: 10, background: msg.includes("Publicado") ? "rgba(34,197,94,.06)" : "rgba(239,68,68,.06)", border: `1px solid ${msg.includes("Publicado") ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`, borderRadius: 6, fontSize: 12, color: msg.includes("Publicado") ? "#86efac" : "#fca5a5" }}>{msg}</div>}
        <div style={{ marginTop: 14 }}>
          <button style={styles.btn(true)} onClick={publish} disabled={submitting}>{submitting ? "Publicando…" : "Publicar"}</button>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Posts publicados ({posts.length})</div>
        {loading && <div>Cargando…</div>}
        {!loading && posts.length === 0 && <div style={{ color: "rgba(237,233,224,.5)" }}>(sin posts)</div>}
        {posts.map(p => (
          <div key={p.id} style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <Pill>{p.type}</Pill>
                <span style={{ fontSize: 11, color: "rgba(237,233,224,.4)" }}>{new Date(p.created_at).toLocaleString("es-AR")}</span>
                {p.expires_at && <span style={{ fontSize: 11, color: "#f59e0b" }}>expira: {new Date(p.expires_at).toLocaleString("es-AR")}</span>}
              </div>
              {p.title && <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.title}</div>}
              {p.body && <div style={{ fontSize: 13, color: "rgba(237,233,224,.7)", whiteSpace: "pre-wrap" }}>{p.body}</div>}
              {p.media_url && <div style={{ fontSize: 11, color: "rgba(237,233,224,.45)", marginTop: 4, wordBreak: "break-all" }}>📎 {p.media_url}</div>}
            </div>
            <button style={styles.btn(false, true)} onClick={() => remove(p.id)}>Borrar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Branding ───────────────────────────────────────────────────────────
// Vista read-only del branding aplicado + mockups de "donde se ve" para que
// el admin entienda el alcance de cambiar `name` / `slogan` / `logo` /
// `colors`. La edicion real vive en el wizard (/admin/setup), boton al final.
function BrandingTab() {
  const branding = useBranding();
  const [manifestPreview, setManifestPreview] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API}/manifest.json`).then(r => r.ok ? r.json() : null).then(setManifestPreview).catch(() => {});
  }, [branding.name]); // refetch si cambia el branding

  const propagationTargets = [
    { icon: "🌐", title: "Browser title",       desc: "<title> en cada tab abierta del portal",                              source: "name" },
    { icon: "📱", title: "PWA install prompt",  desc: "Cuando un usuario instala el portal en su pantalla de inicio",         source: "name + short_name + logo + theme_color" },
    { icon: "🔗", title: "Link previews",       desc: "Cuando alguien comparte el link en WhatsApp/Twitter/Facebook/Discord", source: "name + slogan + logo (Open Graph + Twitter Cards)" },
    { icon: "🔐", title: "Prompt biométrico",   desc: "Cuando un usuario registra Touch ID / Face ID / Windows Hello",        source: "name (WebAuthn rpName)" },
    { icon: "🎨", title: "Sidebar + Topbar",    desc: "Logo + nombre visibles dentro del portal logueado",                    source: "name + logo + colors" },
    { icon: "📨", title: "Emails",              desc: "Bienvenida, reset password, verificación, broadcasts admin",            source: "name + logo + color_primary" },
    { icon: "🔔", title: "Alertas internas",    desc: "Notificaciones a Telegram cuando el portal explota o hay registros",   source: "name (APP_NAME)" },
    { icon: "🎨", title: "Tile color (Windows)",desc: "Color de fondo de la app instalada en Windows",                        source: "color_bg" },
  ];

  const fontStack = (b => {
    const fonts = { moderna: "Inter, sans-serif", clasica: "Georgia, serif", tech: "JetBrains Mono, monospace", friendly: "Quicksand, sans-serif" };
    return fonts[b.font_preset] || fonts.moderna;
  })(branding);

  return (
    <div>
      {/* Resumen actual */}
      <div style={styles.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Branding actual</div>
        <div style={{ fontSize: 12, color: "rgba(237,233,224,.5)", marginBottom: 16 }}>Sólo lectura. Para editar, abrí el wizard de configuración.</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <BrandingField label="Nombre"   value={branding.name} mono />
          <BrandingField label="Slogan"   value={branding.slogan} />
          <BrandingField label="Logo URL" value={branding.logo_url} mono ellipsis />
          <BrandingField label="Favicon"  value={branding.favicon_url} mono ellipsis />
          <BrandingField label="Font"     value={`${branding.font_preset} (${fontStack})`} />
        </div>

        {/* Swatches */}
        <div style={{ marginTop: 18 }}>
          <div style={{ ...styles.label, marginTop: 0 }}>Paleta</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Swatch hex={branding.color_primary} label="primary" />
            <Swatch hex={branding.color_accent}  label="accent"  />
            <Swatch hex={branding.color_bg}      label="bg"      />
            <Swatch hex={branding.color_text}    label="text"    />
          </div>
        </div>
      </div>

      {/* Live previews */}
      <div style={styles.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cómo se ve tu portal</div>
        <div style={{ fontSize: 12, color: "rgba(237,233,224,.5)", marginBottom: 16 }}>Mockups que reflejan el branding actual (datos reales del backend).</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {/* Browser tab */}
          <PreviewCard title="Browser tab">
            <div style={{ background: "#1f2025", borderRadius: 8, padding: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              {branding.favicon_url
                ? <img src={branding.favicon_url} alt="" style={{ width: 14, height: 14, objectFit: "contain", background: "rgba(255,255,255,.1)", borderRadius: 2, padding: 1 }} onError={e => { e.target.style.display = "none"; }} />
                : <div style={{ width: 14, height: 14, background: branding.color_primary, borderRadius: 2 }} />}
              <span style={{ color: "rgba(255,255,255,.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{branding.name}</span>
              <span style={{ marginLeft: "auto", color: "rgba(255,255,255,.4)" }}>×</span>
            </div>
          </PreviewCard>

          {/* PWA install */}
          <PreviewCard title="PWA install prompt">
            <div style={{ background: "#fff", color: "#000", borderRadius: 12, padding: 14, fontFamily: fontStack }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 48, height: 48, background: branding.color_bg, borderRadius: 10, display: "grid", placeItems: "center", overflow: "hidden" }}>
                  {branding.logo_url
                    ? <img src={branding.logo_url} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} onError={e => { e.target.outerHTML = `<div style="color:${branding.color_primary};font-weight:800;font-size:18px">${(branding.name||"?").charAt(0)}</div>`; }} />
                    : <div style={{ color: branding.color_primary, fontWeight: 800, fontSize: 18 }}>{(branding.name || "?").charAt(0)}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#000" }}>{manifestPreview?.short_name || branding.name}</div>
                  <div style={{ fontSize: 11, color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{manifestPreview?.description || branding.slogan}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, padding: "8px 0", borderTop: "1px solid #eee", display: "flex", gap: 8, fontSize: 12 }}>
                <button style={{ flex: 1, padding: "6px 10px", border: "none", background: "#eee", color: "#444", borderRadius: 6, fontWeight: 600 }} disabled>Cancelar</button>
                <button style={{ flex: 1, padding: "6px 10px", border: "none", background: branding.color_primary, color: "#fff", borderRadius: 6, fontWeight: 700 }} disabled>Instalar</button>
              </div>
            </div>
          </PreviewCard>

          {/* OG / Twitter card */}
          <PreviewCard title="Link preview (WhatsApp / Twitter / Discord)">
            <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e1e8ed" }}>
              <div style={{ background: branding.color_bg, height: 100, display: "grid", placeItems: "center" }}>
                {branding.logo_url
                  ? <img src={branding.logo_url} alt="" style={{ maxWidth: "60%", maxHeight: 70, objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
                  : <div style={{ color: branding.color_primary, fontWeight: 800, fontSize: 24 }}>{branding.name}</div>}
              </div>
              <div style={{ padding: 10, color: "#000" }}>
                <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase" }}>{(typeof window !== "undefined" && window.location.hostname) || "tudominio.com"}</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{branding.name}</div>
                <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>{branding.slogan}</div>
              </div>
            </div>
          </PreviewCard>

          {/* WebAuthn biometric prompt */}
          <PreviewCard title="Prompt biométrico (Touch ID / Hello)">
            <div style={{ background: "rgba(255,255,255,.97)", color: "#000", borderRadius: 14, padding: 16, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Iniciar sesión en <span style={{ color: "#0070f3" }}>{branding.name}</span></div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Usá Touch ID para iniciar sesión.</div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #ddd", display: "flex", gap: 8 }}>
                <button style={{ flex: 1, padding: "6px", background: "transparent", border: "none", color: "#0070f3", fontSize: 13 }} disabled>Cancelar</button>
                <button style={{ flex: 1, padding: "6px", background: "transparent", border: "none", color: "#0070f3", fontSize: 13, fontWeight: 600 }} disabled>Continuar</button>
              </div>
            </div>
          </PreviewCard>

          {/* Telegram alert */}
          <PreviewCard title="Alerta Telegram">
            <div style={{ background: "#17212b", color: "#fff", borderRadius: 8, padding: 12, fontFamily: "-apple-system, sans-serif", fontSize: 13 }}>
              <div style={{ color: "#5eb6f7", fontWeight: 700, fontSize: 12 }}>{branding.name} bot</div>
              <div style={{ marginTop: 6, lineHeight: 1.4 }}>
                🚨 <b>Error en {branding.name}</b><br />
                <span style={{ color: "rgba(255,255,255,.7)" }}>POST /auth/login → 500</span><br />
                <span style={{ color: "rgba(255,255,255,.5)", fontSize: 11 }}>{new Date().toLocaleString("es-AR")}</span>
              </div>
            </div>
          </PreviewCard>

          {/* Email */}
          <PreviewCard title="Email (bienvenida / reset)">
            <div style={{ background: "#fff", color: "#000", borderRadius: 6, overflow: "hidden", border: "1px solid #ddd" }}>
              <div style={{ background: branding.color_bg, padding: "12px", display: "flex", alignItems: "center", gap: 8 }}>
                {branding.logo_url
                  ? <img src={branding.logo_url} alt="" style={{ height: 22, objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
                  : null}
                <div style={{ color: branding.color_text, fontWeight: 700, fontSize: 14 }}>{branding.name}</div>
              </div>
              <div style={{ padding: 14, fontSize: 13, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>¡Hola, [Nombre]!</div>
                <div style={{ color: "#444" }}>Bienvenido a {branding.name}. Tu cuenta ya está lista.</div>
                <div style={{ marginTop: 10 }}>
                  <span style={{ display: "inline-block", padding: "8px 14px", background: branding.color_primary, color: "#fff", borderRadius: 6, fontWeight: 700, fontSize: 12 }}>Ir al portal</span>
                </div>
              </div>
            </div>
          </PreviewCard>
        </div>
      </div>

      {/* Propagación */}
      <div style={styles.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Se aplica automáticamente en {propagationTargets.length} lugares</div>
        <div style={{ fontSize: 12, color: "rgba(237,233,224,.5)", marginBottom: 14 }}>Cuando edités <code style={{ background: "rgba(255,255,255,.08)", padding: "1px 5px", borderRadius: 3 }}>name</code> / <code style={{ background: "rgba(255,255,255,.08)", padding: "1px 5px", borderRadius: 3 }}>logo</code> / <code style={{ background: "rgba(255,255,255,.08)", padding: "1px 5px", borderRadius: 3 }}>colors</code>, se propaga al instante (cache 30s).</div>

        <div style={{ display: "grid", gap: 8 }}>
          {propagationTargets.map(t => (
            <div key={t.title} style={{ display: "flex", gap: 12, padding: "10px 12px", background: "rgba(255,255,255,.02)", borderRadius: 6, alignItems: "flex-start" }}>
              <div style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>{t.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "rgba(237,233,224,.55)", marginTop: 2 }}>{t.desc}</div>
                <div style={{ fontSize: 10, color: "rgba(237,233,224,.35)", marginTop: 3, fontFamily: "monospace" }}>← {t.source}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <button style={styles.btn(true)} onClick={() => navigate("/admin/setup?section=branding")}>✏️ Editar branding en el wizard →</button>
        </div>
      </div>
    </div>
  );
}

function BrandingField({ label, value, mono = false, ellipsis = false }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(237,233,224,.4)", marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 13,
        fontFamily: mono ? "monospace" : "inherit",
        color: value ? "rgba(237,233,224,.9)" : "rgba(237,233,224,.35)",
        ...(ellipsis ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } : {}),
      }}>{value || "(vacío)"}</div>
    </div>
  );
}

function Swatch({ hex, label }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!navigator?.clipboard) return;
    navigator.clipboard.writeText(hex).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
  }
  return (
    <button onClick={copy} title="Click para copiar"
      style={{ background: "transparent", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 4, cursor: "pointer", fontFamily: "inherit", color: "inherit" }}>
      <div style={{ width: 60, height: 40, background: hex, borderRadius: 4, border: "1px solid rgba(0,0,0,.2)" }} />
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(237,233,224,.5)" }}>{label}</div>
      <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(237,233,224,.85)" }}>{copied ? "copiado!" : hex}</div>
    </button>
  );
}

function PreviewCard({ title, children }) {
  return (
    <div style={{ background: "rgba(0,0,0,.3)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(237,233,224,.45)", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Tab: Settings ───────────────────────────────────────────────────────────
function SettingsTab() {
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API}/api/admin/config/status`, { headers: authHdr() })
      .then(r => r.json()).then(d => setStatus(d.status || null)).catch(() => {});
  }, []);

  return (
    <div>
      <div style={styles.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Estado del setup</div>
        {!status && <div>Cargando…</div>}
        {status && (
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(status).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,.02)", borderRadius: 6, fontSize: 13 }}>
                <span style={{ textTransform: "capitalize" }}>{k}</span>
                <span style={{ color: v ? "#22c55e" : "rgba(237,233,224,.4)" }}>{v ? "✓ configurado" : "— pendiente"}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <button style={styles.btn(true)} onClick={() => navigate("/admin/setup")}>Abrir el wizard de configuración →</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "rgba(237,233,224,.5)" }}>
          El wizard te permite editar cada sección (Cloudinary, Marca, Resend, Telegram, Reglas) de forma individual.
          Los cambios se aplican al instante (con cache-bust del frontend al recargar).
        </div>
      </div>
    </div>
  );
}
