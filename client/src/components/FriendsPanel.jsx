import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const AVATAR_EMOJI = {
  avatar_lemon: "🪙", avatar_rocket: "🚀", avatar_globe: "🌍",
  avatar_diamond: "💎", avatar_fire: "🔥", avatar_crown: "👑",
};
const AVATAR_BG = {
  avatar_lemon: "var(--brand-primary, #f5e03a)", avatar_rocket: "#3b82f6", avatar_globe: "#22c55e",
  avatar_diamond: "#a78bfa", avatar_fire: "var(--brand-accent, #ff5500)", avatar_crown: "var(--brand-primary, #f5e03a)",
};

function relativeSeen(iso) {
  if (!iso) return "Nunca conectado";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)     return "ahora";
  if (diff < 3600)   return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400)  return `hace ${Math.floor(diff/3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff/86400)} d`;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function nameStyleFromUser(u) {
  if (u.name_grad_from && u.name_grad_to) {
    return {
      backgroundImage: `linear-gradient(90deg, ${u.name_grad_from}, ${u.name_grad_to})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    };
  }
  return {
    color: u.name_color || "#ede9e0",
    textShadow: u.name_glow > 0 && u.name_glow_color
      ? `0 0 ${u.name_glow * 2}px ${u.name_glow_color}`
      : "none",
  };
}

function FriendCard({ f, onClick, online }) {
  const emoji = AVATAR_EMOJI[f.avatar_key] || "🪙";
  const bg = AVATAR_BG[f.avatar_key] || "var(--brand-primary, #f5e03a)";
  const dotColor = online ? "#22c55e" : "#6b7280";
  const ring = online ? "rgba(34,197,94,.55)" : "rgba(255,255,255,.06)";
  return (
    <button onClick={onClick} className="fp-card" style={{ "--ring": ring }}>
      <div className="fp-ava-wrap">
        <div className="fp-ava" style={{ background: f.avatar_url ? "transparent" : bg }}>
          {f.avatar_url
            ? <img src={f.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 28 }}>{emoji}</span>}
        </div>
        <span className="fp-dot" style={{ background: dotColor, boxShadow: online ? `0 0 8px ${dotColor},0 0 16px ${dotColor}66` : "none", animation: online ? "fpPulse 2s ease-in-out infinite" : "none" }} />
        {f.is_mutual && <span className="fp-mutual" title="Amigo mutuo">💚</span>}
      </div>
      <div className="fp-name" style={nameStyleFromUser(f)}>{f.name}</div>
      <div className="fp-seen" style={{ color: online ? "#22c55e" : "rgba(255,255,255,.35)" }}>
        {online ? "● en línea" : relativeSeen(f.last_seen_at)}
      </div>
    </button>
  );
}

export default function FriendsPanel() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let abort = false;
    async function load() {
      try {
        const r = await fetch(`${API}/api/friends`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (abort) return;
        if (d.ok) setFriends(d.friends);
      } catch {}
      finally { if (!abort) setLoading(false); }
    }
    load();
    const iv = setInterval(load, 20000);
    const onVis = () => { if (!document.hidden) load(); };
    const onFocus = () => load();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      abort = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const online = friends.filter(f => f.is_online);
  const offline = friends.filter(f => !f.is_online);

  return (
    <div className="hc-card" style={{ "--ac": "#22c55e", padding: "20px 22px" }}>
      <style>{`
        @keyframes fpPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.25);opacity:.85}}
        .fp-row{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;scrollbar-width:thin;scrollbar-color:rgba(var(--brand-primary-rgb),.2) transparent}
        .fp-row::-webkit-scrollbar{height:6px}
        .fp-row::-webkit-scrollbar-thumb{background:rgba(var(--brand-primary-rgb),.2);border-radius:99px}
        .fp-card{flex:0 0 auto;width:96px;background:transparent;border:none;cursor:pointer;font-family:inherit;text-align:center;padding:6px 4px;color:inherit;border-radius:14px;transition:all .25s}
        .fp-card:hover{background:rgba(var(--brand-primary-rgb),.04);transform:translateY(-2px)}
        .fp-ava-wrap{position:relative;width:64px;height:64px;margin:0 auto 8px}
        .fp-ava{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid var(--ring);box-shadow:0 0 0 2px rgba(8,9,16,.85),0 4px 14px rgba(0,0,0,.4);transition:all .3s}
        .fp-card:hover .fp-ava{border-color:rgba(var(--brand-primary-rgb),.5)}
        .fp-dot{position:absolute;bottom:1px;right:1px;width:14px;height:14px;border-radius:50%;border:2.5px solid rgba(8,9,16,.95)}
        .fp-mutual{position:absolute;top:-2px;right:-2px;font-size:14px;background:rgba(8,9,16,.95);border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(34,197,94,.4)}
        .fp-name{font-family:'Gotham', sans-serif;font-weight:700;font-size:13px;letter-spacing:.5px;line-height:1.1;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .fp-seen{font-family:'Gotham', monospace;font-size:9px;letter-spacing:1px;line-height:1.1}
        .fp-section-h{display:flex;align-items:center;gap:8px;margin:14px 0 12px;font-family:'Gotham', monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:700}
        .fp-section-h::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.05)}
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: "'Gotham', monospace", fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: "#22c55e", fontWeight: 600, marginBottom: 6 }}>
            👥 Amigos
          </div>
          <div style={{ fontFamily: "'Gotham', sans-serif", fontSize: 28, letterSpacing: 1.2, color: "#fff", lineHeight: 1 }}>
            En vivo
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.3)", borderRadius: 999 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", animation: "fpPulse 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: "'Gotham', monospace", fontSize: 9, letterSpacing: 1.5, fontWeight: 700, color: "#22c55e" }}>{online.length} ONLINE</span>
          </div>
          <div style={{ fontFamily: "'Gotham', monospace", fontSize: 9, letterSpacing: 1.2, color: "rgba(255,255,255,.4)" }}>{friends.length} en total</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", gap: 12, padding: "16px 0" }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ width: 96, textAlign: "center" }}>
              <div className="hc-skel" style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 8px" }} />
              <div className="hc-skel" style={{ height: 10, width: 60, margin: "0 auto 4px" }} />
              <div className="hc-skel" style={{ height: 8, width: 40, margin: "0 auto" }} />
            </div>
          ))}
        </div>
      ) : friends.length === 0 ? (
        <div style={{ padding: "28px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 36, opacity: .35, marginBottom: 10 }}>👥</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginBottom: 6 }}>Sin amigos todavía</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", fontFamily: "'Gotham', monospace", letterSpacing: 1, marginBottom: 14 }}>Seguí a otros usuarios desde su perfil</div>
          <button onClick={() => navigate("/perfil")}
            style={{ padding: "9px 18px", background: "rgba(34,197,94,.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,.3)", fontFamily: "'Gotham', monospace", fontSize: 11, letterSpacing: 1.5, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>
            Ir a mi perfil →
          </button>
        </div>
      ) : (
        <>
          {online.length > 0 && (
            <>
              <div className="fp-section-h" style={{ color: "#22c55e" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", animation: "fpPulse 2s ease-in-out infinite" }} />
                Online · {online.length}
              </div>
              <div className="fp-row">
                {online.map(f => (
                  <FriendCard key={f.id} f={f} online onClick={() => navigate(f.username ? `/perfil/${f.username}` : "/perfil")} />
                ))}
              </div>
            </>
          )}
          {offline.length > 0 && (
            <>
              <div className="fp-section-h" style={{ color: "rgba(255,255,255,.35)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6b7280" }} />
                Offline · {offline.length}
              </div>
              <div className="fp-row">
                {offline.map(f => (
                  <FriendCard key={f.id} f={f} online={false} onClick={() => navigate(f.username ? `/perfil/${f.username}` : "/perfil")} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
