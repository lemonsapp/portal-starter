// ProfileStudio.jsx
import { useState, useEffect, useRef } from "react";
import { useUser } from "../context/UserContext.jsx";
const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
const hdrs = () => ({ Authorization: "Bearer " + getToken(), "Content-Type": "application/json" });
const PALETTE = ["var(--brand-primary, #f5e03a)","var(--brand-accent, #ff5500)","#ff3300","#22c55e","#60a5fa","#a78bfa","#f472b6","#e11d48","#0ea5e9","#14b8a6","#06b6d4","#ffffff","#ede9e0","#000000"];
const EMOJIS  = ["⚡","🔥","🪙","💎","👑","🌟","🏆","💀","🐋","🌈","❄","🚀","🎯","💜","🖤","⭐","🌀","👾","🎮","🎪"];
const BANNER_EFFECTS = [
  { id:"none",       name:"Ninguno",    icon:"⬜" },
  { id:"lemon_rain", name:"Limones",    icon:"🪙" },
  { id:"lightning",  name:"Tormenta",   icon:"⚡" },
  { id:"fire",       name:"Fuego",      icon:"🔥" },
  { id:"snow",       name:"Nieve",      icon:"❄"  },
  { id:"stars",      name:"Estrellas",  icon:"✨" },
  { id:"matrix",     name:"Matrix",     icon:"👾" },
  { id:"rainbow",    name:"Arcoíris",   icon:"🌈" },
  { id:"aurora",     name:"Aurora",     icon:"🌌" },
  { id:"cyber",      name:"Cyber",      icon:"💻" },
  { id:"ocean",      name:"Océano",     icon:"🌊" },
  { id:"pulse",      name:"Pulso",      icon:"💓" },
  { id:"vortex",     name:"Vórtice",    icon:"🌀" },
];

export function BannerCanvas({ effect, color1, color2, height=120 }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const psRef     = useRef([]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = canvas.parentElement?.offsetWidth||500; canvas.height = height; };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    const count = effect==="none"?0:60;
    psRef.current = Array.from({length:count},()=>({
      x:Math.random()*(canvas.width||500), y:Math.random()*height,
      vx:(Math.random()-.5)*1.2,
      vy:["lemon_rain","snow"].includes(effect)?Math.random()*2+.5:(Math.random()-.5)*1.2,
      size:Math.random()*12+6, opacity:Math.random()*.8+.2,
      phase:Math.random()*Math.PI*2, speed:Math.random()*.03+.01,
      char:effect==="matrix"?String.fromCharCode(0x30A0+Math.random()*96):null,
      angle:Math.random()*Math.PI*2,
    }));
    let t=0;
    function draw() {
      const w=canvas.width,h=canvas.height; ctx.clearRect(0,0,w,h);
      // background
      if(effect==="aurora"){
        const bg=ctx.createLinearGradient(0,0,w,h); bg.addColorStop(0,"#040110"); bg.addColorStop(1,"#0a0820"); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
        [[w*.1,h*.3,color1,.14],[w*.5,h*.2,"#8b5cf6",.11],[w*.8,h*.5,color2,.09],[w*.3,h*.7,"var(--brand-primary, #f5e03a)",.07]].forEach(([x,y,c,a])=>{
          const g=ctx.createRadialGradient(x,y,0,x,y,w*.28); g.addColorStop(0,c+(Math.round(a*255).toString(16).padStart(2,"0"))); g.addColorStop(1,"transparent"); ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
        });
      } else if(effect==="cyber"){
        ctx.fillStyle="#000a0f"; ctx.fillRect(0,0,w,h); ctx.strokeStyle="rgba(0,255,180,.07)"; ctx.lineWidth=.8;
        for(let x=0;x<w;x+=44){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();} for(let y=0;y<h;y+=44){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      } else if(effect==="ocean"){
        const bg=ctx.createLinearGradient(0,0,0,h); bg.addColorStop(0,"#000c18"); bg.addColorStop(1,"#001224"); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
      } else if(effect==="pulse"){
        const bg=ctx.createLinearGradient(0,0,w,h); bg.addColorStop(0,color1+"18"); bg.addColorStop(1,color2+"08"); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
        ctx.strokeStyle="rgba(237,233,224,.018)"; ctx.lineWidth=1; for(let x=0;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();} for(let y=0;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      } else if(effect==="vortex"){
        const bg=ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w*.6); bg.addColorStop(0,color1+"22"); bg.addColorStop(.5,color2+"11"); bg.addColorStop(1,"#03040c"); ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
      } else {
        const g=ctx.createLinearGradient(0,0,w,h); g.addColorStop(0,color1+"22"); g.addColorStop(1,color2+"11"); ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
        ctx.strokeStyle="rgba(237,233,224,.018)"; ctx.lineWidth=1; for(let x=0;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();} for(let y=0;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      }
      psRef.current.forEach((p,i)=>{
        t++; p.x+=p.vx; p.y+=p.vy; p.phase+=p.speed; p.angle+=.02;
        if(p.y>h+16)p.y=-16; if(p.y<-16)p.y=h+16; if(p.x>w+16)p.x=-16; if(p.x<-16)p.x=w+16;
        const a=(Math.sin(p.phase)*.3+.7)*p.opacity; ctx.globalAlpha=a;
        if(effect==="lemon_rain"){ctx.font=`${p.size}px serif`;ctx.fillText("🪙",p.x,p.y);}
        else if(effect==="lightning"){ctx.strokeStyle=color1;ctx.lineWidth=Math.random()<.03?2:.5;ctx.shadowColor=color1;ctx.shadowBlur=6;ctx.beginPath();let lx=p.x,ly=0;for(let s=0;s<8;s++){const nx=lx+(Math.random()-.5)*28,ny=ly+h/8;ctx.moveTo(lx,ly);ctx.lineTo(nx,ny);lx=nx;ly=ny;}ctx.stroke();ctx.shadowBlur=0;}
        else if(effect==="fire"){const fr=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,12+Math.sin(p.phase*3)*6);fr.addColorStop(0,"var(--brand-primary, #f5e03a)");fr.addColorStop(.5,"var(--brand-accent, #ff5500)");fr.addColorStop(1,"transparent");ctx.fillStyle=fr;ctx.beginPath();ctx.arc(p.x,p.y,14,0,Math.PI*2);ctx.fill();}
        else if(effect==="snow"){ctx.fillStyle="#bae6fd";ctx.beginPath();ctx.arc(p.x,p.y,p.size/5,0,Math.PI*2);ctx.fill();}
        else if(effect==="stars"){ctx.fillStyle=color1;ctx.shadowColor=color1;ctx.shadowBlur=6;ctx.beginPath();ctx.arc(p.x,p.y,p.size/3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
        else if(effect==="matrix"){ctx.fillStyle="#22c55e";ctx.font=`${p.size*.75}px monospace`;if(Math.random()<.01)p.char=String.fromCharCode(0x30A0+Math.random()*96);ctx.fillText(p.char||"0",p.x,p.y);}
        else if(effect==="rainbow"){ctx.fillStyle=`hsla(${(t*.4+i*6)%360},75%,60%,${a})`;ctx.beginPath();ctx.arc(p.x,p.y,p.size/3.5,0,Math.PI*2);ctx.fill();}
        else if(effect==="aurora"){const r=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size*2);r.addColorStop(0,color1+"44");r.addColorStop(1,"transparent");ctx.fillStyle=r;ctx.fillRect(0,0,w,h);}
        else if(effect==="cyber"){const x=((i*w/60)+t*38)%w;const gx=ctx.createRadialGradient(x,h/2,0,x,h/2,44);gx.addColorStop(0,"rgba(0,255,180,.16)");gx.addColorStop(1,"transparent");ctx.fillStyle=gx;ctx.fillRect(x-44,0,88,h);}
        else if(effect==="ocean"){ctx.beginPath();ctx.moveTo(0,h*.4+i%7*10);for(let x=0;x<=w;x+=3)ctx.lineTo(x,h*.4+(i%7)*10+Math.sin(x*.008+t*.014+i*.6)*18);ctx.strokeStyle=`rgba(6,182,212,${.04+(i%7)*.013})`;ctx.lineWidth=2+(i%7)*.4;ctx.stroke();}
        else if(effect==="pulse"){const r=Math.abs(Math.sin(t*.014+i*.3))*h*.4+5;const gr=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);gr.addColorStop(0,color1+"33");gr.addColorStop(1,"transparent");ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);}
        else if(effect==="vortex"){const angle=p.angle;const r=20+i*2;const x=w/2+Math.cos(angle+t*.008)*r,y=h/2+Math.sin(angle+t*.008)*r*.5;ctx.fillStyle=color1;ctx.shadowColor=color1;ctx.shadowBlur=4;ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
        ctx.globalAlpha=1;
      });
      animRef.current=requestAnimationFrame(draw);
    }
    draw();
    return ()=>{if(animRef.current)cancelAnimationFrame(animRef.current);ro.disconnect();};
  },[effect,color1,color2,height]);
  return <canvas ref={canvasRef} style={{width:"100%",height:height+"px",display:"block",borderRadius:10}}/>;
}

