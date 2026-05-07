/* =====================================================================
   HOLISTIC GROWSHOP — animations.js
   Animaciones sutiles y profesionales con GSAP + ScrollTrigger
   ===================================================================== */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function init() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // -----------------------------------------------------------------
    // A. HEADER — fade + rise al cargar (0.6s)
    // -----------------------------------------------------------------
    gsap.from(".header", {
        y: -30,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out"
    });

    // -----------------------------------------------------------------
    // B. HERO TITLE — split manual por palabras + stagger 0.08s
    // -----------------------------------------------------------------
    const firstTitle = document.querySelector(".hero__slide.is-active .hero__title");
    if (firstTitle) {
        const words = firstTitle.textContent.trim().split(/\s+/);
        firstTitle.innerHTML = words
            .map(w => `<span class="word"><span class="word__inner">${w}</span></span>`)
            .join(" ");

        gsap.from(".hero__slide.is-active .hero__title .word__inner", {
            y: 40,
            opacity: 0,
            duration: 0.8,
            stagger: 0.08,
            ease: "power3.out",
            delay: 0.2
        });
    }

    // -----------------------------------------------------------------
    // C. HERO SUBTITLE + ACTIONS — fade + rise escalonado (0.15s stagger)
    // -----------------------------------------------------------------
    gsap.from(
        ".hero__slide.is-active .hero__eyebrow, .hero__slide.is-active .hero__subtitle, .hero__slide.is-active .hero__actions",
        {
            y: 20,
            opacity: 0,
            duration: 0.7,
            stagger: 0.15,
            ease: "power2.out",
            delay: 0.5
        }
    );

    gsap.from(".hero__slide.is-active .hero__image img", {
        scale: 0.94,
        opacity: 0,
        duration: 1,
        ease: "power2.out",
        delay: 0.3
    });

    // -----------------------------------------------------------------
    // D. HERO SLIDER — auto-cambio cada 6s, crossfade 0.8s, flechas y dots.
    // -----------------------------------------------------------------
    const slides = document.querySelectorAll(".hero__slide");
    const dots   = document.querySelectorAll(".hero__dot");
    const prevBtn = document.querySelector(".hero__arrow--prev");
    const nextBtn = document.querySelector(".hero__arrow--next");

    slides.forEach(s => s.removeAttribute("hidden"));

    let current = 0;
    let isAnimating = false;

    function goTo(index) {
        if (isAnimating || index === current) return;
        isAnimating = true;

        const outgoing = slides[current];
        const incoming = slides[index];

        gsap.to(outgoing, {
            opacity: 0,
            duration: 0.8,
            ease: "power2.inOut",
            onComplete: () => {
                outgoing.classList.remove("is-active");
            }
        });

        incoming.classList.add("is-active");
        gsap.fromTo(incoming,
            { opacity: 0 },
            {
                opacity: 1,
                duration: 0.8,
                ease: "power2.inOut",
                onComplete: () => { isAnimating = false; }
            }
        );

        dots[current].classList.remove("is-active");
        dots[index].classList.add("is-active");
        current = index;
    }

    function next() { goTo((current + 1) % slides.length); }
    function prev() { goTo((current - 1 + slides.length) % slides.length); }

    if (nextBtn) nextBtn.addEventListener("click", next);
    if (prevBtn) prevBtn.addEventListener("click", prev);
    dots.forEach(dot => {
        dot.addEventListener("click", () => goTo(parseInt(dot.dataset.dot, 10)));
    });

    let autoplayId = null;
    function startAutoplay() {
        if (prefersReducedMotion) return;
        stopAutoplay();
        autoplayId = setInterval(next, 6000);
    }
    function stopAutoplay() {
        if (autoplayId) { clearInterval(autoplayId); autoplayId = null; }
    }

    const heroEl = document.querySelector(".hero");
    if (heroEl) {
        heroEl.addEventListener("mouseenter", stopAutoplay);
        heroEl.addEventListener("mouseleave", startAutoplay);
        startAutoplay();
    }

    // -----------------------------------------------------------------
    // E. BANNER WHATSAPP — fade-in + slight scale al entrar al viewport
    // -----------------------------------------------------------------
    gsap.from(".banner", {
        scrollTrigger: {
            trigger: ".banner",
            start: "top 90%",
            toggleActions: "play none none none"
        },
        opacity: 0,
        scale: 0.98,
        duration: 0.7,
        ease: "power2.out"
    });

    // -----------------------------------------------------------------
    // F. BENTO CARDS — scale 0.95→1 + fade con stagger 0.1s
    // -----------------------------------------------------------------
    gsap.utils.toArray(".bento__row").forEach(row => {
        const cards = row.querySelectorAll(".bento__card");
        gsap.from(cards, {
            scrollTrigger: {
                trigger: row,
                start: "top 85%",
                toggleActions: "play none none none"
            },
            scale: 0.95,
            opacity: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: "power2.out"
        });
    });

    // -----------------------------------------------------------------
    // I. FOOTER — fade-in al entrar al viewport
    // -----------------------------------------------------------------
    gsap.from(".footer__cols", {
        scrollTrigger: {
            trigger: ".footer",
            start: "top 90%",
            toggleActions: "play none none none"
        },
        opacity: 0,
        y: 20,
        duration: 0.7,
        ease: "power2.out"
    });

    gsap.from(".footer__brand", {
        scrollTrigger: {
            trigger: ".footer__brand",
            start: "top 95%",
            toggleActions: "play none none none"
        },
        opacity: 0,
        y: 40,
        duration: 0.9,
        ease: "power2.out"
    });

    // -----------------------------------------------------------------
    // Canales: fade-in sutil de las cards
    // -----------------------------------------------------------------
    gsap.from(".channels__card", {
        scrollTrigger: {
            trigger: ".channels",
            start: "top 85%",
            toggleActions: "play none none none"
        },
        opacity: 0,
        y: 20,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out"
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
