// Moneda Holistic — imagen única de la moneda del portal, compartida por todas
// las superficies (balance, ruleta, tienda, misiones, stories, topnav). Vive acá
// para reutilizarla sin importar páginas pesadas.
// BASE_URL: el portal vive bajo /portal/ en prod (regla de assets por string).
export const COIN_IMG = `${import.meta.env.BASE_URL}imagenes-web/coins/moneda-holistic.webp`;

// <CoinIcon size={16} /> — la moneda como icono inline. Reemplaza al emoji 🪙:
// el emoji se dibuja dorado en Windows pero GRIS en iPhone/Android (cada OS
// usa su propio set), la imagen se ve idéntica en todas las plataformas.
// createElement (no JSX) porque este archivo es .js y Vite no transforma JSX acá.
import { createElement } from "react";

// El emoji de moneda que guardan algunos datos (el avatar "Coin Dorado" lo usa
// como icono). Se compara por codepoint, no a ojo.
export const EMOJI_MONEDA = "\u{1FA99}";

// conMoneda(valor, size) — si el valor ES el emoji de moneda, devuelve la
// imagen de la moneda Holistic; cualquier otro emoji vuelve tal cual. Sirve
// para los iconos que vienen de la base (avatares) sin tener que migrar datos.
export function conMoneda(valor, size = 20) {
  return valor === EMOJI_MONEDA ? createElement(CoinIcon, { size }) : valor;
}

export function CoinIcon({ size = 16, style: extra }) {
  return createElement("img", {
    src: COIN_IMG,
    alt: "",
    "aria-hidden": "true",
    draggable: false,
    style: {
      width: size, height: size, objectFit: "contain",
      verticalAlign: "-2px", userSelect: "none", ...extra,
    },
  });
}
