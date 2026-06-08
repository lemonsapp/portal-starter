// client/src/pages/ShopProduct.jsx
//
// Detalle de producto — REWRITE editorial botánico (2026-06-03).
// Light-luxury: campo crema, galería grande sticky + panel de compra,
// secciones editoriales numeradas (counter CSS), Gotham black caps +
// acentos verdes, reveal escalonado. Estilos en styles/shop-product.css
// (clases reales con media queries — reemplaza el style-object inline que
// mutaba según window.innerWidth y rompía el responsive).

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBranding } from "../lib/branding.js";
import { useCart, formatARS } from "../lib/useCart.js";
import {
  fixImageUrl, isStaleProduct, KIT_FAMILY_SHOTS, PRODUCT_FALLBACK_IMG,
  sizeTokenFromUrl, variantOfSize,
} from "../lib/shopImages.js";
import { lineDetails, lineKeyFor } from "../data/lineDetails.js";
import "../styles/shop-product.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

// Corrige las imágenes del producto (paths Race viejos del backend sin redeploy)
// y el fallback de packs de puntos sin imagen. Espeja la reconciliación del server.
function normalizeProduct(p) {
  if (!p) return p;
  let fixedPrimary = fixImageUrl(p.primary_image);
  let images = (p.images || []).map((im) => ({ ...im, url: fixImageUrl(im.url) }));

  // Interna de un kit de línea: la primaria es SIEMPRE la foto familia
  // ("unificado", todos los potes juntos). Reemplaza la entrada primaria de
  // la galería en vez de mapear por URL global (que pisaba SKUs sueltos).
  const familyShot = p.meta?.bundle ? KIT_FAMILY_SHOTS[p.meta.bundle_line] : null;
  if (familyShot && fixedPrimary !== familyShot) {
    fixedPrimary = familyShot;
    images = images.some((im) => im.is_primary)
      ? images.map((im) => (im.is_primary ? { ...im, url: familyShot, alt: p.name } : im))
      : [{ id: "family-shot", url: familyShot, alt: p.name, sort_order: -1, is_primary: true }, ...images];
  }

  // Bundle: fix de imágenes + filtrado de familias fantasma (en prod sin
  // redeploy, "incluye la línea completa" llega con los SKUs Race viejos —
  // Race 1 Vegetativo, Race 2 Floración A/B, Race 3 PK rosa. Al filtrar sus
  // variantes la familia queda vacía y se descarta entera).
  const bundle = p.bundle
    ? {
        ...p.bundle,
        includes: (p.bundle.includes || [])
          .map((f) => ({
            ...f,
            variants: (f.variants || [])
              .filter((v) => !isStaleProduct(v.slug))
              .map((v) => ({ ...v, primary_image: fixImageUrl(v.primary_image) })),
          }))
          .filter((f) => f.variants.length > 0)
          // Orden estable (Race 1 → Race 4): el backend viejo manda las
          // familias en orden de query. El server nuevo ya las ordena igual.
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es")),
      }
    : p.bundle;

  // Galería de kit COMPLETA y de UNA MISMA MEDIDA: la interna de una línea
  // muestra todos los envases que la componen. Si el backend (sin redeploy)
  // manda menos imágenes que familias+1, sumamos la foto de cada familia que
  // falte EN LA MEDIDA que ya usa la galería (los potes de 1kg se complementan
  // con potes de 1kg, no con los de 25g — pedido del cliente 2026-06-07).
  // Cuando el server nuevo deploye ya manda la galería completa → no-op.
  let galleryImages = images;
  const fams = bundle?.includes || [];
  if (p.meta?.bundle && fams.length > 0 && images.length < fams.length + 1) {
    const kitSize = images.map((im) => sizeTokenFromUrl(im.url)).find(Boolean) || null;
    const seen = new Set(images.map((im) => im.url));
    const extras = [];
    for (const fam of fams) {
      // Sin variante de esa medida (familias con formatos dispares) caemos a
      // la primera con foto; si la URL ya está en la galería, la familia ya
      // está representada (ej. tarro violeta compartido por R3 A y B) → skip.
      const v = variantOfSize(fam.variants, kitSize) || fam.variants.find((x) => x.primary_image);
      if (!v?.primary_image || seen.has(v.primary_image)) continue;
      seen.add(v.primary_image);
      extras.push({
        id: `fam-${fam.group}`, url: v.primary_image, alt: fam.name,
        sort_order: 90 + extras.length, is_primary: false,
      });
    }
    galleryImages = [...images, ...extras];
  }

  return {
    ...p,
    primary_image: fixedPrimary || (p.meta?.points_pack ? PRODUCT_FALLBACK_IMG : p.primary_image),
    images: galleryImages,
    bundle,
    variants: (p.variants || [])
      .filter((v) => !isStaleProduct(v.slug))
      .map((v) => ({ ...v, primary_image: fixImageUrl(v.primary_image) })),
    cross_sell: (p.cross_sell || [])
      .filter((c) => !isStaleProduct(c.slug))
      .map((c) => ({ ...c, primary_image: fixImageUrl(c.primary_image) })),
  };
}

