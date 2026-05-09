// panels.js — 9 panels SPYLT-style del slider home (post VideoHero).
//
// Estructura por panel:
//   slug         → folder en /img/slider-spylt/
//   nombre       → caption visible (debajo del card)
//   linea        → "PRO" | "RACE" (tag pequeño)
//   route        → href del CTA (apunta al producto principal)
//   bgColor      → fallback bg cuando el card no cubre 100% del panel
//   accentColor  → color para tag/dot/highlights
//   aspect       → aspect-ratio del card (de base.png) — preserva el
//                  diseño original sin cropping ni stretch
//   label        → texto que va arriba del card como tipografía editorial
//                  (reemplaza al texto.png overlay que venía cropped en
//                  6 de 9 panels). Si NO querés label visible, dejar "".
//   layers:
//     base       → fondo de la card (el shape coloreado + ornamentos)
//     hero       → producto principal (Pote / Bidón / WEB ELEMENTOS)
//     wheels     → array opcional de ruedas (sólo RACE; cada rueda es
//                  layer independiente para spin/parallax individual).
//                  Para Race Verde usamos Ruedas Unificadas (single
//                  layer con las 4 ruedas) porque su Rueda 3 venía
//                  cropped al bounding box.
//
// Aspectos por panel (base.png dimensions):
//   PRO Vegetativo   2.275  (1718×755 — muy wide)
//   PRO Pre Floración 1.960  (1719×877)
//   PRO Floración    2.282  (1718×753 — muy wide)
//   PRO Enraizante   2.262  (1710×756 — muy wide)
//   RACE Celeste     1.259  (1718×1365 — casi cuadrado)
//   RACE Rosado      1.365  (1807×1324)
//   RACE Verde       1.591  (1726×1085)
//   RACE Violeta A   1.587  (1718×1083)
//   RACE Violeta B   1.298  (1718×1324)
export const panels = [
    // ─── LÍNEA PRO ─── (etapas del cultivo, orden cronológico)
    {
        slug: "pro-vegetativo",
        nombre: "VEGETATIVO",
        linea: "PRO",
        route: "/linea-pro",
        bgColor: "#2E8F6E",
        accentColor: "#C7F0DD",
        aspect: 2.275,
        label: "PRO",
        layers: {
            base: "/img/slider-spylt/pro-vegetativo/base.png",
            hero: "/img/slider-spylt/pro-vegetativo/hero.png",
        },
    },
    {
        slug: "pro-pre-floracion",
        nombre: "PRE FLORACIÓN",
        linea: "PRO",
        route: "/linea-pro",
        bgColor: "#7AB85F",
        accentColor: "#D5EFC2",
        aspect: 1.960,
        label: "PRO",
        layers: {
            base: "/img/slider-spylt/pro-pre-floracion/base.png",
            hero: "/img/slider-spylt/pro-pre-floracion/hero.png",
        },
    },
    {
        slug: "pro-floracion",
        nombre: "FLORACIÓN",
        linea: "PRO",
        route: "/linea-pro",
        bgColor: "#D86E8C",
        accentColor: "#F7D6DC",
        aspect: 2.282,
        label: "PRO",
        layers: {
            base: "/img/slider-spylt/pro-floracion/base.png",
            hero: "/img/slider-spylt/pro-floracion/hero.png",
        },
    },
    {
        slug: "pro-enraizante",
        nombre: "ENRAIZANTE",
        linea: "PRO",
        route: "/linea-pro",
        // bgColor saturado actualizado al hot pink que renderiza el base.png
        // (estaba en gold #C9A34E que no matcheaba el art real). accentColor
        // pastel derivado del color medio sampled del art (ver
        // landing/src/scripts/lib/sample-base-pngs.md si existe).
        bgColor: "#E579B7",
        accentColor: "#F3C2DE",
        aspect: 2.262,
        label: "PRO",
        layers: {
            base: "/img/slider-spylt/pro-enraizante/base.png",
            hero: "/img/slider-spylt/pro-enraizante/hero.png",
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
        aspect: 1.259,
        label: "RACE",
        layers: {
            base: "/img/slider-spylt/race-celeste/base.png",
            hero: "/img/slider-spylt/race-celeste/hero.png",
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
        aspect: 1.365,
        label: "RACE",
        layers: {
            base: "/img/slider-spylt/race-rosado/base.png",
            hero: "/img/slider-spylt/race-rosado/hero.png",
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
        aspect: 1.591,
        label: "RACE",
        layers: {
            base: "/img/slider-spylt/race-verde/base.png",
            hero: "/img/slider-spylt/race-verde/hero.png",
            // Race Verde: usamos Ruedas Unificadas (single layer) porque
            // Rueda 3 estaba cropped al bounding box (365×405).
            wheels: [
                "/img/slider-spylt/race-verde/ruedas-unificadas.png",
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
        aspect: 1.587,
        label: "PART A",
        layers: {
            base: "/img/slider-spylt/race-violeta-a/base.png",
            hero: "/img/slider-spylt/race-violeta-a/hero.png",
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
        aspect: 1.298,
        label: "PART B",
        layers: {
            base: "/img/slider-spylt/race-violeta-b/base.png",
            hero: "/img/slider-spylt/race-violeta-b/hero.png",
            wheels: [
                "/img/slider-spylt/race-violeta-b/rueda-1.png",
                "/img/slider-spylt/race-violeta-b/rueda-2.png",
                "/img/slider-spylt/race-violeta-b/rueda-3.png",
                "/img/slider-spylt/race-violeta-b/rueda-4.png",
            ],
        },
    },
];
