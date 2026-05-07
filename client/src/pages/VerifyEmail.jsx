import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [msg, setMsg] = useState("");
  const cardRef = useRef(null);

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setStatus("error"); setMsg("Token inválido"); return; }
    fetch(`${API}/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) { setStatus("ok"); setMsg(d.message || ""); }
        else { setStatus("error"); setMsg(d.error || "Error"); }
      })
      .catch(() => { setStatus("error"); setMsg("Error de red"); });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => cardRef.current?.classList.add("in"), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="vf-root">
      <style>{`
        .vf-root{min-height:100vh;min-height:100svh;background:#020307;color:#f0ece3;font-family:'Barlow',sans-serif;display:flex;align-items:center;justify-content:center;padding:32px;overflow:hidden;position:relative}
        .vf-root::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");opacity:.026;pointer-events:none;z-index:9}
        .vf-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px);background-size:64px 64px;z-index:1;pointer-events:none}
        .vf-watermark{position:absolute;font-family:'Bebas Neue',sans-serif;font-size:clamp(180px,22vw,360px);line-height:.78;letter-spacing:-6px;color:transparent;-webkit-text-stroke:1px rgba(var(--brand-primary-rgb),.04);pointer-events:none;z-index:1;user-select:none;top:50%;left:50%;transform:translate(-50%,-50%)}
        .vf-logo-bg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:50%;max-width:480px;opacity:.05;filter:invert(1);pointer-events:none;user-select:none;z-index:1}
        .vf-card{position:relative;z-index:5;width:100%;max-width:560px;text-align:center;padding:56px 48px;background:linear-gradient(135deg,#07090f 0%,#020307 100%);border:1px solid rgba(240,236,227,.08);opacity:0;transform:translateY(24px);transition:all .9s cubic-bezier(.2,.8,.2,1)}
        .vf-card.in{opacity:1;transform:translateY(0)}
        .vf-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--lemon),var(--orange),var(--lemon));background-size:200% 100%;animation:vfBar 3s linear infinite}
        @keyframes vfBar{from{background-position:0 0}to{background-position:200% 0}}

        .vf-eyebrow{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:3.5px;text-transform:uppercase;color:var(--brand-accent, #ff5500);display:inline-flex;align-items:center;gap:12px;margin-bottom:24px}
        .vf-eyebrow::before,.vf-eyebrow::after{content:'';width:28px;height:1px;background:var(--brand-accent, #ff5500)}

        .vf-icon{margin:0 auto 28px;width:128px;height:128px;display:flex;align-items:center;justify-content:center;position:relative}
        .vf-spinner{width:96px;height:96px;border:3px solid rgba(var(--brand-primary-rgb),.1);border-top-color:var(--brand-primary, #f5e03a);border-radius:50%;animation:vfSpin 1s linear infinite}
        @keyframes vfSpin{to{transform:rotate(360deg)}}

        .vf-check{width:128px;height:128px;animation:vfPop .6s cubic-bezier(.34,1.56,.64,1)}
        .vf-check circle{fill:none;stroke:#22c55e;stroke-width:3;stroke-dasharray:283;stroke-dashoffset:283;animation:vfDraw 1s cubic-bezier(.2,.8,.2,1) .15s forwards}
        .vf-check path{fill:none;stroke:#22c55e;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:48;stroke-dashoffset:48;animation:vfDraw .55s cubic-bezier(.2,.8,.2,1) .9s forwards}
        @keyframes vfPop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes vfDraw{to{stroke-dashoffset:0}}

        .vf-x{width:128px;height:128px;animation:vfPop .6s cubic-bezier(.34,1.56,.64,1) .1s both, vfShake .5s ease 1s 1}
        .vf-x circle{fill:none;stroke:var(--brand-accent, #ff5500);stroke-width:3;stroke-dasharray:283;stroke-dashoffset:283;animation:vfDraw 1s cubic-bezier(.2,.8,.2,1) .15s forwards}
        .vf-x path{fill:none;stroke:var(--brand-accent, #ff5500);stroke-width:5;stroke-linecap:round;stroke-dasharray:36;stroke-dashoffset:36;animation:vfDraw .4s cubic-bezier(.2,.8,.2,1) .9s forwards}
        @keyframes vfShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-3px)}}

        .vf-title{font-family:'Bebas Neue',sans-serif;font-size:clamp(48px,6vw,80px);line-height:.88;letter-spacing:-1.5px;color:#f0ece3;margin-bottom:14px}
        .vf-title em{font-style:normal;color:var(--brand-primary, #f5e03a)}
        .vf-title .ok{color:#22c55e}
        .vf-title .err{color:var(--brand-accent, #ff5500)}

        .vf-msg{font-size:15px;font-weight:300;color:rgba(240,236,227,.55);line-height:1.85;margin-bottom:24px;max-width:420px;margin-left:auto;margin-right:auto}

        .vf-coins{display:inline-flex;align-items:center;gap:12px;padding:12px 20px;background:rgba(var(--brand-primary-rgb),.06);border:1px solid rgba(var(--brand-primary-rgb),.22);font-family:'DM Mono',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--brand-primary, #f5e03a);margin-bottom:30px}
        .vf-coins b{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;font-weight:400}

        .vf-btn{font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;background:var(--brand-primary, #f5e03a);color:#000;border:none;padding:18px 36px;cursor:pointer;transition:all .25s;display:inline-flex;align-items:center;justify-content:center;gap:10px}
        .vf-btn:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(var(--brand-primary-rgb),.18);background:var(--brand-primary, #fff7a0)}
        .vf-btn .arr{transition:transform .3s}
        .vf-btn:hover .arr{transform:translateX(4px)}

        @media (max-width: 600px){
          .vf-card{padding:40px 24px}
          .vf-title{font-size:42px}
        }
      `}</style>

      <div className="vf-grid" />
      <div className="vf-watermark">VERIFY</div>
      <img src="/icons/icon.svg" alt="" className="vf-logo-bg" />

      <div ref={cardRef} className="vf-card">
        <div className="vf-eyebrow">Verificación de email</div>

        <div className="vf-icon">
          {status === "loading" && <div className="vf-spinner" />}
          {status === "ok" && (
            <svg className="vf-check" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" />
              <path d="M30 52 L45 67 L72 38" />
            </svg>
          )}
          {status === "error" && (
            <svg className="vf-x" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" />
              <path d="M35 35 L65 65 M65 35 L35 65" />
            </svg>
          )}
        </div>

        <div className="vf-title">
          {status === "loading" && <>VERIFICANDO<em>…</em></>}
          {status === "ok"      && <>EMAIL <span className="ok">VERIFICADO</span></>}
          {status === "error"   && <>NO PUDIMOS <span className="err">VERIFICAR</span></>}
        </div>

        {msg && <div className="vf-msg">{msg}</div>}

        {status === "ok" && (
          <div className="vf-coins">🪙 <b>+15</b> Coins acreditados</div>
        )}

        {status !== "loading" && (
          <div>
            <button onClick={() => navigate("/")} className="vf-btn">
              <span>Ir al login</span><span className="arr">→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
