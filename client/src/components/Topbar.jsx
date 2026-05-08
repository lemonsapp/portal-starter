import { useEffect, useState } from "react";
import { useUser } from "../context/UserContext.jsx";
import { useNavigate } from "react-router-dom";
import { CountUp } from "./MotionPop.jsx";
import { useBranding } from "../lib/branding.js";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

export default function Topbar() {
  const userCtx = useUser();
  const branding = useBranding();
  const [me, setMe] = useState(null);
  const [userDrop, setUserDrop] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [privUnread, setPrivUnread] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) return;
    const loadNotifs = () => {
      fetch(`${API}/api/notifications`, { headers: { Authorization: `Bearer ${getToken()}` } })
        .then(r => r.json()).then(d => { if (d.ok) { setNotifs(d.notifications); setUnread(d.unread); } }).catch(() => {});
      fetch(`${API}/api/chat/private/unread/count`, { headers: { Authorization: `Bearer ${getToken()}` } })
        .then(r => r.json()).then(d => { if (d.ok) setPrivUnread(d.total || 0); }).catch(() => {});
    };
    loadNotifs();
    const iv = setInterval(loadNotifs, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (d.user) {
          setMe(d.user);
          fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(d => { if (d.profile) setProfileData(d); }).catch(() => {});
        }
      }).catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const handler = () => setNotifOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [notifOpen]);

  useEffect(() => {
    if (!userDrop) return;
    const handler = () => setUserDrop(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [userDrop]);

  async function markAllRead() {
    await fetch(`${API}/api/notifications/read`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setNotifs(n => n.map(x => ({...x, read: true})));
    setUnread(0);
  }

  function logout() {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    window.location.href = "/";
  }

  const isStaff   = me?.role === "operator" || me?.role === "admin";
  const roleLabel = me?.role === "admin" ? "Admin" : isStaff ? "Operador" : "Cliente";

  const displayName = userCtx?.displayName || me?.name || "";
  const nameStyle   = userCtx?.nameStyle  || { color: "#ede9e0" };
  const avatarUrl   = profileData?.profile?.avatar_url || null;
  const avatarKey   = profileData?.profile?.avatar_key || "avatar_lemon";
  const avatarEmoji = ({ avatar_lemon:"🪙", avatar_rocket:"🚀", avatar_globe:"🌍", avatar_diamond:"💎", avatar_fire:"🔥", avatar_crown:"👑" })[avatarKey] || "🪙";
  const avatarBg    = ({ avatar_lemon:"var(--brand-primary, #f5e03a)", avatar_rocket:"#3b82f6", avatar_globe:"#22c55e", avatar_diamond:"#a78bfa", avatar_fire:"var(--brand-accent, #ff5500)", avatar_crown:"var(--brand-primary, #f5e03a)" })[avatarKey] || "var(--brand-primary, #f5e03a)";
  const balance     = profileData?.coins?.balance || 0;

  return (
    <>
      <style>{`
        .tb-shell {
          position: sticky; top: 0; z-index: 500;
          background: ${scrolled ? "rgba(2,3,7,0.96)" : "rgba(2,3,7,0.78)"};
          backdrop-filter: blur(28px);
          border-bottom: 1px solid rgba(240,236,227,0.06);
          transition: background .3s, box-shadow .3s; height: 64px;
          box-shadow: ${scrolled ? "0 8px 32px rgba(0,0,0,.4)" : "none"};
        }
        .tb-shell::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),.4), rgba(var(--brand-accent-rgb),.4), rgba(var(--brand-primary-rgb),.4), transparent);
          background-size: 200% 100%;
          animation: tbBar 6s linear infinite;
          opacity: ${scrolled ? "1" : "0"};
          transition: opacity .3s;
        }
        @keyframes tbBar { from { background-position: 0 0; } to { background-position: 200% 0; } }
        .tb-inner {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px; height: 64px; max-width: 100%; gap: 12px;
        }
        .tb-logo {
          font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 5px;
          color: #f0ece3; text-decoration: none; display: flex; align-items: center; gap: 10px;
          flex-shrink: 0;
          transition: text-shadow .25s;
        }
        .tb-logo:hover { text-shadow: 0 0 20px rgba(var(--brand-primary-rgb),.4); }
        .tb-logo .y { color: var(--brand-primary, #f5e03a); }
        .tb-logo .dot { width:7px; height:7px; background:var(--brand-accent, #ff5500); border-radius:50%; animation:tbpulse 2s ease-in-out infinite; box-shadow:0 0 10px var(--brand-accent, #ff5500); }
        @keyframes tbpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.25;transform:scale(0.7)} }
        .tb-user-btn { display:flex; align-items:center; gap:10px; padding:8px 14px; background:rgba(255,255,255,0.025); border:1px solid rgba(240,236,227,0.08); cursor:pointer; transition:all .25s; position:relative; }
        .tb-user-btn:hover { background:rgba(var(--brand-primary-rgb),0.05); border-color:rgba(var(--brand-primary-rgb),0.22); transform:translateY(-1px); }
        .tb-role { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; text-transform:uppercase; padding:3px 9px; background:rgba(var(--brand-primary-rgb),0.06); border:1px solid rgba(var(--brand-primary-rgb),0.2); color:var(--brand-primary, #f5e03a); font-weight:500; }
        .tb-drop { position:absolute; right:0; top:calc(100% + 10px); background:rgba(7,9,15,0.97); border:1px solid rgba(240,236,227,0.08); overflow:hidden; min-width:280px; z-index:9999; box-shadow:0 28px 80px rgba(0,0,0,0.7); backdrop-filter:blur(28px); animation:dropIn 0.32s cubic-bezier(0.2,0.8,0.2,1); }
        .tb-drop::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a)); background-size:200% 100%; animation:tbBar 4s linear infinite; }
        @keyframes dropIn { 0%{opacity:0;transform:translateY(-12px) scale(0.97)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        .tb-drop-item { display:flex; align-items:center; gap:12px; padding:14px 22px; font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:rgba(240,236,227,0.65); text-decoration:none; border-bottom:1px solid rgba(240,236,227,0.04); transition:all .2s; cursor:pointer; background:none; border-left:none; border-right:none; border-top:none; width:100%; text-align:left; position:relative; }
        .tb-drop-item::before { content:''; position:absolute; left:0; top:0; bottom:0; width:0; background:linear-gradient(90deg,rgba(var(--brand-primary-rgb),.3),transparent); transition:width .3s; }
        .tb-drop-item:hover { color:var(--brand-primary, #f5e03a); padding-left:28px; }
        .tb-drop-item:hover::before { width:100%; }
        .tb-drop-item:last-child { border-bottom:none; }
        .tb-logout { font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:800; letter-spacing:2px; text-transform:uppercase; background:rgba(255,255,255,0.025); color:rgba(240,236,227,0.55); border:1px solid rgba(240,236,227,0.08); padding:0 18px; cursor:pointer; transition:all .25s; height:38px; display:flex; align-items:center; }
        .tb-logout:hover { background:rgba(var(--brand-accent-rgb),0.08); color:var(--brand-accent, #ff8c2a); border-color:rgba(var(--brand-accent-rgb),0.25); }
        @media(max-width:768px) { .hide-mobile { display:none !important; } .tb-inner { padding:0 12px !important; } }
      `}</style>

      <div className="tb-shell">
        <div className="tb-inner">

          {/* Logo */}
          <a href="/inicio" className="tb-logo">
            <img src="/icons/icon.svg" alt="" style={{ width:30, height:30, objectFit:"contain", filter:"drop-shadow(0 0 8px rgba(var(--brand-primary-rgb),.35))", flexShrink:0 }} />
            LEMON<span className="y">'S</span>
            <span className="dot" />
            ARG
          </a>

          {/* Right: estado líneas + notif + usuario + salir */}
          <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            {me && (
              <button onClick={()=>navigate("/chats")}
                title={privUnread > 0 ? `${privUnread} mensajes sin leer` : "Mensajes privados"}
                style={{position:"relative",width:40,height:40,borderRadius:12,background:privUnread>0?"rgba(34,197,94,.1)":"rgba(255,255,255,.04)",border:`1px solid ${privUnread>0?"rgba(34,197,94,.35)":"rgba(255,255,255,.08)"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transition:"all .2s",color:privUnread>0?"#22c55e":"rgba(237,233,224,.78)"}}>
                ✉
                {privUnread > 0 && <span style={{position:"absolute",top:-4,right:-4,minWidth:16,height:16,borderRadius:999,background:"#22c55e",color:"#000",fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",border:"2px solid #03040c"}}>{privUnread > 9 ? "9+" : privUnread}</span>}
              </button>
            )}
            {me && (
            <div style={{position:"relative"}} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>setNotifOpen(o=>!o)} style={{position:"relative",width:40,height:40,borderRadius:12,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transition:"all .2s"}}>
                🔔
                {unread > 0 && <span style={{position:"absolute",top:6,right:6,width:16,height:16,borderRadius:"50%",background:"#ef4444",color:"#fff",fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{unread > 9 ? "9+" : unread}</span>}
              </button>
              {notifOpen && (
                <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",width:340,maxHeight:480,background:"rgba(10,10,10,.99)",border:"1px solid rgba(var(--brand-primary-rgb),.15)",borderRadius:18,overflow:"hidden",zIndex:9999,boxShadow:"0 20px 60px rgba(0,0,0,.8)",animation:"dropIn .25s cubic-bezier(.34,1.56,.64,1)"}} onClick={e=>e.stopPropagation()}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:"2px"}}>Notificaciones</span>
                    {unread > 0 && <button onClick={markAllRead} style={{fontSize:10,fontWeight:800,color:"var(--brand-primary, #f5e03a)",background:"none",border:"none",cursor:"pointer",letterSpacing:"1px"}}>Marcar todo leído</button>}
                  </div>
                  <div style={{overflowY:"auto",maxHeight:400}}>
                    {notifs.length === 0 && <div style={{padding:28,textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:12}}>Sin notificaciones</div>}
                    {notifs.map(n => {
                      const isAnn = typeof n.type === "string" && n.type.startsWith("ann_");
                      const annCat = isAnn ? n.type.replace("ann_", "") : null;
                      const ANN_CFG = {
                        urgente: { emoji: "🚨", color: "#ef4444", bg: "rgba(239,68,68,.1)",  border: "rgba(239,68,68,.3)", label: "Urgente" },
                        linea:   { emoji: "🌐", color: "var(--brand-primary, #f5e03a)", bg: "rgba(var(--brand-primary-rgb),.1)", border: "rgba(var(--brand-primary-rgb),.3)", label: "Líneas" },
                        feriado: { emoji: "🎌", color: "#60a5fa", bg: "rgba(96,165,250,.1)", border: "rgba(96,165,250,.3)", label: "Feriado" },
                        tip:     { emoji: "💡", color: "#fbbf24", bg: "rgba(251,191,36,.1)", border: "rgba(251,191,36,.3)", label: "Tip" },
                        novedad: { emoji: "✨", color: "#a78bfa", bg: "rgba(167,139,250,.1)",border: "rgba(167,139,250,.3)", label: "Novedad" },
                        general: { emoji: "📢", color: "var(--brand-primary, #f5e03a)", bg: "rgba(var(--brand-primary-rgb),.1)", border: "rgba(var(--brand-primary-rgb),.3)", label: "Anuncio" },
                      };
                      const annStyle = isAnn ? (ANN_CFG[annCat] || ANN_CFG.general) : null;
                      return (
                        <a key={n.id} href={n.link||"#"} onClick={(ev)=>{ setNotifOpen(false); if(!n.read){ setNotifs(prev=>prev.map(x=>x.id===n.id?{...x,read:true}:x)); setUnread(u=>Math.max(0,u-1)); fetch(`${API}/api/notifications/read`,{method:"POST",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({ids:[n.id]})}).catch(()=>{}); } }} style={{display:"flex",gap:12,padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,.04)",background:n.read ? "transparent" : (isAnn ? annStyle.bg : "rgba(var(--brand-primary-rgb),.04)"),textDecoration:"none",transition:"all .15s",alignItems:"flex-start",borderLeft: isAnn && !n.read ? `2px solid ${annStyle.color}` : "2px solid transparent"}}>
                          {/* Avatar */}
                          <div style={{flexShrink:0,width:40,height:40,borderRadius:isAnn?12:"50%",overflow:"hidden",border:`2px solid ${isAnn ? annStyle.border : "rgba(var(--brand-primary-rgb),.2)"}`,background:isAnn ? annStyle.bg : "rgba(var(--brand-primary-rgb),.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,filter: isAnn ? `drop-shadow(0 0 6px ${annStyle.color}66)` : "none"}}>
                            {isAnn
                              ? <span>{annStyle.emoji}</span>
                              : (n.actor_avatar
                                  ? <img src={n.actor_avatar} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                                  : <span>{n.type==="follow"?"👤":n.type==="delivery"?"📦":n.type==="like"?"❤️":n.type==="comment"?"💬":"🔔"}</span>
                                )
                            }
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            {isAnn ? (
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"1.5px",fontWeight:800,padding:"2px 8px",color:annStyle.color,background:annStyle.bg,border:`1px solid ${annStyle.border}`,borderRadius:4,textTransform:"uppercase"}}>
                                  📢 {annStyle.label}
                                </span>
                                <span style={{fontSize:10,color:"rgba(255,255,255,.35)",fontFamily:"'DM Mono',monospace",letterSpacing:"1px"}}>{branding.name}</span>
                              </div>
                            ) : (n.actor_name && (
                              <span style={{fontSize:13,fontWeight:800,color:n.actor_name_color||"var(--brand-primary, #f5e03a)",textShadow:n.actor_glow>0&&n.actor_glow_color?`0 0 ${n.actor_glow*2}px ${n.actor_glow_color}`:"none",marginRight:6}}>
                                {n.actor_name}
                              </span>
                            ))}
                            <div style={{fontSize:isAnn?13:12,fontWeight:isAnn?700:400,color:n.read?"rgba(255,255,255,.45)":"rgba(255,255,255,.92)",lineHeight:1.4,marginTop:isAnn?0:2,fontFamily:isAnn?"'Barlow',sans-serif":"inherit"}}>{isAnn ? n.title : n.body}</div>
                            {isAnn && n.body && (
                              <div style={{fontSize:11,color:n.read?"rgba(255,255,255,.3)":"rgba(255,255,255,.55)",lineHeight:1.5,marginTop:3}}>{n.body}</div>
                            )}
                            <div style={{fontSize:9,color:"rgba(255,255,255,.22)",marginTop:5,letterSpacing:"0.5px"}}>{new Date(n.created_at).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>
                          </div>
                          {!n.read && <div style={{width:8,height:8,borderRadius:"50%",background:isAnn?annStyle.color:"var(--brand-primary, #f5e03a)",flexShrink:0,marginTop:6,boxShadow:isAnn?`0 0 8px ${annStyle.color}`:"none"}}/>}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          {me && (
              <div style={{ position:"relative" }}>
                <div className="tb-user-btn" onClick={e => { e.stopPropagation(); setUserDrop(o => !o); }}>
                  {avatarUrl ? (
                    <div style={{ width:34,height:34,borderRadius:"50%",overflow:"hidden",flexShrink:0,border:"2px solid rgba(var(--brand-primary-rgb),0.4)" }}>
                      <img src={avatarUrl} style={{ width:"100%",height:"100%",objectFit:"cover" }} alt="" />
                    </div>
                  ) : (
                    <div style={{ width:34,height:34,borderRadius:"50%",background:avatarBg,display:"grid",placeItems:"center",fontSize:18,flexShrink:0 }}>
                      {avatarEmoji}
                    </div>
                  )}
                  <div>
                    <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:2 }}>
                      <span className="tb-role">{roleLabel}</span>
                      <span style={{ fontSize:13,fontWeight:800,...nameStyle }}>{displayName}</span>
                    </div>
                    <div style={{ fontSize:11,color:"rgba(237,233,224,0.3)" }} className="hide-mobile">#{me.client_number} · {me.email}</div>
                  </div>
                  <span style={{ fontSize:9,color:"rgba(255,255,255,0.2)" }}>▼</span>
                </div>

                {userDrop && (
                  <div className="tb-drop" onClick={e => e.stopPropagation()}>
                    <div style={{ padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:12,background:"rgba(var(--brand-primary-rgb),0.04)" }}>
                      {avatarUrl ? (
                        <div style={{ width:44,height:44,borderRadius:"50%",overflow:"hidden",border:"2px solid rgba(var(--brand-primary-rgb),0.4)" }}>
                          <img src={avatarUrl} style={{ width:"100%",height:"100%",objectFit:"cover" }} alt="" />
                        </div>
                      ) : (
                        <div style={{ width:44,height:44,borderRadius:"50%",background:avatarBg,display:"grid",placeItems:"center",fontSize:22 }}>{avatarEmoji}</div>
                      )}
                      <div>
                        <div style={{ fontWeight:900,fontSize:16,color:"#fff" }}>{me.name}</div>
                        <div style={{ fontSize:11,color:"var(--brand-primary, #f5e03a)",fontWeight:700 }}><CountUp value={balance}>{balance.toLocaleString()}</CountUp> 🪙 LC</div>
                        <div style={{ fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1 }}>{me.email}</div>
                      </div>
                    </div>
                    <a href={me?.username ? `/perfil/${me.username}` : "/perfil"} className="tb-drop-item" onClick={() => setUserDrop(false)}>👤 Mi Perfil</a>
                    <a href="/coins"  className="tb-drop-item" onClick={() => setUserDrop(false)}>🪙 Coins</a>
                    <button className="tb-drop-item" style={{ color:"rgba(239,68,68,0.8)" }} onClick={() => { setUserDrop(false); logout(); }}>🚪 Cerrar sesión</button>
                  </div>
                )}
              </div>
            )}
            <button className="tb-logout" onClick={logout}>Salir</button>
          </div>

        </div>
      </div>
    </>
  );
}
