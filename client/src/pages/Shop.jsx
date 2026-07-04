// client/src/pages/Shop.jsx
//
// Catálogo público — REWRITE editorial botánico (2026-06-03).
// Mismo lenguaje que la interna: campo crema, Gotham black mayúscula +
// acentos verdes, hero editorial, filtros sticky claros, grid de cards con
// hover lift + zoom de imagen. Estilos en styles/shop-catalog.css (clases
// reales — reemplaza el style-object inline).

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useBranding } from "../lib/branding.js";
import { useCart } from "../lib/useCart.js";
import { fixImageUrl, isStaleProduct, PRODUCT_FALLBACK_IMG } from "../lib/shopImages.js";
// Animaciones GSAP — skills: gsap-react (useGSAP + scope + cleanup) y
// gsap-scrolltrigger (reveal por scroll). matchMedia respeta reduced-motion.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import "../styles/shop-catalog.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

// Tilt 3D + spotlight sólo con puntero fino y sin reduced-motion (no en touch).
const CAN_TILT = typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Normaliza las imágenes de una familia: corrige paths Race viejos del backend
// y, si un pack de puntos no trae imagen (backend sin redeploy), usa el SVG.
function normalizeFamily(f) {
  // Packs/compra de puntos → SIEMPRE la moneda HOLISTIC oficial, sin importar
  // qué imagen tengan en la DB. Algunos tienen un SVG diamante subido a
  // Cloudinary por el admin (URL remota que no matchea fixImageUrl), por eso
  // hay que forzarla por el flag y no por el path.
  const isPoints = f.meta?.points_pack || f.meta?.points_custom;
  const primary = isPoints ? PRODUCT_FALLBACK_IMG : (fixImageUrl(f.primary_image) || f.primary_image);
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
  const rootRef = useRef(null);
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
        // Oculta los SKUs Race fantasma del esquema viejo (backend sin
        // redeploy todavía los devuelve) y descarta familias que queden vacías.
        const visible = (fams || [])
          .map((f) => ({
            ...f,
            variants: (f.variants || []).filter((v) => !isStaleProduct(v.slug)),
          }))
          .filter((f) => !isStaleProduct(f.slug) && (f.variants || []).length > 0);
        setFamilies(visible.map(normalizeFamily));
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

  // Hero: entrada coreografiada + un "glitch in" del título. Spotlight que
  // sigue el cursor (gsap.quickTo). Todo bajo matchMedia → reduced-motion no
  // corre nada y el glow no se muestra.
  const glowRef = useRef(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .from(".cat-eyebrow", { y: 16, opacity: 0, duration: 0.5 })
        .from(".cat-display", { y: 26, opacity: 0, duration: 0.7 }, "-=0.28")
        // glitch: jitter rápido de skew/x al asentar el título
        .to(".cat-display", { keyframes: [
          { x: -2, skewX: 3, duration: 0.05 },
          { x: 2, skewX: -3, duration: 0.05 },
          { x: -1, skewX: 1.5, duration: 0.05 },
          { x: 0, skewX: 0, duration: 0.06 },
        ], ease: "none" }, "-=0.15")
        .from(".cat-sub", { y: 16, opacity: 0, duration: 0.6 }, "-=0.3");

      // Spotlight de cursor sólo en dispositivos con puntero fino.
      if (glowRef.current && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        const xTo = gsap.quickTo(glowRef.current, "x", { duration: 0.5, ease: "power3" });
        const yTo = gsap.quickTo(glowRef.current, "y", { duration: 0.5, ease: "power3" });
        const move = (e) => { xTo(e.clientX); yTo(e.clientY); gsap.to(glowRef.current, { opacity: 1, duration: 0.4, overwrite: "auto" }); };
        const leave = () => gsap.to(glowRef.current, { opacity: 0, duration: 0.4, overwrite: "auto" });
        window.addEventListener("pointermove", move, { passive: true });
        window.addEventListener("pointerleave", leave);
        return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerleave", leave); };
      }
    });
  }, { scope: rootRef });

  // Cards: reveal escalonado al entrar en viewport (ScrollTrigger.batch).
  // Anima --rty (custom prop), NO el transform → convive con el tilt 3D y el
  // hover-lift (--ty). Re-stagger al cambiar de categoría o al cargar; NO en
  // cada tecla del buscador (searchInput fuera de deps) para evitar jank.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const cards = gsap.utils.toArray(".cat-card", rootRef.current);
      if (!cards.length) return;
      gsap.set(cards, { opacity: 0, "--rty": "30px" });
      ScrollTrigger.batch(cards, {
        start: "top 90%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, "--rty": "0px", duration: 0.55, stagger: 0.06, ease: "power2.out" }),
      });
      ScrollTrigger.refresh();
    });
  }, { scope: rootRef, dependencies: [loading, activeCategory], revertOnUpdate: true });

  return (
    <div ref={rootRef} className="cat-page theme-light">
      {/* Spotlight ambiental que sigue el cursor (GSAP lo posiciona) */}
      <div ref={glowRef} className="cat-cursor-glow" aria-hidden="true" />

      {/* Hero editorial */}
      <header className="cat-hero">
        <div className="cat-hero-inner">
          <div className="cat-eyebrow">Fertilizantes superiores para cultivo</div>
          <h1 className="cat-display">
            Fertilizantes
            <span className="cat-em">de precisión</span>
            para cultivo
            <span className="cat-em">indoor &amp; outdoor</span>
          </h1>
          <p className="cat-sub">
            Sumá los productos al carrito y pagás seguro con MercadoPago.
            Despachamos en 24 hs. Con soporte humano sin cargo.
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

        {/* Skeletons mientras carga el catálogo */}
        {loading && (
          <div className="cat-grid" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="cat-skel">
                <div className="cat-skel__img" />
                <div className="cat-skel__body">
                  <div className="cat-skel__line" style={{ width: "40%" }} />
                  <div className="cat-skel__line" style={{ width: "85%" }} />
                  <div className="cat-skel__line" style={{ width: "60%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

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
        <span>Holistic</span>
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
  // Los kits "sistema completo" (bundle) se arman por medida en la interna, así
  // que en el catálogo muestran "desde …" y mandan a elegir medida (no quick-add
  // a precio fijo), igual que las familias multi-medida.
  const isBundle = !!family.meta?.bundle;
  const multi = isBundle || (family.variant_count || 1) > 1;
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

  // Tilt 3D + posición del spotlight interno (vars CSS). Sólo puntero fino.
  function handleTilt(e) {
    if (!CAN_TILT) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;   // 0..1
    const py = (e.clientY - r.top) / r.height;   // 0..1
    const MAX = 4;                               // grados de inclinación
    el.style.setProperty("--ry", `${(px - 0.5) * 2 * MAX}deg`);
    el.style.setProperty("--rx", `${-(py - 0.5) * 2 * MAX}deg`);
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
    if (!el.classList.contains("is-tilting")) el.classList.add("is-tilting");
  }
  function resetTilt(e) {
    const el = e.currentTarget;
    el.classList.remove("is-tilting");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <Link to={`/shop/${family.slug}`} className="cat-card" aria-label={`Ver ${family.name}`}
      onMouseMove={handleTilt} onMouseLeave={resetTilt}>
      {family.featured && <span className="cat-badge cat-badge-featured">⭐ Destacado</span>}
      {(family.variant_count || 1) > 1 && <span className="cat-badge cat-badge-sizes">{family.variant_count} medidas</span>}

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