function ColorPicker({ value, onChange, label }) {
  return (
    <div>
      {label&&<div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.4)",marginBottom:8}}>{label}</div>}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
        {PALETTE.map(c=><div key={c} onClick={()=>onChange(c)} style={{width:22,height:22,borderRadius:"50%",background:c,cursor:"pointer",border:value===c?"2px solid #fff":"2px solid transparent",boxShadow:value===c?"0 0 6px "+c:"none",transition:"all .15s",flexShrink:0}}/>)}
      </div>
      <div style={{display:"flex",gap:8}}>
        <input type="color" value={value} onChange={e=>onChange(e.target.value)} style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(237,233,224,.15)",background:"none",cursor:"pointer",padding:2}}/>
        <input type="text" value={value} onChange={e=>onChange(e.target.value)} maxLength={7} style={{width:80,background:"rgba(255,255,255,.05)",border:"1px solid rgba(237,233,224,.12)",borderRadius:8,color:"#ede9e0",fontSize:11,padding:"6px 10px",outline:"none"}}/>
      </div>
    </div>
  );
}

function LockOverlay({ cost, label, onUnlock, coins, loading }) {
  const ok=coins>=cost;
  return (
    <div style={{position:"absolute",inset:0,borderRadius:"inherit",background:"rgba(4,6,13,.85)",backdropFilter:"blur(4px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:10,gap:12}}>
      <div style={{fontSize:32}}>🔒</div>
      <div style={{fontSize:18,fontWeight:800,color:"#ede9e0",textAlign:"center"}}>{label}</div>
      <div style={{fontSize:11,color:ok?"var(--brand-primary, #f5e03a)":"rgba(237,233,224,.35)"}}>🪙 {cost} coins</div>
      {!ok&&<div style={{fontSize:9,color:"rgba(var(--brand-accent-rgb),.7)"}}>Te faltan {cost-coins} coins</div>}
      <button onClick={onUnlock} disabled={!ok||loading} style={{fontSize:12,fontWeight:800,letterSpacing:"1.5px",textTransform:"uppercase",padding:"10px 24px",borderRadius:8,border:"none",background:ok?"var(--brand-primary, #f5e03a)":"rgba(237,233,224,.1)",color:ok?"#04060d":"rgba(237,233,224,.3)",cursor:ok?"pointer":"not-allowed",opacity:loading?.7:1}}>
        {loading?"Desbloqueando...":ok?"⚡ Desbloquear":"Sin coins"}
      </button>
    </div>
  );
}

const BADGE_FX = {
  lightning:{css:(c)=>`@keyframes lb_${c.replace("#","")}{ 0%,100%{box-shadow:0 0 8px ${c},0 0 22px ${c}88}50%{box-shadow:0 0 4px ${c},0 0 10px ${c}44}}@keyframes lf{0%,100%{opacity:1}92%{opacity:1}93%{opacity:.3}95%{opacity:1}}`,wrap:(c)=>({animation:`lb_${c.replace("#","")} 1.6s ease-in-out infinite`,background:`linear-gradient(135deg,${c}22,${c}08)`,border:`1.5px solid ${c}70`}),text:(c)=>({animation:"lf 3s linear infinite",color:c}),emoji:"none"},
  fire:{css:()=>`@keyframes fg{0%,100%{box-shadow:0 0 8px var(--brand-accent, #ff5500)aa,0 0 20px var(--brand-accent, #ff5500)55}50%{box-shadow:0 0 16px var(--brand-accent, #ff5500)cc}}@keyframes fw{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.08)}}`,wrap:()=>({animation:"fg 1.8s ease-in-out infinite",background:"linear-gradient(135deg,rgba(var(--brand-accent-rgb),.2),rgba(var(--brand-primary-rgb),.08))",border:"1.5px solid rgba(var(--brand-accent-rgb),.6)"}),text:()=>({background:"linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500))",backgroundClip:"text",WebkitBackgroundClip:"text",color:"transparent"}),emoji:"fw 1.5s ease-in-out infinite"},
  glow:{css:(c)=>`@keyframes gl_${c.replace("#","")}{ 0%,100%{box-shadow:0 0 8px ${c}66,0 0 16px ${c}33}50%{box-shadow:0 0 16px ${c}99,0 0 32px ${c}55}}`,wrap:(c)=>({animation:`gl_${c.replace("#","")} 2s ease-in-out infinite`,background:`${c}15`,border:`1.5px solid ${c}50`}),text:(c)=>({color:c}),emoji:"none"},
  sparkle:{css:()=>`@keyframes sp{0%,100%{box-shadow:0 0 8px var(--brand-primary, #f5e03a)55,0 0 20px var(--brand-accent, #ff5500)33}33%{box-shadow:0 0 12px #a78bfa55}66%{box-shadow:0 0 10px var(--brand-primary, #f5e03a)77}}@keyframes spr{from{transform:rotate(0)}to{transform:rotate(360deg)}}`,wrap:()=>({animation:"sp 2.5s ease-in-out infinite",background:"linear-gradient(135deg,rgba(var(--brand-primary-rgb),.15),rgba(var(--brand-accent-rgb),.1))",border:"1.5px solid rgba(var(--brand-primary-rgb),.45)"}),text:()=>({background:"linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a))",backgroundClip:"text",WebkitBackgroundClip:"text",color:"transparent"}),emoji:"spr 4s linear infinite"},
  rainbow:{css:()=>`@keyframes rbf{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}@keyframes rbg{0%,100%{box-shadow:0 0 10px var(--brand-primary, #f5e03a)44}33%{box-shadow:0 0 10px #a78bfa44}66%{box-shadow:0 0 10px #22c55e44}}`,wrap:()=>({background:"linear-gradient(270deg,var(--brand-primary, #f5e03a)22,var(--brand-accent, #ff5500)22,#a78bfa22,#60a5fa22,#22c55e22,var(--brand-primary, #f5e03a)22)",backgroundSize:"400% 400%",animation:"rbf 4s ease infinite,rbg 3s ease-in-out infinite",border:"1.5px solid rgba(var(--brand-primary-rgb),.3)"}),text:()=>({background:"linear-gradient(90deg,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),#a78bfa,#60a5fa,#22c55e)",backgroundClip:"text",WebkitBackgroundClip:"text",color:"transparent"}),emoji:"none"},
  glitch:{css:(c)=>`@keyframes gg_${c.replace("#","")}{ 0%,100%{box-shadow:0 0 8px ${c}88,-2px 0 #ff000033,2px 0 #00ffff33}50%{box-shadow:0 0 16px ${c}aa,2px 0 #ff000055,-2px 0 #00ffff55}}`,wrap:(c)=>({animation:`gg_${c.replace("#","")} 0.8s ease-in-out infinite`,background:`${c}10`,border:`1.5px solid ${c}60`}),text:(c)=>({color:c}),emoji:"none"},
  lemon_rain:{css:(c)=>`@keyframes lr{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-4px) rotate(12deg)}}@keyframes lg_${c.replace("#","")}{ 0%,100%{box-shadow:0 0 10px ${c}88}50%{box-shadow:0 0 18px ${c}aa}}`,wrap:(c)=>({animation:`lg_${c.replace("#","")} 2s ease-in-out infinite`,background:`${c}15`,border:`1.5px solid ${c}55`}),text:(c)=>({color:c}),emoji:"lr 1.8s ease-in-out infinite"},
};

export function BadgePreview({ effect, color, emoji, text, size="normal" }) {
  const fx=BADGE_FX[effect]||BADGE_FX.glow; const sm=size==="small";
  return (<><style>{fx.css(color)}</style><div style={{display:"inline-flex",alignItems:"center",gap:sm?5:8,padding:sm?"4px 11px":"6px 16px",borderRadius:100,cursor:"default",userSelect:"none",fontSize:sm?9:11,letterSpacing:"2px",textTransform:"uppercase",...fx.wrap(color)}}><span style={{fontSize:sm?13:17,display:"inline-block",animation:fx.emoji!=="none"?fx.emoji:"none"}}>{emoji}</span><span style={{fontWeight:600,...fx.text(color)}}>{text||"BADGE"}</span></div></>);
}

export default function ProfileStudio({ me, profile, coins, onSave, shopItems=[], chatPowersOwned=[] }) {
  const isAdmin = me?.role==="admin";
  const balance = coins?.balance||0;
  const { reload: reloadCtx } = useUser() || {};
  const unlocked = profile?.features_unlocked||[];
  const hasBannerFree = isAdmin||unlocked.includes("banner_free");
  const hasBannerChange = isAdmin||chatPowersOwned.includes("bannerchange")||unlocked.includes("banner_change");

  const [tab,        setTab]       = useState("banners");
  const [chatPowers, setChatPowers]= useState([]);
  const [chatConfig, setChatConfig]= useState({});
  const [chatSaving, setChatSaving]= useState(false);
  const [saving,     setSaving]    = useState(false);
  const [unlocking,  setUnlocking] = useState(null);
  const [msg,        setMsg]       = useState("");

  useEffect(()=>{
    const token=getToken(); if(!token)return;
    fetch((import.meta.env.VITE_API_URL||"http://localhost:4000")+"/api/chat/powers",{headers:{Authorization:"Bearer "+token}}).then(r=>r.json()).then(d=>{if(d.ok)setChatPowers(d.powers.filter(p=>p.owned));});
    fetch((import.meta.env.VITE_API_URL||"http://localhost:4000")+"/api/chat/config",{headers:{Authorization:"Bearer "+token}}).then(r=>r.json()).then(d=>{if(d.ok)setChatConfig(d.config||{});});
  },[]);

  const [bannerFx,  setBannerFx]  = useState(profile?.banner_effect||"none");
  const [bannerC1,  setBannerC1]  = useState(profile?.banner_color1||"var(--brand-primary, #f5e03a)");
  const [bannerC2,  setBannerC2]  = useState(profile?.banner_color2||"var(--brand-accent, #ff5500)");

  // Sincronizar estados cuando profile cambia desde el padre
  useEffect(()=>{
    if(profile?.banner_effect) setBannerFx(profile.banner_effect);
    if(profile?.banner_color1) setBannerC1(profile.banner_color1);
    if(profile?.banner_color2) setBannerC2(profile.banner_color2);
  },[profile?.banner_effect, profile?.banner_color1, profile?.banner_color2]);
  const [badgeFx,   setBadgeFx]   = useState("lightning");
  const [badgeColor,setBadgeColor]= useState("var(--brand-primary, #f5e03a)");
  const [badgeEmoji,setBadgeEmoji]= useState("⚡");
  const [badgeText, setBadgeText] = useState("CUSTOM");
  const [badgeName, setBadgeName] = useState("Mi Badge");
  const [badgeDesc, setBadgeDesc] = useState("Badge personalizada");
  const [badgeRarity,setBadgeRarity]=useState("legendary");
  const [badgeCost, setBadgeCost] = useState(0);
  const [badgeDone, setBadgeDone] = useState(false);

  const ownedBanners = (profile?.owned_items||[]).filter(k=>k.startsWith("banner_"));
  const bannerPresets = shopItems.filter(i=>i.type==="banner");

  async function unlock(item_key){
    setUnlocking(item_key); setMsg("");
    try{const res=await fetch(API+"/profile/unlock",{method:"POST",headers:hdrs(),body:JSON.stringify({item_key})});const d=await res.json();if(res.ok){setMsg("Desbloqueado!");onSave&&onSave();}else setMsg(d.error||"Error");}catch{setMsg("Error de red");}
    setUnlocking(null);
  }
  async function saveBanner(){
    setSaving(true); setMsg("");
    try{const res=await fetch(API+"/profile/studio",{method:"POST",headers:hdrs(),body:JSON.stringify({banner_effect:bannerFx,banner_color1:bannerC1,banner_color2:bannerC2})});const d=await res.json();if(res.ok){setMsg("Banner guardado");setTimeout(()=>window.location.reload(),800);}else setMsg(d.error||"Error");}catch{setMsg("Error de red");}
    setSaving(false);
  }
  async function equipBanner(key){
    setSaving(true); setMsg("");
    try{const res=await fetch(API+"/profile/banner",{method:"PATCH",headers:hdrs(),body:JSON.stringify({banner_key:key})});const d=await res.json();if(res.ok){setMsg("Banner equipado");onSave&&onSave();}else setMsg(d.error||"Error");}catch{setMsg("Error de red");}
    setSaving(false);
  }
  async function buyBannerPreset(item){
    if(!confirm("Comprar "+item.name+" por "+item.cost_coins+" coins?"))return;
    setSaving(true); setMsg("");
    try{const res=await fetch(API+"/profile/unlock",{method:"POST",headers:hdrs(),body:JSON.stringify({item_key:item.key})});const d=await res.json();if(res.ok){setMsg(item.name+" desbloqueado!");onSave&&onSave();}else setMsg(d.error||"Error");}catch{setMsg("Error de red");}
    setSaving(false);
  }
  async function saveBadge(){
    setSaving(true); setMsg(""); setBadgeDone(false);
    try{const key="badge_custom_"+Date.now();const res=await fetch(API+"/profile/studio/badge",{method:"POST",headers:hdrs(),body:JSON.stringify({key,name:badgeName,description:badgeDesc,emoji:badgeEmoji,cost_coins:badgeCost,rarity:badgeRarity,data:{color:badgeColor,animated:true,effect:badgeFx}})});const d=await res.json();if(res.ok){setMsg("Badge creada!");setBadgeDone(true);}else setMsg(d.error||"Error");}catch{setMsg("Error de red");}
    setSaving(false);
  }

  const card=(children,style={})=>(<div style={{background:"#0b0f1e",border:"1px solid rgba(237,233,224,.08)",borderRadius:16,padding:"22px",...style}}>{children}</div>);
  const lbl=(t)=>(<div style={{fontSize:9,letterSpacing:"3px",textTransform:"uppercase",color:"var(--brand-accent, #ff5500)",marginBottom:14,display:"flex",alignItems:"center",gap:10}}><span style={{width:20,height:1,background:"var(--brand-accent, #ff5500)",display:"block"}}/>{t}</div>);
  const tabBtn=(id,icon,label)=>(<button onClick={()=>{setTab(id);setMsg("");}} style={{fontSize:12,fontWeight:800,letterSpacing:"1.5px",textTransform:"uppercase",padding:"8px 16px",borderRadius:8,cursor:"pointer",transition:"all .2s",background:tab===id?"rgba(var(--brand-primary-rgb),.12)":"transparent",border:`1px solid ${tab===id?"rgba(var(--brand-primary-rgb),.3)":"rgba(237,233,224,.08)"}`,color:tab===id?"var(--brand-primary, #f5e03a)":"rgba(237,233,224,.45)"}}>{icon} {label}</button>);

  return (
    <div>
      <style>{`
        @keyframes studioshine{0%,100%{box-shadow:0 0 20px rgba(var(--brand-primary-rgb),.06)}50%{box-shadow:0 0 40px rgba(var(--brand-primary-rgb),.14)}}
        input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:100px;background:rgba(237,233,224,.1);outline:none;width:100%}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--brand-primary, #f5e03a);cursor:pointer;box-shadow:0 0 8px rgba(var(--brand-primary-rgb),.5)}
        .eff-btn{transition:all .2s;cursor:pointer}.eff-btn:hover{transform:translateY(-2px)}
        .bp{transition:all .2s;cursor:pointer}.bp:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,.3)}
      `}</style>

      <div style={{padding:"18px 22px",background:"linear-gradient(135deg,rgba(var(--brand-primary-rgb),.06),rgba(var(--brand-accent-rgb),.03))",border:"1px solid rgba(var(--brand-primary-rgb),.12)",borderRadius:14,marginBottom:20,display:"flex",alignItems:"center",gap:14,animation:"studioshine 3s ease-in-out infinite"}}>
        <div style={{fontSize:32}}>⚡</div>
        <div style={{flex:1}}>
          <div style={{fontSize:22,fontWeight:900,letterSpacing:3,color:"var(--brand-primary, #f5e03a)"}}>PROFILE STUDIO</div>
          <div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.35)",marginTop:1}}>Personalizá tu perfil</div>
        </div>
        <div style={{fontSize:10,color:"var(--brand-primary, #f5e03a)",textAlign:"right"}}>
          <div style={{fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(237,233,224,.35)",marginBottom:2}}>Saldo</div>
          <div>🪙 {balance.toLocaleString()}</div>
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:22,flexWrap:"wrap"}}>
        {tabBtn("banners","🖼","Banners")}
        {tabBtn("chat","💬","Chat")}
        {isAdmin&&tabBtn("badges","⚡","Crear Badge")}
      </div>

      {msg&&<div style={{marginBottom:16,padding:"11px 16px",borderRadius:10,background:msg.includes("Error")||msg.includes("error")?"rgba(var(--brand-accent-rgb),.1)":"rgba(34,197,94,.1)",border:"1px solid "+(msg.includes("Error")||msg.includes("error")?"rgba(var(--brand-accent-rgb),.25)":"rgba(34,197,94,.25)"),color:msg.includes("Error")||msg.includes("error")?"var(--brand-accent, #ff8c2a)":"#4ade80",fontSize:14,fontWeight:700}}>{msg}</div>}

      {tab==="banners"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{position:"relative",borderRadius:16,overflow:"hidden"}}>
              {card(<>
                {lbl("Efecto del banner")}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:14}}>
                  {BANNER_EFFECTS.map(ef=>(
                    <div key={ef.id} className="eff-btn" onClick={()=>setBannerFx(ef.id)} style={{padding:"10px 6px",borderRadius:8,border:`1px solid ${bannerFx===ef.id?"rgba(var(--brand-primary-rgb),.4)":"rgba(237,233,224,.07)"}`,background:bannerFx===ef.id?"rgba(var(--brand-primary-rgb),.08)":"rgba(255,255,255,.02)",textAlign:"center"}}>
                      <div style={{fontSize:18,marginBottom:3}}>{ef.icon}</div>
                      <div style={{fontSize:7,letterSpacing:"1px",textTransform:"uppercase",color:bannerFx===ef.id?"var(--brand-primary, #f5e03a)":"rgba(237,233,224,.35)"}}>{ef.name}</div>
                    </div>
                  ))}
                </div>
                {lbl("Colores")}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                  <ColorPicker value={bannerC1} onChange={setBannerC1} label="Color 1"/>
                  <ColorPicker value={bannerC2} onChange={setBannerC2} label="Color 2"/>
                </div>
                <button onClick={saveBanner} disabled={saving} style={{width:"100%",height:38,fontSize:12,fontWeight:800,letterSpacing:"1.5px",textTransform:"uppercase",background:"var(--brand-primary, #f5e03a)",border:"none",color:"#04060d",borderRadius:8,cursor:"pointer",opacity:saving?.7:1}}>
                  {saving?"...":"🎨 Guardar banner"}
                </button>
              </>)}
              {!hasBannerFree&&!hasBannerChange&&<LockOverlay cost={40} label="Banner Personalizado" coins={balance} loading={unlocking==="feature_banner_free"} onUnlock={()=>unlock("feature_banner_free")}/>}
            </div>

            {bannerPresets.length>0&&card(<>
              {lbl("Banners preset")}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {bannerPresets.map(banner=>{
                  const owned=ownedBanners.includes(banner.key); const data=banner.data||{};
                  return (<div key={banner.key} className="bp" style={{borderRadius:12,overflow:"hidden",border:`1px solid ${owned?"rgba(var(--brand-primary-rgb),.25)":"rgba(237,233,224,.07)"}`,background:owned?"rgba(var(--brand-primary-rgb),.04)":"rgba(255,255,255,.02)"}}>
                    <div style={{height:60,overflow:"hidden",position:"relative"}}><BannerCanvas effect={data.effect||"stars"} color1={data.color1||"var(--brand-primary, #f5e03a)"} color2={data.color2||"var(--brand-accent, #ff5500)"} height={60}/></div>
                    <div style={{padding:"10px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:800,letterSpacing:".5px",textTransform:"uppercase"}}>{banner.name}</span>
                        <span style={{fontSize:8,padding:"1px 6px",borderRadius:100,background:{legendary:"rgba(var(--brand-primary-rgb),.1)",epic:"rgba(167,139,250,.1)",rare:"rgba(96,165,250,.1)",common:"rgba(237,233,224,.05)"}[banner.rarity],color:{legendary:"var(--brand-primary, #f5e03a)",epic:"#a78bfa",rare:"#60a5fa",common:"#ede9e0"}[banner.rarity]}}>{banner.rarity}</span>
                      </div>
                      {owned?(<button onClick={()=>equipBanner(banner.key)} disabled={saving} style={{width:"100%",height:28,fontSize:10,fontWeight:800,letterSpacing:"1px",textTransform:"uppercase",background:"rgba(var(--brand-primary-rgb),.12)",border:"1px solid rgba(var(--brand-primary-rgb),.28)",color:"var(--brand-primary, #f5e03a)",borderRadius:6,cursor:"pointer"}}>✓ Equipar</button>):(
                        <button onClick={()=>buyBannerPreset(banner)} disabled={saving||balance<banner.cost_coins} style={{width:"100%",height:28,fontSize:10,fontWeight:800,letterSpacing:"1px",textTransform:"uppercase",background:balance>=banner.cost_coins?"var(--brand-primary, #f5e03a)":"rgba(237,233,224,.05)",border:"none",color:balance>=banner.cost_coins?"#04060d":"rgba(237,233,224,.3)",borderRadius:6,cursor:balance>=banner.cost_coins?"pointer":"not-allowed"}}>🪙 {banner.cost_coins}</button>
                      )}
                    </div>
                  </div>);
                })}
              </div>
            </>)}
          </div>

          <div>
            {card(<>
              {lbl("Preview")}
              <div style={{borderRadius:12,overflow:"hidden",border:"1px solid rgba(237,233,224,.08)",marginBottom:14}}>
                <BannerCanvas effect={bannerFx} color1={bannerC1} color2={bannerC2} height={120}/>
                <div style={{background:"#0b0f1e",padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:46,height:46,borderRadius:"50%",background:"var(--brand-primary, #f5e03a)",display:"grid",placeItems:"center",fontSize:22,flexShrink:0}}>🪙</div>
                  <div>
                    <div style={{fontSize:20,fontWeight:900,letterSpacing:2,color:"#ede9e0"}}>{me?.name||"TU NOMBRE"}</div>
                    <div style={{fontSize:9,color:"rgba(237,233,224,.25)",letterSpacing:"1px",textTransform:"uppercase",marginTop:2}}>#{me?.client_number}</div>
                  </div>
                </div>
              </div>
              <div style={{padding:14,borderRadius:10,background:"rgba(255,255,255,.02)",border:"1px solid rgba(237,233,224,.06)"}}>
                <div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.35)",marginBottom:10}}>Estado</div>
                {[
                  {label:"Banner personalizado",has:hasBannerFree,cost:40,key:"feature_banner_free"},
                  {label:"Banner Change (Power)",has:hasBannerChange,cost:0,key:null},
                ].map(f=>(
                  <div key={f.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",borderRadius:8,background:f.has?"rgba(34,197,94,.06)":"rgba(255,255,255,.02)",border:`1px solid ${f.has?"rgba(34,197,94,.18)":"rgba(237,233,224,.06)"}`,marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:700,color:f.has?"#4ade80":"rgba(237,233,224,.45)"}}>{f.has?"✅":"🔒"} {f.label}</span>
                    {!f.has&&f.cost>0&&<span style={{fontSize:10,color:"var(--brand-primary, #f5e03a)"}}>🪙 {f.cost}</span>}
                  </div>
                ))}
              </div>
            </>)}
          </div>
        </div>
      )}

      {tab==="chat"&&(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {chatPowers.length===0?(
            <div style={{textAlign:"center",padding:40,color:"rgba(237,233,224,.3)",fontSize:13}}>
              <div style={{fontSize:36,marginBottom:12}}>⚡</div>
              <div>No tenés Powers comprados todavía.</div>
              <div style={{marginTop:8,fontSize:11}}>Comprá powers en el Chat</div>
            </div>
          ):(
            <>
              {chatPowers.some(p=>["namecolor","namegrad","nameglow"].includes(p.slug))&&(
                <div style={{background:"rgba(255,255,255,.03)",borderRadius:12,padding:16}}>
                  <div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.4)",marginBottom:12}}>COLOR DEL NOMBRE</div>
                  {chatPowers.some(p=>p.slug==="namecolor")&&(
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:11,color:"rgba(237,233,224,.5)",marginBottom:6}}>Color del nombre</div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <input type="color" value={chatConfig.name_color||"#c8f53a"} onChange={e=>setChatConfig(c=>({...c,name_color:e.target.value}))} style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(237,233,224,.15)",background:"none",cursor:"pointer",padding:2}}/>
                        <input type="text" value={chatConfig.name_color||"#c8f53a"} onChange={e=>setChatConfig(c=>({...c,name_color:e.target.value}))} maxLength={7} style={{width:80,background:"rgba(255,255,255,.05)",border:"1px solid rgba(237,233,224,.12)",borderRadius:8,color:"#ede9e0",fontSize:11,padding:"6px 10px",outline:"none"}}/>
                        <span style={{color:chatConfig.name_color||"#c8f53a",fontWeight:700,fontSize:14}}>Preview</span>
                      </div>
                    </div>
                  )}
                  {chatPowers.some(p=>p.slug==="nameglow")&&(
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:11,color:"rgba(237,233,224,.5)",marginBottom:6}}>Glow del nombre</div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <input type="color" value={chatConfig.name_glow_color||"#c8f53a"} onChange={e=>setChatConfig(c=>({...c,name_glow_color:e.target.value}))} style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(237,233,224,.15)",background:"none",cursor:"pointer",padding:2}}/>
                        <span style={{fontSize:11,color:"rgba(237,233,224,.4)"}}>Intensidad:</span>
                        <input type="range" min={0} max={20} value={chatConfig.name_glow||0} onChange={e=>setChatConfig(c=>({...c,name_glow:Number(e.target.value)}))} style={{flex:1}}/>
                        <span style={{fontSize:11,color:"#c8f53a",minWidth:20}}>{chatConfig.name_glow||0}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {chatPowers.some(p=>p.slug==="namegrad")&&(
                <div style={{background:"rgba(255,255,255,.03)",borderRadius:12,padding:16}}>
                  <div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.4)",marginBottom:12}}>GRADIENTE DEL NOMBRE</div>
                  <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                    <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"center"}}>
                      <span style={{fontSize:10,color:"rgba(237,233,224,.4)"}}>Color 1</span>
                      <input type="color" value={chatConfig.name_grad_from||"#c8f53a"} onChange={e=>setChatConfig(c=>({...c,name_grad_from:e.target.value}))} style={{width:44,height:44,borderRadius:10,border:"1px solid rgba(237,233,224,.15)",background:"none",cursor:"pointer",padding:2}}/>
                    </div>
                    <span style={{fontSize:20,color:"rgba(237,233,224,.3)"}}>→</span>
                    <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"center"}}>
                      <span style={{fontSize:10,color:"rgba(237,233,224,.4)"}}>Color 2</span>
                      <input type="color" value={chatConfig.name_grad_to||"#60a5fa"} onChange={e=>setChatConfig(c=>({...c,name_grad_to:e.target.value}))} style={{width:44,height:44,borderRadius:10,border:"1px solid rgba(237,233,224,.15)",background:"none",cursor:"pointer",padding:2}}/>
                    </div>
                    <span style={{background:`linear-gradient(90deg,${chatConfig.name_grad_from||"#c8f53a"},${chatConfig.name_grad_to||"#60a5fa"})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontWeight:900,fontSize:18}}>Preview</span>
                  </div>
                  <button onClick={()=>setChatConfig(c=>({...c,name_grad_from:null,name_grad_to:null}))} style={{marginTop:10,fontSize:11,color:"rgba(237,233,224,.4)",background:"none",border:"1px solid rgba(237,233,224,.1)",borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>Quitar gradiente</button>
                </div>
              )}

              {chatPowers.some(p=>["nickname","nickcolor","nickglow"].includes(p.slug))&&(
                <div style={{background:"rgba(255,255,255,.03)",borderRadius:12,padding:16}}>
                  <div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.4)",marginBottom:12}}>STATUS / NICKNAME</div>
                  {chatPowers.some(p=>p.slug==="nickname")&&(
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:11,color:"rgba(237,233,224,.5)",marginBottom:6}}>Texto de status</div>
                      <input type="text" value={chatConfig.nickname||""} onChange={e=>setChatConfig(c=>({...c,nickname:e.target.value}))} maxLength={40} placeholder="Tu status en el chat..." style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(237,233,224,.12)",borderRadius:8,color:"#ede9e0",fontSize:12,padding:"8px 12px",outline:"none",boxSizing:"border-box"}}/>
                    </div>
                  )}
                  {chatPowers.some(p=>p.slug==="nickcolor")&&(
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:11,color:"rgba(237,233,224,.5)",marginBottom:6}}>Color del status</div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <input type="color" value={chatConfig.nick_color||"#64748b"} onChange={e=>setChatConfig(c=>({...c,nick_color:e.target.value}))} style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(237,233,224,.15)",background:"none",cursor:"pointer",padding:2}}/>
                        <span style={{color:chatConfig.nick_color||"#64748b",fontSize:12}}>{chatConfig.nickname||"tu status"}</span>
                      </div>
                    </div>
                  )}
                  {chatPowers.some(p=>p.slug==="nickglow")&&(
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:11,color:"rgba(237,233,224,.5)",marginBottom:6}}>Glow del status</div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <input type="color" value={chatConfig.nick_glow_color||"#c8f53a"} onChange={e=>setChatConfig(c=>({...c,nick_glow_color:e.target.value}))} style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(237,233,224,.15)",background:"none",cursor:"pointer",padding:2}}/>
                        <span style={{fontSize:11,color:"rgba(237,233,224,.4)"}}>Intensidad:</span>
                        <input type="range" min={0} max={20} value={chatConfig.nick_glow||0} onChange={e=>setChatConfig(c=>({...c,nick_glow:Number(e.target.value)}))} style={{flex:1}}/>
                        <span style={{fontSize:11,color:"#c8f53a",minWidth:20}}>{chatConfig.nick_glow||0}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {chatPowers.some(p=>["gold","diamond","crown"].includes(p.slug))&&(
                <div style={{background:"rgba(255,255,255,.03)",borderRadius:12,padding:16}}>
                  <div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.4)",marginBottom:12}}>ÍCONO</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[{slug:"gold",icon:"🥇"},{slug:"diamond",icon:"💎"},{slug:"crown",icon:"👑"}].filter(i=>chatPowers.some(p=>p.slug===i.slug)).map(i=>(
                      <button key={i.slug} onClick={()=>setChatConfig(c=>({...c,icon_slug:c.icon_slug===i.slug?null:i.slug}))} style={{background:chatConfig.icon_slug===i.slug?"rgba(200,245,58,.15)":"rgba(255,255,255,.05)",border:`1px solid ${chatConfig.icon_slug===i.slug?"#c8f53a44":"rgba(237,233,224,.1)"}`,borderRadius:10,padding:"10px 20px",cursor:"pointer",fontSize:20}}>{i.icon}</button>
                    ))}
                    <button onClick={()=>setChatConfig(c=>({...c,icon_slug:null}))} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(237,233,224,.08)",borderRadius:10,padding:"10px 16px",cursor:"pointer",fontSize:11,color:"rgba(237,233,224,.3)"}}>Sin ícono</button>
                  </div>
                </div>
              )}

              <button onClick={async()=>{
                setChatSaving(true); setMsg("");
                try{const token=getToken();const r=await fetch((import.meta.env.VITE_API_URL||"http://localhost:4000")+"/api/chat/config",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({name_color:chatConfig.name_color||null,name_glow_color:chatConfig.name_glow_color||null,name_glow:chatConfig.name_glow||null,name_grad_from:chatConfig.name_grad_from||null,name_grad_to:chatConfig.name_grad_to||null,nickname:chatConfig.nickname||null,nick_color:chatConfig.nick_color||null,nick_glow:chatConfig.nick_glow||null,nick_glow_color:chatConfig.nick_glow_color||null,icon_slug:chatConfig.icon_slug||null})});const d=await r.json();if(r.ok){setMsg("Config del chat guardada");setTimeout(()=>window.location.reload(),800);}else setMsg(d.error||"Error");}catch{setMsg("Error de red");}
                setChatSaving(false);
              }} disabled={chatSaving} style={{fontSize:13,fontWeight:800,letterSpacing:"1.5px",textTransform:"uppercase",padding:"12px 24px",borderRadius:8,border:"none",background:"#c8f53a",color:"#04060d",cursor:"pointer",opacity:chatSaving?.6:1}}>
                {chatSaving?"Guardando...":"💬 Guardar config del chat"}
              </button>
            </>
          )}
        </div>
      )}

      {tab==="badges"&&isAdmin&&(
        <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:16}}>
          <div>
            {card(<>
              {lbl("Efecto")}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>
                {Object.keys(BADGE_FX).map(id=>(
                  <div key={id} className="eff-btn" onClick={()=>setBadgeFx(id)} style={{padding:"10px 6px",borderRadius:10,border:`1px solid ${badgeFx===id?"rgba(var(--brand-primary-rgb),.4)":"rgba(237,233,224,.07)"}`,background:badgeFx===id?"rgba(var(--brand-primary-rgb),.08)":"rgba(255,255,255,.02)",textAlign:"center"}}>
                    <div style={{fontSize:9,letterSpacing:"1px",textTransform:"uppercase",color:badgeFx===id?"var(--brand-primary, #f5e03a)":"rgba(237,233,224,.4)"}}>{id}</div>
                  </div>
                ))}
              </div>
              {lbl("Color y emoji")}
              <div style={{marginBottom:14}}><ColorPicker value={badgeColor} onChange={setBadgeColor}/></div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:18}}>
                {EMOJIS.map(e=><div key={e} onClick={()=>setBadgeEmoji(e)} style={{width:30,height:30,borderRadius:7,display:"grid",placeItems:"center",fontSize:16,cursor:"pointer",background:badgeEmoji===e?"rgba(var(--brand-primary-rgb),.12)":"rgba(255,255,255,.03)",border:`1px solid ${badgeEmoji===e?"rgba(var(--brand-primary-rgb),.3)":"rgba(237,233,224,.07)"}`,transition:"all .15s"}}>{e}</div>)}
              </div>
            </>)}
            {card(<>
              {lbl("Datos")}
              <div style={{display:"grid",gap:10}}>
                <div><div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.4)",marginBottom:6}}>Texto visible</div><input value={badgeText} onChange={e=>setBadgeText(e.target.value.toUpperCase())} maxLength={12} style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(237,233,224,.12)",borderRadius:8,color:"#ede9e0",fontSize:13,letterSpacing:"2px",padding:"9px 12px",outline:"none",textTransform:"uppercase"}}/></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div><div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.4)",marginBottom:6}}>Nombre</div><input value={badgeName} onChange={e=>setBadgeName(e.target.value)} maxLength={30} style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(237,233,224,.12)",borderRadius:8,color:"#ede9e0",fontSize:13,padding:"9px 12px",outline:"none"}}/></div>
                  <div><div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.4)",marginBottom:6}}>Rareza</div><select value={badgeRarity} onChange={e=>setBadgeRarity(e.target.value)} style={{width:"100%",height:38,background:"rgba(255,255,255,.06)",border:"1px solid rgba(237,233,224,.12)",borderRadius:8,color:"#ede9e0",fontSize:13,padding:"0 12px",outline:"none"}}><option value="common">Común</option><option value="rare">Raro</option><option value="epic">Épico</option><option value="legendary">Legendario</option></select></div>
                </div>
                <div><div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.4)",marginBottom:6}}>Descripción</div><input value={badgeDesc} onChange={e=>setBadgeDesc(e.target.value)} maxLength={60} style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(237,233,224,.12)",borderRadius:8,color:"#ede9e0",fontSize:13,padding:"9px 12px",outline:"none"}}/></div>
                <div><div style={{fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.4)",marginBottom:6}}>Costo (coins)</div><input type="number" value={badgeCost} onChange={e=>setBadgeCost(Math.max(0,parseInt(e.target.value)||0))} min={0} style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(237,233,224,.12)",borderRadius:8,color:"var(--brand-primary, #f5e03a)",fontSize:22,padding:"7px 12px",outline:"none"}}/></div>
              </div>
            </>)}
          </div>
          <div>{card(<>
            {lbl("Preview")}
            <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(237,233,224,.05)",borderRadius:12,padding:"32px 20px",textAlign:"center",marginBottom:14}}>
              <BadgePreview effect={badgeFx} color={badgeColor} emoji={badgeEmoji} text={badgeText}/>
              <div style={{fontSize:8,letterSpacing:"2px",textTransform:"uppercase",color:"rgba(237,233,224,.2)",margin:"14px 0 10px"}}>Small</div>
              <BadgePreview effect={badgeFx} color={badgeColor} emoji={badgeEmoji} text={badgeText} size="small"/>
            </div>
            <button onClick={saveBadge} disabled={saving||badgeDone} style={{width:"100%",height:42,fontSize:13,fontWeight:800,letterSpacing:"1.5px",textTransform:"uppercase",background:badgeDone?"rgba(34,197,94,.12)":"var(--brand-primary, #f5e03a)",border:badgeDone?"1px solid rgba(34,197,94,.35)":"none",color:badgeDone?"#4ade80":"#04060d",borderRadius:10,cursor:badgeDone?"default":"pointer",opacity:saving?.7:1}}>
              {saving?"...":(badgeDone?"✅ Creada":"⚡ Crear badge")}
            </button>
            {badgeDone&&<button onClick={()=>{setBadgeDone(false);setMsg("");setBadgeText("CUSTOM");}} style={{width:"100%",height:32,marginTop:8,fontSize:11,fontWeight:800,letterSpacing:"1px",textTransform:"uppercase",background:"transparent",border:"1px solid rgba(237,233,224,.08)",color:"rgba(237,233,224,.4)",borderRadius:8,cursor:"pointer"}}>+ Otra</button>}
          </>)}</div>
        </div>
      )}
    </div>
  );
}
