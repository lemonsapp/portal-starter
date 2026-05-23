// client/src/pages/HomeClient.jsx
//
// Home base post-login para users no-staff. Spec § 7.2: 'home base con feed
// del admin + widgets sociales'. Reescrito en Phase 2 (post Sprint 12) con
// tokens --h-* Holistic, Gotham, sin emojis en chrome (SVG accents) y
// hero editorial estilo SPYLT/Linear.
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
  general: { label: "Anuncio",  color: "var(--h-green)" },
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
  const nameStyle   = userCtx?.nameStyle  || { color: "var(--h-green)" };

  return (
    <div className="hc-root">
      <style>{`
        .hc-root {
          flex: 1;
          min-height: 100vh;
          background: var(--h-bg-0);
          color: var(--h-text-1);
        }
        @keyframes hcTickerSlide { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes hcFadeUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
        .hc-fade { animation: hcFadeUp .56s var(--h-ease-out) both }

        /* Ticker — barra horizontal sutil con scroll continuo */
        .hc-ticker {
          border-bottom: 1px solid var(--h-line-1);
          background: var(--h-bg-1);
          overflow: hidden;
          padding: 10px 0;
        }
        .hc-ticker-track {
          display: flex;
          white-space: nowrap;
          width: fit-content;
          animation: hcTickerSlide 64s linear infinite;
        }
        .hc-ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 0 28px;
          font-size: 12px;
          color: var(--h-text-2);
        }
        .hc-ticker-cat {
          font-family: var(--h-font-tag);
          font-weight: 700;
          font-size: 9px;
          letter-spacing: 1.6px;
          text-transform: uppercase;
        }
        .hc-ticker-sep { color: var(--h-text-4); }

        .hc-page {
          max-width: 1180px;
          margin: 0 auto;
          padding: 36px 24px 56px;
        }

        /* HERO editorial */
        .hc-hero { margin-bottom: 36px; }
        .hc-eyebrow {
          font-family: var(--h-font-tag);
          font-weight: 700;
          font-size: 10px;
          letter-spacing: 2.4px;
          text-transform: uppercase;
          color: var(--h-text-3);
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .hc-eyebrow::before {
          content: '';
          width: 28px;
          height: 1px;
          background: var(--h-sand);
        }
        .hc-eyebrow .hc-eb-sand { color: var(--h-sand); }
        .hc-hello {
          font-family: var(--h-font-display);
          font-weight: 900;
          font-size: clamp(38px, 5.4vw, 64px);
          line-height: .94;
          letter-spacing: -0.025em;
          margin: 0 0 14px;
          color: var(--h-text-1);
        }
        .hc-balance {
          font-size: 14px;
          color: var(--h-text-2);
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: var(--h-bg-2);
          border: 1px solid var(--h-line-2);
          border-radius: var(--h-r-full);
        }
        .hc-balance b {
          font-family: var(--h-font-display);
          font-weight: 900;
          color: var(--h-green);
          font-size: 18px;
          letter-spacing: 0;
        }
        .hc-balance-sep {
          width: 1px;
          height: 14px;
          background: var(--h-line-3);
        }

        /* Card base */
        .hc-card {
          background: var(--h-bg-1);
          border: 1px solid var(--h-line-2);
          border-radius: var(--h-r-lg);
          padding: 22px;
        }
        .hc-card--pinned {
          border-color: var(--h-green-mid);
          background: linear-gradient(180deg, var(--h-green-soft) 0%, var(--h-bg-1) 100%);
        }
        .hc-section-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--h-font-tag);
          font-weight: 700;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--h-sand);
          margin-bottom: 14px;
        }
        .hc-section-label__count {
          margin-left: auto;
          color: var(--h-text-3);
          font-weight: 500;
          letter-spacing: 1px;
        }

        /* Pinned card */
        .hc-pinned-title {
          font-family: var(--h-font-display);
          font-weight: 900;
          font-size: 24px;
          line-height: 1.16;
          letter-spacing: -0.01em;
          margin: 0 0 8px;
          color: var(--h-text-1);
        }
        .hc-pinned-body {
          font-size: 14px;
          color: var(--h-text-2);
          line-height: 1.65;
          white-space: pre-wrap;
        }

        /* Grid feed + friends */
        .hc-grid {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 18px;
          margin-bottom: 18px;
        }
        @media (max-width: 980px) { .hc-grid { grid-template-columns: 1fr; } }

        /* Feed entry */
        .hc-feed-empty {
          padding: 24px;
          text-align: center;
          font-size: 13px;
          color: var(--h-text-3);
        }
        .hc-feed-empty a { color: var(--h-green); text-decoration: none; }
        .hc-feed-empty a:hover { text-decoration: underline; }

        .hc-feed-item {
          padding: 14px 0;
          border-bottom: 1px solid var(--h-line-1);
        }
        .hc-feed-item:last-child { border-bottom: none; }
        .hc-feed-meta {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 8px;
        }
        .hc-feed-type {
          font-family: var(--h-font-tag);
          font-weight: 700;
          font-size: 9px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          padding: 3px 8px;
          background: var(--h-bg-2);
          color: var(--h-text-2);
          border-radius: var(--h-r-xs);
        }
        .hc-feed-time { font-size: 11px; color: var(--h-text-3); }
        .hc-feed-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; color: var(--h-text-1); }
        .hc-feed-body  { font-size: 13px; color: var(--h-text-2); line-height: 1.65; white-space: pre-wrap; }
        .hc-feed-media { margin-top: 8px; }
        .hc-feed-media img { max-width: 100%; border-radius: var(--h-r-md); display: block; }

        /* Anuncios secundarios */
        .hc-ann-list { display: grid; gap: 8px; }
        .hc-ann {
          padding: 12px 14px;
          background: var(--h-bg-2);
          border-left: 3px solid;
          border-radius: var(--h-r-sm);
        }
        .hc-ann-meta {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 4px;
        }
        .hc-ann-cat {
          font-family: var(--h-font-tag);
          font-weight: 700;
          font-size: 9px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
        }
        .hc-ann-time { font-size: 11px; color: var(--h-text-3); }
        .hc-ann-title { font-size: 14px; font-weight: 600; color: var(--h-text-1); }
        .hc-ann-body  { font-size: 13px; color: var(--h-text-2); margin-top: 4px; line-height: 1.6; }

        .hc-loading { color: var(--h-text-3); font-size: 13px; padding: 8px 0; }
      `}</style>

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
          <div className="hc-eyebrow"><span className="hc-eb-sand">{today}</span></div>
          <h1 className="hc-hello">
            {greeting},<br />
            <span style={nameStyle}>{displayName || "amigo"}</span>
          </h1>
          {showCoins && (
            <div className="hc-balance">
              <span>Balance</span>
              <b>{balance}</b>
              <span className="hc-balance-sep" />
              <span>Total ganado · {totalEarned}</span>
            </div>
          )}
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

      </div>
    </div>
  );
}
