// client/src/pages/HomeClient.jsx
//
// Home base post-login para users no-staff. Spec § 7.2: 'home base con feed
// del admin + widgets sociales'. Visual overhaul 2026-05-24: design system
// FIJO --c-* / --f-* (mint #A7F5C8, Gotham + Fraunces italic accent), paridad
// con Login/Register, hero editorial sin ruido.
//
// Layout:
//   1. Ticker de anuncios (si hay)
//   2. Hero editorial (saludo + display tipográfico + balance line)
//   3. Pinned announcement / featured post del admin
//   4. Stories (cuando feature ON)
//   5. Grid: feed admin + friends panel
//   6. Anuncios secundarios

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import FriendsPanel from "../components/FriendsPanel.jsx";
import Stories from "../components/Stories.jsx";
import BuyCTA from "../components/BuyCTA.jsx";
import RotatingAuthBg from "../components/RotatingAuthBg.jsx";
import { useFeatureFlag } from "../lib/branding.js";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

/* Categorías de anuncios — color-coded.
   Drop emoji-as-icon, mantener el emoji como contenido inline del autor pero
   no como decoración del chrome. Cat label uppercase tracked = Gotham bold. */
const CAT_CFG = {
  urgente: { label: "Urgente",  color: "#ef4444" },
  feriado: { label: "Feriado",  color: "#60a5fa" },
  tip:     { label: "Tip",      color: "#fbbf24" },
  novedad: { label: "Novedad",  color: "#a78bfa" },
  general: { label: "Anuncio",  color: "var(--c-accent, #A7F5C8)" },
};

const TYPE_LABEL = { post: "Post", story: "Story", update: "Update" };

function relativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
}

/* SVG accents (Lucide-like 1.6 stroke) — reemplazan los emojis decorativos
   del chrome (📌 📰 👥 📢) en los section labels. */
const SectionMark = ({ name }) => {
  const p = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "pin":     return <svg {...p}><path d="M12 17v5"/><path d="M9 10.76A2 2 0 0 0 7.7 12.3 5.2 5.2 0 0 0 12 16a5.2 5.2 0 0 0 4.3-3.7 2 2 0 0 0-1.3-1.54L13.7 4.6a1 1 0 0 0-1.4 0z"/></svg>;
    case "feed":    return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h7M7 16h10"/></svg>;
    case "friends": return <svg {...p}><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><path d="M16 4a3 3 0 1 1 0 6"/><path d="M21 20c0-2.3-1.7-4.2-4-4.8"/></svg>;
    case "list":    return <svg {...p}><path d="M3 6h18M3 12h18M3 18h12"/></svg>;
    default:        return null;
  }
};

