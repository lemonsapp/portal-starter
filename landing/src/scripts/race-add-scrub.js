/* =====================================================================
   race-add-scrub.js — Video scroll-scrub para /linea-race.
   Mapea scroll progress → video.currentTime. Pinned mientras dura el
   scrub. User scrolea down → video avanza ("se arma"); scrolea up →
   retrocede ("se desarma"). Patrón scrolly-video clásico.

   El video tiene keyframes en cada frame (encodeado con
   keyint=1:scenecut=0:bframes=0) para que currentTime sea
   frame-accurate y el scrub se vea smooth.

   Notas anti-bug:
   - Esperamos canplaythrough antes de setup (no solo loadedmetadata) —
     algunas browsers fallan al seek si los frames no están decoded.
   - Primeamos el video con play().then(.pause()) en init para "unlock"
     el seeking en Chrome/Safari headless.
   - Listener resize/orientation refresh ScrollTrigger.

   Skills aplicadas:
     • gsap-scrolltrigger pin + scrub       → scroll-driven scrub
     • gsap-core matchMedia                 → reduced-motion respect
     • HTMLMediaElement.currentTime         → frame seeking
   ===================================================================== */
import { gsap, mm, BREAKPOINTS, ScrollTrigger } from "./lib/registerGsap.js";

function initRaceAddScrub() {
    const root = document.querySelector("[data-race-add]");
    if (!root) return;
    const pin = root.querySelector("[data-race-add-pin]");
    const video = root.querySelector("[data-race-add-video]");
    if (!pin || !video) return;

    // Force load + prime el video. play()+pause() inmediato "warms up"
    // el decoder para que el primer seek no falle. Atado a un user-gesture
    // proxy via DOMContentLoaded para máxima compatibilidad.
    video.load();
    const prime = () => {
        const promise = video.play();
        if (promise && promise.then) {
            promise.then(() => {
                video.pause();
                video.currentTime = 0;
            }).catch(() => {
                // play() rejected (autoplay policy, etc.) — sin problema,
                // los seeks aún funcionan en la mayoría de browsers.
            });
        }
    };
    if (video.readyState >= 3) {
        prime();
    } else {
        video.addEventListener("canplaythrough", prime, { once: true });
    }

    // Wait until video has duration AND can play through, antes de setup
    // de ScrollTrigger. Algunas browsers necesitan canplaythrough para
    // que los seeks sean reliables.
    function setup() {
        if (!video.duration || isNaN(video.duration) || video.readyState < 3) {
            const handler = () => {
                if (video.duration && !isNaN(video.duration) && video.readyState >= 3) {
                    video.removeEventListener("loadedmetadata", handler);
                    video.removeEventListener("canplaythrough", handler);
                    setup();
                }
            };
            video.addEventListener("loadedmetadata", handler);
            video.addEventListener("canplaythrough", handler);
            return;
        }

        const duration = video.duration;

        mm.add(BREAKPOINTS, (ctx) => {
            const { reduceMotion } = ctx.conditions;

            // reduce-motion: video al frame final estático, sin scrub.
            if (reduceMotion) {
                video.currentTime = duration;
                return;
            }

            // ScrollTween: scrub el currentTime via objeto proxy.
            // Usar tween-on-proxy permite aprovechar lerp/scrub smoothing
            // de GSAP en lugar de update directo del video (que es
            // potencialmente jittery porque seek es async).
            const proxy = { t: 0 };
            const tween = gsap.to(proxy, {
                t: duration,
                ease: "none",
                onUpdate: () => {
                    if (Math.abs(proxy.t - video.currentTime) > 0.005) {
                        video.currentTime = proxy.t;
                    }
                },
                scrollTrigger: {
                    id: "race-add-scrub",
                    trigger: pin,
                    start: "top top",
                    end:   "+=200%",   // 200vh de scroll para el scrub
                    pin: true,
                    pinSpacing: true,
                    scrub: 0.6,
                    invalidateOnRefresh: true,
                    anticipatePin: 1,
                },
            });

            return () => tween.scrollTrigger?.kill();
        });

        // Refresh ScrollTrigger después de que el video tenga su layout
        // final (videos pueden cambiar height al cargar metadata).
        ScrollTrigger.refresh();
    }

    setup();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRaceAddScrub);
} else {
    initRaceAddScrub();
}
