/* =====================================================================
   LiquidBridge — v2 (2026-05-20): blob chorreando cruzando secciones.

   Cambios vs v1:
     • Blob alargado vertical (1000 unidades de alto, sin section
       container que lo recorte). Keyframes nuevos matcheando el SVG
       actualizado.
     • Loops continuos (no scroll-bound) — el chorreo es siempre
       visible, no solo en transición de scroll.
     • feTurbulence baseFrequency yoyo loop (idle).
     • Particles flow loop continuo siguiendo flowPath sinuoso.

   Skills aplicadas:
     • gsap-plugins MotionPathPlugin       → particles flow interior
     • gsap-plugins CustomEase ("liquid")  → blob morph ease orgánico
     • gsap-timeline (per-particle loop)   → flow continuo
     • gsap-utils.random + toArray         → naturalismo particles
     • gsap-core matchMedia                → reduced-motion + mobile
     • gsap-performance                    → attr + transforms only
   ===================================================================== */

import {
    gsap, mm, BREAKPOINTS, ScrollTrigger,
    MotionPathPlugin,
} from "./lib/registerGsap.js";

// ============ KEYFRAMES del blob ============
// 4 keyframes con MISMA estructura (M + 5 C + Z) para interpolation
// lineal del `d`. Cada KF describe un blob alargado vertical 0-1000
// con leve waviness orgánica. La transición entre KFs hace que el
// blob "respire" continuamente mientras drena.
const BLOB_KEYFRAMES = {
    KF1: "M 500 0 C 470 100, 460 220, 480 360 C 500 500, 490 640, 510 780 C 520 880, 500 950, 500 1000 C 500 950, 480 880, 490 780 C 510 640, 500 500, 520 360 C 540 220, 530 100, 500 0 Z",
    KF2: "M 500 0 C 440 120, 480 240, 460 380 C 440 520, 510 660, 530 800 C 540 900, 510 960, 500 1000 C 490 960, 460 900, 470 800 C 490 660, 560 520, 540 380 C 520 240, 560 120, 500 0 Z",
    KF3: "M 500 0 C 480 140, 440 260, 470 400 C 500 540, 470 680, 490 820 C 500 910, 520 970, 500 1000 C 480 970, 500 910, 510 820 C 530 680, 500 540, 530 400 C 560 260, 520 140, 500 0 Z",
    KF4: "M 500 0 C 460 110, 480 250, 460 390 C 440 530, 520 670, 540 810 C 550 900, 520 960, 500 1000 C 480 960, 450 900, 460 810 C 480 670, 560 530, 540 390 C 520 250, 540 110, 500 0 Z",
};

const root = document.querySelector("[data-liquid-bridge]");
if (root) {
    const svg       = root.querySelector("[data-lb-svg]");
    const blob      = root.querySelector("[data-lb-blob]");
    const particles = Array.from(root.querySelectorAll("[data-lb-particle]"));
    const flowPath  = root.querySelector("[data-lb-flow-path]");
    const turb      = root.querySelector("[data-lb-turb]");

    if (!blob || !flowPath) {
        // bail
    }

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion, isMobile } = ctx.conditions;

        // ====== Estados iniciales ======
        gsap.set(blob, { attr: { d: BLOB_KEYFRAMES.KF1 } });
        gsap.set(particles, { opacity: 0, scale: 0.4 });

        if (reduceMotion) {
            return;
        }

        // ====== TURBULENCE IDLE — distortion acuosa continua ======
        if (turb) {
            gsap.to(turb, {
                attr: { baseFrequency: "0.030 0.045" },
                duration: 5.5,
                ease: "sine.inOut",
                yoyo: true, repeat: -1,
            });
        }

        // ====== BLOB MORPH LOOP continuo ======
        // Cicla entre los 4 keyframes — KF1 → KF2 → KF3 → KF4 → KF1.
        // No scroll-bound: el blob respira continuamente.
        // Skill: gsap-timeline + animar SVG attr `d`.
        const morphTl = gsap.timeline({ repeat: -1 });
        morphTl.to(blob, { attr: { d: BLOB_KEYFRAMES.KF2 }, duration: 3.2, ease: "sine.inOut" })
               .to(blob, { attr: { d: BLOB_KEYFRAMES.KF3 }, duration: 3.5, ease: "sine.inOut" })
               .to(blob, { attr: { d: BLOB_KEYFRAMES.KF4 }, duration: 3.0, ease: "sine.inOut" })
               .to(blob, { attr: { d: BLOB_KEYFRAMES.KF1 }, duration: 3.4, ease: "sine.inOut" });

        // ====== PARTICLES FLOW LOOP continuo ======
        // Cada particle tiene timeline infinito: fade-in → flow down
        // via MotionPath → fade-out → restart con delay random.
        // Naturalismo: stagger inicial + duración variable per particle.
        // Skill: gsap-plugins MotionPathPlugin + gsap-utils.random.
        particles.forEach((p, i) => {
            const flowDur   = gsap.utils.random(2.4, 4.2);
            const startDelay = gsap.utils.random(0, 5);
            const peakOpacity = gsap.utils.random(0.55, 0.95);
            const startPct = gsap.utils.random(0, 0.15);
            const endPct   = gsap.utils.random(0.85, 1);

            const tl = gsap.timeline({
                repeat: -1,
                delay: startDelay,
                repeatDelay: gsap.utils.random(0.2, 1.5),
            });

            tl.set(p, { opacity: 0, scale: 0.4 });
            tl.to(p, { opacity: peakOpacity, scale: 1, duration: 0.15 });
            tl.to(p, {
                motionPath: {
                    path: flowPath,
                    align: flowPath,
                    alignOrigin: [0.5, 0.5],
                    autoRotate: false,
                    start: startPct,
                    end: endPct,
                },
                duration: flowDur,
                ease: "power1.in",  // gravity-ish
            }, "-=0.08");
            tl.to(p, { opacity: 0, scale: 0.4, duration: 0.15 }, "-=0.1");
        });

        // ====== Cleanup ======
        const onResize = () => ScrollTrigger.refresh();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    });
}