// Encabezado editorial reutilizable: número (counter CSS) + título con acento.
function SectionHead({ pre, em }) {
  return (
    <div className="sp-section-head">
      <span className="sp-section-num" aria-hidden="true" />
      <h2 className="sp-section-title">
        {pre} <span className="sp-em">{em}</span>
      </h2>
      <div className="sp-section-rule" />
    </div>
  );
}

const LINE_NAMES = { race: "Race", pro: "Pro", elite: "Elite" };

// Claves de `meta` que son de control interno (no son ficha técnica del producto).
const META_HIDDEN = new Set([
  "linea", "bundle", "bundle_discount_pct", "points_pack", "variant_of",
  "family", "grupo", "group", "order", "orden",
]);
function visibleSpecs(meta) {
  return Object.entries(meta).filter(
    ([k, v]) => !META_HIDDEN.has(k) && v != null && v !== "" && !(Array.isArray(v) && v.length === 0)
  );
}

// Ficha técnica en castellano: las keys/valores de `meta` vienen crudos del
// seed ("etapa: npk", "tipo: bidon"). Estos mapas los traducen a etiquetas
// legibles; lo no mapeado se capitaliza como fallback.
const SPEC_LABELS = {
  etapa: "Etapa del cultivo",
  formato: "Formato",
  color: "Color de identificación",
  parte: "Parte",
  tipo: "Presentación",
  presentaciones: "Presentaciones disponibles",
  indoor_outdoor: "Uso",
};
const SPEC_VALUES = {
  npk: "NPK — todo el ciclo",
  estructura: "Calcio + Nitrógeno",
  pk: "PK — floración",
  micro: "Micro + Magnesio",
  enraizante: "Enraizante",
  vegetativo: "Vegetativo",
  preflora: "Pre-floración",
  floracion: "Floración",
  bidon: "Bidón profesional",
  combo: "Combo",
};
function specLabel(key) {
  return SPEC_LABELS[key] || key.replace(/_/g, " ");
}
function specValue(key, value) {
  if (key === "indoor_outdoor") return value ? "Indoor y outdoor" : "Indoor";
  if (Array.isArray(value)) return value.join(" · ");
  if (typeof value === "boolean") return value ? "Sí" : "No";
  const s = String(value);
  return SPEC_VALUES[s.toLowerCase()] || s.charAt(0).toUpperCase() + s.slice(1);
}

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
  // Medida elegida del kit (sólo productos bundle: linea-race/pro/elite).
  const [kitSel, setKitSel] = useState(null);

  // Barra de compra fija (mobile): visible sólo cuando el CTA principal
  // salió del viewport, para que precio + "Agregar" siempre estén a mano.
  const ctaRef = useRef(null);
  const [ctaInView, setCtaInView] = useState(true);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setCtaInView(entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // `loading` en deps: el CTA recién existe cuando termina la carga, así
    // el observer se re-engancha al navegar entre variantes (slug nuevo).
  }, [slug, loading]);

  // Cuando la barra fija está visible, el FAB del carrito sube para no
  // taparle el botón "Agregar" (regla CSS body.sp-has-sticky .cart-fab).
  const stickyVisible = !ctaInView && !!product && (product.stock == null || product.stock > 0);
  useEffect(() => {
    document.body.classList.toggle("sp-has-sticky", stickyVisible);
    return () => document.body.classList.remove("sp-has-sticky");
  }, [stickyVisible]);

  useEffect(() => {
    setActiveImg(0);
    setQuantity(1);
    setCtaInView(true); // evita que la barra fija (y su body class) quede colgada al navegar
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch(`${API}/api/shop/products/${encodeURIComponent(slug)}`);
        if (r.status === 404) {
          setErr("Producto no encontrado");
        } else {
          const d = await r.json();
          setProduct(normalizeProduct(d.product || null));
          if (d.product?.category?.slug) {
            fetch(`${API}/api/shop/products?category=${d.product.category.slug}&limit=8`)
              .then((r) => r.json())
              .then((rd) =>
                setRelated(
                  (rd.products || [])
                    .filter((p) => p.id !== d.product.id && !isStaleProduct(p.slug))
                    .slice(0, 4)
                    .map(normalizeProduct)
                )
              )
              .catch(() => {});
          }
        }
      } catch (e) {
        setErr("Error al cargar el producto");
      }
      setLoading(false);
    })();
  }, [slug]);

  // ── KIT por medida (bundle): el cliente elige una medida y compra TODAS las
  // partes de la línea en esa medida. Usa los SKUs individuales que ya existen.
  const bundleIncludes = product?.bundle?.includes || [];
  // Medidas disponibles del kit = unión de formatos de todas las familias.
  const kitSizes = (() => {
    const m = new Map();
    for (const f of bundleIncludes)
      for (const v of f.variants || [])
        if (v.formato && !m.has(v.formato))
          m.set(v.formato, { formato: v.formato, label: v.label, order: v.order ?? 99 });
    return [...m.values()].sort((a, b) => a.order - b.order);
  })();
  const isKit = !!product?.bundle && kitSizes.length > 0;
  // Partes del kit en la medida elegida (la variante de cada familia en esa medida).
  const kitParts = kitSel
    ? bundleIncludes.map((f) => (f.variants || []).find((v) => v.formato === kitSel)).filter(Boolean)
    : [];
  const kitTotalCents = kitParts.reduce((a, v) => a + (v.price_cents || 0), 0);
  const kitSelLabel = kitSizes.find((s) => s.formato === kitSel)?.label || "";

  // Default: la medida que ilustra la foto del kit; si no, la primera.
  useEffect(() => {
    if (!kitSizes.length) { setKitSel(null); return; }
    const galleryTok = (product?.images || []).map((im) => sizeTokenFromUrl(im.url)).find(Boolean);
    const match = galleryTok && kitSizes.find((s) => s.formato.toLowerCase() === galleryTok);
    setKitSel((match || kitSizes[0]).formato);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  // Al cambiar la medida del kit, la galería cambia → volvemos a la 1ra foto.
  useEffect(() => { setActiveImg(0); }, [kitSel]);

  function addToCart() {
    if (!product) return;
    addItem(product, Math.max(1, Number(quantity) || 1));
    window.dispatchEvent(new CustomEvent("holistic-cart-open"));
    setToast(`Agregado al carrito — ${quantity} ${quantity > 1 ? "unidades" : "unidad"}`);
    setTimeout(() => setToast(""), 2500);
  }

  // Agrega todas las partes del kit en la medida elegida (n SKUs de una).
  function addKit() {
    if (!kitParts.length) return;
    const q = Math.max(1, Number(quantity) || 1);
    kitParts.forEach((v) =>
      addItem(
        { id: v.id, slug: v.slug, name: v.name, price_cents: v.price_cents, primary_image: v.primary_image, stock: v.stock },
        q
      )
    );
    window.dispatchEvent(new CustomEvent("holistic-cart-open"));
    setToast(`Kit agregado — ${kitParts.length} productos${kitSelLabel ? ` · ${kitSelLabel}` : ""}`);
    setTimeout(() => setToast(""), 2500);
  }

  function addCross(c) {
    addItem(
      {
        id: c.id, slug: c.slug, name: c.name,
        price_cents: c.price_cents, primary_image: c.primary_image, stock: c.stock,
      },
      1
    );
    window.dispatchEvent(new CustomEvent("holistic-cart-open"));
  }

  if (loading) {
    return (
      <div className="sp-page theme-light">
        <div className="sp-container"><div className="sp-loading">Cargando…</div></div>
      </div>
    );
  }

  if (err || !product) {
    return (
      <div className="sp-page theme-light">
        <div className="sp-container">
          <Link to="/shop" className="sp-back">
            <span className="sp-back-arrow">←</span> Volver al catálogo
          </Link>
          <div className="sp-loading">{err || "Producto no encontrado"}</div>
        </div>
      </div>
    );
  }

  // Galería del KIT reactiva a la medida elegida: foto familia (unificado) +
  // cada parte en la medida seleccionada. Cambiar el selector cambia las fotos.
  const kitGallery = isKit
    ? (() => {
        const imgs = [];
        const seen = new Set();
        if (product.primary_image) {
          imgs.push({ url: product.primary_image, alt: product.name, is_primary: true });
          seen.add(product.primary_image);
        }
        for (const v of kitParts) {
          if (v.primary_image && !seen.has(v.primary_image)) {
            seen.add(v.primary_image);
            imgs.push({ url: v.primary_image, alt: v.name });
          }
        }
        return imgs;
      })()
    : [];
  const images = isKit && kitGallery.length
    ? kitGallery
    : product.images?.length
      ? product.images
      : [{ url: product.primary_image, alt: product.name }].filter((i) => i.url);
  const inStock = product.stock == null || product.stock > 0;
  const _lk = lineKeyFor(product);
  const details = _lk ? lineDetails[_lk] : null;

  // Bundle de la línea: si este producto es individual de Race/Pro/Elite,
  // ofrecemos el kit. Si ES el kit (product.bundle), mostramos qué incluye.
  const lineKey = product.meta?.linea;
  const lineBundleSlug =
    !product.bundle && ["race", "pro", "elite"].includes(lineKey) ? `linea-${lineKey}` : null;

  // Breadcrumb: Shop / Línea X (si pertenece a una) / producto actual.
  // El crumb de línea filtra el catálogo vía ?categoria= (Shop lo lee).
  const crumbLine = lineKey && LINE_NAMES[lineKey]
    ? { label: `Línea ${LINE_NAMES[lineKey]}`, to: `/shop?categoria=${lineKey}` }
    : product.category
      ? { label: product.category.name, to: "/shop" }
      : null;

  return (
    <div className="sp-page theme-light">
      <div className="sp-container">
        <nav className="sp-crumbs" aria-label="Estás en">
          <Link to="/shop" className="sp-crumb">
            <span className="sp-back-arrow">←</span> Shop
          </Link>
          {crumbLine && (
            <>
              <span className="sp-crumb-sep" aria-hidden="true">/</span>
              <Link to={crumbLine.to} className="sp-crumb">{crumbLine.label}</Link>
            </>
          )}
          <span className="sp-crumb-sep" aria-hidden="true">/</span>
          <span className="sp-crumb-current" aria-current="page">{product.name}</span>
        </nav>

        {/* ─────────────────────────── HERO ─────────────────────────── */}
        <div className="sp-hero">
          {/* GALERÍA */}
          <div className="sp-gallery sp-reveal" data-d="1">
            <div className="sp-stage">
              {images[activeImg]?.url ? (
                <img src={images[activeImg].url} alt={images[activeImg].alt || product.name} />
              ) : (
                <div className="sp-stage-empty" />
              )}
              {product.featured && <span className="sp-badge">⭐ Destacado</span>}
            </div>
            {images.length > 1 && (
              <div className="sp-thumbs">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`sp-thumb${i === activeImg ? " is-active" : ""}`}
                    aria-label={`Ver imagen ${i + 1}`}
                  >
                    <img src={img.url} alt={img.alt || ""} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PANEL DE COMPRA */}
          <div className="sp-buy sp-reveal" data-d="2">
            {product.category && (
              <div className="sp-eyebrow">{product.category.name.toUpperCase()}</div>
            )}

            <h1 className="sp-title">{product.name}</h1>

            {product.short_description && <p className="sp-tagline">{product.short_description}</p>}

            <div className="sp-pricerow">
              <span className="sp-price">{isKit ? formatARS(kitTotalCents) : product.price_formatted}</span>
              {isKit
                ? <span className="sp-sku">El kit · {kitParts.length} {kitParts.length === 1 ? "producto" : "productos"}</span>
                : (product.sku && <span className="sp-sku">SKU: {product.sku}</span>)}
            </div>

            {/* Selector de medida del KIT — comprá las N partes en esa medida */}
            {isKit && (
              <div className="sp-field">
                <span className="sp-field-label">Medida del kit</span>
                <div className="sp-pills">
                  {kitSizes.map((s) => {
                    const active = s.formato === kitSel;
                    return (
                      <button
                        key={s.formato}
                        onClick={() => setKitSel(s.formato)}
                        className={`sp-pill${active ? " is-active" : ""}`}
                        aria-pressed={active}
                        title={`Kit completo en ${s.label}`}
                      >
                        <span className="sp-pill-label">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selector de medida */}
            {product.variants?.length > 1 && (
              <div className="sp-field">
                <span className="sp-field-label">Medida</span>
                <div className="sp-pills">
                  {product.variants.map((v) => {
                    const active = v.slug === product.slug;
                    const out = v.stock != null && v.stock <= 0;
                    return (
                      <button
                        key={v.slug}
                        onClick={() => { if (!active && !out) navigate(`/shop/${v.slug}`); }}
                        className={`sp-pill${active ? " is-active" : ""}${out ? " is-out" : ""}`}
                        aria-pressed={active}
                        title={out ? "Sin stock" : `${v.label} — ${v.price_formatted}`}
                      >
                        <span className="sp-pill-label">{v.label}</span>
                        {v.price_formatted && (
                          <span className="sp-pill-price">{v.price_formatted}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="sp-stock">
              {inStock ? (
                <span className="sp-stock-ok">
                  Disponible{product.stock != null && ` · ${product.stock} en stock`}
                </span>
              ) : (
                <span className="sp-stock-out">● Sin stock por ahora</span>
              )}
            </div>

            {/* Cantidad */}
            {inStock && (
              <div className="sp-qty-row">
                <span className="sp-field-label">Cantidad</span>
                <div className="sp-qty">
                  <button className="sp-qty-btn" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Restar uno">−</button>
                  <span className="sp-qty-num">{quantity}</span>
                  <button className="sp-qty-btn" onClick={() => setQuantity((q) => Math.min(product.stock ?? 99, q + 1))} aria-label="Sumar uno">+</button>
                </div>
              </div>
            )}

            {/* CTA */}
            <button ref={ctaRef} className="sp-cta" disabled={!inStock} onClick={isKit ? addKit : addToCart} aria-label={isKit ? `Agregar el kit ${kitSelLabel} al carrito` : `Agregar ${product.name} al carrito`}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
                <path d="M2.5 3h2.7l2.5 12.4a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
              </svg>
              <span>{!inStock ? "Sin stock" : isKit ? `Agregar el kit${kitSelLabel ? ` · ${kitSelLabel}` : ""}` : "Agregar al carrito"}</span>
            </button>

            {toast && <div className="sp-toast">✓ {toast}</div>}

            {/* Confianza */}
            <div className="sp-trust">
              <span className="sp-trust-item"><span className="sp-trust-ico">🚚</span> Envío 48 hs</span>
              <span className="sp-trust-item"><span className="sp-trust-ico">💳</span> Cuotas</span>
              <span className="sp-trust-item"><span className="sp-trust-ico">🔒</span> Pago seguro MP</span>
              <span className="sp-trust-item"><span className="sp-trust-ico">♥</span> Soporte humano</span>
            </div>

            {/* Upsell al kit */}
            {lineBundleSlug && (
              <Link to={`/shop/${lineBundleSlug}`} className="sp-bundle-promo">
                <div>
                  <div className="sp-bundle-promo-title">¿Lo querés completo?</div>
                  <div className="sp-bundle-promo-body">
                    Llevá toda la línea {LINE_NAMES[lineKey]} en un kit y ahorrá vs comprar por separado.
                  </div>
                </div>
                <span className="sp-bundle-promo-cta" aria-hidden="true">Ver kit →</span>
              </Link>
            )}
          </div>
        </div>

        {/* ──────────────────── SECCIONES EDITORIALES ──────────────────── */}
        <div className="sp-sections">
          {/* Bundle: incluye la línea */}
          {product.bundle && product.bundle.includes?.length > 0 && (
            <section className="sp-section">
              <SectionHead pre="Incluye" em="la línea completa" />
              <p className="sp-savings">
                Elegí la medida arriba y llevás {kitParts.length > 0 ? `las ${kitParts.length} partes` : "todas las partes"} de la línea en una sola compra. ¿Querés sólo algunas? Entrá a cada una abajo.
              </p>
              <div className="sp-bundle-grid">
                {product.bundle.includes.map((f) => {
                  // Foto de la familia en la medida de la galería del kit
                  // (los potes de 1kg ilustrados con el render de 1kg).
                  const v0 = f.variants?.find((v) => v.formato === kitSel) || f.variants?.[0];
                  return (
                    <div key={f.group} className="sp-bundle-item">
                      <Link
                        to={v0 ? `/shop/${v0.slug}` : "/shop"}
                        className="sp-bundle-item-head"
                        aria-label={`Ver ${f.name}`}
                      >
                        {v0?.primary_image && <img src={v0.primary_image} alt={f.name} loading="lazy" />}
                        <div className="sp-bundle-item-name">{f.name}</div>
                      </Link>
                      {/* Cualquier variedad en cualquier medida, elegible desde
                          el kit (pedido del cliente 2026-06-07). */}
                      {f.variants?.length > 0 && (
                        <div className="sp-bundle-sizes" aria-label={`Medidas de ${f.name}`}>
                          {f.variants.map((v) => (
                            <Link
                              key={v.slug}
                              to={`/shop/${v.slug}`}
                              className="sp-bundle-size"
                              title={`${f.name} ${v.label}${v.price_formatted ? ` — ${v.price_formatted}` : ""}`}
                            >
                              {v.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="sp-separate">
                ¿Preferís elegir vos? <Link to="/shop">Comprar por separado →</Link>
              </p>
            </section>
          )}

          {/* Cross-sell */}
          {product.cross_sell?.length > 0 && (
            <section className="sp-section">
              <SectionHead pre="Sumá para" em="acompañar" />
              <p className="sp-hint">Productos que combinan con tu compra. No te olvides de:</p>
              <div className="sp-cross-grid">
                {product.cross_sell.map((c) => (
                  <div key={c.slug} className="sp-cross-card">
                    <Link to={`/shop/${c.slug}`} className="sp-cross-imgwrap" aria-label={`Ver ${c.name}`}>
                      {c.primary_image && <img src={c.primary_image} alt={c.name} loading="lazy" />}
                    </Link>
                    <div className="sp-cross-body">
                      <Link to={`/shop/${c.slug}`} className="sp-cross-name">{c.name}</Link>
                      <div className="sp-cross-pricerow">
                        <span className="sp-cross-price">{c.price_formatted}</span>
                        <button className="sp-cross-add" onClick={() => addCross(c)} aria-label={`Agregar ${c.name}`}>
                          + Sumar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sobre el producto */}
          {product.long_description && (
            <section className="sp-section">
              <SectionHead pre="Sobre" em="el producto" />
              <p className="sp-lead sp-lead-first">{product.long_description}</p>
            </section>
          )}

          {/* Por qué elegirlo (beneficios) */}
          {details && details.benefits.length > 0 && (
            <section className="sp-section">
              <SectionHead pre="Por qué" em="elegirlo" />
              <div className="sp-benefits-grid">
                {details.benefits.map((b, i) => (
                  <div key={i} className="sp-benefit">
                    <div className="sp-benefit-title">{b.title}</div>
                    <div className="sp-benefit-body">{b.body}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Características clave */}
          {details && details.features.length > 0 && (
            <section className="sp-section">
              <SectionHead pre="Características" em="clave" />
              <div className="sp-features">
                {details.features.map((f, i) => (
                  <div key={i} className="sp-feature">
                    <span className="sp-feature-ico">{f.emoji || "◆"}</span>
                    <div>
                      <div className="sp-feature-title">{f.title}</div>
                      <div className="sp-feature-body">{f.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Datos técnicos */}
          {product.meta && visibleSpecs(product.meta).length > 0 && (
            <section className="sp-section">
              <SectionHead pre="Datos" em="técnicos" />
              <dl className="sp-specs">
                {visibleSpecs(product.meta).map(([k, v]) => (
                  <div key={k} className="sp-spec-row">
                    <dt className="sp-spec-key">{specLabel(k)}</dt>
                    <dd className="sp-spec-val">{specValue(k, v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Relacionados */}
          {related.length > 0 && (
            <section className="sp-section">
              <SectionHead pre="También de" em={product.category?.name?.toLowerCase() || "esta línea"} />
              <div className="sp-related-grid">
                {related.map((r) => (
                  <Link key={r.id} to={`/shop/${r.slug}`} className="sp-related-card">
                    <div className="sp-related-imgwrap">
                      {r.primary_image && <img src={r.primary_image} alt={r.name} loading="lazy" />}
                    </div>
                    <div className="sp-related-body">
                      <span className="sp-related-name">{r.name}</span>
                      <span className="sp-related-price">{r.price_formatted}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Barra de compra fija (sólo mobile, ver shop-product.css). Aparece
          cuando el CTA del hero sale del viewport para no duplicarlo. */}
      {inStock && (
        <div className={`sp-sticky-buy${!ctaInView ? " is-visible" : ""}`} aria-hidden={ctaInView}>
          <div className="sp-sticky-info">
            <span className="sp-sticky-name">{product.name}{isKit && kitSelLabel ? ` · ${kitSelLabel}` : ""}</span>
            <span className="sp-sticky-price">{isKit ? formatARS(kitTotalCents) : product.price_formatted}</span>
          </div>
          <button
            className="sp-sticky-cta"
            onClick={isKit ? addKit : addToCart}
            tabIndex={ctaInView ? -1 : 0}
            aria-label={isKit ? `Agregar el kit ${kitSelLabel} al carrito` : `Agregar ${product.name} al carrito`}
          >
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}
