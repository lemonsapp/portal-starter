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
    fontFamily: "var(--brand-font, 'Gotham', system-ui, sans-serif)",
    padding: "32px 16px",
  },
  container: { maxWidth: 1100, margin: "0 auto" },
  h1: {
    fontFamily: "'Gotham', system-ui, sans-serif",
    fontSize: 32, fontWeight: 900, margin: "0 0 6px 0",
    letterSpacing: "-0.02em",
  },
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
          <button style={styles.tab(tab === "products")} onClick={() => setTab("products")}>🛒 Productos</button>
          <button style={styles.tab(tab === "orders")}    onClick={() => setTab("orders")}>📦 Pedidos</button>
          <button style={styles.tab(tab === "customers")} onClick={() => setTab("customers")}>👥 Clientes</button>
          <button style={styles.tab(tab === "branding")}  onClick={() => setTab("branding")}>🎨 Branding</button>
          <button style={styles.tab(tab === "settings")}  onClick={() => setTab("settings")}>⚙️ Configuración</button>
        </div>

        {tab === "coins"     && <CoinsTab />}
        {tab === "feed"      && <FeedTab />}
        {tab === "products"  && <ProductsTab />}
        {tab === "orders"    && <OrdersTab />}
        {tab === "customers" && <CustomersTab />}
        {tab === "branding"  && <BrandingTab />}
        {tab === "settings"  && <SettingsTab />}
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

