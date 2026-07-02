// client/src/components/BuyCTA.jsx
//
// CTA verde "COMPRAR" — llamativo, linkea a /shop. Se coloca ARRIBA (variant
// "inline", botón compacto en la primera sección) y ABAJO (variant "banner",
// bloque ancho al cierre) de cada interna para reforzar el mensaje de compra.
//
// Usa tokens --c-* (accent-2 = verde CTA) → se adapta solo al light theme.

import { Link } from "react-router-dom";

const CartIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" />
    <path d="M2.5 3h2.7l2.5 12.4a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
  </svg>
);

/**
 * @param {{ variant?: "inline"|"banner", label?: string, sublabel?: string, style?: object }} props
 */
export default function BuyCTA({ variant = "inline", label = "COMPRAR", sublabel = "Despachamos en 24 hs · Pagás seguro con MercadoPago", style }) {
  const isBanner = variant === "banner";
  return (
    <Link
      to="/shop"
      className={`buycta buycta--${variant}`}
      style={style}
      aria-label="Ir a la tienda a comprar"
    >
      <style>{`
        .buycta {
          --buycta-green: var(--c-accent-2, #25D366);
          display: inline-flex; align-items: center; gap: 12px;
          text-decoration: none;
          font-family: var(--f-display, 'Gotham', sans-serif);
          font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase;
          color: #fff;
          background: linear-gradient(135deg, var(--buycta-green) 0%, #1FA350 100%);
          border-radius: var(--r-pill, 999px);
          box-shadow: 0 10px 30px -8px rgba(37,211,102,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset;
          cursor: pointer;
          transition: transform .22s var(--ease-out, cubic-bezier(.2,.8,.2,1)),
                      box-shadow .22s ease, filter .22s ease;
          animation: buyctaPulse 2.6s ease-in-out infinite;
          will-change: transform, box-shadow;
        }
        .buycta:hover {
          transform: translateY(-2px) scale(1.025);
          box-shadow: 0 16px 42px -8px rgba(37,211,102,0.7), 0 0 0 1px rgba(255,255,255,0.12) inset;
          filter: saturate(1.08);
          animation-play-state: paused;
        }
        .buycta:focus-visible { outline: 3px solid var(--c-accent, #A7F5C8); outline-offset: 3px; }
        .buycta:active { transform: translateY(0) scale(0.99); }
        .buycta__arrow { transition: transform .22s var(--ease-out, cubic-bezier(.2,.8,.2,1)); }
        .buycta:hover .buycta__arrow { transform: translateX(5px); }

        /* Pulso de glow para "incitar a apretarlo" */
        @keyframes buyctaPulse {
          0%, 100% { box-shadow: 0 10px 30px -8px rgba(37,211,102,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset; }
          50%      { box-shadow: 0 14px 38px -8px rgba(37,211,102,0.72), 0 0 0 1px rgba(255,255,255,0.10) inset; }
        }
        @media (prefers-reduced-motion: reduce) { .buycta { animation: none; } }

        /* ── inline: botón compacto (arriba) ── */
        .buycta--inline { padding: 13px 26px; font-size: 14px; }

        /* ── banner: bloque ancho (abajo) ── */
        .buycta--banner {
          display: flex; width: 100%; box-sizing: border-box;
          justify-content: center; gap: 16px;
          padding: 22px 28px; font-size: 17px;
          border-radius: var(--r-4, 18px);
          text-align: center;
        }
        .buycta--banner .buycta__text { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
        .buycta--banner .buycta__sub {
          font-family: var(--f-body, 'Gotham', sans-serif);
          font-weight: 600; font-size: 11px; letter-spacing: 0.02em;
          text-transform: none; color: rgba(255,255,255,0.85);
        }
        .buycta--banner .buycta__icon { width: 40px; height: 40px; display: grid; place-items: center;
          background: rgba(255,255,255,0.16); border-radius: 50%; flex-shrink: 0; }
      `}</style>
      {isBanner && <span className="buycta__icon"><CartIcon /></span>}
      {!isBanner && <CartIcon />}
      <span className="buycta__text">
        <span className="buycta__label">{label}</span>
        {isBanner && sublabel && <span className="buycta__sub">{sublabel}</span>}
      </span>
      <span className="buycta__arrow" aria-hidden="true">→</span>
    </Link>
  );
}
