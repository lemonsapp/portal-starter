// client/src/pages/AdminPanel.jsx
//
// Panel admin post-wizard. Spec § 9.
// Tabs: Coins / Feed / Settings (re-abre el wizard por sección).

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useBranding, useRules } from "../lib/branding.js";
// Kit de UI del admin — tema claro estilo Tiendanube (scopeado bajo `.adm`).
import { useAdmCss, Btn, Card, Field, Badge } from "./admin/ui.jsx";
// Contenido por línea (sincronizado desde las internas) para pre-cargar los
// editores del producto con lo que HOY se muestra en la ficha del shop.
import { lineDetails, lineKeyFor } from "../data/lineDetails.js";
import { fixImageUrl } from "../lib/shopImages.js";

// Cross-sell default por línea en "Sumá para acompañar" — espeja LINE_CROSS_SELL
// de ShopProduct.jsx para que el picker del admin arranque pre-cargado.
const LINE_CROSS_DEFAULT = {
  race: ["race-3-pk-1-500ml", "race-3-pk-2-500ml"],
  pro:  ["race-4-micro-magnesio-500ml", "race-2-calcio-nitrogeno-500ml"],
};

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
const authHdr = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHdr = () => ({ ...authHdr(), "Content-Type": "application/json" });

const styles = {
  shell: {
    minHeight: "100vh",
    background: "var(--bg)",
    color: "var(--text)",
    fontFamily: "var(--brand-font, 'Gotham', system-ui, sans-serif)",
    padding: "28px 16px",
  },
  container: { maxWidth: 1180, margin: "0 auto" },
  h1: {
    fontFamily: "'Gotham', system-ui, sans-serif",
    fontSize: 24, fontWeight: 800, margin: "0 0 4px 0",
    letterSpacing: "-0.02em", color: "var(--text)",
  },
  sub: { color: "var(--text-2)", marginBottom: 22, fontSize: 13.5 },
  // overflowX auto + tabs que no encogen: en mobile la fila scrollea
  // horizontalmente dentro del panel en vez de desbordar/cortarse.
  tabs: { display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)", overflowX: "auto", WebkitOverflowScrolling: "touch" },
  tab: (active) => ({
    padding: "11px 16px",
    flex: "0 0 auto", whiteSpace: "nowrap",
    cursor: "pointer",
    fontSize: 13, fontWeight: 700, letterSpacing: 0.2,
    color: active ? "var(--accent-hover)" : "var(--text-2)",
    background: "transparent",
    border: "none", borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    fontFamily: "inherit", marginBottom: -1,
  }),
  // Sub-pestañas (Tienda → Productos/Pedidos/Feed · Config → Branding/Ajustes).
  // Estilo pill para diferenciarlas visualmente de las top-level (underline).
  subtabs: { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" },
  subtab: (active) => ({
    padding: "7px 15px", borderRadius: 999, cursor: "pointer",
    fontSize: 12, fontWeight: 700, letterSpacing: 0.2,
    color: active ? "#fff" : "var(--text-2)",
    background: active ? "var(--accent)" : "var(--surface)",
    border: `1px solid ${active ? "transparent" : "var(--border-2)"}`,
    fontFamily: "inherit",
  }),
  card: {
    padding: 20, marginBottom: 16,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14, boxShadow: "var(--sh-sm)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: { textAlign: "left", padding: "11px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--text-3)", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" },
  td: { padding: "11px 14px", borderBottom: "1px solid var(--border)" },
  btn: (primary = false, danger = false) => ({
    padding: "9px 15px",
    borderRadius: 9,
    border: `1px solid ${danger ? "var(--danger-border)" : primary ? "transparent" : "var(--border-2)"}`,
    cursor: "pointer",
    fontSize: 12.5, fontWeight: 700,
    background: danger ? "var(--surface)" : primary ? "var(--accent)" : "var(--surface)",
    color: danger ? "var(--danger)" : primary ? "#fff" : "var(--text)",
    fontFamily: "inherit",
    boxShadow: primary ? "var(--sh-sm)" : "none",
  }),
  input: {
    width: "100%", padding: "10px 12px", fontSize: 13.5,
    background: "var(--surface)",
    border: "1px solid var(--border-2)",
    borderRadius: 9, color: "var(--text)", fontFamily: "inherit",
    boxSizing: "border-box",
  },
  label: { display: "block", fontSize: 12.5, fontWeight: 700, letterSpacing: 0, textTransform: "none", color: "var(--text)", marginBottom: 6, marginTop: 12 },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", display: "grid", placeItems: "center", zIndex: 9000, padding: 16, boxSizing: "border-box", backdropFilter: "blur(2px)" },
  // maxHeight + scroll: en celular los modales altos (editor de producto) no
  // se salen del viewport; el contenido scrollea dentro de la card.
  modalCard: { background: "#ffffff", border: "1px solid rgba(17,24,39,.1)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box", boxShadow: "0 24px 60px rgba(16,24,40,.24)" },
};

