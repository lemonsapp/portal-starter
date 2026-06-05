// client/src/pages/Shop.jsx
//
// Catálogo público — REWRITE editorial botánico (2026-06-03).
// Mismo lenguaje que la interna: campo crema, Gotham black mayúscula +
// acentos verdes, hero editorial, filtros sticky claros, grid de cards con
// hover lift + zoom de imagen. Estilos en styles/shop-catalog.css (clases
// reales — reemplaza el style-object inline).

import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useBranding } from "../lib/branding.js";
import { useCart } from "../lib/useCart.js";
import { fixImageUrl, PRODUCT_FALLBACK_IMG } from "../lib/shopImages.js";
import "../styles/shop-catalog.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

// Normaliza las imágenes de una familia: corrige paths Race viejos del backend
// y, si un pack de puntos no trae imagen (backend sin redeploy), usa el SVG.
function normalizeFamily(f) {
  const fixed = fixImageUrl(f.primary_image);
  const primary = fixed || (f.meta?.points_pack ? PRODUCT_FALLBACK_IMG : f.primary_image);
  return {
    ...f,
    primary_image: primary,
    variants: (f.variants || []).map((v) => ({ ...v, primary_image: fixImageUrl(v.primary_image) })),
  };
}

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

// ?categoria= viene de los CTAs de las internas (landing y portal) y del
// breadcrumb de ShopProduct. Se traduce a un término de búsqueda que matchea
// nombre/slug de las familias de esa línea.
const CATEGORIA_QUERY = {
  race: "race",
  pro: "pro",
  elite: "elite",
  bio: "bio",
  day0: "day-0",
  cloner: "cloner",
};

export default function Shop() {
  useBranding();
  const { addItem } = useCart();
  const [searchParams] = useSearchParams();
  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("q") || CATEGORIA_QUERY[searchParams.get("categoria")] || ""
  );

  // Si cambia la URL sin remount (ej. segundo click en un breadcrumb de
  // línea), re-sincroniza el buscador con los params.
  useEffect(() => {
    const next = searchParams.get("q") || CATEGORIA_QUERY[searchParams.get("categoria")] || "";
    if (next) setSearchInput(next);
  }, [searchParams]);

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
        setFamilies((fams || []).map(normalizeFamily));
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
    <div className="cat-page theme-light">
      {/* Hero editorial */}
      <header className="cat-hero">
        <div className="cat-hero-inner cat-reveal">
          <div className="cat-eyebrow">Fertilizantes superiores para cultivo</div>
          <h1 className="cat-display">
            Fertilizantes
            <span className="cat-em">premium</span>
            para cultivo
            <span className="cat-em">indoor &amp; outdoor</span>
          </h1>
          <p className="cat-sub">
            Sumá los productos al carrito y pagás seguro con MercadoPago.
            Envío en 48 hs a todo el país, con soporte humano sin cargo.
          </p>
        </div>
      </header>

      <div className="cat-container">
        {/* Filtros: categorías + búsqueda */}
        <div className="cat-filters">
          <div className="cat-pills" role="tablist" aria-label="Filtrar por categoría">
            <button
              className={`cat-pill${activeCategory === "all" ? " is-active" : ""}`}
              onClick={() => setActiveCategory("all")}
              role="tab"
              aria-selected={activeCategory === "all"}
            >
              Todos{families.length ? ` · ${families.length}` : ""}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`cat-pill${activeCategory === c.slug ? " is-active" : ""}`}
                onClick={() => setActiveCategory(c.slug)}
                role="tab"
                aria-selected={activeCategory === c.slug}
              >
                {c.name}{c.product_count ? ` · ${c.product_count}` : ""}
              </button>
            ))}
          </div>
          <div className="cat-search">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Buscar producto…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="cat-count">
          {loading
            ? "Cargando catálogo…"
            : err
              ? err
              : `${filtered.length} ${filtered.length === 1 ? "producto" : "productos"}`}
        </div>

        {/* Estado vacío */}
        {!loading && !err && filtered.length === 0 && (
          <div className="cat-empty">
            No encontramos productos que coincidan.
            <br />
            <button className="cat-empty-reset" onClick={() => { setActiveCategory("all"); setSearchInput(""); }}>
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && !err && filtered.length > 0 && (
          <div className="cat-grid">
            {filtered.map((f) => <ShopCard key={f.group || f.slug} family={f} onAdd={handleAdd} />)}
          </div>
        )}
      </div>

      {/* Firma del footer */}
      <div className="cat-signature">
        <span>Holistic Growshop</span>
        <span>· Nutrición Superior · Cultivo Indoor / Outdoor ·</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card de producto — hover lift + image scale + add-to-cart inline (CSS)
// ─────────────────────────────────────────────────────────────────────────────
function ShopCard({ family, onAdd }) {
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
    <Link to={`/shop/${family.slug}`} className="cat-card" aria-label={`Ver ${family.name}`}>
      {family.featured && <span className="cat-badge cat-badge-featured">⭐ Destacado</span>}
      {multi && <span className="cat-badge cat-badge-sizes">{family.variant_count} medidas</span>}

      <div className="cat-card-imgwrap">
        {family.primary_image ? (
          <img src={family.primary_image} alt={family.name} loading="lazy" />
        ) : (
          <div className="cat-card-empty" />
        )}
      </div>

      <div className="cat-card-body">
        {family.category && <span className="cat-card-cat">{family.category.name}</span>}
        <h3 className="cat-card-name">{family.name}</h3>
        {family.short_description && <p className="cat-card-desc">{family.short_description}</p>}
        <div className="cat-card-pricerow">
          <span className="cat-card-price">{priceText}</span>
          {single ? (
            <button onClick={addSingle} className="cat-card-cta" aria-label={`Agregar ${family.name} al carrito`}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
                <path d="M2.5 3h2.7l2.5 12.4a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
              </svg>
              <span>Sumar</span>
            </button>
          ) : (
            <span className="cat-card-cta">
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