// ── Tab: Productos (Shop fase 1) ────────────────────────────────────────────
// Lista + CRUD de productos. Imágenes por URL (file upload llega en fase 2).
function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // null = no modal | "new" | productObj
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [pr, cr] = await Promise.all([
        fetch(`${API}/api/admin/shop/products`, { headers: authHdr() }),
        fetch(`${API}/api/admin/shop/categories`, { headers: authHdr() }),
      ]);
      const pd = await pr.json();
      const cd = await cr.json();
      setProducts(pd.products || []);
      setCategories(cd.categories || []);
    } catch (e) {
      setErr("No se pudo cargar el catálogo");
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(p) {
    if (!confirm(`¿Borrar "${p.name}"? Esta acción no se puede deshacer.`)) return;
    const r = await fetch(`${API}/api/admin/shop/products/${p.id}`, {
      method: "DELETE", headers: authHdr(),
    });
    if (r.ok) load();
    else alert("Error al borrar");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Productos del catálogo</h2>
        <button style={styles.btn(true)} onClick={() => setEditing("new")}>+ Nuevo producto</button>
      </div>

      {err && <div style={{ ...styles.card, color: "#fca5a5", borderColor: "rgba(239,68,68,.4)" }}>{err}</div>}

      <div style={styles.card}>
        {loading ? (
          <div>Cargando…</div>
        ) : products.length === 0 ? (
          <div style={{ color: "rgba(237,233,224,.5)", padding: "20px 0" }}>
            Sin productos. Hacé clic en <strong>+ Nuevo producto</strong> para arrancar.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}></th>
                <th style={styles.th}>Producto</th>
                <th style={styles.th}>Categoría</th>
                <th style={styles.th}>Precio</th>
                <th style={styles.th}>Stock</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td style={styles.td}>
                    {p.primary_image
                      ? <img src={p.primary_image} alt="" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, background: "rgba(255,255,255,.03)" }} />
                      : <div style={{ width: 36, height: 36, background: "rgba(255,255,255,.05)", borderRadius: 4 }} />
                    }
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(237,233,224,.5)" }}>/{p.slug}{p.featured ? " · ⭐ destacado" : ""}</div>
                  </td>
                  <td style={styles.td}>{p.category?.name || "—"}</td>
                  <td style={styles.td}>{p.price_formatted}</td>
                  <td style={styles.td}>{p.stock == null ? "∞" : p.stock}</td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 11, color: p.active ? "#86efac" : "rgba(237,233,224,.4)" }}>
                      {p.active ? "✓ activo" : "— oculto"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button style={styles.btn()} onClick={() => setEditing(p)}>Editar</button>{" "}
                    <button style={styles.btn(false, true)} onClick={() => remove(p)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <ProductModal
          product={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Modal: crear/editar producto ────────────────────────────────────────────
function ProductModal({ product, categories, onClose, onSaved }) {
  const isNew = !product;
  const [name, setName] = useState(product?.name || "");
  const [slug, setSlug] = useState(product?.slug || "");
  const [shortDesc, setShortDesc] = useState(product?.short_description || "");
  const [longDesc, setLongDesc] = useState(product?.long_description || "");
  // price_cents en ARS — el form trabaja en pesos (1.000 = $1.000), se convierte a centavos al guardar.
  const [priceArs, setPriceArs] = useState(
    product?.price_cents != null ? Math.round(product.price_cents / 100) : ""
  );
  const [stock, setStock] = useState(product?.stock ?? "");
  const [sku, setSku] = useState(product?.sku || "");
  const [categoryId, setCategoryId] = useState(product?.category?.id || "");
  const [active, setActive] = useState(product?.active !== false);
  const [featured, setFeatured] = useState(product?.featured === true);
  const [sortOrder, setSortOrder] = useState(product?.sort_order ?? 0);
  // Imágenes como lista de { url, alt, is_primary }
  const [images, setImages] = useState(
    product?.images?.length ? product.images.map((i) => ({
      url: i.url, alt: i.alt || "", is_primary: !!i.is_primary,
    })) : [{ url: "", alt: "", is_primary: true }]
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Auto-slug a partir del nombre cuando es nuevo y el slug está vacío.
  function maybeAutoSlug(v) {
    setName(v);
    if (isNew && !slug) {
      const auto = v.toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      setSlug(auto);
    }
  }

  function updateImage(i, field, value) {
    setImages((arr) => arr.map((img, idx) => idx === i ? { ...img, [field]: value } : img));
  }
  function setPrimary(i) {
    setImages((arr) => arr.map((img, idx) => ({ ...img, is_primary: idx === i })));
  }
  function addImage() {
    setImages((arr) => [...arr, { url: "", alt: "", is_primary: false }]);
  }
  function removeImage(i) {
    setImages((arr) => {
      const next = arr.filter((_, idx) => idx !== i);
      if (next.length && !next.some((img) => img.is_primary)) next[0].is_primary = true;
      return next.length ? next : [{ url: "", alt: "", is_primary: true }];
    });
  }

  async function save() {
    setErr("");
    setSaving(true);
    const payload = {
      slug: slug.trim(),
      name: name.trim(),
      short_description: shortDesc.trim() || null,
      long_description: longDesc.trim() || null,
      price_cents: Math.max(0, Math.round(Number(priceArs || 0) * 100)),
      stock: stock === "" ? null : Math.max(0, Number(stock)),
      sku: sku.trim() || null,
      category_id: categoryId ? Number(categoryId) : null,
      active, featured,
      sort_order: Number(sortOrder) || 0,
      images: images
        .filter((i) => i.url.trim())
        .map((i, idx) => ({
          url: i.url.trim(),
          alt: i.alt.trim() || null,
          sort_order: idx,
          is_primary: !!i.is_primary,
        })),
    };

    try {
      const url = isNew
        ? `${API}/api/admin/shop/products`
        : `${API}/api/admin/shop/products/${product.id}`;
      const r = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: jsonHdr(),
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "Error al guardar");
        setSaving(false);
        return;
      }
      onSaved();
    } catch (e) {
      setErr("Error de red");
    }
    setSaving(false);
  }

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div
        style={{ ...styles.modalCard, maxWidth: 640, maxHeight: "88vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{isNew ? "Nuevo producto" : `Editar — ${product.name}`}</h3>
          <button style={styles.btn()} onClick={onClose}>✕</button>
        </div>

        {err && (
          <div style={{ padding: 10, marginBottom: 12, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.35)", borderRadius: 6, color: "#fca5a5", fontSize: 13 }}>
            {err}
          </div>
        )}

        <label style={styles.label}>Nombre</label>
        <input style={styles.input} value={name} onChange={(e) => maybeAutoSlug(e.target.value)} placeholder="Ej: Línea Race — Race 1 Vegetativo 500ml" />

        <label style={styles.label}>Slug (URL)</label>
        <input style={styles.input} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="race-1-vegetativo-500ml" />
        <div style={{ fontSize: 11, color: "rgba(237,233,224,.45)", marginTop: 4 }}>Aparecerá como /shop/{slug || "..."}</div>

        <label style={styles.label}>Descripción corta</label>
        <input style={styles.input} value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} placeholder="Tarjeta del catálogo, 1-2 líneas" />

        <label style={styles.label}>Descripción larga</label>
        <textarea style={{ ...styles.input, minHeight: 90, resize: "vertical" }} value={longDesc} onChange={(e) => setLongDesc(e.target.value)} placeholder="Detalle del producto en la página de producto" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div>
            <label style={styles.label}>Precio (ARS)</label>
            <input style={styles.input} type="number" min="0" step="1" value={priceArs} onChange={(e) => setPriceArs(e.target.value)} placeholder="25000" />
          </div>
          <div>
            <label style={styles.label}>Stock (vacío = ∞)</label>
            <input style={styles.input} type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="50" />
          </div>
          <div>
            <label style={styles.label}>SKU</label>
            <input style={styles.input} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="RACE-1-500" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <div>
            <label style={styles.label}>Categoría</label>
            <select style={styles.input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— Sin categoría —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.label}>Orden</label>
            <input style={styles.input} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 14, fontSize: 13 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Activo (visible en /shop)
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            Destacado ⭐
          </label>
        </div>

        <label style={{ ...styles.label, marginTop: 18 }}>Imágenes (URL)</label>
        <div style={{ display: "grid", gap: 8 }}>
          {images.map((img, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr auto auto", gap: 6, alignItems: "center" }}>
              {img.url
                ? <img src={img.url} alt="" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 4, background: "rgba(255,255,255,.04)" }} />
                : <div style={{ width: 32, height: 32, background: "rgba(255,255,255,.05)", borderRadius: 4 }} />
              }
              <input style={styles.input} value={img.url} onChange={(e) => updateImage(i, "url", e.target.value)} placeholder="URL de la imagen (ej: /img/productos/race/...)" />
              <input style={styles.input} value={img.alt} onChange={(e) => updateImage(i, "alt", e.target.value)} placeholder="Alt text (a11y)" />
              <label style={{ fontSize: 11, color: "rgba(237,233,224,.6)", display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input type="radio" name="primary" checked={img.is_primary} onChange={() => setPrimary(i)} />
                Principal
              </label>
              <button style={{ ...styles.btn(false, true), padding: "4px 10px" }} onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
          <button style={{ ...styles.btn(), alignSelf: "start", marginTop: 4 }} onClick={addImage}>+ Agregar imagen</button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button style={styles.btn()} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={styles.btn(true)} onClick={save} disabled={saving || !name || !slug || priceArs === ""}>
            {saving ? "Guardando…" : (isNew ? "Crear producto" : "Guardar cambios")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Pedidos (Shop F2) ──────────────────────────────────────────────────
// Lista de órdenes con filtros por estado + tabs lifecycle. Click en una
// fila abre el detalle con datos del cliente, items, dirección y acciones
// de cambio de estado.
const ORDER_STATUS_META = {
  pending_payment: { label: "Pendiente de pago", color: "#fcd34d", emoji: "⏳" },
  paid:            { label: "Pagado",            color: "#86efac", emoji: "💰" },
  dispatched:      { label: "Despachado",        color: "#93c5fd", emoji: "🚚" },
  completed:       { label: "Completado",        color: "#A7F5C8", emoji: "✅" },
  cancelled:       { label: "Cancelado",         color: "rgba(237,233,224,.5)", emoji: "🚫" },
  failed:          { label: "Fallido",           color: "#fca5a5", emoji: "❌" },
};

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filter !== "all") qs.set("status", filter);
    if (search.trim()) qs.set("search", search.trim());
    try {
      const r = await fetch(`${API}/api/admin/shop/orders?${qs.toString()}`, { headers: authHdr() });
      const d = await r.json();
      setOrders(d.orders || []);
      setCounts(d.counts || {});
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  return (
    <div>
      <h2 style={{ fontSize: 18, margin: "0 0 14px", fontWeight: 700 }}>Pedidos del shop</h2>

      <div style={styles.card}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
            Todos · {Object.values(counts).reduce((a, b) => a + b, 0)}
          </FilterPill>
          {Object.entries(ORDER_STATUS_META).map(([key, meta]) => (
            <FilterPill key={key} active={filter === key} onClick={() => setFilter(key)} color={meta.color}>
              {meta.emoji} {meta.label} · {counts[key] || 0}
            </FilterPill>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            style={{ ...styles.input, maxWidth: 360 }}
            placeholder="Buscar por email, nombre o número de orden…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          />
          <button style={styles.btn()} onClick={load}>Buscar</button>
        </div>
      </div>

      <div style={styles.card}>
        {loading ? (
          <div>Cargando…</div>
        ) : orders.length === 0 ? (
          <div style={{ color: "rgba(237,233,224,.5)", padding: "20px 0" }}>
            No hay pedidos {filter !== "all" ? `con estado "${ORDER_STATUS_META[filter]?.label}"` : "todavía"}.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Orden</th>
                <th style={styles.th}>Cliente</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const meta = ORDER_STATUS_META[o.status] || ORDER_STATUS_META.pending_payment;
                return (
                  <tr key={o.id} onClick={() => setDetail(o.id)} style={{ cursor: "pointer" }}>
                    <td style={styles.td}>
                      <code style={{ fontFamily: "monospace", fontWeight: 700 }}>{o.public_id}</code>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600 }}>{o.customer_first_name} {o.customer_last_name || ""}</div>
                      <div style={{ fontSize: 11, color: "rgba(237,233,224,.55)" }}>{o.customer_email}</div>
                    </td>
                    <td style={styles.td}>
                      <strong style={{ color: "var(--brand-primary, #A7F5C8)" }}>{o.total_formatted}</strong>
                    </td>
                    <td style={styles.td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: meta.color }}>
                        <span>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12, color: "rgba(237,233,224,.6)" }}>
                        {new Date(o.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button style={styles.btn()} onClick={(e) => { e.stopPropagation(); setDetail(o.id); }}>Ver detalle</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {detail && <OrderDetailModal orderId={detail} onClose={() => setDetail(null)} onChanged={load} />}
    </div>
  );
}

function FilterPill({ active, onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px", borderRadius: 999,
        border: active ? `1px solid ${color || "var(--brand-primary, #A7F5C8)"}` : "1px solid rgba(255,255,255,.1)",
        background: active ? "rgba(167,245,200,.10)" : "transparent",
        color: active ? (color || "var(--brand-primary, #A7F5C8)") : "rgba(237,233,224,.75)",
        fontSize: 12, fontWeight: 700, cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function OrderDetailModal({ orderId, onClose, onChanged }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch(`${API}/api/admin/shop/orders/${orderId}`, { headers: authHdr() });
    const d = await r.json();
    setOrder(d.order || null);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId]);

  async function changeStatus(newStatus) {
    if (!confirm(`Cambiar estado a "${ORDER_STATUS_META[newStatus]?.label}"?`)) return;
    setSavingStatus(newStatus);
    const r = await fetch(`${API}/api/admin/shop/orders/${orderId}/status`, {
      method: "POST", headers: jsonHdr(),
      body: JSON.stringify({ status: newStatus }),
    });
    if (r.ok) {
      await load();
      onChanged?.();
    } else {
      alert("Error al cambiar estado");
    }
    setSavingStatus("");
  }

  const sa = order?.shipping_address || {};

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div
        style={{ ...styles.modalCard, maxWidth: 720, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>
            Pedido <code style={{ fontFamily: "monospace", color: "var(--brand-primary, #A7F5C8)" }}>{order?.public_id || "…"}</code>
          </h3>
          <button style={styles.btn()} onClick={onClose}>✕</button>
        </div>

        {loading && <div>Cargando…</div>}
        {!loading && order && (
          <>
            {/* Estado actual + acciones */}
            <div style={{ ...styles.card, marginBottom: 16, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(237,233,224,.5)" }}>Estado</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: ORDER_STATUS_META[order.status]?.color }}>
                  {ORDER_STATUS_META[order.status]?.emoji} {ORDER_STATUS_META[order.status]?.label}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(ORDER_STATUS_META).map(([key, meta]) => (
                  <button
                    key={key}
                    disabled={key === order.status || !!savingStatus}
                    onClick={() => changeStatus(key)}
                    style={{
                      padding: "7px 11px", fontSize: 11, fontWeight: 700,
                      borderRadius: 6, border: "1px solid rgba(255,255,255,.1)",
                      background: key === order.status ? "rgba(167,245,200,.12)" : "rgba(255,255,255,.04)",
                      color: key === order.status ? meta.color : "rgba(237,233,224,.8)",
                      cursor: key === order.status ? "default" : "pointer",
                      opacity: savingStatus === key ? 0.5 : 1,
                      fontFamily: "inherit",
                    }}
                  >
                    {meta.emoji} {meta.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "rgba(237,233,224,.5)", marginTop: 10 }}>
                Flujo típico: Pendiente → Pagado → Despachado → Completado.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Cliente */}
              <div style={styles.card}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 10 }}>Cliente</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{order.customer_first_name} {order.customer_last_name || ""}</div>
                <div style={{ fontSize: 13, color: "rgba(237,233,224,.75)", marginTop: 4 }}>
                  <div>📧 <a href={`mailto:${order.customer_email}`} style={{ color: "inherit", textDecoration: "underline dotted" }}>{order.customer_email}</a></div>
                  <div>📱 <a href={`https://wa.me/${order.customer_phone?.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline dotted" }}>{order.customer_phone}</a></div>
                </div>
              </div>

              {/* Envío */}
              <div style={styles.card}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 10 }}>Dirección de envío</div>
                <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                  <div>{sa.street} {sa.number}{sa.apartment ? ` · Dpto ${sa.apartment}` : ""}</div>
                  <div>{sa.city}, {sa.province}</div>
                  <div>CP {sa.postal_code}{sa.country ? ` · ${sa.country}` : ""}</div>
                  {sa.notes && <div style={{ marginTop: 8, fontStyle: "italic", color: "rgba(237,233,224,.65)" }}>“{sa.notes}”</div>}
                </div>
              </div>
            </div>

            {/* Items */}
            <div style={{ ...styles.card, marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 10 }}>Productos ({order.items?.length || 0})</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}></th>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Cant</th>
                    <th style={styles.th}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((it) => (
                    <tr key={it.id}>
                      <td style={styles.td}>
                        {it.image_url
                          ? <img src={it.image_url} alt="" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, background: "rgba(255,255,255,.03)" }} />
                          : <div style={{ width: 36, height: 36, background: "rgba(255,255,255,.05)", borderRadius: 4 }} />
                        }
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600 }}>{it.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(237,233,224,.5)" }}>/{it.product_slug}</div>
                      </td>
                      <td style={styles.td}>{it.quantity}</td>
                      <td style={styles.td}>{formatARS(it.line_total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 14 }}>
                <span style={{ fontSize: 13, color: "rgba(237,233,224,.7)" }}>Total</span>
                <strong style={{ fontSize: 22, color: "var(--brand-primary, #A7F5C8)" }}>{order.total_formatted}</strong>
              </div>
            </div>

            {/* Timestamps */}
            <div style={{ ...styles.card, marginTop: 14, fontSize: 12, color: "rgba(237,233,224,.65)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 8 }}>Historial</div>
              <div>📥 Creado: {new Date(order.created_at).toLocaleString("es-AR")}</div>
              {order.paid_at && <div>💰 Pagado: {new Date(order.paid_at).toLocaleString("es-AR")}</div>}
              {order.dispatched_at && <div>🚚 Despachado: {new Date(order.dispatched_at).toLocaleString("es-AR")}</div>}
              {order.completed_at && <div>✅ Completado: {new Date(order.completed_at).toLocaleString("es-AR")}</div>}
              {order.mp_payment_id && <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 11 }}>MP payment_id: {order.mp_payment_id}</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Helper local (no re-importamos useCart acá — AdminPanel sólo necesita formatear)
function formatARS(cents) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Tab: Clientes (Shop F3) ─────────────────────────────────────────────────
// Vista de marketing: lista de customers con métricas acumuladas
// (orders_count, total_spent), filtros, toggle opt-in y export CSV para
// campañas externas (Mailchimp, etc).
function CustomersTab() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [marketingCount, setMarketingCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | optin | optout
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    if (filter === "optin") qs.set("marketing", "1");
    if (filter === "optout") qs.set("marketing", "0");
    try {
      const r = await fetch(`${API}/api/admin/shop/customers?${qs.toString()}`, { headers: authHdr() });
      const d = await r.json();
      setCustomers(d.customers || []);
      setTotal(d.total || 0);
      setMarketingCount(d.marketing_count || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function toggleMarketing(c) {
    const r = await fetch(`${API}/api/admin/shop/customers/${c.id}/marketing`, {
      method: "POST", headers: jsonHdr(),
      body: JSON.stringify({ opted_in: !c.opted_in_marketing }),
    });
    if (r.ok) load();
  }

  function downloadCsv(onlyMarketing) {
    const token = getToken();
    const qs = onlyMarketing ? "?marketing=1" : "";
    // CSV requiere Authorization header → fetch + download manual.
    fetch(`${API}/api/admin/shop/customers/export.csv${qs}`, { headers: authHdr() })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `holistic-customers-${new Date().toISOString().slice(0, 10)}${onlyMarketing ? "-marketing" : ""}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Clientes del shop</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.btn()} onClick={() => downloadCsv(false)}>↓ Exportar todos</button>
          <button style={styles.btn(true)} onClick={() => downloadCsv(true)}>↓ Solo opt-in marketing</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <StatCard label="Clientes totales" value={total} />
        <StatCard label="Opt-in marketing" value={marketingCount} accent />
        <StatCard label="Tasa opt-in" value={total > 0 ? `${Math.round((marketingCount / total) * 100)}%` : "—"} />
      </div>

      <div style={styles.card}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>Todos</FilterPill>
          <FilterPill active={filter === "optin"} onClick={() => setFilter("optin")}>✅ Opt-in marketing</FilterPill>
          <FilterPill active={filter === "optout"} onClick={() => setFilter("optout")}>🚫 Unsubscribe</FilterPill>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            style={{ ...styles.input, maxWidth: 360 }}
            placeholder="Buscar por email o nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          />
          <button style={styles.btn()} onClick={load}>Buscar</button>
        </div>
      </div>

      <div style={styles.card}>
        {loading ? <div>Cargando…</div> : customers.length === 0 ? (
          <div style={{ color: "rgba(237,233,224,.5)", padding: "20px 0" }}>
            Sin clientes que coincidan. Los nuevos se crean automáticamente al confirmar un pedido en /shop.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Cliente</th>
                <th style={styles.th}>Email / Contacto</th>
                <th style={styles.th}>Pedidos</th>
                <th style={styles.th}>Gastado</th>
                <th style={styles.th}>Último pedido</th>
                <th style={styles.th}>Marketing</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 600 }}>{c.first_name || "—"} {c.last_name || ""}</div>
                    <div style={{ fontSize: 11, color: "rgba(237,233,224,.5)" }}>
                      {(c.last_address?.city || "") + (c.last_address?.province ? `, ${c.last_address.province}` : "")}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <a href={`mailto:${c.email}`} style={{ color: "inherit" }}>{c.email}</a>
                    {c.phone && <div style={{ fontSize: 11, color: "rgba(237,233,224,.55)" }}>📱 {c.phone}</div>}
                  </td>
                  <td style={styles.td}>
                    <strong>{c.orders_count}</strong>
                  </td>
                  <td style={styles.td}>
                    <strong style={{ color: "var(--brand-primary, #A7F5C8)" }}>{c.total_spent_formatted}</strong>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 12, color: "rgba(237,233,224,.7)" }}>
                      {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button
                      style={{
                        padding: "5px 11px", fontSize: 11, fontWeight: 700,
                        borderRadius: 999, border: "none", fontFamily: "inherit",
                        background: c.opted_in_marketing ? "rgba(167,245,200,.15)" : "rgba(239,68,68,.12)",
                        color: c.opted_in_marketing ? "#86efac" : "#fca5a5",
                        cursor: "pointer",
                      }}
                      onClick={() => toggleMarketing(c)}
                      title="Click para alternar"
                    >
                      {c.opted_in_marketing ? "✓ Opt-in" : "✗ Out"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...styles.card, padding: 16, margin: 0, textAlign: "center" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent ? "var(--brand-primary, #A7F5C8)" : "inherit", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}
