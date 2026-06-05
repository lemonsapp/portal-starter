/* =====================================================================
   HOLISTIC — smooth-scroll.js
   Lenis + GSAP ScrollTrigger integration (patrón oficial).
   Exposed via window.__lenis so el Loader u otros scripts pueden
   pausarla/reanudarla sin necesidad de ES-import cross-bundle.

   MOBILE: Lenis NO se instancia en dispositivos touch (pointer: coarse).
   El scroll nativo de iOS/Android corre en el compositor a 120Hz; Lenis
   lo reemplaza por un rAF en main-thread que compite con GSAP y produce
   jank en teléfonos promedio. ScrollTrigger funciona igual con scroll
   nativo (escucha el evento scroll del window). Todos los consumidores
   de window.__lenis ya tienen guards defensivos.
   ===================================================================== */

import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

let lenis = null;

if (!isTouchDevice) {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 2,
        lerp: 0.1,
    });

    if (prefersReducedMotion) {
        lenis.stop();
    }

    lenis.on("scroll", ScrollTrigger.update);

    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });

    // Requerido por Lenis: sin lagSmoothing el ticker de GSAP no salta
    // frames cuando Lenis maneja el rAF. (registerGsap.js respeta este
    // valor cuando Lenis está activo — ver window.__lenisActive.)
    gsap.ticker.lagSmoothing(0);
    window.__lenisActive = true;
}

window.__lenis = lenis;

export default lenis;
