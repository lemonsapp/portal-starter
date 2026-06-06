import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import RotatingAuthBg from "../components/RotatingAuthBg";
import { useBranding } from "../lib/branding.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export default function Register() {
  const navigate = useNavigate();
  const branding = useBranding();
  const [searchParams] = useSearchParams();
  const referrer = searchParams.get("r") || searchParams.get("ref") || "";
  const [step, setStep] = useState("form"); // form | success
  const [form, setForm] = useState({ invite_code:"", name:"", email:"", password:"", confirm:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendStatus, setResendStatus] = useState("idle"); // idle | sending | sent | cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const titleRef = useRef(null);
  const cardRef = useRef(null);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  async function resendVerification() {
    if (resendStatus !== "idle") return;
    setResendStatus("sending");
    try {
      await fetch(`${API}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
    } catch {}
    setResendStatus("cooldown");
    setResendCooldown(60);
  }

  useEffect(() => {
    if (resendCooldown <= 0) {
      if (resendStatus === "cooldown") setResendStatus("idle");
      return;
    }
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown, resendStatus]);

  async function submit() {
    setError("");
    if (!form.invite_code.trim()) return setError("Ingresá tu código de invitación");
    if (!form.name.trim()) return setError("Ingresá tu nombre");
    if (!form.email.trim()) return setError("Ingresá tu email");
    if (form.password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");
    if (form.password !== form.confirm) return setError("Las contraseñas no coinciden");

    setLoading(true);
    try {
      const body = { invite_code: form.invite_code, name: form.name, email: form.email, password: form.password };
      if (referrer) body.referrer = referrer;
      const r = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) return setError(d.error || "Error al registrarse");
      setStep("success");
    } catch { setError("Error de red"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      titleRef.current?.classList.add("in");
      cardRef.current?.classList.add("in");
    }, 80);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="rg-root">
      <style>{`
        /* ══════════════════════════════════════════════════════════════════
           REGISTER — minimalista 2026-05-23, paridad con Login
           Form a la izquierda, hero a la derecha (espejo).
           ══════════════════════════════════════════════════════════════════ */
        .rg-root {
          min-height: 100vh; min-height: 100svh;
          background: var(--c-bg, #06070A);
          color: var(--c-text, #F5F2EB);
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: var(--f-body, 'Gotham', sans-serif);
          overflow: hidden;
          position: relative;
        }

        /* BG rotativo: ver components/RotatingAuthBg.jsx (compartido con
           Login). Los paneles van translúcidos + z-index 1 encima. */

        /* ── LEFT: form (vidrio oscuro sobre el fondo rotativo) ── */
        .rg-left {
          position: relative; z-index: 1;
          display: flex; align-items: center; justify-content: center;
          padding: clamp(36px, 5vw, 64px);
          background: rgba(6,7,10,.62);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .rg-card {
          width: 100%; max-width: 440px;
          opacity: 0; transform: translateY(16px);
          transition: opacity .8s var(--ease-out), transform .8s var(--ease-out);
        }
        .rg-card.in { opacity: 1; transform: translateY(0); }
        .rg-eyebrow {
          font-family: var(--f-body); font-weight: 700;
          font-size: 11px; letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--c-accent, #A7F5C8);
          display: inline-flex; align-items: center; gap: 12px;
          margin-bottom: 16px;
        }
        .rg-eyebrow::before {
          content: ''; width: 24px; height: 1px;
          background: var(--c-accent, #A7F5C8); opacity: .7;
        }
        .rg-title {
          font-family: var(--f-display, 'Gotham', sans-serif);
          font-weight: 900;
          font-size: clamp(36px, 4.6vw, 54px);
          line-height: 0.98;
          letter-spacing: -0.025em;
          color: var(--c-text);
          margin-bottom: 10px;
        }
        .rg-title em {
          font-style: normal; text-transform: uppercase;
          font-family: var(--f-display, 'Gotham', sans-serif);
          font-weight: 400;
          color: var(--c-accent, #A7F5C8);
          letter-spacing: -0.015em;
        }
        .rg-desc {
          font-size: 14px; line-height: 1.65;
          color: var(--c-text-2, rgba(245,242,235,.72));
          margin-bottom: 32px;
        }

        .rg-field { margin-bottom: 14px; }
        .rg-field label {
          display: block;
          font-family: var(--f-body); font-weight: 700;
          font-size: 10px; letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--c-text-3, rgba(245,242,235,.5));
          margin-bottom: 8px;
        }
        .rg-field label.hot { color: var(--c-accent, #A7F5C8); }
        .rg-input {
          width: 100%;
          background: var(--c-surface, #0E1014);
          border: 1px solid var(--c-border-2, rgba(255,255,255,.10));
          color: var(--c-text, #F5F2EB);
          font-family: inherit; font-weight: 400;
          font-size: 15px; padding: 13px 16px;
          outline: none;
          border-radius: var(--r-2, 10px);
          transition:
            border-color var(--dur-base, .24s) var(--ease-out),
            background var(--dur-base, .24s) var(--ease-out),
            box-shadow var(--dur-base, .24s) var(--ease-out);
        }
        .rg-input:hover { border-color: var(--c-border-3, rgba(255,255,255,.16)); }
        .rg-input:focus {
          border-color: var(--c-accent, #A7F5C8);
          background: var(--c-surface-2, #161A20);
          box-shadow: 0 0 0 3px rgba(167,245,200,.18);
        }
        .rg-input::placeholder { color: var(--c-text-3, rgba(245,242,235,.5)); }
        .rg-input.code {
          font-family: var(--f-mono, ui-monospace, monospace);
          font-weight: 700; font-size: 17px;
          letter-spacing: 0.32em; text-align: center;
          border-color: rgba(167,245,200,.30);
          background: rgba(167,245,200,.04);
        }
        .rg-input.code:focus {
          border-color: var(--c-accent, #A7F5C8);
          background: rgba(167,245,200,.07);
        }

        .rg-btn {
          width: 100%;
          font-family: inherit;
          font-size: 13px; font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          background: linear-gradient(135deg, var(--c-accent-2, #25D366) 0%, #1AAE54 100%);
          color: #07130c;
          border: 1px solid rgba(167,245,200,.45);
          padding: 15px 26px;
          cursor: pointer;
          border-radius: var(--r-pill, 999px);
          transition:
            transform var(--dur-fast, .15s) ease,
            box-shadow var(--dur-base, .24s) ease;
          display: inline-flex; align-items: center; justify-content: center; gap: 12px;
          margin-top: 14px;
          box-shadow:
            0 14px 30px -6px rgba(46,143,110,.55),
            0 0 0 1px rgba(167,245,200,.20) inset;
        }
        .rg-btn:hover {
          transform: translateY(-2px);
          box-shadow:
            0 22px 40px -8px rgba(46,143,110,.7),
            0 0 0 2px rgba(167,245,200,.6),
            0 0 60px -10px rgba(167,245,200,.45);
        }
        .rg-btn:active { transform: translateY(0); }
        .rg-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
        .rg-btn .arr { transition: transform var(--dur-base, .24s) ease; }
        .rg-btn:hover .arr { transform: translateX(6px); }

        .rg-err {
          margin-bottom: 16px; padding: 13px 16px;
          background: rgba(252,165,165,.08);
          border: 1px solid rgba(252,165,165,.25);
          color: var(--c-danger, #FCA5A5);
          font-size: 13px;
          border-radius: var(--r-2, 10px);
          display: flex; align-items: center; gap: 10px;
        }
        .rg-err::before { content: '⚠'; font-size: 14px; }

        .rg-divider {
          display: flex; align-items: center; gap: 14px;
          margin: 26px 0 18px;
          font-family: var(--f-body); font-weight: 700;
          font-size: 10px; letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--c-text-3, rgba(245,242,235,.5));
        }
        .rg-divider::before, .rg-divider::after {
          content: ''; flex: 1; height: 1px;
          background: var(--c-border, rgba(255,255,255,.06));
        }
        .rg-back {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; font-size: 13px;
          color: var(--c-text-2, rgba(245,242,235,.72));
        }
        .rg-back a {
          color: var(--c-accent, #A7F5C8);
          font-weight: 700; text-decoration: none; cursor: pointer;
          border-bottom: 1px solid transparent;
          transition: border-color var(--dur-fast, .15s) ease;
        }
        .rg-back a:hover { border-bottom-color: var(--c-accent, #A7F5C8); }

        /* ── SUCCESS state ── */
        .rg-success { text-align: center; padding: 16px 0; }
        .rg-check-wrap {
          width: 88px; height: 88px; border-radius: 50%;
          background: rgba(167,245,200,.08);
          border: 1.5px solid rgba(167,245,200,.45);
          color: var(--c-accent, #A7F5C8);
          margin: 0 auto 26px;
          display: flex; align-items: center; justify-content: center;
          font-size: 40px;
          animation: rgPulse 2.4s ease-in-out infinite;
        }
        @keyframes rgPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(167,245,200,.30); }
          50%      { box-shadow: 0 0 0 16px rgba(167,245,200,0); }
        }
        .rg-success-title {
          font-family: var(--f-display);
          font-weight: 900; font-size: 44px;
          line-height: 0.98; letter-spacing: -.02em;
          margin-bottom: 12px;
        }
        .rg-success-title em {
          font-style: normal; text-transform: uppercase;
          font-family: var(--f-display, 'Gotham', sans-serif);
          font-weight: 400;
          color: var(--c-accent, #A7F5C8);
        }
        .rg-success-desc {
          font-size: 14px; line-height: 1.75;
          color: var(--c-text-2, rgba(245,242,235,.72));
          margin-bottom: 18px;
        }
        .rg-coins-pill {
          display: inline-flex; align-items: center; gap: 10px;
          font-family: var(--f-body); font-weight: 700;
          font-size: 11px; letter-spacing: 0.18em;
          text-transform: uppercase;
          padding: 9px 18px;
          background: rgba(167,245,200,.06);
          border: 1px solid rgba(167,245,200,.25);
          color: var(--c-accent, #A7F5C8);
          border-radius: var(--r-pill, 999px);
          margin-bottom: 28px;
        }
        .rg-coins-pill b { font-weight: 900; font-size: 16px; letter-spacing: 0; }

        /* ── RIGHT: branding hero ── */
        .rg-right {
          position: relative; z-index: 1;
          overflow: hidden;
          display: flex; flex-direction: column;
          justify-content: space-between;
          padding: clamp(36px, 5vw, 64px);
          background: linear-gradient(
            205deg,
            rgba(6,7,10,.42) 0%,
            rgba(14,16,20,.28) 40%,
            rgba(10,24,20,.45) 100%
          );
          border-left: 1px solid var(--c-border);
        }
        .rg-right::before {
          content: ''; position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 30% 20%, rgba(167,245,200,0.12), transparent 60%),
            radial-gradient(ellipse 80% 70% at 70% 90%, rgba(46,143,110,0.08), transparent 70%);
          pointer-events: none;
        }
        .rg-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(167,245,200,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167,245,200,.025) 1px, transparent 1px);
          background-size: 64px 64px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 70% 50% at 50% 50%, black, transparent 75%);
        }
        .rg-right-inner {
          position: relative; z-index: 3;
          display: flex; flex-direction: column;
          height: 100%; justify-content: space-between;
          gap: 40px;
        }

        .rg-top { display: flex; align-items: center; justify-content: space-between; }
        .rg-logo {
          font-family: var(--f-display);
          font-weight: 900; font-size: 20px;
          letter-spacing: 0.18em;
        }
        .rg-back-link {
          font-family: var(--f-body); font-weight: 700;
          font-size: 11px; letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--c-text-2, rgba(245,242,235,.72));
          text-decoration: none; cursor: pointer;
          background: none; border: none; padding: 0;
          transition: color var(--dur-base, .24s) ease;
        }
        .rg-back-link:hover { color: var(--c-accent, #A7F5C8); }

        .rg-pitch { display: flex; flex-direction: column; gap: 18px; }
        .rg-pitch h2 {
          font-family: var(--f-display);
          font-weight: 900;
          font-size: clamp(48px, 6.5vw, 84px);
          line-height: 0.95;
          letter-spacing: -0.03em;
          margin: 0;
          color: var(--c-text);
        }
        .rg-pitch h2 em {
          font-style: normal; text-transform: uppercase;
          font-family: var(--f-display, 'Gotham', sans-serif);
          font-weight: 400;
          color: var(--c-accent, #A7F5C8);
        }
        .rg-pitch-sub {
          max-width: 420px;
          font-size: 15px; line-height: 1.6;
          color: var(--c-text-2, rgba(245,242,235,.72));
          margin: 0;
        }

        .rg-perks {
          display: flex; flex-direction: column; gap: 14px;
        }
        .rg-perk {
          display: flex; align-items: center; gap: 14px;
          font-size: 13px;
          color: var(--c-text-2, rgba(245,242,235,.72));
        }
        .rg-perk b {
          font-family: var(--f-mono, ui-monospace, monospace);
          font-weight: 700; font-size: 11px;
          letter-spacing: 0.12em;
          color: var(--c-accent, #A7F5C8);
          min-width: 26px;
        }
        .rg-perk-line {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, rgba(167,245,200,.30), rgba(167,245,200,0));
        }

        @media (max-width: 980px) {
          .rg-root { grid-template-columns: 1fr; }
          .rg-right { padding: 28px; min-height: 240px; order: -1; border-left: none; border-bottom: 1px solid var(--c-border); gap: 24px; }
          .rg-pitch h2 { font-size: clamp(34px, 9vw, 52px); }
          .rg-perks { display: none; }
        }
        @media (max-width: 600px) {
          .rg-title { font-size: 32px; }
          .rg-success-title { font-size: 36px; }
        }
      `}</style>

      <RotatingAuthBg />

      {/* LEFT — form */}
      <div className="rg-left">
        <div ref={cardRef} className="rg-card">
          {step === "success" ? (
            <div className="rg-success">
              <div className="rg-check-wrap">✓</div>
              <div className="rg-success-title">Cuenta <em>creada</em></div>
              <div className="rg-success-desc">
                Te enviamos un email de verificación.<br/>Revisá tu bandeja de entrada para activar la cuenta.
              </div>
              <div className="rg-coins-pill">🪙 <b>+15</b> Coins de bienvenida al verificar</div>
              <button onClick={() => navigate("/")} className="rg-btn">
                <span>Ir al login</span><span className="arr">→</span>
              </button>
              <div style={{ marginTop: 18, fontSize: 12, color: "var(--c-text-3, rgba(245,242,235,.5))" }}>
                {resendStatus === "cooldown" ? (
                  <span>Mail reenviado{resendCooldown > 0 ? `. Podés reintentar en ${resendCooldown}s.` : "."}</span>
                ) : (
                  <button type="button" onClick={resendVerification} disabled={resendStatus === "sending"}
                    style={{ background: "none", border: "none", color: "var(--c-accent, #A7F5C8)", cursor: "pointer", fontFamily: "inherit", fontSize: 12, padding: 0, textDecoration: "underline" }}>
                    {resendStatus === "sending" ? "Reenviando..." : "¿No te llegó? Reenviar mail"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="rg-eyebrow">Crear cuenta</div>
              <div className="rg-title">Sumate <em>al portal</em></div>
              <div className="rg-desc">Necesitás un código de invitación para registrarte. Si no tenés, consultanos por WhatsApp.</div>

              {error && <div className="rg-err">{error}</div>}

              <div className="rg-field">
                <label className="hot">🔑 Código de invitación *</label>
                <input className="rg-input code" placeholder="A1B2C3D4" value={form.invite_code}
                  onChange={e => set("invite_code", e.target.value.toUpperCase())} maxLength={16} />
              </div>

              <div className="rg-field">
                <label>Nombre completo *</label>
                <input className="rg-input" placeholder="Tu nombre" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>

              <div className="rg-field">
                <label>Email *</label>
                <input className="rg-input" type="email" placeholder="tu@email.com" value={form.email} onChange={e => set("email", e.target.value)} />
              </div>

              <div className="rg-field">
                <label>Contraseña *</label>
                <input className="rg-input" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={e => set("password", e.target.value)} />
              </div>

              <div className="rg-field">
                <label>Confirmá la contraseña *</label>
                <input className="rg-input" type="password" placeholder="Repetí la contraseña" value={form.confirm} onChange={e => set("confirm", e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()} />
              </div>

              <button onClick={submit} disabled={loading} className="rg-btn">
                <span>{loading ? "Creando cuenta..." : "Crear cuenta"}</span>
                {!loading && <span className="arr">→</span>}
              </button>

              <div className="rg-divider">o</div>
              <div className="rg-back">
                ¿Ya tenés cuenta? <a onClick={() => navigate("/")}>Iniciar sesión</a>
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT — branding hero */}
      <div className="rg-right">
        <div className="rg-grid" />
        <div className="rg-right-inner">
          <div className="rg-top">
            <div className="rg-logo">{(branding.name || "HOLISTIC").toUpperCase()}</div>
            <button className="rg-back-link" onClick={() => navigate("/")}>← Volver al login</button>
          </div>

          <div ref={titleRef} className="rg-pitch">
            <h2>Sumate al cultivo<br /><em>de la comunidad.</em></h2>
            <p className="rg-pitch-sub">
              Acceso a la línea completa Holistic, Coins, recompensas y soporte
              humano de ingenieros agrónomos. Todo en un solo lugar.
            </p>
          </div>

          <div className="rg-perks">
            <div className="rg-perk"><b>01</b> Comunidad y stories <span className="rg-perk-line" /></div>
            <div className="rg-perk"><b>02</b> Coins y recompensas <span className="rg-perk-line" /></div>
            <div className="rg-perk"><b>03</b> Chat directo con el equipo <span className="rg-perk-line" /></div>
            <div className="rg-perk"><b>04</b> Login biométrico seguro <span className="rg-perk-line" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
