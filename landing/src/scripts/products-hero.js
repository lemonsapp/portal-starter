/* =====================================================================
   products-hero.js — Hero text-only ANTES del slider (SPYLT-style).
   Char reveal POR PARTES scroll-driven + conector animado al slider.

   Cada línea del headline reveals en su propia fase del scrub timeline
   (no todas juntas). Al final del scroll, el conector SVG dibuja una
   línea vertical + dot descendente que une el hero con la sección del
   slider abajo, dando continuidad visual SPYLT-pure entre las dos
   secciones.

   Skills aplicadas:
     • gsap-plugins SplitText               → char reveal con mask
     • gsap-plugins CustomEase 'explode'    → mark entrance overshoot
     • gsap-timeline position parameter     → choreography por línea
     • gsap-scrolltrigger scrub             → entrance scroll-LINKED
     • gsap-core matchMedia                 → reduced-motion respect
     • gsap-performance                     → transforms only, will-change
     • SVG stroke-dashoffset technique      → line drawing animation
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText } from "./lib/registerGsap.js";

function initProductsHero() {
    const root = document.querySelector("[data-products-hero]");
    if (!root) return;

    const eyebrow = root.querySelector("[data-psh-eyebrow]");
    const lines   = gsap.utils.toArray("[data-psh-line]", root);
    const mark    = root.querySelector("[data-psh-mark]");
    const sub     = root.querySelector("[data-psh-sub]");
    const connectorLine = root.querySelector("[data-psh-connector-line]");
    const connectorDot  = root.querySelector("[data-psh-connector-dot]");

    const lineInners = lines
        .map((l) => l.querySelector(".psh__line-inner"))
        .filter(Boolean);

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion } = ctx.conditions;

        // SplitText sólo en lines de texto puro. El mark queda fuera (anim
        // separada con explode). Hacemos un split POR LÍNEA para poder
        // animar cada línea en su propia fase del scrub timeline.
        let splitsByLine = [];
        let splitInstances = [];
        lineInners.forEach((inner) => {
            if (inner.querySelector("mark")) {
                splitsByLine.push(null);
                return;
            }
            const split = SplitText.create(inner, {
                type: "chars,words",
                aria: "auto",
            });
            splitsByLine.push(split.chars);
            splitInstances.push(split);
        });

        if (reduceMotion) {
            gsap.set([eyebrow, sub, mark, ...lineInners], { autoAlpha: 1, y: 0 });
            splitsByLine.forEach((chars) => {
                if (chars) gsap.set(chars, { y: 0, autoAlpha: 1 });
            });
            // Conector: visible desde el inicio si reduce-motion
            if (connectorLine) gsap.set(connectorLine, { strokeDashoffset: 0 });
            if (connectorDot)  gsap.set(connectorDot, { attr: { r: 4 } });
            return () => splitInstances.forEach((s) => s.revert());
        }

        // Estados iniciales — fully hidden
        gsap.set(eyebrow, { autoAlpha: 0, yPercent: 60 });
        gsap.set(sub,     { autoAlpha: 0, yPercent: 60 });
        splitsByLine.forEach((chars) => {
            if (chars) gsap.set(chars, { yPercent: 110, autoAlpha: 0 });
        });
        gsap.set(mark, {
            scaleX: 0.55, scaleY: 0.85, rotation: -1.6,
            autoAlpha: 0, transformOrigin: "0 50%",
        });
        if (connectorLine) gsap.set(connectorLine, { strokeDashoffset: 100 });
        if (connectorDot)  gsap.set(connectorDot,  { attr: { r: 0 } });

        // Scroll-LINKED scrub timeline. Más range que antes (top 80% → bottom
        // 10%) para que cada línea del headline tenga tiempo dedicado en su
        // propia fase del scrub. Con range corto, las fases se atropellaban;
        // con este range cada línea respira.
        const tl = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: {
                trigger: root,
                start: "top 80%",
                end:   "bottom 10%",
                scrub: 1.2,
                invalidateOnRefresh: true,
            },
        });

        // ============================================================
        // CHOREOGRAPHY POR PARTES — cada línea su fase distintiva
        //
        //   0.00 → 0.10  Eyebrow (y rises + fade in)
        //   0.08 → 0.20  Línea 1 "TENEMOS 6"
        //   0.20 → 0.32  Línea 2 "PRODUCTOS"
        //   0.32 → 0.46  Mark "OBSESIVAMENTE" (explode)
        //   0.46 → 0.58  Línea 4 "DISEÑADOS."
        //   0.58 → 0.70  Sub-copy fade in
        //   0.72 → 1.00  Connector SVG draws + dot pulses
        // ============================================================

        // 1) Eyebrow
        tl.to(eyebrow, { yPercent: 0, autoAlpha: 1, duration: 0.10 }, 0);

        // 2) Línea 1: "TENEMOS 6"
        if (splitsByLine[0]) {
            tl.to(splitsByLine[0], {
                yPercent: 0, autoAlpha: 1,
                duration: 0.12,
                stagger: { amount: 0.08, from: "start" },
                ease: "power3.out",
            }, 0.08);
        }

        // 3) Línea 2: "PRODUCTOS"
        if (splitsByLine[1]) {
            tl.to(splitsByLine[1], {
                yPercent: 0, autoAlpha: 1,
                duration: 0.12,
                stagger: { amount: 0.10, from: "start" },
                ease: "power3.out",
            }, 0.20);
        }

        // 4) Línea 3: "OBSESIVAMENTE" mark con explode (overshoot)
        tl.to(mark, {
            scaleX: 1, scaleY: 1, autoAlpha: 1,
            duration: 0.14,
            ease: "explode",
        }, 0.32);

        // 5) Línea 4: "DISEÑADOS."
        if (splitsByLine[3]) {
            tl.to(splitsByLine[3], {
                yPercent: 0, autoAlpha: 1,
                duration: 0.12,
                stagger: { amount: 0.10, from: "start" },
                ease: "power3.out",
            }, 0.46);
        }

        // 6) Sub-copy
        tl.to(sub, { yPercent: 0, autoAlpha: 1, duration: 0.12 }, 0.58);

        // 7) Connector — line draws + dot pulses al final del scrub.
        //    El timing 0.72-1.0 cubre el último ~28% del scroll de la
        //    sección, justo cuando el user está pasando del hero al slider.
        //    Da continuidad visual entre las dos secciones.
        if (connectorLine) {
            tl.to(connectorLine, {
                strokeDashoffset: 0,
                duration: 0.20,
                ease: "none",
            }, 0.72);
        }
        if (connectorDot) {
            tl.to(connectorDot, {
                attr: { r: 5 },
                duration: 0.06,
                ease: "back.out(2)",
            }, 0.92);
        }

        // Idle: respiración sutil del mark + del dot conector
        gsap.to(mark, {
            scale: 1.022,
            duration: 2.8,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
        });
        if (connectorDot) {
            gsap.to(connectorDot, {
                attr: { r: 6 },
                duration: 1.4,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
            });
        }

        return () => splitInstances.forEach((s) => s.revert());
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductsHero);
} else {
    initProductsHero();
}
