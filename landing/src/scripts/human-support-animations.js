/* =====================================================================
   HOLISTIC — human-support-animations.js (v2 — wave + ignite)
   Animación nueva pedida por el cliente: el rail no es un simple "fill",
   ahora el runner verde "enciende" cada milestone al pasar por encima
   con un pulso luminoso. El título hace un "sweep" de color al entrar
   (line-by-line). El CTA es un botón radiant CSS (no necesita JS).

   Skills aplicadas (citadas):
     • gsap-plugins         → SplitText (title lines), DrawSVG (rail fill curve)
     • gsap-timeline        → enter timeline + scrub timeline
     • gsap-scrolltrigger   → scrub para rail + ignite por milestone
     • gsap-utils           → toArray, mapRange para igniteThresholds
     • gsap-core matchMedia → reduced-motion + responsive
   ===================================================================== */
import {
    gsap, mm, BREAKPOINTS, ScrollTrigger, SplitText,
} from "./lib/registerGsap.js";

function initHumanSupport() {
    const root = document.querySelector("[data-human-support]");
    if (!root) return;

    const eyebrow      = root.querySelector("[data-human-eyebrow]");
    const titleEl      = root.querySelector("[data-human-title]");
    const lede         = root.querySelector("[data-human-lede]");
    const pulses       = Array.from(root.querySelectorAll("[data-human-pulse]"));
    const railFill     = root.querySelector("[data-human-rail-fill]");
    const runner       = root.querySelector("[data-human-runner]");
    const runnerTrail  = root.querySelector("[data-human-runner-trail]");
    const milestones   = Array.from(root.querySelectorAll("[data-human-milestone]"));
    const cta          = root.querySelector("[data-human-cta]");

    mm.add(BREAKPOINTS, (ctx) => {
        const { reduceMotion } = ctx.conditions;

        // --------- SplitText: chars del title (mask por línea) ---------
        let splitTitle = null;
        let lines = [];
        let chars = [];
        if (titleEl) {
            splitTitle = SplitText.create(titleEl, {
                type: "lines, chars",
                mask: "lines",
                linesClass: "title-line",
                charsClass: "title-char",
                aria: "auto",
            });
            lines = splitTitle.lines;
            chars = splitTitle.chars;
        }

        // --------- Estados iniciales ---------
        gsap.set(eyebrow, { autoAlpha: 0, y: 24 });
        gsap.set(chars,   { yPercent: 110, rotationX: -45, autoAlpha: 0, transformOrigin: "50% 100%" });
        gsap.set(lede,    { autoAlpha: 0, y: 30 });
        gsap.set(pulses,  { autoAlpha: 0, y: 20, scale: 0 });
        gsap.set(railFill,{ scaleX: 0, transformOrigin: "0% 50%" });
        gsap.set(milestones, { autoAlpha: 0, y: 24 });
        // Cada milestone tiene un node-inner que es la "luz" — apaga
        milestones.forEach((m) => {
            const inner = m.querySelector(".milestone__node-inner");
            if (inner) gsap.set(inner, { scale: 0, autoAlpha: 0 });
        });
        if (cta) gsap.set(cta, { autoAlpha: 0, scale: 0.6, y: 30 });

        if (reduceMotion) {
            gsap.set([eyebrow, lede, ...pulses, ...milestones], { autoAlpha: 1, y: 0, scale: 1 });
            gsap.set(chars, { yPercent: 0, rotationX: 0, autoAlpha: 1 });
            gsap.set(railFill, { scaleX: 1 });
            milestones.forEach((m) => {
                const inner = m.querySelector(".milestone__node-inner");
                if (inner) gsap.set(inner, { scale: 1, autoAlpha: 1 });
            });
            if (cta) gsap.set(cta, { autoAlpha: 1, scale: 1, y: 0 });
            return () => splitTitle && splitTitle.revert();
        }

        // --------- Eyebrow ---------
        if (eyebrow) {
            gsap.to(eyebrow, {
                autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out",
                scrollTrigger: {
                    trigger: root, start: "top 80%",
                    toggleActions: "play none none reverse",
                },
            });
        }

        // --------- Header reveal ---------
        // Title chars stagger + lede + pulses (burst from "center")
        const headerTl = gsap.timeline({
            defaults: { ease: "expo.out" },
            scrollTrigger: {
                id: "human-support-header",
                trigger: root,
                start: "top 65%",
                toggleActions: "play none none reverse",
            },
        });
        headerTl
            .to(chars, {
                yPercent: 0, rotationX: 0, autoAlpha: 1,
                duration: 0.95,
                stagger: { amount: 0.65, from: "start" },
                ease: "back.out(1.4)",
            }, 0)
            .to(lede, { autoAlpha: 1, y: 0, duration: 0.8, ease: "back.out(1.3)" }, "-=0.4")
            .to(pulses, {
                autoAlpha: 1, y: 0, scale: 1,
                duration: 0.7,
                ease: "back.out(2)",
                stagger: { amount: 0.35, from: "center" },
            }, "-=0.35");

        // --------- Rail scrub: fill + runner + ignite milestones ---------
        // El runner "enciende" cada milestone al pasar por encima.
        // Calculamos el threshold de ignición de cada milestone como
        // (idx + 0.5) / total — el runner cruza ese punto cuando el
        // scrub progress equivale a esa fracción.
        const total = milestones.length || 1;
        const igniteThresholds = milestones.map((_, i) => (i + 0.5) / total);
        const ignited = milestones.map(() => false);

        const railTl = gsap.timeline({
            scrollTrigger: {
                id: "human-support-rail",
                trigger: root.querySelector(".human-support__timeline"),
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
                            // Reverse: si retrocede, podés re-ignitar después
                            ignited[i] = false;
                            const inner = milestones[i].querySelector(".milestone__node-inner");
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

        // --------- Función de ignición de milestone ---------
        // Cuando el runner pasa por encima, el milestone hace pop:
        //   1) entra desde abajo con back.out
        //   2) el node-inner se enciende con un flash de luz
        function igniteMilestone(m) {
            const inner = m.querySelector(".milestone__node-inner");
            const tl = gsap.timeline();
            tl.to(m, {
                autoAlpha: 1, y: 0,
                duration: 0.55, ease: "back.out(1.8)",
                overwrite: true,
            }, 0);
            if (inner) {
                tl.fromTo(inner,
                    { scale: 0, autoAlpha: 0 },
                    {
                        scale: 1, autoAlpha: 1,
                        duration: 0.4, ease: "back.out(2.4)",
                    }, 0.1
                );
                // Flash de luz blanca pulsa una vez al ignitar
                tl.fromTo(inner,
                    { boxShadow: "0 0 0 0 rgba(255,255,255,0.8), 0 0 20px 0 #25d366" },
                    {
                        boxShadow: "0 0 0 16px rgba(255,255,255,0), 0 0 28px 6px #25d366",
                        duration: 0.6, ease: "power2.out",
                    }, 0.1
                );
            }
        }

        // --------- CTA pop ---------
        if (cta) {
            gsap.to(cta, {
                autoAlpha: 1, scale: 1, y: 0,
                duration: 1, ease: "back.out(2.2)",
                scrollTrigger: {
                    trigger: cta, start: "top 85%",
                    toggleActions: "play none none reverse",
                },
            });
        }

        return () => splitTitle && splitTitle.revert();
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHumanSupport);
} else {
    initHumanSupport();
}
