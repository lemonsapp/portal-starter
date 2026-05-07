import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import FriendsPanel from "../components/FriendsPanel.jsx";
import Stories from "../components/Stories.jsx";
import { Pop, FadeUp, Jumbo, CountUp } from "../components/MotionPop.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const CAT_CFG = {
  urgente: { label: "Urgente",  emoji: "🚨", color: "#ef4444", bg: "rgba(239,68,68,.08)",  bd: "rgba(239,68,68,.3)" },
  linea:   { label: "Líneas",   emoji: "🌐", color: "var(--brand-primary, #f5e03a)", bg: "rgba(245,224,58,.08)", bd: "rgba(245,224,58,.3)" },
  feriado: { label: "Feriado",  emoji: "🎌", color: "#60a5fa", bg: "rgba(96,165,250,.08)", bd: "rgba(96,165,250,.3)" },
  tip:     { label: "Tip",      emoji: "💡", color: "#fbbf24", bg: "rgba(251,191,36,.08)", bd: "rgba(251,191,36,.3)" },
  novedad: { label: "Novedad",  emoji: "✨", color: "#a78bfa", bg: "rgba(167,139,250,.08)",bd: "rgba(167,139,250,.3)" },
  general: { label: "Anuncio",  emoji: "📢", color: "#ede9e0", bg: "rgba(237,233,224,.05)",bd: "rgba(237,233,224,.18)" },
};

function relativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff/86400)} d`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default function HomeClient() {
  const navigate = useNavigate();
  const userCtx = useUser();
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/"); return; }
    let abort = false;

    async function loadAll() {
      try {
        const [meRes, profRes, shipRes, annRes] = await Promise.all([
          fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
          fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
          fetch(`${API}/client/shipments`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
          fetch(`${API}/api/announcements`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({})),
        ]);
        if (abort) return;
        if (meRes?.user) setMe(meRes.user);
        if (profRes?.profile) setProfile(profRes);
        if (shipRes?.shipments) setShipments(shipRes.shipments);
        if (annRes?.announcements) setAnnouncements(annRes.announcements);
      } finally {
        if (!abort) setLoading(false);
      }
    }
    loadAll();
    return () => { abort = true; };
  }, [navigate]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6)  return "Buenas noches";
    if (h < 13) return "Buenos días";
    if (h < 20) return "Buenas tardes";
    return "Buenas noches";
  }, []);

  const today = useMemo(() => new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }), []);

  const pinnedAnn = announcements.find(a => a.pinned);
  const otherAnn  = announcements.filter(a => a.id !== pinnedAnn?.id).slice(0, 6);
  const tickerAnn = announcements.slice(0, 8);

  const activeShips = shipments.filter(s => s.status !== "Entregado");
  const totalShips = shipments.length;
  const balance = profile?.coins?.balance || 0;
  const displayName = userCtx?.displayName || me?.name || "";
  const nameStyle = userCtx?.nameStyle || { color: "var(--brand-primary, #f5e03a)" };

  const nextDelivery = activeShips
    .map(s => ({ ...s, etaDate: s.estimated_delivery_date ? new Date(s.estimated_delivery_date) : null }))
    .filter(s => s.etaDate)
    .sort((a, b) => a.etaDate - b.etaDate)[0];

  return (
    <div style={{ flex: 1, minHeight: "100vh", background: "var(--void, #020307)", color: "#ede9e0" }}>
      <style>{`
        @keyframes hcTickerSlide{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes hcBarGlow{from{background-position:0 0}to{background-position:200% 0}}
        @keyframes hcPulseDot{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:1;transform:scale(1.3)}}
        @keyframes hcFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes hcShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .hc-fade{animation:hcFadeUp .6s cubic-bezier(.2,.8,.2,1) both}
        .hc-card{background:rgba(8,9,16,.85);border:1px solid rgba(245,224,58,.12);border-radius:18px;position:relative;overflow:hidden}
        .hc-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--ac,var(--brand-primary, #f5e03a)),transparent);background-size:200% 100%;animation:hcBarGlow 3s linear infinite}
        .hc-cat-chip{font-family:'DM Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:3px 9px;border-radius:4px;display:inline-flex;align-items:center;gap:5px}
        .hc-quick-btn{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.08);padding:18px;border-radius:14px;cursor:pointer;text-align:left;transition:all .25s;display:flex;align-items:center;gap:14px;color:#ede9e0;text-decoration:none;width:100%;font-family:inherit}
        .hc-quick-btn:hover{background:rgba(245,224,58,.06);border-color:rgba(245,224,58,.22);transform:translateY(-2px)}
        .hc-skel{background:linear-gradient(90deg,rgba(255,255,255,.02) 0px,rgba(255,255,255,.05) 200px,rgba(255,255,255,.02) 400px);background-size:800px;animation:hcShimmer 1.4s linear infinite;border-radius:12px}
        .hc-grid-2{display:grid;grid-template-columns:1.6fr 1fr;gap:18px}
        @media(max-width:980px){.hc-grid-2{grid-template-columns:1fr}}
        .hc-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        @media(max-width:780px){.hc-grid-3{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:480px){.hc-grid-3{grid-template-columns:1fr}}

        /* ANUNCIO ROW (lista del feed) */
        .hc-ann-row{
          position:relative;
          display:flex;
          gap:14px;
          align-items:flex-start;
          padding:14px 16px 14px 22px;
          background:rgba(255,255,255,.022);
          border:1px solid rgba(255,255,255,.05);
          border-radius:12px;
          transition:all .28s cubic-bezier(.2,.8,.2,1);
          overflow:hidden;
        }
        .hc-ann-row + .hc-ann-row{margin-top:10px}
        .hc-ann-row:hover{
          background:var(--cat-bg);
          border-color:var(--cat-bd);
          transform:translateX(2px);
        }
        .hc-ann-bar{
          position:absolute;
          top:10px;bottom:10px;left:0;
          width:3px;border-radius:0 3px 3px 0;
          background:var(--cat-color);
          box-shadow:0 0 12px var(--cat-color);
          opacity:.85;
        }
        .hc-ann-icon{
          flex-shrink:0;
          width:34px;height:34px;
          border-radius:10px;
          display:flex;align-items:center;justify-content:center;
          font-size:18px;line-height:1;
          background:var(--cat-bg);
          border:1px solid var(--cat-bd);
          margin-top:2px;
          filter:drop-shadow(0 0 8px var(--cat-color)55);
        }
        .hc-ann-body{flex:1;min-width:0}
        .hc-ann-meta{
          display:flex;align-items:center;gap:8px;
          margin-bottom:6px;flex-wrap:wrap;
        }
        .hc-ann-time{
          font-family:'DM Mono',monospace;
          font-size:9px;letter-spacing:1.2px;
          color:rgba(255,255,255,.32);
          margin-left:auto;
          flex-shrink:0;
        }
        .hc-ann-title{
          font-family:'Barlow',sans-serif;
          font-size:14px;font-weight:700;
          color:#fff;line-height:1.4;
          margin-bottom:4px;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
          word-break:break-word;
        }
        .hc-ann-text{
          font-size:12px;color:rgba(255,255,255,.55);
          line-height:1.55;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
          word-break:break-word;
        }
        .hc-ann-link{
          margin-top:8px;
          font-family:'DM Mono',monospace;
          font-size:10px;letter-spacing:1.2px;
          font-weight:700;
        }
        .hc-ann-arrow{
          font-size:22px;
          color:rgba(255,255,255,.2);
          align-self:center;
          margin-right:-4px;
          transition:all .25s;
          flex-shrink:0;
        }
        .hc-ann-row:hover .hc-ann-arrow{
          color:var(--cat-color);
          transform:translateX(3px);
        }
      `}</style>

      {/* TICKER */}
      {tickerAnn.length > 0 && (
        <div style={{ background: "linear-gradient(90deg,rgba(245,224,58,.04),rgba(255,85,0,.04))", borderBottom: "1px solid rgba(245,224,58,.14)", overflow: "hidden", padding: "11px 0", position: "relative" }}>
          <div style={{ display: "flex", whiteSpace: "nowrap", animation: "hcTickerSlide 60s linear infinite", width: "fit-content" }}>
            {[...tickerAnn, ...tickerAnn].map((a, i) => {
              const cat = CAT_CFG[a.category] || CAT_CFG.general;
              return (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "0 32px", fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 1, color: "rgba(255,255,255,.7)" }}>
                  <span style={{ fontSize: 14 }}>{a.emoji || cat.emoji}</span>
                  <span style={{ fontWeight: 700, color: cat.color, textTransform: "uppercase", letterSpacing: 1.5 }}>{cat.label}</span>
                  <span>{a.title}</span>
                  <span style={{ color: "rgba(255,255,255,.25)" }}>·</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px 48px" }}>

        {/* HERO GREETING */}
        <div className="hc-fade" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,.4)", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 24, height: 1, background: "rgba(245,224,58,.5)" }} />
              {today}
            </div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(36px,5vw,64px)", lineHeight: .95, letterSpacing: 1.2, color: "#fff" }}>
              {greeting},<br />
              <span style={{ ...nameStyle, fontFamily: "'Bebas Neue',sans-serif" }}>{displayName}</span>
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,.5)", marginTop: 14, maxWidth: 540, lineHeight: 1.7 }}>
              Acá vas a ver el estado de las líneas, anuncios y novedades de tus envíos en vivo.
            </div>
          </div>

          {/* Stat strip */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Pop as="button" onClick={() => navigate("/client/shipments")} className="hc-quick-btn" style={{ width: 160, padding: "14px 16px" }}>
              <div style={{ fontSize: 28 }}>📦</div>
              <div>
                <CountUp value={activeShips.length} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, lineHeight: 1, color: "var(--brand-primary, #f5e03a)", letterSpacing: 1, display: "block" }}>{activeShips.length}</CountUp>
                <div style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: 1.5, color: "rgba(255,255,255,.4)", textTransform: "uppercase" }}>Activos · {totalShips} total</div>
              </div>
            </Pop>
            <Pop as="button" onClick={() => navigate("/coins")} className="hc-quick-btn" style={{ width: 160, padding: "14px 16px" }}>
              <div style={{ fontSize: 28 }}>🍋</div>
              <div>
                <CountUp value={balance} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, lineHeight: 1, color: "var(--brand-primary, #f5e03a)", letterSpacing: 1, display: "block" }}>{balance.toLocaleString()}</CountUp>
                <div style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: 1.5, color: "rgba(255,255,255,.4)", textTransform: "uppercase" }}>Coins</div>
              </div>
            </Pop>
          </div>
        </div>

        {/* STORIES (estilo IG) */}
        <div className="hc-fade" style={{ animationDelay: "40ms", marginBottom: 14 }}>
          <Stories announcements={announcements} />
        </div>

        {/* ROW 1: featured announcement + lines status */}
        <div className="hc-grid-2 hc-fade" style={{ animationDelay: "80ms", marginBottom: 18 }}>
          {/* Featured / Pinned */}
          {loading ? (
            <div className="hc-skel" style={{ height: 280 }} />
          ) : pinnedAnn ? (
            <FeaturedAnnouncement ann={pinnedAnn} />
          ) : (
            <EmptyFeatured nextDelivery={nextDelivery} />
          )}

        </div>

        {/* ROW 2: announcements feed + shipments preview */}
        <div className="hc-grid-2 hc-fade" style={{ animationDelay: "160ms", marginBottom: 18 }}>
          {/* Announcements feed */}
          <div className="hc-card" style={{ "--ac": "#a78bfa", padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: "#a78bfa", fontWeight: 600, marginBottom: 6 }}>
                  📰 Novedades
                </div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 1.2, color: "#fff", lineHeight: 1 }}>
                  Últimas novedades
                </div>
              </div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5, color: "rgba(255,255,255,.35)" }}>
                {announcements.length} {announcements.length === 1 ? "aviso" : "avisos"}
              </div>
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1,2,3].map(i => <div key={i} className="hc-skel" style={{ height: 70 }} />)}
              </div>
            ) : otherAnn.length === 0 && !pinnedAnn ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10, opacity: .4 }}>📭</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)" }}>No hay novedades por ahora</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.25)", marginTop: 6, fontFamily: "'DM Mono',monospace" }}>Volvé pronto · Las publicamos seguido</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {otherAnn.map(a => <AnnRow key={a.id} ann={a} />)}
              </div>
            )}
          </div>

          {/* Shipments preview */}
          <div className="hc-card" style={{ "--ac": "#22c55e", padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: "#22c55e", fontWeight: 600, marginBottom: 6 }}>
                  📦 Mis envíos
                </div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 1.2, color: "#fff", lineHeight: 1 }}>
                  Activos
                </div>
              </div>
              <button onClick={() => navigate("/client/shipments")}
                style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 1.5, color: "#22c55e", background: "none", border: "1px solid rgba(34,197,94,.3)", padding: "6px 12px", cursor: "pointer", fontWeight: 700 }}>
                Ver todos →
              </button>
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1,2,3].map(i => <div key={i} className="hc-skel" style={{ height: 60 }} />)}
              </div>
            ) : activeShips.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 8, opacity: .4 }}>🍋</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>Sin envíos activos</div>
                <button onClick={() => navigate("/client/quote")}
                  style={{ marginTop: 14, padding: "10px 18px", background: "var(--brand-primary, #f5e03a)", color: "#020307", border: "none", fontWeight: 700, fontFamily: "'DM Mono',monospace", letterSpacing: 1.5, fontSize: 11, cursor: "pointer", textTransform: "uppercase" }}>
                  💬 Cotizar nuevo →
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeShips.slice(0, 4).map(s => <ShipmentRow key={s.id} ship={s} onClick={() => navigate("/client/shipments")} />)}
              </div>
            )}
          </div>
        </div>

        {/* ROW 2.5: Friends presence */}
        <div className="hc-fade" style={{ animationDelay: "200ms", marginBottom: 18 }}>
          <FriendsPanel />
        </div>

        {/* ROW 3: Quick actions */}
        <div className="hc-grid-3 hc-fade" style={{ animationDelay: "240ms" }}>
          <Pop as="button" onClick={() => navigate("/client/quote")} className="hc-quick-btn">
            <div style={{ fontSize: 32, filter: "drop-shadow(0 0 8px rgba(34,197,94,.4))" }}>🧮</div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: "#fff", letterSpacing: 1, lineHeight: 1 }}>Cotizar envío</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 3 }}>Calculá precio en segundos</div>
            </div>
          </Pop>
          <Pop as="a" href="https://wa.me/5491157479346?text=Hola!%20Tengo%20una%20consulta" target="_blank" rel="noreferrer" className="hc-quick-btn">
            <div style={{ fontSize: 32, filter: "drop-shadow(0 0 8px rgba(96,165,250,.4))" }}>💬</div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: "#fff", letterSpacing: 1, lineHeight: 1 }}>WhatsApp</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 3 }}>Te respondemos al toque</div>
            </div>
          </Pop>
          <Pop as="button" onClick={() => navigate("/coins")} className="hc-quick-btn">
            <div style={{ fontSize: 32, filter: "drop-shadow(0 0 10px rgba(245,224,58,.5))" }}>🍋</div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: "#fff", letterSpacing: 1, lineHeight: 1 }}>Mis Coins</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 3 }}>{balance.toLocaleString()} disponibles</div>
            </div>
          </Pop>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function FeaturedAnnouncement({ ann }) {
  const cat = CAT_CFG[ann.category] || CAT_CFG.general;
  return (
    <div style={{ background: `linear-gradient(135deg,${cat.bg},rgba(8,9,16,.85))`, border: `1px solid ${cat.bd}`, borderRadius: 18, padding: "32px 32px 28px", position: "relative", overflow: "hidden", minHeight: 280 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,transparent,${cat.color},transparent)`, backgroundSize: "200% 100%", animation: "hcBarGlow 3s linear infinite" }} />
      <div style={{ position: "absolute", top: 16, right: 16, fontSize: 96, opacity: .08, lineHeight: 1, transform: "rotate(-8deg)" }}>{ann.emoji || cat.emoji}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span className="hc-cat-chip" style={{ color: cat.color, background: cat.bg, border: `1px solid ${cat.bd}` }}>
          📌 Destacado
        </span>
        <span className="hc-cat-chip" style={{ color: cat.color, background: cat.bg, border: `1px solid ${cat.bd}` }}>
          {cat.emoji} {cat.label}
        </span>
      </div>

      <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 14, filter: `drop-shadow(0 0 20px ${cat.color}66)` }}>{ann.emoji || cat.emoji}</div>

      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(28px,3vw,40px)", lineHeight: .95, letterSpacing: 1, color: "#fff", marginBottom: 12, position: "relative" }}>
        {ann.title}
      </div>
      {ann.body && (
        <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,.7)", marginBottom: 18, maxWidth: 560, position: "relative" }}>
          {ann.body}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
        {ann.link_url && (
          <a href={ann.link_url} target="_blank" rel="noreferrer"
             style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", background: cat.color, color: "#020307", textDecoration: "none", fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>
            {ann.link_label || "Más info"} →
          </a>
        )}
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 1.5, color: "rgba(255,255,255,.35)" }}>
          {relativeTime(ann.starts_at || ann.created_at)}
        </span>
      </div>
    </div>
  );
}

