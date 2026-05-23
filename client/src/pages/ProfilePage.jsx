import "./ProfilePage.css";
import Topbar from "../components/Topbar.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { Pop, FadeUp, Pulse, Jumbo, CountUp } from "../components/MotionPop.jsx";
import StoryViewer from "../components/StoryViewer.jsx";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";
import { UserNameHeader } from "../components/UserName.jsx";
import ProfileStudio from "./ProfileStudio.jsx";
import { BannerCanvas, BadgePreview } from "./ProfileStudio.jsx";
import ConnectedDevicesPanel from "../components/ConnectedDevicesPanel";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const RARITY = {
  common:    { label:"Común",      color:"#ede9e0", bg:"rgba(237,233,224,.08)", border:"rgba(237,233,224,.15)" },
  rare:      { label:"Raro",       color:"#60a5fa", bg:"rgba(96,165,250,.08)",  border:"rgba(96,165,250,.25)"  },
  epic:      { label:"Épico",      color:"#a78bfa", bg:"rgba(167,139,250,.08)", border:"rgba(167,139,250,.25)" },
  legendary: { label:"Legendario", color:"var(--brand-primary, #f5e03a)", bg:"rgba(var(--brand-primary-rgb),.08)",  border:"rgba(var(--brand-primary-rgb),.3)"   },
};
const LEVEL = {
  bronze: { label:"Bronce", color:"#CD7F32", bg:"rgba(205,127,50,.12)",   icon:"🥉" },
  silver: { label:"Plata",  color:"#C0C0C0", bg:"rgba(192,192,192,.12)", icon:"🥈" },
  gold:   { label:"Oro",    color:"var(--brand-primary, #f5e03a)", bg:"rgba(var(--brand-primary-rgb),.12)",   icon:"🥇" },
};
// Sprint 11: achievements basados en stats sociales reales (posts/likes/
// friends/days_active). Cada condition recibe (stats, totalCoinsEarned).
const ACHIEVEMENTS = [
  { key:"ach_first_post", icon:"🎯", name:"Primer Post",  desc:"Publicaste tu primer post",         condition:(s)=>s.posts>=1,        reward:0,    rarity:"common"    },
  { key:"ach_x5_posts",   icon:"📰", name:"Activo",       desc:"5 posts publicados",                condition:(s)=>s.posts>=5,        reward:50,   rarity:"common"    },
  { key:"ach_x25_posts",  icon:"📣", name:"Comunicador",  desc:"25 posts publicados",               condition:(s)=>s.posts>=25,       reward:300,  rarity:"epic"      },
  { key:"ach_friends10",  icon:"👥", name:"Conector",     desc:"10 amigos en la comunidad",         condition:(s)=>s.friends>=10,     reward:100,  rarity:"rare"      },
  { key:"ach_friends50",  icon:"🌐", name:"Influencer",   desc:"50 amigos en la comunidad",         condition:(s)=>s.friends>=50,     reward:500,  rarity:"epic"      },
  { key:"ach_likes100",   icon:"❤️", name:"Querido",      desc:"100 likes recibidos en tus posts",  condition:(s)=>s.likes>=100,      reward:200,  rarity:"rare"      },
  { key:"ach_loyal30",    icon:"💛", name:"Leal",         desc:"30 días en la comunidad",           condition:(s)=>s.days_active>=30, reward:0,    rarity:"common"    },
  { key:"ach_veteran365",  icon:"🏆", name:"Veterano",    desc:"1 año en la comunidad",             condition:(s)=>s.days_active>=365,reward:1000, rarity:"legendary" },
  { key:"ach_coins500",    icon:"🪙", name:"Acumulador",  desc:"500+ Coins ganados en total",       condition:(s,c)=>c>=500,          reward:0,    rarity:"rare"      },
];

const BADGE_CONFIG = {
  badge_beta: {
    label:"BETA", emoji:"⚡",
    glowColor:"#06b6d455", glowColor2:"#06b6d411",
    wrapStyle:{ background:"linear-gradient(135deg,rgba(6,182,212,.15),rgba(0,255,255,.08))", border:"1px solid rgba(6,182,212,.4)" },
    textGrad:"linear-gradient(90deg,#06b6d4,#22d3ee,#67e8f9,#22d3ee,#06b6d4)",
    animDur:"2.5s", scanline:true,
    tt:{ name:"Beta Tester", rarity:"✦ EXCLUSIVO", desc:"Adoptador temprano del portal. Estuvo desde los primeros días del sistema.", footer:"Solo por invitación · No disponible", nameColor:"#22d3ee", rarityColor:"#06b6d4", borderColor:"rgba(6,182,212,.3)", iconBg:"rgba(6,182,212,.15)", iconBorder:"rgba(6,182,212,.25)" },
  },
  badge_creator: {
    label:"CREATOR", emoji:"🌿",
    glowColor:"var(--brand-primary, #f5e03a)55", glowColor2:"var(--brand-primary, #f5e03a)11",
    holographic:true,
    textGrad:"linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a),#ff8c00,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))",
    animDur:"2s", particles:true,
    tt:{ name:"Creator", rarity:"✦ LEGENDARIO", desc:"Contribuidor activo de la comunidad. Crea contenido y ayuda a otros miembros de la comunidad.", footer:"Otorgado por el equipo del portal", nameColor:"var(--brand-primary, #f5e03a)", rarityColor:"var(--brand-primary, #f5e03a)", borderColor:"rgba(var(--brand-primary-rgb),.35)", iconBg:"rgba(var(--brand-primary-rgb),.15)", iconBorder:"rgba(var(--brand-primary-rgb),.3)" },
  },
  badge_legendary: {
    label:"LEGENDARIO", emoji:"✦",
    glowColor:"#8b5cf655", glowColor2:"#8b5cf611",
    wrapStyle:{ background:"linear-gradient(135deg,rgba(139,92,246,.18),rgba(167,139,250,.1),rgba(196,181,253,.06))", border:"1px solid rgba(139,92,246,.4)" },
    textGrad:"linear-gradient(90deg,#a78bfa,#c4b5fd,#ddd6fe,#c4b5fd,#a78bfa)",
    animDur:"3s", rings:true,
    tt:{ name:"Legendario", rarity:"✦ EPICO", desc:"El rango mas alto de la comunidad. Miembro elite con historial destacado en la comunidad.", footer:"Desbloqueado por actividad y volumen", nameColor:"#c4b5fd", rarityColor:"#a78bfa", borderColor:"rgba(139,92,246,.32)", iconBg:"rgba(139,92,246,.15)", iconBorder:"rgba(139,92,246,.28)" },
  },
  badge_mod: {
    label:"MOD", emoji:"🛡️",
    glowColor:"#22c55e44", glowColor2:"#22c55e11",
    wrapStyle:{ background:"linear-gradient(135deg,rgba(34,197,94,.14),rgba(16,185,129,.08))", border:"1px solid rgba(34,197,94,.38)" },
    textGrad:"linear-gradient(90deg,#22c55e,#4ade80,#86efac,#4ade80,#22c55e)",
    animDur:"2.8s", matrix:true,
    tt:{ name:"Moderador", rarity:"✦ STAFF", desc:"Parte del equipo de moderación oficial de la comunidad del portal.", footer:"Solo moderadores · Staff oficial", nameColor:"#4ade80", rarityColor:"#22c55e", borderColor:"rgba(34,197,94,.3)", iconBg:"rgba(34,197,94,.14)", iconBorder:"rgba(34,197,94,.25)" },
  },
  badge_bot: {
    label:"BOT", emoji:"🤖",
    glowColor:"#ec489944", glowColor2:"#ec489911",
    wrapStyle:{ background:"linear-gradient(135deg,rgba(236,72,153,.15),rgba(244,114,182,.08))", border:"1px solid rgba(236,72,153,.38)" },
    textGrad:"linear-gradient(90deg,#ec4899,#f472b6,#fbcfe8,#f472b6,#ec4899)",
    animDur:"2s", spinIcon:true,
    tt:{ name:"Bot Oficial", rarity:"✦ SISTEMA", desc:"Cuenta automática del sistema del portal. Gestiona notificaciones y automatizaciones.", footer:"Cuenta del sistema · Automático", nameColor:"#f472b6", rarityColor:"#ec4899", borderColor:"rgba(236,72,153,.3)", iconBg:"rgba(236,72,153,.14)", iconBorder:"rgba(236,72,153,.25)" },
  },
};

