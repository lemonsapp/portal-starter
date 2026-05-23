/* =====================================================================
   HOLISTIC — final-cta-animations.js — REWRITE 2026-05-23
   Shopping-focused CTA con bi-tipo Gotham + Fraunces italic.

   Beat-by-beat:
     1. Badge "ENVÍO GRATIS" desde arriba con bounce
     2. EXPLORÁ — SplitText chars explosion (edges-in)
     3. "todo el catálogo" Fraunces italic — mask reveal slide
     4. Sub copy fade-up
     5. Botón pop con back.out + cart icon wiggle + badge "+" bounce
     6. Trust chips stagger
     7. Hint bottom fade
     8. Idle: cart wiggle + badge pulse + arrow drift + particles drift

   Skills aplicadas:
     • gsap-plugins SplitText      → chars EXPLORÁ
     • gsap-timeline labels         → orquestación beat-by-beat
     • gsap-scrolltrigger toggleActions → reveal reversible
     • gsap-utils random           → partículas idle
     • gsap-core matchMedia        → reduced-motion + breakpoints
   ===================================================================== */

import { gsap, mm, BREAKPOINTS, SplitText } from "./lib/registerGsap.js";

function initFinalCTA() {
    const root = document.querySelector("[data-final-cta]");
    if (!root) return;

    const badge       = root.querySelector("[data-final-badge]");
    const titleEl     = root.querySelector("[data-final-title]");
    const italicInner = root.querySelector("[data-final-italic]");
    const subEl       = root.querySelector("[data-final-sub]");
    const btn         = root.querySelector("[data-final-btn]");
    const btnCartSvg  = btn ? btn.querySelector(".final-cta__btn-cart svg") : null;
    const btnBadge    = root.querySelector("[data-final-cart-badge]");
    const btnArrow    = btn ? btn.querySelector(".final-cta__btn-arrow") : null;
    const trustChips  = Array.from(root.querySelectorAll("[data-final-trust-chip]"));
    const hint        = root.querySelector("[data-final-hint]");

    mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion } = context.conditions;

        // ============== SplitText chars de EXPLORÁ (solo la row bold) ==============
        const boldWord = titleEl ? titleEl.querySelector("[data-split-final]") : null;
        let split = null;
        let chars = [];
        if (boldWord) {
            split = SplitText.create(boldWord, { type: "chars,words", aria: "auto" });
            chars = split.chars;
        }

        // ============== Estados iniciales ==============
        gsap.set(badge, { y: -20, autoAlpha: 0 });
        gsap.set(chars, { yPercent: 110, autoAlpha: 0, rotationX: -60, transformOrigin: "50% 100%" });
        gsap.set(italicInner, { yPercent: 110 });
        gsap.set(subEl, { y: 24, autoAlpha: 0 });
        gsap.set(btn, { scale: 0.6, autoAlpha: 0, y: 20 });
        gsap.set(btnBadge, { scale: 0, transformOrigin: "50% 50%" });
        gsap.set(trustChips, { y: 18, autoAlpha: 0 });
        gsap.set(hint, { autoAlpha: 0 });

        // ============== Partículas decorativas (8 mint flotando) ==============
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
        root.appendChild(particleLayer);

        const particles = [];
        const COLORS = ["#25D366", "#3FBE82", "#2E8F6E", "#A7F5C8"];
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

        if (reduceMotion) {
            gsap.set([badge, subEl, btn, hint], { autoAlpha: 1, y: 0, scale: 1 });
            gsap.set(chars, { yPercent: 0, autoAlpha: 1, rotationX: 0 });
            gsap.set(italicInner, { yPercent: 0 });
            gsap.set(btnBadge, { scale: 1 });
            gsap.set(trustChips, { y: 0, autoAlpha: 1 });
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
                start: "top 78%",
                toggleActions: "play none none reverse",
            },
        });

        // 1) BADGE drop-in con bounce
        tl.to(badge, {
            y: 0, autoAlpha: 1,
            duration: 0.7, ease: "back.out(2.4)",
        }, 0);

        // 2) EXPLORÁ chars explosion
        tl.to(chars, {
            yPercent: 0, autoAlpha: 1, rotationX: 0,
            duration: 0.85, ease: "back.out(1.7)",
            stagger: { amount: 0.4, from: "edges" },
        }, 0.15);

        // 3) Fraunces italic line — mask reveal slide-up
        tl.to(italicInner, {
            yPercent: 0,
            duration: 0.85, ease: "expo.out",
        }, 0.45);

        // 4) Sub fade-up
        tl.to(subEl, {
            y: 0, autoAlpha: 1,
            duration: 0.7, ease: "power3.out",
        }, 0.85);

        // 5) Botón pop dramático
        tl.to(btn, {
            scale: 1, autoAlpha: 1, y: 0,
            duration: 0.85, ease: "back.out(2.2)",
        }, 1.05);

        // 5b) Cart badge "+" pop right after button
        tl.to(btnBadge, {
            scale: 1,
            duration: 0.5, ease: "back.out(3)",
        }, 1.35);

        // 6) Trust chips stagger
        tl.to(trustChips, {
            y: 0, autoAlpha: 1,
            duration: 0.6, ease: "power3.out",
            stagger: 0.08,
        }, 1.3);

        // 7) Hint bottom
        tl.to(hint, {
            autoAlpha: 0.55,
            duration: 0.6, ease: "power2.out",
        }, 1.6);

        // 8) Partículas pop staggered random
        tl.to(particles, {
            autoAlpha: () => gsap.utils.random(0.35, 0.75, 0.05),
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
                        yoyo: true, repeat: -1,
                        delay: gsap.utils.random(0, 2),
                    });
                    gsap.to(p, {
                        opacity: gsap.utils.random(0.2, 0.7, 0.05),
                        duration: gsap.utils.random(2.5, 5),
                        ease: "sine.inOut",
                        yoyo: true, repeat: -1,
                        delay: gsap.utils.random(0, 1.5),
                    });
                });
            },
        }, 0.4);

        // ============== IDLE LOOPS (post-entrance) ==============
        // Cart icon wiggle — micro-tilt left-right pulsing como
        // "agregando algo al carrito"
        if (btnCartSvg) {
            gsap.to(btnCartSvg, {
                rotate: -8, x: -1.5,
                transformOrigin: "50% 50%",
                duration: 0.55, ease: "sine.inOut",
                yoyo: true, repeat: -1,
                delay: 2.2,
            });
        }
        // Cart badge "+" idle pulse — escalado yoyo + glow leve
        if (btnBadge) {
            gsap.to(btnBadge, {
                scale: 1.15,
                duration: 0.7, ease: "sine.inOut",
                yoyo: true, repeat: -1,
                delay: 2.4,
            });
        }
        // Arrow drift sutil
        if (btnArrow) {
            gsap.to(btnArrow, {
                x: 5,
                duration: 0.95, ease: "sine.inOut",
                yoyo: true, repeat: -1,
                delay: 2.0,
            });
        }
        // Badge dots glow yoyo (los 2 puntos del badge superior)
        const badgeDots = badge ? badge.querySelectorAll(".final-cta__badge-dot") : [];
        if (badgeDots.length) {
            gsap.to(badgeDots, {
                opacity: 0.4,
                duration: 1.2, ease: "sine.inOut",
                yoyo: true, repeat: -1,
                stagger: { each: 0.3, from: "start" },
                delay: 1.5,
            });
        }

        // ============== HOVER BOOSTS ==============
        if (btn) {
            const onEnter = () => {
                gsap.to(btn, { scale: 1.06, duration: 0.3, ease: "power3.out", overwrite: "auto" });
                if (btnArrow) gsap.to(btnArrow, { x: 12, duration: 0.3, ease: "power3.out", overwrite: "auto" });
                if (btnCartSvg) gsap.to(btnCartSvg, { rotate: 8, x: 1.5, duration: 0.3, ease: "back.out(2)", overwrite: "auto" });
                if (btnBadge) gsap.to(btnBadge, { scale: 1.3, duration: 0.3, ease: "back.out(2)", overwrite: "auto" });
            };
            const onLeave = () => {
                gsap.to(btn, { scale: 1, duration: 0.4, ease: "back.out(2)", overwrite: "auto" });
                // idle loops del cart/badge se re-enganchan solos al overwriteo
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
