/* =====================================================================
   HOLISTIC — final-cta-animations.js
   Último impulso de la home. Beat-by-beat:
    - SplitText por chars del título — reveal explosivo (yPercent 110 →
      0 + rotationX -60 → 0 + autoAlpha) con stagger desde "edges" para
      feel de "explosión hacia el centro".
    - Subline aparece después con power3.out + slight slide.
    - CTA hace pop dramático con back.out(2.4); arrow drift idle.
    - 8 partículas verdes flotan alrededor del CTA con random walk.
   El magnetic del botón ya lo maneja cursor-animations.js (data-magnetic).
   Skills aplicados:
     gsap-plugins (SplitText), gsap-timeline (labels + position param),
     gsap-utils (random walk de partículas), gsap-scrolltrigger (toggle
     reveal).
   ===================================================================== */

import { gsap, mm, BREAKPOINTS, SplitText } from "./lib/registerGsap.js";

function initFinalCTA() {
    const root = document.querySelector("[data-final-cta]");
    if (!root) return;

    const titleEl = root.querySelector("[data-final-title]");
    const subEl = root.querySelector("[data-final-sub]");
    const btn = root.querySelector("[data-final-btn]");
    const btnArrow = btn ? btn.querySelector("svg") : null;

    mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion } = context.conditions;

        // SplitText por chars manteniendo el span.word como contenedor.
        let split = null;
        let chars = [];
        if (titleEl) {
            split = SplitText.create(titleEl, {
                type: "chars,words",
                aria: "auto",
            });
            chars = split.chars;
        }

        gsap.set(chars, { yPercent: 110, autoAlpha: 0, rotationX: -60, transformOrigin: "50% 100%" });
        if (subEl) gsap.set(subEl, { y: 30, autoAlpha: 0 });
        if (btn) gsap.set(btn, { scale: 0, autoAlpha: 0, rotation: -8 });

        // Spawn 8 partículas decorativas alrededor del CTA (DOM creado
        // dinámicamente para no ensuciar el .astro).
        const particleLayer = document.createElement("div");
        particleLayer.className = "final-cta__particles";
        particleLayer.setAttribute("aria-hidden", "true");
        Object.assign(particleLayer.style, {
            position: "absolute",
            inset: "0",
            zIndex: "0",
            pointerEvents: "none",
            overflow: "hidden",
        });
        root.style.position = root.style.position || "relative";
        root.appendChild(particleLayer);

        const particles = [];
        const COLORS = ["#25D366", "#3FBE82", "#2E8F6E", "#A8E6C5"];
        for (let i = 0; i < 8; i++) {
            const p = document.createElement("span");
            const size = gsap.utils.random(6, 14, 1);
            const color = gsap.utils.random(COLORS);
            Object.assign(p.style, {
                position: "absolute",
                left: gsap.utils.random(8, 92) + "%",
                top: gsap.utils.random(15, 85) + "%",
                width: size + "px",
                height: size + "px",
                borderRadius: "50%",
                background: color,
                opacity: "0",
                boxShadow: `0 0 ${size * 1.5}px ${color}66`,
                transform: "translate(-50%, -50%)",
                willChange: "transform, opacity",
            });
            particleLayer.appendChild(p);
            particles.push(p);
        }
        gsap.set(particles, { autoAlpha: 0 });

        if (reduceMotion) {
            gsap.set(chars, { yPercent: 0, autoAlpha: 1, rotationX: 0 });
            if (subEl) gsap.set(subEl, { y: 0, autoAlpha: 1 });
            if (btn) gsap.set(btn, { scale: 1, autoAlpha: 1, rotation: 0 });
            gsap.set(particles, { autoAlpha: 0.6 });
            return () => {
                if (split) split.revert();
                particleLayer.remove();
            };
        }

        // ============== ENTRANCE TIMELINE (scroll-triggered) ==============
        const tl = gsap.timeline({
            scrollTrigger: {
                id: "final-cta",
                trigger: root,
                start: "top 75%",
                toggleActions: "play none none reverse",
            },
        });

        tl.addLabel("title", 0)
            .to(chars, {
                yPercent: 0,
                autoAlpha: 1,
                rotationX: 0,
                duration: 0.85,
                ease: "back.out(1.7)",
                stagger: { amount: 0.4, from: "edges" },
            }, "title");

        if (subEl) {
            tl.addLabel("sub", "title+=0.5")
                .to(subEl, {
                    y: 0,
                    autoAlpha: 1,
                    duration: 0.7,
                    ease: "power3.out",
                }, "sub");
        }

        if (btn) {
            tl.addLabel("cta", "sub+=0.2")
                .to(btn, {
                    scale: 1,
                    autoAlpha: 1,
                    rotation: 0,
                    duration: 0.9,
                    ease: "back.out(2.4)",
                }, "cta");
        }

        // Partículas: pop en stagger random + idle infinito de drift.
        tl.to(particles, {
            autoAlpha: () => gsap.utils.random(0.4, 0.85, 0.05),
            duration: 0.7,
            ease: "power2.out",
            stagger: { amount: 0.6, from: "random" },
            onComplete: () => {
                particles.forEach((p) => {
                    gsap.to(p, {
                        x: gsap.utils.random(-60, 60),
                        y: gsap.utils.random(-80, 80),
                        duration: gsap.utils.random(6, 12),
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1,
                        delay: gsap.utils.random(0, 2),
                    });
                    gsap.to(p, {
                        opacity: gsap.utils.random(0.2, 0.7, 0.05),
                        duration: gsap.utils.random(2.5, 5),
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1,
                        delay: gsap.utils.random(0, 1.5),
                    });
                });
            },
        }, "title+=0.2");

        // Arrow del botón: drift continuo izquierda↔derecha sutil cuando
        // ya entró en escena. Telegrafia "click acá".
        if (btnArrow) {
            tl.to(btnArrow, {
                x: 6,
                duration: 0.9,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
            }, "cta+=0.6");
        }

        // Hover boost del botón: scale + brillo de outline.
        if (btn) {
            const onEnter = () => {
                gsap.to(btn, { scale: 1.06, duration: 0.3, ease: "power3.out", overwrite: "auto" });
                if (btnArrow) gsap.to(btnArrow, { x: 12, duration: 0.3, ease: "power3.out", overwrite: "auto" });
            };
            const onLeave = () => {
                gsap.to(btn, { scale: 1, duration: 0.4, ease: "back.out(2)", overwrite: "auto" });
                // El idle drift se re-engancha solo (no fue killed; sólo overwriteado).
            };
            btn.addEventListener("mouseenter", onEnter);
            btn.addEventListener("mouseleave", onLeave);

            return () => {
                if (split) split.revert();
                btn.removeEventListener("mouseenter", onEnter);
                btn.removeEventListener("mouseleave", onLeave);
                particleLayer.remove();
            };
        }

        return () => {
            if (split) split.revert();
            particleLayer.remove();
        };
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFinalCTA);
} else {
    initFinalCTA();
}
