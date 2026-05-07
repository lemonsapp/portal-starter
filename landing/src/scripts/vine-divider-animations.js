/* =====================================================================
   HOLISTIC — vine-divider-animations.js (v2)
   Cada VineDivider:
    - Tallo se DIBUJA con DrawSVGPlugin scrubbed al scroll.
    - Glow filter pulsa stdDeviation tied al scrub (savia luminosa).
    - Hojas pop con back.out + sway idle async.
    - 3 esporas viajan por el tallo con MotionPathPlugin (idle infinito).
    - Fruto pop al final + pulse idle.
    - Bloom moment: sparkles estallan en el peak del scrub.
   Skills aplicados:
     gsap-plugins: DrawSVG, MotionPath
     gsap-scrolltrigger: scrub + toggleActions
     gsap-utils: random distribuído para spore timings y sparkle stagger
   ===================================================================== */

import { gsap, ScrollTrigger, mm, BREAKPOINTS, DrawSVGPlugin, MotionPathPlugin } from "./lib/registerGsap.js";

function initVines() {
    const vines = document.querySelectorAll("[data-vine-divider]");
    if (!vines.length) return;

    mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion } = context.conditions;

        vines.forEach((vine) => {
            const stem = vine.querySelector("[data-vine-stem]");
            const leaves = vine.querySelectorAll("[data-vine-leaf]");
            const fruit = vine.querySelector("[data-vine-fruit]");
            const spores = vine.querySelectorAll("[data-vine-spore]");
            const sparks = vine.querySelectorAll("[data-vine-spark]");
            const glowBlur = vine.querySelector("[data-vine-glow]");

            if (stem) gsap.set(stem, { drawSVG: 0 });
            if (leaves.length) {
                leaves.forEach((leaf) => {
                    gsap.set(leaf, {
                        scale: 0,
                        autoAlpha: 0,
                        transformOrigin: "50% 50%",
                    });
                });
            }
            if (fruit) {
                gsap.set(fruit, {
                    scale: 0,
                    autoAlpha: 0,
                    transformOrigin: "50% 50%",
                });
            }
            // Esporas arrancan invisibles fuera del path; MotionPath las
            // posiciona al primer tick del tween.
            if (spores.length) gsap.set(spores, { autoAlpha: 0 });
            if (sparks.length) gsap.set(sparks, { scale: 0, autoAlpha: 0, transformOrigin: "50% 50%" });
            if (glowBlur) glowBlur.setAttribute("stdDeviation", "0");

            if (reduceMotion) {
                if (stem) gsap.set(stem, { drawSVG: "0% 100%" });
                if (leaves.length) leaves.forEach((l) => gsap.set(l, { scale: 1, autoAlpha: 1 }));
                if (fruit) gsap.set(fruit, { scale: 1, autoAlpha: 1 });
                if (sparks.length) gsap.set(sparks, { scale: 1, autoAlpha: 1 });
                return;
            }

            // Tallo se dibuja con scrub. Mismo ScrollTrigger anima el glow
            // (stdDeviation 0 → 4 → 0) para feel de savia recorriendo.
            if (stem) {
                const stemTl = gsap.timeline({
                    scrollTrigger: {
                        trigger: vine,
                        start: "top 90%",
                        end: "bottom 50%",
                        scrub: 0.6,
                    },
                });
                stemTl.to(stem, { drawSVG: "0% 100%", ease: "none" }, 0);
                if (glowBlur) {
                    // Glow sube a la mitad del scrub y baja al final → "energía"
                    // viajando por el tallo.
                    stemTl.to(glowBlur, {
                        attr: { stdDeviation: 4 },
                        ease: "sine.inOut",
                        duration: 0.5,
                    }, 0)
                        .to(glowBlur, {
                            attr: { stdDeviation: 0 },
                            ease: "sine.inOut",
                            duration: 0.5,
                        }, 0.5);
                }
            }

            // Esporas viajan a lo largo del tallo en loop infinito. Cada
            // una con duration y delay random para que no se sincronicen.
            if (stem && spores.length) {
                spores.forEach((spore, i) => {
                    const dur = gsap.utils.random(7, 12, 0.5);
                    const delay = gsap.utils.random(0, 4, 0.1);
                    gsap.fromTo(spore,
                        { autoAlpha: 0 },
                        {
                            autoAlpha: 0.85,
                            duration: 0.6,
                            delay,
                            ease: "sine.out",
                        }
                    );
                    gsap.to(spore, {
                        motionPath: {
                            path: stem,
                            align: stem,
                            alignOrigin: [0.5, 0.5],
                            start: 0,
                            end: 1,
                        },
                        duration: dur,
                        delay,
                        ease: "none",
                        repeat: -1,
                    });
                    // Pulso de tamaño asíncrono mientras viaja.
                    gsap.to(spore, {
                        scale: gsap.utils.random(1.4, 2.0, 0.1),
                        duration: gsap.utils.random(1.4, 2.4, 0.2),
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1,
                        delay: delay + i * 0.3,
                        transformOrigin: "50% 50%",
                    });
                });
            }

            // Hojas: pop con stagger cuando el vine entra al 75% del viewport.
            if (leaves.length) {
                gsap.to(leaves, {
                    scale: 1,
                    autoAlpha: 1,
                    duration: 0.7,
                    ease: "back.out(2)",
                    stagger: 0.12,
                    scrollTrigger: {
                        trigger: vine,
                        start: "top 75%",
                        toggleActions: "play none none reverse",
                    },
                });

                // Sway idle de cada hoja con duración random.
                leaves.forEach((leaf, i) => {
                    gsap.to(leaf, {
                        rotation: gsap.utils.random(-7, 7, 1),
                        duration: gsap.utils.random(3, 5),
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1,
                        delay: i * 0.3 + gsap.utils.random(0, 1),
                    });
                });
            }

            // Fruto: pop dramático al final del divider.
            if (fruit) {
                gsap.to(fruit, {
                    scale: 1,
                    autoAlpha: 1,
                    duration: 0.9,
                    ease: "back.out(2.4)",
                    scrollTrigger: {
                        trigger: vine,
                        start: "top 50%",
                        toggleActions: "play none none reverse",
                    },
                });

                // Idle: el fruto pulsa suavemente.
                gsap.to(fruit, {
                    scale: 1.08,
                    duration: gsap.utils.random(2, 3.5),
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                    delay: 1,
                });
            }

            // BLOOM moment: cuando el scrub llega al final, los sparkles
            // estallan con stagger desde center y se desvanecen.
            if (sparks.length) {
                const bloomTl = gsap.timeline({
                    scrollTrigger: {
                        trigger: vine,
                        start: "top 30%",
                        toggleActions: "play none none reverse",
                    },
                });
                bloomTl.to(sparks, {
                    scale: 1,
                    autoAlpha: 1,
                    duration: 0.5,
                    ease: "back.out(2.6)",
                    stagger: { amount: 0.3, from: "center" },
                })
                    .to(sparks, {
                        scale: 1.4,
                        autoAlpha: 0,
                        duration: 0.7,
                        ease: "power2.out",
                        stagger: { amount: 0.25, from: "edges" },
                    }, "+=0.15");

                // Twinkle idle de los sparks una vez visibles. Aprovecho
                // el reverse del toggleActions para no acumular tweens
                // — los re-iniciamos dentro del onComplete de la TL.
                bloomTl.eventCallback("onComplete", () => {
                    sparks.forEach((sp, i) => {
                        gsap.to(sp, {
                            autoAlpha: () => gsap.utils.random(0.3, 0.9, 0.1),
                            scale: () => gsap.utils.random(0.85, 1.25, 0.05),
                            duration: gsap.utils.random(1.2, 2.4, 0.2),
                            ease: "sine.inOut",
                            yoyo: true,
                            repeat: -1,
                            delay: i * 0.15,
                        });
                    });
                });
            }
        });
    });
}

