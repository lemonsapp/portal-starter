/* =====================================================================
   HOLISTIC — ease-of-use-animations.js (v5 — turbulence warp)
   Sticky pattern (300vh padre, viewport interno sticky 100vh) leido por
   ScrollTrigger sin pin. Cada panel transition modula un filtro SVG
   compartido `#promise-warp` (feTurbulence + feDisplacementMap):
    - Pre-transicion: scale 0 (texto limpio) en panel saliente.
    - Mid-transicion: scale 25 (texto disuelto en ruido) -> mientras
      esta disuelto, autoAlpha del panel viejo cae y el nuevo sube
      (el viewer no nota el swap porque ambos son ruido).
    - Post-transicion: scale vuelve a 0 (texto nuevo limpio).
    - Idle: seed del feTurbulence cambia a alta frecuencia para que el
      texto vibre como en heat-haze.
   Patron rara vez usado en webs modernas porque requiere SVG filter
   primitives directamente, no shortcuts CSS.
   Skills aplicados:
     gsap-core (attr tweens sobre nodos SVG), gsap-timeline (labels y
     anidado), gsap-plugins (DrawSVG en underline), gsap-utils (random).
   ===================================================================== */

import { gsap, mm, BREAKPOINTS, DrawSVGPlugin, SplitText } from "./lib/registerGsap.js";
import { burst } from "./lib/burst.js";

