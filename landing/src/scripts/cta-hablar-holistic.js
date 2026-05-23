/* =====================================================================
   CTA "Hablar con Holistic" — animaciones premium (2026-05-23)

   Layers:
     • Halo radial — pulse continuo (scale + opacity yoyo)
     • Ring orbital — rotación continua del SVG dashed
     • 6 partículas — posicionadas en círculo + rotación del container
     • Shimmer sheen — barrido diagonal infinito (CSS keyframes)
     • Pulse rings × 2 — expansion idle (CSS keyframes)
     • Tallo emitido — DrawSVG bottom→top + gota cayendo por MotionPath
     • Entrance reveal — scale-in + glow burst al primer viewport-enter
     • Hover — magnetic ya en data-magnetic + scramble del label

   Skills:
     • gsap-core + gsap-timeline (entrance + idle)
     • gsap-plugins SplitText (chars scramble en hover)
     • gsap-plugins DrawSVGPlugin (tallo growth)
     • gsap-plugins MotionPathPlugin (gota viaja por el tallo)
     • gsap-scrolltrigger (trigger reveal)
     • gsap-utils.random (variabilidad partículas)
     • gsap-performance (transforms + will-change)
   ===================================================================== */

import {
    gsap, mm, BREAKPOINTS, ScrollTrigger,
    SplitText, DrawSVGPlugin, MotionPathPlugin,
} from "./lib/registerGsap.js";

