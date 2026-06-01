/* =====================================================================
   HOLISTIC — race-formats-showcase.js
   Showcase de las 4 fórmulas Race en /linea-race. Maneja:
    - Cross-fade con blur entre imágenes activas (timeline GSAP).
    - Tabs clickeables + autorotate cada 5s con pause al hover/focus.
    - Tema dinámico: cuando cambia la fórmula activa, las CSS vars
      del color (--rfs-active-color) se actualizan en el root y
      animan halo, dot, ring, tab fill, caption tagline.
    - Partículas orbitales: distribuidas en círculo alrededor del
      stage con drift radial sutil + scintilación opacity.
    - Reveal scroll-driven (entrada al viewport).
    - Reduced motion: estado final inmediato sin animación, autorotate
      desactivado.

   Skills aplicadas (citadas en el componente):
     • gsap-timeline           → cross-fade coordinado entre fórmulas
     • gsap-scrolltrigger      → reveal al entrar viewport
     • gsap-utils.toArray      → setup partículas + tabs
     • gsap-utils.random       → variación de duración/delay
     • gsap-core matchMedia    → reduce-motion + breakpoints
     • gsap-performance        → transforms only, will-change scoped
   ===================================================================== */

import { gsap, ScrollTrigger, mm, BREAKPOINTS } from "./lib/registerGsap.js";

const AUTOROTATE_MS = 5000;

