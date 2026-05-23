// client/src/pages/Shop.jsx
//
// Catálogo público del shop (fase 1 — Sprint 14, 2026-05-23). Sin auth
// requerido para browse. El botón "Agregar al carrito" queda preparado
// pero la lógica del carrito real (localStorage + MercadoPago) llega en
// fase 2.
//
// Rutas:
//   /shop               → este componente (grid + filtros)
//   /shop/:slug         → ShopProduct.jsx (detalle)
//
// Feature flag features.shop: si está OFF, /api/shop devuelve 404 →
// el catálogo muestra estado vacío con mensaje.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBranding } from "../lib/branding.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

const styles = {
  shell: {
    minHeight: "100vh",
    background: "var(--brand-bg, #080808)",
    color: "var(--brand-text, #ede9e0)",
    fontFamily: "var(--brand-font, 'Gotham', system-ui, sans-serif)",
    padding: "48px 20px 80px",
  },
  container: { maxWidth: 1240, margin: "0 auto" },
  header: { textAlign: "center", marginBottom: 40 },
  eyebrow: {
    fontSize: 12, fontWeight: 700, letterSpacing: "0.32em",
    textTransform: "uppercase", color: "var(--brand-primary, #A7F5C8)",
    marginBottom: 14,
  },
  h1: {
    fontFamily: "'Gotham', sans-serif",
    fontSize: "clamp(2.4rem, 5vw, 3.6rem)", fontWeight: 900,
    margin: "0 0 14px", letterSpacing: "-0.02em", lineHeight: 1.05,
    textTransform: "uppercase",
  },
  sub: {
    maxWidth: 620, margin: "0 auto",
    fontSize: "clamp(0.98rem, 1.2vw, 1.1rem)",
    lineHeight: 1.55, color: "rgba(237,233,224,.7)",
  },
  filters: {
    display: "flex", flexWrap: "wrap", justifyContent: "center",
    gap: 8, margin: "32px 0 40px",
  },
  pill: (active) => ({
    padding: "9px 18px", borderRadius: 999,
    border: active
      ? "1px solid var(--brand-primary, #A7F5C8)"
      : "1px solid rgba(237,233,224,.15)",
    background: active ? "rgba(167, 245, 200, 0.12)" : "transparent",
    color: active ? "var(--brand-primary, #A7F5C8)" : "rgba(237,233,224,.7)",
    fontSize: 13, fontWeight: 600, letterSpacing: ".04em",
    cursor: "pointer", fontFamily: "inherit",
    transition: "background .25s ease, border-color .25s ease, color .25s ease",
  }),
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 22,
  },
  card: {
    display: "flex", flexDirection: "column",
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 14, overflow: "hidden",
    textDecoration: "none", color: "inherit",
    transition: "transform .35s cubic-bezier(.2,.8,.2,1), border-color .35s ease, box-shadow .35s ease",
    cursor: "pointer",
  },
  cardImg: {
    width: "100%", aspectRatio: "1 / 1",
    objectFit: "contain", padding: 28,
    background: "rgba(255,255,255,.02)",
    display: "block",
  },
  cardBody: { padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 6, flex: 1 },
  cardCat: {
    fontSize: 10, fontWeight: 700, letterSpacing: ".22em",
    textTransform: "uppercase", color: "rgba(167,245,200,.85)",
  },
  cardName: { fontSize: 17, fontWeight: 700, lineHeight: 1.2, margin: 0 },
  cardDesc: { fontSize: 13, color: "rgba(237,233,224,.65)", lineHeight: 1.5, margin: 0, flex: 1 },
  cardPrice: { fontSize: 19, fontWeight: 800, marginTop: 8, color: "var(--brand-primary, #A7F5C8)" },
  cardFeatured: {
    position: "absolute", top: 12, right: 12,
    padding: "4px 10px", borderRadius: 999,
    background: "rgba(167,245,200,.18)",
    color: "var(--brand-primary, #A7F5C8)",
    fontSize: 10, fontWeight: 700, letterSpacing: ".18em",
    textTransform: "uppercase",
  },
  empty: {
    textAlign: "center", padding: "80px 20px",
    color: "rgba(237,233,224,.55)", fontSize: 15,
  },
};

export default function Shop() {
  useBranding();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [pr, cr] = await Promise.all([
          fetch(`${API}/api/shop/products?limit=100`),
          fetch(`${API}/api/shop/categories`),
        ]);
        if (pr.status === 404) {
          // feature flag OFF
          setErr("La tienda está temporalmente deshabilitada. Volvé pronto.");
          setLoading(false);
          return;
        }
        const pd = await pr.json();
        const cd = await cr.json();
        setProducts(pd.products || []);
        setCategories(cd.categories || []);
      } catch (e) {
        setErr("No se pudo cargar el catálogo. Refrescá la página.");
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return products;
    return products.filter((p) => p.category?.slug === activeCategory);
  }, [products, activeCategory]);

  return (
    <div style={styles.shell}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.eyebrow}>· Catálogo Holistic ·</div>
          <h1 style={styles.h1}>Fertilizantes para cultivo indoor y outdoor</h1>
          <p style={styles.sub}>
            Sumá los productos al carrito y pagás seguro. Envío en 48 hs a todo el país.
            Soporte técnico humano sin cargo: ingenieros agrónomos y cultivadores
            del equipo Holistic.
          </p>
        </header>

        {categories.length > 0 && (
          <div style={styles.filters} role="tablist" aria-label="Filtrar por categoría">
            <button
              style={styles.pill(activeCategory === "all")}
              onClick={() => setActiveCategory("all")}
              role="tab"
              aria-selected={activeCategory === "all"}
            >
              Todos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                style={styles.pill(activeCategory === c.slug)}
                onClick={() => setActiveCategory(c.slug)}
                role="tab"
                aria-selected={activeCategory === c.slug}
              >
                {c.name}{c.product_count ? ` · ${c.product_count}` : ""}
              </button>
            ))}
          </div>
        )}

        {loading && <div style={styles.empty}>Cargando catálogo…</div>}

        {!loading && err && <div style={styles.empty}>{err}</div>}

        {!loading && !err && filtered.length === 0 && (
          <div style={styles.empty}>
            No hay productos en esta categoría todavía.
          </div>
        )}

        {!loading && !err && filtered.length > 0 && (
          <div style={styles.grid}>
            {filtered.map((p) => <ShopCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ShopCard({ product }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={`/shop/${product.slug}`}
      style={{
        ...styles.card,
        position: "relative",
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        borderColor: hover ? "rgba(167,245,200,.35)" : "rgba(255,255,255,.07)",
        boxShadow: hover ? "0 18px 48px rgba(0,0,0,0.35)" : "none",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`Ver ${product.name}`}
    >
      {product.featured && <span style={styles.cardFeatured}>⭐ Destacado</span>}
      {product.primary_image ? (
        <img src={product.primary_image} alt={product.name} style={styles.cardImg} loading="lazy" />
      ) : (
        <div style={{ ...styles.cardImg, background: "rgba(255,255,255,.04)" }} />
      )}
      <div style={styles.cardBody}>
        {product.category && <span style={styles.cardCat}>{product.category.name}</span>}
        <h3 style={styles.cardName}>{product.name}</h3>
        {product.short_description && (
          <p style={styles.cardDesc}>{product.short_description}</p>
        )}
        <div style={styles.cardPrice}>{product.price_formatted}</div>
      </div>
    </Link>
  );
}
