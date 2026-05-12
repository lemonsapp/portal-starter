/* =====================================================================
   HOLISTIC — video-hero-animations.js
   Hero principal SPYLT-style. Master timeline con defaults + labels:

     0       → "frame"      : top band L/R, bottom HUD + scroll hint
     0.3     → "kicker"     : kicker numérico + línea
     0.55    → "display"    : "HOLISTIC" chars (SplitText) + reglas em
     0.95    → "race"       : "RACE" chars + halo accent
     1.4     → "claim"      : 3 líneas del claim en stagger
     1.85    → "cta"        : botón scale-in con back.out
     2.0     → "particles"  : partículas empiezan a flotar
     idle    → ken-burns video, dot pulse, cta x liquid fill por cursor

   Skills aplicadas:
     • gsap-timeline           → defaults + labels + position parameter
     • gsap-plugins SplitText  → display chars stagger (con fallback)
     • gsap-utils.toArray/random → partículas + chars
     • gsap-core matchMedia    → reduce-motion + breakpoints
     • gsap-performance        → transforms only, will-change scoped

   Recovery: si el JS falla, el contenido sigue visible (CSS no oculta
   permanente). Si SplitText falla, animamos las líneas como bloques.
   ===================================================================== */

import { gsap, mm, BREAKPOINTS, SplitText } from "./lib/registerGsap.js";

