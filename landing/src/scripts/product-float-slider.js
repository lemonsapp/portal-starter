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
    const editorialDot     = root.querySelector(".psl__editorial-dot");
    const paintSvg         = root.querySelector("[data-psl-paint]");
    const paintBlobs       = gsap.utils.toArray("[data-psl-blob]", root);

    const total = panels.length;
    if (!total || !track || !pinWrap) return;

    // Pre-cache colors per panel para interpolación scroll-driven:
    // bgColor   → color saturado (badge/dot/CTA hover)
    // accent    → color pastel para el bg de la sección entera (legibilidad
    //             del editorial dark + match con el card del producto activo).
    // El style.getPropertyValue lee los inline styles que setea el .astro.
    const panelBgs = panels.map((p) => p.style.getPropertyValue("--psl-bg").trim() || "#f7f3ea");
    const panelAccents = panels.map((p, i) => {
        const ds = p.dataset.accent;
        return (ds && ds.trim()) || panelBgs[i];
    });
    // Interpolators precomputados — gsap.utils.interpolate(c1, c2) devuelve
    // una function(t) → color string. Fuerza muy poca; vale precomputar.
    const accentInterps = panelAccents.map((c, i) => {
        const next = panelAccents[Math.min(i + 1, total - 1)];
        return gsap.utils.interpolate(c, next);
    });
    // Set inicial del section bg al accent del primer panel.
    if (root) root.style.setProperty("--psl-section-bg", panelAccents[0]);

    mm.add({
        ...BREAKPOINTS,
        isHorizontal: "(min-width: 901px)",
        isStacked:    "(max-width: 900px)",
    }, (ctx) => {
        const { isHorizontal, isStacked, reduceMotion } = ctx.conditions;

        // ============================================================
        // 0a) GOOEY PAINT REVEAL — cover SVG dissolves al entrar al pin.
        //     Patrón Codrops "paint away to reveal hidden content".
        //     8 circle blobs en mask negro con feGaussianBlur+feColorMatrix
        //     (goo filter) crecen de r=0 → r=720 con stagger fino. El cover
        //     rect (color = --psl-section-bg) se vuelve transparent en las
        //     áreas gooey → editorial + slider revelados orgánicamente.
        //     Trigger: pinWrap "top 90%" → "top top" (= 1 viewport-height
        //     de scroll antes que el pin enganche). Cuando el pin engancha,
        //     el cover está full-disuelto y el slider toma el control.
        //     skill: gsap-scrolltrigger scrub + gsap-utils stagger
        // ============================================================
        if (paintBlobs.length && !reduceMotion) {
            // Estado inicial: blobs r=0 → mask vacío → cover full → contenido
            // tapado. Forzamos via gsap.set para que GSAP rastree el atributo
            // (el HTML inicial ya tiene r=0, pero queremos consistency con
            // el reverse del scrub si el user scrollea hacia arriba).
            gsap.set(paintBlobs, { attr: { r: 0 } });

            gsap.to(paintBlobs, {
                attr: { r: 720 },
                ease: "power2.in",
                stagger: { amount: 0.4, from: "random" },
                scrollTrigger: {
                    trigger: pinWrap,
                    start: "top 90%",
                    end:   "top top",
                    scrub: 1.0,
                    invalidateOnRefresh: true,
                },
            });
        } else if (reduceMotion && paintBlobs.length) {
            // reduce-motion: cover ya disuelto desde el inicio (sin animación)
            gsap.set(paintBlobs, { attr: { r: 720 } });
        }

        // ============================================================
        // 0b) EDITORIAL ENTRANCE — simple fade-in al engancharse el pin.
        //    El "drama" del char reveal SPYLT-style ahora vive en el
        //    componente <ProductsHero /> que va ARRIBA del slider en el
        //    layout (sección dedicada de hero text). Acá el editorial
        //    sólo necesita acomodarse en su anchor izquierdo cuando la
        //    sección entra en viewport — sin char reveal redundante.
        //    Skills: gsap-scrolltrigger toggleActions + gsap-timeline.
        // ============================================================
        // SplitText preservado por compatibilidad con el char-mask CSS,
        // pero los chars se setean visible inmediatamente (no rise).
        let splitInstances = [];
        const lineInners = editorialLines
            .map((line) => line.querySelector(".psl__editorial-line-inner"))
            .filter(Boolean);

        if (lineInners.length) {
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
        const editorialRoot = root.querySelector(".psl__editorial");

        if (reduceMotion) {
            gsap.set([editorialEyebrow, editorialSub, editorialMark, ...lineInners], {
                autoAlpha: 1, y: 0,
            });
            if (allChars.length) gsap.set(allChars, { y: 0, autoAlpha: 1 });
        } else {
            // Editorial chars ya en posición final desde el inicio (no rise).
            // Solo eyebrow/sub/mark hacen un fade-in suave cuando la sección
            // entra en viewport — discreto, sin competir con el hero text.
            gsap.set(allChars, { yPercent: 0, autoAlpha: 1 });
            gsap.set(editorialEyebrow, { autoAlpha: 0, yPercent: 30 });
            gsap.set(editorialSub,     { autoAlpha: 0, yPercent: 30 });
            gsap.set(editorialMark, {
                scaleX: 0.92, scaleY: 0.96, rotation: -1.6,
                autoAlpha: 0, transformOrigin: "0 50%",
            });

            // Fade-in toggleActions cuando el pinWrap entra al 75% del viewport
            const tl = gsap.timeline({
                defaults: { ease: "power3.out" },
                scrollTrigger: {
                    trigger: pinWrap,
                    start: "top 80%",
                    toggleActions: "play none none reverse",
                },
            });
            tl.to(editorialEyebrow, { yPercent: 0, autoAlpha: 1, duration: 0.5 }, 0)
              .to(editorialMark, { scaleX: 1, scaleY: 1, autoAlpha: 1, duration: 0.55, ease: "explode" }, 0.10)
              .to(editorialSub, { yPercent: 0, autoAlpha: 1, duration: 0.5 }, 0.15);

            // Idle: respiración sutil del mark
            gsap.to(editorialMark, {
                scale: 1.018,
                duration: 2.8,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
            });
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
        //    Set inicial: GSAP toma el scale CSS-base del layer para que
        //    los tweens posteriores (y/rotation/scrub) compongan en lugar
        //    de clobberear. Sin esto, gsap.to({y}) borra el scale: 1.22
        //    inline del CSS.
        // ============================================================
        if (!reduceMotion) {
            panels.forEach((panel, panelIdx) => {
                const base   = panel.querySelector("[data-psl-base]");
                const hero   = panel.querySelector("[data-psl-hero]");
                const label  = panel.querySelector("[data-psl-label]");
                const wheels = gsap.utils.toArray("[data-psl-wheel]", panel);

                // Establece scale base que matchea CSS — GSAP ahora "sabe"
                // que el hero y wheels viven con scale > 1. heroScale viene
                // del data-hero-scale (declarado en panels.js per panel para
                // normalizar tamaño visible del packshot).
                const heroScale = parseFloat(panel.dataset.heroScale) || 1.22;
                if (hero) gsap.set(hero, { scale: heroScale, transformOrigin: "center 55%" });
                wheels.forEach((w) => gsap.set(w, { scale: 1.08, transformOrigin: "center" }));

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
                        // Posición continua dentro del rango [0..total-1]:
                        //   segIdx  → índice del panel actual (entero)
                        //   segT    → progreso 0..1 dentro del segmento (entre
                        //             panel segIdx y panel segIdx+1)
                        const segments = total - 1;
                        const segF     = self.progress * segments;
                        const segIdx   = Math.min(segments - 1, Math.max(0, Math.floor(segF)));
                        const segT     = Math.min(1, Math.max(0, segF - segIdx));
                        // idx del panel "activo" (ronda al más cercano):
                        const idx = Math.min(total - 1, Math.round(self.progress * segments));

                        if (hudNum) hudNum.textContent = String(idx + 1).padStart(2, "0");

                        steps.forEach((s, i) => {
                            const isActive = i === idx;
                            s.classList.toggle("is-active", isActive);
                            s.setAttribute("aria-selected", isActive ? "true" : "false");
                        });
                        panels.forEach((p, i) => p.classList.toggle("is-active", i === idx));

                        // ============================================
                        // Section bg: interpolación entre accent[segIdx]
                        // y accent[segIdx+1] según segT.
                        // skill: gsap-utils.interpolate (color tween)
                        // ============================================
                        const interp = accentInterps[segIdx];
                        if (interp && root) {
                            root.style.setProperty("--psl-section-bg", interp(segT));
                        }

                        // Mark + dot color sync: usa el bg saturado del panel activo
                        if (editorialMark) {
                            editorialMark.style.background = panelBgs[idx];
                        }
                        if (editorialDot) {
                            editorialDot.style.background = panelBgs[idx];
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
                    // Per-panel hero scale base (de panels.js heroScale)
                    const baseScale = parseFloat(panel.dataset.heroScale) || 1.22;
                    const peakScale = baseScale * 1.08;  // +8% peak al centro

                    // Movimiento horizontal contraparallax sutil
                    // skill: gsap-scrolltrigger containerAnim
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
                    // Scale "kick" al pasar por centro del panel: escala
                    // base en bordes, peak (+8%) en centro (panel activo).
                    // Ease sine para curva suave de "respiro" del producto.
                    gsap.fromTo(hero,
                        { scale: baseScale },
                        {
                            keyframes: [
                                { scale: peakScale, ease: "sine.inOut" }, // mid-panel
                                { scale: baseScale, ease: "sine.inOut" }, // exit
                            ],
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
                            // Mobile: cut-cambio del section bg al accent del panel
                            // activo (no hay scrub continuo en stacked).
                            if (root) {
                                gsap.to(root, {
                                    "--psl-section-bg": panelAccents[i],
                                    duration: 0.6,
                                    ease: "power2.out",
                                });
                            }
                            if (editorialMark) editorialMark.style.background = panelBgs[i];
                            if (editorialDot)  editorialDot.style.background  = panelBgs[i];
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
