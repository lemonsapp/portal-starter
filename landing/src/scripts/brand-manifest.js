/* =====================================================================
   HOLISTIC — brand-manifest.js
   Sección "MANIFIESTO HOLISTIC" — reemplazo de la antigua "Nutrición Superior".
   Concepto + animaciones completamente nuevos.

   Skills aplicadas (citadas inline):
     • gsap-core matchMedia      → reduced-motion + breakpoints
     • gsap-timeline             → image stack rotator
     • gsap-scrolltrigger        → scrub para counters + reveal claim
     • gsap-plugins (Flip)       → core de la rotación de productos (NUEVO uso)
     • gsap-plugins (SplitText)  → reveal claim word-by-word
     • gsap-utils.snap           → counters enteros
     • gsap-utils.toArray/random → setup
     • gsap-performance          → transforms only, will-change limitado
     • accessibility             → aria-live actualizada por counters
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText } from "./lib/registerGsap.js";
import { Flip } from "gsap/Flip";

if (!window.__holisticFlipRegistered) {
    gsap.registerPlugin(Flip);
    window.__holisticFlipRegistered = true;
}

function initBrandManifest() {
    const root = document.querySelector("[data-brand-manifest]");
    if (!root) return;

    const cols          = Array.from(root.querySelectorAll("[data-bm-col]"));
    const tracks        = Array.from(root.querySelectorAll("[data-bm-track]"));
    const eyebrow       = root.querySelector("[data-bm-eyebrow]");
    const claim         = root.querySelector("[data-bm-claim]");
    const lede          = root.querySelector("[data-bm-lede]");
    const stage         = root.querySelector("[data-bm-stage]");
    const cards         = Array.from(root.querySelectorAll("[data-bm-card]"));
    const statValues    = Array.from(root.querySelectorAll("[data-bm-stat-value]"));
    const statBoxes     = Array.from(root.querySelectorAll("[data-bm-stat]"));

    mm.add(BREAKPOINTS, (ctx) => {
        const { isMobile, reduceMotion } = ctx.conditions;

        // ----------------------------------------------------------
        // 1) MARQUEES VERTICALES (infinite loop con yPercent ±50)
        //    Patrón gsap-performance: transforms only + will-change CSS.
        // ----------------------------------------------------------
        const marqueeTweens = [];
        if (!reduceMotion && tracks.length) {
            tracks.forEach((track, i) => {
                const dir = cols[i]?.dataset.dir || "up";
                const dur = isMobile ? 28 : 36 + i * 4; // distintos tempos
                const tween = gsap.fromTo(track,
                    { yPercent: dir === "up" ? 0 : -50 },
                    {
                        yPercent: dir === "up" ? -50 : 0,
                        duration: dur,
                        ease: "none",
                        repeat: -1,
                    }
                );
                marqueeTweens.push(tween);
            });
        }

        // ----------------------------------------------------------
        // 2) CLAIM REVEAL — SplitText words con stagger from "start"
        // ----------------------------------------------------------
        let splitClaim = null;
        if (claim) {
            splitClaim = SplitText.create(claim, {
                type: "lines, words",
                mask: "lines",
                linesClass: "bm__claim-split-line",
                wordsClass: "bm__claim-split-word",
                aria: "auto",
            });
            const cwords = splitClaim.words;
            gsap.set(cwords, { yPercent: 110, rotationX: -45, autoAlpha: 0 });

            if (reduceMotion) {
                gsap.set(cwords, { yPercent: 0, rotationX: 0, autoAlpha: 1 });
            } else {
                gsap.to(cwords, {
                    yPercent: 0, rotationX: 0, autoAlpha: 1,
                    duration: 1.0,
                    stagger: { amount: 0.7, from: "start" },
                    ease: "back.out(1.4)",
                    scrollTrigger: {
                        trigger: root, start: "top 65%",
                        toggleActions: "play none none reverse",
                    },
                });
            }
        }

        // Eyebrow + lede secuencial
        if (eyebrow) {
            gsap.from(eyebrow, {
                autoAlpha: 0, y: 22, duration: 0.7, ease: "power3.out",
                scrollTrigger: {
                    trigger: root, start: "top 75%",
                    toggleActions: "play none none reverse",
                },
            });
        }
        if (lede) {
            gsap.from(lede, {
                autoAlpha: 0, y: 26, duration: 0.8, ease: "power3.out", delay: 0.6,
                scrollTrigger: {
                    trigger: root, start: "top 65%",
                    toggleActions: "play none none reverse",
                },
            });
        }

        // ----------------------------------------------------------
        // 3) IMAGE STACK ROTATOR — usa Flip plugin (skill gsap-plugins).
        //    Cada 2.8s movemos la card del frente al final del DOM →
        //    Flip captura estados antes/después y anima la transición
        //    sin "pop" — los productos se reordenan suavemente.
        // ----------------------------------------------------------
        if (cards.length && stage) {
            // Setup: cada card a una posición/rotación distinta basada
            // en su índice → "stack" 3D con depth.
            const arrange = () => {
                const list = Array.from(stage.children);
                list.forEach((c, i) => {
                    const offset = i;
                    gsap.set(c, {
                        zIndex: list.length - i,
                        rotation: i === 0 ? 0 : (i % 2 === 0 ? -8 : 8) * Math.min(i, 3),
                        x: i === 0 ? 0 : (i % 2 === 0 ? -1 : 1) * 22 * Math.min(i, 3),
                        y: i * 14,
                        scale: i === 0 ? 1 : 1 - 0.05 * Math.min(i, 3),
                        autoAlpha: i < 4 ? 1 - 0.15 * i : 0,
                    });
                    c.classList.toggle("is-front", i === 0);
                });
            };
            arrange();

            if (!reduceMotion) {
                // Auto rotation: cada N segundos, mover el primer hijo
                // del DOM al final → Flip captures el cambio.
                const rotateOnce = () => {
                    const state = Flip.getState(cards, {
                        props: "rotation,zIndex,opacity,visibility",
                    });
                    // Move first child to the end
                    stage.appendChild(stage.firstElementChild);
                    arrange();
                    Flip.from(state, {
                        duration: 0.95,
                        ease: "power3.inOut",
                        absolute: false,
                        onEnter: (el) => gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }),
                    });
                };

                // Lo arrancamos cuando entra al viewport, lo paramos cuando sale
                let rotateInterval = null;
                ScrollTrigger.create({
                    trigger: root,
                    start: "top 70%",
                    end: "bottom 20%",
                    onEnter: () => {
                        if (rotateInterval) clearInterval(rotateInterval);
                        rotateInterval = setInterval(rotateOnce, 2800);
                    },
                    onEnterBack: () => {
                        if (rotateInterval) clearInterval(rotateInterval);
                        rotateInterval = setInterval(rotateOnce, 2800);
                    },
                    onLeave: () => rotateInterval && clearInterval(rotateInterval),
                    onLeaveBack: () => rotateInterval && clearInterval(rotateInterval),
                });

                // Pausar al hover
                stage.addEventListener("mouseenter", () => rotateInterval && clearInterval(rotateInterval));
                stage.addEventListener("mouseleave", () => {
                    if (rotateInterval) clearInterval(rotateInterval);
                    rotateInterval = setInterval(rotateOnce, 2800);
                });

                // Cleanup
                ctx.add(() => () => rotateInterval && clearInterval(rotateInterval));
            }
        }

        // ----------------------------------------------------------
        // 4) STAT COUNTERS — count-up scrub-driven.
        //    Cada stat-value tiene data-target. Animamos un proxy obj
        //    {n: 0} → {n: target} con snap a entero, y onUpdate
        //    actualizamos textContent. ScrollTrigger scrub para que
        //    el conteo siga el scroll (más cinemático que un to único).
        // ----------------------------------------------------------
        if (statValues.length) {
            statValues.forEach((el) => {
                const target = parseFloat(el.dataset.target || "0");
                const proxy = { n: 0 };

                if (reduceMotion) {
                    el.textContent = String(target);
                    return;
                }

                gsap.to(proxy, {
                    n: target,
                    duration: 1,
                    ease: "none",
                    snap: { n: 1 }, // gsap-utils.snap inline en tween
                    onUpdate: () => { el.textContent = String(Math.round(proxy.n)); },
                    scrollTrigger: {
                        trigger: el,
                        start: "top 85%",
                        end: "top 50%",
                        scrub: 0.6,
                    },
                });
            });

            // Stat boxes pop-in con stagger desde "start"
            gsap.from(statBoxes, {
                autoAlpha: 0, y: 30, scale: 0.92,
                duration: 0.7,
                stagger: 0.12,
                ease: "back.out(1.6)",
                scrollTrigger: {
                    trigger: root.querySelector("[data-bm-stats]"),
                    start: "top 85%",
                    toggleActions: "play none none reverse",
                },
            });
        }

        // Cleanup matchMedia: revert SplitText
        return () => {
            if (splitClaim) splitClaim.revert();
            marqueeTweens.forEach((t) => t.kill());
        };
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBrandManifest);
} else {
    initBrandManifest();
}
