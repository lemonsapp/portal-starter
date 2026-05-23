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
        /* ══════════════════════════════════════════════════════════════════
           LOGIN — minimalista 2026-05-23
           Layout split 50/50: izquierda branding hero, derecha form.
           Tipografía bi-modo Gotham black + Fraunces italic accent.
           Colores: del design system fijo (--c-bg, --c-accent mint, etc.)
           ══════════════════════════════════════════════════════════════════ */
        .lg-root {
          min-height: 100vh; min-height: 100svh;
          background: var(--c-bg, #06070A);
          color: var(--c-text, #F5F2EB);
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: var(--f-body, 'Gotham', sans-serif);
          overflow: hidden;
          position: relative;
        }

        /* ── LEFT: branding hero ── */
        .lg-left {
          position: relative;
          overflow: hidden;
          padding: clamp(36px, 5vw, 64px);
          display: flex; flex-direction: column;
          justify-content: space-between;
          background: linear-gradient(
            155deg,
            var(--c-bg) 0%,
            var(--c-surface) 40%,
            #0a1814 100%
          );
          border-right: 1px solid var(--c-border);
        }
        .lg-left::before {
          content: ''; position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 70% 20%, rgba(167,245,200,0.12), transparent 60%),
            radial-gradient(ellipse 80% 70% at 30% 90%, rgba(46,143,110,0.08), transparent 70%);
          pointer-events: none;
        }
        .lg-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(167,245,200,.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167,245,200,.025) 1px, transparent 1px);
          background-size: 64px 64px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 70% 50% at 50% 50%, black, transparent 75%);
        }
        .lg-left-inner {
          position: relative; z-index: 3;
          display: flex; flex-direction: column;
          height: 100%; justify-content: space-between;
          gap: 40px;
        }

        .lg-top { display: flex; flex-direction: column; gap: 14px; }
        .lg-eyebrow {
          font-family: var(--f-body); font-weight: 700;
          font-size: 11px; letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--c-accent, #A7F5C8);
          display: inline-flex; align-items: center; gap: 12px;
        }
        .lg-eyebrow::before {
          content: ''; width: 26px; height: 1px;
          background: var(--c-accent, #A7F5C8); opacity: .7;
        }
        .lg-logo {
          font-family: var(--f-display, 'Gotham', sans-serif);
          font-weight: 900; font-size: 20px;
          letter-spacing: 0.18em;
        }

        /* Hero display centered vertically */
        .lg-hero {
          display: flex; flex-direction: column; gap: 20px;
        }
        .lg-hero-headline {
          font-family: var(--f-display, 'Gotham', sans-serif);
          font-weight: 900;
          font-size: clamp(48px, 6.5vw, 84px);
          line-height: 0.95;
          letter-spacing: -0.03em;
          color: var(--c-text);
          margin: 0;
        }
        .lg-hero-headline em {
          font-family: var(--f-italic, 'Fraunces', Georgia, serif);
          font-style: italic; font-weight: 400;
          color: var(--c-accent, #A7F5C8);
          letter-spacing: -0.015em;
        }
        .lg-hero-sub {
          max-width: 440px;
          font-size: 15px; line-height: 1.6;
          color: var(--c-text-2, rgba(245,242,235,.72));
        }

        .lg-foot {
          font-family: var(--f-body); font-weight: 700;
          font-size: 11px; letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--c-text-3, rgba(245,242,235,.5));
          display: flex; gap: 24px;
          flex-wrap: wrap;
        }
        .lg-foot-item {
          display: inline-flex; align-items: center; gap: 8px;
        }
        .lg-foot-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--c-accent, #A7F5C8);
          box-shadow: 0 0 8px var(--c-accent, #A7F5C8);
        }

        /* ── RIGHT: form ── */
        .lg-right {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          padding: clamp(36px, 5vw, 64px);
          background: var(--c-bg, #06070A);
        }
        .lg-form-wrap {
          width: 100%; max-width: 420px;
          opacity: 0; transform: translateY(16px);
          transition: opacity .8s var(--ease-out), transform .8s var(--ease-out);
        }
        .lg-form-wrap.in { opacity: 1; transform: translateY(0); }
        .lg-form-eyebrow {
          font-family: var(--f-body); font-weight: 700;
          font-size: 11px; letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--c-accent, #A7F5C8);
          display: inline-flex; align-items: center; gap: 12px;
          margin-bottom: 16px;
        }
        .lg-form-eyebrow::before {
          content: ''; width: 24px; height: 1px;
          background: var(--c-accent, #A7F5C8); opacity: .7;
        }
        .lg-form-title {
          font-family: var(--f-display, 'Gotham', sans-serif);
          font-weight: 900;
          font-size: clamp(36px, 4.6vw, 54px);
          line-height: 0.98;
          letter-spacing: -0.025em;
          color: var(--c-text);
          margin-bottom: 10px;
        }
        .lg-form-title em {
          font-style: italic;
          font-family: var(--f-italic, 'Fraunces', Georgia, serif);
          font-weight: 400;
          color: var(--c-accent, #A7F5C8);
          letter-spacing: -0.015em;
        }
        .lg-form-desc {
          font-size: 14px; line-height: 1.65;
          color: var(--c-text-2, rgba(245,242,235,.72));
          margin-bottom: 32px;
        }

        .lg-field { margin-bottom: 16px; }
        .lg-field label {
          display: block;
          font-family: var(--f-body); font-weight: 700;
          font-size: 10px; letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--c-text-3, rgba(245,242,235,.5));
          margin-bottom: 10px;
        }
        .lg-input {
          width: 100%;
          background: var(--c-surface, #0E1014);
          border: 1px solid var(--c-border-2, rgba(255,255,255,.10));
          color: var(--c-text, #F5F2EB);
          font-family: inherit; font-weight: 400;
          font-size: 15px; padding: 14px 16px;
          outline: none;
          border-radius: var(--r-2, 10px);
          transition:
            border-color var(--dur-base, .24s) var(--ease-out),
            background var(--dur-base, .24s) var(--ease-out),
            box-shadow var(--dur-base, .24s) var(--ease-out);
        }
        .lg-input:hover { border-color: var(--c-border-3, rgba(255,255,255,.16)); }
        .lg-input:focus {
          border-color: var(--c-accent, #A7F5C8);
          background: var(--c-surface-2, #161A20);
          box-shadow: 0 0 0 3px rgba(167,245,200,.18);
        }
        .lg-input::placeholder { color: var(--c-text-3, rgba(245,242,235,.5)); }

        .lg-row {
          display: flex; align-items: center;
          justify-content: space-between;
          margin: 10px 0 28px;
        }
        .lg-check {
          display: inline-flex; align-items: center; gap: 8px;
          cursor: pointer;
          font-family: var(--f-body); font-weight: 600;
          font-size: 12px;
          color: var(--c-text-2, rgba(245,242,235,.72));
          user-select: none;
        }
        .lg-check input {
          width: 16px; height: 16px;
          accent-color: var(--c-accent, #A7F5C8);
          cursor: pointer;
        }
        .lg-link {
          font-family: var(--f-body); font-weight: 700;
          font-size: 12px;
          color: var(--c-accent, #A7F5C8);
          cursor: pointer;
          background: transparent; border: none; padding: 0;
          border-bottom: 1px solid transparent;
          transition: border-color var(--dur-fast, .15s) ease;
        }
        .lg-link:hover { border-bottom-color: var(--c-accent, #A7F5C8); }

        .lg-btn {
          width: 100%;
          font-family: inherit;
          font-size: 13px; font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          background: linear-gradient(135deg, var(--c-accent-2, #25D366) 0%, #1AAE54 100%);
          color: #07130c;
          border: 1px solid rgba(167,245,200,.45);
          padding: 16px 26px;
          cursor: pointer;
          border-radius: var(--r-pill, 999px);
          transition:
            transform var(--dur-fast, .15s) ease,
            box-shadow var(--dur-base, .24s) ease;
          display: inline-flex; align-items: center; justify-content: center; gap: 12px;
          box-shadow:
            0 14px 30px -6px rgba(46,143,110,.55),
            0 0 0 1px rgba(167,245,200,.20) inset;
        }
        .lg-btn:hover {
          transform: translateY(-2px);
          box-shadow:
            0 22px 40px -8px rgba(46,143,110,.7),
            0 0 0 2px rgba(167,245,200,.6),
            0 0 60px -10px rgba(167,245,200,.45);
        }
        .lg-btn:active { transform: translateY(0); }
        .lg-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
        .lg-btn .arr { transition: transform var(--dur-base, .24s) ease; }
        .lg-btn:hover .arr { transform: translateX(6px); }

        .lg-err {
          margin-bottom: 16px; padding: 13px 16px;
          background: rgba(252,165,165,.08);
          border: 1px solid rgba(252,165,165,.25);
          color: var(--c-danger, #FCA5A5);
          font-size: 13px;
          border-radius: var(--r-2, 10px);
          display: flex; align-items: center; gap: 10px;
        }
        .lg-err::before { content: '⚠'; font-size: 14px; }

        .lg-divider {
          display: flex; align-items: center; gap: 14px;
          margin: 28px 0 22px;
          font-family: var(--f-body); font-weight: 700;
          font-size: 10px; letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--c-text-3, rgba(245,242,235,.5));
        }
        .lg-divider::before, .lg-divider::after {
          content: ''; flex: 1; height: 1px;
          background: var(--c-border, rgba(255,255,255,.06));
        }

        .lg-register {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; font-size: 13px;
          color: var(--c-text-2, rgba(245,242,235,.72));
        }
        .lg-register a {
          color: var(--c-accent, #A7F5C8);
          font-weight: 700;
          text-decoration: none; cursor: pointer;
          border-bottom: 1px solid transparent;
          transition: border-color var(--dur-fast, .15s) ease;
        }
        .lg-register a:hover { border-bottom-color: var(--c-accent, #A7F5C8); }

        /* ── Biometric button — ghost style mint ── */
        .lg-bio {
          width: 100%;
          padding: 14px 18px;
          margin-bottom: 16px;
          background: rgba(167,245,200,.06);
          border: 1px solid rgba(167,245,200,.25);
          color: var(--c-accent, #A7F5C8);
          font-family: inherit; font-size: 13px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase;
          border-radius: var(--r-pill, 999px);
          cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          transition: background var(--dur-base, .24s) ease, border-color var(--dur-base, .24s) ease;
        }
        .lg-bio:hover {
          background: rgba(167,245,200,.12);
          border-color: rgba(167,245,200,.5);
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 980px) {
          .lg-root { grid-template-columns: 1fr; }
          .lg-left { padding: 28px; min-height: 280px; gap: 32px; border-right: none; border-bottom: 1px solid var(--c-border); }
          .lg-hero-headline { font-size: clamp(36px, 9vw, 56px); }
          .lg-foot { display: none; }
        }
        @media (max-width: 600px) {
          .lg-form-title { font-size: 34px; }
        }
      `}</style>

      {/* LEFT: branding hero — bi-tipo Gotham + Fraunces */}
      <div className="lg-left">
        <div className="lg-grid" />
        <div className="lg-left-inner">
          <div className="lg-top">
            <span className="lg-eyebrow">{branding.slogan || "Nutrición Superior"}</span>
            <span className="lg-logo">{(branding.name || "HOLISTIC").toUpperCase()}</span>
          </div>

          <div className="lg-hero">
            <h1 className="lg-hero-headline">
              Bienvenido <em>al portal</em><br />
              de la comunidad.
            </h1>
            <p className="lg-hero-sub">
              Coins, recompensas, contenido exclusivo y la línea completa
              de fertilizantes Holistic en un solo lugar.
            </p>
          </div>

          <div className="lg-foot">
            <span className="lg-foot-item"><span className="lg-foot-dot" /> Cultivo indoor &amp; outdoor</span>
            <span className="lg-foot-item"><span className="lg-foot-dot" /> Soporte humano</span>
          </div>
        </div>
      </div>

      {/* RIGHT: form */}
      <div className="lg-right">
        <div ref={formRef} className="lg-form-wrap">
          <div className="lg-form-eyebrow">Acceso</div>
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
