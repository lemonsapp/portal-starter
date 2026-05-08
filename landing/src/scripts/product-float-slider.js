/* =====================================================================
   product-float-slider.js — SPYLT-style horizontal pinned slider con
   composición por capas pre-renderizadas + editorial cinemática.

   Layers: pin horizontal scroll, layered card, editorial con SplitText
   char reveal, counter, chip live, asterisk SVG, partículas canvas2D
   y glow ambient color-sync.

   Skills aplicadas (citadas inline):
     • gsap-timeline                       → choreography multi-step
     • gsap-scrolltrigger pin/scrub/snap   → horizontal slider
     • gsap-scrolltrigger containerAnim    → parallax layers
     • gsap-scrolltrigger toggleActions    → entrance editorial
     • gsap-plugins SplitText              → char reveal con mask
     • gsap-plugins CustomEase 'explode'   → mark entrance overshoot
     • gsap-plugins DrawSVGPlugin          → asterisco draw-in
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
    const editorial            = root.querySelector("[data-psl-editorial]");
    const editorialMark        = root.querySelector("[data-psl-editorial-mark]");
    const editorialChip        = root.querySelector("[data-psl-editorial-chip]");
    const editorialChipName    = root.querySelector("[data-psl-editorial-chip-name]");
    const editorialLines       = gsap.utils.toArray("[data-psl-editorial-line]", root);
    const editorialSub         = root.querySelector("[data-psl-editorial-sub]");
    const editorialAsterisk    = root.querySelector("[data-psl-asterisk]");
    const counter              = root.querySelector("[data-psl-counter]");
    const counterCurrent       = root.querySelector("[data-psl-counter-current]");
    const counterDigits        = gsap.utils.toArray("[data-counter-digit]", root);
    const glow                 = root.querySelector("[data-psl-glow]");
    const particlesCanvas      = root.querySelector("[data-psl-particles]");

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
        //    skill: gsap-plugins DrawSVGPlugin (asterisco)
        // ============================================================

        // SplitText: convierte cada línea en chars con mask. El padre
        // .psl__editorial-line tiene overflow:hidden → los chars suben
        // desde abajo del mask al hacer y:0.
        let splitInstances = [];
        const lineInners = editorialLines
            .map((line) => line.querySelector(".psl__editorial-line-inner"))
            .filter(Boolean);

        if (lineInners.length) {
            // SplitText falla si los lines tienen <svg> u otros elementos
            // no-text adentro. Por eso splitemos sólo el line-inner que
            // contiene texto. La línea con asterisco SVG queda fuera del
            // split (el asterisco se anima por separado).
            lineInners.forEach((inner) => {
                // Si tiene <svg> hijo (línea con asterisco), saltear split
                if (inner.querySelector("svg")) return;
                const split = SplitText.create(inner, {
                    type: "chars,words",
                    aria: "auto",
                });
                splitInstances.push(split);
            });
        }

        const allChars = splitInstances.flatMap((s) => s.chars);

        if (reduceMotion) {
            // Skip animations: dejar visible directamente
            gsap.set([editorialChip, editorialSub, editorialMark, ...lineInners], {
                autoAlpha: 1, y: 0,
            });
            if (allChars.length) gsap.set(allChars, { y: 0, autoAlpha: 1 });
            if (counterDigits.length) gsap.set(counterDigits, { y: 0 });
            if (editorialAsterisk) {
                gsap.set(editorialAsterisk.querySelectorAll("path"), { drawSVG: "100%" });
                gsap.set(editorialAsterisk, { autoAlpha: 1, scale: 1 });
            }
        } else {
            // Estados iniciales
            gsap.set([editorialChip, editorialSub], { autoAlpha: 0, y: 14 });
            gsap.set(allChars, { yPercent: 110, autoAlpha: 0 });
            // Mark: tilt -1.6 + scale + alpha 0
            gsap.set(editorialMark, {
                scaleX: 0.6, scaleY: 0.85, rotation: -1.6,
                autoAlpha: 0, transformOrigin: "0 50%",
            });
            // Asterisco: undraw + invisible + 0.6 scale
            if (editorialAsterisk) {
                const paths = editorialAsterisk.querySelectorAll("path");
                gsap.set(paths, { drawSVG: "0%" });
                gsap.set(editorialAsterisk, { autoAlpha: 0, scale: 0.4, rotation: -90 });
            }
            // Counter digits: ocultos abajo del mask (overflow:hidden en parent)
            gsap.set(counterDigits, { yPercent: 100 });

            const tl = gsap.timeline({
                defaults: { ease: "power3.out" },
                scrollTrigger: {
                    trigger: pinWrap,
                    start: "top 75%",
                    toggleActions: "play none none reverse",
                },
            });

            // 1. Chip fade-in
            tl.to(editorialChip, { autoAlpha: 1, y: 0, duration: 0.55 }, 0);

            // 2. Counter digits suben con stagger
            tl.to(counterDigits, {
                yPercent: 0,
                duration: 0.7,
                stagger: 0.06,
                ease: "power2.out",
            }, 0.1);

            // 3. Headline chars rise from mask con stagger fino
            //    skill: gsap-plugins SplitText con cada char animado
            if (allChars.length) {
                tl.to(allChars, {
                    yPercent: 0,
                    autoAlpha: 1,
                    duration: 0.85,
                    stagger: { amount: 0.7, from: "start" },
                    ease: "power3.out",
                }, 0.2);
            }

            // 4. Asterisco SVG draw + scale + rotate
            //    skill: gsap-plugins DrawSVGPlugin
            if (editorialAsterisk) {
                const paths = editorialAsterisk.querySelectorAll("path");
                tl.to(editorialAsterisk, {
                    autoAlpha: 1, scale: 1, rotation: 0,
                    duration: 0.7,
                    ease: "back.out(1.8)",
                }, "-=0.5");
                tl.to(paths, {
                    drawSVG: "100%",
                    duration: 0.6,
                    stagger: 0.08,
                    ease: "power2.out",
                }, "-=0.55");
            }

            // 5. Mark con custom ease 'explode' (anticipation+overshoot)
            //    skill: gsap-plugins CustomEase
            tl.to(editorialMark, {
                scaleX: 1, scaleY: 1, autoAlpha: 1,
                duration: 0.85,
                ease: "explode",
            }, "-=0.45");

            // 6. Sub fade-in último
            tl.to(editorialSub, { autoAlpha: 1, y: 0, duration: 0.6 }, "-=0.3");
        }

        // ============================================================
        // 0.b) IDLE — micro-animaciones del editorial (loop infinito)
        // ============================================================
        if (!reduceMotion) {
            // El "6" serif italic: leve oscilación de rotation
            const six = root.querySelector(".psl__editorial-six");
            if (six) {
                gsap.to(six, {
                    rotation: -1.5,
                    y: -2,
                    duration: 3.4,
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                });
            }
            // Asterisco: rotación lenta continua + bobbing
            if (editorialAsterisk) {
                gsap.to(editorialAsterisk, {
                    rotation: "+=360",
                    duration: 24,
                    ease: "none",
                    repeat: -1,
                });
            }
            // Mark: respiración sutil de scale
            if (editorialMark) {
                gsap.to(editorialMark, {
                    scale: 1.018,
                    duration: 2.8,
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                });
            }
        }

        // ============================================================
        // 0.c) PARTÍCULAS CANVAS — fondo del pin-wrap
        //      Canvas2D con ~120 partículas, parallax mouse + scroll,
        //      color tint per panel. Lightweight, no Three.js.
        // ============================================================
        let particlesRAF = null;
        let particlesState = null;
        if (particlesCanvas && !reduceMotion) {
            particlesState = setupParticles(particlesCanvas, panels);
            const tick = () => {
                drawParticles(particlesState);
                particlesRAF = requestAnimationFrame(tick);
            };
            particlesRAF = requestAnimationFrame(tick);

            const onResize = () => resizeParticles(particlesState);
            window.addEventListener("resize", onResize);
            ctx.add(() => () => {
                window.removeEventListener("resize", onResize);
                if (particlesRAF) cancelAnimationFrame(particlesRAF);
            });

            const onMouse = (e) => {
                const rect = pinWrap.getBoundingClientRect();
                particlesState.mouseX = (e.clientX - rect.left) / rect.width;
                particlesState.mouseY = (e.clientY - rect.top) / rect.height;
            };
            pinWrap.addEventListener("mousemove", onMouse);
            ctx.add(() => () => pinWrap.removeEventListener("mousemove", onMouse));
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
                        const padded = String(idx + 1).padStart(2, "0");
                        if (hudNum) hudNum.textContent = padded;

                        steps.forEach((s, i) => {
                            const isActive = i === idx;
                            s.classList.toggle("is-active", isActive);
                            s.setAttribute("aria-selected", isActive ? "true" : "false");
                        });
                        panels.forEach((p, i) => p.classList.toggle("is-active", i === idx));

                        // Counter digits update con flip animation
                        updateCounterDigits(counterDigits, padded, reduceMotion);

                        // Editorial mark color sync
                        const activePanel = panels[idx];
                        if (activePanel) {
                            const bg = activePanel.style.getPropertyValue("--psl-bg");
                            const accent = activePanel.style.getPropertyValue("--psl-accent");
                            if (editorialMark && bg) editorialMark.style.background = bg;
                            if (editorialAsterisk && bg) editorialAsterisk.style.color = bg;
                            if (editorialChipName && bg) editorialChipName.style.color = bg;
                            if (glow && bg && accent) {
                                glow.style.setProperty("--psl-glow-bg", `${bg}80`);     // 50% alpha
                                glow.style.setProperty("--psl-glow-accent", `${accent}b3`); // 70% alpha
                            }
                            // Particles tint
                            if (particlesState && bg) {
                                particlesState.targetTint = hexToRgb(bg);
                            }
                            // Chip name flip update
                            updateChipName(editorialChipName, activePanel.dataset.nombre, reduceMotion);
                        }

                        // Particles parallax con scroll
                        if (particlesState) {
                            particlesState.scrollProgress = self.progress;
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
                            const padded = String(i + 1).padStart(2, "0");
                            if (hudNum) hudNum.textContent = padded;
                            steps.forEach((s, k) => {
                                s.classList.toggle("is-active", k === i);
                                s.setAttribute("aria-selected", k === i ? "true" : "false");
                            });
                            updateCounterDigits(counterDigits, padded, reduceMotion);
                            const bg = p.style.getPropertyValue("--psl-bg");
                            if (editorialMark && bg) editorialMark.style.background = bg;
                            if (editorialAsterisk && bg) editorialAsterisk.style.color = bg;
                            if (editorialChipName && bg) editorialChipName.style.color = bg;
                            updateChipName(editorialChipName, p.dataset.nombre, reduceMotion);
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

        // Cleanup matchMedia: revert SplitText + RAF
        return () => {
            splitInstances.forEach((s) => s.revert());
            if (particlesRAF) cancelAnimationFrame(particlesRAF);
        };
    });
}

/* =====================================================================
   Counter digit flip update
   Cada dígito vive en un span con overflow:hidden parent. Al cambiar el
   dígito hacemos un flip vertical: out arriba, in desde abajo.
   ===================================================================== */
