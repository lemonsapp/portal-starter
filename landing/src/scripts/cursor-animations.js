/* =====================================================================
   HOLISTIC — cursor-animations.js
   Cursor custom (dot + ring) con tres niveles de feedback:
    - quickTo follow del dot (instantáneo) y ring (lag con power3.out).
    - Hover state sobre links/buttons/[data-cursor="hover"]: ring escala
      y se tinta verde Holistic.
    - Magnetic pull sobre [data-magnetic]: el target completo se acerca
      al cursor escalado por data-magnetic-strength (default 0.25).
    - Click warp: ring se contrae y dot crece — feel de "click sólido".
    - Scroll velocity squash: el ring se aplasta vertical cuando hay
      scroll rápido (vía Lenis si está disponible).
   Skills aplicados:
     gsap-core: gsap.quickTo, gsap.matchMedia, gsap.utils.clamp.
     gsap-utils: clamp para limitar magnetic strength y squash.
   ===================================================================== */

import { gsap, mm, BREAKPOINTS } from "./lib/registerGsap.js";

function initCustomCursor() {
    const dot = document.querySelector("[data-cursor-dot]");
    const ring = document.querySelector("[data-cursor-ring]");
    if (!dot || !ring) return;

    mm.add({
        cursorActive: "(min-width: 901px) and (pointer: fine)",
    }, (context) => {
        if (!context.conditions.cursorActive) return;

        document.documentElement.classList.add("has-custom-cursor");

        // Centro del transform-origin en el elemento (evita esquina pegada).
        gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });

        // Dot: follow instantáneo. Ring: lag suave (lookahead feel).
        const dotX = gsap.quickTo(dot, "x", { duration: 0.0, ease: "none" });
        const dotY = gsap.quickTo(dot, "y", { duration: 0.0, ease: "none" });
        const ringX = gsap.quickTo(ring, "x", { duration: 0.4, ease: "power3.out" });
        const ringY = gsap.quickTo(ring, "y", { duration: 0.4, ease: "power3.out" });

        let lastX = window.innerWidth / 2;
        let lastY = window.innerHeight / 2;

        const onMove = (e) => {
            lastX = e.clientX;
            lastY = e.clientY;
            dotX(e.clientX);
            dotY(e.clientY);
            ringX(e.clientX);
            ringY(e.clientY);
        };
        window.addEventListener("mousemove", onMove, { passive: true });

        // ----------------- HOVER STATE (links/buttons) -----------------
        const hoverSelector = 'a, button, [data-cursor="hover"]';
        let hoverTween = null;
        const ringHoverIn = () => {
            if (hoverTween) hoverTween.kill();
            hoverTween = gsap.to(ring, {
                scale: 2.5,
                borderColor: "#25D366",
                backgroundColor: "rgba(37, 211, 102, 0.12)",
                duration: 0.35,
                ease: "power3.out",
            });
        };
        const ringHoverOut = () => {
            if (hoverTween) hoverTween.kill();
            hoverTween = gsap.to(ring, {
                scale: 1,
                borderColor: "rgba(0, 0, 0, 0.6)",
                backgroundColor: "transparent",
                duration: 0.35,
                ease: "power3.out",
            });
        };

        const onOver = (e) => {
            const t = e.target;
            if (t instanceof Element && t.closest(hoverSelector)) ringHoverIn();
        };
        const onOut = (e) => {
            const t = e.target;
            if (t instanceof Element && t.closest(hoverSelector)) ringHoverOut();
        };
        document.addEventListener("mouseover", onOver);
        document.addEventListener("mouseout", onOut);

        // ----------------- VISIBILITY (mouseenter/leave window) -----------------
        const onWinLeave = () => gsap.to([dot, ring], { opacity: 0, duration: 0.2 });
        const onWinEnter = () => gsap.to([dot, ring], { opacity: 1, duration: 0.2 });
        document.addEventListener("mouseleave", onWinLeave);
        document.addEventListener("mouseenter", onWinEnter);

        // ----------------- CLICK WARP -----------------
        // mousedown: ring se contrae + dot crece. mouseup: snap back.
        const onDown = () => {
            gsap.to(ring, { scale: 0.6, duration: 0.18, ease: "power3.out", overwrite: "auto" });
            gsap.to(dot, { scale: 1.8, duration: 0.18, ease: "power3.out", overwrite: "auto" });
        };
        const onUp = () => {
            gsap.to(ring, { scale: 1, duration: 0.35, ease: "back.out(2)", overwrite: "auto" });
            gsap.to(dot, { scale: 1, duration: 0.35, ease: "back.out(2)", overwrite: "auto" });
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("mouseup", onUp);

        // ----------------- SCROLL VELOCITY SQUASH -----------------
        // Ring se aplasta vertical en función de la velocidad de scroll.
        const setSquash = gsap.quickTo(ring, "scaleY", { duration: 0.4, ease: "power2.out" });
        const setStretch = gsap.quickTo(ring, "scaleX", { duration: 0.4, ease: "power2.out" });
        let squashTimeout = null;
        const lenis = window.__lenis;
        let onLenisScroll = null;

        const applyScrollSquash = (velocity) => {
            const v = Math.abs(velocity);
            const squash = gsap.utils.clamp(0.6, 1, 1 - v * 0.04);
            const stretch = gsap.utils.clamp(1, 1.5, 1 + v * 0.04);
            setSquash(squash);
            setStretch(stretch);
            if (squashTimeout) clearTimeout(squashTimeout);
            squashTimeout = setTimeout(() => {
                setSquash(1);
                setStretch(1);
            }, 220);
        };

        if (lenis && typeof lenis.on === "function") {
            onLenisScroll = (e) => applyScrollSquash(e?.velocity ?? 0);
            lenis.on("scroll", onLenisScroll);
        }

        // ----------------- MAGNETIC PULL -----------------
        // Cualquier [data-magnetic]: cuando el cursor está sobre él, el
        // elemento se acerca al cursor. La fuerza es 0.25 por defecto;
        // configurable por elemento con data-magnetic-strength.
        const magnetics = Array.from(document.querySelectorAll("[data-magnetic]"));
        const magneticHandlers = [];

        magnetics.forEach((el) => {
            const strength = parseFloat(el.dataset.magneticStrength || "0.25");
            const setMagX = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
            const setMagY = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });

            const onElMove = (e) => {
                const rect = el.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                setMagX((e.clientX - cx) * strength);
                setMagY((e.clientY - cy) * strength);
            };
            const onElLeave = () => {
                setMagX(0);
                setMagY(0);
            };
            el.addEventListener("mousemove", onElMove);
            el.addEventListener("mouseleave", onElLeave);
            magneticHandlers.push({ el, onElMove, onElLeave });
        });

        return () => {
            window.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseover", onOver);
            document.removeEventListener("mouseout", onOut);
            document.removeEventListener("mouseleave", onWinLeave);
            document.removeEventListener("mouseenter", onWinEnter);
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("mouseup", onUp);
            if (onLenisScroll && lenis && typeof lenis.off === "function") {
                lenis.off("scroll", onLenisScroll);
            }
            if (squashTimeout) clearTimeout(squashTimeout);
            magneticHandlers.forEach(({ el, onElMove, onElLeave }) => {
                el.removeEventListener("mousemove", onElMove);
                el.removeEventListener("mouseleave", onElLeave);
            });
            document.documentElement.classList.remove("has-custom-cursor");
        };
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCustomCursor);
} else {
    initCustomCursor();
}