function initEaseOfUse() {
    const root = document.querySelector("[data-ease-of-use]");
    if (!root) return;

    const bg = root.querySelector("[data-ease-bg]");
    const blobs = Array.from(root.querySelectorAll("[data-ease-blob]"));
    const panels = Array.from(root.querySelectorAll("[data-promise]"));
    const steps = Array.from(root.querySelectorAll("[data-ease-step]"));
    const underlines = panels.map((p) => p.querySelector("[data-promise-underline]"));
    const eyebrow = root.querySelector("[data-ease-eyebrow]");
    const eyebrowText = root.querySelector("[data-ease-eyebrow-text]");

    // Cada panel tiene un title con palabras → splitteamos chars para
    // petal in/out cuando se cambia de panel.
    const panelTitles = panels.map((p) => p.querySelector("[data-promise-title]"));
    const panelChars = []; // se llena dentro del matchMedia con SplitText

    if (!panels.length) return;

    // Refs al filtro warp compartido (vive en el SVG defs del componente).
    const warpDisp = document.querySelector("[data-promise-disp]");
    const warpNoise = document.querySelector("[data-promise-noise]");

    const colors = panels.map((p) =>
        p.style.getPropertyValue("--promise-color").trim() || "#F7F3EA"
    );

    underlines.forEach((u) => {
        if (u) gsap.set(u, { drawSVG: 0 });
    });

    mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion, isMobile } = context.conditions;

        // Estado base: paneles invisibles. Panel 0 visible.
        gsap.set(panels, { autoAlpha: 0, yPercent: 8 });
        gsap.set(panels[0], { autoAlpha: 1, yPercent: 0 });
        gsap.set(bg, { backgroundColor: colors[0] });
        if (warpDisp) gsap.set(warpDisp, { attr: { scale: 0 } });
        if (underlines[0]) gsap.set(underlines[0], { drawSVG: "0% 100%" });

        if (reduceMotion) {
            gsap.set(panels, { autoAlpha: 0, yPercent: 0 });
            gsap.set(panels[0], { autoAlpha: 1 });
            if (warpDisp) gsap.set(warpDisp, { attr: { scale: 0 } });
            return;
        }

        // ----------- IDLE BOIL del filtro warp -----------
        // El seed cambia con alta frecuencia para que cuando el scale
        // del displacement esta > 0, el texto "ebulle" en lugar de
        // moverse uniformemente. Cuando scale = 0, no hay efecto visible
        // (el seed cambia "por dentro" sin costo).
        // En móvil NO corremos el boil: cambiar el `seed` de feTurbulence
        // recomputa TODO el campo de ruido fractal cada ~100ms para siempre
        // (aunque scale=0), y es de lo más caro que hay en GPU/CPU de celular.
        // El warp de transición entre paneles sigue funcionando igual.
        let warpBoil = null;
        if (warpNoise && !isMobile) {
            warpBoil = gsap.timeline({ repeat: -1, repeatRefresh: true });
            warpBoil.to(warpNoise, {
                attr: { seed: () => Math.floor(gsap.utils.random(0, 999)) },
                duration: () => gsap.utils.random(0.06, 0.15, 0.02),
                ease: "steps(1)",
            });
        }

        // ---- Eyebrow grande con SplitText words: cada palabra entra
        // independiente con stagger, mucho más impactante que un fade en bloque.
        let eyebrowSplit = null;
        if (eyebrowText) {
            eyebrowSplit = SplitText.create(eyebrowText, {
                type: "words, chars",
                mask: "words",
                wordsClass: "eyebrow-word",
                charsClass: "eyebrow-char",
                aria: "auto",
            });
            const ewords = eyebrowSplit.words;
            gsap.set(ewords, { yPercent: 110, rotationX: -45, autoAlpha: 0 });
            gsap.from(eyebrow, {
                autoAlpha: 0, y: 24, duration: 0.5, ease: "power3.out",
                scrollTrigger: {
                    trigger: root, start: "top 75%",
                    toggleActions: "play none none reverse",
                },
            });
            gsap.to(ewords, {
                yPercent: 0, rotationX: 0, autoAlpha: 1,
                duration: 1.0,
                stagger: { amount: 0.5, from: "start" },
                ease: "back.out(1.6)",
                scrollTrigger: {
                    trigger: root, start: "top 70%",
                    toggleActions: "play none none reverse",
                },
            });
        }

        // ---- Split chars de cada panel title para petal in/out por panel
        const panelSplits = panelTitles.map((t) => {
            if (!t) return null;
            return SplitText.create(t, {
                type: "chars",
                mask: "chars",
                charsClass: "promise-char",
                aria: "hidden",
            });
        });
        // panel 0: visible · resto: chars iniciales abajo + autoAlpha 0
        panelSplits.forEach((s, i) => {
            if (!s) return;
            if (i !== 0) {
                gsap.set(s.chars, {
                    yPercent: 110, rotationX: -45, autoAlpha: 0,
                    transformOrigin: "50% 100%",
                });
            }
        });

        const segmentLength = 1 / panels.length;

        const tl = gsap.timeline({
            scrollTrigger: {
                id: "ease-of-use",
                trigger: root,
                start: "top top",
                end: "bottom bottom",
                scrub: 0.6,
                invalidateOnRefresh: true,
                refreshPriority: -2,
                onUpdate: (self) => {
                    const idx = Math.min(
                        panels.length - 1,
                        Math.floor(self.progress / segmentLength)
                    );
                    steps.forEach((s, i) => s.classList.toggle("is-active", i === idx));
                    panels.forEach((p, i) => p.classList.toggle("is-active", i === idx));
                },
            },
        });

        const HOLD = 0.6;
        const TRANS = 0.3;

        for (let i = 1; i < panels.length; i++) {
            const transStart = i * segmentLength - segmentLength * TRANS;
            const transDur = segmentLength * TRANS;

            // ----- WARP PUMP -----
            // Filter scale: 0 -> 25 al inicio de la transicion, queda alto
            // mientras swappeamos paneles, vuelve a 0 al final. Como el
            // filtro es compartido, los paneles que estan saliendo y
            // entrando ambos quedan disueltos en ruido al pico — el viewer
            // nunca ve un "salto" porque ambos son indistinguibles.
            // En móvil NO: el filtro está desactivado por CSS (sin boil el
            // displacement estático distorsionaba el texto). La transición
            // queda como cross-fade + letras pétalo, suave y sin filtro SVG.
            if (warpDisp && !isMobile) {
                tl.to(warpDisp, {
                    attr: { scale: 25 },
                    duration: transDur * 0.35,
                    ease: "power3.in",
                }, transStart);
                tl.to(warpDisp, {
                    attr: { scale: 0 },
                    duration: transDur * 0.5,
                    ease: "power3.out",
                }, transStart + transDur * 0.45);
            }

            // ----- Cross-fade entre paneles dentro del pico de warp -----
            tl.to(panels[i - 1], {
                autoAlpha: 0,
                duration: transDur * 0.25,
                ease: "none",
            }, transStart + transDur * 0.3);

            tl.fromTo(panels[i],
                { autoAlpha: 0, yPercent: 0 },
                {
                    autoAlpha: 1,
                    duration: transDur * 0.3,
                    ease: "none",
                },
                transStart + transDur * 0.4
            );

            // ----- Petal letters out / in (chars del title) -----
            // El panel saliente vuela las letras como pétalos hacia los lados,
            // y el entrante las trae desde abajo con rotación. Sincronizado
            // con el pico de warp para que el viewer no vea overlapping limpio.
            const charsOut = panelSplits[i - 1] ? panelSplits[i - 1].chars : [];
            const charsIn  = panelSplits[i]     ? panelSplits[i].chars     : [];

            if (charsOut.length) {
                tl.to(charsOut, {
                    yPercent: -120,
                    rotationX: 60,
                    autoAlpha: 0,
                    duration: transDur * 0.45,
                    ease: "power2.in",
                    stagger: { amount: transDur * 0.15, from: "edges" },
                }, transStart + transDur * 0.05);
            }
            if (charsIn.length) {
                tl.fromTo(charsIn,
                    { yPercent: 110, rotationX: -45, autoAlpha: 0 },
                    {
                        yPercent: 0, rotationX: 0, autoAlpha: 1,
                        duration: transDur * 0.55,
                        ease: "back.out(1.4)",
                        stagger: { amount: transDur * 0.18, from: "start" },
                    },
                    transStart + transDur * 0.45
                );
            }

            // Liquid paint splash en bg (wipe de color subyacente).
            tl.set(blobs, { attr: { fill: colors[i] } }, transStart);
            tl.to(blobs, {
                attr: {
                    r: () => gsap.utils.random(420, 580, 10),
                    cx: () => gsap.utils.random(150, 850, 10),
                    cy: () => gsap.utils.random(200, 800, 10),
                },
                duration: transDur * 0.7,
                ease: "power3.out",
                stagger: { amount: transDur * 0.2, from: "random" },
            }, transStart);
            tl.set(bg, { backgroundColor: colors[i] }, transStart + transDur * 0.85);
            tl.set(blobs, { attr: { r: 0 } }, transStart + transDur * 0.9);

            // Underline draw — despues de la transicion, mientras el panel
            // ya esta limpio.
            if (underlines[i]) {
                const underlineStart = i * segmentLength + segmentLength * 0.1;
                tl.fromTo(underlines[i],
                    { drawSVG: "0% 0%" },
                    {
                        drawSVG: "0% 100%",
                        duration: segmentLength * 0.4,
                        ease: "power2.out",
                    },
                    underlineStart
                );
            }
        }

        // Cleanup matchMedia: revertir SplitText (eyebrow + panel titles)
        return () => {
            if (eyebrowSplit) eyebrowSplit.revert();
            panelSplits.forEach((s) => s && s.revert());
        };
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEaseOfUse);
} else {
    initEaseOfUse();
}
