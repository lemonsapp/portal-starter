/* =====================================================================
   HOLISTIC — liquid-pour-animations.js (v2)
   Beat-by-beat cinematográfico controlado por scroll. La timeline tiene
   labels para que cada momento sea legible y editable:
     hold → release → fall → impact → splash → ripple → wave → bubbles → brand → transition
   Patrón base del proyecto: mm.add(BREAKPOINTS) con auto-cleanup, sin
   re-registrar plugins (ya viven en lib/registerGsap.js).
   Skills aplicados:
     - gsap-timeline: labels + position parameter ("<", ">-=N", "label+=N").
     - gsap-core: CustomEase ya registrado ("liquid", "explode", "brand").
     - gsap-utils: random/snap para distribuir splash y bubbles.
     - gsap-scrolltrigger: ScrollTrigger en top-level con scrub.
   ===================================================================== */

import { gsap, mm, BREAKPOINTS } from "./lib/registerGsap.js";

function initLiquidPour() {
    const el = document.querySelector("[data-liquid-pour]");
    if (!el) return;

    const drop = el.querySelector("[data-liquid-drop]");
    const blobs = el.querySelectorAll("[data-liquid-blob]");
    const pool = el.querySelector("[data-liquid-pool]");
    const crater = el.querySelector("[data-liquid-crater]");
    const overlay = el.querySelector("[data-liquid-overlay]");
    const splashes = el.querySelectorAll("[data-liquid-splash]");
    const ripples = el.querySelectorAll("[data-liquid-ripple]");
    const bubbles = el.querySelectorAll("[data-liquid-bubble]");
    const brandLines = el.querySelectorAll("[data-liquid-brand-line]");
    const superiorDisp = el.querySelector("[data-superior-disp]");
    const superiorNoise = el.querySelector("[data-superior-noise]");

    mm.add(BREAKPOINTS, (context) => {
        const { isMobile, reduceMotion } = context.conditions;

        // ESTADO BASE — todo apagado, listo para que el scroll dispare la TL.
        gsap.set(drop, { attr: { cy: -100, rx: 38, ry: 54 } });
        blobs.forEach((b, i) =>
            gsap.set(b, { attr: { cy: -120 - i * 30 } })
        );
        gsap.set(pool, { attr: { y: 1200, height: 0 } });
        gsap.set(crater, { attr: { rx: 0, ry: 0 }, opacity: 0 });
        gsap.set(splashes, { attr: { cx: 500, cy: 1180, r: 0 } });
        gsap.set(ripples, { attr: { r: 0, cy: 1180 }, opacity: 0 });
        gsap.set(bubbles, { attr: { r: 0, cy: 1180 } });
        gsap.set(brandLines, { y: 40, autoAlpha: 0 });
        if (superiorDisp) gsap.set(superiorDisp, { attr: { scale: 90 } });
        gsap.set(overlay, { yPercent: -100 });

        // Reduce-motion: salto al estado final (overlay pintado), sin TL.
        if (reduceMotion) {
            gsap.set(overlay, { yPercent: 0 });
            gsap.set(brandLines, { y: 0, autoAlpha: 1 });
            if (superiorDisp) gsap.set(superiorDisp, { attr: { scale: 0 } });
            return;
        }

        // ----------- IDLE BOIL del SUPERIOR -----------
        // Independiente del scrub: corre infinito mientras la página viva.
        // Cuando scale del displacement está en 0, no hay efecto visible,
        // así que el seed cambia "por dentro" sin costo visual.
        // Cuando entra el scrub-driven scale, el seed cambiando a alta
        // frecuencia da el efecto de "líquido en ebullición".
        let boilTl = null;
        if (superiorNoise) {
            boilTl = gsap.timeline({ repeat: -1, repeatRefresh: true });
            boilTl.to(superiorNoise, {
                attr: { seed: () => Math.floor(gsap.utils.random(0, 999)) },
                duration: () => gsap.utils.random(0.08, 0.18, 0.02),
                ease: "steps(1)",
            });
        }

        const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
                id: "liquid-pour",
                trigger: el,
                start: "top bottom",
                end: "bottom top",
                scrub: isMobile ? 0.6 : 1,
                refreshPriority: -2,
                invalidateOnRefresh: true,
            },
        });

        // -------------------------- HOLD --------------------------
        // La gota emerge al borde superior y respira un instante antes de soltarse.
        tl.addLabel("hold", 0)
            .to(drop, { attr: { cy: 80, rx: 42, ry: 50 }, duration: 0.08 }, "hold")
            .to(blobs, {
                attr: (i) => ({ cy: 60 - i * 18 }),
                duration: 0.08,
            }, "hold");

        // ------------------------ RELEASE -------------------------
        // El drop se desprende — los blobs siguen a velocidad escalonada.
        tl.addLabel("release", 0.1);

        // -------------------------- FALL --------------------------
        // Caída con stretch: ry crece, rx se afina (estiramiento por velocidad).
        // Easing "none" porque el scrub maneja la curva — pero el cambio
        // de attr da el feel de aceleración.
        tl.addLabel("fall", 0.2)
            .to(drop, {
                attr: { cy: 1100, rx: 24, ry: 110 },
                duration: 0.35,
            }, "fall");

        blobs.forEach((b, i) => {
            tl.to(b, {
                attr: { cy: 1100 + i * 8 },
                duration: 0.35,
            }, "fall+=" + (i * 0.04));
        });

        // -------------------------- IMPACT ------------------------
        // El drop se aplasta al tocar la superficie: ry colapsa, rx se ensancha.
        // Cráter aparece y se hunde simulando la huella del impacto.
        tl.addLabel("impact", 0.55)
            .to(drop, {
                attr: { cy: 1180, rx: 80, ry: 18 },
                duration: 0.06,
                ease: "expo.in",
            }, "impact")
            .to(crater, {
                attr: { rx: 90, ry: 14 },
                opacity: 0.55,
                duration: 0.06,
            }, "impact")
            .to(crater, {
                attr: { rx: 0, ry: 0 },
                opacity: 0,
                duration: 0.18,
                ease: "power2.out",
            }, "impact+=0.06");

        // -------------------------- SPLASH ------------------------
        // 6 drops vuelan en arco con cx y cy random. Stagger desde center
        // para que la dispersión arranque del punto de impacto.
        tl.addLabel("splash", 0.6);
        splashes.forEach((s, i) => {
            const targetCx = gsap.utils.random(340, 660, 5);
            const peakCy = gsap.utils.random(940, 1080, 5);
            const radius = gsap.utils.random(8, 18, 1);
            tl.to(s, {
                attr: { r: radius, cx: targetCx, cy: peakCy },
                duration: 0.16,
                ease: "liquid",
            }, "splash+=" + (i * 0.012))
                .to(s, {
                    attr: { r: 0, cy: 1185 },
                    duration: 0.18,
                    ease: "power2.in",
                }, ">");
        });

        // -------------------------- RIPPLE ------------------------
        // 3 anillos concéntricos expanden desde el impacto y se desvanecen.
        // Stagger between rings + opacity peak in middle then fade.
        tl.addLabel("ripple", 0.62);
        ripples.forEach((r, i) => {
            tl.fromTo(r,
                { attr: { r: 20 }, opacity: 0.7 },
                {
                    attr: { r: 280 + i * 80 },
                    opacity: 0,
                    duration: 0.28,
                    ease: "power2.out",
                },
                "ripple+=" + (i * 0.06)
            );
        });

        // -------------------------- WAVE --------------------------
        // El pool se llena: rect crece desde abajo. Easing "explode" dramático
        // para que tenga overshoot mínimo y settle.
        tl.addLabel("wave", 0.55)
            .to(pool, {
                attr: { y: 720, height: 480 },
                duration: 0.3,
                ease: "explode",
            }, "wave");

        // ------------------------ BUBBLES -------------------------
        // 5 burbujas suben desde el pool con timing y radio random. Cada
        // una nace y muere en su propia pista, distribuida con stagger.
        tl.addLabel("bubbles", 0.78);
        bubbles.forEach((b, i) => {
            const startCy = 1180 - gsap.utils.random(20, 80, 5);
            const endCy = startCy - gsap.utils.random(140, 240, 10);
            const radius = gsap.utils.random(8, 22, 2);
            tl.fromTo(b,
                { attr: { r: 0, cy: startCy } },
                { attr: { r: radius, cy: endCy }, duration: 0.18, ease: "sine.out" },
                "bubbles+=" + (i * 0.02)
            )
                .to(b, {
                    attr: { r: 0, cy: endCy - 30 },
                    duration: 0.06,
                    ease: "power2.in",
                }, ">");
        });

        // -------------------------- BRAND -------------------------
        // NUTRICIÓN entra deslizándose (mix-blend-mode: difference).
        // SUPERIOR emerge del caos: el displacement scale arranca en 90
        // (texto totalmente disuelto en ruido) y baja a 0 (limpio) durante
        // un rango amplio de scroll. Idle: oscila entre 0 y 3 con seed
        // cambiando rápidamente → texto que vibra como en heat-haze.
        // Salida: scale vuelve a 90 (se vuelve a disolver).
        tl.addLabel("brand", 0.55)
            .to(brandLines[0], {
                y: 0,
                autoAlpha: 1,
                duration: 0.12,
                ease: "expo.out",
            }, "brand");

        // SUPERIOR aparece (y autoAlpha del span se resuelve por sí mismo).
        tl.to(brandLines[1], {
            y: 0,
            autoAlpha: 1,
            duration: 0.06,
            ease: "expo.out",
        }, "brand+=0.02");

        // Displacement scale: 90 → 0 → idle wobble → 90 (salida).
        if (superiorDisp) {
            tl.to(superiorDisp, {
                attr: { scale: 0 },
                duration: 0.18,
                ease: "power3.out",
            }, "brand+=0.04");

            // Idle wobble: oscila levemente para que el texto se sienta
            // vivo (heat-haze sutil) durante el HOLD.
            tl.to(superiorDisp, {
                attr: { scale: () => gsap.utils.random(1.5, 4.5, 0.5) },
                duration: 0.06,
                ease: "sine.inOut",
                repeat: 4,
                yoyo: true,
            }, "brand+=0.25");

            // Exit: vuelve al caos.
            tl.to(superiorDisp, {
                attr: { scale: 90 },
                duration: 0.06,
                ease: "power3.in",
            }, 0.94);
        }

        // Brand OUT cerca del final.
        tl.to(brandLines, {
            y: -30,
            autoAlpha: 0,
            duration: 0.05,
            ease: "power2.in",
            stagger: 0.02,
        }, 0.95);

        // ----------------------- TRANSITION -----------------------
        // Overlay pinta hacia abajo, conectando con la próxima sección.
        tl.addLabel("transition", 0.92)
            .to(overlay, {
                yPercent: 0,
                duration: 0.08,
            }, "transition");
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLiquidPour);
} else {
    initLiquidPour();
}
