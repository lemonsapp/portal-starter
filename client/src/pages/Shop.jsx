// client/src/pages/Shop.jsx
//
// Catálogo público — REWRITE editorial 2026-05-23.
// Estilo Holistic landing: dark + mint accents, Gotham Black para
// headings, Fraunces italic para accents, cards más grandes con hover
// scale del producto, hero con eyebrow + display title.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBranding } from "../lib/branding.js";
import { useCart } from "../lib/useCart.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

// Fallback: convierte un producto plano en la forma "familia" que espera ShopCard
// (cuando el server no devuelve familias agrupadas). 1 variante = quick-add directo.
function toFamily(p) {
  return {
    group: null,
    slug: p.slug,
    name: p.name,
    short_description: p.short_description,
    category: p.category,
    meta: p.meta,
    featured: p.featured,
    primary_image: p.primary_image,
    from_price_formatted: p.price_formatted,
    variant_count: 1,
    variants: [{
      id: p.id, slug: p.slug, label: p.name,
      price_cents: p.price_cents, price_formatted: p.price_formatted,
      stock: p.stock, primary_image: p.primary_image,
    }],
  };
}

export default function Shop() {
  useBranding();
  const { addItem } = useCart();
  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [pr, cr] = await Promise.all([
          fetch(`${API}/api/shop/products?grouped=1&limit=200`),
          fetch(`${API}/api/shop/categories`),
        ]);
        if (pr.status === 404) {
          setErr("La tienda está temporalmente deshabilitada. Volvé pronto.");
          setLoading(false);
          return;
        }
        const pd = pr.ok ? await pr.json() : {};
        const cd = cr.ok ? await cr.json() : {};
        // Resiliente: usa families si el server las devuelve; si no (server viejo
        // sin soporte grouped, o respuesta {products}), arma familias en el cliente.
        let fams = pd.families;
        if (!fams || !fams.length) {
          let products = pd.products;
          if (!products) {
            const pr2 = await fetch(`${API}/api/shop/products?limit=200`);
            products = pr2.ok ? (await pr2.json()).products : [];
          }
          fams = (products || []).map(toFamily);
        }
        setFamilies(fams || []);
        setCategories(cd.categories || []);
      } catch (e) {
        setErr("No se pudo cargar el catálogo. Refrescá la página.");
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = families;
    if (activeCategory !== "all") {
      list = list.filter((f) => f.category?.slug === activeCategory);
    }
    if (searchInput.trim()) {
      const q = searchInput.trim().toLowerCase();
      list = list.filter((f) =>
        f.name.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q) ||
        (f.short_description || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [families, activeCategory, searchInput]);

  function handleAdd(e, item) {
    e.preventDefault();
    e.stopPropagation();
    addItem(item, 1);
    window.dispatchEvent(new CustomEvent("holistic-cart-open"));
  }

  return (
    <div className="theme-light" style={S.shell}>
      {/* Hero — eyebrow + display + sub + decorative line */}
      <header style={S.hero}>
        <div style={S.heroGlow} aria-hidden="true" />
        <div style={S.heroInner}>
          <div style={S.eyebrow}>
            <span style={S.eyebrowDot} />
            Fertilizantes superiores para cultivo
            <span style={S.eyebrowDot} />
          </div>
          <h1 style={S.display}>
            <span style={S.displayLine}>FERTILIZANTES</span>
            <span style={S.displayItalic}>premium</span>
            <span style={S.displayLine}>PARA CULTIVO</span>
            <span style={S.displayItalic}>indoor &amp; outdoor</span>
          </h1>
          <p style={S.heroSub}>
            Sumá los productos al carrito y pagás seguro con MercadoPago.
            <br />
            Envío en 48 hs a todo el país. Soporte humano sin cargo.
          </p>
        </div>
      </header>

      <div style={S.container}>
        {/* Filters: categories + search */}
        <div style={S.filters}>
          <div style={S.filterPills} role="tablist" aria-label="Filtrar por categoría">
            <button
              style={S.pill(activeCategory === "all")}
              onClick={() => setActiveCategory("all")}
              role="tab"
              aria-selected={activeCategory === "all"}
            >
              Todos{families.length ? ` · ${families.length}` : ""}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                style={S.pill(activeCategory === c.slug)}
                onClick={() => setActiveCategory(c.slug)}
                role="tab"
                aria-selected={activeCategory === c.slug}
              >
                {c.name}{c.product_count ? ` · ${c.product_count}` : ""}
              </button>
            ))}
          </div>
          <div style={S.searchWrap}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Buscar producto…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={S.searchInput}
            />
          </div>
        </div>

        {/* Result count line */}
        <div style={S.resultCount}>
          {loading
            ? "Cargando catálogo…"
            : err
              ? err
              : `${filtered.length} ${filtered.length === 1 ? "producto" : "productos"}`}
        </div>

        {/* Grid */}
        {!loading && !err && filtered.length === 0 && (
          <div style={S.empty}>
            No encontramos productos que coincidan.
            <br />
            <button style={S.emptyReset} onClick={() => { setActiveCategory("all"); setSearchInput(""); }}>
              Limpiar filtros
            </button>
          </div>
        )}

        {!loading && !err && filtered.length > 0 && (
          <div style={S.grid}>
            {filtered.map((f) => <ShopCard key={f.group || f.slug} family={f} onAdd={handleAdd} />)}
          </div>
        )}
      </div>

      {/* Footer signature line */}
      <div style={S.signature}>
        <span>Holistic Growshop</span>
        <span>· Nutrición Superior · Cultivo Indoor / Outdoor ·</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card de producto — hover lift + image scale + add-to-cart inline
