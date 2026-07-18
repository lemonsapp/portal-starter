/* =====================================================================
   HOLISTIC — product-highlights-animations.js
   Sticky pin con N highlights de cualquier producto. Soporta:
     • Imágenes O videos (tag <video>) en cross-fade con blur
     • Big number 01-NN atrás de la imagen (cambia con stagger)
     • Halo + dot + rail + big number stroke + bg gradient: TODOS
       cambian al color del highlight activo (CSS var --ph-active)
     • Tilt 3D al mouse sobre el stage (mapRange + rotation)
     • Partículas orbitales tintadas con color activo
     • SplitText words en title con stagger
     • DrawSVG progress vertical + decorative rule
     • Bottom progress bar horizontal del scroll del pin

   El componente serializa la lista de colores en data-colors para
   que el script no tenga que duplicar el mapping (cada producto tiene
   su paleta propia y este script la lee del DOM).

   Skills aplicadas (citadas en ProductHighlights.astro):
     • gsap-timeline, gsap-scrolltrigger, gsap-plugins SplitText/DrawSVG
     • gsap-utils.toArray/random/mapRange
     • gsap-core matchMedia
     • gsap-performance
   ===================================================================== */

import { gsap, ScrollTrigger, mm, BREAKPOINTS, SplitText, DrawSVGPlugin } from "./lib/registerGsap.js";

