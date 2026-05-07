import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import StoryViewer from "./StoryViewer.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const CAT_CFG = {
  urgente: { color: "#ef4444", emoji: "🚨" },
  linea:   { color: "var(--brand-primary, #f5e03a)", emoji: "🌐" },
  feriado: { color: "#60a5fa", emoji: "🎌" },
  tip:     { color: "#fbbf24", emoji: "💡" },
  novedad: { color: "#a78bfa", emoji: "✨" },
  general: { color: "#ede9e0", emoji: "📢" },
};
const TIPS = [
  { title: "Antes de comprar consultá",   body: "Cada producto tiene reglas aduaneras distintas. Mandá link por WhatsApp y te decimos si conviene importarlo.", emoji: "💡", color: "#fbbf24" },
  { title: "Express vs Normal",            body: "Express USA llega en 72 hs; Normal 7-10 días. La diferencia se justifica en mercadería sensible al tiempo.", emoji: "⚡", color: "var(--brand-accent, #ff8c2a)" },
  { title: "Lemon Coins acumulan",         body: "Cada envío te suma LC. Canjealos por descuentos, items premium del perfil o powers del chat.",                  emoji: "🍋", color: "var(--brand-primary, #f5e03a)" },
  { title: "Invitá amigos · 25 LC",        body: "Mandá tu link de referido. Cuando hacen su primer envío, vos ganás 25 LC y ellos 25.",                            emoji: "🎁", color: "#a78bfa" },
];

/**
 * Stories estilo IG en /inicio. Buckets aislados por usuario/anuncio/tip.
 * Tap dentro de un bucket → navega entre las stories. Swipe entre buckets.
 */
const STORIES_DAILY_LIMIT = 5;

