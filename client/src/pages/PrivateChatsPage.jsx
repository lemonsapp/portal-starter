import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import usePrivateSocket from "../hooks/usePrivateSocket.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

export default function PrivateChatsPage() {
  const { otherId } = useParams();
  const navigate = useNavigate();
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(otherId ? Number(otherId) : null);

  async function loadConvs() {
    try {
      const r = await fetch(`${API}/api/chat/private/conversations`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });
      const d = await r.json();
      if (d?.ok) setConvs(d.conversations || []);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    loadConvs();
    const iv = setInterval(loadConvs, 120_000);
    return () => clearInterval(iv);
  }, []);

  const socket = usePrivateSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = () => loadConvs();
    socket.on("private_message", handler);
    return () => socket.off("private_message", handler);
  }, [socket]);

  useEffect(() => { setActiveId(otherId ? Number(otherId) : null); }, [otherId]);

  function openChat(c) {
    setActiveId(c.other_id);
    navigate(`/chats/${c.other_id}`);
  }

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const showList = !isMobile || activeId === null;
  const showThread = !isMobile || activeId !== null;

  return (
    <div style={{ padding: isMobile ? "12px 10px 80px" : "20px 16px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: isMobile ? 12 : 18, gap: 8 }}>
        <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: isMobile ? 26 : 36, letterSpacing: 1.2, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          ✉ Mensajes privados
        </h1>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 1.6, color: "rgba(255,255,255,.4)", textTransform: "uppercase" }}>
          {convs.length} {convs.length === 1 ? "chat" : "chats"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(280px, 360px) 1fr", gap: 16, alignItems: "stretch" }}>
            {/* Lista */}
            {showList && (
            <div style={{ background: "rgba(8,9,16,.85)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, overflow: "hidden", maxHeight: isMobile ? "calc(100vh - 200px)" : "calc(100vh - 160px)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: 2, color: "var(--brand-primary, #f5e03a)", fontWeight: 700, textTransform: "uppercase" }}>💬 Conversaciones</span>
                <button onClick={loadConvs} title="Recargar"
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>↻</button>
              </div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                {loading ? (
                  <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,.3)", fontSize: 13 }}>Cargando…</div>
                ) : convs.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,.4)" }}>
                    <div style={{ fontSize: 38, marginBottom: 10 }}>💬</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>No tenés chats privados todavía.<br/>Las respuestas a historias aparecen acá.</div>
                  </div>
                ) : convs.map(c => (
                  <div key={c.other_id}
                    style={{ width: "100%", display: "flex", gap: 10, padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,.03)", background: activeId === c.other_id ? "rgba(var(--brand-primary-rgb),.06)" : "transparent", borderLeft: activeId === c.other_id ? "3px solid var(--brand-primary, #f5e03a)" : "3px solid transparent", alignItems: "center" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (c.username) navigate(`/perfil/${c.username}`); }}
                      title={c.username ? `Ver perfil de ${c.name}` : ""}
                      disabled={!c.username}
                      style={{ position: "relative", flexShrink: 0, background: "transparent", border: "none", padding: 0, cursor: c.username ? "pointer" : "default" }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "#0a0820", border: "1.5px solid rgba(var(--brand-primary-rgb),.2)" }}>
                        {c.avatar_url
                          ? <img src={c.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>}
                      </div>
                      {c.online && <span style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: "#22c55e", border: "2px solid #03040c" }} />}
                    </button>
                    <button onClick={() => openChat(c)}
                      style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (c.username) navigate(`/perfil/${c.username}`); }}
                          disabled={!c.username}
                          style={{ background: "transparent", border: "none", padding: 0, cursor: c.username ? "pointer" : "default", fontSize: 14, fontWeight: 700, color: c.name_color || "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", textAlign: "left" }}>
                          {c.name}
                        </button>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "rgba(255,255,255,.4)", flexShrink: 0 }}>{relTime(c.last_at)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        {c.reply_to_story_id && c.reply_story_image_url && (
                          <img src={c.reply_story_image_url} alt="story" style={{ width: 26, height: 32, borderRadius: 4, objectFit: "cover", flexShrink: 0, border: "1px solid rgba(var(--brand-primary-rgb),.4)" }} />
                        )}
                        <div style={{ fontSize: 12, color: c.reply_to_story_id ? "var(--brand-primary, #f5e03a)" : "rgba(255,255,255,.55)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", flex: 1, lineHeight: 1.3 }}>
                          {c.reply_to_story_id ? (
                            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>
                              ↩ {c.last_from === c.other_id ? "Respondió tu historia" : "Respondiste su historia"}
                            </span>
                          ) : c.last_message}
                        </div>
                        {c.unread > 0 && (
                          <span style={{ background: "var(--brand-primary, #f5e03a)", color: "#000", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999, flexShrink: 0 }}>{c.unread}</span>
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Panel de chat */}
            {showThread && (
            <div style={{ background: "rgba(8,9,16,.85)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, overflow: "hidden", maxHeight: isMobile ? "calc(100vh - 160px)" : "calc(100vh - 160px)", display: "flex", flexDirection: "column", minHeight: isMobile ? "calc(100vh - 200px)" : 480 }}>
              {activeId ? (
                <PrivateThread otherId={activeId} isMobile={isMobile} onBack={() => { setActiveId(null); navigate("/chats"); }} onSent={loadConvs} />
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.3)", textAlign: "center", padding: 30 }}>
                  <div>
                    <div style={{ fontSize: 50, marginBottom: 10 }}>✉</div>
                    <div style={{ fontSize: 14 }}>Elegí una conversación para empezar</div>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
    </div>
  );
}

function PrivateThread({ otherId, onSent, isMobile, onBack }) {
  const [data, setData] = useState({ messages: [], target: null });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const socket = usePrivateSocket();

  async function load() {
    try {
      const r = await fetch(`${API}/api/chat/private/${otherId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });
      const d = await r.json();
      if (d?.ok) setData({ messages: d.messages || [], target: d.target });
    } catch {}
  }

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [otherId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      const oid = Number(otherId);
      const isRelevant = msg.from_user_id === oid || msg.to_user_id === oid;
      if (isRelevant) load();
    };
    socket.on("private_message", handler);
    return () => socket.off("private_message", handler);
  }, [socket, otherId]);

  async function send() {
    const m = text.trim();
    if (!m || sending) return;
    setSending(true);
    try {
      if (socket) {
        socket.emit("private_message", { to_user_id: Number(otherId), message: m });
      } else {
        await fetch(`${API}/api/chat/private/${otherId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ message: m }),
        });
      }
      setText("");
      onSent?.();
    } finally { setSending(false); }
  }

  const target = data.target;
  return (
    <>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,.05)", display: "flex", alignItems: "center", gap: 10, background: "rgba(8,9,16,.92)", flexShrink: 0 }}>
        {isMobile && (
          <button onClick={onBack} aria-label="Volver"
            style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "#fff", width: 34, height: 34, fontSize: 18, cursor: "pointer", flexShrink: 0 }}>‹</button>
        )}
        <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "#0a0820", flexShrink: 0 }}>
          {target?.avatar_url
            ? <img src={target.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: target?.name_color || "#fff", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{target?.name || "Mensajes privados"}</div>
          {target?.username && <a href={`/perfil/${target.username}`} style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--brand-primary, #f5e03a)", textDecoration: "none", letterSpacing: 1.2 }}>@{target.username}</a>}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
        {data.messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,.3)", fontSize: 13, marginTop: 30 }}>Empezá la conversación 👋</div>
        ) : data.messages.map((m, i) => {
          const isOwn = m.from_user_id !== Number(otherId);
          const replyLabel = m.reply_to_story_id
            ? (isOwn ? "↩ Respondiste a su historia" : `↩ ${target?.name?.split(" ")[0] || "Te"} respondió a tu historia`)
            : null;
          return (
            <div key={m.id || i} style={{ display: "flex", justifyContent: isOwn ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
              {!isOwn && (
                <button
                  onClick={() => target?.username && navigate(`/perfil/${target.username}`)}
                  disabled={!target?.username}
                  title={target?.username ? `Ver perfil de ${target?.name}` : ""}
                  style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", background: "#0a0820", flexShrink: 0, border: "none", padding: 0, cursor: target?.username ? "pointer" : "default" }}>
                  {target?.avatar_url
                    ? <img src={target.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>👤</div>}
                </button>
              )}
              <div style={{ maxWidth: "75%", padding: m.reply_to_story_id ? "6px 6px 8px" : "8px 12px", borderRadius: isOwn ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isOwn ? "rgba(var(--brand-primary-rgb),.12)" : "rgba(255,255,255,.05)", border: `1px solid ${isOwn ? "rgba(var(--brand-primary-rgb),.25)" : "rgba(255,255,255,.08)"}` }}>
                {!isOwn && !m.reply_to_story_id && (
                  <button
                    onClick={() => target?.username && navigate(`/perfil/${target.username}`)}
                    disabled={!target?.username}
                    style={{ background: "transparent", border: "none", padding: 0, cursor: target?.username ? "pointer" : "default", fontSize: 11, fontWeight: 700, color: target?.name_color || "#a78bfa", marginBottom: 3, lineHeight: 1, display: "block" }}>
                    {target?.name?.split(" ")[0] || "Usuario"}
                  </button>
                )}
                {/* Quoted story DENTRO de la burbuja, arriba del mensaje */}
                {m.reply_to_story_id && (
                  <div style={{ display: "flex", gap: 8, alignItems: "stretch", padding: 6, marginBottom: 6, background: "rgba(0,0,0,.35)", borderLeft: "3px solid var(--brand-primary, #f5e03a)", borderRadius: 8 }}>
                    {m.reply_story_image_url ? (
                      <img src={m.reply_story_image_url} alt="story" style={{ width: 42, height: 56, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 42, height: 56, borderRadius: 4, background: "linear-gradient(135deg,var(--brand-primary, #f5e03a)33,var(--brand-accent, #ff5500)33)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📷</div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, flex: 1 }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--brand-primary, #f5e03a)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, lineHeight: 1.3 }}>↩ {replyLabel}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "rgba(255,255,255,.55)", lineHeight: 1.3, marginTop: 2 }}>tu historia · 24h</span>
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 13, color: isOwn ? "#fff" : "#e2e8f0", lineHeight: 1.4, wordBreak: "break-word", padding: m.reply_to_story_id ? "0 6px" : 0 }}>{m.message}</div>
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.3)", marginTop: 4, textAlign: "right", fontFamily: "'DM Mono',monospace", padding: m.reply_to_story_id ? "0 6px" : 0 }}>
                  {new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "10px 12px max(10px, env(safe-area-inset-bottom))", borderTop: "1px solid rgba(255,255,255,.05)", display: "flex", gap: 8, background: "rgba(8,9,16,.96)", flexShrink: 0, position: "sticky", bottom: 0 }}>
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Escribí un mensaje..." maxLength={500} disabled={sending}
          enterKeyHint="send"
          style={{ flex: 1, padding: "11px 13px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none", minWidth: 0 }} />
        <button onClick={send} disabled={!text.trim() || sending}
          style={{ padding: "10px 18px", borderRadius: 10, background: text.trim() ? "var(--brand-primary, #f5e03a)" : "rgba(255,255,255,.06)", color: text.trim() ? "#000" : "rgba(255,255,255,.4)", border: "none", fontWeight: 800, cursor: text.trim() && !sending ? "pointer" : "default", fontSize: 16, flexShrink: 0 }}>
          {sending ? "…" : "→"}
        </button>
      </div>
    </>
  );
}

function relTime(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "ahora";
  if (diff < 3600)  return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}d`;
}