function updateCounterDigits(digitEls, paddedStr, reduceMotion) {
    if (!digitEls || digitEls.length < 2) return;
    const chars = paddedStr.split("");
    digitEls.forEach((el, i) => {
        if (el.textContent === chars[i]) return;
        if (reduceMotion) {
            el.textContent = chars[i];
            return;
        }
        gsap.to(el, {
            yPercent: -100,
            duration: 0.18,
            ease: "power2.in",
            onComplete: () => {
                el.textContent = chars[i];
                gsap.fromTo(el,
                    { yPercent: 100 },
                    { yPercent: 0, duration: 0.32, ease: "power3.out" }
                );
            },
        });
    });
}

/* =====================================================================
   Chip name flip update
   ===================================================================== */
function updateChipName(el, nombre, reduceMotion) {
    if (!el || !nombre || el.textContent === nombre) return;
    if (reduceMotion) {
        el.textContent = nombre;
        return;
    }
    gsap.to(el, {
        yPercent: -120,
        autoAlpha: 0,
        duration: 0.22,
        ease: "power2.in",
        onComplete: () => {
            el.textContent = nombre;
            gsap.fromTo(el,
                { yPercent: 120, autoAlpha: 0 },
                {
                    yPercent: 0, autoAlpha: 1,
                    duration: 0.4,
                    ease: "back.out(1.8)",
                }
            );
        },
    });
}