// ─────────────────────────────────────────────────────────────────────────────
function ShopCard({ family, onAdd }) {
  const [hover, setHover] = useState(false);
  // Si la familia tiene una sola medida → quick-add directo. Si tiene varias →
  // la card lleva a la interna para elegir la medida.
  const multi = (family.variant_count || 1) > 1;
  const single = !multi && family.variants?.length ? family.variants[0] : null;
  const priceText = multi
    ? `desde ${family.from_price_formatted}`
    : (single?.price_formatted || family.from_price_formatted);

  function addSingle(e) {
    if (!single) return;
    onAdd(e, {
      id: single.id,
      slug: single.slug,
      name: family.name,
      price_cents: single.price_cents,
      primary_image: single.primary_image || family.primary_image,
      stock: single.stock,
    });
  }

  return (
    <Link
      to={`/shop/${family.slug}`}
      style={{
        ...S.card,
        transform: hover ? "translateY(-6px)" : "translateY(0)",
        borderColor: hover ? "rgba(var(--c-accent-rgb), .4)" : "var(--c-border)",
        boxShadow: hover ? "0 30px 60px -20px rgba(0,0,0,0.18), 0 0 0 1px rgba(var(--c-accent-rgb), .08)" : "none",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={`Ver ${family.name}`}
    >
      {family.featured && <span style={S.cardFeatured}>⭐ Destacado</span>}
      {multi && <span style={S.cardSizes}>{family.variant_count} medidas</span>}

      <div style={S.cardImgWrap}>
        {family.primary_image ? (
          <img
            src={family.primary_image}
            alt={family.name}
            loading="lazy"
            style={{ ...S.cardImg, transform: hover ? "scale(1.06)" : "scale(1)" }}
          />
        ) : (
          <div style={{ ...S.cardImg, background: "var(--c-surface-2)" }} />
        )}
      </div>

      <div style={S.cardBody}>
        {family.category && <span style={S.cardCat}>{family.category.name}</span>}
        <h3 style={S.cardName}>{family.name}</h3>
        {family.short_description && (
          <p style={S.cardDesc}>{family.short_description}</p>
        )}
        <div style={S.cardPriceRow}>
          <span style={S.cardPrice}>{priceText}</span>
          {single ? (
            <button
              onClick={addSingle}
              style={{ ...S.cardCta, opacity: hover ? 1 : 0.85 }}
              aria-label={`Agregar ${family.name} al carrito`}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="20" r="1.4" />
                <circle cx="18" cy="20" r="1.4" />
                <path d="M2.5 3h2.7l2.5 12.4a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
              </svg>
              <span>Sumar</span>
            </button>
          ) : (
            <span style={{ ...S.cardCta, opacity: hover ? 1 : 0.85 }}>
              <span>Elegir medida</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — namespace S
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  shell: {
    minHeight: "100vh",
    background: "var(--c-bg)",
    color: "var(--c-text)",
    fontFamily: "var(--f-body)",
    paddingBottom: "120px",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    padding: "clamp(48px, 9vh, 96px) 24px clamp(36px, 6vh, 70px)",
    textAlign: "center",
    isolation: "isolate",
    background:
      "radial-gradient(ellipse 70% 90% at 50% 0%, rgba(var(--c-accent-rgb), .12) 0%, transparent 60%)",
  },
  heroGlow: {
    position: "absolute",
    top: "-40%", left: "50%",
    transform: "translateX(-50%)",
    width: "70%",
    height: "120%",
    background: "radial-gradient(circle at 50% 30%, rgba(46,143,110,.22) 0%, transparent 60%)",
    filter: "blur(60px)",
    zIndex: -1,
  },
  heroInner: { maxWidth: 920, margin: "0 auto" },
  eyebrow: {
    display: "inline-flex", alignItems: "center", gap: 14,
    fontSize: 11, fontWeight: 700, letterSpacing: "0.32em",
    textTransform: "uppercase",
    color: "var(--c-accent)",
    marginBottom: 28,
  },
  eyebrowDot: {
    display: "inline-block",
    width: 5, height: 5, borderRadius: "50%",
    background: "var(--c-accent)",
    boxShadow: "0 0 10px var(--c-accent)",
  },
  display: {
    margin: 0,
    fontFamily: "var(--f-display)",
    fontSize: "clamp(2.6rem, 7vw, 5.6rem)",
    fontWeight: 900,
    lineHeight: 0.95,
    letterSpacing: "-0.025em",
    textTransform: "uppercase",
    paddingBottom: "0.06em",
  },
  displayLine: { display: "block" },
  displayItalic: {
    // "premium" e "indoor & outdoor" — Gotham italic (gotham-book-italic.woff2
    // cargado). Pedido del cliente: en MAYÚSCULA (textTransform uppercase).
    display: "block",
    fontFamily: "var(--f-display, 'Gotham', sans-serif)",
    fontStyle: "italic",
    fontWeight: 400,
    textTransform: "uppercase",
    fontSize: "0.78em",
    color: "var(--c-accent)",
    letterSpacing: "-0.01em",
    margin: "0.04em 0",
  },
  heroSub: {
    marginTop: 28,
    fontSize: "clamp(0.98rem, 1.25vw, 1.18rem)",
    lineHeight: 1.6,
    color: "rgba(var(--c-text-rgb), .7)",
    maxWidth: 620, marginLeft: "auto", marginRight: "auto",
  },

  container: { maxWidth: 1320, margin: "0 auto", padding: "0 24px" },

  filters: {
    position: "sticky", top: 0, zIndex: "var(--z-sticky)",
    background: "var(--c-accent)",
    backdropFilter: "blur(14px)",
    margin: "0 -24px",
    padding: "18px 24px",
    borderBottom: "none",
    display: "flex", flexWrap: "wrap", gap: 16,
    alignItems: "center", justifyContent: "space-between",
  },
  filterPills: { display: "flex", flexWrap: "wrap", gap: 8 },
  pill: (active) => ({
    padding: "9px 18px",
    borderRadius: "var(--r-pill)",
    border: active ? "1px solid #fff" : "1px solid rgba(255,255,255,.45)",
    background: active ? "#fff" : "transparent",
    color: active ? "var(--c-accent)" : "rgba(255,255,255,.92)",
    fontSize: 12, fontWeight: 700, letterSpacing: ".06em",
    cursor: "pointer", fontFamily: "inherit",
    transition: "all var(--dur-base) var(--ease-out)",
    textTransform: "uppercase",
  }),
  searchWrap: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "9px 14px",
    border: "1px solid rgba(255,255,255,.45)",
    borderRadius: "var(--r-pill)",
    background: "rgba(255,255,255,.15)",
    color: "rgba(255,255,255,.9)",
    minWidth: 200,
  },
  searchInput: {
    background: "transparent", border: "none", outline: "none",
    color: "#fff",
    fontFamily: "inherit", fontSize: 13, flex: 1,
  },

  resultCount: {
    margin: "28px 0 18px",
    fontSize: 12, fontWeight: 700, letterSpacing: ".18em",
    textTransform: "uppercase",
    color: "rgba(var(--c-text-rgb), .45)",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 24,
  },

  card: {
    position: "relative",
    display: "flex", flexDirection: "column",
    background: "var(--c-surface)",
    border: "1px solid var(--c-border)",
    borderRadius: "var(--r-4)", overflow: "hidden",
    textDecoration: "none", color: "inherit",
    cursor: "pointer",
    transition: "transform .4s var(--ease-out), border-color .4s ease, box-shadow .4s ease",
  },
  cardImgWrap: {
    width: "100%", aspectRatio: "1 / 1",
    background: "linear-gradient(135deg, rgba(var(--c-accent-rgb),.04), rgba(46,143,110,.06))",
    overflow: "hidden",
    display: "grid", placeItems: "center",
    padding: "12%",
  },
  cardImg: {
    width: "100%", height: "100%",
    objectFit: "contain",
    display: "block",
    transition: "transform .5s var(--ease-out)",
  },
  cardBody: { padding: "22px 22px 24px", display: "flex", flexDirection: "column", gap: 8, flex: 1 },
  cardCat: {
    fontSize: 10, fontWeight: 800, letterSpacing: ".24em",
    textTransform: "uppercase", color: "rgba(var(--c-accent-rgb),.85)",
    marginBottom: 4,
  },
  cardName: { fontSize: 18, fontWeight: 800, lineHeight: 1.2, margin: 0, letterSpacing: "-0.01em" },
  cardDesc: { fontSize: 13, color: "rgba(var(--c-text-rgb), .6)", lineHeight: 1.5, margin: 0, flex: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  cardPriceRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginTop: 10, paddingTop: 14,
    borderTop: "1px solid var(--c-border)",
    gap: 10,
  },
  cardPrice: {
    fontSize: 20, fontWeight: 900,
    color: "var(--c-accent)",
    letterSpacing: "-0.01em",
  },
  cardCta: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 16px",
    borderRadius: "var(--r-pill)", border: "none",
    background: "linear-gradient(135deg, var(--c-accent-2) 0%, #2E8F6E 100%)",
    color: "#fff",
    fontFamily: "inherit", fontWeight: 800, fontSize: 11,
    letterSpacing: ".06em", textTransform: "uppercase",
    cursor: "pointer",
    boxShadow: "0 8px 20px -6px rgba(46,143,110,.5)",
    transition: "opacity .25s ease, transform .2s ease",
  },
  cardFeatured: {
    position: "absolute", top: 16, right: 16, zIndex: 2,
    padding: "5px 12px", borderRadius: "var(--r-pill)",
    background: "rgba(var(--c-accent-rgb),.18)",
    color: "var(--c-accent)",
    fontSize: 10, fontWeight: 800, letterSpacing: ".18em",
    textTransform: "uppercase",
    backdropFilter: "blur(8px)",
  },
  cardSizes: {
    position: "absolute", top: 16, left: 16, zIndex: 2,
    padding: "5px 11px", borderRadius: "var(--r-pill)",
    background: "var(--c-surface)",
    border: "1px solid var(--c-border)",
    color: "rgba(var(--c-text-rgb),.72)",
    fontSize: 10, fontWeight: 800, letterSpacing: ".1em",
    textTransform: "uppercase",
  },

  empty: {
    textAlign: "center", padding: "80px 20px",
    color: "rgba(var(--c-text-rgb), .55)", fontSize: 16,
  },
  emptyReset: {
    marginTop: 16,
    padding: "10px 22px", borderRadius: "var(--r-pill)",
    background: "var(--c-accent-soft)", color: "var(--c-accent)",
    border: "1px solid rgba(var(--c-accent-rgb),.25)",
    fontFamily: "inherit", fontWeight: 700, fontSize: 12,
    letterSpacing: ".06em", textTransform: "uppercase",
    cursor: "pointer",
  },

  signature: {
    marginTop: 80,
    paddingTop: 36,
    borderTop: "1px solid var(--c-border)",
    textAlign: "center",
    fontSize: 11, fontWeight: 700, letterSpacing: ".32em",
    textTransform: "uppercase",
    color: "rgba(var(--c-text-rgb), .32)",
    display: "flex", flexDirection: "column", gap: 8,
  },
};
