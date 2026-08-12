// PUNTOS — la marca visual del saldo que se GANA (coins.balance) y con el que
// se compra todo lo del perfil: avatares, marcos, títulos, insignias, banners
// y los powers del chat.
//
// Por qué existe este archivo: el portal tiene DOS saldos distintos y hasta
// 2026-08-12 los dos se dibujaban con la misma moneda dorada (lib/coin.js),
// así que en el perfil parecía que los items se pagaban con MONEDAS cuando en
// realidad siempre se cobraron contra los PUNTOS. La gema separa las aguas:
//
//   💎 gema  → PUNTOS   (coins.balance)        · se ganan · compran el perfil
//   🪙 moneda→ MONEDAS  (coins.monedas_balance)· se compran · pagan pedidos
//
// Es SVG inline, no emoji ni imagen: el emoji 💎 cambia de forma y de color en
// cada sistema operativo (la misma trampa documentada en lib/coin.js) y una
// imagen fija no se adapta al fondo. Al pintarse con `currentColor` la gema
// hereda el color del texto que la acompaña, así se ve bien tanto sobre el
// botón amarillo de compra (gema oscura) como sobre los chips oscuros de saldo
// (gema clara), sin una sola variante extra.
//
// createElement (no JSX) porque este archivo es .js y Vite no transforma JSX acá.
import { createElement } from "react";

export function PointsIcon({ size = 16, style: extra }) {
  return createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      role: "img",
      "aria-hidden": "true",
      focusable: "false",
      style: {
        display: "inline-block", verticalAlign: "-2px",
        flexShrink: 0, userSelect: "none", ...extra,
      },
    },
    // Cuerpo de la gema (corte brillante visto de frente).
    createElement("path", {
      d: "M7.4 2.6h9.2l4.9 6.2L12 21.6 2.5 8.8z",
      fill: "currentColor",
    }),
    // Facetas: la mesa superior y las dos aristas que bajan a la punta. Van en
    // negro muy tenue para que la gema se lea tallada sobre fondos claros y
    // desaparezcan sin ensuciar sobre fondos oscuros.
    createElement("path", {
      d: "M2.5 8.8h19M7.4 2.6l1.8 6.2L12 21.6l2.8-12.8 1.8-6.2",
      fill: "none",
      stroke: "#000",
      strokeOpacity: 0.28,
      strokeWidth: 1.1,
      strokeLinejoin: "round",
      strokeLinecap: "round",
    }),
  );
}
