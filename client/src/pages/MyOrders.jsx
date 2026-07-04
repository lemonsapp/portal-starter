// client/src/pages/MyOrders.jsx
//
// Panel de seguimiento de compras del usuario. Lista los pedidos hechos con el
// email de la cuenta (el checkout es guest → se matchea por email en el server:
// GET /api/shop/my-orders). Muestra estado, timeline y tracking.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useBranding } from "../lib/branding.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

// step = índice en la línea de tiempo (0..3). -1 = fuera de flujo (cancelado/fallido).
const STATUS = {
  pending_payment: { label: "Pendiente de pago", color: "#fbbf24", step: 0 },
  paid:            { label: "Pagado",            color: "#34d399", step: 1 },
  dispatched:      { label: "En camino",         color: "#60a5fa", step: 2 },
  completed:       { label: "Entregado",         color: "#22c55e", step: 3 },
  cancelled:       { label: "Cancelado",         color: "#94a3b8", step: -1 },
  failed:          { label: "Pago fallido",      color: "#f87171", step: -1 },
};
const STEPS = ["Recibido", "Pagado", "Despachado", "Entregado"];

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return ""; }
}

function Timeline({ status }) {
  const meta = STATUS[status] || STATUS.pending_payment;
  const cur = meta.step;
  const dead = cur < 0; // cancelado / fallido
  return (
    <div style={{ display: "flex", alignItems: "center", marginTop: 16 }}>
      {STEPS.map((label, i) => {
        const done = !dead && i <= cur;
        const active = !dead && i === cur;
        const dotColor = dead ? "rgba(148,163,184,.4)" : done ? meta.color : "rgba(255,255,255,.14)";
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "0 0 auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 54 }}>
              <div style={{
                width: 16, height: 16, borderRadius: "50%", background: dotColor,
                boxShadow: active ? `0 0 0 4px ${meta.color}33` : "none",
                border: done ? "none" : "1px solid rgba(255,255,255,.15)",
                display: "grid", placeItems: "center", transition: "all .3s",
              }}>
                {done && <span style={{ color: "#04120b", fontSize: 9, fontWeight: 900 }}>✓</span>}
              </div>
              <span style={{ fontSize: 9.5, letterSpacing: .4, textTransform: "uppercase", fontWeight: 700,
                color: done ? "rgba(255,255,255,.75)" : "rgba(255,255,255,.35)", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, margin: "0 2px 18px", background: !dead && i < cur ? meta.color : "rgba(255,255,255,.1)", borderRadius: 2, transition: "background .3s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MyOrders() {
  useBranding();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(null);

  // El cliente confirma que recibió el pedido (despachado → entregado).
  async function confirmReceived(publicId) {
    if (!window.confirm("¿Confirmás que recibiste este pedido?")) return;
    setConfirming(publicId);
    try {
      const r = await fetch(`${API}/api/shop/orders/${encodeURIComponent(publicId)}/received`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const d = await r.json();
      if (r.ok && d.order) {
        setOrders((prev) => prev.map((o) => (o.public_id === publicId ? d.order : o)));
      } else {
        alert(d.error || "No se pudo confirmar la recepción.");
      }
    } catch { alert("Error de red."); }
    setConfirming(null);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API}/api/shop/my-orders`, { headers: { Authorization: `Bearer ${getToken()}` } });
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) { setErr(d.error || "No se pudieron cargar tus pedidos."); }
        else setOrders(d.orders || []);
      } catch { if (alive) setErr("Error de conexión. Refrescá la página."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#e8eaed", padding: "clamp(20px,4vw,40px) clamp(16px,4vw,32px) 60px" }}>
      <style>{`
        .mo-card { transition: border-color .25s, box-shadow .25s, transform .25s; }
        .mo-card:hover { border-color: rgba(var(--brand-primary-rgb,245,224,58),.35); box-shadow: 0 12px 40px rgba(0,0,0,.4); transform: translateY(-2px); }
        @keyframes mo-shimmer { from { background-position: -400px 0 } to { background-position: 400px 0 } }
        .mo-skel { background: linear-gradient(100deg, rgba(255,255,255,.03) 30%, rgba(255,255,255,.07) 50%, rgba(255,255,255,.03) 70%); background-size: 800px 100%; animation: mo-shimmer 1.4s linear infinite; }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <h1 style={{ fontFamily: "'Gotham', system-ui, sans-serif", fontSize: 30, fontWeight: 900, letterSpacing: "-.02em", margin: 0 }}>Mis pedidos</h1>
          <Link to="/shop" style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-primary, #f5e03a)", textDecoration: "none" }}>Ir a la tienda →</Link>
        </div>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 14, margin: "0 0 24px" }}>
          Seguí el estado de tus compras. Te avisamos por email en cada paso.
        </p>

        {loading ? (
          <div style={{ display: "grid", gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="mo-skel" style={{ height: 150, borderRadius: 18, border: "1px solid rgba(255,255,255,.06)" }} />
            ))}
          </div>
        ) : err ? (
          <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#fca5a5", fontSize: 14 }}>{err}</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "70px 20px", border: "1px dashed rgba(255,255,255,.12)", borderRadius: 20 }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🛒</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Todavía no hiciste ninguna compra</div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: 14, marginBottom: 20 }}>Cuando compres algo, vas a poder seguirlo desde acá.</div>
            <Link to="/shop" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 999, background: "var(--brand-primary, #f5e03a)", color: "#000", fontWeight: 900, fontSize: 13, textDecoration: "none", letterSpacing: .5 }}>Ver la tienda</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {orders.map((o) => {
              const meta = STATUS[o.status] || STATUS.pending_payment;
              return (
                <div key={o.public_id} className="mo-card" style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: "18px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "'Gotham', monospace, monospace", fontSize: 15, fontWeight: 900, letterSpacing: 1 }}>#{o.public_id}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 800, color: meta.color, background: `${meta.color}1a`, border: `1px solid ${meta.color}44`, borderRadius: 999, padding: "3px 10px" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }} />{meta.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.45)", marginTop: 5 }}>
                        {fmtDate(o.created_at)}{o.item_count ? ` · ${o.item_count} ${o.item_count === 1 ? "producto" : "productos"}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "var(--brand-primary, #f5e03a)" }}>{o.total_formatted}</div>
                    </div>
                  </div>

                  <Timeline status={o.status} />

                  {o.tracking_number && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
                      <span style={{ color: "rgba(255,255,255,.55)" }}>🚚 {o.carrier_label || "Envío"}:</span>
                      <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{o.tracking_number}</span>
                      {o.tracking_url && (
                        <a href={o.tracking_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto", color: "var(--brand-primary, #f5e03a)", fontWeight: 800, textDecoration: "none" }}>Seguir envío →</a>
                      )}
                    </div>
                  )}

                  {o.status === "dispatched" && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <button onClick={() => confirmReceived(o.public_id)} disabled={confirming === o.public_id}
                        style={{ padding: "11px 22px", borderRadius: 999, border: "none", background: "#22c55e", color: "#04120b", fontFamily: "inherit", fontWeight: 900, fontSize: 13, letterSpacing: ".5px", cursor: confirming === o.public_id ? "default" : "pointer", boxShadow: "0 8px 22px -8px rgba(34,197,94,.6)" }}>
                        {confirming === o.public_id ? "Confirmando…" : "✓ SE RECIBIÓ"}
                      </button>
                      <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)", lineHeight: 1.4 }}>
                        Confirmá cuando lo tengas. Si no, se marca <b>entregado</b> solo a los 2 días.
                      </span>
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <Link to={`/shop/checkout/success?order=${encodeURIComponent(o.public_id)}`}
                      style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,.6)", textDecoration: "none" }}>
                      Ver detalle del pedido →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
