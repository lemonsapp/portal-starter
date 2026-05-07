import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "lemons_onboarding_v1_dismissed";

const STEPS = [
  {
    icon: "📦",
    eyebrow: "Bienvenido",
    title: "Acá ves todos tus envíos",
    desc: "Cada paquete que importás aparece acá con tracking en tiempo real, estado, costos y documentos. Hacé click en cada envío para ver el detalle completo.",
    cta: { label: "Ver mis envíos", href: "/client/shipments" },
  },
  {
    icon: "🍋",
    eyebrow: "Programa de fidelidad",
    title: "Sumás Coins en cada envío",
    desc: "3 🍋 por kg. Bonus por monto y por primer envío. Canjealos por descuentos, kilos gratis o envíos completos sin costo. Cuanto más importás, más ganás.",
    cta: { label: "Ver mis Coins", href: "/coins" },
  },
  {
    icon: "👤",
    eyebrow: "Tu identidad",
    title: "Personalizá tu perfil",
    desc: "Avatar, banner animado, nombre con efectos, badges, logros. Cada uno construye su identidad en la comunidad — y se ve también en el chat.",
    cta: { label: "Ir a mi perfil", href: "/perfil" },
  },
];

export default function OnboardingBanner({ onClose }) {
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => wrapRef.current?.classList.add("ob-in"), 60);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setClosing(true);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setTimeout(() => onClose?.(), 300);
  }

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div ref={wrapRef} className={"ob-root" + (closing ? " ob-out" : "")}>
      <style>{`
        .ob-root{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,3,7,.85);backdrop-filter:blur(16px);opacity:0;transition:opacity .35s cubic-bezier(.2,.8,.2,1)}
        .ob-root.ob-in{opacity:1}
        .ob-root.ob-out{opacity:0}
        .ob-card{position:relative;width:100%;max-width:560px;background:linear-gradient(135deg,#07090f 0%,#020307 100%);border:1px solid rgba(245,224,58,.18);padding:42px 40px 36px;transform:translateY(20px) scale(.96);transition:transform .45s cubic-bezier(.34,1.56,.64,1);overflow:hidden}
        .ob-root.ob-in .ob-card{transform:translateY(0) scale(1)}
        .ob-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a));background-size:200% 100%;animation:obBar 3s linear infinite}
        @keyframes obBar{from{background-position:0 0}to{background-position:200% 0}}
        .ob-card::after{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(245,224,58,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(245,224,58,.018) 1px,transparent 1px);background-size:48px 48px;pointer-events:none;opacity:.5}
        .ob-skip{position:absolute;top:16px;right:16px;background:transparent;border:none;color:rgba(240,236,227,.45);font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;padding:6px 10px;transition:color .2s;z-index:2}
        .ob-skip:hover{color:var(--brand-primary, #f5e03a)}
        .ob-icon-wrap{position:relative;z-index:1;width:96px;height:96px;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;font-size:48px;background:radial-gradient(circle,rgba(245,224,58,.12) 0%,transparent 70%);animation:obFloat 4s ease-in-out infinite}
        @keyframes obFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .ob-eyebrow{position:relative;z-index:1;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:var(--brand-accent, #ff5500);display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:14px}
        .ob-eyebrow::before,.ob-eyebrow::after{content:'';width:24px;height:1px;background:var(--brand-accent, #ff5500)}
        .ob-title{position:relative;z-index:1;font-family:'Bebas Neue',sans-serif;font-size:clamp(36px,5vw,52px);line-height:.95;letter-spacing:-1px;color:#f0ece3;text-align:center;margin-bottom:18px}
        .ob-desc{position:relative;z-index:1;font-size:15px;font-weight:300;color:rgba(240,236,227,.55);line-height:1.75;text-align:center;max-width:440px;margin:0 auto 32px}
        .ob-actions{position:relative;z-index:1;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
        .ob-btn{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;border:none;padding:14px 28px;cursor:pointer;transition:all .25s;display:inline-flex;align-items:center;gap:8px}
        .ob-btn.primary{background:var(--brand-primary, #f5e03a);color:#000}
        .ob-btn.primary:hover{background:var(--brand-primary, #fff7a0);transform:translateY(-2px);box-shadow:0 12px 32px rgba(245,224,58,.22)}
        .ob-btn.secondary{background:transparent;color:rgba(240,236,227,.55);border:1px solid rgba(240,236,227,.12)}
        .ob-btn.secondary:hover{border-color:rgba(245,224,58,.3);color:var(--brand-primary, #f5e03a)}
        .ob-dots{position:relative;z-index:1;display:flex;gap:8px;justify-content:center;margin-bottom:6px}
        .ob-dot{width:24px;height:3px;background:rgba(240,236,227,.1);transition:background .3s,width .3s}
        .ob-dot.on{background:var(--brand-primary, #f5e03a);width:36px;box-shadow:0 0 8px rgba(245,224,58,.4)}
        .ob-counter{position:relative;z-index:1;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(240,236,227,.3);text-align:center}
        @media(max-width:600px){
          .ob-card{padding:36px 24px 28px}
          .ob-title{font-size:32px}
          .ob-icon-wrap{width:80px;height:80px;font-size:40px;margin-bottom:18px}
        }
      `}</style>

      <div className="ob-card">
        <button className="ob-skip" onClick={dismiss}>Skip</button>

        <div className="ob-icon-wrap">{s.icon}</div>
        <div className="ob-eyebrow">{s.eyebrow}</div>
        <h2 className="ob-title">{s.title}</h2>
        <p className="ob-desc">{s.desc}</p>

        <div className="ob-actions">
          {step > 0 && (
            <button className="ob-btn secondary" onClick={() => setStep(step - 1)}>← Atrás</button>
          )}
          {!isLast && (
            <button className="ob-btn primary" onClick={() => setStep(step + 1)}>Siguiente →</button>
          )}
          {isLast && (
            <>
              <button className="ob-btn secondary" onClick={dismiss}>Quizás después</button>
              <button className="ob-btn primary" onClick={() => { dismiss(); navigate(s.cta.href); }}>{s.cta.label} →</button>
            </>
          )}
        </div>

        <div className="ob-dots">
          {STEPS.map((_, i) => (
            <div key={i} className={"ob-dot" + (i === step ? " on" : "")} />
          ))}
        </div>
        <div className="ob-counter">Paso {step + 1} de {STEPS.length}</div>
      </div>
    </div>
  );
}

/**
 * Hook que decide si mostrar el onboarding.
 * Mostrar solo si: nunca se cerró antes (localStorage) + el user es client (no staff).
 */
export function useShouldShowOnboarding(user) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!user) return;
    const isStaff = user.role === "admin" || user.role === "operator";
    if (isStaff) return;
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setShow(true);
    } catch {}
  }, [user?.id]);
  return [show, () => setShow(false)];
}
