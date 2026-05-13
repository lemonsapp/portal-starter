/* =====================================================================
   product-float-slider.js — SPYLT-style horizontal pinned slider con
   composición por capas pre-renderizadas + editorial minimal.

   Editorial: SplitText char reveal con mask + mark CustomEase 'explode'
   + mark color sync per panel + idle breath sutil. Sin ornamentos
   adicionales (asterisco, counter, partículas, glow). El peso visual
   lo lleva el slider de productos.

   Skills aplicadas:
     • gsap-plugins SplitText              → char reveal con mask
     • gsap-plugins CustomEase 'explode'   → mark entrance
     • gsap-timeline                       → choreography multi-step
     • gsap-scrolltrigger pin/scrub/snap   → horizontal slider
     • gsap-scrolltrigger containerAnim    → parallax layers
     • gsap-scrolltrigger toggleActions    → entrance editorial
     • gsap-utils.toArray, random          → naturalismo
     • gsap-core matchMedia                → reduced-motion + responsive
     • gsap-performance                    → transforms only, will-change
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText } from "./lib/registerGsap.js";

function initProductSlider() {
    const root = document.querySelector("[data-product-slider]");
    if (!root) return;

    const pinWrap   = root.querySelector("[data-psl-pin-wrap]");
    const track     = root.querySelector("[data-psl-track]");
    const panels    = gsap.utils.toArray("[data-psl-panel]", root);
    const steps     = gsap.utils.toArray("[data-psl-step]", root);
    const hudNum    = root.querySelector("[data-psl-hud-num]");
    const editorialMark    = root.querySelector("[data-psl-editorial-mark]");
    const editorialEyebrow = root.querySelector("[data-psl-editorial-eyebrow]");
    const editorialLines   = gsap.utils.toArray("[data-psl-editorial-line]", root);
    const editorialSub     = root.querySelector("[data-psl-editorial-sub]");
    const editorialDot     = root.querySelector(".psl__editorial-dot");
    const editorialEl      = root.querySelector("[data-psl-editorial]");
    const maskSvg          = root.querySelector("[data-psl-mask]");
    const maskRect         = root.querySelector("[data-psl-mask-rect]");
    const maskCover        = root.querySelector("[data-psl-mask-cover]");
    const maskGroup        = root.querySelector("[data-psl-mask-group]");
    const globalBlob       = root.querySelector("[data-psl-global-blob]");

    const total = panels.length;
    if (!total || !track || !pinWrap) return;

    // Pre-cache colors per panel para interpolación scroll-driven:
    // bgColor   → color saturado (badge/dot/CTA hover)
    // accent    → color pastel para el bg de la sección entera (legibilidad
    //             del editorial dark + match con el card del producto activo).
    // El style.getPropertyValue lee los inline styles que setea el .astro.
    const panelBgs = panels.map((p) => p.style.getPropertyValue("--psl-bg").trim() || "#f7f3ea");
    const panelAccents = panels.map((p, i) => {
        const ds = p.dataset.accent;
        return (ds && ds.trim()) || panelBgs[i];
    });
    // Interpolators precomputados — gsap.utils.interpolate(c1, c2) devuelve
    // una function(t) → color string. Fuerza muy poca; vale precomputar.
    // Necesitamos DOS sets: uno para el section bg pastel (accent) y otro
    // para el bg saturado del redondelito que también afecta mark+dot
    // (sino el badge cambia abrupt al pasar de panel a panel).
    const accentInterps = panelAccents.map((c, i) => {
        const next = panelAccents[Math.min(i + 1, total - 1)];
        return gsap.utils.interpolate(c, next);
    });
    const bgInterps = panelBgs.map((c, i) => {
        const next = panelBgs[Math.min(i + 1, total - 1)];
        return gsap.utils.interpolate(c, next);
    });

    // Ease function aplicada al segT antes de interp — suaviza el cambio
    // de fondo (no lineal entre paneles). power2.inOut da el sweet spot:
    // arranque lento, mid rápido, end lento → siente "natural".
    const segEase = gsap.parseEase("power2.inOut");
    // Set inicial del section bg al accent del primer panel.
    if (root) root.style.setProperty("--psl-section-bg", panelAccents[0]);

    mm.add({
        ...BREAKPOINTS,
        isHorizontal: "(min-width: 901px)",
        isStacked:    "(max-width: 900px)",
    }, (ctx) => {
        const { isHorizontal, isStacked, reduceMotion } = ctx.conditions;

        // ============================================================
        // 0a) CURSOR-PAINT REVEAL — texto invisible por default, blobs
        //     gooey siguen cursor revelando el texto debajo del cover.
        //     Patrón Codrops "Paint Away the Screen to Reveal Hidden Content".
        //     SVG mask con rect blanco (cover opaco) + 3 blobs negros
        //     (huecos transparentes) bajo feGaussianBlur+feColorMatrix
        //     (goo filter). Cover rect = bg color de sección.
        //     Mouseenter → blobs crecen. Mousemove → blobs lag-follow
        //     cursor con velocidades distintas (trail liquid). Mouseleave
        //     → blobs shrink → cover full → texto oculto otra vez.
        //     ResizeObserver actualiza viewBox para circles perfectos.
        //     skill: requestAnimationFrame + ResizeObserver + SVG mask
        // ============================================================
        if (editorialEl && maskSvg && maskGroup && !reduceMotion) {
            // ViewBox dinámico → coords en píxeles directos del DOM.
            // Sin esto, en aspect ratios distintos los circles se
            // verían eliptizados (preserveAspectRatio=none + viewBox fijo
            // estiraría). Esta solución da circles perfectos.
            let edW = 0, edH = 0, edDiagonal = 0;
            const updateViewBox = () => {
                const r = editorialEl.getBoundingClientRect();
                const w = Math.round(r.width);
                const h = Math.round(r.height);
                if (w > 0 && h > 0) {
                    edW = w; edH = h;
                    edDiagonal = Math.hypot(w, h);
                    maskSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
                    if (maskRect)  { maskRect.setAttribute("width", w);  maskRect.setAttribute("height", h); }
                    if (maskCover) { maskCover.setAttribute("width", w); maskCover.setAttribute("height", h); }
                    // Global blob centrado en píxeles (no %)
                    if (globalBlob) {
                        globalBlob.setAttribute("cx", w / 2);
                        globalBlob.setAttribute("cy", h / 2);
                    }
                }
            };
            updateViewBox();
            const ro = new ResizeObserver(updateViewBox);
            ro.observe(editorialEl);

            // ============================================================
            // (a) AUTO-REVEAL SCROLL-DRIVEN — global blob crece para revelar
            //     TODO el texto cuando el user llega scrolleando al pin.
            //     Trigger: pinWrap "top 90%" → "top top" (1 viewport-height
            //     de scroll). Por pin engagement el cover está full disuelto.
            // ============================================================
            if (globalBlob) {
                gsap.set(globalBlob, { attr: { r: 0 } });
                gsap.to(globalBlob, {
                    attr: { r: () => edDiagonal * 0.85 || 900 },  // diagonal/2 + buffer
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: pinWrap,
                        start: "top 90%",
                        end:   "top top",
                        scrub: 1.2,
                        invalidateOnRefresh: true,
                    },
                });
            }

            // ============================================================
            // (b) CURSOR PERSISTENT TRAIL — cada pointermove appenda un nuevo
            //     <circle> al mask. Los circles persisten para siempre →
            //     huecos revelados quedan visibles. Throttle por distancia
            //     para evitar miles de circles consecutivos.
            // ============================================================
            const SVG_NS = "http://www.w3.org/2000/svg";
            const TRAIL_RADIUS = 70;
            const MIN_DISTANCE = 28;        // skip si cursor movió <28px
            const MAX_TRAIL_BLOBS = 240;    // cap para performance/memory
            const trailBlobs = [];
            let lastTrailX = -9999, lastTrailY = -9999;

            const addTrailBlob = (cx, cy) => {
                const c = document.createElementNS(SVG_NS, "circle");
                c.setAttribute("cx", cx);
                c.setAttribute("cy", cy);
                c.setAttribute("r", "0");
                c.setAttribute("fill", "black");
                maskGroup.appendChild(c);
                trailBlobs.push(c);
                // Anim radius 0 → TRAIL_RADIUS (small grow para feel orgánico)
                gsap.to(c, {
                    attr: { r: TRAIL_RADIUS },
                    duration: 0.45,
                    ease: "power2.out",
                });
                // Cap memory: si pasa límite, remove oldest
                if (trailBlobs.length > MAX_TRAIL_BLOBS) {
                    const old = trailBlobs.shift();
                    if (old && old.parentNode) old.parentNode.removeChild(old);
                }
            };

            const onMove = (e) => {
                const r = editorialEl.getBoundingClientRect();
                const cx = e.clientX - r.left;
                const cy = e.clientY - r.top;
                const dist = Math.hypot(cx - lastTrailX, cy - lastTrailY);
                if (dist < MIN_DISTANCE) return;
                lastTrailX = cx; lastTrailY = cy;
                addTrailBlob(cx, cy);
            };

            editorialEl.addEventListener("pointermove", onMove);

            ctx.add(() => () => {
                ro.disconnect();
                editorialEl.removeEventListener("pointermove", onMove);
                // Cleanup trail blobs en re-init de mm context
                trailBlobs.forEach((b) => b.parentNode && b.parentNode.removeChild(b));
                trailBlobs.length = 0;
            });
        } else if (reduceMotion && maskSvg) {
            // reduce-motion: NO cover, texto siempre visible.
            maskSvg.style.display = "none";
        }

        // ============================================================
        // 0b) EDITORIAL ENTRANCE — simple fade-in al engancharse el pin.
        //    El "drama" del char reveal SPYLT-style ahora vive en el
        //    componente <ProductsHero /> que va ARRIBA del slider en el
        //    layout (sección dedicada de hero text). Acá el editorial
        //    sólo necesita acomodarse en su anchor izquierdo cuando la
        //    sección entra en viewport — sin char reveal redundante.
        //    Skills: gsap-scrolltrigger toggleActions + gsap-timeline.
        // ============================================================
        // SplitText preservado por compatibilidad con el char-mask CSS,
        // pero los chars se setean visible inmediatamente (no rise).
        let splitInstances = [];
        const lineInners = editorialLines
            .map((line) => line.querySelector(".psl__editorial-line-inner"))
            .filter(Boolean);

        if (lineInners.length) {
            lineInners.forEach((inner) => {
                if (inner.querySelector("mark")) return;
                const split = SplitText.create(inner, {
                    type: "chars,words",
                    aria: "auto",
                });
                splitInstances.push(split);
            });
        }

        const allChars = splitInstances.flatMap((s) => s.chars);
        const editorialRoot = root.querySelector(".psl__editorial");

        if (reduceMotion) {
            gsap.set([editorialEyebrow, editorialSub, editorialMark, ...lineInners], {
                autoAlpha: 1, y: 0,
            });
            if (allChars.length) gsap.set(allChars, { y: 0, autoAlpha: 1 });
        } else {
            // ===== CHAR ASSEMBLE SCROLL-LINKED =====
            // Patrón innovador: cada char inicia DISPERSO con offsets random
            // (x/y/rotation/scale/blur). El scroll progress del pinWrap mappea
            // a chars convergiendo a su posición final → "se arman las letras"
            // mientras el usuario scrollea hacia el slider.
            //
            // Skills:
            //   • gsap-plugins SplitText (chars)
            //   • gsap-scrolltrigger scrub (scroll-linked progress)
            //   • gsap-utils.random (per-char dispersión única)
            //   • gsap-performance (transforms only, will-change, blur filter)
            //
            // Estado inicial PER CHAR (cada uno con offset distinto):
            allChars.forEach((ch) => {
                gsap.set(ch, {
                    x: gsap.utils.random(-220, 220),
                    y: gsap.utils.random(-160, 160),
                    rotation: gsap.utils.random(-65, 65),
                    scale: gsap.utils.random(0.35, 0.9),
                    autoAlpha: 0,
                    filter: "blur(8px)",
                    transformOrigin: "50% 50%",
                    willChange: "transform, opacity, filter",
                });
            });

            // Estado inicial de chrome (eyebrow/sub/mark) — coordinado con
            // el char assemble. Mark con la rotation editorial -1.6deg
            // pero scale chico + autoAlpha 0.
            gsap.set(editorialEyebrow, { autoAlpha: 0, yPercent: 40 });
            gsap.set(editorialSub,     { autoAlpha: 0, yPercent: 30 });
            gsap.set(editorialMark, {
                scaleX: 0.92, scaleY: 0.96, rotation: -1.6,
                autoAlpha: 0, transformOrigin: "0 50%",
            });

            // Scroll-LINKED scrub timeline: el progreso del pinWrap al
            // entrar mappea a chars assembling. start "top 90%" → end
            // "top 25%" (cubre ~65% del viewport en scroll → tiempo
            // amplio para que el ensamble se sienta y no flashee).
            const assembleTl = gsap.timeline({
                scrollTrigger: {
                    trigger: pinWrap,
                    start: "top 90%",
                    end:   "top 25%",
                    scrub: 0.6,            // smooth chase del scroll
                    invalidateOnRefresh: true,
                },
            });

            // Acto 1 (0..0.20): eyebrow rises in
            assembleTl.to(editorialEyebrow, {
                autoAlpha: 1, yPercent: 0,
                ease: "power2.out", duration: 0.20,
            }, 0);

            // Acto 2 (0.10..0.85): chars ENSAMBLAN — cada uno desde su
            // posición random a la final, con stagger from "random" para
            // que se acomoden en orden caótico (no izq→der lineal).
            //   • duration grande (0.75 del scrub range) → smooth
            //   • stagger 0.02 from:random → caos organizado
            //   • ease back.out(1.6) → snap satisfactorio al landing
            assembleTl.to(allChars, {
                x: 0, y: 0, rotation: 0, scale: 1,
                autoAlpha: 1,
                filter: "blur(0px)",
                duration: 0.75,
                stagger: { each: 0.02, from: "random" },
                ease: "back.out(1.6)",
            }, 0.10);

            // Acto 3 (0.65..0.90): mark se "imprime" con explode + rotation
            // ligero — pop final que cierra el ensamble.
            assembleTl.to(editorialMark, {
                scaleX: 1, scaleY: 1, rotation: -1.6,
                autoAlpha: 1,
                duration: 0.25,
                ease: "explode",
            }, 0.65);

            // Acto 4 (0.80..1.00): sub fade-in (último, contextual)
            assembleTl.to(editorialSub, {
                autoAlpha: 1, yPercent: 0,
                duration: 0.20,
                ease: "power2.out",
            }, 0.80);

            // Idle: respiración sutil del mark POST-assemble (no afecta scrub)
            gsap.to(editorialMark, {
                scale: 1.018,
                duration: 2.8,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
            });
        }

        // Idle: respiración muy sutil del mark
        if (!reduceMotion && editorialMark) {
            gsap.to(editorialMark, {
                scale: 1.018,
                duration: 2.8,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
            });
        }

        // ============================================================
        // 1) Per-panel: idle micro-animaciones de cada capa del card
        //    Set inicial: GSAP toma el scale CSS-base del layer para que
        //    los tweens posteriores (y/rotation/scrub) compongan en lugar
        //    de clobberear. Sin esto, gsap.to({y}) borra el scale: 1.22
        //    inline del CSS.
        // ============================================================
        if (!reduceMotion) {
            panels.forEach((panel, panelIdx) => {
                const base   = panel.querySelector("[data-psl-base]");
                const hero   = panel.querySelector("[data-psl-hero]");
                const label  = panel.querySelector("[data-psl-label]");
                const wheels = gsap.utils.toArray("[data-psl-wheel]", panel);

                // Establece scale base que matchea CSS — GSAP ahora "sabe"
                // que el hero y wheels viven con scale > 1. heroScale viene
                // del data-hero-scale (declarado en panels.js per panel para
                // normalizar tamaño visible del packshot).
                const heroScale = parseFloat(panel.dataset.heroScale) || 1.22;
                if (hero) gsap.set(hero, { scale: heroScale, transformOrigin: "center 55%" });
                wheels.forEach((w) => gsap.set(w, { scale: 1.08, transformOrigin: "center" }));

                if (hero) {
                    gsap.to(hero, {
                        y:        gsap.utils.random(-10, -22, 1),
                        rotation: gsap.utils.random(-1.4, 1.4, 0.1),
                        duration: gsap.utils.random(2.6, 3.4),
                        ease:     "sine.inOut",
                        yoyo:     true,
                        repeat:   -1,
                        delay:    panelIdx * 0.12,
                    });
                }
                if (base) {
                    gsap.to(base, {
                        scale:    1.025,
                        duration: gsap.utils.random(5, 7),
                        ease:     "sine.inOut",
                        yoyo:     true,
                        repeat:   -1,
                    });
                }
                wheels.forEach((wheel, wIdx) => {
                    gsap.to(wheel, {
                        rotation: wIdx % 2 === 0 ? "+=360" : "-=360",
                        duration: gsap.utils.random(14, 22),
                        ease:     "none",
                        repeat:   -1,
                    });
                    gsap.to(wheel, {
                        x:        gsap.utils.random(-14, 14, 1),
                        y:        gsap.utils.random(-12, 12, 1),
                        duration: gsap.utils.random(2.8, 4.2),
                        ease:     "sine.inOut",
                        yoyo:     true,
                        repeat:   -1,
                        delay:    wIdx * 0.18,
                    });
                });
                if (label) {
                    gsap.fromTo(label,
                        { autoAlpha: 0.92 },
                        {
                            autoAlpha: 1,
                            duration:  gsap.utils.random(2.2, 3.4),
                            ease:      "sine.inOut",
                            yoyo:      true,
                            repeat:    -1,
                        }
                    );
                }
            });
        }

        // ============================================================
        // 2) PIN HORIZONTAL — slider con N panels
        //    skill: gsap-scrolltrigger > Horizontal scroll containerAnimation
        // ============================================================
        if (isHorizontal && !reduceMotion) {
            gsap.set(track, { width: `${total * 100}vw` });
            panels.forEach((p) => gsap.set(p, { width: "100vw" }));

            const scrollTween = gsap.to(track, {
                xPercent: -100 * (total - 1) / total,
                ease: "none",
                scrollTrigger: {
                    id: "psl-horizontal",
                    trigger: pinWrap,
                    pin: true,
                    pinSpacing: true,
                    start: "top top",
                    end: () => `+=${pinWrap.offsetWidth * (total - 1) / total + window.innerHeight * 0.5}`,
                    scrub: 0.8,
                    snap: {
                        snapTo: 1 / (total - 1),
                        duration: { min: 0.2, max: 0.6 },
                        delay: 0.05,
                        ease: "power2.inOut",
                    },
                    invalidateOnRefresh: true,
                    anticipatePin: 1,
                    onUpdate: (self) => {
                        // Posición continua dentro del rango [0..total-1]:
                        //   segIdx  → índice del panel actual (entero)
                        //   segT    → progreso 0..1 dentro del segmento (entre
                        //             panel segIdx y panel segIdx+1)
                        const segments = total - 1;
                        const segF     = self.progress * segments;
                        const segIdx   = Math.min(segments - 1, Math.max(0, Math.floor(segF)));
                        const segT     = Math.min(1, Math.max(0, segF - segIdx));
                        // idx del panel "activo" (ronda al más cercano):
                        const idx = Math.min(total - 1, Math.round(self.progress * segments));

                        if (hudNum) hudNum.textContent = String(idx + 1).padStart(2, "0");

                        steps.forEach((s, i) => {
                            const isActive = i === idx;
                            s.classList.toggle("is-active", isActive);
                            s.setAttribute("aria-selected", isActive ? "true" : "false");
                        });
                        panels.forEach((p, i) => p.classList.toggle("is-active", i === idx));

                        // ============================================
                        // Section bg: interpolación SUAVIZADA entre accent[segIdx]
                        // y accent[segIdx+1] según segT. Aplicamos easing al
                        // progreso del segmento → cross-fade no lineal,
                        // arranca y termina suave (efecto velvet).
                        // skill: gsap-utils.interpolate (color tween)
                        // ============================================
                        const easedT = segEase(segT);
                        const interp = accentInterps[segIdx];
                        if (interp && root) {
                            root.style.setProperty("--psl-section-bg", interp(easedT));
                        }

                        // Mark + dot color: interp continuo entre bgs saturados
                        // (antes saltaba abrupt al rondar idx). Usa el mismo
                        // easedT para sincronizar con el section bg.
                        const bgInterp = bgInterps[segIdx];
                        if (bgInterp) {
                            const currentBg = bgInterp(easedT);
                            if (editorialMark) editorialMark.style.background = currentBg;
                            if (editorialDot)  editorialDot.style.background  = currentBg;
                        }
                    },
                },
            });

            // Per-panel parallax con containerAnimation
            panels.forEach((panel) => {
                const card   = panel.querySelector("[data-psl-card]");
                const hero   = panel.querySelector("[data-psl-hero]");
                const label  = panel.querySelector("[data-psl-label]");
                const wheels = gsap.utils.toArray("[data-psl-wheel]", panel);

                if (card) {
                    gsap.fromTo(card,
                        { xPercent: 8, scale: 0.94, autoAlpha: 0.85 },
                        {
                            xPercent: -8, scale: 1, autoAlpha: 1, ease: "none",
                            scrollTrigger: {
                                containerAnimation: scrollTween,
                                trigger: panel,
                                start: "left right",
                                end:   "right left",
                                scrub: true,
                            },
                        }
                    );
                }
                if (hero) {
                    // Per-panel hero scale base (de panels.js heroScale)
                    const baseScale = parseFloat(panel.dataset.heroScale) || 1.22;
                    const peakScale = baseScale * 1.08;  // +8% peak al centro

                    // Movimiento horizontal contraparallax sutil
                    // skill: gsap-scrolltrigger containerAnim
                    gsap.fromTo(hero,
                        { xPercent: 18 },
                        {
                            xPercent: -18, ease: "none",
                            scrollTrigger: {
                                containerAnimation: scrollTween,
                                trigger: panel,
                                start: "left right",
                                end:   "right left",
                                scrub: true,
                            },
                        }
                    );
                    // Scale "kick" al pasar por centro del panel: escala
                    // base en bordes, peak (+8%) en centro (panel activo).
                    // Ease sine para curva suave de "respiro" del producto.
                    gsap.fromTo(hero,
                        { scale: baseScale },
                        {
                            keyframes: [
                                { scale: peakScale, ease: "sine.inOut" }, // mid-panel
                                { scale: baseScale, ease: "sine.inOut" }, // exit
                            ],
                            scrollTrigger: {
                                containerAnimation: scrollTween,
                                trigger: panel,
                                start: "left right",
                                end:   "right left",
                                scrub: true,
                            },
                        }
                    );
                }
                if (label) {
                    gsap.fromTo(label,
                        { xPercent: -30, autoAlpha: 0 },
                        {
                            xPercent: 0, autoAlpha: 1, ease: "none",
                            scrollTrigger: {
                                containerAnimation: scrollTween,
                                trigger: panel,
                                start: "left 80%",
                                end:   "left 20%",
                                scrub: true,
                            },
                        }
                    );
                }
                wheels.forEach((wheel, wIdx) => {
                    const drift = 12 + wIdx * 6;
                    gsap.fromTo(wheel,
                        { xPercent: drift },
                        {
                            xPercent: -drift, ease: "none",
                            scrollTrigger: {
                                containerAnimation: scrollTween,
                                trigger: panel,
                                start: "left right",
                                end:   "right left",
                                scrub: true,
                            },
                        }
                    );
                });
            });

            // Click en step → scroll-to ese panel
            steps.forEach((s, i) => {
                const fn = () => {
                    const st = scrollTween.scrollTrigger;
                    if (!st) return;
                    const target = st.start + (st.end - st.start) * (i / (total - 1));
                    if (window.__lenis && typeof window.__lenis.scrollTo === "function") {
                        window.__lenis.scrollTo(target, {
                            duration: 1.0,
                            easing: (t) => 1 - Math.pow(1 - t, 3),
                        });
                    } else {
                        window.scrollTo({ top: target, behavior: "smooth" });
                    }
                };
                s.addEventListener("click", fn);
                ctx.add(() => () => s.removeEventListener("click", fn));
            });

        // ============================================================
        // 3) STACKED (mobile) — sin pin, panels apilados verticalmente
        // ============================================================
        } else if (isStacked || reduceMotion) {
            gsap.set(track, { width: "100%", clearProps: "transform" });
            panels.forEach((p) => gsap.set(p, { width: "100%", clearProps: "transform" }));

            if (!reduceMotion) {
                panels.forEach((p) => {
                    const card = p.querySelector("[data-psl-card]");
                    const meta = p.querySelector(".psl__panel-meta");
                    if (!card) return;
                    gsap.from([card, meta].filter(Boolean), {
                        autoAlpha: 0, y: 50, duration: 0.9,
                        stagger: 0.12, ease: "back.out(1.3)",
                        scrollTrigger: {
                            trigger: p, start: "top 75%",
                            toggleActions: "play none none reverse",
                        },
                    });
                });
            }

            panels.forEach((p, i) => {
                ScrollTrigger.create({
                    trigger: p,
                    start: "top center",
                    end: "bottom center",
                    onToggle: (self) => {
                        if (self.isActive) {
                            if (hudNum) hudNum.textContent = String(i + 1).padStart(2, "0");
                            steps.forEach((s, k) => {
                                s.classList.toggle("is-active", k === i);
                                s.setAttribute("aria-selected", k === i ? "true" : "false");
                            });
                            // Mobile: cut-cambio del section bg al accent del panel
                            // activo (no hay scrub continuo en stacked).
                            if (root) {
                                gsap.to(root, {
                                    "--psl-section-bg": panelAccents[i],
                                    duration: 0.6,
                                    ease: "power2.out",
                                });
                            }
                            // Smooth bg fade del badge mark + dot también
                            // (en lugar de assignment directo que saltaba abrupt).
                            if (editorialMark) {
                                gsap.to(editorialMark, {
                                    background: panelBgs[i],
                                    duration: 0.6, ease: "power2.out",
                                });
                            }
                            if (editorialDot) {
                                gsap.to(editorialDot, {
                                    background: panelBgs[i],
                                    duration: 0.6, ease: "power2.out",
                                });
                            }
                        }
                    },
                });
            });

            steps.forEach((s, i) => {
                const fn = () => {
                    panels[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
                };
                s.addEventListener("click", fn);
                ctx.add(() => () => s.removeEventListener("click", fn));
            });
        }

        return () => {
            splitInstances.forEach((s) => s.revert());
        };
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProductSlider);
} else {
    initProductSlider();
}

/* ====================================================================
   SUB-PRODUCT HOVER-SWAP
   En lugar de modal, el packshot del card CAMBIA inline al hover de un
   hotspot:
     - mouseenter en hotspot → cross-fade del unificado al individual
       (sub-base + sub-hero appearen sobre el unificado).
     - mouseleave del CARD → vuelve al unificado.
     - Mover entre hotspots dentro del card → cambio directo sin reset.
     - Click ALSO funciona (keyboard/touch).
   ==================================================================== */
