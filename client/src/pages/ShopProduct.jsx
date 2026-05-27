// client/src/pages/ShopProduct.jsx
//
// Detalle de producto — REWRITE editorial 2026-05-23.
// Layout magazine: galería 55% + info 45%, Gotham Black + Fraunces
// italic, mint accents, sticky add-to-cart en mobile.

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBranding } from "../lib/branding.js";
import { useCart } from "../lib/useCart.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export default function ShopProduct() {
  useBranding();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [activeImg, setActiveImg] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setActiveImg(0);
    setQuantity(1);
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
          // Cargar productos relacionados de la misma categoría
          if (d.product?.category?.slug) {
            fetch(`${API}/api/shop/products?category=${d.product.category.slug}&limit=8`)
              .then((r) => r.json())
              .then((rd) => setRelated((rd.products || []).filter((p) => p.id !== d.product.id).slice(0, 4)))
              .catch(() => {});
          }
        }
      } catch (e) {
        setErr("Error al cargar el producto");
      }
      setLoading(false);
    })();
  }, [slug]);

  function addToCart() {
    if (!product) return;
    addItem(product, Math.max(1, Number(quantity) || 1));
    window.dispatchEvent(new CustomEvent("holistic-cart-open"));
    setToast(`Agregado al carrito — ${quantity} ${quantity > 1 ? "unidades" : "unidad"}`);
    setTimeout(() => setToast(""), 2500);
  }

  if (loading) {
    return (
      <div className="theme-light" style={S.shell}>
        <div style={S.container}>
          <div style={S.loading}>Cargando…</div>
        </div>
      </div>
    );
  }

  if (err || !product) {
    return (
      <div className="theme-light" style={S.shell}>
        <div style={S.container}>
          <Link to="/shop" style={S.back}>← Volver al catálogo</Link>
          <div style={S.loading}>{err || "Producto no encontrado"}</div>
        </div>
      </div>
    );
  }

  const images = product.images?.length
    ? product.images
    : [{ url: product.primary_image, alt: product.name }].filter((i) => i.url);
  const inStock = product.stock == null || product.stock > 0;

  return (
    <div className="theme-light" style={S.shell}>
      <div style={S.container}>
        <Link to="/shop" style={S.back}>← Volver al catálogo</Link>

        {/* Layout: galería 55% + info 45% en desktop, stack en mobile */}
        <div style={S.layout}>
          {/* ─── GALERÍA ─── */}
          <div style={S.gallery}>
            <div style={S.mainImgWrap}>
              {images[activeImg]?.url ? (
                <img
                  src={images[activeImg].url}
                  alt={images[activeImg].alt || product.name}
                  style={S.mainImg}
                />
              ) : (
                <div style={{ ...S.mainImg, background: "rgba(255,255,255,.05)" }} />
              )}
              {product.featured && (
                <span style={S.featuredBadge}>⭐ Destacado</span>
              )}
            </div>
            {images.length > 1 && (
              <div style={S.thumbs}>
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    style={S.thumb(i === activeImg)}
                    aria-label={`Ver imagen ${i + 1}`}
                  >
                    <img src={img.url} alt={img.alt || ""} style={S.thumbImg} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── INFO ─── */}
          <div style={S.info}>
            {product.category && (
              <div style={S.cat}>
                <span style={S.catDot} />
                {product.category.name.toUpperCase()}
              </div>
            )}

            <h1 style={S.name}>{product.name}</h1>

            {product.short_description && (
              <p style={S.tagline}>{product.short_description}</p>
            )}

            <div style={S.priceRow}>
              <span style={S.price}>{product.price_formatted}</span>
              {product.sku && <span style={S.sku}>SKU: {product.sku}</span>}
            </div>

            <div style={S.stockRow}>
              {inStock ? (
                <span style={S.stockOk}>
                  <span style={S.stockOkDot} /> Disponible
                  {product.stock != null && ` · ${product.stock} en stock`}
                </span>
              ) : (
                <span style={S.stockOut}>● Sin stock por ahora</span>
              )}
            </div>

            {/* Quantity selector */}
            {inStock && (
              <div style={S.qtyRow}>
                <span style={S.qtyLabel}>Cantidad</span>
                <div style={S.qtyControls}>
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    style={S.qtyBtn}
                    aria-label="Restar uno"
                  >−</button>
                  <span style={S.qtyNum}>{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stock ?? 99, q + 1))}
                    style={S.qtyBtn}
                    aria-label="Sumar uno"
                  >+</button>
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              style={{ ...S.cta, ...(inStock ? {} : S.ctaDisabled) }}
              disabled={!inStock}
              onClick={addToCart}
              aria-label={`Agregar ${product.name} al carrito`}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="20" r="1.4" />
                <circle cx="18" cy="20" r="1.4" />
                <path d="M2.5 3h2.7l2.5 12.4a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
              </svg>
              <span>{inStock ? "Agregar al carrito" : "Sin stock"}</span>
            </button>

            {toast && <div style={S.toast}>✓ {toast}</div>}

            {/* Trust signals */}
            <div style={S.trust}>
              <span style={S.trustItem}>🚚 Envío 48 hs</span>
              <span style={S.trustItem}>💳 Cuotas</span>
              <span style={S.trustItem}>🔒 Pago seguro MP</span>
              <span style={S.trustItem}>♥ Soporte humano</span>
            </div>
          </div>
        </div>

        {/* Descripción larga — sección editorial separada */}
        {product.long_description && (
          <section style={S.longDescSection}>
            <h2 style={S.sectionHeading}>
              <span>Sobre </span>
              <span style={S.sectionHeadingItalic}>el producto</span>
            </h2>
            <p style={S.longDesc}>{product.long_description}</p>
          </section>
        )}

        {/* Metadata sheet (si meta tiene info útil) */}
        {product.meta && Object.keys(product.meta).length > 0 && (
          <section style={S.metaSection}>
            <h2 style={S.sectionHeading}>
              <span>Datos </span>
              <span style={S.sectionHeadingItalic}>técnicos</span>
            </h2>
            <dl style={S.metaSheet}>
              {Object.entries(product.meta).map(([k, v]) => (
                <div key={k} style={S.metaRow}>
                  <dt style={S.metaKey}>{k.replace(/_/g, " ")}</dt>
                  <dd style={S.metaVal}>{Array.isArray(v) ? v.join(" · ") : String(v)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Productos relacionados */}
        {related.length > 0 && (
          <section style={S.relatedSection}>
            <h2 style={S.sectionHeading}>
              <span>También de </span>
              <span style={S.sectionHeadingItalic}>{product.category?.name?.toLowerCase() || "esta línea"}</span>
            </h2>
            <div style={S.relatedGrid}>
              {related.map((r) => (
                <Link key={r.id} to={`/shop/${r.slug}`} style={S.relatedCard}>
                  <div style={S.relatedImgWrap}>
                    {r.primary_image && <img src={r.primary_image} alt={r.name} style={S.relatedImg} loading="lazy" />}
                  </div>
                  <div style={S.relatedBody}>
                    <span style={S.relatedName}>{r.name}</span>
                    <span style={S.relatedPrice}>{r.price_formatted}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  shell: {
    minHeight: "100vh",
    background: "var(--brand-bg, var(--c-bg))",
    color: "var(--brand-text, var(--c-text))",
    fontFamily: "var(--brand-font, 'Gotham', system-ui, sans-serif)",
    padding: "32px 24px 100px",
  },
  container: { maxWidth: 1280, margin: "0 auto" },

  back: {
    display: "inline-flex", alignItems: "center", gap: 8,
    color: "rgba(var(--c-text-rgb),.7)", textDecoration: "none",
    fontSize: 12, fontWeight: 700, letterSpacing: ".06em",
    marginBottom: 36, textTransform: "uppercase",
  },

  loading: {
    padding: "120px 20px", textAlign: "center",
    color: "rgba(var(--c-text-rgb),.5)", fontSize: 14,
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
    gap: "clamp(36px, 6vw, 80px)",
    alignItems: "flex-start",
  },

  // ── Gallery ──
  gallery: { display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24 },
  mainImgWrap: {
    position: "relative",
    width: "100%", aspectRatio: "1 / 1",
    background: "linear-gradient(135deg, rgba(var(--c-accent-rgb),.05), rgba(46,143,110,.08))",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,.05)",
    overflow: "hidden",
    display: "grid", placeItems: "center",
    padding: "10%",
  },
  mainImg: {
    width: "100%", height: "100%",
    objectFit: "contain", display: "block",
  },
  featuredBadge: {
    position: "absolute", top: 18, right: 18,
    padding: "6px 14px", borderRadius: 999,
    background: "rgba(var(--c-accent-rgb),.20)",
    color: "var(--brand-primary, var(--c-accent))",
    fontSize: 10, fontWeight: 800, letterSpacing: ".2em",
    textTransform: "uppercase", backdropFilter: "blur(8px)",
  },
  thumbs: { display: "flex", gap: 10, flexWrap: "wrap" },
  thumb: (active) => ({
    width: 76, height: 76, padding: 8,
    borderRadius: 12, cursor: "pointer",
    background: "rgba(255,255,255,.04)",
    border: active ? "2px solid var(--brand-primary, var(--c-accent))" : "1px solid rgba(255,255,255,.08)",
    overflow: "hidden",
    transition: "border-color .25s ease",
  }),
  thumbImg: { width: "100%", height: "100%", objectFit: "contain", display: "block" },

  // ── Info ──
  info: { display: "flex", flexDirection: "column", gap: 14 },
  cat: {
    display: "inline-flex", alignItems: "center", gap: 10,
    fontSize: 11, fontWeight: 700, letterSpacing: ".3em",
    color: "var(--brand-primary, var(--c-accent))",
    marginBottom: 4,
  },
  catDot: {
    display: "inline-block",
    width: 5, height: 5, borderRadius: "50%",
    background: "var(--brand-primary, var(--c-accent))",
    boxShadow: "0 0 8px var(--brand-primary, var(--c-accent))",
  },
  name: {
    margin: 0,
    fontFamily: "'Gotham', sans-serif",
    fontSize: "clamp(2rem, 3.6vw, 3rem)",
    fontWeight: 900, lineHeight: 1.05,
    letterSpacing: "-0.025em",
    textTransform: "uppercase",
    paddingBottom: "0.04em",
  },
  tagline: {
    margin: 0,
    fontFamily: "'Fraunces', Georgia, serif",
    fontStyle: "italic", fontWeight: 400,
    fontSize: "clamp(1rem, 1.3vw, 1.2rem)",
    lineHeight: 1.45,
    color: "rgba(var(--c-text-rgb),.78)",
  },

  priceRow: {
    display: "flex", alignItems: "baseline", gap: 16,
    paddingTop: 14,
  },
  price: {
    fontFamily: "'Gotham', sans-serif",
    fontSize: "clamp(2rem, 3.4vw, 2.8rem)",
    fontWeight: 900,
    color: "var(--brand-primary, var(--c-accent))",
    letterSpacing: "-0.01em",
  },
  sku: { fontSize: 11, color: "rgba(var(--c-text-rgb),.4)", fontFamily: "monospace" },

  stockRow: { marginTop: -4 },
  stockOk: {
    display: "inline-flex", alignItems: "center", gap: 8,
    fontSize: 13, color: "rgba(var(--c-accent-rgb),.95)", fontWeight: 600,
  },
  stockOkDot: {
    display: "inline-block",
    width: 8, height: 8, borderRadius: "50%",
    background: "var(--brand-primary, var(--c-accent))",
    boxShadow: "0 0 8px var(--brand-primary, var(--c-accent))",
  },
  stockOut: { fontSize: 13, color: "rgba(252,165,165,.85)", fontWeight: 600 },

  qtyRow: {
    display: "flex", alignItems: "center", gap: 14,
    paddingTop: 8,
  },
  qtyLabel: {
    fontSize: 11, fontWeight: 700, letterSpacing: ".2em",
    textTransform: "uppercase", color: "rgba(var(--c-text-rgb),.55)",
  },
  qtyControls: { display: "inline-flex", alignItems: "center", gap: 4 },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 10,
    background: "rgba(255,255,255,.05)",
    color: "inherit", border: "1px solid rgba(255,255,255,.08)",
    cursor: "pointer", fontFamily: "inherit",
    fontSize: 18, fontWeight: 700,
  },
  qtyNum: {
    minWidth: 44, textAlign: "center",
    fontSize: 16, fontWeight: 800,
  },

  cta: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 14, padding: "18px 32px",
    marginTop: 8,
    borderRadius: 999, border: "none",
    background: "linear-gradient(135deg, var(--c-accent-2) 0%, #2E8F6E 100%)",
    color: "#fff",
    fontFamily: "inherit", fontSize: 14, fontWeight: 900,
    letterSpacing: ".1em", textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: "0 18px 36px -10px rgba(46,143,110,.6), 0 0 0 1px rgba(var(--c-accent-rgb),.25)",
    transition: "transform .25s ease, box-shadow .25s ease",
  },
  ctaDisabled: {
    background: "var(--c-border)", color: "rgba(var(--c-text-rgb),.4)",
    boxShadow: "none", cursor: "not-allowed",
  },

  toast: {
    padding: "11px 16px", borderRadius: 10,
    background: "rgba(var(--c-accent-rgb),.10)",
    border: "1px solid rgba(var(--c-accent-rgb),.3)",
    color: "var(--brand-primary, var(--c-accent))",
    fontSize: 13, fontWeight: 600,
  },

  trust: {
    display: "flex", flexWrap: "wrap", gap: 10,
    marginTop: 14,
    paddingTop: 18,
    borderTop: "1px solid var(--c-border)",
  },
  trustItem: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "7px 13px", borderRadius: 999,
    background: "rgba(255,255,255,.03)",
    border: "1px solid var(--c-border)",
    fontSize: 11, color: "rgba(var(--c-text-rgb),.75)", fontWeight: 600,
  },

  // ── Editorial sections ──
  sectionHeading: {
    margin: "80px 0 24px",
    fontFamily: "'Gotham', sans-serif",
    fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
    fontWeight: 900, lineHeight: 1.1,
    letterSpacing: "-0.02em",
    textTransform: "uppercase",
  },
  sectionHeadingItalic: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontStyle: "italic", fontWeight: 400,
    textTransform: "none",
    color: "var(--brand-primary, var(--c-accent))",
    letterSpacing: "-0.005em",
  },

  longDescSection: {},
  longDesc: {
    margin: 0,
    fontSize: "clamp(1rem, 1.2vw, 1.15rem)",
    lineHeight: 1.7,
    color: "rgba(var(--c-text-rgb),.8)",
    maxWidth: 720,
    whiteSpace: "pre-line",
  },

  metaSection: {},
  metaSheet: {
    margin: 0, padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 0,
    maxWidth: 920,
    border: "1px solid var(--c-border)",
    borderRadius: 14,
    overflow: "hidden",
  },
  metaRow: {
    padding: "16px 20px",
    borderRight: "1px solid var(--c-border)",
    borderBottom: "1px solid var(--c-border)",
    display: "flex", flexDirection: "column", gap: 4,
  },
  metaKey: {
    fontSize: 10, fontWeight: 800, letterSpacing: ".22em",
    textTransform: "uppercase", color: "rgba(var(--c-text-rgb),.45)",
  },
  metaVal: {
    margin: 0,
    fontSize: 14, fontWeight: 600, color: "rgba(var(--c-text-rgb),.9)",
  },

  // ── Related ──
  relatedSection: {},
  relatedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  relatedCard: {
    display: "flex", flexDirection: "column",
    textDecoration: "none", color: "inherit",
    border: "1px solid var(--c-border)",
    borderRadius: 14, overflow: "hidden",
    background: "rgba(255,255,255,.025)",
    transition: "transform .3s ease, border-color .3s ease",
  },
  relatedImgWrap: {
    width: "100%", aspectRatio: "1 / 1",
    padding: "16%",
    background: "linear-gradient(135deg, rgba(var(--c-accent-rgb),.03), rgba(46,143,110,.05))",
    display: "grid", placeItems: "center",
  },
  relatedImg: { width: "100%", height: "100%", objectFit: "contain" },
  relatedBody: { padding: "14px 16px 18px", display: "flex", flexDirection: "column", gap: 6 },
  relatedName: { fontSize: 13, fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.005em" },
  relatedPrice: { fontSize: 14, fontWeight: 800, color: "var(--brand-primary, var(--c-accent))" },
};

// Responsive: stack en mobile (<=900px)
if (typeof window !== "undefined" && window.innerWidth <= 900) {
  S.layout.gridTemplateColumns = "1fr";
  S.gallery.position = "static";
}
