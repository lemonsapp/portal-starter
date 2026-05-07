/* =====================================================================
   HOLISTIC — story-animations.js
   Orquesta capítulos + marquees + FinalCTA + transiciones de color.
   ScrollTrigger en top-level (nunca anidado en timelines con padre).
   ===================================================================== */

import { gsap, ScrollTrigger, mm, BREAKPOINTS } from "./lib/registerGsap.js";

/**
 * Split manual por palabras. Cada palabra queda en .word con .word__inner
 * para poder clipear con overflow hidden en el padre.
 */
function splitByWords(el) {
    if (!el || !el.textContent) return [];
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
        .map(
            (w) =>
                `<span class="word"><span class="word__inner">${w}</span></span>`
        )
        .join(" ");
    return Array.from(el.querySelectorAll(".word__inner"));
}

/**
 * Split manual por líneas visuales — el split por líneas reales requiere
 * mediciones; acá lo que hacemos es envolver el texto en una única línea
 * con estructura para poder animar como bloque. Si el tagline tiene
 * múltiples líneas de CSS, GSAP igual anima con overflow clippeado.
 */
function wrapLine(el) {
    if (!el || !el.textContent) return null;
    const raw = el.innerHTML;
    el.innerHTML = `<span class="line"><span class="line__inner">${raw}</span></span>`;
    return el.querySelector(".line__inner");
}

