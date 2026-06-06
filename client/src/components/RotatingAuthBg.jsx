import { useState, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────
// Fondo rotativo compartido de las pantallas de auth (Login + Register).
//
// Dos fotos del cliente (2026-06-06) que crossfadean cada ROTATE_MS y
// arrancan en una AL AZAR, así cualquiera puede aparecer primero. Viven en
// client/public/imagenes-web/login/ (crudos PNG en landing/imagenes-web/
// IMAGENES/login-crudos/). BASE_URL: el portal se sirve bajo /portal/ en
// prod y / en dev — sin esto, en prod apuntarían a la landing (404).
//
// La página que lo monta debe: (1) tener position:relative en su root,
// (2) poner z-index:1 + fondo translúcido en sus paneles para que la foto
// se vea debajo (ver Login.jsx / Register.jsx).
// ─────────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL;
const AUTH_BGS = [
  `${BASE}imagenes-web/login/login-1.webp`,
  `${BASE}imagenes-web/login/login-2.webp`,
];
const ROTATE_MS = 12000;

export default function RotatingAuthBg() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * AUTH_BGS.length));

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % AUTH_BGS.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="auth-bg" aria-hidden="true">
      <style>{`
        .auth-bg { position: absolute; inset: 0; z-index: 0; }
        .auth-bg-img {
          position: absolute; inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0; transform: scale(1.07);
          transition: opacity 1.8s ease-in-out, transform 16s linear;
          will-change: opacity;
        }
        .auth-bg-img.on { opacity: 1; transform: scale(1); }
        /* Velo oscuro: contraste para que branding y form sigan legibles */
        .auth-bg-veil {
          position: absolute; inset: 0;
          background: linear-gradient(
            155deg,
            rgba(6,7,10,.84) 0%,
            rgba(6,7,10,.55) 48%,
            rgba(6,7,10,.80) 100%
          );
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-bg-img { transition: opacity 1.8s ease-in-out; transform: none; }
        }
      `}</style>
      {AUTH_BGS.map((src, i) => (
        <div
          key={src}
          className={`auth-bg-img${i === idx ? " on" : ""}`}
          style={{ backgroundImage: `url(${src})` }}
        />
      ))}
      <div className="auth-bg-veil" />
    </div>
  );
}
