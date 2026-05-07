/* =====================================================================
   HOLISTIC — hero-animations.js (v5 — NUTRICIÓN SUPERIOR credo section)
   Reescrito para la nueva CinematicHero: scroll-driven con SplitText,
   reveal coordinado y pour dorado scrubbed.

   Skills aplicadas (citadas):
     • gsap-scrolltrigger    → pin + scrub + toggleActions
     • gsap-plugins          → SplitText (chars/lines) + DrawSVG / attr SVG
     • gsap-timeline         → defaults + position param
     • gsap-utils            → random
     • gsap-core matchMedia  → prefers-reduced-motion + breakpoints
     • gsap-performance      → transforms only, will-change limitado
   ===================================================================== */
import {
    gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText,
} from "./lib/registerGsap.js";

function initNutri() {
    const root = document.querySelector("[data-nutri]");
    if (!root) return;

    const eyebrow      = root.querySelector("[data-nutri-eyebrow]");
    const lines        = Array.from(root.querySelectorAll("[data-nutri-line]"));
    const lineTexts    = Array.from(root.querySelectorAll("[data-nutri-text]"));
    const lede         = root.querySelector("[data-nutri-lede]");
    const cta          = root.querySelector("[data-nutri-cta]");
    const stage        = root.querySelector("[data-nutri-stage]");
    const product      = root.querySelector("[data-nutri-product]");
    const halo         = root.querySelector(".nutri__halo");
    const watermark    = root.querySelector(".nutri__watermark");
    const mesh         = root.querySelector("[data-nutri-mesh]");
    const pourStream   = root.querySelector("[data-nutri-pour-stream]");
    const pourDrops    = Array.from(root.querySelectorAll("[data-nutri-pour-drop]"));

    mm.add(BREAKPOINTS, (ctx) => {
        const { isDesktop, isTablet, isMobile, reduceMotion } = ctx.conditions;

        // ----------------------------------------------------------
        // SplitText sobre cada palabra del título (chars).
        // Usamos `mask: "chars"` → cada char queda en wrapper con
        // overflow:clip para reveal limpio sin parpadeos.
        // ----------------------------------------------------------
        const splits = lineTexts.map((el) =>
            SplitText.create(el, {
                type: "chars",
                mask: "chars",
                charsClass: "nutri__char",
                aria: "hidden", // el wrapper conserva el texto plano
            })
        );
        const allChars = splits.flatMap((s) => s.chars);

        // ----------------------------------------------------------
        // Estados iniciales
        // ----------------------------------------------------------
        gsap.set(eyebrow, { autoAlpha: 0, y: 28 });
        gsap.set(allChars, { yPercent: 110, rotationX: -45, autoAlpha: 0, transformOrigin: "50% 100%" });
        gsap.set(lede,    { autoAlpha: 0, y: 30 });
        gsap.set(cta,     { autoAlpha: 0, y: 24, scale: 0.85 });
        gsap.set(product, { autoAlpha: 0, yPercent: 14, scale: 0.92 });
        gsap.set(halo,    { autoAlpha: 0, scale: 0.65 });
        gsap.set(watermark, { autoAlpha: 0, x: -60 });
        gsap.set(pourStream, { attr: { height: 0, y: 0 } });
        gsap.set(pourDrops,  { attr: { r: 0, cy: 0 } });

        // ----------------------------------------------------------
        // Reduced-motion: estado final sin animaciones
        // ----------------------------------------------------------
        if (reduceMotion) {
            gsap.set([eyebrow, lede, cta], { autoAlpha: 1, y: 0, scale: 1 });
            gsap.set(allChars, { yPercent: 0, rotationX: 0, autoAlpha: 1 });
            gsap.set(product, { autoAlpha: 1, yPercent: 0, scale: 1 });
            gsap.set(halo, { autoAlpha: 0.85, scale: 1 });
            gsap.set(watermark, { autoAlpha: 0.18, x: 0 });
            return () => splits.forEach((s) => s.revert());
        }

        // ----------------------------------------------------------
        // Reveal entrada — toggleActions cuando entra al viewport.
        // (no scrub: queremos que arranque limpio una sola vez)
        // ----------------------------------------------------------
        const enterTl = gsap.timeline({
            defaults: { ease: "expo.out" },
            scrollTrigger: {
                id: "nutri-enter",
                trigger: root,
                start: "top 70%",
                toggleActions: "play none none reverse",
            },
        });

        enterTl
            .to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.8, ease: "back.out(1.6)" }, 0)
            .to(watermark, {
                autoAlpha: 0.18, x: 0, duration: 1.6, ease: "power3.out",
            }, 0.1)
            .to(allChars, {
                yPercent: 0, rotationX: 0, autoAlpha: 1,
                duration: 1.0,
                stagger: { amount: 0.55, from: "start" },
                ease: "back.out(1.4)",
            }, 0.2)
            .to(halo, {
                autoAlpha: 0.85, scale: 1, duration: 1.2, ease: "expo.out",
            }, 0.3)
            .to(product, {
                autoAlpha: 1, yPercent: 0, scale: 1,
                duration: 1.4, ease: "back.out(1.2)",
            }, 0.4)
            .to(lede, {
                autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out",
            }, 0.9)
            .to(cta, {
                autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: "back.out(2)",
            }, 1.05);

        // Idle: respiración del producto + halo pulse
        gsap.to(product, {
            y: "+=12", duration: 3.6, ease: "sine.inOut",
            yoyo: true, repeat: -1,
        });
        gsap.to(halo, {
            scale: 1.06, duration: 3.4, ease: "sine.inOut",
            yoyo: true, repeat: -1,
        });

        // ----------------------------------------------------------
        // POUR dorado scrub-driven — mientras scrolleás, la columna
        // dorada cae desde la tapa del envase y las gotas crecen.
        // ScrollTrigger de tween único (top-level), no anidado.
        // ----------------------------------------------------------
        const pourTl = gsap.timeline({
            scrollTrigger: {
                id: "nutri-pour",
                trigger: root,
                start: "top 50%",
                end: "bottom 30%",
                scrub: 0.7,
                invalidateOnRefresh: true,
            },
        });

        // Stream: crece como columna desde y=0 hasta y=400 (la mitad
        // del envase). Como `attr`, no usamos transforms — directo
        // al SVG.
        pourTl.to(pourStream, {
            attr: { height: 360, y: 80 }, ease: "none",
        }, 0);

        // Cada drop crece y baja a una posición distinta
        pourDrops.forEach((d, i) => {
            pourTl.to(d, {
                attr: {
                    r:  gsap.utils.random(8, 16, 1),
                    cy: gsap.utils.random(420, 720, 10),
                },
                ease: "none",
            }, i * 0.07);
        });

        // ----------------------------------------------------------
        // Parallax sutil del watermark (más rápido que el resto)
        // y del producto (más lento). Crea profundidad cinemática.
        // ----------------------------------------------------------
        if (!isMobile) {
            gsap.to(watermark, {
                xPercent: -8, ease: "none",
                scrollTrigger: {
                    trigger: root,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 1,
                },
            });
            gsap.to(product, {
                yPercent: -8, ease: "none",
                scrollTrigger: {
                    trigger: root,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 1.2,
                },
            });
        }

        // Cleanup matchMedia: revertir SplitText.
        return () => splits.forEach((s) => s.revert());
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNutri);
} else {
    initNutri();
}
