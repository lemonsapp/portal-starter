import { useEffect, useState, useMemo } from "react";
import { generatePaymentReceipt, generateShipmentRemito } from "../utils/pdfGenerator.js";
import EditorialHero from "../components/EditorialHero.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const fmtUsd = (v) => `$${Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtArs = (v) => `$${Number(v || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (v) => {
  if (!v) return "-";
  try { const d = typeof v === "string" && !v.includes("T") ? new Date(v + "T12:00:00") : new Date(v); if (isNaN(d.getTime())) return String(v); return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return String(v); }
};
const fmtDateOnly = (v) => {
  if (!v) return "-";
  try { const str = typeof v === "string" ? v.slice(0, 10) : String(v).slice(0, 10); const d = new Date(str + "T12:00:00"); if (isNaN(d.getTime())) return String(v); return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return String(v); }
};
const num = (v) => Number(v || 0);

const METHODS = [
  { value: "USD_CASH",     label: "💵 USD Efectivo",       color: "#22c55e" },
  { value: "USDT",         label: "🔷 USDT",               color: "#3b82f6" },
  { value: "ARS_TRANSFER", label: "📲 Pesos Transferencia", color: "#a78bfa" },
  { value: "ARS_CASH",     label: "💴 Pesos Efectivo",     color: "#f5e03a" },
];
const METHOD_MAP = Object.fromEntries(METHODS.map(m => [m.value, m]));
const EXPENSE_CATEGORIES = ["Alquiler / Oficina", "Sueldos / Personal", "Logística / Flete", "Marketing", "Servicios", "Otros"];
const INCOME_CATEGORIES = ["Servicios", "Comisiones", "Consultoría", "Venta de activos", "Otros"];

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function monthBounds(year, month1) {
  const m = String(month1).padStart(2, "0");
  const lastDay = new Date(year, month1, 0).getDate();
  return { from: `${year}-${m}-01`, to: `${year}-${m}-${String(lastDay).padStart(2, "0")}` };
}

function MonthFilter({ year, month, onChange, onClear, active, loading }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase" }}>Mes</span>
      <select className="input" value={month} onChange={e => onChange(year, parseInt(e.target.value, 10))} style={{ width: 150 }} disabled={!active}>
        {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
      </select>
      <select className="input" value={year} onChange={e => onChange(parseInt(e.target.value, 10), month)} style={{ width: 100 }} disabled={!active}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      {active ? (
        <button onClick={onClear} disabled={loading}
          style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid var(--border2)", background: "transparent", color: "var(--muted2)", cursor: "pointer", fontFamily: "'Barlow',sans-serif", fontWeight: 600, fontSize: 12 }}>
          Ver todos
        </button>
      ) : (
        <button onClick={() => onChange(year, month)} disabled={loading}
          style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid rgba(245,224,58,0.3)", background: "rgba(245,224,58,0.06)", color: "var(--lemon)", cursor: "pointer", fontFamily: "'Barlow',sans-serif", fontWeight: 700, fontSize: 12 }}>
          Filtrar por mes
        </button>
      )}
      {loading && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted2)" }}>cargando…</span>}
    </div>
  );
}
const ACCOUNT_TYPE_LABELS = {
  usd_cash: { label: "💵 USD Efectivo", color: "#22c55e" },
  usdt:     { label: "🔷 USDT",         color: "#3b82f6" },
  bank_ars: { label: "🏦 Banco ARS",    color: "#a78bfa" },
  bank_usd: { label: "🏦 Banco USD",    color: "#34d399" },
  prepaid:  { label: "💳 Prepaga",      color: "#fbbf24" },
  other:    { label: "📁 Otra",         color: "#94a3b8" },
};

