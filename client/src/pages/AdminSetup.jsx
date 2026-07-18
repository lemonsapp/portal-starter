// client/src/pages/AdminSetup.jsx
//
// Setup wizard guiado de 5 pasos + welcome + final. Spec § 8.1.
//
// Cada paso lleva al admin de la mano: explica qué es el provider, cómo
// crear cuenta gratis, dónde encontrar las keys, qué pegar acá, y testea
// la conexión. Sin necesidad de leer docs externos — la guía vive in-app.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

function useStatus() {
  const [status, setStatus] = useState(null);
  const reload = () => {
    fetch(`${API}/api/admin/config/status`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(d => setStatus(d.ok ? d.status : null)).catch(() => setStatus(null));
  };
  useEffect(reload, []);
  return [status, reload];
}

async function loadSection(section) {
  const r = await fetch(`${API}/api/admin/config/${section}`, { headers: { Authorization: `Bearer ${getToken()}` } });
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
    method: "POST", headers: { Authorization: `Bearer ${getToken()}` },
  });
  return await r.json();
}

// ── Estilos compartidos ─────────────────────────────────────────────────────

const S = {
  shell: { minHeight: "100vh", background: "var(--brand-bg, #080808)", color: "var(--brand-text, #ede9e0)", fontFamily: "var(--brand-font, 'Gotham', system-ui, sans-serif)", padding: "32px 16px" },
  container: { maxWidth: 760, margin: "0 auto" },
  h1: { fontFamily: "'Gotham', system-ui, sans-serif", fontSize: 36, fontWeight: 900, marginBottom: 8, letterSpacing: "-0.02em" },
  sub: { color: "rgba(237,233,224,.55)", marginBottom: 28, fontSize: 14 },
  stepNav: { display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" },
  stepBtn: (active, done) => ({
    padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
    border: "1px solid", borderColor: active ? "var(--brand-primary, #3B82F6)" : done ? "rgba(34,197,94,.4)" : "rgba(255,255,255,.1)",
    background: active ? "rgba(59,130,246,.1)" : done ? "rgba(34,197,94,.05)" : "rgba(255,255,255,.02)",
    color: active ? "var(--brand-primary, #3B82F6)" : done ? "#22c55e" : "rgba(237,233,224,.5)",
    fontFamily: "inherit",
  }),
  card:    { padding: 24, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, marginBottom: 18 },
  guide:   { padding: "16px 18px", background: "rgba(59,130,246,.04)", border: "1px solid rgba(59,130,246,.18)", borderRadius: 10, marginBottom: 18, fontSize: 13 },
  guideHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" },
  guideTitle:  { fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--brand-primary, #3B82F6)" },
  step:    { display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  stepNum: { flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: "var(--brand-primary, #3B82F6)", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800 },
  stepTxt: { fontSize: 13, lineHeight: 1.55, color: "rgba(237,233,224,.85)" },
  link:    { color: "var(--brand-primary, #3B82F6)", textDecoration: "underline", fontWeight: 600 },
  label:   { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 6, marginTop: 14 },
  input:   { width: "100%", padding: "10px 12px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "inherit", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" },
  hint:    { fontSize: 12, color: "rgba(237,233,224,.4)", marginTop: 6 },
  btn:     (primary = false) => ({ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: primary ? "var(--brand-primary, #3B82F6)" : "rgba(255,255,255,.06)", color: primary ? "#fff" : "rgba(237,233,224,.85)", fontFamily: "inherit" }),
  msgOk:   { padding: "10px 12px", borderRadius: 8, background: "rgba(34,197,94,.08)",  border: "1px solid rgba(34,197,94,.3)",  color: "#86efac", fontSize: 13, marginTop: 12 },
  msgErr:  { padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,.08)",  border: "1px solid rgba(239,68,68,.3)",  color: "#fca5a5", fontSize: 13, marginTop: 12 },
  msgWarn: { padding: "10px 12px", borderRadius: 8, background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.3)", color: "#fcd34d", fontSize: 13, marginTop: 12 },
  row:     { display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" },
};

// ── Componente reusable: panel de guía expandible ───────────────────────────
function GuidePanel({ title = "📖 Guía paso a paso", steps, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={S.guide}>
      <div style={S.guideHeader} onClick={() => setOpen(!open)}>
        <div style={S.guideTitle}>{title}</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,.5)" }}>{open ? "−" : "+"}</div>
      </div>
      {open && (
        <div style={{ marginTop: 14 }}>
          {steps.map((step, i) => (
            <div key={i} style={S.step}>
              <div style={S.stepNum}>{i + 1}</div>
              <div style={S.stepTxt}>{step}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Wrapper común de cada step ──────────────────────────────────────────────
function StepShell({ title, subtitle, guide, children, onSave, onSkip, onNext, onTest, msg, saving, testing, isFinal, hideSkip }) {
  return (
    <div style={S.card}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ ...S.hint, marginBottom: 14 }}>{subtitle}</div>}
      {guide}
      {children}
      {msg && <div style={msg.type === "err" ? S.msgErr : msg.type === "warn" ? S.msgWarn : S.msgOk}>{msg.text}</div>}
      <div style={S.row}>
        {onSave && <button style={S.btn(true)} onClick={onSave} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>}
        {onTest && <button style={S.btn()} onClick={onTest} disabled={testing}>{testing ? "Probando…" : "Probar conexión"}</button>}
        {!hideSkip && onSkip && <button style={S.btn()} onClick={onSkip}>Saltar este paso</button>}
        {onNext && <button style={S.btn(true)} onClick={onNext}>{isFinal ? "Empezar 🚀" : "Siguiente →"}</button>}
      </div>
    </div>
  );
}

// ── Step 0: Welcome ─────────────────────────────────────────────────────────
function StepWelcome({ goNext }) {
  return (
    <div style={S.card}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--brand-primary, #3B82F6)", marginBottom: 6 }}>👋 Bienvenido</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>Setup inicial del portal</div>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(237,233,224,.7)", marginBottom: 18 }}>
        Vamos a configurar 5 cosas para que tu portal funcione. Es <b>todo guiado</b> — te explico paso a paso cómo crear cada cuenta gratis, dónde encontrar las API keys, y qué pegar acá. Tardás <b>15-30 minutos</b> total.
      </p>

      <div style={{ display: "grid", gap: 10, marginBottom: 22 }}>
        {[
          { n: 1, icon: "☁️", title: "Cloudinary",  desc: "Para subir avatars y el logo del portal", req: true },
          { n: 2, icon: "🎨", title: "Marca",       desc: "Nombre, colores, fuente, logo", req: true },
          { n: 3, icon: "✉️", title: "Resend",      desc: "Para mandar emails de verificación y reset password", req: true },
          { n: 4, icon: "📱", title: "Telegram",    desc: "Alertas opcionales a tu chat (saltable)", req: false },
          { n: 5, icon: "⚙️", title: "Reglas",      desc: "Coins por registro, signup abierto/invitación, features ON/OFF", req: true },
        ].map(s => (
          <div key={s.n} style={{ display: "flex", gap: 12, padding: 14, background: "rgba(255,255,255,.025)", borderRadius: 8, alignItems: "center" }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.n}. {s.title} {!s.req && <span style={{ fontSize: 11, fontWeight: 500, color: "#fcd34d", marginLeft: 6 }}>opcional</span>}</div>
              <div style={{ fontSize: 12, color: "rgba(237,233,224,.55)", marginTop: 2 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={S.msgWarn}>
        💡 Cualquier paso lo podés saltar y completar después desde <code style={{ background: "rgba(255,255,255,.06)", padding: "2px 6px", borderRadius: 4 }}>/admin → Configuración</code>. Pero <b>Cloudinary y Resend son críticos</b> — sin ellos los users no pueden subir avatar ni recibir emails de verificación.
      </div>

      <div style={S.row}>
        <button style={S.btn(true)} onClick={goNext}>Empezar setup →</button>
      </div>
    </div>
  );
}

// ── Step 1: Cloudinary ──────────────────────────────────────────────────────
function StepCloudinary({ goNext, goSkip }) {
  const [v, setV] = useState({ cloud_name: "", api_key: "", api_secret: "", folder_base: "portal" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSection("cloudinary").then(d => setV(p => ({
      ...p, ...d,
      api_key:    d.api_key    === "••••••" ? "" : (d.api_key || ""),
      api_secret: d.api_secret === "••••••" ? "" : (d.api_secret || ""),
    })));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const payload = {};
    for (const k of ["cloud_name","api_key","api_secret","folder_base"]) if (v[k]) payload[k] = v[k];
    const r = await saveSection("cloudinary", payload);
    setSaving(false);
    setMsg(r.ok ? { type: "ok", text: "✓ Guardado." } : { type: "err", text: r.errors?.[0]?.error || "Error al guardar" });
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
      subtitle="Servicio gratuito para guardar imágenes (avatars, logos, fotos del feed)."
      guide={<GuidePanel
        title="📖 Cómo crear tu cuenta de Cloudinary (5 minutos)"
        steps={[
          <>Andá a <a href="https://cloudinary.com/users/register_free" target="_blank" rel="noreferrer" style={S.link}>cloudinary.com/users/register_free</a> y creá una cuenta con tu email.</>,
          <>Verificá tu email (te llega un link).</>,
          <>Una vez adentro, vas a ver el <b>Dashboard</b>. Arriba a la izquierda dice <code style={{ background: "rgba(255,255,255,.06)", padding: "1px 6px", borderRadius: 3 }}>Cloud name</code> — copialo y pegálo abajo.</>,
          <>Click en <b>API Keys</b> (sidebar izquierdo) → vas a ver tu <code style={{ background: "rgba(255,255,255,.06)", padding: "1px 6px", borderRadius: 3 }}>API Key</code> y <code style={{ background: "rgba(255,255,255,.06)", padding: "1px 6px", borderRadius: 3 }}>API Secret</code>. Click en "👁️" para ver el secret y copiálo.</>,
          <>Pegá los 3 valores acá → Click <b>Probar conexión</b> → si dice ✓ Cloudinary OK, ya está.</>,
        ]}
      />}
      onSave={save} onTest={test} onNext={goNext} onSkip={goSkip}
      msg={msg} saving={saving} testing={testing}
    >
      <label style={S.label}>Cloud name</label>
      <input style={S.input} value={v.cloud_name} onChange={e => setV({ ...v, cloud_name: e.target.value })} placeholder="ej: tu-cloud-nombre" autoComplete="off" />
      <div style={S.hint}>Lo encontrás en cloudinary.com → Dashboard → arriba a la izquierda.</div>

      <label style={S.label}>API Key</label>
      <input style={S.input} value={v.api_key} onChange={e => setV({ ...v, api_key: e.target.value })} placeholder="123456789012345" type="password" autoComplete="off" />

      <label style={S.label}>API Secret 🔒</label>
      <input style={S.input} value={v.api_secret} onChange={e => setV({ ...v, api_secret: e.target.value })} placeholder="abcdefg-XXX" type="password" autoComplete="off" />
      <div style={S.hint}>Se guarda encriptado con AES-256-GCM en la base de datos.</div>

      <label style={S.label}>Carpeta base (opcional)</label>
      <input style={S.input} value={v.folder_base} onChange={e => setV({ ...v, folder_base: e.target.value })} placeholder="portal" />
      <div style={S.hint}>Dónde se uploadean los archivos dentro de Cloudinary. Default: "portal".</div>
    </StepShell>
  );
}

// ── Step 2: Branding ────────────────────────────────────────────────────────
function StepBranding({ goNext, goSkip }) {
  const [v, setV] = useState({ name: "", slogan: "", color_primary: "#3B82F6", color_accent: "#F59E0B", font_preset: "moderna", logo_url: "", favicon_url: "" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSection("branding").then(d => setV(p => ({ ...p, ...d }))); }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const r = await saveSection("branding", v);
    setSaving(false);
    setMsg(r.ok ? { type: "ok", text: "✓ Guardado. Recargá para ver los colores aplicados en toda la app." } : { type: "err", text: "Error al guardar" });
  };

  return (
    <StepShell
      title="2. Marca"
      subtitle="Cómo se ve y se llama tu portal. Los colores se aplican en toda la UI."
      guide={<GuidePanel
        title="📖 Sobre el logo y favicon"
        defaultOpen={false}
        steps={[
          <>Si todavía no subiste el logo, andá al paso 1 (Cloudinary) primero, después subí el logo desde su dashboard.</>,
          <>En Cloudinary, click <b>Media Library</b> → arrastrá tu logo → copiá el "Secure URL" del archivo subido.</>,
          <>Pegálo abajo en "URL del logo". Mismo proceso para el favicon (versión más chica para la pestaña del browser).</>,
          <>Si no tenés logo todavía, dejá los campos vacíos — la app muestra un icono genérico.</>,
        ]}
      />}
      onSave={save} onNext={goNext} onSkip={goSkip} msg={msg} saving={saving}
    >
      <label style={S.label}>Nombre del producto *</label>
      <input style={S.input} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} placeholder="Mi Portal" />
      <div style={S.hint}>Aparece en el title del browser, en emails, en el header.</div>

      <label style={S.label}>Slogan / descripción corta</label>
      <input style={S.input} value={v.slogan} onChange={e => setV({ ...v, slogan: e.target.value })} placeholder="Tu comunidad en un solo lugar" />

      <label style={S.label}>Color primario (botones, links, acentos)</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...S.input, flex: 1 }} value={v.color_primary} onChange={e => setV({ ...v, color_primary: e.target.value })} placeholder="#3B82F6" />
        <input type="color" value={v.color_primary} onChange={e => setV({ ...v, color_primary: e.target.value })} style={{ width: 50, height: 40, padding: 0, border: "none", borderRadius: 8, cursor: "pointer" }} />
      </div>

      <label style={S.label}>Color acento (gradients secundarios)</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...S.input, flex: 1 }} value={v.color_accent} onChange={e => setV({ ...v, color_accent: e.target.value })} placeholder="#F59E0B" />
        <input type="color" value={v.color_accent} onChange={e => setV({ ...v, color_accent: e.target.value })} style={{ width: 50, height: 40, padding: 0, border: "none", borderRadius: 8, cursor: "pointer" }} />
      </div>

      <label style={S.label}>Preset de fuente</label>
      <select style={S.input} value={v.font_preset} onChange={e => setV({ ...v, font_preset: e.target.value })}>
        <option value="moderna">Moderna (Inter — sans-serif limpio)</option>
        <option value="clasica">Clásica (Georgia — serif elegante)</option>
        <option value="tech">Tech (JetBrains Mono — monospace)</option>
        <option value="friendly">Friendly (Quicksand — redondeada)</option>
      </select>

      <label style={S.label}>URL del logo (opcional)</label>
      <input style={S.input} value={v.logo_url} onChange={e => setV({ ...v, logo_url: e.target.value })} placeholder="https://res.cloudinary.com/.../logo.png" />

      <label style={S.label}>URL del favicon (opcional)</label>
      <input style={S.input} value={v.favicon_url} onChange={e => setV({ ...v, favicon_url: e.target.value })} placeholder="https://res.cloudinary.com/.../favicon.png" />

      {/* Preview en vivo */}
      <div style={{ marginTop: 18, padding: 16, borderRadius: 8, background: v.color_primary + "22", border: `1px solid ${v.color_primary}66` }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: v.color_primary, marginBottom: 4 }}>PREVIEW</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{v.name || "Tu Portal"}</div>
        {v.slogan && <div style={{ fontSize: 13, color: "rgba(237,233,224,.6)", marginTop: 2 }}>{v.slogan}</div>}
        <button style={{ marginTop: 10, padding: "8px 16px", background: `linear-gradient(135deg, ${v.color_primary}, ${v.color_accent})`, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, fontFamily: "inherit" }}>
          Botón de ejemplo
        </button>
      </div>
    </StepShell>
  );
}

// ── Step 3: Email (Resend) ──────────────────────────────────────────────────
function StepEmail({ goNext, goSkip }) {
  const [v, setV] = useState({ api_key: "", from_email: "", from_name: "" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSection("resend").then(d => setV(p => ({
      ...p, ...d, api_key: d.api_key === "••••••" ? "" : (d.api_key || "")
    })));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const payload = {}; for (const k of ["api_key","from_email","from_name"]) if (v[k]) payload[k] = v[k];
    const r = await saveSection("resend", payload);
    setSaving(false);
    setMsg(r.ok ? { type: "ok", text: "✓ Guardado." } : { type: "err", text: "Error" });
  };
  const test = async () => {
    setTesting(true); setMsg(null);
    const r = await testProvider("resend");
    setTesting(false);
    setMsg({ type: r.ok ? "ok" : "err", text: r.message });
  };

  return (
    <StepShell
      title="3. Resend (emails)"
      subtitle="Para mandar emails de verificación de cuenta y reset de password. 3000 emails/mes gratis."
      guide={<GuidePanel
        title="📖 Cómo crear cuenta y verificar tu dominio"
        steps={[
          <>Andá a <a href="https://resend.com/signup" target="_blank" rel="noreferrer" style={S.link}>resend.com/signup</a> y creá cuenta gratis.</>,
          <>Una vez adentro, click en <b>API Keys</b> (sidebar) → <b>Create API Key</b> → nombre cualquiera → permisos "Sending access" → copiá la key (empieza con <code>re_</code>).</>,
          <>
            <b>Para mandar emails desde tu dominio</b> (recomendado): click en <b>Domains</b> → <b>Add Domain</b> → tu dominio (ej. <code>tu-cliente.com</code>) → te muestra registros DNS (TXT, MX, DKIM) que tenés que cargar en tu proveedor de DNS (GoDaddy/Cloudflare/etc). Tarda 1-24hs en verificar.
          </>,
          <>
            <b>Para empezar rápido sin DNS</b>: usá <code>onboarding@resend.dev</code> como from_email — funciona pero los users ven que el mail viene de "resend.dev". Cambialo después.
          </>,
          <>Pegá la API key abajo. From email = el que diste de alta en Domains, o <code>onboarding@resend.dev</code> para empezar. From name = el nombre que ven los users.</>,
          <>Click <b>Probar conexión</b> → si dice ✓ Resend OK, ya está.</>,
        ]}
      />}
      onSave={save} onTest={test} onNext={goNext} onSkip={goSkip}
      msg={msg || (!v.api_key ? { type: "warn", text: "⚠ Sin esto los users no pueden verificar email ni resetear password. No te recomendamos saltarlo." } : null)}
      saving={saving} testing={testing}
    >
      <label style={S.label}>API Key (re_…)</label>
      <input style={S.input} value={v.api_key} onChange={e => setV({ ...v, api_key: e.target.value })} placeholder="re_xxx..." type="password" autoComplete="off" />

      <label style={S.label}>From email *</label>
      <input style={S.input} value={v.from_email} onChange={e => setV({ ...v, from_email: e.target.value })} placeholder="noreply@tu-dominio.com" />
      <div style={S.hint}>Debe estar verificado en Resend → Domains. Para empezar: <code>onboarding@resend.dev</code>.</div>

      <label style={S.label}>From name</label>
      <input style={S.input} value={v.from_name} onChange={e => setV({ ...v, from_name: e.target.value })} placeholder="Mi Portal" />
      <div style={S.hint}>Lo que ven los users en su inbox. Suele ser el nombre del producto.</div>
    </StepShell>
  );
}

// ── Step 4: Telegram ────────────────────────────────────────────────────────
function StepTelegram({ goNext, goSkip }) {
  const [v, setV] = useState({ bot_token: "", chat_id: "" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSection("telegram").then(d => setV(p => ({
      ...p,
      bot_token: d.bot_token === "••••••" ? "" : "",
      chat_id:   d.chat_id   === "••••••" ? "" : "",
    })));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const payload = {}; for (const k of ["bot_token","chat_id"]) if (v[k]) payload[k] = v[k];
    const r = await saveSection("telegram", payload);
    setSaving(false);
    setMsg(r.ok ? { type: "ok", text: "✓ Guardado." } : { type: "err", text: "Error" });
  };
  const test = async () => {
    setTesting(true); setMsg(null);
    const r = await testProvider("telegram");
    setTesting(false);
    setMsg({ type: r.ok ? "ok" : "err", text: r.message });
  };

  return (
    <StepShell
      title="4. Telegram (alertas, opcional)"
      subtitle="Para que el server te mande alertas a tu chat de Telegram cuando algo se rompe. Saltable."
      guide={<GuidePanel
        title="📖 Cómo crear el bot en 3 minutos"
        steps={[
          <>Abrí Telegram → buscá <b>@BotFather</b> → click <b>Start</b>.</>,
          <>Mandale <code style={{ background: "rgba(255,255,255,.06)", padding: "1px 6px", borderRadius: 3 }}>/newbot</code> → te pide nombre (ej. "Mi Portal Alertas") → te pide username (debe terminar en "bot", ej. <code>miportal_alerts_bot</code>).</>,
          <>BotFather te responde con un <b>token</b> tipo <code>123456789:ABCdef...</code> — copialo y pegálo abajo.</>,
          <>Ahora necesitás el <b>chat_id</b> de tu chat personal con el bot:</>,
          <>Mandale <code style={{ background: "rgba(255,255,255,.06)", padding: "1px 6px", borderRadius: 3 }}>/start</code> a tu nuevo bot.</>,
          <>Abrí en el browser: <code style={{ background: "rgba(255,255,255,.06)", padding: "1px 6px", borderRadius: 3, fontSize: 11 }}>https://api.telegram.org/bot&lt;TU_TOKEN&gt;/getUpdates</code> (reemplazá &lt;TU_TOKEN&gt; con el token de arriba).</>,
          <>Buscá en el JSON que aparece <code>{'"chat":{"id":...}'}</code> → copiá ese número (puede ser positivo o negativo) → pegálo abajo.</>,
          <>Click <b>Probar conexión</b> → si todo OK, te llega un mensaje de prueba al chat.</>,
        ]}
      />}
      onSave={save} onTest={test} onNext={goNext} onSkip={goSkip}
      msg={msg} saving={saving} testing={testing}
    >
      <label style={S.label}>Bot token</label>
      <input style={S.input} value={v.bot_token} onChange={e => setV({ ...v, bot_token: e.target.value })} placeholder="123456789:ABC-DEF..." type="password" autoComplete="off" />

      <label style={S.label}>Chat ID</label>
      <input style={S.input} value={v.chat_id} onChange={e => setV({ ...v, chat_id: e.target.value })} placeholder="123456789" />
      <div style={S.hint}>Número que sale del getUpdates después de mandarle /start al bot.</div>
    </StepShell>
  );
}

// ── Step 5: Rules + Features ────────────────────────────────────────────────
function StepRules({ goNext, goSkip }) {
  const [v, setV] = useState({ signup_mode: "open", email_verify_required: false, coins_on_register: 3 });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState({ chat: true, stories: true, friends: true, coins: true, webauthn: true });

  useEffect(() => {
    loadSection("rules").then(d => setV(p => ({ ...p, ...d })));
    loadSection("features").then(d => setFeatures(p => ({ ...p, ...d })));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const r1 = await saveSection("rules", v);
    const r2 = await saveSection("features", features);
    setSaving(false);
    setMsg((r1.ok && r2.ok) ? { type: "ok", text: "✓ Guardado." } : { type: "err", text: "Error" });
  };

  const featureDescriptions = {
    chat:     "Chat global y mensajes privados entre users",
    stories:  "Historias de 24hs (estilo Instagram)",
    friends:  "Sistema de amigos / follows",
    coins:    "Coins virtuales como recompensa por actividad",
    webauthn: "Login biométrico (Touch ID, Windows Hello, etc)",
  };

  return (
    <StepShell
      title="5. Reglas y features"
      subtitle="Cómo funciona el portal y qué features están activas."
      guide={<GuidePanel
        title="📖 Qué significa cada cosa"
        defaultOpen={false}
        steps={[
          <><b>Modo Abierto</b>: cualquiera puede registrarse con un código de invitación que generes desde /admin → Coins. <b>Modo Solo invitación</b>: nadie se registra sin que un admin le mande un código.</>,
          <><b>Coins por registro</b>: cuántos coins recibe un user nuevo al registrarse. 0 = no hay reward inicial.</>,
          <><b>Verificación email obligatoria</b>: si está ON, los users no pueden loguear hasta clickear el link del email. Recomendado dejarlo ON.</>,
          <><b>Features</b>: prendé/apagá módulos completos. Apagar <code>chat</code> hace que la página /chat tire 404 y no se renderice el botón en el menú. Cualquier feature se puede prender/apagar después desde /admin → Configuración.</>,
        ]}
      />}
      onSave={save} onNext={goNext} onSkip={goSkip} msg={msg} saving={saving}
    >
      <label style={S.label}>Modo de registro</label>
      <select style={S.input} value={v.signup_mode} onChange={e => setV({ ...v, signup_mode: e.target.value })}>
        <option value="open">Abierto (cualquiera con un código)</option>
        <option value="invite">Solo por invitación (admin manda códigos)</option>
      </select>

      <label style={S.label}>Coins por registro</label>
      <input style={S.input} type="number" min="0" value={v.coins_on_register} onChange={e => setV({ ...v, coins_on_register: Number(e.target.value) })} />

      <label style={{ ...S.label, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={!!v.email_verify_required} onChange={e => setV({ ...v, email_verify_required: e.target.checked })} />
        Requiere verificación de email
      </label>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "rgba(237,233,224,.5)", marginBottom: 12 }}>Features activas</div>
        {Object.keys(features).map(k => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 13 }}>
            <input type="checkbox" checked={!!features[k]} onChange={e => setFeatures({ ...features, [k]: e.target.checked })} />
            <span style={{ width: 78, textTransform: "capitalize", fontWeight: 600 }}>{k}</span>
            <span style={{ color: "rgba(237,233,224,.5)", fontSize: 12 }}>{featureDescriptions[k]}</span>
          </label>
        ))}
      </div>
    </StepShell>
  );
}

// ── Step: MercadoPago (Shop F2) ─────────────────────────────────────────────
function StepMercadoPago({ goNext, goSkip }) {
  const [v, setV] = useState({ access_token: "", public_key: "", webhook_secret: "" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSection("mercadopago").then(d => setV(p => ({
      ...p,
      ...d,
      access_token:   d.access_token   === "••••••" ? "" : (d.access_token || ""),
      webhook_secret: d.webhook_secret === "••••••" ? "" : (d.webhook_secret || ""),
    })));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const payload = {}; for (const k of ["access_token","public_key","webhook_secret"]) if (v[k]) payload[k] = v[k];
    const r = await saveSection("mercadopago", payload);
    setSaving(false);
    setMsg(r.ok ? { type: "ok", text: "✓ Guardado." } : { type: "err", text: "Error" });
  };

  const test = async () => {
    setTesting(true); setMsg(null);
    const r = await testProvider("mercadopago");
    setTesting(false);
    setMsg(r.ok ? { type: "ok", text: `✓ ${r.message}` } : { type: "err", text: `✗ ${r.message || r.error || "Error"}` });
  };

  return (
    <StepShell
      title="6. MercadoPago (pagos del shop)"
      subtitle="Para que los clientes paguen en /shop con tarjeta, débito o efectivo (Rapipago/PagoFácil). Sin esto, el shop crea órdenes 'pendientes' que coordinás manual por WhatsApp."
      guide={<GuidePanel
        title="📖 Cómo obtener tus credenciales de MercadoPago"
        steps={[
          <>Andá a <a href="https://www.mercadopago.com.ar/developers/panel/app" target="_blank" rel="noreferrer" style={S.link}>mercadopago.com.ar/developers/panel/app</a>. Si no tenés cuenta, registrate como <b>vendedor</b> con tu CUIT.</>,
          <>Click <b>Crear aplicación</b> → nombre (ej. "Holistic Shop") → modelo "Pagos online" → producto "Checkout Pro".</>,
          <>En tu app → tab <b>Credenciales de producción</b> → copiá el <code>Access Token</code> y el <code>Public Key</code>. Si querés probar primero, usá las <b>Credenciales de prueba</b> (mismo lugar, otro tab).</>,
          <>Pegá el access_token abajo (es secreto — se encripta). public_key es opcional acá: solo lo necesitás si en el futuro pasamos a Checkout Bricks embebido.</>,
          <><b>webhook_secret</b> (opcional pero recomendado): cualquier string random que vos elijas, ej. <code>hl-mp-2026-xyz</code>. Lo usa el server para validar que las notificaciones vienen realmente de MercadoPago.</>,
          <>Después de guardar, en tu app de MP → <b>Webhooks</b> → URL: <code>{`${API}/api/webhooks/mercadopago?secret=${v.webhook_secret || "TU_WEBHOOK_SECRET"}`}</code> → eventos: <b>Pagos</b>. Ojo: es la URL de la <b>API</b> (no la del sitio).</>,
        ]}
      />}
      onSave={save} onTest={test} onNext={goNext} onSkip={goSkip}
      msg={msg || (!v.access_token ? { type: "warn", text: "⚠ Sin MP el shop funciona en modo manual — las órdenes se crean pero no se cobran online." } : null)}
      saving={saving} testing={testing}
    >
      <label style={S.label}>Access Token (secreto)</label>
      <input style={S.input} value={v.access_token} onChange={e => setV({ ...v, access_token: e.target.value })} placeholder="APP_USR-xxx-xxx-xxx" type="password" autoComplete="off" />
      <div style={S.hint}>Empieza con <code>APP_USR-</code> (prod) o <code>TEST-</code> (sandbox).</div>

      <label style={S.label}>Public Key (opcional)</label>
      <input style={S.input} value={v.public_key} onChange={e => setV({ ...v, public_key: e.target.value })} placeholder="APP_USR-pubkey-xxx" />
      <div style={S.hint}>Solo necesario si después usás Bricks embebido. Checkout Pro (redirect) no lo necesita.</div>

      <label style={S.label}>Webhook Secret</label>
      <input style={S.input} value={v.webhook_secret} onChange={e => setV({ ...v, webhook_secret: e.target.value })} placeholder="cualquier-string-random-tuyo" type="password" autoComplete="off" />
      <div style={S.hint}>Random tuyo. Se appendea como <code>?secret=…</code> en la URL de webhook que cargás en MP.</div>
    </StepShell>
  );
}

// ── Step: Shop (envío + moneda) ─────────────────────────────────────────────
function StepShop({ goNext, goSkip }) {
  const [v, setV] = useState({ currency: "ARS", shipping_cost_cents: 0, transfer_details: "" });
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSection("shop").then(d => setV(p => ({
      ...p,
      currency: d.currency || "ARS",
      shipping_cost_cents: d.shipping_cost_cents != null ? Number(d.shipping_cost_cents) : 0,
      transfer_details: d.transfer_details || "",
    })));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    const payload = {
      currency: v.currency,
      shipping_cost_cents: String(Math.max(0, Math.round(Number(v.shipping_cost_cents) || 0))),
      transfer_details: v.transfer_details,
    };
    const r = await saveSection("shop", payload);
    setSaving(false);
    setMsg(r.ok ? { type: "ok", text: "✓ Guardado." } : { type: "err", text: "Error" });
  };

  const shippingArs = (Number(v.shipping_cost_cents) || 0) / 100;

  return (
    <StepShell
      title="7. Shop (envío y moneda)"
      subtitle="Costo de envío fijo y moneda del catálogo. Productos individuales se gestionan desde /admin → Productos."
      guide={<GuidePanel
        title="📖 Configuración del shop"
        defaultOpen={false}
        steps={[
          <><b>Costo de envío</b>: monto fijo en pesos que se agrega a cada orden. 0 = envío gratis o se coordina aparte. F5+ podemos agregar tabla por provincia / por peso.</>,
          <><b>Moneda</b>: por ahora soporta solo ARS. Productos se cargan en pesos enteros (sin centavos) desde /admin → Productos.</>,
          <><b>Productos del catálogo</b>: ya viene seed con ~40 SKUs reales de Holistic. Podés editarlos / agregar nuevos / sacar lo que no vendés desde /admin → Productos.</>,
        ]}
      />}
      onSave={save} onNext={goNext} onSkip={goSkip} msg={msg} saving={saving}
    >
      <label style={S.label}>Moneda</label>
      <select style={S.input} value={v.currency} onChange={e => setV({ ...v, currency: e.target.value })}>
        <option value="ARS">ARS (Pesos argentinos)</option>
      </select>

      <label style={S.label}>Costo de envío (ARS)</label>
      <input
        style={S.input} type="number" min="0" step="100"
        value={shippingArs}
        onChange={e => setV({ ...v, shipping_cost_cents: String(Math.round(Number(e.target.value || 0) * 100)) })}
        placeholder="0 = a coordinar"
      />
      <div style={S.hint}>0 = se coordina con cada cliente (recomendado mientras armás logística). Si poneé un monto fijo se agrega automáticamente al total.</div>

      <label style={S.label}>Datos para transferencia bancaria</label>
      <textarea
        style={{ ...S.input, minHeight: 130, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, resize: "vertical" }}
        value={v.transfer_details}
        onChange={e => setV({ ...v, transfer_details: e.target.value })}
        placeholder={"Banco\nTitular\nCBU: …\nALIAS: …\nCUIL: …"}
      />
      <div style={S.hint}>
        Si cargás datos acá, el checkout ofrece <b>pagar por transferencia</b>: el cliente ve estos datos, sube el comprobante y vos aprobás el pago desde /admin → Pedidos. Dejalo vacío para ofrecer solo MercadoPago.
      </div>
    </StepShell>
  );
}

// ── Step 6: Final review ────────────────────────────────────────────────────
function StepFinal({ status, onLaunch }) {
  const allCriticalDone = status?.cloudinary && status?.resend && status?.branding;
  return (
    <StepShell
      title="🎉 Resumen"
      subtitle="Listo para arrancar. Lo que falte podés completarlo después desde /admin → Configuración."
      onNext={onLaunch}
      isFinal={true}
      hideSkip={true}
    >
      <div style={{ display: "grid", gap: 8, marginTop: 8, marginBottom: 12 }}>
        {Object.entries(status || {}).map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,.02)", borderRadius: 8, fontSize: 13 }}>
            <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{k}</span>
            <span style={{ color: v ? "#22c55e" : "rgba(237,233,224,.4)", fontSize: 12, fontWeight: 700 }}>{v ? "✓ configurado" : "— pendiente"}</span>
          </div>
        ))}
      </div>

      {!allCriticalDone && (
        <div style={S.msgWarn}>
          ⚠ Te falta configurar al menos una sección crítica (Cloudinary / Resend / Branding). Podés arrancar igual y completarlo después, pero algunas funciones no van a funcionar (ej. emails de verificación, upload de avatars).
        </div>
      )}

      {allCriticalDone && (
        <div style={S.msgOk}>
          ✓ Todo listo para arrancar. Click "Empezar" para ir al inicio del portal.
        </div>
      )}
    </StepShell>
  );
}

// ── Wizard root ─────────────────────────────────────────────────────────────
export default function AdminSetup() {
  const [step, setStep] = useState(0);
  const [status, reload] = useStatus();
  const navigate = useNavigate();

  const STEPS = useMemo(() => [
    { key: "welcome",     label: "Inicio",      done: false },
    { key: "cloudinary",  label: "Cloudinary",  done: status?.cloudinary },
    { key: "branding",    label: "Marca",       done: status?.branding },
    { key: "resend",      label: "Emails",      done: status?.resend },
    { key: "telegram",    label: "Telegram",    done: status?.telegram },
    { key: "mercadopago", label: "MercadoPago", done: status?.mercadopago },
    { key: "shop",        label: "Shop",        done: status?.shop },
    { key: "rules",       label: "Reglas",      done: status?.rules },
    { key: "final",       label: "Listo",       done: false },
  ], [status]);

  const goNext = () => { reload(); setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const goSkip = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const launch = () => { reload(); navigate("/inicio"); };

  return (
    <div style={S.shell}>
      <div style={S.container}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <div style={S.h1}>Setup wizard</div>
            <div style={{ ...S.sub, marginBottom: 0 }}>Paso {step + 1} de {STEPS.length} — {STEPS[step].label}</div>
          </div>
          <a href="/admin" style={{ ...S.btn(), textDecoration: "none", display: "inline-block" }}>← Volver al panel</a>
        </div>

        <div style={S.stepNav}>
          {STEPS.map((s, i) => (
            <button key={s.key} onClick={() => setStep(i)} style={S.stepBtn(i === step, s.done)}>
              {i === 0 ? "👋" : i === STEPS.length - 1 ? "🎉" : i}. {s.label}
            </button>
          ))}
        </div>

        {step === 0 && <StepWelcome     goNext={goNext} />}
        {step === 1 && <StepCloudinary  goNext={goNext} goSkip={goSkip} />}
        {step === 2 && <StepBranding    goNext={goNext} goSkip={goSkip} />}
        {step === 3 && <StepEmail       goNext={goNext} goSkip={goSkip} />}
        {step === 4 && <StepTelegram    goNext={goNext} goSkip={goSkip} />}
        {step === 5 && <StepMercadoPago goNext={goNext} goSkip={goSkip} />}
        {step === 6 && <StepShop        goNext={goNext} goSkip={goSkip} />}
        {step === 7 && <StepRules       goNext={goNext} goSkip={goSkip} />}
        {step === 8 && <StepFinal       status={status} onLaunch={launch} />}
      </div>
    </div>
  );
}
