/* =====================================================================
   product-float-slider.js — SPYLT-style horizontal pinned slider con
   composición por capas pre-renderizadas.

   Cada panel apila layers en su mismo coordinate space (Base + Ruedas +
   Hero + Texto), igual al Ejemplo.png que diseñó el cliente. Los layers
   se animan independientemente para dar vida al panel sin tocar el
   art-direction original.

   Skills aplicadas (citadas inline):
     • gsap-timeline                       → entrada multi-layer + idle
     • gsap-scrolltrigger pin/scrub/snap   → horizontal pinned slider
     • gsap-scrolltrigger containerAnimation → parallax sub-layers
     • gsap-utils.toArray, random          → naturalismo en idle
     • gsap-core matchMedia                → reduced-motion + responsive
     • gsap-performance                    → transforms only, will-change
     • accessibility                       → aria-selected en steps
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger } from "./lib/registerGsap.js";

function initProductSlider() {
    const root = document.querySelector("[data-product-slider]");
    if (!root) return;

    const pinWrap   = root.querySelector("[data-psl-pin-wrap]");
    const track     = root.querySelector("[data-psl-track]");
    const panels    = gsap.utils.toArray("[data-psl-panel]", root);
    const steps     = gsap.utils.toArray("[data-psl-step]", root);
    const hudNum    = root.querySelector("[data-psl-hud-num]");
    const editorialMark = root.querySelector("[data-psl-editorial-mark]");

    const total = panels.length;
    if (!total || !track || !pinWrap) return;

    mm.add({
        ...BREAKPOINTS,
        isHorizontal: "(min-width: 901px)",
        isStacked:    "(max-width: 900px)",
    }, (ctx) => {
        const { isHorizontal, isStacked, reduceMotion } = ctx.conditions;

        // ============================================================
        // 1) Per-panel: idle micro-animaciones de cada capa
        //    El art-direction lo da el Ejemplo.png; acá sólo agregamos
        //    movimiento sutil que da vida sin desarmar la composición.
        // ============================================================
        if (!reduceMotion) {
            panels.forEach((panel, panelIdx) => {
                const base   = panel.querySelector("[data-psl-base]");
                const hero   = panel.querySelector("[data-psl-hero]");
                const text   = panel.querySelector("[data-psl-text]");
                const wheels = gsap.utils.toArray("[data-psl-wheel]", panel);

                // Hero (bidón / pote): float vertical + leve rotation
                if (hero) {
                    gsap.to(hero, {
                        y:        gsap.utils.random(-10, -22, 1),
                        rotation: gsap.utils.random(-1.4, 1.4, 0.1),
                        duration: gsap.utils.random(2.6, 3.4),
                        ease:     "sine.inOut",
                        yoyo:     true,
                        repeat:   -1,
                        delay:    panelIdx * 0.12,
                    });
                }

                // Base: respiración suave (scale)
                if (base) {
                    gsap.to(base, {
                        scale:    1.025,
                        duration: gsap.utils.random(5, 7),
                        ease:     "sine.inOut",
                        yoyo:     true,
                        repeat:   -1,
                    });
                }

                // Ruedas: cada una rota en su propio ritmo + bobbing
                //   skill: gsap-utils.random para que el resultado se
                //   sienta orgánico (no marching bots).
                wheels.forEach((wheel, wIdx) => {
                    // Spin lento continuo — direction según índice
                    gsap.to(wheel, {
                        rotation: wIdx % 2 === 0 ? "+=360" : "-=360",
                        duration: gsap.utils.random(14, 22),
                        ease:     "none",
                        repeat:   -1,
                    });
                    // Bobbing X/Y independiente
                    gsap.to(wheel, {
                        x:        gsap.utils.random(-14, 14, 1),
                        y:        gsap.utils.random(-12, 12, 1),
                        duration: gsap.utils.random(2.8, 4.2),
                        ease:     "sine.inOut",
                        yoyo:     true,
                        repeat:   -1,
                        delay:    wIdx * 0.18,
                    });
                });

                // Texto: idle fade pulse muy sutil para que no se vea muerto
                if (text) {
                    gsap.fromTo(text,
                        { autoAlpha: 0.92 },
                        {
                            autoAlpha: 1,
                            duration:  gsap.utils.random(2.2, 3.4),
                            ease:      "sine.inOut",
                            yoyo:      true,
                            repeat:    -1,
                        }
                    );
                }
            });
        }

        // ============================================================
        // 2) PIN HORIZONTAL — slider SPYLT-style con N panels
        //    skill: gsap-scrolltrigger > Horizontal scroll containerAnimation
        //    ease: "none" CRÍTICO en el horizontal tween (sin esto los
        //    sub-triggers no quedan alineados con la posición del scroll).
        // ============================================================
        if (isHorizontal && !reduceMotion) {
            gsap.set(track, { width: `${total * 100}vw` });
            panels.forEach((p) => gsap.set(p, { width: "100vw" }));

            const scrollTween = gsap.to(track, {
                xPercent: -100 * (total - 1) / total,
                ease: "none",
                scrollTrigger: {
                    id: "psl-horizontal",
                    trigger: pinWrap,
                    pin: true,
                    pinSpacing: true,
                    start: "top top",
                    end: () => `+=${pinWrap.offsetWidth * (total - 1) / total + window.innerHeight * 0.5}`,
                    scrub: 0.8,
                    snap: {
                        snapTo: 1 / (total - 1),
                        duration: { min: 0.2, max: 0.6 },
                        delay: 0.05,
                        ease: "power2.inOut",
                    },
                    invalidateOnRefresh: true,
                    anticipatePin: 1,
                    onUpdate: (self) => {
                        const idx = Math.min(total - 1, Math.round(self.progress * (total - 1)));
                        if (hudNum) hudNum.textContent = String(idx + 1).padStart(2, "0");

                        steps.forEach((s, i) => {
                            const isActive = i === idx;
                            s.classList.toggle("is-active", isActive);
                            s.setAttribute("aria-selected", isActive ? "true" : "false");
                        });
                        panels.forEach((p, i) => p.classList.toggle("is-active", i === idx));

                        // Editorial mark: cambia background al accent del
                        // panel activo (transición CSS suaviza el switch).
                        if (editorialMark && panels[idx]) {
                            const bg = panels[idx].style.getPropertyValue("--psl-bg");
                            if (bg) editorialMark.style.background = bg;
                        }
                    },
                },
            });

            // ---- Per-panel parallax con containerAnimation ----
            // skill: gsap-scrolltrigger > containerAnimation con trigger
            // y start/end basados en posición horizontal de cada panel.
            panels.forEach((panel) => {
                const card   = panel.querySelector("[data-psl-card]");
                const hero   = panel.querySelector("[data-psl-hero]");
                const text   = panel.querySelector("[data-psl-text]");
                const wheels = gsap.utils.toArray("[data-psl-wheel]", panel);

                // Card: leve scale + parallax X mientras pasa por viewport
                if (card) {
                    gsap.fromTo(card,
                        { xPercent: 8, scale: 0.94, autoAlpha: 0.85 },
                        {
                            xPercent: -8, scale: 1, autoAlpha: 1, ease: "none",
                            scrollTrigger: {
                                containerAnimation: scrollTween,
                                trigger: panel,
                                start: "left right",
                                end:   "right left",
                                scrub: true,
                            },
                        }
                    );
                }

                // Hero: parallax X más pronunciado que el card (sale "adelante")
                if (hero) {
                    gsap.fromTo(hero,
                        { xPercent: 18 },
                        {
                            xPercent: -18, ease: "none",
                            scrollTrigger: {
                                containerAnimation: scrollTween,
                                trigger: panel,
                                start: "left right",
                                end:   "right left",
                                scrub: true,
                            },
                        }
                    );
                }

                // Texto: entra fade + slide desde derecha
                if (text) {
                    gsap.fromTo(text,
                        { xPercent: 30, autoAlpha: 0 },
                        {
                            xPercent: 0, autoAlpha: 1, ease: "none",
                            scrollTrigger: {
                                containerAnimation: scrollTween,
                                trigger: panel,
                                start: "left 70%",
                                end:   "left left",
                                scrub: true,
                            },
                        }
                    );
                }

                // Ruedas: parallax X individual (cada rueda con velocidad
                // distinta → profundidad). Sin sobrescribir el spin idle.
                wheels.forEach((wheel, wIdx) => {
                    const drift = 12 + wIdx * 6; // 12, 18, 24, 30 vw
                    gsap.fromTo(wheel,
                        { xPercent: drift },
                        {
                            xPercent: -drift, ease: "none",
                            scrollTrigger: {
                                containerAnimation: scrollTween,
                                trigger: panel,
                                start: "left right",
                                end:   "right left",
                                scrub: true,
                            },
                        }
                    );
                });
            });

            // ---- Click en step: scroll-to ese panel ----
            steps.forEach((s, i) => {
                const fn = () => {
                    const st = scrollTween.scrollTrigger;
                    if (!st) return;
                    const target = st.start + (st.end - st.start) * (i / (total - 1));
                    if (window.__lenis && typeof window.__lenis.scrollTo === "function") {
                        window.__lenis.scrollTo(target, {
                            duration: 1.0,
                            easing: (t) => 1 - Math.pow(1 - t, 3),
                        });
                    } else {
                        window.scrollTo({ top: target, behavior: "smooth" });
                    }
                };
                s.addEventListener("click", fn);
                ctx.add(() => () => s.removeEventListener("click", fn));
            });

        // ============================================================
        // 3) STACKED (mobile) — sin pin, panels apilados verticalmente
        //    skill: gsap-scrolltrigger toggleActions (no scrub)
        // ============================================================
        } else if (isStacked || reduceMotion) {
            gsap.set(track, { width: "100%", clearProps: "transform" });
            panels.forEach((p) => gsap.set(p, { width: "100%", clearProps: "transform" }));

            if (!reduceMotion) {
                panels.forEach((p) => {
                    const card = p.querySelector("[data-psl-card]");
                    const meta = p.querySelector(".psl__panel-meta");
                    if (!card) return;
                    gsap.from([card, meta].filter(Boolean), {
                        autoAlpha: 0, y: 50, duration: 0.9,
                        stagger: 0.12, ease: "back.out(1.3)",
                        scrollTrigger: {
                            trigger: p, start: "top 75%",
                            toggleActions: "play none none reverse",
                        },
                    });
                });
            }

            // Sync HUD numerador con panel visible
            panels.forEach((p, i) => {
                ScrollTrigger.create({
                    trigger: p,
                    start: "top center",
                    end: "bottom center",
                    onToggle: (self) => {
                        if (self.isActive) {
                            if (hudNum) hudNum.textContent = String(i + 1).padStart(2, "0");
                            steps.forEach((s, k) => {
                                s.classList.toggle("is-active", k === i);
                                s.setAttribute("aria-selected", k === i ? "true" : "false");
                            });
                            if (editorialMark) {
                                const bg = p.style.getPropertyValue("--psl-bg");
                                if (bg) editorialMark.style.background = bg;
                            }
                        }
                    },
                });
            });

            steps.forEach((s, i) => {
                const fn = () => {
                    panels[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
                };
                s.addEventListener("click", fn);
                ctx.add(() => () => s.removeEventListener("click", fn));
            });
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductSlider);
} else {
    initProductSlider();
}
