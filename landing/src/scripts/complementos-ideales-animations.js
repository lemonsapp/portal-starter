/* =====================================================================
   HOLISTIC — complementos-ideales-animations.js

   Animaciones de la sección <ComplementosIdeales /> que vive debajo
   del slider del home. Composición completa:

     1) HEADER — "COMPLEMENTOS / IDEALES" con chars-assemble
        scroll-linked. Cada char arranca disperso (x/y/rotation/scale
        random + blur) y se "arma" hacia su posición final mientras
        el usuario scrollea hacia la sección.

     2) DIVIDER — DrawSVG en línea horizontal con glow circle central.
        Crece desde 50%-50% → 0%-100% (centro hacia afuera).

     3) THREAD VERTICAL — DrawSVGPlugin scroll-linked en línea
        SVG fullheight de la sección. Conecta visualmente header →
        marker 01 (BIO) → marker 02 (DAY-0).

     4) PANELS (BIO + DAY-0) — cada uno con timeline propio
        toggleActions enter:
          • marker dot scale-in
          • blob + halo fade-in
          • bottle PNG slide-up + parallax continuo
          • num stroke-text rise
          • kicker + name + tagline + body fade-stagger
          • CTA elastic-in

   Skills:
     • gsap-plugins SplitText (chars del header, words del name)
     • gsap-plugins DrawSVGPlugin (divider + thread vertical)
     • gsap-plugins CustomEase (eases ya registrados: 'explode')
     • gsap-scrolltrigger scrub (header assemble + thread + parallax)
     • gsap-scrolltrigger toggleActions (panels enter)
     • gsap-timeline (secuencia por panel)
     • gsap-utils.random (per-char scatter único)
     • gsap-utils.toArray (selectors batch)
     • gsap-core matchMedia (reduced-motion + breakpoints)
     • gsap-performance (transforms + opacity + will-change)
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText, DrawSVGPlugin } from "./lib/registerGsap.js";

function initComplementosIdeales() {
    const root = document.querySelector("[data-complementos-ideales]");
    if (!root) return;

    // ---------- Refs HEADER ----------
    const header     = root.querySelector("[data-cmp-header]");
    const eyebrow    = root.querySelector("[data-cmp-eyebrow]");
    const lines      = gsap.utils.toArray("[data-cmp-line]", root);
    const dividerLn  = root.querySelector("[data-cmp-divider-line]");
    const dividerGlow= root.querySelector("[data-cmp-divider-glow]");
    const sub        = root.querySelector("[data-cmp-sub]");

    // ---------- Refs THREAD ----------
    const threadLine = root.querySelector("[data-cmp-thread]");

    // ---------- Refs PANELS ----------
    const panels     = gsap.utils.toArray("[data-cmp-panel]", root);

    if (!lines.length || !panels.length) return;

    const splits = [];

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion } = ctx.conditions;

        // ============================================================
        // 1) HEADER — SplitText por línea (CHARS, no words como antes).
        //    Patrón "armándose": chars dispersos → ensamblan.
        // ============================================================
        const lineInners = lines
            .map((l) => l.querySelector(".cmp__line-inner"))
            .filter(Boolean);

        const charSplits = lineInners.map((inner) => {
            const s = SplitText.create(inner, {
                type: "chars,words",
                aria: "auto",
            });
            splits.push(s);
            return s;
        });
        const allChars = charSplits.flatMap((s) => s.chars);

        // ESTADOS INICIALES del header
        gsap.set(eyebrow, { autoAlpha: 0, y: 14 });
        gsap.set(sub,     { autoAlpha: 0, y: 18 });
        if (dividerLn)   gsap.set(dividerLn,   { drawSVG: "50% 50%" });
        if (dividerGlow) gsap.set(dividerGlow, { autoAlpha: 0, scale: 0, transformOrigin: "50% 50%" });

        if (reduceMotion) {
            gsap.set([eyebrow, sub, ...allChars], {
                autoAlpha: 1, y: 0, x: 0, rotation: 0, scale: 1, filter: "none",
            });
            if (dividerLn)   gsap.set(dividerLn,   { drawSVG: "0% 100%" });
            if (dividerGlow) gsap.set(dividerGlow, { autoAlpha: 1, scale: 1 });
            if (threadLine)  gsap.set(threadLine,  { drawSVG: "0% 100%" });
            // Panels visibles sin animación
            panels.forEach((panel) => {
                const els = panel.querySelectorAll("[data-cmp-num], [data-cmp-kicker], [data-cmp-name], [data-cmp-tagline], [data-cmp-text], [data-cmp-cta], [data-cmp-visual]");
                els.forEach((el) => gsap.set(el, { autoAlpha: 1, y: 0, x: 0, scale: 1 }));
            });
            return;
        }

        // ============================================================
        // SCATTER inicial REFINED — más editorial, menos caótico.
        //
        // Mejora vs versión anterior (que tenía rango muy amplio
        // ±280px x/y, rotaciones ±90°): ahora scatter más sutil con
        // énfasis vertical (caen desde arriba/abajo) + slight rotation
        // sobre eje Y + blur fuerte. Estética "focus pull" cinematográfica
        // en lugar de "explosión de chars".
        // Skill: gsap-utils.random, gsap-performance.
        // ============================================================
        allChars.forEach((ch) => {
            gsap.set(ch, {
                // Énfasis vertical (drift desde arriba/abajo), poco x
                x: gsap.utils.random(-30, 30),
                y: gsap.utils.random(-80, 80),
                z: gsap.utils.random(-200, 200),
                // Rotación sutil sobre Y (página flip feel) sin volteretas
                rotation: 0,
                rotationY: gsap.utils.random(-45, 45),
                rotationX: gsap.utils.random(-20, 20),
                scale: gsap.utils.random(0.7, 0.95),
                autoAlpha: 0,
                filter: "blur(14px)",
                transformOrigin: "50% 50%",
                transformPerspective: 800,
                willChange: "transform, opacity, filter",
            });
        });
        lineInners.forEach((inner) => {
            gsap.set(inner, { perspective: 1000 });
        });

        // ============================================================
        // HEADER ASSEMBLE TIMELINE — scrub más amplio + ease cinematográfico
        // ============================================================
        const assembleTl = gsap.timeline({
            scrollTrigger: {
                trigger: header,
                start: "top 95%",
                end:   "top 20%",
                scrub: 0.8,           // chase más smooth
                invalidateOnRefresh: true,
            },
        });

        // Acto 1: eyebrow rises in
        assembleTl.to(eyebrow, {
            autoAlpha: 1, y: 0,
            duration: 0.18, ease: "expo.out",
        }, 0);

        // Acto 2: chars ENSAMBLAN — focus pull pattern.
        // ease cubic-bezier custom (0.16, 1, 0.3, 1) = "smooth quint-out"
        // — curva más editorial, similar al easing de Apple/Linear.
        // Stagger from:"center" + each 0.012 → orchestrated reveal.
        assembleTl.to(allChars, {
            x: 0, y: 0, z: 0,
            rotation: 0, rotationX: 0, rotationY: 0,
            scale: 1,
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.85,
            stagger: { each: 0.012, from: "center" },
            ease: "expo.out",
        }, 0.10);

        // Acto 3: micro-glow burst — los chars ganan brillo sutil al
        // landing (efecto "premium punch"). Se aplica vía text-shadow
        // intensification via filter brightness pulse.
        if (allChars.length) {
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

        // Acto 4: divider draws (0.55..0.80) + glow circle
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

        // Acto 5: sub fade (0.88..1.00)
        assembleTl.to(sub, {
            autoAlpha: 1, y: 0,
            duration: 0.18, ease: "expo.out",
        }, 0.88);

        // ============================================================
        // POST-ASSEMBLE IDLES — loops sutiles que dan "vida"
        // ============================================================
        if (dividerGlow) {
            // Glow pulse — yoyo scale + opacity, ritmo más rápido
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
        if (dividerLn) {
            gsap.to(dividerLn, {
                opacity: 0.65,
                duration: 3.2, ease: "sine.inOut",
                yoyo: true, repeat: -1, delay: 2.4,
            });
        }
        // Eyebrow dot pulse — drama extra que conecta con divider glow
        const eyebrowDot = root.querySelector(".cmp__dot");
        if (eyebrowDot) {
            gsap.to(eyebrowDot, {
                scale: 1.35,
                duration: 1.4, ease: "sine.inOut",
                yoyo: true, repeat: -1, delay: 1.6,
                transformOrigin: "50% 50%",
            });
        }

        // ============================================================
        // 2) THREAD VERTICAL DrawSVG scroll-linked
        // ============================================================
        // Skill: gsap-plugins DrawSVGPlugin + gsap-scrolltrigger scrub.
        // El thread se "dibuja" mientras el usuario scrollea por la
        // sección, conectando visualmente header → 01 → 02.
        if (threadLine) {
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
        // 3) PANELS (BIO + DAY-0) — cada uno con timeline propio
        // ============================================================
        panels.forEach((panel, panelIdx) => {
            const marker  = panel.querySelector(".cmp__panel-marker");
            const blob    = panel.querySelector(".cmp__panel-blob");
            const halo    = panel.querySelector("[data-cmp-halo]");
            const img     = panel.querySelector("[data-cmp-img]");
            const num     = panel.querySelector("[data-cmp-num]");
            const kicker  = panel.querySelector("[data-cmp-kicker]");
            const name    = panel.querySelector("[data-cmp-name]");
            const tagline = panel.querySelector("[data-cmp-tagline]");
            const text    = panel.querySelector("[data-cmp-text]");
            const cta     = panel.querySelector("[data-cmp-cta]");

            // SplitText words del name → permite stagger en la entrada.
            let nameSplit = null;
            let nameWords = [];
            if (name) {
                nameSplit = SplitText.create(name, {
                    type: "words",
                    wordsClass: "cmp__panel-name-word",
                    aria: "auto",
                });
                splits.push(nameSplit);
                nameWords = nameSplit.words;
            }

            // Estados iniciales
            if (marker)  gsap.set(marker,  { autoAlpha: 0, scale: 0.4, transformOrigin: "50% 50%" });
            if (blob)    gsap.set(blob,    { autoAlpha: 0, scale: 0.6 });
            if (halo)    gsap.set(halo,    { autoAlpha: 0, scale: 0.4 });
            if (img)     gsap.set(img,     { autoAlpha: 0, y: 60, scale: 0.92 });
            if (num)     gsap.set(num,     { autoAlpha: 0, y: 30 });
            if (kicker)  gsap.set(kicker,  { autoAlpha: 0, y: 18 });
            if (nameWords.length) gsap.set(nameWords, { autoAlpha: 0, yPercent: 105 });
            if (tagline) gsap.set(tagline, { autoAlpha: 0, y: 18 });
            if (text)    gsap.set(text,    { autoAlpha: 0, y: 18 });
            if (cta)     gsap.set(cta,     { autoAlpha: 0, y: 24, scale: 0.85 });

            // Entrance timeline — toggleActions enter cuando panel
            // entra al viewport (top 78%). play none none reverse → si
            // user scroll-up y vuelve, se replay.
            const panelTl = gsap.timeline({
                scrollTrigger: {
                    trigger: panel,
                    start: "top 78%",
                    toggleActions: "play none none reverse",
                    invalidateOnRefresh: true,
                },
                defaults: { ease: "power3.out" },
            });

            // 0.00 Marker scale-in (anchor del thread vertical)
            if (marker) {
                panelTl.to(marker, {
                    autoAlpha: 1, scale: 1,
                    duration: 0.5, ease: "back.out(2.2)",
                }, 0);
            }

            // 0.05 Blob + Halo fade-in (color del producto detrás)
            if (blob) {
                panelTl.to(blob, {
                    autoAlpha: 0.4, scale: 1,
                    duration: 1.0, ease: "power2.out",
                }, 0.05);
            }
            if (halo) {
                panelTl.to(halo, {
                    autoAlpha: 1, scale: 1,
                    duration: 0.9, ease: "power2.out",
                }, 0.10);
            }

            // 0.15 Bottle slide-up + scale
            if (img) {
                panelTl.to(img, {
                    autoAlpha: 1, y: 0, scale: 1,
                    duration: 1.1, ease: "expo.out",
                }, 0.15);
            }

            // 0.20 Num rise (stroke text grande)
            if (num) {
                panelTl.to(num, {
                    autoAlpha: 1, y: 0,
                    duration: 0.7, ease: "back.out(1.5)",
                }, 0.20);
            }

            // 0.30 Kicker fade
            if (kicker) {
                panelTl.to(kicker, {
                    autoAlpha: 1, y: 0,
                    duration: 0.5,
                }, 0.30);
            }

            // 0.38 Name words slide-up con stagger
            if (nameWords.length) {
                panelTl.to(nameWords, {
                    autoAlpha: 1, yPercent: 0,
                    duration: 0.7,
                    stagger: { each: 0.07, from: "start" },
                    ease: "expo.out",
                }, 0.38);
            }

            // 0.55 Tagline + body
            if (tagline) {
                panelTl.to(tagline, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.55);
            }
            if (text) {
                panelTl.to(text, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.62);
            }

            // 0.72 CTA elastic-in
            if (cta) {
                panelTl.to(cta, {
                    autoAlpha: 1, y: 0, scale: 1,
                    duration: 0.8, ease: "elastic.out(1, 0.62)",
                }, 0.72);
            }

            // ============================================================
            // PARALLAX continuo — img + halo + blob siguen al scroll
            // sutilmente dentro del panel.
            // Skill: gsap-scrolltrigger scrub + gsap-utils trabajando solo
            // con transforms (gsap-performance).
            // ============================================================
            if (img) {
                gsap.fromTo(img,
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
            if (halo) {
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

            // Idle: img float suave (independiente del scroll)
            if (img) {
                gsap.to(img, {
                    y: gsap.utils.random(-8, -16, 1),
                    rotation: gsap.utils.random(-1.2, 1.2, 0.1),
                    duration: gsap.utils.random(2.6, 3.6),
                    ease: "sine.inOut",
                    yoyo: true, repeat: -1,
                    delay: 0.6 + panelIdx * 0.18,
                });
            }
        });
    });

    // Cleanup callback (matchMedia revert hace la mayoría)
    return () => {
        splits.forEach((s) => s.revert());
    };
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initComplementosIdeales, { once: true });
} else {
    initComplementosIdeales();
}
