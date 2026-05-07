/* =====================================================================
   HOLISTIC — smooth-scroll.js
   Lenis + GSAP ScrollTrigger integration (patrón oficial).
   Exposed via window.__lenis so el Loader u otros scripts pueden
   pausarla/reanudarla sin necesidad de ES-import cross-bundle.
   ===================================================================== */

import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const lenis = new Lenis({
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

gsap.ticker.lagSmoothing(0);

window.__lenis = lenis;

export default lenis;
