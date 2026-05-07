/* =====================================================================
   HOLISTIC — race-slider-animations.js
   Slider hero del chapter Race. Maneja:
    - Transición entre slides con un timeline GSAP por cambio
      (saliente: x:-50, scale:0.95, autoAlpha:0 con power2.in;
       entrante: x:80→0, scale:1.05→1, autoAlpha:0→1 con power3.out).
    - Float idle infinito sólo en el slide activo (yoyo, sine.inOut).
    - Autoplay 6s con pausa al hover. Click en dot detiene 10s y reanuda.
    - reduceMotion: cross-fade suave sin transforms ni float.
    - Respeta el patrón del proyecto: importa gsap/mm/BREAKPOINTS de
      lib/registerGsap.js y monta dentro de mm.add() para auto-cleanup.
   ===================================================================== */

import { gsap, mm, BREAKPOINTS } from "./lib/registerGsap.js";

const AUTOPLAY_MS = 6000;
const RESUME_AFTER_MANUAL_MS = 10000;
const TRANSITION_MS = 700;

function initRaceSliders() {
    const sliders = document.querySelectorAll("[data-race-slider]");
    if (!sliders.length) return;

    mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion } = context.conditions;

        const cleanups = [];

        sliders.forEach((slider) => {
            const slides = Array.from(slider.querySelectorAll("[data-slide]"));
            const dots = Array.from(slider.querySelectorAll("[data-slide-dot]"));
            const arrows = Array.from(slider.querySelectorAll("[data-slide-arrow]"));
            if (slides.length < 2) return;

            let activeIndex = 0;
            let autoplayId = null;
            let manualPauseId = null;
            let floatTween = null;
            let transitionTl = null;
            let hoverPaused = false;
            let isTransitioning = false;

            // Estado base: todos los slides ocultos en GSAP-land salvo
            // el activo. Usamos autoAlpha (oculta + visibility) para que
            // los slides no-activos no capturen pointer events.
            gsap.set(slides, { autoAlpha: 0, x: 0, scale: 1 });
            gsap.set(slides[0], { autoAlpha: 1 });

            const startFloat = (slide) => {
                if (reduceMotion) return;
                const bg = slide.querySelector("[data-slide-bg]");
                if (!bg) return;
                floatTween = gsap.to(bg, {
                    y: -12,
                    duration: 3,
                    ease: "sine.inOut",
                    yoyo: true,
                    repeat: -1,
                });
            };

            const stopFloat = () => {
                if (floatTween) {
                    floatTween.kill();
                    floatTween = null;
                }
            };

            const setActiveColor = (slide) => {
                const color = getComputedStyle(slide).getPropertyValue("--slide-color").trim();
                if (color) slider.style.setProperty("--race-active-color", color);
            };

            const setDots = (index) => {
                dots.forEach((dot, i) => {
                    dot.classList.toggle("race-dot--active", i === index);
                    dot.setAttribute("aria-current", i === index ? "true" : "false");
                });
            };

            const setSlideAria = (incomingIndex) => {
                slides.forEach((s, i) => {
                    s.classList.toggle("race-slide--active", i === incomingIndex);
                    s.setAttribute("aria-hidden", i === incomingIndex ? "false" : "true");
                });
            };

            const goToSlide = (nextIndex, { fromUser = false } = {}) => {
                if (isTransitioning) return;
                if (nextIndex === activeIndex) return;
                const total = slides.length;
                const targetIndex = ((nextIndex % total) + total) % total;
                const outgoing = slides[activeIndex];
                const incoming = slides[targetIndex];

                isTransitioning = true;
                stopFloat();

                // Posicioná al entrante a la derecha antes de que aparezca.
                gsap.set(incoming, {
                    autoAlpha: 0,
                    x: reduceMotion ? 0 : 80,
                    scale: reduceMotion ? 1 : 1.05,
                });

                if (transitionTl) transitionTl.kill();

                transitionTl = gsap.timeline({
                    defaults: { overwrite: "auto" },
                    onComplete: () => {
                        isTransitioning = false;
                        startFloat(incoming);
                    },
                });

                if (reduceMotion) {
                    transitionTl
                        .to(outgoing, { autoAlpha: 0, duration: 0.3, ease: "none" }, 0)
                        .to(incoming, { autoAlpha: 1, duration: 0.3, ease: "none" }, 0);
                } else {
                    transitionTl
                        .to(outgoing, {
                            x: -50,
                            scale: 0.95,
                            autoAlpha: 0,
                            duration: TRANSITION_MS / 1000 - 0.2,
                            ease: "power2.in",
                        }, 0)
                        .to(incoming, {
                            x: 0,
                            scale: 1,
                            autoAlpha: 1,
                            duration: TRANSITION_MS / 1000,
                            ease: "power3.out",
                        }, 0.1);
                }

                activeIndex = targetIndex;
                slider.dataset.activeIndex = String(targetIndex);
                setSlideAria(targetIndex);
                setDots(targetIndex);
                setActiveColor(incoming);

                if (fromUser) {
                    pauseAutoplay();
                    if (manualPauseId) clearTimeout(manualPauseId);
                    manualPauseId = setTimeout(() => {
                        manualPauseId = null;
                        if (!hoverPaused) startAutoplay();
                    }, RESUME_AFTER_MANUAL_MS);
                }
            };

            const next = () => goToSlide(activeIndex + 1);

            const startAutoplay = () => {
                if (autoplayId || reduceMotion) return;
                autoplayId = setInterval(next, AUTOPLAY_MS);
            };

            const pauseAutoplay = () => {
                if (autoplayId) {
                    clearInterval(autoplayId);
                    autoplayId = null;
                }
            };

            const onEnter = () => {
                hoverPaused = true;
                pauseAutoplay();
            };
            const onLeave = () => {
                hoverPaused = false;
                if (!manualPauseId) startAutoplay();
            };

            slider.addEventListener("mouseenter", onEnter);
            slider.addEventListener("mouseleave", onLeave);

            const onDotClick = (e) => {
                const btn = e.currentTarget;
                const idx = parseInt(btn.dataset.targetIndex || "0", 10);
                goToSlide(idx, { fromUser: true });
            };
            dots.forEach((dot) => dot.addEventListener("click", onDotClick));

            const onArrowClick = (e) => {
                const dir = e.currentTarget.dataset.slideArrow;
                const delta = dir === "prev" ? -1 : 1;
                goToSlide(activeIndex + delta, { fromUser: true });
            };
            arrows.forEach((arrow) => arrow.addEventListener("click", onArrowClick));

            // Iniciá float del slide 0 y autoplay (autoplay no arranca si reduceMotion).
            startFloat(slides[0]);
            startAutoplay();

            cleanups.push(() => {
                pauseAutoplay();
                if (manualPauseId) clearTimeout(manualPauseId);
                stopFloat();
                if (transitionTl) transitionTl.kill();
                slider.removeEventListener("mouseenter", onEnter);
                slider.removeEventListener("mouseleave", onLeave);
                dots.forEach((dot) => dot.removeEventListener("click", onDotClick));
                arrows.forEach((arrow) => arrow.removeEventListener("click", onArrowClick));
            });
        });

        return () => cleanups.forEach((fn) => fn());
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRaceSliders);
} else {
    initRaceSliders();
}
