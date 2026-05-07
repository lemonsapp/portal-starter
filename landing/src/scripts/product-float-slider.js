/* =====================================================================
   product-float-slider.js
   1) WELCOME — timeline cinemática que arranca al .is-loaded del Loader.
   2) PIN HORIZONTAL — slider SPYLT-style con 6 panels (xPercent + scrub
      + snap + containerAnimation parallax).

   Skills aplicadas (citadas inline):
     • gsap-timeline                       → welcome multi-step + per-panel
     • gsap-scrolltrigger pin/scrub/snap   → horizontal pinned slider
     • gsap-scrolltrigger containerAnimation → parallax sub-elementos
     • gsap-plugins SplitText              → headline (lines/words/chars)
     • gsap-utils.toArray, mapRange        → setup
     • gsap-core matchMedia                → reduced-motion + responsive
     • gsap-performance                    → transforms only, will-change
     • accessibility                       → aria-selected en steps, hidden hints
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText } from "./lib/registerGsap.js";

function initProductSlider() {
    const root = document.querySelector("[data-product-slider]");
    if (!root) return;

    /* -----------------------------------------------------------------
       Refs — Welcome
       ----------------------------------------------------------------- */
    const welcome        = root.querySelector("[data-psl-welcome]");
    const welcomeBlobs   = gsap.utils.toArray("[data-psl-welcome-blob]", root);
    const welcomeEyebrow = root.querySelector("[data-psl-welcome-eyebrow]");
    const welcomeHL      = root.querySelector("[data-psl-welcome-headline]");
    const welcomeSub     = root.querySelector("[data-psl-welcome-sub]");
    const welcomeRow     = root.querySelector("[data-psl-welcome-row]");
    const welcomeGhosts  = gsap.utils.toArray("[data-psl-welcome-ghost]", root);
    const welcomeScroll  = root.querySelector("[data-psl-welcome-scroll]");

    /* -----------------------------------------------------------------
       Refs — Pin slider
       ----------------------------------------------------------------- */
    const pinWrap   = root.querySelector("[data-psl-pin-wrap]");
    const track     = root.querySelector("[data-psl-track]");
    const panels    = gsap.utils.toArray("[data-psl-panel]", root);
    const bignames  = gsap.utils.toArray("[data-psl-bigname]", root);
    const panelImgs = gsap.utils.toArray("[data-psl-panel-img]", root);
    const steps     = gsap.utils.toArray("[data-psl-step]", root);
    const hudNum    = root.querySelector("[data-psl-hud-num]");

    const total = panels.length;
    if (!total || !track) return;

    mm.add({
        ...BREAKPOINTS,
        isHorizontal: "(min-width: 901px)",
        isStacked:    "(max-width: 900px)",
    }, (ctx) => {
        const { isHorizontal, isStacked, reduceMotion } = ctx.conditions;

        // ============================================================
        // 1) WELCOME — timeline cinemática que arranca al .is-loaded
        //    o si la página ya cargó. Pasos:
        //      1.1) Background blobs respiran in (scale + opacity)
        //      1.2) Eyebrow fade up
        //      1.3) Headline lines: cada línea con words stagger desde abajo
        //      1.4) Subhead fade up
        //      1.5) Ghost-row pop + idle drift
        //      1.6) Scroll hint
        // ============================================================
        let splitWelcome = null;
        let welcomeWords = [];
        if (welcomeHL) {
            splitWelcome = SplitText.create(welcomeHL, {
                type: "lines, words",
                mask: "lines",
                linesClass: "psl__welcome-line-split",
                wordsClass: "psl__welcome-word",
                aria: "auto",
            });
            welcomeWords = splitWelcome.words;
        }

        // Estados iniciales
        gsap.set(welcomeBlobs,  { autoAlpha: 0, scale: 0.6 });
        gsap.set(welcomeEyebrow,{ autoAlpha: 0, y: 22 });
        gsap.set(welcomeWords,  { yPercent: 110, rotationX: -45, autoAlpha: 0, transformOrigin: "50% 100%" });
        gsap.set(welcomeSub,    { autoAlpha: 0, y: 24 });
        gsap.set(welcomeGhosts, { autoAlpha: 0, y: 60, scale: 0.7, rotation: () => gsap.utils.random(-12, 12, 1) });
        gsap.set(welcomeScroll, { autoAlpha: 0 });

        if (reduceMotion) {
            gsap.set([welcomeBlobs, welcomeEyebrow, welcomeWords, welcomeSub, welcomeGhosts, welcomeScroll],
                { autoAlpha: 1, y: 0, scale: 1, yPercent: 0, rotation: 0, rotationX: 0 });
        } else {
            const playWelcome = () => {
                const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

                tl.to(welcomeBlobs, {
                    autoAlpha: 0.65, scale: 1,
                    duration: 1.6, ease: "power3.out",
                    stagger: { amount: 0.4, from: "random" },
                }, 0);

                tl.to(welcomeEyebrow, {
                    autoAlpha: 1, y: 0,
                    duration: 0.7, ease: "back.out(1.6)",
                }, 0.15);

                tl.to(welcomeWords, {
                    yPercent: 0, rotationX: 0, autoAlpha: 1,
                    duration: 1.0, ease: "back.out(1.4)",
                    stagger: { amount: 0.7, from: "start" },
                }, 0.3);

                tl.to(welcomeSub, {
                    autoAlpha: 1, y: 0,
                    duration: 0.8, ease: "power3.out",
                }, 0.95);

                tl.to(welcomeGhosts, {
                    autoAlpha: 1, y: 0, scale: 1, rotation: 0,
                    duration: 0.85, ease: "back.out(1.6)",
                    stagger: { amount: 0.5, from: "center" },
                }, 1.0);

                tl.to(welcomeScroll, {
                    autoAlpha: 1, duration: 0.6,
                }, 1.6);

                // Idle: blobs respiran + ghosts hacen leve flotación
                tl.add(() => {
                    welcomeBlobs.forEach((b, i) => {
                        gsap.to(b, {
                            scale: 1.1, x: gsap.utils.random(-30, 30, 1),
                            duration: gsap.utils.random(4, 6),
                            ease: "sine.inOut", yoyo: true, repeat: -1,
                            delay: i * 0.4,
                        });
                    });
                    welcomeGhosts.forEach((g, i) => {
                        gsap.to(g, {
                            y: gsap.utils.random(-12, 12, 1),
                            duration: gsap.utils.random(2.5, 4),
                            ease: "sine.inOut", yoyo: true, repeat: -1,
                            delay: i * 0.18,
                        });
                    });
                });
            };

            // Arranca cuando el Loader libera (clase .is-loaded en <html>)
            // o si la página ya está cargada al ejecutar el script.
            if (document.documentElement.classList.contains("is-loaded")) {
                playWelcome();
            } else {
                const obs = new MutationObserver(() => {
                    if (document.documentElement.classList.contains("is-loaded")) {
                        obs.disconnect();
                        playWelcome();
                    }
                });
                obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
                ctx.add(() => () => obs.disconnect());
                // Fallback: si el Loader no carga (ej. dev server), arrancar tras 600ms
                setTimeout(() => {
                    if (!document.documentElement.classList.contains("is-loaded")) {
                        document.documentElement.classList.add("is-loaded");
                    }
                }, 1000);
            }
        }

        // ============================================================
        // 1.b) WELCOME → SLIDER transition (scroll out)
        //    Mientras el usuario scrollea bajando del welcome, el contenido
        //    hace fade-out + parallax up. Usa scrub.
        // ============================================================
        if (welcome && !reduceMotion) {
            gsap.to(
                [welcomeEyebrow, welcomeHL, welcomeSub, welcomeRow, welcomeScroll],
                {
                    yPercent: -30,
                    autoAlpha: 0,
                    ease: "none",
                    stagger: 0.04,
                    scrollTrigger: {
                        trigger: welcome,
                        start: "top top",
                        end: "bottom 30%",
                        scrub: 0.6,
                    },
                }
            );
        }

        // ============================================================
        // 2) PIN HORIZONTAL — slider SPYLT-style con 6 panels
        // ============================================================
        if (isHorizontal && !reduceMotion) {
            gsap.set(track, { width: `${total * 100}vw` });
            panels.forEach((p) => gsap.set(p, { width: "100vw" }));

            // Tween principal del horizontal scroll (ease: "none" CRÍTICO
            // según skill gsap-scrolltrigger > Horizontal scroll).
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
                    },
                },
            });

            // Per-panel parallax con containerAnimation
            bignames.forEach((bn) => {
                gsap.fromTo(bn,
                    { xPercent: 30, autoAlpha: 0.6 },
                    {
                        xPercent: -30, autoAlpha: 1, ease: "none",
                        scrollTrigger: {
                            containerAnimation: scrollTween,
                            trigger: bn.parentElement,
                            start: "left right", end: "right left", scrub: true,
                        },
                    }
                );
            });
            panelImgs.forEach((img) => {
                gsap.fromTo(img,
                    { xPercent: 12, scale: 0.95 },
                    {
                        xPercent: -12, scale: 1.02, ease: "none",
                        scrollTrigger: {
                            containerAnimation: scrollTween,
                            trigger: img.parentElement,
                            start: "left right", end: "right left", scrub: true,
                        },
                    }
                );
            });

            // Click en step → mover scroll a la posición del panel
            steps.forEach((s, i) => {
                const fn = () => {
                    const st = scrollTween.scrollTrigger;
                    if (!st) return;
                    const target = st.start + (st.end - st.start) * (i / (total - 1));
                    if (window.__lenis && typeof window.__lenis.scrollTo === "function") {
                        window.__lenis.scrollTo(target, { duration: 1.0, easing: (t) => 1 - Math.pow(1 - t, 3) });
                    } else {
                        window.scrollTo({ top: target, behavior: "smooth" });
                    }
                };
                s.addEventListener("click", fn);
                ctx.add(() => () => s.removeEventListener("click", fn));
            });

        // ============================================================
        // STACKED (mobile) — sin pin, panels apilados verticalmente
        // ============================================================
        } else if (isStacked || reduceMotion) {
            gsap.set(track, { width: "100%", clearProps: "transform" });
            panels.forEach((p) => gsap.set(p, { width: "100%", clearProps: "transform" }));

            if (!reduceMotion) {
                panels.forEach((p) => {
                    const img = p.querySelector("[data-psl-panel-img] img");
                    const name = p.querySelector(".psl__panel-name");
                    const bn = p.querySelector("[data-psl-bigname]");
                    gsap.from([bn, img, name].filter(Boolean), {
                        autoAlpha: 0, y: 40, duration: 0.9,
                        stagger: 0.12, ease: "back.out(1.3)",
                        scrollTrigger: {
                            trigger: p, start: "top 70%",
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

        // Cleanup matchMedia: revert SplitText
        return () => {
            if (splitWelcome) splitWelcome.revert();
        };
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductSlider);
} else {
    initProductSlider();
}
