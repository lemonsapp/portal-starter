// panels.js — 5 panels SPYLT-style del slider home (post VideoHero).
//
// Reducido de 9 (sub-SKUs Pro+Race separados) a 5 LÍNEAS principales
// del catálogo, en este orden canónico definido por el cliente:
//   01 BIOESTIMULANTE
//   02 LÍNEA PRO       (4 potes 100gr unificados como hero)
//   03 LÍNEA RACE      (5 bidones juntos como hero)
//   04 LÍNEA ELITE     (PART-1 + PART-2 juntos)
//   05 DAY 0           (finalizador de cosecha)
//
// Estructura por panel:
//   slug         → folder en /img/slider-spylt/
//   nombre       → caption visible (debajo del card)
//   linea        → tag pequeño arriba del card
//   route        → href del CTA (apunta al producto/categoría)
//   bgColor      → fallback bg cuando el card no cubre 100% del panel +
//                  bg del .psl__card cuando NO hay base.png
//   accentColor  → color pastel para bg de la sección (cross-fade entre
//                  panels via gsap.utils.interpolate scroll-driven)
//   aspect       → aspect-ratio del card. Para los 5 nuevos lo derivo del
//                  hero.png (los packshots tienen aspect propio).
//   heroScale    → multiplier del scale CSS sobre .psl__layer--hero.
//                  Calibrado per-panel para normalizar visible-height.
//   label        → texto editorial grande encima del card.
//   layers:
//     base       → OPCIONAL. Si no existe, el card se renderea con
//                  bgColor solid (fallback en .psl__card background).
//     hero       → packshot del producto (PNG transparente).
//     wheels     → array opcional de ruedas (solo Race original tenía).
export const panels = [
    // ─── 01 · BIOESTIMULANTE ───────────────────────────────────────
    // 2 botellas pastel (teal + rosa) con sticker BIO-ESTIMULANTE.
    // Color del panel: lila pastel matching el sticker color.
    {
        slug: "bioestimulante",
        nombre: "BIOESTIMULANTE",
        linea: "HOLISTIC",
        route: "/bio-estimulante",
        bgColor: "#B8A4D9",       // lila pastel
        accentColor: "#E5DCF0",   // lila más claro para section bg
        aspect: 1.0,              // hero 1200x1200
        heroScale: 0.92,          // packshot ya llena el card cuadrado
        label: "BIO",
        layers: {
            hero: "/img/slider-spylt/bioestimulante/hero.png",
        },
    },

    // ─── 02 · LÍNEA PRO ────────────────────────────────────────────
    // 4 potes Holistic Pro alineados (Vegetativo / Pre-Floración /
    // Floración / Enraizante). Hero canvas WIDE (3.52:1).
    {
        slug: "linea-pro",
        nombre: "LÍNEA PRO",
        linea: "PRO",
        route: "/linea-pro",
        bgColor: "#2E8F6E",       // verde Holistic
        accentColor: "#C7F0DD",
        aspect: 1.66,             // card más estándar — hero ultra-wide cabe centrado
        heroScale: 1.20,          // hero wide → scale moderado
        label: "PRO",
        layers: {
            hero: "/img/slider-spylt/linea-pro/hero.png",
        },
    },

    // ─── 03 · LÍNEA RACE ───────────────────────────────────────────
    // 5 bidones Race juntos (1 verde / 2 celeste / 3 violetaA /
    // 3 violetaB / 4 rosa). Hero asp 1.89.
    {
        slug: "linea-race",
        nombre: "LÍNEA RACE",
        linea: "RACE",
        route: "/linea-race",
        bgColor: "#6B3BAF",       // violeta Race (color líder del set)
        accentColor: "#B49AE0",
        aspect: 1.66,
        heroScale: 1.18,
        label: "RACE",
        layers: {
            hero: "/img/slider-spylt/linea-race/hero.png",
        },
    },

    // ─── 04 · LÍNEA ELITE ──────────────────────────────────────────
    // 2 bidones premium (PART-1 + PART-2). Tonos blanco-orange editorial.
    // bg charcoal premium contrasta con el packshot claro.
    {
        slug: "linea-elite",
        nombre: "LÍNEA ELITE",
        linea: "ELITE",
        route: "/linea-elite",
        bgColor: "#1F1A14",       // charcoal warm premium
        accentColor: "#D9A86A",   // gold/orange Elite
        aspect: 1.0,              // hero 1200x1200
        heroScale: 0.95,
        label: "ELITE",
        layers: {
            hero: "/img/slider-spylt/linea-elite/hero.png",
        },
    },

    // ─── 05 · DAY 0 ────────────────────────────────────────────────
    // 2 botellitas amarillas — finalizador de cosecha.
    {
        slug: "day-0",
        nombre: "DAY 0",
        linea: "FINISHER",
        route: "/day-0",
        bgColor: "#F4D03F",       // amarillo Day-0
        accentColor: "#FBE89C",
        aspect: 1.0,
        heroScale: 0.92,
        label: "DAY 0",
        layers: {
            hero: "/img/slider-spylt/day-0/hero.png",
        },
    },
];
