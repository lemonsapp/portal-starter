/* =====================================================================
   HOLISTIC — burst.js
   Helper reusable para efectos de "explosión" estilo spylt/awwwards.
   Tres funciones:
     - burst(items, opts)        → back.out + stagger desde center
     - shrapnel(items, opts)     → Physics2D con gravedad y rotación random
     - cameraShake(el, ...)      → sacudida de la cámara al impacto

   Todas devuelven una timeline GSAP. Si prefers-reduced-motion está on,
   las funciones snappean a estado final sin animar.
   ===================================================================== */

import { gsap } from "./registerGsap.js";

const REDUCE = () =>
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * burst — explosión clásica (back.out + stagger desde center).
 * Cada item arranca en (x: 0, y: 0, scale: 0, rotation: random) y vuela
 * a su posición final con bounce. Patrón fundamental de spylt-style.
 */
export function burst(items, opts = {}) {
    const {
        from = "center",
        spread = 0,            // 0 = vuelven a su posición CSS; >0 = vuelan a random
        rotate = 30,           // grados de rotation inicial random
        duration = 1.2,
        stagger = 0.05,
        ease = "back.out(1.6)",
        delay = 0,
        autoAlpha = true,
    } = opts;

    const targets = gsap.utils.toArray(items);
    if (!targets.length) return gsap.timeline();

    if (REDUCE()) {
        gsap.set(targets, { x: 0, y: 0, scale: 1, rotation: 0, autoAlpha: 1 });
        return gsap.timeline();
    }

    gsap.set(targets, {
        x: 0,
        y: 0,
        scale: 0,
        rotation: () => gsap.utils.random(-rotate, rotate, 1),
        autoAlpha: autoAlpha ? 0 : 1,
    });

    return gsap.timeline().to(targets, {
        x: spread ? () => gsap.utils.random(-spread, spread, 1) : 0,
        y: spread ? () => gsap.utils.random(-spread, spread, 1) : 0,
        scale: 1,
        rotation: 0,
        autoAlpha: 1,
        duration,
        ease,
        stagger: typeof stagger === "object" ? stagger : { amount: stagger * targets.length, from },
        delay,
    });
}

/**
 * shrapnel — Physics2D real con gravedad. Items salen disparados con
 * velocidad y ángulo random, caen al suelo del viewport con rotación.
 * Ideal para satélites/partículas decorativas alrededor de un main.
 */
export function shrapnel(items, opts = {}) {
    const {
        velocityMin = 250,
        velocityMax = 550,
        angleMin = -150,        // grados, -90 = arriba puro
        angleMax = -30,
        gravity = 800,
        rotationRange = 720,
        duration = 2,
        stagger = 0.04,
        delay = 0,
        fadeOut = true,
    } = opts;

    const targets = gsap.utils.toArray(items);
    if (!targets.length) return gsap.timeline();

    if (REDUCE()) {
        gsap.set(targets, { autoAlpha: 1 });
        return gsap.timeline();
    }

    const tl = gsap.timeline({ delay });

    tl.to(targets, {
        physics2D: {
            velocity: () => gsap.utils.random(velocityMin, velocityMax),
            angle: () => gsap.utils.random(angleMin, angleMax),
            gravity,
        },
        rotation: () => gsap.utils.random(-rotationRange, rotationRange, 30),
        duration,
        ease: "none",
        stagger: { amount: stagger * targets.length, from: "random" },
    }, 0);

    if (fadeOut) {
        tl.to(targets, {
            autoAlpha: 0,
            duration: 0.4,
            ease: "power2.in",
        }, duration - 0.4);
    }

    return tl;
}

/**
 * cameraShake — sacudida del elemento (típicamente el container de la
 * sección o body) al peak de una explosión. Decay lineal: cada paso
 * reduce la intensidad hasta 0.
 */
export function cameraShake(el, intensity = 8, steps = 6) {
    if (REDUCE() || !el) return gsap.timeline();
    const tl = gsap.timeline();
    for (let i = 0; i < steps; i++) {
        const strength = intensity * (1 - i / steps);
        tl.to(el, {
            x: (i % 2 === 0 ? 1 : -1) * strength,
            duration: 0.06,
            ease: "power1.inOut",
        });
    }
    tl.to(el, { x: 0, duration: 0.06 });
    return tl;
}
