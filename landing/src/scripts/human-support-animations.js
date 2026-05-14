/* =====================================================================
   HOLISTIC — human-support-animations.js (v3 CINEMATOGRÁFICO)
   Rediseño explosivo (14/05/2026 turno 4): traer la dramaturgia del
   VideoHero al HumanSupport. Master timeline con labels secuenciales,
   SplitText con stagger explosivo, partículas drifting, runner verde
   scrub, ignite por milestone, CTA scale-in, tendril drawSVG.

   Beat sheet (master timeline, scroll-trigger toggleActions):
     0      → frame      : top band L/R aparecen + bottom HUD
     0.25   → kicker     : kicker numérico + línea horizontal
     0.5    → display    : "ASESORAMIENTO" chars desde abajo (rotateX)
     0.95   → em         : "SIN CARGO" chars + reglas L/R abren
     1.4    → claim      : 3 líneas del claim stagger
     1.85   → cta        : botón scale-in con back.out
     idle   → particles drifting CSS-less (controlado JS)
     scroll → rail fill + runner + ignite milestones (sub-trigger)
     scroll → tendril drawSVG (sub-trigger en el CTA)

   Skills aplicadas:
     • gsap-timeline                → master tl + labels + position param
     • gsap-plugins SplitText       → display chars con mask
     • gsap-plugins CustomEase      → 'hs-explode' overshoot
     • gsap-scrolltrigger           → enter triggers + scrub del runner
     • gsap-utils.toArray, random   → partículas + naturalismo
     • gsap-core matchMedia         → reduce-motion + breakpoints
     • gsap-performance             → transforms only, will-change scoped

   Recovery: si SplitText falla, animamos los words como bloques. Si
   CustomEase falla, fallback a back.out(2.6). Si JS no corre, el CSS
   muestra el estado final (sin animación pero todo visible).
   ===================================================================== */

// registerGsap.js ya registra ScrollTrigger + SplitText + CustomEase y
// define el ease "explode" (overshoot 3-act). Lo reusamos para los chars
// del display — feel "burst" sincronizado con el resto del site.
import {
    gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText,
} from "./lib/registerGsap.js";

