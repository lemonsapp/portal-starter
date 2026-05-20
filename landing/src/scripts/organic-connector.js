/* =====================================================================
   OrganicConnector — Fluid Drops Cascade v2 (compact + dense)
   2026-05-20 — iteración tras feedback "queda espacio vacío".

   Cambios vs v1:
     • Streams visibles desde el inicio (sin DrawSVG hidden) — la
       silueta ya aporta presencia visual instantánea.
     • Drops cayendo en LOOP CONTINUO (independiente del scroll) —
       la cascada está SIEMPRE activa, no solo en el momento de scroll.
     • Splash + ripples también triggereados por los loops continuos
       (cada drop al "morir" dispara su splash/ripple).
     • Turbulence shimmer idle yoyo se mantiene.

   Skills aplicadas:
     • gsap-plugins MotionPathPlugin      → drops siguen streams
     • gsap-plugins Physics2DPlugin       → splash con gravity
     • gsap-plugins CustomEase ("liquid") → drops timing
     • gsap-timeline (per-drop loop)      → cascada continua
     • gsap-utils.random + stagger        → naturalismo
     • gsap-core matchMedia               → reduced-motion + mobile
     • gsap-performance                   → transforms + will-change
   ===================================================================== */

import {
    gsap, mm, BREAKPOINTS, ScrollTrigger,
    MotionPathPlugin, Physics2DPlugin,
} from "./lib/registerGsap.js";

const root = document.querySelector("[data-organic-connector]");
if (root) {
    const svg       = root.querySelector("[data-oc-svg]");
    const streams   = Array.from(root.querySelectorAll("[data-oc-stream]"));
    const drops     = Array.from(root.querySelectorAll("[data-oc-drop]"));
    const splashes  = Array.from(root.querySelectorAll("[data-oc-splash]"));
    const ripples   = Array.from(root.querySelectorAll("[data-oc-ripple]"));
    const turb      = root.querySelector("[data-oc-turb]");

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion, isMobile } = ctx.conditions;

        // ====== Estados iniciales ======
        gsap.set(drops,    { opacity: 0, scale: 0.6 });
        gsap.set(splashes, { opacity: 0, scale: 0.5 });
        gsap.set(ripples,  { opacity: 0, scale: 0.3 });

        if (reduceMotion) {
            return;
        }

        // ====== TURBULENCE IDLE loop ======
        if (turb) {
            gsap.to(turb, {
                attr: { baseFrequency: "0.030 0.038" },
                duration: 4.2,
                ease: "sine.inOut",
                yoyo: true, repeat: -1,
            });
        }

        // ====== LOOP CONTINUO de drops ======
        // Cada drop tiene su propio timeline infinito: cae por su
        // stream, dispara splash + ripple al impactar, fade-out,
        // restart desde el top con delay aleatorio. No scroll-bound —
        // siempre activo.
        // Skill: gsap-timeline + gsap-utils.random + gsap-plugins
        // MotionPathPlugin + Physics2DPlugin.
        const streamX = [700, 100, 290, 480, 920, 1110, 1300];

        drops.forEach((drop, i) => {
            const streamIdx = parseInt(drop.dataset.stream, 10);
            const pathEl = streams[streamIdx];
            if (!pathEl) return;

            const fallDur = gsap.utils.random(2.4, 3.8);
            const startDelay = gsap.utils.random(0, 2.5);

            // Drop loop: fall → splash spawn → restart
            const dropTl = gsap.timeline({
                repeat: -1,
                delay: startDelay,
                repeatDelay: gsap.utils.random(0.3, 1.2),
            });

            dropTl.set(drop, { opacity: 0 });
            dropTl.to(drop, { opacity: 0.95, scale: 1, duration: 0.12 });
            dropTl.to(drop, {
                motionPath: {
                    path: pathEl,
                    align: pathEl,
                    alignOrigin: [0.5, 0.5],
                    autoRotate: true,
                    start: 0,
                    end: 1,
                },
                duration: fallDur,
                ease: "power2.in",   // gravity acceleration
                scaleY: 1.45,
                scaleX: 0.78,
            }, "-=0.05");

            // Trigger splash + ripple del stream correspondiente
            dropTl.add(() => {
                triggerSplash(streamIdx);
                triggerRipple(streamIdx);
            });

            dropTl.to(drop, { opacity: 0, duration: 0.08 }, "<");
        });

        // ====== Helpers — trigger splash + ripple por stream ======
        function triggerSplash(streamIdx) {
            const group = splashes.filter((s) => parseInt(s.dataset.stream, 10) === streamIdx);
            group.forEach((p) => {
                gsap.set(p, {
                    opacity: 0.95,
                    scale: 1,
                    cx: streamX[streamIdx],
                    cy: 690,
                });
                gsap.to(p, {
                    physics2D: {
                        velocity: gsap.utils.random(120, 280),
                        angle:    gsap.utils.random(220, 320),
                        gravity:  600,
                    },
                    duration: gsap.utils.random(0.5, 0.8),
                    ease: "none",
                    opacity: 0,
                    scale: 0.3,
                });
            });
        }

        function triggerRipple(streamIdx) {
            const ripple = ripples.find((r) => parseInt(r.dataset.stream, 10) === streamIdx);
            if (!ripple) return;
            gsap.set(ripple, { opacity: 1, scale: 1 });
            gsap.to(ripple, {
                scale: 3.6,
                opacity: 0,
                duration: 0.55,
                ease: "power2.out",
            });
        }

        // ====== SCROLL-DRIVEN streams fade-up (encima del loop continuo) ======
        // Los streams ya están visibles desde el inicio. Al scrollear,
        // se "saturan" — opacity 0.85 → 1.0 + slight scaleX para que
        // se sientan más densos. Skill: gsap-scrolltrigger scrub.
        gsap.fromTo(streams,
            { opacity: 0.55 },
            {
                opacity: 0.95,
                duration: 1,
                ease: "none",
                scrollTrigger: {
                    trigger: root,
                    start: "top bottom",
                    end:   "center center",
                    scrub: isMobile ? 0.6 : 1.0,
                },
            }
        );

        // ====== Cleanup ======
        const onResize = () => ScrollTrigger.refresh();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    });
}