export default function Stories({ announcements = [] }) {
  const [open, setOpen] = useState(null); // { bucketIdx, storyIdx }
  const [groups, setGroups] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [quota, setQuota] = useState({ used: 0, limit: STORIES_DAILY_LIMIT, remaining: STORIES_DAILY_LIMIT });
  const fileRef = useRef(null);

  async function loadFeed() {
    try {
      const r = await fetch(`${API}/api/chat/stories/feed`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const d = await r.json();
      if (d.ok) setGroups(d.groups);
    } catch {}
  }
  async function loadQuota() {
    try {
      const r = await fetch(`${API}/api/chat/stories/quota`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const d = await r.json();
      if (d.ok) setQuota({ used: d.used, limit: d.limit, remaining: d.remaining });
    } catch {}
  }
  useEffect(() => {
    loadFeed(); loadQuota();
    const iv = setInterval(() => { loadFeed(); loadQuota(); }, 60_000);
    return () => clearInterval(iv);
  }, []);

  // Buckets ordenados: self → friends → anuncios → tips
  const buckets = useMemo(() => {
    const userBuckets = groups.map(g => ({
      kind: "user",
      key: `u-${g.user_id}`,
      user_id: g.user_id,
      user: g, // metadata: name, avatar_url, is_self, etc.
      stories: g.stories.map(s => ({
        kind: "user",
        story_id: s.id,
        image: s.image_url,
        caption: s.caption,
        bg_color: s.bg_color,
        created_at: s.created_at,
      })),
    }));
    const annBuckets = announcements.slice(0, 5).map(a => ({
      kind: "announcement",
      key: `ann-${a.id}`,
      stories: [{
        kind: "announcement",
        title: a.title,
        body: a.body || "",
        emoji: a.emoji || (CAT_CFG[a.category]?.emoji || "📢"),
        color: CAT_CFG[a.category]?.color || "var(--brand-primary, #f5e03a)",
        link_url: a.link_url,
        link_label: a.link_label,
        pinned: a.pinned,
      }],
    }));
    const tipBuckets = TIPS.map((t, i) => ({
      kind: "tip",
      key: `tip-${i}`,
      stories: [{ kind: "tip", ...t }],
    }));
    return [...userBuckets, ...annBuckets, ...tipBuckets];
  }, [groups, announcements]);

  const selfGroup = groups.find(g => g.is_self);
  const friendGroups = groups.filter(g => !g.is_self);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Solo imágenes");
    if (file.size > 4 * 1024 * 1024) return alert("Máximo 4MB");
    if (quota.remaining <= 0) return alert(`Llegaste al límite de ${quota.limit} historias en 24 hs`);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch(`${API}/api/chat/stories`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const d = await r.json();
      if (!d.ok) alert(d.error || "Error subiendo");
      else { loadFeed(); loadQuota(); }
    } catch { alert("Error de red"); }
    finally { setUploading(false); e.target.value = ""; }
  }

  function openBucketByKey(key) {
    const i = buckets.findIndex(b => b.key === key);
    if (i >= 0) setOpen({ bucketIdx: i, storyIdx: 0 });
  }

  return (
    <>
      <style>{`
        .st-row{display:flex;gap:12px;overflow-x:auto;padding:6px 4px 12px;scrollbar-width:none}
        .st-row::-webkit-scrollbar{display:none}
        .st-circle{flex-shrink:0;width:72px;cursor:pointer;text-align:center;font-family:inherit;background:none;border:none;color:inherit;padding:4px 0;position:relative}
        .st-ring{width:64px;height:64px;border-radius:50%;padding:2.5px;margin:0 auto 6px;position:relative;transition:transform .25s}
        .st-ring.unread{background:conic-gradient(from 0deg,#a78bfa,#ec4899,var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a),#a78bfa)}
        .st-ring.viewed{background:rgba(255,255,255,.12)}
        .st-ring.lemons{background:conic-gradient(from 0deg,var(--c1),var(--c2),var(--c1))}
        .st-circle:hover .st-ring{transform:scale(1.06)}
        .st-inner{width:100%;height:100%;border-radius:50%;background:#03040c;display:flex;align-items:center;justify-content:center;font-size:28px;overflow:hidden}
        .st-inner img{width:100%;height:100%;object-fit:cover}
        .st-label{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1px;color:rgba(255,255,255,.55);text-transform:uppercase;font-weight:700;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72px}
        .st-pin{position:absolute;top:-2px;right:-2px;background:var(--brand-primary, #f5e03a);color:#000;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;border:2px solid #03040c}
        .st-add{position:absolute;bottom:-2px;right:-2px;background:#22c55e;color:#000;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2.5px solid #03040c;font-weight:900}
      `}</style>

      <div className="st-row">
        {/* Self */}
        <div className="st-circle" style={{ position: "relative" }}>
          <button
            onClick={() => {
              if (selfGroup) openBucketByKey(`u-${selfGroup.user_id}`);
              else if (quota.remaining > 0) fileRef.current?.click();
              else alert(`Llegaste al límite de ${quota.limit} historias en 24 hs`);
            }}
            title={selfGroup ? "Ver tus historias" : "Subir tu primera historia"}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%" }}>
            <div className={`st-ring ${selfGroup ? (selfGroup.all_viewed ? "viewed" : "unread") : "viewed"}`}>
              <div className="st-inner" style={{ background: selfGroup?.avatar_url ? "transparent" : "#0a0820" }}>
                {selfGroup?.stories?.[0]?.image_url
                  ? <img src={selfGroup.stories[0].image_url} alt="" />
                  : selfGroup?.avatar_url
                    ? <img src={selfGroup.avatar_url} alt="" />
                    : <span style={{ fontSize: 26 }}>🍋</span>}
              </div>
            </div>
            <div className="st-label">Tu historia</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8.5, letterSpacing: 1, color: quota.remaining === 0 ? "#ef4444" : "rgba(255,255,255,.4)", marginTop: 2, fontWeight: 700 }}>
              {quota.used}/{quota.limit}
            </div>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (quota.remaining > 0) fileRef.current?.click(); else alert(`Llegaste al límite de ${quota.limit} historias en 24 hs`); }}
            disabled={uploading || quota.remaining === 0}
            title={quota.remaining === 0 ? "Sin cupo" : `Sumar otra (te quedan ${quota.remaining})`}
            className="st-add"
            style={{ position: "absolute", top: 38, left: "calc(50% + 16px)", transform: "translate(-50%, 0)", background: quota.remaining === 0 ? "rgba(239,68,68,.5)" : "#22c55e", color: "#000", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, border: "2.5px solid #03040c", fontWeight: 900, cursor: uploading || quota.remaining === 0 ? "default" : "pointer", padding: 0, zIndex: 2 }}>
            {uploading ? "…" : "+"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleUpload} />
        </div>

        {/* Friends */}
        {friendGroups.map(g => (
          <button key={`g-${g.user_id}`} className="st-circle" onClick={() => openBucketByKey(`u-${g.user_id}`)}>
            <div className={`st-ring ${g.all_viewed ? "viewed" : "unread"}`}>
              <div className="st-inner" style={{ background: g.avatar_url ? "transparent" : "#0a0820" }}>
                {g.stories[0]?.image_url
                  ? <img src={g.stories[0].image_url} alt="" />
                  : g.avatar_url
                    ? <img src={g.avatar_url} alt="" />
                    : <span style={{ fontSize: 26 }}>👤</span>}
              </div>
            </div>
            <div className="st-label" style={{ color: g.name_color || "rgba(255,255,255,.55)" }}>
              {g.name?.split(" ")[0] || g.username || "User"}
            </div>
          </button>
        ))}

        {/* Anuncios pinned */}
        {announcements.slice(0, 5).map(a => {
          const cat = CAT_CFG[a.category] || CAT_CFG.general;
          return (
            <button key={`ann-${a.id}`} className="st-circle" onClick={() => openBucketByKey(`ann-${a.id}`)}>
              <div className="st-ring lemons" style={{ "--c1": cat.color, "--c2": "var(--brand-accent, #ff5500)", position: "relative" }}>
                <div className="st-inner">{a.emoji || cat.emoji}</div>
                {a.pinned && <span className="st-pin">📌</span>}
              </div>
              <div className="st-label">{a.title.slice(0, 12)}{a.title.length > 12 ? "…" : ""}</div>
            </button>
          );
        })}

        {/* Tips */}
        {TIPS.map((t, i) => (
          <button key={`tip-${i}`} className="st-circle" onClick={() => openBucketByKey(`tip-${i}`)}>
            <div className="st-ring lemons" style={{ "--c1": t.color, "--c2": "#ec4899" }}>
              <div className="st-inner">{t.emoji}</div>
            </div>
            <div className="st-label">TIP</div>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {open !== null && (
          <StoryViewer
            buckets={buckets}
            startBucket={open.bucketIdx}
            startStory={open.storyIdx}
            onClose={() => setOpen(null)}
            onStoryDeleted={() => loadFeed()}
          />
        )}
      </AnimatePresence>
    </>
  );
}
