/* =====================================================================
   HOLISTIC — registerGsap.js
   Singleton: registra plugins una vez y expone una matchMedia compartida.
   Cualquier script de página debe importar desde acá en lugar de
   registrar plugins por su cuenta.
   ===================================================================== */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { Observer } from "gsap/Observer";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { Physics2DPlugin } from "gsap/Physics2DPlugin";
import { CustomBounce } from "gsap/CustomBounce";

if (!window.__holisticGsapRegistered) {
    gsap.registerPlugin(ScrollTrigger, CustomEase, SplitText, DrawSVGPlugin, Observer, MotionPathPlugin, Physics2DPlugin, CustomBounce);

    // Bounce eases para splash physics — squash & stretch al impactar.
    // Strength alto → más rebote; endAtStart para que el squash arranque
    // ANTES del impacto (anticipation).
    if (!CustomBounce.get?.("liquidSplash")) {
        CustomBounce.create("liquidSplash", { strength: 0.6, squash: 2, endAtStart: false });
    }

    if (!CustomEase.get("heroIn")) {
        CustomEase.create("heroIn", "M0,0 C0.1,0 0.2,1 1,1");
    }
    if (!CustomEase.get("brand")) {
        CustomEase.create("brand", "M0,0 C0.22,1 0.36,1 1,1");
    }
    if (!CustomEase.get("liquid")) {
        // Para drops y splashes — anticipa, salta, asienta.
        CustomEase.create("liquid", "M0,0 C0.34,0 0.5,1.2 1,1");
    }
    if (!CustomEase.get("explode")) {
        // 3-act: anticipation → overshoot → settle.
        CustomEase.create("explode", "M0,0 C0.16,0 0.18,1.4 0.5,1.1 0.7,0.95 1,1 1,1");
    }

    gsap.defaults({ ease: "power2.out" });

    // gsap-performance: tolerar frames lentos hasta 500ms (suspende la
    // animación temporalmente en vez de saltar) y considerar lag a partir
    // de 33ms (1 frame perdido a 30fps). Mejora la suavidad en mobile/CPU
    // débil sin afectar 60fps en desktop.
    gsap.ticker.lagSmoothing(500, 33);

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            ScrollTrigger.refresh();
        });
    }

    window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });

    window.__holisticGsapRegistered = true;
}

export const mm = window.__holisticMM || (window.__holisticMM = gsap.matchMedia());

export const BREAKPOINTS = {
    isDesktop: "(min-width: 901px)",
    isTablet: "(min-width: 641px) and (max-width: 900px)",
    isMobile: "(max-width: 640px)",
    reduceMotion: "(prefers-reduced-motion: reduce)",
};

export { gsap, ScrollTrigger, CustomEase, SplitText, DrawSVGPlugin, Observer, MotionPathPlugin, Physics2DPlugin, CustomBounce };