function initProductHighlights(root) {
    if (!root) return;
    if (root.dataset.phInit === "1") return;
    root.dataset.phInit = "1";

    // ===== Refs =====
    const total = parseInt(root.dataset.total, 10) || 1;
    const colors = (root.dataset.colors || "").split(",").map((c) => c.trim()).filter(Boolean);

    const pin = root.querySelector("[data-ph-pin]");
    const stage = root.querySelector("[data-ph-stage]");
    const halo = root.querySelector("[data-ph-halo]");
    const images = gsap.utils.toArray("[data-ph-image]", root);
    const bigDigits = gsap.utils.toArray("[data-ph-bignum-digit]", root);
    const particles = gsap.utils.toArray("[data-ph-particle]", root);
    const panels = gsap.utils.toArray("[data-ph-panel]", root);
    const titles = gsap.utils.toArray("[data-ph-title]", root);
    const railFill = root.querySelector("[data-ph-rail-fill]");
    const railTicks = gsap.utils.toArray("[data-ph-rail-tick]", root);
    const ruleLines = gsap.utils.toArray("[data-ph-rule-line]", root);
    const ruleCaps = gsap.utils.toArray("[data-ph-rule-cap]", root);
    const hudNum = root.querySelector("[data-ph-hud-num]");
    const hudDots = gsap.utils.toArray("[data-ph-hud-dot]", root);
    const progressFill = root.querySelector("[data-ph-progress-fill]");

    let activeIdx = 0;
    // Modo liviano (celular): sin blur animado en imágenes ni duraciones
    // largas — el filter:blur() por frame es lo que traba el scroll en móvil.
    // Se setea dentro de mm.add() según la condición isMobile.
    let lite = false;
    // splits[i] = SplitText instance del title de cada panel. Se popula
    // dentro de mm.add() ya que SplitText necesita correr post-DOM.
    // setActive lo usa para reset/reveal del título al cambiar de panel.
    let splits = [];

    /**
     * Reintenta play() del media activo si es un video pausado.
     * El play() del init puede no arrancar: iOS no reproduce videos
     * offscreen al cargar la página, y el modo bajo consumo rechaza
     * cualquier play() que no venga de un gesto. Se llama al entrar
     * la sección al viewport y en el primer gesto del usuario.
     */
    function tryPlayActive() {
        const media = images[activeIdx];
        if (media && media.tagName === "VIDEO" && media.paused) {
            const p = media.play();
            if (p && typeof p.catch === "function") p.catch(() => {});
        }
    }
    window.addEventListener("touchend", tryPlayActive, { once: true, passive: true });
    window.addEventListener("click", tryPlayActive, { once: true });

    // Autoplay robusto: cada vez que un video activo del stage entra al
    // viewport y está pausado, se fuerza play(). Cubre los casos donde el
    // autoplay nativo no disparó (elemento offscreen al cargar, Safari
    // que pausó y no reanudó al volver a la sección).
    const vids = images.filter((el) => el.tagName === "VIDEO");
    if (vids.length && "IntersectionObserver" in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting && e.target.paused && e.target.classList.contains("is-active")) {
                    const p = e.target.play();
                    if (p && typeof p.catch === "function") p.catch(() => {});
                }
            });
        }, { threshold: 0.15 });
        vids.forEach((v) => io.observe(v));
    }

    /**
     * Aplica el highlight `nextIdx`: actualiza color tema, cross-fade
     * de imágenes/videos, big number, panel, rail tick, HUD.
     */
    function setActive(nextIdx) {
        const prevIdx = activeIdx;
        activeIdx = Math.max(0, Math.min(total - 1, nextIdx));
        const color = colors[activeIdx] || colors[0] || "#A7F5C8";

        root.style.setProperty("--ph-active", color);

        // Imágenes / videos
        images.forEach((img, i) => {
            const isAct = i === activeIdx;
            if (isAct && !img.classList.contains("is-active")) {
                img.classList.add("is-active");
                gsap.to(img, {
                    autoAlpha: 1,
                    filter: lite ? "blur(0px) saturate(1)" : "blur(0px) saturate(1.05)",
                    scale: 1,
                    duration: lite ? 0.5 : 0.85,
                    ease: "power3.out",
                    overwrite: "auto",
                });
                // Si es video, lo reproducimos cuando se hace activo.
                if (img.tagName === "VIDEO") {
                    const p = img.play();
                    if (p && typeof p.catch === "function") p.catch(() => {});
                }
            } else if (!isAct && img.classList.contains("is-active")) {
                img.classList.remove("is-active");
                gsap.to(img, {
                    autoAlpha: 0,
                    // En móvil no animamos blur (queda en 0): el cross-fade es
                    // solo opacidad + escala. En desktop sí, para el look rico.
                    filter: lite ? "blur(0px) saturate(1)" : "blur(20px) saturate(0.65)",
                    scale: lite ? 0.97 : 0.93,
                    duration: lite ? 0.4 : 0.6,
                    ease: "power2.in",
                    overwrite: "auto",
                });
                if (img.tagName === "VIDEO") {
                    try { img.pause(); } catch (_) {}
                }
            }
        });

        // Big number con stagger vertical
        bigDigits.forEach((d, i) => {
            const isAct = i === activeIdx;
            if (isAct && !d.classList.contains("is-active")) {
                d.classList.add("is-active");
                gsap.fromTo(d,
                    { autoAlpha: 0, yPercent: 30 },
                    { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: "power3.out", overwrite: "auto" }
                );
            } else if (!isAct && d.classList.contains("is-active")) {
                d.classList.remove("is-active");
                gsap.to(d, {
                    autoAlpha: 0, yPercent: -30,
                    duration: 0.6, ease: "power2.in", overwrite: "auto",
                });
            }
        });

        // Panels + decorative rule por panel (DrawSVG anim cada vez que activa)
        panels.forEach((p, i) => {
            const isAct = i === activeIdx;
            if (isAct && !p.classList.contains("is-active")) {
                p.classList.add("is-active");
                gsap.to(p, {
                    autoAlpha: 1, y: 0,
                    duration: 0.65, ease: "power3.out", overwrite: "auto",
                });
                // Title words: subir desde abajo del mask (yPercent: 110)
                // hasta 0 con stagger. Fix 2026-05-23 — antes solo el
                // primer panel se revelaba; los demás quedaban con título
                // invisible al scrollear.
                const split = splits[i];
                if (split && split.words) {
                    gsap.fromTo(split.words,
                        { yPercent: 110 },
                        { yPercent: 0, duration: 0.8, stagger: 0.04, ease: "expo.out", delay: 0.15, overwrite: "auto" }
                    );
                }
                const ruleLine = ruleLines[i];
                const ruleCap = ruleCaps[i];
                if (ruleLine && ruleCap) {
                    gsap.fromTo(ruleLine,
                        { drawSVG: "0% 0%" },
                        { drawSVG: "0% 100%", duration: 0.9, delay: 0.25, ease: "power3.inOut", overwrite: "auto" }
                    );
                    gsap.fromTo(ruleCap,
                        { autoAlpha: 0, scale: 0 },
                        { autoAlpha: 1, scale: 1, duration: 0.4, delay: 1.05, ease: "back.out(2)", overwrite: "auto" }
                    );
                }
            } else if (!isAct && p.classList.contains("is-active")) {
                p.classList.remove("is-active");
                gsap.to(p, {
                    autoAlpha: 0, y: i < activeIdx ? -20 : 20,
                    duration: 0.45, ease: "power2.in", overwrite: "auto",
                });
                // Reset title words al ocultar el panel — así cuando
                // vuelve a activarse, el reveal arranca limpio desde
                // abajo del mask (efecto consistente en cada visita).
                const split = splits[i];
                if (split && split.words) {
                    gsap.set(split.words, { yPercent: 110 });
                }
            }
        });

        // Rail ticks
        railTicks.forEach((t, i) => t.classList.toggle("is-active", i === activeIdx));

        // HUD
        if (hudNum) hudNum.textContent = String(activeIdx + 1).padStart(2, "0");
        hudDots.forEach((d, i) => d.classList.toggle("is-active", i === activeIdx));
    }

    // ===== matchMedia scope =====
    mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion, isMobile } = context.conditions;
        lite = !!isMobile;

        if (reduceMotion) {
            setActive(0);
            gsap.set(particles, { autoAlpha: 0 });
            return;
        }

        // Estados iniciales GSAP-controlled. En móvil sin blur (ver `lite`).
        gsap.set(images, {
            autoAlpha: 0,
            filter: lite ? "blur(0px) saturate(1)" : "blur(20px) saturate(0.65)",
            scale: lite ? 0.97 : 0.93,
        });
        if (images[0]) {
            gsap.set(images[0], { autoAlpha: 1, filter: lite ? "blur(0px) saturate(1)" : "blur(0px) saturate(1.05)", scale: 1 });
            tryPlayActive();
        }
        gsap.set(bigDigits, { autoAlpha: 0, yPercent: 30 });
        if (bigDigits[0]) gsap.set(bigDigits[0], { autoAlpha: 1, yPercent: 0 });
        gsap.set(panels, { autoAlpha: 0, y: 20 });
        if (panels[0]) gsap.set(panels[0], { autoAlpha: 1, y: 0 });
        gsap.set(progressFill, { scaleX: 0 });
        gsap.set(ruleLines, { drawSVG: "0% 0%" });
        gsap.set(ruleCaps, { autoAlpha: 0, scale: 0 });

        // SplitText sobre cada title — popula el outer `splits` para que
        // setActive() pueda animar el reveal/reset al cambiar de panel.
        splits = [];
        try {
            if (SplitText && typeof SplitText.create === "function") {
                titles.forEach((t) => {
                    const s = SplitText.create(t, {
                        type: "words",
                        mask: "words",
                        wordsClass: "ph__title-word",
                        aria: "auto",
                    });
                    splits.push(s);
                    gsap.set(s.words, { yPercent: 110 });
                });
                if (splits[0]) gsap.set(splits[0].words, { yPercent: 0 });
            }
        } catch (_) {}

        // Pin principal
        const pinDuration = (total - 1) * 80;
        const stHl = ScrollTrigger.create({
            trigger: root,
            start: "top top",
            end: `+=${pinDuration}%`,
            pin: pin,
            pinSpacing: true,
            scrub: 0.7,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
                const idx = total > 1
                    ? Math.min(total - 1, Math.floor(self.progress * total))
                    : 0;
                if (idx !== activeIdx) setActive(idx);

                if (progressFill) {
                    gsap.set(progressFill, { scaleX: self.progress });
                }
                // El rail está display:none en móvil (<=900px): animar su attr
                // por frame es trabajo tirado que suma jank al scrub. Sólo desktop.
                if (railFill && !isMobile) {
                    const target = self.progress * 400;
                    gsap.to(railFill, {
                        attr: { "stroke-dasharray": `${target} 400` },
                        duration: 0.1,
                        ease: "none",
                        overwrite: "auto",
                    });
                }
            },
        });

        // Reveal inicial al entrar al viewport
        const revealTl = gsap.timeline({
            scrollTrigger: {
                trigger: root,
                start: "top 65%",
                once: true,
            },
            defaults: { ease: "power3.out" },
        });
        revealTl
            .add(tryPlayActive, 0)
            .from(stage, {
                autoAlpha: 0, scale: 0.92,
                duration: 1.0, ease: "back.out(1.4)",
            }, 0)
            .from(panels[0], {
                autoAlpha: 0, y: 30,
                duration: 0.7,
            }, 0.2)
            .add(() => {
                if (splits[0]) {
                    gsap.fromTo(splits[0].words,
                        { yPercent: 110 },
                        { yPercent: 0, duration: 0.8, stagger: 0.04, ease: "expo.out" }
                    );
                }
            }, 0.3);
        if (ruleLines[0]) {
            revealTl.fromTo(ruleLines[0],
                { drawSVG: "0% 0%" },
                { drawSVG: "0% 100%", duration: 0.9, ease: "power3.inOut" },
                0.6
            );
        }
        if (ruleCaps[0]) {
            revealTl.fromTo(ruleCaps[0],
                { autoAlpha: 0, scale: 0 },
                { autoAlpha: 1, scale: 1, duration: 0.4, ease: "back.out(2)" },
                1.4
            );
        }

        // Tilt 3D al mouse (desktop only)
        if (stage && !isMobile) {
            const mapX = gsap.utils.mapRange(0, 1, 8, -8);
            const mapY = gsap.utils.mapRange(0, 1, -6, 6);

            const onMove = (e) => {
                const r = stage.getBoundingClientRect();
                const nx = (e.clientX - r.left) / r.width;
                const ny = (e.clientY - r.top) / r.height;
                gsap.to(stage, {
                    rotationY: mapX(nx),
                    rotationX: mapY(ny),
                    duration: 0.7, ease: "power2.out", overwrite: "auto",
                });
            };
            const onLeave = () => {
                gsap.to(stage, {
                    rotationY: 0, rotationX: 0,
                    duration: 0.9, ease: "power3.out", overwrite: "auto",
                });
            };
            stage.addEventListener("mousemove", onMove);
            stage.addEventListener("mouseleave", onLeave);
            context.add(() => () => {
                stage.removeEventListener("mousemove", onMove);
                stage.removeEventListener("mouseleave", onLeave);
            });
        }

        // Partículas orbitales. En móvil las bajamos a 6 (menos timelines
        // infinitas corriendo = menos presión sobre el main thread al scroll).
        const count = isMobile ? Math.min(6, particles.length) : particles.length;
        particles.slice(count).forEach((p) => gsap.set(p, { autoAlpha: 0, display: "none" }));

        const stageSize = stage ? stage.offsetWidth : 480;
        const baseRadius = stageSize * 0.42;

        const particleTweens = [];
        particles.slice(0, count).forEach((p, i) => {
            const angle = (i / count) * Math.PI * 2 + gsap.utils.random(-0.18, 0.18);
            const radius = baseRadius + gsap.utils.random(-30, 70);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const driftR = gsap.utils.random(-12, 18);
            const dx = Math.cos(angle) * driftR;
            const dy = Math.sin(angle) * driftR;
            const peak = gsap.utils.random(0.4, 0.95);
            const dur = gsap.utils.random(2.8, 6);
            const delay = gsap.utils.random(0, 4);

            gsap.set(p, { x, y });

            const t = gsap.timeline({ repeat: -1, yoyo: true, delay, paused: true });
            t.to(p, { autoAlpha: peak, duration: dur * 0.45, ease: "sine.out" }, 0)
             .to(p, { x: x + dx, y: y + dy, duration: dur, ease: "sine.inOut" }, 0)
             .to(p, { autoAlpha: peak * 0.3, duration: dur * 0.55, ease: "sine.in" }, dur * 0.45);
            particleTweens.push(t);
        });

        ScrollTrigger.create({
            trigger: root,
            start: "top 70%",
            once: true,
            onEnter: () => {
                particleTweens.forEach((t, i) => {
                    gsap.delayedCall(i * 0.04, () => t.play());
                });
            },
        });

        return () => {
            try { stHl.kill(); } catch (_) {}
            try { revealTl.kill(); } catch (_) {}
            particleTweens.forEach((t) => { try { t.kill(); } catch (_) {} });
            splits.forEach((s) => { try { s.revert(); } catch (_) {} });
        };
    });
}

// Soporta múltiples instancias en la misma página (poco probable pero
// barato): inicializa cada [data-ph] una sola vez (guard data-ph-init).
function initAll() {
    document.querySelectorAll("[data-ph]").forEach(initProductHighlights);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll, { once: true });
} else {
    initAll();
}
