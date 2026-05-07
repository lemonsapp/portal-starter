/* =====================================================================
   HOLISTIC — marquee-animations.js
   Banda horizontal infinita reactiva al scroll:
    - Loop seamless con xPercent: -50 sobre track con 2 grupos espejados.
    - timeScale + direction se modulan con la velocidad de Lenis (si
      está) — feel de "el mundo acelera cuando scrolleás fuerte".
    - skewX leve por velocidad (track se inclina cuando va rápido).
    - Hover suaviza a 0.25× (no pause duro — más orgánico).
    - quickTo en lugar de tweens por frame: una sola pasada barata.
    - reduceMotion: loop pausado, track quieto.
   Skills aplicados:
     gsap-core: gsap.quickTo, gsap.utils.clamp, mm.add(BREAKPOINTS).
     gsap-utils: clamp para limitar timeScale y skew.
   ===================================================================== */

import { gsap, mm, BREAKPOINTS } from "./lib/registerGsap.js";

function initMarquees() {
    const marquees = document.querySelectorAll("[data-marquee]");
    if (!marquees.length) return;

    mm.add(BREAKPOINTS, (context) => {
        const { reduceMotion, isMobile } = context.conditions;

        const cleanups = [];

        marquees.forEach((marquee) => {
            const track = marquee.querySelector("[data-marquee-track]");
            if (!track) return;

            // Mobile más lento (texto más chico, menos contenido) para
            // que no parezca histérico.
            const baseDuration = isMobile ? 32 : 22;
            // 1 = avanza (xPercent baja), -1 = retrocede.
            let direction = 1;
            // Decae a 1× cuando el scroll se queda quieto.
            let idleTimeoutId = null;

            const loop = gsap.to(track, {
                xPercent: -50,
                duration: baseDuration,
                ease: "none",
                repeat: -1,
            });

            if (reduceMotion) {
                loop.pause();
                gsap.set(track, { xPercent: 0 });
                return;
            }

            // quickTo es ~1 orden de magnitud más barato que `gsap.to`
            // por frame — ideal para handlers de scroll que disparan a
            // 60–120 Hz.
            const setTimeScale = gsap.quickTo(loop, "timeScale", {
                duration: 0.5,
                ease: "power2.out",
            });
            const setSkew = gsap.quickTo(track, "skewX", {
                duration: 0.5,
                ease: "power3.out",
            });

            const lenis = window.__lenis;
            let onLenisScroll = null;
            let onWheel = null;

            // Mapper común: dado velocity (px/frame), aplicar timeScale +
            // skew + dirección. Lenis y wheel ambos llaman a esta fn.
            const applyVelocity = (velocity) => {
                if (typeof velocity !== "number" || !isFinite(velocity)) return;
                const v = Math.abs(velocity);
                if (velocity > 0.01) direction = 1;
                else if (velocity < -0.01) direction = -1;

                // timeScale: 1× idle, hasta 5× en velocidades extremas.
                // gsap.utils.clamp acota el rango.
                const ts = direction * gsap.utils.clamp(0.6, 5, 1 + v * 0.06);
                setTimeScale(ts);

                // Skew: hasta ±8° con la velocidad. Inclina contra la
                // dirección — feel de "viento" al moverse.
                const sk = gsap.utils.clamp(-8, 8, velocity * 0.12);
                setSkew(sk);

                // Re-armamos el decay a idle 1× cuando el scroll se detenga.
                if (idleTimeoutId) clearTimeout(idleTimeoutId);
                idleTimeoutId = setTimeout(() => {
                    setTimeScale(direction * 1);
                    setSkew(0);
                }, 220);
            };

            if (lenis && typeof lenis.on === "function") {
                onLenisScroll = (e) => applyVelocity(e?.velocity ?? 0);
                lenis.on("scroll", onLenisScroll);
            } else {
                // Fallback sin Lenis: leer wheel deltaY como proxy de velocidad.
                onWheel = (e) => applyVelocity(e.deltaY * 0.05);
                window.addEventListener("wheel", onWheel, { passive: true });
            }

            // Hover: slowdown soft (no pause) para mantener vida.
            const onEnter = () => setTimeScale(direction * 0.25);
            const onLeave = () => setTimeScale(direction * 1);
            marquee.addEventListener("mouseenter", onEnter);
            marquee.addEventListener("mouseleave", onLeave);

            cleanups.push(() => {
                loop.kill();
                if (idleTimeoutId) clearTimeout(idleTimeoutId);
                if (onLenisScroll && lenis && typeof lenis.off === "function") {
                    lenis.off("scroll", onLenisScroll);
                }
                if (onWheel) window.removeEventListener("wheel", onWheel);
                marquee.removeEventListener("mouseenter", onEnter);
                marquee.removeEventListener("mouseleave", onLeave);
            });
        });

        return () => cleanups.forEach((fn) => fn());
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMarquees);
} else {
    initMarquees();
}