function initVideoHero() {
    const root = document.querySelector("[data-video-hero]");
    if (!root) return;

    // ========== Refs ==========
    const video = root.querySelector("[data-video-hero-video]");
    const bandL = root.querySelector("[data-vh-band-l]");
    const bandR = root.querySelector("[data-vh-band-r]");
    const kicker = root.querySelector("[data-vh-kicker]");
    const display = root.querySelector("[data-vh-display]");
    const words = Array.from(root.querySelectorAll("[data-vh-word]"));
    const rules = Array.from(root.querySelectorAll("[data-vh-rule]"));
    const claimLines = Array.from(root.querySelectorAll(".vh__claim-line"));
    const cta = root.querySelector("[data-vh-cta]");
    const ctaFill = root.querySelector("[data-vh-cta-fill]");
    const scrollHint = root.querySelector("[data-vh-scroll]");
    const hud = root.querySelector(".vh__hud");
    const hudNum = root.querySelector("[data-vh-hud-num]");
    const hudDots = Array.from(root.querySelectorAll("[data-vh-hud-dot]"));
    const particles = gsap.utils.toArray("[data-video-hero-particle]");

    // ========== Video lifecycle ==========
    // Play una vez desde frame 0 → freeze en el último frame visible.
    //
    // Por qué `timeupdate` y no `ended`:
    //   En varios browsers el evento `ended` llega después de que el
    //   reproductor ya pausó y/o reseteó currentTime, y un seek post-pause
    //   no siempre rendea el nuevo frame. Pausamos NOSOTROS ~1 frame antes
    //   del final y seteamos currentTime a (duration - ~1 frame): el último
    //   frame queda renderizado y el reproductor nunca dispara `ended`.
    if (video) {
        const FRAME = 1 / 30;        // asumimos 30 fps source (inicio.mp4 es 30fps)
        const FREEZE_OFFSET = FRAME; // último frame visible

        let frozen = false;
        const freeze = () => {
            if (frozen) return;
            frozen = true;
            try {
                video.pause();
                if (Number.isFinite(video.duration)) {
                    video.currentTime = Math.max(0, video.duration - FREEZE_OFFSET);
                }
            } catch (_) {}
        };

        // Arranque sincronizado con el LOADER:
        // El Loader del site tapa la pantalla ~2.85s al cargar. Si el
        // video tiene `autoplay` HTML, empieza a reproducirse detrás del
        // loader → cuando el loader se va, el video ya está mid-playback
        // y el user nunca ve el frame 0. Solución: NO autoplay HTML,
        // disparamos play() al recibir `loader:done` (custom event del
        // Loader) o al detectar `<html class="is-loaded">` ya seteada
        // (si este script corre después del loader, como en reduce-motion).
        //
        // Fallback adicional: si el browser bloquea autoplay incluso
        // post-loader, primer gesto del user (scroll/click/keydown/touch)
        // dispara el play.
        let attemptedKick = false;
        const kick = () => {
            if (attemptedKick) return;
            attemptedKick = true;
            try { video.currentTime = 0; } catch (_) {}
            const p = video.play();
            if (p && typeof p.then === "function") {
                p.then(() => { /* ok */ }).catch(() => {
                    attemptedKick = false;
                    const onGesture = () => {
                        if (attemptedKick) return;
                        attemptedKick = true;
                        try { video.currentTime = 0; } catch (_) {}
                        const p2 = video.play();
                        if (p2 && typeof p2.catch === "function") p2.catch(() => {});
                    };
                    ["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) =>
                        window.addEventListener(ev, onGesture, { once: true, passive: true })
                    );
                });
            }
        };

        // 1) Si el loader ya terminó (reduce-motion, navegación cached),
        //    arrancar el video ya — pero esperando readyState mínimo.
        const tryKickWhenReady = () => {
            if (video.readyState >= 2 /* HAVE_CURRENT_DATA */) {
                kick();
            } else {
                video.addEventListener("loadedmetadata", kick, { once: true });
                video.addEventListener("canplay", kick, { once: true });
            }
        };

        if (document.documentElement.classList.contains("is-loaded")) {
            tryKickWhenReady();
        } else {
            // 2) Esperar al evento custom del Loader
            window.addEventListener("loader:done", tryKickWhenReady, { once: true });
            // Red de seguridad: si por algún motivo no llega el evento
            // (Loader fue removido / script crashed) y is-loaded nunca
            // aparece → forzar play tras 4.5s (el Loader tiene timeout
            // de 4s, así que ya debería estar libre).
            window.setTimeout(() => {
                if (!attemptedKick) tryKickWhenReady();
            }, 4500);
        }

        // Pre-end freeze: dispara ~2 frames antes del fin → margen de seguridad
        // para evitar que el browser ya haya hecho su propio auto-pause.
        video.addEventListener("timeupdate", () => {
            if (frozen) return;
            const d = video.duration;
            if (Number.isFinite(d) && video.currentTime >= d - FRAME * 2) {
                freeze();
            }
        });

        // Fallback por las dudas (si timeupdate se saltea el threshold).
        video.addEventListener("ended", freeze);
    }

    // ========== CTA: liquid fill que sale desde el cursor ==========
    // Default está en el centro; al mover el mouse sobre el botón
    // ajustamos --vh-cta-fill-x para que el círculo blanco emerja
    // desde el punto de entrada, no siempre desde el medio.
    if (cta && ctaFill) {
        cta.addEventListener("mouseenter", (e) => {
            const r = cta.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * 100;
            cta.style.setProperty("--vh-cta-fill-x", `${x}%`);
        });
        cta.addEventListener("mouseleave", (e) => {
            const r = cta.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * 100;
            cta.style.setProperty("--vh-cta-fill-x", `${x}%`);
        });
    }

    // ========== HUD counter rotativo (idle, decorativo) ==========
    // Cicla 01..06 cada ~3s para que el hero se sienta vivo aunque
    // el usuario no scrollee aún. Sincronizado con los dots.
    let hudIdx = 0;
    let hudTimer = null;
    function rotateHud() {
        hudIdx = (hudIdx + 1) % hudDots.length;
        if (hudNum) hudNum.textContent = String(hudIdx + 1).padStart(2, "0");
        hudDots.forEach((d, i) => d.classList.toggle("is-active", i === hudIdx));
    }

    // ========== matchMedia scope ==========
    mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion, isMobile } = context.conditions;

        // ---- Reduced motion: estado final + sin animación ----
        if (reduceMotion) {
            if (video) {
                video.removeAttribute("autoplay");
                try { video.pause(); } catch (_) {}
            }
            gsap.set([bandL, bandR, kicker, claimLines, cta, scrollHint, hud], { autoAlpha: 1, y: 0 });
            gsap.set(words, { yPercent: 0, autoAlpha: 1 });
            gsap.set(rules, { scaleX: 1, autoAlpha: 1 });
            gsap.set(particles, { autoAlpha: 0 });
            return;
        }

        // ---- Estado inicial controlado SIEMPRE por GSAP ----
        gsap.set([bandL, bandR], { autoAlpha: 0, y: -10 });
        gsap.set(kicker, { autoAlpha: 0, y: 12 });
        gsap.set(words, { yPercent: 110 });
        gsap.set(rules, { scaleX: 0, autoAlpha: 0 });
        gsap.set(claimLines, { autoAlpha: 0, y: 18 });
        gsap.set(cta, { autoAlpha: 0, y: 18, scale: 0.9 });
        gsap.set(scrollHint, { autoAlpha: 0, y: 10 });
        gsap.set(hud, { autoAlpha: 0, y: 10 });
        gsap.set(particles, { autoAlpha: 0 });

        // ---- SplitText opcional ----
        let splits = [];
        let charTargets = [];
        let useSplitText = false;
        try {
            if (SplitText && typeof SplitText.create === "function") {
                splits = words.map((w) =>
                    new SplitText(w, { type: "chars", charsClass: "vh-char" })
                );
                charTargets = splits.flatMap((s) => s.chars || []);
                if (charTargets.length) {
                    gsap.set(words, { yPercent: 0 });
                    gsap.set(charTargets, { yPercent: 110, willChange: "transform" });
                    useSplitText = true;
                }
            }
        } catch (_) { /* fallback a words como bloque */ }
        const wordTargets = useSplitText ? charTargets : words;

        // ========================================================
        // MASTER TIMELINE
        // ========================================================
        const tl = gsap.timeline({
            defaults: { ease: "power3.out" },
            delay: 0.25,
        });

        tl
            // Acto I: framing — bandas top + bottom + scroll hint
            .addLabel("frame", 0)
            .to(bandL, { autoAlpha: 1, y: 0, duration: 0.7 }, "frame")
            .to(bandR, { autoAlpha: 1, y: 0, duration: 0.7 }, "frame+=0.08")
            .to(scrollHint, { autoAlpha: 1, y: 0, duration: 0.6 }, "frame+=0.12")
            .to(hud, { autoAlpha: 1, y: 0, duration: 0.6 }, "frame+=0.16")

            // Acto II: kicker
            .addLabel("kicker", "frame+=0.3")
            .to(kicker, { autoAlpha: 1, y: 0, duration: 0.55 }, "kicker")

            // Acto III: display "HOLISTIC" + reglas
            .addLabel("display", "kicker+=0.25")
            .to(wordTargets, {
                yPercent: 0,
                duration: 0.95,
                stagger: useSplitText ? 0.02 : 0.18,
                ease: "expo.out",
            }, "display")
            .to(rules, {
                scaleX: 1, autoAlpha: 1,
                duration: 0.7, ease: "power4.out",
                stagger: 0.08,
            }, "display+=0.4")

            // Acto IV: claim
            .addLabel("claim", "display+=0.85")
            .to(claimLines, {
                autoAlpha: 1, y: 0,
                duration: 0.7, stagger: 0.1,
            }, "claim")

            // Acto V: CTA con back.out (escala con overshoot)
            .addLabel("cta", "claim+=0.45")
            .to(cta, {
                autoAlpha: 1, y: 0, scale: 1,
                duration: 0.85, ease: "back.out(1.7)",
            }, "cta")

            // Acto VI: particles
            .addLabel("particles", "cta+=0.15")
            .add(() => {
                particles.slice(0, isMobile ? 14 : particles.length).forEach((p) => {
                    gsap.set(p, {
                        left: `${gsap.utils.random(0, 100)}%`,
                        top: `${gsap.utils.random(60, 110)}%`,
                        xPercent: -50, yPercent: -50,
                        x: 0, y: 0, autoAlpha: 0,
                    });
                    const driftX = gsap.utils.random(-30, 30);
                    const driftY = gsap.utils.random(-200, -560);
                    const dur = gsap.utils.random(8, 18);
                    const delay = gsap.utils.random(0, 5);
                    const peak = gsap.utils.random(0.35, 0.95);

                    gsap.timeline({ repeat: -1, delay })
                        .to(p, { autoAlpha: peak, duration: dur * 0.18, ease: "sine.out" })
                        .to(p, { x: driftX, y: driftY, duration: dur, ease: "sine.inOut" }, 0)
                        .to(p, { autoAlpha: 0, duration: dur * 0.3, ease: "sine.in" }, dur * 0.7);
                });
                particles.slice(isMobile ? 14 : particles.length).forEach((p) =>
                    gsap.set(p, { autoAlpha: 0 })
                );
            }, "particles")

            // Acto VII: idle ken-burns infinito del video + HUD rotación
            .add(() => {
                gsap.to(video, {
                    scale: 1.05,
                    duration: 16, ease: "sine.inOut",
                    yoyo: true, repeat: -1,
                });
                hudTimer = window.setInterval(rotateHud, 2800);
            }, "particles+=1.2");

        // ---- Cleanup ----
        return () => {
            try { tl.kill(); } catch (_) {}
            splits.forEach((s) => { try { s.revert(); } catch (_) {} });
            if (hudTimer) {
                clearInterval(hudTimer);
                hudTimer = null;
            }
        };
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVideoHero, { once: true });
} else {
    initVideoHero();
}
