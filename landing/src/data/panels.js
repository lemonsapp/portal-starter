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
//     silhouette → PNG decorativo que cubre todo el panel detrás del
//                  card. Pattern del ejemplo Pre-Flora (motivos florales
//                  pastel sobre bg saturado). Re-tintado al color del
//                  producto via Pillow.
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
        // Colores del nuevo Banner.png Bio (rosa pastel con palm leaves).
        bgColor: "#f8b9d5",       // rosa pastel saturado matched al Banner
        accentColor: "#fdd9e6",   // rosa muy pastel section bg
        aspect: 1.51,             // matchea Banner.png Bio (1024x677)
        heroScale: 0.92,          // packshot 2 botellas BIO — scale moderado
        label: "BIO",
        layers: {
            base: "/img/slider-spylt/bioestimulante/base.png",
            hero: "/img/slider-spylt/bioestimulante/hero.png",
            silhouette: "/img/slider-spylt/bioestimulante/silhouette.png",
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
        // Color derivado del nuevo base "Linea PRO.png" (celeste-azul pastel)
        bgColor: "#9ad8f5",       // celeste pastel matched al nuevo base
        accentColor: "#e8f4fb",   // celeste muy claro para section bg
        aspect: 1.51,             // nuevo aspect del base Linea PRO.png (1024x677)
        heroScale: 1.10,          // packshot 4 potes — scale ajustado al nuevo aspect
        label: "PRO",
        layers: {
            // base = Linea PRO.png del pack Unificados (celeste con hojas pastel)
            base: "/img/slider-spylt/linea-pro/base.png",
            hero: "/img/slider-spylt/linea-pro/hero.png",
            // silhouette ahora apunta al Fondo.png Unificados (gradient pastel
            // multi-color que cubre todo el panel detrás del card)
            silhouette: "/img/slider-spylt/linea-pro/fondo.png",
        },
        // Sub-productos: 4 stages del ciclo. Cada uno tiene su packshot
        // individual + base decorativo. Hotspots posicionados sobre la
        // hero.png unificada (4 potes horizontales): cada uno ocupa
        // aprox 25% del ancho, centrado verticalmente sobre el pote.
        // Orden del packshot real: Enraizante / Vegetativo / Pre-Flora / Floración
        subProducts: [
            {
                slug: "enraizante",
                nombre: "ENRAIZANTE",
                tagline: "Para esquejes",
                base: "/img/slider-spylt/linea-pro/sub/enraizante/base.png",
                pote: "/img/slider-spylt/linea-pro/sub/enraizante/pote.png",
                texto: "/img/slider-spylt/linea-pro/sub/enraizante/texto.png",
                accentColor: "#f3c2de",
                hotspot: { x: 2, y: 8, w: 23, h: 84 },
            },
            {
                slug: "vegetativo",
                nombre: "VEGETATIVO",
                tagline: "Crecimiento vigoroso",
                base: "/img/slider-spylt/linea-pro/sub/vegetativo/base.png",
                pote: "/img/slider-spylt/linea-pro/sub/vegetativo/pote.png",
                texto: "/img/slider-spylt/linea-pro/sub/vegetativo/texto.png",
                accentColor: "#c7f0dd",
                hotspot: { x: 26, y: 8, w: 23, h: 84 },
            },
            {
                slug: "pre-floracion",
                nombre: "PRE-FLORACIÓN",
                tagline: "Transición",
                base: "/img/slider-spylt/linea-pro/sub/pre-floracion/base.png",
                pote: "/img/slider-spylt/linea-pro/sub/pre-floracion/pote.png",
                texto: "/img/slider-spylt/linea-pro/sub/pre-floracion/texto.png",
                accentColor: "#f0a7b1",
                hotspot: { x: 50, y: 8, w: 23, h: 84 },
            },
            {
                slug: "floracion",
                nombre: "FLORACIÓN",
                tagline: "Etapa final",
                base: "/img/slider-spylt/linea-pro/sub/floracion/base.png",
                pote: "/img/slider-spylt/linea-pro/sub/floracion/pote.png",
                texto: "/img/slider-spylt/linea-pro/sub/floracion/texto.png",
                accentColor: "#f7d6dc",
                hotspot: { x: 74, y: 8, w: 24, h: 84 },
            },
        ],
    },

    // ─── 03 · LÍNEA RACE ───────────────────────────────────────────
    // 5 bidones Race juntos (1 verde / 2 celeste / 3 violetaA /
    // 3 violetaB / 4 rosa). Hero asp 1.89.
    {
        slug: "linea-race",
        nombre: "LÍNEA RACE",
        linea: "RACE",
        route: "/linea-race",
        bgColor: "#c078e5",       // violeta del base.png Race Violeta Parte A
        accentColor: "#edd9f7",   // pastel lila claro section bg
        aspect: 1.59,             // matchea base.png Race Violeta Parte A
        heroScale: 1.10,
        label: "RACE",
        layers: {
            base: "/img/slider-spylt/linea-race/base.png",
            hero: "/img/slider-spylt/linea-race/hero.png",
            silhouette: "/img/slider-spylt/linea-race/silhouette.png",
        },
        // Sub-productos: Race son 4 fertilizantes en el packshot unificado.
        // Violeta es un kit de 2 bidones (Parte A + Parte B) tratados como
        // un único producto. El bidón.png del violeta es composite de
        // ambas partes lado a lado, y el hotspot cubre ambas regiones
        // (~37% del ancho del packshot — los 2 bidones violeta juntos).
        // Orden visual del Race Juntos.png: Verde / Celeste / Violeta (A+B) / Rosado.
        subProducts: [
            {
                slug: "verde",
                nombre: "RACE VERDE",
                tagline: "Etapa 1",
                base: "/img/slider-spylt/linea-race/sub/verde/base.png",
                pote: "/img/slider-spylt/linea-race/sub/verde/bidon.png",
                ruedas: "/img/slider-spylt/linea-race/sub/verde/ruedas.png",
                texto: "/img/slider-spylt/linea-race/sub/verde/texto.png",
                accentColor: "#c7f0dd",
                hotspot: { x: 2, y: 10, w: 18, h: 80 },
            },
            {
                slug: "celeste",
                nombre: "RACE CELESTE",
                tagline: "Etapa 2",
                base: "/img/slider-spylt/linea-race/sub/celeste/base.png",
                pote: "/img/slider-spylt/linea-race/sub/celeste/bidon.png",
                ruedas: "/img/slider-spylt/linea-race/sub/celeste/ruedas.png",
                texto: "/img/slider-spylt/linea-race/sub/celeste/texto.png",
                accentColor: "#c8eaf3",
                hotspot: { x: 21, y: 10, w: 18, h: 80 },
            },
            {
                slug: "violeta",
                nombre: "RACE VIOLETA",
                tagline: "Etapa 3 · Kit 2 partes",
                base: "/img/slider-spylt/linea-race/sub/violeta/base.png",
                pote: "/img/slider-spylt/linea-race/sub/violeta/bidon.png",
                ruedas: "/img/slider-spylt/linea-race/sub/violeta/ruedas.png",
                texto: "/img/slider-spylt/linea-race/sub/violeta/texto.png",
                accentColor: "#b49ae0",
                // Hotspot extendido cubre los 2 bidones violeta (A + B)
                hotspot: { x: 40, y: 10, w: 37, h: 80 },
            },
            {
                slug: "rosado",
                nombre: "RACE ROSADO",
                tagline: "Etapa 4",
                base: "/img/slider-spylt/linea-race/sub/rosado/base.png",
                pote: "/img/slider-spylt/linea-race/sub/rosado/bidon.png",
                ruedas: "/img/slider-spylt/linea-race/sub/rosado/ruedas.png",
                texto: "/img/slider-spylt/linea-race/sub/rosado/texto.png",
                accentColor: "#f7d6dc",
                hotspot: { x: 78, y: 10, w: 20, h: 80 },
            },
        ],
    },

    // ─── 04 · LÍNEA ELITE ──────────────────────────────────────────
    // 2 bidones premium (PART-1 + PART-2). Tonos blanco-orange editorial.
    // bg charcoal premium contrasta con el packshot claro.
    {
        slug: "linea-elite",
        nombre: "LÍNEA ELITE",
        linea: "ELITE",
        route: "/linea-elite",
        bgColor: "#bd6ee6",       // violeta del base.png Race Violeta Parte B
        accentColor: "#ecd6f8",   // pastel lila claro section bg
        aspect: 1.30,             // matchea base.png Race Violeta Parte B (darker)
        heroScale: 1.05,
        label: "ELITE",
        layers: {
            base: "/img/slider-spylt/linea-elite/base.png",
            hero: "/img/slider-spylt/linea-elite/hero.png",
            silhouette: "/img/slider-spylt/linea-elite/silhouette.png",
        },
        // Sub-productos: 2 partes del set Elite (PART 1 + PART 2).
        // El packshot unificado muestra ambas en horizontal → cada
        // hotspot ~50% del ancho.
        subProducts: [
            {
                slug: "parte-1",
                nombre: "ELITE · PART 1",
                tagline: "Base mineral",
                base: "/img/slider-spylt/linea-elite/sub/parte-1/base.png",
                pote: "/img/slider-spylt/linea-elite/sub/parte-1/pote.png",
                texto: "/img/slider-spylt/linea-elite/sub/parte-1/texto.png",
                accentColor: "#d9a86a",
                hotspot: { x: 8, y: 10, w: 40, h: 80 },
            },
            {
                slug: "parte-2",
                nombre: "ELITE · PART 2",
                tagline: "Complejo orgánico",
                base: "/img/slider-spylt/linea-elite/sub/parte-2/base.png",
                pote: "/img/slider-spylt/linea-elite/sub/parte-2/pote.png",
                texto: "/img/slider-spylt/linea-elite/sub/parte-2/texto.png",
                accentColor: "#d9a86a",
                hotspot: { x: 52, y: 10, w: 40, h: 80 },
            },
        ],
    },

    // ─── 05 · DAY 0 ────────────────────────────────────────────────
    // 2 botellitas amarillas — finalizador de cosecha.
    {
        slug: "day-0",
        nombre: "DAY 0",
        linea: "FINISHER",
        route: "/day-0",
        // Nuevo BANNER 2.png amarillo (curvas amarillas wave-like).
        bgColor: "#e6d54a",       // amarillo saturado del Banner
        accentColor: "#f5e89c",   // amarillo pastel section bg
        aspect: 1.51,             // matchea BANNER 2.png (1024x677)
        heroScale: 0.92,
        label: "DAY 0",
        layers: {
            base: "/img/slider-spylt/day-0/base.png",
            hero: "/img/slider-spylt/day-0/hero.png",
            silhouette: "/img/slider-spylt/day-0/silhouette.png",
        },
    },
];
