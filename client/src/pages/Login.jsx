import { useState, useEffect, useRef } from "react";
import fondoLogin from "/FONDO-LOGIN.jpg";
import { useNavigate } from "react-router-dom";
import {
  supportsWebAuthn,
  supportsPlatformBiometric,
  detectPlatformBiometricLabel,
  loginWithBiometric,
  isBiometricEnabledLocally,
  getLastBiometricEmail,
  shouldShowBiometricPrompt,
} from "../lib/webauthn";
import ActivateBiometricModal from "../components/ActivateBiometricModal";
import { useBranding } from "../lib/branding.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

export default function Login() {
  const navigate = useNavigate();
  const branding = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("biometría");
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activateModalToken, setActivateModalToken] = useState(null);
  const [activateModalUser, setActivateModalUser] = useState(null);
  const formRef = useRef(null);

  const clearToken = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  };

  async function resendVerification() {
    if (!needsVerification || resending) return;
    setResending(true);
    try {
      await fetch(`${API}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: needsVerification }),
      });
      setResent(true);
    } catch {}
    finally { setResending(false); }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(""); setNeedsVerification(null); setResent(false); clearToken(); setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data?.code === "EMAIL_NOT_VERIFIED") {
          setNeedsVerification(data.email || email);
          return;
        }
        setMsg(data?.error || "Credenciales inválidas");
        return;
      }
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("token", data.token);

      // Si el server dice que el user no tiene biometría y este browser la soporta,
      // abrir el modal de activación ANTES de navegar.
      if (data.prompt_biometric_setup && supportsWebAuthn()) {
        const platformOk = await supportsPlatformBiometric();
        if (platformOk && shouldShowBiometricPrompt()) {
          setActivateModalToken(data.token);
          setActivateModalUser(data.user);
          setShowActivateModal(true);
          return; // no navegar todavía, navegamos después de cerrar el modal
        }
      }

      const role = data.user?.role;
      const scopes = data.user?.scopes;
      if (role === "admin") { await redirectAdmin(navigate); return; }
      // operadores y clientes: home común (Sprint 3+ podrá agregar /admin para admin)
      navigate("/inicio");
    } catch { setMsg("Error de conexión"); }
    finally { setLoading(false); }
  }

  async function handleBiometricLogin() {
    if (biometricLoading) return;
    setMsg(""); setNeedsVerification(null); clearToken(); setBiometricLoading(true);
    try {
      const data = await loginWithBiometric({ email: email || getLastBiometricEmail() });
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem("token", data.token);
      const role = data.user?.role;
      const scopes = data.user?.scopes;
      if (role === "admin") { await redirectAdmin(navigate); return; }
      // operadores y clientes: home común (Sprint 3+ podrá agregar /admin para admin)
      navigate("/inicio");
    } catch (e) {
      // Si falla, no muestra error grande — el form de password sigue ahí
      if (e?.message && !/Cancelaste/i.test(e.message)) {
        setMsg(e.message);
      }
    } finally {
      setBiometricLoading(false);
    }
  }

  async function closeBiometricModalAndNavigate(userObj) {
    setShowActivateModal(false);
    if (!userObj) { navigate("/inicio"); return; }
    if (userObj.role === "admin") { await redirectAdmin(navigate); return; }
    navigate("/inicio");
  }

  // Helper: si admin y app_config tiene wizard incompleto → redirige a /admin/setup
  async function redirectAdmin(nav) {
    try {
      const tok = localStorage.getItem("token") || sessionStorage.getItem("token");
      const r = await fetch(`${API}/api/admin/config/status`, { headers: { Authorization: `Bearer ${tok}` } });
      const d = await r.json();
      // Si falta cualquiera de los pasos críticos, mandar al wizard
      const incomplete = !d.status || !d.status.cloudinary || !d.status.resend;
      nav(incomplete ? "/admin/setup" : "/inicio");
    } catch {
      nav("/admin/setup");  // fail-safe: lo mando al wizard
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      formRef.current?.classList.add("in");
    }, 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    (async () => {
      if (!supportsWebAuthn()) return;
      if (!isBiometricEnabledLocally()) return;
      const ok = await supportsPlatformBiometric();
      if (ok) {
        setBiometricAvailable(true);
        setBiometricLabel(detectPlatformBiometricLabel());
        const lastEmail = getLastBiometricEmail();
        if (lastEmail && !email) setEmail(lastEmail);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intencional: solo al montar

  return (
    <div className="lg-root">
      <style>{`
        .lg-root{min-height:100vh;min-height:100svh;background:#020307;color:#f0ece3;display:grid;grid-template-columns:1.05fr .95fr;font-family:'Gotham', sans-serif;overflow:hidden;position:relative}
        .lg-root::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");opacity:.026;pointer-events:none;z-index:9}

        /* LEFT — branding panel */
        .lg-left{position:relative;overflow:hidden;border-right:1px solid rgba(240,236,227,.07);display:flex;flex-direction:column;justify-content:space-between;padding:48px 56px}
        .lg-bg{position:absolute;inset:0;background-image:url("${fondoLogin}");background-size:cover;background-position:center;filter:brightness(.32) saturate(.6);z-index:0}
        .lg-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(2,3,7,.9) 0%,rgba(2,3,7,.55) 50%,rgba(2,3,7,.95) 100%)}
        .lg-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px);background-size:64px 64px;z-index:1;pointer-events:none}
        .lg-watermark{position:absolute;font-family:'Gotham', sans-serif;font-weight:900;font-size:clamp(220px,28vw,420px);line-height:.78;letter-spacing:-6px;color:transparent;-webkit-text-stroke:1px rgba(var(--brand-primary-rgb),.04);pointer-events:none;z-index:1;bottom:-60px;right:-40px;user-select:none}
        .lg-logo-img{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60%;max-width:540px;opacity:.06;filter:invert(1);pointer-events:none;user-select:none;z-index:1}
        .lg-lemon{position:absolute;right:-6%;bottom:-2%;height:96%;max-height:780px;z-index:2;pointer-events:none;animation:lgFloat 6s ease-in-out infinite;filter:drop-shadow(0 0 60px rgba(var(--brand-primary-rgb),.18))}
        @keyframes lgFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-18px) rotate(2deg)}}
        .lg-left-inner{position:relative;z-index:3;display:flex;flex-direction:column;height:100%;justify-content:space-between}

        .lg-top{display:flex;align-items:center;justify-content:space-between}
        .lg-logo{font-family:'Gotham', sans-serif;font-weight:900;font-size:18px;letter-spacing:3px;display:flex;align-items:center;gap:10px}
        .lg-logo .y{color:var(--brand-primary, #f5e03a)}
        .lg-dot{width:6px;height:6px;border-radius:50%;background:var(--brand-accent, #ff5500);animation:lgdot 2s ease-in-out infinite}
        @keyframes lgdot{0%,100%{opacity:1}50%{opacity:.2}}
        .lg-eyebrow{font-family:'Gotham', sans-serif;font-weight:700;font-size:10px;letter-spacing:2.6px;text-transform:uppercase;color:var(--brand-accent, #ff5500);display:flex;align-items:center;gap:12px}
        .lg-eyebrow::before{content:'';width:28px;height:1px;background:var(--brand-accent, #ff5500)}

        .lg-title{position:relative}
        .lg-title h1{font-family:'Gotham', sans-serif;font-weight:900;font-size:clamp(64px,9vw,140px);line-height:.86;letter-spacing:-0.04em;margin:0;color:#f0ece3}
        .lg-title .yl{color:var(--brand-primary, #f5e03a)}
        .lg-title .out{-webkit-text-stroke:1.5px rgba(240,236,227,.32);color:transparent}
        .lg-line{overflow:hidden;display:block}
        .lg-line span{display:inline-block;transform:translateY(110%);transition:transform 1s cubic-bezier(.2,.8,.2,1)}
        .lg-title.in .lg-line:nth-child(1) span{transform:translateY(0);transition-delay:.05s}
        .lg-title.in .lg-line:nth-child(2) span{transform:translateY(0);transition-delay:.18s}
        .lg-title.in .lg-line:nth-child(3) span{transform:translateY(0);transition-delay:.31s}

        .lg-sub{font-size:15px;font-weight:300;color:rgba(240,236,227,.55);line-height:1.85;max-width:420px;margin-top:36px;opacity:0;transform:translateY(16px);transition:all .8s ease .55s}
        .lg-title.in + .lg-sub{opacity:1;transform:translateY(0)}
        .lg-sub strong{color:#f0ece3;font-weight:600}

        .lg-foot{display:flex;align-items:center;gap:24px;font-family:'Gotham', sans-serif;font-weight:700;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:rgba(240,236,227,.3);flex-wrap:wrap}
        .lg-foot-item{display:flex;align-items:center;gap:8px}
        .lg-foot-item b{color:var(--brand-primary, #f5e03a);font-weight:900;font-family:'Gotham', sans-serif;font-size:22px;letter-spacing:0}
        .lg-foot-sep{width:1px;height:18px;background:rgba(240,236,227,.1)}

        /* RIGHT — form */
        .lg-right{position:relative;display:flex;align-items:center;justify-content:center;padding:48px 5vw;background:#020307}
        .lg-form-wrap{width:100%;max-width:440px;opacity:0;transform:translateY(24px);transition:all .9s cubic-bezier(.2,.8,.2,1) .25s}
        .lg-form-wrap.in{opacity:1;transform:translateY(0)}
        .lg-form-eyebrow{font-family:'Gotham', sans-serif;font-weight:700;font-size:10px;letter-spacing:2.6px;text-transform:uppercase;color:var(--brand-accent, #ff5500);display:flex;align-items:center;gap:12px;margin-bottom:18px}
        .lg-form-eyebrow::before{content:'';width:28px;height:1px;background:var(--brand-accent, #ff5500)}
        .lg-form-title{font-family:'Gotham', sans-serif;font-weight:900;font-size:clamp(40px,5.4vw,64px);line-height:.94;letter-spacing:-0.025em;color:#f0ece3;margin-bottom:8px}
        .lg-form-title em{font-style:normal;color:var(--brand-primary, #f5e03a)}
        .lg-form-desc{font-size:14px;font-weight:400;color:rgba(240,236,227,.55);line-height:1.7;margin-bottom:36px}

        .lg-field{margin-bottom:18px}
        .lg-field label{display:block;font-family:'Gotham', sans-serif;font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(240,236,227,.4);margin-bottom:10px}
        .lg-input{width:100%;background:rgba(255,255,255,.025);border:1px solid rgba(240,236,227,.08);color:#f0ece3;font-family:'Gotham', sans-serif;font-weight:400;font-size:15px;padding:15px 18px;outline:none;transition:all .25s;border-radius:0}
        .lg-input:focus{border-color:rgba(var(--brand-primary-rgb),.5);background:rgba(var(--brand-primary-rgb),.04);box-shadow:0 0 0 1px rgba(var(--brand-primary-rgb),.2)}
        .lg-input::placeholder{color:rgba(240,236,227,.18)}

        .lg-row{display:flex;align-items:center;justify-content:space-between;margin:8px 0 26px}
        .lg-check{display:flex;align-items:center;gap:10px;cursor:pointer;font-family:'Gotham', sans-serif;font-weight:700;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:rgba(240,236,227,.45);user-select:none}
        .lg-check input{width:14px;height:14px;accent-color:var(--brand-primary, #f5e03a);cursor:pointer}
        .lg-link{font-family:'Gotham', sans-serif;font-weight:700;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:var(--brand-primary, #f5e03a);cursor:pointer;border-bottom:1px solid transparent;transition:border .2s;background:none;border-top:none;border-left:none;border-right:none;padding:0}
        .lg-link:hover{border-bottom-color:var(--brand-primary, #f5e03a)}

        .lg-btn{width:100%;font-family:'Gotham', sans-serif;font-size:13px;font-weight:900;letter-spacing:2.2px;text-transform:uppercase;background:var(--brand-primary, #f5e03a);color:#000;border:none;padding:18px 28px;cursor:pointer;transition:all .25s;display:inline-flex;align-items:center;justify-content:center;gap:10px;position:relative;overflow:hidden}
        .lg-btn::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,var(--brand-primary, #fff7a0),var(--brand-primary, #f5e03a),var(--brand-primary, #fff7a0));background-size:200% 100%;opacity:0;transition:opacity .3s;animation:lgshim 2.4s linear infinite}
        @keyframes lgshim{0%{background-position:0% 0}100%{background-position:200% 0}}
        .lg-btn:hover::before{opacity:1}
        .lg-btn:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(var(--brand-primary-rgb),.18)}
        .lg-btn:active{transform:translateY(0)}
        .lg-btn:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
        .lg-btn span{position:relative;z-index:1}
        .lg-btn .arr{position:relative;z-index:1;transition:transform .3s}
        .lg-btn:hover .arr{transform:translateX(4px)}

        .lg-err{margin-bottom:18px;padding:12px 16px;background:rgba(var(--brand-accent-rgb),.06);border:1px solid rgba(var(--brand-accent-rgb),.18);color:#ffb07a;font-size:13px;font-weight:500;display:flex;align-items:center;gap:10px;font-family:'Gotham', sans-serif}
        .lg-err::before{content:'⚠';color:var(--brand-accent, #ff5500);font-size:14px}

        .lg-divider{display:flex;align-items:center;gap:14px;margin:32px 0 24px;font-family:'Gotham', sans-serif;font-weight:700;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:rgba(240,236,227,.25)}
        .lg-divider::before,.lg-divider::after{content:'';flex:1;height:1px;background:rgba(240,236,227,.07)}

        .lg-register{display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:rgba(240,236,227,.4);font-weight:400}
        .lg-register a{color:var(--brand-primary, #f5e03a);font-weight:700;text-decoration:none;border-bottom:1px solid transparent;transition:border .2s;cursor:pointer}
        .lg-register a:hover{border-bottom-color:var(--brand-primary, #f5e03a)}

        /* Decorative numbers like watermarks */
        .lg-num{position:absolute;font-family:'Gotham', sans-serif;font-weight:900;font-size:160px;line-height:.85;color:transparent;-webkit-text-stroke:1px rgba(var(--brand-primary-rgb),.05);pointer-events:none;user-select:none}
        .lg-num.tl{top:14px;right:14px;font-size:90px}

        /* RESPONSIVE */
        @media (max-width: 980px){
          .lg-root{grid-template-columns:1fr}
          .lg-left{padding:32px 28px;min-height:340px}
          .lg-right{padding:40px 24px}
          .lg-foot{display:none}
          .lg-lemon{height:60%;max-height:380px;right:-12%}
        }
        @media (max-width: 600px){
          .lg-form-title{font-size:42px}
          .lg-lemon{display:none}
        }
      `}</style>

      {/* LEFT */}
      <div className="lg-left">
        <div className="lg-bg" />
        <div className="lg-grid" />
        <img src="/icons/icon.svg" alt="" className="lg-logo-img" />
        <div className="lg-left-inner">
          <div className="lg-top">
            <div className="lg-logo">{(branding.name || "Mi Portal").toUpperCase()}</div>
            <div className="lg-eyebrow">{branding.slogan || "Portal exclusivo"}</div>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="lg-right">
        <div className="lg-num tl">01</div>
        <div ref={formRef} className="lg-form-wrap">
          <div className="lg-form-eyebrow">Acceso seguro</div>
          <div className="lg-form-title">Bienvenido <em>de vuelta</em></div>
          <div className="lg-form-desc">Ingresá con tu cuenta para acceder al portal y a tu comunidad.</div>

          {needsVerification && (
            <div className="lg-err" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
              <div>Tenés que verificar tu email para entrar. Revisá tu bandeja.</div>
              {resent ? (
                <div style={{ fontSize: 12, color: "rgba(240,236,227,.7)" }}>
                  Mail reenviado. Revisá tu bandeja (y spam).
                </div>
              ) : (
                <button type="button" className="lg-link" onClick={resendVerification} disabled={resending}
                  style={{ alignSelf: "flex-start" }}>
                  {resending ? "Reenviando..." : "Reenviar mail de verificación"}
                </button>
              )}
            </div>
          )}

          {msg && <div className="lg-err">{msg}</div>}

          {biometricAvailable && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              style={{
                width: "100%",
                padding: "16px 20px",
                marginBottom: 18,
                background: "rgba(var(--brand-primary-rgb),0.06)",
                border: "1px solid rgba(var(--brand-primary-rgb),0.3)",
                color: "var(--brand-primary, #f5e03a)",
                fontFamily: "'Gotham', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                cursor: biometricLoading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              {biometricLoading ? "Verificando..." : `🔐 Login con ${biometricLabel}`}
            </button>
          )}

          <form onSubmit={onSubmit}>
            <div className="lg-field">
              <label>Email</label>
              <input className="lg-input" type="email" placeholder="tuemail@dominio.com"
                value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>

            <div className="lg-field">
              <label>Contraseña</label>
              <input className="lg-input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>

            <div className="lg-row">
              <label className="lg-check">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                Recordarme
              </label>
              <button type="button" className="lg-link" onClick={() => navigate("/forgot-password")}>
                Olvidé mi contraseña
              </button>
            </div>

            <button type="submit" className="lg-btn" disabled={loading}>
              <span>{loading ? "Ingresando..." : "Iniciar sesión"}</span>
              {!loading && <span className="arr">→</span>}
            </button>
          </form>

          <div className="lg-divider">o</div>
          <div className="lg-register">
            ¿No tenés cuenta? <a onClick={() => navigate("/register")}>Registrate con tu código</a>
          </div>
        </div>
      </div>

      {showActivateModal && (
        <ActivateBiometricModal
          token={activateModalToken}
          email={email}
          onActivated={() => closeBiometricModalAndNavigate(activateModalUser)}
          onDismiss={() => closeBiometricModalAndNavigate(activateModalUser)}
        />
      )}
    </div>
  );
}
