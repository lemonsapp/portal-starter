/* =====================================================================
   HOLISTIC — lineas-estrella-animations.js

   Animaciones del componente <LineasEstrella /> que reemplaza al
   <ProductFloatSlider /> horizontal por un slider vertical
   scroll-down separado por las 3 líneas estrella (ELITE/RACE/PRO).

   Refactor 2026-05-19: cliente pidió que los 3 panels copien EXACTO
   el formato de los 3 panels de <ComplementosIdeales />. Antes el
   visual era layered stage (base+pote+ruedas+texto con frame rounded),
   ahora es bottle PNG simple igual que cmp panels. Las animaciones
   del visual se simplificaron en consecuencia (no más layered
   sequence: solo slide-up + parallax + idle float).

   Estructura del componente:
     • HEADER editorial (chars scatter→assemble scroll-linked +
       divider DrawSVG)
     • THREAD vertical SVG (DrawSVGPlugin scrub fullsection)
     • 3 PANELS con visual (bottle PNG + halo + blob) + body
       alternating layout + markers pulsantes en el thread.

   Skills:
     • gsap-plugins SplitText (chars header + words name)
     • gsap-plugins DrawSVGPlugin (divider + thread vertical)
     • gsap-plugins CustomEase (eases lib registrados)
     • gsap-scrolltrigger scrub (header assemble + thread + parallax)
     • gsap-scrolltrigger toggleActions (panels entrance reversible)
     • gsap-timeline (header acts + per-panel sequence)
     • gsap-utils.random (per-char scatter + idle float)
     • gsap-utils.toArray (selectors batch)
     • gsap-core matchMedia (reduced-motion + breakpoints)
     • gsap-performance (transforms + opacity + will-change)
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText, DrawSVGPlugin } from "./lib/registerGsap.js";

function initLineasEstrella() {
    const root = document.querySelector("[data-lineas-estrella]");
    if (!root) return;

    // ---------- Refs HEADER ----------
    const header     = root.querySelector("[data-le-header]");
    const eyebrow    = root.querySelector("[data-le-eyebrow]");
    const lines      = gsap.utils.toArray("[data-le-line]", root);
    const mark       = root.querySelector("[data-le-mark]");
    const dividerLn  = root.querySelector("[data-le-divider-line]");
    const dividerGlow= root.querySelector("[data-le-divider-glow]");
    const sub        = root.querySelector("[data-le-sub]");

    // ---------- Refs THREAD ----------
    const threadLine = root.querySelector("[data-le-thread]");

    // ---------- Refs PANELS ----------
    const panels     = gsap.utils.toArray("[data-le-panel]", root);

    if (!lines.length || !panels.length) return;

    const splits = [];

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion, isMobile } = ctx.conditions;

        // SplitText chars de las 3 líneas no-mark (la mark line tiene
        // el <mark> dentro del inner — no se splittea).
        const lineInners = lines
            .map((l) => l.querySelector(".le__line-inner"))
            .filter((inner) => inner && !inner.querySelector("mark"));

        const charSplits = lineInners.map((inner) => {
            const s = SplitText.create(inner, { type: "chars,words", aria: "auto" });
            splits.push(s);
            return s;
        });
        const allChars = charSplits.flatMap((s) => s.chars);

        // Estados iniciales del header
        gsap.set(eyebrow, { autoAlpha: 0, y: 14 });
        gsap.set(sub,     { autoAlpha: 0, y: 18 });
        if (mark) {
            gsap.set(mark, {
                scaleX: 0.85, scaleY: 0.92, rotation: -1.6,
                autoAlpha: 0, transformOrigin: "0 50%",
            });
        }
        if (dividerLn)   gsap.set(dividerLn,   { drawSVG: "50% 50%" });
        if (dividerGlow) gsap.set(dividerGlow, { autoAlpha: 0, scale: 0, transformOrigin: "50% 50%" });

        if (reduceMotion) {
            gsap.set([eyebrow, sub, ...allChars], {
                autoAlpha: 1, y: 0, x: 0, z: 0,
                rotation: 0, rotationX: 0, rotationY: 0,
                scale: 1, filter: "none",
            });
            if (mark)        gsap.set(mark,        { autoAlpha: 1, scaleX: 1, scaleY: 1, rotation: -1.6 });
            if (dividerLn)   gsap.set(dividerLn,   { drawSVG: "0% 100%" });
            if (dividerGlow) gsap.set(dividerGlow, { autoAlpha: 1, scale: 1 });
            if (threadLine)  gsap.set(threadLine,  { drawSVG: "0% 100%" });
            panels.forEach((panel) => {
                const els = panel.querySelectorAll("[data-le-num], [data-le-kicker], [data-le-name], [data-le-tagline], [data-le-text], [data-le-cta], [data-le-visual], [data-le-img], [data-le-stage], [data-le-layer-base], [data-le-layer-ruedas], [data-le-layer-pote], [data-le-layer-texto]");
                els.forEach((el) => gsap.set(el, { autoAlpha: 1, y: 0, x: 0, scale: 1, rotation: 0 }));
            });
            return;
        }

        // ============================================================
        // SCATTER inicial — chars en perspective (mismo patrón que cmp)
        // ============================================================
        allChars.forEach((ch) => {
            gsap.set(ch, {
                x: gsap.utils.random(-30, 30),
                y: gsap.utils.random(-80, 80),
                z: gsap.utils.random(-200, 200),
                rotation: 0,
                rotationY: gsap.utils.random(-45, 45),
                rotationX: gsap.utils.random(-20, 20),
                scale: gsap.utils.random(0.7, 0.95),
                autoAlpha: 0,
                // En móvil sin blur: animar filter:blur() por char en cada
                // frame de scrub es el mayor costo de repaint en celular.
                filter: isMobile ? "none" : "blur(14px)",
                transformOrigin: "50% 50%",
                transformPerspective: 800,
                willChange: isMobile ? "transform, opacity" : "transform, opacity, filter",
            });
        });
        lineInners.forEach((inner) => gsap.set(inner, { perspective: 1000 }));

        // ============================================================
        // HEADER ASSEMBLE — scroll-linked scrub
        // ============================================================
        const assembleTl = gsap.timeline({
            scrollTrigger: {
                trigger: header,
                start: "top 95%",
                end:   "top 20%",
                scrub: 0.8,
                invalidateOnRefresh: true,
            },
        });

        assembleTl.to(eyebrow, {
            autoAlpha: 1, y: 0,
            duration: 0.18, ease: "expo.out",
        }, 0);

        assembleTl.to(allChars, {
            x: 0, y: 0, z: 0,
            rotation: 0, rotationX: 0, rotationY: 0,
            scale: 1,
            autoAlpha: 1,
            ...(isMobile ? {} : { filter: "blur(0px)" }),
            duration: 0.85,
            stagger: { each: 0.012, from: "center" },
            ease: "expo.out",
        }, 0.10);

        // Micro-glow burst post-assemble (desktop: usa filter brightness)
        if (!isMobile && allChars.length) {
            assembleTl.to(allChars, {
                filter: "blur(0px) brightness(1.15)",
                duration: 0.10, ease: "sine.out",
                stagger: { each: 0.004, from: "center" },
            }, 0.82).to(allChars, {
                filter: "blur(0px) brightness(1)",
                duration: 0.14, ease: "sine.in",
                stagger: { each: 0.004, from: "center" },
            }, 0.92);
        }

        // Mark "ESTRELLA" — explode in
        if (mark) {
            assembleTl.to(mark, {
                scaleX: 1, scaleY: 1, rotation: -1.6,
                autoAlpha: 1,
                duration: 0.22, ease: "explode",
            }, 0.65);
        }

        if (dividerLn) {
            assembleTl.to(dividerLn, {
                drawSVG: "0% 100%",
                duration: 0.25, ease: "power3.inOut",
            }, 0.55);
        }
        if (dividerGlow) {
            assembleTl.to(dividerGlow, {
                autoAlpha: 1, scale: 1,
                duration: 0.22, ease: "back.out(2.4)",
            }, 0.70);
        }

        assembleTl.to(sub, {
            autoAlpha: 1, y: 0,
            duration: 0.18, ease: "expo.out",
        }, 0.88);

        // POST-ASSEMBLE IDLE
        if (dividerGlow) {
            gsap.to(dividerGlow, {
                scale: 1.28,
                duration: 2.4, ease: "sine.inOut",
                yoyo: true, repeat: -1, delay: 1.8,
            });
            gsap.to(dividerGlow, {
                opacity: 0.7,
                duration: 1.8, ease: "sine.inOut",
                yoyo: true, repeat: -1, delay: 2.0,
            });
        }
        if (mark) {
            gsap.to(mark, {
                scale: 1.02,
                duration: 2.8, ease: "sine.inOut",
                yoyo: true, repeat: -1, delay: 1.5,
            });
        }
        // Eyebrow dot pulse
        const eyebrowDot = root.querySelector(".le__dot");
        if (eyebrowDot) {
            gsap.to(eyebrowDot, {
                scale: 1.35,
                duration: 1.4, ease: "sine.inOut",
                yoyo: true, repeat: -1, delay: 1.6,
                transformOrigin: "50% 50%",
            });
        }

        // ============================================================
        // THREAD VERTICAL DrawSVG scroll-linked
        // ============================================================
        // El thread está display:none en móvil (<=900px): animar su drawSVG
        // por frame de scroll es 100% trabajo tirado. Sólo desktop.
        if (threadLine && !isMobile) {
            gsap.set(threadLine, { drawSVG: "0% 0%" });
            gsap.to(threadLine, {
                drawSVG: "0% 100%",
                ease: "none",
                scrollTrigger: {
                    trigger: root,
                    start: "top 70%",
                    end:   "bottom 80%",
                    scrub: 0.4,
                    invalidateOnRefresh: true,
                },
            });
        }

        // ============================================================
        // PANELS entrance timeline + parallax
        //
        // Modo dual:
        //   • Panel con `data-le-stage` (RACE + PRO) → layered stage
        //     (base + ruedas + pote + texto) con entry secuencial.
        //   • Panel con `data-le-img` (ELITE) → bottle PNG simple
        //     calcado de cmp panels (slide-up + parallax + idle float).
        // ============================================================
        panels.forEach((panel, panelIdx) => {
            const marker  = panel.querySelector(".le__panel-marker");
            const blob    = panel.querySelector(".le__panel-blob");
            const halo    = panel.querySelector("[data-le-halo]");
            const img     = panel.querySelector("[data-le-img]");        // simple
            const stage   = panel.querySelector("[data-le-stage]");      // layered
            const lBase   = panel.querySelector("[data-le-layer-base]");
            const lRuedas = panel.querySelector("[data-le-layer-ruedas]");
            const lPote   = panel.querySelector("[data-le-layer-pote]");
            const lTexto  = panel.querySelector("[data-le-layer-texto]");
            const num     = panel.querySelector("[data-le-num]");
            const kicker  = panel.querySelector("[data-le-kicker]");
            const name    = panel.querySelector("[data-le-name]");
            const tagline = panel.querySelector("[data-le-tagline]");
            const text    = panel.querySelector("[data-le-text]");
            const cta     = panel.querySelector("[data-le-cta]");

            // SplitText words del name
            let nameSplit = null;
            let nameWords = [];
            if (name) {
                nameSplit = SplitText.create(name, {
                    type: "words",
                    wordsClass: "le__panel-name-word",
                    aria: "auto",
                });
                splits.push(nameSplit);
                nameWords = nameSplit.words;
            }

            // Estados iniciales
            if (marker)  gsap.set(marker,  { autoAlpha: 0, scale: 0.4, transformOrigin: "50% 50%" });
            if (blob)    gsap.set(blob,    { autoAlpha: 0, scale: 0.6 });
            if (halo)    gsap.set(halo,    { autoAlpha: 0, scale: 0.4 });
            // Modo simple (ELITE)
            if (img)     gsap.set(img,     { autoAlpha: 0, y: 60, scale: 0.92 });
            // Modo layered (RACE + PRO) — preserva scale CSS-base del pote
            if (stage)   gsap.set(stage,   { autoAlpha: 0, y: 40 });
            if (lBase)   gsap.set(lBase,   { autoAlpha: 0, scale: 1.05 });
            if (lRuedas) gsap.set(lRuedas, { autoAlpha: 0, rotation: -45, scale: 0.7 });
            if (lPote) {
                const poteBaseScale = parseFloat(getComputedStyle(lPote).transform.match(/matrix.*\(([^)]+)\)/)?.[1]?.split(",")[0]) || 1.10;
                gsap.set(lPote, { autoAlpha: 0, scale: poteBaseScale * 0.75, y: 20 });
                lPote.dataset.poteScale = poteBaseScale;
            }
            if (lTexto)  gsap.set(lTexto,  { autoAlpha: 0, y: -16, scale: 0.92 });
            if (num)     gsap.set(num,     { autoAlpha: 0, y: 30 });
            if (kicker)  gsap.set(kicker,  { autoAlpha: 0, y: 18 });
            if (nameWords.length) gsap.set(nameWords, { autoAlpha: 0, yPercent: 105 });
            if (tagline) gsap.set(tagline, { autoAlpha: 0, y: 18 });
            if (text)    gsap.set(text,    { autoAlpha: 0, y: 18 });
            if (cta)     gsap.set(cta,     { autoAlpha: 0, y: 24, scale: 0.85 });

            // Entrance timeline toggleActions
            const panelTl = gsap.timeline({
                scrollTrigger: {
                    trigger: panel,
                    start: "top 78%",
                    toggleActions: "play none none reverse",
                    invalidateOnRefresh: true,
                },
                defaults: { ease: "power3.out" },
            });

            if (marker) panelTl.to(marker, { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(2.2)" }, 0);
            if (blob)   panelTl.to(blob,   { autoAlpha: 0.4, scale: 1, duration: 1.0, ease: "power2.out" }, 0.05);
            if (halo)   panelTl.to(halo,   { autoAlpha: 1, scale: 1, duration: 0.9, ease: "power2.out" }, 0.10);

            // Simple img path (ELITE)
            if (img) panelTl.to(img, { autoAlpha: 1, y: 0, scale: 1, duration: 1.1, ease: "expo.out" }, 0.15);

            // Layered stage path (RACE + PRO) — secuencia base → ruedas → pote → texto
            if (stage) panelTl.to(stage, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.15);
            if (lBase) panelTl.to(lBase, { autoAlpha: 1, scale: 1, duration: 0.40, ease: "power3.out" }, 0.20);
            if (lRuedas) panelTl.to(lRuedas, { autoAlpha: 1, rotation: 0, scale: 1, duration: 0.70, ease: "back.out(1.6)" }, 0.32);
            if (lPote) {
                const poteBaseScale = parseFloat(lPote.dataset.poteScale) || 1.10;
                panelTl.to(lPote, { autoAlpha: 1, scale: poteBaseScale, y: 0, duration: 0.55, ease: "back.out(1.8)" }, 0.36);
            }
            if (lTexto) panelTl.to(lTexto, { autoAlpha: 1, y: 0, scale: 1, duration: 0.42, ease: "power3.out" }, 0.46);

            if (num)    panelTl.to(num,    { autoAlpha: 1, y: 0, duration: 0.7, ease: "back.out(1.5)" }, 0.20);
            if (kicker) panelTl.to(kicker, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.30);
            if (nameWords.length) panelTl.to(nameWords, {
                autoAlpha: 1, yPercent: 0,
                duration: 0.7,
                stagger: { each: 0.07, from: "start" },
                ease: "expo.out",
            }, 0.38);
            if (tagline) panelTl.to(tagline, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.55);
            if (text)    panelTl.to(text,    { autoAlpha: 1, y: 0, duration: 0.5 }, 0.62);
            if (cta)     panelTl.to(cta, {
                autoAlpha: 1, y: 0, scale: 1,
                duration: 0.8, ease: "elastic.out(1, 0.62)",
            }, 0.72);

            // PARALLAX continuo — decorativo. En móvil lo apagamos: el del
            // halo escala una capa con blur(28px) (re-rasteriza el blur por
            // frame) y son 2 scrubs vivos por panel × 3 paneles.
            const parallaxTarget = img || stage;
            if (parallaxTarget && !isMobile) {
                gsap.fromTo(parallaxTarget,
                    { yPercent: -6 },
                    {
                        yPercent: 6, ease: "none",
                        scrollTrigger: {
                            trigger: panel,
                            start: "top bottom",
                            end:   "bottom top",
                            scrub: true,
                        },
                    }
                );
            }
            if (halo && !isMobile) {
                gsap.fromTo(halo,
                    { yPercent: -10, scale: 1 },
                    {
                        yPercent: 10, scale: 1.06, ease: "none",
                        scrollTrigger: {
                            trigger: panel,
                            start: "top bottom",
                            end:   "bottom top",
                            scrub: true,
                        },
                    }
                );
            }

            // Idle: img float suave + micro-rotation (modo simple). En móvil
            // no: loop infinito sobre una img con drop-shadow (repinta la
            // sombra sin parar aunque esté fuera de viewport).
            if (img && !isMobile) {
                gsap.to(img, {
                    y: gsap.utils.random(-8, -16, 1),
                    rotation: gsap.utils.random(-1.2, 1.2, 0.1),
                    duration: gsap.utils.random(2.6, 3.6),
                    ease: "sine.inOut",
                    yoyo: true, repeat: -1,
                    delay: 0.6 + panelIdx * 0.18,
                });
            }
            // Idle: stage float + pote micro-rotation (modo layered)
            if (stage) {
                gsap.to(stage, {
                    y: gsap.utils.random(-8, -14, 1),
                    duration: gsap.utils.random(2.8, 3.6),
                    ease: "sine.inOut",
                    yoyo: true, repeat: -1,
                    delay: 0.8 + panelIdx * 0.18,
                });
            }
            if (lPote) {
                gsap.to(lPote, {
                    rotation: gsap.utils.random(-1.5, 1.5, 0.1),
                    duration: gsap.utils.random(3.0, 4.2),
                    ease: "sine.inOut",
                    yoyo: true, repeat: -1,
                    delay: 1.0 + panelIdx * 0.18,
                });
            }
            // RUEDAS (RACE) — rotación continua infinita post-entrada
            if (lRuedas) {
                gsap.to(lRuedas, {
                    rotation: "+=360",
                    duration: 12,
                    ease: "none",
                    repeat: -1,
                    delay: 1.3 + panelIdx * 0.18,
                });
            }
        });
    });

    return () => {
        splits.forEach((s) => s.revert());
    };
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLineasEstrella, { once: true });
} else {
    initLineasEstrella();
}
