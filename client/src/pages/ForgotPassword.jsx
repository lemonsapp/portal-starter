import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const cardRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => cardRef.current?.classList.add("in"), 80);
    return () => clearTimeout(t);
  }, []);

  async function submit() {
    setMsg("");
    if (!email.trim()) return setMsg("Ingresá tu email.");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) return setMsg(data?.error || "Error al enviar el link.");
      setSuccess(true);
    } catch {
      setMsg("Error de red. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fp-root">
      <style>{`
        .fp-root{min-height:100vh;min-height:100svh;background:#020307;color:#f0ece3;display:grid;grid-template-columns:1.05fr .95fr;font-family:'Barlow',sans-serif;overflow:hidden;position:relative}
        .fp-root::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");opacity:.026;pointer-events:none;z-index:9}
        .fp-left{position:relative;overflow:hidden;border-right:1px solid rgba(240,236,227,.07);display:flex;flex-direction:column;justify-content:space-between;padding:48px 56px;background:linear-gradient(135deg,#07090f 0%,#020307 70%)}
        .fp-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(245,224,58,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(245,224,58,.018) 1px,transparent 1px);background-size:64px 64px;z-index:1;pointer-events:none}
        .fp-watermark{position:absolute;font-family:'Bebas Neue',sans-serif;font-size:clamp(220px,28vw,420px);line-height:.78;letter-spacing:-8px;color:transparent;-webkit-text-stroke:1px rgba(245,224,58,.04);pointer-events:none;z-index:1;bottom:-60px;right:-40px;user-select:none}
        .fp-logo-img{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60%;max-width:520px;opacity:.06;filter:invert(1);pointer-events:none;user-select:none;z-index:1}
        .fp-glow{position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(255,85,0,.04) 0%,transparent 70%);top:50%;left:-180px;transform:translateY(-50%);z-index:1;pointer-events:none}
        .fp-left-inner{position:relative;z-index:3;display:flex;flex-direction:column;height:100%;justify-content:space-between}
        .fp-top{display:flex;align-items:center;justify-content:space-between}
        .fp-logo{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:5px;display:flex;align-items:center;gap:10px}
        .fp-logo .y{color:#f5e03a}
        .fp-dot{width:6px;height:6px;border-radius:50%;background:#ff5500;animation:fpdot 2s ease-in-out infinite}
        @keyframes fpdot{0%,100%{opacity:1}50%{opacity:.2}}
        .fp-eyebrow{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:#ff5500;display:flex;align-items:center;gap:12px}
        .fp-eyebrow::before{content:'';width:28px;height:1px;background:#ff5500}
        .fp-pitch h2{font-family:'Bebas Neue',sans-serif;font-size:clamp(60px,8vw,120px);line-height:.84;letter-spacing:-2px;margin:0;color:#f0ece3}
        .fp-pitch .yl{color:#f5e03a}
        .fp-pitch-sub{font-size:14px;font-weight:300;color:rgba(240,236,227,.5);line-height:1.85;max-width:380px;margin-top:24px}

        .fp-right{position:relative;display:flex;align-items:center;justify-content:center;padding:48px 5vw;background:#020307}
        .fp-num{position:absolute;top:14px;right:14px;font-family:'Bebas Neue',sans-serif;font-size:90px;line-height:.85;color:transparent;-webkit-text-stroke:1px rgba(245,224,58,.05);pointer-events:none;user-select:none}
        .fp-card{width:100%;max-width:440px;opacity:0;transform:translateY(24px);transition:all .9s cubic-bezier(.2,.8,.2,1) .15s}
        .fp-card.in{opacity:1;transform:translateY(0)}
        .fp-form-eyebrow{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:#ff5500;display:flex;align-items:center;gap:12px;margin-bottom:18px}
        .fp-form-eyebrow::before{content:'';width:28px;height:1px;background:#ff5500}
        .fp-form-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(48px,6vw,72px);line-height:.9;letter-spacing:-1px;color:#f0ece3;margin-bottom:8px}
        .fp-form-title em{font-style:normal;color:#f5e03a}
        .fp-form-desc{font-size:14px;font-weight:300;color:rgba(240,236,227,.5);line-height:1.7;margin-bottom:32px}

        .fp-field{margin-bottom:18px}
        .fp-field label{display:block;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(240,236,227,.4);margin-bottom:10px}
        .fp-input{width:100%;background:rgba(255,255,255,.025);border:1px solid rgba(240,236,227,.08);color:#f0ece3;font-family:'Barlow',sans-serif;font-size:15px;padding:15px 18px;outline:none;transition:all .25s;border-radius:0}
        .fp-input:focus{border-color:rgba(245,224,58,.5);background:rgba(245,224,58,.04);box-shadow:0 0 0 1px rgba(245,224,58,.2)}
        .fp-input::placeholder{color:rgba(240,236,227,.18)}

        .fp-btn{width:100%;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;background:#f5e03a;color:#000;border:none;padding:18px 28px;cursor:pointer;transition:all .25s;display:inline-flex;align-items:center;justify-content:center;gap:10px;margin-top:6px}
        .fp-btn:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(245,224,58,.18);background:#fff7a0}
        .fp-btn:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
        .fp-btn .arr{transition:transform .3s}
        .fp-btn:hover .arr{transform:translateX(4px)}

        .fp-back{width:100%;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;background:transparent;color:rgba(240,236,227,.45);border:1px solid rgba(240,236,227,.1);padding:14px 28px;cursor:pointer;transition:all .25s;margin-top:10px}
        .fp-back:hover{border-color:rgba(245,224,58,.25);color:#f5e03a}

        .fp-err{margin-bottom:18px;padding:12px 16px;background:rgba(255,85,0,.06);border:1px solid rgba(255,85,0,.18);color:#ffb07a;font-size:13px;font-weight:500;display:flex;align-items:center;gap:10px}
        .fp-err::before{content:'⚠';color:#ff5500;font-size:14px}

        .fp-success{text-align:center;padding:8px 0}
        .fp-success-icon{width:96px;height:96px;border-radius:50%;background:rgba(245,224,58,.06);border:1.5px solid rgba(245,224,58,.32);margin:0 auto 28px;display:flex;align-items:center;justify-content:center;font-size:42px;animation:fpPulse 2.4s ease-in-out infinite}
        @keyframes fpPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,224,58,.25)}50%{box-shadow:0 0 0 16px rgba(245,224,58,0)}}
        .fp-success-title{font-family:'Bebas Neue',sans-serif;font-size:56px;line-height:.92;letter-spacing:-.5px;margin-bottom:14px}
        .fp-success-title em{font-style:normal;color:#f5e03a}
        .fp-success-desc{font-size:14px;font-weight:300;color:rgba(240,236,227,.55);line-height:1.85;margin-bottom:18px}
        .fp-success-desc b{color:#f5e03a;font-weight:600}
        .fp-tip{padding:14px 18px;background:rgba(245,224,58,.04);border:1px solid rgba(245,224,58,.15);font-family:'DM Mono',monospace;font-size:11px;letter-spacing:1px;color:rgba(240,236,227,.55);margin-bottom:24px;text-align:left}
        .fp-tip b{color:#f5e03a;font-weight:500;letter-spacing:1.5px}

        @media (max-width: 980px){
          .fp-root{grid-template-columns:1fr}
          .fp-left{padding:32px 28px;min-height:280px;order:-1}
          .fp-right{padding:40px 24px}
        }
        @media (max-width: 600px){
          .fp-pitch h2{font-size:54px;letter-spacing:-1px}
          .fp-form-title{font-size:42px}
          .fp-success-title{font-size:42px}
        }
      `}</style>

      {/* LEFT — branding */}
      <div className="fp-left">
        <div className="fp-grid" />
        <div className="fp-watermark">RESET</div>
        <img src="/logo-lemons-1.png" alt="" className="fp-logo-img" />
        <div className="fp-glow" />
        <div className="fp-left-inner">
          <div className="fp-top">
            <div className="fp-logo">LEMON<span className="y">'S</span><span className="fp-dot" /> ARG</div>
            <div className="fp-eyebrow">Recuperar acceso</div>
          </div>
          <div className="fp-pitch">
            <h2>RECUPERÁ<br/><span className="yl">TU CUENTA</span></h2>
            <p className="fp-pitch-sub">Te enviamos un link a tu email para que puedas crear una contraseña nueva en menos de un minuto.</p>
          </div>
          <div />
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="fp-right">
        <div className="fp-num">03</div>
        <div ref={cardRef} className="fp-card">
          {success ? (
            <div className="fp-success">
              <div className="fp-success-icon">📬</div>
              <div className="fp-success-title">Revisá tu <em>email</em></div>
              <div className="fp-success-desc">
                Si existe una cuenta con <b>{email}</b>, te enviamos un link para restablecer tu contraseña.
              </div>
              <div className="fp-tip">El link vence en <b>30 MINUTOS</b>. Revisá también tu carpeta de spam.</div>
              <button onClick={() => navigate("/")} className="fp-btn">
                <span>Volver al inicio</span><span className="arr">→</span>
              </button>
            </div>
          ) : (
            <>
              <div className="fp-form-eyebrow">¿Olvidaste tu contraseña?</div>
              <div className="fp-form-title">Restablecer <em>acceso</em></div>
              <div className="fp-form-desc">Ingresá tu email y te enviamos un link para crear una nueva contraseña.</div>

              {msg && <div className="fp-err">{msg}</div>}

              <div className="fp-field">
                <label>Email</label>
                <input
                  className="fp-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </div>

              <button onClick={submit} disabled={loading} className="fp-btn">
                <span>{loading ? "Enviando…" : "Enviar link"}</span>
                {!loading && <span className="arr">→</span>}
              </button>

              <button onClick={() => navigate("/")} className="fp-back">← Volver al login</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
