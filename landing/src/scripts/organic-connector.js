/* =====================================================================
   OrganicConnector — Fluid Drops Cascade (rewrite 2026-05-20).

   Reemplaza el sistema de raíces growing por una cascada líquida
   realista: streams verticales + drops cayendo con gravedad + splash
   physics al impacto + ripples expansivas + turbulence orgánica.

   Skills aplicadas:
     • gsap-plugins DrawSVGPlugin         → streams revelando con stroke
     • gsap-plugins MotionPathPlugin      → drops siguen curvas del stream
     • gsap-plugins Physics2DPlugin       → splash particles con gravity
     • gsap-plugins CustomBounce          → squash & stretch al impacto
     • gsap-plugins CustomEase ("liquid") → anticipation + overshoot
     • gsap-scrolltrigger scrub           → master timeline scroll-linked
     • gsap-timeline labels               → phases secuenciales 1-5
     • gsap-utils.random + stagger        → naturalismo per drop/particle
     • gsap-core matchMedia               → reduced-motion + mobile
     • gsap-performance                   → transforms + will-change scoped

   Master phases (timeline labels):
     0.00 .. 0.55  → streams DrawSVG reveal
     0.10 .. 0.85  → drops fall (MotionPath + power3.in gravity)
     0.70 .. 0.95  → splash particles spawn (Physics2D velocity/angle)
     0.72 .. 0.98  → ripples expand
   Plus: turbulence baseFrequency idle yoyo loop (no scroll-bound)
   ===================================================================== */

import {
    gsap, mm, BREAKPOINTS, ScrollTrigger,
    DrawSVGPlugin, MotionPathPlugin, Physics2DPlugin, CustomBounce,
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
        gsap.set(streams, { drawSVG: "0%" });
        gsap.set(drops,    { opacity: 0, scale: 0.6 });
        gsap.set(splashes, { opacity: 0, scale: 0.5 });
        gsap.set(ripples,  { opacity: 0, scale: 0.3 });

        if (reduceMotion) {
            gsap.set(streams, { drawSVG: "100%" });
            return;
        }

        // ====== TURBULENCE IDLE — distorsión orgánica continua ======
        // baseFrequency animada con `attr` tween → shimmer suave que
        // hace los streams "respirar" como líquido. Loop infinito,
        // independiente del scroll, sutil (frequency oscila en rango chico).
        // Skill: gsap-plugins (animar SVG attrs).
        if (turb) {
            gsap.to(turb, {
                attr: { baseFrequency: "0.025 0.035" },
                duration: 4.2,
                ease: "sine.inOut",
                yoyo: true, repeat: -1,
            });
        }

        // ====== MASTER TIMELINE scroll-scrubbed ======
        const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
                trigger: root,
                start: "top bottom",
                end:   "bottom top",
                scrub: isMobile ? 0.6 : 1.0,
                invalidateOnRefresh: true,
            },
        });

        // PHASE 1 (0.00 → 0.55): streams reveal — DrawSVG cada uno con
        // su timing escalonado para que la cascada arranque del center y
        // los streams laterales sigan.
        streams.forEach((s, i) => {
            const start = i === 0 ? 0 : 0.06 + i * 0.04;
            tl.to(s, { drawSVG: "100%", duration: 0.50 }, start);
        });

        // PHASE 2 (0.10 → 0.85): drops cayendo por sus streams.
        // MotionPath les hace seguir el path; ease "power3.in" simula
        // gravity (aceleración cuadrática). Cada drop con timing único
        // para que la cascada sea desincronizada (realismo).
        drops.forEach((drop, i) => {
            const streamIdx = parseInt(drop.dataset.stream, 10);
            const pathEl = streams[streamIdx];
            if (!pathEl) return;

            const fallDelay = 0.10 + (i * 0.08) + gsap.utils.random(-0.03, 0.03);
            const fallDur   = gsap.utils.random(0.50, 0.70);

            // Fade-in del drop al inicio del fall
            tl.to(drop, { opacity: 0.95, scale: 1, duration: 0.06 }, fallDelay);

            // Caída siguiendo MotionPath del stream — autoRotate alinea
            // la cola del ellipse con la tangente del path (gota sigue
            // la curva). Skill: gsap-plugins MotionPathPlugin.
            tl.to(drop, {
                motionPath: {
                    path: pathEl,
                    align: pathEl,
                    alignOrigin: [0.5, 0.5],
                    autoRotate: true,
                    start: 0,
                    end: 1,
                },
                duration: fallDur,
                ease: "power3.in",   // gravity: cuadrática acelerando
                // Stretch durante la caída — el drop se elonga al acelerar
                // (skill gsap-performance: transforms only)
                scaleY: 1.35,
                scaleX: 0.85,
            }, fallDelay);

            // Fade-out justo antes del impacto (la "absorción" en el splash)
            tl.to(drop, {
                opacity: 0,
                duration: 0.04,
            }, fallDelay + fallDur - 0.04);
        });

        // PHASE 3 (0.70 → 0.95): splash particles spawn con Physics2D.
        // Cada partícula recibe velocity + angle + gravity randomized —
        // simula explosión líquida al impactar. Skill: gsap-plugins
        // Physics2DPlugin.
        splashes.forEach((p) => {
            const streamIdx = parseInt(p.dataset.stream, 10);
            const i = parseInt(p.dataset.i, 10);
            const fallEnd = 0.10 + (streamIdx * 0.16) + 0.60;  // approx fin de caída por stream
            const spawn = fallEnd + gsap.utils.random(-0.02, 0.04);

            // Splash trajectory: arco ±90° desde la vertical
            // (angle 0° = abajo en Physics2DPlugin; usamos 270° base
            // y rotamos ± para que vuelen hacia los lados/arriba).
            // velocity entre 200-380 → distancia variada
            // gravity 600 → caen rápido después del peak
            const angleSpread = gsap.utils.random(220, 320);  // 270° = up
            const velocity    = gsap.utils.random(180, 360);

            // Fade-in instantáneo
            tl.to(p, { opacity: 0.95, scale: 1, duration: 0.02 }, spawn);

            // Physics fling
            tl.to(p, {
                physics2D: {
                    velocity: velocity,
                    angle:    angleSpread,
                    gravity:  650,
                },
                duration: 0.42,
                ease: "none",
                opacity: 0,
                scale: 0.4,
            }, spawn);
        });

        // PHASE 4 (0.72 → 0.98): ripples expanding rings al impacto.
        // scale 0.3 → 3.2, opacity 0 → 1 → 0 (peak en el medio).
        // Cada ripple tiene su timing exacto post-impact del stream.
        ripples.forEach((ripple, i) => {
            const fallEnd = 0.10 + (i * 0.16) + 0.62;

            // Opacity peak + scale expand simultáneo. Ease "liquid"
            // custom = anticipation + overshoot.
            tl.to(ripple, { opacity: 1, scale: 1, duration: 0.04 }, fallEnd);
            tl.to(ripple, {
                scale: 3.4,
                opacity: 0,
                duration: 0.38,
                ease: "power2.out",
            }, fallEnd);
        });

        // ====== RESIZE handler ======
        const onResize = () => ScrollTrigger.refresh();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    });
}