function EmptyFeatured({ nextDelivery }) {
  return (
    <div style={{ background: "linear-gradient(135deg,rgba(245,224,58,.05),rgba(8,9,16,.85))", border: "1px solid rgba(245,224,58,.18)", borderRadius: 18, padding: "32px", position: "relative", overflow: "hidden", minHeight: 280, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,transparent,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a),transparent)", backgroundSize: "200% 100%", animation: "hcBarGlow 3s linear infinite" }} />
      <div style={{ position: "absolute", top: -10, right: -10, fontSize: 200, opacity: .04, lineHeight: 1, transform: "rotate(-12deg)" }}>🍋</div>

      <div className="hc-cat-chip" style={{ color: "var(--brand-primary, #f5e03a)", background: "rgba(245,224,58,.06)", border: "1px solid rgba(245,224,58,.25)", marginBottom: 16, alignSelf: "flex-start" }}>
        ✨ Bienvenido
      </div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(32px,3.5vw,48px)", lineHeight: .95, letterSpacing: 1, color: "#fff", marginBottom: 14, position: "relative" }}>
        TU PORTAL<br /><span style={{ color: "var(--brand-primary, #f5e03a)" }}>EN VIVO</span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,.6)", maxWidth: 480, position: "relative", marginBottom: 18 }}>
        {nextDelivery
          ? `Tu próxima entrega estimada: ${new Date(nextDelivery.estimated_delivery_date).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}.`
          : "Acá vas a ver novedades, estado de líneas, tips de importación y avisos importantes."}
      </div>
    </div>
  );
}

