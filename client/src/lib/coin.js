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
