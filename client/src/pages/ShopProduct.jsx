// client/src/pages/ShopProduct.jsx
//
// Detalle público de un producto (fase 1 — Sprint 14, 2026-05-23).
// Gallery + name + price + descripción + botón "Agregar al carrito"
// (placeholder fase 2). Sin auth requerido para browse.

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBranding } from "../lib/branding.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

const styles = {
  shell: {
    minHeight: "100vh",
    background: "var(--brand-bg, #080808)",
    color: "var(--brand-text, #ede9e0)",
    fontFamily: "var(--brand-font, 'Gotham', system-ui, sans-serif)",
    padding: "32px 20px 80px",
  },
  container: { maxWidth: 1100, margin: "0 auto" },
  back: {
    display: "inline-flex", alignItems: "center", gap: 8,
    color: "rgba(237,233,224,.7)", textDecoration: "none",
    fontSize: 13, fontWeight: 600, letterSpacing: ".04em",
    marginBottom: 28,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr",
    gap: "clamp(28px, 5vw, 60px)",
    alignItems: "start",
  },
  gallery: { display: "flex", flexDirection: "column", gap: 14 },
  mainImg: {
    width: "100%", aspectRatio: "1 / 1",
    objectFit: "contain", padding: 40,
    background: "rgba(255,255,255,.03)",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.06)",
    display: "block",
  },
  thumbs: { display: "flex", gap: 10, flexWrap: "wrap" },
  thumb: (active) => ({
    width: 64, height: 64, padding: 6,
    borderRadius: 10, cursor: "pointer",
    background: "rgba(255,255,255,.04)",
    border: active ? "1.5px solid var(--brand-primary, #A7F5C8)" : "1px solid rgba(255,255,255,.1)",
    objectFit: "contain", display: "block",
    transition: "border-color .25s ease",
  }),
  info: { display: "flex", flexDirection: "column", gap: 16 },
  cat: {
    fontSize: 11, fontWeight: 700, letterSpacing: ".28em",
    textTransform: "uppercase", color: "var(--brand-primary, #A7F5C8)",
  },
  name: {
    fontFamily: "'Gotham', sans-serif",
    fontSize: "clamp(1.8rem, 3.6vw, 2.6rem)",
    fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.01em",
    margin: 0, textTransform: "uppercase",
  },
  shortDesc: {
    fontSize: "clamp(1rem, 1.2vw, 1.1rem)",
    lineHeight: 1.55, color: "rgba(237,233,224,.78)",
    margin: 0,
  },
  priceRow: {
    display: "flex", alignItems: "baseline", gap: 14,
    paddingTop: 4,
  },
  price: {
    fontFamily: "'Gotham', sans-serif",
    fontSize: "clamp(2rem, 3.8vw, 2.8rem)",
    fontWeight: 900, color: "var(--brand-primary, #A7F5C8)",
    letterSpacing: "-0.01em",
  },
  stock: {
    fontSize: 13, color: "rgba(237,233,224,.55)",
    fontWeight: 600,
  },
  cta: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 12, padding: "16px 28px", marginTop: 4,
    borderRadius: 999, border: "none",
    background: "linear-gradient(135deg, #25D366 0%, #2E8F6E 100%)",
    color: "#fff",
    fontFamily: "inherit", fontSize: 14, fontWeight: 800,
    letterSpacing: ".08em", textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: "0 14px 30px -8px rgba(46,143,110,.55)",
    transition: "transform .25s ease, box-shadow .35s ease",
  },
  ctaDisabled: {
    background: "rgba(255,255,255,.08)",
    color: "rgba(237,233,224,.4)",
    boxShadow: "none", cursor: "not-allowed",
  },
  longDesc: {
    marginTop: 22, paddingTop: 22,
    borderTop: "1px solid rgba(255,255,255,.08)",
    fontSize: 15, lineHeight: 1.7, color: "rgba(237,233,224,.78)",
    whiteSpace: "pre-line",
  },
  trust: {
    display: "flex", flexWrap: "wrap", gap: 10,
    marginTop: 18, padding: "16px 0", borderTop: "1px solid rgba(255,255,255,.06)",
  },
  trustItem: {
    display: "inline-flex", alignItems: "center", gap: 7,
    fontSize: 12, color: "rgba(237,233,224,.7)",
  },
  notice: {
    padding: "14px 16px", borderRadius: 10,
    background: "rgba(167,245,200,.08)",
    border: "1px solid rgba(167,245,200,.22)",
    color: "var(--brand-primary, #A7F5C8)",
    fontSize: 13, marginTop: 14,
  },
  empty: {
    textAlign: "center", padding: "80px 20px",
    color: "rgba(237,233,224,.55)", fontSize: 15,
  },
};

