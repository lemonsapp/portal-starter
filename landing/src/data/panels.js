// panels.js — 3 panels SPYLT-style del slider home (post VideoHero).
//
// Orden canónico (re-ordenado 2026-05-17 por pedido del cliente —
// sólo las 3 líneas estrella; los 2 complementos BIO y DAY-0 viven
// ahora en su propia sección <ComplementosIdeales /> abajo del slider):
//   01 LÍNEA ELITE         (PART-1 + PART-2 juntos)
//   02 LÍNEA RACE          (4 bidones juntos como hero)
//   03 LÍNEA PRO           (4 potes 100gr unificados como hero)
//
// El soporte de `type:"interlude"` queda como infra dormante en el
// componente/JS (sin afectar nada porque no hay entries con este type).
//
// Estructura por panel producto:
//   slug         → folder en /imagenes-web/slider-spylt/
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
    // ─── 01 · LÍNEA ELITE ──────────────────────────────────────────
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
            base: "/imagenes-web/slider-spylt/linea-elite/base.png",
            hero: "/imagenes-web/slider-spylt/linea-elite/hero.png",
            silhouette: "/imagenes-web/slider-spylt/linea-elite/silhouette.png",
        },
        // Sub-productos: 2 partes del set Elite (PART 1 + PART 2).
        // El packshot unificado muestra ambas en horizontal → cada
        // hotspot ~50% del ancho.
        subProducts: [
            {
                slug: "parte-1",
                nombre: "ELITE · PART 1",
                tagline: "Base mineral",
                base: "/imagenes-web/slider-spylt/linea-elite/sub/parte-1/base.png",
                pote: "/imagenes-web/slider-spylt/linea-elite/sub/parte-1/pote.png",
                // texto: omitido — el texto.png exportado salió como copia
                // del fondo del card (bug del pipeline 3D), tapaba el pote
                // al renderearse con z=50. El swap se queda con base+pote.
                accentColor: "#d9a86a",
                hotspot: { x: 8, y: 10, w: 40, h: 80 },
            },
            {
                slug: "parte-2",
                nombre: "ELITE · PART 2",
                tagline: "Complejo orgánico",
                base: "/imagenes-web/slider-spylt/linea-elite/sub/parte-2/base.png",
                pote: "/imagenes-web/slider-spylt/linea-elite/sub/parte-2/pote.png",
                // texto: omitido — mismo bug que parte-1 (ver comentario arriba).
                accentColor: "#d9a86a",
                hotspot: { x: 52, y: 10, w: 40, h: 80 },
            },
        ],
    },

    // ─── 02 · LÍNEA RACE ───────────────────────────────────────────
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
            base: "/imagenes-web/slider-spylt/linea-race/base.png",
            hero: "/imagenes-web/slider-spylt/linea-race/hero.png",
            silhouette: "/imagenes-web/slider-spylt/linea-race/silhouette.png",
        },
        // Sub-productos: Race son 4 fertilizantes — Verde / Celeste /
        // Violeta (solo Parte B) / Rosado. El packshot unificado se
        // recompuso (hero.png) con sólo estos 4 bidones lado a lado:
        // sacamos el Race 3 Parte A por pedido del cliente. Hotspots
        // distribuidos en 4 regiones de ~24% cada una.
        subProducts: [
            {
                slug: "verde",
                nombre: "RACE VERDE",
                tagline: "Etapa 1",
                base: "/imagenes-web/slider-spylt/linea-race/sub/verde/base.png",
                pote: "/imagenes-web/slider-spylt/linea-race/sub/verde/bidon.png",
                ruedas: "/imagenes-web/slider-spylt/linea-race/sub/verde/ruedas.png",
                texto: "/imagenes-web/slider-spylt/linea-race/sub/verde/texto.png",
                accentColor: "#c7f0dd",
                hotspot: { x: 2, y: 10, w: 22, h: 80 },
            },
            {
                slug: "celeste",
                nombre: "RACE CELESTE",
                tagline: "Etapa 2",
                base: "/imagenes-web/slider-spylt/linea-race/sub/celeste/base.png",
                pote: "/imagenes-web/slider-spylt/linea-race/sub/celeste/bidon.png",
                ruedas: "/imagenes-web/slider-spylt/linea-race/sub/celeste/ruedas.png",
                texto: "/imagenes-web/slider-spylt/linea-race/sub/celeste/texto.png",
                accentColor: "#c8eaf3",
                hotspot: { x: 26, y: 10, w: 22, h: 80 },
            },
            {
                slug: "violeta",
                nombre: "RACE VIOLETA",
                tagline: "Etapa 3",
                base: "/imagenes-web/slider-spylt/linea-race/sub/violeta/base.png",
                pote: "/imagenes-web/slider-spylt/linea-race/sub/violeta/bidon.png",
                ruedas: "/imagenes-web/slider-spylt/linea-race/sub/violeta/ruedas.png",
                texto: "/imagenes-web/slider-spylt/linea-race/sub/violeta/texto.png",
                accentColor: "#b49ae0",
                hotspot: { x: 50, y: 10, w: 22, h: 80 },
            },
            {
                slug: "rosado",
                nombre: "RACE ROSADO",
                tagline: "Etapa 4",
                base: "/imagenes-web/slider-spylt/linea-race/sub/rosado/base.png",
                pote: "/imagenes-web/slider-spylt/linea-race/sub/rosado/bidon.png",
                ruedas: "/imagenes-web/slider-spylt/linea-race/sub/rosado/ruedas.png",
                texto: "/imagenes-web/slider-spylt/linea-race/sub/rosado/texto.png",
                accentColor: "#f7d6dc",
                hotspot: { x: 74, y: 10, w: 24, h: 80 },
            },
        ],
    },

    // ─── 03 · LÍNEA PRO ────────────────────────────────────────────
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
            base: "/imagenes-web/slider-spylt/linea-pro/base.png",
            hero: "/imagenes-web/slider-spylt/linea-pro/hero.png",
            // silhouette ahora apunta al Fondo.png Unificados (gradient pastel
            // multi-color que cubre todo el panel detrás del card)
            silhouette: "/imagenes-web/slider-spylt/linea-pro/fondo.png",
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
                base: "/imagenes-web/slider-spylt/linea-pro/sub/enraizante/base.png",
                pote: "/imagenes-web/slider-spylt/linea-pro/sub/enraizante/pote.png",
                texto: "/imagenes-web/slider-spylt/linea-pro/sub/enraizante/texto.png",
                accentColor: "#f3c2de",
                hotspot: { x: 2, y: 8, w: 23, h: 84 },
            },
            {
                slug: "vegetativo",
                nombre: "VEGETATIVO",
                tagline: "Crecimiento vigoroso",
                base: "/imagenes-web/slider-spylt/linea-pro/sub/vegetativo/base.png",
                pote: "/imagenes-web/slider-spylt/linea-pro/sub/vegetativo/pote.png",
                texto: "/imagenes-web/slider-spylt/linea-pro/sub/vegetativo/texto.png",
                accentColor: "#c7f0dd",
                hotspot: { x: 26, y: 8, w: 23, h: 84 },
            },
            {
                slug: "pre-floracion",
                nombre: "PRE-FLORACIÓN",
                tagline: "Transición",
                base: "/imagenes-web/slider-spylt/linea-pro/sub/pre-floracion/base.png",
                pote: "/imagenes-web/slider-spylt/linea-pro/sub/pre-floracion/pote.png",
                texto: "/imagenes-web/slider-spylt/linea-pro/sub/pre-floracion/texto.png",
                accentColor: "#f0a7b1",
                hotspot: { x: 50, y: 8, w: 23, h: 84 },
            },
            {
                slug: "floracion",
                nombre: "FLORACIÓN",
                tagline: "Etapa final",
                base: "/imagenes-web/slider-spylt/linea-pro/sub/floracion/base.png",
                pote: "/imagenes-web/slider-spylt/linea-pro/sub/floracion/pote.png",
                texto: "/imagenes-web/slider-spylt/linea-pro/sub/floracion/texto.png",
                accentColor: "#f7d6dc",
                hotspot: { x: 74, y: 8, w: 24, h: 84 },
            },
        ],
    },

    // BIO + DAY-0 movidos a <ComplementosIdeales /> (sección dedicada
    // debajo del slider con narrativa scroll-driven propia).
];