function initSubProductHoverSwap() {
    const cards = document.querySelectorAll("[data-psl-card]");
    if (!cards.length) return;

    const gsapLib = window.gsap || null;

    cards.forEach((card) => {
        const hotspots = card.querySelectorAll("[data-psl-hotspot]");
        if (!hotspots.length) return;

        const subBaseEl = card.querySelector("[data-psl-sub-base]");
        const subHeroEl = card.querySelector("[data-psl-sub-hero]");
        if (!subBaseEl || !subHeroEl) return;

        // Estado inicial: sub-layers invisibles
        if (gsapLib) {
            gsapLib.set([subBaseEl, subHeroEl], { autoAlpha: 0 });
        } else {
            subBaseEl.style.opacity = "0";
            subHeroEl.style.opacity = "0";
        }

        let currentSub = null;
        let pendingTimer = null;

        const showSub = (hotspot) => {
            if (pendingTimer) {
                clearTimeout(pendingTimer);
                pendingTimer = null;
            }
            const slug = hotspot.dataset.subSlug;
            if (currentSub === slug) return;
            currentSub = slug;

            const baseSrc = hotspot.dataset.subBase;
            const poteSrc = hotspot.dataset.subPote;
            const nombre  = hotspot.dataset.subNombre || "";

            // Cross-fade: si ya hay un sub visible, fade-out rápido →
            // swap src → fade-in. Sino, swap src directo + fade-in.
            const swap = () => {
                subBaseEl.src = baseSrc;
                subHeroEl.src = poteSrc;
                subHeroEl.alt = nombre;
            };

            if (gsapLib) {
                const wasVisible = parseFloat(getComputedStyle(subHeroEl).opacity) > 0.1;
                if (wasVisible) {
                    gsapLib.to([subBaseEl, subHeroEl], {
                        autoAlpha: 0,
                        duration: 0.15,
                        ease: "power2.in",
                        onComplete: () => {
                            swap();
                            gsapLib.to([subBaseEl, subHeroEl], {
                                autoAlpha: 1,
                                duration: 0.3,
                                ease: "power2.out",
                                stagger: 0.04,
                            });
                        },
                    });
                } else {
                    swap();
                    gsapLib.to([subBaseEl, subHeroEl], {
                        autoAlpha: 1,
                        duration: 0.35,
                        ease: "power2.out",
                        stagger: 0.05,
                    });
                }
            } else {
                swap();
                subBaseEl.style.opacity = "1";
                subHeroEl.style.opacity = "1";
            }
        };

        const hideSub = () => {
            currentSub = null;
            if (gsapLib) {
                gsapLib.to([subBaseEl, subHeroEl], {
                    autoAlpha: 0,
                    duration: 0.28,
                    ease: "power2.inOut",
                });
            } else {
                subBaseEl.style.opacity = "0";
                subHeroEl.style.opacity = "0";
            }
        };

        // Hotspot pointer events (hover preview).
        // El <a> nativo maneja el click → navega a panel.route#sub-slug,
        // sin que nosotros interceptemos. Permite Enter (keyboard) +
        // cmd/ctrl+click (new tab) + click normal (same tab).
        hotspots.forEach((h) => {
            // pointerenter — más reliable que mouseenter (touch + pen support)
            h.addEventListener("pointerenter", () => showSub(h));
            // focus para keyboard nav
            h.addEventListener("focus", () => showSub(h));
        });

        // Card leave → reset al unificado. pointerleave para cubrir
        // mouse/touch/pen. Pequeño delay para evitar flicker cuando
        // user mueve entre hotspots adyacentes.
        card.addEventListener("pointerleave", () => {
            pendingTimer = setTimeout(hideSub, 80);
        });
        card.addEventListener("pointerenter", () => {
            if (pendingTimer) {
                clearTimeout(pendingTimer);
                pendingTimer = null;
            }
        });
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSubProductHoverSwap);
} else {
    initSubProductHoverSwap();
}
