/* =====================================================================
   HOLISTIC — socios-button-animations.js
   Animaciones GSAP del CTA SOCIOS del Header (entrance, idle pulse,
   hover ring + shimmer, click feedback). Importado desde Header.astro.
   ─────────────────────────────────────────────────────────────────────
   Patron singleton: si el script ya corrio en esta navegacion, no se
   duplica. data-magnetic + data-cursor="hover" son manejados por
   cursor-animations.js, esto solo agrega los effects propios del CTA.
   ===================================================================== */

import { gsap } from "gsap";

if (!window.__holisticSociosCtaInit) {
    window.__holisticSociosCtaInit = true;
    init();
}

function init() {
    // Esperar al DOM si el script entra antes
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
        run();
    }
}

function run() {
    const cta = document.querySelector("[data-socios-btn]");
    if (!cta) return;

    const label = cta.querySelector(".header__socios-cta__label");
    const arrow = cta.querySelector(".header__socios-cta__arrow");
    const ring = cta.querySelector(".header__socios-cta__ring");
    const sheen = cta.querySelector(".header__socios-cta__sheen");

    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
        // Estado final, sin tweens
        gsap.set(cta, { scale: 1, opacity: 1, x: 0 });
        gsap.set(ring, { scale: 1, opacity: 0.85 });
        return;
    }

    // ─── ENTRANCE ─────────────────────────────────────────────────────
    // Aparece despues que el header (header-footer-animations.js anima a
    // 0.6s desde -30y). Le damos un delay de 0.55s para escalonar y un
    // efecto extra de magnetism: el boton entra con un pequenio "rebote"
    // desde la derecha.
    gsap.set(cta, { x: 24, scale: 0.92, opacity: 0 });
    gsap.set(ring, { scale: 0.5, opacity: 0 });

    const tl = gsap.timeline({ delay: 0.55 });
    tl.to(cta, {
        x: 0,
        scale: 1,
        opacity: 1,
        duration: 0.7,
        ease: "back.out(1.6)",
    })
        .to(
            ring,
            {
                scale: 1,
                opacity: 0.85,
                duration: 0.6,
                ease: "power3.out",
            },
            "-=0.45"
        )
        // Tiny pop al final como "estoy aca" (tipo Apple primary CTA)
        .to(cta, {
            scale: 1.04,
            duration: 0.16,
            ease: "power2.out",
            yoyo: true,
            repeat: 1,
        });

    // ─── IDLE PULSE ───────────────────────────────────────────────────
    // Anillo sutil que pulsa cada ~3.2s para llamar la atencion sin
    // ser molesto. Solo activo cuando el boton NO esta en hover.
    const idlePulse = gsap.timeline({
        repeat: -1,
        repeatDelay: 2.6,
        paused: true,
        defaults: { ease: "power2.out" },
    });
    idlePulse
        .fromTo(
            ring,
            { boxShadow: "0 0 0 1px rgba(82,183,136,0.35) inset, 0 0 0 0 rgba(82,183,136,0)" },
            {
                boxShadow:
                    "0 0 0 1px rgba(82,183,136,0.55) inset, 0 0 0 8px rgba(82,183,136,0)",
                duration: 0.7,
            }
        )
        .to(ring, {
            boxShadow:
                "0 0 0 1px rgba(82,183,136,0.35) inset, 0 0 0 0 rgba(82,183,136,0)",
            duration: 0.5,
        });

    // Arrancar el pulse despues del entrance
    tl.call(() => idlePulse.play(), [], "+=0.4");

    // ─── HOVER ENTER / LEAVE ──────────────────────────────────────────
    // En hover: pausa el pulse, anillo crece, sheen barre, label
    // gradient sweep (CSS), boton scale up. data-magnetic ya hace el
    // pull magnetic en cursor-animations.js.

    let hoverTl = null;

    cta.addEventListener("mouseenter", () => {
        idlePulse.pause();
        if (hoverTl) hoverTl.kill();

        hoverTl = gsap.timeline({ defaults: { ease: "power3.out" } });
        hoverTl
            .to(
                cta,
                {
                    scale: 1.06,
                    duration: 0.32,
                },
                0
            )
            .to(
                ring,
                {
                    scale: 1.04,
                    opacity: 1,
                    boxShadow:
                        "0 0 0 1.5px rgba(82,183,136,0.7) inset, 0 0 0 6px rgba(82,183,136,0.18)",
                    duration: 0.4,
                },
                0
            )
            // Sheen sweep: luz pasa de izquierda a derecha
            .fromTo(
                sheen,
                { left: "-120%" },
                {
                    left: "120%",
                    duration: 0.7,
                    ease: "power2.inOut",
                },
                0.05
            );
    });

    cta.addEventListener("mouseleave", () => {
        if (hoverTl) hoverTl.kill();

        const out = gsap.timeline({ defaults: { ease: "power2.out" } });
        out.to(
            cta,
            {
                scale: 1,
                duration: 0.4,
            },
            0
        ).to(
            ring,
            {
                scale: 1,
                opacity: 0.85,
                boxShadow:
                    "0 0 0 1px rgba(82,183,136,0.35) inset, 0 0 0 0 rgba(82,183,136,0)",
                duration: 0.5,
            },
            0
        );
        // Resetear sheen fuera del viewport
        gsap.set(sheen, { left: "-120%" });

        // Reanudar pulse despues de un beat
        gsap.delayedCall(0.6, () => idlePulse.resume());
    });

    // ─── CLICK FEEDBACK ───────────────────────────────────────────────
    // Quick squash antes de navegar — feel tactil. La navegacion la
    // sigue manejando el <a href> nativo, no preventDefault.
    cta.addEventListener("mousedown", () => {
        gsap.to(cta, { scale: 0.94, duration: 0.1, ease: "power2.out" });
    });
    cta.addEventListener("mouseup", () => {
        gsap.to(cta, { scale: 1.06, duration: 0.18, ease: "back.out(2.4)" });
    });
}