function initStory() {
    const chapters = gsap.utils.toArray("[data-chapter]");
    const finalCTA = document.querySelector("[data-final-cta]");
    const marquees = gsap.utils.toArray("[data-marquee]");
    const cycleIntro = document.querySelector("[data-cycle-intro]");
    // FlavorScroll fue removido — el slider del catálogo ahora es ProductFloatSlider
    // (que tiene su propio script). Mantenemos el body color transition cuando
    // el ProductFloatSlider entra (se hace abajo).

    mm.add(BREAKPOINTS, (context) => {
            const { isDesktop, isTablet, isMobile, reduceMotion: isReduce } =
                context.conditions;

            // ============================================================
            // Marquees — loop horizontal infinito
            // ============================================================
            marquees.forEach((marquee) => {
                const track = marquee.querySelector("[data-marquee-track]");
                if (!track) return;

                if (isReduce) return; // Sin loop en reduce-motion

                // xPercent -50 mueve exactamente una copia del contenido
                // (rendereamos 2 grupos idénticos).
                const duration = isMobile ? 22 : isTablet ? 26 : 30;

                gsap.to(track, {
                    xPercent: -50,
                    duration,
                    ease: "none",
                    repeat: -1,
                });
            });

            // ============================================================
            // CycleIntro — pin + scrub reveal palabra por palabra.
            // refreshPriority: -2 (segundo después del hero).
            // ============================================================
            if (cycleIntro) {
                const cycleTrack = cycleIntro.querySelector("[data-cycle-track]");
                const cycleWords = cycleIntro.querySelectorAll("[data-word]");
                const hlCiclo = cycleIntro.querySelector("[data-highlight-ciclo]");
                const hlEtapaFill = cycleIntro.querySelector(
                    "[data-highlight-etapa-fill]"
                );

                gsap.set(cycleWords, { opacity: 0, y: 40 });
                if (cycleTrack) gsap.set(cycleTrack, { opacity: 1 });
                if (hlCiclo) gsap.set(hlCiclo, { backgroundColor: "rgba(37,211,102,0)" });
                if (hlEtapaFill) gsap.set(hlEtapaFill, { scaleX: 0 });

                if (isReduce) {
                    gsap.set(cycleWords, { opacity: 1, y: 0 });
                    if (hlCiclo) gsap.set(hlCiclo, {
                        backgroundColor: "rgba(37,211,102,0.15)",
                    });
                    if (hlEtapaFill) gsap.set(hlEtapaFill, { scaleX: 1 });
                } else {
                    const pinRange = isMobile ? "+=100%" : "+=200%";

                    const cycleTl = gsap.timeline({
                        scrollTrigger: {
                            id: "cycle-intro",
                            trigger: cycleIntro,
                            start: "top top",
                            end: pinRange,
                            pin: true,
                            pinSpacing: true,
                            scrub: true,
                            anticipatePin: 1,
                            invalidateOnRefresh: true,
                            refreshPriority: -2,
                        },
                    });

                    // gsap-core skill: stagger object form, "amount" reparte
                    // la duración total entre todas las palabras.
                    cycleTl.to(cycleWords, {
                        opacity: 1,
                        y: 0,
                        duration: 0.6,
                        stagger: { amount: 3.4, from: "start" },
                        ease: "power2.out",
                    }, 0);

                    if (hlCiclo) {
                        cycleTl.to(hlCiclo, {
                            backgroundColor: "rgba(37,211,102,0.15)",
                            duration: 0.4,
                            ease: "power2.out",
                        }, 2.2);
                    }

                    if (hlEtapaFill) {
                        cycleTl.to(hlEtapaFill, {
                            scaleX: 1,
                            duration: 0.6,
                            ease: "expo.out",
                        }, 3.6);
                    }
                }

                // Cursor claro mientras CycleIntro está en viewport (fondo negro).
                ScrollTrigger.create({
                    trigger: cycleIntro,
                    start: "top 60%",
                    end: "bottom 40%",
                    onEnter: () =>
                        document.documentElement.classList.add("cursor-on-dark"),
                    onLeave: () =>
                        document.documentElement.classList.remove("cursor-on-dark"),
                    onEnterBack: () =>
                        document.documentElement.classList.add("cursor-on-dark"),
                    onLeaveBack: () =>
                        document.documentElement.classList.remove("cursor-on-dark"),
                });

                // Body color → negro al entrar.
                ScrollTrigger.create({
                    trigger: cycleIntro,
                    start: "top 20%",
                    onEnter: () => {
                        gsap.to(document.body, {
                            backgroundColor: "#0a0a0a",
                            duration: 0.8,
                            ease: "power2.inOut",
                            overwrite: true,
                        });
                    },
                    onEnterBack: () => {
                        gsap.to(document.body, {
                            backgroundColor: "#0a0a0a",
                            duration: 0.8,
                            ease: "power2.inOut",
                            overwrite: true,
                        });
                    },
                });
            }

            // ============================================================
            // ProductFloatSlider — body color transition cuando entra
            // (reemplazo del antiguo FlavorScroll). El slider ahora es el
            // hero principal del sitio.
            // ============================================================
            const flavorCleanup = [];
            const productSlider = document.querySelector("[data-product-slider]");

            if (productSlider) {
                ScrollTrigger.create({
                    trigger: productSlider,
                    start: "top 50%",
                    onEnter: () => {
                        gsap.to(document.body, {
                            backgroundColor: "#0c0c0c",
                            duration: 0.8, ease: "power2.inOut", overwrite: true,
                        });
                    },
                    onEnterBack: () => {
                        gsap.to(document.body, {
                            backgroundColor: "#0c0c0c",
                            duration: 0.8, ease: "power2.inOut", overwrite: true,
                        });
                    },
                });
            }

            // FlavorScroll legacy code — DEPRECATED, dead branch
            const flavorScroll = null;
            if (flavorScroll) {
                const flavorHeader = flavorScroll.querySelector("[data-flavor-header]");

                // 1. Entrada del eyebrow.
                if (flavorHeader && !isReduce) {
                    gsap.from(flavorHeader, {
                        y: 30,
                        autoAlpha: 0,
                        duration: 0.8,
                        ease: "power3.out",
                        scrollTrigger: {
                            trigger: flavorScroll,
                            start: "top 75%",
                            toggleActions: "play none none reverse",
                        },
                    });
                }

                // 2. Body color → crema SPYLT al entrar. Disparado por el pin
                // de EaseOfUse (no por flavorScroll directo) para que el body
                // ya esté cream cuando el pin libera y NO haya flash blanco
                // entre el pin spacer y el flavorScroll real. Trigger
                // anclado al [data-ease-of-use] con start "bottom 80%" =
                // cuando el bottom de EaseOfUse cruza el 80% del viewport
                // (el pin está terminando), pintamos cream. Si EaseOfUse no
                // está en la página, fallback al flavorScroll directo.
                const easeOfUse = document.querySelector("[data-ease-of-use]");
                const transitionTrigger = easeOfUse || flavorScroll;
                const transitionStart = easeOfUse ? "bottom 80%" : "top 20%";

                ScrollTrigger.create({
                    trigger: transitionTrigger,
                    start: transitionStart,
                    onEnter: () => {
                        gsap.to(document.body, {
                            backgroundColor: "#faf5ed",
                            duration: 0.8,
                            ease: "power2.inOut",
                            overwrite: true,
                        });
                    },
                    onEnterBack: () => {
                        gsap.to(document.body, {
                            backgroundColor: "#faf5ed",
                            duration: 0.8,
                            ease: "power2.inOut",
                            overwrite: true,
                        });
                    },
                });

                // 3. FLAVOR SPLIT cycling estilo Spylt — UNA card visible a
                // la vez, intercambiándose con auto-play + arrows + steps.
                const stage = flavorScroll.querySelector("[data-flavor-stage]");
                const bigs = stage ? Array.from(stage.querySelectorAll("[data-flavor-big]")) : [];
                const names = Array.from(flavorScroll.querySelectorAll("[data-flavor-name]"));
                const stepBtns = Array.from(flavorScroll.querySelectorAll("[data-progress-step]"));
                const prevBtn = flavorScroll.querySelector("[data-flavor-prev]");
                const nextBtn = flavorScroll.querySelector("[data-flavor-next]");
                const splitTitle = flavorScroll.querySelector("[data-flavor-title]");

                // Entrada del title con stagger por palabras.
                if (splitTitle && !isReduce) {
                    const titleSpans = Array.from(splitTitle.children);
                    gsap.from(titleSpans, {
                        y: 40,
                        autoAlpha: 0,
                        duration: 0.9,
                        stagger: 0.06,
                        ease: "expo.out",
                        scrollTrigger: {
                            trigger: flavorScroll,
                            start: "top 70%",
                            toggleActions: "play none none reverse",
                        },
                    });
                }

                if (bigs.length && !isReduce) {
                    let activeIndex = 0;
                    let autoTween = null;
                    const total = bigs.length;
                    const listeners = [];

                    // gsap-performance skill: pre-set inicial de cada panel.
                    bigs.forEach((b, i) => {
                        if (i === 0) {
                            gsap.set(b, { autoAlpha: 1, yPercent: 0, scale: 1 });
                        } else {
                            gsap.set(b, { autoAlpha: 0, yPercent: 8, scale: 0.96 });
                        }
                    });
                    names.forEach((n, i) => {
                        gsap.set(n, i === 0
                            ? { autoAlpha: 1, y: 0 }
                            : { autoAlpha: 0, y: 14 }
                        );
                    });

                    // gsap-timeline skill: timeline reusable para cada
                    // transición. Lo creamos por demanda y lo killeamos al
                    // saltar a otro index (overwrite).
                    const goTo = (nextIndex) => {
                        const idx = ((nextIndex % total) + total) % total;
                        if (idx === activeIndex) return;

                        const out = bigs[activeIndex];
                        const incoming = bigs[idx];

                        // Sincronizamos clases is-active (cards, names, steps).
                        bigs.forEach((b, i) => b.classList.toggle("is-active", i === idx));
                        names.forEach((n, i) => n.classList.toggle("is-active", i === idx));
                        stepBtns.forEach((s, i) => s.classList.toggle("is-active", i === idx));

                        // Animar el name out/in para que esté sincronizado
                        // exacto con la card y NO se pisen visualmente.
                        const nameOut = names[activeIndex];
                        const nameIn = names[idx];
                        if (nameOut) {
                            gsap.to(nameOut, {
                                autoAlpha: 0, y: -10,
                                duration: 0.35, ease: "power2.in",
                            });
                        }
                        if (nameIn) {
                            gsap.fromTo(nameIn,
                                { autoAlpha: 0, y: 18 },
                                { autoAlpha: 1, y: 0, duration: 0.5, ease: "back.out(1.6)", delay: 0.2 }
                            );
                        }

                        const tl = gsap.timeline({ defaults: { ease: "back.out(1.5)" } });
                        // Out: shrink hacia adentro con anticipation.
                        tl.to(out, {
                            autoAlpha: 0,
                            yPercent: -8,
                            scale: 0.85,
                            rotation: -3,
                            duration: 0.5,
                            ease: "power3.in",
                        }, 0)
                        // In: pop con back.out + leve rotation reset.
                          .fromTo(incoming,
                            { autoAlpha: 0, yPercent: 14, scale: 0.7, rotation: 4 },
                            { autoAlpha: 1, yPercent: 0, scale: 1, rotation: 0, duration: 0.95, ease: "back.out(1.7)" },
                            0.15
                          );

                        // Stagger interno del card entrante: imagen + name +
                        // num + etapa con un pequeño rebote.
                        const card = incoming.querySelector(".flavor-big__card");
                        const img = incoming.querySelector(".flavor-big__img");
                        const name = incoming.querySelector(".flavor-big__name");
                        const num = incoming.querySelector(".flavor-big__num");
                        if (img) tl.fromTo(img,
                            { yPercent: 18, autoAlpha: 0, rotation: -3 },
                            { yPercent: 0, autoAlpha: 1, rotation: 0, duration: 0.7, ease: "back.out(1.4)" },
                            0.25
                        );
                        if (num) tl.fromTo(num,
                            { autoAlpha: 0, scale: 0.6 },
                            { autoAlpha: 1, scale: 1, duration: 0.6 },
                            0.3
                        );
                        if (name) tl.fromTo(name,
                            { yPercent: 50, autoAlpha: 0 },
                            { yPercent: 0, autoAlpha: 1, duration: 0.5 },
                            0.4
                        );

                        activeIndex = idx;
                    };

                    // Auto-cycling cada 4s — pausable al hover.
                    const startAuto = () => {
                        if (autoTween) autoTween.kill();
                        autoTween = gsap.delayedCall(4, () => {
                            goTo(activeIndex + 1);
                            startAuto();
                        });
                    };
                    const stopAuto = () => {
                        if (autoTween) autoTween.kill();
                        autoTween = null;
                    };

                    // Arrancamos cuando el componente entra al viewport.
                    ScrollTrigger.create({
                        trigger: flavorScroll,
                        start: "top 70%",
                        end: "bottom top",
                        onEnter: startAuto,
                        onEnterBack: startAuto,
                        onLeave: stopAuto,
                        onLeaveBack: stopAuto,
                    });

                    // Hover sobre el stage pausa el auto-cycling.
                    if (stage) {
                        const onEnter = () => stopAuto();
                        const onLeave = () => startAuto();
                        stage.addEventListener("mouseenter", onEnter);
                        stage.addEventListener("mouseleave", onLeave);
                        listeners.push(
                            { el: stage, type: "mouseenter", fn: onEnter },
                            { el: stage, type: "mouseleave", fn: onLeave }
                        );
                    }

                    // Prev / next arrows.
                    if (prevBtn) {
                        const fn = () => { goTo(activeIndex - 1); stopAuto(); startAuto(); };
                        prevBtn.addEventListener("click", fn);
                        listeners.push({ el: prevBtn, type: "click", fn });
                    }
                    if (nextBtn) {
                        const fn = () => { goTo(activeIndex + 1); stopAuto(); startAuto(); };
                        nextBtn.addEventListener("click", fn);
                        listeners.push({ el: nextBtn, type: "click", fn });
                    }

                    // Click en cada step jumpea a ese index.
                    stepBtns.forEach((btn, i) => {
                        const fn = () => { goTo(i); stopAuto(); startAuto(); };
                        btn.addEventListener("click", fn);
                        listeners.push({ el: btn, type: "click", fn });
                    });

                    flavorCleanup.push(() => {
                        stopAuto();
                        listeners.forEach(({ el, type, fn }) =>
                            el.removeEventListener(type, fn)
                        );
                    });
                }
            }

            // ============================================================
            // Capítulos: split, entrada, parallax, color transition
            // ============================================================
            chapters.forEach((chapter, i) => {
                const kicker = chapter.querySelector("[data-chapter-kicker]");
                const titleEl = chapter.querySelector("[data-chapter-title]");
                const titleSpans = chapter.querySelectorAll("[data-split-title]");
                const tagline = chapter.querySelector("[data-chapter-tagline]");
                const description = chapter.querySelector(
                    "[data-chapter-description]"
                );
                const cta = chapter.querySelector("[data-chapter-cta]");
                const productMain = chapter.querySelector("[data-product-main]");
                const productSecondary = chapter.querySelector(
                    "[data-product-secondary]"
                );

                // Split manual por palabra en cada span del título.
                const titleChars = [];
                titleSpans.forEach((span) => {
                    const inner = splitByWords(span);
                    titleChars.push(...inner);
                });

                const taglineLine = wrapLine(tagline);

                const visualSide = chapter.dataset.visualSide || "right";
                const productInX = visualSide === "left" ? -80 : 80;
                const secondaryRot = gsap.utils.random(-20, -8, 1);
                const bgColor = chapter.dataset.bgColor || "#ffffff";

                // ---- Estado inicial ----
                gsap.set(kicker, { autoAlpha: 0, y: 20, scale: 0.7 });
                gsap.set(titleChars, { yPercent: 120, opacity: 0, scale: 0.85 });
                if (taglineLine) gsap.set(taglineLine, { yPercent: 120, opacity: 0 });
                gsap.set([description, cta], { autoAlpha: 0, y: 30 });
                gsap.set(productMain, {
                    scale: 0.6,
                    x: productInX,
                    autoAlpha: 0,
                    rotation: gsap.utils.random(-12, 12, 1),
                });
                if (productSecondary) {
                    gsap.set(productSecondary, {
                        autoAlpha: 0,
                        rotation: secondaryRot - 15,
                        scale: 0.7,
                    });
                }

                if (isReduce) {
                    gsap.set(kicker, { autoAlpha: 1, y: 0 });
                    gsap.set(titleChars, { yPercent: 0, opacity: 1 });
                    if (taglineLine) gsap.set(taglineLine, { yPercent: 0, opacity: 1 });
                    gsap.set([description, cta], { autoAlpha: 1, y: 0 });
                    gsap.set(productMain, { scale: 1, x: 0, autoAlpha: 1 });
                    if (productSecondary) {
                        gsap.set(productSecondary, {
                            autoAlpha: 1,
                            rotation: secondaryRot,
                            scale: 1,
                        });
                    }
                    return;
                }

                // ---- Entrada al viewport (toggleActions) ----
                const enterTl = gsap.timeline({
                    scrollTrigger: {
                        trigger: chapter,
                        start: "top 70%",
                        toggleActions: "play none none reverse",
                    },
                    defaults: { ease: "expo.out" },
                });

                // Burst entry: back.out + stagger desde "start" para los
                // chars del título → feel de "explosión" de cada palabra.
                enterTl
                    .to(kicker, {
                        autoAlpha: 1, y: 0, scale: 1,
                        duration: 0.7, ease: "back.out(1.6)",
                    }, 0)
                    .to(
                        titleChars,
                        {
                            yPercent: 0,
                            opacity: 1,
                            scale: 1,
                            duration: 1,
                            ease: "back.out(1.5)",
                            stagger: { amount: 0.5, from: "start" },
                        },
                        0.15
                    )
                    .to(
                        productMain,
                        {
                            scale: 1,
                            x: 0,
                            autoAlpha: 1,
                            rotation: 0,
                            duration: 1.4,
                            ease: "back.out(1.4)",
                        },
                        0.2
                    );

                if (taglineLine) {
                    enterTl.to(
                        taglineLine,
                        { yPercent: 0, opacity: 1, duration: 0.8 },
                        0.6
                    );
                }

                enterTl
                    .to(
                        [description, cta],
                        {
                            autoAlpha: 1,
                            y: 0,
                            duration: 0.7,
                            stagger: 0.1,
                            ease: "back.out(1.4)",
                        },
                        0.8
                    );

                if (productSecondary) {
                    enterTl.to(
                        productSecondary,
                        {
                            autoAlpha: 1,
                            rotation: secondaryRot,
                            scale: 1,
                            duration: 1,
                            ease: "back.out(1.2)",
                        },
                        0.6
                    );
                }

                // ============================================================
                // DRIPS — gotas de líquido que cuelgan del título y caen
                // cuando el chapter entra. Idle: drip aleatorio infinito.
                // (gsap-timeline + attr animation sobre SVG nativo)
                // ============================================================
                const dripsSvg = chapter.querySelector("[data-chapter-drips]");
                if (dripsSvg && !isReduce) {
                    const stems = gsap.utils.toArray("[data-drip-stem]", dripsSvg);
                    const drops = gsap.utils.toArray("[data-drip]", dripsSvg);

                    // Reveal de stems con la entrada del chapter (los stems
                    // crecen desde 0 → ry final, simulando el goteo formándose)
                    enterTl.fromTo(stems,
                        { attr: { ry: 0, cy: 0 } },
                        {
                            attr: () => ({
                                ry: gsap.utils.random(28, 56, 1),
                                cy: gsap.utils.random(20, 50, 1),
                            }),
                            duration: 0.9,
                            ease: "power2.out",
                            stagger: { amount: 0.4, from: "random" },
                        },
                        0.7
                    );

                    // Drops sueltos caen con stagger random
                    enterTl.fromTo(drops,
                        { attr: { r: 0, cy: 0 } },
                        {
                            attr: () => ({
                                r:  gsap.utils.random(6, 12, 1),
                                cy: gsap.utils.random(80, 180, 1),
                            }),
                            duration: 1.1,
                            ease: "liquid",
                            stagger: { amount: 0.5, from: "random" },
                        },
                        1.0
                    );

                    // Idle: cada drop hace un loop random de fade in/out
                    // (el liquid sigue dripping mientras el chapter está activo)
                    drops.forEach((d, i) => {
                        gsap.to(d, {
                            attr: () => ({
                                cy: gsap.utils.random(120, 220, 1),
                                r: gsap.utils.random(4, 10, 1),
                            }),
                            duration: gsap.utils.random(2.4, 4),
                            ease: "sine.inOut",
                            yoyo: true,
                            repeat: -1,
                            delay: gsap.utils.random(1.5, 3),
                        });
                    });
                }

                // ============================================================
                // CLONER ADN — doble hélice que se "construye" con DrawSVG
                // cuando el chapter entra. Strands primero, luego rungs y bases.
                // ============================================================
                const dnaStrands = chapter.querySelectorAll("[data-orn-dna-strand]");
                const dnaRungs   = chapter.querySelectorAll("[data-orn-dna-rung]");
                const dnaBases   = chapter.querySelectorAll("[data-orn-dna-base]");

                if (dnaStrands.length && !isReduce) {
                    // Estado inicial
                    gsap.set(dnaStrands, { drawSVG: "0% 0%" });
                    gsap.set(dnaRungs, { scaleX: 0, transformOrigin: "50% 50%", autoAlpha: 0 });
                    gsap.set(dnaBases, { scale: 0, autoAlpha: 0, transformOrigin: "50% 50%" });

                    const dnaTl = gsap.timeline({
                        scrollTrigger: {
                            id: `chapter-dna-${chapter.dataset.chapter || ""}`,
                            trigger: chapter,
                            start: "top 75%",
                            end: "bottom 20%",
                            scrub: 1,
                            invalidateOnRefresh: true,
                        },
                    });

                    // Hélices se dibujan en paralelo
                    dnaTl.to(dnaStrands, {
                        drawSVG: "0% 100%",
                        duration: 1,
                        ease: "none",
                    }, 0);

                    // Rungs y bases aparecen escalonadas mientras se dibujan
                    dnaTl.to(dnaRungs, {
                        scaleX: 1,
                        autoAlpha: 1,
                        duration: 1,
                        ease: "none",
                        stagger: { amount: 0.9, from: "start" },
                    }, 0.05);
                    dnaTl.to(dnaBases, {
                        scale: 1,
                        autoAlpha: 1,
                        duration: 0.8,
                        ease: "none",
                        stagger: { amount: 0.9, from: "start" },
                    }, 0.1);
                } else if (dnaStrands.length && isReduce) {
                    gsap.set(dnaStrands, { drawSVG: "0% 100%" });
                    gsap.set(dnaRungs, { scaleX: 1, autoAlpha: 1 });
                    gsap.set(dnaBases, { scale: 1, autoAlpha: 1 });
                }

                // ---- Float loop del producto main (desktop/tablet) ----
                if (!isMobile) {
                    gsap.to(productMain, {
                        y: "+=10",
                        duration: 4,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1,
                    });
                }

                // ---- Scroll-driven parallax (desktop/tablet) ----
                if (!isMobile) {
                    const parallaxTl = gsap.timeline({
                        scrollTrigger: {
                            trigger: chapter,
                            start: "top bottom",
                            end: "bottom top",
                            scrub: 1,
                        },
                    });

                    parallaxTl
                        .fromTo(
                            productMain,
                            { y: 50 },
                            { y: -50, ease: "none" },
                            0
                        )
                        .fromTo(
                            titleEl,
                            { y: -30 },
                            { y: 30, ease: "none" },
                            0
                        );
                }

                // ---- Body color transition al entrar capítulo ----
                // start "top 20%": el color body cambia cuando el chapter ya
                // domina visualmente. Evita gaps tipo "pantalla lavanda vacía"
                // donde el body se pintaba con el color del chapter siguiente
                // mientras el chapter actual todavía no había entrado.
                ScrollTrigger.create({
                    trigger: chapter,
                    start: "top 20%",
                    onEnter: () => {
                        gsap.to(document.body, {
                            backgroundColor: bgColor,
                            duration: 0.8,
                            ease: "power2.inOut",
                            overwrite: true,
                        });
                    },
                    onEnterBack: () => {
                        gsap.to(document.body, {
                            backgroundColor: bgColor,
                            duration: 0.8,
                            ease: "power2.inOut",
                            overwrite: true,
                        });
                    },
                });

                // ============================================================
                // VIDEO REVEAL — clip-path scrub + autoplay + parallax + glow
                // (sólo si el chapter tiene video)
                // ============================================================
                const videoFrame = chapter.querySelector("[data-chapter-video-frame]");
                const videoEl = chapter.querySelector("[data-chapter-video]");
                const videoGlow = chapter.querySelector(".chapter__video-glow");

                const videoSats = chapter.querySelectorAll("[data-video-sat]");

                if (videoFrame && videoEl && !isReduce) {
                    // Estado inicial: frame cerrado + satélites invisibles.
                    gsap.set(videoFrame, {
                        clipPath: "inset(0% 50% 0% 50% round 32px)",
                        scale: 0.92,
                        rotation: -6,
                    });
                    gsap.set(videoGlow, { autoAlpha: 0, scale: 0.7 });
                    if (videoSats.length) {
                        gsap.set(videoSats, {
                            scale: 0,
                            autoAlpha: 0,
                            rotation: () => gsap.utils.random(-30, 30, 1),
                        });
                    }

                    // Reveal scrub: el clip se abre + scale up + rotation
                    // de -6° a 0° mientras entra al viewport.
                    const revealTl = gsap.timeline({
                        scrollTrigger: {
                            id: `video-reveal-${chapter.dataset.chapter || ""}`,
                            trigger: chapter,
                            start: "top 75%",
                            end: "top 25%",
                            scrub: 0.8,
                            invalidateOnRefresh: true,
                        },
                    });

                    revealTl
                        .to(videoFrame, {
                            clipPath: "inset(0% 0% 0% 0% round 32px)",
                            scale: 1,
                            rotation: 0,
                            ease: "power3.out",
                            duration: 1,
                        }, 0)
                        .to(videoGlow, {
                            autoAlpha: 1,
                            scale: 1,
                            ease: "power2.out",
                            duration: 1,
                        }, 0);

                    // Rotation continuo con scroll: el frame entero gira
                    // de 0° a -10° mientras scrolleás todo el chapter →
                    // feel de "el video acompaña el scroll".
                    gsap.to(videoFrame, {
                        rotation: -10,
                        ease: "none",
                        scrollTrigger: {
                            id: `video-spin-${chapter.dataset.chapter || ""}`,
                            trigger: chapter,
                            start: "top top",
                            end: "bottom top",
                            scrub: 1,
                        },
                    });

                    // Parallax interno del video.
                    gsap.fromTo(videoEl,
                        { yPercent: -6, scale: 1.1 },
                        {
                            yPercent: 6,
                            scale: 1.05,
                            ease: "none",
                            scrollTrigger: {
                                trigger: chapter,
                                start: "top bottom",
                                end: "bottom top",
                                scrub: 0.6,
                            },
                        }
                    );

                    // Glow pulse infinito.
                    gsap.to(videoGlow, {
                        scale: 1.08,
                        duration: 4,
                        ease: "sine.inOut",
                        yoyo: true,
                        repeat: -1,
                    });

                    // Satellites: pop in con back.out + stagger from
                    // "random" cuando el chapter entra al viewport.
                    if (videoSats.length) {
                        gsap.to(videoSats, {
                            scale: 1,
                            autoAlpha: 1,
                            rotation: 0,
                            duration: 0.9,
                            ease: "back.out(2.2)",
                            stagger: { amount: 0.5, from: "random" },
                            scrollTrigger: {
                                trigger: chapter,
                                start: "top 70%",
                                toggleActions: "play none none reverse",
                            },
                        });

                        // Idle float + halo pulse — cada uno con duración
                        // random asíncrona para que NUNCA se sincronicen.
                        videoSats.forEach((sat, i) => {
                            gsap.to(sat, {
                                y: gsap.utils.random(-10, 10, 1),
                                rotation: gsap.utils.random(-6, 6, 1),
                                duration: gsap.utils.random(3, 5),
                                ease: "sine.inOut",
                                yoyo: true,
                                repeat: -1,
                                delay: i * 0.3 + gsap.utils.random(0, 0.8),
                            });
                            const halo = sat.querySelector(".video-sat__halo");
                            if (halo) {
                                gsap.to(halo, {
                                    scale: 1.15,
                                    opacity: 0.95,
                                    duration: gsap.utils.random(2, 3.5),
                                    ease: "sine.inOut",
                                    yoyo: true,
                                    repeat: -1,
                                    delay: i * 0.4,
                                });
                            }
                        });
                    }

                    // Autoplay condicionado al viewport.
                    ScrollTrigger.create({
                        trigger: chapter,
                        start: "top 70%",
                        end: "bottom 30%",
                        onEnter: () => videoEl.play().catch(() => {}),
                        onEnterBack: () => videoEl.play().catch(() => {}),
                        onLeave: () => videoEl.pause(),
                        onLeaveBack: () => videoEl.pause(),
                    });
                } else if (videoFrame && videoEl && isReduce) {
                    gsap.set(videoFrame, { clipPath: "inset(0% 0% 0% 0% round 32px)", scale: 1, rotation: 0 });
                    gsap.set(videoGlow, { autoAlpha: 1, scale: 1 });
                    if (videoSats.length) gsap.set(videoSats, { scale: 1, autoAlpha: 1, rotation: 0 });
                }
            });

            // ============================================================
            // HumanSupport — body color → cream cuando entra (rompe la
            // continuidad del color del último chapter, day-0 amarillo).
            // ============================================================
            const humanSupport = document.querySelector("[data-human-support]");
            if (humanSupport) {
                ScrollTrigger.create({
                    trigger: humanSupport,
                    start: "top 20%",
                    onEnter: () => {
                        gsap.to(document.body, {
                            backgroundColor: "#faf5ed",
                            duration: 0.8,
                            ease: "power2.inOut",
                            overwrite: true,
                        });
                    },
                    onEnterBack: () => {
                        gsap.to(document.body, {
                            backgroundColor: "#faf5ed",
                            duration: 0.8,
                            ease: "power2.inOut",
                            overwrite: true,
                        });
                    },
                });
            }

            // ============================================================
            // FinalCTA — entry + cursor light toggle
            // ============================================================
            if (finalCTA) {
                const finalTitle = finalCTA.querySelector("[data-final-title]");
                const finalWords = finalCTA.querySelectorAll("[data-split-final]");
                const finalSub = finalCTA.querySelector("[data-final-sub]");
                const finalBtn = finalCTA.querySelector("[data-final-btn]");

                // Split palabras en char (cada palabra ya es un span, lo
                // convertimos a .word__inner para reutilizar el pattern).
                const finalChars = [];
                finalWords.forEach((w) => {
                    const inner = splitByWords(w);
                    finalChars.push(...inner);
                });

                gsap.set(finalChars, { yPercent: 120, opacity: 0, scale: 0.8 });
                gsap.set([finalSub, finalBtn], { autoAlpha: 0, y: 30, scale: 0.85 });

                if (isReduce) {
                    gsap.set(finalChars, { yPercent: 0, opacity: 1, scale: 1 });
                    gsap.set([finalSub, finalBtn], { autoAlpha: 1, y: 0, scale: 1 });
                } else {
                    const finalTl = gsap.timeline({
                        scrollTrigger: {
                            trigger: finalCTA,
                            start: "top 65%",
                            toggleActions: "play none none reverse",
                        },
                        defaults: { ease: "back.out(1.6)" },
                    });

                    finalTl
                        .to(finalChars, {
                            yPercent: 0,
                            opacity: 1,
                            scale: 1,
                            duration: 1,
                            stagger: { amount: 0.5, from: "center" },
                        })
                        .to(
                            [finalSub, finalBtn],
                            {
                                autoAlpha: 1,
                                y: 0,
                                scale: 1,
                                duration: 0.7,
                                stagger: 0.12,
                                ease: "back.out(2)",
                            },
                            "-=0.4"
                        );
                }

                // Cursor claro mientras FinalCTA está en viewport.
                ScrollTrigger.create({
                    trigger: finalCTA,
                    start: "top 50%",
                    end: "bottom 50%",
                    onEnter: () =>
                        document.documentElement.classList.add("cursor-on-dark"),
                    onLeave: () =>
                        document.documentElement.classList.remove("cursor-on-dark"),
                    onEnterBack: () =>
                        document.documentElement.classList.add("cursor-on-dark"),
                    onLeaveBack: () =>
                        document.documentElement.classList.remove("cursor-on-dark"),
                });

                // Color del body cuando llegamos al final: negro. start "top 20%"
                // para matchear el momento en que FinalCTA domina el viewport.
                ScrollTrigger.create({
                    trigger: finalCTA,
                    start: "top 20%",
                    onEnter: () => {
                        gsap.to(document.body, {
                            backgroundColor: "#000000",
                            duration: 0.8,
                            ease: "power2.inOut",
                            overwrite: true,
                        });
                    },
                    onLeaveBack: () => {
                        // Al scrollear hacia arriba, el capítulo Day-0
                        // re-disparará su propio onEnterBack con su color.
                    },
                });
            }

            // ============================================================
            // Refresh cuando termine el loader (layout ya estable) +
            // al cargar imágenes (load event).
            // ============================================================
            const refresh = () => ScrollTrigger.refresh();

            if (document.documentElement.classList.contains("is-loaded")) {
                refresh();
            } else {
                const observer = new MutationObserver(() => {
                    if (
                        document.documentElement.classList.contains("is-loaded")
                    ) {
                        observer.disconnect();
                        refresh();
                    }
                });
                observer.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ["class"],
                });
            }

            if (document.readyState === "complete") {
                refresh();
            } else {
                window.addEventListener("load", refresh, { once: true });
            }

            // Cleanup del matchMedia: GSAP revierte tweens/ScrollTriggers
            // automáticamente, pero los event listeners DOM manuales (hover
            // del marquee + mousemove de cards) hay que removerlos a mano.
            return () => {
                flavorCleanup.forEach((fn) => fn());
            };
        }
    );
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStory);
} else {
    initStory();
}