// Estructura de pestañas del admin. TIENDA y CONFIGURACIÓN agrupan sub-pestañas;
// el resto abre su componente directo. Los *Tab son function declarations
// (hoisted), así que se pueden referenciar acá aunque se definan más abajo.
const ADMIN_NAV = [
  {
    key: "tienda", label: "🛒 Tienda",
    subs: [
      { key: "products", label: "Productos",    Comp: ProductsTab },
      { key: "orders",   label: "Pedidos",      Comp: OrdersTab },
      { key: "billing",  label: "Facturación",  Comp: BillingTab },
      { key: "feed",     label: "Feed",         Comp: FeedTab },
    ],
  },
  {
    key: "puntos", label: "💎 Puntos",
    subs: [
      { key: "manual",   label: "Carga manual", Comp: PuntosManualTab },
      { key: "catalogo", label: "Catálogo",     Comp: RewardsCatalogTab },
      { key: "canjes",   label: "Canjes",       Comp: RedemptionsTab },
      { key: "instagram",label: "Instagram",    Comp: IgQueueTab },
      { key: "ranking",  label: "Saldos",       Comp: CoinsTab },
    ],
  },
  { key: "clientes",  label: "👥 Clientes",     Comp: CustomersTab },
  { key: "campaigns", label: "📧 Campañas",     Comp: CampaignsTab },
  { key: "promos",    label: "🎟️ Códigos",      Comp: PromoCodesTab },
  { key: "invites",   label: "🔑 Invitaciones", Comp: InviteCodesTab },
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
  useAdmCss();

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
    // data-staff-page activa staff-mobile.css (<=768px): tablas con scroll
    // horizontal interno, grids a 1 columna, inputs capeados y root sin
    // overflow — mismo tratamiento mobile que los demás paneles staff.
    <div className="adm" style={styles.shell} data-staff-page>
      <div style={styles.container}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
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
  const [customer, setCustomer] = useState(null);   // { id, name, email, customer_code, balance, monedas_balance }
  const [earnPerPoint, setEarnPerPoint] = useState(12000);
  const [buyPrice, setBuyPrice] = useState(3600);
  const [looking, setLooking] = useState(false);
  const [lookupErr, setLookupErr] = useState("");

  // Qué saldo cargar: puntos (compra externa, tasa earn_per_point) o monedas
  // (venta de monedas por fuera de la web, tasa buy_price del pack custom).
  const [currency, setCurrency] = useState("puntos");
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
      else { setCustomer(d.user); setEarnPerPoint(d.earn_per_point || 12000); setBuyPrice(d.buy_price || 3600); }
    } catch { setLookupErr("Error de conexión"); }
    setLooking(false);
  }

  const esMonedas = currency === "monedas";
  const unidad = esMonedas ? "monedas" : "pts";
  const rate = esMonedas ? (buyPrice || 3600) : (earnPerPoint || 12000);
  const pesos = Math.max(0, Math.floor(Number(amount) || 0));
  const previewPoints = override !== ""
    ? Math.max(0, Math.floor(Number(override) || 0))
    : Math.floor(pesos / rate);

  async function submit() {
    if (!customer || previewPoints <= 0) return;
    setSubmitting(true); setErr(""); setResult(null);
    try {
      const r = await fetch(`${API}/coins/manual-credit`, {
        method: "POST", headers: jsonHdr(),
        body: JSON.stringify({
          customer_code: customer.customer_code,
          amount_pesos: pesos,
          canal, descripcion, currency,
          points_override: override === "" ? undefined : override,
        }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "Error al acreditar");
      else {
        setResult(d);
        setCustomer({ ...customer, [esMonedas ? "monedas_balance" : "balance"]: d.new_balance });
        setAmount(""); setDescripcion(""); setOverride("");
      }
    } catch { setErr("Error de conexión"); }
    setSubmitting(false);
  }

  return (
    <div>
      <div style={styles.card}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>Carga manual de puntos y monedas</h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(90,102,117,.55)" }}>
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
              <div style={{ fontSize: 12, color: "rgba(90,102,117,.55)" }}>{customer.email} · {customer.customer_code}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "rgba(90,102,117,.4)" }}>Saldos</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: "var(--brand-primary, #3B82F6)" }}>💎 {customer.balance} pts</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#f59e0b" }}>🪙 {customer.monedas_balance ?? 0} monedas</div>
            </div>
          </div>

          <label style={styles.label}>Qué cargar</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[["puntos", "💎 Puntos"], ["monedas", "🪙 Monedas"]].map(([val, lbl]) => (
              <button key={val} onClick={() => setCurrency(val)}
                style={{ ...styles.btn(currency === val), flex: 1 }}>
                {lbl}
              </button>
            ))}
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

          <label style={styles.label}>{esMonedas ? "Monedas" : "Puntos"} a acreditar — override (opcional)</label>
          <input style={styles.input} type="number" min="0" placeholder={`auto: ${previewPoints}`} value={override} onChange={(e) => setOverride(e.target.value)} />

          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: esMonedas ? "rgba(245,158,11,.12)" : "rgba(59,130,246,.12)", border: `1px solid ${esMonedas ? "rgba(245,158,11,.3)" : "rgba(59,130,246,.25)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "rgba(90,102,117,.8)" }}>Se acreditarán</span>
            <span style={{ fontWeight: 900, fontSize: 20, color: esMonedas ? "#f59e0b" : "var(--brand-primary, #3B82F6)" }}>+{previewPoints} {unidad}</span>
          </div>
          <div style={{ fontSize: 11, color: "rgba(90,102,117,.45)", marginTop: 6 }}>
            {esMonedas
              ? `1 moneda cada $${rate.toLocaleString("es-AR")} (precio del pack de monedas) · redondeo hacia abajo.`
              : `1 punto cada $${rate.toLocaleString("es-AR")} · redondeo hacia abajo.`}
          </div>

          {err && <p style={{ color: "#fca5a5", fontSize: 13, marginTop: 10 }}>{err}</p>}
          <button style={{ ...styles.btn(true), marginTop: 14, width: "100%", padding: "11px" }} onClick={submit} disabled={submitting || previewPoints <= 0}>
            {submitting ? "Acreditando…" : `Acreditar +${previewPoints} ${unidad}`}
          </button>
        </div>
      )}

      {result && (
        <div style={{ ...styles.card, borderColor: "rgba(34,197,94,.4)", background: "rgba(34,197,94,.06)" }}>
          ✓ Acreditados <b>+{result.points_credited} {result.currency === "monedas" ? "monedas 🪙" : "pts 💎"}</b> a <b>{result.user.name}</b>. Nuevo saldo: <b>{result.new_balance} {result.currency === "monedas" ? "monedas" : "pts"}</b>.
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
        <div style={{ fontSize: 11, color: "rgba(90,102,117,.4)" }}>{rw.slug} · {rw.kind}</div>
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

  if (loading) return <div style={{ color: "rgba(90,102,117,.5)", padding: 20 }}>Cargando…</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(90,102,117,.55)" }}>Catálogo de canjes — editá costo en puntos, stock y disponibilidad.</p>
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
      {loading ? <div style={{ color: "rgba(90,102,117,.5)", padding: 20 }}>Cargando…</div> : rows.length === 0 ? (
        <div style={{ color: "rgba(90,102,117,.4)", padding: 20 }}>Sin canjes en este filtro.</div>
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
                  <div style={{ fontSize: 11, color: "rgba(90,102,117,.4)" }}>{r.customer_code}</div>
                </td>
                <td style={styles.td}>{r.label || r.reward_slug}<div style={{ fontSize: 11, color: "rgba(90,102,117,.4)" }}>{r.kind}</div></td>
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
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "rgba(90,102,117,.55)" }}>Evidencias de acciones de Instagram. Aprobar acredita los puntos al cliente.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["pending", "Pendientes"], ["approved", "Aprobadas"], ["rejected", "Rechazadas"], ["all", "Todas"]].map(([k, l]) => (
          <button key={k} style={styles.subtab(filter === k)} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {loading ? <div style={{ color: "rgba(90,102,117,.5)", padding: 20 }}>Cargando…</div> : rows.length === 0 ? (
        <div style={{ color: "rgba(90,102,117,.4)", padding: 20 }}>Sin evidencias en este filtro.</div>
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
                  <div style={{ fontSize: 11, color: "rgba(90,102,117,.4)" }}>{s.customer_code}</div>
                </td>
                <td style={styles.td}>{s.label}</td>
                <td style={styles.td}>+{s.points}</td>
                <td style={styles.td}>
                  {s.evidence_url && /^https?:\/\//i.test(s.evidence_url) ? <a href={s.evidence_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-primary, #3B82F6)" }}>Ver link</a> : s.evidence_url ? <span style={{ fontSize: 11, color: "rgba(90,102,117,.5)", wordBreak: "break-all" }}>{s.evidence_url}</span> : null}
                  {s.note ? <div style={{ fontSize: 11, color: "rgba(90,102,117,.5)" }}>{s.note}</div> : null}
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
  const [historyUser, setHistoryUser] = useState(null); // user del modal de historial

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
              <th style={styles.th}>💎 Puntos</th>
              <th style={styles.th}>🪙 Monedas</th>
              <th style={styles.th}>Total ganado</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td style={styles.td} colSpan={8}>Cargando…</td></tr>}
            {!loading && users.length === 0 && <tr><td style={styles.td} colSpan={8}>(sin users)</td></tr>}
            {users.map(u => (
              <tr key={u.id}>
                <td style={styles.td}>{u.id}</td>
                <td style={styles.td}>{u.name}</td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}><Pill>{u.role}</Pill></td>
                <td style={{ ...styles.td, fontWeight: 700, color: "var(--brand-primary, #3B82F6)" }}>{u.balance}</td>
                <td style={{ ...styles.td, fontWeight: 700, color: "#f59e0b" }}>{u.monedas_balance}</td>
                <td style={styles.td}>{u.total_earned}</td>
                <td style={styles.td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={styles.btn()} onClick={() => setHistoryUser(u)}>📜 Historial</button>
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
      {historyUser && <TxHistoryModal user={historyUser} onClose={() => setHistoryUser(null)} />}
    </div>
  );
}

// Etiquetas legibles para cada tipo de movimiento de coin_transactions.
// El "cómo lo ganó" sale de acá: cada origen (compra web, Instagram, carga
// manual, regalo del admin, etc.) tiene su tipo propio en la DB.
const TX_TYPE_LABELS = {
  compra_web:      "Compra en la tienda web",
  compra_externa:  "Compra externa (carga manual)",
  accion_ig:       "Acción de Instagram",
  gift:            "Regalo del admin",
  adjust:          "Ajuste del admin",
  earn:            "Actividad del portal",
  canje_descuento: "Canje de descuento",
  canje_premio:    "Canje de premio",
  correccion:      "Devolución por canje cancelado",
  redeem:          "Canje",
  spend:           "Gasto en el portal",
  compra_monedas:  "Compra de pack de monedas",
  pago_pedido:     "Pago de pedido con monedas",
  devolucion_pedido: "Devolución de pedido",
};
const txLabel = (type) => TX_TYPE_LABELS[type] || type;

// Modal de historial: cuántos puntos/monedas tiene el cliente y CÓMO los ganó
// y gastó. Arriba el desglose por origen (todo el historial, calculado en el
// server); abajo los últimos 100 movimientos con fecha, detalle y monto.
function TxHistoryModal({ user, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/admin/users/${user.id}/transactions`, { headers: authHdr() })
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); else setErr(d.error || "Error al cargar historial"); })
      .catch(() => setErr("Error de red"));
  }, [user.id]);

  const CUR = { puntos: { icon: "💎", color: "var(--brand-primary, #3B82F6)" }, monedas: { icon: "🪙", color: "#f59e0b" } };
  const summary = data?.summary || [];
  const earnedRows = summary.filter(s => Number(s.earned) > 0);
  const spentRows  = summary.filter(s => Number(s.spent) < 0);

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={{ ...styles.modalCard, maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Historial de {user.name}</div>
        <div style={{ color: "rgba(90,102,117,.55)", fontSize: 13, marginBottom: 14 }}>
          {user.email} · saldo actual: <b style={{ color: CUR.puntos.color }}>💎 {user.balance} puntos</b> · <b style={{ color: CUR.monedas.color }}>🪙 {user.monedas_balance} monedas</b>
        </div>

        {err && <div style={{ padding: 10, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 6, fontSize: 12, color: "#fca5a5" }}>{err}</div>}
        {!data && !err && <div style={{ color: "rgba(90,102,117,.5)", fontSize: 13 }}>Cargando…</div>}

        {data && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Cómo los ganó</div>
            {earnedRows.length === 0 && <div style={{ color: "rgba(90,102,117,.5)", fontSize: 12, marginBottom: 10 }}>(todavía no ganó puntos ni monedas)</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {earnedRows.map((s, i) => (
                <span key={i} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid var(--border, rgba(17,24,39,.12))", background: "rgba(34,197,94,.06)" }}>
                  {CUR[s.currency]?.icon || ""} {txLabel(s.type)}: <b style={{ color: "#16a34a" }}>+{s.earned}</b> <span style={{ color: "rgba(90,102,117,.5)" }}>({s.count}×)</span>
                </span>
              ))}
            </div>

            {spentRows.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Cómo los gastó</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {spentRows.map((s, i) => (
                    <span key={i} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, border: "1px solid var(--border, rgba(17,24,39,.12))", background: "rgba(239,68,68,.05)" }}>
                      {CUR[s.currency]?.icon || ""} {txLabel(s.type)}: <b style={{ color: "#dc2626" }}>{s.spent}</b>
                    </span>
                  ))}
                </div>
              </>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Movimientos ({data.transactions.length}{data.transactions.length === 100 ? " últimos" : ""})</div>
            {data.transactions.length === 0 && <div style={{ color: "rgba(90,102,117,.5)", fontSize: 12 }}>(sin movimientos)</div>}
            <table style={styles.table}>
              <tbody>
                {data.transactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ ...styles.td, whiteSpace: "nowrap", fontSize: 11, color: "rgba(90,102,117,.55)" }}>{new Date(tx.created_at).toLocaleDateString("es-AR")}</td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: 600, fontSize: 12.5 }}>{txLabel(tx.type)}</div>
                      {tx.reason && <div style={{ fontSize: 11.5, color: "rgba(90,102,117,.6)" }}>{tx.reason}</div>}
                    </td>
                    <td style={{ ...styles.td, whiteSpace: "nowrap", textAlign: "right", fontWeight: 700, color: tx.amount >= 0 ? "#16a34a" : "#dc2626" }}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount} {CUR[tx.currency]?.icon || "💎"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <button style={styles.btn()} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function CoinModal({ modal, onClose, onSuccess }) {
  const { user, action } = modal;
  const [amount, setAmount] = useState(action === "gift" ? "100" : "0");
  const [reason, setReason] = useState("");
  // Qué saldo tocar: puntos (coins.balance) o monedas (coins.monedas_balance).
  const [currency, setCurrency] = useState("puntos");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setErr(""); setSubmitting(true);
    try {
      const r = await fetch(`${API}/admin/users/${user.id}/coins`, {
        method: "POST", headers: jsonHdr(),
        body: JSON.stringify({ action, amount: parseInt(amount, 10) || 0, currency, reason: reason || (action === "gift" ? "Regalo del admin" : "Ajuste manual") }),
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
        <div style={{ color: "rgba(90,102,117,.55)", fontSize: 13, marginBottom: 16 }}>
          {user.name} · {user.email} · 💎 <b>{user.balance}</b> puntos · 🪙 <b>{user.monedas_balance ?? 0}</b> monedas
        </div>

        <label style={styles.label}>Moneda</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[["puntos", "💎 Puntos"], ["monedas", "🪙 Monedas"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setCurrency(val)}
              style={{ ...styles.btn(currency === val), flex: 1 }}>
              {lbl}
            </button>
          ))}
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
  const c = children === "admin" ? "#ef4444" : children === "operator" ? "#f59e0b" : "rgba(90,102,117,.5)";
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
        {!loading && posts.length === 0 && <div style={{ color: "rgba(90,102,117,.5)" }}>(sin posts)</div>}
        {posts.map(p => (
          <div key={p.id} style={{ padding: 14, borderTop: "1px solid rgba(17,24,39,.06)", display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <Pill>{p.type}</Pill>
                <span style={{ fontSize: 11, color: "rgba(90,102,117,.4)" }}>{new Date(p.created_at).toLocaleString("es-AR")}</span>
                {p.expires_at && <span style={{ fontSize: 11, color: "#f59e0b" }}>expira: {new Date(p.expires_at).toLocaleString("es-AR")}</span>}
              </div>
              {p.title && <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.title}</div>}
              {p.body && <div style={{ fontSize: 13, color: "rgba(90,102,117,.7)", whiteSpace: "pre-wrap" }}>{p.body}</div>}
              {p.media_url && <div style={{ fontSize: 11, color: "rgba(90,102,117,.45)", marginTop: 4, wordBreak: "break-all" }}>📎 {p.media_url}</div>}
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
        <div style={{ fontSize: 12, color: "rgba(90,102,117,.5)", marginBottom: 16 }}>Sólo lectura. Para editar, abrí el wizard de configuración.</div>

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
        <div style={{ fontSize: 12, color: "rgba(90,102,117,.5)", marginBottom: 16 }}>Mockups que reflejan el branding actual (datos reales del backend).</div>

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
        <div style={{ fontSize: 12, color: "rgba(90,102,117,.5)", marginBottom: 14 }}>Cuando edités <code style={{ background: "rgba(17,24,39,.08)", padding: "1px 5px", borderRadius: 3 }}>name</code> / <code style={{ background: "rgba(17,24,39,.08)", padding: "1px 5px", borderRadius: 3 }}>logo</code> / <code style={{ background: "rgba(17,24,39,.08)", padding: "1px 5px", borderRadius: 3 }}>colors</code>, se propaga al instante (cache 30s).</div>

        <div style={{ display: "grid", gap: 8 }}>
          {propagationTargets.map(t => (
            <div key={t.title} style={{ display: "flex", gap: 12, padding: "10px 12px", background: "rgba(17,24,39,.02)", borderRadius: 6, alignItems: "flex-start" }}>
              <div style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>{t.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "rgba(90,102,117,.55)", marginTop: 2 }}>{t.desc}</div>
                <div style={{ fontSize: 10, color: "rgba(90,102,117,.35)", marginTop: 3, fontFamily: "monospace" }}>← {t.source}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(17,24,39,.08)" }}>
          <button style={styles.btn(true)} onClick={() => navigate("/admin/setup?section=branding")}>✏️ Editar branding en el wizard →</button>
        </div>
      </div>
    </div>
  );
}

function BrandingField({ label, value, mono = false, ellipsis = false }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(90,102,117,.4)", marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 13,
        fontFamily: mono ? "monospace" : "inherit",
        color: value ? "rgba(90,102,117,.9)" : "rgba(90,102,117,.35)",
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
      style={{ background: "transparent", border: "1px solid rgba(17,24,39,.08)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 4, cursor: "pointer", fontFamily: "inherit", color: "inherit" }}>
      <div style={{ width: 60, height: 40, background: hex, borderRadius: 4, border: "1px solid rgba(0,0,0,.2)" }} />
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(90,102,117,.5)" }}>{label}</div>
      <div style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(90,102,117,.85)" }}>{copied ? "copiado!" : hex}</div>
    </button>
  );
}

function PreviewCard({ title, children }) {
  return (
    <div style={{ background: "rgba(0,0,0,.3)", border: "1px solid rgba(17,24,39,.06)", borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(90,102,117,.45)", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Tab: Settings ───────────────────────────────────────────────────────────
function SettingsTab() {
  const [status, setStatus] = useState(null);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API}/api/admin/config/status`, { headers: authHdr() })
      .then(r => r.json()).then(d => setStatus(d.status || null)).catch(() => {});
  }, []);

  async function sendTest() {
    setTesting(true); setTestRes(null);
    try {
      const r = await fetch(`${API}/api/admin/shop/test-email`, {
        method: "POST", headers: jsonHdr(), body: JSON.stringify({ to: testTo.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setTestRes({ ok: false, msg: d.error || "Error del servidor." }); }
      else {
        const res = d.result || {};
        if (res.ok) setTestRes({ ok: true, msg: `✓ Email enviado a ${testTo.trim()}. Revisá la bandeja (y el spam).` });
        else if (res.skipped) setTestRes({ ok: false, msg: "Resend NO está configurado (falta la API key o el email remitente). Configuralo en el wizard → sección Resend." });
        else setTestRes({ ok: false, msg: `Resend rechazó el envío: ${res.error}. Suele ser el dominio del remitente sin verificar en Resend (verificá tu dominio en resend.com).` });
      }
    } catch { setTestRes({ ok: false, msg: "Error de red." }); }
    setTesting(false);
  }

  return (
    <div>
      <div style={styles.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Estado del setup</div>
        {!status && <div>Cargando…</div>}
        {status && (
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(status).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(17,24,39,.02)", borderRadius: 6, fontSize: 13 }}>
                <span style={{ textTransform: "capitalize" }}>{k}</span>
                <span style={{ color: v ? "#22c55e" : "rgba(90,102,117,.4)" }}>{v ? "✓ configurado" : "— pendiente"}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <button style={styles.btn(true)} onClick={() => navigate("/admin/setup")}>Abrir el wizard de configuración →</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "rgba(90,102,117,.5)" }}>
          El wizard te permite editar cada sección (Cloudinary, Marca, Resend, Telegram, Reglas) de forma individual.
          Los cambios se aplican al instante (con cache-bust del frontend al recargar).
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>📧 Probar envío de email</div>
        <div style={{ fontSize: 12, color: "rgba(90,102,117,.6)", marginBottom: 12 }}>
          Mandá un email de prueba para verificar que Resend está configurado. Si falla, el resultado te dice exactamente por qué.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...styles.input, maxWidth: 320 }} type="email" placeholder="tu@email.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <button style={styles.btn(true)} disabled={testing || !testTo.trim()} onClick={sendTest}>
            {testing ? "Enviando…" : "Enviar test"}
          </button>
        </div>
        {testRes && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, fontSize: 13, lineHeight: 1.5, background: testRes.ok ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.08)", border: `1px solid ${testRes.ok ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}`, color: testRes.ok ? "#15803d" : "#b42318" }}>
            {testRes.msg}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Productos (Shop fase 1) ────────────────────────────────────────────
// Lista + CRUD de productos. Imágenes por URL (file upload llega en fase 2).

// Agrupa el catálogo como lo ve la tienda: 1 tarjeta por familia de medidas
// (famKeyOf) o por producto suelto. `products` ya viene ordenado por sort_order
// del server, así que el orden de aparición acá ES el orden de la tienda.
function catalogCards(products) {
  const buckets = new Map();
  const order = [];
  for (const p of products) {
    const key = famKeyOf(p.meta) || `solo:${p.slug}`;
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
    buckets.get(key).push(p);
  }
  return order.map((key) => {
    const items = buckets.get(key);
    // Cabecera = la medida destacada si hay (igual que la tarjeta del shop).
    const head = items.find((p) => p.meta?.medida_destacada === true) || items[0];
    return { key, items, head };
  });
}

function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // null = no modal | "new" | productObj
  const [err, setErr] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | hidden | featured
  // Modo "Ordenar tienda": buffer local de tarjetas (familias) reordenables.
  // Nada pega al server hasta "Guardar orden".
  const [ordering, setOrdering] = useState(false);
  const [cards, setCards] = useState([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const dragIdx = useRef(-1);
  useAdmCss();

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

  // One-shot: resube a Cloudinary las imágenes que todavía son archivos de
  // carpeta y reapunta las filas, para poder editarlas desde el panel. El host
  // = origin actual (de ahí Cloudinary baja los renders). Idempotente + backup.
  async function migrateImages() {
    if (!confirm(
      "¿Subir todas las imágenes de producto a Cloudinary y dejarlas editables desde el panel?\n\n" +
      "Es idempotente (saltea las que ya están en Cloudinary) y guarda un backup de las viejas. " +
      "Puede tardar ~1 minuto."
    )) return;
    setMigrating(true); setMigrateMsg("");
    try {
      const r = await fetch(`${API}/api/admin/shop/migrate-images-to-cloudinary`, {
        method: "POST", headers: jsonHdr(),
        body: JSON.stringify({ host: window.location.origin }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMigrateMsg("Error: " + (d.error || "falló la migración"));
      } else {
        setMigrateMsg(
          `Listo · ${d.updated} filas migradas (${d.uploadedFiles} archivos subidos) · ` +
          `${d.skipped} ya estaban en Cloudinary · ${d.failed} con error`
        );
        load();
      }
    } catch (e) {
      setMigrateMsg("Error de red en la migración");
    }
    setMigrating(false);
  }

  function startOrdering() {
    setCards(catalogCards(products));
    setOrdering(true);
    setErr("");
    setMigrateMsg("");
  }
  const moveCard = (i, dir) => setCards((a) => {
    const j = i + dir;
    if (j < 0 || j >= a.length) return a;
    const n = [...a];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  // Drag & drop nativo (desktop). En touch quedan las flechas.
  const onDragStart = (i) => (e) => { dragIdx.current = i; e.dataTransfer.effectAllowed = "move"; };
  const onDragOver = (i) => (e) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === -1 || from === i) return;
    setCards((a) => {
      const n = [...a];
      const [moved] = n.splice(from, 1);
      n.splice(i, 0, moved);
      return n;
    });
    dragIdx.current = i;
  };
  const onDragEnd = () => { dragIdx.current = -1; };

  async function saveOrder() {
    setSavingOrder(true);
    setErr("");
    try {
      // Familias expandidas: la posición de la primera variante define dónde
      // aparece la tarjeta en la tienda; las medidas viajan juntas.
      const order = cards.flatMap((c) => c.items.map((p) => p.id));
      const r = await fetch(`${API}/api/admin/shop/products/reorder`, {
        method: "POST", headers: jsonHdr(), body: JSON.stringify({ order }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "No se pudo guardar el orden");
      } else {
        setOrdering(false);
        await load();
      }
    } catch {
      setErr("Error de red al guardar el orden");
    }
    setSavingOrder(false);
  }

  const needle = q.trim().toLowerCase();
  const counts = {
    all: products.length,
    active: products.filter((p) => p.active).length,
    hidden: products.filter((p) => !p.active).length,
    featured: products.filter((p) => p.featured).length,
  };
  const filtered = products.filter((p) => {
    if (statusFilter === "active" && !p.active) return false;
    if (statusFilter === "hidden" && p.active) return false;
    if (statusFilter === "featured" && !p.featured) return false;
    if (needle && !`${p.name} ${p.slug} ${p.sku || ""}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const FILTERS = [
    { k: "all", label: "Todos" },
    { k: "active", label: "Activos" },
    { k: "hidden", label: "Ocultos" },
    { k: "featured", label: "Destacados" },
  ];

  return (
    <div style={{ margin: "2px 0" }}>
      <div className="adm-spread" style={{ marginBottom: 16 }}>
        <div>
          <div className="adm-h1">Productos</div>
          <div className="adm-sub">{counts.all} en el catálogo · {counts.active} publicados</div>
        </div>
        <div className="adm-toolbar">
          {ordering ? (
            <>
              <Btn size="sm" disabled={savingOrder} onClick={() => setOrdering(false)}>Cancelar</Btn>
              <Btn variant="primary" disabled={savingOrder} onClick={saveOrder}>
                {savingOrder ? "Guardando…" : "Guardar orden"}
              </Btn>
            </>
          ) : (
            <>
              <Btn size="sm" disabled={loading || products.length < 2} onClick={startOrdering} title="Elegí qué publicación aparece primera en la tienda">
                ↕ Ordenar tienda
              </Btn>
              <Btn size="sm" disabled={migrating} onClick={migrateImages} title="Sube a Cloudinary las imágenes que todavía son archivos de carpeta, para poder editarlas desde el panel">
                {migrating ? "Migrando…" : "☁ Migrar imágenes"}
              </Btn>
              <Btn variant="primary" onClick={() => setEditing("new")}>+ Nuevo producto</Btn>
            </>
          )}
        </div>
      </div>

      {migrateMsg && <div className={`adm-alert ${migrateMsg.startsWith("Error") ? "adm-alert--err" : "adm-alert--ok"}`} style={{ marginBottom: 12 }}>{migrateMsg}</div>}
      {err && <div className="adm-alert adm-alert--err" style={{ marginBottom: 12 }}>{err}</div>}

      {ordering ? (
        <div className="adm-card">
          <div className="adm-card__bd" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="adm-help" style={{ marginTop: 0 }}>
              Este es el orden en que se ven las publicaciones en la tienda: la primera de la
              lista aparece primera. Arrastrá las filas o usá las flechas (las medidas de una
              misma familia se mueven juntas). Nada cambia hasta tocar <strong>Guardar orden</strong>.
            </div>
          </div>
          {cards.map((c, i) => {
            const img = c.head.primary_image || c.items.find((p) => p.primary_image)?.primary_image;
            const formatos = c.items.map((p) => p.meta?.formato).filter(Boolean);
            const hidden = c.items.every((p) => !p.active);
            return (
              <div
                key={c.key}
                draggable
                onDragStart={onDragStart(i)}
                onDragOver={onDragOver(i)}
                onDragEnd={onDragEnd}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 16px", borderBottom: "1px solid var(--border)",
                  cursor: "grab", opacity: hidden ? 0.55 : 1,
                }}
              >
                <span className="adm-mono" style={{ width: 26, textAlign: "right", color: "var(--text-3)", fontSize: 12, flex: "0 0 auto" }}>{i + 1}</span>
                {img
                  ? <img src={fixImageUrl(img)} alt="" className="adm-thumb" draggable={false} />
                  : <div className="adm-thumb adm-thumb--ph">🖼</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{c.head.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                    {c.items.length > 1
                      ? `${c.items.length} medidas${formatos.length ? ` · ${formatos.join(" / ")}` : ""}`
                      : `/${c.head.slug}`}
                    {hidden ? " · Oculto en la tienda" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                  <Btn size="sm" disabled={i === 0} onClick={() => moveCard(i, -1)} title="Subir">↑</Btn>
                  <Btn size="sm" disabled={i === cards.length - 1} onClick={() => moveCard(i, 1)} title="Bajar">↓</Btn>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <div className="adm-card">
        <div className="adm-card__bd adm-spread" style={{ borderBottom: "1px solid var(--border)", gap: 12 }}>
          <div className="adm-search" style={{ flex: "1 1 240px", minWidth: 0 }}>
            <span className="adm-search__i">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            </span>
            <input className="adm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, slug o SKU…" />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTERS.map((f) => (
              <button key={f.k} onClick={() => setStatusFilter(f.k)} className={`adm-btn adm-btn--sm ${statusFilter === f.k ? "adm-btn--primary" : "adm-btn--ghost"}`}>
                {f.label} <span style={{ opacity: 0.7 }}>{counts[f.k]}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="adm-empty">Cargando catálogo…</div>
        ) : filtered.length === 0 ? (
          <div className="adm-empty">
            <div className="adm-empty__ic">📦</div>
            {products.length === 0
              ? <>Todavía no hay productos. Tocá <strong>+ Nuevo producto</strong> para publicar el primero.</>
              : <>Ningún producto coincide con la búsqueda o el filtro.</>}
          </div>
        ) : (
          <div className="adm-tablewrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th style={{ width: 56 }}></th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.primary_image
                        ? <img src={fixImageUrl(p.primary_image)} alt="" className="adm-thumb" />
                        : <div className="adm-thumb adm-thumb--ph">🖼</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div className="adm-mono" style={{ fontSize: 11.5, color: "var(--text-3)" }}>/{p.slug}{p.featured ? " · ⭐" : ""}</div>
                    </td>
                    <td>{p.category?.name || <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                    <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{p.price_formatted}</td>
                    <td>
                      {p.stock == null
                        ? <Badge tone="muted">∞</Badge>
                        : p.stock <= 0
                          ? <Badge tone="danger">Sin stock</Badge>
                          : p.stock <= 5
                            ? <Badge tone="warn">{p.stock}</Badge>
                            : <span>{p.stock}</span>}
                    </td>
                    <td>{p.active ? <Badge tone="ok"><span className="adm-dot" />Activo</Badge> : <Badge tone="muted">Oculto</Badge>}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <Btn size="sm" onClick={() => setEditing(p)}>Editar</Btn>
                        <Btn size="sm" variant="danger" onClick={() => remove(p)} title="Borrar">🗑</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {editing && (
        <ProductModal
          product={editing === "new" ? null : editing}
          categories={categories}
          allProducts={products}
          onClose={() => setEditing(null)}
          onSaved={() => { load(); }}
        />
      )}
    </div>
  );
}

// ── Editor de lista repetible (beneficios / características / datos técnicos) ──
// `fields` = [{ key, placeholder, wide?, textarea? }]. Cada fila es un objeto.
function RepeatList({ title, hint, rows, fields, onAdd, onChange, onRemove, addLabel }) {
  return (
    <div>
      {(title || hint) && (
        <div style={{ marginBottom: 10 }}>
          {title && <div className="adm-label" style={{ marginBottom: hint ? 3 : 0 }}>{title}</div>}
          {hint && <div className="adm-help" style={{ marginTop: 0 }}>{hint}</div>}
        </div>
      )}
      <div className="adm-rep">
        {rows.map((row, i) => (
          <div key={i} className="adm-rep__row">
            <div className="adm-rep__fields">
              {fields.map((f) => (
                f.textarea ? (
                  <textarea
                    key={f.key}
                    className="adm-textarea"
                    style={{ minHeight: 56 }}
                    value={row[f.key] || ""}
                    onChange={(e) => onChange(i, f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                ) : (
                  <input
                    key={f.key}
                    className="adm-input"
                    value={row[f.key] || ""}
                    onChange={(e) => onChange(i, f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                )
              ))}
            </div>
            <Btn size="sm" variant="danger" onClick={() => onRemove(i)} title="Quitar">×</Btn>
          </div>
        ))}
      </div>
      <Btn size="sm" onClick={onAdd} style={{ marginTop: 10 }}>{addLabel || "+ Agregar"}</Btn>
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
    <div>
      {(title || hint) && (
        <div style={{ marginBottom: 8 }}>
          {title && <div className="adm-label" style={{ marginBottom: hint ? 3 : 0 }}>{title}</div>}
          {hint && <div className="adm-help" style={{ marginTop: 0 }}>{hint}</div>}
        </div>
      )}
      {selected.length > 0 && (
        <div className="adm-chips">
          {selected.map((slug) => (
            <span key={slug} className="adm-chip">
              {bySlug.get(slug)?.name || slug}
              <button onClick={() => onToggle(slug)} title="Quitar">×</button>
            </span>
          ))}
        </div>
      )}
      <input className="adm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto por nombre o slug…" />
      <div className="adm-picklist">
        {filtered.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12.5, color: "var(--text-3)" }}>Sin resultados.</div>
        ) : filtered.map((o) => {
          const on = selected.includes(o.slug);
          return (
            <label key={o.slug} className={`adm-pickrow ${on ? "is-on" : ""}`}>
              <input type="checkbox" checked={on} onChange={() => onToggle(o.slug)} />
              {o.primary_image
                ? <img src={fixImageUrl(o.primary_image)} alt="" className="adm-thumb" style={{ width: 28, height: 28 }} />
                : <div className="adm-thumb adm-thumb--ph" style={{ width: 28, height: 28, fontSize: 12 }}>🖼</div>}
              <span style={{ flex: 1, fontSize: 13 }}>{o.name}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>{o.price_formatted || ""}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Modal: crear/editar producto ────────────────────────────────────────────
// Orden canónico de medidas (para listar las variantes de una familia).
const FORMATO_ORDER = ["25g", "100g", "500g", "1kg", "250ml", "500ml", "1L", "5L", "10L", "20L"];

// Clave de familia (espeja variantGroup del server): agrupa las variantes que
// son "la misma cosa en otra medida". null = no es variante de familia (kit,
// combo o producto sin formato).
function famKeyOf(meta = {}) {
  if (!meta || meta.bundle || meta.tipo === "combo") return null;
  if (!meta.formato) return null;
  const l = meta.linea;
  if (l === "race")  return `race-${meta.etapa}${meta.parte ? "-" + meta.parte : ""}`;
  if (l === "pro")   return `pro-${meta.etapa}`;
  if (l === "elite") return meta.tipo === "bidon"
        ? `elite-max-${String(meta.parte || "a").toLowerCase()}`
        : `elite-parte-${meta.parte ?? "x"}`;
  if (l) return `linea-${l}`;
  return null;
}

// Editor de imágenes de UNA medida (variante). Reusa la UI de imágenes del modal
// pero guarda solo esa variante vía el PUT existente (no toca el server). Cada
// medida se guarda por separado: el admin edita y aprieta "Guardar".
// onSaved(images) avisa al modal padre — clave cuando la medida editada ES el
// producto abierto: sin eso, "Guardar cambios" re-PUTea con la lista vieja del
// form y pisa lo que este editor acababa de guardar.
function MedidaImageEditor({ variant, onSaved }) {
  const [imgs, setImgs] = useState(() =>
    variant.images?.length
      ? variant.images.map((i) => ({ url: i.url, alt: i.alt || "", is_primary: !!i.is_primary }))
      : [{ url: "", alt: "", is_primary: true }]);
  const [uploadingIdx, setUploadingIdx] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const upd = (i, f, v) => setImgs((a) => a.map((im, idx) => (idx === i ? { ...im, [f]: v } : im)));
  const setPrim = (i) => setImgs((a) => a.map((im, idx) => ({ ...im, is_primary: idx === i })));
  const add = () => setImgs((a) => [...a, { url: "", alt: "", is_primary: false }]);
  // Reordena: la posición en la lista ES el orden de la galería (sort_order).
  const move = (i, dir) => setImgs((a) => {
    const j = i + dir;
    if (j < 0 || j >= a.length) return a;
    const n = [...a];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const del = (i) => setImgs((a) => {
    const n = a.filter((_, idx) => idx !== i);
    if (n.length && !n.some((x) => x.is_primary)) n[0].is_primary = true;
    return n.length ? n : [{ url: "", alt: "", is_primary: true }];
  });
  async function uploadFile(i, file) {
    if (!file) return;
    setUploadingIdx(i); setMsg("");
    try {
      const fd = new FormData(); fd.append("image", file);
      const r = await fetch(`${API}/api/admin/shop/products/upload-image`, { method: "POST", headers: authHdr(), body: fd });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Error al subir"); return; }
      upd(i, "url", d.url);
    } catch { setMsg("Error de red al subir"); }
    finally { setUploadingIdx(-1); }
  }
  async function save() {
    setSaving(true); setMsg("");
    const payload = {
      slug: variant.slug,
      name: variant.name,
      short_description: variant.short_description || null,
      long_description: variant.long_description || null,
      price_cents: variant.price_cents ?? 0,
      stock: variant.stock ?? null,
      sku: variant.sku || null,
      category_id: variant.category?.id ?? null,
      active: variant.active !== false,
      featured: variant.featured === true,
      sort_order: variant.sort_order ?? 0,
      images: imgs.filter((i) => i.url.trim()).map((i, idx) => ({
        url: i.url.trim(), alt: i.alt.trim() || null, sort_order: idx, is_primary: !!i.is_primary,
      })),
      meta: variant.meta || {},
    };
    try {
      const r = await fetch(`${API}/api/admin/shop/products/${variant.id}`, { method: "PUT", headers: jsonHdr(), body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) {
        const detail = Array.isArray(d.issues) ? d.issues.map((it) => `${(it.path || []).join(".")}: ${it.message}`).join(" · ") : "";
        setMsg("Error: " + [d.error || "no se pudo guardar", detail].filter(Boolean).join(" — "));
      } else { setMsg("✓ Imágenes guardadas"); variant.images = payload.images; onSaved?.(payload.images); }
    } catch { setMsg("Error de red al guardar"); }
    setSaving(false);
  }
  return (
    <div className="adm-mie">
      {imgs.map((img, i) => (
        <div key={i} className="adm-mie__row">
          {/* Posición en la galería + flechas para reordenar (1º se ve primero). */}
          <div className="adm-mie__ord">
            <button type="button" className="adm-btn adm-btn--default adm-btn--sm adm-mie__ordbtn" title="Subir en el orden" aria-label="Mover antes"
              disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <span className="adm-mie__pos">{i + 1}º</span>
            <button type="button" className="adm-btn adm-btn--default adm-btn--sm adm-mie__ordbtn" title="Bajar en el orden" aria-label="Mover después"
              disabled={i === imgs.length - 1} onClick={() => move(i, 1)}>↓</button>
          </div>
          {img.url
            ? <img src={fixImageUrl(img.url)} alt="" className="adm-thumb" style={{ width: 34, height: 34 }} />
            : <div className="adm-thumb adm-thumb--ph" style={{ width: 34, height: 34 }}>🖼</div>}
          <input className="adm-input adm-mie__url" value={img.url} onChange={(e) => upd(i, "url", e.target.value)} placeholder="URL de la imagen" />
          <input className="adm-input adm-mie__alt" value={img.alt} onChange={(e) => upd(i, "alt", e.target.value)} placeholder="Alt text" />
          <div className="adm-mie__acts">
            <label className="adm-btn adm-btn--default adm-btn--sm" style={{ cursor: uploadingIdx === i ? "wait" : "pointer", opacity: uploadingIdx === i ? 0.6 : 1 }}>
              {uploadingIdx === i ? "Subiendo…" : "Subir"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingIdx === i} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; uploadFile(i, f); }} />
            </label>
            <label style={{ fontSize: 11.5, color: "var(--text-2)", display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="radio" name={`prim-${variant.id}`} checked={img.is_primary} onChange={() => setPrim(i)} /> Destacada
            </label>
            <Btn size="sm" variant="danger" onClick={() => del(i)}>×</Btn>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
        <Btn size="sm" onClick={add}>+ Agregar imagen</Btn>
        <Btn size="sm" variant="primary" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar imágenes de esta medida"}</Btn>
        {msg && <span style={{ fontSize: 12, color: msg.startsWith("Error") ? "var(--danger)" : "var(--accent-hover)" }}>{msg}</span>}
      </div>
    </div>
  );
}

function ProductModal({ product, categories, allProducts = [], onClose, onSaved }) {
  const isNew = !product;
  // meta completo del producto: lo preservamos tal cual y sólo reescribimos la
  // sub-clave `editorial`. Así NO pisamos linea/etapa/formato/bundle/etc.
  const metaBase = product?.meta && typeof product.meta === "object" ? product.meta : {};
  const ed0 = (metaBase.editorial && typeof metaBase.editorial === "object") ? metaBase.editorial : {};
  // Contenido actual de la interna (default por línea) para PRE-CARGAR los
  // editores cuando el producto todavía no tiene meta.editorial propio. Así el
  // admin ve exactamente lo que HOY muestra la ficha y lo puede editar.
  const lineDef = (product && lineDetails[lineKeyFor(product)]) || {};
  const pickArr = (edKey, defKey) =>
    (Array.isArray(ed0[edKey]) && ed0[edKey].length) ? ed0[edKey] : (lineDef[defKey] || []);
  // Secciones editoriales de la interna. Vacío en meta → cae al contenido de la
  // interna (lineDef); vacío también ahí → sin sección.
  const [benefits, setBenefits] = useState(() =>
    pickArr("benefits", "benefits").map((b) => ({ title: b.title || "", body: b.body || "" })));
  const [features, setFeatures] = useState(() =>
    pickArr("features", "features").map((f) => ({ emoji: f.emoji || "", title: f.title || "", body: f.body || "" })));
  const [specs, setSpecs] = useState(() =>
    pickArr("specs", "specs").map((s) => ({ label: s.label || "", value: s.value || "" })));
  const [crossSlugs, setCrossSlugs] = useState(() =>
    (Array.isArray(ed0.cross_sell_slugs) && ed0.cross_sell_slugs.length)
      ? ed0.cross_sell_slugs.filter(Boolean)
      : (LINE_CROSS_DEFAULT[metaBase.linea] || []));
  // "También de esta línea" (related). Vacío = automático por categoría en la ficha.
  const [relatedSlugs, setRelatedSlugs] = useState(() =>
    Array.isArray(ed0.related_slugs) ? ed0.related_slugs.filter(Boolean) : []);
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
  // Producto nuevo → al FINAL de la tienda (max sort_order + 10). Con 0 saltaba
  // al primer puesto del catálogo apenas el admin usaba "Ordenar tienda".
  const [sortOrder, setSortOrder] = useState(() =>
    product
      ? (product.sort_order ?? 0)
      : Math.max(0, ...allProducts.map((p) => p.sort_order ?? 0)) + 10
  );
  // Galería fija: si está activo, la interna muestra SOLO las fotos subidas acá
  // (la destacada primero) en vez de armar la galería por medida (kits).
  const [galleryFixed, setGalleryFixed] = useState(metaBase.gallery_fixed === true);
  // Medida destacada (con la que abre la interna). Dos formas según el producto:
  //  • Kit (bundle): string con el formato elegido (ej "250ml") de meta.presentaciones.
  //  • Variante individual (meta.formato): booleano → esta variante es la cabecera
  //    de la familia (la que abre desde el catálogo).
  // Medidas del kit (meta.presentaciones) — ahora EDITABLE: el admin puede
  // agregar/quitar medidas. Controla las secciones por medida de este modal
  // (fotos, precios, portada). El chip de medida en la TIENDA sale de los
  // productos de la línea que existen en esa medida (ver "Agregar medida" en
  // cada familia).
  const [kitMedidas, setKitMedidas] = useState(() =>
    Array.isArray(metaBase.presentaciones) ? metaBase.presentaciones.filter(Boolean) : []);
  const [nuevaPresentacion, setNuevaPresentacion] = useState("");
  // Medidas que el admin QUITÓ explícitamente en esta sesión. La poda de los
  // datos por medida (fotos/orden/precio/portada) en buildMeta se hace SOLO
  // sobre estas — nunca contra kitMedidas: hay kits legados con datos por
  // medida cuyas claves no están en presentaciones, y podar contra la lista
  // los borraría en silencio con cualquier "Guardar cambios".
  const [removedKitMedidas, setRemovedKitMedidas] = useState(() => new Set());
  const addKitMedida = () => {
    const v = nuevaPresentacion.trim();
    if (!v) return;
    setNuevaPresentacion("");
    // Si la había quitado en esta sesión, re-agregarla la "des-quita".
    setRemovedKitMedidas((prev) => {
      if (!prev.has(v)) return prev;
      const next = new Set(prev); next.delete(v); return next;
    });
    if (kitMedidas.some((m) => m.toLowerCase() === v.toLowerCase())) return;
    // Se inserta ordenada por tamaño (FORMATO_ORDER); lo desconocido va al final.
    setKitMedidas((prev) => [...prev, v].sort((a, b) => ordFmt(a) - ordFmt(b)));
  };
  const removeKitMedida = (m) => {
    if (!window.confirm(`¿Quitar la medida "${m}" del kit? Al GUARDAR se borran definitivamente sus fotos, orden, precio y portada guardados para esa medida (los productos de la línea NO se borran).`)) return;
    setKitMedidas((prev) => prev.filter((x) => x !== m));
    setRemovedKitMedidas((prev) => new Set(prev).add(m));
    if (medidaDestacada === m) setMedidaDestacada("");
  };
  const isVariant = !isBundle && typeof metaBase.formato === "string" && !!metaBase.formato;
  const [medidaDestacada, setMedidaDestacada] = useState(
    typeof metaBase.medida_destacada === "string" ? metaBase.medida_destacada : ""
  );
  const [isMedidaDestacada, setIsMedidaDestacada] = useState(metaBase.medida_destacada === true);
  // KIT: destacada (hero) elegida por el admin para CADA medida. Se ve arriba en
  // la interna al seleccionar esa medida. { "250ml": url, ... } en meta.hero_por_medida.
  const [heroPorMedida, setHeroPorMedida] = useState(() => ({ ...(metaBase.hero_por_medida || {}) }));
  const setHero = (m, url) => setHeroPorMedida((prev) => ({ ...prev, [m]: url }));
  // URLs de candidatas que el admin borró en esta sesión (se ocultan al toque,
  // sin esperar el refetch). El borrado real ya se hizo (form o API).
  const [deletedHeroUrls, setDeletedHeroUrls] = useState(() => new Set());
  // KIT: fotos COMUNES (galería) por medida, aparte de la destacada. Se guardan
  // en meta.fotos_por_medida = { "20L": [url, ...] } y se ven en la ficha del
  // kit cuando se elige esa medida. Acumulan varias (a diferencia de la
  // destacada, que es una sola).
  const [fotosPorMedida, setFotosPorMedida] = useState(() => {
    const src = (metaBase.fotos_por_medida && typeof metaBase.fotos_por_medida === "object")
      ? metaBase.fotos_por_medida : {};
    const out = {};
    for (const [m, arr] of Object.entries(src)) out[m] = Array.isArray(arr) ? arr.filter(Boolean) : [];
    return out;
  });
  const [uploadingFoto, setUploadingFoto] = useState(null);
  // Paleta "Potes" abierta/cerrada por medida. Cerrada por defecto (las fotos
  // de los potes suelen ser las MISMAS que las subidas al kit, con otra url —
  // verlas siempre duplicaba todo visualmente). Si la medida no tiene fotos
  // propias, arranca abierta: ahí los potes son lo único que hay.
  const [potesOpen, setPotesOpen] = useState({});
  const addFotoMedida = (m, url) =>
    setFotosPorMedida((prev) => ({ ...prev, [m]: [...(prev[m] || []), url] }));
  const removeFotoMedida = (m, url) =>
    setFotosPorMedida((prev) => ({ ...prev, [m]: (prev[m] || []).filter((u) => u !== url) }));
  // KIT: precio a medida del pack por cada medida (ML/g). El form trabaja en
  // pesos (string "80000"); vacío = sin precio propio (cae a la suma de partes).
  // meta.precio_por_medida se guarda en CENTAVOS. { "500ml": 8000000, ... }
  const [precioPorMedida, setPrecioPorMedida] = useState(() => {
    const src = (metaBase.precio_por_medida && typeof metaBase.precio_por_medida === "object")
      ? metaBase.precio_por_medida : {};
    return Object.fromEntries(
      Object.entries(src).map(([m, cents]) => {
        const n = Number(cents);
        return [m, Number.isFinite(n) && n > 0 ? String(Math.round(n / 100)) : ""];
      })
    );
  });
  const setPrecioMedida = (m, ars) =>
    setPrecioPorMedida((prev) => ({ ...prev, [m]: String(ars).replace(/[^\d]/g, "") }));
  // Variantes para editar las imágenes de cada medida acá mismo.
  //  • Producto de familia (Race/Pro/Bio/Elite individual): sus medidas hermanas.
  //  • Kit / línea (bundle): TODAS las variantes de la línea, ordenadas por medida
  //    (es la publicación donde se ven las medidas, pero no tiene formato propio).
  const [expandedMedida, setExpandedMedida] = useState(null);
  const ordFmt = (f) => { const i = FORMATO_ORDER.indexOf(f); return i === -1 ? 99 : i; };
  const familyKey = famKeyOf(metaBase);
  const lineKey = isBundle ? (metaBase.bundle_line || metaBase.linea) : null;
  const medidaSiblings = familyKey
    ? allProducts
        .filter((p) => famKeyOf(p.meta) === familyKey)
        .sort((a, b) => ordFmt(a.meta?.formato) - ordFmt(b.meta?.formato))
    : lineKey
      ? allProducts
          .filter((p) => p.meta?.linea === lineKey && p.meta?.formato && !p.meta?.bundle)
          .sort((a, b) => ordFmt(a.meta?.formato) - ordFmt(b.meta?.formato) || String(a.name).localeCompare(String(b.name), "es"))
      : [];
  // Fotos propias del producto/kit (sección "Fotos"), como lista de
  // { url, alt, is_primary }. Independientes de las fotos por medida del kit.
  const [images, setImages] = useState(
    product?.images?.length ? product.images.map((i) => ({
      url: i.url, alt: i.alt || "", is_primary: !!i.is_primary,
    })) : [{ url: "", alt: "", is_primary: true }]
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  // Cantidad de subidas "Subir foto" en vuelo (token-based, ver addImageWithFile).
  const [pendingCount, setPendingCount] = useState(0);

  // Candidatas a hero de una medida del kit: SOLO las imágenes de las variantes
  // de la línea en esa medida. Las fotos propias del kit (sección "Fotos") NO se
  // mezclan acá a propósito: son secciones separadas. Antes se apilaban también
  // `images`, y eso hacía que la destacada del kit "reapareciera" en cada medida
  // de "Fotos por medida" (confuso al borrarla). La portada del kit se elige con
  // el botón "Portada automática" (usa la foto principal del kit).
  const heroCandidates = (m) => {
    const urls = [];
    for (const v of allProducts) {
      // Sólo productos ACTIVOS: los stale/ocultos de la línea metían fotos
      // viejas repetidas en la paleta (el público nunca las ve).
      if (v.active === false) continue;
      if (v.meta?.linea === lineKey && v.meta?.formato === m && !v.meta?.bundle) {
        for (const im of (v.images || [])) if (im.url && !urls.includes(im.url)) urls.push(im.url);
      }
    }
    return urls;
  };

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
  // Reordena la galería: la posición en la lista ES el orden en la ficha
  // (se persiste como sort_order al guardar).
  function moveImage(i, dir) {
    setImages((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  // Sube una o VARIAS fotos comunes de una medida (galería del kit) y las agrega
  // a la lista de esa medida (acumula, no reemplaza). Sube en orden para
  // preservar la secuencia. Se persiste en meta.fotos_por_medida.
  async function uploadFotosMedida(m, files) {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setUploadingFoto(m);
    setErr("");
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.append("image", file);
        const r = await fetch(`${API}/api/admin/shop/products/upload-image`, { method: "POST", headers: authHdr(), body: fd });
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "Error al subir una imagen"); continue; }
        addFotoMedida(m, d.url);
      }
    } catch (e) {
      setErr("Error de red al subir imágenes");
    } finally {
      setUploadingFoto(null);
    }
  }

  // Fotos DEL KIT para una medida (meta.fotos_por_medida), en el orden en que
  // se muestran en la ficha. Son las únicas que la galería del kit muestra
  // cuando la medida está curada; el orden ES el orden del array (sin hints).
  const orderedFotosMedida = (m) => {
    const seen = new Set();
    return (fotosPorMedida[m] || []).filter((u) => {
      if (!u || seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  };

  // Fotos de los POTES (productos de la línea) en esa medida que NO están en
  // el kit: paleta para elegir portada, sumarlas al kit (＋) o borrarlas del
  // pote (×). No se muestran en la galería del kit salvo que se sumen.
  const poteFotosMedida = (m) => {
    const curated = new Set(fotosPorMedida[m] || []);
    return heroCandidates(m).filter((u) => u && !curated.has(u) && !deletedHeroUrls.has(u));
  };

  // Mueve una foto del kit un lugar (◀ dir=-1 / ▶ dir=+1) dentro de su medida:
  // reordena directamente meta.fotos_por_medida, que es lo que la ficha recorre.
  const moveFotoMedida = (m, url, dir) => {
    setFotosPorMedida((prev) => {
      const list = (prev[m] || []).filter(Boolean);
      const i = list.indexOf(url);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= list.length) return prev;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...prev, [m]: next };
    });
  };

  // Quita una foto de la galería del kit (la ×): sólo la saca de la lista de la
  // medida — NUNCA borra la foto del pote dueño (para eso está la × de la fila
  // "Potes"). Si era la portada y ya no existe en ningún lado, vuelve a automática.
  function removeMedidaFoto(m, url) {
    if (!(fotosPorMedida[m] || []).includes(url)) return;
    removeFotoMedida(m, url);
    if (heroPorMedida[m] === url && !heroCandidates(m).includes(url)) setHero(m, "");
  }

  // Elimina una foto candidata (la ×) de la galería por medida. La foto puede
  // pertenecer al kit (imágenes del form) o a una variante de la línea; en ese
  // caso se borra de esa variante vía API. Se oculta al instante.
  // Devuelve true si se borró, false si el admin canceló o falló.
  async function deleteHeroCandidate(m, url) {
    if (!url) return false;
    if (!window.confirm("¿Eliminar esta foto del producto? No se puede deshacer.")) return false;
    // Si era la destacada elegida de esta medida, volvemos a "Automática".
    if (heroPorMedida[m] === url) setHero(m, "");

    // Caso 1: es una foto propia del kit (está en el form de imágenes).
    if (images.some((im) => im.url === url)) {
      setImages((arr) => {
        const next = arr.filter((im) => im.url !== url);
        if (next.length && !next.some((im) => im.is_primary)) next[0].is_primary = true;
        return next.length ? next : [{ url: "", alt: "", is_primary: true }];
      });
      setDeletedHeroUrls((prev) => new Set(prev).add(url));
      return true;
    }

    // Caso 2: pertenece a una variante de la línea → se borra de esa variante.
    const owner = allProducts.find(
      (v) => v.meta?.linea === lineKey && v.meta?.formato === m && !v.meta?.bundle
        && (v.images || []).some((im) => im.url === url)
    );
    if (!owner) { setDeletedHeroUrls((prev) => new Set(prev).add(url)); return true; }

    // Borrado QUIRÚRGICO: sacamos SÓLO esta foto de la variante hermana vía el
    // endpoint dedicado. ⚠ Antes rearmábamos un PUT completo con `owner.images`
    // de `allProducts` (snapshot cargado al abrir el panel): si la variante había
    // recibido fotos nuevas después, ese PUT las pisaba y las BORRABA. Ahora el
    // server sólo elimina la fila que matchea la url y devuelve la galería fresca.
    try {
      const r = await fetch(
        `${API}/api/admin/shop/products/${owner.id}/images?url=${encodeURIComponent(url)}`,
        { method: "DELETE", headers: authHdr() },
      );
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || "No se pudo eliminar la foto"); return false; }
      const d = await r.json().catch(() => ({}));
      // Sincroniza el prop en memoria con lo que quedó en el server (fresco),
      // no con una resta local sobre el snapshot viejo.
      owner.images = Array.isArray(d.images)
        ? d.images
        : (owner.images || []).filter((im) => im.url !== url);
      setDeletedHeroUrls((prev) => new Set(prev).add(url));
      return true;
    } catch (e) {
      setErr("Error de red al eliminar la foto");
      return false;
    }
  }

  // ── Familia: agregar / borrar MEDIDAS (cada medida es un producto real) ──
  // El chip de medida en la tienda existe sólo si existe el producto variante
  // (ej. race-2-...-20l). "Agregar medida" CLONA este producto en el formato
  // nuevo (mismo meta/contenido, sin fotos: se suben después en "Fotos por
  // medida"). "Borrar medida" elimina ese producto variante.
  const [newFmt, setNewFmt] = useState("");
  const [newFmtPrice, setNewFmtPrice] = useState("");
  const [creatingMedida, setCreatingMedida] = useState(false);
  const [medidaMsg, setMedidaMsg] = useState("");
  // Token de medida al final de un nombre ("Race 1 — NPK 500ml" → "500ml").
  const SIZE_TAIL = /\s*\d+(?:[.,]\d+)?\s*(?:ml|l|lt|lts|g|gr|kg)\.?\s*$/i;
  const fmtSlug = (f) => String(f).toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  // Canonicaliza la medida tipeada al formato del catálogo ("5lt" / "5 litros"
  // / "5 L" → "5L"; "250 ML" → "250ml"; "500 gr" → "500g"). Sin esto, una
  // medida fuera de canon rompe el orden de los chips (FMT_ORDER del server no
  // la conoce → va última) y los tokens de fotos por medida.
  function canonFormato(s) {
    const m = String(s).trim().toLowerCase().replace(/\s+/g, "")
      .match(/^(\d+(?:[.,]\d+)?)(ml|cc|l|lt|lts|litros?|g|gr|grs?|kg)\.?$/);
    if (!m) return String(s).trim();
    const n = m[1].replace(",", ".");
    const u = m[2];
    if (u === "ml" || u === "cc") return `${n}ml`;
    if (u === "kg") return `${n}kg`;
    if (u.startsWith("g")) return `${n}g`;
    return `${n}L`; // l / lt / lts / litro(s)
  }

  async function createMedida() {
    const fmt = canonFormato(newFmt);
    if (!fmt || !product) return;
    if (medidaSiblings.some((s) => String(s.meta?.formato || "").toLowerCase() === fmt.toLowerCase())) {
      setMedidaMsg("Error: esa medida ya existe en esta familia."); return;
    }
    const pesos = parseInt(String(newFmtPrice).replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(pesos) || pesos <= 0) { setMedidaMsg("Error: poné el precio de la medida nueva (en pesos)."); return; }
    setCreatingMedida(true); setMedidaMsg("");
    // Nombre y slug: mismo producto con el token de medida cambiado. Primero
    // se intenta sacar el formato EXACTO del final del nombre (cubre formatos
    // raros tipo "20 litros"); si no está, cae al tail genérico (SIZE_TAIL).
    const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const curFmt = String(metaBase.formato || "").trim();
    let baseName = product.name;
    if (curFmt) baseName = baseName.replace(new RegExp(`\\s*${escRe(curFmt)}\\s*$`, "i"), "");
    baseName = baseName.replace(SIZE_TAIL, "").trim();
    const curFmtSlug = fmtSlug(metaBase.formato || "");
    const baseSlug = curFmtSlug && product.slug.endsWith(`-${curFmtSlug}`)
      ? product.slug.slice(0, -(curFmtSlug.length + 1))
      : product.slug;
    // Meta clonado: misma familia (linea/etapa/parte/…), formato nuevo. Sin
    // medida_destacada: una sola cabecera por familia.
    const cloneMeta = { ...metaBase, formato: fmt };
    delete cloneMeta.medida_destacada;
    const payload = {
      slug: `${baseSlug}-${fmtSlug(fmt)}`,
      name: `${baseName} ${fmt}`,
      short_description: product.short_description || null,
      long_description: product.long_description || null,
      price_cents: pesos * 100,
      stock: null,
      sku: null,
      category_id: product.category?.id ?? null,
      // Hereda el estado del form: si la familia está oculta (trabajo en
      // curso), la medida nueva NO debe aparecer sola en la tienda.
      active,
      featured: false,
      sort_order: product.sort_order ?? 0,
      images: [],
      meta: cloneMeta,
    };
    try {
      const r = await fetch(`${API}/api/admin/shop/products`, { method: "POST", headers: jsonHdr(), body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) {
        setMedidaMsg("Error: " + (d.error || "no se pudo crear la medida"));
      } else {
        setMedidaMsg(`✓ Medida ${fmt} creada${active ? " — ya aparece en la tienda" : " (oculta, igual que esta familia)"}; subile fotos acá abajo`);
        setNewFmt(""); setNewFmtPrice("");
        onSaved(); // refresca la lista → la medida nueva entra a medidaSiblings
      }
    } catch { setMedidaMsg("Error de red al crear la medida"); }
    setCreatingMedida(false);
  }

  async function deleteMedida(sib) {
    if (!sib || sib.id === product?.id) return; // el producto abierto no se borra desde acá
    // Si algún kit la lista A MANO en su "Incluye" (editorial.bundle_includes_slugs),
    // avisamos: al borrarla, esa familia desaparece del kit sin error visible.
    const kitsQueLaIncluyen = allProducts.filter((p) =>
      p.meta?.bundle && Array.isArray(p.meta?.editorial?.bundle_includes_slugs)
      && p.meta.editorial.bundle_includes_slugs.includes(sib.slug)
    ).map((p) => p.name);
    const aviso = kitsQueLaIncluyen.length
      ? `\n\nOJO: ${kitsQueLaIncluyen.join(" y ")} la lista en su "Incluye" — al borrarla dejará de mostrarse ahí también.`
      : "";
    if (!window.confirm(`¿Borrar "${sib.name}"? Se elimina el producto de esa medida y deja de verse en la tienda. No se puede deshacer.${aviso}`)) return;
    setMedidaMsg("");
    try {
      const r = await fetch(`${API}/api/admin/shop/products/${sib.id}`, { method: "DELETE", headers: authHdr() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMedidaMsg("Error: " + (d.error || "no se pudo borrar la medida")); return; }
      setMedidaMsg(`✓ Medida ${sib.meta?.formato || ""} borrada`);
      if (expandedMedida === sib.id) setExpandedMedida(null);
      onSaved(); // refresca la lista → desaparece de medidaSiblings
    } catch { setMedidaMsg("Error de red al borrar la medida"); }
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
    if (relatedSlugs.length) editorial.related_slugs = relatedSlugs;
    if (bundleSlugs.length) editorial.bundle_includes_slugs = bundleSlugs;

    const next = { ...metaBase };
    if (Object.keys(editorial).length) next.editorial = editorial;
    else delete next.editorial;
    // Galería fija (solo fotos subidas, sin armado por medida).
    if (galleryFixed) next.gallery_fixed = true;
    else delete next.gallery_fixed;
    // Medidas del kit (editable): se persisten. La PODA de los datos por medida
    // es SOLO sobre las quitadas explícitamente en esta sesión (removed) —
    // nunca contra kitMedidas, para no borrar datos legados de claves que no
    // figuran en presentaciones (data-loss silencioso al guardar).
    const removed = removedKitMedidas;
    if (isBundle) {
      if (kitMedidas.length) next.presentaciones = kitMedidas;
      else delete next.presentaciones;
    }
    // Destacada (hero) del kit por medida.
    if (isBundle) {
      const hpm = Object.fromEntries(Object.entries(heroPorMedida).filter(([m, v]) => v && !removed.has(m)));
      if (Object.keys(hpm).length) next.hero_por_medida = hpm;
      else delete next.hero_por_medida;
    }
    // Fotos comunes (galería) por medida.
    if (isBundle) {
      const fpm = {};
      for (const [m, arr] of Object.entries(fotosPorMedida)) {
        if (removed.has(m)) continue;
        const clean = (arr || []).filter(Boolean);
        if (clean.length) fpm[m] = clean;
      }
      if (Object.keys(fpm).length) next.fotos_por_medida = fpm;
      else delete next.fotos_por_medida;
    }
    // orden_por_medida (hint de una iteración anterior) ya no se usa: el orden
    // de la galería del kit ES el orden de fotos_por_medida. Se limpia para
    // que un hint viejo no re-ordene distinto de lo que el admin ve.
    if (isBundle) delete next.orden_por_medida;
    // Precio a medida del pack por cada medida (pesos del form → centavos).
    if (isBundle) {
      const ppm = {};
      for (const [m, ars] of Object.entries(precioPorMedida)) {
        if (removed.has(m)) continue;
        const pesos = parseInt(String(ars).replace(/[^\d]/g, ""), 10);
        if (Number.isFinite(pesos) && pesos > 0) ppm[m] = pesos * 100;
      }
      if (Object.keys(ppm).length) next.precio_por_medida = ppm;
      else delete next.precio_por_medida;
    }
    // Medida destacada (con la que abre la interna / la familia).
    if (isBundle) {
      if (medidaDestacada && !removed.has(medidaDestacada)) next.medida_destacada = medidaDestacada;
      else delete next.medida_destacada;
    } else if (isVariant) {
      if (isMedidaDestacada) next.medida_destacada = true;
      else delete next.medida_destacada;
    }
    return next;
  }

  async function save() {
    setErr("");
    setSavedMsg("");
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
        // El server (zod) devuelve `issues` con el detalle por campo. Lo
        // mostramos para que un 400 de validación sea accionable en vez de un
        // genérico "Datos inválidos" — ej: "short_description: máx 500".
        const detail = Array.isArray(d.issues)
          ? d.issues
              .map((it) => `${(it.path || []).join(".") || "campo"}: ${it.message}`)
              .join(" · ")
          : "";
        setErr([d.error || "Error al guardar", detail].filter(Boolean).join(" — "));
        setSaving(false);
        return;
      }
      // Refresca la lista de fondo PERO deja el modal abierto en este producto
      // (onSaved ya no cierra). Confirmación visible arriba.
      onSaved();
      setSavedMsg(isNew ? "✓ Producto creado" : "✓ Cambios guardados");
    } catch (e) {
      setErr("Error de red");
    }
    setSaving(false);
  }

  useAdmCss();

  // Agrega una foto nueva y le sube el archivo directo (tile "Subir foto").
  // ⚠ Antes usaba `idx = images.length` (índice STALE del closure): si dos
  // subidas se solapaban, la segunda escribía en el índice de la primera y la
  // pisaba/borraba al guardar. Ahora cada subida lleva un TOKEN único y su URL
  // se escribe en la fila que matchea ese token — nunca pisa otra imagen.
  function addImageWithFile(file) {
    if (!file) return;
    const token = `pend_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setImages((arr) => [...arr, { url: "", alt: "", is_primary: arr.every((x) => !x.is_primary), _pending: token }]);
    uploadImageForToken(token, file);
  }

  async function uploadImageForToken(token, file) {
    if (!file) return;
    setPendingCount((n) => n + 1);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch(`${API}/api/admin/shop/products/upload-image`, { method: "POST", headers: authHdr(), body: fd });
      const d = await r.json();
      if (!r.ok) {
        setImages((arr) => arr.filter((im) => im._pending !== token)); // saca la fila pendiente fallida
        setErr(d.error || "Error al subir la imagen");
        return;
      }
      setImages((arr) => arr.map((im) => (im._pending === token ? { ...im, url: d.url, _pending: undefined } : im)));
    } catch (e) {
      setImages((arr) => arr.filter((im) => im._pending !== token));
      setErr("Error de red al subir la imagen");
    } finally {
      setPendingCount((n) => Math.max(0, n - 1));
    }
  }

  // isBundle solo (sin exigir medidas): un kit sin presentaciones necesita ver
  // la card para poder agregar su primera medida.
  const hasVariantSection = isBundle || isVariant || medidaSiblings.length > 1;

  return createPortal(
    <div className="adm">
      <div className="adm-editor" role="dialog" aria-modal="true">
        {/* Barra superior sticky */}
        <div className="adm-editor__top">
          <Btn variant="ghost" size="sm" onClick={onClose} disabled={saving}>← Volver</Btn>
          <div className="adm-editor__title">{isNew ? "Nuevo producto" : product.name}</div>
          {!isNew && (active ? <Badge tone="ok"><span className="adm-dot" />Activo</Badge> : <Badge tone="muted">Oculto</Badge>)}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {savedMsg && <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent-hover)" }}>{savedMsg}</span>}
            <Btn className="adm-hide-mobile" onClick={onClose} disabled={saving}>Cerrar</Btn>
            <Btn variant="primary" onClick={save} disabled={saving || !name || !slug || priceArs === ""}>
              {saving ? "Guardando…" : (isNew ? "Crear producto" : "Guardar cambios")}
            </Btn>
          </div>
        </div>

        <div className="adm-editor__scroll">
          <div className="adm-editor__wrap">
            {/* Columna principal */}
            <div className="adm-editor__main">
              {err && <div className="adm-alert adm-alert--err">{err}</div>}

              <Card title="Información básica">
                <Field label="Nombre del producto">
                  <input className="adm-input" value={name} onChange={(e) => maybeAutoSlug(e.target.value)} placeholder="Ej: Línea Race — Race 1 Vegetativo 500ml" />
                </Field>
                <Field label="URL (slug)" hint={`Aparecerá como /shop/${slug || "..."}`}>
                  <input className="adm-input adm-mono" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="race-1-vegetativo-500ml" />
                </Field>
                <Field label="Descripción corta" hint="Se muestra en la tarjeta del catálogo (1-2 líneas).">
                  <input className="adm-input" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} placeholder="Resumen breve del producto" />
                </Field>
                <Field label="Descripción larga" hint="Detalle en la página del producto.">
                  <textarea className="adm-textarea" value={longDesc} onChange={(e) => setLongDesc(e.target.value)} placeholder="Contá de qué se trata, cómo se usa, para qué sirve…" />
                </Field>
              </Card>

              <Card title="Fotos" hint="La foto marcada como destacada (★) abre la ficha. Con ◀ ▶ elegís el orden en que se ven (1º, 2º, 3º…). Subí archivos o pegá URLs.">
                <div className="adm-gal">
                  {images.map((img, i) => (
                    <div key={i} className={`adm-tile ${img.is_primary ? "adm-tile--primary" : ""}`}>
                      {img.url
                        ? <img src={fixImageUrl(img.url)} alt={img.alt || ""} />
                        : <span style={{ color: "var(--text-3)", fontSize: 12, textAlign: "center", padding: 8 }}>{img._pending ? "Subiendo…" : "Sin imagen"}</span>}
                      {/* Posición en la galería (1º se ve primero en la ficha).
                          Abajo a la izquierda para no pisar el flag "Destacada". */}
                      <span style={{ position: "absolute", bottom: 6, left: 6, fontSize: 10, fontWeight: 900, color: "#fff", background: "rgba(0,0,0,0.55)", borderRadius: 5, padding: "1px 6px", pointerEvents: "none" }}>{i + 1}º</span>
                      {img.is_primary && <span className="adm-tile__flag">Destacada</span>}
                      {/* flexWrap: con 4 botones no entran en el ancho mínimo del tile (110px). */}
                      <div className="adm-tile__acts" style={{ flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "calc(100% - 12px)" }}>
                        <button type="button" className="adm-tile__btn" title="Mover antes" aria-label="Mover antes" disabled={i === 0} style={{ opacity: i === 0 ? 0.35 : 1 }} onClick={() => moveImage(i, -1)}>◀</button>
                        <button type="button" className="adm-tile__btn" title="Mover después" aria-label="Mover después" disabled={i === images.length - 1} style={{ opacity: i === images.length - 1 ? 0.35 : 1 }} onClick={() => moveImage(i, 1)}>▶</button>
                        <button type="button" className={`adm-tile__btn adm-tile__btn--star ${img.is_primary ? "is-on" : ""}`} title="Marcar como destacada" onClick={() => setPrimary(i)}>★</button>
                        <button type="button" className="adm-tile__btn adm-tile__btn--del" title="Quitar" onClick={() => removeImage(i)}>🗑</button>
                      </div>
                    </div>
                  ))}
                  <label className="adm-tile adm-tile--add">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    {pendingCount > 0 ? "Subiendo…" : "Subir foto"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; addImageWithFile(f); }} />
                  </label>
                </div>

                <details style={{ marginTop: 14 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>Editar URLs / alt-text</summary>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {images.map((img, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1.4fr 1fr auto", gap: 6, alignItems: "center" }}>
                        {img.url
                          ? <img src={fixImageUrl(img.url)} alt="" className="adm-thumb" style={{ width: 32, height: 32 }} />
                          : <div className="adm-thumb adm-thumb--ph" style={{ width: 32, height: 32 }}>🖼</div>}
                        <input className="adm-input" value={img.url} onChange={(e) => updateImage(i, "url", e.target.value)} placeholder="URL de la imagen" />
                        <input className="adm-input" value={img.alt} onChange={(e) => updateImage(i, "alt", e.target.value)} placeholder="Alt text (a11y)" />
                        <Btn size="sm" variant="danger" onClick={() => removeImage(i)}>×</Btn>
                      </div>
                    ))}
                    <Btn size="sm" onClick={addImage} style={{ justifySelf: "start" }}>+ Agregar fila</Btn>
                  </div>
                </details>

                <label className="adm-switch" style={{ marginTop: 16, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={galleryFixed} onChange={(e) => setGalleryFixed(e.target.checked)} />
                  <span className="adm-switch__track" />
                  <span className="adm-switch__lab">
                    <span className="adm-switch__t">Usar solo estas fotos en la galería</span>
                    <span className="adm-switch__h">La ficha muestra exactamente estas fotos (destacada primero) y no agrega fotos al cambiar de medida.</span>
                  </span>
                </label>
              </Card>

              {hasVariantSection && (
                <Card title="Variantes y medidas" hint="Configuración de la familia / kit por medida.">
                  {isBundle && (
                    <Field label="Medidas del kit" hint='Agregá o quitá medidas del kit (controla las fotos, precios y portada por medida de acá abajo). OJO: el selector de medida que ve el cliente sale de los productos de la línea — si falta una medida en la tienda, abrí cada producto de la línea y usá "+ Agregar medida" ahí.'>
                      <div className="adm-chips" style={{ marginBottom: 0 }}>
                        {kitMedidas.map((m) => (
                          <span key={m} className="adm-chip">
                            {m}
                            <button type="button" onClick={() => removeKitMedida(m)} title={`Quitar la medida ${m}`} aria-label={`Quitar la medida ${m}`}>×</button>
                          </span>
                        ))}
                        {kitMedidas.length === 0 && <span className="adm-fpm__empty">Sin medidas — agregá la primera:</span>}
                      </div>
                      <div className="adm-addmedida" style={{ marginTop: 8 }}>
                        <input className="adm-input adm-addmedida__fmt" list="kit-fmt-options" value={nuevaPresentacion}
                          onChange={(e) => setNuevaPresentacion(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKitMedida(); } }}
                          placeholder="Nueva medida (ej: 20L)" />
                        <datalist id="kit-fmt-options">
                          {FORMATO_ORDER.filter((f) => !kitMedidas.some((m) => m.toLowerCase() === f.toLowerCase())).map((f) => <option key={f} value={f} />)}
                        </datalist>
                        <Btn size="sm" onClick={addKitMedida} disabled={!nuevaPresentacion.trim()}>+ Agregar medida</Btn>
                      </div>
                    </Field>
                  )}
                  {isBundle && kitMedidas.length > 0 && (
                    <Field label="Medida destacada (con la que abre la interna)" hint="Al entrar a la interna del kit se ve esta medida (sus potes y su precio). Cambiala cuando quieras.">
                      <select className="adm-select" value={medidaDestacada} onChange={(e) => setMedidaDestacada(e.target.value)}>
                        <option value="">— Automática (la primera) —</option>
                        {kitMedidas.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </Field>
                  )}
                  {isBundle && kitMedidas.length > 0 && (
                    <Field label="Fotos por medida" hint='La ficha del kit muestra estas fotos, en este orden (◀ ▶). Tocá una para hacerla PORTADA. En "Potes": ＋ la suma al kit; su × la borra del producto de la línea.'>
                      <div className="adm-fpm">
                        {kitMedidas.map((m) => {
                          // Curadas del kit (lo que muestra la ficha) + paleta de potes.
                          const curated = orderedFotosMedida(m);
                          const potes = poteFotosMedida(m);
                          const portada = heroPorMedida[m] || "";
                          const up = uploadingFoto === m;
                          // Sin fotos propias, los potes son lo único → abierta.
                          const showPotes = potesOpen[m] ?? curated.length === 0;
                          return (
                            <div key={m} className="adm-fpm__row">
                              {/* Header de la medida: nombre + portada + subir. La tira va abajo. */}
                              <div className="adm-fpm__head">
                                <span className="adm-fpm__medida">{m}</span>
                                <button type="button" onClick={() => setHero(m, "")}
                                  className={`adm-btn adm-btn--sm ${portada === "" ? "adm-btn--primary" : "adm-btn--default"}`}
                                  title="Usar la foto unificada del kit como portada">Portada automática</button>
                                <label className="adm-btn adm-btn--default adm-btn--sm adm-fpm__up" style={{ cursor: up ? "wait" : "pointer", opacity: up ? 0.6 : 1 }}>
                                  {up ? "Subiendo…" : "⬆ Subir fotos"}
                                  <input type="file" accept="image/*" multiple style={{ display: "none" }} disabled={up} onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ""; uploadFotosMedida(m, files); }} />
                                </label>
                              </div>
                              <div className="adm-fpm__strip">
                                {curated.length === 0 && (
                                  <span className="adm-fpm__empty">
                                    Sin fotos propias{potes.length > 0 ? " — la ficha muestra las de los potes" : ""}
                                  </span>
                                )}
                                {curated.map((u, idx) => {
                                  const isPortada = portada === u;
                                  return (
                                    <div key={u} className="adm-fpm__tile">
                                      <button type="button" onClick={() => setHero(m, u)} title={isPortada ? "Es la portada de esta medida" : "Marcar como portada"}
                                        className={`adm-fpm__imgbtn${isPortada ? " is-portada" : ""}`}>
                                        <img src={fixImageUrl(u)} alt="" className="adm-fpm__img" loading="lazy"
                                          onError={(e) => e.currentTarget.parentElement.classList.add("is-broken")} />
                                        {isPortada && <span className="adm-fpm__flag">★ PORTADA</span>}
                                      </button>
                                      {/* Orden en la galería: ◀ posición ▶ */}
                                      <div className="adm-fpm__ord">
                                        <button type="button" className="adm-fpm__ordbtn" onClick={() => moveFotoMedida(m, u, -1)} disabled={idx === 0} title="Mover antes" aria-label="Mover antes">◀</button>
                                        <span className="adm-fpm__pos">{idx + 1}º</span>
                                        <button type="button" className="adm-fpm__ordbtn" onClick={() => moveFotoMedida(m, u, 1)} disabled={idx === curated.length - 1} title="Mover después" aria-label="Mover después">▶</button>
                                      </div>
                                      <button type="button" className="adm-fpm__del" onClick={() => removeMedidaFoto(m, u)} title="Sacar esta foto del kit (no borra la foto del pote)" aria-label="Sacar del kit">×</button>
                                    </div>
                                  );
                                })}
                                {/* Paleta de POTES: fotos de los productos de la línea en esta
                                    medida. NO se muestran en el kit — ＋ las suma, tocar = portada.
                                    Plegada por defecto: suelen ser las mismas fotos que las del
                                    kit (otra url) y verlas siempre duplicaba todo. */}
                                {potes.length > 0 && (
                                  <>
                                    <button type="button" className={`adm-fpm__potes${showPotes ? " is-open" : ""}`}
                                      onClick={() => setPotesOpen((prev) => ({ ...prev, [m]: !showPotes }))}
                                      title="Fotos de los productos de la línea en esta medida. No se muestran en el kit salvo que las sumes con ＋.">
                                      Potes ({potes.length}) {showPotes ? "◂" : "▸"}
                                    </button>
                                    {showPotes && potes.map((u) => {
                                      const isPortada = portada === u;
                                      return (
                                        <div key={u} className="adm-fpm__tile">
                                          <button type="button" onClick={() => setHero(m, u)} title={isPortada ? "Es la portada de esta medida" : "Marcar como portada (sin sumarla a la galería)"}
                                            className={`adm-fpm__imgbtn is-pote${isPortada ? " is-portada" : ""}`}>
                                            <img src={fixImageUrl(u)} alt="" className="adm-fpm__img" loading="lazy"
                                          onError={(e) => e.currentTarget.parentElement.classList.add("is-broken")} />
                                            {isPortada && <span className="adm-fpm__flag">★ PORTADA</span>}
                                          </button>
                                          <button type="button" className="adm-fpm__use" onClick={() => addFotoMedida(m, u)} title="Sumar esta foto a la galería del kit">＋ al kit</button>
                                          <button type="button" className="adm-fpm__del" onClick={() => deleteHeroCandidate(m, u)} title="Borrar esta foto DEL POTE (el producto de la línea)" aria-label="Borrar foto del pote">×</button>
                                        </div>
                                      );
                                    })}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Field>
                  )}
                  {isBundle && kitMedidas.length > 0 && (
                    <Field label="Precio del pack por medida" hint='Fijá a mano cuánto sale el kit completo en cada medida (en pesos). Si dejás una vacía, el precio de esa medida es la suma de las partes, como hasta ahora.'>
                      <div style={{ display: "grid", gap: 8 }}>
                        {kitMedidas.map((m) => (
                          <div key={m} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, minWidth: 46, color: "var(--accent-hover)" }}>{m}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, maxWidth: 220 }}>
                              <span style={{ fontSize: 13, color: "var(--text-3)" }}>$</span>
                              <input
                                className="adm-input"
                                type="text"
                                inputMode="numeric"
                                value={precioPorMedida[m] ?? ""}
                                onChange={(e) => setPrecioMedida(m, e.target.value)}
                                placeholder="Suma de las partes"
                                aria-label={`Precio del pack en ${m}`}
                                style={{ flex: 1 }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Field>
                  )}
                  {isVariant && (
                    <label className="adm-switch" style={{ alignItems: "flex-start", marginBottom: medidaSiblings.length > 1 ? 16 : 0 }}>
                      <input type="checkbox" checked={isMedidaDestacada} onChange={(e) => setIsMedidaDestacada(e.target.checked)} />
                      <span className="adm-switch__track" />
                      <span className="adm-switch__lab">
                        <span className="adm-switch__t">Medida destacada de la familia ({metaBase.formato})</span>
                        <span className="adm-switch__h">Si lo activás, al entrar desde el catálogo la familia abre en esta medida. Dejá solo una marcada por familia.</span>
                      </span>
                    </label>
                  )}
                  {/* Cuando el kit tiene la sección unificada "Fotos por medida" arriba
                      (subir, ordenar, portada, quitar), este accordion NO se muestra: era
                      la duplicación confusa. Queda para familias de medidas y para el
                      caso raro de un bundle sin meta.presentaciones (si no, ese bundle
                      se quedaría sin NINGÚN editor por medida). Para variantes se muestra
                      aunque la familia tenga UNA sola medida: hace falta para agregar más. */}
                  {!(isBundle && kitMedidas.length > 0) && (medidaSiblings.length > 1 || isVariant) && (
                    <div>
                      <div className="adm-label">Medidas de la familia y sus fotos</div>
                      <div className="adm-help" style={{ marginTop: 0, marginBottom: 10 }}>
                        Cada medida es una publicación de la tienda: sus fotos son las que ve el cliente. Con ↑ ↓ elegís el orden (1º, 2º, 3º…). Cada medida se guarda por separado. Con "+ Agregar medida" creás una medida nueva (ej: 20L) y con 🗑 la borrás de la tienda.
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {medidaSiblings.map((sib) => {
                          const open = expandedMedida === sib.id;
                          const isThis = sib.id === product?.id;
                          const n = sib.images?.length || 0;
                          return (
                            <div key={sib.id} className="adm-acc">
                              <div className="adm-acc__head">
                                <button type="button" className="adm-acc__toggle" onClick={() => setExpandedMedida(open ? null : sib.id)}>
                                  {sib.primary_image
                                    ? <img src={fixImageUrl(sib.primary_image)} alt="" className="adm-thumb" style={{ width: 30, height: 30 }} />
                                    : <div className="adm-thumb adm-thumb--ph" style={{ width: 30, height: 30 }}>🖼</div>}
                                  {sib.meta?.formato && <Badge tone="ok">{sib.meta.formato}</Badge>}
                                  <span className="adm-acc__name">{sib.name}{isThis && <span className="adm-acc__muted"> · esta</span>}</span>
                                  <span className="adm-acc__count">{n} {n === 1 ? "foto" : "fotos"}</span>
                                  <span className="adm-acc__caret">{open ? "▲" : "▼"}</span>
                                </button>
                                {isVariant && !isThis && (
                                  <button type="button" className="adm-acc__del" onClick={() => deleteMedida(sib)} title={`Borrar la medida ${sib.meta?.formato || ""} de la tienda`} aria-label={`Borrar la medida ${sib.meta?.formato || ""}`}>🗑</button>
                                )}
                              </div>
                              {open && <div className="adm-acc__body">
                                <MedidaImageEditor
                                  key={sib.id}
                                  variant={sib}
                                  onSaved={(imgs) => {
                                    // Si la medida editada ES el producto abierto,
                                    // sincronizamos la lista del form principal para
                                    // que "Guardar cambios" NO pise estas fotos.
                                    if (sib.id === product?.id) {
                                      setImages(imgs.map((i) => ({
                                        url: i.url, alt: i.alt || "", is_primary: !!i.is_primary,
                                      })));
                                    }
                                  }}
                                />
                              </div>}
                            </div>
                          );
                        })}
                      </div>
                      {/* Agregar una medida nueva: crea el producto variante (clon de
                          este, sin fotos) y la tienda muestra el chip al instante. */}
                      {isVariant && !isNew && (
                        <div className="adm-addmedida">
                          <input className="adm-input adm-addmedida__fmt" list="fam-fmt-options" value={newFmt}
                            onChange={(e) => setNewFmt(e.target.value)}
                            placeholder="Medida nueva (ej: 20L)" />
                          <datalist id="fam-fmt-options">
                            {FORMATO_ORDER.filter((f) => !medidaSiblings.some((s) => String(s.meta?.formato || "").toLowerCase() === f.toLowerCase())).map((f) => <option key={f} value={f} />)}
                          </datalist>
                          <div className="adm-addmedida__price">
                            <span className="adm-addmedida__cur">$</span>
                            <input className="adm-input" type="text" inputMode="numeric" value={newFmtPrice}
                              onChange={(e) => setNewFmtPrice(e.target.value.replace(/[^\d]/g, ""))}
                              placeholder="Precio" aria-label="Precio de la medida nueva" />
                          </div>
                          <Btn size="sm" variant="primary" disabled={creatingMedida || !newFmt.trim() || !newFmtPrice} onClick={createMedida}>
                            {creatingMedida ? "Creando…" : "+ Agregar medida"}
                          </Btn>
                        </div>
                      )}
                      {medidaMsg && (
                        <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: medidaMsg.startsWith("Error") ? "var(--danger)" : "var(--accent-hover)" }}>{medidaMsg}</div>
                      )}
                    </div>
                  )}
                </Card>
              )}

              <Card title="Contenido de la página" hint="Pisa el contenido por defecto de la línea. Si dejás una sección vacía, se usa el default.">
                <RepeatList
                  title="Por qué elegirlo (beneficios)"
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
                <div style={{ height: 18 }} />
                <RepeatList
                  title="Características clave"
                  hint="Lista con ícono (emoji) + título + descripción."
                  rows={features}
                  fields={[
                    { key: "emoji", placeholder: "Emoji (ej: ⚖)" },
                    { key: "title", placeholder: "Título (ej: pH auto-buffer)" },
                    { key: "body", placeholder: "Descripción", textarea: true },
                  ]}
                  onAdd={mkRow(setFeatures, { emoji: "", title: "", body: "" })}
                  onChange={setField(setFeatures)}
                  onRemove={delRow(setFeatures)}
                  addLabel="+ Agregar característica"
                />
                <div style={{ height: 18 }} />
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
              </Card>

              <Card title="Productos relacionados" hint="Qué se muestra como complementario o relacionado en la ficha.">
                <ProductPicker
                  title="Sumá para acompañar (cross-sell)"
                  hint="Productos complementarios que aparecen en la interna."
                  options={allProducts.filter((o) => o.slug !== slug)}
                  selected={crossSlugs}
                  onToggle={(s) => toggleSlug(setCrossSlugs, s)}
                />
                <div style={{ height: 18 }} />
                <ProductPicker
                  title="También de esta línea (relacionados)"
                  hint="Sección 'También de…'. Vacío = automático por categoría."
                  options={allProducts.filter((o) => o.slug !== slug)}
                  selected={relatedSlugs}
                  onToggle={(s) => toggleSlug(setRelatedSlugs, s)}
                />
                <div style={{ height: 18 }} />
                <ProductPicker
                  title="Incluye la línea completa (kit)"
                  hint={isBundle
                    ? "Productos que componen este kit/línea. Vacío = se arma solo con la familia."
                    : "Sólo aplica a productos marcados como kit/línea (meta.bundle)."}
                  options={allProducts.filter((o) => o.slug !== slug)}
                  selected={bundleSlugs}
                  onToggle={(s) => toggleSlug(setBundleSlugs, s)}
                />
              </Card>
            </div>

            {/* Columna lateral */}
            <div className="adm-editor__side">
              <Card title="Estado y visibilidad">
                <label className="adm-switch" style={{ alignItems: "flex-start", marginBottom: 16 }}>
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  <span className="adm-switch__track" />
                  <span className="adm-switch__lab">
                    <span className="adm-switch__t">Activo</span>
                    <span className="adm-switch__h">Visible en /shop</span>
                  </span>
                </label>
                <label className="adm-switch" style={{ alignItems: "flex-start" }}>
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                  <span className="adm-switch__track" />
                  <span className="adm-switch__lab">
                    <span className="adm-switch__t">Destacado ⭐</span>
                    <span className="adm-switch__h">Aparece en secciones destacadas</span>
                  </span>
                </label>
              </Card>

              <Card title="Precio y stock">
                <Field label="Precio (ARS)">
                  <div className="adm-ig">
                    <span className="adm-ig__pre">$</span>
                    <input className="adm-input" type="number" min="0" step="1" value={priceArs} onChange={(e) => setPriceArs(e.target.value)} placeholder="25000" />
                  </div>
                </Field>
                <div className="adm-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <Field label="Stock" hint="Vacío = ∞">
                    <input className="adm-input" type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="50" />
                  </Field>
                  <Field label="SKU">
                    <input className="adm-input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="RACE-1-500" />
                  </Field>
                </div>
              </Card>

              <Card title="Organización">
                <Field label="Categoría">
                  <select className="adm-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">— Sin categoría —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Orden" hint="Menor número aparece antes.">
                  <input className="adm-input" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
                </Field>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tab: Tienda → Facturación (dashboard de ventas) ─────────────────────────
// Facturación = pedidos en paid/dispatched/completed pagados con plata real
// (MercadoPago/transferencia). Los pagados con monedas no suman — la plata
// entró al comprar el pack — pero aparecen en el desglose por medio de pago.
function BillingTab() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/api/admin/shop/stats`, { headers: authHdr() })
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)))
      .catch(() => setErr("Error de conexión"));
  }, []);

  if (err) return <p style={{ color: "#fca5a5", padding: 20 }}>{err}</p>;
  if (!data) return <div style={{ color: "rgba(90,102,117,.5)", padding: 20 }}>Cargando…</div>;

  const n = (x) => Number(x) || 0; // los SUM (bigint) llegan como string desde pg
  const t = data.totals;
  const revMonth = n(t.revenue_month);
  const revPrev = n(t.revenue_prev_month);
  const delta = revPrev > 0 ? Math.round(((revMonth - revPrev) / revPrev) * 100) : null;
  const avgTicket = t.orders_month > 0 ? Math.round(revMonth / t.orders_month) : 0;

  // Serie continua de 30 días: la API sólo trae días con ventas.
  const byDay = Object.fromEntries(data.daily.map((d) => [d.day, d]));
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    days.push({ key, label: `${dt.getDate()}/${dt.getMonth() + 1}`, ...(byDay[key] || { orders: 0, revenue_cents: 0 }) });
  }
  const maxDay = Math.max(1, ...days.map((d) => n(d.revenue_cents)));

  const METHOD = { mercadopago: "💳 MercadoPago", transfer: "🏦 Transferencia", monedas: "🪙 Monedas" };
  const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const statCard = (label, value, sub, color) => (
    <div style={{ ...styles.card, marginBottom: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "rgba(90,102,117,.45)" }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 22, color: color || "var(--text)", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "rgba(90,102,117,.55)", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 14 }}>
        {statCard(
          "Facturado este mes", formatARS(revMonth),
          delta == null
            ? `${t.orders_month} pedido${t.orders_month === 1 ? "" : "s"}`
            : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs ${formatARS(revPrev)} el mes pasado`,
          "var(--brand-primary, #3B82F6)"
        )}
        {statCard("Pedidos del mes", t.orders_month, `ticket promedio ${formatARS(avgTicket)}`)}
        {statCard("Histórico", formatARS(n(t.revenue_all)), `${t.orders_all} pedidos cobrados`)}
        {statCard("Pendiente de pago", formatARS(n(t.pending_cents)), `${t.pending_orders} pedido${t.pending_orders === 1 ? "" : "s"} sin cobrar`, "#f59e0b")}
      </div>

      <div style={styles.card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>Últimos 30 días</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 120 }}>
          {days.map((d) => (
            <div key={d.key} title={`${d.label} · ${formatARS(n(d.revenue_cents))} · ${d.orders} pedido${d.orders === 1 ? "" : "s"}`}
              style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", cursor: "default" }}>
              <div style={{
                height: `${Math.max(n(d.revenue_cents) > 0 ? 4 : 1, Math.round((n(d.revenue_cents) / maxDay) * 100))}%`,
                background: n(d.revenue_cents) > 0 ? "var(--brand-primary, #3B82F6)" : "rgba(90,102,117,.15)",
                borderRadius: "3px 3px 0 0",
              }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(90,102,117,.45)", marginTop: 6 }}>
          <span>{days[0].label}</span><span>{days[14].label}</span><span>{days[29].label}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
        <div style={{ ...styles.card, marginBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Por mes</div>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Mes</th><th style={styles.th}>Pedidos</th><th style={styles.th}>Facturado</th></tr></thead>
            <tbody>
              {data.monthly.length === 0 && <tr><td style={styles.td} colSpan={3}>(sin ventas todavía)</td></tr>}
              {data.monthly.map((m) => (
                <tr key={m.month}>
                  <td style={{ ...styles.td, textTransform: "capitalize" }}>{monthLabel(m.month)}</td>
                  <td style={styles.td}>{m.orders}</td>
                  <td style={{ ...styles.td, fontWeight: 700 }}>{formatARS(n(m.revenue_cents))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ ...styles.card, marginBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Por medio de pago</div>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Medio</th><th style={styles.th}>Pedidos</th><th style={styles.th}>Total</th></tr></thead>
            <tbody>
              {data.methods.length === 0 && <tr><td style={styles.td} colSpan={3}>(sin ventas todavía)</td></tr>}
              {data.methods.map((m) => (
                <tr key={m.payment_method}>
                  <td style={styles.td}>{METHOD[m.payment_method] || m.payment_method}</td>
                  <td style={styles.td}>{m.orders}</td>
                  <td style={{ ...styles.td, fontWeight: 700 }}>{formatARS(n(m.revenue_cents))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.methods.some((m) => m.payment_method === "monedas") && (
            <div style={{ fontSize: 11, color: "rgba(90,102,117,.45)", marginTop: 8 }}>
              🪙 Los pedidos con monedas no suman a la facturación: la plata entró al comprarse el pack.
            </div>
          )}
        </div>

        <div style={{ ...styles.card, marginBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Top productos</div>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Producto</th><th style={styles.th}>Unid.</th><th style={styles.th}>Facturado</th></tr></thead>
            <tbody>
              {data.top_products.length === 0 && <tr><td style={styles.td} colSpan={3}>(sin ventas todavía)</td></tr>}
              {data.top_products.map((p) => (
                <tr key={p.name}>
                  <td style={styles.td}>{p.name}</td>
                  <td style={styles.td}>{p.units}</td>
                  <td style={{ ...styles.td, fontWeight: 700 }}>{formatARS(n(p.revenue_cents))}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
  cancelled:       { label: "Cancelado",         color: "rgba(90,102,117,.5)", emoji: "🚫" },
  failed:          { label: "Fallido",           color: "#fca5a5", emoji: "❌" },
};

// Acciones rápidas por fila: avanzar la etapa del pedido sin abrir el detalle.
const NEXT_ACTIONS = {
  pending_payment: [{ to: "paid", label: "Marcar pagado", variant: "primary" }, { to: "cancelled", label: "Cancelar", variant: "danger" }],
  paid:            [{ to: "dispatched", label: "🚚 Despachar", variant: "primary" }, { to: "cancelled", label: "Cancelar", variant: "danger" }],
  dispatched:      [{ to: "completed", label: "✅ Completar", variant: "primary" }],
  completed:       [],
  cancelled:       [{ to: "pending_payment", label: "Reabrir", variant: "default" }],
  failed:          [{ to: "pending_payment", label: "Reabrir", variant: "default" }],
};

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [changing, setChanging] = useState(null);

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

  // Cambia el estado del pedido desde la lista (confirma primero). Reusa el
  // endpoint del detalle. Para "Despachar" sin tracking, el nº de seguimiento
  // se puede cargar después en el detalle.
  async function quickStatus(e, id, status) {
    e.stopPropagation();
    if (!confirm(`Cambiar este pedido a "${ORDER_STATUS_META[status]?.label}"?`)) return;
    setChanging(`${id}-${status}`);
    try {
      const r = await fetch(`${API}/api/admin/shop/orders/${id}/status`, {
        method: "POST", headers: jsonHdr(), body: JSON.stringify({ status }),
      });
      if (r.ok) await load();
      else alert("No se pudo cambiar el estado.");
    } catch { alert("Error de red."); }
    setChanging(null);
  }

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const STATUS_TONE = { pending_payment: "warn", paid: "ok", dispatched: "muted", completed: "ok", cancelled: "muted", failed: "danger" };

  return (
    <div style={{ margin: "2px 0" }}>
      <div className="adm-spread" style={{ marginBottom: 16 }}>
        <div>
          <div className="adm-h1">Pedidos</div>
          <div className="adm-sub">{totalCount} {totalCount === 1 ? "pedido" : "pedidos"} en total</div>
        </div>
        <div className="adm-search" style={{ minWidth: 260 }}>
          <span className="adm-search__i">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          </span>
          <input className="adm-input" placeholder="Buscar por email, nombre o N° de orden…" value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") load(); }} />
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        <button onClick={() => setFilter("all")} className={`adm-btn adm-btn--sm ${filter === "all" ? "adm-btn--primary" : "adm-btn--default"}`}>
          Todos <span style={{ opacity: 0.7 }}>{totalCount}</span>
        </button>
        {Object.entries(ORDER_STATUS_META).map(([key, meta]) => (
          <button key={key} onClick={() => setFilter(key)} className={`adm-btn adm-btn--sm ${filter === key ? "adm-btn--primary" : "adm-btn--default"}`}>
            {meta.emoji} {meta.label} <span style={{ opacity: 0.7 }}>{counts[key] || 0}</span>
          </button>
        ))}
      </div>

      <div className="adm-card">
        {loading ? (
          <div className="adm-empty">Cargando pedidos…</div>
        ) : orders.length === 0 ? (
          <div className="adm-empty">
            <div className="adm-empty__ic">🧾</div>
            No hay pedidos {filter !== "all" ? `con estado "${ORDER_STATUS_META[filter]?.label}"` : "todavía"}.
          </div>
        ) : (
          <div className="adm-tablewrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th style={{ width: 300 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const meta = ORDER_STATUS_META[o.status] || ORDER_STATUS_META.pending_payment;
                  return (
                    <tr key={o.id} onClick={() => setDetail(o.id)} style={{ cursor: "pointer" }}>
                      <td>
                        <span className="adm-mono" style={{ fontWeight: 700 }}>{o.public_id}</span>
                        {o.payment_method === "transfer" && (
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--accent-hover)", marginTop: 2 }}>
                            🏦 Transferencia{o.transfer_receipt_url ? " · 📎 comprobante" : " · sin comprobante"}
                          </div>
                        )}
                        {o.payment_method === "monedas" && (
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--accent-hover)", marginTop: 2 }}>
                            🪙 Pagado con monedas
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{o.customer_first_name} {o.customer_last_name || ""}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{o.customer_email}</div>
                      </td>
                      <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{o.total_formatted}</td>
                      <td><Badge tone={STATUS_TONE[o.status] || "muted"}>{meta.emoji} {meta.label}</Badge></td>
                      <td style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                        {new Date(o.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {(NEXT_ACTIONS[o.status] || []).map((a) => (
                            // "Despachar" abre el detalle para cargar carrier + nº de
                            // tracking a mano (ahí se dispara el email con seguimiento).
                            a.to === "dispatched" ? (
                              <Btn key={a.to} size="sm" variant={a.variant}
                                onClick={(e) => { e.stopPropagation(); setDetail(o.id); }}>
                                {a.label}
                              </Btn>
                            ) : (
                              <Btn key={a.to} size="sm" variant={a.variant} disabled={changing === `${o.id}-${a.to}`}
                                onClick={(e) => quickStatus(e, o.id, a.to)}>
                                {changing === `${o.id}-${a.to}` ? "…" : a.label}
                              </Btn>
                            )
                          ))}
                          <Btn size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetail(o.id); }}>Detalle</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && <OrderDetailModal orderId={detail} onClose={() => setDetail(null)} onChanged={load} />}
    </div>
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
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(90,102,117,.5)" }}>Estado</div>
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
                      borderRadius: 6, border: "1px solid rgba(17,24,39,.1)",
                      background: key === order.status ? "rgba(167,245,200,.12)" : "rgba(17,24,39,.04)",
                      color: key === order.status ? meta.color : "rgba(90,102,117,.8)",
                      cursor: key === order.status ? "default" : "pointer",
                      opacity: savingStatus === key ? 0.5 : 1,
                      fontFamily: "inherit",
                    }}
                  >
                    {meta.emoji} {meta.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "rgba(90,102,117,.5)", marginTop: 10 }}>
                Flujo típico: Pendiente → Pagado → Despachado → Completado.
              </div>
            </div>

            {/* Pago con monedas: la orden nació pagada con débito del saldo. */}
            {order.payment_method === "monedas" && (
              <div style={{ ...styles.card, marginBottom: 16, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(90,102,117,.5)" }}>
                  🪙 Pagado con monedas
                </div>
                <div style={{ fontSize: 12, color: "rgba(90,102,117,.6)", marginTop: 6 }}>
                  El comprador pagó con su saldo de monedas — el débito ya se hizo y la orden entró como pagada.
                </div>
              </div>
            )}

            {/* Pago por transferencia: comprobante subido por el comprador.
                El admin lo mira y aprueba con el botón "Pagado" de arriba. */}
            {order.payment_method === "transfer" && (
              <div style={{ ...styles.card, marginBottom: 16, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(90,102,117,.5)", marginBottom: 10 }}>
                  🏦 Pago por transferencia
                </div>
                {order.transfer_receipt_url ? (
                  <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <a href={order.transfer_receipt_url} target="_blank" rel="noopener noreferrer">
                      <img src={order.transfer_receipt_url} alt="Comprobante de transferencia"
                        style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(17,24,39,.12)", display: "block" }} />
                    </a>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <a href={order.transfer_receipt_url} target="_blank" rel="noopener noreferrer"
                        style={{ fontWeight: 800, fontSize: 13, color: "var(--brand-primary, #2E8F6E)" }}>
                        Ver comprobante completo ↗
                      </a>
                      <div style={{ fontSize: 12, color: "rgba(90,102,117,.6)", marginTop: 6 }}>
                        Verificá que la transferencia haya llegado a la cuenta y aprobá el pago cambiando el estado a <b>💰 Pagado</b> (arriba). El cliente recibe el email de confirmación automáticamente.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "rgba(90,102,117,.7)" }}>
                    El cliente eligió transferencia pero todavía <b>no subió el comprobante</b>. Puede subirlo desde el link de su orden; si te lo manda por WhatsApp, verificá el ingreso y marcá el pedido como 💰 Pagado.
                  </div>
                )}
              </div>
            )}

            {/* Tracking de envío — visible desde que el pedido está pagado */}
            {["paid", "dispatched", "completed"].includes(order.status) && (
              <div style={{ ...styles.card, marginBottom: 16, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(90,102,117,.5)", marginBottom: 10 }}>
                  🚚 Envío / Tracking
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={carrier} onChange={(e) => setCarrier(e.target.value)}
                    style={{ flex: "1 1 150px", padding: "9px 12px", borderRadius: 8, background: "rgba(17,24,39,.05)", border: "1px solid rgba(17,24,39,.12)", color: "rgba(90,102,117,.9)", fontFamily: "inherit", fontSize: 13 }}>
                    <option value="">Elegir correo…</option>
                    <option value="andreani">Andreani</option>
                    <option value="correo_argentino">Correo Argentino</option>
                    <option value="via_cargo">Vía Cargo</option>
                    <option value="propio">Envío propio</option>
                  </select>
                  <input value={trackingNum} onChange={(e) => setTrackingNum(e.target.value)} placeholder="N° de seguimiento"
                    style={{ flex: "2 1 200px", padding: "9px 12px", borderRadius: 8, background: "rgba(17,24,39,.05)", border: "1px solid rgba(17,24,39,.12)", color: "rgba(90,102,117,.9)", fontFamily: "inherit", fontSize: 13 }} />
                  <button onClick={saveDispatch} disabled={!!savingStatus}
                    style={{ padding: "9px 16px", fontSize: 12, fontWeight: 800, borderRadius: 8, border: "none", background: "#25D366", color: "#fff", cursor: "pointer", fontFamily: "inherit", opacity: savingStatus ? 0.6 : 1, whiteSpace: "nowrap" }}>
                    {order.status === "dispatched" ? "Actualizar envío" : "Despachar y notificar"}
                  </button>
                </div>
                {order.tracking_url && (
                  <div style={{ fontSize: 12, color: "rgba(90,102,117,.6)", marginTop: 10 }}>
                    Link de seguimiento: <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-primary, #A7F5C8)" }}>{order.tracking_url}</a>
                  </div>
                )}
                <div style={{ fontSize: 11, color: "rgba(90,102,117,.45)", marginTop: 8 }}>
                  Al despachar, el socio recibe un email con el botón “Seguir mi envío”.
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Cliente */}
              <div style={styles.card}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(90,102,117,.5)", marginBottom: 10 }}>Cliente</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{order.customer_first_name} {order.customer_last_name || ""}</div>
                <div style={{ fontSize: 13, color: "rgba(90,102,117,.75)", marginTop: 4 }}>
                  <div>📧 <a href={`mailto:${order.customer_email}`} style={{ color: "inherit", textDecoration: "underline dotted" }}>{order.customer_email}</a></div>
                  <div>📱 <a href={`https://wa.me/${order.customer_phone?.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline dotted" }}>{order.customer_phone}</a></div>
                </div>
              </div>

              {/* Envío */}
              <div style={styles.card}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(90,102,117,.5)", marginBottom: 10 }}>Dirección de envío</div>
                <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                  <div>{sa.street} {sa.number}{sa.apartment ? ` · Dpto ${sa.apartment}` : ""}</div>
                  <div>{sa.city}, {sa.province}</div>
                  <div>CP {sa.postal_code}{sa.country ? ` · ${sa.country}` : ""}</div>
                  {sa.notes && <div style={{ marginTop: 8, fontStyle: "italic", color: "rgba(90,102,117,.65)" }}>“{sa.notes}”</div>}
                </div>
              </div>
            </div>

            {/* Items */}
            <div style={{ ...styles.card, marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(90,102,117,.5)", marginBottom: 10 }}>Productos ({order.items?.length || 0})</div>
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
                          ? <img src={fixImageUrl(it.image_url)} alt="" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4, background: "rgba(17,24,39,.03)" }} />
                          : <div style={{ width: 36, height: 36, background: "rgba(17,24,39,.05)", borderRadius: 4 }} />
                        }
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600 }}>{it.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(90,102,117,.5)" }}>/{it.product_slug}</div>
                      </td>
                      <td style={styles.td}>{it.quantity}</td>
                      <td style={styles.td}>{formatARS(it.line_total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(17,24,39,.08)", display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: 14 }}>
                <span style={{ fontSize: 13, color: "rgba(90,102,117,.7)" }}>Total</span>
                <strong style={{ fontSize: 22, color: "var(--brand-primary, #A7F5C8)" }}>{order.total_formatted}</strong>
              </div>
            </div>

            {/* Timestamps */}
            <div style={{ ...styles.card, marginTop: 14, fontSize: 12, color: "rgba(90,102,117,.65)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(90,102,117,.5)", marginBottom: 8 }}>Historial</div>
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
// Pill de filtro (lo usa CustomersTab). Estilo del kit claro.
function FilterPill({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`adm-btn adm-btn--sm ${active ? "adm-btn--primary" : "adm-btn--default"}`}>
      {children}
    </button>
  );
}

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
          <div style={{ color: "rgba(90,102,117,.5)", padding: "20px 0" }}>
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
                    <div style={{ fontSize: 11, color: "rgba(90,102,117,.5)" }}>
                      {(c.last_address?.city || "") + (c.last_address?.province ? `, ${c.last_address.province}` : "")}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <a href={`mailto:${c.email}`} style={{ color: "inherit" }}>{c.email}</a>
                    {c.phone && <div style={{ fontSize: 11, color: "rgba(90,102,117,.55)" }}>📱 {c.phone}</div>}
                  </td>
                  <td style={styles.td}>
                    <strong>{c.orders_count}</strong>
                  </td>
                  <td style={styles.td}>
                    <strong style={{ color: "var(--brand-primary, #A7F5C8)" }}>{c.total_spent_formatted}</strong>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 12, color: "rgba(90,102,117,.7)" }}>
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
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(90,102,117,.5)", marginBottom: 8 }}>
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
    subject: "Oferta exclusiva en Holistic 🌱",
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
      <a href="https://hgrowshop.com/shop" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#25D366 0%,#2E8F6E 100%);color:#fff;text-decoration:none;font-weight:800;border-radius:999px;letter-spacing:.06em;text-transform:uppercase;font-size:13px;">Aprovechar oferta →</a>
    </p>
    <p style="font-size:13px;color:#666;text-align:center;margin:20px 0 0;">Válido hasta agotar stock.</p>
  </td></tr>
</table>`,
  },
  anuncio: {
    label: "📣 Anuncio / Update",
    subject: "Novedades de Holistic",
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
      <a href="https://hgrowshop.com/shop" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#25D366 0%,#2E8F6E 100%);color:#fff;text-decoration:none;font-weight:800;border-radius:999px;letter-spacing:.06em;text-transform:uppercase;font-size:13px;">Ver en el catálogo →</a>
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
      <a href="https://hgrowshop.com/shop" style="display:inline-block;padding:12px 24px;background:rgba(46,143,110,.1);color:#2E8F6E;text-decoration:none;font-weight:700;border-radius:999px;font-size:13px;">Ver catálogo</a>
    </p>
  </td></tr>
</table>`,
  },
};

const CAMPAIGN_STATUS_META = {
  draft:      { label: "Borrador",  color: "rgba(90,102,117,.6)", emoji: "📝" },
  sending:    { label: "Enviando…", color: "#fcd34d", emoji: "📡" },
  sent:       { label: "Enviada",   color: "#86efac", emoji: "✅" },
  cancelled:  { label: "Cancelada", color: "rgba(90,102,117,.4)", emoji: "🚫" },
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
          <div style={{ fontSize: 12, color: "rgba(90,102,117,.55)", marginTop: 3 }}>
            {segments.opt_in} clientes opt-in · {segments.all} totales · Free tier: 90/día
          </div>
        </div>
        <button style={styles.btn(true)} onClick={() => setComposer("new")}>+ Nueva campaña</button>
      </div>

      <div style={styles.card}>
        {loading ? <div>Cargando…</div> : campaigns.length === 0 ? (
          <div style={{ color: "rgba(90,102,117,.5)", padding: "20px 0" }}>
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
                      <div style={{ fontSize: 11, color: "rgba(90,102,117,.5)" }}>{c.subject}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 11, color: "rgba(90,102,117,.7)", textTransform: "uppercase", letterSpacing: ".1em" }}>
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
                          <div style={{ width: 90, height: 5, background: "rgba(17,24,39,.06)", borderRadius: 999, marginTop: 4, overflow: "hidden" }}>
                            <div style={{ width: `${progress}%`, height: "100%", background: meta.color, transition: "width .4s" }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "rgba(90,102,117,.4)" }}>—</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12, color: "rgba(90,102,117,.6)" }}>
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
            srcDoc={bodyHtml + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;border-top:1px solid #e5e5e5;padding-top:16px;"><tr><td style="font-family:sans-serif;font-size:11px;line-height:1.5;color:#999;text-align:center;">Recibís este email porque estás en la lista de clientes de Holistic.<br>¿No querés más? <a href="#">Darse de baja</a>.</td></tr></table>`}
            style={{ width: "100%", height: 540, border: "1px solid rgba(17,24,39,.1)", borderRadius: 8, background: "#fff" }}
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

        <div style={{ marginTop: 18, padding: "14px 16px", borderRadius: 10, background: dailyLimitReached ? "rgba(252,211,77,.10)" : "rgba(167,245,200,.08)", border: `1px solid ${dailyLimitReached ? "rgba(252,211,77,.3)" : "rgba(167,245,200,.2)"}`, fontSize: 13, color: "rgba(90,102,117,.85)" }}>
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
        <div style={{ fontSize: 11, color: "rgba(90,102,117,.5)", textAlign: "right", marginTop: 6 }}>
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
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(90,102,117,.5)" }}>Asunto</div>
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
              <div style={{ width: "100%", height: 8, background: "rgba(17,24,39,.06)", borderRadius: 999, overflow: "hidden" }}>
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
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".22em", textTransform: "uppercase", color: "rgba(90,102,117,.5)", marginBottom: 10 }}>
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
          <summary style={{ cursor: "pointer", color: "rgba(90,102,117,.7)", fontSize: 12 }}>Ver HTML enviado</summary>
          <pre style={{ marginTop: 10, padding: 12, background: "rgba(0,0,0,.4)", borderRadius: 6, fontSize: 11, color: "rgba(90,102,117,.7)", maxHeight: 280, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
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
          <div style={{ fontSize: 12, color: "rgba(90,102,117,.55)", marginTop: 3 }}>
            Aplican en /checkout. El cliente los tipea o se les manda por campaña.
          </div>
        </div>
        <button style={styles.btn(true)} onClick={() => setEditing("new")}>+ Nuevo código</button>
      </div>

      <div style={styles.card}>
        {loading ? <div>Cargando…</div> : codes.length === 0 ? (
          <div style={{ color: "rgba(90,102,117,.5)", padding: "20px 0" }}>
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
                    {c.notes && <div style={{ fontSize: 11, color: "rgba(90,102,117,.5)" }}>{c.notes}</div>}
                  </td>
                  <td style={styles.td}>
                    <strong>{c.discount_display}</strong>
                    <div style={{ fontSize: 11, color: "rgba(90,102,117,.5)" }}>
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
                      <span style={{ fontSize: 12, color: "rgba(90,102,117,.7)" }}>
                        {new Date(c.expires_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    ) : <span style={{ color: "rgba(90,102,117,.4)" }}>—</span>}
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

// ── Tab: Códigos de invitación (registro por invitación) ────────────────────
// Restaura el panel de invites del portal original (vivía en OperatorPanel,
// borrado en Sprint 0; los endpoints /admin/invite-codes sobrevivieron).
// Los códigos sólo se exigen en /register cuando rules.signup_mode="invite";
// el switch de acá escribe esa regla vía /api/admin/config/rules.
const INVITE_VALIDITY_OPTS = [
  { value: "1",  label: "24 horas" },
  { value: "7",  label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "",   label: "Sin vencimiento" },
];

function InviteCodesTab() {
  const rules = useRules();
  const [modeOverride, setModeOverride] = useState(null); // pisa rules tras togglear
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [validity, setValidity] = useState("1");
  const [copied, setCopied] = useState(null);
  const [err, setErr] = useState("");

  const inviteOn = (modeOverride ?? rules.signup_mode) === "invite";

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/invite-codes`, { headers: authHdr() });
      const d = await r.json();
      if (d.ok) setCodes(d.codes || []);
      else setErr(d.error || "No se pudo cargar la lista de códigos");
    } catch { setErr("Error de red al cargar los códigos"); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggleMode() {
    const next = inviteOn ? "open" : "invite";
    const warn = next === "invite"
      ? "¿Activar registro por invitación? Nadie va a poder crear cuenta sin un código generado acá."
      : "¿Volver al registro abierto? Cualquiera va a poder crear cuenta sin código.";
    if (!confirm(warn)) return;
    setSavingMode(true); setErr("");
    try {
      const r = await fetch(`${API}/api/admin/config/rules`, {
        method: "POST", headers: jsonHdr(),
        body: JSON.stringify({ signup_mode: next }),
      });
      const d = await r.json();
      if (d.ok) setModeOverride(next);
      else setErr(d.error || "No se pudo cambiar el modo de registro");
    } catch { setErr("Error de red al cambiar el modo de registro"); }
    setSavingMode(false);
  }

  async function generate() {
    setGenerating(true); setErr("");
    try {
      const r = await fetch(`${API}/admin/invite-codes`, {
        method: "POST", headers: jsonHdr(),
        body: JSON.stringify({
          notes: notes.trim() || null,
          expires_days: validity ? Number(validity) : null,
          quantity: qty,
        }),
      });
      const d = await r.json();
      if (d.ok) { setNotes(""); await load(); }
      else setErr(d.error || "No se pudieron generar los códigos");
    } catch { setErr("Error de red al generar los códigos"); }
    setGenerating(false);
  }

  async function remove(c) {
    if (!confirm(`¿Borrar el código ${c.code}?`)) return;
    try {
      const r = await fetch(`${API}/admin/invite-codes/${c.id}`, { method: "DELETE", headers: authHdr() });
      if (r.ok) load(); else setErr("No se pudo borrar el código");
    } catch { setErr("Error de red al borrar el código"); }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const pending = codes.filter((c) => !c.used_by);
  const used = codes.filter((c) => c.used_by);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Códigos de invitación</h2>
          <div style={{ fontSize: 12, color: "rgba(90,102,117,.55)", marginTop: 3 }}>
            Para darle acceso al registro a clientes particulares. Uso único por código.
          </div>
        </div>
      </div>

      {err && (
        <div style={{ ...styles.card, borderColor: "var(--danger-border)", color: "var(--danger)", fontSize: 13, fontWeight: 600 }}>
          {err}
        </div>
      )}

      {/* Estado del modo de registro + switch */}
      <div style={{ ...styles.card, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>
            {inviteOn ? "🔒 Registro por invitación ACTIVADO" : "🌐 Registro abierto (sin código)"}
          </div>
          <div style={{ fontSize: 12, color: "rgba(90,102,117,.55)", marginTop: 3 }}>
            {inviteOn
              ? "Nadie puede crear cuenta sin un código de esta lista."
              : "Los códigos no se piden en el registro hasta activar el modo invitación."}
          </div>
        </div>
        <button style={styles.btn(!inviteOn, inviteOn)} onClick={toggleMode} disabled={savingMode}>
          {savingMode ? "Guardando…" : inviteOn ? "Volver a registro abierto" : "Activar modo invitación"}
        </button>
      </div>

      {/* Generador */}
      <div style={styles.card}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Generar códigos</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={styles.label}>Cantidad</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 3, 5, 10].map((n) => (
                <button key={n} onClick={() => setQty(n)}
                  style={{ ...styles.btn(qty === n), width: 44, padding: "9px 0", textAlign: "center" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: 170 }}>
            <label style={styles.label}>Validez</label>
            <select style={styles.input} value={validity} onChange={(e) => setValidity(e.target.value)}>
              {INVITE_VALIDITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={styles.label}>Nota (opcional)</label>
            <input style={styles.input} placeholder="Para qué cliente es…" value={notes}
              onChange={(e) => setNotes(e.target.value)} maxLength={120} />
          </div>
          <button style={styles.btn(true)} onClick={generate} disabled={generating}>
            {generating ? "Generando…" : "⚡ Generar"}
          </button>
        </div>
      </div>

      {/* Pendientes */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Pendientes ({pending.length})</div>
          <button style={styles.btn()} onClick={load}>↻ Actualizar</button>
        </div>
        {loading ? <div>Cargando…</div> : pending.length === 0 ? (
          <div style={{ color: "rgba(90,102,117,.5)", padding: "14px 0" }}>
            Sin códigos pendientes. Generá uno arriba y mandáselo al cliente.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Código</th>
                <th style={styles.th}>Nota</th>
                <th style={styles.th}>Vence</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((c) => {
                const exp = c.expires_at ? new Date(c.expires_at) : null;
                const hrs = exp ? Math.round((exp - Date.now()) / 3600000) : null;
                const expired = hrs !== null && hrs <= 0;
                return (
                  <tr key={c.id}>
                    <td style={styles.td}>
                      <code style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 14, letterSpacing: 2 }}>{c.code}</code>
                    </td>
                    <td style={styles.td}>
                      {c.notes || <span style={{ color: "rgba(90,102,117,.4)" }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {exp ? (
                        <span style={{ fontSize: 12, color: expired ? "var(--danger)" : "rgba(90,102,117,.7)", fontWeight: expired ? 700 : 400 }}>
                          {expired ? "⚠ Vencido" : hrs < 48 ? `⏳ ${hrs}h` : exp.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                        </span>
                      ) : <span style={{ color: "rgba(90,102,117,.4)" }}>—</span>}
                    </td>
                    <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                      <button style={styles.btn()} onClick={() => copy(c.code, c.code)}>
                        {copied === c.code ? "✓ Copiado" : "📋 Copiar"}
                      </button>{" "}
                      <button style={styles.btn()} onClick={() => copy(`${window.location.origin}/register?code=${c.code}`, c.code + "_l")}>
                        {copied === c.code + "_l" ? "✓ Copiado" : "🔗 Link"}
                      </button>{" "}
                      <button style={styles.btn(false, true)} onClick={() => remove(c)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Usados */}
      {used.length > 0 && (
        <div style={styles.card}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Usados ({used.length})</div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Código</th>
                <th style={styles.th}>Usado por</th>
                <th style={styles.th}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {used.slice(0, 15).map((c) => (
                <tr key={c.id}>
                  <td style={styles.td}>
                    <code style={{ fontFamily: "monospace", fontSize: 13, color: "rgba(90,102,117,.6)" }}>{c.code}</code>
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{c.used_by_name}</div>
                    <div style={{ fontSize: 11.5, color: "rgba(90,102,117,.55)" }}>{c.used_by_email}</div>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 12, color: "rgba(90,102,117,.7)" }}>
                      {c.used_at ? new Date(c.used_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