function AnnRow({ ann }) {
  const cat = CAT_CFG[ann.category] || CAT_CFG.general;
  const Tag = ann.link_url ? "a" : "div";
  const tagProps = ann.link_url ? { href: ann.link_url, target: "_blank", rel: "noreferrer" } : {};
  return (
    <Tag {...tagProps} className="hc-ann-row" style={{
      "--cat-color": cat.color,
      "--cat-bg": cat.bg,
      "--cat-bd": cat.bd,
      cursor: ann.link_url ? "pointer" : "default",
      textDecoration: "none",
      color: "inherit",
    }}>
      <span className="hc-ann-bar" />
      <div className="hc-ann-icon">{ann.emoji || cat.emoji}</div>
      <div className="hc-ann-body">
        <div className="hc-ann-meta">
          <span className="hc-cat-chip" style={{ color: cat.color, background: cat.bg, border: `1px solid ${cat.bd}` }}>
            {cat.label}
          </span>
          {ann.pinned && (
            <span className="hc-cat-chip" style={{ color: "var(--brand-primary, #f5e03a)", background: "rgba(245,224,58,.08)", border: "1px solid rgba(245,224,58,.3)" }}>
              📌 Destacado
            </span>
          )}
          <span className="hc-ann-time">{relativeTime(ann.starts_at || ann.created_at)}</span>
        </div>
        <div className="hc-ann-title">{ann.title}</div>
        {ann.body && <div className="hc-ann-text">{ann.body}</div>}
        {ann.link_url && (
          <div className="hc-ann-link" style={{ color: cat.color }}>
            {ann.link_label || "Más info"} ↗
          </div>
        )}
      </div>
      {ann.link_url && <span className="hc-ann-arrow">›</span>}
    </Tag>
  );
}

