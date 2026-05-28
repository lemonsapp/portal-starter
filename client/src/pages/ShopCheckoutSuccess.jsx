// client/src/pages/ShopCheckoutSuccess.jsx
//
// Página de retorno post-checkout (MP success, free purchase, o manual).
// REWRITE 2026-05-23 con animación GSAP premium:
//   • Checkmark SVG que se "dibuja" con stroke-dashoffset
//   • Confetti mint burst expanding desde el centro
//   • Headline chars-rise stagger
//   • Sub-text fade-up sequenced
//   • Order ID y CTAs slide-up al final
//
// Skill: gsap-core + gsap-timeline para la coreografía.

import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCart } from "../lib/useCart.js";
import { useBranding } from "../lib/branding.js";
import gsap from "gsap";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export default function ShopCheckoutSuccess() {
    useBranding();
    const [params] = useSearchParams();
    const orderParam = params.get("order") || sessionStorage.getItem("holistic.lastOrder");
    const isPending = params.get("pending") === "1";
    const isFree    = params.get("free") === "1" || sessionStorage.getItem("holistic.lastOrderFree") === "1";
    const { clear } = useCart();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    const rootRef        = useRef(null);
    const checkRef       = useRef(null);
    const haloRef        = useRef(null);
    const confettiRef    = useRef(null);
    const headlineRef    = useRef(null);
    const subRef         = useRef(null);
    const flowRef        = useRef(null);
    const orderBoxRef    = useRef(null);
    const ctaRowRef      = useRef(null);

    // Clear cart al montarse — idempotente. Limpia también flag free.
    useEffect(() => {
        clear();
        sessionStorage.removeItem("holistic.lastOrderFree");
    }, [clear]);

    // Fetch order detail
    useEffect(() => {
        if (!orderParam) { setLoading(false); return; }
        fetch(`${API}/api/shop/orders/${encodeURIComponent(orderParam)}`)
            .then((r) => r.ok ? r.json() : null)
            .then((d) => setOrder(d?.order || null))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [orderParam]);

    // ── GSAP master timeline ──
    useEffect(() => {
        if (loading) return;
        if (!rootRef.current) return;

        const ctx = gsap.context(() => {
            // Estados iniciales
            gsap.set(haloRef.current, { scale: 0, opacity: 0 });
            gsap.set(checkRef.current, { scale: 0.6, opacity: 0 });
            gsap.set(headlineRef.current?.querySelectorAll("[data-success-char]") || [], {
                yPercent: 110, opacity: 0, rotationX: -30, transformOrigin: "50% 100%",
            });
            gsap.set(subRef.current, { y: 24, opacity: 0 });
            gsap.set(flowRef.current?.querySelectorAll("[data-flow-step]") || [], { x: -24, opacity: 0 });
            gsap.set(orderBoxRef.current, { y: 30, opacity: 0, scale: 0.92 });
            gsap.set(ctaRowRef.current, { y: 24, opacity: 0 });

            const tl = gsap.timeline({ delay: 0.1, defaults: { ease: "power3.out" } });

            // 1) Halo burst — radial pulse desde el centro
            tl.to(haloRef.current, {
                scale: 1.2, opacity: 1,
                duration: 0.6, ease: "expo.out",
            }, 0);

            // 2) Checkmark — pop + stroke draw (controlled via state hack)
            tl.to(checkRef.current, {
                scale: 1, opacity: 1,
                duration: 0.7, ease: "back.out(2.5)",
            }, 0.15);

            // 3) Confetti — 20 partículas expanding desde el centro
            const particles = confettiRef.current?.querySelectorAll("[data-confetti]") || [];
            tl.to(particles, {
                x: () => gsap.utils.random(-220, 220),
                y: () => gsap.utils.random(-160, 80),
                rotation: () => gsap.utils.random(-90, 90),
                opacity: 0,
                duration: 1.6, ease: "expo.out",
                stagger: { amount: 0.15, from: "center" },
            }, 0.35);

            // 4) Headline chars-rise
            const chars = headlineRef.current?.querySelectorAll("[data-success-char]") || [];
            tl.to(chars, {
                yPercent: 0, opacity: 1, rotationX: 0,
                duration: 0.7, ease: "back.out(1.4)",
                stagger: { amount: 0.5, from: "start" },
            }, 0.45);

            // 5) Sub-text fade-up
            tl.to(subRef.current, {
                y: 0, opacity: 1,
                duration: 0.6,
            }, 0.85);

            // 6) Flow steps — slide-in stagger desde la izquierda
            const steps = flowRef.current?.querySelectorAll("[data-flow-step]") || [];
            if (steps.length) {
                tl.to(steps, {
                    x: 0, opacity: 1,
                    duration: 0.55,
                    stagger: 0.12,
                }, 1.0);
            }

            // 7) Order box scale-in
            tl.to(orderBoxRef.current, {
                y: 0, opacity: 1, scale: 1,
                duration: 0.65, ease: "back.out(1.6)",
            }, 1.5);

            // 8) CTAs row
            tl.to(ctaRowRef.current, {
                y: 0, opacity: 1,
                duration: 0.5,
            }, 1.7);

            // 9) Halo idle pulse — yoyo después de toda la entrada
            tl.to(haloRef.current, {
                scale: 1.35, opacity: 0.7,
                duration: 2.4, ease: "sine.inOut",
                yoyo: true, repeat: -1,
            }, 2.0);
        }, rootRef);

        return () => ctx.revert();
    }, [loading]);

    const status = order?.status;
    const isPaid = status === "paid" || isFree;
    const isManual = status === "pending_payment" && !isFree;

    // Headline narrativo (no exclamativo) según el estado real del pedido.
    const headlineText = isPaid
        ? "Hemos recibido tu compra"
        : isPending
            ? "Pago pendiente"
            : "Orden recibida";

    // Sub-text corto + descripción del flujo siguiente. El flujo detallado
    // se renderiza aparte como step list (ver flowSteps abajo).
    const subText = isPaid
        ? "El equipo va a empezar a preparar tus productos. Te mantenemos al tanto por email."
        : isPending
            ? "MercadoPago todavía está procesando el pago. Te avisamos por email cuando se confirme."
            : isManual
                ? "Guardamos tu pedido. Te contactamos por WhatsApp para coordinar pago y envío."
                : "Te contactamos por WhatsApp para coordinar.";

    // Step list visible cuando la compra ya está confirmada (paid o free).
    // Refleja el flujo real del post-checkout: armado → email confirmación →
    // despacho → email tracking. Si más adelante hay tracking real, el ítem 3
    // pasa a "en camino" con número.
    const flowSteps = isPaid ? [
        { icon: "✓", title: "Compra recibida",   desc: "Tu pedido ya está en nuestro sistema.", done: true },
        { icon: "✉", title: "Email de confirmación", desc: "Te enviamos un mail con los detalles de la compra.", done: true },
        { icon: "📦", title: "Preparación",       desc: "El equipo está armando tu pedido.", done: false, active: true },
        { icon: "🚚", title: "Despacho",          desc: "Te enviamos otro email cuando salga hacia tu domicilio.", done: false },
    ] : [];

    return (
        <div ref={rootRef} style={S.shell}>
            <div style={S.card}>
                {/* Halo radial mint */}
                <div ref={haloRef} style={S.halo} aria-hidden="true" />

                {/* Confetti container (absolute particles desde el centro) */}
                <div ref={confettiRef} style={S.confettiWrap} aria-hidden="true">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <span
                            key={i}
                            data-confetti
                            style={{
                                ...S.confettiParticle,
                                background: ["var(--c-accent)", "var(--c-accent-2)", "#2E8F6E", "#FFFFFF"][i % 4],
                                width: 6 + (i % 3) * 2,
                                height: 6 + (i % 3) * 2,
                            }}
                        />
                    ))}
                </div>

                {/* Checkmark SVG */}
                <div ref={checkRef} style={S.checkWrap}>
                    {isFree && <div style={S.freeBadge}>🎉 GRATIS</div>}
                    <svg viewBox="0 0 80 80" width="100" height="100" style={S.checkSvg}>
                        <circle cx="40" cy="40" r="36"
                            fill="none"
                            stroke="rgba(var(--c-accent-rgb),0.4)"
                            strokeWidth="2"
                        />
                        <circle cx="40" cy="40" r="32"
                            fill="rgba(var(--c-accent-rgb),0.15)"
                            stroke="var(--brand-primary, var(--c-accent))"
                            strokeWidth="2.5"
                        />
                        <path d="M 26 42 L 36 52 L 56 30"
                            fill="none"
                            stroke="var(--brand-primary, var(--c-accent))"
                            strokeWidth="4.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                                filter: "drop-shadow(0 0 8px rgba(var(--c-accent-rgb),0.85))",
                                strokeDasharray: 50,
                                strokeDashoffset: 50,
                                animation: "shop-success-draw .7s cubic-bezier(.22,1,.36,1) .35s forwards",
                            }}
                        />
                    </svg>
                </div>

                {/* Headline */}
                <h1 ref={headlineRef} style={S.headline}>
                    {/* split por PALABRAS (cada una nowrap) → el salto de línea
                        cae solo entre palabras, nunca a mitad de una (antes cada
                        char era inline-block y cortaba "CO MPRA"). Los chars siguen
                        siendo spans [data-success-char] para la animación GSAP. */}
                    {headlineText.split(" ").map((word, wi, arr) => (
                        <Fragment key={wi}>
                            <span style={S.headlineWord}>
                                {word.split("").map((ch, ci) => (
                                    <span key={ci} data-success-char style={S.headlineChar}>{ch}</span>
                                ))}
                            </span>
                            {wi < arr.length - 1 ? " " : null}
                        </Fragment>
                    ))}
                </h1>

                {/* Sub */}
                <p ref={subRef} style={S.sub}>{subText}</p>

                {/* Flow steps — sólo cuando el pago/orden está confirmada */}
                {flowSteps.length > 0 && (
                    <div ref={flowRef} style={S.flow}>
                        {flowSteps.map((step, i) => (
                            <div
                                key={i}
                                data-flow-step
                                style={S.flowStep(step.done, step.active)}
                            >
                                <div style={S.flowIcon(step.done, step.active)}>{step.icon}</div>
                                <div style={S.flowBody}>
                                    <div style={S.flowTitle(step.done, step.active)}>{step.title}</div>
                                    <div style={S.flowDesc}>{step.desc}</div>
                                </div>
                                {i < flowSteps.length - 1 && (
                                    <div style={S.flowConnector(step.done)} aria-hidden="true" />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Order box */}
                {orderParam && (
                    <div ref={orderBoxRef} style={S.orderBox}>
                        <div style={S.orderLabel}>Número de orden</div>
                        <div style={S.orderId}>{orderParam}</div>
                        {status && (
                            <div style={S.statusBadge(isPaid ? "paid" : "pending")}>
                                {isPaid ? "✓ Pagado" : isPending ? "⏳ Pendiente MP" : "📋 En revisión"}
                            </div>
                        )}
                    </div>
                )}

                {/* Tracking de envío — visible cuando el pedido fue despachado */}
                {order?.tracking_number && (
                    <div style={{ marginTop: 18, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: "var(--r-3,14px)", padding: "20px", textAlign: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--c-accent-2)", marginBottom: 8 }}>
                            🚚 Tu envío está en camino
                        </div>
                        <div style={{ fontSize: 13, color: "var(--c-text-2)" }}>Seguimiento{order.carrier_label ? ` · ${order.carrier_label}` : ""}</div>
                        <div style={{ fontFamily: "monospace", fontSize: 19, fontWeight: 900, color: "var(--c-text)", margin: "6px 0 14px", letterSpacing: ".02em" }}>{order.tracking_number}</div>
                        {order.tracking_url
                            ? <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: "var(--c-accent-2)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 14, padding: "12px 28px", borderRadius: "var(--r-pill,999px)" }}>Seguir mi envío →</a>
                            : <div style={{ fontSize: 13, color: "var(--c-text-2)" }}>Coordinamos la entrega con vos por WhatsApp.</div>}
                    </div>
                )}

                {/* CTAs */}
                <div ref={ctaRowRef} style={S.ctaRow}>
                    <Link to="/shop" style={S.btn}>Seguir comprando</Link>
                    <Link to="/inicio" style={S.btnGhost}>Volver al inicio</Link>
                </div>

                <p style={S.fineprint}>
                    Cualquier consulta, escribinos por WhatsApp.
                    Guardá tu número de orden para referencias futuras.
                </p>
            </div>

            <style>{`
                @keyframes shop-success-draw {
                    to { stroke-dashoffset: 0; }
                }
            `}</style>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const S = {
    shell: {
        minHeight: "100vh",
        background: "var(--brand-bg, var(--c-bg))",
        color: "var(--brand-text, var(--c-text))",
        fontFamily: "var(--brand-font, 'Gotham', system-ui, sans-serif)",
        padding: "60px 20px",
        display: "grid", placeItems: "center",
        position: "relative", overflow: "hidden",
    },
    card: {
        position: "relative",
        maxWidth: 580, width: "100%",
        padding: "60px 40px 48px",
        background: "rgba(255,255,255,.03)",
        border: "1px solid rgba(var(--c-accent-rgb),.22)",
        borderRadius: 24,
        textAlign: "center",
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6), 0 0 60px -20px rgba(var(--c-accent-rgb),0.18)",
        backdropFilter: "blur(14px)",
        overflow: "hidden",
    },
    halo: {
        position: "absolute",
        top: "20%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 420, height: 420,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(var(--c-accent-rgb),0.45) 0%, rgba(46,143,110,0.18) 30%, transparent 65%)",
        filter: "blur(40px)",
        pointerEvents: "none",
        zIndex: 0,
    },
    confettiWrap: {
        position: "absolute",
        top: "20%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 0, height: 0,
        pointerEvents: "none",
        zIndex: 1,
    },
    confettiParticle: {
        position: "absolute",
        top: 0, left: 0,
        borderRadius: "50%",
        boxShadow: "0 0 12px currentColor",
    },

    checkWrap: {
        position: "relative",
        zIndex: 2,
        display: "inline-block",
        marginBottom: 24,
    },
    checkSvg: { display: "block" },
    freeBadge: {
        position: "absolute",
        top: -10, right: -28,
        padding: "5px 12px", borderRadius: 999,
        background: "linear-gradient(135deg, var(--c-accent-2), #2E8F6E)",
        color: "#fff",
        fontSize: 11, fontWeight: 900, letterSpacing: ".14em",
        boxShadow: "0 8px 18px rgba(37,211,102,0.55)",
        transform: "rotate(8deg)",
        zIndex: 3,
    },

    headline: {
        position: "relative", zIndex: 2,
        margin: "0 0 14px",
        fontFamily: "'Gotham', sans-serif",
        fontSize: "clamp(1.35rem, 2.8vw, 1.95rem)",
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "-0.01em",
        lineHeight: 1.12,
        paddingBottom: "0.06em",
    },
    // Cada palabra es un bloque nowrap → el wrap cae solo en los espacios.
    headlineWord: {
        display: "inline-block",
        whiteSpace: "nowrap",
    },
    headlineChar: {
        display: "inline-block",
        willChange: "transform, opacity",
    },

    sub: {
        position: "relative", zIndex: 2,
        margin: "0 auto 28px",
        maxWidth: 460,
        color: "rgba(var(--c-text-rgb),.78)",
        fontSize: 15, lineHeight: 1.55,
    },

    flow: {
        position: "relative", zIndex: 2,
        margin: "8px auto 28px",
        maxWidth: 460,
        textAlign: "left",
        display: "flex", flexDirection: "column",
        gap: 0,
    },
    flowStep: (done, active) => ({
        position: "relative",
        display: "grid",
        gridTemplateColumns: "44px 1fr",
        gap: 14,
        alignItems: "flex-start",
        padding: "12px 0",
        opacity: done ? 1 : active ? 1 : 0.65,
    }),
    flowIcon: (done, active) => ({
        width: 36, height: 36,
        borderRadius: "50%",
        display: "grid", placeItems: "center",
        fontSize: 16,
        background: done
            ? "linear-gradient(135deg, var(--c-accent-2) 0%, #2E8F6E 100%)"
            : active
                ? "rgba(var(--c-accent-rgb),0.16)"
                : "rgba(255,255,255,0.05)",
        border: done
            ? "1px solid rgba(var(--c-accent-rgb),0.5)"
            : active
                ? "1px solid rgba(var(--c-accent-rgb),0.4)"
                : "1px solid var(--c-border-2)",
        color: done ? "#07130c" : active ? "var(--brand-primary, var(--c-accent))" : "rgba(var(--c-text-rgb),0.55)",
        fontWeight: 900,
        boxShadow: done
            ? "0 6px 16px -4px rgba(46,143,110,0.45)"
            : active
                ? "0 0 0 4px rgba(var(--c-accent-rgb),0.10)"
                : "none",
        flexShrink: 0,
        position: "relative",
        zIndex: 1,
    }),
    flowBody: { paddingTop: 6 },
    flowTitle: (done, active) => ({
        fontSize: 14,
        fontWeight: done || active ? 800 : 700,
        color: done || active ? "var(--brand-text, var(--c-text))" : "rgba(var(--c-text-rgb),0.7)",
        letterSpacing: "0.01em",
        marginBottom: 3,
    }),
    flowDesc: {
        fontSize: 13,
        color: "rgba(var(--c-text-rgb),0.62)",
        lineHeight: 1.5,
    },
    flowConnector: (done) => ({
        position: "absolute",
        top: 48,
        left: 17, // 36/2 - 1px del border
        bottom: -12,
        width: 2,
        background: done
            ? "linear-gradient(180deg, rgba(46,143,110,0.55), rgba(var(--c-accent-rgb),0.22))"
            : "rgba(255,255,255,0.08)",
        zIndex: 0,
    }),

    orderBox: {
        position: "relative", zIndex: 2,
        display: "inline-block",
        padding: "16px 22px",
        margin: "0 auto 24px",
        background: "rgba(255,255,255,.05)",
        border: "1px dashed rgba(var(--c-accent-rgb),.3)",
        borderRadius: 14,
        textAlign: "left",
    },
    orderLabel: {
        fontSize: 10, fontWeight: 800, letterSpacing: ".24em",
        textTransform: "uppercase",
        color: "rgba(var(--c-text-rgb),.55)",
        marginBottom: 6,
    },
    orderId: {
        fontSize: 22, fontWeight: 900,
        color: "var(--brand-primary, var(--c-accent))",
        letterSpacing: ".04em",
        fontFamily: "monospace",
    },
    statusBadge: (kind) => ({
        display: "inline-block",
        marginTop: 10,
        padding: "4px 12px", borderRadius: 999,
        fontSize: 10, fontWeight: 800, letterSpacing: ".18em",
        textTransform: "uppercase",
        background: kind === "paid" ? "rgba(var(--c-accent-rgb),.18)" : "rgba(252,211,77,.14)",
        color: kind === "paid" ? "var(--brand-primary, var(--c-accent))" : "var(--c-warning)",
    }),

    ctaRow: {
        position: "relative", zIndex: 2,
        display: "flex", flexWrap: "wrap", gap: 10,
        justifyContent: "center",
        marginTop: 8,
    },
    btn: {
        padding: "13px 24px", borderRadius: 999,
        background: "linear-gradient(135deg, var(--c-accent-2) 0%, #2E8F6E 100%)",
        color: "#fff", textDecoration: "none",
        fontFamily: "inherit", fontWeight: 800, fontSize: 13,
        letterSpacing: ".06em", textTransform: "uppercase",
        boxShadow: "0 14px 30px -8px rgba(46,143,110,.55)",
    },
    btnGhost: {
        padding: "13px 24px", borderRadius: 999,
        background: "transparent",
        border: "1px solid rgba(255,255,255,.18)",
        color: "rgba(var(--c-text-rgb),.85)", textDecoration: "none",
        fontFamily: "inherit", fontWeight: 700, fontSize: 13,
        letterSpacing: ".06em", textTransform: "uppercase",
    },

    fineprint: {
        position: "relative", zIndex: 2,
        marginTop: 26,
        fontSize: 12, color: "rgba(var(--c-text-rgb),.45)",
        lineHeight: 1.55,
    },
};
