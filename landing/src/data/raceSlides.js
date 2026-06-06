// 4 slides del Race Slider — orden visual: verde → violeta → celeste → rosa.
// `bg` apunta a /public/imagenes-web/race-slider/ (composición widescreen 16:9 ya
// con card + splash + botella + piezas F1 horneadas en la imagen).
// `color` se usa como fill de dot activo y bg del CTA del slide.
// `textColor` es el color del título/tagline cuando se solapa al espacio
// cream del 40% izquierdo de la imagen.
export const raceSlides = [
    {
        id: "verde",
        nombre: "Race 1 · Vegetativo",
        tagline: "Pasto vigoroso y verde profundo.",
        bg: "/imagenes-web/race-slider/verde-1.png",
        color: "#2E8F6E",
        textColor: "#1B5E20",
    },
    {
        id: "violeta",
        nombre: "Race 2 · Floración",
        tagline: "Floración explosiva y vigor.",
        bg: "/imagenes-web/race-slider/violeta-2.png",
        color: "#8E24AA",
        textColor: "#4A148C",
    },
    {
        id: "celeste",
        nombre: "Race 3 · Bloom Booster",
        tagline: "Frescura y crecimiento balanceado.",
        bg: "/imagenes-web/race-slider/celeste-3.png",
        color: "#29B6F6",
        textColor: "#01579B",
    },
    {
        id: "rosa",
        nombre: "Race 4 · Finalizador",
        tagline: "Energía y poder en cada riego.",
        bg: "/imagenes-web/race-slider/rosa-4.png",
        color: "#EC407A",
        textColor: "#880E4F",
    },
];
