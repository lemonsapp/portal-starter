/* =====================================================================
   LeCmpTransition — script (2026-05-23)

   Transición editorial scroll-driven entre LineasEstrella (bg blanco) y
   ComplementosIdeales (bg dark). Master timeline scrub:

   Progress 0 → 0.4 : Label 1 "MÁS HOLISTIC" entra (chars-rise) + línea
                       vertical se dibuja
   Progress 0.4 → 0.6 : Label 1 fade out (chars + slight up)
   Progress 0.5 → 0.75: Bg dark reveal (clip-path inset 100% → 0%)
   Progress 0.6 → 1.0 : Label 2 "VAN COMPLEMENTOS" entra (chars-rise sobre dark)

   Skills:
     • gsap-scrolltrigger scrub: 1 → todo tied a scroll
     • gsap-plugins SplitText      → chars per word
     • gsap-timeline master        → orquestación
     • gsap-core matchMedia        → reduced-motion + mobile
     • gsap-performance            → transforms + will-change
   ===================================================================== */

import {
    gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText,
} from "./lib/registerGsap.js";

const root = document.querySelector("[data-le-cmp-transition]");
if (root) {
    const darkReveal = root.querySelector("[data-lct-dark-reveal]");
    const labelW1    = root.querySelector("[data-lct-label-1]");
    const labelW2    = root.querySelector("[data-lct-label-2]");
    const linePath   = root.querySelector("[data-lct-line-path]");
    const words1     = labelW1?.querySelectorAll("[data-lct-word]");
    const words2     = labelW2?.querySelectorAll("[data-lct-word]");

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion, isMobile } = ctx.conditions;

        // Estados iniciales
        gsap.set(darkReveal, { clipPath: "inset(100% 0 0 0)" });
        gsap.set(labelW1, { autoAlpha: 0 });
        gsap.set(labelW2, { autoAlpha: 0 });
        if (linePath) gsap.set(linePath, { drawSVG: "0% 50%" });  // arranca chico en el centro

        // SplitText chars de cada word de ambos labels
        const splits = [];
        try {
            words1?.forEach((w) => {
                const s = SplitText.create(w, { type: "chars", aria: "hidden" });
                splits.push(s);
                gsap.set(s.chars, { yPercent: 120, opacity: 0 });
            });
            words2?.forEach((w) => {
                const s = SplitText.create(w, { type: "chars", aria: "hidden" });
                splits.push(s);
                gsap.set(s.chars, { yPercent: 120, opacity: 0 });
            });
        } catch (_) {}

        const chars1 = splits.slice(0, words1?.length || 0).flatMap((s) => s.chars);
        const chars2 = splits.slice(words1?.length || 0).flatMap((s) => s.chars);

        if (reduceMotion) {
            gsap.set([labelW1, labelW2], { autoAlpha: 1 });
            gsap.set(darkReveal, { clipPath: "inset(50% 0 0 0)" });
            gsap.set(chars2, { yPercent: 0, opacity: 1 });
            return () => splits.forEach((s) => s.revert());
        }

        // Master timeline scrub
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: root,
                start: "top bottom",
                end:   "bottom top",
                scrub: isMobile ? 0.5 : 1.0,
                invalidateOnRefresh: true,
            }
        });

        // 0 → 0.4: Label 1 entra
        tl.to(labelW1, { autoAlpha: 1, duration: 0.1, ease: "none" }, 0.05);
        tl.to(chars1, {
            yPercent: 0, opacity: 1,
            duration: 0.35, ease: "expo.out",
            stagger: 0.012,
        }, 0.05);

        // Línea decorativa se dibuja en el mismo tramo
        if (linePath) {
            tl.to(linePath, {
                drawSVG: "0% 100%",
                duration: 0.40, ease: "power2.inOut",
            }, 0.10);
        }

        // 0.4 → 0.55: Label 1 sale (chars vuelan arriba + fade)
        tl.to(chars1, {
            yPercent: -120, opacity: 0,
            duration: 0.15, ease: "expo.in",
            stagger: { each: 0.008, from: "end" },
        }, 0.40);
        tl.to(labelW1, { autoAlpha: 0, duration: 0.05 }, 0.54);

        // 0.50 → 0.75: Bg dark reveal — clip-path inset(100% 0 0 0) → inset(0% 0 0 0)
        tl.to(darkReveal, {
            clipPath: "inset(0% 0 0 0)",
            duration: 0.25, ease: "power2.inOut",
        }, 0.50);

        // 0.6 → 1.0: Label 2 entra desde dark
        tl.to(labelW2, { autoAlpha: 1, duration: 0.05 }, 0.62);
        tl.to(chars2, {
            yPercent: 0, opacity: 1,
            duration: 0.32, ease: "expo.out",
            stagger: 0.014,
        }, 0.62);

        // Cleanup
        return () => splits.forEach((s) => s.revert());
    });
}