export default function HomeClient() {
  const navigate = useNavigate();
  const userCtx = useUser();
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  const showCoins   = useFeatureFlag("coins");
  const showStories = useFeatureFlag("stories");
  const showFriends = useFeatureFlag("friends");

  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/"); return; }
    let abort = false;

    (async () => {
      try {
        const [meRes, profRes, annRes, feedRes] = await Promise.all([
          fetch(`${API}/auth/me`,            { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
          fetch(`${API}/profile`,            { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
          fetch(`${API}/api/announcements`,  { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
          fetch(`${API}/feed`).then(r => r.json()).catch(() => ({})),
        ]);
        if (abort) return;
        if (meRes?.user)            setMe(meRes.user);
        if (profRes?.profile)       setProfile(profRes);
        if (annRes?.announcements)  setAnnouncements(annRes.announcements);
        if (feedRes?.posts)         setFeed(feedRes.posts);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [navigate]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6)  return "Buenas noches";
    if (h < 13) return "Buenos días";
    if (h < 20) return "Buenas tardes";
    return "Buenas noches";
  }, []);
  const today = useMemo(() =>
    new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })
  , []);

  const pinnedAnn = announcements.find(a => a.pinned);
  const otherAnn  = announcements.filter(a => a.id !== pinnedAnn?.id).slice(0, 6);
  const tickerAnn = announcements.slice(0, 8);

  const balance     = profile?.coins?.balance || 0;
  const totalEarned = profile?.coins?.total_earned || 0;
  const displayName = userCtx?.displayName || me?.name || "";
  // nameStyle del UserContext puede tener color/text-shadow custom (gem holders).
  // Si NO hay nameStyle custom, dejamos vacío para que la clase .hc-hello-name
  // aplique Fraunces italic mint por default. Si SÍ hay custom, gana custom.
  const nameStyle   = userCtx?.nameStyle || {};

  return (
    <div className="hc-root">
      <style>{`
        /* ══════════════════════════════════════════════════════════════════
           HOME CLIENT — rewrite minimalista 2026-05-24
           Estética paridad con Login/Register: Gotham + Fraunces italic
           accent, mint #A7F5C8, near-black, layout editorial sin ruido.
           ══════════════════════════════════════════════════════════════════ */
        .hc-root {
          flex: 1;
          min-height: 100vh;
          /* Fondo rotativo del login (RotatingAuthBg, montado abajo): base
             transparente para que la foto + velo se vean detrás del contenido.
             #06070A queda de fallback por si las imágenes no cargan. */
          background: var(--c-bg, #06070A);
          background-color: transparent;
          color: var(--c-text, #F5F2EB);
          font-family: var(--f-body, 'Gotham', sans-serif);
          position: relative;
        }
        .hc-root::before {
          content: ''; position: fixed; inset: 0;
          background:
            radial-gradient(ellipse 50% 40% at 20% 0%, rgba(167,245,200,0.06), transparent 60%),
            radial-gradient(ellipse 60% 50% at 80% 100%, rgba(46,143,110,0.04), transparent 70%);
          pointer-events: none; z-index: 0;
        }
        .hc-page {
          position: relative; z-index: 1;
          max-width: 1140px;
          margin: 0 auto;
          padding: clamp(32px, 5vw, 64px) clamp(20px, 4vw, 40px) 80px;
        }
        @keyframes hcTickerSlide { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes hcFadeUp {
          from { opacity: 0; transform: translateY(14px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        .hc-fade { animation: hcFadeUp .7s var(--ease-out, cubic-bezier(.16,1,.3,1)) both }

        /* ── Ticker (sutil, top edge) ── */
        .hc-ticker {
          border-bottom: 1px solid var(--c-border, rgba(255,255,255,.06));
          background: var(--c-surface, #0E1014);
          overflow: hidden;
          padding: 9px 0;
          position: relative; z-index: 1;
        }
        .hc-ticker-track {
          display: flex;
          white-space: nowrap;
          width: fit-content;
          animation: hcTickerSlide 60s linear infinite;
        }
        .hc-ticker-item {
          display: inline-flex; align-items: center; gap: 12px;
          padding: 0 28px;
          font-size: 12px;
          color: var(--c-text-2, rgba(245,242,235,.72));
        }
        .hc-ticker-cat {
          font-weight: 700; font-size: 10px;
          letter-spacing: 0.22em; text-transform: uppercase;
        }
        .hc-ticker-sep { color: var(--c-text-3, rgba(245,242,235,.5)); }

        /* ── HERO editorial ── */
        .hc-hero {
          margin-bottom: clamp(28px, 4vw, 48px);
          padding-bottom: clamp(28px, 4vw, 40px);
          border-bottom: 1px solid var(--c-border, rgba(255,255,255,.06));
        }
        .hc-eyebrow {
          display: inline-flex; align-items: center; gap: 12px;
          font-weight: 700; font-size: 11px;
          letter-spacing: 0.32em; text-transform: uppercase;
          color: var(--c-accent, #A7F5C8);
          margin-bottom: 18px;
        }
        .hc-eyebrow::before {
          content: ''; width: 24px; height: 1px;
          background: var(--c-accent, #A7F5C8); opacity: .7;
        }
        .hc-hello {
          font-family: var(--f-display, 'Gotham', sans-serif);
          font-weight: 900;
          font-size: clamp(40px, 6vw, 76px);
          line-height: 0.95;
          letter-spacing: -0.03em;
          margin: 0 0 18px;
          color: var(--c-text);
        }
        .hc-hello-name {
          display: inline-block;
          font-style: normal; text-transform: uppercase;
          font-family: var(--f-display, 'Gotham', sans-serif);
          font-weight: 400;
          letter-spacing: -0.015em;
          color: var(--c-accent, #A7F5C8);
        }
        .hc-meta-row {
          display: flex; flex-wrap: wrap;
          gap: 12px; align-items: center;
          margin-top: 14px;
        }
        .hc-balance {
          display: inline-flex; align-items: center; gap: 14px;
          padding: 10px 18px;
          background: rgba(167,245,200,0.06);
          border: 1px solid rgba(167,245,200,0.20);
          border-radius: var(--r-pill, 999px);
          font-size: 12px;
          color: var(--c-text-2, rgba(245,242,235,.72));
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        .hc-balance b {
          font-family: var(--f-display);
          font-weight: 900;
          color: var(--c-accent, #A7F5C8);
          font-size: 17px;
          letter-spacing: 0;
        }
        .hc-balance-sep {
          width: 1px; height: 14px;
          background: rgba(167,245,200,0.30);
        }

        /* ── Section label ── */
        .hc-section-label {
          display: flex; align-items: center; gap: 10px;
          font-weight: 700; font-size: 11px;
          letter-spacing: 0.28em; text-transform: uppercase;
          color: var(--c-accent, #A7F5C8);
          margin-bottom: 18px;
        }
        .hc-section-label__count {
          margin-left: auto;
          color: var(--c-text-3, rgba(245,242,235,.5));
          font-weight: 600;
          letter-spacing: 0.12em;
          font-size: 10px;
        }

        /* ── Card base — flat, no shadow, sutil border ── */
        .hc-card {
          background: var(--c-surface, #0E1014);
          border: 1px solid var(--c-border-2, rgba(255,255,255,.10));
          border-radius: var(--r-3, 14px);
          padding: clamp(20px, 2.5vw, 28px);
        }
        .hc-card--pinned {
          background:
            linear-gradient(155deg, rgba(167,245,200,0.06) 0%, var(--c-surface) 60%);
          border-color: rgba(167,245,200, 0.25);
        }

        /* ── Pinned card ── */
        .hc-pinned-title {
          font-family: var(--f-display);
          font-weight: 900;
          font-size: clamp(22px, 3vw, 30px);
          line-height: 1.15;
          letter-spacing: -0.015em;
          margin: 0 0 10px;
          color: var(--c-text);
        }
        .hc-pinned-title em {
          font-style: normal; text-transform: uppercase;
          font-family: var(--f-display, 'Gotham', sans-serif);
          font-weight: 400;
          color: var(--c-accent, #A7F5C8);
        }
        .hc-pinned-body {
          font-size: 14px;
          color: var(--c-text-2, rgba(245,242,235,.72));
          line-height: 1.65;
          white-space: pre-wrap;
        }

        /* ── Grid feed + friends ── */
        .hc-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 18px;
          margin-bottom: 18px;
        }
        @media (max-width: 980px) { .hc-grid { grid-template-columns: 1fr; } }

        /* ── Feed entry ── */
        .hc-feed-empty {
          padding: 28px 16px;
          text-align: center;
          font-size: 13px;
          color: var(--c-text-3, rgba(245,242,235,.5));
          border: 1px dashed var(--c-border-2, rgba(255,255,255,.10));
          border-radius: var(--r-2, 10px);
        }
        .hc-feed-empty a {
          color: var(--c-accent, #A7F5C8);
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color var(--dur-fast, .15s) ease;
        }
        .hc-feed-empty a:hover { border-bottom-color: var(--c-accent, #A7F5C8); }

        .hc-feed-item {
          padding: 18px 0;
          border-bottom: 1px solid var(--c-border, rgba(255,255,255,.06));
        }
        .hc-feed-item:first-child { padding-top: 0; }
        .hc-feed-item:last-child  { padding-bottom: 0; border-bottom: none; }
        .hc-feed-meta {
          display: flex; gap: 10px; align-items: center;
          margin-bottom: 10px;
        }
        .hc-feed-type {
          font-weight: 700; font-size: 10px;
          letter-spacing: 0.18em; text-transform: uppercase;
          padding: 3px 9px;
          background: rgba(167,245,200,0.08);
          color: var(--c-accent, #A7F5C8);
          border-radius: var(--r-pill, 999px);
        }
        .hc-feed-time {
          font-size: 11px;
          color: var(--c-text-3, rgba(245,242,235,.5));
        }
        .hc-feed-title {
          font-size: 16px; font-weight: 700;
          margin-bottom: 6px;
          color: var(--c-text);
          letter-spacing: -0.005em;
        }
        .hc-feed-body {
          font-size: 14px;
          color: var(--c-text-2, rgba(245,242,235,.72));
          line-height: 1.65;
          white-space: pre-wrap;
        }
        .hc-feed-media { margin-top: 10px; }
        .hc-feed-media img {
          max-width: 100%;
          border-radius: var(--r-2, 10px);
          display: block;
        }

        /* ── Anuncios secundarios — list editorial ── */
        .hc-ann-list { display: grid; gap: 10px; }
        .hc-ann {
          padding: 14px 16px;
          background: var(--c-surface, #0E1014);
          border: 1px solid var(--c-border-2, rgba(255,255,255,.10));
          border-left: 3px solid;
          border-radius: var(--r-2, 10px);
          transition: border-color var(--dur-base, .24s) ease;
        }
        .hc-ann:hover { border-color: var(--c-border-3, rgba(255,255,255,.16)); }
        .hc-ann-meta {
          display: flex; gap: 10px; align-items: center;
          margin-bottom: 6px;
        }
        .hc-ann-cat {
          font-weight: 700; font-size: 10px;
          letter-spacing: 0.18em; text-transform: uppercase;
        }
        .hc-ann-time {
          font-size: 11px;
          color: var(--c-text-3, rgba(245,242,235,.5));
        }
        .hc-ann-title {
          font-size: 14px; font-weight: 700;
          color: var(--c-text);
        }
        .hc-ann-body {
          font-size: 13px;
          color: var(--c-text-2, rgba(245,242,235,.72));
          margin-top: 4px;
          line-height: 1.6;
        }

        .hc-loading {
          color: var(--c-text-3, rgba(245,242,235,.5));
          font-size: 13px;
          padding: 8px 0;
        }
      `}</style>

      {/* Fondo rotativo compartido con el login (2 fotos + velo oscuro).
          Va detrás de todo: .hc-page y .hc-ticker ya están en z-index:1. */}
      <RotatingAuthBg />

      {/* TICKER */}
      {tickerAnn.length > 0 && (
        <div className="hc-ticker" aria-label="Anuncios recientes">
          <div className="hc-ticker-track">
            {[...tickerAnn, ...tickerAnn].map((a, i) => {
              const cat = CAT_CFG[a.category] || CAT_CFG.general;
              return (
                <span key={i} className="hc-ticker-item">
                  <span className="hc-ticker-cat" style={{ color: cat.color }}>{cat.label}</span>
                  <span>{a.title}</span>
                  <span className="hc-ticker-sep">·</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="hc-page">

        {/* HERO */}
        <header className="hc-hero hc-fade">
          <div className="hc-eyebrow">{today}</div>
          <h1 className="hc-hello">
            {greeting},<br />
            <span className="hc-hello-name" style={nameStyle}>
              {displayName || "amigo"}.
            </span>
          </h1>
          {showCoins && (
            <div className="hc-meta-row">
              <div className="hc-balance">
                <span>Balance</span>
                <b>{balance}</b>
                <span className="hc-balance-sep" />
                <span>Total ganado · {totalEarned}</span>
              </div>
            </div>
          )}
          <div style={{ marginTop: 22 }}>
            <BuyCTA variant="inline" label="COMPRAR" />
          </div>
        </header>

        {/* PINNED */}
        {pinnedAnn && (
          <div className="hc-card hc-card--pinned hc-fade" style={{ marginBottom: 18 }}>
            <div className="hc-section-label">
              <SectionMark name="pin" /> Destacado
            </div>
            <h2 className="hc-pinned-title">{pinnedAnn.title}</h2>
            {pinnedAnn.body && <div className="hc-pinned-body">{pinnedAnn.body}</div>}
          </div>
        )}

        {/* STORIES */}
        {showStories && (
          <div className="hc-fade" style={{ marginBottom: 22 }}>
            <Stories />
          </div>
        )}

        {/* GRID */}
        <div className="hc-grid hc-fade">

          {/* Feed */}
          <div className="hc-card">
            <div className="hc-section-label">
              <SectionMark name="feed" /> Novedades
              {feed.length > 0 && <span className="hc-section-label__count">{feed.length} posts</span>}
            </div>
            {loading && <div className="hc-loading">Cargando…</div>}
            {!loading && feed.length === 0 && (
              <div className="hc-feed-empty">
                Todavía no hay novedades. El admin puede postear desde <a href="/admin">/admin</a>.
              </div>
            )}
            {feed.slice(0, 6).map(p => (
              <article key={p.id} className="hc-feed-item">
                <div className="hc-feed-meta">
                  <span className="hc-feed-type">{TYPE_LABEL[p.type] || p.type}</span>
                  <span className="hc-feed-time">{relativeTime(p.created_at)}</span>
                </div>
                {p.title && <div className="hc-feed-title">{p.title}</div>}
                {p.body  && <div className="hc-feed-body">{p.body}</div>}
                {p.media_url && (
                  <div className="hc-feed-media">
                    <img src={p.media_url} alt="" loading="lazy" />
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Friends */}
          {showFriends && (
            <div className="hc-card">
              <div className="hc-section-label">
                <SectionMark name="friends" /> Amigos
              </div>
              <FriendsPanel />
            </div>
          )}
        </div>

        {/* OTROS ANUNCIOS */}
        {otherAnn.length > 0 && (
          <div className="hc-card hc-fade">
            <div className="hc-section-label">
              <SectionMark name="list" /> Anuncios
            </div>
            <div className="hc-ann-list">
              {otherAnn.map(a => {
                const cat = CAT_CFG[a.category] || CAT_CFG.general;
                return (
                  <div key={a.id} className="hc-ann" style={{ borderLeftColor: cat.color }}>
                    <div className="hc-ann-meta">
                      <span className="hc-ann-cat" style={{ color: cat.color }}>{cat.label}</span>
                      <span className="hc-ann-time">{relativeTime(a.created_at)}</span>
                    </div>
                    <div className="hc-ann-title">{a.title}</div>
                    {a.body && <div className="hc-ann-body">{a.body}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <BuyCTA
            variant="banner"
            label="Comprar fertilizantes"
            sublabel="Línea Elite, Pro y Race · Envío en 48 hs · Pagás seguro"
          />
        </div>

      </div>
    </div>
  );
}
