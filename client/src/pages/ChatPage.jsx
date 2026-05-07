import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { buildNameStyle } from "../utils/nameStyles.js";
import { io } from "socket.io-client";
import { BannerCanvas } from "./ProfileStudio.jsx";
import { Pop, Jumbo } from "../components/MotionPop.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

// Metadata visual para salas. La sala "general" (default seed) está acá;
// salas custom que cree el admin caen en el fallback `{accent:"#c8f53a", icon: room.icon || "💬"}`.
const ROOM_META = {
  "general": { accent: "var(--brand-primary, #c8f53a)", icon: "💬" },
};

const ICONS = { gold: "🥇", diamond: "💎", crown: "👑" };
const AVATAR_EMOJIS = { avatar_lemon:"🪙", avatar_fire:"🔥", avatar_diamond:"💎", avatar_star:"⭐", avatar_crown:"👑", avatar_rocket:"🚀" };

// ── XAT-style SMILES (códigos → emoji) ────────────────────────────────────────
const SMILES_MAP = {
  ":)": "😊", ":-)": "😊", ":D": "😄", ":-D": "😄", ":P": "😛", ":p": "😛",
  ":(": "😢", ":-(": "😢", ":'(": "😭", ";)": "😉", ";-)": "😉",
  ":o": "😮", ":O": "😮", ":|": "😐", ":/": "😕", "xD": "😆", "XD": "😆",
  "<3": "❤️", "</3": "💔", ":*": "😘", "B)": "😎",
  "(L)": "🪙", "(Y)": "👍", "(N)": "👎", "(H)": "😎", "(K)": "💋", "(F)": "🌹",
  "(*)": "⭐", "(fire)": "🔥", "(crown)": "👑", "(star)": "⭐", "(diamond)": "💎",
  "(heart)": "❤️", "(rocket)": "🚀", "(party)": "🎉", "(lemon)": "🪙",
  "(coin)": "🪙", "(box)": "📦", "(plane)": "✈️", "(wave)": "👋", "(clap)": "👏",
  "(eyes)": "👀", "(mind)": "🤯", "(100)": "💯", "(ok)": "👌", "(pray)": "🙏",
};
const SMILE_PICKER = [
  { c:"😊", k:":)" }, { c:"😄", k:":D" }, { c:"😆", k:"xD" }, { c:"😉", k:";)" },
  { c:"😎", k:"B)" }, { c:"😛", k:":P" }, { c:"😘", k:":*" }, { c:"😮", k:":o" },
  { c:"😐", k:":|" }, { c:"😕", k:":/" }, { c:"🤯", k:"(mind)" }, { c:"😢", k:":(" },
  { c:"😭", k:":'(" },
  { c:"❤️", k:"<3" }, { c:"💔", k:"</3" }, { c:"💋", k:"(K)" }, { c:"🌹", k:"(F)" },
  { c:"🪙", k:"(L)" }, { c:"⭐", k:"(*)" }, { c:"🔥", k:"(fire)" }, { c:"👑", k:"(crown)" },
  { c:"💎", k:"(diamond)" }, { c:"🚀", k:"(rocket)" }, { c:"🎉", k:"(party)" },
  { c:"💯", k:"(100)" }, { c:"👍", k:"(Y)" }, { c:"👎", k:"(N)" }, { c:"👌", k:"(ok)" },
  { c:"📦", k:"(box)" }, { c:"✈️", k:"(plane)" }, { c:"🪙", k:"(coin)" },
  { c:"👋", k:"(wave)" }, { c:"👏", k:"(clap)" }, { c:"👀", k:"(eyes)" }, { c:"🙏", k:"(pray)" },
];
const _smileKeys = Object.keys(SMILES_MAP).sort((a, b) => b.length - a.length);
function replaceSmiles(t) {
  if (!t) return t;
  let out = t;
  _smileKeys.forEach(k => { out = out.split(k).join(SMILES_MAP[k]); });
  return out;
}

/**
 * Renderiza texto con tokens :emoji_key: como <img>.
 * Devuelve array de React nodes (string + <img>).
 */
function renderRich(text, customMap) {
  if (!text) return [text];
  if (!customMap || Object.keys(customMap).length === 0) return [text];
  const re = /:([a-z0-9_]{2,30}):/gi;
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = m[1].toLowerCase();
    const e = customMap[key];
    if (e) {
      out.push(
        <img
          key={`e${m.index}`}
          src={e.url}
          alt={`:${key}:`}
          title={`:${key}:`}
          style={{ display: "inline-block", width: "1.4em", height: "1.4em", verticalAlign: "middle", margin: "0 1px", borderRadius: 4 }}
        />
      );
    } else {
      out.push(m[0]); // si no existe, dejar el texto
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ── Pawn / rank icon (xat-style) ──────────────────────────────────────────────
function getPawn(user) {
  if (!user) return null;
  if (user.user_role === "admin")    return { ico: "👑", c: "#ef4444", lbl: "ADMIN" };
  if (user.user_role === "operator") return { ico: "🛡️", c: "#fb923c", lbl: "OP" };
  if (user.chat_role === "owner" || user.chat_role === "main_owner")
    return { ico: "👑", c: "#fbbf24", lbl: "OWNER" };
  if (user.chat_role === "mod")      return { ico: "🛡️", c: "#60a5fa", lbl: "MOD" };
  return { ico: "🪙", c: "#c8f53a", lbl: "MEMBER" };
}

// ── Sound ping (Web Audio, sin asset externo) ────────────────────────────────
let __chatAudioCtx = null;
function chatPing(volume = 0.04) {
  try {
    __chatAudioCtx = __chatAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = __chatAudioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.start();
    o.stop(ctx.currentTime + 0.2);
  } catch (e) {}
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });
}


