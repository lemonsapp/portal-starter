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
// GSAP — reveal por scroll de las secciones (el hero ya anima solo via
// .sp-reveal; acá NO se toca). Skills: gsap-react + gsap-scrolltrigger.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import "../styles/shop-product.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

// Corrige las imágenes del producto (paths Race viejos del backend sin redeploy)
// y el fallback de packs de puntos sin imagen. Espeja la reconciliación del server.
function normalizeProduct(p) {
  if (!p) return p;
  let fixedPrimary = fixImageUrl(p.primary_image);
  let images = (p.images || []).map((im) => ({ ...im, url: fixImageUrl(im.url) }));
  // Packs / compra de puntos → SIEMPRE la moneda HOLISTIC oficial (galería +
  // destacada), ignorando la imagen de la DB. Algunos tienen un SVG diamante
  // subido a Cloudinary por el admin (URL remota que fixImageUrl no mapea).
  if (p.meta?.points_pack || p.meta?.points_custom) {
    fixedPrimary = PRODUCT_FALLBACK_IMG;
    images = [{ url: PRODUCT_FALLBACK_IMG, alt: p.name, is_primary: true }];
  }

  // Galería fija: el admin marcó "usar solo estas fotos" (meta.gallery_fixed).
  // Cuando está activo, las imágenes subidas SON la galería y no se las toca:
  // ni se inyecta la foto familia como fallback ni se completan los envases que
  // faltan por medida. Sin este guard, los bloques de abajo contaminaban
  // product.images (ej: línea Elite con 3 fotos subidas terminaba mostrando 6).
  const galleryFixed = p.meta?.gallery_fixed === true;

  // Interna de un kit de línea: la foto familia ("unificado", todos los potes
  // juntos) es sólo un FALLBACK cuando el producto no trae primaria propia.
  // Antes se forzaba SIEMPRE y pisaba la imagen que el admin sube/edita desde el
  // panel (la foto subida se guardaba pero no se mostraba en la interna). Ahora
  // el server deploya y el admin controla la imagen → su elección manda.
  const familyShot = p.meta?.bundle ? KIT_FAMILY_SHOTS[p.meta.bundle_line] : null;
  if (familyShot && !fixedPrimary && !galleryFixed) {
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
    ? (() => {
        const cleaned = (p.bundle.includes || [])
          .map((f) => ({
            ...f,
            variants: (f.variants || [])
              .filter((v) => !isStaleProduct(v.slug))
              .map((v) => ({ ...v, primary_image: fixImageUrl(v.primary_image) })),
          }))
          .filter((f) => f.variants.length > 0);
        // Unifica familias DUPLICADAS por nombre. En prod (sin redeploy del
        // server) "Race 4 — Micro + Magnesio" llega partido en 2 familias por
        // meta drifteada (etapa finalizador vs micro) → se ven "dos Race 4".
        // Las juntamos en una sola con todas sus medidas. Espeja el fix del
        // server (1680baa); cuando deploye, llega ya unificado → no-op.
        const byName = new Map();
        for (const f of cleaned) {
          const key = f.name || f.group;
          if (!byName.has(key)) {
            byName.set(key, { ...f, variants: [...f.variants] });
          } else {
            const ex = byName.get(key);
            const seen = new Set(ex.variants.map((v) => v.slug));
            for (const v of f.variants) if (!seen.has(v.slug)) ex.variants.push(v);
          }
        }
        const includes = [...byName.values()]
          .map((f) => ({ ...f, variants: f.variants.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)) }))
          // Orden estable de familias (Race 1 → Race 4).
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
        return { ...p.bundle, includes };
      })()
    : p.bundle;

  // Galería de kit COMPLETA y de UNA MISMA MEDIDA: la interna de una línea
  // muestra todos los envases que la componen. Si el backend (sin redeploy)
  // manda menos imágenes que familias+1, sumamos la foto de cada familia que
  // falte EN LA MEDIDA que ya usa la galería (los potes de 1kg se complementan
  // con potes de 1kg, no con los de 25g — pedido del cliente 2026-06-07).
  // Cuando el server nuevo deploye ya manda la galería completa → no-op.
  let galleryImages = images;
  const fams = bundle?.includes || [];
  if (!galleryFixed && p.meta?.bundle && fams.length > 0 && images.length < fams.length + 1) {
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
  // Control de galería: si la interna fija las fotos del admin o las arma por medida.
  "gallery_fixed",
  // Contenido editorial curado por el admin (beneficios, features, specs,
  // cross-sell, bundle): tiene su propia sección, no es ficha técnica cruda.
  "editorial",
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

// "Puntos a medida" (producto con meta.points_custom): el cliente elige cuántos
// puntos comprar. 1 punto = 1 unidad del producto → el carrito/checkout calculan
// el total y shopNotify acredita la cantidad. Tope alto (2000) acotado en server.
const POINTS_MIN = 1;
const POINTS_MAX = 2000;
const POINTS_PRESETS = [10, 25, 50, 100, 200, 500];
function clampPoints(n) {
  const v = Math.floor(Number(n) || 0);
  return Math.max(POINTS_MIN, Math.min(POINTS_MAX, v));
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
  // "Puntos a medida" (meta.points_custom): el cliente elige cuántos puntos.
  const [pointsQty, setPointsQty] = useState(50);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  // Medida elegida del kit (sólo productos bundle: linea-race/pro/elite).
  const [kitSel, setKitSel] = useState(null);

  // Barra de compra fija (mobile): visible sólo cuando el CTA principal
  // salió del viewport, para que precio + "Agregar" siempre estén a mano.
  const rootRef = useRef(null);
  const glowRef = useRef(null);
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
          let normalized = normalizeProduct(d.product || null);
          // Espejo client-side: producto "base" sin variantes propias (ej.
          // bio-estimulante, day-0) → le adjuntamos sus variantes-hijas por
          // medida desde la familia agrupada, así su página tiene selector de
          // medida igual que el resto. Espeja el attach del server
          // (routes/shop.js, commit 1680baa); cuando deploye, ya vienen y esto
          // no encuentra nada nuevo (la familia ya está cubierta).
          if (
            normalized && !normalized.variants?.length && !normalized.bundle &&
            !normalized.meta?.formato && !normalized.meta?.points_pack
          ) {
            try {
              const gr = await fetch(`${API}/api/shop/products?grouped=1&limit=200`).then((x) => x.json());
              const base = normalized.slug;
              const fam = (gr.families || []).find((f) =>
                (f.variants || []).some((v) => v.slug?.startsWith(`${base}-`))
              );
              if (fam?.variants?.length) {
                normalized = {
                  ...normalized,
                  variants: fam.variants
                    .filter((v) => !isStaleProduct(v.slug))
                    .map((v) => ({ ...v, primary_image: fixImageUrl(v.primary_image) })),
                };
              }
            } catch { /* sin red / sin grouped: la página queda sin selector, ok */ }
          }
          // Espejo client-side de "Sumá para acompañar": si el admin eligió los
          // productos (meta.editorial.cross_sell_slugs) los resolvemos del
          // catálogo y pisamos lo que mandó el server, así la elección se ve YA
          // sin esperar el redeploy del backend (cuando deploye, manda lo mismo).
          let csSlugs = normalized?.meta?.editorial?.cross_sell_slugs;
          // Defaults por línea en "Sumá para acompañar" (pedido cliente
          // 2026-07-02). El admin puede overridear con meta.editorial.
          // cross_sell_slugs. El self-filter de abajo evita ofrecer el propio
          // producto (ej. Race 3 PK 1ª no se ofrece a sí misma).
          const LINE_CROSS_SELL = {
            race: ["race-3-pk-1-500ml", "race-3-pk-2-500ml"],                    // Race 3 PK 1ª y 2ª parte
            pro:  ["race-4-micro-magnesio-500ml", "race-2-calcio-nitrogeno-500ml"], // Race 4 + Race 2
          };
          if (normalized && (!Array.isArray(csSlugs) || !csSlugs.length)) {
            const def = LINE_CROSS_SELL[normalized.meta?.linea];
            if (def) csSlugs = def;
          }
          if (normalized && Array.isArray(csSlugs) && csSlugs.length) {
            try {
              const cat = await fetch(`${API}/api/shop/products?limit=100`).then((x) => x.json());
              const bySlug = new Map((cat.products || []).map((p) => [p.slug, p]));
              const resolved = csSlugs
                .filter((s) => s && s !== normalized.slug && !isStaleProduct(s))
                .map((s) => bySlug.get(s))
                .filter(Boolean)
                .map((p) => ({
                  slug: p.slug,
                  name: p.name,
                  price_formatted: p.price_formatted,
                  primary_image: fixImageUrl(p.primary_image),
                }));
              if (resolved.length) normalized = { ...normalized, cross_sell: resolved };
            } catch { /* sin red: queda el cross_sell que mandó el server */ }
          }
          setProduct(normalized);
          // "También de…": si el admin eligió productos (meta.editorial.
          // related_slugs) usamos esos; si no, automático por categoría.
          const relSlugs = normalized?.meta?.editorial?.related_slugs;
          if (Array.isArray(relSlugs) && relSlugs.length) {
            fetch(`${API}/api/shop/products?limit=100`)
              .then((r) => r.json())
              .then((cat) => {
                const bySlug = new Map((cat.products || []).map((p) => [p.slug, p]));
                setRelated(
                  relSlugs
                    .filter((s) => s && s !== normalized.slug && !isStaleProduct(s))
                    .map((s) => bySlug.get(s))
                    .filter(Boolean)
                    .slice(0, 4)
                    .map(normalizeProduct)
                );
              })
              .catch(() => {});
          } else if (d.product?.category?.slug) {
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
  // Precio del pack a medida por ML: el admin puede fijar un precio propio para
  // cada medida del kit (meta.precio_por_medida = { "500ml": <centavos>, ... }).
  // Si hay uno para la medida elegida, ese es el precio (y se cobra como un solo
  // ítem "kit"); si no, cae al total = suma de las partes (comportamiento previo).
  const kitPriceMap = (product?.meta?.precio_por_medida && typeof product.meta.precio_por_medida === "object")
    ? product.meta.precio_por_medida : {};
  const kitCustomRaw = kitSel ? Number(kitPriceMap[kitSel]) : NaN;
  const kitCustomCents = Number.isFinite(kitCustomRaw) && kitCustomRaw > 0 ? Math.round(kitCustomRaw) : null;
  const kitPriceCents = kitCustomCents != null ? kitCustomCents : kitTotalCents;

  // Default al entrar: 1) la "medida destacada" que fijó el admin
  // (meta.medida_destacada), 2) la que ilustra la foto del kit, 3) la primera.
  useEffect(() => {
    if (!kitSizes.length) { setKitSel(null); return; }
    const destacada = product?.meta?.medida_destacada;
    const pinned = typeof destacada === "string" && kitSizes.find((s) => s.formato === destacada);
    if (pinned) { setKitSel(pinned.formato); return; }
    const galleryTok = (product?.images || []).map((im) => sizeTokenFromUrl(im.url)).find(Boolean);
    const match = galleryTok && kitSizes.find((s) => s.formato.toLowerCase() === galleryTok);
    setKitSel((match || kitSizes[0]).formato);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  // Al cambiar la medida del kit, la galería cambia → volvemos a la 1ra foto.
  useEffect(() => { setActiveImg(0); }, [kitSel]);

  function addToCart() {
    if (!product) return;
    if (product.meta?.points_custom) {
      const q = clampPoints(pointsQty);
      addItem(product, q);
      window.dispatchEvent(new CustomEvent("holistic-cart-open"));
      setToast(`Agregado al carrito — ${q} ${q > 1 ? "puntos" : "punto"}`);
      setTimeout(() => setToast(""), 2500);
      return;
    }
    addItem(product, Math.max(1, Number(quantity) || 1));
    window.dispatchEvent(new CustomEvent("holistic-cart-open"));
    setToast(`Agregado al carrito — ${quantity} ${quantity > 1 ? "unidades" : "unidad"}`);
    setTimeout(() => setToast(""), 2500);
  }

  // Agrega el kit en la medida elegida. Dos modos:
  //  • Precio a medida (meta.precio_por_medida[medida]): se agrega UNA línea
  //    "kit" al precio fijado por el admin (el server lo revalida al cobrar).
  //  • Sin precio a medida: se agregan las N partes como SKUs sueltos (previo).
  function addKit() {
    if (!kitParts.length) return;
    const q = Math.max(1, Number(quantity) || 1);
    if (kitCustomCents != null) {
      const heroImg = product.meta?.hero_por_medida?.[kitSel]
        || product.primary_image || product.images?.[0]?.url || null;
      addItem(
        {
          id: `${product.id}::kit::${kitSel}`,
          product_id: product.id,
          kit_formato: kitSel,
          slug: product.slug,
          name: `${product.name}${kitSelLabel ? ` · ${kitSelLabel}` : ""}`,
          price_cents: kitCustomCents,
          primary_image: heroImg,
          stock: null,
        },
        q
      );
      window.dispatchEvent(new CustomEvent("holistic-cart-open"));
      setToast(`Kit agregado — ${kitSelLabel || kitSel}`);
      setTimeout(() => setToast(""), 2500);
      return;
    }
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

  // IMPORTANTE: este hook va ANTES de los early returns (loading/err) para no
  // violar las Rules of Hooks (si no, al pasar de "cargando" a "cargado" React
  // ve más hooks que en el render anterior y crashea → queda en el skeleton).
  // Reveal por scroll de las secciones + spotlight de cursor. El hero se anima
  // solo via .sp-reveal. matchMedia respeta reduced-motion.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const secs = gsap.utils.toArray(".sp-section", rootRef.current);
      if (secs.length) {
        gsap.set(secs, { opacity: 0, y: 32 });
        ScrollTrigger.batch(secs, {
          start: "top 86%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "power2.out" }),
        });
        ScrollTrigger.refresh();
      }

      // Spotlight ambiental que sigue el cursor (sólo puntero fino).
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
  }, { scope: rootRef, dependencies: [loading], revertOnUpdate: true });

  if (loading) {
    return (
      <div className="sp-page theme-light">
        <div className="sp-container">
          <div className="sp-skel-hero" aria-hidden="true">
            <div className="sp-skel-img" />
            <div className="sp-skel-info">
              <div className="sp-skel-line" style={{ width: "35%", height: 12 }} />
              <div className="sp-skel-line" style={{ width: "80%", height: 30 }} />
              <div className="sp-skel-line" style={{ width: "55%", height: 22 }} />
              <div className="sp-skel-line" style={{ width: "100%" }} />
              <div className="sp-skel-line" style={{ width: "92%" }} />
              <div className="sp-skel-line" style={{ width: "45%", height: 44, marginTop: 8 }} />
            </div>
          </div>
        </div>
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

  // Galería fija: el admin marcó "usar solo mis fotos" (meta.gallery_fixed). En
  // ese caso la interna muestra EXACTAMENTE las fotos subidas, con la destacada
  // (is_primary) primero, y NO se inyectan fotos de las partes por medida.
  const galleryFixed = product.meta?.gallery_fixed === true;
  const adminImages = (() => {
    const list = (product.images || []).filter((i) => i && i.url);
    if (!list.length) return [];
    // Orden estable: la destacada al frente, el resto en su sort_order original.
    const primaryFirst = [...list].sort(
      (a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)
    );
    return primaryFirst.map((i) => ({
      url: i.url, alt: i.alt || product.name, is_primary: !!i.is_primary,
    }));
  })();

  // Galería del KIT reactiva a la medida elegida: foto unificada (hero) + UN
  // pote por familia EN la medida seleccionada. Apretar un chip de medida
  // recambia los potes (no acumula). Tiene prioridad sobre gallery_fixed: en un
  // kit el cliente quiere ver los envases de la medida, no fotos estáticas.
  // (Antes se volcaba todo product.images + las partes → se mezclaban medidas y
  // aparecían 6-8 fotos para una línea con 3 subidas.)
  const kitGallery = isKit
    ? (() => {
        const imgs = [];
        const seen = new Set();
        // Hero del kit: el admin puede fijar una destacada POR medida
        // (meta.hero_por_medida[formato]). Si no hay para la medida activa,
        // cae a la foto unificada del kit (product.primary_image).
        const heroByMedida = product.meta?.hero_por_medida || {};
        const hero = (kitSel && heroByMedida[kitSel]) || product.primary_image;
        if (hero) {
          imgs.push({ url: hero, alt: product.name, is_primary: true });
          seen.add(hero);
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
    : galleryFixed && adminImages.length
      ? adminImages
      : product.images?.length
        ? product.images
        : [{ url: product.primary_image, alt: product.name }].filter((i) => i.url);
  const inStock = product.stock == null || product.stock > 0;
  const isCustomPoints = !!product.meta?.points_custom;
  const customPointsTotal = product.price_cents * clampPoints(pointsQty);
  const _lk = lineKeyFor(product);
  const details = _lk ? lineDetails[_lk] : null;

  // Contenido editorial curado por el admin (meta.editorial). Cada sección que
  // el admin define pisa el default por línea de lineDetails.js; lo que deja
  // vacío cae al default (cero regresión en productos sin editar).
  const editorial = (product.meta && product.meta.editorial) || {};
  const benefits = (Array.isArray(editorial.benefits) && editorial.benefits.length)
    ? editorial.benefits
    : (details?.benefits || []);
  const features = (Array.isArray(editorial.features) && editorial.features.length)
    ? editorial.features
    : (details?.features || []);
  // Datos técnicos: si el admin cargó una lista propia {label,value}, se usa
  // esa; si no, se traducen las keys crudas de meta como hasta ahora.
  const techSpecs = (Array.isArray(editorial.specs) && editorial.specs.length)
    ? editorial.specs.filter((s) => s && s.label && s.value).map((s) => [s.label, s.value, true])
    : visibleSpecs(product.meta || {}).map(([k, v]) => [k, v, false]);

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
    <div ref={rootRef} className="sp-page theme-light">
      <div ref={glowRef} className="sp-cursor-glow" aria-hidden="true" />
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
              <span className="sp-price">{
                isCustomPoints ? formatARS(customPointsTotal)
                  : isKit ? formatARS(kitPriceCents)
                  : product.price_formatted
              }</span>
              {/* Pack con precio a medida más barato que la suma → mostramos el "antes". */}
              {isKit && kitCustomCents != null && kitTotalCents > kitCustomCents && (
                <span className="sp-price-was">{formatARS(kitTotalCents)}</span>
              )}
              {isCustomPoints
                ? <span className="sp-sku">{clampPoints(pointsQty)} puntos · {product.price_formatted} por punto</span>
                : isKit
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

            {/* Puntos a medida: el cliente elige cuántos puntos quiere */}
            {isCustomPoints ? (
              <div className="sp-field">
                <span className="sp-field-label">¿Cuántos puntos querés?</span>
                <div className="sp-pills">
                  {POINTS_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPointsQty(n)}
                      className={`sp-pill${clampPoints(pointsQty) === n ? " is-active" : ""}`}
                      aria-pressed={clampPoints(pointsQty) === n}
                    >
                      <span className="sp-pill-label">{n} pts</span>
                    </button>
                  ))}
                </div>
                <div className="sp-qty-row" style={{ marginTop: 12 }}>
                  <span className="sp-field-label">O ingresá la cantidad</span>
                  <div className="sp-qty">
                    <button className="sp-qty-btn" onClick={() => setPointsQty((q) => clampPoints(clampPoints(q) - 1))} aria-label="Restar un punto">−</button>
                    <input
                      className="sp-qty-num"
                      type="number"
                      min={POINTS_MIN}
                      max={POINTS_MAX}
                      value={pointsQty}
                      onChange={(e) => setPointsQty(e.target.value === "" ? "" : clampPoints(e.target.value))}
                      onBlur={() => setPointsQty((q) => clampPoints(q || POINTS_MIN))}
                      aria-label="Cantidad de puntos"
                      style={{ width: 72, textAlign: "center", border: "none", background: "transparent", font: "inherit" }}
                    />
                    <button className="sp-qty-btn" onClick={() => setPointsQty((q) => clampPoints(clampPoints(q) + 1))} aria-label="Sumar un punto">+</button>
                  </div>
                </div>
              </div>
            ) : inStock && (
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
          {benefits.length > 0 && (
            <section className="sp-section">
              <SectionHead pre="Por qué" em="elegirlo" />
              <div className="sp-benefits-grid">
                {benefits.map((b, i) => (
                  <div key={i} className="sp-benefit">
                    <div className="sp-benefit-title">{b.title}</div>
                    <div className="sp-benefit-body">{b.body}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Características clave */}
          {features.length > 0 && (
            <section className="sp-section">
              <SectionHead pre="Características" em="clave" />
              <div className="sp-features">
                {features.map((f, i) => (
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
          {techSpecs.length > 0 && (
            <section className="sp-section">
              <SectionHead pre="Datos" em="técnicos" />
              <dl className="sp-specs">
                {techSpecs.map(([k, v, raw], i) => (
                  <div key={`${k}-${i}`} className="sp-spec-row">
                    <dt className="sp-spec-key">{raw ? k : specLabel(k)}</dt>
                    <dd className="sp-spec-val">{raw ? v : specValue(k, v)}</dd>
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
            <span className="sp-sticky-price">{isKit ? formatARS(kitPriceCents) : product.price_formatted}</span>
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
