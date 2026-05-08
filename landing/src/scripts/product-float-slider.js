/* =====================================================================
   product-float-slider.js — SPYLT-style horizontal pinned slider con
   composición por capas pre-renderizadas + editorial minimal.

   Editorial: SplitText char reveal con mask + mark CustomEase 'explode'
   + mark color sync per panel + idle breath sutil. Sin ornamentos
   adicionales (asterisco, counter, partículas, glow). El peso visual
   lo lleva el slider de productos.

   Skills aplicadas:
     • gsap-plugins SplitText              → char reveal con mask
     • gsap-plugins CustomEase 'explode'   → mark entrance
     • gsap-timeline                       → choreography multi-step
     • gsap-scrolltrigger pin/scrub/snap   → horizontal slider
     • gsap-scrolltrigger containerAnim    → parallax layers
     • gsap-scrolltrigger toggleActions    → entrance editorial
     • gsap-utils.toArray, random          → naturalismo
     • gsap-core matchMedia                → reduced-motion + responsive
     • gsap-performance                    → transforms only, will-change
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText } from "./lib/registerGsap.js";

function initProductSlider() {
    const root = document.querySelector("[data-product-slider]");
    if (!root) return;

    const pinWrap   = root.querySelector("[data-psl-pin-wrap]");
    const track     = root.querySelector("[data-psl-track]");
    const panels    = gsap.utils.toArray("[data-psl-panel]", root);
    const steps     = gsap.utils.toArray("[data-psl-step]", root);
    const hudNum    = root.querySelector("[data-psl-hud-num]");
    const editorialMark    = root.querySelector("[data-psl-editorial-mark]");
    const editorialEyebrow = root.querySelector("[data-psl-editorial-eyebrow]");
    const editorialLines   = gsap.utils.toArray("[data-psl-editorial-line]", root);
    const editorialSub     = root.querySelector("[data-psl-editorial-sub]");

    const total = panels.length;
    if (!total || !track || !pinWrap) return;

    mm.add({
        ...BREAKPOINTS,
        isHorizontal: "(min-width: 901px)",
        isStacked:    "(max-width: 900px)",
    }, (ctx) => {
        const { isHorizontal, isStacked, reduceMotion } = ctx.conditions;

        // ============================================================
        // 0) EDITORIAL ENTRANCE — char reveal con SplitText + mask
        //    skill: gsap-plugins SplitText + CustomEase 'explode'
        // ============================================================
        let splitInstances = [];
        const lineInners = editorialLines
            .map((line) => line.querySelector(".psl__editorial-line-inner"))
            .filter(Boolean);

        if (lineInners.length) {
            // SplitText sólo en lines de texto puro. La line con <mark>
            // queda fuera del split — el mark se anima por separado con
            // 'explode' ease.
            lineInners.forEach((inner) => {
                if (inner.querySelector("mark")) return;
                const split = SplitText.create(inner, {
                    type: "chars,words",
                    aria: "auto",
                });
                splitInstances.push(split);
            });
        }

        const allChars = splitInstances.flatMap((s) => s.chars);

        if (reduceMotion) {
            gsap.set([editorialEyebrow, editorialSub, editorialMark, ...lineInners], {
                autoAlpha: 1, y: 0,
            });
            if (allChars.length) gsap.set(allChars, { y: 0, autoAlpha: 1 });
        } else {
            // Estados iniciales
            gsap.set([editorialEyebrow, editorialSub], { autoAlpha: 0, y: 14 });
            gsap.set(allChars, { yPercent: 110, autoAlpha: 0 });
            // Mark: tilt -1.6 + scale + alpha 0 (rotation preservada)
            gsap.set(editorialMark, {
                scaleX: 0.6, scaleY: 0.85, rotation: -1.6,
                autoAlpha: 0, transformOrigin: "0 50%",
            });

            const tl = gsap.timeline({
                defaults: { ease: "power3.out" },
                scrollTrigger: {
                    trigger: pinWrap,
                    start: "top 75%",
                    toggleActions: "play none none reverse",
                },
            });

            // 1. Eyebrow fade-in
            tl.to(editorialEyebrow, { autoAlpha: 1, y: 0, duration: 0.5 }, 0);

            // 2. Headline chars rise from mask con stagger fino
            //    skill: gsap-plugins SplitText
            if (allChars.length) {
                tl.to(allChars, {
                    yPercent: 0,
                    autoAlpha: 1,
                    duration: 0.85,
                    stagger: { amount: 0.7, from: "start" },
                    ease: "power3.out",
                }, 0.15);
            }

            // 3. Mark con CustomEase 'explode' (anticipation+overshoot)
            //    skill: gsap-plugins CustomEase
            tl.to(editorialMark, {
                scaleX: 1, scaleY: 1, autoAlpha: 1,
                duration: 0.85,
                ease: "explode",
            }, "-=0.25");

            // 4. Sub fade-in último
            tl.to(editorialSub, { autoAlpha: 1, y: 0, duration: 0.55 }, "-=0.4");
        }

        // Idle: respiración muy sutil del mark
        if (!reduceMotion && editorialMark) {
            gsap.to(editorialMark, {
                scale: 1.018,
                duration: 2.8,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
            });
        }

        // ============================================================
        // 1) Per-panel: idle micro-animaciones de cada capa del card
        // ============================================================
        if (!reduceMotion) {
            panels.forEach((panel, panelIdx) => {
                const base   = panel.querySelector("[data-psl-base]");
                const hero   = panel.querySelector("[data-psl-hero]");
                const label  = panel.querySelector("[data-psl-label]");
                const wheels = gsap.utils.toArray("[data-psl-wheel]", panel);

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
                if (base) {
                    gsap.to(base, {
                        scale:    1.025,
                        duration: gsap.utils.random(5, 7),
                        ease:     "sine.inOut",
                        yoyo:     true,
                        repeat:   -1,
                    });
                }
                wheels.forEach((wheel, wIdx) => {
                    gsap.to(wheel, {
                        rotation: wIdx % 2 === 0 ? "+=360" : "-=360",
                        duration: gsap.utils.random(14, 22),
                        ease:     "none",
                        repeat:   -1,
                    });
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
                if (label) {
                    gsap.fromTo(label,
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
        // 2) PIN HORIZONTAL — slider con N panels
        //    skill: gsap-scrolltrigger > Horizontal scroll containerAnimation
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

                        // Mark color sync: el bg del mark sigue al panel activo
                        if (editorialMark && panels[idx]) {
                            const bg = panels[idx].style.getPropertyValue("--psl-bg");
                            if (bg) editorialMark.style.background = bg;
                        }
                    },
                },
            });

            // Per-panel parallax con containerAnimation
            panels.forEach((panel) => {
                const card   = panel.querySelector("[data-psl-card]");
                const hero   = panel.querySelector("[data-psl-hero]");
                const label  = panel.querySelector("[data-psl-label]");
                const wheels = gsap.utils.toArray("[data-psl-wheel]", panel);

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
                if (label) {
                    gsap.fromTo(label,
                        { xPercent: -30, autoAlpha: 0 },
                        {
                            xPercent: 0, autoAlpha: 1, ease: "none",
                            scrollTrigger: {
                                containerAnimation: scrollTween,
                                trigger: panel,
                                start: "left 80%",
                                end:   "left 20%",
                                scrub: true,
                            },
                        }
                    );
                }
                wheels.forEach((wheel, wIdx) => {
                    const drift = 12 + wIdx * 6;
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

            // Click en step → scroll-to ese panel
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

        return () => {
            splitInstances.forEach((s) => s.revert());
        };
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductSlider);
} else {
    initProductSlider();
}