const wrap = document.querySelector("[data-hs-cta-wrap]");
if (wrap) {
    const halo      = wrap.querySelector("[data-hs-cta-halo]");
    const orbit     = wrap.querySelector("[data-hs-cta-orbit]");
    const particles = Array.from(wrap.querySelectorAll("[data-hs-cta-particle]"));
    const label     = wrap.querySelector("[data-hs-cta-label]");
    const stemPath  = wrap.querySelector("[data-hs-cta-stem-path]");
    const stemDrop  = wrap.querySelector("[data-hs-cta-stem-drop]");
    const cta       = wrap.querySelector("[data-hs-cta]");

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion } = ctx.conditions;

        // ====== Estados iniciales ======
        gsap.set(halo,       { scale: 0.85, opacity: 0.55 });
        gsap.set(particles,  { opacity: 0 });
        if (stemPath) gsap.set(stemPath, { drawSVG: "0% 0%" });
        if (stemDrop) gsap.set(stemDrop, { opacity: 0 });

        // ====== Posicionar partículas en círculo ======
        // 6 partículas equidistantes (60° entre cada una). El radio se
        // calcula como % del wrap → escala con el tamaño del botón.
        particles.forEach((p, i) => {
            const angle = (i / particles.length) * Math.PI * 2;
            const radiusVw = 23;  // % del wrap (proporcional)
            const dx = Math.cos(angle) * radiusVw;
            const dy = Math.sin(angle) * radiusVw;
            // CSS centra cada particle con translate(-50%, -50%). Movemos
            // con xPercent/yPercent para acumular sobre ese centrado.
            gsap.set(p, { xPercent: dx, yPercent: dy });
        });

        if (reduceMotion) {
            gsap.set(particles, { opacity: 0.55 });
            if (stemPath) gsap.set(stemPath, { drawSVG: "0% 70%" });
            return;
        }

        // ====== IDLE LOOPS (siempre activos) ======

        // Halo pulse — yoyo scale + opacity
        gsap.to(halo, {
            scale: 1.15, opacity: 0.85,
            duration: 2.6, ease: "sine.inOut",
            yoyo: true, repeat: -1,
        });

        // Ring orbital — rotación CW continua
        gsap.to(orbit, {
            rotation: 360,
            duration: 24, ease: "none", repeat: -1,
            transformOrigin: "50% 50%",
        });

        // Partículas container — rotación CCW (opuesto al ring) para
        // sensación de "campo" en movimiento, no solo rueda.
        gsap.to(".hs__cta-particles", {
            rotation: -360,
            duration: 18, ease: "none", repeat: -1,
            transformOrigin: "50% 50%",
        });

        // Cada partícula con su glow yoyo individual (desincronizado)
        particles.forEach((p, i) => {
            gsap.to(p, {
                scale: gsap.utils.random(0.6, 1.4),
                duration: gsap.utils.random(1.2, 2.2),
                ease: "sine.inOut",
                yoyo: true, repeat: -1,
                delay: i * 0.18,
            });
        });

        // ====== ENTRANCE (scroll-triggered, una vez) ======
        // Particles + tallo aparecen cuando el CTA entra al viewport.
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: wrap,
                start: "top 78%",
                once: true,
            },
            defaults: { ease: "power3.out" },
        });

        // Particles fade-in escalonado
        tl.to(particles, {
            opacity: 0.85, duration: 0.7,
            stagger: { amount: 0.5, from: "random" },
        }, 0);

        // Botón rebote sutil al entrar (refuerza la presencia)
        tl.fromTo(cta, { scale: 0.94 }, { scale: 1, duration: 0.8, ease: "back.out(2)" }, 0.1);

        // Tallo dibuja bottom→top
        if (stemPath) {
            tl.to(stemPath, {
                drawSVG: "0% 100%",
                duration: 1.4, ease: "power2.inOut",
            }, 0.35);
        }

        // ====== TALLO IDLE — gotas que viajan continuamente hacia abajo ======
        // Una gota verde aparece arriba del tallo y desciende por el path
        // hasta desaparecer al final. Loop infinito con delay randomizado.
        if (stemPath && stemDrop) {
            const dropLoop = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
            dropLoop.set(stemDrop, { opacity: 0 });
            dropLoop.to(stemDrop, { opacity: 1, duration: 0.18 });
            dropLoop.to(stemDrop, {
                motionPath: {
                    path: stemPath,
                    align: stemPath,
                    alignOrigin: [0.5, 0.5],
                    start: 0, end: 1,
                    autoRotate: false,
                },
                duration: 2.2, ease: "power2.in",
            }, "<");
            dropLoop.to(stemDrop, { opacity: 0, duration: 0.2 }, ">-0.25");
            // Empieza después del reveal del tallo
            dropLoop.delay(2.2);
        }

        // ====== HOVER — scramble del label + boost de halo ======
        let labelSplit = null;
        try {
            labelSplit = SplitText.create(label, { type: "chars", aria: "hidden" });
        } catch (_) {}

        const onEnter = () => {
            // Boost halo
            gsap.to(halo, { scale: 1.25, opacity: 1, duration: 0.35, ease: "power2.out", overwrite: "auto" });
            // Boost particles
            gsap.to(particles, { scale: 1.5, opacity: 1, duration: 0.35, stagger: 0.02, ease: "power2.out", overwrite: "auto" });
            // Scramble chars del label — flicker individual + restore
            if (labelSplit && labelSplit.chars) {
                gsap.fromTo(labelSplit.chars,
                    { y: -3, opacity: 0.6 },
                    { y: 0, opacity: 1, duration: 0.4, stagger: 0.02, ease: "back.out(2.2)", overwrite: "auto" }
                );
            }
        };
        const onLeave = () => {
            gsap.to(halo, { scale: 1.15, opacity: 0.85, duration: 0.6, ease: "power2.out", overwrite: "auto" });
            gsap.to(particles, { scale: 1, opacity: 0.85, duration: 0.5, stagger: 0.02, ease: "power2.out", overwrite: "auto" });
        };
        cta?.addEventListener("mouseenter", onEnter);
        cta?.addEventListener("mouseleave", onLeave);

        return () => {
            cta?.removeEventListener("mouseenter", onEnter);
            cta?.removeEventListener("mouseleave", onLeave);
            if (labelSplit) labelSplit.revert();
        };
    });
}