// ── Design Components ─────────────────────────────────────────────────────────
function FTabs({ tabs, active, onChange, size = "md" }) {
  const h = size === "sm" ? 36 : 42;
  return (
    <div style={{ display: "flex", gap: 4, padding: "4px 5px", background: "var(--deep)", border: "1px solid var(--border2)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)", width: "fit-content" }}>
      {tabs.map(t => {
        const on = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{ display: "flex", alignItems: "center", gap: 6, height: h, padding: `0 ${size === "sm" ? 12 : 16}px`, borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: size === "sm" ? 11 : 13, letterSpacing: "0.8px", textTransform: "uppercase", transition: "all .22s cubic-bezier(.34,1.56,.64,1)", background: on ? "var(--lemon)" : "transparent", color: on ? "var(--void)" : "var(--ghost)", boxShadow: on ? "0 4px 20px rgba(245,224,58,0.35)" : "none", transform: on ? "scale(1.02)" : "scale(1)" }}
            onMouseEnter={e => { if (!on) { e.currentTarget.style.background = "rgba(245,224,58,0.08)"; e.currentTarget.style.color = "var(--lemon)"; } }}
            onMouseLeave={e => { if (!on) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ghost)"; } }}>
            <span style={{ fontSize: size === "sm" ? 13 : 15 }}>{t.icon}</span>
            <span>{t.label}</span>
            {t.badge != null && t.badge > 0 && <span style={{ minWidth: 16, height: 16, borderRadius: 8, padding: "0 4px", background: on ? "rgba(0,0,0,0.2)" : "rgba(245,224,58,0.15)", color: on ? "var(--void)" : "var(--lemon)", fontSize: 9, fontFamily: "'DM Mono',monospace", display: "flex", alignItems: "center", justifyContent: "center" }}>{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Card({ children, style = {}, accent = "var(--lemon)" }) {
  return (
    <div style={{ background: "var(--mid)", border: "1px solid var(--border)", borderRadius: 18, position: "relative", overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${accent},transparent)` }} />
      {children}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent = "var(--lemon)" }) {
  return (
    <div className="cash-kpi" style={{ background: "var(--mid)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px 18px", position: "relative", overflow: "hidden", transition: "all .2s", cursor: "default" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.4)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${accent},transparent)` }} />
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: "1px", color: "#fff", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Lbl({ children }) {
  return <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 500, letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 6 }}>{children}</div>;
}

function Btn({ children, onClick, disabled, v = "ghost", style = {}, size = "md" }) {
  const h = size === "sm" ? 30 : size === "lg" ? 50 : 40;
  const variants = {
    ghost:   { background: "var(--faint2)", border: "1px solid var(--border2)", color: "var(--text)" },
    primary: { background: "var(--lemon)", border: "none", color: "var(--void)", boxShadow: "0 4px 20px rgba(245,224,58,0.3)" },
    danger:  { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" },
    green:   { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#4ade80" },
    blue:    { background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", color: "#93c5fd" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ height: h, padding: `0 ${size === "sm" ? 10 : 16}px`, borderRadius: 10, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: size === "sm" ? 11 : 13, letterSpacing: "0.8px", textTransform: "uppercase", transition: "all .2s", opacity: disabled ? .45 : 1, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", ...variants[v], ...style }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = "translateY(-1px) scale(1.02)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; }}>
      {children}
    </button>
  );
}

function Hr() { return <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />; }

function MethodBadge({ method }) {
  const m = METHOD_MAP[method];
  if (!m) return <span>{method}</span>;
  return <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 500, letterSpacing: "1px", padding: "3px 8px", borderRadius: 6, background: `${m.color}15`, border: `1px solid ${m.color}30`, color: m.color, whiteSpace: "nowrap" }}>{m.label}</span>;
}

function Toast({ msg, onClose }) {
  if (!msg) return null;
  const isErr = /error|inválid|falt|no se/i.test(msg);
  return (
    <div onClick={onClose} style={{ padding: "12px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 14, background: isErr ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)", border: `1px solid ${isErr ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`, color: isErr ? "#fca5a5" : "#86efac", fontFamily: "'Barlow',sans-serif" }}>
      {isErr ? "⚠ " : "✓ "}{msg}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────
const TH = ({ children }) => <th style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted2)", padding: "11px 12px", borderBottom: "1px solid var(--border)", textAlign: "left", background: "rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}>{children}</th>;
const TD = ({ children, style = {} }) => <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", verticalAlign: "middle", ...style }}>{children}</td>;

// ══════════════════════════════════════════════════════════════════════════════
// TAB COBROS
// ══════════════════════════════════════════════════════════════════════════════
function CobrosTab() {
  const [msg, setMsg] = useState("");
  const [clientNum, setClientNum] = useState("");
  const [clientData, setClientData] = useState(null);
  const [loadingClient, setLoadingClient] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [method, setMethod] = useState("USD_CASH");
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState([{ method: "USD_CASH", amount: "" }, { method: "USDT", amount: "" }]);
  const [exchangeRate, setExchangeRate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [payAccount, setPayAccount] = useState("");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [histFilter, setHistFilter] = useState({ from: "", to: "", method: "", client_number: "" });
  const [generatingPdf, setGeneratingPdf] = useState(null);
  const [editPayment, setEditPayment] = useState(null);
  const [editForm, setEditForm] = useState({ method: "", notes: "", exchange_rate: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const selectedShipments = useMemo(() => (clientData?.shipments || []).filter(s => selected.has(s.id)), [clientData, selected]);
  const totalUsd = useMemo(() => selectedShipments.reduce((a, s) => a + num(s.estimated_usd), 0), [selectedShipments]);
  const needsArs = !splitMode && (method === "ARS_TRANSFER" || method === "ARS_CASH");
  const splitTotal = splitMode ? splits.reduce((a, s) => a + (parseFloat(s.amount) || 0), 0) : 0;
  const arsEquiv = needsArs && num(exchangeRate) > 0 ? totalUsd * num(exchangeRate) : null;

  async function findClient() {
    setMsg(""); setClientData(null); setSelected(new Set());
    if (!clientNum.trim()) return;
    setLoadingClient(true);
    try {
      const res = await fetch(`${API}/cash/pending/${clientNum.trim()}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (!res.ok) { setMsg(data?.error || "Error"); return; }
      setClientData(data);
      if (!data.shipments.length) setMsg("Este cliente no tiene paquetes pendientes de cobro.");
    } catch { setMsg("Error de red"); }
    finally { setLoadingClient(false); }
  }

  function toggleSelect(id) { setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); }
  function selectAll() { setSelected(new Set((clientData?.shipments || []).map(s => s.id))); }

  async function registerPayment() {
    if (!clientData?.user) return setMsg("Buscá un cliente primero");
    if (selected.size === 0) return setMsg("Seleccioná al menos un paquete");
    if (!splitMode && needsArs && (!exchangeRate || num(exchangeRate) <= 0)) return setMsg("Ingresá el tipo de cambio");
    if (splitMode) {
      const act = splits.filter(s => parseFloat(s.amount) > 0);
      if (!act.length) return setMsg("Ingresá al menos un monto");
      const st = act.reduce((a, s) => a + parseFloat(s.amount), 0);
      if (Math.abs(st - totalUsd) > 0.10) return setMsg(`La suma (${fmtUsd(st)}) no coincide con el total (${fmtUsd(totalUsd)})`);
    }
    setSaving(true); setMsg("");
    try {
      const body = splitMode
        ? { user_id: clientData.user.id, shipment_ids: [...selected], notes: notes || null, account_id: payAccount ? parseInt(payAccount, 10) : null, splits: splits.filter(s => parseFloat(s.amount) > 0).map(sp => { const na = sp.method === "ARS_TRANSFER" || sp.method === "ARS_CASH"; return { method: sp.method, amount: parseFloat(sp.amount), exchange_rate: na && num(exchangeRate) > 0 ? num(exchangeRate) : null, amount_ars: na && num(exchangeRate) > 0 ? parseFloat(sp.amount) * num(exchangeRate) : null }; }) }
        : { user_id: clientData.user.id, shipment_ids: [...selected], method, exchange_rate: needsArs ? num(exchangeRate) : null, amount_ars: arsEquiv, notes: notes || null, account_id: payAccount ? parseInt(payAccount, 10) : null };
      const res = await fetch(`${API}/cash/payments`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setMsg(data?.error || "Error"); return; }
      setMsg(`✅ Cobro registrado — ${fmtUsd(totalUsd)}`);
      setClientData(null); setSelected(new Set()); setNotes(""); setExchangeRate(""); setClientNum(""); setSplitMode(false);
      setSplits([{ method: "USD_CASH", amount: "" }, { method: "USDT", amount: "" }]);
      await loadHistory();
    } catch { setMsg("Error de red"); }
    finally { setSaving(false); }
  }

  async function saveEditPayment() {
    if (!editPayment) return; setSavingEdit(true);
    try {
      const res = await fetch(`${API}/cash/payments/${editPayment.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ method: editForm.method || null, notes: editForm.notes || null, exchange_rate: editForm.exchange_rate ? num(editForm.exchange_rate) : null }) });
      const data = await res.json();
      if (!res.ok) { setMsg(data?.error || "Error"); return; }
      setMsg("Cobro actualizado ✅"); setEditPayment(null); await loadHistory();
    } catch { setMsg("Error de red"); }
    finally { setSavingEdit(false); }
  }

  async function deletePayment(id) {
    if (!confirm("¿Anular este cobro?")) return;
    const res = await fetch(`${API}/cash/payments/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
    if (res.ok) { setMsg("Cobro anulado"); await loadHistory(); } else setMsg("Error anulando");
  }

  async function downloadRecibo(payment) {
    setGeneratingPdf(payment.id);
    try { generatePaymentReceipt(payment, (payment.items || []).map(it => ({ ...it }))); }
    catch (e) { setMsg("Error generando PDF: " + e.message); }
    finally { setGeneratingPdf(null); }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    const qs = new URLSearchParams();
    if (histFilter.from) qs.set("from", histFilter.from);
    if (histFilter.to) qs.set("to", histFilter.to);
    if (histFilter.method) qs.set("method", histFilter.method);
    if (histFilter.client_number) qs.set("client_number", histFilter.client_number);
    try { const res = await fetch(`${API}/cash/payments?${qs}`, { headers: { Authorization: `Bearer ${getToken()}` } }); const data = await res.json(); if (res.ok) setHistory(data.rows || []); } catch {}
    finally { setLoadingHistory(false); }
  }

  useEffect(() => {
    loadHistory();
    fetch(`${API}/accounts`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()).then(d => setAccounts(d.accounts || [])).catch(() => {});
  }, []);

  const histTotals = useMemo(() => METHODS.reduce((acc, m) => { acc[m.value] = history.filter(h => h.method === m.value).reduce((a, h) => a + num(h.amount_usd), 0); return acc; }, {}), [history]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Toast msg={msg} onClose={() => setMsg("")} />

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
        {METHODS.map(m => <KpiCard key={m.value} icon={m.label.split(" ")[0]} label={m.label.slice(2)} value={fmtUsd(histTotals[m.value])} sub="En el período" accent={m.color} />)}
        <KpiCard icon="💰" label="Total cobrado" value={fmtUsd(Object.values(histTotals).reduce((a, b) => a + b, 0))} sub="Todos los métodos" accent="var(--lemon)" />
        <KpiCard icon="📉" label="Costo total" value={fmtUsd(history.reduce((a, h) => a + num(h.cost_usd || 0), 0))} sub="Costo real" accent="#ef4444" />
        <KpiCard icon="📈" label="Ganancia neta" value={fmtUsd(history.reduce((a, h) => a + num(h.profit_usd || 0), 0))} sub="Cobrado − costo" accent="#22c55e" />
      </div>

      {/* Registrar cobro */}
      <Card style={{ padding: "20px 22px" }} accent="var(--lemon)">
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--orange)", textTransform: "uppercase", marginBottom: 16 }}>Registrar cobro</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input className="input" placeholder="Nº de cliente" value={clientNum} onChange={e => setClientNum(e.target.value)} onKeyDown={e => e.key === "Enter" && findClient()} style={{ maxWidth: 220 }} />
          <Btn onClick={findClient} disabled={loadingClient} v="primary">{loadingClient ? "Buscando…" : "Buscar"}</Btn>
        </div>

        {clientData && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "14px 16px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: "var(--lemon)", display: "grid", placeItems: "center", fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: "var(--void)", flexShrink: 0 }}>{String(clientData.user.name || "?")[0].toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 15 }}>#{clientData.user.client_number} — {clientData.user.name}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted2)", marginTop: 2 }}>{clientData.user.email}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)" }}>PENDIENTE TOTAL</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: "1px", color: "var(--lemon)" }}>{fmtUsd(clientData.shipments.reduce((a, s) => a + num(s.estimated_usd), 0))}</div>
              </div>
            </div>

            {clientData.shipments.length > 0 ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase" }}>Paquetes pendientes</div>
                  <Btn onClick={selectAll} size="sm">Seleccionar todos</Btn>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {clientData.shipments.map(s => (
                    <div key={s.id} onClick={() => toggleSelect(s.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: selected.has(s.id) ? "rgba(245,224,58,0.06)" : "var(--faint2)", border: `1px solid ${selected.has(s.id) ? "rgba(245,224,58,0.28)" : "var(--border)"}`, borderRadius: 12, cursor: "pointer", transition: "all .15s" }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: selected.has(s.id) ? "var(--lemon)" : "var(--faint2)", border: `1px solid ${selected.has(s.id) ? "transparent" : "var(--border2)"}`, display: "grid", placeItems: "center", fontSize: 12, color: selected.has(s.id) ? "var(--void)" : "transparent", fontWeight: 900 }}>✓</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 500, color: "var(--lemon)" }}>{s.code}</span>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", color: "var(--muted2)", padding: "1px 6px", borderRadius: 4, background: "var(--faint2)", border: "1px solid var(--border)" }}>{s.origin}{s.service && s.service !== "NORMAL" ? ` · ${s.service}` : ""}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ghost)", marginTop: 2 }}>{s.description}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: "1px", color: "var(--lemon)" }}>{fmtUsd(s.estimated_usd)}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)" }}>{Number(s.weight_kg).toFixed(2)} kg</div>
                      </div>
                    </div>
                  ))}
                </div>

                {selected.size > 0 && (
                  <Card style={{ padding: "18px 20px" }} accent="#22c55e">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 4, textTransform: "uppercase" }}>Total a cobrar</div>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 42, letterSpacing: "1px", color: "var(--lemon)", lineHeight: 1 }}>{fmtUsd(totalUsd)}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)", marginTop: 4 }}>{selected.size} paquete{selected.size !== 1 ? "s" : ""}</div>
                      </div>
                      {arsEquiv && (
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 4 }}>EQUIV. PESOS</div>
                          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: "1px", color: "#a78bfa" }}>{fmtArs(arsEquiv)}</div>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)", marginTop: 2 }}>@ ${num(exchangeRate).toLocaleString("es-AR")}</div>
                        </div>
                      )}
                    </div>
                    <Hr />

                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <Lbl>Método de pago</Lbl>
                        <button onClick={() => setSplitMode(p => !p)} style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", fontWeight: 500, padding: "4px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: splitMode ? "var(--lemon)" : "var(--faint2)", color: splitMode ? "var(--void)" : "var(--ghost)", textTransform: "uppercase" }}>⚡ {splitMode ? "Split ON" : "Split"}</button>
                      </div>
                      {!splitMode ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {METHODS.map(m => (
                            <button key={m.value} onClick={() => setMethod(m.value)} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "'Barlow',sans-serif", fontWeight: 700, fontSize: 13, background: method === m.value ? m.color : "var(--faint2)", color: method === m.value ? "var(--void)" : "var(--ghost)", boxShadow: method === m.value ? `0 0 16px ${m.color}50` : "none", transition: "all .15s" }}>{m.label}</button>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)", letterSpacing: "1px" }}>Total: {fmtUsd(totalUsd)}</div>
                          {splits.map((sp, i) => (
                            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <select value={sp.method} onChange={e => setSplits(prev => prev.map((s, j) => j === i ? { ...s, method: e.target.value } : s))} className="input" style={{ flex: 1 }}>
                                {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                              </select>
                              <input type="number" placeholder="USD" value={sp.amount} onChange={e => setSplits(prev => prev.map((s, j) => j === i ? { ...s, amount: e.target.value } : s))} className="input" style={{ width: 110, color: "var(--lemon)", fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px" }} />
                              {i === splits.length - 1 && <button onClick={() => setSplits(p => [...p, { method: "ARS_CASH", amount: "" }])} style={{ background: "var(--faint2)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text)", width: 32, height: 42, cursor: "pointer", fontSize: 16 }}>+</button>}
                            </div>
                          ))}
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: Math.abs(splitTotal - totalUsd) < 0.01 ? "#4ade80" : "var(--orange)", letterSpacing: "1px" }}>
                            Asignado: {fmtUsd(splitTotal)} / {fmtUsd(totalUsd)} {Math.abs(splitTotal - totalUsd) < 0.01 ? "✓" : `(falta ${fmtUsd(totalUsd - splitTotal)})`}
                          </div>
                        </div>
                      )}
                    </div>

                    {needsArs && (
                      <div style={{ marginBottom: 14 }}>
                        <Lbl>Tipo de cambio (ARS por USD)</Lbl>
                        <input className="input" placeholder="Ej: 1250" inputMode="decimal" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} style={{ maxWidth: 200 }} />
                      </div>
                    )}
                    <div style={{ marginBottom: 14 }}>
                      <Lbl>Notas (opcional)</Lbl>
                      <input className="input" placeholder="Observaciones del cobro…" value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <Lbl>Acreditar en cuenta (opcional)</Lbl>
                      <select className="input" value={payAccount} onChange={e => setPayAccount(e.target.value)}>
                        <option value="">— Sin asignar —</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                      </select>
                    </div>
                    <Btn onClick={registerPayment} disabled={saving} v="primary" size="lg" style={{ width: "100%", borderRadius: 14, fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "2px" }}>
                      {saving ? "Registrando…" : `Confirmar cobro ${fmtUsd(totalUsd)}`}
                    </Btn>
                  </Card>
                )}
              </>
            ) : (
              <div style={{ padding: 24, textAlign: "center", fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase" }}>Sin paquetes pendientes</div>
            )}
          </>
        )}
      </Card>

      {/* ── Modal editar cobro ── */}
      {editPayment && (
        <div style={{position:"fixed",inset:0,zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)"}} onClick={()=>setEditPayment(null)}>
          <div style={{background:"var(--mid)",border:"1px solid var(--border2)",borderRadius:20,padding:"28px 32px",width:480,maxWidth:"94vw",position:"relative",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,var(--lemon),var(--orange),transparent)"}}/>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"2px",marginBottom:6}}>Editar cobro</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",color:"var(--muted2)",marginBottom:20,textTransform:"uppercase"}}>
              #{editPayment.client_number} · {editPayment.client_name} · {fmtUsd(editPayment.amount_usd)}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",color:"var(--muted2)",textTransform:"uppercase",marginBottom:6}}>Método</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {METHODS.map(m=>(
                    <button key={m.value} onClick={()=>setEditForm(f=>({...f,method:m.value}))} style={{height:38,padding:"0 14px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:12,background:editForm.method===m.value?m.color:"var(--faint2)",color:editForm.method===m.value?"var(--void)":"var(--ghost)",boxShadow:editForm.method===m.value?`0 0 14px ${m.color}50`:"none",transition:"all .15s"}}>{m.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",color:"var(--muted2)",textTransform:"uppercase",marginBottom:6}}>Tipo de cambio (ARS/USD)</div>
                <input className="input" placeholder="Ej: 1250" inputMode="decimal" value={editForm.exchange_rate} onChange={e=>setEditForm(f=>({...f,exchange_rate:e.target.value}))} style={{maxWidth:200}}/>
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",color:"var(--muted2)",textTransform:"uppercase",marginBottom:6}}>Notas</div>
                <input className="input" placeholder="Observaciones…" value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}/>
              </div>
              <div style={{display:"flex",gap:10,marginTop:8}}>
                <button onClick={saveEditPayment} disabled={savingEdit} style={{flex:1,height:46,borderRadius:12,border:"none",cursor:savingEdit?"not-allowed":"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:"2px",background:"var(--lemon)",color:"var(--void)",opacity:savingEdit?.6:1,transition:"all .2s"}}>
                  {savingEdit?"Guardando…":"Guardar cambios"}
                </button>
                <button onClick={()=>setEditPayment(null)} style={{height:46,padding:"0 20px",borderRadius:12,border:"1px solid var(--border2)",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:13,letterSpacing:"1px",textTransform:"uppercase",background:"var(--faint2)",color:"var(--ghost)"}}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Historial */}
      <Card style={{ padding: "20px 22px" }} accent="#60a5fa">
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase", marginBottom: 16 }}>Historial de cobros</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <input type="date" className="input" value={histFilter.from} onChange={e => setHistFilter(f => ({ ...f, from: e.target.value }))} style={{ width: 150 }} />
          <input type="date" className="input" value={histFilter.to} onChange={e => setHistFilter(f => ({ ...f, to: e.target.value }))} style={{ width: 150 }} />
          <select className="input" value={histFilter.method} onChange={e => setHistFilter(f => ({ ...f, method: e.target.value }))} style={{ width: 180 }}>
            <option value="">Todos los métodos</option>
            {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input className="input" placeholder="Nº cliente" value={histFilter.client_number} onChange={e => setHistFilter(f => ({ ...f, client_number: e.target.value }))} style={{ width: 130 }} />
          <Btn onClick={loadHistory} disabled={loadingHistory}>{loadingHistory ? "…" : "Filtrar"}</Btn>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr><TH>Fecha</TH><TH>Cliente</TH><TH>Paquetes</TH><TH>Método</TH><TH>Monto USD</TH><TH>Costo</TH><TH>Ganancia</TH><TH>ARS</TH><TH>Notas</TH><TH></TH></tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="cash-tr">
                  <TD><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10 }}>{fmtDate(h.created_at)}</span></TD>
                  <TD>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 500, color: "var(--lemon)" }}>#{h.client_number}</div>
                    <div style={{ fontSize: 11, color: "var(--muted2)" }}>{h.client_name}</div>
                  </TD>
                  <TD>
                    {(h.items || []).map(it => (
                      <div key={it.shipment_id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--lemon)" }}>{it.code}</span>
                        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, letterSpacing: "1px", color: "#22c55e" }}>{fmtUsd(it.amount_usd)}</span>
                      </div>
                    ))}
                  </TD>
                  <TD><MethodBadge method={h.method} /></TD>
                  <TD><span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: "#22c55e" }}>{fmtUsd(h.amount_usd)}</span></TD>
                  <TD><span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: "#ef4444" }}>{fmtUsd(h.cost_usd || 0)}</span></TD>
                  <TD><span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: num(h.profit_usd || 0) >= 0 ? "#4ade80" : "#f97316" }}>{fmtUsd(h.profit_usd || 0)}</span></TD>
                  <TD style={{ fontSize: 11, color: "var(--muted2)", fontFamily: "'DM Mono',monospace" }}>{h.amount_ars ? `${fmtArs(h.amount_ars)}` : "–"}</TD>
                  <TD style={{ fontSize: 11, color: "var(--muted2)" }}>{h.notes || "–"}</TD>
                  <TD>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn onClick={() => downloadRecibo(h)} size="sm" style={{ width: 32, padding: 0, justifyContent: "center" }}>{generatingPdf === h.id ? "…" : "📄"}</Btn>
                      <Btn onClick={() => { setEditPayment(h); setEditForm({ method: h.method, notes: h.notes || "", exchange_rate: h.exchange_rate || "" }); }} size="sm" style={{ width: 32, padding: 0, justifyContent: "center" }}>✏</Btn>
                      <Btn onClick={() => deletePayment(h.id)} v="danger" size="sm" style={{ width: 32, padding: 0, justifyContent: "center" }}>✕</Btn>
                    </div>
                  </TD>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={10} style={{ textAlign: "center", padding: 28, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase" }}>Sin cobros en el período</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB GASTOS
// ══════════════════════════════════════════════════════════════════════════════
function GastosTab() {
  const now = new Date();
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ type: "empresa", category: EXPENSE_CATEGORIES[0], description: "", amount: "", currency: "USD", date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const initialBounds = monthBounds(now.getFullYear(), now.getMonth() + 1);
  const [filter, setFilter] = useState({ from: initialBounds.from, to: initialBounds.to, type: "", currency: "" });
  const [monthSel, setMonthSel] = useState({ year: now.getFullYear(), month: now.getMonth() + 1, active: true });
  const [fxFallback, setFxFallback] = useState(null);

  function applyMonth(year, month) {
    const b = monthBounds(year, month);
    setMonthSel({ year, month, active: true });
    setFilter(f => ({ ...f, from: b.from, to: b.to }));
  }
  function clearMonth() {
    setMonthSel(s => ({ ...s, active: false }));
    setFilter(f => ({ ...f, from: "", to: "" }));
  }

  async function loadExpenses() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filter.from) qs.set("from", filter.from); if (filter.to) qs.set("to", filter.to);
    if (filter.type) qs.set("type", filter.type); if (filter.currency) qs.set("currency", filter.currency);
    try { const res = await fetch(`${API}/cash/expenses?${qs}`, { headers: { Authorization: `Bearer ${getToken()}` } }); const data = await res.json(); if (res.ok) { setExpenses(data.rows || []); setTotals(data.totals || {}); } } catch {}
    finally { setLoading(false); }
  }

  async function addExpense() {
    if (!form.description.trim()) return setMsg("Ingresá una descripción");
    const amt = Number(String(form.amount).replace(",", ".")); if (!amt || amt <= 0) return setMsg("Monto inválido");
    setSaving(true); setMsg("");
    try {
      const res = await fetch(`${API}/cash/expenses`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: amt, account_id: form.account_id ? parseInt(form.account_id, 10) : null }) });
      const data = await res.json();
      if (!res.ok) { setMsg(data?.error || "Error"); return; }
      setMsg("Gasto registrado ✅"); setForm(f => ({ ...f, description: "", amount: "" })); await loadExpenses();
    } catch { setMsg("Error de red"); }
    finally { setSaving(false); }
  }

  async function deleteExpense(id) {
    if (!confirm("¿Eliminar este gasto?")) return;
    const res = await fetch(`${API}/cash/expenses/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
    if (res.ok) { setMsg("Gasto eliminado"); await loadExpenses(); } else setMsg("Error eliminando");
  }

  useEffect(() => {
    fetch(`${API}/accounts`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()).then(d => setAccounts(d.accounts || [])).catch(() => {});
    fetch(`${API}/cash/fx-current`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()).then(d => setFxFallback(d?.fx || null)).catch(() => {});
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [filter.from, filter.to, filter.type, filter.currency]);

  const totalConvertedUsd = expenses.reduce((acc, r) => {
    const amt = Number(r.amount || 0);
    if (r.currency === "USD") return acc + amt;
    const fx = Number(r.exchange_rate) || fxFallback;
    if (!fx || fx <= 0) return acc;
    return acc + amt / fx;
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Toast msg={msg} onClose={() => setMsg("")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
        <KpiCard icon="🏢" label="Empresa USD" value={fmtUsd(totals.empresa_USD)} accent="#3b82f6" />
        <KpiCard icon="🏢" label="Empresa ARS" value={fmtArs(totals.empresa_ARS)} accent="#3b82f6" />
        <KpiCard icon="👤" label="Personal USD" value={fmtUsd(totals.personal_USD)} accent="#a78bfa" />
        <KpiCard icon="👤" label="Personal ARS" value={fmtArs(totals.personal_ARS)} accent="#a78bfa" />
        <KpiCard icon="📊" label="Total USD" value={fmtUsd(totals.USD)} accent="var(--lemon)" />
        <KpiCard icon="📊" label="Total ARS" value={fmtArs(totals.ARS)} accent="var(--lemon)" />
        <KpiCard icon="💱" label="Total ≈ USD" value={fmtUsd(totalConvertedUsd)} accent="#22c55e"
          sub={fxFallback ? `TC fallback $${Number(fxFallback).toLocaleString("es-AR")}` : "Sin TC fallback"} />
      </div>

      <Card style={{ padding: "20px 22px" }} accent="var(--orange)">
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--orange)", textTransform: "uppercase", marginBottom: 16 }}>Registrar gasto</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
          <div>
            <Lbl>Tipo</Lbl>
            <div style={{ display: "flex", gap: 6 }}>
              {[["empresa", "🏢 Empresa", "#3b82f6"], ["personal", "👤 Personal", "#a78bfa"]].map(([v, l, c]) => (
                <button key={v} onClick={() => setForm(f => ({ ...f, type: v }))} style={{ flex: 1, height: 40, borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "'Barlow',sans-serif", fontWeight: 700, fontSize: 12, background: form.type === v ? c : "var(--faint2)", color: form.type === v ? "#fff" : "var(--ghost)", transition: "all .15s" }}>{l}</button>
              ))}
            </div>
          </div>
          <div><Lbl>Categoría</Lbl><select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div>
            <Lbl>Moneda</Lbl>
            <div style={{ display: "flex", gap: 6 }}>
              {[["USD", "💵 USD", "#22c55e"], ["ARS", "💴 ARS", "#f5e03a"]].map(([v, l, c]) => (
                <button key={v} onClick={() => setForm(f => ({ ...f, currency: v }))} style={{ flex: 1, height: 40, borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "'Barlow',sans-serif", fontWeight: 700, fontSize: 12, background: form.currency === v ? c : "var(--faint2)", color: form.currency === v ? "var(--void)" : "var(--ghost)", transition: "all .15s" }}>{l}</button>
              ))}
            </div>
          </div>
          <div><Lbl>Fecha</Lbl><input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <Lbl>Debitado de cuenta (opcional)</Lbl>
          <select className="input" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} style={{ maxWidth: 300 }}>
            <option value="">— Sin asignar —</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div><Lbl>Descripción</Lbl><input className="input" placeholder="Ej: Alquiler local diciembre" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} onKeyDown={e => e.key === "Enter" && addExpense()} /></div>
            <div><Lbl>Monto ({form.currency})</Lbl><input className="input" placeholder="0.00" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} onKeyDown={e => e.key === "Enter" && addExpense()} style={{ maxWidth: 200 }} /></div>
          </div>
          <Btn onClick={addExpense} disabled={saving} v="primary" size="lg" style={{ padding: "0 28px" }}>{saving ? "…" : "+ Agregar"}</Btn>
        </div>
      </Card>

      <Card style={{ padding: "20px 22px" }} accent="#ef4444">
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase", marginBottom: 16 }}>Historial de gastos</div>
        <div style={{ marginBottom: 12 }}>
          <MonthFilter year={monthSel.year} month={monthSel.month} active={monthSel.active} loading={loading}
            onChange={applyMonth} onClear={clearMonth} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <input type="date" className="input" value={filter.from} onChange={e => { setFilter(f => ({ ...f, from: e.target.value })); setMonthSel(s => ({ ...s, active: false })); }} style={{ width: 150 }} />
          <input type="date" className="input" value={filter.to} onChange={e => { setFilter(f => ({ ...f, to: e.target.value })); setMonthSel(s => ({ ...s, active: false })); }} style={{ width: 150 }} />
          <select className="input" value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))} style={{ width: 160 }}>
            <option value="">Todos los tipos</option><option value="empresa">🏢 Empresa</option><option value="personal">👤 Personal</option>
          </select>
          <select className="input" value={filter.currency} onChange={e => setFilter(f => ({ ...f, currency: e.target.value }))} style={{ width: 130 }}>
            <option value="">Todas las monedas</option><option value="USD">💵 USD</option><option value="ARS">💴 ARS</option>
          </select>
          <Btn onClick={loadExpenses} disabled={loading}>{loading ? "…" : "Filtrar"}</Btn>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><TH>Fecha</TH><TH>Tipo</TH><TH>Categoría</TH><TH>Descripción</TH><TH>Monto</TH><TH>Moneda</TH><TH>📎</TH><TH>Operador</TH><TH></TH></tr></thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} className="cash-tr">
                  <TD><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10 }}>{fmtDateOnly(e.date)}</span></TD>
                  <TD><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", padding: "3px 8px", borderRadius: 6, background: e.type === "empresa" ? "rgba(59,130,246,0.12)" : "rgba(167,139,250,0.12)", border: `1px solid ${e.type === "empresa" ? "rgba(59,130,246,0.3)" : "rgba(167,139,250,0.3)"}`, color: e.type === "empresa" ? "#93c5fd" : "#c4b5fd" }}>{e.type === "empresa" ? "🏢 Empresa" : "👤 Personal"}</span></TD>
                  <TD style={{ fontSize: 12 }}>{e.category}</TD>
                  <TD style={{ fontSize: 13 }}>{e.description}</TD>
                  <TD><span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: e.currency === "USD" ? "#22c55e" : "var(--lemon)" }}>{e.currency === "USD" ? fmtUsd(e.amount) : fmtArs(e.amount)}</span></TD>
                  <TD><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", padding: "2px 6px", borderRadius: 5, background: e.currency === "USD" ? "rgba(34,197,94,0.12)" : "rgba(245,224,58,0.1)", color: e.currency === "USD" ? "#86efac" : "var(--lemon)" }}>{e.currency}</span></TD>
                  <TD>{e.receipt_url ? <a href={e.receipt_url} target="_blank" rel="noreferrer" title="Ver comprobante" style={{ textDecoration: "none", fontSize: 16 }}>📎</a> : <span style={{ color: "var(--faint)", fontSize: 11 }}>–</span>}</TD>
                  <TD style={{ fontSize: 11, color: "var(--muted2)" }}>{e.operator_name || "–"}</TD>
                  <TD><Btn onClick={() => deleteExpense(e.id)} v="danger" size="sm" style={{ width: 30, padding: 0, justifyContent: "center" }}>✕</Btn></TD>
                </tr>
              ))}
              {!expenses.length && <tr><td colSpan={9} style={{ textAlign: "center", padding: 28, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase" }}>{monthSel.active ? `No hay gastos en ${MONTH_NAMES[monthSel.month - 1]} ${monthSel.year}` : "Sin gastos en el período"}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB INGRESOS
// ══════════════════════════════════════════════════════════════════════════════
function IngresosTab() {
  const now = new Date();
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ category: INCOME_CATEGORIES[0], description: "", amount: "", currency: "USD", date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [income, setIncome] = useState([]);
  const [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const initialBoundsI = monthBounds(now.getFullYear(), now.getMonth() + 1);
  const [filter, setFilter] = useState({ from: initialBoundsI.from, to: initialBoundsI.to, currency: "" });
  const [monthSel, setMonthSel] = useState({ year: now.getFullYear(), month: now.getMonth() + 1, active: true });

  function applyMonth(year, month) {
    const b = monthBounds(year, month);
    setMonthSel({ year, month, active: true });
    setFilter(f => ({ ...f, from: b.from, to: b.to }));
  }
  function clearMonth() {
    setMonthSel(s => ({ ...s, active: false }));
    setFilter(f => ({ ...f, from: "", to: "" }));
  }

  async function loadIncome() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filter.from) qs.set("from", filter.from); if (filter.to) qs.set("to", filter.to); if (filter.currency) qs.set("currency", filter.currency);
    try {
      const [incRes, payRes] = await Promise.all([fetch(`${API}/cash/income?${qs}`, { headers: { Authorization: `Bearer ${getToken()}` } }), fetch(`${API}/cash/payments?${qs}`, { headers: { Authorization: `Bearer ${getToken()}` } })]);
      const incData = await incRes.json(); const payData = await payRes.json();
      const incRows = (incData.rows || []).map(r => ({ ...r, _type: "additional", _label: r.category, _detail: r.description, _amount_usd: r.currency === "USD" ? Number(r.amount) : null, _amount_ars: r.currency === "ARS" ? Number(r.amount) : null, _date: r.date }));
      const payRows = (payData.rows || []).map(r => ({ ...r, _type: "payment", _label: `Cobro #${r.client_number} ${r.client_name}`, _detail: (r.items || []).map(i => i.code).join(", "), _amount_usd: Number(r.profit_usd || r.amount_usd), _amount_ars: r.amount_ars ? Number(r.amount_ars) : null, _date: r.created_at ? r.created_at.slice(0, 10) : null }));
      const all = [...incRows, ...payRows].sort((a, b) => (b._date || "").localeCompare(a._date || ""));
      setIncome(all);
      setTotals({ USD: all.reduce((s, r) => s + (r._amount_usd || 0), 0), ARS: all.reduce((s, r) => s + (r._amount_ars || 0), 0), fromPkg: payRows.reduce((s, r) => s + (r._amount_usd || 0), 0), fromAdd: incRows.filter(r => r.currency === "USD").reduce((s, r) => s + Number(r.amount), 0) });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function addIncome() {
    if (!form.description.trim()) return setMsg("Ingresá una descripción");
    const amt = Number(String(form.amount).replace(",", ".")); if (!amt || amt <= 0) return setMsg("Monto inválido");
    setSaving(true); setMsg("");
    try {
      const res = await fetch(`${API}/cash/income`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: amt }) });
      const data = await res.json();
      if (!res.ok) { setMsg(data?.error || "Error"); return; }
      setMsg("Ingreso registrado ✅"); setForm(f => ({ ...f, description: "", amount: "" })); await loadIncome();
    } catch { setMsg("Error de red"); }
    finally { setSaving(false); }
  }

  async function deleteIncome(id) {
    if (!confirm("¿Eliminar este ingreso?")) return;
    const res = await fetch(`${API}/cash/income/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
    if (res.ok) { setMsg("Ingreso eliminado"); await loadIncome(); } else setMsg("Error eliminando");
  }

  useEffect(() => { loadIncome(); }, [filter.from, filter.to, filter.currency]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Toast msg={msg} onClose={() => setMsg("")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
        <KpiCard icon="💰" label="Total USD" value={fmtUsd(totals.USD)} accent="#22c55e" sub="Paquetes + adicionales" />
        <KpiCard icon="💴" label="Total ARS" value={fmtArs(totals.ARS)} accent="var(--lemon)" />
        <KpiCard icon="📦" label="Por paquetes" value={fmtUsd(totals.fromPkg)} accent="#3b82f6" />
        <KpiCard icon="➕" label="Adicionales" value={fmtUsd(totals.fromAdd)} accent="#a78bfa" />
        <KpiCard icon="📋" label="Registros" value={income.length} accent="var(--lemon)" />
      </div>

      <Card style={{ padding: "20px 22px" }} accent="#22c55e">
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase", marginBottom: 16 }}>Registrar ingreso adicional</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10, marginBottom: 12 }}>
          <div><Lbl>Categoría</Lbl><select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><Lbl>Moneda</Lbl><div style={{ display: "flex", gap: 6 }}>{[["USD", "💵 USD", "#22c55e"], ["ARS", "💴 ARS", "#f5e03a"]].map(([v, l, c]) => <button key={v} onClick={() => setForm(f => ({ ...f, currency: v }))} style={{ flex: 1, height: 40, borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "'Barlow',sans-serif", fontWeight: 700, fontSize: 12, background: form.currency === v ? c : "var(--faint2)", color: form.currency === v ? "var(--void)" : "var(--ghost)", transition: "all .15s" }}>{l}</button>)}</div></div>
          <div><Lbl>Fecha</Lbl><input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div><Lbl>Descripción</Lbl><input className="input" placeholder="Ej: Comisión por asesoramiento" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} onKeyDown={e => e.key === "Enter" && addIncome()} /></div>
            <div><Lbl>Monto ({form.currency})</Lbl><input className="input" placeholder="0.00" inputMode="decimal" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} onKeyDown={e => e.key === "Enter" && addIncome()} style={{ maxWidth: 200 }} /></div>
          </div>
          <Btn onClick={addIncome} disabled={saving} v="primary" size="lg" style={{ padding: "0 28px" }}>{saving ? "…" : "+ Agregar"}</Btn>
        </div>
      </Card>

      <Card style={{ padding: "20px 22px" }} accent="#a78bfa">
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase", marginBottom: 16 }}>Historial de ingresos</div>
        <div style={{ marginBottom: 12 }}>
          <MonthFilter year={monthSel.year} month={monthSel.month} active={monthSel.active} loading={loading}
            onChange={applyMonth} onClear={clearMonth} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <input type="date" className="input" value={filter.from} onChange={e => { setFilter(f => ({ ...f, from: e.target.value })); setMonthSel(s => ({ ...s, active: false })); }} style={{ width: 150 }} />
          <input type="date" className="input" value={filter.to} onChange={e => { setFilter(f => ({ ...f, to: e.target.value })); setMonthSel(s => ({ ...s, active: false })); }} style={{ width: 150 }} />
          <select className="input" value={filter.currency} onChange={e => setFilter(f => ({ ...f, currency: e.target.value }))} style={{ width: 130 }}>
            <option value="">Todas</option><option value="USD">💵 USD</option><option value="ARS">💴 ARS</option>
          </select>
          <Btn onClick={loadIncome} disabled={loading}>{loading ? "…" : "Filtrar"}</Btn>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><TH>Fecha</TH><TH>Tipo</TH><TH>Concepto</TH><TH>Detalle</TH><TH>Monto USD</TH><TH>Monto ARS</TH><TH></TH></tr></thead>
            <tbody>
              {income.map((i, idx) => (
                <tr key={`${i._type}-${i.id}-${idx}`} className="cash-tr">
                  <TD><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10 }}>{fmtDateOnly(i._date)}</span></TD>
                  <TD><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", padding: "3px 8px", borderRadius: 6, background: i._type === "payment" ? "rgba(59,130,246,0.12)" : "rgba(167,139,250,0.12)", border: `1px solid ${i._type === "payment" ? "rgba(59,130,246,0.3)" : "rgba(167,139,250,0.3)"}`, color: i._type === "payment" ? "#93c5fd" : "#c4b5fd" }}>{i._type === "payment" ? "📦 Paquetes" : "➕ Adicional"}</span></TD>
                  <TD style={{ fontFamily: "'Barlow',sans-serif", fontWeight: 700, fontSize: 13 }}>{i._label}</TD>
                  <TD style={{ fontSize: 11, color: "var(--muted2)" }}>{i._detail}</TD>
                  <TD>{i._amount_usd != null ? <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: "#22c55e" }}>{fmtUsd(i._amount_usd)}</span> : <span style={{ color: "var(--faint)" }}>–</span>}</TD>
                  <TD>{i._amount_ars != null ? <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: "var(--lemon)" }}>{fmtArs(i._amount_ars)}</span> : <span style={{ color: "var(--faint)" }}>–</span>}</TD>
                  <TD>{i._type === "additional" && <Btn onClick={() => deleteIncome(i.id)} v="danger" size="sm" style={{ width: 30, padding: 0, justifyContent: "center" }}>✕</Btn>}</TD>
                </tr>
              ))}
              {!income.length && <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase" }}>{monthSel.active ? `No hay ingresos en ${MONTH_NAMES[monthSel.month - 1]} ${monthSel.year}` : "Sin ingresos en el período"}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB FONDOS
// ══════════════════════════════════════════════════════════════════════════════
function FondosTab({ fxRate }) {
  const [msg, setMsg] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selAccount, setSelAccount] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loadingMov, setLoadingMov] = useState(false);
  const [movForm, setMovForm] = useState({ direction: "in", amount: "", description: "" });
  const [savingMov, setSavingMov] = useState(false);
  const [editBalId, setEditBalId] = useState(null);
  const [editBal, setEditBal] = useState("");
  const [savingBal, setSavingBal] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newAcc, setNewAcc] = useState({ name: "", type: "usd_cash", currency: "USD", balance: "0", notes: "" });
  const [savingNew, setSavingNew] = useState(false);

  async function loadAccounts() { setLoading(true); try { const res = await fetch(`${API}/accounts`, { headers: { Authorization: `Bearer ${getToken()}` } }); const data = await res.json(); if (res.ok) setAccounts(data.accounts || []); } catch {} finally { setLoading(false); } }
  async function loadMovements(id) { setLoadingMov(true); try { const res = await fetch(`${API}/accounts/${id}/movements`, { headers: { Authorization: `Bearer ${getToken()}` } }); const data = await res.json(); if (res.ok) setMovements(data.rows || []); } catch {} finally { setLoadingMov(false); } }
  async function saveBalance(id) { const amt = Number(String(editBal).replace(",", ".")); if (isNaN(amt)) return setMsg("Monto inválido"); setSavingBal(true); try { const res = await fetch(`${API}/accounts/${id}`, { method: "PUT", headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ balance: amt }) }); const data = await res.json(); if (!res.ok) { setMsg(data?.error || "Error"); return; } setMsg("Saldo actualizado ✅"); setEditBalId(null); setEditBal(""); await loadAccounts(); } catch { setMsg("Error de red"); } finally { setSavingBal(false); } }
  async function addMovement(id) { const amt = Number(String(movForm.amount).replace(",", ".")); if (!amt || amt <= 0) return setMsg("Monto inválido"); if (!movForm.description.trim()) return setMsg("Ingresá una descripción"); setSavingMov(true); try { const res = await fetch(`${API}/accounts/${id}/movements`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ direction: movForm.direction, amount: amt, description: movForm.description }) }); const data = await res.json(); if (!res.ok) { setMsg(data?.error || "Error"); return; } setMsg(`Movimiento registrado ✅`); setMovForm({ direction: "in", amount: "", description: "" }); await loadAccounts(); await loadMovements(id); } catch { setMsg("Error de red"); } finally { setSavingMov(false); } }
  async function createAccount() { if (!newAcc.name.trim()) return setMsg("Ingresá un nombre"); setSavingNew(true); try { const res = await fetch(`${API}/accounts`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...newAcc, balance: Number(newAcc.balance) || 0 }) }); const data = await res.json(); if (!res.ok) { setMsg(data?.error || "Error"); return; } setMsg("Cuenta creada ✅"); setShowNew(false); setNewAcc({ name: "", type: "usd_cash", currency: "USD", balance: "0", notes: "" }); await loadAccounts(); } catch { setMsg("Error de red"); } finally { setSavingNew(false); } }
  async function archiveAccount(id) { if (!confirm("¿Archivar esta cuenta?")) return; await fetch(`${API}/accounts/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } }); await loadAccounts(); }

  useEffect(() => { loadAccounts(); }, []);
  useEffect(() => { if (selAccount) loadMovements(selAccount.id); }, [selAccount]);

  const totals = accounts.reduce((acc, a) => { acc[a.currency] = (acc[a.currency] || 0) + Number(a.balance); return acc; }, {});
  const capitalUsd = accounts.reduce((sum, a) => { const bal = Number(a.balance); if (a.currency === "ARS" && fxRate && fxRate > 0) return sum + (bal / fxRate); return sum + bal; }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Toast msg={msg} onClose={() => setMsg("")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
        {Object.entries(totals).map(([cur, bal]) => <KpiCard key={cur} icon={cur === "USD" ? "💵" : cur === "USDT" ? "🔷" : "💴"} label={`Total ${cur}`} value={cur === "ARS" ? fmtArs(bal) : fmtUsd(bal)} sub={cur === "ARS" && fxRate ? `≈ ${fmtUsd(bal / fxRate)} USD` : undefined} accent={cur === "USD" ? "#22c55e" : cur === "USDT" ? "#3b82f6" : "var(--lemon)"} />)}
        <KpiCard icon="🏦" label="Capital total USD" value={fmtUsd(capitalUsd)} sub={fxRate ? `TC: $${Number(fxRate).toLocaleString("es-AR")}` : "Configurá el TC"} accent="var(--lemon)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
        {accounts.map(a => {
          const typeInfo = ACCOUNT_TYPE_LABELS[a.type] || ACCOUNT_TYPE_LABELS.other;
          const isSel = selAccount?.id === a.id;
          const isEdit = editBalId === a.id;
          const balNum = Number(a.balance);
          const usdEquiv = a.currency === "ARS" && fxRate && fxRate > 0 ? balNum / fxRate : null;
          return (
            <div key={a.id} onClick={() => setSelAccount(isSel ? null : a)} style={{ background: isSel ? "rgba(245,224,58,0.05)" : "var(--mid)", border: `1px solid ${isSel ? "rgba(245,224,58,0.25)" : "var(--border)"}`, borderRadius: 18, padding: "18px 20px", cursor: "pointer", transition: "all .2s", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${typeInfo.color},transparent)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", padding: "3px 8px", borderRadius: 6, background: `${typeInfo.color}15`, border: `1px solid ${typeInfo.color}30`, color: typeInfo.color }}>{typeInfo.label}</span>
                  <div style={{ fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 15, marginTop: 8 }}>{a.name}</div>
                </div>
                <Btn onClick={e => { e.stopPropagation(); archiveAccount(a.id); }} v="danger" size="sm" style={{ width: 28, padding: 0, justifyContent: "center" }}>✕</Btn>
              </div>
              {isEdit ? (
                <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                  <input className="input" value={editBal} onChange={e => setEditBal(e.target.value)} inputMode="decimal" placeholder="Nuevo saldo" style={{ flex: 1 }} autoFocus />
                  <Btn onClick={() => saveBalance(a.id)} disabled={savingBal} v="primary" size="sm">{savingBal ? "…" : "✓"}</Btn>
                  <Btn onClick={() => setEditBalId(null)} size="sm">✕</Btn>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: "1px", color: balNum >= 0 ? typeInfo.color : "#ef4444" }}>{a.currency === "ARS" ? fmtArs(balNum) : fmtUsd(balNum)}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)" }}>{a.currency}</span>
                    <button onClick={e => { e.stopPropagation(); setEditBalId(a.id); setEditBal(String(a.balance)); }} style={{ fontSize: 11, color: "var(--muted2)", background: "none", border: "none", cursor: "pointer" }}>✏</button>
                  </div>
                  {usdEquiv !== null && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted2)", marginTop: 3 }}>≈ <span style={{ color: "#22c55e" }}>{fmtUsd(usdEquiv)}</span> @ ${Number(fxRate).toLocaleString("es-AR")}</div>}
                </div>
              )}
              {a.notes && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)", marginTop: 8 }}>{a.notes}</div>}
            </div>
          );
        })}

        {!showNew ? (
          <div onClick={() => setShowNew(true)} style={{ background: "var(--faint2)", border: "1px dashed var(--border2)", borderRadius: 18, padding: "18px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--muted2)", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, letterSpacing: "1px", textTransform: "uppercase", minHeight: 120 }}>+ Nueva cuenta</div>
        ) : (
          <Card style={{ padding: "18px 20px" }} accent="var(--lemon)">
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--lemon)", textTransform: "uppercase", marginBottom: 12 }}>Nueva cuenta</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="input" placeholder="Nombre (ej: Efectivo caja)" value={newAcc.name} onChange={e => setNewAcc(a => ({ ...a, name: e.target.value }))} />
              <select className="input" value={newAcc.type} onChange={e => setNewAcc(a => ({ ...a, type: e.target.value }))}>{Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
              <select className="input" value={newAcc.currency} onChange={e => setNewAcc(a => ({ ...a, currency: e.target.value }))}><option value="USD">USD</option><option value="ARS">ARS</option><option value="USDT">USDT</option></select>
              <input className="input" placeholder="Saldo inicial" inputMode="decimal" value={newAcc.balance} onChange={e => setNewAcc(a => ({ ...a, balance: e.target.value }))} />
              <input className="input" placeholder="Notas (opcional)" value={newAcc.notes} onChange={e => setNewAcc(a => ({ ...a, notes: e.target.value }))} />
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={createAccount} disabled={savingNew} v="primary" style={{ flex: 1, height: 40 }}>{savingNew ? "…" : "Crear"}</Btn>
                <Btn onClick={() => setShowNew(false)} style={{ height: 40, padding: "0 14px" }}>Cancelar</Btn>
              </div>
            </div>
          </Card>
        )}
      </div>

      {selAccount && (
        <Card style={{ padding: "20px 22px" }} accent="var(--lemon)">
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: "2px", marginBottom: 16 }}>Movimientos — <span style={{ color: "var(--lemon)" }}>{selAccount.name}</span></div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[["in", "⬆ Ingreso", "#22c55e"], ["out", "⬇ Egreso", "#ef4444"]].map(([v, l, c]) => (
                <button key={v} onClick={() => setMovForm(f => ({ ...f, direction: v }))} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "'Barlow',sans-serif", fontWeight: 700, fontSize: 12, background: movForm.direction === v ? c : "var(--faint2)", color: movForm.direction === v ? "#fff" : "var(--ghost)", transition: "all .15s" }}>{l}</button>
              ))}
            </div>
            <input className="input" placeholder="Monto" inputMode="decimal" value={movForm.amount} onChange={e => setMovForm(f => ({ ...f, amount: e.target.value }))} style={{ width: 130 }} />
            <input className="input" placeholder="Descripción" value={movForm.description} onChange={e => setMovForm(f => ({ ...f, description: e.target.value }))} style={{ flex: 1, minWidth: 180 }} />
            <Btn onClick={() => addMovement(selAccount.id)} disabled={savingMov} v="primary">{savingMov ? "…" : "Registrar"}</Btn>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><TH>Fecha</TH><TH>Tipo</TH><TH>Descripción</TH><TH>Monto</TH><TH>Saldo después</TH></tr></thead>
              <tbody>
                {loadingMov ? <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted2)" }}>CARGANDO…</td></tr>
                  : movements.map(m => (
                    <tr key={m.id} className="cash-tr">
                      <TD><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10 }}>{fmtDate(m.created_at)}</span></TD>
                      <TD><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", padding: "3px 8px", borderRadius: 6, background: m.direction === "in" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: m.direction === "in" ? "#86efac" : "#fca5a5" }}>{m.direction === "in" ? "⬆ Ingreso" : "⬇ Egreso"}</span></TD>
                      <TD style={{ fontSize: 13 }}>{m.description}</TD>
                      <TD><span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: m.direction === "in" ? "#22c55e" : "#ef4444" }}>{m.direction === "in" ? "+" : "–"}{fmtUsd(m.amount)}</span></TD>
                      <TD style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--muted2)" }}>{m.balance_after != null ? fmtUsd(m.balance_after) : "–"}</TD>
                    </tr>
                  ))}
                {!loadingMov && !movements.length && <tr><td colSpan={5} style={{ textAlign: "center", padding: 24, fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase" }}>Sin movimientos</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
export default function CashRegister() {
  const [tab, setTab] = useState("cobros");
  const [fxRate, setFxRate] = useState(null);
  const [fxInput, setFxInput] = useState("");
  const [savingFx, setSavingFx] = useState(false);
  const [fxMsg, setFxMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/settings/fx`, { headers: { Authorization: `Bearer ${getToken()}` } }).then(r => r.json()).then(d => { if (d.rate) { setFxRate(d.rate); setFxInput(String(d.rate)); } }).catch(() => {});
  }, []);

  async function saveFx() {
    const n = Number(String(fxInput).replace(",", ".")); if (!n || n <= 0) return setFxMsg("Valor inválido");
    setSavingFx(true); setFxMsg("");
    try { const res = await fetch(`${API}/settings/fx`, { method: "PUT", headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ rate: n }) }); if (res.ok) { setFxMsg("✅ Guardado"); setFxRate(n); } else setFxMsg("Error"); }
    catch { setFxMsg("Error de red"); }
    finally { setSavingFx(false); setTimeout(() => setFxMsg(""), 2500); }
  }

  return (
    <div className="screen" data-staff-page style={{ maxWidth: 1500, margin: "0 auto", padding: "0 8px 48px" }}>
      <style>{`
        @keyframes cash-fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .cash-fade { animation: cash-fadeUp .35s ease both; }
        .cash-kpi { transition: all .2s !important; }
        .cash-tr:hover td { background: rgba(245,224,58,0.02) !important; }
        .cash-tr td { border-bottom: 1px solid var(--border); padding: 10px 12px; vertical-align: middle; }
      `}</style>

      <EditorialHero
        eyebrow="Finanzas"
        title="CONTROL"
        em="DE CAJA"
        watermark="CAJA"
        meta={["Cobros · Ingresos · Gastos · Fondos", fxRate ? `TC: $${Number(fxRate).toLocaleString("es-AR")}` : "Sin TC cargado"]}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--faint2)", border: "1px solid var(--border2)", padding: "8px 14px" }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", textTransform: "uppercase" }}>💱 USD/ARS</span>
            <input className="input" value={fxInput} onChange={e => setFxInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveFx()} inputMode="decimal" placeholder="Ej: 1200" style={{ width: 100, height: 34 }} />
            <Btn onClick={saveFx} disabled={savingFx} v="primary" size="sm">{savingFx ? "…" : "Guardar"}</Btn>
            {fxMsg && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "#86efac" }}>{fxMsg}</span>}
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, position: "sticky", top: 12, zIndex: 100 }}>
        <FTabs active={tab} onChange={setTab} tabs={[
          { key: "cobros",   icon: "💵", label: "Cobros" },
          { key: "ingresos", icon: "➕", label: "Ingresos" },
          { key: "gastos",   icon: "📋", label: "Gastos" },
          { key: "fondos",   icon: "💳", label: "Fondos" },
        ]} />
      </div>

      <div className="cash-fade" key={tab}>
        {tab === "cobros"   && <CobrosTab />}
        {tab === "ingresos" && <IngresosTab />}
        {tab === "gastos"   && <GastosTab />}
        {tab === "fondos"   && <FondosTab fxRate={fxRate} />}
      </div>
    </div>
  );
}