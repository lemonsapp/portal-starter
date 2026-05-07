// client/src/pages/HomeClient.jsx
//
// Home base post-login para users no-staff. Spec § 7.2: 'home base con feed
// del admin + widgets sociales'. Reescrito en Sprint 4 para sacar todo lo
// que era cargas-específico del original Lemons (shipments, cotizar, ETA,
// tracking, ShipmentRow, etc.).
//
// Layout:
//   1. Ticker de anuncios (si hay)
//   2. Hero greeting (saludo + nombre)
//   3. Pinned announcement / featured post del admin
//   4. Stories (FriendsPanel + Stories component, ambos existentes)
//   5. Feed posts (lista del /feed endpoint del admin-feed)
//   6. Mi balance de coins (si la feature está ON)

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import FriendsPanel from "../components/FriendsPanel.jsx";
import Stories from "../components/Stories.jsx";
import { useFeatureFlag } from "../lib/branding.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const CAT_CFG = {
  urgente: { label: "Urgente",  emoji: "🚨", color: "#ef4444" },
  feriado: { label: "Feriado",  emoji: "🎌", color: "#60a5fa" },
  tip:     { label: "Tip",      emoji: "💡", color: "#fbbf24" },
  novedad: { label: "Novedad",  emoji: "✨", color: "#a78bfa" },
  general: { label: "Anuncio",  emoji: "📢", color: "var(--brand-primary, #3B82F6)" },
};

const TYPE_LABEL = {
  post:   "Post",
  story:  "Story",
  update: "Update",
};

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
  const today = useMemo(() => new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }), []);

  const pinnedAnn = announcements.find(a => a.pinned);
  const otherAnn  = announcements.filter(a => a.id !== pinnedAnn?.id).slice(0, 6);
  const tickerAnn = announcements.slice(0, 8);

  const balance     = profile?.coins?.balance || 0;
  const totalEarned = profile?.coins?.total_earned || 0;
  const displayName = userCtx?.displayName || me?.name || "";
  const nameStyle   = userCtx?.nameStyle  || { color: "var(--brand-primary, #3B82F6)" };

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "var(--brand-bg, #080808)", color: "var(--brand-text, #ede9e0)" }}>
      <style>{`
        @keyframes hcTickerSlide { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes hcFadeUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
        .hc-fade { animation: hcFadeUp .6s cubic-bezier(.2,.8,.2,1) both }
        .hc-card { background: rgba(8,9,16,.85); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 22px; }
        .hc-grid-2 { display: grid; grid-template-columns: 1.6fr 1fr; gap: 18px; }
        @media (max-width: 980px) { .hc-grid-2 { grid-template-columns: 1fr } }
      `}</style>

      {/* TICKER */}
      {tickerAnn.length > 0 && (
        <div style={{ borderBottom: "1px solid rgba(255,255,255,.08)", overflow: "hidden", padding: "11px 0", background: "rgba(255,255,255,.02)" }}>
          <div style={{ display: "flex", whiteSpace: "nowrap", animation: "hcTickerSlide 60s linear infinite", width: "fit-content" }}>
            {[...tickerAnn, ...tickerAnn].map((a, i) => {
              const cat = CAT_CFG[a.category] || CAT_CFG.general;
              return (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "0 32px", fontSize: 12, color: "rgba(255,255,255,.7)" }}>
                  <span style={{ fontSize: 14 }}>{a.emoji || cat.emoji}</span>
                  <span style={{ fontWeight: 700, color: cat.color, textTransform: "uppercase", letterSpacing: 1.5, fontSize: 10 }}>{cat.label}</span>
                  <span>{a.title}</span>
                  <span style={{ color: "rgba(255,255,255,.25)" }}>·</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 48px" }}>

        {/* HERO */}
        <div className="hc-fade" style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,.4)", marginBottom: 10 }}>{today}</div>
          <h1 style={{ fontSize: "clamp(34px,5vw,58px)", lineHeight: 1, margin: "0 0 12px 0", fontFamily: "var(--brand-font, Inter, sans-serif)", fontWeight: 800 }}>
            {greeting},<br />
            <span style={nameStyle}>{displayName || "amigo"}</span>
          </h1>
          {showCoins && (
            <div style={{ fontSize: 14, color: "rgba(255,255,255,.55)" }}>
              Tu balance: <b style={{ color: "var(--brand-primary, #3B82F6)" }}>{balance}</b> coins · ganados en total: {totalEarned}
            </div>
          )}
        </div>

        {/* PINNED ANNOUNCEMENT */}
        {pinnedAnn && (
          <div className="hc-card hc-fade" style={{ marginBottom: 18, borderColor: "var(--brand-primary, #3B82F6)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "var(--brand-primary, #3B82F6)", marginBottom: 8 }}>📌 Destacado</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{pinnedAnn.title}</div>
            {pinnedAnn.body && <div style={{ fontSize: 14, color: "rgba(255,255,255,.7)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{pinnedAnn.body}</div>}
          </div>
        )}

        {/* STORIES (si la feature está ON) */}
        {showStories && (
          <div className="hc-fade" style={{ marginBottom: 22 }}>
            <Stories />
          </div>
        )}

        {/* GRID: feed admin + friends */}
        <div className="hc-grid-2 hc-fade" style={{ marginBottom: 18 }}>

          {/* Feed posts del admin (de /feed) */}
          <div className="hc-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brand-primary, #3B82F6)", fontWeight: 700 }}>📰 Novedades</div>
              {feed.length > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>{feed.length} posts</div>}
            </div>
            {loading && <div style={{ color: "rgba(255,255,255,.4)", fontSize: 13 }}>Cargando…</div>}
            {!loading && feed.length === 0 && (
              <div style={{ padding: 18, fontSize: 13, color: "rgba(255,255,255,.45)", textAlign: "center" }}>
                Todavía no hay novedades. El admin puede postear desde <a href="/admin" style={{ color: "var(--brand-primary, #3B82F6)" }}>/admin</a>.
              </div>
            )}
            {feed.slice(0, 6).map(p => (
              <div key={p.id} style={{ padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.6)", letterSpacing: 1, textTransform: "uppercase" }}>{TYPE_LABEL[p.type] || p.type}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>{relativeTime(p.created_at)}</span>
                </div>
                {p.title && <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{p.title}</div>}
                {p.body  && <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{p.body}</div>}
                {p.media_url && (
                  <div style={{ marginTop: 8 }}>
                    <img src={p.media_url} alt="" style={{ maxWidth: "100%", borderRadius: 8 }} loading="lazy" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Friends (si la feature está ON) */}
          {showFriends && (
            <div className="hc-card">
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--brand-primary, #3B82F6)", fontWeight: 700, marginBottom: 14 }}>👥 Amigos</div>
              <FriendsPanel />
            </div>
          )}
        </div>

        {/* OTROS ANUNCIOS */}
        {otherAnn.length > 0 && (
          <div className="hc-card hc-fade">
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,.5)", fontWeight: 700, marginBottom: 14 }}>📢 Anuncios</div>
            <div style={{ display: "grid", gap: 8 }}>
              {otherAnn.map(a => {
                const cat = CAT_CFG[a.category] || CAT_CFG.general;
                return (
                  <div key={a.id} style={{ padding: "10px 14px", background: "rgba(255,255,255,.02)", borderRadius: 8, borderLeft: `3px solid ${cat.color}` }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{a.emoji || cat.emoji}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: cat.color, letterSpacing: 1.5, textTransform: "uppercase" }}>{cat.label}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>{relativeTime(a.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</div>
                    {a.body && <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginTop: 4 }}>{a.body}</div>}
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
