/* =====================================================================
   HOLISTIC — product-detail.js
   Animaciones para ProductDeepDive — landing interna del producto
   estilo apple.com/macbook-pro.

   Skills aplicadas (citadas inline):
     • gsap-scrolltrigger pin + scrub  → highlights sticky + bigstat counter
     • gsap-plugins SplitText           → headline, claim, pullquote
     • gsap-plugins Flip                → format selector (re-orden DOM)
     • gsap-timeline                    → secuencia hero
     • gsap-utils.snap                  → counter integer
     • gsap-utils.toArray, random       → setup
     • gsap-core matchMedia             → reduced-motion + breakpoints
     • gsap-performance                 → transforms only, will-change CSS
     • accessibility                    → aria-selected/expanded actualizados
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText } from "./lib/registerGsap.js";
import { Flip } from "gsap/Flip";

if (!window.__holisticFlipRegistered) {
    gsap.registerPlugin(Flip);
    window.__holisticFlipRegistered = true;
}

function initProductDetail() {
    const root = document.querySelector("[data-product-deepdive]");
    if (!root) return;

    /* -----------------------------------------------------------------
       Refs
       ----------------------------------------------------------------- */
    // Hero
    const hero          = root.querySelector("[data-pdd-hero]");
    const heroGlow      = root.querySelector("[data-pdd-hero-glow]");
    const kicker        = root.querySelector("[data-pdd-kicker]");
    const headline      = root.querySelector("[data-pdd-headline]");
    const claim         = root.querySelector("[data-pdd-claim]");
    const heroImg       = root.querySelector("[data-pdd-hero-img]");
    const heroStage     = root.querySelector("[data-pdd-hero-stage]");
    const ctas          = Array.from(root.querySelectorAll(".pdd__hero-ctas .pdd__cta"));
    const scrollHint    = root.querySelector("[data-pdd-scroll-hint]");

    // Highlights
    const hlSection     = root.querySelector("[data-pdd-highlights]");
    const hlPin         = root.querySelector("[data-pdd-highlights-pin]");
    const hlItems       = Array.from(root.querySelectorAll("[data-pdd-highlight]"));
    const hlDots        = Array.from(root.querySelectorAll("[data-pdd-highlight-dot]"));
    // Multi-image: cuando los highlights tienen imagen propia (Race),
    // hay N imágenes apiladas en el container. Si no, hay solo una.
    const hlImgs        = Array.from(root.querySelectorAll("[data-pdd-highlights-img]"));
    const hlProductImg  = hlImgs.length === 1 ? hlImgs[0] : null;

    // Big stat
    const bigStatVal    = root.querySelector("[data-pdd-bigstat-value]");
    const bigStatLabel  = root.querySelector("[data-pdd-bigstat-label]");
    const bigStatBody   = root.querySelector("[data-pdd-bigstat-body]");
    // Variante statement (Race): "FÓRMULA ADAPTABLE" con reveal L→R
    const bigStatText   = root.querySelector("[data-pdd-bigstat-text]");
    const bigStatWords  = Array.from(root.querySelectorAll("[data-pdd-bigstat-word]"));
    const bigStatRule   = root.querySelector("[data-pdd-bigstat-rule]");

    // Bento
    const bentoCells    = Array.from(root.querySelectorAll("[data-pdd-bento-cell]"));

    // Formats
    const formatStage   = root.querySelector("[data-pdd-formats-stage]");
    const formatCards   = Array.from(root.querySelectorAll("[data-pdd-format-card]"));
    const formatTabs    = Array.from(root.querySelectorAll("[data-pdd-format-tab]"));

    // System
    const systemTitle   = root.querySelector("[data-pdd-system-title]");
    const systemChips   = Array.from(root.querySelectorAll("[data-pdd-system-chip]"));

    // Pullquote
    const pullquoteTxt  = root.querySelector("[data-pdd-pullquote-text]");

    // Specs
    const specRows      = Array.from(root.querySelectorAll("[data-pdd-spec-row]"));

    /* -----------------------------------------------------------------
       A11y: pausa hero video full-bleed bajo prefers-reduced-motion.
       Antes esto sólo se aplicaba en /linea-race vía RaceCinematic
       script. Las internas Elite/Pro/Bio/Day-0 que ahora también tienen
       heroVideo lo necesitan acá. Verificación one-shot (no reactivo)
       para evitar arrancar/parar al toggle del media query —
       refrescar la página vuelve a evaluar.
       ----------------------------------------------------------------- */
    const heroVideoEl = root.querySelector("[data-pdd-hero-video]");
    if (heroVideoEl && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        heroVideoEl.removeAttribute("autoplay");
        try { heroVideoEl.pause(); } catch (_) {}
    }

    /* -----------------------------------------------------------------
       MatchMedia: reduced-motion + breakpoints
       ----------------------------------------------------------------- */
    const splits = []; // tracking para revert
    const cleanups = []; // listeners a soltar cuando matchMedia revierte

    mm.add(BREAKPOINTS, (ctx) => {
        const { isMobile, reduceMotion } = ctx.conditions;

        // ============================================================
        // 1) HERO — secuencia entry + parallax glow
        // ============================================================
        let splitHeadline = null;
        if (headline) {
            splitHeadline = SplitText.create(headline, {
                type: "lines, words",
                mask: "lines",
                linesClass: "pdd__hero-line-split",
                wordsClass: "pdd__hero-word",
                aria: "auto",
            });
            splits.push(splitHeadline);
        }
        const headlineWords = splitHeadline ? splitHeadline.words : [];

        // Estados iniciales
        gsap.set(kicker,        { autoAlpha: 0, y: 20 });
        gsap.set(headlineWords, { yPercent: 110, rotationX: -45, autoAlpha: 0 });
        gsap.set(claim,         { autoAlpha: 0, y: 24 });
        gsap.set(ctas,          { autoAlpha: 0, y: 24, scale: 0.92 });
        gsap.set(heroStage,     { autoAlpha: 0, yPercent: 12, scale: 0.92 });
        gsap.set(heroGlow,      { autoAlpha: 0, scale: 0.6 });
        gsap.set(scrollHint,    { autoAlpha: 0 });

        if (reduceMotion) {
            gsap.set([kicker, claim, ...ctas, heroStage, scrollHint], { autoAlpha: 1, y: 0, scale: 1, yPercent: 0 });
            gsap.set(headlineWords, { yPercent: 0, rotationX: 0, autoAlpha: 1 });
            gsap.set(heroGlow, { autoAlpha: 0.65, scale: 1 });
        } else {
            const heroTl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.2 });
            heroTl
                .to(kicker, { autoAlpha: 1, y: 0, duration: 0.6, ease: "back.out(1.6)" }, 0)
                .to(heroGlow, { autoAlpha: 0.7, scale: 1, duration: 1.4 }, 0.05)
                .to(headlineWords, {
                    yPercent: 0, rotationX: 0, autoAlpha: 1,
                    duration: 1.0, ease: "back.out(1.4)",
                    stagger: { amount: 0.6, from: "start" },
                }, 0.15)
                .to(heroStage, {
                    autoAlpha: 1, yPercent: 0, scale: 1,
                    duration: 1.4, ease: "back.out(1.2)",
                }, 0.3)
                .to(claim, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.85)
                .to(ctas,  {
                    autoAlpha: 1, y: 0, scale: 1, duration: 0.6,
                    ease: "back.out(2)",
                    stagger: 0.08,
                }, 1.0)
                .to(scrollHint, { autoAlpha: 1, duration: 0.5 }, 1.2);

            // Idle: respiración del producto + glow pulse
            gsap.to(heroImg, {
                y: "+=14", duration: 3.6, ease: "sine.inOut", yoyo: true, repeat: -1,
            });
            gsap.to(heroGlow, {
                scale: 1.08, duration: 4, ease: "sine.inOut", yoyo: true, repeat: -1,
            });

            // Parallax glow + product on scroll (solo desktop)
            if (!isMobile) {
                gsap.to(heroGlow, {
                    yPercent: -10, ease: "none",
                    scrollTrigger: {
                        trigger: hero, start: "top top", end: "bottom top", scrub: 1,
                    },
                });
                gsap.to(heroImg, {
                    yPercent: -8, ease: "none",
                    scrollTrigger: {
                        trigger: hero, start: "top top", end: "bottom top", scrub: 1.2,
                    },
                });
            }
        }

        // ============================================================
        // 2) STICKY HIGHLIGHTS — pin + scrub progress
        //    El producto está pinned a la izquierda, los highlights pasan
        //    a la derecha sincronizados con el scroll.
        // ============================================================
        if (hlSection && hlItems.length && !reduceMotion) {
            const total = hlItems.length;

            // Estados iniciales: solo el primero visible
            hlItems.forEach((it, i) => {
                gsap.set(it, {
                    autoAlpha: i === 0 ? 1 : 0,
                    y: i === 0 ? 0 : 40,
                });
            });

            // Estado inicial multi-imgs: la primera visible, el resto
            // con blur + autoAlpha 0. GSAP "ownea" estas props para que
            // las transiciones del onUpdate las puedan animar limpias.
            if (hlImgs.length > 1) {
                hlImgs.forEach((img, i) => {
                    if (i === 0) {
                        gsap.set(img, {
                            autoAlpha: 1,
                            filter: "blur(0px) saturate(1.05)",
                            scale: 1,
                        });
                    } else {
                        gsap.set(img, {
                            autoAlpha: 0,
                            filter: "blur(18px) saturate(0.7)",
                            scale: 0.95,
                        });
                    }
                });
            }

            // Pin: cada highlight dura 1 viewport-height de scroll
            const pinDuration = (total - 1) * 80; // % de window height

            const stHl = ScrollTrigger.create({
                id: "pdd-highlights",
                trigger: hlSection,
                start: "top top",
                end: `+=${pinDuration}%`,
                pin: hlPin,
                pinSpacing: true,
                scrub: 0.7,
                anticipatePin: 1,
                invalidateOnRefresh: true,
                onUpdate: (self) => {
                    const idx = Math.min(total - 1, Math.floor(self.progress * total));
                    hlItems.forEach((it, i) => {
                        const isActive = i === idx;
                        if (isActive && !it.classList.contains("is-active")) {
                            it.classList.add("is-active");
                            gsap.to(it, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", overwrite: true });
                        } else if (!isActive && it.classList.contains("is-active")) {
                            it.classList.remove("is-active");
                            gsap.to(it, {
                                autoAlpha: 0,
                                y: i < idx ? -40 : 40,
                                duration: 0.4, ease: "power2.in", overwrite: true,
                            });
                        }
                    });
                    hlDots.forEach((d, i) => d.classList.toggle("is-active", i === idx));

                    // Cross-fade entre imágenes apiladas (Race tiene 4
                    // imágenes, una por highlight). Saliente: blur+fade
                    // out; entrante: blur→0 + fade in. Sólo si hay > 1.
                    if (hlImgs.length > 1) {
                        hlImgs.forEach((img, i) => {
                            const isActive = i === idx;
                            if (isActive && !img.classList.contains("is-active")) {
                                img.classList.add("is-active");
                                gsap.to(img, {
                                    autoAlpha: 1,
                                    filter: "blur(0px) saturate(1.05)",
                                    scale: 1,
                                    duration: 0.7,
                                    ease: "power3.out",
                                    overwrite: "auto",
                                });
                            } else if (!isActive && img.classList.contains("is-active")) {
                                img.classList.remove("is-active");
                                gsap.to(img, {
                                    autoAlpha: 0,
                                    filter: "blur(18px) saturate(0.7)",
                                    scale: 0.95,
                                    duration: 0.5,
                                    ease: "power2.in",
                                    overwrite: "auto",
                                });
                            }
                        });
                    }
                },
            });

            // SplitText titulares de highlights (entrada con stagger words)
            hlItems.forEach((it) => {
                const t = it.querySelector("[data-pdd-highlight-title]");
                if (!t) return;
                const sp = SplitText.create(t, {
                    type: "words",
                    mask: "words",
                    wordsClass: "pdd__highlight-word",
                    aria: "auto",
                });
                splits.push(sp);
            });

            // Producto rotation sutil con scroll del pin
            if (hlProductImg) {
                gsap.to(hlProductImg, {
                    rotation: 6, ease: "none",
                    scrollTrigger: {
                        trigger: hlSection,
                        start: "top top",
                        end: `+=${pinDuration}%`,
                        scrub: 1,
                    },
                });
            }
        } else if (hlItems.length && reduceMotion) {
            hlItems.forEach((it) => gsap.set(it, { autoAlpha: 1, y: 0 }));
            // En reduceMotion, mostramos sólo la primera imagen multi
            // (no hay cross-fade scroll-driven).
            if (hlImgs.length > 1) {
                hlImgs.forEach((img, i) => gsap.set(img, { autoAlpha: i === 0 ? 1 : 0 }));
            }
        }

        // ============================================================
        // 3-bis) BIG STAT variante statement (Race) — "FÓRMULA ADAPTABLE"
        // Reveal editorial izquierda→derecha: cada palabra se descubre con
        // clip-path (inset desde la derecha → 0) + un slide sutil en X, y la
        // regla accent se dibuja del mismo lado (scaleX 0→1). Profesional,
        // sin perder la colorimetría verde (--pdd-color en accent + regla).
        // gsap-scrolltrigger: toggleActions (no scrub) para un reveal discreto.
        // ============================================================
        if (bigStatText) {
            if (reduceMotion) {
                // Sin motion: aseguramos estado final visible (la regla parte
                // en scaleX:1 por CSS, así que no hay que tocar nada más).
            } else {
                gsap.set(bigStatWords, { xPercent: -6, clipPath: "inset(0 100% 0 0)" });
                if (bigStatRule) gsap.set(bigStatRule, { scaleX: 0 });

                const tl = gsap.timeline({
                    scrollTrigger: {
                        trigger: bigStatText,
                        start: "top 78%",
                        toggleActions: "play none none reverse",
                    },
                });
                tl.to(bigStatWords, {
                    xPercent: 0,
                    clipPath: "inset(0 0% 0 0)",
                    duration: 0.9,
                    ease: "power4.out",
                    stagger: 0.14,
                });
                if (bigStatRule) {
                    tl.to(bigStatRule, {
                        scaleX: 1,
                        duration: 0.7,
                        ease: "power3.inOut",
                    }, "-=0.55");
                }
                gsap.from([bigStatLabel, bigStatBody], {
                    autoAlpha: 0, y: 30, duration: 0.8, stagger: 0.12, ease: "power3.out",
                    scrollTrigger: {
                        trigger: bigStatText, start: "top 80%",
                        toggleActions: "play none none reverse",
                    },
                });
            }
        }

        // ============================================================
        // 3) BIG STAT — counter scrub-driven (snap entero)
        // ============================================================
        if (bigStatVal) {
            const target = parseFloat(bigStatVal.dataset.target || "0");
            if (reduceMotion) {
                bigStatVal.textContent = String(target);
            } else {
                const proxy = { n: 0 };
                gsap.to(proxy, {
                    n: target,
                    duration: 1, ease: "none",
                    snap: { n: 1 },
                    onUpdate: () => { bigStatVal.textContent = String(Math.round(proxy.n)); },
                    scrollTrigger: {
                        trigger: bigStatVal,
                        start: "top 85%",
                        end: "top 35%",
                        scrub: 0.6,
                    },
                });

                // Body + label entry
                gsap.from([bigStatLabel, bigStatBody], {
                    autoAlpha: 0, y: 30, duration: 0.8, stagger: 0.12, ease: "power3.out",
                    scrollTrigger: {
                        trigger: bigStatVal, start: "top 80%",
                        toggleActions: "play none none reverse",
                    },
                });
            }
        }

        // ============================================================
        // 4) BENTO CELLS — pop con stagger
        // ============================================================
        if (bentoCells.length && !reduceMotion) {
            gsap.from(bentoCells, {
                autoAlpha: 0, y: 40, scale: 0.92,
                duration: 0.7, stagger: 0.08, ease: "back.out(1.6)",
                scrollTrigger: {
                    trigger: bentoCells[0].parentElement,
                    start: "top 75%",
                    toggleActions: "play none none reverse",
                },
            });
        }

        // ============================================================
        // 5) FORMATS — selector con Flip plugin
        //    Click en tab → mover la card target al frente, Flip anima.
        // ============================================================
        if (formatStage && formatCards.length > 1) {
            // Patrón "solo el activo visible, escalado grande" por pedido
            // del cliente. Los demás cards se hacen autoAlpha 0 (no se
            // ven), el activo escala 1.22 + zIndex top. Cross-fade smooth
            // entre selecciones via Flip.
            // La escala del activo vive en CSS (--pdd-active-scale): en
            // notebooks bajas la media query la reduce para que el render
            // escalado no desborde el stage. Se lee en cada uso (no una vez)
            // por si el viewport cambia de categoría con un resize.
            const activeScale = () =>
                parseFloat(getComputedStyle(formatStage).getPropertyValue("--pdd-active-scale")) || 1.22;

            // ── Normalizar el TAMAÑO VISIBLE de los renders ────────────────
            // Solo actúa donde los datos traen data-img-target (hoy: Race).
            // Sin esos atributos no hace nada → elite/pro/bio/day-0/cloner
            // siguen exactamente igual con su imgScale estático.
            //
            // Por qué hace falta: el stage cambia de FORMA con el viewport
            // (ancho por vw, alto por vh), así que object-fit:contain cambia
            // de dimensión ligante entre notebook y monitor grande, y se
            // invierte qué imágenes crecen. Una escala fija no puede valer en
            // las dos formas (a 1920 el 1L se veía 35% más grande que el 10L).
            //
            // Se despeja la escala para que el alto del producto OPACO sea
            // `target` × alto del stage. El alto visible es lineal con la
            // escala, así que sale de una división. Tope por ancho para que
            // el producto no se pase de los lados del stage.
            const normalizarRenders = () => {
                const cardH = parseFloat(getComputedStyle(formatStage).height);
                const cardW = parseFloat(getComputedStyle(formatStage).width);
                if (!cardH || !cardW) return;

                formatCards.forEach((card) => {
                    const img = card.querySelector("img");
                    if (!img) return;
                    const target = parseFloat(img.dataset.imgTarget);
                    const alphaW = parseFloat(img.dataset.imgAlphaW);
                    const alphaH = parseFloat(img.dataset.imgAlphaH);
                    // Sin datos calibrados → no tocar (respeta el imgScale).
                    if (!target || !alphaW || !alphaH) return;
                    const NW = img.naturalWidth, NH = img.naturalHeight;
                    if (!NW || !NH) return;   // todavía no cargó: lo reintenta el onload

                    // Caja de layout del img (getComputedStyle NO incluye el
                    // transform, así que es la caja a escala 1 — sin esto el
                    // cálculo se muerde la cola).
                    const cs = getComputedStyle(img);
                    const boxW = parseFloat(cs.width), boxH = parseFloat(cs.height);
                    if (!boxW || !boxH) return;

                    const fit = Math.min(boxW / NW, boxH / NH);   // object-fit: contain
                    const visW1 = alphaW * NW * fit;              // producto visible a escala 1
                    const visH1 = alphaH * NH * fit;
                    if (!visW1 || !visH1) return;

                    // OJO: la CARD tambien se escala (activeScale) por encima
                    // de esta escala, asi que el tope de ancho tiene que
                    // descontarlo o el producto se sale igual (a 1920 el 10L
                    // se pasaba 62px de los lados con el tope sin descontar).
                    const A = activeScale();
                    const porAlto  = (target * cardH) / visH1;
                    const porAncho = (0.92 * cardW) / (visW1 * A);
                    const s = Math.min(porAlto, porAncho, 2);

                    img.style.transform = `scale(${s.toFixed(4)})`;
                    img.style.transformOrigin = "center";
                });
            };

            formatCards.forEach((card) => {
                const img = card.querySelector("img");
                if (img && !img.complete) img.addEventListener("load", normalizarRenders, { once: true });
            });
            normalizarRenders();
            window.addEventListener("resize", normalizarRenders);
            cleanups.push(() => window.removeEventListener("resize", normalizarRenders));

            const arrange = (activeIdx) => {
                const cards = Array.from(formatStage.children);
                cards.forEach((c, i) => {
                    const isActive = i === activeIdx;
                    gsap.set(c, {
                        zIndex: isActive ? 10 : 1,
                        rotation: 0,
                        x: 0,
                        y: 0,
                        scale: isActive ? activeScale() : 0.88,
                        autoAlpha: isActive ? 1 : 0,
                        transformOrigin: "center center",
                    });
                    c.classList.toggle("is-active", isActive);
                });
            };
            arrange(0);

            const goToFormat = (idx) => {
                if (reduceMotion) {
                    arrange(idx);
                } else {
                    // Timeline: fade-out de los actuales no-activos →
                    // fade-in del nuevo activo con scale-up. Más simple
                    // que Flip y matchea mejor el "los otros desaparecen
                    // y el seleccionado crece" que el cliente pidió.
                    const cards = Array.from(formatStage.children);
                    const currentActive = cards.find((c) => c.classList.contains("is-active"));
                    const nextActive = cards[idx];
                    const others = cards.filter((c) => c !== nextActive);

                    const tl = gsap.timeline();

                    // 1) Si hay un activo previo distinto al nuevo, lo
                    //    desvanecemos + scale-down primero.
                    if (currentActive && currentActive !== nextActive) {
                        tl.to(currentActive, {
                            autoAlpha: 0, scale: 0.88,
                            duration: 0.32, ease: "power2.in",
                        }, 0);
                    }
                    // 2) Otros cards quedan invisibles
                    tl.set(others, { autoAlpha: 0, scale: 0.88, zIndex: 1 }, 0);
                    // 3) El nuevo activo entra escalado grande
                    tl.set(nextActive, { zIndex: 10 }, 0.20);
                    tl.fromTo(nextActive,
                        { autoAlpha: 0, scale: 0.88 },
                        {
                            autoAlpha: 1, scale: activeScale(),
                            duration: 0.55, ease: "back.out(1.4)",
                        }, 0.20);
                    // 4) Sync clases
                    tl.call(() => {
                        cards.forEach((c, i) => c.classList.toggle("is-active", i === idx));
                    }, [], 0.20);
                }

                formatTabs.forEach((t, i) => {
                    t.classList.toggle("is-active", i === idx);
                    t.setAttribute("aria-selected", i === idx ? "true" : "false");
                });
            };

            formatTabs.forEach((tab, i) => {
                tab.addEventListener("click", () => goToFormat(i));
            });
        }

        // ============================================================
        // 6) SYSTEM — title SplitText + chips stagger
        // ============================================================
        if (systemTitle && !reduceMotion) {
            const sp = SplitText.create(systemTitle, {
                type: "words",
                mask: "words",
                wordsClass: "pdd__system-word",
                aria: "auto",
            });
            splits.push(sp);
            gsap.from(sp.words, {
                yPercent: 110, rotationX: -45, autoAlpha: 0,
                duration: 0.9,
                stagger: { amount: 0.5, from: "start" },
                ease: "back.out(1.4)",
                scrollTrigger: {
                    trigger: systemTitle, start: "top 75%",
                    toggleActions: "play none none reverse",
                },
            });
        }
        if (systemChips.length && !reduceMotion) {
            gsap.from(systemChips, {
                autoAlpha: 0, y: 20, scale: 0.9, duration: 0.6,
                stagger: 0.12, ease: "back.out(2)",
                scrollTrigger: {
                    trigger: systemChips[0].parentElement, start: "top 80%",
                    toggleActions: "play none none reverse",
                },
            });
        }

        // ============================================================
        // 7) PULLQUOTE — palabras flotando (yPercent stagger from "start")
        // ============================================================
        if (pullquoteTxt && !reduceMotion) {
            const sp = SplitText.create(pullquoteTxt, {
                type: "words",
                mask: "words",
                wordsClass: "pdd__pullquote-word",
                aria: "auto",
                ignore: ".pdd__pullquote-mark",
            });
            splits.push(sp);
            gsap.from(sp.words, {
                yPercent: 110, rotation: 6, autoAlpha: 0,
                duration: 1.0,
                stagger: { amount: 0.6, from: "start" },
                ease: "back.out(1.3)",
                scrollTrigger: {
                    trigger: pullquoteTxt, start: "top 70%",
                    toggleActions: "play none none reverse",
                },
            });
        }

        // ============================================================
        // 8) SPECS — disclosure list reveal
        // ============================================================
        if (specRows.length && !reduceMotion) {
            gsap.from(specRows, {
                autoAlpha: 0, x: -30, duration: 0.6,
                stagger: 0.06, ease: "power3.out",
                scrollTrigger: {
                    trigger: specRows[0].parentElement, start: "top 80%",
                    toggleActions: "play none none reverse",
                },
            });
        }

        // Cleanup matchMedia: revert SplitText + soltar listeners propios
        return () => {
            splits.forEach((s) => s && s.revert());
            cleanups.forEach((fn) => fn());
            cleanups.length = 0;
        };
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductDetail);
} else {
    initProductDetail();
}
