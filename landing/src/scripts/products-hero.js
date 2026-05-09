/* =====================================================================
   products-hero.js — Hero text-only ANTES del slider (SPYLT-style).
   Char reveal dramático scroll-driven con SplitText + mark explode.
   Cuando el user llega a la sección, el texto se va revelando como
   "Stir up your fearless past" de SPYLT.com.

   Skills aplicadas:
     • gsap-plugins SplitText               → char reveal con mask
     • gsap-plugins CustomEase 'explode'    → mark entrance overshoot
     • gsap-timeline                        → choreography multi-step
     • gsap-scrolltrigger scrub             → entrance scroll-LINKED
     • gsap-core matchMedia                 → reduced-motion respect
     • gsap-performance                     → transforms only, will-change
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText } from "./lib/registerGsap.js";

function initProductsHero() {
    const root = document.querySelector("[data-products-hero]");
    if (!root) return;

    const eyebrow = root.querySelector("[data-psh-eyebrow]");
    const lines   = gsap.utils.toArray("[data-psh-line]", root);
    const mark    = root.querySelector("[data-psh-mark]");
    const sub     = root.querySelector("[data-psh-sub]");

    const lineInners = lines
        .map((l) => l.querySelector(".psh__line-inner"))
        .filter(Boolean);

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion } = ctx.conditions;

        // SplitText sólo en lines de texto puro. La línea con <mark>
        // queda fuera del split — el mark se anima por separado.
        let splits = [];
        lineInners.forEach((inner) => {
            if (inner.querySelector("mark")) return;
            const split = SplitText.create(inner, { type: "chars,words", aria: "auto" });
            splits.push(split);
        });
        const allChars = splits.flatMap((s) => s.chars);

        if (reduceMotion) {
            gsap.set([eyebrow, sub, mark, ...lineInners], { autoAlpha: 1, y: 0 });
            if (allChars.length) gsap.set(allChars, { y: 0, autoAlpha: 1 });
            return () => splits.forEach((s) => s.revert());
        }

        // Estados iniciales — fully hidden
        gsap.set(eyebrow, { autoAlpha: 0, yPercent: 60 });
        gsap.set(sub,     { autoAlpha: 0, yPercent: 60 });
        gsap.set(allChars, { yPercent: 110, autoAlpha: 0 });
        gsap.set(mark, {
            scaleX: 0.55, scaleY: 0.85, rotation: -1.6,
            autoAlpha: 0, transformOrigin: "0 50%",
        });

        // Timeline scroll-LINKED. Trigger: la sección misma.
        // start "top 75%": cuando el top de la sección está al 75% del
        //                  viewport (sección apareciendo desde abajo).
        // end   "top 15%": cuando llega al 15% del top (casi en posición).
        // Esto da 60% de viewport-height de scroll para que la animación
        // pase, dramática y completamente visible al user.
        const tl = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: {
                trigger: root,
                start: "top 75%",
                end:   "top 15%",
                scrub: 1.2,
                invalidateOnRefresh: true,
            },
        });

        // Choreography sobre rango 0-1 del scrub
        tl.to(eyebrow, { yPercent: 0, autoAlpha: 1, duration: 0.18 }, 0);
        if (allChars.length) {
            tl.to(allChars, {
                yPercent: 0, autoAlpha: 1,
                duration: 0.50,
                stagger: { amount: 0.40, from: "start" },
                ease: "power3.out",
            }, 0.04);
        }
        tl.to(mark, {
            scaleX: 1, scaleY: 1, autoAlpha: 1,
            duration: 0.28,
            ease: "explode",
        }, 0.32);
        tl.to(sub, { yPercent: 0, autoAlpha: 1, duration: 0.22 }, 0.50);

        // Idle: respiración sutil del mark (sin scrolltrigger)
        gsap.to(mark, {
            scale: 1.022,
            duration: 2.8,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
        });

        return () => splits.forEach((s) => s.revert());
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductsHero);
} else {
    initProductsHero();
}
