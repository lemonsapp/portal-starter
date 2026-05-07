import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Pop } from "./MotionPop.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

/**
 * StoryViewer reutilizable.
 *
 * Recibe `buckets` = array de grupos donde cada grupo es:
 *   { kind: "user"|"announcement"|"tip", key, user?, stories: [...] }
 *
 * Features:
 *   - Auto-advance (5s user / 6s lemons), tap dentro del bucket / swipe entre buckets.
 *   - Click en avatar/nombre del header → navega al perfil (/perfil/:username).
 *   - Indicador "online" si bucket.user.online === true.
 *   - Like ❤ por story (count visible para todos, lista de likers sólo si soy owner).
 *   - Reply: input que envía un mensaje privado al dueño con cita de la story.
 *   - Si soy owner: botón 👁 abre panel con likers.
 */
export default function StoryViewer({ buckets, startBucket = 0, startStory = 0, onClose, onStoryDeleted }) {
  const [bIdx, setBIdx] = useState(startBucket);
  const [sIdx, setSIdx] = useState(startStory);
  const [paused, setPaused] = useState(false);
  const [likeState, setLikeState] = useState({}); // { [story_id]: { count, liked } }
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyOk, setReplyOk] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [likers, setLikers] = useState([]);
  const navigate = useNavigate();
  const replyRef = useRef(null);

  const bucket = buckets[bIdx];
  const story = bucket?.stories?.[sIdx];
  const DURATION = story?.kind === "user" ? 5000 : 6000;

  // Bloquea scroll body
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Reset feedback al cambiar story
  useEffect(() => {
    setReplyText("");
    setReplyOk(false);
    setShowLikers(false);
    setLikers([]);
  }, [bIdx, sIdx]);

  // Inicializar likeState con la data del bucket
  useEffect(() => {
    if (story?.kind === "user" && story.story_id != null && likeState[story.story_id] === undefined) {
      setLikeState(s => ({ ...s, [story.story_id]: { count: story.like_count || 0, liked: !!story.liked_by_me } }));
    }
  }, [story?.story_id]);

  // Mark as viewed
  useEffect(() => {
    if (story?.kind === "user" && story.story_id) {
      fetch(`${API}/api/chat/stories/${story.story_id}/view`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      }).catch(() => {});
    }
  }, [story?.story_id]);

  // Pausar autoadvance si hay foco en el reply
  const replyFocused = !!replyText || (typeof document !== "undefined" && document.activeElement === replyRef.current);

  // Auto-advance — solo dentro del bucket. Termina = close.
  useEffect(() => {
    if (paused || replyFocused || showLikers || !story) return;
    const t = setTimeout(() => {
      const lastInBucket = sIdx >= (bucket.stories.length - 1);
      if (!lastInBucket) setSIdx(i => i + 1);
      else onClose();
    }, DURATION);
    return () => clearTimeout(t);
  }, [bIdx, sIdx, paused, replyFocused, showLikers, bucket?.stories?.length, DURATION, onClose, story]);

  function nextStory() {
    if (sIdx < bucket.stories.length - 1) setSIdx(i => i + 1);
    else onClose();
  }
  function prevStory() {
    if (sIdx > 0) setSIdx(i => i - 1);
  }
  function nextBucket() {
    if (bIdx < buckets.length - 1) {
      setBIdx(i => i + 1);
      setSIdx(0);
    } else {
      onClose();
    }
  }
  function prevBucket() {
    if (bIdx > 0) {
      setBIdx(i => i - 1);
      setSIdx(0);
    }
  }

  function handleDelete() {
    if (!story?.story_id) return;
    if (!window.confirm("¿Borrar esta historia?")) return;
    fetch(`${API}/api/chat/stories/${story.story_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(() => {
      onStoryDeleted?.(story.story_id);
      if (bucket.stories.length <= 1) onClose();
      else if (sIdx >= bucket.stories.length - 1) setSIdx(i => Math.max(0, i - 1));
    });
  }

  async function toggleLike() {
    if (!story?.story_id) return;
    const cur = likeState[story.story_id] || { count: story.like_count || 0, liked: !!story.liked_by_me };
    // Optimista
    setLikeState(s => ({ ...s, [story.story_id]: { count: cur.count + (cur.liked ? -1 : 1), liked: !cur.liked } }));
    try {
      const r = await fetch(`${API}/api/chat/stories/${story.story_id}/like`, {
        method: cur.liked ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const d = await r.json();
      if (d?.ok) setLikeState(s => ({ ...s, [story.story_id]: { count: d.like_count, liked: d.liked_by_me } }));
    } catch {
      // rollback
      setLikeState(s => ({ ...s, [story.story_id]: cur }));
    }
  }

  async function sendReply() {
    if (!story?.story_id) return;
    const text = replyText.trim();
    if (!text || replySending) return;
    setReplySending(true);
    try {
      const r = await fetch(`${API}/api/chat/stories/${story.story_id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ message: text }),
      });
      const d = await r.json();
      if (d?.ok) {
        setReplyText("");
        setReplyOk(true);
        setTimeout(() => setReplyOk(false), 1800);
      }
    } catch {}
    finally { setReplySending(false); }
  }

  async function openLikers() {
    if (!story?.story_id) return;
    setShowLikers(true);
    try {
      const r = await fetch(`${API}/api/chat/stories/${story.story_id}/likes`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const d = await r.json();
      if (d?.ok) setLikers(d.users || []);
    } catch {}
  }

  function goToProfile() {
    if (bucket?.user?.username) {
      onClose();
      navigate(`/perfil/${bucket.user.username}`);
    }
  }

  if (!bucket || !story) return null;

  const bgGradient = story.kind === "user"
    ? `linear-gradient(160deg, ${story.bg_color || "#0a0820"} 0%, #03040c 100%)`
    : `linear-gradient(160deg, ${story.color}30 0%, #0a0820 50%, #03040c 100%)`;

  const ls = (story.story_id != null && likeState[story.story_id]) || { count: story.like_count || 0, liked: !!story.liked_by_me };
  const isUserKind = bucket.kind === "user";
  const isSelf = !!bucket.user?.is_self;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.95)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
      onClick={onClose}
    >
      {buckets.length > 1 && bIdx > 0 && (
        <button onClick={(e) => { e.stopPropagation(); prevBucket(); }}
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
      )}
      {buckets.length > 1 && bIdx < buckets.length - 1 && (
        <button onClick={(e) => { e.stopPropagation(); nextBucket(); }}
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
      )}

      <motion.div
        key={bucket.key + "-" + sIdx}
        initial={{ opacity: 0, scale: .94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: .98, y: 10 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        drag={buckets.length > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={(_e, info) => {
          const swipe = info.offset.x;
          if (swipe < -80)      nextBucket();
          else if (swipe > 80)  prevBucket();
        }}
        onClick={e => e.stopPropagation()}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
        style={{
          width: "100%", maxWidth: 420, height: "min(720px, 90vh)",
          background: bgGradient,
          borderRadius: 24, position: "relative", overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.04)",
          touchAction: "pan-y",
        }}
      >
        {/* Progress bars */}
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", gap: 4, zIndex: 10 }}>
          {bucket.stories.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, background: "rgba(255,255,255,.18)", borderRadius: 2, overflow: "hidden" }}>
              {i === sIdx && !paused && !replyFocused && !showLikers && (
                <div style={{ height: "100%", background: "#fff", animation: `stProg ${DURATION}ms linear forwards` }} />
              )}
              {i < sIdx && <div style={{ height: "100%", background: "#fff" }} />}
            </div>
          ))}
        </div>
        <style>{`
          @keyframes stProg{from{width:0%}to{width:100%}}
          @keyframes svOnlinePulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.7)}50%{box-shadow:0 0 0 4px rgba(34,197,94,0)}}
          @keyframes svHeartPop{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}
        `}</style>

        {/* Header */}
        <div style={{ position: "absolute", top: 30, left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            {isUserKind ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goToProfile(); }}
                  disabled={!bucket.user?.username}
                  title={bucket.user?.username ? `Ver perfil de ${bucket.user?.name || bucket.user.username}` : ""}
                  style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", padding: 0, cursor: bucket.user?.username ? "pointer" : "default", minWidth: 0, flex: 1 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(255,255,255,.4)", background: "#0a0820" }}>
                      {bucket.user?.avatar_url
                        ? <img src={bucket.user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div>}
                    </div>
                    {bucket.user?.online && !isSelf && (
                      <span style={{ position: "absolute", bottom: -1, right: -1, width: 11, height: 11, borderRadius: "50%", background: "#22c55e", border: "2px solid #03040c", animation: "svOnlinePulse 2s ease-in-out infinite" }} />
                    )}
                  </div>
                  <div style={{ minWidth: 0, textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: bucket.user?.name_color || "#fff", lineHeight: 1, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {bucket.user?.name}
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(255,255,255,.55)", marginTop: 3 }}>
                      {relTime(story.created_at)} · {sIdx + 1}/{bucket.stories.length}
                      {bucket.user?.online && !isSelf && <span style={{ color: "#22c55e", marginLeft: 6 }}>● en línea</span>}
                    </div>
                  </div>
                </button>
              </>
            ) : (
              <>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${story.color}25`, border: `1px solid ${story.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{story.emoji}</div>
                <div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2px", color: story.color, textTransform: "uppercase", fontWeight: 700 }}>
                    Lemon's {story.kind === "tip" ? "Tip" : "anuncia"}
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {isUserKind && isSelf && (
              <>
                <button onClick={(e) => { e.stopPropagation(); openLikers(); }}
                  title="Ver quién likeó"
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.15)", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>👁</button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(239,68,68,.4)", border: "1px solid rgba(239,68,68,.6)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button>
              </>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.15)", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>

        {/* Tap zones — DENTRO del bucket */}
        <button onClick={(e) => { e.stopPropagation(); prevStory(); }}
          style={{ position: "absolute", left: 0, top: 60, bottom: 100, width: "30%", background: "transparent", border: "none", zIndex: 4, cursor: "pointer" }} aria-label="Story anterior" />
        <button onClick={(e) => { e.stopPropagation(); nextStory(); }}
          style={{ position: "absolute", right: 0, top: 60, bottom: 100, width: "30%", background: "transparent", border: "none", zIndex: 4, cursor: "pointer" }} aria-label="Story siguiente" />

        {/* Contenido */}
        {isUserKind ? (
          <>
            <img src={story.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 1 }} />
            {story.caption && (
              <div style={{ position: "absolute", left: 16, right: 16, bottom: 90, padding: "12px 16px", background: "rgba(0,0,0,.55)", backdropFilter: "blur(8px)", borderRadius: 14, color: "#fff", fontSize: 14, lineHeight: 1.5, zIndex: 5 }}>
                {story.caption}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 32px", zIndex: 3, pointerEvents: "none" }}>
              <div style={{ fontSize: 80, marginBottom: 18, filter: `drop-shadow(0 0 24px ${story.color}aa)`, lineHeight: 1 }}>{story.emoji}</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(36px, 6vw, 56px)", lineHeight: .95, letterSpacing: "1px", color: "#fff", marginBottom: 16, textShadow: `0 4px 24px ${story.color}66` }}>
                {story.title}
              </div>
              {story.body && (
                <div style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,.78)", maxWidth: 320 }}>
                  {story.body}
                </div>
              )}
            </div>
            {story.link_url && (
              <div style={{ position: "absolute", left: 20, right: 20, bottom: 28, zIndex: 5 }}>
                <Pop as="a" href={story.link_url} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 20px", background: story.color, color: "#000", borderRadius: 14, fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "2px", fontWeight: 700, textTransform: "uppercase", textDecoration: "none", boxShadow: `0 12px 32px ${story.color}66` }}>
                  {story.link_label || "Más info"} →
                </Pop>
              </div>
            )}
          </>
        )}

        {/* Footer interactivo (sólo user stories) */}
        {isUserKind && (
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 7, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(0,0,0,.55)", backdropFilter: "blur(10px)", borderRadius: 14, border: "1px solid rgba(255,255,255,.08)" }}>
            {!isSelf ? (
              <>
                <input
                  ref={replyRef}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendReply(); }}
                  placeholder={replyOk ? "✓ Enviado!" : `Responder a ${bucket.user?.name?.split(" ")[0] || ""}…`}
                  maxLength={500}
                  disabled={replySending}
                  style={{ flex: 1, minWidth: 0, padding: "9px 12px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none" }}
                />
                <button onClick={sendReply} disabled={!replyText.trim() || replySending}
                  style={{ padding: "9px 12px", borderRadius: 10, background: replyText.trim() ? "rgba(245,224,58,.18)" : "rgba(255,255,255,.06)", border: `1px solid ${replyText.trim() ? "rgba(245,224,58,.45)" : "rgba(255,255,255,.1)"}`, color: replyText.trim() ? "#f5e03a" : "rgba(255,255,255,.4)", fontSize: 14, cursor: replyText.trim() && !replySending ? "pointer" : "default", flexShrink: 0 }}>
                  {replySending ? "…" : "→"}
                </button>
                <button onClick={toggleLike}
                  title={ls.liked ? "Quitar like" : "Like"}
                  style={{ padding: "8px 11px", borderRadius: 10, background: ls.liked ? "rgba(239,68,68,.18)" : "rgba(255,255,255,.06)", border: `1px solid ${ls.liked ? "rgba(239,68,68,.5)" : "rgba(255,255,255,.12)"}`, color: ls.liked ? "#ef4444" : "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, animation: ls.liked ? "svHeartPop .35s ease-out" : "none" }}>
                  {ls.liked ? "❤" : "🤍"}
                  {ls.count > 0 && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700 }}>{ls.count}</span>}
                </button>
              </>
            ) : (
              <button onClick={openLikers}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10, background: "rgba(245,224,58,.08)", border: "1px solid rgba(245,224,58,.22)", color: "#f5e03a", fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: 1.4, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>
                ❤ {ls.count} {ls.count === 1 ? "like" : "likes"} · ver quién
              </button>
            )}
          </div>
        )}

        {/* Hint swipe abajo */}
        {buckets.length > 1 && !isUserKind && (
          <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", zIndex: 6, fontFamily: "'DM Mono',monospace", fontSize: 8, letterSpacing: "1.5px", color: "rgba(255,255,255,.4)", textTransform: "uppercase", pointerEvents: "none" }}>
            ← Desliza · {bIdx + 1}/{buckets.length} ·  →
          </div>
        )}

        {/* Panel de likers (sólo owner) */}
        <AnimatePresence>
          {showLikers && (
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: "40%", background: "rgba(8,9,16,.98)", backdropFilter: "blur(20px)", borderRadius: "20px 20px 0 0", borderTop: "1px solid rgba(245,224,58,.2)", zIndex: 20, overflow: "hidden", display: "flex", flexDirection: "column" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 1, color: "#fff", lineHeight: 1 }}>
                    Likes de tu story
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: 1.4, color: "rgba(255,255,255,.4)", marginTop: 4 }}>
                    {ls.count} {ls.count === 1 ? "persona" : "personas"} · sólo vos podés ver esta lista
                  </div>
                </div>
                <button onClick={() => setShowLikers(false)}
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {likers.length === 0 ? (
                  <div style={{ padding: "30px 20px", textAlign: "center", color: "rgba(255,255,255,.35)", fontSize: 13 }}>
                    Todavía nadie le dio ❤
                  </div>
                ) : (
                  likers.map(u => (
                    <button key={u.id}
                      onClick={() => { onClose(); navigate(`/perfil/${u.username || ""}`); }}
                      disabled={!u.username}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: "1px solid rgba(255,255,255,.03)", background: "transparent", border: "none", cursor: u.username ? "pointer" : "default", textAlign: "left" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "#0a0820", flexShrink: 0 }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: u.name_color || "#fff", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(255,255,255,.4)", marginTop: 3 }}>
                          {u.username ? `@${u.username}` : ""} · {relTime(u.created_at)}
                        </div>
                      </div>
                      <span style={{ color: "#ef4444", fontSize: 16 }}>❤</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function relTime(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "ahora";
  if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
  return `hace ${Math.floor(diff/86400)} d`;
}
