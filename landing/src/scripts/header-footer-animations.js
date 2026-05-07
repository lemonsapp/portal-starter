/* =====================================================================
   HOLISTIC — header-footer-animations.js
   Fade-in sutil del header (al cargar) y del footer (al entrar viewport).
   Global via BaseLayout. Se AUTO-SKIP en /home-classic para no duplicar
   los tweens que ya maneja animations-classic.js en esa ruta.
   ===================================================================== */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function init() {
    // Guard anti-duplicación: si estamos en /home-classic, animations-classic.js
    // ya anima header + footer. Detectamos por .hero__slider (solo home vieja).
    if (document.querySelector(".hero__slider")) return;

    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    // ---------------- HEADER fade ----------------
    const header = document.querySelector(".header");
    if (header) {
        if (prefersReducedMotion) {
            gsap.set(header, { y: 0, opacity: 1 });
        } else {
            gsap.from(header, {
                y: -30,
                opacity: 0,
                duration: 0.6,
                ease: "power2.out",
            });
        }
    }

    // ---------------- FOOTER fade ----------------
    const footerCols = document.querySelector(".footer__cols");
    const footerBrand = document.querySelector(".footer__brand");
    const footer = document.querySelector(".footer");

    if (!footer) return;

    const footerTargets = [footerCols, footerBrand].filter(Boolean);
    if (!footerTargets.length) return;

    if (prefersReducedMotion) {
        gsap.set(footerTargets, { y: 0, opacity: 1 });
        return;
    }

    gsap.from(footerTargets, {
        y: 20,
        opacity: 0,
        duration: 0.7,
        stagger: 0.15,
        ease: "power2.out",
        scrollTrigger: {
            trigger: footer,
            start: "top 85%",
            toggleActions: "play none none none",
        },
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
