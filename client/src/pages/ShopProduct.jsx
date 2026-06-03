// client/src/pages/ShopProduct.jsx
//
// Detalle de producto — REWRITE editorial botánico (2026-06-03).
// Light-luxury: campo crema, galería grande sticky + panel de compra,
// secciones editoriales numeradas (counter CSS), Gotham black caps +
// acentos verdes, reveal escalonado. Estilos en styles/shop-product.css
// (clases reales con media queries — reemplaza el style-object inline que
// mutaba según window.innerWidth y rompía el responsive).

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBranding } from "../lib/branding.js";
import { useCart } from "../lib/useCart.js";
import { fixImageUrl, PRODUCT_FALLBACK_IMG } from "../lib/shopImages.js";
import { lineDetails, lineKeyFor } from "../data/lineDetails.js";
import "../styles/shop-product.css";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

// Corrige las imágenes del producto (paths Race viejos del backend sin redeploy)
// y el fallback de packs de puntos sin imagen. Espeja la reconciliación del server.
function normalizeProduct(p) {
  if (!p) return p;
  const fixedPrimary = fixImageUrl(p.primary_image);
  return {
    ...p,
    primary_image: fixedPrimary || (p.meta?.points_pack ? PRODUCT_FALLBACK_IMG : p.primary_image),
    images: (p.images || []).map((im) => ({ ...im, url: fixImageUrl(im.url) })),
    variants: (p.variants || []).map((v) => ({ ...v, primary_image: fixImageUrl(v.primary_image) })),
    cross_sell: (p.cross_sell || []).map((c) => ({ ...c, primary_image: fixImageUrl(c.primary_image) })),
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
          setProduct(normalizeProduct(d.product || null));
          if (d.product?.category?.slug) {
            fetch(`${API}/api/shop/products?category=${d.product.category.slug}&limit=8`)
              .then((r) => r.json())
              .then((rd) =>
                setRelated(
                  (rd.products || [])
                    .filter((p) => p.id !== d.product.id)
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

  function addToCart() {
    if (!product) return;
    addItem(product, Math.max(1, Number(quantity) || 1));
    window.dispatchEvent(new CustomEvent("holistic-cart-open"));
    setToast(`Agregado al carrito — ${quantity} ${quantity > 1 ? "unidades" : "unidad"}`);
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

  const images = product.images?.length
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

  return (
    <div className="sp-page theme-light">
      <div className="sp-container">
        <Link to="/shop" className="sp-back">
          <span className="sp-back-arrow">←</span> Volver al catálogo
        </Link>

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
              <span className="sp-price">{product.price_formatted}</span>
              {product.sku && <span className="sp-sku">SKU: {product.sku}</span>}
            </div>

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
                        title={out ? "Sin stock" : v.label}
                      >
                        {v.label}
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
            <button className="sp-cta" disabled={!inStock} onClick={addToCart} aria-label={`Agregar ${product.name} al carrito`}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
                <path d="M2.5 3h2.7l2.5 12.4a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
              </svg>
              <span>{inStock ? "Agregar al carrito" : "Sin stock"}</span>
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
              {product.bundle.discount_pct > 0 && (
                <p className="sp-savings">
                  Comprándolo junto ahorrás ~{product.bundle.discount_pct}% vs comprar cada producto por separado.
                </p>
              )}
              <div className="sp-bundle-grid">
                {product.bundle.includes.map((f) => {
                  const v0 = f.variants?.[0];
                  return (
                    <Link key={f.group} to={v0 ? `/shop/${v0.slug}` : "/shop"} className="sp-bundle-item">
                      {v0?.primary_image && <img src={v0.primary_image} alt={f.name} loading="lazy" />}
                      <div>
                        <div className="sp-bundle-item-name">{f.name}</div>
                        <div className="sp-bundle-item-meta">
                          {f.variants.length > 1 ? `${f.variants.length} medidas` : v0?.label}
                        </div>
                      </div>
                    </Link>
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
                    <dt className="sp-spec-key">{k.replace(/_/g, " ")}</dt>
                    <dd className="sp-spec-val">{Array.isArray(v) ? v.join(" · ") : String(v)}</dd>
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
    </div>
  );
}
