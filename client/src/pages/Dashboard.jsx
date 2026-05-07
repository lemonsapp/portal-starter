import { useEffect, useState, useRef, useCallback } from "react";
import StatusBadge from "../components/StatusBadge.jsx";
import FounderGodMode from "../components/FounderGodMode.jsx";
import FounderDashboardHero from "../components/FounderDashboardHero.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
const hdrs = () => ({ Authorization: `Bearer ${getToken()}` });

const n = (v) => Number(v || 0);
const usd = (v, compact = false) => {
  const num = n(v);
  if (compact && Math.abs(num) >= 1000) return `$${(num / 1000).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;
  return `$${num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const ars = (v) => `$${n(v).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const kg = (v) => `${n(v).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
const pct = (v) => `${n(v).toFixed(1)}%`;

const STATUS_CFG = {
  "Recibido en depósito": { c: "#f5e03a", glow: "rgba(245,224,58,0.3)", icon: "📥" },
  "En preparación":       { c: "#ff8c2a", glow: "rgba(255,140,42,0.3)", icon: "🔧" },
  "Despachado":           { c: "#60a5fa", glow: "rgba(96,165,250,0.3)", icon: "🚀" },
  "En tránsito":          { c: "#c084fc", glow: "rgba(192,132,252,0.3)", icon: "✈️" },
  "Listo para entrega":   { c: "#34d399", glow: "rgba(52,211,153,0.3)", icon: "📬" },
  "Entregado":            { c: "#f5e03a", glow: "rgba(245,224,58,0.3)", icon: "✅" },
};

// ── Animated Number ───────────────────────────────────────────────────────────
function AnimNum({ value, fmt = "usd", dur = 900, compact = false }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const target = n(value);
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(target * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  if (fmt === "kg") return <>{kg(display)}</>;
  if (fmt === "pct") return <>{pct(display)}</>;
  if (fmt === "raw") return <>{Math.round(display)}</>;
  return <>{usd(display, compact)}</>;
}

// ── Floating Tab Bar ──────────────────────────────────────────────────────────
function FTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, padding: "5px 6px", background: "var(--deep)", border: "1px solid var(--border2)", borderRadius: 18, boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)", width: "fit-content" }}>
      {tabs.map(t => {
        const on = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{ display: "flex", alignItems: "center", gap: 7, height: 42, padding: "0 18px", borderRadius: 13, border: "none", cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: "0.8px", textTransform: "uppercase", transition: "all .22s cubic-bezier(.34,1.56,.64,1)", background: on ? "var(--lemon)" : "transparent", color: on ? "var(--void)" : "var(--ghost)", boxShadow: on ? "0 4px 20px rgba(245,224,58,0.35), inset 0 1px 0 rgba(255,255,255,0.3)" : "none", transform: on ? "scale(1.02)" : "scale(1)" }}
            onMouseEnter={e => { if (!on) { e.currentTarget.style.background = "rgba(245,224,58,0.08)"; e.currentTarget.style.color = "var(--lemon)"; } }}
            onMouseLeave={e => { if (!on) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ghost)"; } }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Glass Card ────────────────────────────────────────────────────────────────
function Card({ children, style = {}, accent = "var(--lemon)" }) {
  return (
    <div style={{ background: "var(--mid)", border: "1px solid var(--border)", borderRadius: 18, position: "relative", overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${accent},transparent)` }} />
      {children}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, color = "var(--lemon)", fmt = "usd", icon, badge, trend, compact = false }) {
  const isPos = n(value) >= 0;
  const c = color === "auto" ? (isPos ? "#22c55e" : "#ef4444") : color;
  return (
    <div className="dash-kpi" style={{ background: "var(--mid)", border: "1px solid var(--border)", borderRadius: 18, padding: "18px 20px", position: "relative", overflow: "hidden", transition: "all .22s", cursor: "default" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = `${c}30`; e.currentTarget.style.boxShadow = `0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px ${c}20`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = ""; }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${c},transparent)` }} />
      <div style={{ position: "absolute", top: -20, right: -10, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${c}15, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted2)" }}>{label}</div>
        {icon && <div style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: `${c}12`, border: `1px solid ${c}20`, color: c, fontSize: 13 }}>{icon}</div>}
      </div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, letterSpacing: "1px", color: "#fff", lineHeight: 1 }}>
        <AnimNum value={value} fmt={fmt} compact={compact} />
      </div>
      {sub && <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted2)", lineHeight: 1.4 }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: n(trend) >= 0 ? "#22c55e" : "#ef4444" }}>{n(trend) >= 0 ? "▲" : "▼"} {Math.abs(n(trend)).toFixed(1)}%</span>
          <span style={{ fontSize: 10, color: "var(--muted2)" }}>vs mes ant.</span>
        </div>
      )}
    </div>
  );
}

