// client/src/pages/ShopCheckoutFailure.jsx
//
// Página de retorno cuando MercadoPago reporta failure o cancel. El carrito
// NO se limpia — el usuario puede reintentar el pago desde el checkout.

import { Link, useSearchParams } from "react-router-dom";
import { useBranding } from "../lib/branding.js";

const styles = {
  shell: {
    minHeight: "100vh",
    background: "var(--brand-bg, var(--c-bg))",
    color: "var(--brand-text, var(--c-text))",
    fontFamily: "var(--brand-font, 'Gotham', system-ui, sans-serif)",
    padding: "80px 20px",
    display: "grid", placeItems: "center",
  },
  card: {
    maxWidth: 520, width: "100%",
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(239,68,68,.25)",
    borderRadius: 20, padding: "40px 32px",
    textAlign: "center",
  },
  icon: { fontSize: 56, marginBottom: 14 },
  h1: {
    fontFamily: "'Gotham', sans-serif",
    fontSize: "clamp(1.7rem, 3.2vw, 2.2rem)", fontWeight: 900,
    margin: "0 0 10px", textTransform: "uppercase",
  },
  sub: { color: "rgba(var(--c-text-rgb),.78)", fontSize: 15, lineHeight: 1.55, marginBottom: 22 },
  btnRow: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 },
  btn: {
    padding: "12px 22px", borderRadius: 999,
    background: "linear-gradient(135deg, var(--c-accent-2) 0%, #2E8F6E 100%)",
    color: "#fff", textDecoration: "none",
    fontFamily: "inherit", fontWeight: 800, fontSize: 13,
    letterSpacing: ".06em", textTransform: "uppercase",
  },
  btnGhost: {
    padding: "12px 22px", borderRadius: 999,
    background: "transparent",
    border: "1px solid rgba(255,255,255,.18)",
    color: "rgba(var(--c-text-rgb),.85)", textDecoration: "none",
    fontFamily: "inherit", fontWeight: 700, fontSize: 13,
    letterSpacing: ".06em", textTransform: "uppercase",
  },
};

export default function ShopCheckoutFailure() {
  useBranding();
  const [params] = useSearchParams();
  const orderParam = params.get("order");

  return (
    <div className="theme-light" style={styles.shell}>
      <div style={styles.card}>
        <div style={styles.icon}>⚠️</div>
        <h1 style={styles.h1}>El pago no se completó</h1>
        <p style={styles.sub}>
          MercadoPago no pudo procesar el pago. Tus productos siguen en el
          carrito — podés intentarlo de nuevo cuando quieras.
        </p>
        {orderParam && (
          <p style={{ fontSize: 12, color: "rgba(var(--c-text-rgb),.55)", marginBottom: 16 }}>
            Referencia: <code style={{ fontFamily: "monospace" }}>{orderParam}</code>
          </p>
        )}
        <div style={styles.btnRow}>
          <Link to="/shop/checkout" style={styles.btn}>Intentar de nuevo</Link>
          <Link to="/shop" style={styles.btnGhost}>Volver al catálogo</Link>
        </div>
      </div>
    </div>
  );
}
