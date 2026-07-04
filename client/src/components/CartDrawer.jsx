// client/src/components/CartDrawer.jsx
//
// Cart drawer flotante + botón en burbuja. Sprint 14 F2 (2026-05-23).
// Se monta una sola vez en el árbol (por ej. en App.jsx) y se muestra
// en cualquier página gracias a useCart() compartido vía localStorage +
// CustomEvent. La burbuja del header sólo aparece si hay items o si el
// user explícitamente abre el drawer.

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCart, formatARS } from "../lib/useCart.js";
// fixImageUrl: corrige paths viejos snapshoteados en localStorage (ej. el
// render viejo del Cloner) y las sugerencias que llegan crudas de la API.
import { fixImageUrl, PRODUCT_FALLBACK_IMG } from "../lib/shopImages.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

const styles = {
  fab: (visible) => ({
    position: "fixed",
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--c-accent-2) 0%, #2E8F6E 100%)",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 14px 30px -8px rgba(46,143,110,.6)",
    display: visible ? "grid" : "none",
    placeItems: "center",
    zIndex: 8000,
    transition: "transform .25s ease",
    fontFamily: "inherit",
  }),
  badge: {
    position: "absolute",
    top: -6, right: -6,
    minWidth: 22, height: 22, padding: "0 6px",
    background: "#fff", color: "var(--c-surface-2)",
    borderRadius: 999,
    fontSize: 11, fontWeight: 900,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 10px rgba(0,0,0,.25)",
  },
  backdrop: (open) => ({
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,.55)",
    backdropFilter: "blur(2px)",
    opacity: open ? 1 : 0,
    pointerEvents: open ? "auto" : "none",
    transition: "opacity .3s ease",
    zIndex: 9000,
  }),
  drawer: (open) => ({
    position: "fixed",
    top: 0, right: 0, bottom: 0,
    width: "min(420px, 92vw)",
    background: "var(--brand-bg, var(--c-bg))",
    color: "var(--brand-text, var(--c-text))",
    fontFamily: "var(--brand-font, 'Gotham', system-ui, sans-serif)",
    transform: open ? "translateX(0)" : "translateX(100%)",
    transition: "transform .35s cubic-bezier(.2,.8,.2,1)",
    boxShadow: "-30px 0 60px rgba(0,0,0,.5)",
    zIndex: 9001,
    display: "flex", flexDirection: "column",
  }),
  drawerHead: {
    padding: "20px 22px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  drawerTitle: {
    margin: 0, fontSize: 18, fontWeight: 900,
    textTransform: "uppercase", letterSpacing: ".06em",
  },
  closeBtn: {
    background: "var(--c-border)", border: "none",
    color: "inherit", padding: "6px 12px", borderRadius: 6,
    cursor: "pointer", fontFamily: "inherit", fontSize: 18,
  },
  drawerBody: {
    flex: 1, overflowY: "auto", padding: "16px 22px",
  },
  empty: {
    padding: "40px 0", textAlign: "center",
    color: "rgba(var(--c-text-rgb),.55)", fontSize: 14, lineHeight: 1.6,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "64px 1fr auto",
    gap: 12, padding: "12px 0",
    borderBottom: "1px solid var(--c-border)",
    alignItems: "center",
  },
  rowImg: {
    width: 64, height: 64, objectFit: "contain",
    background: "rgba(255,255,255,.04)", borderRadius: 8,
    padding: 6,
  },
  rowName: { fontWeight: 600, fontSize: 14, lineHeight: 1.3, marginBottom: 4 },
  rowPrice: { fontSize: 13, color: "var(--brand-primary, var(--c-accent))", fontWeight: 700 },
  qty: {
    display: "inline-flex", alignItems: "center", gap: 6,
    marginTop: 6,
  },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 6,
    background: "rgba(255,255,255,.08)", color: "inherit",
    border: "none", cursor: "pointer", fontFamily: "inherit",
    fontSize: 16, fontWeight: 700,
  },
  qtyNum: { minWidth: 28, textAlign: "center", fontSize: 13, fontWeight: 600 },
  removeBtn: {
    background: "transparent", color: "rgba(239,68,68,.85)",
    border: "none", cursor: "pointer", fontSize: 12,
    fontFamily: "inherit", padding: 4,
  },
  sugWrap: {
    marginTop: 18, paddingTop: 16,
    borderTop: "1px dashed var(--c-border)",
  },
  sugTitle: {
    fontSize: 12, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase",
    color: "var(--brand-primary, var(--c-accent))", marginBottom: 12,
  },
  sugRow: {
    display: "grid", gridTemplateColumns: "44px 1fr auto",
    gap: 10, alignItems: "center", padding: "8px 0",
  },
  sugImg: {
    width: 44, height: 44, objectFit: "contain",
    background: "rgba(255,255,255,.04)", borderRadius: 6, padding: 4,
  },
  sugName: {
    fontSize: 13, fontWeight: 600, lineHeight: 1.25,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  sugPrice: { fontSize: 12, color: "rgba(var(--c-text-rgb),.6)", marginTop: 2 },
  sugAdd: {
    padding: "7px 11px", borderRadius: 999, whiteSpace: "nowrap",
    border: "1px solid rgba(var(--c-accent-rgb),.4)",
    background: "rgba(var(--c-accent-rgb),.12)", color: "var(--brand-primary, var(--c-accent))",
    fontFamily: "inherit", fontWeight: 800, fontSize: 11, letterSpacing: ".03em",
    textTransform: "uppercase", cursor: "pointer",
  },
  drawerFoot: {
    borderTop: "1px solid rgba(255,255,255,.08)",
    padding: "18px 22px",
    display: "flex", flexDirection: "column", gap: 12,
    background: "rgba(0,0,0,.3)",
  },
  totalRow: {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    fontSize: 14,
  },
  totalVal: { fontSize: 22, fontWeight: 900, color: "var(--brand-primary, var(--c-accent))" },
  ctaCheckout: {
    padding: "14px 22px", borderRadius: 999, border: "none",
    background: "linear-gradient(135deg, var(--c-accent-2) 0%, #2E8F6E 100%)",
    color: "#fff", fontFamily: "inherit", fontWeight: 900,
    fontSize: 14, letterSpacing: ".06em", textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: "0 14px 30px -8px rgba(46,143,110,.55)",
  },
  ctaCheckoutDisabled: {
    background: "var(--c-border)", color: "rgba(var(--c-text-rgb),.4)",
    cursor: "not-allowed", boxShadow: "none",
  },
};

