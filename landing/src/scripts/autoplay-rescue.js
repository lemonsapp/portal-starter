/* =====================================================================
   HOLISTIC — autoplay-rescue.js  (global, cargado desde BaseLayout)

   Rescate universal de autoplay: iOS/Android bloquean el autoplay de
   <video> según el estado del teléfono (modo bajo consumo, ahorro de
   datos) y el bloqueo NO es parejo entre usuarios — a unos les arranca
   y a otros no. Este script reintenta play() de todo video[autoplay]
   visible que haya quedado pausado:

     • al primer toque/click (un play() dentro de un gesto real no se
       puede bloquear, ni siquiera en modo bajo consumo),
     • en cada scroll (throttled con rAF; ayuda en Android/desktop),
     • cuando la página vuelve a estar visible (cambio de pestaña).

   No pelea con los componentes que pausan videos a propósito (ej. el
   cross-fade de ProductHighlights deja los inactivos con autoAlpha 0):
   sólo toca videos efectivamente visibles (visibility + opacity).
   ===================================================================== */

function isEffectivelyVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity) > 0.05;
}

function rescueAll() {
    document.querySelectorAll("video[autoplay]").forEach((v) => {
        if (v.paused && isEffectivelyVisible(v)) {
            const p = v.play();
            if (p && typeof p.catch === "function") p.catch(() => {});
        }
    });
}

addEventListener("touchend", rescueAll, { passive: true });
addEventListener("click", rescueAll);

let ticking = false;
addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; rescueAll(); });
}, { passive: true });

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) rescueAll();
});
