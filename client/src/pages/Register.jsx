import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBranding } from "../lib/branding.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

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
        .rg-root{min-height:100vh;min-height:100svh;background:#020307;color:#f0ece3;display:grid;grid-template-columns:.95fr 1.05fr;font-family:'Gotham', sans-serif;overflow:hidden;position:relative}
        .rg-root::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");opacity:.026;pointer-events:none;z-index:9}

        /* LEFT — form */
        .rg-left{position:relative;display:flex;align-items:center;justify-content:center;padding:48px 5vw;background:#020307;border-right:1px solid rgba(240,236,227,.07)}
        .rg-num{position:absolute;font-family:'Gotham', sans-serif;font-weight:900;font-size:90px;line-height:.85;color:transparent;-webkit-text-stroke:1px rgba(var(--brand-primary-rgb),.05);pointer-events:none;user-select:none;top:14px;left:14px}

        .rg-card{width:100%;max-width:460px;opacity:0;transform:translateY(24px);transition:all .9s cubic-bezier(.2,.8,.2,1) .25s}
        .rg-card.in{opacity:1;transform:translateY(0)}
        .rg-eyebrow{font-family:'Gotham', sans-serif;font-weight:700;font-size:10px;letter-spacing:2.6px;text-transform:uppercase;color:var(--brand-accent, #ff5500);display:flex;align-items:center;gap:12px;margin-bottom:18px}
        .rg-eyebrow::before{content:'';width:28px;height:1px;background:var(--brand-accent, #ff5500)}
        .rg-title{font-family:'Gotham', sans-serif;font-weight:900;font-size:clamp(40px,5.4vw,64px);line-height:.94;letter-spacing:-0.025em;color:#f0ece3;margin-bottom:8px}
        .rg-title em{font-style:normal;color:var(--brand-primary, #f5e03a)}
        .rg-desc{font-size:14px;font-weight:400;color:rgba(240,236,227,.55);line-height:1.7;margin-bottom:32px}

        .rg-field{margin-bottom:16px}
        .rg-field label{display:block;font-family:'Gotham', sans-serif;font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(240,236,227,.4);margin-bottom:9px}
        .rg-field label.hot{color:var(--brand-primary, #f5e03a)}
        .rg-input{width:100%;background:rgba(255,255,255,.025);border:1px solid rgba(240,236,227,.08);color:#f0ece3;font-family:'Gotham', sans-serif;font-weight:400;font-size:15px;padding:14px 18px;outline:none;transition:all .25s;border-radius:0}
        .rg-input:focus{border-color:rgba(var(--brand-primary-rgb),.5);background:rgba(var(--brand-primary-rgb),.04);box-shadow:0 0 0 1px rgba(var(--brand-primary-rgb),.2)}
        .rg-input::placeholder{color:rgba(240,236,227,.18)}
        .rg-input.code{font-family:'Gotham', sans-serif;font-weight:700;font-size:18px;letter-spacing:4px;text-align:center;border-color:rgba(var(--brand-primary-rgb),.25);background:rgba(var(--brand-primary-rgb),.02)}
        .rg-input.code:focus{border-color:var(--brand-primary, #f5e03a);background:rgba(var(--brand-primary-rgb),.06)}

        .rg-btn{width:100%;font-family:'Gotham', sans-serif;font-size:13px;font-weight:900;letter-spacing:2.2px;text-transform:uppercase;background:var(--brand-primary, #f5e03a);color:#000;border:none;padding:18px 28px;cursor:pointer;transition:all .25s;display:inline-flex;align-items:center;justify-content:center;gap:10px;margin-top:12px;position:relative}
        .rg-btn:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(var(--brand-primary-rgb),.18);background:var(--brand-primary, #fff7a0)}
        .rg-btn:active{transform:translateY(0)}
        .rg-btn:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
        .rg-btn .arr{transition:transform .3s}
        .rg-btn:hover .arr{transform:translateX(4px)}

        .rg-err{margin-bottom:18px;padding:12px 16px;background:rgba(var(--brand-accent-rgb),.06);border:1px solid rgba(var(--brand-accent-rgb),.18);color:#ffb07a;font-size:13px;font-weight:500;display:flex;align-items:center;gap:10px}
        .rg-err::before{content:'⚠';color:var(--brand-accent, #ff5500);font-size:14px}

        .rg-divider{display:flex;align-items:center;gap:14px;margin:30px 0 20px;font-family:'Gotham', sans-serif;font-weight:700;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:rgba(240,236,227,.25)}
        .rg-divider::before,.rg-divider::after{content:'';flex:1;height:1px;background:rgba(240,236,227,.07)}
        .rg-back{display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:rgba(240,236,227,.4)}
        .rg-back a{color:var(--brand-primary, #f5e03a);font-weight:700;text-decoration:none;border-bottom:1px solid transparent;transition:border .2s;cursor:pointer}
        .rg-back a:hover{border-bottom-color:var(--brand-primary, #f5e03a)}

        /* SUCCESS */
        .rg-success{text-align:center;padding:24px 0}
        .rg-check-wrap{width:96px;height:96px;border-radius:50%;background:rgba(34,197,94,.08);border:1.5px solid rgba(34,197,94,.35);margin:0 auto 28px;display:flex;align-items:center;justify-content:center;font-size:44px;animation:rgPulse 2.4s ease-in-out infinite}
        @keyframes rgPulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.25)}50%{box-shadow:0 0 0 16px rgba(34,197,94,0)}}
        .rg-success-title{font-family:'Gotham', sans-serif;font-weight:900;font-size:48px;line-height:.96;letter-spacing:-.02em;margin-bottom:14px}
        .rg-success-title em{font-style:normal;color:#22c55e}
        .rg-success-desc{font-size:14px;font-weight:400;color:rgba(240,236,227,.55);line-height:1.85;margin-bottom:18px}
        .rg-coins-pill{display:inline-flex;align-items:center;gap:10px;font-family:'Gotham', sans-serif;font-weight:700;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;padding:10px 18px;background:rgba(var(--brand-primary-rgb),.06);border:1px solid rgba(var(--brand-primary-rgb),.2);color:var(--brand-primary, #f5e03a);margin-bottom:30px}
        .rg-coins-pill b{font-family:'Gotham', sans-serif;font-weight:900;font-size:18px;letter-spacing:0}

        /* RIGHT — branding panel */
        .rg-right{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:48px 56px;background:linear-gradient(135deg,#07090f 0%,#020307 70%)}
        .rg-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px);background-size:64px 64px;z-index:1;pointer-events:none}
        .rg-watermark{position:absolute;font-family:'Gotham', sans-serif;font-weight:900;font-size:clamp(220px,28vw,420px);line-height:.78;letter-spacing:-6px;color:transparent;-webkit-text-stroke:1px rgba(var(--brand-primary-rgb),.04);pointer-events:none;z-index:1;bottom:-60px;left:-40px;user-select:none}
        .rg-logo-img{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60%;max-width:520px;opacity:.06;filter:invert(1);pointer-events:none;user-select:none;z-index:1}
        .rg-glow{position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(var(--brand-primary-rgb),.04) 0%,transparent 70%);top:50%;right:-180px;transform:translateY(-50%);z-index:1;pointer-events:none}
        .rg-right-inner{position:relative;z-index:3;display:flex;flex-direction:column;height:100%;justify-content:space-between}

        .rg-top{display:flex;align-items:center;justify-content:space-between}
        .rg-logo{font-family:'Gotham', sans-serif;font-weight:900;font-size:18px;letter-spacing:3px;display:flex;align-items:center;gap:10px}
        .rg-logo .y{color:var(--brand-primary, #f5e03a)}
        .rg-dot{width:6px;height:6px;border-radius:50%;background:var(--brand-accent, #ff5500);animation:rgdot 2s ease-in-out infinite}
        @keyframes rgdot{0%,100%{opacity:1}50%{opacity:.2}}
        .rg-back-link{font-family:'Gotham', sans-serif;font-weight:700;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:rgba(240,236,227,.4);text-decoration:none;cursor:pointer;border:none;background:none}
        .rg-back-link:hover{color:var(--brand-primary, #f5e03a)}

        .rg-pitch{position:relative}
        .rg-pitch h2{font-family:'Gotham', sans-serif;font-weight:900;font-size:clamp(64px,9vw,140px);line-height:.86;letter-spacing:-0.04em;margin:0;color:#f0ece3}
        .rg-pitch .yl{color:var(--brand-primary, #f5e03a)}
        .rg-pitch-line{overflow:hidden;display:block}
        .rg-pitch-line span{display:inline-block;transform:translateY(110%);transition:transform 1s cubic-bezier(.2,.8,.2,1)}
        .rg-pitch.in .rg-pitch-line:nth-child(1) span{transform:translateY(0);transition-delay:.05s}
        .rg-pitch.in .rg-pitch-line:nth-child(2) span{transform:translateY(0);transition-delay:.18s}
        .rg-pitch-sub{font-size:15px;font-weight:400;color:rgba(240,236,227,.55);line-height:1.85;max-width:380px;margin-top:32px;opacity:0;transform:translateY(16px);transition:all .8s ease .55s}
        .rg-pitch.in + .rg-pitch-sub{opacity:1;transform:translateY(0)}

        .rg-perks{display:flex;flex-direction:column;gap:14px}
        .rg-perk{display:flex;align-items:center;gap:14px;font-size:13px;color:rgba(240,236,227,.55);font-weight:400}
        .rg-perk b{font-family:'Gotham', sans-serif;font-weight:900;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:var(--brand-primary, #f5e03a);min-width:54px}
        .rg-perk-line{flex:1;height:1px;background:linear-gradient(90deg,rgba(var(--brand-primary-rgb),.25),rgba(var(--brand-primary-rgb),0))}

        @media (max-width: 980px){
          .rg-root{grid-template-columns:1fr}
          .rg-right{padding:32px 28px;min-height:280px;order:-1}
          .rg-left{padding:40px 24px;border-right:none}
          .rg-perks{display:none}
        }
        @media (max-width: 600px){
          .rg-pitch h2{font-size:60px;letter-spacing:-1.5px}
          .rg-title{font-size:40px}
          .rg-success-title{font-size:44px}
        }
      `}</style>

      {/* LEFT — form */}
      <div className="rg-left">
        <div className="rg-num">02</div>
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
              <div style={{ marginTop: 18, fontSize: 12, color: "rgba(240,236,227,.45)" }}>
                {resendStatus === "cooldown" ? (
                  <span>Mail reenviado{resendCooldown > 0 ? `. Podés reintentar en ${resendCooldown}s.` : "."}</span>
                ) : (
                  <button type="button" onClick={resendVerification} disabled={resendStatus === "sending"}
                    style={{ background: "none", border: "none", color: "var(--brand-primary, #f5e03a)", cursor: "pointer", fontFamily: "inherit", fontSize: 12, padding: 0, textDecoration: "underline" }}>
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

      {/* RIGHT — branding */}
      <div className="rg-right">
        <div className="rg-grid" />
        <div className="rg-watermark">PORTAL</div>
        <img src="/icons/icon.svg" alt="" className="rg-logo-img" />
        <div className="rg-glow" />
        <div className="rg-right-inner">
          <div className="rg-top">
            <div className="rg-logo">{(branding.name || "Mi Portal").toUpperCase()}</div>
            <button className="rg-back-link" onClick={() => navigate("/")}>← Volver al login</button>
          </div>

          <div ref={titleRef} className="rg-pitch">
            <h2>
              <span className="rg-pitch-line"><span>UN PORTAL</span></span>
              <span className="rg-pitch-line"><span className="yl">PARA VOS</span></span>
            </h2>
          </div>
          <p className="rg-pitch-sub">
            Acceso completo a tus envíos, perfil, comunidad, notificaciones y Coins. Todo en un solo lugar.
          </p>

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