export default function CartDrawer() {
  const { items, addItem, updateQty, removeItem, subtotalCents, itemCount } = useCart();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Cross-sell: trae complementarios curados una sola vez (al primer open).
  useEffect(() => {
    if (!open || suggestions.length) return;
    let alive = true;
    fetch(`${API}/api/shop/cross-sell`)
      .then((r) => r.json())
      .then((d) => { if (alive) setSuggestions(d.products || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open, suggestions.length]);

  // Sugerencias a mostrar: las que todavía no están en el carrito (máx 3).
  const suggestToShow = suggestions
    .filter((s) => !items.some((i) => i.id === s.id))
    .slice(0, 3);

  function addSuggestion(s) {
    addItem({
      id: s.id, slug: s.slug, name: s.name,
      price_cents: s.price_cents, primary_image: s.primary_image, stock: s.stock,
    }, 1);
  }

  // No mostrar el FAB en /shop/checkout (ya hay carrito visible inline)
  // ni en /admin* (admin no compra como cliente desde su sesión).
  const hideFab =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/shop/checkout") ||
    location.pathname.startsWith("/setup-admin");

  // Atajo: Escape cierra el drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Listener global: cualquier botón "Agregar al carrito" puede disparar
  // window.dispatchEvent(new CustomEvent('holistic-cart-open')) para
  // abrir el drawer como feedback visual.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("holistic-cart-open", onOpen);
    return () => window.removeEventListener("holistic-cart-open", onOpen);
  }, []);

  function goToCheckout() {
    setOpen(false);
    navigate("/shop/checkout");
  }

  return (
    <>
      {/* Micro-interacciones + focus-visible (el drawer usa estilos inline; estas
          reglas sólo tocan outline/transform, que no chocan con el inline). */}
      <style>{`
        .cart-fab:hover { transform: scale(1.06); }
        .cart-fab:focus-visible, .cd-close:focus-visible, .cd-qty:focus-visible,
        .cd-remove:focus-visible, .cd-sugadd:focus-visible, .cd-checkout:focus-visible {
          outline: 2px solid var(--c-accent); outline-offset: 2px;
        }
        .cd-close, .cd-qty, .cd-sugadd, .cd-checkout { transition: transform .15s ease; }
        .cd-close:hover { transform: rotate(90deg); }
        .cd-qty:hover { transform: translateY(-1px); }
        .cd-qty:active, .cd-sugadd:active { transform: translateY(1px); }
        .cd-checkout:hover:not(:disabled) { transform: translateY(-2px); }
        .cd-checkout:active:not(:disabled) { transform: translateY(0); }
        @media (prefers-reduced-motion: reduce) {
          .cart-fab, .cd-close, .cd-qty, .cd-sugadd, .cd-checkout { transition: none; }
          .cart-fab:hover, .cd-close:hover { transform: none; }
        }
      `}</style>
      <button
        type="button"
        className="cart-fab"
        style={styles.fab(itemCount > 0 && !hideFab)}
        onClick={() => setOpen(true)}
        aria-label={`Abrir carrito (${itemCount} ítems)`}
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
          <path d="M2.5 3h2.7l2.5 12.4a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
        </svg>
        {itemCount > 0 && <span style={styles.badge}>{itemCount}</span>}
      </button>

      <div style={styles.backdrop(open)} onClick={() => setOpen(false)} />

      <aside style={styles.drawer(open)} role="dialog" aria-label="Tu carrito" aria-hidden={!open}>
        <header style={styles.drawerHead}>
          <h2 style={styles.drawerTitle}>Tu carrito</h2>
          <button className="cd-close" style={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Cerrar carrito">✕</button>
        </header>

        <div style={styles.drawerBody}>
          {items.length === 0 ? (
            <div style={styles.empty}>
              Tu carrito está vacío.<br />
              Sumá productos desde el <a href="/shop" style={{ color: "var(--brand-primary, var(--c-accent))" }}>catálogo</a>.
            </div>
          ) : (
            items.map((i) => (
              <div key={i.id} style={styles.row}>
                {/* Packs de puntos y cualquier item sin foto caen a la moneda
                    HOLISTIC oficial (PRODUCT_FALLBACK_IMG = moneda-holistic.webp). */}
                <img src={i.primary_image ? fixImageUrl(i.primary_image) : PRODUCT_FALLBACK_IMG} alt={i.name} style={styles.rowImg} />
                <div>
                  <div style={styles.rowName}>{i.name}</div>
                  <div style={styles.rowPrice}>{formatARS(i.price_cents)}</div>
                  <div style={styles.qty}>
                    <button className="cd-qty" style={styles.qtyBtn} onClick={() => updateQty(i.id, i.quantity - 1)} aria-label="Quitar uno">−</button>
                    <span style={styles.qtyNum}>{i.quantity}</span>
                    <button className="cd-qty" style={styles.qtyBtn} onClick={() => updateQty(i.id, i.quantity + 1)} aria-label="Sumar uno">+</button>
                  </div>
                </div>
                <button className="cd-remove" style={styles.removeBtn} onClick={() => removeItem(i.id)} aria-label={`Quitar ${i.name} del carrito`}>
                  Quitar
                </button>
              </div>
            ))
          )}

          {/* Cross-sell: "te olvidaste / sirve para acompañar" */}
          {items.length > 0 && suggestToShow.length > 0 && (
            <div style={styles.sugWrap}>
              <div style={styles.sugTitle}>¿Te olvidaste algo?</div>
              {suggestToShow.map((s) => (
                <div key={s.id} style={styles.sugRow}>
                  <img src={s.primary_image ? fixImageUrl(s.primary_image) : PRODUCT_FALLBACK_IMG} alt={s.name} style={styles.sugImg} />
                  <div style={{ minWidth: 0 }}>
                    <div style={styles.sugName}>{s.name}</div>
                    <div style={styles.sugPrice}>{formatARS(s.price_cents)}</div>
                  </div>
                  <button className="cd-sugadd" style={styles.sugAdd} onClick={() => addSuggestion(s)} aria-label={`Agregar ${s.name}`}>
                    + Sumar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer style={styles.drawerFoot}>
          <div style={styles.totalRow}>
            <span style={{ color: "rgba(var(--c-text-rgb),.65)" }}>Subtotal</span>
            <span style={styles.totalVal}>{formatARS(subtotalCents)}</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(var(--c-text-rgb),.5)", marginTop: -4 }}>
            El envío se calcula en el checkout.
          </div>
          <button
            className="cd-checkout"
            style={{ ...styles.ctaCheckout, ...(items.length === 0 ? styles.ctaCheckoutDisabled : {}) }}
            disabled={items.length === 0}
            onClick={goToCheckout}
          >
            Ir al checkout →
          </button>
        </footer>
      </aside>
    </>
  );
}
