/* =====================================================================
   LiquidBridge — Ink Pour Morphing (nuevo 2026-05-20).

   Transición líquida entre <LineasEstrella /> y <ComplementosIdeales />.
   Diferente al OrganicConnector (que es cascada de drops): este es un
   blob orgánico continuo que morpha entre 4 keyframes mientras drena
   hacia abajo, con partículas interiores que fluyen por un path
   sinuoso (MotionPath) y feTurbulence FUERTE animada para distortion
   acuosa.

   Path morphing manual: animamos el `d` del path con `attr` tween
   entre keyframes con la MISMA estructura de comandos (M, C×4, Z)
   para que la interpolación lineal funcione sin MorphSVG plugin.

   Skills aplicadas:
     • gsap-plugins MotionPathPlugin       → particles flow interior
     • gsap-plugins CustomEase ("liquid")  → ease orgánico
     • gsap-scrolltrigger scrub            → master timeline scroll-linked
     • gsap-timeline                       → 4 phases: emerge → morph
                                              → flow → dissolve
     • gsap-utils.random + toArray         → naturalismo particles
     • gsap-core matchMedia                → reduced-motion + mobile
     • gsap-performance                    → attr + transforms only

   Phases (timeline labels):
     0.00 .. 0.25 → blob emerge (KF1 → KF2)
     0.20 .. 0.55 → blob expand & morph (KF2 → KF3)
     0.30 .. 0.85 → particles flow inside (MotionPath stagger)
     0.50 .. 0.90 → blob drain + morph (KF3 → KF4)
     0.10 .. 0.35 → label fade-in
   Plus: turbulence baseFrequency yoyo loop idle.
   ===================================================================== */

import {
    gsap, mm, BREAKPOINTS, ScrollTrigger,
    MotionPathPlugin,
} from "./lib/registerGsap.js";

// ============ KEYFRAMES del blob ============
// Cada keyframe tiene la MISMA estructura: M + 4 cubic curves + Z.
// 8 puntos de control por curva (cada C tiene 6 numbers).
// Para que el interpolation de `d` funcione cleanly: misma cantidad
// de comandos en mismo orden, solo cambian los valores numéricos.
//
// Conceptualmente:
//   KF1 = blob comprimido pequeño top center (entry)
//   KF2 = blob expanded middle, leve elongación
//   KF3 = blob full body, formación ovalada drenando
//   KF4 = blob disolviendo bottom, alargado vertical
const BLOB_KEYFRAMES = {
    KF1: "M 500 -40 C 480 -20, 460 0, 460 30 C 460 60, 480 80, 500 90 C 520 80, 540 60, 540 30 C 540 0, 520 -20, 500 -40 Z",
    KF2: "M 500 20 C 440 60, 380 140, 400 230 C 420 320, 480 380, 500 410 C 520 380, 580 320, 600 230 C 620 140, 560 60, 500 20 Z",
    KF3: "M 500 80 C 380 180, 320 300, 360 440 C 400 560, 480 620, 500 660 C 520 620, 600 560, 640 440 C 680 300, 620 180, 500 80 Z",
    KF4: "M 500 180 C 420 320, 380 460, 440 600 C 480 720, 500 780, 500 840 C 500 780, 520 720, 560 600 C 620 460, 580 320, 500 180 Z",
};