function Avatar({ name, size=30, color="#c8f53a", glow, avatarKey, avatarUrl }) {
  const emoji = avatarKey ? AVATAR_EMOJIS[avatarKey] : null;
  const initials = (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  if (avatarUrl) {
    return (
      <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, overflow:"hidden", border:`1.5px solid ${color}44`, boxShadow:glow?`0 0 10px ${color}44`:"none", userSelect:"none" }}>
        <img src={avatarUrl} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
      </div>
    );
  }
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, background:`linear-gradient(135deg,${color}22,${color}55)`, border:`1.5px solid ${color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:emoji?size*0.55:size*0.36, fontWeight:800, color, boxShadow:glow?`0 0 10px ${color}44`:"none", userSelect:"none" }}>
      {emoji||initials}
    </div>
  );
}

function UserName({ user, size=13 }) {
  const isStaff = ["admin","operator"].includes(user?.user_role||user?.role);
  const style = buildNameStyle(user);
  return (
    <span style={{ fontWeight:700, fontSize:size, display:"inline-flex", alignItems:"center", gap:3, ...style }}>
      {user?.icon_slug && ICONS[user.icon_slug] && <span>{ICONS[user.icon_slug]}</span>}
      {isStaff && <span>🪙</span>}
      <span>{user?.user_name||user?.name}</span>
      {user?.chat_role && user.chat_role!=="member" && !isStaff && <span style={{ fontSize:size-3, color:"#60a5fa" }}>[{user.chat_role.toUpperCase()}]</span>}
      {isStaff && <span style={{ fontSize:size-3, color:"#ef4444", opacity:0.7 }}>ADMIN</span>}
    </span>
  );
}

// ── Profile Modal ─────────────────────────────────────────────────────────────
function ProfileModal({ user, currentUser, token, isAdmin, friends, onClose, onPrivateChat, onAddFriend, onAccept, onReject, onAssignRole, onKick, chatPowersOwned, currentProfile, onSaved }) {
  const navigate = useNavigate();
  const isOwn = user.user_id === currentUser?.id;
  const [tab, setTab] = useState("info");
  const [profile, setProfile] = useState(null);
  const [cfg, setCfg] = useState(null); // null = cargando
  // Cargar config fresca del servidor siempre
  useEffect(()=>{
    if(!isOwn) return;
    fetch(`${API}/api/chat/config`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.json()).then(d=>{
        if(d.ok) {
          setCfg(d.config || {});
          try { localStorage.setItem("chat_profile_cache", JSON.stringify(d.config||{})); } catch {}
        }
      }).catch(()=>{ setCfg(currentProfile||{}); });
  },[isOwn]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const has = (slug) => chatPowersOwned.includes(slug) || ["admin","operator"].includes(currentUser?.role);

  const [followStats, setFollowStats] = useState({ followers: 0, following: 0, isFollowing: false });
  const [addingFriend, setAddingFriend] = useState(false);
  useEffect(() => {
    fetch(`${API}/profile/${user.user_id}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r=>r.json()).then(d=>{ if(d.user) setProfile(d); }).catch(()=>{});
    fetch(`${API}/api/follow/${user.user_id}`, { headers:{ Authorization:`Bearer ${token}` } })
      .then(r=>r.json()).then(d=>{ if(d.ok) setFollowStats({ followers: d.followers||0, following: d.following||0, isFollowing: !!d.isFollowing }); }).catch(()=>{});
  }, [user.user_id]);

  // Wrapper de onAddFriend con loading + feedback inline
  async function handleAddFriend() {
    setAddingFriend(true);
    try { await onAddFriend(user); } catch {}
    finally { setAddingFriend(false); }
  }
  // Toggle follow del usuario
  async function toggleFollow() {
    try {
      const method = followStats.isFollowing ? "DELETE" : "POST";
      const r = await fetch(`${API}/api/follow/${user.user_id}`, { method, headers: { Authorization:`Bearer ${token}` } });
      const d = await r.json();
      if (d.ok) setFollowStats(s => ({ ...s, isFollowing: !s.isFollowing, followers: d.followers ?? s.followers }));
    } catch {}
  }

  const friendship = friends.find(f => f.other_id === user.user_id);
  const nameColor = user.name_color || (["admin","operator"].includes(user.user_role) ? "#ef4444" : "#c8f53a");
  const level = profile?.user?.level || "bronze";
  const bannerGrad = level==="gold"
    ? "linear-gradient(135deg,rgba(var(--brand-primary-rgb),.3),rgba(var(--brand-accent-rgb),.2))"
    : level==="silver" ? "linear-gradient(135deg,rgba(192,192,192,.2),rgba(96,165,250,.15))"
    : "linear-gradient(135deg,rgba(99,102,241,.2),rgba(168,85,247,.15))";

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/chat/config`, {
        method:"POST", headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body: JSON.stringify({ name_color:cfg.name_color||null, name_glow:cfg.name_glow||null, name_glow_color:cfg.name_glow_color||null, name_grad_from:cfg.name_grad_from||null, name_grad_to:cfg.name_grad_to||null, nickname:cfg.nickname!==undefined?cfg.nickname:null, nick_color:cfg.nick_color||null, nick_glow:cfg.nick_glow||null, nick_glow_color:cfg.nick_glow_color||null, icon_slug:cfg.icon_slug||null })
      });
      const d = await r.json();
      if(d.ok) { setSaveMsg({ok:true,text:"¡Guardado!"}); onSaved&&onSaved(cfg); }
      else setSaveMsg({ok:false,text:d.error});
    } catch { setSaveMsg({ok:false,text:"Error"}); }
    setSaving(false); setTimeout(()=>setSaveMsg(null),3000);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center" }} onClick={onClose}>
      <div className="xc-pmodal" style={{ background:"#04060d",border:"1px solid rgba(237,233,224,.08)",borderRadius:20,width:"min(460px,95vw)",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,.9)" }} onClick={e=>e.stopPropagation()}>
        {/* Banner */}
        <div style={{ height:110,position:"relative",borderRadius:"20px 20px 0 0",overflow:"hidden" }}>
          {profile?.profile?.banner_effect && profile.profile.banner_effect !== "none" ? (
            <BannerCanvas
              effect={profile.profile.banner_effect}
              color1={profile.profile.banner_color1 || "#a78bfa"}
              color2={profile.profile.banner_color2 || "#ec4899"}
              height={110}
            />
          ) : (
            <div style={{ position:"absolute",inset:0,background:bannerGrad }}>
              <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(237,233,224,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(237,233,224,.015) 1px,transparent 1px)",backgroundSize:"40px 40px" }} />
            </div>
          )}
          <button onClick={onClose} style={{ position:"absolute",top:10,right:10,zIndex:2,background:"rgba(0,0,0,.5)",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:16,borderRadius:8,padding:"4px 10px" }}>✕</button>
        </div>
        {/* Info */}
        <div style={{ background:"#0b0f1e",padding:"0 22px 20px" }}>
          <div style={{ display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginTop:-38,marginBottom:14 }}>
            <div style={{ position:"relative" }}>
              <Avatar name={user.user_name} size={76} color={nameColor} glow={!!user.name_glow} avatarKey={profile?.profile?.avatar_key} avatarUrl={profile?.profile?.avatar_url} />
              {isOwn && (
                <label style={{ position:"absolute",bottom:0,right:0,background:"#c8f53a",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:"2px solid #04060d",fontSize:12 }}>
                  📷
                  <input type="file" accept="image/*" style={{ display:"none" }} onChange={async(e)=>{
                    const file = e.target.files[0];
                    if(!file) return;
                    const fd = new FormData();
                    fd.append("avatar", file);
                    const r = await fetch(`${API}/profile/avatar-upload`, { method:"POST", headers:{ Authorization:`Bearer ${token}` }, body:fd });
                    const d = await r.json();
                    if(d.ok) { setProfile(prev=>({...prev,profile:{...prev?.profile,avatar_url:d.url}})); }
                    else alert(d.error);
                  }} />
                </label>
              )}
            </div>
            <div style={{ display:"flex",gap:6,paddingBottom:4 }}>
              {[["info","👤 Info"],...(isOwn?[["powers","⚡ Powers"]]:[])]
                .map(([id,label])=>(
                <button key={id} onClick={()=>{
                  // Para usuarios ajenos, INFO navega al perfil completo
                  if(id==="info" && !isOwn){
                    const uname = profile?.user?.username;
                    onClose();
                    if(uname) navigate(`/perfil/${uname}`);
                    else      navigate(`/perfil/id/${user.user_id}`); // fallback by-id
                    return;
                  }
                  setTab(id);
                }}
                  style={{ background:tab===id?"rgba(200,245,58,.12)":"transparent",border:`1px solid ${tab===id?"rgba(200,245,58,.3)":"rgba(237,233,224,.08)"}`,borderRadius:8,padding:"5px 12px",color:tab===id?"#c8f53a":"rgba(237,233,224,.4)",fontSize:11,cursor:"pointer",fontWeight:700 }}
                  title={!isOwn && id==="info" ? "Ver perfil completo" : ""}>
                  {label}{!isOwn && id==="info" ? " ↗" : ""}
                </button>
              ))}
            </div>
          </div>
          <UserName user={user} size={18} />
          {user.nickname && <div style={{ fontSize:12,color:user.nick_color||"#475569",marginTop:3,textShadow:user.nick_glow?`0 0 ${user.nick_glow}px ${user.nick_color||"#475569"}`:"none" }}>{user.nickname}</div>}
          <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:6,flexWrap:"wrap" }}>
            <div style={{ width:7,height:7,borderRadius:"50%",background:"#22c55e" }} />
            <span style={{ color:"#22c55e",fontSize:11 }}>Online</span>
            <span style={{ color:"#1e293b" }}>·</span>
            <span style={{ color:"#334155",fontSize:11 }}>#{user.client_number}</span>
          </div>
          {/* Followers / Following */}
          <div style={{ display:"flex",alignItems:"center",gap:14,marginTop:10 }}>
            <div style={{ fontSize:13 }}>
              <strong style={{ color:"#fff" }}>{followStats.followers}</strong>
              <span style={{ color:"#475569",marginLeft:5 }}>seguidores</span>
            </div>
            <div style={{ fontSize:13 }}>
              <strong style={{ color:"#fff" }}>{followStats.following}</strong>
              <span style={{ color:"#475569",marginLeft:5 }}>seguidos</span>
            </div>
            {!isOwn && (
              <button onClick={toggleFollow}
                style={{ marginLeft:"auto",padding:"5px 12px",borderRadius:8,border:`1px solid ${followStats.isFollowing?"rgba(239,68,68,.4)":"rgba(167,139,250,.4)"}`,background:followStats.isFollowing?"rgba(239,68,68,.08)":"rgba(167,139,250,.1)",color:followStats.isFollowing?"#ef4444":"#a78bfa",fontSize:11,fontWeight:800,cursor:"pointer",letterSpacing:".5px" }}>
                {followStats.isFollowing ? "✓ Siguiendo" : "+ Seguir"}
              </button>
            )}
          </div>
        </div>
        {/* Stats */}
        {profile && (
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,padding:"0 22px 16px",background:"#0b0f1e" }}>
            {/* Sprint 11: stats sociales reales (posts/amigos/coins). */}
            {[{label:"Posts",value:profile.stats?.posts||0},{label:"Amigos",value:profile.stats?.friends||0},{label:"🪙 Coins",value:profile.coins?.balance||0}].map(s=>(
              <div key={s.label} style={{ background:"rgba(255,255,255,.04)",borderRadius:10,padding:"10px 12px",textAlign:"center" }}>
                <div style={{ fontWeight:900,fontSize:18,color:"#f1f5f9" }}>{s.value}</div>
                <div style={{ fontSize:10,color:"#334155",marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
        {/* TAB INFO */}
        {tab==="info" && (
          <div style={{ padding:"0 22px 20px",background:"#0b0f1e",display:"flex",flexDirection:"column",gap:8 }}>
            {profile?.profile?.bio && <div style={{ background:"rgba(255,255,255,.03)",borderRadius:10,padding:12,fontSize:13,color:"#94a3b8",lineHeight:1.5 }}>{profile.profile.bio}</div>}
            {isOwn ? (
              <div style={{ textAlign:"center",color:"#334155",fontSize:12,padding:8 }}>
                Este sos vos 👋 · <span style={{ color:"#c8f53a",cursor:"pointer" }} onClick={()=>setTab("powers")}>Ir a Powers →</span>
              </div>
            ) : (
              <>
                {friendship?.status==="accepted" ? (
                  <button onClick={()=>onPrivateChat(user)} style={{ background:"#c8f53a18",border:"1px solid #c8f53a33",borderRadius:8,padding:"10px",color:"#c8f53a",fontSize:13,cursor:"pointer",fontWeight:700 }}>💬 Mensaje privado</button>
                ) : friendship?.status==="pending" ? (
                  <div style={{ display:"flex",gap:8 }}>
                    <button onClick={()=>onAccept(user)} style={{ flex:1,background:"#22c55e18",border:"1px solid #22c55e33",borderRadius:8,padding:"10px",color:"#22c55e",fontSize:13,cursor:"pointer",fontWeight:700 }}>✓ Aceptar</button>
                    <button onClick={()=>onReject(user)} style={{ flex:1,background:"#ef444418",border:"1px solid #ef444433",borderRadius:8,padding:"10px",color:"#ef4444",fontSize:13,cursor:"pointer",fontWeight:700 }}>✕ Rechazar</button>
                  </div>
                ) : (
                  <button onClick={handleAddFriend} disabled={addingFriend}
                    style={{ background:addingFriend?"#0f172a":"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"10px",color:"#60a5fa",fontSize:13,cursor:addingFriend?"wait":"pointer",fontWeight:700,opacity:addingFriend?.6:1 }}>
                    {addingFriend ? "Enviando..." : "➕ Agregar amigo"}
                  </button>
                )}
                {isAdmin && (
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4 }}>
                    <button onClick={()=>{onAssignRole(user,"moderator");onClose();}} style={{ background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"9px",color:"#60a5fa",fontSize:12,cursor:"pointer",fontWeight:700 }}>⚡ Dar MOD</button>
                    <button onClick={()=>{onAssignRole(user,"member");onClose();}} style={{ background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"9px",color:"#64748b",fontSize:12,cursor:"pointer",fontWeight:700 }}>👤 Quitar MOD</button>
                    <button onClick={()=>{onKick(user);onClose();}} style={{ background:"#ef444412",border:"1px solid #ef444430",borderRadius:8,padding:"9px",color:"#ef4444",fontSize:12,cursor:"pointer",fontWeight:700,gridColumn:"span 2" }}>🚫 Kickear</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {/* TAB POWERS */}
        {tab==="powers" && isOwn && (
          <div style={{ padding:"0 22px 20px",background:"#0b0f1e",display:"flex",flexDirection:"column",gap:8 }}>
            {saveMsg && <div style={{ background:saveMsg.ok?"#22c55e15":"#ef444415",border:`1px solid ${saveMsg.ok?"#22c55e30":"#ef444430"}`,borderRadius:8,padding:"8px 12px",color:saveMsg.ok?"#22c55e":"#ef4444",fontSize:12,marginBottom:4 }}>{saveMsg.text}</div>}

            {cfg === null && <div style={{ textAlign:"center",color:"#334155",padding:20,fontSize:12 }}>Cargando configuración...</div>}
            {cfg !== null && <>

            {/* Vista previa en vivo */}
            <div style={{ background:"rgba(255,255,255,.03)",borderRadius:10,padding:"10px 14px",marginBottom:4,display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ fontSize:11,color:"#334155" }}>Vista previa:</div>
              <span style={{ fontWeight:800, fontSize:14, ...(cfg.name_grad_from&&cfg.name_grad_to ? {background:`linear-gradient(90deg,${cfg.name_grad_from},${cfg.name_grad_to})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"} : {color:cfg.name_color||"#c8f53a",textShadow:cfg.name_glow?`0 0 ${cfg.name_glow}px ${cfg.name_glow_color||cfg.name_color||"#c8f53a"}`:"none"}) }}>
                {cfg.icon_slug&&ICONS[cfg.icon_slug]&&<span style={{marginRight:3}}>{ICONS[cfg.icon_slug]}</span>}
                🪙 {currentUser?.name}
              </span>
              {cfg.nickname && <span style={{ fontSize:11,color:cfg.nick_color||"#64748b",textShadow:cfg.nick_glow?`0 0 ${cfg.nick_glow}px ${cfg.nick_color||"#64748b"}`:"none" }}>{cfg.nickname}</span>}
            </div>

            {/* Powers como cards clickeables */}
            {[
              has("namecolor") && {
                slug:"namecolor", icon:"🎨", label:"Name Color", desc:"Color del nombre",
                content: (
                  <div style={{ display:"flex",gap:8,alignItems:"center",marginTop:10 }}>
                    <input type="color" value={cfg.name_color||"#c8f53a"} onChange={e=>setCfg(c=>({...c,name_color:e.target.value}))} style={{ width:40,height:40,borderRadius:8,border:"2px solid #1e293b",background:"none",cursor:"pointer",padding:2 }} />
                    <input type="text" value={cfg.name_color||"#c8f53a"} onChange={e=>setCfg(c=>({...c,name_color:e.target.value}))} maxLength={7} style={{ width:90,background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#e2e8f0",fontSize:12,padding:"6px 10px",outline:"none" }} />
                    <span style={{ color:cfg.name_color||"#c8f53a",fontWeight:800,fontSize:14 }}>Preview</span>
                  </div>
                )
              },
              has("nameglow") && {
                slug:"nameglow", icon:"✨", label:"Name Glow", desc:"Aura brillante alrededor del nombre",
                content: (
                  <div style={{ marginTop:10 }}>
                    <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:8 }}>
                      <input type="color" value={cfg.name_glow_color||"#c8f53a"} onChange={e=>setCfg(c=>({...c,name_glow_color:e.target.value}))} style={{ width:36,height:36,borderRadius:8,border:"2px solid #1e293b",background:"none",cursor:"pointer",padding:2 }} />
                      <span style={{ color:cfg.name_glow_color||"#c8f53a",textShadow:`0 0 ${cfg.name_glow||8}px ${cfg.name_glow_color||"#c8f53a"}`,fontWeight:800,fontSize:14 }}>Glow preview</span>
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <span style={{ color:"#475569",fontSize:11,minWidth:70 }}>Intensidad</span>
                      <input type="range" min={0} max={20} value={cfg.name_glow||0} onChange={e=>setCfg(c=>({...c,name_glow:Number(e.target.value)}))} style={{ flex:1 }} />
                      <span style={{ color:"#c8f53a",fontSize:12,minWidth:20,textAlign:"right" }}>{cfg.name_glow||0}</span>
                    </div>
                  </div>
                )
              },
              has("namegrad") && {
                slug:"namegrad", icon:"🌈", label:"Name Gradient", desc:"Gradiente de 2 colores en tu nombre",
                content: (
                  <div style={{ display:"flex",gap:8,alignItems:"center",marginTop:10 }}>
                    <input type="color" value={cfg.name_grad_from||"#c8f53a"} onChange={e=>setCfg(c=>({...c,name_grad_from:e.target.value}))} style={{ width:40,height:40,borderRadius:8,border:"2px solid #1e293b",background:"none",cursor:"pointer",padding:2 }} />
                    <span style={{ color:"#334155",fontSize:18 }}>→</span>
                    <input type="color" value={cfg.name_grad_to||"#60a5fa"} onChange={e=>setCfg(c=>({...c,name_grad_to:e.target.value}))} style={{ width:40,height:40,borderRadius:8,border:"2px solid #1e293b",background:"none",cursor:"pointer",padding:2 }} />
                    <span style={{ background:`linear-gradient(90deg,${cfg.name_grad_from||"#c8f53a"},${cfg.name_grad_to||"#60a5fa"})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontWeight:800,fontSize:14 }}>Preview</span>
                  </div>
                )
              },
              has("nickname") && {
                slug:"nickname", icon:"📝", label:"Nickname", desc:"Texto de status debajo del nombre",
                content: (
                  <div style={{ marginTop:10 }}>
                    <input type="text" value={cfg.nickname||""} onChange={e=>setCfg(c=>({...c,nickname:e.target.value}))} maxLength={40} placeholder="Tu status..." style={{ width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#e2e8f0",fontSize:13,padding:"8px 12px",outline:"none",boxSizing:"border-box" }} />
                    <div style={{ fontSize:11,color:"#334155",marginTop:6 }}>Vista: <span style={{ color:cfg.nick_color||"#64748b" }}>{cfg.nickname||"tu status"}</span></div>
                  </div>
                )
              },
              has("nickcolor") && {
                slug:"nickcolor", icon:"🎨", label:"Nick Color", desc:"Color del texto de status",
                content: (
                  <div style={{ display:"flex",gap:8,alignItems:"center",marginTop:10 }}>
                    <input type="color" value={cfg.nick_color||"#ffd500"} onChange={e=>setCfg(c=>({...c,nick_color:e.target.value}))} style={{ width:40,height:40,borderRadius:8,border:"2px solid #1e293b",background:"none",cursor:"pointer",padding:2 }} />
                    <input type="text" value={cfg.nick_color||"#ffd500"} onChange={e=>setCfg(c=>({...c,nick_color:e.target.value}))} maxLength={7} style={{ width:90,background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#e2e8f0",fontSize:12,padding:"6px 10px",outline:"none" }} />
                    <span style={{ color:cfg.nick_color||"#ffd500",fontWeight:700,fontSize:14 }}>{cfg.nickname||"Preview"}</span>
                  </div>
                )
              },
              has("nickglow") && {
                slug:"nickglow", icon:"✨", label:"Nick Glow", desc:"Glow en el texto de status",
                content: (
                  <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ padding:"10px 12px",background:"rgba(255,255,255,.03)",borderRadius:8,textAlign:"center" }}>
                      <span style={{ color:cfg.nick_color||"#ffffff", fontSize:15, fontWeight:700, textShadow:`0 0 ${Number(cfg.nick_glow)||8}px ${cfg.nick_glow_color||"#c8f53a"}` }}>
                        {cfg.nickname||"Glow preview"}
                      </span>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <input type="color" value={cfg.nick_glow_color||"#c8f53a"} onChange={e=>setCfg(c=>({...c,nick_glow_color:e.target.value}))} style={{ width:36,height:36,borderRadius:8,border:"2px solid #1e293b",background:"none",cursor:"pointer",padding:2,flexShrink:0 }} />
                      <input type="text" value={cfg.nick_glow_color||"#c8f53a"} onChange={e=>setCfg(c=>({...c,nick_glow_color:e.target.value}))} maxLength={7} style={{ width:90,background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#e2e8f0",fontSize:12,padding:"6px 10px",outline:"none" }} />
                      <span style={{ color:"#475569",fontSize:11 }}>Color del glow</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:"#475569",fontSize:11,minWidth:70,flexShrink:0 }}>Intensidad</span>
                      <input type="range" min={0} max={20} value={Number(cfg.nick_glow)||0} onChange={e=>setCfg(c=>({...c,nick_glow:Number(e.target.value)}))} style={{ flex:1 }} />
                      <span style={{ color:"#c8f53a",fontSize:12,minWidth:24,textAlign:"right",fontWeight:700 }}>{Number(cfg.nick_glow)||0}</span>
                    </div>
                  </div>
                )
              },
              (has("gold")||has("diamond")||has("crown")) && {
                slug:"icons", icon:"🏅", label:"Ícono", desc:"Ícono exclusivo al lado de tu nombre",
                content: (
                  <div style={{ display:"flex",gap:8,marginTop:10,flexWrap:"wrap" }}>
                    {[{slug:"gold",icon:"🥇",label:"Gold"},{slug:"diamond",icon:"💎",label:"Diamond"},{slug:"crown",icon:"👑",label:"Crown"}].filter(i=>has(i.slug)).map(i=>(
                      <button key={i.slug} onClick={()=>setCfg(c=>({...c,icon_slug:c.icon_slug===i.slug?null:i.slug}))}
                        style={{ background:cfg.icon_slug===i.slug?"rgba(200,245,58,.15)":"rgba(255,255,255,.03)",border:`2px solid ${cfg.icon_slug===i.slug?"#c8f53a":"rgba(237,233,224,.08)"}`,borderRadius:12,padding:"10px 16px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                        <span style={{ fontSize:28 }}>{i.icon}</span>
                        <span style={{ fontSize:10,color:cfg.icon_slug===i.slug?"#c8f53a":"#475569",fontWeight:700 }}>{i.label}</span>
                      </button>
                    ))}
                    <button onClick={()=>setCfg(c=>({...c,icon_slug:null}))}
                      style={{ background:"rgba(255,255,255,.03)",border:"2px solid rgba(237,233,224,.06)",borderRadius:12,padding:"10px 16px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
                      <span style={{ fontSize:28 }}>⊘</span>
                      <span style={{ fontSize:10,color:"#334155",fontWeight:700 }}>Ninguno</span>
                    </button>
                  </div>
                )
              },
            ].filter(Boolean).map(power => (
              <PowerAccordion key={power.slug} power={power} />
            ))}

            {!has("namecolor")&&!has("nameglow")&&!has("nickname")&&!has("gold") && (
              <div style={{ textAlign:"center",padding:24,color:"#334155" }}>
                <div style={{ fontSize:32,marginBottom:8 }}>⚡</div>
                <div style={{ fontSize:12 }}>Comprá Powers en la tienda del chat</div>
              </div>
            )}
            {(has("namecolor")||has("nameglow")||has("nickname")||has("gold")) && (
              <button onClick={save} disabled={saving}
                style={{ background:"#c8f53a",color:"#000",border:"none",borderRadius:10,padding:"12px",fontWeight:800,cursor:"pointer",fontSize:14,opacity:saving?0.6:1,marginTop:4 }}>
                {saving?"Guardando...":"💾 Guardar cambios"}
              </button>
            )}
            </>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Power Accordion ──────────────────────────────────────────────────────────
function PowerAccordion({ power }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background:"rgba(255,255,255,.03)", border:`1px solid ${open?"rgba(200,245,58,.2)":"rgba(237,233,224,.06)"}`, borderRadius:12, overflow:"hidden", transition:"all .2s" }}>
      <div onClick={()=>setOpen(v=>!v)}
        style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",cursor:"pointer" }}>
        <div style={{ width:40,height:40,borderRadius:10,background:"rgba(200,245,58,.08)",border:"1px solid rgba(200,245,58,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>
          {power.icon}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700,color:"#e2e8f0",fontSize:13 }}>{power.label}</div>
          <div style={{ color:"#334155",fontSize:11,marginTop:1 }}>{power.desc}</div>
        </div>
        <div style={{ color:open?"#c8f53a":"#334155",fontSize:16,transition:"transform .2s",transform:open?"rotate(180deg)":"none" }}>▾</div>
      </div>
      {open && (
        <div style={{ padding:"0 14px 14px",borderTop:"1px solid rgba(237,233,224,.04)" }}>
          {power.content}
        </div>
      )}
    </div>
  );
}


// ── Private Chat Panel ────────────────────────────────────────────────────────
function PrivateChatPanel({ targetUser, currentUser, socket, token, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  const navigate = useNavigate();
  const goToProfile = () => { if (targetUser?.user_id) { onClose?.(); navigate(`/perfil/id/${targetUser.user_id}`); } };

  useEffect(() => {
    // Cargar historial
    fetch(`${API}/api/chat/private/${targetUser.user_id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(d => {
      if (d.ok) setMessages(d.messages || []);
    }).catch(() => {});
  }, [targetUser.user_id]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      const isRelevant = (msg.from_user_id === targetUser.user_id && msg.to_user_id === currentUser?.id) ||
                         (msg.from_user_id === currentUser?.id && msg.to_user_id === targetUser.user_id);
      if (isRelevant) setMessages(prev => [...prev, msg]);
    };
    socket.on("private_message", handler);
    return () => socket.off("private_message", handler);
  }, [socket, targetUser.user_id, currentUser?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function send() {
    const msg = input.trim();
    if (!msg || !socket) return;
    socket.emit("private_message", { to_user_id: targetUser.user_id, message: msg });
    setMessages(prev => [...prev, { from_user_id: currentUser?.id, to_user_id: targetUser.user_id, message: msg, created_at: new Date().toISOString() }]);
    setInput("");
  }

  const nameColor = targetUser.name_color || "#c8f53a";

  return (
    <div style={{ background:"#04060d", border:"1px solid rgba(237,233,224,0.1)", borderRadius:20, width:"100%", maxWidth:480, height:"70vh", display:"flex", flexDirection:"column", overflow:"hidden" }}
      onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div style={{ padding:"14px 18px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:10, background:"#08101e" }}>
        <button onClick={goToProfile} title={`Ver perfil de ${targetUser.user_name}`}
          style={{ background:"transparent", border:"none", padding:0, cursor:"pointer", flexShrink:0 }}>
          <Avatar name={targetUser.user_name} size={32} color={nameColor} avatarUrl={targetUser.avatar_url} />
        </button>
        <button onClick={goToProfile}
          style={{ flex:1, background:"transparent", border:"none", padding:0, cursor:"pointer", textAlign:"left" }}>
          <div style={{ fontWeight:800, fontSize:14, color:nameColor }}>{targetUser.user_name}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>Ver perfil →</div>
        </button>
        <button onClick={onClose} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", fontSize:18 }}>✕</button>
      </div>

      {/* Mensajes */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:13, marginTop:40 }}>
            Empezá la conversación 👋
          </div>
        )}
        {messages.map((m, i) => {
          const isOwn = m.from_user_id === currentUser?.id;
          const replyLabel = m.reply_to_story_id
            ? (isOwn ? "Respondiste a su historia" : "Te respondió a tu historia")
            : null;
          const hasQuote = !!m.reply_to_story_id;
          return (
            <div key={i} style={{ display:"flex", justifyContent: isOwn ? "flex-end" : "flex-start", marginBottom:8 }}>
              <div style={{ maxWidth:"75%", padding: hasQuote ? "6px 6px 8px" : "8px 14px", borderRadius: isOwn ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                background: isOwn ? "rgba(200,245,58,0.15)" : "rgba(255,255,255,0.06)",
                border: isOwn ? "1px solid rgba(200,245,58,0.2)" : "1px solid rgba(255,255,255,0.08)" }}>
                {hasQuote && (
                  <div style={{ display:"flex", gap:8, alignItems:"stretch", padding:6, marginBottom:6, background:"rgba(0,0,0,0.35)", borderLeft:"3px solid #c8f53a", borderRadius:8 }}>
                    {m.reply_story_image_url ? (
                      <img src={m.reply_story_image_url} alt="story" style={{ width:42, height:56, objectFit:"cover", borderRadius:4, flexShrink:0 }} />
                    ) : (
                      <div style={{ width:42, height:56, borderRadius:4, background:"linear-gradient(135deg,#c8f53a33,#a78bfa33)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>📷</div>
                    )}
                    <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", minWidth:0, flex:1 }}>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#c8f53a", letterSpacing:1.2, textTransform:"uppercase", fontWeight:700, lineHeight:1.3 }}>↩ {replyLabel}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(255,255,255,.55)", lineHeight:1.3, marginTop:2 }}>tu historia · 24h</span>
                    </div>
                  </div>
                )}
                <div style={{ fontSize:13, color: isOwn ? "#c8f53a" : "#e2e8f0", lineHeight:1.4, wordBreak:"break-word", padding: hasQuote ? "0 6px" : 0 }}>{m.message}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)", marginTop:4, textAlign:"right", padding: hasQuote ? "0 6px" : 0 }}>
                  {new Date(m.created_at).toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding:"10px 12px", borderTop:"1px solid rgba(255,255,255,0.06)", background:"#08101e" }}>
        <div style={{ display:"flex", gap:8, alignItems:"center", background:"#0d1424", border:"1px solid rgba(200,245,58,0.15)", borderRadius:10, padding:"4px 4px 4px 12px" }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }}}
            placeholder="Escribí un mensaje..." maxLength={500}
            style={{ flex:1, background:"none", border:"none", color:"#e2e8f0", fontSize:13, outline:"none", padding:"6px 0" }} />
          <button onClick={send} disabled={!input.trim()}
            style={{ background:input.trim()?"#c8f53a":"#1a2540", color:input.trim()?"#000":"#334155", border:"none", borderRadius:8, padding:"8px 16px", fontWeight:800, cursor:input.trim()?"pointer":"default", fontSize:13, transition:"all .15s", flexShrink:0 }}>→</button>
        </div>
      </div>
    </div>
  );
}


// ── Powers Inline ────────────────────────────────────────────────────────────
function PowersInline({ token }) {
  const [powers, setPowers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/chat/powers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (d.ok) setPowers(d.powers || []);
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign:"center", padding:40, color:"rgba(255,255,255,0.3)" }}>Cargando powers...</div>;

  return (
    <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ fontSize:13, fontWeight:800, color:"#c8f53a", marginBottom:8 }}>⚡ Powers</div>
      {powers.length === 0 && <div style={{ color:"rgba(255,255,255,0.3)", fontSize:13, textAlign:"center", padding:20 }}>No tenés powers todavía. Comprá en la tienda de Coins!</div>}
      {powers.map(p => (
        <div key={p.slug} style={{ padding:"12px 16px", background: p.owned ? "rgba(200,245,58,0.08)" : "rgba(255,255,255,0.03)", border:`1px solid ${p.owned ? "rgba(200,245,58,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius:12, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:24 }}>{p.icon || "⚡"}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:13, color: p.owned ? "#c8f53a" : "rgba(255,255,255,0.5)" }}>{p.name}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>{p.description}</div>
          </div>
          {p.owned ? <span style={{ fontSize:11, fontWeight:800, color:"#c8f53a", background:"rgba(200,245,58,0.1)", padding:"3px 10px", borderRadius:20 }}>✓ ACTIVO</span>
            : <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{p.cost} 🪙</span>}
        </div>
      ))}
      <a href="/coins" style={{ display:"block", textAlign:"center", padding:"12px", background:"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500))", color:"#000", borderRadius:12, fontWeight:900, fontSize:14, textDecoration:"none", marginTop:8 }}>
        🪙 Ver tienda de Coins
      </a>
    </div>
  );
}

// ── Message component ─────────────────────────────────────────────────────────
function SmilePicker({ accent, customEmojis, onPickSmile, onPickCustom, onClose }) {
  const [tab, setTab] = useState(customEmojis.length > 0 ? "custom" : "smiles");
  // Si no hay customs todavía, forzar tab smiles
  useEffect(()=>{ if(customEmojis.length===0 && tab==="custom") setTab("smiles"); },[customEmojis.length, tab]);
  return (
    <div className="xat-panel" style={{ background:"#070c18",borderTop:"1px solid #0d1424",padding:"10px 12px",maxHeight:220,overflowY:"auto" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:8 }}>
        <div style={{ display:"flex",gap:4 }}>
          <button onClick={()=>setTab("smiles")}
            style={{ background:tab==="smiles"?accent+"22":"transparent",border:`1px solid ${tab==="smiles"?accent+"55":"transparent"}`,color:tab==="smiles"?accent:"#475569",padding:"4px 10px",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"1.5px",fontWeight:700,cursor:"pointer",borderRadius:5,textTransform:"uppercase" }}>
            😊 Smiles
          </button>
          <button onClick={()=>setTab("custom")} disabled={customEmojis.length===0}
            style={{ background:tab==="custom"?accent+"22":"transparent",border:`1px solid ${tab==="custom"?accent+"55":"transparent"}`,color:customEmojis.length===0?"#1e293b":tab==="custom"?accent:"#475569",padding:"4px 10px",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"1.5px",fontWeight:700,cursor:customEmojis.length===0?"not-allowed":"pointer",borderRadius:5,textTransform:"uppercase" }}>
            🪙 Custom · {customEmojis.length}
          </button>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:12 }}>✕</button>
      </div>
      {tab==="smiles" ? (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(48px,1fr))",gap:4 }}>
          {SMILE_PICKER.map(s => (
            <Pop as="button" key={s.k} onClick={()=>onPickSmile(s.k)} title={s.k}
              hoverScale={1.18}
              style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 4px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",cursor:"pointer",borderRadius:6 }}>
              <span style={{ fontSize:20,lineHeight:1 }}>{s.c}</span>
              <span style={{ fontFamily:"'DM Mono',monospace",fontSize:7,color:"#475569",letterSpacing:".5px" }}>{s.k}</span>
            </Pop>
          ))}
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(56px,1fr))",gap:4 }}>
          {customEmojis.map(e => (
            <Pop as="button" key={e.key} onClick={()=>onPickCustom(e.key)} title={`:${e.key}:`}
              hoverScale={1.18}
              style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 4px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",cursor:"pointer",borderRadius:6 }}>
              <img src={e.url} alt={e.key} style={{ width:30,height:30,objectFit:"contain",imageRendering:"auto" }}/>
              <span style={{ fontFamily:"'DM Mono',monospace",fontSize:7,color:"#475569",letterSpacing:".3px",textOverflow:"ellipsis",overflow:"hidden",whiteSpace:"nowrap",maxWidth:"100%" }}>:{e.key}:</span>
            </Pop>
          ))}
        </div>
      )}
    </div>
  );
}

function Message({ msg, currentUserId, isAdmin, onDelete, onClick, customEmojis }) {
  const isOwn = msg.user_id===currentUserId;
  const avatarColor = msg.name_color||(["admin","operator"].includes(msg.user_role)?"#ef4444":"#c8f53a");
  const pawn = getPawn(msg);
  const text = replaceSmiles(msg.message || "");
  const rich = renderRich(text, customEmojis);
  const hasCustom = rich.some(n => typeof n !== "string");
  // Detect if message is JUST one or a few emoji → render bigger ("jumbomoji" — xat vibe)
  const isShort = text && text.replace(/[\s‍]/g, '').length <= 6 && /^\p{Extended_Pictographic}+$/u.test(text.replace(/\s/g,''));
  return (
    <div className="xat-msg" style={{ display:"flex",gap:8,padding:"4px 10px",background:isOwn?"rgba(200,245,58,0.02)":"transparent",borderLeft:isOwn?"2px solid rgba(200,245,58,0.08)":"2px solid transparent" }}
      onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.018)"}
      onMouseLeave={e=>e.currentTarget.style.background=isOwn?"rgba(200,245,58,0.02)":"transparent"}
    >
      <div onClick={()=>onClick(msg)} style={{ cursor:"pointer",paddingTop:2,flexShrink:0,position:"relative" }}>
        <Avatar name={msg.user_name} size={26} color={avatarColor} glow={!!msg.name_glow} avatarUrl={msg.avatar_url} />
        {pawn && <span title={pawn.lbl} style={{ position:"absolute",bottom:-3,right:-4,fontSize:11,filter:`drop-shadow(0 0 4px ${pawn.c})`,pointerEvents:"none" }}>{pawn.ico}</span>}
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:5,flexWrap:"wrap" }}>
          <span onClick={()=>onClick(msg)} style={{ cursor:"pointer" }}><UserName user={msg} size={12} /></span>
          {msg.nickname&&<span style={{ fontSize:10,color:msg.nick_color||"#334155",textShadow:msg.nick_glow?`0 0 ${msg.nick_glow}px ${msg.nick_color||"#334155"}`:"none" }}>· {msg.nickname}</span>}
          <span style={{ color:"#334155",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"1px" }}>{formatTime(msg.created_at)}</span>
          {isAdmin&&<button onClick={()=>onDelete(msg.id)} style={{ background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:10,opacity:0.3,padding:0 }} onMouseEnter={e=>e.target.style.opacity=1} onMouseLeave={e=>e.target.style.opacity=0.3}>✕</button>}
        </div>
        <div style={{ color:"#cbd5e1",fontSize:isShort?28:13,lineHeight:1.45,wordBreak:"break-word",marginTop:1,letterSpacing:isShort?"2px":0 }}>
          {hasCustom ? <span>{rich}</span> : (isShort ? <Jumbo>{text}</Jumbo> : text)}
        </div>
      </div>
    </div>
  );
}

function SystemMessage({ icon = "👋", text, accent = "#c8f53a" }) {
  return (
    <div className="xat-sys" style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"10px 14px",margin:"6px 14px",background:`${accent}08`,border:`1px solid ${accent}20`,fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"2px",textTransform:"uppercase",color:accent }}>
      <span style={{ fontSize:14 }}>{icon}</span>{text}
    </div>
  );
}

// ── Main ChatPage ─────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null); // sala activa (general por default)
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [joining, setJoining] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [privateChat, setPrivateChat] = useState(null);
  const [friends, setFriends] = useState([]);
  const [chatPowersOwned, setChatPowersOwned] = useState([]);
  const [showPowers, setShowPowers] = useState(false);
  const [showSmiles, setShowSmiles] = useState(false);
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem("chat_sound") !== "0"; } catch { return true; }
  });
  const [showWelcome, setShowWelcome] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastMsgIdRef = useRef(null);
  const token = getToken();
  const isAdmin = ["admin","operator"].includes(currentUser?.role);

  // Sala activa accent color
  const accent = activeRoom ? (ROOM_META[activeRoom.slug]?.accent || "#c8f53a") : "#c8f53a";

  useEffect(()=>{
    fetch(`${API}/auth/me`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>setCurrentUser(d.user)).catch(()=>{});
    fetch(`${API}/api/chat/friends`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{if(d.ok)setFriends(d.friends||[]);}).catch(()=>{});
    fetch(`${API}/api/chat/powers`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{if(d.ok)setChatPowersOwned(d.powers.filter(p=>p.owned).map(p=>p.slug));}).catch(()=>{});
    fetch(`${API}/api/chat/config`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{if(d.ok)setCurrentProfile(d.config||{});}).catch(()=>{});
  },[]);

  useEffect(()=>{
    fetch(`${API}/api/chat/rooms`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>{
      if(d.ok){ setRooms(d.rooms); }
    });
  },[]);

  // Custom emojis (refresca cada 60s)
  const [customEmojis, setCustomEmojis] = useState({});
  const [customEmojisList, setCustomEmojisList] = useState([]);
  useEffect(()=>{
    let abort=false;
    async function load(){
      try{
        const r=await fetch(`${API}/api/chat/emojis`,{headers:{Authorization:`Bearer ${token}`}});
        const d=await r.json();
        if(abort) return;
        if(d.ok){
          const map={}; d.emojis.forEach(e=>{ map[e.key]=e; });
          setCustomEmojis(map);
          setCustomEmojisList(d.emojis);
        }
      }catch{}
    }
    load();
    const iv=setInterval(load,60000);
    return ()=>{abort=true;clearInterval(iv);};
  },[token]);

  useEffect(()=>{
    const s=io(API,{auth:{token},transports:["websocket","polling"]});
    s.on("connect",()=>console.log("[CHAT] ok"));
    s.on("connect_error",e=>console.error("[CHAT]",e.message));
    setSocket(s);
    return()=>s.disconnect();
  },[]);

  // Auto-entrar a la sala general cuando carguen las rooms
  useEffect(()=>{
    if(rooms.length>0 && !activeRoom && socket) {
      const main = rooms.find(r=>r.slug==="general");
      if(main) enterRoom("general");
    }
  },[rooms, socket]);

  useEffect(()=>{
    if(!socket) return;
    socket.on("new_message",msg=>setMessages(prev=>[...prev,msg]));
    socket.on("user_joined",data=>setOnlineUsers(prev=>prev.find(u=>u.user_id===data.user_id)?prev.map(u=>u.user_id===data.user_id?{...u,...data}:u):[...prev,data]));
    socket.on("user_left",({user_id})=>setOnlineUsers(prev=>prev.filter(u=>u.user_id!==user_id)));
    socket.on("room_users",({users})=>setOnlineUsers(prev=>{const m=[...prev];for(const u of users)if(!m.find(x=>x.user_id===u.user_id))m.push(u);return m;}));
    socket.on("user_kicked",({user_id})=>{if(user_id===currentUser?.id){alert("Fuiste removido del room");}setOnlineUsers(prev=>prev.filter(u=>u.user_id!==user_id));});
    socket.on("private_message",msg=>{
      if(msg.from_user_id!==currentUser?.id) setPrivateChat(prev=>prev||{user_id:msg.from_user_id,user_name:msg.from_name,name_color:msg.name_color,_unread:true});
    });
    return()=>{["new_message","user_joined","user_left","room_users","user_kicked","private_message"].forEach(e=>socket.off(e));};
  },[socket,currentUser]);

  useEffect(()=>{messagesEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  // Ping sonoro cuando entra mensaje nuevo de OTRO usuario
  useEffect(() => {
    if (!messages.length) { lastMsgIdRef.current = null; return; }
    const last = messages[messages.length - 1];
    const prev = lastMsgIdRef.current;
    lastMsgIdRef.current = last.id;
    if (prev != null && last.id !== prev && last.user_id !== currentUser?.id && soundOn && document.hasFocus()) {
      chatPing();
    }
  }, [messages, currentUser, soundOn]);

  // Welcome banner al entrar a una sala
  useEffect(() => {
    if (!activeRoom) return;
    setShowWelcome(true);
    const t = setTimeout(() => setShowWelcome(false), 4500);
    return () => clearTimeout(t);
  }, [activeRoom?.slug]);

  function toggleSound() {
    setSoundOn(v => {
      const next = !v;
      try { localStorage.setItem("chat_sound", next ? "1" : "0"); } catch {}
      if (next) chatPing(0.06);
      return next;
    });
  }

  function insertSmile(code) {
    setInput(v => v + (v && !v.endsWith(" ") ? " " : "") + code + " ");
    inputRef.current?.focus();
  }

  const enterRoom = useCallback(async(slug)=>{
    setLoading(true);
    try{
      const room=rooms.find(r=>r.slug===slug);if(!room)return;
      const r=await fetch(`${API}/api/chat/rooms/${slug}/messages`,{headers:{Authorization:`Bearer ${token}`}});
      const d=await r.json();
      if(!d.ok){
        if(d.error==="Sin acceso a este room") alert("Necesitás comprar acceso a esta sala");
        else alert(d.error);
        return;
      }
      if(activeRoom) socket?.emit("leave_room",{slug:activeRoom.slug});
      setActiveRoom(room);setMessages(d.messages||[]);setOnlineUsers([]);
      socket?.emit("join_room",{slug});
      setTimeout(()=>inputRef.current?.focus(),100);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[rooms,activeRoom,socket,token]);

  const joinRoom=async(room)=>{
    setJoining(room.id);
    try{
      const r=await fetch(`${API}/api/chat/rooms/${room.slug}/join`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"}});
      const d=await r.json();
      if(d.ok){setRooms(prev=>prev.map(ro=>ro.id===room.id?{...ro,has_access:true}:ro));enterRoom(room.slug);}
      else alert(d.error);
    }finally{setJoining(null);}
  };

  const sendMessage=()=>{
    const raw=input.trim();if(!raw||!activeRoom||!socket)return;
    const msg=replaceSmiles(raw);
    socket.emit("send_message",{slug:activeRoom.slug,message:msg});
    setInput("");setShowSmiles(false);
  };

  const deleteMessage=async(id)=>{
    await fetch(`${API}/api/chat/messages/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
    setMessages(prev=>prev.filter(m=>m.id!==id));
  };

  const assignRole=async(user,role)=>{
    await fetch(`${API}/api/chat/rooms/${activeRoom?.slug}/role`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({user_id:user.user_id,role})});
    setOnlineUsers(prev=>prev.map(u=>u.user_id===user.user_id?{...u,chat_role:role}:u));
  };

  const kickUser=(user)=>{socket?.emit("kick_user",{slug:activeRoom?.slug,target_user_id:user.user_id});setOnlineUsers(prev=>prev.filter(u=>u.user_id!==user.user_id));};

  const acceptFriend=async(user)=>{
    const r=await fetch(`${API}/api/chat/friends/${user.user_id}/accept`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"}});
    const d=await r.json();
    if(d.ok)setFriends(prev=>prev.map(f=>f.other_id===user.user_id?{...f,status:"accepted"}:f));
  };

  const rejectFriend=async(user)=>{
    await fetch(`${API}/api/chat/friends/${user.user_id}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});
    setFriends(prev=>prev.filter(f=>f.other_id!==user.user_id));
  };

  const handleUserClick=(user)=>{
    if(!user) return;
    // Normalizar user_id a numero
    const uid = Number(user.user_id || user.id || 0);
    if(!uid) return;
    const normalUser = {...user, user_id: uid};
    const isOwn = uid === currentUser?.id;
    setSelectedUser(isOwn ? {...normalUser,...currentProfile,user_id:currentUser.id,user_name:currentUser.name,user_role:currentUser.role} : normalUser);
  };

  const premiumRooms = rooms.filter(r=>r.slug!=="general");
  const [isMobile] = useState(() => window.innerWidth <= 768);
  const [mobileView, setMobileView] = useState("chat"); // "rooms" | "chat" | "users"
  const pendingFriends = friends.filter(f=>f.status==="pending");

  return (
    <>
    <style>{`
      @keyframes xatMsgIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
      .xat-msg{animation:xatMsgIn .25s cubic-bezier(.2,.8,.2,1) both}
      @keyframes xatSysIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
      .xat-sys{animation:xatSysIn .35s cubic-bezier(.34,1.56,.64,1) both}
      @keyframes xatPanelIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
      .xat-panel{animation:xatPanelIn .22s cubic-bezier(.2,.8,.2,1)}
      .xat-smile-btn{transition:transform .15s,background .15s}
      .xat-smile-btn:hover{transform:scale(1.18) translateY(-2px);background:rgba(var(--brand-primary-rgb),.1)!important}
      .xat-icon-btn{transition:all .2s;cursor:pointer;display:flex;align-items:center;justify-content:center;border:1px solid transparent}
      .xat-icon-btn:hover{background:rgba(var(--brand-primary-rgb),.08)!important;border-color:rgba(var(--brand-primary-rgb),.2)!important;color:#c8f53a!important}
      .xat-welcome{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:50;pointer-events:none;animation:xatWelIn .5s cubic-bezier(.34,1.56,.64,1) both,xatWelOut .4s ease 4s forwards}
      @keyframes xatWelIn{from{opacity:0;transform:translateX(-50%) translateY(-12px) scale(.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
      @keyframes xatWelOut{to{opacity:0;transform:translateX(-50%) translateY(-8px) scale(.95)}}

      /* ── MOBILE FIXES ChatPage ── */
      @media(max-width:768px){
        .xc-header{padding:10px 12px!important;gap:8px!important;flex-wrap:wrap!important}
        .xc-header-eye{display:none!important}
        .xc-room-icon{font-size:18px!important}
        .xc-room-name{font-size:18px!important;letter-spacing:2px!important}
        .xc-online-badge{padding:3px 8px!important;font-size:8px!important}
        .xc-pending-badge{font-size:9px!important;padding:3px 8px!important;margin-left:auto!important}
        .xc-sound,.xc-powers{padding:5px 10px!important;font-size:10px!important;letter-spacing:1.5px!important;height:28px!important}
        .xc-hints{display:none!important}
        .xc-input-wrap{padding:8px 10px!important}
        .xc-pmodal{width:100%!important;max-width:100%!important;height:100vh!important;max-height:100vh!important;border-radius:0!important}
        .xc-room-pill{font-size:10px!important;padding:4px 8px!important}
      }
      .xc-pmodal{max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch}
    `}</style>
    <div style={{ height:"calc(100vh - 64px)", background:"#060d1a", display:"flex", justifyContent:"center", padding: isMobile ? "0" : "16px" }}>
      <div style={{ width:"100%", maxWidth:1200, display:"flex", height:"100%", borderRadius: isMobile ? 0 : 16, overflow:"hidden", border: isMobile ? "none" : "1px solid #0d1424", flexDirection:"column" }}>

      {/* ── MOBILE NAV TABS ── */}
      {isMobile && (
        <div style={{ display:"flex", background:"#08101e", borderBottom:"1px solid #0d1424", flexShrink:0 }}>
          {[["rooms","🏠 Salas"],["chat","💬 Chat"],["users","👥 Users"]].map(([v,l]) => (
            <button key={v} onClick={()=>setMobileView(v)}
              style={{ flex:1, padding:"12px 4px", border:"none", cursor:"pointer", fontSize:12, fontWeight:800,
                background: mobileView===v ? `${accent}18` : "transparent",
                color: mobileView===v ? accent : "#334155",
                borderBottom: mobileView===v ? `2px solid ${accent}` : "2px solid transparent" }}>
              {l}
            </button>
          ))}
        </div>
      )}

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

      {/* ── PANEL PRIVADO ────────────────────────────────────────────────────── */}
      {privateChat && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <PrivateChatPanel targetUser={privateChat} currentUser={currentUser} socket={socket} token={token} onClose={()=>setPrivateChat(null)} />
        </div>
      )}

      {/* ── CHAT PRINCIPAL ───────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:isMobile&&mobileView!=="chat"?"none":"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

        {/* Header sala activa — editorial */}
        <div className="xc-header" style={{ padding:"14px 18px", borderBottom:`1px solid ${accent}15`, display:"flex", alignItems:"center", gap:14, flexShrink:0, background:"linear-gradient(135deg,#08101e 0%,#04060d 100%)", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,${accent},transparent)` }}/>
          <span className="xc-room-icon" style={{ fontSize:22, filter:`drop-shadow(0 0 10px ${accent}66)` }}>{activeRoom ? ROOM_META[activeRoom.slug]?.icon : "🪙"}</span>
          <div style={{ display:"flex", flexDirection:"column", lineHeight:1 }}>
            <div className="xc-header-eye" style={{ fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:"2.5px", textTransform:"uppercase", color:"rgba(var(--brand-primary-rgb),.4)", marginBottom:4 }}>Sala activa</div>
            <div className="xc-room-name" style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:"3px", color:"#f0ece3", textTransform:"uppercase" }}>{activeRoom?.name || "Cargando…"}</div>
          </div>
          <div className="xc-online-badge" style={{ display:"inline-flex", alignItems:"center", gap:6, marginLeft:8, padding:"4px 10px", background:"rgba(34,197,94,.06)", border:"1px solid rgba(34,197,94,.2)", fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:"2px", color:"#22c55e" }}>
            <span style={{ width:6,height:6,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e" }}/>
            {onlineUsers.length} online
          </div>
          {pendingFriends.length>0 && (
            <div className="xc-pending-badge" style={{ marginLeft:"auto", background:"rgba(245,158,11,.08)", border:"1px solid rgba(245,158,11,.25)", padding:"5px 12px", color:"#f59e0b", fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"1.5px", fontWeight:500, cursor:"pointer", textTransform:"uppercase" }}>
              🔔 {pendingFriends.length} solicitud{pendingFriends.length>1?"es":""}
            </div>
          )}
          <button onClick={toggleSound} title={soundOn?"Sonido activo":"Sonido apagado"}
            className="xat-icon-btn xc-sound"
            style={{ marginLeft:pendingFriends.length>0?"8px":"auto", background:soundOn?`${accent}14`:"transparent", border:`1px solid ${soundOn?accent+"40":"rgba(240,236,227,.12)"}`, padding:"6px 12px", color:soundOn?accent:"rgba(240,236,227,.4)", fontSize:14, height:30, lineHeight:1 }}>
            {soundOn?"🔔":"🔕"}
          </button>
          <button onClick={()=>setShowPowers(v=>!v)} className="xc-powers" style={{ background:showPowers?`${accent}14`:"transparent", border:`1px solid ${showPowers?accent+"40":"rgba(240,236,227,.12)"}`, padding:"6px 14px", color:showPowers?accent:"rgba(240,236,227,.55)", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:800, letterSpacing:"2px", textTransform:"uppercase", transition:"all .25s" }}>⚡ Powers</button>
        </div>

        {/* Mensajes */}
        <div style={{ flex:1,overflowY:"auto",padding:"8px 0",display:"flex",flexDirection:"column",position:"relative" }}>
          {/* Welcome banner xat-style */}
          {showWelcome && activeRoom && (
            <div key={"w-"+activeRoom.slug} className="xat-welcome">
              <div style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 18px",background:`linear-gradient(135deg,${accent}18,rgba(7,12,24,.95))`,border:`1px solid ${accent}40`,boxShadow:`0 12px 40px ${accent}22`,backdropFilter:"blur(12px)" }}>
                <span style={{ fontSize:18,filter:`drop-shadow(0 0 8px ${accent})` }}>{ROOM_META[activeRoom.slug]?.icon||"🪙"}</span>
                <div>
                  <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",color:accent,textTransform:"uppercase" }}>Bienvenido a</div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:"3px",color:"#f0ece3",textTransform:"uppercase",lineHeight:1 }}>{activeRoom.name}</div>
                </div>
              </div>
            </div>
          )}
          {showPowers ? (
            <PowersInline token={token} />
          ) : loading ? (
            <div style={{ textAlign:"center",color:"#1e293b",marginTop:40,fontSize:13 }}>Cargando...</div>
          ) : messages.length===0 ? (
            <div style={{ textAlign:"center",marginTop:60 }}>
              <div style={{ fontSize:40,marginBottom:8 }}>{ROOM_META[activeRoom?.slug]?.icon||"🪙"}</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:"4px",color:"#475569",marginBottom:6 }}>SILENCIO ABSOLUTO</div>
              <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,color:"#1e293b",letterSpacing:"2px",textTransform:"uppercase" }}>Sé el primero · Tipeá :) (L) (fire)</div>
            </div>
          ) : (<>
            <SystemMessage icon="🚪" text={`ESTÁS EN ${activeRoom?.name||"el chat"} · sé respetuoso`} accent={accent} />
            {messages.map(msg=>(
              <Message key={msg.id} msg={msg} currentUserId={currentUser?.id} isAdmin={isAdmin} onDelete={deleteMessage} onClick={handleUserClick} customEmojis={customEmojis} />
            ))}
          </>)}
          <div ref={messagesEndRef} />
        </div>

        {/* Smile picker (xat-style) */}
        {!showPowers && showSmiles && (
          <SmilePicker
            accent={accent}
            customEmojis={customEmojisList}
            onPickSmile={insertSmile}
            onPickCustom={(key)=>insertSmile(`:${key}:`)}
            onClose={()=>setShowSmiles(false)}
          />
        )}

        {/* Input */}
        {!showPowers && (
          <div style={{ padding:"10px 12px",borderTop:`1px solid #0d1424`,flexShrink:0,background:"#08101e" }}>
            <div style={{ display:"flex",gap:6,alignItems:"center",background:"#0d1424",border:`1px solid ${showSmiles?accent+"55":accent+"18"}`,borderRadius:10,padding:"4px 4px 4px 6px",transition:"border-color .25s" }}>
              <button onClick={()=>setShowSmiles(v=>!v)} title="Smiles" className="xat-icon-btn"
                style={{ width:34,height:34,borderRadius:8,background:showSmiles?`${accent}18`:"transparent",border:"none",color:showSmiles?accent:"#94a3b8",fontSize:18,flexShrink:0 }}>
                😊
              </button>
              <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
                placeholder={`Escribí en ${activeRoom?.name||"el chat"}...`} maxLength={1000}
                style={{ flex:1,background:"none",border:"none",color:"#e2e8f0",fontSize:13.5,outline:"none",padding:"6px 4px" }} />
              <Pop as="button" onClick={sendMessage} disabled={!input.trim()}
                style={{ background:input.trim()?accent:"#1a2540",color:input.trim()?"#000":"#334155",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:800,cursor:input.trim()?"pointer":"default",fontSize:13,flexShrink:0 }}>→</Pop>
            </div>
            <div className="xc-hints" style={{ marginTop:6,fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:"1.5px",color:"#334155",textTransform:"uppercase",display:"flex",gap:10,flexWrap:"wrap" }}>
              <span>:) → 😊</span><span>(L) → 🪙</span><span>(fire) → 🔥</span><span>{`<3 → ❤️`}</span><span>(crown) → 👑</span>
            </div>
          </div>
        )}
      </div>

      {/* ── PANEL DERECHO ────────────────────────────────────────────────────── */}
      <div style={{ width:isMobile?"100%":200, borderLeft:isMobile?"none":"1px solid #0d1424", display:isMobile&&mobileView==="chat"?"none":"flex", flexDirection:"column",background:"#070c18",flexShrink:0 }}>

        {/* Salas premium */}
        <div style={{ borderBottom:"1px solid #0d1424",padding:"8px 6px" }}>
          <div style={{ fontSize:9,color:"#1e293b",fontWeight:700,letterSpacing:1,textTransform:"uppercase",padding:"0 6px 6px" }}>Salas</div>
          {/* Sala principal */}
          <div onClick={()=>enterRoom("general")}
            style={{ display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,cursor:"pointer",background:activeRoom?.slug==="general"?"rgba(var(--brand-primary-rgb),0.08)":"transparent",border:activeRoom?.slug==="general"?"1px solid rgba(var(--brand-primary-rgb),0.15)":"1px solid transparent",marginBottom:3 }}>
            <span style={{ fontSize:14 }}>💬</span>
            <span style={{ fontSize:11,fontWeight:700,color:activeRoom?.slug==="general"?"var(--brand-primary, #c8f53a)":"#64748b" }}>Sala general</span>
          </div>
          {/* Salas premium */}
          {premiumRooms.map(room=>{
            const meta = ROOM_META[room.slug]||{accent:"#c8f53a",icon:"💬"};
            const isActive = activeRoom?.slug===room.slug;
            const hasAccess = room.has_access || room.coins_required===0;
            return (
              <div key={room.id}
                onClick={()=> hasAccess ? enterRoom(room.slug) : joinRoom(room)}
                style={{ display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:7,cursor:"pointer",background:isActive?`${meta.accent}15`:"transparent",border:isActive?`1px solid ${meta.accent}25`:"1px solid transparent",marginBottom:3,opacity:hasAccess?1:0.6 }}>
                <span style={{ fontSize:14 }}>{meta.icon}</span>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:11,fontWeight:700,color:isActive?meta.accent:"#475569",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{room.name}</div>
                  {!hasAccess && <div style={{ fontSize:9,color:"#334155" }}>🔒 {room.coins_required} 🪙</div>}
                </div>
                {joining===room.id && <span style={{ fontSize:9,color:"#334155" }}>...</span>}
              </div>
            );
          })}
        </div>

        {/* Amigos */}
        {friends.filter(f=>f.status==="accepted").length>0 && (
          <div style={{ borderBottom:"1px solid #0d1424",padding:"8px 6px" }}>
            <div style={{ fontSize:9,color:"#1e293b",fontWeight:700,letterSpacing:1,textTransform:"uppercase",padding:"0 6px 6px" }}>Amigos</div>
            {friends.filter(f=>f.status==="accepted").map(f=>(
              <div key={f.other_id} onClick={()=>setPrivateChat({user_id:f.other_id,user_name:f.other_name,name_color:f.name_color,nickname:f.nickname})}
                style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:7,cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.background="#0f172a"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Avatar name={f.other_name} size={20} color={f.name_color||"#c8f53a"} />
                <span style={{ fontSize:11,color:f.name_color||"#64748b",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>{f.other_name}</span>
                <span style={{ fontSize:9 }}>💬</span>
              </div>
            ))}
          </div>
        )}

        {/* Solicitudes pendientes */}
        {pendingFriends.length>0 && (
          <div style={{ borderBottom:"1px solid #0d1424",padding:"8px 6px" }}>
            <div style={{ fontSize:9,color:"#f59e0b",fontWeight:700,letterSpacing:1,textTransform:"uppercase",padding:"0 6px 6px" }}>🔔 Solicitudes</div>
            {pendingFriends.map(f=>(
              <div key={f.other_id} style={{ padding:"4px 8px",marginBottom:4 }}>
                <div style={{ fontSize:11,color:"#e2e8f0",fontWeight:700,marginBottom:4 }}>{f.other_name}</div>
                <div style={{ display:"flex",gap:4 }}>
                  <button onClick={()=>acceptFriend({user_id:f.other_id,user_name:f.other_name})} style={{ flex:1,background:"#22c55e18",border:"1px solid #22c55e33",borderRadius:5,padding:"3px",color:"#22c55e",fontSize:10,cursor:"pointer",fontWeight:700 }}>✓</button>
                  <button onClick={()=>rejectFriend({user_id:f.other_id})} style={{ flex:1,background:"#ef444418",border:"1px solid #ef444433",borderRadius:5,padding:"3px",color:"#ef4444",fontSize:10,cursor:"pointer",fontWeight:700 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Usuarios online */}
        <div style={{ flex:1,overflowY:"auto",padding:"8px 6px" }}>
          <div style={{ fontSize:9,color:"#1e293b",fontWeight:700,letterSpacing:1,textTransform:"uppercase",padding:"0 6px 6px" }}>Online — {onlineUsers.length}</div>
          {onlineUsers.map(u=>{
            const isOwn=u.user_id===currentUser?.id;
            const isStaff=["admin","operator"].includes(u.user_role);
            const avatarColor=u.name_color||(isStaff?"#ef4444":"#c8f53a");
            const pawn=getPawn(u);
            return (
              <div key={u.user_id} onClick={()=>handleUserClick(u)}
                style={{ display:"flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:7,cursor:"pointer",background:isOwn?"rgba(200,245,58,0.05)":"transparent" }}
                onMouseEnter={e=>e.currentTarget.style.background=isOwn?"rgba(200,245,58,0.08)":"#0f172a"}
                onMouseLeave={e=>e.currentTarget.style.background=isOwn?"rgba(200,245,58,0.05)":"transparent"}>
                <div style={{ position:"relative" }}>
                  <Avatar name={u.user_name} size={24} color={avatarColor} glow={!!u.name_glow} avatarKey={u.avatar_key} avatarUrl={u.avatar_url} />
                  <div style={{ position:"absolute",bottom:-1,right:-1,width:6,height:6,borderRadius:"50%",background:"#22c55e",border:"1.5px solid #070c18" }} />
                  {pawn && <span title={pawn.lbl} style={{ position:"absolute",top:-3,left:-4,fontSize:9,filter:`drop-shadow(0 0 3px ${pawn.c})`,pointerEvents:"none" }}>{pawn.ico}</span>}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}><UserName user={u} size={10} /></div>
                  {u.nickname && <div style={{ fontSize:9,color:u.nick_color||"#334155",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textShadow:u.nick_glow?`0 0 ${u.nick_glow}px ${u.nick_color||"#334155"}`:"none" }}>{u.nickname}</div>}
                </div>
                {isOwn && <span style={{ fontSize:8,color:"#c8f53a",opacity:0.4 }}>vos</span>}
              </div>
            );
          })}
          {onlineUsers.length===0 && <div style={{ padding:"4px 10px",color:"#1a2540",fontSize:11 }}>Nadie online</div>}
        </div>
      </div>
      </div>
    </div>
    </div>

    {/* Modal perfil - fuera del overflow para mobile */}
    {selectedUser && (
      <ProfileModal
        user={selectedUser} currentUser={currentUser} token={token} isAdmin={isAdmin}
        friends={friends} onClose={()=>setSelectedUser(null)}
        onPrivateChat={(u)=>{setSelectedUser(null);setPrivateChat(u);}}
        onAddFriend={async(u)=>{
          const r=await fetch(`${API}/api/chat/friends/${u.user_id}/request`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"}});
          const d=await r.json();
          if(d.ok)setFriends(prev=>[...prev,{other_id:u.user_id,other_name:u.user_name,status:"pending"}]);
          else alert(d.error);
        }}
        onAccept={(u)=>{acceptFriend(u);setSelectedUser(null);}}
        onReject={(u)=>{rejectFriend(u);setSelectedUser(null);}}
        onAssignRole={assignRole} onKick={kickUser}
        chatPowersOwned={chatPowersOwned} currentProfile={currentProfile}
        onSaved={(cfg)=>{setCurrentProfile(prev=>({...prev,...cfg}));setSelectedUser(null);}}
      />
    )}
    </>
  );
}
