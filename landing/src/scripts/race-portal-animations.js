/* =====================================================================
   HOLISTIC — race-portal-animations.js
   Composición multi-capa estilo Ahmed Codes. Cada capa tiene:
    - Reveal stagger al entrar al viewport (back.out + scale up).
    - Parallax con scroll: cada capa se mueve con yPercent según su
      data-layer-speed → feel de profundidad 3D.
    - Idle infinito: remolino rota 360°, luces pulsan opacity, liquido
      respira con sine.inOut.
    - Rotation continuo del portal entero con scroll → la "cámara" gira
      mientras vas bajando.
   ===================================================================== */

import { gsap, ScrollTrigger, mm, BREAKPOINTS } from "./lib/registerGsap.js";

function initRacePortal() {
    const portals = document.querySelectorAll("[data-race-portal]");
    if (!portals.length) return;

    mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion } = context.conditions;

        portals.forEach((portal) => {
            const layers = Array.from(portal.querySelectorAll("[data-portal-layer]"));
            const remolino = portal.querySelector('[data-layer-name="remolino"]');
            const luces = portal.querySelector('[data-layer-name="luces"]');
            const liquido = portal.querySelector('[data-layer-name="liquido"]');
            const productos = portal.querySelector('[data-layer-name="productos"]');
            const cristales = portal.querySelector('[data-layer-name="cristales"]');

            // Estado inicial: capas YA visibles para que aunque el
            // ScrollTrigger no dispare, se vean. El reveal usa `from()`
            // para empujar a scale chico y traerlas con bounce — pero
            // el estado base es completamente visible.
            gsap.set(layers, { scale: 1, autoAlpha: 1, yPercent: 0 });

            if (reduceMotion) return;

            // 1) REVEAL: from() animation — arranca de scale 0.85 +
            // autoAlpha 0 y vuelve al estado natural con back.out.
            // Stagger por z-index → fondo primero, tapas última.
            gsap.from(layers, {
                scale: 0.85,
                autoAlpha: 0,
                duration: 1.1,
                ease: "back.out(1.7)",
                stagger: { amount: 0.6, from: "start" },
                scrollTrigger: {
                    trigger: portal,
                    start: "top 95%",
                    toggleActions: "play none none none",
                },
            });

            // 2) PARALLAX por capa con scrub: cada capa se mueve
            // según su data-layer-speed. Speeds negativos = arriba.
            // El remolino tiene speed 0 (no se mueve, sólo rota).
            layers.forEach((layer) => {
                const speed = parseFloat(layer.dataset.layerSpeed || "0");
                if (speed === 0) return;

                gsap.fromTo(layer,
                    { yPercent: -speed },
                    {
                        yPercent: speed,
                        ease: "none",
                        scrollTrigger: {
                            trigger: portal,
                            start: "top bottom",
                            end: "bottom top",
                            scrub: 0.6,
                        },
                    }
                );
            });

            // 3) ROTATION del portal entero con scroll → la cámara gira
            // sutilmente mientras seguís scrolleando.
            gsap.fromTo(portal,
                { rotation: -3 },
                {
                    rotation: 3,
                    ease: "none",
                    scrollTrigger: {
                        trigger: portal,
                        start: "top bottom",
                        end: "bottom top",
                        scrub: 1,
                    },
                }
            );

            // 4) IDLE — remolino rota infinito 360° en 18s.
            if (remolino) {
                gsap.to(remolino, {
                    rotation: 360,
                    duration: 18,
                    ease: "none",
                    repeat: -1,
                    transformOrigin: "50% 50%",
                });
            }

            // 5) IDLE — luces pulsan opacity + leve scale para parpadeo
            // de estrella.
            if (luces) {
                gsap.to(luces, {
                    opacity: 0.6,
                    scale: 1.04,
                    duration: 2.5,
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                    delay: 1.2,
                });
            }

            // 6) IDLE — liquido respira sutil (scale + leve rotation
            // contrario al remolino).
            if (liquido) {
                gsap.to(liquido, {
                    scale: 1.06,
                    duration: 4.5,
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                    delay: 1.8,
                });
                gsap.to(liquido, {
                    rotation: -8,
                    duration: 22,
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                    transformOrigin: "50% 50%",
                });
            }

            // 7) IDLE — cristales con drift sutil aleatorio.
            if (cristales) {
                gsap.to(cristales, {
                    rotation: 4,
                    duration: 12,
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                    transformOrigin: "50% 50%",
                });
            }

            // 8) IDLE — productos al frente flotan sutilmente para
            // que las botellas no queden estáticas sobre el portal.
            if (productos) {
                gsap.to(productos, {
                    y: -8,
                    duration: 3.5,
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                    delay: 0.6,
                });
                gsap.to(productos, {
                    rotation: 1.5,
                    duration: 6,
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                    transformOrigin: "50% 50%",
                });
            }
        });
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRacePortal);
} else {
    initRacePortal();
}
