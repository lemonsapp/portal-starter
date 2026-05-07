/* =====================================================================
   HOLISTIC — race-cinematic-animations.js
   Sección /linea-race · marquee horizontal + grid de motion videos.
   Maneja:
    - Auto-play / pause de los <video> según viewport: ScrollTrigger
      por tile dispara play() onEnter / pause() onLeave para no
      desperdiciar GPU si están fuera de pantalla.
    - Reduce-motion (matchMedia): videos paused en frame 0 (poster).

   El header inicial (eyebrow + title + lede) y la galería editorial
   masonry fueron retirados por pedido del cliente. Sus animaciones
   también se eliminaron de este script.

   Skills aplicadas (citadas en el componente):
     • gsap-scrolltrigger callbacks → autoplay video por tile
     • gsap-utils.toArray            → setup videos
     • gsap-core matchMedia          → reduce-motion + breakpoints
   ===================================================================== */

import { gsap, ScrollTrigger, mm, BREAKPOINTS } from "./lib/registerGsap.js";

function initRaceCinematic() {
    const root = document.querySelector("[data-race-cinematic]");
    if (!root) return;

    const ctx = mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion } = context.conditions;

        // ===== Autoplay/pause de videos por viewport =====
        // (La batch de reveal de tiles del grid editorial fue retirada
        // al sacarse esa galería del componente. Si se reactiva, los
        // tiles vuelven a aparecer con [data-rc-tile] y conviene
        // re-introducir un ScrollTrigger.batch acá.)
        // Crea un ScrollTrigger por video que dispara play() onEnter y
        // pause() onLeave. En reduce-motion, los videos quedan estáticos
        // mostrando el poster; el usuario puede activar play manual sin
        // controles desde el browser-context-menu si quisiera.
        const motionVideos = gsap.utils.toArray("[data-rc-motion-video]");
        const heroVideo = document.querySelector("[data-pdd-hero-video]");
        const allVideos = [heroVideo, ...motionVideos].filter(Boolean);

        allVideos.forEach((video) => {
            if (reduceMotion) {
                video.removeAttribute("autoplay");
                try { video.pause(); } catch (_) {}
                return;
            }

            ScrollTrigger.create({
                trigger: video,
                start: "top 90%",
                end: "bottom 10%",
                onEnter: () => {
                    const p = video.play();
                    if (p && typeof p.catch === "function") p.catch(() => {});
                },
                onEnterBack: () => {
                    const p = video.play();
                    if (p && typeof p.catch === "function") p.catch(() => {});
                },
                onLeave: () => video.pause(),
                onLeaveBack: () => video.pause(),
            });
        });

        // No hace falta retornar cleanup explícito: mm.add() revierte
        // todas las animaciones y ScrollTriggers creadas en este scope
        // cuando cambia el media-query o cuando se llama ctx.revert().
    });

    return ctx;
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRaceCinematic, { once: true });
} else {
    initRaceCinematic();
}