function ShipmentRow({ ship, onClick }) {
  const status = ship.status || "Recibido";
  const STATUS_C = {
    "Recibido en depósito": "var(--brand-primary, #f5e03a)",
    "En preparación":      "var(--brand-accent, #ff8c2a)",
    "Despachado":          "#60a5fa",
    "En tránsito":         "#c084fc",
    "Listo para entrega":  "#34d399",
    "Entregado":           "#22c55e",
  };
  const c = STATUS_C[status] || "#888";
  const flag = ship.origin === "USA" ? "🇺🇸" : ship.origin === "CHINA" ? "🇨🇳" : "🇪🇺";
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,.018)", border: `1px solid ${c}33`, borderRadius: 12, cursor: "pointer", transition: "all .25s" }}>
      <div style={{ fontSize: 22 }}>{flag}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#fff" }}>{ship.code || `#${ship.id}`}</span>
          <span style={{ fontSize: 9, padding: "2px 7px", background: `${c}1a`, border: `1px solid ${c}55`, color: c, fontFamily: "'DM Mono',monospace", letterSpacing: 1.2, fontWeight: 700, borderRadius: 3, textTransform: "uppercase" }}>{status}</span>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ship.description || ship.tracking_number || "—"}
        </div>
      </div>
      <span style={{ color: "rgba(255,255,255,.25)", fontSize: 14 }}>›</span>
    </div>
  );
}