function initChapterOrnaments() {
    const ornaments = document.querySelectorAll("[data-chapter-ornaments]");
    if (!ornaments.length) return;

    mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion } = context.conditions;

        ornaments.forEach((orn) => {
            const stems = orn.querySelectorAll("[data-orn-stem]");
            const leaves = orn.querySelectorAll("[data-orn-leaf]");
            const decos = orn.querySelectorAll("[data-orn-deco]");
            const chapterParent = orn.closest("[data-chapter]");

            stems.forEach((s) => gsap.set(s, { drawSVG: 0 }));
            leaves.forEach((l) => gsap.set(l, {
                scale: 0, autoAlpha: 0, transformOrigin: "50% 50%",
            }));
            decos.forEach((d) => gsap.set(d, {
                scale: 0, autoAlpha: 0, transformOrigin: "50% 50%",
            }));

            if (reduceMotion) {
                stems.forEach((s) => gsap.set(s, { drawSVG: "0% 100%" }));
                leaves.forEach((l) => gsap.set(l, { scale: 1, autoAlpha: 1 }));
                decos.forEach((d) => gsap.set(d, { scale: 1, autoAlpha: 1 }));
                return;
            }

            // Tallos: drawSVG con scrub atado al chapter parent. Mientras
            // scrolleás por el chapter, los tallos se van dibujando.
            stems.forEach((stem) => {
                gsap.to(stem, {
                    drawSVG: "0% 100%",
                    ease: "none",
                    scrollTrigger: {
                        trigger: chapterParent || orn,
                        start: "top 90%",
                        end: "bottom 30%",
                        scrub: 0.6,
                    },
                });
            });

            // Hojas: pop con stagger cuando el chapter entra al 75%.
            if (leaves.length) {
                gsap.to(leaves, {
                    scale: 1,
                    autoAlpha: 1,
                    duration: 0.7,
                    ease: "back.out(2)",
                    stagger: { amount: 0.5, from: "start" },
                    scrollTrigger: {
                        trigger: chapterParent || orn,
                        start: "top 80%",
                        toggleActions: "play none none reverse",
                    },
                });

                // Sway idle de cada hoja con duración random asíncrono.
                leaves.forEach((leaf, i) => {
                    gsap.to(leaf, {
                        rotation: gsap.utils.random(-6, 6, 1),
                        duration: gsap.utils.random(3, 5),
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1,
                        delay: i * 0.2 + gsap.utils.random(0, 1),
                    });
                });
            }

            // Decoraciones (fruto, gotas, raíces, etc) pop al final.
            if (decos.length) {
                gsap.to(decos, {
                    scale: 1,
                    autoAlpha: 1,
                    duration: 0.9,
                    ease: "back.out(2.4)",
                    stagger: 0.1,
                    scrollTrigger: {
                        trigger: chapterParent || orn,
                        start: "top 50%",
                        toggleActions: "play none none reverse",
                    },
                });

                // Idle pulse de cada deco asíncrono.
                decos.forEach((d, i) => {
                    gsap.to(d, {
                        scale: 1.1,
                        duration: gsap.utils.random(2, 3.5),
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1,
                        delay: 1 + i * 0.4,
                    });
                });
            }
        });
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initVines();
        initChapterOrnaments();
    });
} else {
    initVines();
    initChapterOrnaments();
}