export default function ShopProduct() {
  useBranding();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch(`${API}/api/shop/products/${encodeURIComponent(slug)}`);
        if (r.status === 404) {
          setErr("Producto no encontrado");
        } else {
          const d = await r.json();
          setProduct(d.product || null);
        }
      } catch (e) {
        setErr("Error al cargar el producto");
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div style={styles.shell}>
        <div style={styles.container}>
          <div style={styles.empty}>Cargando…</div>
        </div>
      </div>
    );
  }

  if (err || !product) {
    return (
      <div style={styles.shell}>
        <div style={styles.container}>
          <Link to="/shop" style={styles.back}>← Volver al catálogo</Link>
          <div style={styles.empty}>{err || "Producto no encontrado"}</div>
        </div>
      </div>
    );
  }

  const images = product.images?.length
    ? product.images
    : [{ url: product.primary_image, alt: product.name }].filter((i) => i.url);

  const inStock = product.stock == null || product.stock > 0;

  function addToCart() {
    // Placeholder fase 2: cart real con localStorage + checkout MercadoPago.
    // Por ahora solo telegrafiamos al user que está en proceso de carga.
    setToast("Carrito en construcción — próximamente vas a poder comprar 🛒");
    setTimeout(() => setToast(""), 4000);
  }

  return (
    <div style={styles.shell}>
      <div style={styles.container}>
        <Link to="/shop" style={styles.back}>← Volver al catálogo</Link>

        <div style={{ ...styles.grid, gridTemplateColumns: window.innerWidth < 800 ? "1fr" : styles.grid.gridTemplateColumns }}>
          <div style={styles.gallery}>
            {images[activeImg]?.url ? (
              <img src={images[activeImg].url} alt={images[activeImg].alt || product.name} style={styles.mainImg} />
            ) : (
              <div style={{ ...styles.mainImg, background: "rgba(255,255,255,.05)" }} />
            )}
            {images.length > 1 && (
              <div style={styles.thumbs}>
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={img.url}
                    alt={img.alt || ""}
                    style={styles.thumb(i === activeImg)}
                    onClick={() => setActiveImg(i)}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={styles.info}>
            {product.category && <div style={styles.cat}>{product.category.name}</div>}
            <h1 style={styles.name}>{product.name}</h1>
            {product.short_description && <p style={styles.shortDesc}>{product.short_description}</p>}

            <div style={styles.priceRow}>
              <span style={styles.price}>{product.price_formatted}</span>
              <span style={styles.stock}>
                {inStock
                  ? (product.stock == null ? "En stock" : `${product.stock} disponibles`)
                  : "Sin stock"}
              </span>
            </div>

            <button
              style={{ ...styles.cta, ...(inStock ? {} : styles.ctaDisabled) }}
              disabled={!inStock}
              onClick={addToCart}
              aria-label={`Agregar ${product.name} al carrito`}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="20" r="1.4" />
                <circle cx="18" cy="20" r="1.4" />
                <path d="M2.5 3h2.7l2.5 12.4a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
              </svg>
              {inStock ? "Agregar al carrito" : "Sin stock"}
            </button>

            {toast && <div style={styles.notice}>{toast}</div>}

            <div style={styles.trust}>
              <span style={styles.trustItem}>🚚 Envío en 48 hs</span>
              <span style={styles.trustItem}>💳 Pago en cuotas</span>
              <span style={styles.trustItem}>🔒 Compra segura</span>
            </div>

            {product.long_description && (
              <div style={styles.longDesc}>{product.long_description}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