// ── Spark Bar ─────────────────────────────────────────────────────────────────
function SparkBar({ pct: p, color }) {
  return (
    <div style={{ height: 3, borderRadius: 999, background: "var(--faint2)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, p))}%`, height: "100%", background: color, borderRadius: 999, transition: "width 1s ease" }} />
    </div>
  );
}

// ── Progress Ring ─────────────────────────────────────────────────────────────
function Ring({ value, max = 100, color, size = 72, label, sub }) {
  const p = Math.min(100, Math.max(0, (n(value) / n(max)) * 100));
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (p / 100) * circ;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease", filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "1px", color: "#fff" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 2, fontFamily: "'DM Mono',monospace", letterSpacing: "1px" }}>{sub}</div>
      </div>
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ data, height = 120, keys }) {
  const maxVal = Math.max(...data.flatMap(d => keys.map(k => n(d[k]))), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height, paddingBottom: 24, position: "relative" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%" }}>
          <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", gap: 2, justifyContent: "center" }}>
            {keys.map((k, ki) => (
              <div key={ki} style={{ width: `${100 / keys.length - 4}%`, borderRadius: "3px 3px 0 0", height: `${(n(d[k]) / maxVal) * 100}%`, background: k === "revenue" ? "var(--lemon)" : k === "cost" ? "#ef4444" : "#22c55e", minHeight: 2, transition: "height .8s ease" }} title={`${k}: ${usd(d[k])}`} />
            ))}
          </div>
          <div style={{ fontSize: 8, fontFamily: "'DM Mono',monospace", color: "var(--muted2)", textAlign: "center", position: "absolute", bottom: 0 }}>{String(d.month || d.label || "").slice(-5)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────────────
function Donut({ segments, size = 100 }) {
  const total = segments.reduce((a, s) => a + n(s.value), 0) || 1;
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={16} />
      {segments.map((s, i) => {
        const dash = (n(s.value) / total) * circ;
        const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={16} strokeDasharray={`${dash - 2} ${circ - dash + 2}`} strokeDashoffset={-offset} strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }} />;
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
function Alert({ color, title, text }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 12, background: `${color}08`, border: `1px solid ${color}20` }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, marginTop: 6, flexShrink: 0 }} />
      <div>
        <div style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--muted2)", lineHeight: 1.5 }}>{text}</div>
      </div>
    </div>
  );
}

// ── Section Label ─────────────────────────────────────────────────────────────
function SectionLbl({ label, title, right }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
      <div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "3px", textTransform: "uppercase", color: "var(--orange)", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 20, height: 1, background: "var(--orange)", display: "inline-block" }} />{label}
        </div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: "1px", color: "var(--text)" }}>{title}</div>
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Hr() { return <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />; }

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
function pctDiff(current, previous) {
  const c = Number(current || 0), p = Number(previous || 0);
  if (!p && !c) return "0%";
  if (!p) return "+100%";
  const diff = ((c - p) / Math.abs(p)) * 100;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
}