function initHumanSupport() {
    const root = document.querySelector("[data-human-support]");
    if (!root) return;

    // ========== Refs ==========
    const bandL       = root.querySelector("[data-hs-band-l]");
    const bandR       = root.querySelector("[data-hs-band-r]");
    const bandBL      = root.querySelector("[data-hs-band-bl]");
    const bandBR      = root.querySelector("[data-hs-band-br]");
    const kicker      = root.querySelector("[data-hs-kicker]");
    const display     = root.querySelector("[data-hs-display]");
    const words       = Array.from(root.querySelectorAll("[data-hs-word]"));
    const rules       = Array.from(root.querySelectorAll("[data-hs-rule]"));
    const claimLines  = Array.from(root.querySelectorAll(".hs__claim-line"));
    const cta         = root.querySelector("[data-hs-cta]");
    const milestones  = Array.from(root.querySelectorAll("[data-hs-milestone]"));
    const railFill    = root.querySelector("[data-hs-rail-fill]");
    const runner      = root.querySelector("[data-hs-runner]");
    const runnerTrail = root.querySelector("[data-hs-runner-trail]");
    const particles   = gsap.utils.toArray("[data-hs-particle]");
    const tendrilPath = root.querySelector("[data-human-cta-tendril-path]");
    const tendrilTip  = root.querySelector("[data-human-cta-tendril-tip]");

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion } = ctx.conditions;

        // ========== SplitText: chars de cada word del display ==========
        const splits = [];
        const allChars = [];
        words.forEach((w) => {
            try {
                const sp = SplitText.create(w, {
                    type: "chars",
                    charsClass: "hs-char",
                    aria: "auto",
                });
                splits.push(sp);
                allChars.push(...sp.chars);
            } catch (_) {
                // SplitText falló — animamos el word entero como char-único
                allChars.push(w);
            }
        });

        // ========== Estados iniciales ==========
        gsap.set(bandL,   { autoAlpha: 0, x: -28 });
        gsap.set(bandR,   { autoAlpha: 0, x:  28 });
        gsap.set(bandBL,  { autoAlpha: 0, y:  16 });
        gsap.set(bandBR,  { autoAlpha: 0, y:  16 });
        gsap.set(kicker,  { autoAlpha: 0, y:  18 });
        gsap.set(allChars,{ yPercent: 130, rotationX: -55, autoAlpha: 0, transformOrigin: "50% 100%" });
        gsap.set(rules,   { scaleX: 0, autoAlpha: 0, transformOrigin: "50% 50%" });
        gsap.set(claimLines, { autoAlpha: 0, y: 26 });
        gsap.set(cta,     { autoAlpha: 0, scale: 0.5, y: 30 });
        gsap.set(milestones, { autoAlpha: 0, y: 24 });
        milestones.forEach((m) => {
            const inner = m.querySelector(".hs-milestone__node-inner");
            if (inner) gsap.set(inner, { scale: 0, autoAlpha: 0 });
        });
        gsap.set(railFill,    { scaleX: 0, transformOrigin: "0% 50%" });
        gsap.set(particles,   { autoAlpha: 0, scale: 0.4, x: 0, y: 0 });

        if (reduceMotion) {
            gsap.set([bandL, bandR, bandBL, bandBR, kicker, ...claimLines, cta, ...milestones],
                { autoAlpha: 1, x: 0, y: 0, scale: 1 });
            gsap.set(allChars, { yPercent: 0, rotationX: 0, autoAlpha: 1 });
            gsap.set(rules, { scaleX: 1, autoAlpha: 1 });
            gsap.set(railFill, { scaleX: 1 });
            gsap.set(particles, { autoAlpha: 0.7, scale: 1 });
            milestones.forEach((m) => {
                const inner = m.querySelector(".hs-milestone__node-inner");
                if (inner) gsap.set(inner, { scale: 1, autoAlpha: 1 });
            });
            return () => splits.forEach((s) => s.revert());
        }

        // ========== MASTER TIMELINE — entrance ==========
        const master = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: {
                id: "hs-master",
                trigger: root,
                start: "top 78%",
                toggleActions: "play none none reverse",
            },
        });

        master
            // 0 — frame: bands aparecen
            .addLabel("frame", 0)
            .to([bandL, bandR], { autoAlpha: 1, x: 0, duration: 0.7 }, "frame")
            .to([bandBL, bandBR], { autoAlpha: 1, y: 0, duration: 0.7 }, "frame+=0.1")

            // 0.25 — kicker
            .addLabel("kicker", 0.25)
            .to(kicker, { autoAlpha: 1, y: 0, duration: 0.65 }, "kicker")

            // 0.5 — display: chars del primer word ("ASESORAMIENTO") burst
            .addLabel("display", 0.5)
            .to(splits[0]?.chars || [words[0]], {
                yPercent: 0, rotationX: 0, autoAlpha: 1,
                duration: 1.05,
                stagger: { amount: 0.55, from: "start" },
                ease: "explode",
            }, "display")

            // 0.95 — em: reglas L/R abren + chars del segundo word
            .addLabel("em", 0.95)
            .to(rules, {
                scaleX: 1, autoAlpha: 1,
                duration: 0.75, ease: "expo.out",
                stagger: 0.06,
            }, "em")
            .to(splits[1]?.chars || [words[1]], {
                yPercent: 0, rotationX: 0, autoAlpha: 1,
                duration: 0.95,
                stagger: { amount: 0.45, from: "center" },
                ease: "explode",
            }, "em+=0.1")

            // 1.4 — claim 3 líneas
            .addLabel("claim", 1.4)
            .to(claimLines, {
                autoAlpha: 1, y: 0,
                duration: 0.75,
                stagger: 0.12,
                ease: "back.out(1.4)",
            }, "claim")

            // 1.85 — CTA scale-in con back.out fuerte
            .addLabel("cta", 1.85)
            .to(cta, {
                autoAlpha: 1, scale: 1, y: 0,
                duration: 0.95, ease: "back.out(2.4)",
            }, "cta");

        // ========== PARTICLES drifting — independientes del scroll ==========
        // Cada partícula tiene posición inicial random, se hace fade-in
        // escalonada, y empieza un loop de drift vertical + sway
        // horizontal con duración random. CSS-less control = más
        // performance que keyframes (GSAP tween, transforms only).
        const W = root.clientWidth;
        const H = root.clientHeight;
        particles.forEach((p, i) => {
            const startX = gsap.utils.random(0, W);
            const startY = gsap.utils.random(H * 0.2, H * 1.05);
            gsap.set(p, {
                x: startX, y: startY,
                scale: gsap.utils.random(0.55, 1.2),
            });
            gsap.to(p, {
                autoAlpha: gsap.utils.random(0.45, 0.85),
                duration: 1.4,
                delay: 1.0 + i * 0.025,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: root,
                    start: "top 90%",
                    toggleActions: "play none none reverse",
                },
            });
            // Drift vertical loop infinito
            const driftDur = gsap.utils.random(11, 18);
            const swayAmp  = gsap.utils.random(28, 70);
            gsap.to(p, {
                y: -H * 0.15,           // sube suavemente
                x: `+=${gsap.utils.random(-swayAmp, swayAmp)}`,
                duration: driftDur,
                ease: "none",
                repeat: -1,
                delay: i * 0.08,
                modifiers: {
                    // wrap-around: cuando la partícula sale por arriba,
                    // re-entra por abajo en x random
                    y: gsap.utils.unitize((y) => {
                        const n = parseFloat(y);
                        return n < -50 ? H + 30 : n;
                    }),
                },
            });
            // Pulse de opacidad + scale (pseudo-flicker orgánico)
            gsap.to(p, {
                scale: `+=${gsap.utils.random(-0.2, 0.3)}`,
                duration: gsap.utils.random(2.4, 4.2),
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut",
                delay: i * 0.05,
            });
        });

        // ========== RAIL scrub: fill + runner + ignite milestones ==========
        // El runner verde "enciende" cada milestone al pasar por encima.
        const total = milestones.length || 1;
        const igniteThresholds = milestones.map((_, i) => (i + 0.5) / total);
        const ignited = milestones.map(() => false);

        const railTl = gsap.timeline({
            scrollTrigger: {
                id: "hs-rail",
                trigger: root.querySelector("[data-hs-timeline]"),
                start: "top 75%",
                end: "bottom 60%",
                scrub: 0.6,
                onUpdate: (self) => {
                    const p = self.progress;
                    igniteThresholds.forEach((t, i) => {
                        if (!ignited[i] && p >= t) {
                            ignited[i] = true;
                            igniteMilestone(milestones[i]);
                        }
                        if (ignited[i] && p < t - 0.05) {
                            ignited[i] = false;
                            const inner = milestones[i].querySelector(".hs-milestone__node-inner");
                            if (inner) gsap.to(inner, { scale: 0, autoAlpha: 0, duration: 0.2 });
                        }
                    });
                },
            },
        });
        railTl.to(railFill, { scaleX: 1, ease: "none" }, 0);
        if (runner) {
            railTl.fromTo(runner,
                { attr: { cx: 0 } },
                { attr: { cx: 1000 }, ease: "none", duration: 1 },
                0
            );
        }
        if (runnerTrail) {
            railTl.fromTo(runnerTrail,
                { attr: { cx: -30 } },
                { attr: { cx: 970 }, ease: "none", duration: 1 },
                0
            );
        }

        function igniteMilestone(m) {
            const inner = m.querySelector(".hs-milestone__node-inner");
            const tl = gsap.timeline();
            tl.to(m, {
                autoAlpha: 1, y: 0,
                duration: 0.55, ease: "back.out(1.8)",
                overwrite: true,
            }, 0);
            if (inner) {
                tl.fromTo(inner,
                    { scale: 0, autoAlpha: 0 },
                    { scale: 1, autoAlpha: 1, duration: 0.4, ease: "back.out(2.4)" },
                    0.1
                );
                tl.fromTo(inner,
                    { boxShadow: "0 0 0 0 rgba(255,255,255,0.85), 0 0 22px 0 #25d366" },
                    {
                        boxShadow: "0 0 0 16px rgba(255,255,255,0), 0 0 32px 8px #25d366",
                        duration: 0.6, ease: "power2.out",
                    }, 0.1
                );
            }
        }

        // ========== TENDRIL CTA → OrganicConnector ==========
        // Path crece scroll-linked desde el CTA hacia el bottom de la
        // sección, donde se planta en el seed del OC.
        if (tendrilPath) {
            const PATH_LEN = 480;
            gsap.set(tendrilPath, { strokeDashoffset: PATH_LEN });
            gsap.to(tendrilPath, {
                strokeDashoffset: 0,
                ease: "none",
                scrollTrigger: {
                    trigger: cta || root,
                    start: "top 75%",
                    end: "bottom 30%",
                    scrub: 0.4,
                },
            });
        }
        if (tendrilTip) {
            gsap.set(tendrilTip, { autoAlpha: 0, scale: 0 });
            gsap.to(tendrilTip, {
                autoAlpha: 1, scale: 1,
                duration: 0.45, ease: "back.out(2.2)",
                scrollTrigger: {
                    trigger: cta || root,
                    start: "bottom 55%",
                    toggleActions: "play none none reverse",
                },
            });
            gsap.to(tendrilTip, {
                scale: 1.4, duration: 1.1,
                ease: "sine.inOut", yoyo: true, repeat: -1,
                delay: 0.6,
            });
        }

        // ========== Parallax sutil del display al scroll ==========
        if (display) {
            gsap.to(display, {
                yPercent: -8,
                ease: "none",
                scrollTrigger: {
                    trigger: root,
                    start: "top top",
                    end:   "bottom top",
                    scrub: 0.8,
                },
            });
        }

        return () => {
            splits.forEach((s) => s.revert());
        };
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHumanSupport);
} else {
    initHumanSupport();
}