const root = document.querySelector("[data-liquid-bridge]");
if (root) {
    const svg       = root.querySelector("[data-lb-svg]");
    const blob      = root.querySelector("[data-lb-blob]");
    const particles = Array.from(root.querySelectorAll("[data-lb-particle]"));
    const flowPath  = root.querySelector("[data-lb-flow-path]");
    const turb      = root.querySelector("[data-lb-turb]");
    const label     = root.querySelector("[data-lb-label]");

    if (!blob || !flowPath) {
        // bail safely
    }

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion, isMobile } = ctx.conditions;

        // ====== Estados iniciales ======
        gsap.set(blob, { attr: { d: BLOB_KEYFRAMES.KF1 } });
        gsap.set(particles, { opacity: 0, scale: 0.4 });
        if (label) gsap.set(label, { opacity: 0, y: -8 });

        if (reduceMotion) {
            gsap.set(blob, { attr: { d: BLOB_KEYFRAMES.KF3 }, opacity: 0.5 });
            if (label) gsap.set(label, { opacity: 0.5, y: 0 });
            return;
        }

        // ====== TURBULENCE IDLE ======
        // baseFrequency oscila → distorsión acuosa continua sutil.
        // No scroll-bound — loop infinito. Skill: gsap-plugins (animar
        // SVG attrs continuos).
        if (turb) {
            gsap.to(turb, {
                attr: { baseFrequency: "0.030 0.045" },
                duration: 5.5,
                ease: "sine.inOut",
                yoyo: true, repeat: -1,
            });
        }

        // ====== MASTER TIMELINE scroll-scrubbed ======
        const tl = gsap.timeline({
            defaults: { ease: "power2.inOut" },
            scrollTrigger: {
                trigger: root,
                start: "top bottom",
                end:   "bottom top",
                scrub: isMobile ? 0.6 : 1.0,
                invalidateOnRefresh: true,
            },
        });

        // PHASE 1 (0.00 → 0.25): blob emerge — KF1 → KF2
        // Pequeño blob aparece del top y crece descendiendo. Ease custom
        // "liquid" registrado en registerGsap = anticipation + overshoot.
        tl.to(blob, {
            attr: { d: BLOB_KEYFRAMES.KF2 },
            duration: 0.25,
            ease: "liquid",
        }, 0);

        // PHASE 2 (0.20 → 0.55): expand + morph — KF2 → KF3
        // Blob alcanza tamaño completo, forma ovalada drenando.
        tl.to(blob, {
            attr: { d: BLOB_KEYFRAMES.KF3 },
            duration: 0.35,
            ease: "power2.inOut",
        }, 0.20);

        // PHASE 3 (0.30 → 0.85): particles flow interior con MotionPath.
        // Cada particle sigue el flowPath con timing único + opacity sine
        // para shimmer. autoRotate false (las particles son circles, no
        // necesitan orientación). Skill: gsap-plugins MotionPathPlugin.
        particles.forEach((p, i) => {
            const t0 = 0.30 + (i * 0.025) + gsap.utils.random(-0.02, 0.02);
            const dur = gsap.utils.random(0.42, 0.62);
            const peakOpacity = gsap.utils.random(0.65, 0.95);

            // Fade-in
            tl.to(p, { opacity: peakOpacity, scale: 1, duration: 0.04 }, t0);

            // Flow descent siguiendo flowPath — start/end aleatorios
            // para que cada particle recorra una porción del path
            // (algunas largas, otras cortas)
            const start = gsap.utils.random(0, 0.2);
            const end   = gsap.utils.random(0.78, 1);
            tl.to(p, {
                motionPath: {
                    path: flowPath,
                    align: flowPath,
                    alignOrigin: [0.5, 0.5],
                    autoRotate: false,
                    start,
                    end,
                },
                duration: dur,
                ease: "power1.in",  // gravity-ish
            }, t0);

            // Fade-out al final del recorrido
            tl.to(p, {
                opacity: 0,
                scale: 0.4,
                duration: 0.06,
            }, t0 + dur - 0.06);
        });

        // PHASE 4 (0.50 → 0.90): drain + morph final — KF3 → KF4
        // El blob se alarga hacia abajo, dissolviendo bajo el mask
        // gradient (la mask hace fade-to-black automático al cruzar
        // el 75% vertical). Ease "power3.in" → gravity drain.
        tl.to(blob, {
            attr: { d: BLOB_KEYFRAMES.KF4 },
            duration: 0.40,
            ease: "power3.in",
        }, 0.50);

        // ====== LABEL FADE (independent toggleActions) ======
        if (label) {
            gsap.to(label, {
                opacity: 0.85, y: 0,
                duration: 0.6, ease: "power2.out",
                scrollTrigger: {
                    trigger: root,
                    start: "top 80%",
                    end:   "top 30%",
                    toggleActions: "play none none reverse",
                },
            });
        }

        // ====== RESIZE handler ======
        const onResize = () => ScrollTrigger.refresh();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    });
}
