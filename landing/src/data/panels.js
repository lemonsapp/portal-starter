// panels.js — 9 panels SPYLT-style del slider home (post VideoHero).
//
// Reemplaza el data source antiguo (flavors.js, 6 productos) con la
// nueva composición por capas pre-renderizadas que vive en
// /img/slider-spylt/<slug>/. Cada panel es una "etapa" o "variante"
// de Línea PRO o Línea RACE.
//
// Estructura por panel:
//   slug         → folder en /img/slider-spylt/
//   nombre       → caption visible (debajo del producto, estilo SPYLT)
//   linea        → "PRO" | "RACE" (tag pequeño)
//   route        → href del CTA (apunta al producto principal)
//   bgColor      → fondo del panel cuando la imagen Base no cubre 100%
//   accentColor  → color para HUD/dot/highlights
//   textHighlight→ palabra del headline editorial que se resalta en este panel
//                  (estilo SPYLT "FREAKING" en caja)
//   layers:
//     base       → fondo de la card (incluye el shape coloreado)
//     hero       → producto principal (Pote / Bidón / WEB ELEMENTOS)
//     texto      → tipografía blanca overlay con el nombre del producto
//     wheels     → array opcional de 4 ruedas (solo RACE)
//
// El orden importa: PRO va primero (etapas del cultivo en orden temporal)
// y RACE después (intensidad creciente del color).
export const panels = [
    // ─── LÍNEA PRO ─── (etapas del cultivo, orden cronológico)
    {
        slug: "pro-vegetativo",
        nombre: "VEGETATIVO",
        linea: "PRO",
        route: "/linea-pro",
        bgColor: "#2E8F6E",
        accentColor: "#C7F0DD",
        textHighlight: "VEGETATIVO",
        layers: {
            base:  "/img/slider-spylt/pro-vegetativo/base.png",
            hero:  "/img/slider-spylt/pro-vegetativo/hero.png",
            texto: "/img/slider-spylt/pro-vegetativo/texto.png",
        },
    },
    {
        slug: "pro-pre-floracion",
        nombre: "PRE FLORACIÓN",
        linea: "PRO",
        route: "/linea-pro",
        bgColor: "#7AB85F",
        accentColor: "#D5EFC2",
        textHighlight: "PRE FLORACIÓN",
        layers: {
            base:  "/img/slider-spylt/pro-pre-floracion/base.png",
            hero:  "/img/slider-spylt/pro-pre-floracion/hero.png",
            texto: "/img/slider-spylt/pro-pre-floracion/texto.png",
        },
    },
    {
        slug: "pro-floracion",
        nombre: "FLORACIÓN",
        linea: "PRO",
        route: "/linea-pro",
        bgColor: "#D86E8C",
        accentColor: "#F7D6DC",
        textHighlight: "FLORACIÓN",
        layers: {
            base:  "/img/slider-spylt/pro-floracion/base.png",
            hero:  "/img/slider-spylt/pro-floracion/hero.png",
            texto: "/img/slider-spylt/pro-floracion/texto.png",
        },
    },
    {
        slug: "pro-enraizante",
        nombre: "ENRAIZANTE",
        linea: "PRO",
        route: "/linea-pro",
        bgColor: "#C9A34E",
        accentColor: "#F7F3EA",
        textHighlight: "ENRAIZANTE",
        layers: {
            base:  "/img/slider-spylt/pro-enraizante/base.png",
            hero:  "/img/slider-spylt/pro-enraizante/hero.png",
            texto: "/img/slider-spylt/pro-enraizante/texto.png",
        },
    },

    // ─── LÍNEA RACE ─── (intensidad creciente del color)
    {
        slug: "race-celeste",
        nombre: "RACE CELESTE",
        linea: "RACE",
        route: "/linea-race",
        bgColor: "#5DBED8",
        accentColor: "#C8EAF3",
        textHighlight: "RACE",
        layers: {
            base:   "/img/slider-spylt/race-celeste/base.png",
            hero:   "/img/slider-spylt/race-celeste/hero.png",
            texto:  "/img/slider-spylt/race-celeste/texto.png",
            wheels: [
                "/img/slider-spylt/race-celeste/rueda-1.png",
                "/img/slider-spylt/race-celeste/rueda-2.png",
                "/img/slider-spylt/race-celeste/rueda-3.png",
                "/img/slider-spylt/race-celeste/rueda-4.png",
            ],
        },
    },
    {
        slug: "race-rosado",
        nombre: "RACE ROSADO",
        linea: "RACE",
        route: "/linea-race",
        bgColor: "#E591B6",
        accentColor: "#F7D6DC",
        textHighlight: "RACE",
        layers: {
            base:   "/img/slider-spylt/race-rosado/base.png",
            hero:   "/img/slider-spylt/race-rosado/hero.png",
            texto:  "/img/slider-spylt/race-rosado/texto.png",
            wheels: [
                "/img/slider-spylt/race-rosado/rueda-1.png",
                "/img/slider-spylt/race-rosado/rueda-2.png",
                "/img/slider-spylt/race-rosado/rueda-3.png",
                "/img/slider-spylt/race-rosado/rueda-4.png",
            ],
        },
    },
    {
        slug: "race-verde",
        nombre: "RACE VERDE",
        linea: "RACE",
        route: "/linea-race",
        bgColor: "#2EC274",
        accentColor: "#C7F0DD",
        textHighlight: "RACE",
        layers: {
            base:   "/img/slider-spylt/race-verde/base.png",
            hero:   "/img/slider-spylt/race-verde/hero.png",
            texto:  "/img/slider-spylt/race-verde/texto.png",
            wheels: [
                "/img/slider-spylt/race-verde/rueda-1.png",
                "/img/slider-spylt/race-verde/rueda-2.png",
                "/img/slider-spylt/race-verde/rueda-3.png",
                "/img/slider-spylt/race-verde/rueda-4.png",
            ],
        },
    },
    {
        slug: "race-violeta-a",
        nombre: "RACE VIOLETA · PART A",
        linea: "RACE",
        route: "/linea-race",
        bgColor: "#8A5BC0",
        accentColor: "#E4D5F2",
        textHighlight: "PART A",
        layers: {
            base:   "/img/slider-spylt/race-violeta-a/base.png",
            hero:   "/img/slider-spylt/race-violeta-a/hero.png",
            texto:  "/img/slider-spylt/race-violeta-a/texto.png",
            wheels: [
                "/img/slider-spylt/race-violeta-a/rueda-1.png",
                "/img/slider-spylt/race-violeta-a/rueda-2.png",
                "/img/slider-spylt/race-violeta-a/rueda-3.png",
                "/img/slider-spylt/race-violeta-a/rueda-4.png",
            ],
        },
    },
    {
        slug: "race-violeta-b",
        nombre: "RACE VIOLETA · PART B",
        linea: "RACE",
        route: "/linea-race",
        bgColor: "#6B3BAF",
        accentColor: "#B49AE0",
        textHighlight: "PART B",
        layers: {
            base:   "/img/slider-spylt/race-violeta-b/base.png",
            hero:   "/img/slider-spylt/race-violeta-b/hero.png",
            texto:  "/img/slider-spylt/race-violeta-b/texto.png",
            wheels: [
                "/img/slider-spylt/race-violeta-b/rueda-1.png",
                "/img/slider-spylt/race-violeta-b/rueda-2.png",
                "/img/slider-spylt/race-violeta-b/rueda-3.png",
                "/img/slider-spylt/race-violeta-b/rueda-4.png",
            ],
        },
    },
];
