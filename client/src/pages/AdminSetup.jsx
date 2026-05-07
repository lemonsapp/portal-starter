// client/src/pages/AdminSetup.jsx
//
// Setup wizard de 5 pasos (spec § 8.1). Sprint 2: implementación completa,
// guarda contra /api/admin/config/* (encriptado server-side via configStore).
//
// Pasos:
//   1. Cloudinary  — sin esto no se puede subir logo ni avatars
//   2. Marca       — nombre, slogan, logo, colores, favicon, fuente
//   3. Resend      — emails de verify/reset
//   4. Telegram    — alertas opcionales
//   5. Reglas      — coins por registro, signup_mode, features on/off
//   + Final review
//
// Cualquier paso es saltable (con warnings en críticos como Resend).

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

function useStatus() {
  const [status, setStatus] = useState(null);
  const reload = () => {
    fetch(`${API}/api/admin/config/status`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(d => setStatus(d.ok ? d.status : null))
      .catch(() => setStatus(null));
  };
  useEffect(reload, []);
  return [status, reload];
}

async function loadSection(section) {
  const r = await fetch(`${API}/api/admin/config/${section}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const d = await r.json();
  return d.values || {};
}

async function saveSection(section, values) {
  const r = await fetch(`${API}/api/admin/config/${section}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  return await r.json();
}

async function testProvider(provider) {
  const r = await fetch(`${API}/api/admin/config/test/${provider}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return await r.json();
}

// ── Componentes UI compartidos ──────────────────────────────────────────────

const styles = {
  shell: {
    minHeight: "100vh",
    background: "var(--brand-bg, #080808)",
    color: "var(--brand-text, #ede9e0)",
    fontFamily: "var(--brand-font, Inter, sans-serif)",
    padding: "32px 16px",
  },
  container: { maxWidth: 720, margin: "0 auto" },
  h1: { fontSize: 28, fontWeight: 800, marginBottom: 8 },
  sub: { color: "rgba(237,233,224,.55)", marginBottom: 28, fontSize: 14 },
  stepNav: { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" },
  stepBtn: (active, done) => ({
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    border: "1px solid",
    borderColor: active ? "var(--brand-primary, #3B82F6)" : done ? "rgba(34,197,94,.4)" : "rgba(255,255,255,.1)",
    background: active ? "rgba(59,130,246,.1)" : done ? "rgba(34,197,94,.05)" : "rgba(255,255,255,.02)",
    color: active ? "var(--brand-primary, #3B82F6)" : done ? "#22c55e" : "rgba(237,233,224,.5)",
  }),
  card: {
    padding: 24,
    background: "rgba(255,255,255,.02)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 12,
    marginBottom: 18,
  },
  label: { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 6, marginTop: 14 },
  input: {
    width: "100%", padding: "10px 12px",
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 8,
    color: "inherit", fontSize: 14, fontFamily: "inherit",
  },
  btn: (primary = false) => ({
    padding: "10px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    background: primary ? "var(--brand-primary, #3B82F6)" : "rgba(255,255,255,.06)",
    color: primary ? "#fff" : "rgba(237,233,224,.85)",
    fontFamily: "inherit",
  }),
  msgOk:  { padding: "10px 12px", borderRadius: 8, background: "rgba(34,197,94,.08)",  border: "1px solid rgba(34,197,94,.3)",  color: "#86efac", fontSize: 13, marginTop: 12 },
  msgErr: { padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,.08)",  border: "1px solid rgba(239,68,68,.3)",  color: "#fca5a5", fontSize: 13, marginTop: 12 },
  hint: { fontSize: 12, color: "rgba(237,233,224,.4)", marginTop: 6 },
  row: { display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" },
};

// ── Step base wrapper ───────────────────────────────────────────────────────
function StepShell({ title, hint, children, onSave, onSkip, onNext, onTest, msg, saving, testing, isFinal }) {
  return (
    <div style={styles.card}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{title}</div>
      {hint && <div style={styles.hint}>{hint}</div>}
      {children}
      {msg && <div style={msg.type === "err" ? styles.msgErr : styles.msgOk}>{msg.text}</div>}
      <div style={styles.row}>
        {onSave && <button style={styles.btn(true)} onClick={onSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>}
        {onTest && <button style={styles.btn()} onClick={onTest} disabled={testing}>{testing ? "Probando…" : "Probar conexión"}</button>}
        {onSkip && <button style={styles.btn()} onClick={onSkip}>Saltar este paso</button>}
        {onNext && <button style={styles.btn(true)} onClick={onNext}>{isFinal ? "Empezar" : "Siguiente →"}</button>}
      </div>
    </div>
  );
}

// ── Steps ───────────────────────────────────────────────────────────────────

function StepCloudinary({ goNext, goSkip }) {
  const [v, setV] = useState({ cloud_name: "", api_key: "", api_secret: "", folder_base: "portal" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => { loadSection("cloudinary").then(d => setV(p => ({ ...p, ...d, api_key: d.api_key === "••••••" ? "" : (d.api_key || ""), api_secret: d.api_secret === "••••••" ? "" : (d.api_secret || "") }))); }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const payload = {};
    for (const k of ["cloud_name","api_key","api_secret","folder_base"]) {
      if (v[k]) payload[k] = v[k];
    }
    const r = await saveSection("cloudinary", payload);
    setSaving(false);
    setMsg(r.ok ? { type:"ok", text: "Guardado." } : { type:"err", text: r.errors?.[0]?.error || "Error" });
  };
  const test = async () => {
    setTesting(true); setMsg(null);
    const r = await testProvider("cloudinary");
    setTesting(false);
    setMsg({ type: r.ok ? "ok" : "err", text: r.message });
  };

  return (
    <StepShell
      title="1. Cloudinary"
      hint="Necesario para que los usuarios puedan subir avatars y para guardar el logo del producto. Cuenta gratis en cloudinary.com."
      onSave={save} onTest={test} onNext={goNext} onSkip={goSkip}
      msg={msg} saving={saving} testing={testing}
    >
      <label style={styles.label}>Cloud name</label>
      <input style={styles.input} value={v.cloud_name} onChange={e => setV({ ...v, cloud_name: e.target.value })} placeholder="ej: tu-cloud-nombre" />

      <label style={styles.label}>API Key</label>
      <input style={styles.input} value={v.api_key} onChange={e => setV({ ...v, api_key: e.target.value })} placeholder="123456789012345" type="password" autoComplete="off" />

      <label style={styles.label}>API Secret</label>
      <input style={styles.input} value={v.api_secret} onChange={e => setV({ ...v, api_secret: e.target.value })} placeholder="abcdefg-XXX" type="password" autoComplete="off" />

      <label style={styles.label}>Carpeta base (opcional)</label>
      <input style={styles.input} value={v.folder_base} onChange={e => setV({ ...v, folder_base: e.target.value })} placeholder="portal" />
    </StepShell>
  );
}

function StepBranding({ goNext, goSkip }) {
  const [v, setV] = useState({ name:"", slogan:"", color_primary:"#3B82F6", color_accent:"#F59E0B", font_preset:"moderna", logo_url:"", favicon_url:"" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSection("branding").then(d => setV(p => ({ ...p, ...d }))); }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const r = await saveSection("branding", v);
    setSaving(false);
    setMsg(r.ok ? { type:"ok", text:"Guardado. Recargá la página para ver los cambios aplicados." } : { type:"err", text: "Error" });
  };

  return (
    <StepShell title="2. Marca" hint="Lo que ven tus usuarios. Podés cambiarlo cuando quieras desde /admin." onSave={save} onNext={goNext} onSkip={goSkip} msg={msg} saving={saving}>
      <label style={styles.label}>Nombre del producto</label>
      <input style={styles.input} value={v.name} onChange={e => setV({...v, name:e.target.value})} placeholder="Mi Portal" />

      <label style={styles.label}>Slogan</label>
      <input style={styles.input} value={v.slogan} onChange={e => setV({...v, slogan:e.target.value})} placeholder="Tu comunidad en un solo lugar" />

      <label style={styles.label}>Color primario (hex)</label>
      <div style={{ display:"flex", gap:8 }}>
        <input style={{ ...styles.input, flex:1 }} value={v.color_primary} onChange={e => setV({...v, color_primary:e.target.value})} placeholder="#3B82F6" />
        <input type="color" value={v.color_primary} onChange={e => setV({...v, color_primary:e.target.value})} style={{ width: 50, height: 40, padding: 0, border: "none", borderRadius: 8, cursor: "pointer" }} />
      </div>

      <label style={styles.label}>Color acento (hex)</label>
      <div style={{ display:"flex", gap:8 }}>
        <input style={{ ...styles.input, flex:1 }} value={v.color_accent} onChange={e => setV({...v, color_accent:e.target.value})} placeholder="#F59E0B" />
        <input type="color" value={v.color_accent} onChange={e => setV({...v, color_accent:e.target.value})} style={{ width: 50, height: 40, padding: 0, border: "none", borderRadius: 8, cursor: "pointer" }} />
      </div>

      <label style={styles.label}>Preset de fuente</label>
      <select style={styles.input} value={v.font_preset} onChange={e => setV({...v, font_preset:e.target.value})}>
        <option value="moderna">Moderna (Inter)</option>
        <option value="clasica">Clásica (Georgia)</option>
        <option value="tech">Tech (JetBrains Mono)</option>
        <option value="friendly">Friendly (Quicksand)</option>
      </select>

      <label style={styles.label}>URL del logo (Cloudinary)</label>
      <input style={styles.input} value={v.logo_url} onChange={e => setV({...v, logo_url:e.target.value})} placeholder="https://res.cloudinary.com/.../logo.png" />

      <label style={styles.label}>URL del favicon</label>
      <input style={styles.input} value={v.favicon_url} onChange={e => setV({...v, favicon_url:e.target.value})} placeholder="https://res.cloudinary.com/.../favicon.png" />
    </StepShell>
  );
}

function StepEmail({ goNext, goSkip }) {
  const [v, setV] = useState({ api_key:"", from_email:"", from_name:"" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => { loadSection("resend").then(d => setV(p => ({ ...p, ...d, api_key: d.api_key === "••••••" ? "" : (d.api_key || "") }))); }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const payload = {}; for (const k of ["api_key","from_email","from_name"]) if (v[k]) payload[k] = v[k];
    const r = await saveSection("resend", payload);
    setSaving(false);
    setMsg(r.ok ? { type:"ok", text:"Guardado." } : { type:"err", text:"Error" });
  };
  const test = async () => {
    setTesting(true); setMsg(null);
    const r = await testProvider("resend");
    setTesting(false);
    setMsg({ type: r.ok ? "ok" : "err", text: r.message });
  };

  return (
    <StepShell title="3. Resend (emails)" hint="⚠ Sin esto no se mandan emails de verificación ni reset de password. Cuenta gratis (3000 emails/mes) en resend.com." onSave={save} onTest={test} onNext={goNext} onSkip={goSkip} msg={msg} saving={saving} testing={testing}>
      <label style={styles.label}>API Key</label>
      <input style={styles.input} value={v.api_key} onChange={e => setV({...v, api_key:e.target.value})} placeholder="re_xxx..." type="password" autoComplete="off" />

      <label style={styles.label}>From email (debe estar verificado en Resend)</label>
      <input style={styles.input} value={v.from_email} onChange={e => setV({...v, from_email:e.target.value})} placeholder="noreply@tu-dominio.com" />

      <label style={styles.label}>From name</label>
      <input style={styles.input} value={v.from_name} onChange={e => setV({...v, from_name:e.target.value})} placeholder="Mi Portal" />
    </StepShell>
  );
}

function StepTelegram({ goNext, goSkip }) {
  const [v, setV] = useState({ bot_token:"", chat_id:"" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => { loadSection("telegram").then(d => setV(p => ({ ...p, bot_token: d.bot_token === "••••••" ? "" : "", chat_id: d.chat_id === "••••••" ? "" : "" }))); }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const payload = {}; for (const k of ["bot_token","chat_id"]) if (v[k]) payload[k] = v[k];
    const r = await saveSection("telegram", payload);
    setSaving(false);
    setMsg(r.ok ? { type:"ok", text:"Guardado." } : { type:"err", text:"Error" });
  };
  const test = async () => {
    setTesting(true); setMsg(null);
    const r = await testProvider("telegram");
    setTesting(false);
    setMsg({ type: r.ok ? "ok" : "err", text: r.message });
  };

  return (
    <StepShell title="4. Telegram (alertas, opcional)" hint="Para recibir alertas de errores en tu chat. Crear bot: @BotFather → /newbot. Saltable." onSave={save} onTest={test} onNext={goNext} onSkip={goSkip} msg={msg} saving={saving} testing={testing}>
      <label style={styles.label}>Bot token</label>
      <input style={styles.input} value={v.bot_token} onChange={e => setV({...v, bot_token:e.target.value})} placeholder="123:ABC-..." type="password" autoComplete="off" />
      <label style={styles.label}>Chat ID (mandale /start al bot, después getUpdates te lo da)</label>
      <input style={styles.input} value={v.chat_id} onChange={e => setV({...v, chat_id:e.target.value})} placeholder="123456789" />
    </StepShell>
  );
}

function StepRules({ goNext, goSkip }) {
  const [v, setV] = useState({ signup_mode:"open", email_verify_required:true, coins_on_register:100 });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState({ chat:true, stories:true, friends:true, coins:true, webauthn:true });

  useEffect(() => {
    loadSection("rules").then(d => setV(p => ({ ...p, ...d })));
    loadSection("features").then(d => setFeatures(p => ({ ...p, ...d })));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const r1 = await saveSection("rules", v);
    const r2 = await saveSection("features", features);
    setSaving(false);
    setMsg((r1.ok && r2.ok) ? { type:"ok", text:"Guardado." } : { type:"err", text:"Error" });
  };

  return (
    <StepShell title="5. Reglas y features" hint="Cómo funcionan los registros y qué features están activas." onSave={save} onNext={goNext} onSkip={goSkip} msg={msg} saving={saving}>
      <label style={styles.label}>Modo de registro</label>
      <select style={styles.input} value={v.signup_mode} onChange={e => setV({...v, signup_mode:e.target.value})}>
        <option value="open">Abierto (cualquiera con un código)</option>
        <option value="invite">Solo por invitación (admin manda códigos)</option>
      </select>

      <label style={styles.label}>Coins por registro</label>
      <input style={styles.input} type="number" min="0" value={v.coins_on_register} onChange={e => setV({...v, coins_on_register: Number(e.target.value)})} />

      <label style={{ ...styles.label, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={!!v.email_verify_required} onChange={e => setV({...v, email_verify_required: e.target.checked})} />
        Requiere verificación de email
      </label>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 12 }}>Features activas</div>
        {Object.keys(features).map(k => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13 }}>
            <input type="checkbox" checked={!!features[k]} onChange={e => setFeatures({ ...features, [k]: e.target.checked })} />
            <span style={{ textTransform: "capitalize" }}>{k}</span>
          </label>
        ))}
      </div>
    </StepShell>
  );
}

function StepFinal({ status, onLaunch }) {
  return (
    <StepShell title="6. Listo para arrancar" hint="Resumen del setup. Lo que falte podés completarlo desde /admin después." onNext={onLaunch} isFinal={true}>
      <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
        {Object.entries(status || {}).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,.02)", borderRadius: 8, fontSize: 13 }}>
            <span style={{ textTransform: "capitalize" }}>{k}</span>
            <span style={{ color: v ? "#22c55e" : "rgba(237,233,224,.4)" }}>{v ? "✓ configurado" : "— pendiente"}</span>
          </div>
        ))}
      </div>
    </StepShell>
  );
}

// ── Wizard root ─────────────────────────────────────────────────────────────
export default function AdminSetup() {
  const [step, setStep] = useState(0);
  const [status, reload] = useStatus();
  const navigate = useNavigate();

  const STEPS = useMemo(() => [
    { key: "cloudinary", label: "Cloudinary",  done: status?.cloudinary },
    { key: "branding",   label: "Marca",       done: status?.branding },
    { key: "resend",     label: "Emails",      done: status?.resend },
    { key: "telegram",   label: "Telegram",    done: status?.telegram },
    { key: "rules",      label: "Reglas",      done: status?.rules },
    { key: "final",      label: "Listo",       done: false },
  ], [status]);

  const goNext = () => { reload(); setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const goSkip = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const launch = () => { reload(); navigate("/inicio"); };

  return (
    <div style={styles.shell}>
      <div style={styles.container}>
        <div style={styles.h1}>Setup wizard</div>
        <div style={styles.sub}>5 pasos para configurar tu portal. Todos son saltables (con warnings en los críticos).</div>

        <div style={styles.stepNav}>
          {STEPS.map((s, i) => (
            <button key={s.key} onClick={() => setStep(i)} style={styles.stepBtn(i === step, s.done)}>
              {i + 1}. {s.label}
            </button>
          ))}
        </div>

        {step === 0 && <StepCloudinary goNext={goNext} goSkip={goSkip} />}
        {step === 1 && <StepBranding   goNext={goNext} goSkip={goSkip} />}
        {step === 2 && <StepEmail      goNext={goNext} goSkip={goSkip} />}
        {step === 3 && <StepTelegram   goNext={goNext} goSkip={goSkip} />}
        {step === 4 && <StepRules      goNext={goNext} goSkip={goSkip} />}
        {step === 5 && <StepFinal      status={status} onLaunch={launch} />}
      </div>
    </div>
  );
}
