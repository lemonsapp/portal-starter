import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBranding } from "../lib/branding.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResetPassword() {
  const q = useQuery();
  const navigate = useNavigate();
  const branding = useBranding();

  const email = q.get("email") || "";
  const token = q.get("token") || "";

  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const invalidLink = !email || !token;
  const cardRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => cardRef.current?.classList.add("in"), 80);
    return () => clearTimeout(t);
  }, []);

  async function submit() {
    setMsg("");
    if (invalidLink) return setMsg("El link es inválido o ya venció.");
    if (pass.length < 6) return setMsg("La contraseña debe tener mínimo 6 caracteres.");
    if (pass !== pass2) return setMsg("Las contraseñas no coinciden.");

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, new_password: pass }),
      });
      const data = await res.json();
      if (!res.ok) return setMsg(data?.error || "Error al restablecer la contraseña.");
      setSuccess(true);
      setTimeout(() => navigate("/"), 2500);
    } catch {
      setMsg("Error de red. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const strength = pass.length === 0 ? 0 : Math.min(Math.floor(pass.length / 2), 5);
  const strengthColors = ["#ef4444", "#ef4444", "#f59e0b", "#22c55e", "#22c55e"];

  return (
    <div className="rp-root">
      <style>{`
        .rp-root{min-height:100vh;min-height:100svh;background:#020307;color:#f0ece3;display:grid;grid-template-columns:.95fr 1.05fr;font-family:'Gotham', sans-serif;overflow:hidden;position:relative}
        .rp-root::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");opacity:.026;pointer-events:none;z-index:9}

        .rp-left{position:relative;display:flex;align-items:center;justify-content:center;padding:48px 5vw;background:#020307;border-right:1px solid rgba(240,236,227,.07)}
        .rp-num{position:absolute;top:14px;left:14px;font-family:'Gotham', sans-serif;font-size:90px;line-height:.85;color:transparent;-webkit-text-stroke:1px rgba(var(--brand-primary-rgb),.05);pointer-events:none;user-select:none}
        .rp-card{width:100%;max-width:460px;opacity:0;transform:translateY(24px);transition:all .9s cubic-bezier(.2,.8,.2,1) .15s}
        .rp-card.in{opacity:1;transform:translateY(0)}
        .rp-eyebrow{font-family:'Gotham', monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:var(--brand-accent, #ff5500);display:flex;align-items:center;gap:12px;margin-bottom:18px}
        .rp-eyebrow::before{content:'';width:28px;height:1px;background:var(--brand-accent, #ff5500)}
        .rp-title{font-family:'Gotham', sans-serif;font-size:clamp(48px,6vw,72px);line-height:.9;letter-spacing:-1px;color:#f0ece3;margin-bottom:8px}
        .rp-title em{font-style:normal;color:var(--brand-primary, #f5e03a)}
        .rp-desc{font-size:14px;font-weight:400;color:rgba(240,236,227,.5);line-height:1.7;margin-bottom:30px}
        .rp-desc b{color:#f0ece3;font-weight:600}

        .rp-field{margin-bottom:18px}
        .rp-field label{display:block;font-family:'Gotham', monospace;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(240,236,227,.4);margin-bottom:10px}
        .rp-input-wrap{position:relative}
        .rp-input{width:100%;background:rgba(255,255,255,.025);border:1px solid rgba(240,236,227,.08);color:#f0ece3;font-family:'Gotham', sans-serif;font-size:15px;padding:15px 18px;outline:none;transition:all .25s;border-radius:0}
        .rp-input:focus{border-color:rgba(var(--brand-primary-rgb),.5);background:rgba(var(--brand-primary-rgb),.04);box-shadow:0 0 0 1px rgba(var(--brand-primary-rgb),.2)}
        .rp-input::placeholder{color:rgba(240,236,227,.18)}
        .rp-eye{position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:rgba(240,236,227,.4);font-size:16px;padding:4px}
        .rp-eye:hover{color:var(--brand-primary, #f5e03a)}

        .rp-strength{display:flex;gap:5px;margin:-8px 0 16px}
        .rp-strength div{flex:1;height:3px;background:rgba(240,236,227,.07);transition:background .25s}

        .rp-btn{width:100%;font-family:'Gotham', sans-serif;font-size:14px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;background:var(--brand-primary, #f5e03a);color:#000;border:none;padding:18px 28px;cursor:pointer;transition:all .25s;display:inline-flex;align-items:center;justify-content:center;gap:10px;margin-top:6px}
        .rp-btn:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(var(--brand-primary-rgb),.18);background:var(--brand-primary, #fff7a0)}
        .rp-btn:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
        .rp-btn .arr{transition:transform .3s}
        .rp-btn:hover .arr{transform:translateX(4px)}

        .rp-back{width:100%;font-family:'Gotham', monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;background:transparent;color:rgba(240,236,227,.45);border:1px solid rgba(240,236,227,.1);padding:14px 28px;cursor:pointer;transition:all .25s;margin-top:10px}
        .rp-back:hover{border-color:rgba(var(--brand-primary-rgb),.25);color:var(--brand-primary, #f5e03a)}

        .rp-err{margin-bottom:18px;padding:12px 16px;background:rgba(var(--brand-accent-rgb),.06);border:1px solid rgba(var(--brand-accent-rgb),.18);color:#ffb07a;font-size:13px;display:flex;align-items:center;gap:10px}
        .rp-err::before{content:'⚠';color:var(--brand-accent, #ff5500);font-size:14px}

        .rp-icon-wrap{width:96px;height:96px;border-radius:50%;margin:0 auto 28px;display:flex;align-items:center;justify-content:center;font-size:42px;animation:rpPulse 2.4s ease-in-out infinite}
        .rp-icon-wrap.success{background:rgba(34,197,94,.06);border:1.5px solid rgba(34,197,94,.35)}
        .rp-icon-wrap.error{background:rgba(var(--brand-accent-rgb),.06);border:1.5px solid rgba(var(--brand-accent-rgb),.35)}
        @keyframes rpPulse{0%,100%{box-shadow:0 0 0 0 rgba(var(--brand-primary-rgb),.2)}50%{box-shadow:0 0 0 14px rgba(var(--brand-primary-rgb),0)}}

        /* Animated SVG check */
        .rp-check{width:96px;height:96px;margin:0 auto 28px;display:block;animation:rpCheckPop .5s cubic-bezier(.34,1.56,.64,1)}
        .rp-check circle{fill:none;stroke:#22c55e;stroke-width:3;stroke-dasharray:283;stroke-dashoffset:283;animation:rpDraw 1s cubic-bezier(.2,.8,.2,1) .15s forwards}
        .rp-check path{fill:none;stroke:#22c55e;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:48;stroke-dashoffset:48;animation:rpDraw .55s cubic-bezier(.2,.8,.2,1) .9s forwards}
        @keyframes rpCheckPop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes rpDraw{to{stroke-dashoffset:0}}

        .rp-success-title{font-family:'Gotham', sans-serif;font-size:54px;line-height:.92;letter-spacing:-.5px;text-align:center;margin-bottom:14px}
        .rp-success-title em{font-style:normal;color:#22c55e}
        .rp-success-desc{font-size:14px;font-weight:400;color:rgba(240,236,227,.55);line-height:1.85;margin-bottom:24px;text-align:center}

        .rp-right{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:48px 56px;background:linear-gradient(135deg,#07090f 0%,#020307 70%)}
        .rp-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px);background-size:64px 64px;z-index:1;pointer-events:none}
        .rp-watermark{position:absolute;font-family:'Gotham', sans-serif;font-size:clamp(220px,28vw,420px);line-height:.78;letter-spacing:-8px;color:transparent;-webkit-text-stroke:1px rgba(var(--brand-primary-rgb),.04);pointer-events:none;z-index:1;bottom:-60px;left:-40px;user-select:none}
        .rp-logo-img{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60%;max-width:520px;opacity:.06;filter:invert(1);pointer-events:none;user-select:none;z-index:1}
        .rp-glow{position:absolute;width:560px;height:560px;border-radius:50%;background:radial-gradient(circle,rgba(34,197,94,.04) 0%,transparent 70%);top:50%;right:-200px;transform:translateY(-50%);z-index:1;pointer-events:none}
        .rp-right-inner{position:relative;z-index:3;display:flex;flex-direction:column;height:100%;justify-content:space-between}
        .rp-top{display:flex;align-items:center;justify-content:space-between}
        .rp-logo{font-family:'Gotham', sans-serif;font-size:22px;letter-spacing:5px;display:flex;align-items:center;gap:10px}
        .rp-logo .y{color:var(--brand-primary, #f5e03a)}
        .rp-pitch h2{font-family:'Gotham', sans-serif;font-size:clamp(60px,8vw,120px);line-height:.84;letter-spacing:-2px;margin:0;color:#f0ece3}
        .rp-pitch .yl{color:var(--brand-primary, #f5e03a)}
        .rp-pitch-sub{font-size:14px;font-weight:400;color:rgba(240,236,227,.5);line-height:1.85;max-width:360px;margin-top:24px}
        .rp-tips{display:flex;flex-direction:column;gap:10px}
        .rp-tip{display:flex;align-items:center;gap:14px;font-size:13px;color:rgba(240,236,227,.55);font-weight:400}
        .rp-tip b{font-family:'Gotham', monospace;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--brand-primary, #f5e03a);font-weight:400;min-width:54px}
        .rp-tip-line{flex:1;height:1px;background:linear-gradient(90deg,rgba(var(--brand-primary-rgb),.25),rgba(var(--brand-primary-rgb),0))}

        @media (max-width: 980px){
          .rp-root{grid-template-columns:1fr}
          .rp-right{padding:32px 28px;min-height:240px;order:-1}
          .rp-left{padding:40px 24px;border-right:none}
          .rp-tips{display:none}
        }
        @media (max-width: 600px){
          .rp-pitch h2{font-size:54px;letter-spacing:-1px}
          .rp-title{font-size:42px}
          .rp-success-title{font-size:42px}
        }
      `}</style>

      {/* LEFT — form */}
      <div className="rp-left">
        <div className="rp-num">04</div>
        <div ref={cardRef} className="rp-card">
          {invalidLink ? (
            <>
              <div className="rp-icon-wrap error">⚠️</div>
              <div className="rp-success-title">Link <em style={{ color: "var(--brand-accent, #ff5500)" }}>inválido</em></div>
              <div className="rp-success-desc">
                Este link de recuperación es inválido o ya venció.<br/>Los links tienen validez de 30 minutos.
              </div>
              <button onClick={() => navigate("/forgot-password")} className="rp-btn">
                <span>Pedir nuevo link</span><span className="arr">→</span>
              </button>
              <button onClick={() => navigate("/")} className="rp-back">← Volver al login</button>
            </>
          ) : success ? (
            <>
              <svg className="rp-check" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" />
                <path d="M30 52 L45 67 L72 38" />
              </svg>
              <div className="rp-success-title">Contraseña <em>actualizada</em></div>
              <div className="rp-success-desc">Tu contraseña fue restablecida correctamente.<br/>Te redirigimos al login en unos segundos.</div>
              <button onClick={() => navigate("/")} className="rp-btn">
                <span>Ir al login</span><span className="arr">→</span>
              </button>
            </>
          ) : (
            <>
              <div className="rp-eyebrow">Seguridad restaurada</div>
              <div className="rp-title">Nueva <em>contraseña</em></div>
              <div className="rp-desc">Cuenta: <b>{email}</b></div>

              {msg && <div className="rp-err">{msg}</div>}

              <div className="rp-field">
                <label>Nueva contraseña</label>
                <div className="rp-input-wrap">
                  <input className="rp-input" type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} placeholder="Mínimo 6 caracteres" style={{ paddingRight: 44 }} />
                  <button type="button" className="rp-eye" onClick={() => setShowPass(v => !v)}>{showPass ? "🙈" : "👁"}</button>
                </div>
              </div>

              {strength > 0 && (
                <div className="rp-strength">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} style={{ background: i < strength ? strengthColors[strength - 1] : "rgba(240,236,227,.07)" }} />
                  ))}
                </div>
              )}

              <div className="rp-field">
                <label>Repetí la contraseña</label>
                <input className="rp-input" type={showPass ? "text" : "password"} value={pass2} onChange={e => setPass2(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Repetí la contraseña" />
              </div>

              <button onClick={submit} disabled={loading} className="rp-btn">
                <span>{loading ? "Guardando…" : "Guardar nueva contraseña"}</span>
                {!loading && <span className="arr">→</span>}
              </button>

              <button onClick={() => navigate("/")} className="rp-back">← Volver al login</button>
            </>
          )}
        </div>
      </div>

      {/* RIGHT — branding */}
      <div className="rp-right">
        <div className="rp-grid" />
        <div className="rp-watermark">RESET</div>
        <img src="/icons/icon.svg" alt="" className="rp-logo-img" />
        <div className="rp-glow" />
        <div className="rp-right-inner">
          <div className="rp-top">
            <div className="rp-logo">{(branding.name || "Mi Portal").toUpperCase()}</div>
          </div>
          <div className="rp-pitch">
            <h2>CUENTA<br/><span className="yl">SEGURA</span></h2>
            <p className="rp-pitch-sub">Tu link de recuperación es único y de un solo uso. Después de cambiar la contraseña, vas a poder acceder con tu nueva clave.</p>
          </div>
          <div className="rp-tips">
            <div className="rp-tip"><b>01</b>Mínimo 6 caracteres<span className="rp-tip-line" /></div>
            <div className="rp-tip"><b>02</b>Combiná letras y números<span className="rp-tip-line" /></div>
            <div className="rp-tip"><b>03</b>Validez del link: 30 min<span className="rp-tip-line" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
