/* =====================================================================
   HOLISTIC — complementos-ideales-animations.js
   Animaciones del componente ComplementosIdeales.astro.

   Diseño deliberadamente DISTINTO al interlude original que vivía
   adentro del slider:
     • Interlude old: chars scatter→assemble + scrub scroll-linked.
     • Este new:     words slide-up from mask + DrawSVG underline +
                     elastic chips. toggleActions (NO scrub).

   Skills aplicadas:
     • gsap-plugins SplitText (words, no chars)
     • gsap-plugins DrawSVGPlugin (línea decorativa)
     • gsap-plugins CustomEase (ya registrado 'explode')
     • gsap-scrolltrigger toggleActions (enter discreto)
     • gsap-timeline (secuencia con labels)
     • gsap-utils.toArray (selectors batch)
     • gsap-core matchMedia (reduced-motion + breakpoints)
     • gsap-performance (transforms + opacity + will-change)
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText, DrawSVGPlugin } from "./lib/registerGsap.js";

function initComplementosIdeales() {
    const root = document.querySelector("[data-complementos-ideales]");
    if (!root) return;

    const eyebrow    = root.querySelector("[data-cmp-eyebrow]");
    const lines      = gsap.utils.toArray("[data-cmp-line]", root);
    const dividerLn  = root.querySelector("[data-cmp-divider-line]");
    const dividerGlow= root.querySelector("[data-cmp-divider-glow]");
    const chips      = gsap.utils.toArray("[data-cmp-chip]", root);
    const chipsSep   = root.querySelector(".cmp__chips-sep");
    const sub        = root.querySelector("[data-cmp-sub]");

    if (!lines.length) return;

    const splits = [];

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion } = ctx.conditions;

        // SplitText por línea — WORDS (no chars, diferente al interlude).
        // Cada palabra dentro del .cmp__line-inner se splittea para poder
        // animarla independiente con stagger.
        const lineInners = lines
            .map((l) => l.querySelector(".cmp__line-inner"))
            .filter(Boolean);

        const wordSplits = lineInners.map((inner) => {
            const s = SplitText.create(inner, {
                type: "words",
                wordsClass: "cmp__word",
                aria: "auto",
            });
            splits.push(s);
            return s;
        });
        const allWords = wordSplits.flatMap((s) => s.words);

        // ============================================================
        // ESTADOS INICIALES — hidden + offset
        // ============================================================
        gsap.set(eyebrow,  { autoAlpha: 0, y: 14 });
        gsap.set(allWords, { yPercent: 105, autoAlpha: 0, transformOrigin: "50% 100%" });
        if (chipsSep) gsap.set(chipsSep, { autoAlpha: 0, scale: 0.6, transformOrigin: "50% 50%" });
        gsap.set(chips,    { autoAlpha: 0, y: 24, scale: 0.85, transformOrigin: "50% 50%" });
        gsap.set(sub,      { autoAlpha: 0, y: 18 });

        // DrawSVGPlugin: setea el line al 0% para que el timeline lo
        // anime desde el centro hacia afuera. El glow circle también
        // arranca pequeño para que crezca con el draw.
        if (dividerLn) {
            gsap.set(dividerLn, { drawSVG: "50% 50%" });
        }
        if (dividerGlow) gsap.set(dividerGlow, { autoAlpha: 0, scale: 0 });

        if (reduceMotion) {
            // reduceMotion: todos visibles, sin animación. drawSVG full.
            gsap.set([eyebrow, ...allWords, chipsSep, ...chips, sub], {
                autoAlpha: 1, y: 0, yPercent: 0, scale: 1,
            });
            if (dividerLn) gsap.set(dividerLn, { drawSVG: "0% 100%" });
            if (dividerGlow) gsap.set(dividerGlow, { autoAlpha: 1, scale: 1 });
            return;
        }

        // ============================================================
        // ENTRANCE TIMELINE — toggleActions enter (no scrub).
        //
        // Trigger: la sección entra cuando su top toca el 75% del
        // viewport. toggleActions play none none reverse → si el user
        // hace scroll up y vuelve a entrar, se replay.
        //
        // Composición por labels:
        //   eyebrow → words → divider → chips → sub
        // ============================================================
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: root,
                start: "top 75%",
                toggleActions: "play none none reverse",
                invalidateOnRefresh: true,
            },
            defaults: { ease: "power3.out" },
        });

        // Eyebrow rises in (0..0.30s real time)
        tl.to(eyebrow, {
            autoAlpha: 1, y: 0,
            duration: 0.5,
        }, 0);

        // Words rise from below mask — stagger desde "start" para que
        // entren orden lectura. Per-word slide UP (NO scatter): el
        // patrón es "telón se levanta" desde abajo de cada línea.
        // Skill: gsap-plugins SplitText words + gsap-utils stagger.
        tl.to(allWords, {
            yPercent: 0, autoAlpha: 1,
            duration: 0.85,
            stagger: { each: 0.08, from: "start" },
            ease: "expo.out",
        }, 0.15);

        // DrawSVG: línea desde 50%-50% hacia 0%-100% — crece desde el
        // centro hacia los extremos. Glow circle scale-in al final del
        // draw (timing un poco solapado).
        // Skill: gsap-plugins DrawSVGPlugin.
        if (dividerLn) {
            tl.to(dividerLn, {
                drawSVG: "0% 100%",
                duration: 0.7,
                ease: "power2.inOut",
            }, 0.55);
        }
        if (dividerGlow) {
            tl.to(dividerGlow, {
                autoAlpha: 1, scale: 1,
                duration: 0.5,
                ease: "back.out(2)",
            }, 0.75);
        }

        // Chips elastic scale-in con stagger lateral (desde el separador
        // hacia afuera). El sep se pone visible primero (lo "ancla").
        if (chipsSep) {
            tl.to(chipsSep, {
                autoAlpha: 1, scale: 1,
                duration: 0.5, ease: "back.out(2.2)",
            }, 0.85);
        }
        tl.to(chips, {
            autoAlpha: 1, y: 0, scale: 1,
            duration: 0.8,
            stagger: 0.10,
            ease: "elastic.out(1, 0.62)",
        }, 0.95);

        // Sub fade-in al final (último elemento del scan visual)
        tl.to(sub, {
            autoAlpha: 1, y: 0,
            duration: 0.6,
        }, 1.10);

        // ============================================================
        // IDLE LOOPS — post-entrance
        // ============================================================
        // Glow del divider pulsa muy sutil (no afecta el draw).
        if (dividerGlow) {
            gsap.to(dividerGlow, {
                scale: 1.18,
                duration: 2.6,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
                delay: 1.6,
            });
        }
        // Separador "·" entre chips respira al unísono con el glow.
        if (chipsSep) {
            gsap.to(chipsSep, {
                opacity: 0.55,
                duration: 2.6,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
                delay: 1.6,
            });
        }
    });

    // Cleanup
    return () => {
        splits.forEach((s) => s.revert());
    };
}

/* ----------------------------------------------------------------------
   Bootstrap — listo cuando DOM y GSAP plugins disponibles.
   Igual que otros scripts del proyecto: re-init en pageshow para
   astro view transitions friendly.
---------------------------------------------------------------------- */
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initComplementosIdeales, { once: true });
} else {
    initComplementosIdeales();
}
