/* =====================================================================
   OrganicConnector — v4 "Nutrición Ascendente" scroll-scrub botánico
   2026-05-23 — refinement v3 con narrativa fertilizantes/cultivo.

   Concepto:
     • Tallos vegetales crecen bottom→top (DrawSVG scrub)
     • Hojas se abren lateralmente desde el tallo central, cada una a
       su ventana de scroll (scale 0 → target, back.out)
     • Gotas de fertilizante líquido ascienden por los tallos
       (MotionPath REVERSE scrub) con fade-in + fade-out
     • Halo de fotosíntesis arriba se intensifica con el scroll
     • Todo atado al scroll del usuario — sin loops infinitos

   Skills aplicadas:
     • gsap-scrolltrigger scrub        → master timeline tied a scroll
     • gsap-plugins DrawSVGPlugin      → tallos + bloom
     • gsap-plugins MotionPathPlugin   → drops ascendiendo
     • gsap-core matchMedia            → reduced-motion + mobile
     • gsap-timeline (master)          → orquestación de los 4 layers
   ===================================================================== */

import {
    gsap, mm, BREAKPOINTS, ScrollTrigger,
    MotionPathPlugin, DrawSVGPlugin,
} from "./lib/registerGsap.js";

const root = document.querySelector("[data-organic-connector]");
if (root) {
    const halo   = root.querySelector("[data-oc-halo]");
    const stems  = Array.from(root.querySelectorAll("[data-oc-stem]"));
    const leaves = Array.from(root.querySelectorAll("[data-oc-leaf]"));
    const drops  = Array.from(root.querySelectorAll("[data-oc-drop]"));

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion, isMobile } = ctx.conditions;

        // ====== Estados iniciales ======
        gsap.set(stems, { drawSVG: "0% 0%" });

        leaves.forEach((leaf) => {
            const x   = parseFloat(leaf.dataset.x);
            const y   = parseFloat(leaf.dataset.y);
            const rot = parseFloat(leaf.dataset.rot);
            gsap.set(leaf, {
                x, y, rotation: rot,
                scale: 0,
                transformOrigin: "0 0",
            });
        });

        gsap.set(drops, { opacity: 0, scale: 0, transformOrigin: "50% 50%" });
        gsap.set(halo, { opacity: 0 });

        if (reduceMotion) {
            gsap.set(stems, { drawSVG: "0% 70%" });
            gsap.set(halo, { opacity: 0.2 });
            leaves.forEach((leaf) => {
                const s = parseFloat(leaf.dataset.targetScale) * 0.85;
                gsap.set(leaf, { scale: s });
            });
            return;
        }

        // ====== MASTER TIMELINE — todo scroll-scrub bound ======
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: root,
                start: "top bottom",
                end:   "bottom top",
                scrub: isMobile ? 0.4 : 1.0,
                invalidateOnRefresh: true,
            }
        });

        // --- LAYER 1: HALO fotosíntesis ---
        // Se intensifica gradualmente desde el inicio del scroll, llega
        // a full cuando el usuario está saliendo de la sección hacia
        // Productos Estrella.
        tl.to(halo, {
            opacity: 0.4,   // suave: el halo vive abajo (top:50%), no cerca de la
                            // unión, así el verde de arriba queda uniforme.
            duration: 1,
            ease: "none",
        }, 0);

        // --- LAYER 2: TALLOS crecen bottom→top ---
        // DrawSVG anima el stroke desde "0% 0%" (invisible) hasta
        // "0% 100%" (full). Como los paths van M(y=700) → end(y=0),
        // el growth visualmente sube desde la base hacia la copa.
        tl.to(stems, {
            drawSVG: "0% 100%",
            duration: 0.80,
            ease: "none",
            stagger: { each: 0.04, from: "center" },
        }, 0);

        // --- LAYER 3: HOJAS bloom secuencial ---
        // Cada hoja florece en su propia ventana (data-progress es el
        // scroll % donde arranca su crecimiento). back.out le da el
        // pop botánico cuando se abre. Pequeña oscilación de rotación
        // post-bloom para vibe respiración (idle infinito, ligero,
        // no compite con el scrub).
        leaves.forEach((leaf) => {
            const targetScale = parseFloat(leaf.dataset.targetScale);
            const baseRot     = parseFloat(leaf.dataset.rot);
            const p           = parseFloat(leaf.dataset.progress);

            tl.to(leaf, {
                scale: targetScale,
                duration: 0.10,
                ease: "back.out(1.5)",
            }, p);

            // Idle respiration — pequeña oscilación de rotación post-bloom.
            // Fuera del timeline (independent loop), arranca solo después
            // de que la hoja apareció.
            gsap.to(leaf, {
                rotation: baseRot + (baseRot < -90 ? 3 : -3),
                duration: gsap.utils.random(3.5, 5.2),
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
                delay: gsap.utils.random(0, 1.5),
            });
        });

        // --- LAYER 4: GOTAS DE FERTILIZANTE ascienden ---
        // motionPath con start: 0 (base del tallo, y=700) → end: 1
        // (copa, y=0) = ascenso. Cada drop tiene su propia ventana
        // de scroll con stagger. Lead drop arranca primero y arriba
        // más temprano — visualmente "guía" al pelotón.
        drops.forEach((drop, i) => {
            const stemIdx = parseInt(drop.dataset.stem, 10);
            const stem = stems[stemIdx];
            const targetScale = parseFloat(drop.dataset.targetScale);
            if (!stem) return;

            const isLead = i === 0;
            const startOffset = isLead ? 0.05 : 0.08 + (i / drops.length) * 0.28;
            const windowLen   = isLead ? 0.80 : 0.65;
            const endOffset   = Math.min(startOffset + windowLen, 0.98);
            const actualWin   = endOffset - startOffset;

            // 1) Fade-in + grow (primeros 12% del recorrido del drop)
            tl.fromTo(drop,
                { opacity: 0, scale: 0 },
                {
                    opacity: 1,
                    scale: targetScale,
                    duration: actualWin * 0.12,
                    ease: "none",
                },
                startOffset
            );

            // 2) Ride ascendente — motionPath REVERSE direction
            //    (start:0 = base del path = abajo, end:1 = top)
            tl.to(drop, {
                motionPath: {
                    path: stem,
                    align: stem,
                    alignOrigin: [0.5, 0.5],
                    autoRotate: false,
                    start: 0,
                    end: 1,
                },
                duration: actualWin,
                ease: "none",
            }, startOffset);

            // 3) Fade-out + shrink (últimos 18% del recorrido)
            tl.to(drop, {
                opacity: 0,
                scale: targetScale * 0.4,
                duration: actualWin * 0.18,
                ease: "none",
            }, startOffset + actualWin * 0.82);
        });

        // ====== Cleanup ======
        const onResize = () => ScrollTrigger.refresh();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    });
}