function PremiumBadge({ badgeKey, name, emoji, fallbackColor="var(--brand-primary, #f5e03a)" }) {
  const [hover, setHover] = useState(false);
  const [parts, setParts] = useState([]);
  const cfg = BADGE_CONFIG[badgeKey];

  useEffect(() => {
    if (!cfg?.particles) return;
    const iv = setInterval(() => {
      setParts(prev => {
        const np = Array.from({length:3},(_,i)=>({
          id:Date.now()+i,
          x:15+Math.random()*70, y:15+Math.random()*70,
          color:["var(--brand-primary, #f5e03a)","var(--brand-primary, #f5e03a)","var(--brand-accent, #ff5500)"][Math.floor(Math.random()*3)],
          tx:(Math.random()-.5)*50, ty:(Math.random()-.5)*50,
          sz:2+Math.random()*2.5, dl:Math.random()*.8,
        }));
        return [...prev.filter(p=>Date.now()-p.id<2000),...np];
      });
    }, 600);
    return ()=>clearInterval(iv);
  }, [cfg]);

  if (!cfg) return (
    <div style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"4px 12px",borderRadius:100,background:`${fallbackColor}15`,border:`1px solid ${fallbackColor}30`,color:fallbackColor,fontSize:9,fontWeight:900,letterSpacing:"1.5px",textTransform:"uppercase" }}>
      {emoji} {name}
    </div>
  );

  const { tt } = cfg;
  const baseWrap = cfg.holographic
    ? { position:"relative" }
    : { ...cfg.wrapStyle };

  return (
    <div
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        display:"inline-flex",alignItems:"center",gap:8,borderRadius:100,padding:"7px 16px 7px 10px",
        position:"relative",cursor:"pointer",transition:"transform .2s",
        transform:hover?"scale(1.08) translateY(-2px)":"scale(1)",
        animation:`badgeBreathe 3s ease-in-out infinite`,
        "--gc":cfg.glowColor,"--gc2":cfg.glowColor2,
        ...baseWrap,
      }}
    >
      {cfg.holographic && <>
        <div style={{ position:"absolute",inset:-1.5,borderRadius:100,background:"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a))",backgroundSize:"300% 300%",animation:"holographic 2s linear infinite",zIndex:0 }} />
        <div style={{ position:"absolute",inset:1.5,borderRadius:100,background:"linear-gradient(135deg,rgba(20,12,2,.92),rgba(30,18,2,.92))",zIndex:1 }} />
      </>}
      {cfg.scanline && (
        <div style={{ position:"absolute",inset:0,borderRadius:100,overflow:"hidden",pointerEvents:"none" }}>
          <div style={{ position:"absolute",width:"100%",height:"20%",background:"linear-gradient(180deg,transparent,rgba(6,182,212,.12),transparent)",animation:"scanline 2s linear infinite" }} />
        </div>
      )}
      {cfg.matrix && <div style={{ position:"absolute",inset:0,borderRadius:100,background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(34,197,94,.04) 2px,rgba(34,197,94,.04) 4px)",pointerEvents:"none" }} />}
      {cfg.rings && <>
        <div style={{ position:"absolute",inset:-6,borderRadius:100,border:"1.5px solid rgba(139,92,246,.3)",animation:"rippleOut 2s ease-out infinite",pointerEvents:"none" }} />
        <div style={{ position:"absolute",inset:-12,borderRadius:100,border:"1px solid rgba(139,92,246,.15)",animation:"rippleOut 2s ease-out infinite .7s",pointerEvents:"none" }} />
      </>}
      {cfg.particles && (
        <div style={{ position:"absolute",inset:0,borderRadius:100,pointerEvents:"none",overflow:"visible",zIndex:4 }}>
          {parts.map(p=>(
            <div key={p.id} style={{ position:"absolute",width:p.sz,height:p.sz,borderRadius:"50%",background:p.color,left:`${p.x}%`,top:`${p.y}%`,animation:`particleFly 2s ease-out forwards`,animationDelay:`${p.dl}s`,"--tx":`${p.tx}px`,"--ty":`${p.ty}px` }} />
          ))}
        </div>
      )}
      <div style={{ position:"absolute",inset:0,borderRadius:100,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)",backgroundSize:"300% 100%",animation:`badgeShimmer ${cfg.animDur} infinite`,zIndex:2,pointerEvents:"none" }} />
      <span style={{ fontSize:16,position:"relative",zIndex:3,display:"inline-block",transition:"transform .25s",transform:hover?"scale(1.2) rotate(-8deg)":"scale(1)",animation:cfg.spinIcon?"iconSpin 4s ease-in-out infinite":undefined }}>
        {cfg.emoji}
      </span>
      <span style={{ fontSize:9,fontWeight:900,letterSpacing:"2px",textTransform:"uppercase",position:"relative",zIndex:3,background:cfg.textGrad,backgroundSize:"300% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:`badgeShimmer ${cfg.animDur} infinite` }}>
        {cfg.label}
      </span>
      {tt && (
        <div style={{ position:"absolute",top:"calc(100% + 14px)",left:"50%",transform:hover?"translateX(-50%) translateY(0) scale(1)":"translateX(-50%) translateY(-6px) scale(.95)",width:210,background:"#0d1124",borderRadius:16,padding:14,border:`1px solid ${tt.borderColor}`,boxShadow:`0 20px 60px rgba(0,0,0,.85),0 0 40px ${cfg.glowColor}`,opacity:hover?1:0,transition:"opacity .18s ease,transform .18s ease",pointerEvents:"none",zIndex:9999,whiteSpace:"normal" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:8 }}>
            <div style={{ width:34,height:34,borderRadius:10,background:tt.iconBg,border:`1px solid ${tt.iconBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,animation:"float 3s ease-in-out infinite" }}>{cfg.emoji}</div>
            <div>
              <div style={{ fontSize:13,fontWeight:800,color:tt.nameColor,marginBottom:2 }}>{tt.name}</div>
              <div style={{ fontSize:7,fontWeight:900,letterSpacing:"2px",textTransform:"uppercase",color:tt.rarityColor }}>{tt.rarity}</div>
            </div>
          </div>
          <div style={{ fontSize:10,color:"rgba(255,255,255,.45)",lineHeight:1.6,marginBottom:8 }}>{tt.desc}</div>
          <div style={{ fontSize:8,fontWeight:900,letterSpacing:"1.5px",textTransform:"uppercase",color:tt.rarityColor,borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:6 }}>{tt.footer}</div>
          <div style={{ position:"absolute",top:-6,left:"50%",transform:"translateX(-50%)",width:12,height:6,overflow:"hidden" }}>
            <div style={{ position:"absolute",width:10,height:10,bottom:-5,left:1,transform:"rotate(45deg)",background:"#0d1124",border:`1px solid ${tt.borderColor}` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, owned, equipped, onBuy, onEquip, loading, readOnly }) {
  const [hover, setHover] = useState(false);
  const r = RARITY[item.rarity] || RARITY.common;
  const d = item.data || {};
  return (
    <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} style={{ background:owned?r.bg:"rgba(255,255,255,.02)",border:`1px solid ${owned?r.border:"rgba(237,233,224,.07)"}`,borderRadius:15,padding:"14px 13px",position:"relative",overflow:"hidden",transition:"all .25s",transform:hover?"translateY(-4px)":"none",boxShadow:hover?`0 14px 42px rgba(0,0,0,.45)`:owned?`0 0 20px ${r.border}22`:"none",opacity:owned?1:0.65 }}>
      {owned && <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${r.color},transparent)` }} />}
      <div style={{ position:"absolute",top:9,right:9,fontSize:7,fontWeight:900,letterSpacing:"1.5px",textTransform:"uppercase",padding:"2px 7px",borderRadius:100,background:r.bg,border:`1px solid ${r.border}`,color:r.color }}>{r.label}</div>
      <div style={{ fontSize:30,display:"block",margin:"6px 0 9px",textAlign:"center",animation:"float 3s ease-in-out infinite" }}>{d.emoji||item.emoji||"⭐"}</div>
      <div style={{ fontSize:11,fontWeight:800,color:"#e2e8f0",marginBottom:2,letterSpacing:".3px" }}>{item.name}</div>
      {item.description && <div style={{ fontSize:9,color:"rgba(255,255,255,.3)",lineHeight:1.4,marginBottom:10 }}>{item.description}</div>}
      {item.type==="title"&&d.color&&<div style={{ fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:d.color,marginBottom:10 }}>— {item.name} —</div>}
      {!readOnly && (owned ? (
        <button onClick={()=>onEquip(item)} style={{ width:"100%",height:28,fontSize:8,fontWeight:900,letterSpacing:"1px",textTransform:"uppercase",background:equipped?"rgba(var(--brand-accent-rgb),.12)":"rgba(255,255,255,.05)",border:`1px solid ${equipped?"rgba(var(--brand-accent-rgb),.28)":"rgba(255,255,255,.1)"}`,color:equipped?"var(--brand-accent, #ff8c2a)":"rgba(255,255,255,.45)",borderRadius:8,cursor:"pointer",transition:"all .2s" }}>
          {equipped?"Desequipar":"Equipar"}
        </button>
      ) : (
        <button onClick={()=>onBuy(item)} disabled={loading===item.key} style={{ width:"100%",height:28,fontSize:8,fontWeight:900,letterSpacing:"1px",textTransform:"uppercase",background:item.cost_coins===0?"rgba(34,197,94,.1)":"var(--brand-primary, #f5e03a)",border:"none",color:item.cost_coins===0?"#22c55e":"#04060d",borderRadius:8,cursor:"pointer",opacity:loading===item.key?.6:1 }}>
          {loading===item.key?"...":item.cost_coins===0?"🎁 Gratis":"🪙 "+item.cost_coins.toLocaleString()}
        </button>
      ))}
    </div>
  );
}

function AchievementCard({ ach, unlocked, stats }) {
  const [hover, setHover] = useState(false);
  const r = RARITY[ach.rarity] || RARITY.common;
  // Sprint 11: progress bars sobre stats sociales reales.
  const pct = ach.key==="ach_x25_posts" ? Math.min(100, ((stats?.posts||0)/25)*100)
            : ach.key==="ach_friends50" ? Math.min(100, ((stats?.friends||0)/50)*100)
            : ach.key==="ach_likes100"  ? Math.min(100, ((stats?.likes||0)/100)*100)
            : ach.key==="ach_veteran365"? Math.min(100, ((stats?.days_active||0)/365)*100)
            : null;
  return (
    <div onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} style={{ background:unlocked?r.bg:"rgba(255,255,255,.02)",border:`1px solid ${unlocked?r.border:"rgba(237,233,224,.06)"}`,padding:18,position:"relative",overflow:"hidden",transition:"all .35s cubic-bezier(.2,.8,.2,1)",transform:hover?"translateY(-6px) scale(1.015)":"none",boxShadow:hover?(unlocked?`0 24px 60px rgba(0,0,0,.5),0 0 0 1px ${r.color}40,0 0 32px ${r.color}26`:"0 18px 48px rgba(0,0,0,.5)"):"none",opacity:unlocked?1:.6 }}>
      {unlocked&&<div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${r.color},${r.color}40,transparent)`,backgroundSize:"200% 100%",animation:hover?"shimmerBg 2s linear infinite":"none" }} />}
      {unlocked&&hover&&<div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 60% 100% at 50% 100%,${r.color}14,transparent 70%)`,pointerEvents:"none"}}/>}
      <div style={{ position:"absolute",top:10,right:10,fontFamily:"'Gotham', monospace",fontSize:8,fontWeight:500,letterSpacing:"1.5px",textTransform:"uppercase",padding:"3px 8px",background:r.bg,border:`1px solid ${r.border}`,color:r.color }}>{r.label}</div>
      <div style={{ fontSize:32,marginBottom:10,display:"inline-block",animation:unlocked?(hover?"iconSpin .9s ease,iconPop 4s ease-in-out infinite":"iconPop 4s ease-in-out infinite"):"float 4s ease-in-out infinite",filter:unlocked?`drop-shadow(0 0 12px ${r.color}55)`:"grayscale(.6) opacity(.5)",transition:"transform .3s" }}>{unlocked?ach.icon:"🔒"}</div>
      <div style={{ fontFamily:"'Gotham', sans-serif",fontSize:14,fontWeight:800,color:"#e2e8f0",marginBottom:5,letterSpacing:".5px",textTransform:"uppercase" }}>{ach.name}</div>
      <div style={{ fontSize:11,color:"rgba(255,255,255,.4)",lineHeight:1.55,marginBottom:12 }}>{ach.desc}</div>
      <div style={{ fontFamily:"'Gotham', monospace",fontSize:9,fontWeight:500,letterSpacing:"2px",color:unlocked?r.color:"rgba(255,255,255,.2)",textTransform:"uppercase",display:"flex",alignItems:"center",gap:6 }}>
        {unlocked?<>✦ Desbloqueado</>:<>{ach.reward>0?<>🪙 +{ach.reward}</>:"Bloqueado"}{pct!==null&&<span style={{marginLeft:"auto",color:"rgba(255,255,255,.45)"}}>{Math.floor(pct)}%</span>}</>}
      </div>
      {!unlocked&&pct!==null&&<div style={{ height:3,background:"rgba(255,255,255,.07)",overflow:"hidden",marginTop:10,position:"relative" }}><div style={{ height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${r.color},${r.color}88)`,boxShadow:`0 0 8px ${r.color}66`,transition:"width 1s cubic-bezier(.2,.8,.2,1)" }} /></div>}
    </div>
  );
}

function PhoneEditor({ profile, showToast }) {
  const initial = profile?.user?.phone || "";
  const [phone, setPhone] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(()=>{setPhone(initial);},[initial]);
  async function save() {
    if (phone === initial) return;
    setSaving(true);
    try {
      const r = await fetch(API+"/auth/setup-profile", {
        method:"POST",
        headers:{"Authorization":"Bearer "+getToken(),"Content-Type":"application/json"},
        body: JSON.stringify({ phone })
      });
      const d = await r.json();
      if (d.ok) showToast("✓ Teléfono actualizado", "#22c55e");
      else showToast("❌ "+d.error, "#ef4444");
    } catch { showToast("❌ Error de red", "#ef4444"); }
    finally { setSaving(false); }
  }
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.09)",borderRadius:10,padding:"6px 12px"}}>
      <span style={{color:"rgba(255,255,255,.3)",fontSize:13}}>📞</span>
      <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+54 9 11..." maxLength={20} style={{background:"none",border:"none",color:"#e2e8f0",fontFamily:"inherit",fontSize:13,fontWeight:700,outline:"none",width:140}} onKeyDown={e=>e.key==="Enter"&&save()}/>
      {phone!==initial&&<button onClick={save} disabled={saving} style={{background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",borderRadius:7,color:"#22c55e",fontSize:10,fontWeight:900,padding:"3px 10px",cursor:"pointer"}}>{saving?"...":"Guardar"}</button>}
    </div>
  );
}

function PrivacyToggle({ label, desc, icon, iconBg, iconBorder, value, onChange }) {
  return (
    <div onClick={onChange} style={{ display:"flex",alignItems:"center",padding:"15px 20px",borderBottom:"1px solid rgba(255,255,255,.04)",cursor:"pointer",transition:"background .2s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.02)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <div style={{ width:40,height:40,borderRadius:12,background:iconBg,border:`1px solid ${iconBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,marginRight:14 }}>{icon}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13,fontWeight:700,color:"#e2e8f0",marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:10,color:"rgba(255,255,255,.3)",lineHeight:1.4 }}>{desc}</div>
      </div>
      <div style={{ display:"flex",alignItems:"center",gap:10,flexShrink:0 }}>
        <span style={{ fontSize:9,fontWeight:800,letterSpacing:"1px",textTransform:"uppercase",color:value?"#22c55e":"rgba(255,255,255,.25)" }}>{value?"Visible":"Oculto"}</span>
        <div onClick={e=>{e.stopPropagation();onChange();}} style={{ width:46,height:24,borderRadius:100,position:"relative",cursor:"pointer",flexShrink:0,background:value?"rgba(var(--brand-primary-rgb),.22)":"rgba(255,255,255,.09)",border:`1px solid ${value?"rgba(var(--brand-primary-rgb),.38)":"rgba(255,255,255,.12)"}`,transition:"all .3s" }}>
          <div style={{ position:"absolute",top:3,borderRadius:"50%",width:16,height:16,left:value?23:3,background:value?"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))":"rgba(255,255,255,.35)",boxShadow:value?"0 0 10px rgba(var(--brand-primary-rgb),.5)":"none",transition:"all .3s cubic-bezier(.34,1.56,.64,1)" }} />
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, onDelete, isOwn }) {
  const [liked, setLiked] = useState(post.liked||false);
  const [likes, setLikes] = useState(post.likes||0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments||0);
  const API2 = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
  const getTok = () => localStorage.getItem("token")||sessionStorage.getItem("token");

  async function loadComments() {
    setLoadingComments(true);
    try {
      const res = await fetch(`${API2}/api/post/${post.id}/comments`, {headers:{Authorization:"Bearer "+getTok()}});
      const data = await res.json();
      if (data.ok) setComments(data.comments);
    } catch(e) {}
    setLoadingComments(false);
  }

  async function submitComment() {
    if (!commentInput.trim()) return;
    setSavingComment(true);
    try {
      const res = await fetch(`${API2}/api/post/${post.id}/comments`, {
        method:"POST",
        headers:{Authorization:"Bearer "+getTok(),"Content-Type":"application/json"},
        body: JSON.stringify({body: commentInput.trim()})
      });
      const data = await res.json();
      if (data.ok) {
        setComments(prev=>[...prev, data.comment]);
        setCommentCount(c=>c+1);
        setCommentInput("");
      }
    } catch(e) {}
    setSavingComment(false);
  }
  const TC = { text:{bg:"rgba(255,255,255,.06)",border:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)",label:"📝 POST"}, loot:{bg:"rgba(var(--brand-primary-rgb),.1)",border:"rgba(var(--brand-primary-rgb),.25)",color:"#fde047",label:"✦ LOOT"}, logro:{bg:"rgba(var(--brand-primary-rgb),.1)",border:"rgba(var(--brand-primary-rgb),.25)",color:"var(--brand-primary, #f5e03a)",label:"🏆 LOGRO"}, envio:{bg:"rgba(96,165,250,.1)",border:"rgba(96,165,250,.25)",color:"#93c5fd",label:"📦 ENVÍO"} };
  const tc = TC[post.type]||TC.text;
  return (
    <div style={{ background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",borderRadius:18,padding:18,position:"relative",overflow:"hidden",transition:"all .25s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.borderColor="rgba(255,255,255,.12)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.025)";e.currentTarget.style.borderColor="rgba(255,255,255,.07)";}}>
      <div style={{ display:"flex",alignItems:"center",gap:11,marginBottom:11 }}>
        <div style={{ width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#1a0820,#0a1825)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,border:"1.5px solid rgba(var(--brand-primary-rgb),.22)",flexShrink:0 }}>🪙</div>
        <div>
          <div style={{ fontSize:13,fontWeight:800,background:"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>{post.author||post.author_name||"ANON"}</div>
          <div style={{ fontSize:9,color:"rgba(255,255,255,.25)",marginTop:1 }}>{post.time||"ahora"} · {post.category||"Texto"}</div>
        </div>
        <div style={{ marginLeft:"auto",padding:"3px 9px",borderRadius:100,fontSize:8,fontWeight:900,letterSpacing:"1.5px",textTransform:"uppercase",background:tc.bg,border:`1px solid ${tc.border}`,color:tc.color }}>{tc.label}</div>
      </div>
      <div style={{ fontSize:12,color:"rgba(255,255,255,.65)",lineHeight:1.7,marginBottom:12 }} dangerouslySetInnerHTML={{__html:post.body}} />
      {post.lootItem&&(
        <div style={{ background:"linear-gradient(135deg,rgba(var(--brand-primary-rgb),.08),rgba(var(--brand-primary-rgb),.04))",border:"1px solid rgba(var(--brand-primary-rgb),.2)",borderRadius:12,padding:14,display:"flex",alignItems:"center",gap:14,marginBottom:12 }}>
          <div style={{ fontSize:28,animation:"float 3s ease-in-out infinite" }}>{post.lootItem.emoji}</div>
          <div>
            <div style={{ fontSize:13,fontWeight:800,color:"#fde047",marginBottom:2 }}>{post.lootItem.name}</div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,.4)" }}>{post.lootItem.desc}</div>
            {post.lootItem.rarity&&<div style={{ fontSize:7,fontWeight:900,letterSpacing:"1.5px",textTransform:"uppercase",color:"var(--brand-primary, #f5e03a)",marginTop:4,background:"rgba(var(--brand-primary-rgb),.1)",border:"1px solid rgba(var(--brand-primary-rgb),.25)",borderRadius:100,padding:"2px 8px",display:"inline-block" }}>{post.lootItem.rarity}</div>}
          </div>
        </div>
      )}
      <div style={{ display:"flex",alignItems:"center",gap:6,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.05)" }}>
        <button onClick={async()=>{
          const tok = localStorage.getItem("token")||sessionStorage.getItem("token");
          if (!tok) return;
          const newLiked = !liked;
          setLiked(newLiked); setLikes(c=>newLiked?c+1:c-1);
          try {
            const res = await fetch(`${import.meta.env.VITE_API_URL||"http://localhost:4000"}/api/post/${post.id}/like`,{method:"POST",headers:{Authorization:"Bearer "+tok}});
            const data = await res.json();
            if (data.ok) setLikes(data.likes);
          } catch(e) { setLiked(!newLiked); setLikes(c=>newLiked?c-1:c+1); }
        }} style={{ display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:8,cursor:"pointer",transition:"all .2s",fontSize:10,fontWeight:700,background:liked?"rgba(239,68,68,.1)":"rgba(255,255,255,.04)",border:`1px solid ${liked?"rgba(239,68,68,.25)":"rgba(255,255,255,.07)"}`,color:liked?"#f87171":"rgba(255,255,255,.4)" }}>
          <span style={{ fontSize:14,animation:liked?"heartBeat .4s ease":undefined }}>{liked?"❤️":"🤍"}</span><span>{likes}</span>
        </button>
        <button onClick={()=>{ setShowComments(s=>!s); if(!showComments) loadComments(); }} style={{ display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:8,background:showComments?"rgba(96,165,250,.1)":"rgba(255,255,255,.04)",border:`1px solid ${showComments?"rgba(96,165,250,.25)":"rgba(255,255,255,.07)"}`,color:showComments?"#93c5fd":"rgba(255,255,255,.4)",fontSize:10,fontWeight:700,cursor:"pointer" }}>
          <span style={{ fontSize:14 }}>💬</span><span>{commentCount}</span>
        </button>
        {isOwn&&<button onClick={()=>onDelete(post.id)} style={{ marginLeft:"auto",width:28,height:28,borderRadius:7,background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.15)",color:"rgba(239,68,68,.5)",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s" }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(239,68,68,.18)";e.currentTarget.style.color="#f87171"}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(239,68,68,.07)";e.currentTarget.style.color="rgba(239,68,68,.5)"}}>✕</button>}
      </div>
      {showComments && (
        <div style={{marginTop:12,borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:12}}>
          {loadingComments && <div style={{fontSize:11,color:"rgba(255,255,255,.3)",textAlign:"center",padding:8}}>Cargando...</div>}
          {comments.map(c=>(
            <div key={c.id} style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-start"}}>
              {c.avatar_url
                ? <img src={c.avatar_url} style={{width:28,height:28,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"1px solid rgba(var(--brand-primary-rgb),.3)"}} alt=""/>
                : <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(var(--brand-primary-rgb),.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🪙</div>
              }
              <div style={{flex:1,background:"rgba(255,255,255,.03)",borderRadius:10,padding:"8px 12px"}}>
                <div style={{fontSize:11,fontWeight:800,marginBottom:2,
                  ...(c.name_grad_from&&c.name_grad_to ? {
                    background:`linear-gradient(90deg,${c.name_grad_from},${c.name_grad_to})`,
                    WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"
                  } : {color:c.name_color||"var(--brand-primary, #f5e03a)"}),
                  textShadow:c.name_glow>0&&c.name_glow_color?`0 0 ${c.name_glow*2}px ${c.name_glow_color},0 0 ${c.name_glow*4}px ${c.name_glow_color}99`:"none"
                }}>{c.author_name||"Usuario"}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.7)",lineHeight:1.5}}>{c.body}</div>
              </div>
            </div>
          ))}
          {!comments.length && !loadingComments && <div style={{fontSize:11,color:"rgba(255,255,255,.25)",textAlign:"center",padding:8}}>Sin comentarios aún</div>}
          {getTok() && (
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <input value={commentInput} onChange={e=>setCommentInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitComment()} placeholder="Escribí un comentario..." style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"#e2e8f0",fontFamily:"inherit",fontSize:12,padding:"8px 12px",outline:"none"}}/>
              <button onClick={submitComment} disabled={savingComment} style={{height:36,padding:"0 14px",borderRadius:10,border:"none",background:"var(--lemon,var(--brand-primary, #f5e03a))",color:"#000",fontWeight:800,fontSize:12,cursor:"pointer",opacity:savingComment?.6:1}}>
                {savingComment?"...":"→"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DOCK_ITEMS = [
  {id:"posts",        icon:"📝", label:"Posts"},
  {id:"logros",       icon:"🏆", label:"Logros & Colección", badge:"5/8"},
  {id:"personalizar", icon:"🎨", label:"Personalizar"},
  {id:"privacidad",   icon:"🔐", label:"Privacidad"},
];

// Sub-tabs dentro de "Personalizar"
const PERSONALIZE_SUBTABS = [
  {id:"perfil", icon:"🎮", label:"Perfil"},
  {id:"studio", icon:"🎨", label:"Studio"},
  {id:"powers", icon:"⚡", label:"Powers"},
  {id:"tienda", icon:"🛍️", label:"Tienda"},
];

export default function ProfilePage() {
  const { username: targetUsername } = useParams();
  const { reload: reloadCtx, me } = useUser() || {};
  const isOwn = !targetUsername || Boolean(me && me.username && me.username === targetUsername);

  // Redirigir al login si no hay token y es perfil público
  useEffect(() => {
    if (targetUsername && !getToken()) {
      window.location.href = "/";
    }
  }, [targetUsername]);
  const [profile, setProfile]   = useState(null);
  const [shop,    setShop]       = useState(null);
  const [panel,   setPanel]      = useState("posts");
  const [subPanel,setSubPanel]   = useState("perfil"); // sub-tab dentro de "personalizar"
  const [dockOpen,setDockOpen]   = useState(false);
  const [loading, setLoading]    = useState(true);
  const [buying,  setBuying]     = useState(null);
  const [saving,  setSaving]     = useState(false);
  const [msg,     setMsg]        = useState("");
  const [editBio, setEditBio]    = useState(false);
  const [bioText, setBioText]    = useState("");
  const [toast,   setToast]      = useState(null);
  const [equip,   setEquip]      = useState({avatar_key:"avatar_lemon",frame_key:null,title_key:null,badges:[]});
  const [avatarUrl,setAvatarUrl] = useState(null);
  const [uploadingAvatar,setUploadingAvatar] = useState(false);
  const [chatPowers,setChatPowers] = useState([]);
  const [typeFilter,setTypeFilter] = useState("all");
  const [posts,   setPosts]      = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postInput,setPostInput] = useState("");
  const [privacy, setPrivacy]    = useState({envios:true,coins:true,logros:true,posts:true,amigos:false});
  const [privacyLoaded, setPrivacyLoaded] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [followData, setFollowData] = useState({ followers: 0, following: 0, isFollowing: false });
  const [followLoading, setFollowLoading] = useState(false);
  const [storyGroup, setStoryGroup] = useState(null); // group con stories activas del user
  const [showStories, setShowStories] = useState(false);
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState("");
  const getHdrs = () => ({Authorization:"Bearer "+getToken()});

  const showToast = (text,color="var(--brand-primary, #f5e03a)") => { setToast({text,color}); setTimeout(()=>setToast(null),3500); };
  const uidRef = useRef(null);

  const loadPosts = async (uid) => {
    if (!uid) return;
    setPostsLoading(true);
    try {
      const res = await fetch(API+"/api/posts/"+uid, {headers:getHdrs()});
      const data = await res.json();
      if (data.ok) setPosts(data.posts.map(p => ({
        ...p,
        time: new Date(p.created_at).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}),
        type: p.category === "Logros" ? "logro" : p.category === "Colección" ? "loot" : "text",
        likes: Number(p.likes),
        comments: Number(p.comments),
      })));
    } catch(e) { console.error(e); }
    setPostsLoading(false);
  };

  const load = useCallback(async () => {
    try { const tok=getToken(); if(tok) fetch(API+"/api/chat/powers",{headers:{Authorization:"Bearer "+tok}}).then(r=>r.json()).then(d=>{if(d.ok)setChatPowers(d.powers||[]);}).catch(()=>{}); } catch {}
    setLoading(true);
    try {
      const url = isOwn ? API+"/profile" : API+"/profile/u/"+targetUsername;
      const tok = getToken();
      const profileHeaders = tok ? getHdrs() : {};
      let pData, sData;
      const pRes = await fetch(url, {headers: profileHeaders});
      pData = await pRes.json();
      if (tok) {
        const sRes = await fetch(API+"/profile/shop", {headers: getHdrs()});
        sData = await sRes.json();
      } else {
        sData = {items: []};
      }

      setProfile(pData); setShop(sData.items||[]);
      setBioText(pData.profile?.bio||""); setAvatarUrl(pData.profile?.avatar_url||null);
      setUsername(pData.user?.username||""); setUsernameInput(pData.user?.username||"");
      if (pData?.user?.id) {
        uidRef.current = pData.user.id;
        if (getToken()) {
          fetch(API+"/api/follow/"+pData.user.id, {headers:getHdrs()})
            .then(r=>r.json()).then(d=>{ if(d.ok) setFollowData(d); }).catch(()=>{});
          // Cargar stories activas de este user
          fetch(API+"/api/chat/stories/user/"+pData.user.id, {headers:getHdrs()})
            .then(r=>r.json()).then(d=>{ if(d.ok && d.group) setStoryGroup(d.group); }).catch(()=>{});
        }
        // Cargar posts directamente sin depender de loadPosts
        fetch(API+"/api/posts/"+pData.user.id, {headers:{Authorization:"Bearer "+getToken()}})
          .then(r=>r.json())
          .then(d=>{ if(d.ok) setPosts(d.posts.map(p=>({...p, time: new Date(p.created_at).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}), type: p.category==="Logros"?"logro":p.category==="Colección"?"loot":"text", likes:Number(p.likes), comments:Number(p.comments)})));})
          .catch(e=>console.error("posts error",e));
      }
      setEquip({avatar_key:pData.profile?.avatar_key||"avatar_lemon",frame_key:pData.profile?.frame_key||null,title_key:pData.profile?.title_key||null,badges:pData.profile?.badges||[]});
      setPrivacy({
        envios: pData.profile?.privacy_envios !== false,
        coins:  pData.profile?.privacy_coins  !== false,
        logros: pData.profile?.privacy_logros !== false,
        posts:  pData.profile?.privacy_posts  !== false,
        amigos: pData.profile?.privacy_amigos === true,
      });
    } catch(e) { setMsg("Error: "+e.message); }
    setLoading(false);
  },[targetUsername]);

  useEffect(()=>{load();},[load]);

  const postsLoadedRef = useRef(false);
  useEffect(()=>{
    const uid = profile?.user?.id;
    if (uid && !postsLoadedRef.current) {
      postsLoadedRef.current = true;
      loadPosts(uid);
    }
  });


  async function handleBuy(item) {
    const d=item.data||{}; if(d.grantOnly){showToast("Solo puede ser otorgada por el equipo","var(--brand-accent, #ff5500)");return;}
    if(item.cost_coins>0&&!confirm(`Gastar ${item.cost_coins} Coins en ${item.name}?`))return;
    setBuying(item.key);
    try { const res=await fetch(API+"/profile/buy",{method:"POST",headers:{...getHdrs(),"Content-Type":"application/json"},body:JSON.stringify({item_key:item.key})}); const data=await res.json(); if(!res.ok)setMsg(data.error||"Error"); else{showToast("🎉 "+item.name+" desbloqueado!");await load();reloadCtx&&reloadCtx();} } catch{setMsg("Error de red");}
    setBuying(null);
  }

  function handleEquip(item) {
    const e2={...equip};
    if(item.type==="avatar")e2.avatar_key=item.key;
    if(item.type==="frame") e2.frame_key=e2.frame_key===item.key?null:item.key;
    if(item.type==="title") e2.title_key=e2.title_key===item.key?null:item.key;
    if(item.type==="badge"){const idx=e2.badges.indexOf(item.key);if(idx>=0)e2.badges=e2.badges.filter(b=>b!==item.key);else if(e2.badges.length<4)e2.badges=[...e2.badges,item.key];else{showToast("Máximo 4 insignias","var(--brand-accent, #ff5500)");return;}}
    setEquip(e2);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(API+"/profile", {
        method:"PATCH",
        headers:{...getHdrs(),"Content-Type":"application/json"},
        body:JSON.stringify({...equip,bio:bioText})
      });
      const data = await res.json();
      if(res.ok) {
        showToast("✓ Perfil guardado");
        setEditBio(false);
        // Recargar datos frescos del backend
        const [pRes, sRes] = await Promise.all([
          fetch(API+"/profile", {headers:getHdrs()}),
          fetch(API+"/profile/shop", {headers:getHdrs()}),
        ]);
        const [pData, sData] = await Promise.all([pRes.json(), sRes.json()]);
        setProfile(pData);
        setShop(sData.items||[]);
        setBioText(pData.profile?.bio||"");
        setAvatarUrl(pData.profile?.avatar_url||null);
        setEquip({
          avatar_key: pData.profile?.avatar_key||"avatar_lemon",
          frame_key:  pData.profile?.frame_key||null,
          title_key:  pData.profile?.title_key||null,
          badges:     pData.profile?.badges||[],
        });
        setPrivacy({
          envios: pData.profile?.privacy_envios!==false,
          coins:  pData.profile?.privacy_coins!==false,
          logros: pData.profile?.privacy_logros!==false,
          posts:  pData.profile?.privacy_posts!==false,
          amigos: pData.profile?.privacy_amigos===true,
        });
        setPrivacyLoaded(true);
        setPrivacyLoaded(true);
        if(reloadCtx) await reloadCtx();
        window.location.reload();
      } else setMsg(data.error||"Error");
    } catch{ setMsg("Error de red"); }
    setSaving(false);
  }



  async function toggleFollow() {
    console.log("[FOLLOW] profile.user:", profile?.user);
    if (!profile?.user?.id) return;
    setFollowLoading(true);
    try {
      const method = followData.isFollowing ? "DELETE" : "POST";
      const res = await fetch(API+"/api/follow/"+profile.user.id, {method, headers:getHdrs()});
      const data = await res.json();
      if (data.ok) setFollowData(f => ({...f, followers: data.followers, isFollowing: !f.isFollowing}));
    } catch(e) { console.error(e); }
    setFollowLoading(false);
  }

  async function saveUsername() {
    if (!usernameInput.trim()) return;
    setSavingUsername(true); setUsernameMsg("");
    try {
      const res = await fetch(API+"/profile/username", {
        method: "PATCH",
        headers: {...getHdrs(), "Content-Type": "application/json"},
        body: JSON.stringify({ username: usernameInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) { setUsernameMsg(data.error||"Error"); return; }
      setUsername(data.username);
      setUsernameMsg("✓ @"+data.username);
      setTimeout(()=>setUsernameMsg(""), 3000);
    } catch { setUsernameMsg("Error de red"); }
    setSavingUsername(false);
  }

  async function publishPost() {
    if(!postInput.trim()) return;
    try {
      const res = await fetch(API+"/api/posts", {
        method:"POST",
        headers:{...getHdrs(),"Content-Type":"application/json"},
        body: JSON.stringify({body: postInput.trim(), category: "Texto"})
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error||"Error","#ef4444"); return; }
      setPostInput("");
      showToast("✓ Publicado!","#22c55e");
      // Agregar el post nuevo al principio del array inmediatamente
      if (data.post) {
        const newPost = {
          ...data.post,
          time: "ahora",
          type: "text",
          likes: 0,
          comments: 0,
          author: profile?.user?.name || "ANON",
        };
        setPosts(prev => [newPost, ...prev]);
      }
    } catch { showToast("Error de red","#ef4444"); }
  }

  if(loading) return (
    <div style={{background:"#03040c",minHeight:"100vh",padding:"20px 16px"}}>
      <style>{`
        @keyframes profSkel{0%{background-position:-300% 0}100%{background-position:300% 0}}
        .pf-skel{background:linear-gradient(90deg,rgba(255,255,255,.02) 0%,rgba(var(--brand-primary-rgb),.05) 50%,rgba(255,255,255,.02) 100%);background-size:300% 100%;animation:profSkel 1.6s linear infinite;border-radius:12px}
      `}</style>
      <div style={{maxWidth:1060,margin:"0 auto",display:"flex",flexDirection:"column",gap:0}}>
        <div className="pf-skel" style={{height:280,borderRadius:"24px 24px 0 0"}}/>
        <div style={{background:"#070a18",border:"1px solid rgba(255,255,255,.06)",borderTop:"none",padding:"0 28px 28px",position:"relative"}}>
          <div className="pf-skel" style={{width:120,height:120,borderRadius:"50%",marginTop:-56,marginBottom:18}}/>
          <div className="pf-skel" style={{width:280,height:36,marginBottom:10}}/>
          <div className="pf-skel" style={{width:160,height:14,marginBottom:18}}/>
          <div className="pf-skel" style={{width:"100%",maxWidth:520,height:50,marginBottom:18}}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,marginTop:18}}>
            {[0,1,2,3].map(i=><div key={i} className="pf-skel" style={{height:90}}/>)}
          </div>
        </div>
      </div>
      <div style={{textAlign:"center",marginTop:24,fontFamily:"'Gotham', monospace",fontSize:10,letterSpacing:"3px",color:"rgba(var(--brand-primary-rgb),.4)",textTransform:"uppercase"}}>
        Cargando perfil…
      </div>
    </div>
  );

  const allItems=shop||[]; const owned=profile?.profile?.owned_items||[];
  const level=profile?.user?.level||"bronze"; const lc=LEVEL[level];
  const titleItem=allItems.find(i=>i.key===equip.title_key);
  const PRIVATE_BADGES=["badge_creator","badge_mod","badge_bot","badge_beta"];
  const shopItems=allItems.filter(i=>!PRIVATE_BADGES.includes(i.key));
  const filtered=typeFilter==="all"?shopItems:shopItems.filter(i=>i.type===typeFilter);
  const stats=profile?.stats||{}; const coinsTotal=profile?.coins?.total_earned||0;
  const unlockedAchs=ACHIEVEMENTS.filter(a=>a.condition(stats,coinsTotal));
  const achPct=Math.round(unlockedAchs.length*100/ACHIEVEMENTS.length);

  return (
    <div style={{background:"#03040c",minHeight:"100vh"}}>
      {targetUsername && <Topbar />}
      <div style={{display:"flex"}}>
        {getToken() && <Sidebar />}
        <div style={{flex:1,minWidth:0}}>
      <style>{`
        @keyframes badgeShimmer{0%{background-position:-300% center}100%{background-position:300% center}}
        @keyframes badgeBreathe{0%,100%{box-shadow:0 0 12px var(--gc),0 0 30px var(--gc2,transparent)}50%{box-shadow:0 0 24px var(--gc),0 0 60px var(--gc2,transparent)}}
        @keyframes holographic{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(400%)}}
        @keyframes rippleOut{0%{transform:scale(.8);opacity:.5}100%{transform:scale(2.4);opacity:0}}
        @keyframes particleFly{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--tx),var(--ty)) scale(0);opacity:0}}
        @keyframes iconSpin{0%{transform:rotateY(0deg)}50%{transform:rotateY(180deg)}100%{transform:rotateY(360deg)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes iconPop{0%,100%{transform:scale(1)}50%{transform:scale(1.15) rotate(-4deg)}}
        @keyframes heartBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
        @keyframes progressGlow{0%,100%{box-shadow:0 0 8px var(--brand-primary, #f5e03a)44}50%{box-shadow:0 0 18px var(--brand-primary, #f5e03a)88}}
        @keyframes borderSpin{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 20px var(--brand-primary, #f5e03a)33}50%{box-shadow:0 0 40px var(--brand-primary, #f5e03a)66}}
        @keyframes shimmerBg{0%{background-position:-600px 0}100%{background-position:600px 0}}
        @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{0%{transform:translateX(-50%) translateY(20px) scale(.9);opacity:0}100%{transform:translateX(-50%) translateY(0) scale(1);opacity:1}}

        /* ─── MOBILE FIXES ProfilePage ─── */
        @media(max-width:768px){
          .pf-shell{padding:14px 10px 80px!important}
          .pf-grid{grid-template-columns:1fr!important;gap:14px!important}
          .pf-banner{height:170px!important}
          .pf-banner-eyebrow{top:14px!important;left:14px!important}
          .pf-banner-eyebrow-name{font-size:48px!important;letter-spacing:-1px!important}
          .pf-banner-edit{top:12px!important;right:12px!important;padding:7px 10px!important;font-size:9px!important;letter-spacing:1px!important;gap:4px!important}
          .pf-banner-edit-text{display:none!important}
          .pf-hero{padding:0 14px 16px!important}
          .pf-avatar-wrap{margin-top:-46px!important}
          .pf-avatar{width:90px!important;height:90px!important;font-size:38px!important}
          .pf-name-row{font-size:30px!important}
          .pf-coins-card{padding:8px 12px!important}
          .pf-coins-num{font-size:20px!important}
          .pf-actions-row{flex-wrap:wrap!important;gap:6px!important;width:100%!important}
          .pf-actions-row button{flex:1 1 auto!important;font-size:9px!important;height:32px!important;padding:0 12px!important}
          .pf-tabs{grid-template-columns:repeat(4,1fr)!important;font-size:10px!important}
          .pf-tabs button{padding:10px 4px!important;font-size:9px!important;letter-spacing:1px!important}
          .pf-panel{padding:18px 14px!important;border-radius:0 0 18px 18px!important}
          .pf-dock{position:static!important;width:100%!important;flex-direction:row!important;flex-wrap:wrap!important;gap:6px!important;top:0!important}
          .pf-dock-toggle{display:none!important}
          .pf-dock-item{flex:1 1 calc(33% - 6px)!important;min-width:96px!important}
          .pf-dock-item span:nth-child(2),.pf-dock-item span:nth-child(3){opacity:1!important;transform:none!important}
        }
        @media(max-width:420px){
          .pf-tabs{grid-template-columns:repeat(2,1fr)!important}
          .pf-banner{height:150px!important}
          .pf-name-row{font-size:26px!important}
        }
      `}</style>

      {toast&&<div style={{position:"fixed",bottom:24,left:"50%",zIndex:9999,background:"#0d1124",border:`1px solid ${toast.color}44`,borderRadius:14,padding:"12px 24px",fontSize:13,fontWeight:800,color:toast.color,boxShadow:"0 12px 40px rgba(0,0,0,.7)",whiteSpace:"nowrap",animation:"toastIn .3s ease"}}>{toast.text}</div>}

      <div className="pf-shell" style={{maxWidth:1060,margin:"0 auto",padding:"20px 16px 60px"}}>
        <div className="pf-grid" style={{display:"grid",gridTemplateColumns:"1fr auto",gap:16,alignItems:"start"}}>

          {/* ── PROFILE COLUMN ── */}
          <div style={{minWidth:0}}>
            {/* BANNER PREMIUM */}
            <div className="pf-banner" style={{height:300,borderRadius:"24px 24px 0 0",overflow:"hidden",position:"relative"}}>
              {profile?.profile?.banner_effect&&profile.profile.banner_effect!=="none"?(
                <BannerCanvas effect={profile.profile.banner_effect} color1={profile.profile.banner_color1||"var(--brand-primary, #f5e03a)"} color2={profile.profile.banner_color2||"var(--brand-accent, #ff5500)"} height={300}/>
              ):(
                <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,#040110,#0a0820,#120605)",backgroundSize:"400% 400%",animation:"holographic 8s ease infinite"}}>
                  <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 30% 50%,var(--brand-primary, #f5e03a)18 0%,transparent 60%)"}}/>
                  <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 70% 30%,#8b5cf618 0%,transparent 60%)"}}/>
                  <img src="/icons/icon.svg" alt="" style={{position:"absolute",right:-30,top:-30,width:340,height:340,opacity:.04,filter:"invert(1)",pointerEvents:"none",userSelect:"none"}}/>
                </div>
              )}
              {/* Editorial bar top */}
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a))",backgroundSize:"200% 100%",animation:"borderSpin 4s linear infinite",zIndex:3}}/>
              {/* Grid sutil */}
              <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--brand-primary-rgb),.018) 1px,transparent 1px)",backgroundSize:"56px 56px",pointerEvents:"none",zIndex:1}}/>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(3,4,12,.4) 0%,transparent 30%,rgba(3,4,12,.4) 60%,rgba(3,4,12,.98) 100%)",zIndex:2}}/>
              {/* Eyebrow + watermark name */}
              <div className="pf-banner-eyebrow" style={{position:"absolute",top:24,left:28,zIndex:4}}>
                <div style={{fontFamily:"'Gotham', monospace",fontSize:10,letterSpacing:"3.5px",textTransform:"uppercase",color:"var(--brand-accent, #ff5500)",display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  <span style={{width:28,height:1,background:"var(--brand-accent, #ff5500)",display:"inline-block"}}/>
                  {isOwn?"Tu perfil":"Perfil"}{profile?.user?.role==="admin"?" · admin":profile?.user?.role==="operator"?" · operador":""}
                </div>
                <div className="pf-banner-eyebrow-name" style={{fontFamily:"'Gotham', sans-serif",fontWeight:900,fontSize:"clamp(48px,6.4vw,76px)",lineHeight:.92,letterSpacing:"-0.04em",color:"rgba(240,236,227,.18)",textShadow:"0 4px 24px rgba(0,0,0,.5)",userSelect:"none"}}>
                  @{username||(profile?.user?.name||"").toUpperCase().replace(/\s+/g,"")}
                </div>
              </div>
              {isOwn&&<button onClick={()=>setPanel("studio")} className="pf-banner-edit" style={{position:"absolute",top:24,right:24,zIndex:4,background:"rgba(2,3,7,.7)",backdropFilter:"blur(18px)",border:"1px solid rgba(var(--brand-primary-rgb),.25)",color:"var(--brand-primary, #f5e03a)",fontFamily:"'Gotham', sans-serif",fontSize:11,fontWeight:800,letterSpacing:"2px",textTransform:"uppercase",padding:"10px 18px",cursor:"pointer",transition:"all .25s",display:"flex",alignItems:"center",gap:8}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(var(--brand-primary-rgb),.12)";e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(var(--brand-primary-rgb),.18)"}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(2,3,7,.7)";e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=""}}>🎨 <span className="pf-banner-edit-text">Editar banner</span></button>}
            </div>

            {/* HERO */}
            <div className="pf-hero" style={{background:"linear-gradient(180deg,rgba(8,10,22,.97),#03040c)",border:"1px solid rgba(255,255,255,.06)",borderTop:"none",padding:"0 28px 24px"}}>
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:16}}>
                {/* AVATAR */}
                <div className="pf-avatar-wrap" style={{position:"relative",display:"inline-block",marginTop:-66,zIndex:10,cursor:storyGroup?"pointer":"default"}}
                  onClick={()=>{ if(storyGroup) setShowStories(true); }}
                  title={storyGroup?"Ver historias":""}>
                  <div style={{position:"absolute",inset:-22,borderRadius:"50%",background:"radial-gradient(circle,var(--brand-primary, #f5e03a)30 0%,transparent 70%)",animation:"glowPulse 3s ease-in-out infinite",pointerEvents:"none"}}/>
                  {/* Ring conic-gradient si tiene stories activas (estilo IG) */}
                  {storyGroup ? (
                    <div style={{position:"absolute",inset:-6,borderRadius:"50%",padding:3,background:storyGroup.all_viewed
                      ? "rgba(255,255,255,.15)"
                      : "conic-gradient(from 0deg,#a78bfa,#ec4899,var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a),#a78bfa)",
                      animation:storyGroup.all_viewed?"none":"borderSpin 4s linear infinite",backgroundSize:"100%"}}>
                      <div style={{width:"100%",height:"100%",borderRadius:"50%",background:"#03040c"}}/>
                    </div>
                  ) : (
                    <div style={{position:"absolute",inset:-6,borderRadius:"50%",padding:3,background:"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))",backgroundSize:"300% 300%",animation:"borderSpin 3.5s ease infinite"}}>
                      <div style={{width:"100%",height:"100%",borderRadius:"50%",background:"#03040c"}}/>
                    </div>
                  )}
                  {avatarUrl?(
                    <div className="pf-avatar" style={{width:124,height:124,borderRadius:"50%",overflow:"hidden",border:"3px solid rgba(var(--brand-primary-rgb),.25)",position:"relative",zIndex:2,boxShadow:"0 16px 40px rgba(0,0,0,.5)"}}>
                      <img src={avatarUrl} alt="avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    </div>
                  ):(
                    <div className="pf-avatar" style={{width:124,height:124,borderRadius:"50%",background:allItems.find(i=>i.key===equip.avatar_key)?.data?.bg||"linear-gradient(135deg,#100820,#0a1825)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:54,position:"relative",zIndex:2,border:allItems.find(i=>i.key===equip.frame_key)?.data?.border||"3px solid rgba(var(--brand-primary-rgb),.25)",boxShadow:allItems.find(i=>i.key===equip.frame_key)?.data?.shadow||"0 16px 40px rgba(0,0,0,.5)"}}>
                      {allItems.find(i=>i.key===equip.avatar_key)?.data?.emoji||"🪙"}
                      {allItems.find(i=>i.key===equip.frame_key)?.data?.pulse&&<div style={{position:"absolute",inset:-6,borderRadius:"50%",border:"2px solid rgba(167,139,250,.5)",animation:"glowPulse 2s ease-in-out infinite",pointerEvents:"none"}}/>}
                    </div>
                  )}
                  {/* Pawn de rango xat-style */}
                  <div title={profile?.user?.role==="admin"?"ADMIN":profile?.user?.role==="operator"?"OPERADOR":lc.label} style={{position:"absolute",top:-2,right:-2,width:36,height:36,borderRadius:"50%",background:profile?.user?.role==="admin"?"linear-gradient(135deg,#ef4444,#dc2626)":profile?.user?.role==="operator"?"linear-gradient(135deg,#fb923c,#f97316)":`linear-gradient(135deg,${lc.color},${lc.color}cc)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,zIndex:5,border:"2.5px solid #03040c",boxShadow:`0 0 14px ${profile?.user?.role==="admin"?"#ef4444":profile?.user?.role==="operator"?"#fb923c":lc.color}66`}}>
                    {profile?.user?.role==="admin"?"👑":profile?.user?.role==="operator"?"🛡":lc.icon}
                  </div>
                  {/* Online indicator (siempre online si es own) */}
                  {isOwn&&<div title="Online" style={{position:"absolute",bottom:4,right:4,width:18,height:18,borderRadius:"50%",background:"#22c55e",border:"3px solid #03040c",zIndex:5,boxShadow:"0 0 12px #22c55e",animation:"glowPulse 2s ease-in-out infinite"}}/>}
                  {isOwn&&<label style={{position:"absolute",top:0,left:0,right:0,bottom:0,borderRadius:"50%",background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,cursor:"pointer",zIndex:4,opacity:0,transition:"opacity .25s"}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>
                    {uploadingAvatar?"⏳":"📷"}
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={async(e)=>{
                      const file=e.target.files[0]; if(!file)return; setUploadingAvatar(true);
                      try{const fd=new FormData();fd.append("avatar",file);const r=await fetch(API+"/profile/avatar-upload",{method:"POST",headers:{Authorization:`Bearer ${getToken()}`},body:fd});const d=await r.json();if(d.ok){setAvatarUrl(d.url);showToast("✅ Foto actualizada","#22c55e");}else showToast("❌ "+d.error,"#ef4444");}catch{showToast("❌ Error de red","#ef4444");}
                      setUploadingAvatar(false);
                    }}/>
                  </label>}
                </div>
                {isOwn&&<div className="pf-actions-row" style={{display:"flex",gap:8,paddingBottom:2}}>
                  <Pop as="button" onClick={()=>setEditBio(b=>!b)} style={{height:36,padding:"0 17px",borderRadius:11,fontSize:10,fontWeight:800,letterSpacing:".5px",cursor:"pointer",background:editBio?"rgba(var(--brand-accent-rgb),.1)":"rgba(255,255,255,.05)",border:`1px solid ${editBio?"rgba(var(--brand-accent-rgb),.28)":"rgba(255,255,255,.1)"}`,color:editBio?"var(--brand-accent, #ff8c2a)":"rgba(255,255,255,.5)",display:"flex",alignItems:"center",gap:6}}>✏️ {editBio?"Cancelar":"Editar bio"}</Pop>
                  <Pop as="button" onClick={handleSave} disabled={saving} hoverScale={1.04} style={{height:36,padding:"0 20px",borderRadius:11,fontSize:10,fontWeight:800,letterSpacing:".5px",cursor:saving?"not-allowed":"pointer",background:"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a) 55%,#ff8c00)",border:"none",color:"#000",boxShadow:"0 4px 18px rgba(var(--brand-primary-rgb),.42)",display:"flex",alignItems:"center",gap:6}}>✦ {saving?"Guardando...":"Guardar perfil"}</Pop>
                </div>}
              </div>

              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:8,filter:"drop-shadow(0 4px 24px rgba(var(--brand-primary-rgb),.15))"}}>
                {isOwn?<UserNameHeader size={38}/>:<UserNameHeader className="pf-name-row" own={false} name={profile?.profile?.custom_name||(profile?.user?.name||"")} color={profile?.profile?.name_color||(profile?.user?.role==="admin"?"#ef4444":profile?.user?.role==="operator"?"#fb923c":null)} glowColor={profile?.profile?.name_glow_color} glowInt={profile?.profile?.name_glow||0} size={38}/>}
                {!["admin","operator"].includes(profile?.user?.role) && <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 14px",fontFamily:"'Gotham', monospace",fontSize:9,fontWeight:500,letterSpacing:"2.5px",textTransform:"uppercase",background:`${lc.color}14`,border:`1px solid ${lc.color}38`,color:lc.color}}>{lc.icon} {lc.label}</span>}
                {profile?.user?.role==="admin"&&<span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 14px",fontFamily:"'Gotham', monospace",fontSize:9,fontWeight:500,letterSpacing:"2.5px",textTransform:"uppercase",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",color:"#fca5a5"}}>👑 ADMIN</span>}
                {profile?.user?.role==="operator"&&<span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"5px 14px",fontFamily:"'Gotham', monospace",fontSize:9,fontWeight:500,letterSpacing:"2.5px",textTransform:"uppercase",background:"rgba(251,146,60,.08)",border:"1px solid rgba(251,146,60,.3)",color:"#fb923c"}}>🛡 OP</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:4}}>
                <span style={{fontSize:10,color:"rgba(255,255,255,.2)"}}>#{profile?.user?.client_number}</span>
                {equip.title_key && allItems.find(i=>i.key===equip.title_key) && (()=>{
                  const ti=allItems.find(i=>i.key===equip.title_key); const td=ti.data||{};
                  return <span style={{fontSize:10,fontWeight:800,letterSpacing:"2px",textTransform:"uppercase",color:td.color||"var(--brand-primary, #f5e03a)",background:`${td.color||"var(--brand-primary, #f5e03a)"}15`,border:`1px solid ${td.color||"var(--brand-primary, #f5e03a)"}30`,padding:"2px 10px",borderRadius:100}}>— {ti.name} —</span>;
                })()}
              </div>

              {editBio?(
                <div style={{marginBottom:13}}>
                  <textarea value={bioText} onChange={e=>setBioText(e.target.value)} placeholder="Contá algo sobre vos..." maxLength={160} rows={2} autoFocus style={{width:"100%",maxWidth:500,background:"rgba(255,255,255,.05)",border:"1px solid rgba(var(--brand-primary-rgb),.28)",borderRadius:11,color:"#fff",fontFamily:"inherit",fontSize:12,padding:"10px 13px",outline:"none",resize:"none",lineHeight:1.65,display:"block",marginBottom:7}}/>
                  <div style={{display:"flex",gap:7}}>
                    <button onClick={()=>{showToast("✓ Bio guardada","#22c55e");setEditBio(false);}} style={{padding:"6px 14px",background:"rgba(var(--brand-primary-rgb),.14)",border:"1px solid rgba(var(--brand-primary-rgb),.28)",borderRadius:8,color:"var(--brand-primary, #f5e03a)",fontSize:9,fontWeight:900,letterSpacing:"1px",cursor:"pointer"}}>Guardar →</button>
                    <button onClick={()=>setEditBio(false)} style={{padding:"6px 13px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.09)",borderRadius:8,color:"rgba(255,255,255,.35)",fontSize:9,fontWeight:900,letterSpacing:"1px",cursor:"pointer"}}>Cancelar</button>
                  </div>
                </div>
              ):bioText?(
                <div style={{fontSize:12,color:"rgba(255,255,255,.42)",lineHeight:1.7,maxWidth:500,marginBottom:13,fontStyle:"italic",padding:"9px 13px",background:"rgba(255,255,255,.03)",borderLeft:"2px solid rgba(var(--brand-primary-rgb),.3)",borderRadius:"0 10px 10px 0",cursor:isOwn?"pointer":"default"}} onClick={()=>isOwn&&setEditBio(true)}>
                  <span style={{color:"rgba(var(--brand-primary-rgb),.45)"}}>&#34;</span>{bioText}<span style={{color:"rgba(var(--brand-primary-rgb),.45)"}}>&#34;</span>
                </div>
              ):isOwn?(
                <div style={{fontSize:11,color:"rgba(237,233,224,.18)",marginBottom:13,cursor:"pointer"}} onClick={()=>setEditBio(true)}>+ Agregá una bio...</div>
              ):null}

              {isOwn&&(
                <div style={{marginBottom:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.09)",borderRadius:10,padding:"6px 12px"}}>
                    <span style={{color:"rgba(255,255,255,.3)",fontSize:13}}>@</span>
                    <input value={usernameInput} onChange={e=>setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} placeholder="tu_username" maxLength={30} style={{background:"none",border:"none",color:"#e2e8f0",fontFamily:"inherit",fontSize:13,fontWeight:700,outline:"none",width:140}} onKeyDown={e=>e.key==="Enter"&&saveUsername()}/>
                    {usernameInput!==username&&<button onClick={saveUsername} disabled={savingUsername} style={{background:"rgba(var(--brand-primary-rgb),.15)",border:"1px solid rgba(var(--brand-primary-rgb),.3)",borderRadius:7,color:"var(--brand-primary, #f5e03a)",fontSize:10,fontWeight:900,padding:"3px 10px",cursor:"pointer"}}>{savingUsername?"...":"Guardar"}</button>}
                  </div>
                  <PhoneEditor profile={profile} showToast={showToast}/>
                  {username&&<a href={"/perfil/"+username} target="_blank" style={{fontSize:10,color:"rgba(255,255,255,.3)",textDecoration:"none",fontWeight:700}}>/perfil/{username} ↗</a>}
                  {usernameMsg&&<span style={{fontSize:11,color:usernameMsg.startsWith("✓")?"#22c55e":"#f87171",fontWeight:700}}>{usernameMsg}</span>}
                </div>
              )}
              {equip.badges&&equip.badges.length>0&&(
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14,position:"relative",zIndex:50,isolation:"isolate"}}>
                  {equip.badges.map(bk=>{
                    const b=allItems.find(i=>i.key===bk); if(!b)return null;
                    const bd=b.data||{};
                    if(BADGE_CONFIG[bk])return <PremiumBadge key={bk} badgeKey={bk} name={b.name} emoji={b.emoji}/>;
                    const effect=bd.animated?(bd.effect||"glow"):null;
                    if(effect)return <BadgePreview key={bk} effect={effect} color={bd.color||"var(--brand-primary, #f5e03a)"} emoji={b.emoji} text={b.name} size="small"/>;
                    return <div key={bk} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 12px",borderRadius:100,background:`${bd.color||"var(--brand-primary, #f5e03a)"}15`,border:`1px solid ${bd.color||"var(--brand-primary, #f5e03a)"}30`,color:bd.color||"var(--brand-primary, #f5e03a)",fontSize:9,fontWeight:900,letterSpacing:"1.5px",textTransform:"uppercase"}}>{b.emoji} {b.name}</div>;
                  })}
                </div>
              )}

              <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                {/* Coins card premium */}
                <div style={{display:"inline-flex",alignItems:"center",gap:10,padding:"10px 16px",background:"linear-gradient(135deg,rgba(var(--brand-primary-rgb),.1),rgba(var(--brand-accent-rgb),.05))",border:"1px solid rgba(var(--brand-primary-rgb),.25)",position:"relative",overflow:"hidden",animation:"glowPulse 4s ease-in-out infinite"}}>
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(var(--brand-primary-rgb),.15),transparent)",backgroundSize:"200% 100%",animation:"shimmerBg 3s linear infinite",pointerEvents:"none"}}/>
                  <span style={{fontSize:20,filter:"drop-shadow(0 0 8px rgba(var(--brand-primary-rgb),.5))",position:"relative",zIndex:1}}>🪙</span>
                  <div style={{position:"relative",zIndex:1}}>
                    <div style={{fontFamily:"'Gotham', monospace",fontSize:8,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(var(--brand-primary-rgb),.5)",lineHeight:1}}>Coins</div>
                    <CountUp value={profile?.coins?.balance||0} style={{fontFamily:"'Gotham', sans-serif",fontSize:24,letterSpacing:"1px",color:"var(--brand-primary, #f5e03a)",lineHeight:1.1,marginTop:2,display:"block"}}>{(profile?.coins?.balance||0).toLocaleString()}</CountUp>
                  </div>
                </div>
                {/* Level progress (oculto para staff) */}
                {!["admin","operator"].includes(profile?.user?.role) && (
                <div style={{flex:1,minWidth:200,maxWidth:280}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontFamily:"'Gotham', monospace",fontSize:9,fontWeight:500,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(255,255,255,.4)"}}>Nivel <b style={{color:lc.color,fontWeight:500}}>{lc.label}</b></span>
                    <span style={{fontFamily:"'Gotham', monospace",fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:level==="gold"?"#22c55e":"rgba(255,255,255,.25)"}}>{level==="gold"?"MAX ✓":level==="silver"?"60%":"30%"}</span>
                  </div>
                  <div style={{height:5,background:"rgba(255,255,255,.05)",borderRadius:0,overflow:"hidden",position:"relative",border:"1px solid rgba(255,255,255,.04)"}}>
                    <div style={{height:"100%",width:level==="gold"?"100%":level==="silver"?"60%":"30%",background:`linear-gradient(90deg,${lc.color},${lc.color}cc,var(--brand-accent, #ff5500))`,backgroundSize:"200% 100%",animation:"shimmerBg 3s linear infinite",boxShadow:`0 0 10px ${lc.color}66`}}/>
                  </div>
                </div>
                )}
                {/* Follow stats premium */}
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"4px 14px",borderLeft:"1px solid rgba(255,255,255,.06)",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                    <span style={{fontFamily:"'Gotham', sans-serif",fontSize:22,letterSpacing:"1px",color:"var(--brand-primary, #f5e03a)",lineHeight:1}}>{followData.followers}</span>
                    <span style={{fontFamily:"'Gotham', monospace",fontSize:8,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginTop:2}}>seguidores</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"4px 14px",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                    <span style={{fontFamily:"'Gotham', sans-serif",fontSize:22,letterSpacing:"1px",color:"var(--brand-primary, #f5e03a)",lineHeight:1}}>{followData.following}</span>
                    <span style={{fontFamily:"'Gotham', monospace",fontSize:8,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginTop:2}}>siguiendo</span>
                  </div>
                  {!isOwn && getToken() && (
                    <button onClick={toggleFollow} disabled={followLoading} style={{height:38,padding:"0 22px",border:followData.isFollowing?"1px solid rgba(var(--brand-primary-rgb),.25)":"none",cursor:followLoading?"not-allowed":"pointer",fontFamily:"'Gotham', sans-serif",fontWeight:800,fontSize:12,letterSpacing:"2px",textTransform:"uppercase",background:followData.isFollowing?"transparent":"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #fff7a0))",color:followData.isFollowing?"var(--brand-primary, #f5e03a)":"#000",transition:"all .25s",opacity:followLoading?.6:1,boxShadow:followData.isFollowing?"none":"0 8px 24px rgba(var(--brand-primary-rgb),.25)"}}>
                      {followLoading?"...":followData.isFollowing?"✓ Siguiendo":"+ Seguir"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* STATS PREMIUM */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderTop:"1px solid rgba(255,255,255,.05)",borderBottom:"1px solid rgba(255,255,255,.05)",background:"linear-gradient(180deg,rgba(var(--brand-primary-rgb),.018),transparent)"}}>
              {[
                // Sprint 11: stats sociales reales (privacy.envios reusado para
                // posts/likes/friends; el flag es generico "actividad publica").
                {ico:"📰",lbl:"Posts",         v:String(stats.posts||0),         c:"var(--brand-primary, #f5e03a)", hide:privacyLoaded&&!privacy.envios},
                {ico:"❤️",lbl:"Likes recibidos",v:String(stats.likes||0),         c:"#ef4444", hide:privacyLoaded&&!privacy.envios},
                {ico:"👥",lbl:"Amigos",        v:String(stats.friends||0),       c:"#60a5fa", hide:privacyLoaded&&!privacy.envios},
                {ico:"🪙",lbl:"Coins ganados", v:coinsTotal.toLocaleString(),    c:"var(--brand-primary, #f5e03a)", hide:privacyLoaded&&!privacy.coins},
              ].map((s,i)=>(
                <div key={i} className="pf-stat-card" style={{padding:"22px 22px",borderRight:i<3?"1px solid rgba(255,255,255,.05)":"none",cursor:"pointer",position:"relative",overflow:"hidden",transition:"all .35s",animation:`slideUp .55s cubic-bezier(.2,.8,.2,1) ${i*70}ms both`}} onMouseEnter={e=>!s.hide&&(e.currentTarget.style.background=`${s.c}06`)} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,${s.c},transparent)`,opacity:.4}}/>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:18,filter:`drop-shadow(0 0 8px ${s.c}66)`,opacity:s.hide?.3:1}}>{s.ico}</span>
                    <div style={{fontFamily:"'Gotham', monospace",fontSize:9,fontWeight:500,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(255,255,255,.4)"}}>{s.lbl}</div>
                  </div>
                  <div style={{fontFamily:"'Gotham', sans-serif",fontSize:36,letterSpacing:"1px",color:s.hide?"rgba(255,255,255,.12)":s.c,lineHeight:1,filter:s.hide?"blur(8px)":"none",transition:"filter .3s",textShadow:s.hide?"none":`0 0 20px ${s.c}33`}}>{s.v}</div>
                  {s.hide&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(3,4,12,.55)",backdropFilter:"blur(2px)"}}><span style={{fontSize:18}}>🔒</span><span style={{fontFamily:"'Gotham', monospace",fontSize:8,letterSpacing:"2px",color:"rgba(255,255,255,.35)",textTransform:"uppercase"}}>Privado</span></div>}
                </div>
              ))}
            </div>

            {/* CONTENT PANEL */}
            <div style={{background:"#070a18",border:"1px solid rgba(255,255,255,.06)",borderTop:"none",borderRadius:"0 0 24px 24px",padding:26,minHeight:400,animation:"slideUp .28s ease"}}>

              {panel==="posts"&&(
                <div>
                  {isOwn&&(
                    <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",borderRadius:18,padding:16,marginBottom:20}}>
                      <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
                        <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#100820,#0a1825)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,border:"1.5px solid rgba(var(--brand-primary-rgb),.22)"}}>🪙</div>
                        <textarea value={postInput} onChange={e=>setPostInput(e.target.value)} maxLength={280} placeholder="Compartí algo con la comunidad..." style={{flex:1,background:"none",border:"none",color:"#e2e8f0",fontFamily:"inherit",fontSize:13,lineHeight:1.6,resize:"none",outline:"none",minHeight:60}}/>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.06)"}}>
                        {["📷","🎬","😊"].map(ic=><div key={ic} style={{width:32,height:32,borderRadius:9,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,cursor:"pointer"}} onClick={()=>showToast("Próximamente","var(--brand-primary, #f5e03a)")}>{ic}</div>)}
                        <span style={{fontSize:9,color:"rgba(255,255,255,.2)",marginLeft:4}}>{postInput.length}/280</span>
                        <button onClick={publishPost} style={{marginLeft:"auto",height:34,padding:"0 20px",background:"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))",border:"none",borderRadius:10,color:"#000",fontSize:10,fontWeight:900,cursor:"pointer",boxShadow:"0 4px 16px rgba(var(--brand-primary-rgb),.38)"}}>Publicar →</button>
                      </div>
                    </div>
                  )}
                  <div style={{display:"flex",flexDirection:"column",gap:14}}>
                    {posts.map(p=><PostCard key={p.id} post={p} onDelete={async id=>{
                      try {
                        const res = await fetch(API+"/api/post/"+id,{method:"DELETE",headers:getHdrs()});
                        if (res.ok) setPosts(prev=>prev.filter(x=>x.id!==id));
                        else showToast("Error eliminando","#ef4444");
                      } catch { showToast("Error de red","#ef4444"); }
                    }} isOwn={isOwn}/>)}
                  </div>
                </div>
              )}

              {panel==="perfil"&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:22}}>
                  <div>
                    <div style={{fontSize:8,fontWeight:900,letterSpacing:"4px",textTransform:"uppercase",color:"rgba(var(--brand-accent-rgb),.65)",marginBottom:13,display:"flex",alignItems:"center",gap:10}}><span style={{width:18,height:1,background:"linear-gradient(90deg,var(--brand-accent, #ff5500),transparent)"}}/>Avatar</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:22}}>
                      {allItems.filter(i=>i.type==="avatar"&&owned.includes(i.key)).map(item=><ItemCard key={item.key} item={item} owned readOnly={!isOwn} equipped={equip.avatar_key===item.key} onBuy={handleBuy} onEquip={handleEquip} loading={buying}/>)}
                    </div>
                  </div>
                  <div>
                    {["frame","title","badge"].map(type=>{
                      const its=allItems.filter(i=>i.type===type&&owned.includes(i.key)); if(!its.length)return null;
                      return <div key={type} style={{marginBottom:20}}>
                        <div style={{fontSize:8,fontWeight:900,letterSpacing:"4px",textTransform:"uppercase",color:"rgba(var(--brand-accent-rgb),.65)",marginBottom:13,display:"flex",alignItems:"center",gap:8}}><span style={{width:18,height:1,background:"linear-gradient(90deg,var(--brand-accent, #ff5500),transparent)"}}/>{type==="frame"?"Marcos":type==="title"?"Títulos":"Insignias"}{type==="badge"&&<span style={{color:"rgba(255,255,255,.2)",fontSize:7}}>({equip.badges?.length||0}/4)</span>}</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
                          {its.map(item=><ItemCard key={item.key} item={item} owned readOnly={!isOwn} equipped={type==="badge"?(equip.badges?.includes(item.key)):equip[type+"_key"]===item.key} onBuy={handleBuy} onEquip={handleEquip} loading={buying}/>)}
                        </div>
                      </div>;
                    })}
                  </div>
                </div>
              )}

              {panel==="logros"&&(
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                    <span style={{fontSize:9,color:"rgba(255,255,255,.25)",fontWeight:900,letterSpacing:"2px"}}>{unlockedAchs.length} DE {ACHIEVEMENTS.length} · {achPct}%</span>
                    <div style={{width:180,height:4,background:"rgba(255,255,255,.07)",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${achPct}%`,background:"linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))",boxShadow:"0 0 10px var(--brand-primary, #f5e03a)55",transition:"width 1.5s ease"}}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(162px,1fr))",gap:10}}>
                    {ACHIEVEMENTS.map(ach=><AchievementCard key={ach.key} ach={ach} unlocked={unlockedAchs.some(a=>a.key===ach.key)} stats={stats}/>)}
                  </div>
                  {/* Colección integrada dentro de Logros */}
                  {isOwn&&owned.length>0&&(
                    <div style={{marginTop:32,paddingTop:24,borderTop:"1px solid rgba(255,255,255,.06)"}}>
                      <div style={{fontSize:8,color:"rgba(255,255,255,.22)",fontWeight:900,letterSpacing:"2.5px",marginBottom:18,textTransform:"uppercase"}}>📦 Tu colección · {owned.length} items</div>
                      {[{type:"avatar",label:"Avatares",icon:"🧑"},{type:"frame",label:"Marcos",icon:"🖼"},{type:"title",label:"Títulos",icon:"📛"},{type:"badge",label:"Insignias",icon:"⚡"}].map(({type,label,icon})=>{
                        const its=allItems.filter(i=>i.type===type&&owned.includes(i.key)); if(!its.length)return null;
                        return <div key={type} style={{marginBottom:20}}>
                          <div style={{fontSize:8,fontWeight:900,letterSpacing:"4px",textTransform:"uppercase",color:"rgba(var(--brand-accent-rgb),.65)",marginBottom:13,display:"flex",alignItems:"center",gap:8}}><span style={{width:18,height:1,background:"linear-gradient(90deg,var(--brand-accent, #ff5500),transparent)"}}/>{icon} {label} <span style={{color:"rgba(255,255,255,.18)",fontSize:7}}>({its.length})</span></div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:9}}>
                            {its.map(item=><ItemCard key={item.key} item={item} owned equipped={type==="badge"?(equip.badges?.includes(item.key)):equip[type+"_key"]===item.key} onBuy={handleBuy} onEquip={handleEquip} loading={buying}/>)}
                          </div>
                        </div>;
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* PERSONALIZAR — agrupa perfil/studio/powers/tienda en sub-tabs */}
              {panel==="personalizar"&&isOwn&&(
                <div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:22,padding:"4px 6px",background:"rgba(255,255,255,.025)",border:"1px solid rgba(var(--brand-primary-rgb),.08)",width:"fit-content"}}>
                    {PERSONALIZE_SUBTABS.map(t=>{
                      const on=subPanel===t.id;
                      return <button key={t.id} onClick={()=>setSubPanel(t.id)} style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 18px",cursor:"pointer",border:"none",fontFamily:"'Gotham', sans-serif",fontSize:11,fontWeight:800,letterSpacing:"2px",textTransform:"uppercase",background:on?"var(--brand-primary, #f5e03a)":"transparent",color:on?"#000":"rgba(240,236,227,.45)",transition:"all .25s"}}>
                        <span style={{fontSize:14}}>{t.icon}</span>{t.label}
                      </button>;
                    })}
                  </div>
                  {subPanel==="perfil"&&(
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:22}}>
                      <div>
                        <div style={{fontSize:8,fontWeight:900,letterSpacing:"4px",textTransform:"uppercase",color:"rgba(var(--brand-accent-rgb),.65)",marginBottom:13,display:"flex",alignItems:"center",gap:10}}><span style={{width:18,height:1,background:"linear-gradient(90deg,var(--brand-accent, #ff5500),transparent)"}}/>Avatar</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginBottom:22}}>
                          {allItems.filter(i=>i.type==="avatar"&&owned.includes(i.key)).map(item=><ItemCard key={item.key} item={item} owned readOnly={!isOwn} equipped={equip.avatar_key===item.key} onBuy={handleBuy} onEquip={handleEquip} loading={buying}/>)}
                        </div>
                      </div>
                      <div>
                        {["frame","title","badge"].map(type=>{
                          const its=allItems.filter(i=>i.type===type&&owned.includes(i.key)); if(!its.length)return null;
                          return <div key={type} style={{marginBottom:20}}>
                            <div style={{fontSize:8,fontWeight:900,letterSpacing:"4px",textTransform:"uppercase",color:"rgba(var(--brand-accent-rgb),.65)",marginBottom:13,display:"flex",alignItems:"center",gap:8}}><span style={{width:18,height:1,background:"linear-gradient(90deg,var(--brand-accent, #ff5500),transparent)"}}/>{type==="frame"?"Marcos":type==="title"?"Títulos":"Insignias"}{type==="badge"&&<span style={{color:"rgba(255,255,255,.2)",fontSize:7}}>({equip.badges?.length||0}/4)</span>}</div>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9}}>
                              {its.map(item=><ItemCard key={item.key} item={item} owned readOnly={!isOwn} equipped={type==="badge"?(equip.badges?.includes(item.key)):equip[type+"_key"]===item.key} onBuy={handleBuy} onEquip={handleEquip} loading={buying}/>)}
                            </div>
                          </div>;
                        })}
                      </div>
                    </div>
                  )}
                  {subPanel==="studio"&&<ProfileStudio key={profile.profile?.updated_at||"studio"} me={profile.user} profile={profile.profile} coins={profile.coins} shopItems={allItems} onSave={load} chatPowersOwned={chatPowers.filter(p=>p.owned).map(p=>p.slug)}/>}
                  {subPanel==="powers"&&(
                    <div>
                      <div style={{fontSize:8,color:"rgba(255,255,255,.18)",fontWeight:900,letterSpacing:"2.5px",marginBottom:16}}>{chatPowers.filter(p=>p.owned).length} POWERS ACTIVOS</div>
                      {chatPowers.filter(p=>p.owned).length===0?(
                        <div style={{padding:"60px 20px",textAlign:"center"}}>
                          <div style={{fontSize:46,marginBottom:14,animation:"float 3s ease-in-out infinite"}}>⚡</div>
                          <div style={{fontSize:10,fontWeight:900,letterSpacing:"3px",textTransform:"uppercase",color:"rgba(255,255,255,.2)",marginBottom:16}}>No tenés Powers</div>
                          <a href="/chat" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 22px",background:"rgba(190,242,100,.08)",border:"1px solid rgba(190,242,100,.18)",borderRadius:11,color:"#bef264",fontSize:10,fontWeight:900,letterSpacing:"1px",textDecoration:"none"}}>⚡ Ir al chat →</a>
                        </div>
                      ):(
                        <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:18}}>
                          {chatPowers.filter(p=>p.owned).map(pw=>(
                            <div key={pw.slug} style={{background:"rgba(190,242,100,.035)",border:"1px solid rgba(190,242,100,.1)",borderRadius:13,padding:"13px 16px",display:"flex",alignItems:"center",gap:13,cursor:"pointer",transition:"all .22s",position:"relative",overflow:"hidden"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(190,242,100,.065)";e.currentTarget.style.transform="translateX(4px)"}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(190,242,100,.035)";e.currentTarget.style.transform=""}}>
                              <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:"linear-gradient(180deg,#bef264,#4ade80)",borderRadius:"0 2px 2px 0"}}/>
                              <div style={{width:40,height:40,borderRadius:11,background:"rgba(190,242,100,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{pw.icon}</div>
                              <div>
                                <div style={{fontSize:12,fontWeight:800,color:"#bef264",marginBottom:2}}>{pw.name}</div>
                                <div style={{fontSize:9,color:"rgba(255,255,255,.3)"}}>{pw.description}</div>
                              </div>
                              <div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 9px #22c55e",marginLeft:"auto",flexShrink:0}}/>
                            </div>
                          ))}
                        </div>
                      )}
                      {chatPowers.filter(p=>p.owned).length>0&&<div style={{textAlign:"center"}}><a href="/chat" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 22px",background:"rgba(190,242,100,.07)",border:"1px solid rgba(190,242,100,.17)",borderRadius:11,color:"#bef264",fontSize:9,fontWeight:900,letterSpacing:"1px",textDecoration:"none"}}>⚡ Configurar en el chat →</a></div>}
                    </div>
                  )}
                  {subPanel==="tienda"&&(
                    <div>
                      <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:20,alignItems:"center"}}>
                        {[["all","⭐ Todo"],["avatar","🧑 Avatares"],["frame","🖼 Marcos"],["title","📛 Títulos"],["badge","⚡ Insignias"]].map(([v,l])=>(
                          <button key={v} onClick={()=>setTypeFilter(v)} style={{padding:"7px 16px",borderRadius:100,fontSize:8,fontWeight:900,letterSpacing:"2px",textTransform:"uppercase",cursor:"pointer",transition:"all .22s",border:typeFilter===v?"none":"1px solid rgba(255,255,255,.08)",background:typeFilter===v?"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))":"rgba(255,255,255,.03)",color:typeFilter===v?"#000":"rgba(255,255,255,.35)",boxShadow:typeFilter===v?"0 4px 18px rgba(var(--brand-primary-rgb),.35)":"none"}}>{l}</button>
                        ))}
                        <span style={{marginLeft:"auto",fontSize:9,color:"rgba(255,255,255,.22)",fontWeight:700}}>🪙 {(profile?.coins?.balance||0).toLocaleString()} disp.</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
                        {filtered.map(item=><ItemCard key={item.key} item={item} owned={owned.includes(item.key)} equipped={item.type==="badge"?(equip.badges?.includes(item.key)):equip[item.type+"_key"]===item.key} onBuy={handleBuy} onEquip={handleEquip} loading={buying}/>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {panel==="tienda"&&isOwn&&(
                <div>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:20,alignItems:"center"}}>
                    {[["all","⭐ Todo"],["avatar","🧑 Avatares"],["frame","🖼 Marcos"],["title","📛 Títulos"],["badge","⚡ Insignias"]].map(([v,l])=>(
                      <button key={v} onClick={()=>setTypeFilter(v)} style={{padding:"7px 16px",borderRadius:100,fontSize:8,fontWeight:900,letterSpacing:"2px",textTransform:"uppercase",cursor:"pointer",transition:"all .22s",border:typeFilter===v?"none":"1px solid rgba(255,255,255,.08)",background:typeFilter===v?"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))":"rgba(255,255,255,.03)",color:typeFilter===v?"#000":"rgba(255,255,255,.35)",boxShadow:typeFilter===v?"0 4px 18px rgba(var(--brand-primary-rgb),.35)":"none"}}>{l}</button>
                    ))}
                    <span style={{marginLeft:"auto",fontSize:9,color:"rgba(255,255,255,.22)",fontWeight:700}}>🪙 {(profile?.coins?.balance||0).toLocaleString()} disp.</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12}}>
                    {filtered.map(item=><ItemCard key={item.key} item={item} owned={owned.includes(item.key)} equipped={item.type==="badge"?(equip.badges?.includes(item.key)):equip[item.type+"_key"]===item.key} onBuy={handleBuy} onEquip={handleEquip} loading={buying}/>)}
                  </div>
                </div>
              )}

              {panel==="powers"&&isOwn&&(
                <div>
                  <div style={{fontSize:8,color:"rgba(255,255,255,.18)",fontWeight:900,letterSpacing:"2.5px",marginBottom:16}}>{chatPowers.filter(p=>p.owned).length} POWERS ACTIVOS</div>
                  {chatPowers.filter(p=>p.owned).length===0?(
                    <div style={{padding:"60px 20px",textAlign:"center"}}>
                      <div style={{fontSize:46,marginBottom:14,animation:"float 3s ease-in-out infinite"}}>⚡</div>
                      <div style={{fontSize:10,fontWeight:900,letterSpacing:"3px",textTransform:"uppercase",color:"rgba(255,255,255,.2)",marginBottom:16}}>No tenés Powers</div>
                      <a href="/chat" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 22px",background:"rgba(190,242,100,.08)",border:"1px solid rgba(190,242,100,.18)",borderRadius:11,color:"#bef264",fontSize:10,fontWeight:900,letterSpacing:"1px",textDecoration:"none"}}>⚡ Ir al chat →</a>
                    </div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:18}}>
                      {chatPowers.filter(p=>p.owned).map(pw=>(
                        <div key={pw.slug} style={{background:"rgba(190,242,100,.035)",border:"1px solid rgba(190,242,100,.1)",borderRadius:13,padding:"13px 16px",display:"flex",alignItems:"center",gap:13,cursor:"pointer",transition:"all .22s",position:"relative",overflow:"hidden"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(190,242,100,.065)";e.currentTarget.style.transform="translateX(4px)"}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(190,242,100,.035)";e.currentTarget.style.transform=""}}>
                          <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:"linear-gradient(180deg,#bef264,#4ade80)",borderRadius:"0 2px 2px 0"}}/>
                          <div style={{width:40,height:40,borderRadius:11,background:"rgba(190,242,100,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{pw.icon}</div>
                          <div>
                            <div style={{fontSize:12,fontWeight:800,color:"#bef264",marginBottom:2}}>{pw.name}</div>
                            <div style={{fontSize:9,color:"rgba(255,255,255,.3)"}}>{pw.description}</div>
                          </div>
                          <div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 9px #22c55e",marginLeft:"auto",flexShrink:0}}/>
                        </div>
                      ))}
                    </div>
                  )}
                  {chatPowers.filter(p=>p.owned).length>0&&<div style={{textAlign:"center"}}><a href="/chat" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 22px",background:"rgba(190,242,100,.07)",border:"1px solid rgba(190,242,100,.17)",borderRadius:11,color:"#bef264",fontSize:9,fontWeight:900,letterSpacing:"1px",textDecoration:"none"}}>⚡ Configurar en el chat →</a></div>}
                </div>
              )}

              {panel==="coleccion"&&isOwn&&(
                <div>
                  <div style={{fontSize:8,color:"rgba(255,255,255,.18)",fontWeight:900,letterSpacing:"2.5px",marginBottom:18}}>{owned.length} ITEMS EN TU COLECCIÓN</div>
                  {[{type:"avatar",label:"Avatares",icon:"🧑"},{type:"frame",label:"Marcos",icon:"🖼"},{type:"title",label:"Títulos",icon:"📛"},{type:"badge",label:"Insignias",icon:"⚡"}].map(({type,label,icon})=>{
                    const its=allItems.filter(i=>i.type===type&&owned.includes(i.key)); if(!its.length)return null;
                    return <div key={type} style={{marginBottom:24}}>
                      <div style={{fontSize:8,fontWeight:900,letterSpacing:"4px",textTransform:"uppercase",color:"rgba(var(--brand-accent-rgb),.65)",marginBottom:13,display:"flex",alignItems:"center",gap:8}}><span style={{width:18,height:1,background:"linear-gradient(90deg,var(--brand-accent, #ff5500),transparent)"}}/>{icon} {label} <span style={{color:"rgba(255,255,255,.18)",fontSize:7}}>({its.length})</span></div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:9}}>
                        {its.map(item=><ItemCard key={item.key} item={item} owned equipped={type==="badge"?(equip.badges?.includes(item.key)):equip[type+"_key"]===item.key} onBuy={handleBuy} onEquip={handleEquip} loading={buying}/>)}
                      </div>
                    </div>;
                  })}
                </div>
              )}

              {panel==="studio"&&isOwn&&<ProfileStudio key={profile.profile?.updated_at||"studio"} me={profile.user} profile={profile.profile} coins={profile.coins} shopItems={allItems} onSave={load} chatPowersOwned={chatPowers.filter(p=>p.owned).map(p=>p.slug)}/>}

              {panel==="privacidad"&&isOwn&&(
                <div>
                  <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",borderRadius:20,overflow:"hidden",marginBottom:16}}>
                    <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,.05)",display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:40,height:40,borderRadius:12,background:"rgba(var(--brand-primary-rgb),.1)",border:"1px solid rgba(var(--brand-primary-rgb),.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🔐</div>
                      <div><div style={{fontSize:13,fontWeight:800,color:"#e2e8f0"}}>Visibilidad del perfil</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)",marginTop:2}}>Controlá qué ven los demás cuando visitan tu perfil</div></div>
                    </div>
                    <PrivacyToggle label="Mis envíos" desc="Cantidad de envíos totales, entregados y monto USD importado" icon="📦" iconBg="rgba(96,165,250,.1)" iconBorder="rgba(96,165,250,.18)" value={privacy.envios} onChange={async()=>{const v=!privacy.envios;setPrivacy(p=>({...p,envios:v}));showToast(v?"👁 Visible":"🔒 Oculto",v?"#22c55e":"var(--brand-primary, #f5e03a)");try{const tok=localStorage.getItem("token")||sessionStorage.getItem("token");await fetch(API+"/profile",{method:"PATCH",headers:{"Authorization":"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify({privacy_envios:v})});}catch(e){console.error(e);}}}/>
                    <PrivacyToggle label="Coins" desc="Balance actual y total de coins ganados" icon="🪙" iconBg="rgba(var(--brand-primary-rgb),.1)" iconBorder="rgba(var(--brand-primary-rgb),.18)" value={privacy.coins} onChange={async()=>{const v=!privacy.coins;setPrivacy(p=>({...p,coins:v}));showToast(v?"👁 Visible":"🔒 Oculto",v?"#22c55e":"var(--brand-primary, #f5e03a)");try{const tok=localStorage.getItem("token")||sessionStorage.getItem("token");await fetch(API+"/profile",{method:"PATCH",headers:{"Authorization":"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify({privacy_coins:v})});}catch(e){console.error(e);}}}/>
                    <PrivacyToggle label="Logros" desc="Insignias desbloqueadas y progreso de achievements" icon="🏆" iconBg="rgba(var(--brand-primary-rgb),.1)" iconBorder="rgba(var(--brand-primary-rgb),.18)" value={privacy.logros} onChange={async()=>{const v=!privacy.logros;setPrivacy(p=>({...p,logros:v}));showToast(v?"👁 Visible":"🔒 Oculto",v?"#22c55e":"var(--brand-primary, #f5e03a)");try{const tok=localStorage.getItem("token")||sessionStorage.getItem("token");await fetch(API+"/profile",{method:"PATCH",headers:{"Authorization":"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify({privacy_logros:v})});}catch(e){console.error(e);}}}/>
                    <PrivacyToggle label="Posts" desc="Feed de publicaciones y actividad reciente" icon="📝" iconBg="rgba(167,139,250,.1)" iconBorder="rgba(167,139,250,.18)" value={privacy.posts} onChange={async()=>{const v=!privacy.posts;setPrivacy(p=>({...p,posts:v}));showToast(v?"👁 Visible":"🔒 Oculto",v?"#22c55e":"var(--brand-primary, #f5e03a)");try{const tok=localStorage.getItem("token")||sessionStorage.getItem("token");await fetch(API+"/profile",{method:"PATCH",headers:{"Authorization":"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify({privacy_posts:v})});}catch(e){console.error(e);}}}/>
                    <PrivacyToggle label="Lista de amigos" desc="Quién puede ver tus conexiones y amigos" icon="👥" iconBg="rgba(34,197,94,.1)" iconBorder="rgba(34,197,94,.18)" value={privacy.amigos} onChange={async()=>{const v=!privacy.amigos;setPrivacy(p=>({...p,amigos:v}));showToast(v?"👁 Visible":"🔒 Oculto",v?"#22c55e":"var(--brand-primary, #f5e03a)");try{const tok=localStorage.getItem("token")||sessionStorage.getItem("token");await fetch(API+"/profile",{method:"PATCH",headers:{"Authorization":"Bearer "+getToken(),"Content-Type":"application/json"},body:JSON.stringify({privacy_amigos:v})});}catch(e){console.error(e);}}}/>
                  </div>
                  <div style={{padding:"13px 18px",background:"rgba(var(--brand-primary-rgb),.06)",border:"1px solid rgba(var(--brand-primary-rgb),.15)",borderRadius:14,fontSize:11,color:"rgba(255,255,255,.42)",lineHeight:1.6}}>
                    💡 Los cambios se aplican <span style={{color:"var(--brand-primary, #f5e03a)",fontWeight:800}}>inmediatamente</span>. Los datos ocultos solo los ves vos.
                  </div>
                  <ConnectedDevicesPanel />
                </div>
              )}

              {msg&&<div style={{marginTop:16,padding:"11px 16px",borderRadius:10,background:"rgba(var(--brand-accent-rgb),.1)",border:"1px solid rgba(var(--brand-accent-rgb),.25)",color:"var(--brand-accent, #ff8c2a)",fontSize:13,fontWeight:700}}>{msg}</div>}
            </div>
          </div>

          {/* ── DOCK ── */}
          <div className="pf-dock" style={{width:dockOpen?220:58,transition:"width .3s cubic-bezier(.4,0,.2,1)",display:"flex",flexDirection:"column",gap:6,position:"sticky",top:14,flexShrink:0}}>
            <button onClick={()=>setDockOpen(o=>!o)} className="pf-dock-toggle" style={{width:"100%",borderRadius:12,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",padding:"10px 13px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"all .22s",marginBottom:4}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.07)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.04)"}>
              <span style={{fontSize:15,flexShrink:0,transition:"transform .3s",transform:dockOpen?"rotate(180deg)":"rotate(0deg)"}}>◀</span>
              <span style={{fontSize:9,fontWeight:900,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(255,255,255,.3)",opacity:dockOpen?1:0,transition:"opacity .2s .05s",whiteSpace:"nowrap"}}>MENÚ</span>
            </button>
            {DOCK_ITEMS.filter(d=>isOwn||["posts","logros"].includes(d.id)).map(item=>(
              <Pop key={item.id} onClick={()=>setPanel(item.id)} className="pf-dock-item" hoverScale={1.02} style={{borderRadius:14,overflow:"hidden",cursor:"pointer",border:panel===item.id?"1px solid rgba(var(--brand-primary-rgb),.22)":"1px solid rgba(255,255,255,.07)",background:panel===item.id?"rgba(var(--brand-primary-rgb),.08)":"rgba(255,255,255,.04)",position:"relative"}}
                onMouseEnter={e=>{if(panel!==item.id){e.currentTarget.style.background="rgba(var(--brand-primary-rgb),.05)";e.currentTarget.style.borderColor="rgba(var(--brand-primary-rgb),.15)";}}} onMouseLeave={e=>{if(panel!==item.id){e.currentTarget.style.background="rgba(255,255,255,.04)";e.currentTarget.style.borderColor="rgba(255,255,255,.07)";}}}
              >
                {panel===item.id&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:"linear-gradient(180deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))",borderRadius:"0 2px 2px 0"}}/>}
                <div style={{display:"flex",alignItems:"center",gap:12,padding:13,minHeight:48,whiteSpace:"nowrap",overflow:"hidden"}}>
                  <span style={{fontSize:18,flexShrink:0,width:22,textAlign:"center",filter:panel===item.id?"drop-shadow(0 0 6px var(--brand-primary, #f5e03a))":undefined}}>{item.icon}</span>
                  <span style={{fontSize:10,fontWeight:800,letterSpacing:"1.5px",textTransform:"uppercase",color:panel===item.id?"var(--brand-primary, #f5e03a)":"rgba(255,255,255,.45)",opacity:dockOpen?1:0,transform:dockOpen?"translateX(0)":"translateX(-8px)",transition:"all .25s",pointerEvents:"none",flex:1}}>{item.label}</span>
                  {item.badge&&dockOpen&&<span style={{fontSize:9,fontWeight:900,background:"rgba(var(--brand-primary-rgb),.15)",border:"1px solid rgba(var(--brand-primary-rgb),.25)",borderRadius:100,padding:"1px 7px",color:"var(--brand-primary, #f5e03a)",flexShrink:0,opacity:dockOpen?1:0,transition:"all .25s .1s"}}>{item.badge}</span>}
                </div>
              </Pop>
            ))}
          </div>
        </div>
      </div>
        </div>
      </div>

      <AnimatePresence>
        {showStories && storyGroup && (
          <StoryViewer
            buckets={[{
              kind: "user",
              key: `u-${storyGroup.user_id}`,
              user: storyGroup,
              stories: storyGroup.stories.map(s => ({
                kind: "user",
                story_id: s.id,
                image: s.image_url,
                caption: s.caption,
                bg_color: s.bg_color,
                created_at: s.created_at,
              })),
            }]}
            startBucket={0}
            startStory={0}
            onClose={() => setShowStories(false)}
            onStoryDeleted={() => {
              fetch(API+"/api/chat/stories/user/"+storyGroup.user_id, {headers:getHdrs()})
                .then(r=>r.json()).then(d=>{
                  if (d.ok && d.group) setStoryGroup(d.group);
                  else { setStoryGroup(null); setShowStories(false); }
                }).catch(()=>{});
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