export default function Dashboard() {
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [monthly,      setMonthly]      = useState([]);
  const [accounts,     setAccounts]     = useState([]);
  const [fxRate,       setFxRate]       = useState(null);
  const [totalCapital, setTotalCapital] = useState(0);
  const [metrics,      setMetrics]      = useState(null);
  const [selMonth,     setSelMonth]     = useState(new Date().toISOString().slice(0, 7));
  const [tab,          setTab]          = useState("resumen");
  const [fxInput,      setFxInput]      = useState("");
  const [savingFx,     setSavingFx]     = useState(false);
  const [lastUpdate,   setLastUpdate]   = useState(null);
  const [kanban,       setKanban]       = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, monthlyRes, accountsRes, metricsRes, kanbanRes] = await Promise.all([
        fetch(`${API}/operator/dashboard`, { headers: hdrs() }),
        fetch(`${API}/cash/monthly`, { headers: hdrs() }),
        fetch(`${API}/accounts/summary`, { headers: hdrs() }),
        fetch(`${API}/dashboard/metrics?month=${selMonth}`, { headers: hdrs() }),
        fetch(`${API}/operator/shipments?limit=200`, { headers: hdrs() }),
      ]);
      if (dashRes.ok) { const d = await dashRes.json(); setData(d); }
      if (monthlyRes.ok) { const d = await monthlyRes.json(); setMonthly(d.rows || []); }
      if (metricsRes.ok) { const d = await metricsRes.json(); setMetrics(d); }
      if (accountsRes.ok) {
        const d = await accountsRes.json();
        setAccounts(d.accounts || []);
        const fx = d.fx_rate || d.accounts?.[0]?.fx_rate;
        if (fx) { setFxRate(fx); setFxInput(String(fx)); }
        setTotalCapital(d.total_capital_usd || d.total_usd || 0);
      }
      if (kanbanRes.ok) { const d = await kanbanRes.json(); setKanban(d.rows || []); }
      setLastUpdate(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selMonth]);

  useEffect(() => { load(); }, [load]);

  async function saveFx() {
    const val = Number(String(fxInput).replace(",", "."));
    if (!val || val <= 0) return;
    setSavingFx(true);
    try { await fetch(`${API}/settings/fx`, { method: "PUT", headers: { ...hdrs(), "Content-Type": "application/json" }, body: JSON.stringify({ rate: val }) }); await load(); }
    catch {} finally { setSavingFx(false); }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const s = data?.stats || {};
  const allTime = metrics?.all_time || {};
  const monthMetrics = metrics?.month_metrics || {};
  const previousMonthMetrics = metrics?.previous_month_metrics || {};
  const previousMonthCode = metrics?.previous_month || null;
  const m = monthly.find(x => x.month === selMonth) || (Object.keys(monthMetrics).length ? monthMetrics : null) || monthly[0] || {};
  const prevM = (previousMonthCode ? monthly.find(x => x.month === previousMonthCode) : null) || (Object.keys(previousMonthMetrics).length ? previousMonthMetrics : null) || monthly[1] || {};

  const exec       = n(allTime.executive_total_profit ?? metrics?.executive_total_profit);
  const courierP   = n(allTime.courier_profit ?? metrics?.courier_profit);
  const externalP  = n(allTime.external_profit ?? metrics?.external_profit);
  const incomeP    = n(allTime.additional_income_usd ?? metrics?.additional_income_usd);
  const totalKg    = n(allTime.total_kg ?? metrics?.total_kg);

  const monthCourierKg  = n(monthMetrics.courier_kg ?? metrics?.courier_kg ?? m.courier_kg);
  const monthExternalKg = n(monthMetrics.external_kg ?? metrics?.external_kg ?? m.external_kg);
  const totalIncome     = n(monthMetrics.total_income ?? m.total_income);
  const totalOut        = monthMetrics.total_out != null ? n(monthMetrics.total_out) : (m.total_out != null ? n(m.total_out) : n(m.cost_usd) + n(m.empresa_usd) + n(m.personal_usd));
  const netMonth        = n(monthMetrics.net_profit ?? monthMetrics.total_profit ?? m.net);
  const marginMonth     = n(monthMetrics.margin ?? m.margin);
  const monthActiveClients = n(monthMetrics.active_clients ?? metrics?.active_clients);
  const monthNetForCapital = n(monthMetrics.net_profit ?? metrics?.net_profit);
  const prevNet    = n(previousMonthMetrics.net_profit ?? previousMonthMetrics.total_profit ?? prevM.net);
  const trend      = prevNet !== 0 ? ((netMonth - prevNet) / Math.abs(prevNet)) * 100 : (netMonth !== 0 ? 100 : 0);

  const today       = new Date();
  const day         = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const projected   = day > 0 ? (netMonth / day) * daysInMonth : netMonth;
  const usdPerKg    = totalKg > 0 ? exec / totalKg : 0;
  const capitalRatio= n(totalCapital) > 0 ? (monthNetForCapital / n(totalCapital)) * 100 : 0;

  let healthScore = 50;
  if (exec > 0) healthScore += 20;
  if (netMonth > 0) healthScore += 15;
  if (n(totalCapital) > 0) healthScore += 10;
  if (externalP > 0) healthScore += 5;
  healthScore = Math.min(100, Math.max(0, healthScore));
  const healthColor = healthScore >= 75 ? "#22c55e" : healthScore >= 50 ? "var(--lemon)" : "#ef4444";

  const execForShare = Math.max(exec, 0.01);
  const shareC = (courierP / execForShare) * 100;
  const shareE = (externalP / execForShare) * 100;
  const shareI = (incomeP / execForShare) * 100;
  const chartData = [...monthly].reverse().slice(-6);

  const STATUSES = ["Recibido en depósito", "En preparación", "Despachado", "En tránsito", "Listo para entrega", "Entregado"];
  const kanbanCounts = STATUSES.map(st => ({ status: st, count: kanban.filter(r => r.status === st).length }));

  const alerts = [];
  if (exec >= 4000) alerts.push({ color: "#22c55e", title: "🚀 Negocio sólido", text: `Neto ejecutivo acumulado en ${usd(exec)}. Base real para escalar.` });
  else if (exec > 0) alerts.push({ color: "var(--lemon)", title: "⚡ Negocio positivo", text: `Neto ejecutivo en ${usd(exec)}. Seguí empujando revenue.` });
  else alerts.push({ color: "#ef4444", title: "⚠ Revisar rentabilidad", text: `Acumulado en ${usd(exec)}. Revisá pricing, lanes y costos.` });
  if (externalP < 500) alerts.push({ color: "#60a5fa", title: "📦 Externas con margen", text: `Externas acumulan ${usd(externalP)}. Espacio para crecer comisiones.` });
  if (incomeP <= 0) alerts.push({ color: "#a78bfa", title: "💡 Adicionales dormidos", text: "Sin tracción en ingresos adicionales. Activá esa línea paralela." });
  if (usdPerKg < 10) alerts.push({ color: "#f97316", title: "⚖ Rentabilidad por kg baja", text: `Histórico en ${usd(usdPerKg)}/kg. Revisá lanes y costos.` });

  const monthLabel = (mo) => { try { return new Date(mo + "-15").toLocaleString("es-AR", { month: "short", year: "2-digit" }).toUpperCase(); } catch { return mo; } };

  const prevIncome = n(previousMonthMetrics.total_income ?? prevM.total_income);
  const prevOut = previousMonthMetrics.total_out != null ? n(previousMonthMetrics.total_out) : (prevM.total_out != null ? n(prevM.total_out) : n(prevM.cost_usd) + n(prevM.empresa_usd) + n(prevM.personal_usd));
  const prevKg = n(previousMonthMetrics.total_kg ?? prevM.total_kg ?? (n(prevM.courier_kg) + n(prevM.external_kg)));
  const monthDeltaPct = prevNet !== 0 ? ((netMonth - prevNet) / Math.abs(prevNet)) * 100 : 0;

  const laneRows = Array.isArray(data?.by_lane) ? data.by_lane : [];
  const laneInsights = laneRows.map(r => {
    const revenue = Number(r?.revenue || 0), cost = Number(r?.cost || 0), profit = Number(r?.profit || 0);
    return { origin: r?.origin || "N/D", service: r?.service || "N/D", revenue, cost, profit, margin: revenue > 0 ? (profit / revenue) * 100 : 0 };
  }).filter(r => r.revenue > 0 || r.cost > 0 || r.profit > 0).sort((a, b) => b.margin - a.margin);
  const marginAvg = laneInsights.length ? laneInsights.reduce((acc, l) => acc + Number(l.margin || 0), 0) / laneInsights.length : 0;
  const bestLane = laneInsights.length ? laneInsights[0] : null;
  const worstLane = laneInsights.length ? laneInsights[laneInsights.length - 1] : null;
  const aiHeadline = netMonth <= 0 ? "El negocio está en zona de riesgo." : monthDeltaPct < 0 ? "Positivo, pero perdió ritmo." : "Creciendo con base saludable.";
  const aiOpportunity = bestLane ? `Mejor lane: ${bestLane.origin} · ${bestLane.service} — ${pct(bestLane.margin)} margen, ${usd(bestLane.profit)} profit.` : "Sin lane dominante todavía.";
  const aiRisk = worstLane ? `Lane a revisar: ${worstLane.origin} · ${worstLane.service} — ${pct(worstLane.margin)} margen.` : "Sin lane crítico detectado.";
  const aiAction = worstLane && worstLane.margin < 20 ? `Revisá pricing en ${worstLane.origin} · ${worstLane.service}.` : bestLane ? `Empujá volumen en ${bestLane.origin} · ${bestLane.service}.` : "Seguí acumulando datos.";
  const statusLabel3 = netMonth <= 0 ? "En riesgo" : monthDeltaPct < 0 ? "Rentable con atención" : "Escalando";
  const statusColor3 = netMonth <= 0 ? "#ef4444" : monthDeltaPct < 0 ? "var(--lemon)" : "#22c55e";

  return (
    <div className="screen" data-staff-page style={{ maxWidth: 1500, margin: "0 auto", padding: "0 8px 48px" }}>
      <style>{`
        @keyframes dash-fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dash-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes dash-rise { from{transform:translateY(110%)} to{transform:translateY(0)} }
        @keyframes dash-fade-soft { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .dash-fade { animation: dash-fadeUp .4s ease both; }
        .dash-kpi { transition: all .22s !important; }
        .dash-row:hover td { background: rgba(245,224,58,0.02) !important; }
        .dash-row td { border-bottom: 1px solid var(--border); padding: 11px 12px; vertical-align: middle; }
        .dash-th { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; text-transform:uppercase; color:var(--muted2); padding:11px 12px; border-bottom:1px solid var(--border); text-align:left; }
        .dash-table { width:100%; border-collapse:collapse; }

        /* Editorial hero — landing language */
        .dh-hero { position: relative; padding: 28px 32px 26px; margin: 8px 0 28px; border: 1px solid var(--border2); background: linear-gradient(135deg, var(--mid) 0%, var(--deep) 100%); overflow: hidden; }
        .dh-hero::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--lemon),var(--orange),transparent); }
        .dh-hero::after { content:''; position:absolute; inset:0; background-image:linear-gradient(rgba(245,224,58,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(245,224,58,.018) 1px,transparent 1px); background-size:48px 48px; pointer-events:none; opacity:.7 }
        .dh-watermark { position:absolute; right:-30px; bottom:-50px; font-family:'Bebas Neue',sans-serif; font-size:clamp(140px,18vw,260px); line-height:.78; letter-spacing:-6px; color:transparent; -webkit-text-stroke:1px rgba(245,224,58,.04); pointer-events:none; user-select:none; }
        .dh-row { position: relative; z-index: 2; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
        .dh-left { flex: 1; min-width: 280px; }
        .dh-eyebrow { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:3.5px; text-transform:uppercase; color:var(--orange); display:flex; align-items:center; gap:12px; margin-bottom:14px; }
        .dh-eyebrow::before { content:''; width:28px; height:1px; background:var(--orange); }
        .dh-live { display:inline-flex; align-items:center; gap:7px; font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; color:#22c55e; padding:3px 10px; background:rgba(34,197,94,.06); border:1px solid rgba(34,197,94,.2); margin-left:6px; }
        .dh-live::before { content:''; width:6px; height:6px; border-radius:50%; background:#22c55e; box-shadow:0 0 10px #22c55e; animation:dash-pulse 2s ease infinite; }
        .dh-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(48px,6.6vw,92px); line-height:.84; letter-spacing:-1.5px; color:var(--text); margin:0; overflow:hidden; }
        .dh-title em { font-style:normal; color:var(--lemon); }
        .dh-title-inner { display:inline-block; animation: dash-rise .9s cubic-bezier(.2,.8,.2,1) both; }
        .dh-meta { font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; color:var(--muted2); margin-top:14px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; animation: dash-fade-soft .8s ease .25s both; }
        .dh-meta-sep { width:1px; height:12px; background:var(--border2); display:inline-block; }
        .dh-actions { display:flex; gap:10px; flex-wrap:wrap; align-items:center; animation: dash-fade-soft .8s ease .35s both; }
        .dh-month-input { background:rgba(255,255,255,.025); border:1px solid var(--border2); color:var(--text); font-family:'DM Mono',monospace; font-size:12px; padding:10px 14px; height:42px; outline:none; transition:border .25s; }
        .dh-month-input:focus { border-color:rgba(245,224,58,.5); }
        .dh-refresh { font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:800; letter-spacing:2px; text-transform:uppercase; background:var(--lemon); color:#000; border:none; padding:0 22px; height:42px; cursor:pointer; transition:all .25s; display:inline-flex; align-items:center; gap:8px; }
        .dh-refresh:hover { background:#fff7a0; transform:translateY(-1px); box-shadow:0 12px 32px rgba(245,224,58,.18); }
        .dh-refresh:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }
      `}</style>

      {/* ── EDITORIAL HERO ── */}
      <div className="dh-hero">
        <div className="dh-watermark">FOUNDER</div>
        <div className="dh-row">
          <div className="dh-left">
            <div className="dh-eyebrow">Command Center<span className="dh-live">EN VIVO</span></div>
            <h1 className="dh-title"><span className="dh-title-inner">FOUNDER <em>OPS</em></span></h1>
            <div className="dh-meta">
              <span>{today.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}</span>
              <span className="dh-meta-sep" />
              <span>{lastUpdate ? `Actualizado ${lastUpdate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : "Cargando…"}</span>
              <span className="dh-meta-sep" />
              <span>{selMonth.toUpperCase()}</span>
            </div>
          </div>
          <div className="dh-actions">
            <input type="month" value={selMonth} onChange={e => setSelMonth(e.target.value)} className="dh-month-input" />
            <button className="dh-refresh" onClick={load} disabled={loading}>{loading ? <span style={{ animation: "dash-pulse 1s infinite" }}>↻</span> : <>↻ Actualizar</>}</button>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28, position: "sticky", top: 12, zIndex: 100 }}>
        <FTabs active={tab} onChange={setTab} tabs={[
          { key: "resumen",     icon: "📊", label: "Resumen" },
          { key: "financiero",  icon: "💰", label: "Financiero" },
          { key: "operaciones", icon: "📦", label: "Operaciones" },
          { key: "kanban",      icon: "🗂", label: "Pipeline" },
        ]} />
      </div>

      {/* ══ TAB: RESUMEN ══ */}
      {tab === "resumen" && (
        <div className="dash-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Hero block */}
          <FounderDashboardHero netMonth={netMonth} prevNet={prevNet} totalCapital={totalCapital} monthKg={monthCourierKg + monthExternalKg} trend={monthDeltaPct} statusLabel={statusLabel3} statusColor={statusColor3} statusNote={netMonth <= 0 ? "La operación necesita corrección inmediata." : monthDeltaPct < 0 ? "El mes sigue positivo, pero perdió ritmo." : "El mes viene positivo y con buen ritmo."} />

          {/* Decision Engine */}
          <Card style={{ padding: "20px 24px" }} accent="var(--orange)">
            <div className="sectionLabel" style={{ marginBottom: 14 }}>Founder Decision Engine</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {netMonth <= 0 && <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", fontFamily: "'Barlow',sans-serif", fontSize: 13, fontWeight: 600 }}>🔴 El negocio no está generando ganancia este mes.</div>}
              {marginAvg < 25 && <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", fontFamily: "'Barlow',sans-serif", fontSize: 13, fontWeight: 600 }}>🟡 Margen bajo. Subí pricing u optimizá costos.</div>}
              <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", fontFamily: "'Barlow',sans-serif", fontSize: 13, fontWeight: 600 }}>🟢 Acción: enfocar ventas en lanes con mayor margen.</div>
            </div>
          </Card>

          {/* LIMONCIN AI */}
          <div>
            <SectionLbl label="Founder AI" title="LIMONCIN · Decisiones sugeridas" />
            <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 14 }}>
              <Card style={{ padding: "20px 22px" }} accent="#22c55e">
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 12, textTransform: "uppercase" }}>Diagnóstico automático</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "1px", color: "var(--text)", lineHeight: 1.3, marginBottom: 16 }}>{aiHeadline}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { bg: "rgba(34,197,94,0.07)", bd: "rgba(34,197,94,0.2)", c: "#d1fae5", t: `🟢 ${aiOpportunity}` },
                    { bg: "rgba(245,158,11,0.07)", bd: "rgba(245,158,11,0.2)", c: "#fde68a", t: `🟡 ${aiRisk}` },
                    { bg: "rgba(59,130,246,0.07)", bd: "rgba(59,130,246,0.2)", c: "#dbeafe", t: `🧠 ${aiAction}` },
                  ].map((x, i) => <div key={i} style={{ padding: "12px 14px", borderRadius: 12, background: x.bg, border: `1px solid ${x.bd}`, color: x.c, fontSize: 13, fontFamily: "'Barlow',sans-serif", lineHeight: 1.5 }}>{x.t}</div>)}
                </div>
              </Card>
              <Card style={{ padding: "20px 22px" }} accent="#a78bfa">
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 12, textTransform: "uppercase" }}>Prioridades del día</div>
                {[
                  { lbl: "FOCO COMERCIAL", val: bestLane ? `${bestLane.origin} · ${bestLane.service}` : "Sin lane dominante" },
                  { lbl: "FOCO DE MARGEN", val: worstLane ? `${worstLane.origin} · ${worstLane.service}` : "Sin lane crítico" },
                  { lbl: "ESTADO DEL MES", val: `${netMonth > 0 ? "Mes rentable" : "Mes a recuperar"} · ${pct(monthDeltaPct)}` },
                ].map((x, i) => (
                  <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: "var(--faint2)", border: "1px solid var(--border)", marginBottom: 10 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 6, textTransform: "uppercase" }}>{x.lbl}</div>
                    <div style={{ fontFamily: "'Barlow',sans-serif", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{x.val}</div>
                  </div>
                ))}
              </Card>
            </div>
          </div>

          {/* Rentabilidad */}
          <div>
            <SectionLbl label="Founder Intelligence" title="Rentabilidad real del negocio" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.8fr", gap: 12, marginBottom: 14 }}>
              {[
                { lbl: `Mes actual · ${selMonth}`, val: netMonth, c: netMonth >= 0 ? "#22c55e" : "#ef4444", sub: kg(monthCourierKg + monthExternalKg), accent: "#22c55e" },
                { lbl: "Mes pasado", val: prevNet, c: prevNet >= 0 ? "#22c55e" : "#ef4444", sub: kg(prevKg), accent: "#60a5fa" },
                { lbl: "Trend", val: monthDeltaPct, c: monthDeltaPct >= 0 ? "#22c55e" : "#ef4444", fmt: "pct", accent: monthDeltaPct >= 0 ? "#22c55e" : "#ef4444" },
              ].map((x, i) => (
                <Card key={i} style={{ padding: "20px 22px" }} accent={x.accent}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 10, textTransform: "uppercase" }}>{x.lbl}</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, letterSpacing: "1px", color: x.c }}>{x.fmt === "pct" ? pct(x.val) : usd(x.val)}</div>
                  {x.sub && <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 6, fontFamily: "'DM Mono',monospace" }}>{x.sub}</div>}
                </Card>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card style={{ padding: "20px 22px" }} accent="var(--orange)">
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 14, textTransform: "uppercase" }}>Costos por modalidad (USD/KG)</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {[["USA Normal", data?.operator_costs?.usa_normal], ["USA Express", data?.operator_costs?.usa_express], ["USA Tech Premium", data?.operator_costs?.usa_tech_premium], ["China Normal", data?.operator_costs?.china_normal], ["China Express", data?.operator_costs?.china_express], ["Europa", data?.operator_costs?.europa_normal]].map(([label, value]) => (
                    <div key={label} style={{ padding: "10px 12px", borderRadius: 10, background: "var(--faint2)", border: "1px solid var(--border)" }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8, letterSpacing: "1px", color: "var(--muted2)", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "1px", color: "var(--orange)" }}>{usd(value || 0)}</div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card style={{ padding: "20px 22px" }} accent="#22c55e">
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 14, textTransform: "uppercase" }}>Margen real por lane</div>
                {(data?.by_lane || []).slice(0, 6).map((r, i) => {
                  const revenue = Number(r.revenue || 0), profit = Number(r.profit || 0);
                  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                  const mc = margin >= 20 ? "#22c55e" : margin >= 10 ? "var(--lemon)" : "#ef4444";
                  return (
                    <div key={i} style={{ padding: "10px 14px", borderRadius: 10, background: "var(--faint2)", border: "1px solid var(--border)", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontFamily: "'Barlow',sans-serif", fontWeight: 700, fontSize: 13 }}>{r.origin} · {r.service}</span>
                        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: mc }}>{pct(margin)}</span>
                      </div>
                      <SparkBar pct={margin} color={mc} />
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)", marginTop: 4 }}>Rev {usd(revenue)} · Profit {usd(profit)}</div>
                    </div>
                  );
                })}
              </Card>
            </div>
          </div>

          {/* Estructura + Health */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Card style={{ padding: "20px 22px" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 16, textTransform: "uppercase" }}>Estructura de ingresos</div>
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
                <Donut size={90} segments={[{ value: Math.max(courierP, 0), color: "var(--lemon)" }, { value: Math.max(externalP, 0), color: "#60a5fa" }, { value: Math.max(incomeP, 0), color: "#a78bfa" }]} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[{ label: "Courier", value: courierP, color: "var(--lemon)", pct: shareC }, { label: "Externas", value: externalP, color: "#60a5fa", pct: shareE }, { label: "Adicionales", value: incomeP, color: "#a78bfa", pct: shareI }].map(sx => (
                    <div key={sx.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, fontWeight: 700, color: sx.color }}>{sx.label}</span>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--muted2)" }}>{usd(sx.value, true)} · {sx.pct.toFixed(1)}%</span>
                      </div>
                      <SparkBar pct={sx.pct} color={sx.color} />
                    </div>
                  ))}
                </div>
              </div>
              <Hr />
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 12, textTransform: "uppercase" }}>Snapshot mensual</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[{ label: "Entró", val: totalIncome, c: "#4ade80" }, { label: "Salió", val: totalOut, c: "#f87171" }, { label: "Neto", val: netMonth, c: netMonth >= 0 ? "#22c55e" : "#ef4444" }].map(x => (
                  <div key={x.label} style={{ padding: "12px 14px", borderRadius: 12, background: `${x.c}08`, border: `1px solid ${x.c}20` }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", color: "var(--muted2)", marginBottom: 6 }}>{x.label}</div>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: "1px", color: x.c }}>{usd(x.val)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 10, textTransform: "uppercase" }}>Health del negocio</div>
                  <Ring value={healthScore} max={100} color={healthColor} size={72} label={`${healthScore}/100`} sub="Score ejecutivo" />
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", color: "var(--muted2)", marginBottom: 4 }}>PROYECCIÓN CIERRE</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: "1px", color: "#60a5fa" }}>{usd(projected, true)}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)", marginTop: 4 }}>Día {day}/{daysInMonth}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alerts.slice(0, 3).map((a, i) => <Alert key={i} {...a} />)}
              </div>
            </Card>
          </div>

          {/* Fondos */}
          {accounts.length > 0 && (
            <div>
              <SectionLbl label="Capital" title="Estado de fondos" right={
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input value={fxInput} onChange={e => setFxInput(e.target.value)} placeholder="USD/ARS" className="input" style={{ width: 100, height: 34 }} />
                  <button onClick={saveFx} disabled={savingFx} className="btn btnPrimary" style={{ height: 34, padding: "0 14px", fontSize: 11 }}>{savingFx ? "…" : "Guardar TC"}</button>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: "#4ade80" }}>Total: {usd(totalCapital)}</span>
                </div>
              } />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                {accounts.map(acc => (
                  <div key={acc.id} className="dash-kpi" style={{ padding: "16px 18px", borderRadius: 14, background: "var(--mid)", border: "1px solid var(--border)", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,var(--lemon),transparent)" }} />
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 8 }}>{acc.name}</div>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: "1px", color: "var(--text)" }}>{acc.currency === "ARS" ? ars(acc.balance) : usd(acc.balance)}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--orange)", marginTop: 4 }}>{acc.currency}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPIs operativos */}
          <div>
            <SectionLbl label="Operaciones" title="KPIs operativos del período" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {[
                { label: "Total envíos", value: n(s?.total), fmt: "raw", icon: "📦", color: "var(--lemon)", sub: "Histórico" },
                { label: "Entregados", value: n(s?.delivered), fmt: "raw", icon: "✅", color: "#22c55e", sub: "Completados" },
                { label: "En tránsito", value: n(s?.transit), fmt: "raw", icon: "✈️", color: "#60a5fa", sub: "Viajando" },
                { label: "Listo entrega", value: n(s?.ready), fmt: "raw", icon: "📬", color: "#f97316", sub: "Última milla" },
                { label: "Clientes activos", value: monthActiveClients, fmt: "raw", icon: "👥", color: "#a78bfa", sub: "Este mes" },
                { label: "Peso total", value: n(s?.total_weight), fmt: "kg", icon: "⚖", color: "#34d399", sub: "Acumulado" },
              ].map(k => <KPI key={k.label} {...k} />)}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: FINANCIERO ══ */}
      {tab === "financiero" && (
        <div className="dash-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionLbl label="P&L Mensual" title="Financial Performance" right={
            <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="input" style={{ width: 200, height: 38 }}>
              {monthly.map(mx => <option key={mx.month} value={mx.month}>{new Date(mx.month + "-15").toLocaleString("es-AR", { month: "long", year: "numeric" })}</option>)}
            </select>
          } />

          {/* 3 bloques P&L */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Card style={{ padding: "22px 24px" }} accent="#22c55e">
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "#4ade80", marginBottom: 10, textTransform: "uppercase" }}>💰 Entró</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 42, letterSpacing: "1px", color: "#4ade80", lineHeight: 1 }}>{usd(totalIncome)}</div>
              <Hr />
              {[{ label: "Cobros courier", val: n(m.collected), c: "#4ade80" }, { label: "Comisiones externas", val: n(m.commission_usd), c: "var(--lemon)" }, { label: "Ingresos adicionales", val: n(m.income_usd), c: "#60a5fa" }].map(d => (
                <div key={d.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, background: "var(--faint2)", marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, color: "var(--ghost)" }}>{d.label}</span>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: "1px", color: d.c }}>{usd(d.val)}</span>
                </div>
              ))}
            </Card>

            <Card style={{ padding: "22px 24px" }} accent="#ef4444">
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "#f87171", marginBottom: 10, textTransform: "uppercase" }}>📤 Salió</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 42, letterSpacing: "1px", color: "#f87171", lineHeight: 1 }}>{usd(totalOut)}</div>
              <Hr />
              {[{ label: "Costo envíos", val: n(m.cost_usd), c: "#f87171" }, { label: "Gastos empresa USD", val: n(m.empresa_usd), c: "#fb923c" }, { label: "Gastos empresa ARS", val: n(m.empresa_ars), c: "#fb923c", isArs: true }, { label: "Gastos personales USD", val: n(m.personal_usd), c: "#c084fc" }, { label: "Gastos personales ARS", val: n(m.personal_ars), c: "#c084fc", isArs: true }].filter(d => d.val > 0).map(d => (
                <div key={d.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, background: "var(--faint2)", marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, color: "var(--ghost)" }}>{d.label}</span>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: "1px", color: d.c }}>{d.isArs ? ars(d.val) : usd(d.val)}</span>
                </div>
              ))}
            </Card>

            <Card style={{ padding: "22px 24px" }} accent={netMonth >= 0 ? "#22c55e" : "#ef4444"}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: netMonth >= 0 ? "#4ade80" : "#f87171", marginBottom: 10, textTransform: "uppercase" }}>{netMonth >= 0 ? "✅" : "⚠"} Resultado</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 46, letterSpacing: "1px", color: netMonth >= 0 ? "#22c55e" : "#ef4444", lineHeight: 1 }}>{usd(netMonth)}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: netMonth >= 0 ? "#4ade80" : "#f87171", marginTop: 6 }}>{pct(marginMonth)} margen</div>
              <Hr />
              {[{ label: "Courier profit", val: courierP, c: "var(--lemon)" }, { label: "Externas profit", val: externalP, c: "#60a5fa" }].map(d => (
                <div key={d.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, background: "var(--faint2)", marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, color: "var(--ghost)" }}>{d.label}</span>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: "1px", color: d.c }}>{usd(d.val)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, background: "rgba(245,224,58,0.06)", border: "1px solid rgba(245,224,58,0.15)" }}>
                <span style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, fontWeight: 800, color: "var(--text)" }}>Neto ejecutivo</span>
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: exec >= 0 ? "#22c55e" : "#ef4444" }}>{usd(exec)}</span>
              </div>
            </Card>
          </div>

          {/* Tabla comparativa */}
          <Card style={{ padding: "20px 22px" }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 14, textTransform: "uppercase" }}>Comparativa mes a mes</div>
            <div style={{ overflowX: "auto" }}>
              <table className="dash-table">
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.3)" }}>
                    {["Mes", "Entró", "Externas", "Salió", "Resultado", "Margen"].map((h, i) => <th key={i} className="dash-th">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {monthly.map(mx => {
                    const mE = n(mx.total_income), mS = mx.total_out != null ? n(mx.total_out) : n(mx.cost_usd) + n(mx.empresa_usd) + n(mx.personal_usd), mR = n(mx.net);
                    const sel = mx.month === selMonth;
                    return (
                      <tr key={mx.month} className="dash-row" onClick={() => setSelMonth(mx.month)} style={{ cursor: "pointer", background: sel ? "rgba(245,224,58,0.04)" : undefined }}>
                        <td style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: sel ? "var(--lemon)" : "var(--text)" }}>{monthLabel(mx.month)}</td>
                        <td style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: "1px", color: "#4ade80" }}>{usd(mE)}</td>
                        <td style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: "1px", color: "var(--lemon)" }}>{usd(n(mx.commission_usd))}</td>
                        <td style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: "1px", color: "#f87171" }}>{usd(mS)}</td>
                        <td><span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: mR >= 0 ? "#22c55e" : "#ef4444" }}>{usd(mR)}</span></td>
                        <td><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 500, padding: "3px 8px", borderRadius: 6, background: n(mx.margin) >= 30 ? "rgba(34,197,94,0.12)" : n(mx.margin) >= 0 ? "rgba(245,224,58,0.1)" : "rgba(239,68,68,0.1)", color: n(mx.margin) >= 30 ? "#86efac" : n(mx.margin) >= 0 ? "var(--lemon)" : "#fca5a5" }}>{mx.margin}%</span></td>
                      </tr>
                    );
                  })}
                  {!monthly.length && <tr><td colSpan={6} style={{ textAlign: "center", padding: 28, color: "var(--muted2)", fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "2px" }}>SIN DATOS AÚN</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Charts */}
          {chartData.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card style={{ padding: "20px 22px" }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 14, textTransform: "uppercase" }}>Revenue / Costo / Ganancia — 6 meses</div>
                <BarChart data={chartData.map(d => ({ ...d, label: monthLabel(d.month), revenue: n(d.collected) + n(d.commission_usd) + n(d.income_usd), cost: n(d.cost_usd) + n(d.empresa_usd) + n(d.personal_usd), profit: n(d.net) }))} height={140} keys={["revenue", "cost", "profit"]} />
                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                  {[["var(--lemon)", "Entró"], ["#ef4444", "Salió"], ["#22c55e", "Resultado"]].map(([c, l]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)", letterSpacing: "1px" }}>{l}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card style={{ padding: "20px 22px" }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 14, textTransform: "uppercase" }}>Business Intelligence</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[{ label: "Proyección cierre", val: usd(projected, true), c: "#60a5fa" }, { label: "USD por kg", val: usd(usdPerKg), c: "var(--orange)" }, { label: "Trend vs mes ant.", val: pct(trend), c: trend >= 0 ? "#22c55e" : "#ef4444" }, { label: "Rendimiento s/capital", val: pct(capitalRatio), c: "#34d399" }].map(x => (
                    <div key={x.label} style={{ padding: "12px 14px", borderRadius: 12, background: "var(--faint2)", border: "1px solid var(--border)" }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", color: "var(--muted2)", marginBottom: 6, textTransform: "uppercase" }}>{x.label}</div>
                      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: "1px", color: x.c }}>{x.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {alerts.map((a, i) => <Alert key={i} {...a} />)}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: OPERACIONES ══ */}
      {tab === "operaciones" && (
        <div className="dash-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionLbl label="Courier" title="Análisis por origen y lane" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Card style={{ padding: "20px 22px" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 14, textTransform: "uppercase" }}>Por origen</div>
              {(data?.by_origin || []).map(r => {
                const maxR = Math.max(...(data?.by_origin || []).map(x => n(x.revenue)), 1);
                return (
                  <div key={r.origin} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 14 }}>{r.origin || "–"}</span>
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: "1px", color: "var(--lemon)" }}>{usd(r.revenue)}</span>
                    </div>
                    <SparkBar pct={(n(r.revenue) / maxR) * 100} color="var(--lemon)" />
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", color: "var(--muted2)" }}>{r.count} envíos</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", color: "var(--muted2)" }}>{kg(r.weight)}</span>
                    </div>
                  </div>
                );
              })}
            </Card>
            <Card style={{ padding: "20px 22px" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 14, textTransform: "uppercase" }}>Por lane</div>
              <div style={{ overflowX: "auto" }}>
                <table className="dash-table">
                  <thead><tr style={{ background: "rgba(0,0,0,0.3)" }}>{["Lane", "Revenue", "Costo", "Profit", "Margen"].map((h, i) => <th key={i} className="dash-th">{h}</th>)}</tr></thead>
                  <tbody>
                    {(data?.by_lane || []).map(r => {
                      const p = n(r.profit), m2 = n(r.revenue) > 0 ? (p / n(r.revenue)) * 100 : 0;
                      return (
                        <tr key={`${r.origin}-${r.service}`} className="dash-row">
                          <td style={{ fontFamily: "'Barlow',sans-serif", fontWeight: 700 }}>{r.origin} {r.service}</td>
                          <td style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: "1px", color: "var(--lemon)" }}>{usd(r.revenue)}</td>
                          <td style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: "1px", color: "#f87171" }}>{usd(r.cost)}</td>
                          <td style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: "1px", color: p >= 0 ? "#22c55e" : "#ef4444" }}>{usd(p)}</td>
                          <td><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, padding: "2px 7px", borderRadius: 5, background: m2 >= 30 ? "rgba(34,197,94,0.12)" : "rgba(245,224,58,0.1)", color: m2 >= 30 ? "#86efac" : "var(--lemon)" }}>{m2.toFixed(1)}%</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card style={{ padding: "20px 22px" }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 14, textTransform: "uppercase" }}>Top clientes por revenue</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {(data?.top_clients || []).map((r, i) => (
                <div key={r.client_number} style={{ padding: "14px 16px", borderRadius: 14, background: i === 0 ? "rgba(245,224,58,0.05)" : "var(--faint2)", border: `1px solid ${i === 0 ? "rgba(245,224,58,0.2)" : "var(--border)"}`, position: "relative", overflow: "hidden" }}>
                  {i === 0 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,var(--lemon),transparent)" }} />}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 500, color: i === 0 ? "var(--lemon)" : "var(--muted2)" }}>#{r.client_number}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)" }}>{r.shipments} envíos</span>
                  </div>
                  <div style={{ fontFamily: "'Barlow',sans-serif", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{r.name}</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "1px", color: "var(--lemon)" }}>{usd(r.revenue)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ padding: "20px 22px" }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 14, textTransform: "uppercase" }}>Envíos recientes</div>
            <div style={{ overflowX: "auto" }}>
              <table className="dash-table">
                <thead><tr style={{ background: "rgba(0,0,0,0.3)" }}>{["Código", "Cliente", "Descripción", "Estado", "Origen", "USD", "Fecha"].map((h, i) => <th key={i} className="dash-th">{h}</th>)}</tr></thead>
                <tbody>
                  {(data?.recent || []).map(r => (
                    <tr key={r.id} className="dash-row">
                      <td><span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500, fontSize: 12, color: "var(--lemon)" }}>{r.code}</span></td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 10 }}>#{r.client_number} <span style={{ color: "var(--muted2)" }}>{r.client_name}</span></td>
                      <td style={{ fontSize: 12 }}>{r.description}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td style={{ fontSize: 12 }}>{r.origin}</td>
                      <td style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: "var(--lemon)" }}>{r.estimated_usd != null ? usd(r.estimated_usd) : "–"}</td>
                      <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--muted2)" }}>{r.date_in ? new Date(r.date_in).toLocaleDateString("es-AR") : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══ TAB: KANBAN ══ */}
      {tab === "kanban" && (
        <div className="dash-fade">
          <SectionLbl label="Pipeline" title="Estado de envíos en tiempo real" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
            {kanbanCounts.map(({ status, count }) => {
              const cfg = STATUS_CFG[status] || { c: "var(--text)", glow: "transparent", icon: "📦" };
              return (
                <div key={status} className="dash-kpi" style={{ padding: "18px 20px", borderRadius: 16, background: `${cfg.c}07`, border: `1px solid ${cfg.c}20`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${cfg.c},transparent)` }} />
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 10 }}>{cfg.icon} {status}</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, letterSpacing: "1px", color: cfg.c, lineHeight: 1, textShadow: `0 0 20px ${cfg.glow}` }}>{count}</div>
                  <SparkBar pct={n(s?.total) > 0 ? (count / n(s?.total)) * 100 : 0} color={cfg.c} />
                </div>
              );
            })}
          </div>
          <Card style={{ padding: "20px 22px" }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: "var(--muted2)", marginBottom: 14, textTransform: "uppercase" }}>Envíos activos</div>
            <div style={{ overflowX: "auto" }}>
              <table className="dash-table">
                <thead><tr style={{ background: "rgba(0,0,0,0.3)" }}>{["Código", "Cliente", "Descripción", "Estado", "Origen", "Servicio", "USD"].map((h, i) => <th key={i} className="dash-th">{h}</th>)}</tr></thead>
                <tbody>
                  {kanban.filter(r => r.status !== "Entregado").slice(0, 30).map(r => {
                    const cfg = STATUS_CFG[r.status] || { c: "var(--text)" };
                    return (
                      <tr key={r.id} className="dash-row">
                        <td><span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 500, fontSize: 12, color: "var(--lemon)" }}>{r.code}</span></td>
                        <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 10 }}>#{r.client_number}</td>
                        <td style={{ fontSize: 12 }}>{r.description}</td>
                        <td><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "1px", padding: "3px 8px", borderRadius: 6, background: `${cfg.c}12`, border: `1px solid ${cfg.c}25`, color: cfg.c }}>{r.status}</span></td>
                        <td style={{ fontSize: 12 }}>{r.origin}</td>
                        <td style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--muted2)" }}>{r.service}</td>
                        <td style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "1px", color: "var(--lemon)" }}>{r.estimated_usd != null ? usd(r.estimated_usd) : "–"}</td>
                      </tr>
                    );
                  })}
                  {kanban.filter(r => r.status !== "Entregado").length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "var(--muted2)", fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "2px" }}>SIN ENVÍOS ACTIVOS</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}