/* =====================================================================
   Particles canvas2D
   skill: gsap-utils.random + gsap-performance (RAF, transforms only)
   ~120 partículas con parallax mouse + scroll, color tint dinámico.
   ===================================================================== */
function setupParticles(canvas, panels) {
    const ctx = canvas.getContext("2d", { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const state = {
        canvas, ctx, dpr,
        w: 0, h: 0,
        particles: [],
        mouseX: 0.5,
        mouseY: 0.5,
        scrollProgress: 0,
        currentTint: hexToRgb(panels[0]?.style.getPropertyValue("--psl-bg") || "#1a1a1a"),
        targetTint: hexToRgb(panels[0]?.style.getPropertyValue("--psl-bg") || "#1a1a1a"),
    };

    const resize = () => {
        state.w = canvas.offsetWidth;
        state.h = canvas.offsetHeight;
        canvas.width  = state.w * dpr;
        canvas.height = state.h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Crear partículas
    const NUM = 120;
    for (let i = 0; i < NUM; i++) {
        state.particles.push({
            x: Math.random() * state.w,
            y: Math.random() * state.h,
            r: gsap.utils.random(0.6, 2.4),
            vx: gsap.utils.random(-0.06, 0.06),
            vy: gsap.utils.random(-0.04, 0.04),
            depth: gsap.utils.random(0.3, 1),  // for parallax
            alpha: gsap.utils.random(0.18, 0.55),
        });
    }

    return state;
}

function resizeParticles(state) {
    if (!state) return;
    state.w = state.canvas.offsetWidth;
    state.h = state.canvas.offsetHeight;
    state.canvas.width  = state.w * state.dpr;
    state.canvas.height = state.h * state.dpr;
    state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

function drawParticles(state) {
    if (!state) return;
    const { ctx, w, h, particles, mouseX, mouseY, scrollProgress } = state;

    // Lerp tint hacia target color (suaviza transiciones de panel)
    state.currentTint = lerpRgb(state.currentTint, state.targetTint, 0.04);
    const [r, g, b] = state.currentTint;

    ctx.clearRect(0, 0, w, h);

    // Parallax shift basado en scroll horizontal del slider
    const parallaxX = -scrollProgress * 80; // px
    const mouseShiftX = (mouseX - 0.5) * 30;
    const mouseShiftY = (mouseY - 0.5) * 20;

    for (const p of particles) {
        // Movimiento natural
        p.x += p.vx;
        p.y += p.vy;
        // Wrap edges
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Parallax con depth
        const px = p.x + parallaxX * p.depth + mouseShiftX * p.depth;
        const py = p.y + mouseShiftY * p.depth;

        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha * p.depth})`;
        ctx.fill();
    }
}

/* =====================================================================
   Color helpers
   ===================================================================== */
function hexToRgb(hex) {
    if (!hex) return [26, 26, 26];
    hex = hex.trim().replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lerpRgb(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    ];
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductSlider);
} else {
    initProductSlider();
}
