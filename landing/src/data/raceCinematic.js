/* =====================================================================
   raceCinematic.js
   Datos de la sección "Race Cinematic" — galería editorial que se monta
   en /linea-race entre el ProductDeepDive y el FinalCTA. Mezcla foto +
   video, agrupada por concepto narrativo (no por color/SKU).

   Skills aplicadas en el componente:
     • frontend-design  → masonry editorial, ratios mixtos, copy emoción
     • gsap-scrolltrigger → reveal stagger por tile
     • accessibility    → alt descriptivos, video aria-label, sin autoplay
                          de audio, pausa con prefers-reduced-motion
   ===================================================================== */

// Bloque 1 — "MARQUEE" — banderas y carros sin fondo, layout horizontal.
export const raceMarquee = [
    { src: "/imagenes-web/race/car-verde-logo.jpg",      alt: "F1 verde con logo Holistic Race" },
    { src: "/imagenes-web/race/flag-checkered-bw.jpg",   alt: "Bandera a cuadros blanco y negro" },
    { src: "/imagenes-web/race/car-violeta-motion.jpg",  alt: "F1 violeta en motion blur" },
    { src: "/imagenes-web/race/flags-rosa-crossed.jpg",  alt: "Banderas rosa cruzadas" },
    { src: "/imagenes-web/race/car-azul-front.jpg",      alt: "F1 azul de frente" },
    { src: "/imagenes-web/race/car-rosa-front.jpg",      alt: "F1 rosa de frente" },
];

// Bloque 2 — "ESCENARIOS" — botellas en pista, campo, invernadero, raíces.
// Tile size hint controla cómo el masonry los distribuye:
//   wide  → 2 cols, ratio 16/9
//   tall  → 1 col, ratio 3/4
//   xl    → 2 cols, ratio 1/1
export const raceScenes = [
    {
        src: "/imagenes-web/race/bottle-violeta-field-sunset.jpg",
        alt: "Race violeta volando sobre cultivo al atardecer",
        size: "xl",
        kicker: "EN EL CAMPO",
        title: "Probado en cultivo real.",
    },
    {
        src: "/imagenes-web/race/bottle-verde-greenhouse.jpg",
        alt: "Race verde en invernadero con plantas hidropónicas",
        size: "tall",
        kicker: "INVERNADERO",
        title: "Pensado para indoor.",
    },
    {
        src: "/imagenes-web/race/bottle-violeta-a-roots.jpg",
        alt: "Race violeta junto a raíces blancas dramáticas",
        size: "tall",
        kicker: "RAÍCES",
        title: "Donde se decide todo.",
    },
    {
        src: "/imagenes-web/race/bottle-rosa-splash.jpg",
        alt: "Race rosa con splash de agua dramático",
        size: "tall",
        kicker: "CICLO COMPLETO",
        title: "Race 4 — Micro + Magnesio.",
    },
    {
        src: "/imagenes-web/race/bottle-azul-splash.jpg",
        alt: "Race azul con corona de salpicaduras",
        size: "tall",
        kicker: "CRECIMIENTO Y MADURACIÓN",
        title: "Race 3 — PK en dos partes.",
    },
    {
        src: "/imagenes-web/race/bottle-violeta-track-f1.jpg",
        alt: "Race violeta sobre pista F1 al sol",
        size: "wide",
        kicker: "EN PISTA",
        title: "Velocidad y precisión.",
    },
    {
        src: "/imagenes-web/race/bottle-verde-splash-spotlight.jpg",
        alt: "Race verde con splash bajo luz cinematográfica",
        size: "tall",
        kicker: "VEGETATIVO",
        title: "Race 1 — explosión foliar.",
    },
];

// Bloque 3 — "MOTION" — clips de video que se reproducen al entrar
// en viewport (autoplay muted loop). Cada uno tiene su poster.
// Reducimos a 4 para no abrumar conexiones móviles; el resto queda
// disponible para futuras campañas / press kit.
export const raceMotion = [
    {
        src: "/video/race/cinematic-violeta-pistons.mp4",
        poster: "/imagenes-web/race/cinematic-violeta-pistons-poster.png",
        alt: "Race violeta rodeada de pistones, bujías, banderas y splash",
        kicker: "MOTOR",
        title: "Sistema completo, en movimiento.",
    },
    {
        src: "/video/race/cinematic-violeta-splash-radial.mp4",
        poster: "/imagenes-web/race/cinematic-violeta-splash-radial-poster.png",
        alt: "Race violeta con splash radial de agua",
        kicker: "IMPACTO",
        title: "Cada gota cuenta.",
    },
    {
        src: "/video/race/cinematic-violeta-splash-spotlight.mp4",
        poster: "/imagenes-web/race/cinematic-violeta-splash-spotlight-poster.png",
        alt: "Splash violeta bajo luz spotlight",
        kicker: "ESCENA",
        title: "Diseñado para la luz.",
    },
    {
        src: "/video/race/race-clip-04.mp4",
        poster: "/imagenes-web/race/bottle-violeta-track-f1.jpg",
        alt: "Race violeta en escenario de pista",
        kicker: "PISTA",
        title: "El detalle del recorrido.",
    },
];