function initRaceFormatsShowcase() {
    const root = document.querySelector("[data-rfs]");
    if (!root) return;

    // ===== Refs =====
    const total = parseInt(root.dataset.total, 10) || 4;
    const eyebrow = root.querySelector("[data-rfs-eyebrow]");
    const title = root.querySelector("[data-rfs-title]");
    const hudNum = root.querySelector("[data-rfs-hud-num]");
    const stage = root.querySelector("[data-rfs-stage]");
    const halo = root.querySelector("[data-rfs-halo]");
    const ring = root.querySelector("[data-rfs-ring]");
    const core = root.querySelector("[data-rfs-core]");
    const images = gsap.utils.toArray("[data-rfs-image]");
    const particles = gsap.utils.toArray("[data-rfs-particle]");
    const tabs = gsap.utils.toArray("[data-rfs-tab]");
    const railFill = root.querySelector("[data-rfs-rail-fill]");
    const captionPanels = gsap.utils.toArray("[data-rfs-caption-panel]");

    // Lee colores por tab desde el style inline (--tab-color).
    const tabColors = tabs.map((t) => {
        const m = t.getAttribute("style") || "";
        const match = m.match(/--tab-color:\s*([^;]+);?/);
        return (match && match[1].trim()) || "#2E8F6E";
    });

    let activeIdx = 0;
    let autoTimer = null;
    let isHovered = false;

    /**
     * Aplica la fórmula activa: actualiza imágenes, tabs, caption,
     * rail underline, color tema, HUD counter. Usa una mini-timeline
     * para coordinar el cross-fade.
     */
    function setActive(nextIdx, opts = {}) {
        if (nextIdx === activeIdx && !opts.force) return;
        const prevIdx = activeIdx;
        activeIdx = nextIdx;

        const color = tabColors[activeIdx];
        // CSS var en el root del showcase: TODO el subsystem (halo,
        // ring, dot, tab fill, caption tagline) hereda de aquí.
        root.style.setProperty("--rfs-active-color", color);

        // Imágenes: out de la previa con blur, in de la nueva.
        const prevImg = images[prevIdx];
        const nextImg = images[activeIdx];
        if (prevImg !== nextImg) {
            gsap.timeline()
                .to(prevImg, {
                    opacity: 0,
                    filter: "blur(20px) saturate(0.7)",
                    scale: 0.94,
                    duration: 0.55,
                    ease: "power2.in",
                    onComplete: () => prevImg.classList.remove("is-active"),
                }, 0)
                .add(() => nextImg.classList.add("is-active"), 0.05)
                .fromTo(nextImg, {
                    opacity: 0,
                    filter: "blur(20px) saturate(0.7)",
                    scale: 0.94,
                }, {
                    opacity: 1,
                    filter: "blur(0px) saturate(1.04)",
                    scale: 1,
                    duration: 0.85,
                    ease: "power3.out",
                }, 0.1);
        }

        // Tabs aria + active class.
        tabs.forEach((t, i) => {
            const isAct = i === activeIdx;
            t.classList.toggle("is-active", isAct);
            t.setAttribute("aria-selected", isAct ? "true" : "false");
        });

        // Rail underline: traslada al tab activo.
        // El rail tiene width: 20% (1/total) del contenedor, así que
        // moverlo `activeIdx * 100` del propio elemento (xPercent) lo
        // alinea exactamente con el tab activo.
        if (railFill) {
            gsap.to(railFill, {
                xPercent: activeIdx * 100,
                duration: 0.6,
                ease: "power3.inOut",
                background: color,
                overwrite: "auto",
            });
        }

        // Caption panels — orquestados con GSAP para evitar overlap.
        //
        // El bug anterior: el revealTl deja inline styles (opacity:1,
        // y:0) sobre captionPanels[0]. Esas inline styles tienen mayor
        // especificidad que cualquier regla CSS, así que al sacarle la
        // clase `is-active` la transición CSS para fade-out no se
        // ejecuta. Resultado: caption vieja sigue visible mientras la
        // nueva entra → ambos textos se pisan.
        //
        // Fix: GSAP maneja el cross-fade explícitamente. Outgoing fade
        // out rápido sin delay, incoming entra recién cuando la otra
        // se desvaneció por completo.
        const prevPanel = captionPanels[prevIdx];
        const nextPanel = captionPanels[activeIdx];
        if (prevPanel && nextPanel && prevPanel !== nextPanel) {
            gsap.killTweensOf([prevPanel, nextPanel]);
            gsap.timeline()
                .to(prevPanel, {
                    opacity: 0,
                    y: -8,
                    duration: 0.28,
                    ease: "power2.in",
                    onComplete: () => {
                        prevPanel.classList.remove("is-active");
                        prevPanel.setAttribute("aria-hidden", "true");
                    },
                }, 0)
                .fromTo(nextPanel,
                    { opacity: 0, y: 12 },
                    {
                        opacity: 1,
                        y: 0,
                        duration: 0.45,
                        ease: "power2.out",
                        onStart: () => {
                            nextPanel.classList.add("is-active");
                            nextPanel.setAttribute("aria-hidden", "false");
                        },
                    },
                    0.30
                );
        } else if (nextPanel) {
            // Caso force inicial (prev === next): solo asegurar la clase
            // sin animar (el revealTl ya se encarga de mostrarlo).
            nextPanel.classList.add("is-active");
            nextPanel.setAttribute("aria-hidden", "false");
        }

        // HUD counter.
        if (hudNum) hudNum.textContent = String(activeIdx + 1).padStart(2, "0");
    }

    function next() { setActive((activeIdx + 1) % total); }

    function startAutorotate() {
        stopAutorotate();
        autoTimer = window.setInterval(() => {
            if (!isHovered) next();
        }, AUTOROTATE_MS);
    }
    function stopAutorotate() {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
    }

    // ===== Tabs interaction =====
    tabs.forEach((t, i) => {
        t.addEventListener("click", () => {
            setActive(i);
            // Reiniciar timer para no saltar de inmediato a la siguiente.
            if (autoTimer) startAutorotate();
        });
    });

    // ===== Hover pause =====
    if (stage) {
        stage.addEventListener("mouseenter", () => { isHovered = true; });
        stage.addEventListener("mouseleave", () => { isHovered = false; });
    }
    // Focus en tabs también pausa.
    tabs.forEach((t) => {
        t.addEventListener("focus", () => { isHovered = true; });
        t.addEventListener("blur", () => { isHovered = false; });
    });

    // ===== matchMedia scope =====
    mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion, isMobile } = context.conditions;

        // ----- Reduced motion: stop animations, mantener interactividad -----
        if (reduceMotion) {
            gsap.set([eyebrow, title], { autoAlpha: 1, y: 0 });
            gsap.set(particles, { autoAlpha: 0 });
            // No autorotate, pero tabs sí cambian al click.
            return;
        }

        // ----- Estado inicial controlado por GSAP -----
        gsap.set([eyebrow, title, root.querySelector(".rfs__hud")], {
            autoAlpha: 0, y: 20,
        });
        gsap.set(stage, { autoAlpha: 0, scale: 0.92 });
        gsap.set(tabs, { autoAlpha: 0, y: 18 });
        gsap.set(captionPanels[0], { opacity: 0, y: 20 });

        // ----- Reveal al entrar viewport -----
        const revealTl = gsap.timeline({
            scrollTrigger: {
                trigger: root,
                start: "top 75%",
                once: true,
            },
            defaults: { ease: "power3.out" },
        });

        revealTl
            .to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.6 }, 0)
            .to(title,   { autoAlpha: 1, y: 0, duration: 0.8 }, 0.1)
            .to(root.querySelector(".rfs__hud"), { autoAlpha: 1, y: 0, duration: 0.6 }, 0.25)
            .to(stage,   {
                autoAlpha: 1, scale: 1,
                duration: 1.0, ease: "back.out(1.4)",
            }, 0.35)
            .to(tabs, {
                autoAlpha: 1, y: 0,
                duration: 0.6, stagger: 0.06,
            }, 0.7)
            .to(captionPanels[0], {
                opacity: 1, y: 0,
                duration: 0.7,
            }, 0.95)
            .add(() => {
                startAutorotate();
            });

        // ----- Particles orbitales -----
        // Distribuye partículas en círculo alrededor del stage. Cada
        // una tiene radio + ángulo random, drift sutil hacia adentro/
        // afuera, scintilación de opacity.
        const count = isMobile ? Math.min(12, particles.length) : particles.length;
        particles.slice(count).forEach((p) => gsap.set(p, { autoAlpha: 0, display: "none" }));

        const stageSize = stage ? stage.offsetWidth : 480;
        const baseRadius = stageSize * 0.46;

        const particleTweens = [];
        particles.slice(0, count).forEach((p, i) => {
            const angle = (i / count) * Math.PI * 2 + gsap.utils.random(-0.18, 0.18);
            const radius = baseRadius + gsap.utils.random(-30, 60);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const driftR = gsap.utils.random(-12, 18);
            const dx = Math.cos(angle) * driftR;
            const dy = Math.sin(angle) * driftR;
            const peak = gsap.utils.random(0.45, 0.95);
            const dur = gsap.utils.random(2.5, 5.5);
            const delay = gsap.utils.random(0, 4);

            // Posición base (fija). El movimiento es radial corto +
            // scintilación de opacity, infinito.
            gsap.set(p, { x, y });

            const t = gsap.timeline({ repeat: -1, yoyo: true, delay, paused: true });
            t.to(p, { autoAlpha: peak, duration: dur * 0.45, ease: "sine.out" }, 0)
             .to(p, { x: x + dx, y: y + dy, duration: dur, ease: "sine.inOut" }, 0)
             .to(p, { autoAlpha: peak * 0.3, duration: dur * 0.55, ease: "sine.in" }, dur * 0.45);

            particleTweens.push(t);
        });

        // Arrancar partículas con un pequeño retraso para que aparezcan
        // junto con el stage en el reveal.
        ScrollTrigger.create({
            trigger: root,
            start: "top 70%",
            once: true,
            onEnter: () => {
                particleTweens.forEach((t, i) => {
                    gsap.delayedCall(i * 0.03, () => t.play());
                });
            },
        });

        // Asegurar estado inicial de la primera fórmula.
        setActive(0, { force: true });

        // ----- Cleanup -----
        return () => {
            try { revealTl.kill(); } catch (_) {}
            particleTweens.forEach((t) => { try { t.kill(); } catch (_) {} });
            stopAutorotate();
        };
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRaceFormatsShowcase, { once: true });
} else {
    initRaceFormatsShowcase();
}
