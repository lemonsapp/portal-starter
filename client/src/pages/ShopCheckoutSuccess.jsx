// client/src/pages/ShopCheckoutSuccess.jsx
//
// Página de retorno post-MercadoPago (o post-fallback manual). Limpia el
// carrito y muestra el número de orden + estado real consultado al backend.

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCart } from "../lib/useCart.js";
import { useBranding } from "../lib/branding.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

const styles = {
  shell: {
    minHeight: "100vh",
    background: "var(--brand-bg, #080808)",
    color: "var(--brand-text, #ede9e0)",
    fontFamily: "var(--brand-font, 'Gotham', system-ui, sans-serif)",
    padding: "80px 20px",
    display: "grid", placeItems: "center",
  },
  card: {
    maxWidth: 540, width: "100%",
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(167,245,200,.25)",
    borderRadius: 20, padding: "40px 32px",
    textAlign: "center",
    boxShadow: "0 0 80px rgba(167,245,200,.08)",
  },
  icon: { fontSize: 56, marginBottom: 14 },
  h1: {
    fontFamily: "'Gotham', sans-serif",
    fontSize: "clamp(1.7rem, 3.2vw, 2.2rem)", fontWeight: 900,
    margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "-0.01em",
  },
  sub: { color: "rgba(237,233,224,.78)", fontSize: 15, lineHeight: 1.55, marginBottom: 22 },
  orderBox: {
    background: "rgba(255,255,255,.05)",
    border: "1px dashed rgba(255,255,255,.18)",
    borderRadius: 12, padding: "14px 18px",
    margin: "0 auto 22px",
    display: "inline-block", textAlign: "left",
  },
  orderLabel: { fontSize: 10, fontWeight: 800, letterSpacing: ".24em", textTransform: "uppercase", color: "rgba(237,233,224,.55)", marginBottom: 4 },
  orderId: { fontSize: 22, fontWeight: 900, color: "var(--brand-primary, #A7F5C8)", letterSpacing: ".04em", fontFamily: "monospace" },
  status: (kind) => ({
    display: "inline-block",
    padding: "4px 12px", marginTop: 8,
    borderRadius: 999, fontSize: 11, fontWeight: 800,
    letterSpacing: ".18em", textTransform: "uppercase",
    background: kind === "paid" ? "rgba(167,245,200,.16)" : "rgba(252,211,77,.14)",
    color: kind === "paid" ? "var(--brand-primary, #A7F5C8)" : "#fcd34d",
  }),
  btnRow: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 12 },
  btn: {
    padding: "12px 22px", borderRadius: 999,
    background: "linear-gradient(135deg, #25D366 0%, #2E8F6E 100%)",
    color: "#fff", textDecoration: "none",
    fontFamily: "inherit", fontWeight: 800, fontSize: 13,
    letterSpacing: ".06em", textTransform: "uppercase",
  },
  btnGhost: {
    padding: "12px 22px", borderRadius: 999,
    background: "transparent",
    border: "1px solid rgba(255,255,255,.18)",
    color: "rgba(237,233,224,.85)", textDecoration: "none",
    fontFamily: "inherit", fontWeight: 700, fontSize: 13,
    letterSpacing: ".06em", textTransform: "uppercase",
  },
};

export default function ShopCheckoutSuccess() {
  useBranding();
  const [params] = useSearchParams();
  const orderParam = params.get("order") || sessionStorage.getItem("holistic.lastOrder");
  const isPending = params.get("pending") === "1";
  const { clear } = useCart();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Clear cart al montarse (la compra ya está confirmada por el backend
  // si llegamos acá). Idempotente.
  useEffect(() => { clear(); }, [clear]);

  useEffect(() => {
    if (!orderParam) {
      setLoading(false);
      return;
    }
    fetch(`${API}/api/shop/orders/${encodeURIComponent(orderParam)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setOrder(d?.order || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderParam]);

  const status = order?.status;
  const isPaid = status === "paid";
  const isManual = status === "pending_payment";

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        <div style={styles.icon}>{isPaid ? "✅" : isPending ? "⏳" : "📦"}</div>
        <h1 style={styles.h1}>
          {isPaid ? "¡Compra confirmada!" : isPending ? "Pago pendiente" : "Orden recibida"}
        </h1>
        <p style={styles.sub}>
          {isPaid && "Recibimos tu pago. En las próximas horas te escribimos por WhatsApp con la fecha de envío."}
          {isPending && "MercadoPago todavía está procesando el pago. Te avisamos por email cuando se confirme."}
          {isManual && "Guardamos tu pedido. Te contactamos por WhatsApp para coordinar pago y envío."}
          {!status && loading && "Consultando estado de tu orden…"}
          {!status && !loading && "Te contactamos por WhatsApp para coordinar."}
        </p>

        {orderParam && (
          <div style={styles.orderBox}>
            <div style={styles.orderLabel}>Número de orden</div>
            <div style={styles.orderId}>{orderParam}</div>
            {status && (
              <div style={styles.status(isPaid ? "paid" : "pending")}>
                {isPaid ? "✓ Pagado" : isPending ? "⏳ Pendiente MP" : "📋 En revisión"}
              </div>
            )}
          </div>
        )}

        <div style={styles.btnRow}>
          <Link to="/shop" style={styles.btn}>Seguir comprando</Link>
          <Link to="/inicio" style={styles.btnGhost}>Volver al inicio</Link>
        </div>

        <p style={{ marginTop: 22, fontSize: 12, color: "rgba(237,233,224,.5)" }}>
          Cualquier consulta, escribinos a <strong>HolisticGrowShop</strong> por WhatsApp.
          Guardá tu número de orden para referencias futuras.
        </p>
      </div>
    </div>
  );
}
