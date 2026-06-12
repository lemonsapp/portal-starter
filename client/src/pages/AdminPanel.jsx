// client/src/pages/AdminPanel.jsx
//
// Panel admin post-wizard. Spec § 9.
// Tabs: Coins / Feed / Settings (re-abre el wizard por sección).

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBranding } from "../lib/branding.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
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
  // Sub-pestañas (Tienda → Productos/Pedidos/Feed · Config → Branding/Ajustes).
  // Estilo pill para diferenciarlas visualmente de las top-level (underline).
  subtabs: { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" },
  subtab: (active) => ({
    padding: "7px 15px", borderRadius: 999, cursor: "pointer",
    fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
    color: active ? "#fff" : "rgba(237,233,224,.6)",
    background: active ? "var(--brand-primary, #3B82F6)" : "rgba(255,255,255,.05)",
    border: `1px solid ${active ? "transparent" : "rgba(255,255,255,.1)"}`,
    fontFamily: "inherit",
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

// Estructura de pestañas del admin. TIENDA y CONFIGURACIÓN agrupan sub-pestañas;
// el resto abre su componente directo. Los *Tab son function declarations
// (hoisted), así que se pueden referenciar acá aunque se definan más abajo.
const ADMIN_NAV = [
  {
    key: "tienda", label: "🛒 Tienda",
    subs: [
      { key: "products", label: "Productos", Comp: ProductsTab },
      { key: "orders",   label: "Pedidos",   Comp: OrdersTab },
      { key: "feed",     label: "Feed",      Comp: FeedTab },
    ],
  },
  {
    key: "puntos", label: "💎 Puntos",
    subs: [
      { key: "manual",   label: "Carga manual", Comp: PuntosManualTab },
      { key: "catalogo", label: "Catálogo",     Comp: RewardsCatalogTab },
      { key: "canjes",   label: "Canjes",       Comp: RedemptionsTab },
      { key: "instagram",label: "Instagram",    Comp: IgQueueTab },
      { key: "ranking",  label: "Ranking",      Comp: CoinsTab },
    ],
  },
  { key: "clientes",  label: "👥 Clientes",     Comp: CustomersTab },
  { key: "campaigns", label: "📧 Campañas",     Comp: CampaignsTab },
  { key: "promos",    label: "🎟️ Códigos",      Comp: PromoCodesTab },
  {
    key: "config", label: "⚙️ Configuración",
    subs: [
      { key: "branding", label: "Branding", Comp: BrandingTab },
      { key: "settings", label: "Ajustes",  Comp: SettingsTab },
    ],
  },
];

export default function AdminPanel() {
  const [tabKey, setTabKey] = useState("tienda");
  const [subKey, setSubKey] = useState("products");

  const tab = ADMIN_NAV.find((t) => t.key === tabKey) || ADMIN_NAV[0];

  // Al cambiar de pestaña top: si agrupa sub-tabs, caemos a la primera.
  function selectTab(t) {
    setTabKey(t.key);
    if (t.subs) setSubKey(t.subs[0].key);
  }

  // Componente activo: sub-tab seleccionado si el top agrupa, si no el directo.
  const activeSub = tab.subs ? (tab.subs.find((s) => s.key === subKey) || tab.subs[0]) : null;
  const ActiveComp = activeSub ? activeSub.Comp : tab.Comp;

  return (
    <div style={styles.shell}>
      <div style={styles.container}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={styles.h1}>Panel admin</h1>
            <div style={styles.sub}>Tienda, coins, clientes, campañas, códigos y configuración del portal.</div>
          </div>
          <Link to="/inicio" style={{ ...styles.btn(), textDecoration: "none", display: "inline-block" }}>← Volver al inicio</Link>
        </div>

        {/* Pestañas top-level */}
        <div style={styles.tabs}>
          {ADMIN_NAV.map((t) => (
            <button key={t.key} style={styles.tab(tabKey === t.key)} onClick={() => selectTab(t)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Sub-pestañas (solo cuando el top-level agrupa) */}
        {tab.subs && (
          <div style={styles.subtabs}>
            {tab.subs.map((s) => (
              <button key={s.key} style={styles.subtab(subKey === s.key)} onClick={() => setSubKey(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <ActiveComp />
      </div>
    </div>
  );
}

// ── Tab: Puntos → Carga manual (panel Gaia) ──────────────────────────────────
function PuntosManualTab() {
  const [code, setCode] = useState("");
  const [customer, setCustomer] = useState(null);   // { id, name, email, customer_code, balance }
  const [earnPerPoint, setEarnPerPoint] = useState(12000);
  const [looking, setLooking] = useState(false);
  const [lookupErr, setLookupErr] = useState("");

  const [amount, setAmount] = useState("");
  const [canal, setCanal] = useState("whatsapp");
  const [descripcion, setDescripcion] = useState("");
  const [override, setOverride] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  async function lookup() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setLooking(true); setLookupErr(""); setCustomer(null); setResult(null);
    try {
      const r = await fetch(`${API}/coins/lookup/${encodeURIComponent(c)}`, { headers: authHdr() });
      const d = await r.json();
      if (!r.ok) setLookupErr(d.error || "Cliente no encontrado");
      else { setCustomer(d.user); setEarnPerPoint(d.earn_per_point || 12000); }
    } catch { setLookupErr("Error de conexión"); }
    setLooking(false);
  }

  const pesos = Math.max(0, Math.floor(Number(amount) || 0));
  const previewPoints = override !== ""
    ? Math.max(0, Math.floor(Number(override) || 0))
    : Math.floor(pesos / (earnPerPoint || 12000));

  async function submit() {
    if (!customer || previewPoints <= 0) return;
    setSubmitting(true); setErr(""); setResult(null);
    try {
      const r = await fetch(`${API}/coins/manual-credit`, {
        method: "POST", headers: jsonHdr(),
        body: JSON.stringify({
          customer_code: customer.customer_code,
          amount_pesos: pesos,
          canal, descripcion,
          points_override: override === "" ? undefined : override,
        }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "Error al acreditar");
      else {
        setResult(d);
        setCustomer({ ...customer, balance: d.new_balance });
        setAmount(""); setDescripcion(""); setOverride("");
      }
    } catch { setErr("Error de conexión"); }
    setSubmitting(false);
  }

  return (
    <div>
      <div style={styles.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>Carga manual de puntos</h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(237,233,224,.55)" }}>
          Compra externa (WhatsApp, ML, efectivo…). Buscá al cliente por su código, ingresá el monto y acreditá.
        </p>
        <label style={styles.label}>Código de cliente</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={styles.input}
            placeholder="HST-XXXX-XX"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") lookup(); }}
          />
          <button style={styles.btn(true)} onClick={lookup} disabled={looking}>
            {looking ? "…" : "Buscar"}
          </button>
        </div>
        {lookupErr && <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 8 }}>{lookupErr}</p>}
      </div>

      {customer && (
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{customer.name}</div>
              <div style={{ fontSize: 12, color: "rgba(237,233,224,.55)" }}>{customer.email} · {customer.customer_code}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "rgba(237,233,224,.4)" }}>Saldo</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: "var(--brand-primary, #3B82F6)" }}>{customer.balance} pts</div>
            </div>
          </div>

          <label style={styles.label}>Monto de la compra ($)</label>
          <input style={styles.input} type="number" min="0" placeholder="35000" value={amount} onChange={(e) => setAmount(e.target.value)} />

          <label style={styles.label}>Canal</label>
          <select style={styles.input} value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="whatsapp">WhatsApp</option>
            <option value="mercadolibre">MercadoLibre</option>
            <option value="efectivo">Efectivo</option>
            <option value="instagram">Instagram</option>
            <option value="historial_previo">Historial previo</option>
            <option value="otro">Otro</option>
          </select>

          <label style={styles.label}>Descripción (opcional)</label>
          <input style={styles.input} placeholder="2x Elite 500ml + Kit 100gr" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

          <label style={styles.label}>Puntos a acreditar — override (opcional)</label>
          <input style={styles.input} type="number" min="0" placeholder={`auto: ${previewPoints}`} value={override} onChange={(e) => setOverride(e.target.value)} />

          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.25)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "rgba(237,233,224,.8)" }}>Se acreditarán</span>
            <span style={{ fontWeight: 900, fontSize: 20, color: "var(--brand-primary, #3B82F6)" }}>+{previewPoints} pts</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(237,233,224,.45)", marginTop: 6 }}>
            1 punto cada ${earnPerPoint.toLocaleString("es-AR")} · redondeo hacia abajo.
          </div>

          {err && <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 10 }}>{err}</p>}
          <button style={{ ...styles.btn(true), marginTop: 14, width: "100%", padding: "11px" }} onClick={submit} disabled={submitting || previewPoints <= 0}>
            {submitting ? "Acreditando…" : `Acreditar +${previewPoints} pts`}
          </button>
        </div>
      )}

      {result && (
        <div style={{ ...styles.card, borderColor: "rgba(34,197,94,.4)", background: "rgba(34,197,94,.06)" }}>
          ✓ Acreditados <b>+{result.points_credited} pts</b> a <b>{result.user.name}</b>. Nuevo saldo: <b>{result.new_balance} pts</b>.
        </div>
      )}
    </div>
  );
}

// ── Tab: Puntos → Catálogo de canjes (CRUD point_rewards) ────────────────────
function RewardRow({ rw, onSaved, onDeleted }) {
  const [cost, setCost] = useState(rw.cost_points);
  const [stock, setStock] = useState(rw.stock ?? "");
  const [active, setActive] = useState(rw.active);
  const [pct, setPct] = useState(rw.discount_pct ?? "");
  const [val, setVal] = useState(rw.market_value_cents != null ? Math.round(rw.market_value_cents / 100) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const body = {
      cost_points: Number(cost), active,
      stock: stock === "" ? "" : Number(stock),
      discount_pct: rw.kind === "descuento" ? (pct === "" ? null : Number(pct)) : null,
      market_value_cents: rw.kind === "premio" ? (val === "" ? null : Math.round(Number(val) * 100)) : null,
    };
    const r = await fetch(`${API}/coins/admin/rewards/${rw.id}`, { method: "PUT", headers: jsonHdr(), body: JSON.stringify(body) });
    if (r.ok) onSaved?.();
    setSaving(false);
  }
  async function del() {
    if (!confirm(`Eliminar "${rw.label}"?`)) return;
    const r = await fetch(`${API}/coins/admin/rewards/${rw.id}`, { method: "DELETE", headers: authHdr() });
    if (r.ok) onDeleted?.();
  }

  return (
    <tr>
      <td style={styles.td}>
        <div style={{ fontWeight: 700 }}>{rw.label}</div>
        <div style={{ fontSize: 11, color: "rgba(237,233,224,.4)" }}>{rw.slug} · {rw.kind}</div>
      </td>
      <td style={styles.td}><input style={{ ...styles.input, width: 80 }} type="number" value={cost} onChange={e => setCost(e.target.value)} /></td>
      <td style={styles.td}>
        {rw.kind === "descuento"
          ? <input style={{ ...styles.input, width: 70 }} type="number" value={pct} onChange={e => setPct(e.target.value)} placeholder="%" />
          : <input style={{ ...styles.input, width: 100 }} type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="$ valor" />}
      </td>
      <td style={styles.td}><input style={{ ...styles.input, width: 70 }} type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="∞" /></td>
      <td style={styles.td}><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /></td>
      <td style={styles.td}>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={styles.btn(true)} onClick={save} disabled={saving}>{saving ? "…" : "Guardar"}</button>
          <button style={styles.btn(false, true)} onClick={del}>✕</button>
        </div>
      </td>
    </tr>
  );
}

function RewardsCatalogTab() {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState(null); // form abierto

  function load() {
    setLoading(true);
    fetch(`${API}/coins/rewards?all=1`, { headers: authHdr() })
      .then(r => r.json()).then(d => { setRewards(d.rewards || []); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function create() {
    const body = {
      slug: nuevo.slug, kind: nuevo.kind, label: nuevo.label,
      description: nuevo.description, cost_points: Number(nuevo.cost_points),
      discount_pct: nuevo.kind === "descuento" ? Number(nuevo.discount_pct) : null,
      market_value_cents: nuevo.kind === "premio" && nuevo.market_value ? Math.round(Number(nuevo.market_value) * 100) : null,
      stock: nuevo.stock === "" || nuevo.stock == null ? null : Number(nuevo.stock),
      active: true, sort_order: Number(nuevo.sort_order) || 0,
    };
    const r = await fetch(`${API}/coins/admin/rewards`, { method: "POST", headers: jsonHdr(), body: JSON.stringify(body) });
    const d = await r.json();
    if (r.ok) { setNuevo(null); load(); } else alert(d.error || "Error");
  }

  if (loading) return <div style={{ color: "rgba(237,233,224,.5)", padding: 20 }}>Cargando…</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(237,233,224,.55)" }}>Catálogo de canjes — editá costo en puntos, stock y disponibilidad.</p>
        <button style={styles.btn(true)} onClick={() => setNuevo(nuevo ? null : { kind: "descuento", stock: "" })}>{nuevo ? "Cancelar" : "+ Nuevo canje"}</button>
      </div>

      {nuevo && (
        <div style={styles.card}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            <div><label style={styles.label}>Slug</label><input style={styles.input} value={nuevo.slug || ""} onChange={e => setNuevo({ ...nuevo, slug: e.target.value })} placeholder="disc-50 / premio-x" /></div>
            <div><label style={styles.label}>Tipo</label>
              <select style={styles.input} value={nuevo.kind} onChange={e => setNuevo({ ...nuevo, kind: e.target.value })}>
                <option value="descuento">Descuento</option><option value="premio">Premio</option>
              </select>
            </div>
            <div><label style={styles.label}>Label</label><input style={styles.input} value={nuevo.label || ""} onChange={e => setNuevo({ ...nuevo, label: e.target.value })} /></div>
            <div><label style={styles.label}>Costo (pts)</label><input style={styles.input} type="number" value={nuevo.cost_points || ""} onChange={e => setNuevo({ ...nuevo, cost_points: e.target.value })} /></div>
            {nuevo.kind === "descuento"
              ? <div><label style={styles.label}>% off</label><input style={styles.input} type="number" value={nuevo.discount_pct || ""} onChange={e => setNuevo({ ...nuevo, discount_pct: e.target.value })} /></div>
              : <div><label style={styles.label}>Valor ($)</label><input style={styles.input} type="number" value={nuevo.market_value || ""} onChange={e => setNuevo({ ...nuevo, market_value: e.target.value })} /></div>}
            <div><label style={styles.label}>Stock (∞ vacío)</label><input style={styles.input} type="number" value={nuevo.stock || ""} onChange={e => setNuevo({ ...nuevo, stock: e.target.value })} /></div>
          </div>
          <button style={{ ...styles.btn(true), marginTop: 12 }} onClick={create}>Crear canje</button>
        </div>
      )}

      <table style={styles.table}>
        <thead><tr>
          <th style={styles.th}>Canje</th><th style={styles.th}>Costo</th>
          <th style={styles.th}>% / Valor</th><th style={styles.th}>Stock</th>
          <th style={styles.th}>Activo</th><th style={styles.th}>Acciones</th>
        </tr></thead>
        <tbody>{rewards.map(rw => <RewardRow key={rw.id} rw={rw} onSaved={load} onDeleted={load} />)}</tbody>
      </table>
    </div>
  );
}

// ── Tab: Puntos → Canjes (cola point_redemptions) ────────────────────────────
function RedemptionsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  function load() {
    setLoading(true);
    const url = `${API}/coins/admin/redemptions${filter !== "all" ? `?status=${filter}` : ""}`;
    fetch(url, { headers: authHdr() }).then(r => r.json()).then(d => { setRows(d.redemptions || []); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function act(id, status) {
    const r = await fetch(`${API}/coins/admin/redemptions/${id}`, { method: "PATCH", headers: jsonHdr(), body: JSON.stringify({ status }) });
    if (r.ok) load();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["pending", "Pendientes"], ["fulfilled", "Despachados"], ["cancelled", "Cancelados"], ["all", "Todos"]].map(([k, l]) => (
          <button key={k} style={styles.subtab(filter === k)} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {loading ? <div style={{ color: "rgba(237,233,224,.5)", padding: 20 }}>Cargando…</div> : rows.length === 0 ? (
        <div style={{ color: "rgba(237,233,224,.4)", padding: 20 }}>Sin canjes en este filtro.</div>
      ) : (
        <table style={styles.table}>
          <thead><tr>
            <th style={styles.th}>Cliente</th><th style={styles.th}>Canje</th><th style={styles.th}>Pts</th>
            <th style={styles.th}>Cupón</th><th style={styles.th}>Estado</th><th style={styles.th}>Acciones</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={styles.td}>
                  <div style={{ fontWeight: 700 }}>{r.user_name}</div>
                  <div style={{ fontSize: 11, color: "rgba(237,233,224,.4)" }}>{r.customer_code}</div>
                </td>
                <td style={styles.td}>{r.label || r.reward_slug}<div style={{ fontSize: 11, color: "rgba(237,233,224,.4)" }}>{r.kind}</div></td>
                <td style={styles.td}>{r.cost_points}</td>
                <td style={styles.td}>{r.coupon_code ? <code style={{ fontSize: 12, color: "var(--brand-primary, #3B82F6)" }}>{r.coupon_code}</code> : "—"}</td>
                <td style={styles.td}>{r.status}</td>
                <td style={styles.td}>
                  {r.status === "pending" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={styles.btn(true)} onClick={() => act(r.id, "fulfilled")}>Despachado</button>
                      <button style={styles.btn(false, true)} onClick={() => { if (confirm("Cancelar y devolver puntos?")) act(r.id, "cancelled"); }}>Cancelar</button>
                    </div>
                  )}
                  {r.status === "fulfilled" && (
                    <button style={styles.btn(false, true)} onClick={() => { if (confirm("Cancelar y devolver puntos?")) act(r.id, "cancelled"); }}>Cancelar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Tab: Puntos → Instagram (cola de evidencias) ─────────────────────────────
function IgQueueTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  function load() {
    setLoading(true);
    const url = `${API}/coins/admin/ig${filter !== "all" ? `?status=${filter}` : ""}`;
    fetch(url, { headers: authHdr() }).then(r => r.json()).then(d => { setRows(d.submissions || []); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  async function act(id, status) {
    const r = await fetch(`${API}/coins/admin/ig/${id}`, { method: "PATCH", headers: jsonHdr(), body: JSON.stringify({ status }) });
    if (r.ok) load(); else { const d = await r.json().catch(() => ({})); alert(d.error || "Error"); }
  }

  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(237,233,224,.55)" }}>Evidencias de acciones de Instagram. Aprobar acredita los puntos al cliente.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["pending", "Pendientes"], ["approved", "Aprobadas"], ["rejected", "Rechazadas"], ["all", "Todas"]].map(([k, l]) => (
          <button key={k} style={styles.subtab(filter === k)} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {loading ? <div style={{ color: "rgba(237,233,224,.5)", padding: 20 }}>Cargando…</div> : rows.length === 0 ? (
        <div style={{ color: "rgba(237,233,224,.4)", padding: 20 }}>Sin evidencias en este filtro.</div>
      ) : (
        <table style={styles.table}>
          <thead><tr>
            <th style={styles.th}>Cliente</th><th style={styles.th}>Acción</th><th style={styles.th}>Pts</th>
            <th style={styles.th}>Evidencia</th><th style={styles.th}>Estado</th><th style={styles.th}>Acciones</th>
          </tr></thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id}>
                <td style={styles.td}>
                  <div style={{ fontWeight: 700 }}>{s.user_name}</div>
                  <div style={{ fontSize: 11, color: "rgba(237,233,224,.4)" }}>{s.customer_code}</div>
                </td>
                <td style={styles.td}>{s.label}</td>
                <td style={styles.td}>+{s.points}</td>
                <td style={styles.td}>
                  {s.evidence_url ? <a href={s.evidence_url} target="_blank" rel="noreferrer" style={{ color: "var(--brand-primary, #3B82F6)" }}>Ver link</a> : null}
                  {s.note ? <div style={{ fontSize: 11, color: "rgba(237,233,224,.5)" }}>{s.note}</div> : null}
                  {!s.evidence_url && !s.note ? "—" : null}
                </td>
                <td style={styles.td}>{s.status}</td>
                <td style={styles.td}>
                  {s.status === "pending" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={styles.btn(true)} onClick={() => act(s.id, "approved")}>Aprobar</button>
                      <button style={styles.btn(false, true)} onClick={() => act(s.id, "rejected")}>Rechazar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
    { icon: "🎨", title: "Barra de navegación",  desc: "Logo + nombre visibles dentro del portal logueado (TopNav)",            source: "name + logo + colors" },
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
          allProducts={products}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Editor de lista repetible (beneficios / características / datos técnicos) ──
// `fields` = [{ key, placeholder, wide?, textarea? }]. Cada fila es un objeto.
function RepeatList({ title, hint, rows, fields, onAdd, onChange, onRemove, addLabel }) {
  return (
    <div style={{ marginTop: 16 }}>
      <label style={styles.label}>{title}</label>
      {hint && <div style={{ fontSize: 11, color: "rgba(237,233,224,.45)", margin: "2px 0 8px" }}>{hint}</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", background: "rgba(255,255,255,.03)", borderRadius: 6, padding: 8 }}>
            <div style={{ flex: 1, display: "grid", gap: 6 }}>
              {fields.map((f) => (
                f.textarea ? (
                  <textarea
                    key={f.key}
                    style={{ ...styles.input, minHeight: 54, resize: "vertical" }}
                    value={row[f.key] || ""}
                    onChange={(e) => onChange(i, f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                ) : (
                  <input
                    key={f.key}
                    style={{ ...styles.input, ...(f.wide ? {} : {}) }}
                    value={row[f.key] || ""}
                    onChange={(e) => onChange(i, f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                )
              ))}
            </div>
            <button style={{ ...styles.btn(false, true), padding: "4px 10px" }} onClick={() => onRemove(i)} title="Quitar">×</button>
          </div>
        ))}
      </div>
      <button style={{ ...styles.btn(), alignSelf: "start", marginTop: 8 }} onClick={onAdd}>
        {addLabel || "+ Agregar"}
      </button>
    </div>
  );
}

// ── Selector múltiple de productos (cross-sell / "incluye la línea") ──
function ProductPicker({ title, hint, options, selected, onToggle }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? options.filter((o) => o.name.toLowerCase().includes(needle) || (o.slug || "").includes(needle))
    : options;
  const bySlug = new Map(options.map((o) => [o.slug, o]));
  return (
    <div style={{ marginTop: 16 }}>
      <label style={styles.label}>{title}</label>
      {hint && <div style={{ fontSize: 11, color: "rgba(237,233,224,.45)", margin: "2px 0 8px" }}>{hint}</div>}
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {selected.map((slug) => (
            <span key={slug} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, background: "rgba(245,224,58,.15)", border: "1px solid rgba(245,224,58,.35)", borderRadius: 999, padding: "3px 10px" }}>
              {bySlug.get(slug)?.name || slug}
              <button onClick={() => onToggle(slug)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14, lineHeight: 1 }} title="Quitar">×</button>
            </span>
          ))}
        </div>
      )}
      <input style={styles.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto por nombre o slug…" />
      <div style={{ maxHeight: 200, overflowY: "auto", marginTop: 8, border: "1px solid rgba(255,255,255,.08)", borderRadius: 6 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 10, fontSize: 12, color: "rgba(237,233,224,.4)" }}>Sin resultados.</div>
        ) : filtered.map((o) => {
          const on = selected.includes(o.slug);
          return (
            <label key={o.slug} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,.04)", background: on ? "rgba(245,224,58,.08)" : "transparent" }}>
              <input type="checkbox" checked={on} onChange={() => onToggle(o.slug)} />
              {o.primary_image
                ? <img src={o.primary_image} alt="" style={{ width: 26, height: 26, objectFit: "contain", borderRadius: 4, background: "rgba(255,255,255,.04)" }} />
                : <div style={{ width: 26, height: 26, background: "rgba(255,255,255,.05)", borderRadius: 4 }} />}
              <span style={{ flex: 1, fontSize: 13 }}>{o.name}</span>
              <span style={{ fontSize: 11, color: "rgba(237,233,224,.45)" }}>{o.price_formatted || ""}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Modal: crear/editar producto ────────────────────────────────────────────
function ProductModal({ product, categories, allProducts = [], onClose, onSaved }) {
  const isNew = !product;
  // meta completo del producto: lo preservamos tal cual y sólo reescribimos la
  // sub-clave `editorial`. Así NO pisamos linea/etapa/formato/bundle/etc.
  const metaBase = product?.meta && typeof product.meta === "object" ? product.meta : {};
  const ed0 = (metaBase.editorial && typeof metaBase.editorial === "object") ? metaBase.editorial : {};
  // Secciones editoriales de la interna (todas opcionales; vacío = default).
  const [benefits, setBenefits] = useState(() =>
    Array.isArray(ed0.benefits) ? ed0.benefits.map((b) => ({ title: b.title || "", body: b.body || "" })) : []);
  const [features, setFeatures] = useState(() =>
    Array.isArray(ed0.features) ? ed0.features.map((f) => ({ emoji: f.emoji || "", title: f.title || "", body: f.body || "" })) : []);
  const [specs, setSpecs] = useState(() =>
    Array.isArray(ed0.specs) ? ed0.specs.map((s) => ({ label: s.label || "", value: s.value || "" })) : []);
  const [crossSlugs, setCrossSlugs] = useState(() =>
    Array.isArray(ed0.cross_sell_slugs) ? ed0.cross_sell_slugs.filter(Boolean) : []);
  const [bundleSlugs, setBundleSlugs] = useState(() =>
    Array.isArray(ed0.bundle_includes_slugs) ? ed0.bundle_includes_slugs.filter(Boolean) : []);
  const isBundle = metaBase.bundle === true;
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

  // ── Editores de listas repetibles (beneficios / características / specs) ──
  const mkRow = (setter, blank) => () => setter((arr) => [...arr, { ...blank }]);
  const setField = (setter) => (i, field, value) =>
    setter((arr) => arr.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  const delRow = (setter) => (i) => setter((arr) => arr.filter((_, idx) => idx !== i));

  // ── Selector de productos (cross-sell / bundle): toggle por slug ──
  function toggleSlug(setter, slug) {
    setter((arr) => (arr.includes(slug) ? arr.filter((s) => s !== slug) : [...arr, slug]));
  }

  // Arma el `meta` final: preserva todo el meta existente y sólo reescribe la
  // sub-clave `editorial` con lo que el admin cargó (omitiendo lo vacío).
  function buildMeta() {
    const clean = (arr, fields) =>
      arr
        .map((row) => fields.reduce((o, f) => ({ ...o, [f]: String(row[f] ?? "").trim() }), {}))
        .filter((row) => fields.some((f) => row[f]));
    const editorial = {};
    const b = clean(benefits, ["title", "body"]);
    const f = clean(features, ["emoji", "title", "body"]);
    const s = clean(specs, ["label", "value"]);
    if (b.length) editorial.benefits = b;
    if (f.length) editorial.features = f;
    if (s.length) editorial.specs = s;
    if (crossSlugs.length) editorial.cross_sell_slugs = crossSlugs;
    if (bundleSlugs.length) editorial.bundle_includes_slugs = bundleSlugs;

    const next = { ...metaBase };
    if (Object.keys(editorial).length) next.editorial = editorial;
    else delete next.editorial;
    return next;
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
      meta: buildMeta(),
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
              <input style={styles.input} value={img.url} onChange={(e) => updateImage(i, "url", e.target.value)} placeholder="URL de la imagen (ej: /imagenes-web/productos/race/...)" />
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

        {/* ───── Contenido de la interna (todo editable, todo opcional) ───── */}
        <div style={{ marginTop: 26, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.1)" }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 15 }}>Contenido de la página del producto</h4>
          <div style={{ fontSize: 12, color: "rgba(237,233,224,.5)" }}>
            Lo que cargues acá pisa el contenido por defecto. Si dejás una sección vacía, se usa el texto por defecto de la línea.
          </div>
        </div>

        <RepeatList
          title='Por qué elegirlo (beneficios)'
          hint='Tarjetas de "Por qué elegirlo". Título corto + descripción.'
          rows={benefits}
          fields={[
            { key: "title", placeholder: "Título del beneficio (ej: Para ciclos completos)" },
            { key: "body", placeholder: "Descripción del beneficio", textarea: true },
          ]}
          onAdd={mkRow(setBenefits, { title: "", body: "" })}
          onChange={setField(setBenefits)}
          onRemove={delRow(setBenefits)}
          addLabel="+ Agregar beneficio"
        />

        <RepeatList
          title="Características clave"
          hint="Lista con ícono (emoji) + título + descripción."
          rows={features}
          fields={[
            { key: "emoji", placeholder: "Emoji / ícono (ej: ⚖)" },
            { key: "title", placeholder: "Título (ej: pH auto-buffer)" },
            { key: "body", placeholder: "Descripción", textarea: true },
          ]}
          onAdd={mkRow(setFeatures, { emoji: "", title: "", body: "" })}
          onChange={setField(setFeatures)}
          onRemove={delRow(setFeatures)}
          addLabel="+ Agregar característica"
        />

        <RepeatList
          title="Datos técnicos"
          hint="Ficha técnica: dato + valor (ej: Composición → NPK 5-3-7)."
          rows={specs}
          fields={[
            { key: "label", placeholder: "Dato (ej: Composición)" },
            { key: "value", placeholder: "Valor (ej: NPK 5-3-7 + micros)" },
          ]}
          onAdd={mkRow(setSpecs, { label: "", value: "" })}
          onChange={setField(setSpecs)}
          onRemove={delRow(setSpecs)}
          addLabel="+ Agregar dato técnico"
        />

        <ProductPicker
          title='Sumá para acompañar (cross-sell)'
          hint="Elegí qué productos aparecen como complementarios en la interna."
          options={allProducts.filter((o) => o.slug !== slug)}
          selected={crossSlugs}
          onToggle={(s) => toggleSlug(setCrossSlugs, s)}
        />

        <ProductPicker
          title="Incluye la línea completa"
          hint={isBundle
            ? "Productos que componen este kit/línea. Vacío = se arma solo con la familia."
            : "Sólo aplica a productos marcados como kit/línea (meta.bundle). En otros no se muestra."}
          options={allProducts.filter((o) => o.slug !== slug)}
          selected={bundleSlugs}
          onToggle={(s) => toggleSlug(setBundleSlugs, s)}
        />

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
  const [carrier, setCarrier] = useState("");
  const [trackingNum, setTrackingNum] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch(`${API}/api/admin/shop/orders/${orderId}`, { headers: authHdr() });
    const d = await r.json();
    setOrder(d.order || null);
    if (d.order) { setCarrier(d.order.carrier || ""); setTrackingNum(d.order.tracking_number || ""); }
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

  // Despachar (o actualizar tracking): guarda carrier + nº de seguimiento. El
  // server dispara el email "Seguir mi envío" al socio en la transición a
  // dispatched (no re-envía si ya estaba despachado y solo se edita el nº).
  async function saveDispatch() {
    if (!carrier) { alert("Elegí un correo de envío."); return; }
    setSavingStatus("dispatched");
    const r = await fetch(`${API}/api/admin/shop/orders/${orderId}/status`, {
      method: "POST", headers: jsonHdr(),
      body: JSON.stringify({ status: "dispatched", carrier, tracking_number: trackingNum.trim() || null }),
    });
    if (r.ok) { await load(); onChanged?.(); }
    else alert("Error al guardar el envío");
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

            {/* Tracking de envío — visible desde que el pedido está pagado */}
            {["paid", "dispatched", "completed"].includes(order.status) && (
              <div style={{ ...styles.card, marginBottom: 16, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 10 }}>
                  🚚 Envío / Tracking
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={carrier} onChange={(e) => setCarrier(e.target.value)}
                    style={{ flex: "1 1 150px", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(237,233,224,.9)", fontFamily: "inherit", fontSize: 13 }}>
                    <option value="">Elegir correo…</option>
                    <option value="andreani">Andreani</option>
                    <option value="correo_argentino">Correo Argentino</option>
                    <option value="via_cargo">Vía Cargo</option>
                    <option value="propio">Envío propio</option>
                  </select>
                  <input value={trackingNum} onChange={(e) => setTrackingNum(e.target.value)} placeholder="N° de seguimiento"
                    style={{ flex: "2 1 200px", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", color: "rgba(237,233,224,.9)", fontFamily: "inherit", fontSize: 13 }} />
                  <button onClick={saveDispatch} disabled={!!savingStatus}
                    style={{ padding: "9px 16px", fontSize: 12, fontWeight: 800, borderRadius: 8, border: "none", background: "#25D366", color: "#fff", cursor: "pointer", fontFamily: "inherit", opacity: savingStatus ? 0.6 : 1, whiteSpace: "nowrap" }}>
                    {order.status === "dispatched" ? "Actualizar envío" : "Despachar y notificar"}
                  </button>
                </div>
                {order.tracking_url && (
                  <div style={{ fontSize: 12, color: "rgba(237,233,224,.6)", marginTop: 10 }}>
                    Link de seguimiento: <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-primary, #A7F5C8)" }}>{order.tracking_url}</a>
                  </div>
                )}
                <div style={{ fontSize: 11, color: "rgba(237,233,224,.45)", marginTop: 8 }}>
                  Al despachar, el socio recibe un email con el botón “Seguir mi envío”.
                </div>
              </div>
            )}

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

// ── Tab: Campañas Email (Shop F4) ───────────────────────────────────────────
// Compose + send broadcast emails a base de customers opt-in. Throttle
// (90/día / 2s gap) lo maneja el backend. Esta UI sólo orquesta.

const CAMPAIGN_TEMPLATES = {
  promo: {
    label: "🏷️ Promo / Oferta",
    subject: "Oferta exclusiva en Holistic Growshop 🌱",
    body: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,sans-serif;">
  <tr><td style="background:#0a0a0a;padding:32px;text-align:center;color:#fff;">
    <div style="font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:#A7F5C8;">HOLISTIC · GROWSHOP</div>
    <h1 style="margin:8px 0 0;font-size:28px;font-weight:900;">OFERTA EXCLUSIVA</h1>
  </td></tr>
  <tr><td style="padding:32px;color:#1a1a1a;">
    <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">¡Hola! Tenemos una oferta especial para nuestros clientes:</p>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:18px;margin:16px 0;text-align:center;">
      <div style="font-size:32px;font-weight:900;color:#15803d;">20% OFF</div>
      <div style="font-size:14px;color:#666;margin-top:4px;">En toda la línea Race · Cupón: HOLISTIC20</div>
    </div>
    <p style="text-align:center;margin:24px 0;">
      <a href="https://portal-starter.vercel.app/shop" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#25D366 0%,#2E8F6E 100%);color:#fff;text-decoration:none;font-weight:800;border-radius:999px;letter-spacing:.06em;text-transform:uppercase;font-size:13px;">Aprovechar oferta →</a>
    </p>
    <p style="font-size:13px;color:#666;text-align:center;margin:20px 0 0;">Válido hasta agotar stock.</p>
  </td></tr>
</table>`,
  },
  anuncio: {
    label: "📣 Anuncio / Update",
    subject: "Novedades de Holistic Growshop",
    body: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,sans-serif;">
  <tr><td style="background:#0a0a0a;padding:32px;text-align:center;color:#fff;">
    <div style="font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:#A7F5C8;">HOLISTIC · NOVEDADES</div>
    <h1 style="margin:8px 0 0;font-size:24px;font-weight:900;">Nuevo producto en el catálogo</h1>
  </td></tr>
  <tr><td style="padding:32px;color:#1a1a1a;">
    <p style="margin:0 0 14px;font-size:16px;line-height:1.55;">Sumamos un nuevo producto que querés conocer:</p>
    <h2 style="margin:18px 0 8px;font-size:20px;">[Nombre del producto]</h2>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#444;">[Descripción corta del producto y por qué le interesa al cliente]</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="https://portal-starter.vercel.app/shop" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#25D366 0%,#2E8F6E 100%);color:#fff;text-decoration:none;font-weight:800;border-radius:999px;letter-spacing:.06em;text-transform:uppercase;font-size:13px;">Ver en el catálogo →</a>
    </p>
  </td></tr>
</table>`,
  },
  newsletter: {
    label: "📰 Newsletter / Boletín",
    subject: "Newsletter Holistic — Tips para tu cultivo",
    body: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,sans-serif;">
  <tr><td style="background:#0a0a0a;padding:32px;text-align:center;color:#fff;">
    <div style="font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:#A7F5C8;">HOLISTIC · NEWSLETTER</div>
    <h1 style="margin:8px 0 0;font-size:24px;font-weight:900;">Tips del mes</h1>
  </td></tr>
  <tr><td style="padding:32px;color:#1a1a1a;">
    <h2 style="margin:0 0 10px;font-size:18px;color:#2E8F6E;">🌱 Tip 1: Título</h2>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#444;">[Texto del primer tip]</p>
    <h2 style="margin:0 0 10px;font-size:18px;color:#2E8F6E;">💧 Tip 2: Título</h2>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#444;">[Texto del segundo tip]</p>
    <h2 style="margin:0 0 10px;font-size:18px;color:#2E8F6E;">⚡ Tip 3: Título</h2>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#444;">[Texto del tercer tip]</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="https://portal-starter.vercel.app/shop" style="display:inline-block;padding:12px 24px;background:rgba(46,143,110,.1);color:#2E8F6E;text-decoration:none;font-weight:700;border-radius:999px;font-size:13px;">Ver catálogo</a>
    </p>
  </td></tr>
</table>`,
  },
};

const CAMPAIGN_STATUS_META = {
  draft:      { label: "Borrador",  color: "rgba(237,233,224,.6)", emoji: "📝" },
  sending:    { label: "Enviando…", color: "#fcd34d", emoji: "📡" },
  sent:       { label: "Enviada",   color: "#86efac", emoji: "✅" },
  cancelled:  { label: "Cancelada", color: "rgba(237,233,224,.4)", emoji: "🚫" },
  failed:     { label: "Falló",     color: "#fca5a5", emoji: "❌" },
};

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState({ opt_in: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState(null); // null | "new" | campaignObj
  const [detail, setDetail] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/shop/campaigns`, { headers: authHdr() });
      const d = await r.json();
      setCampaigns(d.campaigns || []);
      setSegments(d.segments || { opt_in: 0, all: 0 });
    } catch (e) { console.error(e); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Auto-refresh cada 5s mientras haya alguna campaña en estado "sending"
  useEffect(() => {
    const anySending = campaigns.some((c) => c.status === "sending");
    if (!anySending) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [campaigns.map((c) => c.status).join("|")]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Campañas de email</h2>
          <div style={{ fontSize: 12, color: "rgba(237,233,224,.55)", marginTop: 3 }}>
            {segments.opt_in} clientes opt-in · {segments.all} totales · Free tier: 90/día
          </div>
        </div>
        <button style={styles.btn(true)} onClick={() => setComposer("new")}>+ Nueva campaña</button>
      </div>

      <div style={styles.card}>
        {loading ? <div>Cargando…</div> : campaigns.length === 0 ? (
          <div style={{ color: "rgba(237,233,224,.5)", padding: "20px 0" }}>
            No hay campañas todavía. Tocá <strong>Nueva campaña</strong> para arrancar.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Campaña</th>
                <th style={styles.th}>Segmento</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Progreso</th>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const meta = CAMPAIGN_STATUS_META[c.status] || CAMPAIGN_STATUS_META.draft;
                const progress = c.total_count > 0
                  ? Math.round(((c.sent_count + c.failed_count) / c.total_count) * 100)
                  : 0;
                return (
                  <tr key={c.id} onClick={() => setDetail(c.id)} style={{ cursor: "pointer" }}>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(237,233,224,.5)" }}>{c.subject}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 11, color: "rgba(237,233,224,.7)", textTransform: "uppercase", letterSpacing: ".1em" }}>
                        {c.segment === "all" ? "Todos" : "Opt-in"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {meta.emoji} {meta.label}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {c.total_count > 0 ? (
                        <div>
                          <div style={{ fontSize: 12 }}>{c.sent_count + c.failed_count} / {c.total_count}{c.failed_count > 0 ? ` · ${c.failed_count} fallaron` : ""}</div>
                          <div style={{ width: 90, height: 5, background: "rgba(255,255,255,.06)", borderRadius: 999, marginTop: 4, overflow: "hidden" }}>
                            <div style={{ width: `${progress}%`, height: "100%", background: meta.color, transition: "width .4s" }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "rgba(237,233,224,.4)" }}>—</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12, color: "rgba(237,233,224,.6)" }}>
                        {new Date(c.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button style={styles.btn()} onClick={(e) => { e.stopPropagation(); setDetail(c.id); }}>Ver</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {composer && (
        <CampaignComposer
          campaign={composer === "new" ? null : composer}
          segments={segments}
          onClose={() => setComposer(null)}
          onSaved={() => { setComposer(null); load(); }}
        />
      )}

      {detail && (
        <CampaignDetailModal
          campaignId={detail}
          onClose={() => setDetail(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function CampaignComposer({ campaign, segments, onClose, onSaved }) {
  const [templateKind, setTemplateKind] = useState(campaign?.template_kind || "custom");
  const [name, setName] = useState(campaign?.name || "");
  const [subject, setSubject] = useState(campaign?.subject || "");
  const [bodyHtml, setBodyHtml] = useState(campaign?.body_html || "");
  const [preheader, setPreheader] = useState(campaign?.preheader || "");
  const [segment, setSegment] = useState(campaign?.segment || "opt_in");
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  function applyTemplate(kind) {
    setTemplateKind(kind);
    const tpl = CAMPAIGN_TEMPLATES[kind];
    if (tpl) {
      if (!subject) setSubject(tpl.subject);
      if (!bodyHtml || confirm("¿Reemplazar el HTML actual con el del template?")) {
        setBodyHtml(tpl.body);
      }
    }
  }

  async function save() {
    setSaving(true);
    const r = await fetch(`${API}/api/admin/shop/campaigns`, {
      method: "POST", headers: jsonHdr(),
      body: JSON.stringify({
        name: name.trim(), subject: subject.trim(),
        body_html: bodyHtml, preheader: preheader.trim() || null,
        template_kind: templateKind, segment,
      }),
    });
    setSaving(false);
    if (r.ok) onSaved();
    else { const d = await r.json(); alert(d.error || "Error al crear"); }
  }

  const audienceCount = segment === "all" ? segments.all : segments.opt_in;
  const dailyLimitReached = audienceCount > 90;

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div
        style={{ ...styles.modalCard, maxWidth: 900, maxHeight: "92vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Nueva campaña</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.btn(false)} onClick={() => setPreviewMode(!previewMode)}>
              {previewMode ? "✏️ Editar" : "👁️ Vista previa"}
            </button>
            <button style={styles.btn()} onClick={onClose}>✕</button>
          </div>
        </div>

        <label style={styles.label}>Template base</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {Object.entries(CAMPAIGN_TEMPLATES).map(([k, t]) => (
            <button
              key={k}
              onClick={() => applyTemplate(k)}
              style={{
                ...styles.btn(templateKind === k),
                padding: "9px 14px", fontSize: 12,
              }}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => setTemplateKind("custom")}
            style={{ ...styles.btn(templateKind === "custom"), padding: "9px 14px", fontSize: 12 }}
          >
            🎨 Custom
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 10, marginBottom: 8 }}>
          <div>
            <label style={styles.label}>Nombre interno *</label>
            <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Promo Race Mayo 2026" />
          </div>
          <div>
            <label style={styles.label}>Segmento</label>
            <select style={styles.input} value={segment} onChange={(e) => setSegment(e.target.value)}>
              <option value="opt_in">Solo opt-in marketing ({segments.opt_in})</option>
              <option value="all">Todos los clientes ({segments.all})</option>
            </select>
          </div>
        </div>

        <label style={styles.label}>Asunto del email *</label>
        <input style={styles.input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Lo que aparece en el inbox" />

        <label style={styles.label}>Preheader (preview en inbox)</label>
        <input style={styles.input} value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Texto chico que aparece al lado del asunto" />

        <label style={styles.label}>Contenido HTML</label>
        {previewMode ? (
          <iframe
            srcDoc={bodyHtml + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;border-top:1px solid #e5e5e5;padding-top:16px;"><tr><td style="font-family:sans-serif;font-size:11px;line-height:1.5;color:#999;text-align:center;">Recibís este email porque estás en la lista de clientes de Holistic Growshop.<br>¿No querés más? <a href="#">Darse de baja</a>.</td></tr></table>`}
            style={{ width: "100%", height: 540, border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, background: "#fff" }}
            title="Preview del email"
            sandbox=""
          />
        ) : (
          <textarea
            style={{ ...styles.input, minHeight: 320, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="Pegá HTML o tocá un template arriba"
          />
        )}

        <div style={{ marginTop: 18, padding: "14px 16px", borderRadius: 10, background: dailyLimitReached ? "rgba(252,211,77,.10)" : "rgba(167,245,200,.08)", border: `1px solid ${dailyLimitReached ? "rgba(252,211,77,.3)" : "rgba(167,245,200,.2)"}`, fontSize: 13, color: "rgba(237,233,224,.85)" }}>
          {dailyLimitReached ? (
            <>⚠️ <strong>{audienceCount} destinatarios</strong> superan el límite del free tier de Resend (90/día). Solo se mandarán los primeros 90; el resto en otra campaña.</>
          ) : (
            <>📨 Se va a mandar a <strong>{audienceCount} {audienceCount === 1 ? "destinatario" : "destinatarios"}</strong>. Throttle: ~2s entre envíos (~{Math.ceil(audienceCount * 2 / 60)} min total).</>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
          <button style={styles.btn()} onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            style={styles.btn(true)}
            onClick={save}
            disabled={saving || !name.trim() || !subject.trim() || !bodyHtml.trim()}
          >
            {saving ? "Guardando…" : "💾 Guardar borrador"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "rgba(237,233,224,.5)", textAlign: "right", marginTop: 6 }}>
          Después del save tocá <strong>Enviar</strong> desde la lista para disparar.
        </div>
      </div>
    </div>
  );
}

function CampaignDetailModal({ campaignId, onClose, onChanged }) {
  const [campaign, setCampaign] = useState(null);
  const [sends, setSends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch(`${API}/api/admin/shop/campaigns/${campaignId}`, { headers: authHdr() });
    const d = await r.json();
    setCampaign(d.campaign || null);
    setSends(d.sends || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [campaignId]);

  // Auto-refresh mientras está enviando
  useEffect(() => {
    if (campaign?.status !== "sending") return;
    const t = setInterval(load, 3500);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [campaign?.status]);

  async function doAction(action) {
    if (action === "send" && !confirm(`Enviar campaña a los destinatarios del segmento '${campaign.segment}'?`)) return;
    if (action === "cancel" && !confirm("Cancelar la campaña? Los emails ya enviados no se pueden recuperar.")) return;
    if (action === "delete" && !confirm("Borrar borrador?")) return;
    setActing(action);
    let url = `${API}/api/admin/shop/campaigns/${campaignId}`;
    let method = "POST";
    if (action === "send") url += "/send";
    else if (action === "cancel") url += "/cancel";
    else if (action === "delete") method = "DELETE";
    const r = await fetch(url, { method, headers: jsonHdr() });
    setActing("");
    if (r.ok) {
      if (action === "delete") { onChanged?.(); onClose(); }
      else { load(); onChanged?.(); }
    } else {
      const d = await r.json();
      alert(d.error || "Error");
    }
  }

  if (loading) return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>Cargando…</div>
    </div>
  );
  if (!campaign) return null;

  const meta = CAMPAIGN_STATUS_META[campaign.status] || CAMPAIGN_STATUS_META.draft;
  const progress = campaign.total_count > 0
    ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_count) * 100)
    : 0;
  const failedSends = sends.filter((s) => s.status === "failed").slice(0, 30);

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div
        style={{ ...styles.modalCard, maxWidth: 760, maxHeight: "92vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{campaign.name}</h3>
          <button style={styles.btn()} onClick={onClose}>✕</button>
        </div>

        <div style={{ ...styles.card, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(237,233,224,.5)" }}>Asunto</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>{campaign.subject}</div>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: meta.color }}>
              {meta.emoji} {meta.label}
            </span>
          </div>

          {campaign.total_count > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span>Progreso</span>
                <span style={{ fontWeight: 700 }}>
                  {campaign.sent_count} sent · {campaign.failed_count} fail · {campaign.total_count} total ({progress}%)
                </span>
              </div>
              <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,.06)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: meta.color, transition: "width .4s" }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {campaign.status === "draft" && (
            <>
              <button style={styles.btn(true)} onClick={() => doAction("send")} disabled={!!acting}>
                {acting === "send" ? "Disparando…" : "📨 Enviar ahora"}
              </button>
              <button style={styles.btn(false, true)} onClick={() => doAction("delete")} disabled={!!acting}>
                🗑️ Borrar
              </button>
            </>
          )}
          {campaign.status === "sending" && (
            <button style={styles.btn(false, true)} onClick={() => doAction("cancel")} disabled={!!acting}>
              {acting === "cancel" ? "Cancelando…" : "🛑 Cancelar envío"}
            </button>
          )}
        </div>

        {failedSends.length > 0 && (
          <div style={styles.card}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 10 }}>
              ❌ Envíos fallidos ({failedSends.length})
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Error</th>
                </tr>
              </thead>
              <tbody>
                {failedSends.map((s) => (
                  <tr key={s.id}>
                    <td style={styles.td}>{s.email_snapshot}</td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 11, color: "#fca5a5" }}>{s.error_message?.slice(0, 80) || "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", color: "rgba(237,233,224,.7)", fontSize: 12 }}>Ver HTML enviado</summary>
          <pre style={{ marginTop: 10, padding: 12, background: "rgba(0,0,0,.4)", borderRadius: 6, fontSize: 11, color: "rgba(237,233,224,.7)", maxHeight: 280, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {campaign.body_html}
          </pre>
        </details>
      </div>
    </div>
  );
}

// ── Tab: Códigos Promocionales (Shop F5) ────────────────────────────────────
function PromoCodesTab() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);  // null | "new" | rowObj

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/shop/promo-codes`, { headers: authHdr() });
      const d = await r.json();
      setCodes(d.promo_codes || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function remove(c) {
    if (!confirm(`¿Borrar código ${c.code}? Esta acción no se puede deshacer.`)) return;
    const r = await fetch(`${API}/api/admin/shop/promo-codes/${c.id}`, {
      method: "DELETE", headers: authHdr(),
    });
    if (r.ok) load(); else alert("Error al borrar");
  }
  async function toggleActive(c) {
    const r = await fetch(`${API}/api/admin/shop/promo-codes/${c.id}`, {
      method: "PUT", headers: jsonHdr(),
      body: JSON.stringify({ active: !c.active }),
    });
    if (r.ok) load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Códigos promocionales</h2>
          <div style={{ fontSize: 12, color: "rgba(237,233,224,.55)", marginTop: 3 }}>
            Aplican en /checkout. El cliente los tipea o se les manda por campaña.
          </div>
        </div>
        <button style={styles.btn(true)} onClick={() => setEditing("new")}>+ Nuevo código</button>
      </div>

      <div style={styles.card}>
        {loading ? <div>Cargando…</div> : codes.length === 0 ? (
          <div style={{ color: "rgba(237,233,224,.5)", padding: "20px 0" }}>
            Sin códigos todavía. Hacé clic en <strong>+ Nuevo código</strong> para crear el primero.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Código</th>
                <th style={styles.th}>Descuento</th>
                <th style={styles.th}>Mín. compra</th>
                <th style={styles.th}>Usos</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Expira</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id}>
                  <td style={styles.td}>
                    <code style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 14, color: "var(--brand-primary, #A7F5C8)" }}>
                      {c.code}
                    </code>
                    {c.notes && <div style={{ fontSize: 11, color: "rgba(237,233,224,.5)" }}>{c.notes}</div>}
                  </td>
                  <td style={styles.td}>
                    <strong>{c.discount_display}</strong>
                    <div style={{ fontSize: 11, color: "rgba(237,233,224,.5)" }}>
                      {c.kind === "percent" ? "porcentaje" : "monto fijo"}
                    </div>
                  </td>
                  <td style={styles.td}>
                    {c.min_subtotal_cents > 0
                      ? `$${(c.min_subtotal_cents / 100).toLocaleString("es-AR")}`
                      : "—"}
                  </td>
                  <td style={styles.td}>{c.uses_display}</td>
                  <td style={styles.td}>
                    <button
                      style={{
                        padding: "4px 10px", fontSize: 11, fontWeight: 700,
                        borderRadius: 999, border: "none", fontFamily: "inherit",
                        background: c.active ? "rgba(167,245,200,.15)" : "rgba(239,68,68,.12)",
                        color: c.active ? "#86efac" : "#fca5a5",
                        cursor: "pointer",
                      }}
                      onClick={() => toggleActive(c)}
                    >
                      {c.active ? "✓ activo" : "✗ inactivo"}
                    </button>
                  </td>
                  <td style={styles.td}>
                    {c.expires_at ? (
                      <span style={{ fontSize: 12, color: "rgba(237,233,224,.7)" }}>
                        {new Date(c.expires_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    ) : <span style={{ color: "rgba(237,233,224,.4)" }}>—</span>}
                  </td>
                  <td style={styles.td}>
                    <button style={styles.btn()} onClick={() => setEditing(c)}>Editar</button>{" "}
                    <button style={styles.btn(false, true)} onClick={() => remove(c)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <PromoCodeModal
          code={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function PromoCodeModal({ code, onClose, onSaved }) {
  const isNew = !code;
  const [c, setC] = useState({
    code: code?.code || "",
    kind: code?.kind || "percent",
    value: code?.value || (code?.kind === "fixed_cents" ? 1000 : 10),
    min_subtotal_ars: code?.min_subtotal_cents ? code.min_subtotal_cents / 100 : 0,
    max_uses: code?.max_uses || "",
    expires_at: code?.expires_at ? code.expires_at.slice(0, 10) : "",
    notes: code?.notes || "",
    active: code?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    setSaving(true);
    const payload = {
      code: c.code.trim().toUpperCase(),
      kind: c.kind,
      value: c.kind === "fixed_cents"
        ? Math.round(Number(c.value) * 100)   // ars → cents
        : Number(c.value),
      min_subtotal_cents: Math.round(Number(c.min_subtotal_ars || 0) * 100),
      max_uses: c.max_uses ? Number(c.max_uses) : null,
      expires_at: c.expires_at ? new Date(c.expires_at + "T23:59:59").toISOString() : null,
      notes: c.notes.trim() || null,
      active: c.active,
    };
    try {
      const url = isNew
        ? `${API}/api/admin/shop/promo-codes`
        : `${API}/api/admin/shop/promo-codes/${code.id}`;
      const r = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: jsonHdr(),
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Error al guardar"); setSaving(false); return; }
      onSaved();
    } catch (e) { setErr("Error de red"); }
    setSaving(false);
  }

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={{ ...styles.modalCard, maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{isNew ? "Nuevo código" : `Editar ${code.code}`}</h3>
          <button style={styles.btn()} onClick={onClose}>✕</button>
        </div>

        {err && <div style={{ padding: 10, marginBottom: 12, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.35)", borderRadius: 6, color: "#fca5a5", fontSize: 13 }}>{err}</div>}

        <label style={styles.label}>Código (el cliente lo tipea)</label>
        <input style={{ ...styles.input, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: ".08em" }}
          value={c.code} onChange={(e) => setC({ ...c, code: e.target.value })} placeholder="VERANO15" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div>
            <label style={styles.label}>Tipo</label>
            <select style={styles.input} value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value })}>
              <option value="percent">Porcentaje (%)</option>
              <option value="fixed_cents">Monto fijo (ARS)</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>{c.kind === "percent" ? "Porcentaje (1-100)" : "Monto ARS"}</label>
            <input style={styles.input} type="number" min="1" max={c.kind === "percent" ? 100 : 9999999}
              value={c.value} onChange={(e) => setC({ ...c, value: e.target.value })} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div>
            <label style={styles.label}>Compra mínima (ARS)</label>
            <input style={styles.input} type="number" min="0"
              value={c.min_subtotal_ars} onChange={(e) => setC({ ...c, min_subtotal_ars: e.target.value })}
              placeholder="0 = sin mínimo" />
          </div>
          <div>
            <label style={styles.label}>Usos máximos</label>
            <input style={styles.input} type="number" min="1"
              value={c.max_uses} onChange={(e) => setC({ ...c, max_uses: e.target.value })}
              placeholder="vacío = ilimitado" />
          </div>
        </div>

        <label style={styles.label}>Expira (opcional)</label>
        <input style={styles.input} type="date"
          value={c.expires_at} onChange={(e) => setC({ ...c, expires_at: e.target.value })} />

        <label style={styles.label}>Notas internas (admin)</label>
        <input style={styles.input} value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })}
          placeholder="Para qué se creó este código" />

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={c.active} onChange={(e) => setC({ ...c, active: e.target.checked })} />
          Código activo
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
          <button style={styles.btn()} onClick={onClose} disabled={saving}>Cancelar</button>
          <button style={styles.btn(true)} onClick={save} disabled={saving || !c.code.trim() || !c.value}>
            {saving ? "Guardando…" : (isNew ? "Crear código" : "Guardar")}
          </button>
        </div>
      </div>
    </div>
  );
}
