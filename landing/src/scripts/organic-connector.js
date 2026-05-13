/* =====================================================================
   OrganicConnector — animaciones GSAP scroll-driven entre HumanSupport
   y ProductFloatSlider. Sistema de raíces que crece + hojas que sprout
   + gotas de fertilizante que ruedan. Tema: "el asesoramiento humano
   nutre los productos, como las raíces nutren la planta".

   Skills aplicadas:
     • gsap-core matchMedia      → reduce-motion + breakpoints
     • gsap-timeline             → master tl con labels secuenciales
     • gsap-scrolltrigger        → scrub linkeado al scroll de la sección
     • gsap-plugins DrawSVGPlugin → draw real de paths (% based, suave)
     • gsap-plugins MotionPathPlugin → drops rolling along root paths
     • gsap-utils.toArray, random  → naturalismo en stagger + delays
     • gsap-performance          → transforms only, will-change scoped

   ScrollTrigger setup:
     • trigger = el section .oc
     • start = "top bottom" (cuando el top del section entra al viewport)
     • end   = "bottom top" (cuando termina de salir)
     • scrub = true (lineal con el scroll)
   ===================================================================== */

import {
    gsap, mm, BREAKPOINTS, ScrollTrigger, DrawSVGPlugin, MotionPathPlugin,
} from "./lib/registerGsap.js";

const root = document.querySelector("[data-organic-connector]");
if (root) {
    const svg     = root.querySelector("[data-oc-svg]");
    const roots   = Array.from(root.querySelectorAll("[data-oc-root]"));
    const leaves  = Array.from(root.querySelectorAll("[data-oc-leaf]"));
    const tips    = Array.from(root.querySelectorAll("[data-oc-tip]"));
    const drops   = Array.from(root.querySelectorAll("[data-oc-drop]"));
    const caption = root.querySelector("[data-oc-caption]");

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion, isMobile } = ctx.conditions;

        // ----- Estados iniciales -----
        // Roots: dibujados al 0% (no se ven)
        gsap.set(roots, { drawSVG: "0%" });
        // Leaves: escala 0 con un poco de rotación random + opacity 0
        leaves.forEach((leaf) => {
            const rotJitter = gsap.utils.random(-15, 15, 1);
            gsap.set(leaf, { scale: 0, rotate: `+=${rotJitter}`, opacity: 0 });
        });
        // Tips: opacity 0, scale 0 → pulsan al final de cada root
        gsap.set(tips, { opacity: 0, scale: 0 });
        // Drops: opacity 0 al inicio del path correspondiente
        gsap.set(drops, { opacity: 0 });
        // Caption: fade in suave al entrar al viewport
        if (caption) gsap.set(caption, { autoAlpha: 0, y: 12 });

        if (reduceMotion) {
            gsap.set(roots, { drawSVG: "100%" });
            gsap.set(leaves, { scale: 1, opacity: 1 });
            gsap.set(tips,   { opacity: 1, scale: 1 });
            if (caption) gsap.set(caption, { autoAlpha: 0.8, y: 0 });
            return;
        }

        // ----- Caption entrance — independiente del scrub, fade rápido -----
        if (caption) {
            gsap.to(caption, {
                autoAlpha: 0.85, y: 0, duration: 0.9, ease: "power2.out",
                scrollTrigger: {
                    trigger: root,
                    start: "top 85%",
                    toggleActions: "play none none reverse",
                },
            });
        }

        // ----- MASTER timeline scroll-scrubbed -----
        const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
                trigger: root,
                start: "top bottom",
                end:   "bottom top",
                scrub: isMobile ? 0.6 : 1.0,   // mobile más responsive
                invalidateOnRefresh: true,
            },
        });

        // PHASE 1 (0 → 0.4): main trunk crece desde top hacia abajo
        const mainTrunk = roots.find((r) => r.dataset.tip === "0");
        if (mainTrunk) {
            tl.to(mainTrunk, { drawSVG: "100%", duration: 0.4 }, 0);
        }

        // PHASE 2 (0.18 → 0.65): sub-branches divergen escalonadas
        const subs = roots.filter((r) => r.dataset.tip !== "0");
        subs.forEach((sub, i) => {
            tl.to(sub, { drawSVG: "100%", duration: 0.45 }, 0.18 + i * 0.05);
        });

        // PHASE 3 (0.32 → 0.75): hojas sprout con stagger natural
        // Cada leaf scale 0→1 + rotate back a 0 + opacity 0→1
        leaves.forEach((leaf, i) => {
            // Para hojas "bud" (small circles) usamos un timing distinto
            const isBud = leaf.classList.contains("oc__leaf--bud");
            const delay = 0.32 + i * (isBud ? 0.025 : 0.045);
            tl.to(leaf, {
                scale: 1,
                rotate: "+=0",   // termina sin offset → vuelve al transform original
                opacity: isBud ? gsap.utils.random(0.6, 0.85) : gsap.utils.random(0.85, 1),
                duration: isBud ? 0.18 : 0.28,
                ease: "back.out(1.6)",
            }, delay);
        });

        // PHASE 4 (0.55 → 0.9): tips fade-in + scale pulse cuando la raíz
        // termina de dibujarse. Tip "0" es del main trunk, los otros de subs.
        tips.forEach((tip, i) => {
            tl.to(tip, {
                opacity: 1,
                scale: 1,
                duration: 0.18,
                ease: "back.out(2)",
            }, 0.55 + i * 0.06);
        });

        // PHASE 5 (0.4 → 0.95): gotas de fertilizante ruedan por sus paths.
        // motionPath les hace seguir la curva del root correspondiente.
        // El target del path se lee de data-path-target.
        drops.forEach((drop, i) => {
            const pathTarget = drop.dataset.pathTarget;
            const pathEl = roots.find((r) => r.dataset.tip === pathTarget);
            if (!pathEl) return;

            // Fade-in del drop al inicio del recorrido
            tl.to(drop, { opacity: 0.95, duration: 0.05 }, 0.4 + i * 0.08);
            // Motion path: alignOrigin centra el drop sobre el path
            tl.to(drop, {
                motionPath: {
                    path: pathEl,
                    align: pathEl,
                    alignOrigin: [0.5, 0.5],
                    autoRotate: false,
                    start: 0,
                    end: 1,
                },
                duration: 0.55,
                ease: "power1.in",   // acelera (gravedad)
            }, 0.4 + i * 0.08);
            // Fade-out al final (cuando ya llegó a la punta)
            tl.to(drop, { opacity: 0, duration: 0.08 }, 0.92 + i * 0.02);
        });

        // ----- Refresh on resize (DrawSVG lee tamaños computados) -----
        const onResize = () => ScrollTrigger.refresh();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    });
}
