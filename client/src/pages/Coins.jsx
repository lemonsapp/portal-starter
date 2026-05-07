import { useState, useEffect, useRef } from "react";
import { useToast } from "../components/ToastReward.jsx";
import { Pop, FadeUp, Pulse, Jumbo, CountUp } from "../components/MotionPop.jsx";
import { motion, AnimatePresence } from "framer-motion";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
const hdrs = () => ({ Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" });
const ICONS_MAP = { gold:"🥇", diamond:"💎", crown:"👑" };
const AVATAR_EMOJI = { avatar_lemon:"🍋", avatar_fire:"🔥", avatar_diamond:"💎", avatar_star:"⭐", avatar_crown:"👑", avatar_rocket:"🚀" };

import { buildNameStyle } from "../utils/nameStyles.js";

function Avatar({ u, size=44 }) {
  const isStaff = ["admin","operator"].includes(u?.role);
  const color = u?.name_color||(isStaff?"#ef4444":"var(--brand-primary, #f5e03a)");
  const emoji = u?.avatar_key?(AVATAR_EMOJI[u.avatar_key]||"🍋"):"🍋";
  if (u?.avatar_url) return (
    <div style={{ width:size,height:size,borderRadius:"50%",overflow:"hidden",border:`2px solid ${color}88`,flexShrink:0,boxShadow:`0 0 16px ${color}44` }}>
      <img src={u.avatar_url} style={{ width:"100%",height:"100%",objectFit:"cover" }} alt="" />
    </div>
  );
  return <div style={{ width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${color}33,${color}66)`,border:`2px solid ${color}66`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.44,flexShrink:0 }}>{emoji}</div>;
}

// ── CONFETTI EXPLOSION ─────────────────────────────────────────────────────────
function ConfettiExplosion({ active }) {
  if (!active) return null;
  const pieces = Array.from({length:60},(_,i)=>({
    id:i,
    x: 20+Math.random()*60,
    y: 10+Math.random()*80,
    color:["var(--brand-primary, #f5e03a)","var(--brand-primary, #f5e03a)","var(--brand-accent, #ff5500)","#22c55e","#60a5fa","#a78bfa","#f87171","#ffffff"][i%8],
    size: 4+Math.random()*12,
    delay: Math.random()*1.2,
    shape: Math.random()>0.5?"circle":"square",
    rot: Math.random()*720,
  }));
  return pieces.map(c=>(
    <div key={c.id} style={{
      position:"fixed", left:`${c.x}%`, top:`${c.y}%`,
      width:c.size, height:c.size,
      background:c.color,
      borderRadius:c.shape==="circle"?"50%":"3px",
      animation:`confettiBlast 2.5s ease-out forwards`,
      animationDelay:`${c.delay}s`,
      pointerEvents:"none", zIndex:9999,
    }}/>
  ));
}

// ── RULETA ─────────────────────────────────────────────────────────────────────
function SpinModal({ onClose, onWin }) {
  const [canSpin, setCanSpin] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  // ORDEN EXACTO igual al backend
  const PRIZES = [
    { label:"😢 Mañana", coins:0,    color:"#1a1a2e", accent:"#64748b" },
    { label:"5 🍋",      coins:5,    color:"#0a2a0a", accent:"#4ade80" },
    { label:"10 🍋",     coins:10,   color:"#0a1a3a", accent:"#60a5fa" },
    { label:"50 🍋",     coins:50,   color:"#2a1a00", accent:"var(--brand-primary, #f5e03a)" },
    { label:"100 🍋",    coins:100,  color:"#0a2a10", accent:"#34d399" },
    { label:"200 🍋",    coins:200,  color:"#2a0a0a", accent:"#f87171" },
    { label:"500 🍋",    coins:500,  color:"#1a0a3a", accent:"#a78bfa" },
    { label:"1000 🍋",   coins:1000, color:"#2a1500", accent:"var(--brand-primary, #f5e03a)" },
  ];

  useEffect(() => {
    let iv;
    fetch(`${API}/profile/spin`, { headers: hdrs() })
      .then(r=>r.json()).then(d => {
        if (d.can_spin === true) { setCanSpin(true); return; }
        if (d.can_spin === false && d.last_spin) {
          setCanSpin(false);
          const next = new Date(new Date(d.last_spin.spun_at).getTime() + 24*60*60*1000);
          const update = () => {
            const diff = Math.max(0, next - new Date());
            if (diff === 0) { setCanSpin(true); setTimeLeft(""); clearInterval(iv); return; }
            const h = Math.floor(diff/3600000);
            const m = Math.floor((diff%3600000)/60000);
            const s = Math.floor((diff%60000)/1000);
            setTimeLeft(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
          };
          update(); iv = setInterval(update, 1000);
        } else { setCanSpin(true); }
      }).catch(() => setCanSpin(true));
    return () => clearInterval(iv);
  }, []);

  const spin = async () => {
    if (!canSpin||spinning) return;
    setSpinning(true); setResult(null); setErrorMsg("");
    const r = await fetch(`${API}/profile/spin`, { method:"POST", headers: hdrs() });
    const d = await r.json();
    if (!d.ok) { setErrorMsg(d.error||"Error al girar"); setSpinning(false); setCanSpin(false); return; }
    const seg = 360/PRIZES.length;
    const idx = d.prize_index % PRIZES.length;
    // El segmento idx tiene que quedar apuntado por el puntero (arriba = 270deg o -90deg)
    // Cada segmento empieza en idx*seg - 90, el centro esta en idx*seg + seg/2 - 90
    // Para que el puntero (arriba) apunte al centro del segmento:
    const targetAngle = -(idx * seg + seg/2);
    setRotation(prev => {
      const spins = 8 * 360;
      const current = prev % 360;
      const needed = ((targetAngle % 360) + 360) % 360;
      const diff = (needed - current + 360) % 360;
      return prev + spins + diff;
    });
    setTimeout(() => {
      setResult(d.prize);
      setSpinning(false);
      setCanSpin(false);
      if (d.prize.coins > 0) { setShowConfetti(true); setTimeout(()=>setShowConfetti(false),3000); }
      onWin?.(d.prize.coins);
    }, 6000);
  };

  const SIZE = 320, R = 130, cx = SIZE/2, cy = SIZE/2, n = PRIZES.length;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(12px)" }}
      onClick={e=>e.target===e.currentTarget&&!spinning&&onClose()}>
      <ConfettiExplosion active={showConfetti} />
      <div style={{ background:"linear-gradient(145deg,#0d0d0d,#1a0a00)",border:"2px solid var(--brand-primary, #f5e03a)44",borderRadius:32,padding:"40px",display:"flex",flexDirection:"column",alignItems:"center",gap:20,boxShadow:"0 0 100px var(--brand-primary, #f5e03a)22, inset 0 1px 0 var(--brand-primary, #f5e03a)22",maxWidth:"95vw",position:"relative" }}>
        <div style={{ position:"absolute",inset:0,borderRadius:32,background:"radial-gradient(ellipse at top,var(--brand-primary, #f5e03a)08,transparent 60%)",pointerEvents:"none" }}/>
        <button onClick={onClose} disabled={spinning} style={{ position:"absolute",top:16,right:16,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#666",cursor:spinning?"not-allowed":"pointer",fontSize:18,borderRadius:10,width:38,height:38,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s" }}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}>✕</button>

        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:11,fontWeight:800,color:"var(--brand-primary, #f5e03a)",letterSpacing:4,textTransform:"uppercase",marginBottom:4 }}>🎰 Ruleta Diaria</div>
          <div style={{ fontSize:26,fontWeight:900,color:"#fff",textShadow:"0 0 30px var(--brand-primary, #f5e03a)66" }}>Girá y Ganás 🍋</div>
        </div>

        <div style={{ position:"relative",width:SIZE+200,height:SIZE+60,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <img src="/limon-mascota.png" alt="" style={{ position:"absolute",left:-30,bottom:0,width:180,height:190,objectFit:"contain",filter:"drop-shadow(0 0 20px var(--brand-primary, #f5e03a)66)",zIndex:10,pointerEvents:"none" }}/>
          <div style={{ position:"absolute",width:SIZE+40,height:SIZE+40,borderRadius:"50%",background:"conic-gradient(#f5a62233,var(--brand-primary, #f5e03a)22,var(--brand-accent, #ff5500)22,#f5a62233)",animation:"rotateSlow 4s linear infinite",filter:"blur(16px)" }}/>
          <svg width={SIZE} height={SIZE} style={{ transform:`rotate(${rotation}deg)`,transition:spinning?`transform 6.5s cubic-bezier(0.08,0.82,0.17,1)`:"none",filter:"drop-shadow(0 0 40px var(--brand-primary, #f5e03a)33)",zIndex:2 }}>
            {PRIZES.map((p,i) => {
              const a1=(i*360/n-90)*Math.PI/180, a2=((i+1)*360/n-90)*Math.PI/180;
              const x1=cx+R*Math.cos(a1),y1=cy+R*Math.sin(a1),x2=cx+R*Math.cos(a2),y2=cy+R*Math.sin(a2);
              const mid=((i+0.5)*360/n-90)*Math.PI/180;
              const tx=cx+R*0.65*Math.cos(mid),ty=cy+R*0.65*Math.sin(mid);
              const rot=(i+0.5)*360/n;
              return (
                <g key={i}>
                  <path d={`M${cx},${cy} L${x1},${y1} A${R},${R} 0 0,1 ${x2},${y2} Z`} fill={p.color} stroke="rgba(255,255,255,0.06)" strokeWidth="2"/>
                  <text transform={`translate(${tx},${ty}) rotate(${rot})`} textAnchor="middle" dominantBaseline="middle" fill={p.accent} fontSize="13" fontWeight="900">{p.label} 🍋</text>
                </g>
              );
            })}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--brand-primary, #f5e03a)" strokeWidth="3" opacity="0.5"/>
            <circle cx={cx} cy={cy} r={R-4} fill="none" stroke="var(--brand-primary, #f5e03a)" strokeWidth="1" opacity="0.2"/>
            <circle cx={cx} cy={cy} r="32" fill="#0d0d0d" stroke="var(--brand-primary, #f5e03a)" strokeWidth="3"/>
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="24">🍋</text>
          </svg>
          <div style={{ position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,filter:"drop-shadow(0 0 12px var(--brand-primary, #f5e03a))" }}>
            <svg width="28" height="42" viewBox="0 0 28 42"><polygon points="0,0 28,0 14,42" fill="var(--brand-primary, #f5e03a)"/><polygon points="6,0 22,0 14,36" fill="var(--brand-primary, #f5e03a)"/></svg>
          </div>
        </div>

        {errorMsg && (
          <div style={{ background:"linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05))",border:"1px solid rgba(239,68,68,0.3)",borderRadius:16,padding:"16px 28px",textAlign:"center" }}>
            <div style={{ fontSize:28,marginBottom:4 }}>⏰</div>
            <div style={{ color:"#ef4444",fontWeight:800,fontSize:16 }}>{errorMsg}</div>
            <div style={{ color:"#666",fontSize:12,marginTop:4 }}>Volvé mañana para tu próximo giro</div>
          </div>
        )}
        {result && !errorMsg ? (
          <div style={{ textAlign:"center",background:result.coins>0?"linear-gradient(135deg,rgba(245,224,58,0.2),rgba(245,224,58,0.08))":"linear-gradient(135deg,rgba(100,116,139,0.1),transparent)",border:`2px solid ${result.coins>0?"var(--brand-primary, #f5e03a)":"#334155"}`,borderRadius:20,padding:"24px 48px",animation:"popInBounce 0.7s cubic-bezier(0.34,1.56,0.64,1)",boxShadow:result.coins>0?"0 0 60px var(--brand-primary, #f5e03a)33":"none" }}>
            <div style={{ fontSize:52,marginBottom:8 }}>{result.coins>0?"🎉":"😢"}</div>
            {result.coins>0 ? <>
              <div style={{ color:"var(--brand-primary, #f5e03a)",fontSize:12,marginBottom:4,letterSpacing:2,fontWeight:800,textTransform:"uppercase" }}>¡Ganaste!</div>
              <div style={{ fontWeight:900,fontSize:52,color:"var(--brand-primary, #f5e03a)",textShadow:"0 0 30px var(--brand-primary, #f5e03a)88" }}>+{result.coins} 🍋</div>
              <div style={{ color:"#888",fontSize:13,marginTop:4 }}>Coins acreditados</div>
            </> : <>
              <div style={{ color:"#64748b",fontSize:13,marginBottom:4,letterSpacing:1,textTransform:"uppercase" }}>¡Suerte la próxima!</div>
              <div style={{ fontWeight:900,fontSize:24,color:"#475569" }}>Seguí participando</div>
            </>}
          </div>
        ) : !errorMsg && !canSpin && timeLeft ? (
          <div style={{ textAlign:"center",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"20px 40px" }}>
            <div style={{ fontSize:32,marginBottom:6 }}>⏳</div>
            <div style={{ fontWeight:800,fontSize:15,color:"#94a3b8",marginBottom:4 }}>Próximo giro en</div>
            <div style={{ fontWeight:900,fontSize:36,color:"var(--brand-primary, #f5e03a)",fontVariantNumeric:"tabular-nums",textShadow:"0 0 20px var(--brand-primary, #f5e03a)66" }}>{timeLeft}</div>
          </div>
        ) : !errorMsg && (
          <div style={{ textAlign:"center",color:"#666",fontSize:13 }}>¡Girá para ganar hasta 1000 Coins!</div>
        )}

        <button onClick={spin} disabled={!canSpin||spinning}
          style={{ background:canSpin&&!spinning?"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500))":"rgba(255,255,255,0.04)",backgroundSize:"200% 200%",color:canSpin&&!spinning?"#000":"#334155",border:"none",borderRadius:16,padding:"18px 64px",fontWeight:900,fontSize:20,cursor:canSpin&&!spinning?"pointer":"not-allowed",transition:"all .3s",boxShadow:canSpin&&!spinning?"0 8px 40px var(--brand-primary, #f5e03a)66,0 0 0 1px var(--brand-primary, #f5e03a)33":"none",letterSpacing:2,textTransform:"uppercase",animation:canSpin&&!spinning?"btnPulse 2s ease-in-out infinite":"none" }}
          onMouseEnter={e=>{ if(canSpin&&!spinning){e.currentTarget.style.transform="scale(1.05)";e.currentTarget.style.boxShadow="0 12px 60px var(--brand-primary, #f5e03a)88,0 0 0 2px var(--brand-primary, #f5e03a)55";}}}
          onMouseLeave={e=>{ e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=canSpin&&!spinning?"0 8px 40px var(--brand-primary, #f5e03a)66,0 0 0 1px var(--brand-primary, #f5e03a)33":"none"; }}>
          {spinning?"⚡ Girando...":canSpin?"🎰 GIRAR":"Ya giraste hoy"}
        </button>
      </div>
    </div>
  );
}

// ── TIENDA ─────────────────────────────────────────────────────────────────────
function Store({ balance, onBuy }) {
  const [buying, setBuying] = useState(null);
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [ownedPowers, setOwnedPowers] = useState([]);
  const { showToast } = useToast();

  useEffect(() => {
    fetch(`${API}/api/chat/powers`, { headers: hdrs() })
      .then(r=>r.json()).then(d=>{ if(d.ok) setOwnedPowers(d.powers.filter(p=>p.owned).map(p=>p.slug)); });
  }, []);

  const ITEMS = [
    { id:"redeem_envio_gratis",icon:"✈️",name:"Envío Gratis",   desc:"Un envío completo sin costo",      detail:"Válido para 1 envío de cualquier peso.", cost:9500,cat:"envios",    color:"#3b82f6",badge:"PREMIUM" },
    { id:"redeem_5kg_gratis",  icon:"📦",name:"5kg Gratis",      desc:"5kg de carga sin cargo",           detail:"Se descuentan 5kg del peso cobrable.",   cost:4500,cat:"envios",    color:"#22c55e",badge:"POPULAR" },
    { id:"redeem_usd15",       icon:"💵",name:"USD 15 Off",       desc:"Descuento en próximo envío",       detail:"Crédito de USD 15 en tu próxima liq.",   cost:500, cat:"descuentos",color:"#a78bfa" },
    { id:"redeem_usd8",        icon:"💸",name:"USD 8 Off",        desc:"Descuento express",                detail:"Crédito de USD 8 en tu próxima liq.",    cost:100, cat:"descuentos",color:"var(--brand-primary, #f5e03a)",badge:"FACIL" },
    { id:"power_namecolor",    icon:"🎨",name:"Name Color",       desc:"Color personalizado en el chat",   detail:"Elegí cualquier color para tu nombre.",  cost:20,  cat:"powers",   color:"#ec4899" },
    { id:"power_nameglow",     icon:"✨",name:"Name Glow",        desc:"Aura brillante en tu nombre",      detail:"Efecto glow en tu nombre del chat.",     cost:20,  cat:"powers",   color:"#8b5cf6" },
    { id:"power_namegrad",     icon:"🌈",name:"Name Gradient",    desc:"Gradiente de colores",             detail:"Tu nombre con degradado de 2 colores.",  cost:20,  cat:"powers",   color:"#06b6d4" },
    { id:"power_nickname",     icon:"📝",name:"Nickname",         desc:"Status debajo de tu nombre",       detail:"Texto bajo tu nombre en el chat.",       cost:20,  cat:"powers",   color:"#84cc16" },
    { id:"power_nickcolor",    icon:"🎨",name:"Nick Color",       desc:"Color del status",                 detail:"Color personalizado para tu status.",    cost:20,  cat:"powers",   color:"#f97316" },
    { id:"power_nickglow",     icon:"✨",name:"Nick Glow",        desc:"Brillo en el status",              detail:"Efecto glow en tu texto de status.",     cost:20,  cat:"powers",   color:"#d946ef" },
    { id:"power_gold",         icon:"🥇",name:"Gold",             desc:"Icono dorado exclusivo",           detail:"Medalla dorada al lado de tu nombre.",   cost:20,  cat:"powers",   color:"#eab308" },
    { id:"power_diamond",      icon:"💎",name:"Diamond",          desc:"Icono diamante",                   detail:"Diamante al lado de tu nombre.",         cost:20,  cat:"powers",   color:"#67e8f9" },
    { id:"power_crown",        icon:"👑",name:"Crown",            desc:"Corona — el mas exclusivo",        detail:"El icono mas exclusivo del chat.",       cost:20,  cat:"powers",   color:"var(--brand-primary, #f5e03a)",badge:"RARO" },
  ];

  const FILTERS = [
    { id:"all",        label:"Todo",        icon:"⭐" },
    { id:"envios",     label:"Envios",      icon:"✈️" },
    { id:"descuentos", label:"Descuentos",  icon:"💰" },
    { id:"powers",     label:"Powers",      icon:"⚡" },
  ];

  const filtered = filter==="all" ? ITEMS : ITEMS.filter(i=>i.cat===filter);

  const buy = async (item) => {
    if (item.cat==="powers" && ownedPowers.includes(item.id.replace("power_",""))) return;
    if (!confirm(`Gastar ${item.cost} Coins en ${item.name}?`)) return;
    setBuying(item.id); setMsg(null);
    try {
      let url, body={};
      if (item.cat==="powers") url=`${API}/api/chat/powers/${item.id.replace("power_","")}/buy`;
      else { url=`${API}/profile/redeem`; body={reward_id:item.id}; }
      const r = await fetch(url,{method:"POST",headers:hdrs(),body:JSON.stringify(body)});
      const d = await r.json();
      if (d.ok) { setMsg({ok:true,text:`✅ ${item.name} activado!`}); onBuy?.(item.cost); showToast({ title: `${item.name} activado!`, subtitle: `Gastaste ${item.cost.toLocaleString()} LC`, icon: item.icon, color: item.color }); }
      else setMsg({ok:false,text:d.error||"Error"});
    } catch { setMsg({ok:false,text:"Error de red"}); }
    setBuying(null);
    setTimeout(()=>setMsg(null),4000);
  };

  return (
    <div>
      {msg && (
        <div style={{ background:msg.ok?"linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05))":"linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05))",border:`1px solid ${msg.ok?"rgba(34,197,94,0.4)":"rgba(239,68,68,0.4)"}`,borderRadius:14,padding:"14px 20px",color:msg.ok?"#22c55e":"#ef4444",fontSize:15,fontWeight:800,marginBottom:20,animation:"popInBounce 0.5s ease" }}>
          {msg.text}
        </div>
      )}
      <div style={{ display:"flex",gap:8,marginBottom:24,flexWrap:"wrap" }}>
        {FILTERS.map(f=>(
          <Pop as="button" key={f.id} onClick={()=>setFilter(f.id)}
            style={{ background:filter===f.id?"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))":"rgba(255,255,255,0.04)",border:`1px solid ${filter===f.id?"transparent":"rgba(255,255,255,0.08)"}`,borderRadius:24,padding:"10px 24px",color:filter===f.id?"#000":"#666",cursor:"pointer",fontSize:13,fontWeight:800,transition:"all .2s",boxShadow:filter===f.id?"0 4px 20px var(--brand-primary, #f5e03a)44":"none",transform:filter===f.id?"scale(1.05)":"scale(1)" }}
            onMouseEnter={e=>{ if(filter!==f.id){e.currentTarget.style.background="rgba(245,224,58,0.1)";e.currentTarget.style.color="var(--brand-primary, #f5e03a)";e.currentTarget.style.borderColor="rgba(245,224,58,0.3)"; }}}
            onMouseLeave={e=>{ if(filter!==f.id){e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.color="#666";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"; }}}>
            {f.icon} {f.label}
          </Pop>
        ))}
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:16 }}>
        {filtered.map((item,idx)=>{
          const canAfford=balance>=item.cost;
          const isOpen=expanded===item.id;
          const isOwned=item.cat==="powers" && ownedPowers.includes(item.id.replace("power_",""));
          return (
            <motion.div key={item.id}
              initial={{ opacity:0, y:14, scale:.96 }}
              animate={{ opacity:1, y:0, scale:1 }}
              transition={{ delay:Math.min(idx*0.04,0.5), duration:0.4, ease:[0.2,0.8,0.2,1] }}
              style={{ background:isOwned?`linear-gradient(145deg,rgba(34,197,94,0.1),rgba(0,0,0,0.9))`:`linear-gradient(145deg,${item.color}18,rgba(10,10,10,0.95))`,border:`2px solid ${isOwned?"rgba(34,197,94,0.5)":isOpen?item.color+"88":item.color+(canAfford?"33":"18")}`,borderRadius:20,overflow:"hidden",transition:"border-color .3s, box-shadow .3s",transform:isOpen?"translateY(-6px) scale(1.02)":"translateY(0) scale(1)",boxShadow:isOwned?"0 0 30px rgba(34,197,94,0.2)":isOpen?`0 20px 60px ${item.color}33`:"none",cursor:"pointer" }}
              onMouseEnter={e=>{ if(!isOpen){e.currentTarget.style.transform="translateY(-4px) scale(1.01)";e.currentTarget.style.boxShadow=isOwned?"0 0 40px rgba(34,197,94,0.3)":`0 12px 40px ${item.color}44`;e.currentTarget.style.borderColor=isOwned?"rgba(34,197,94,0.7)":item.color+"66"; }}}
              onMouseLeave={e=>{ if(!isOpen){e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=isOwned?"0 0 30px rgba(34,197,94,0.2)":"none";e.currentTarget.style.borderColor=isOwned?"rgba(34,197,94,0.5)":item.color+(canAfford?"33":"18"); }}}
              onClick={()=>setExpanded(isOpen?null:item.id)}>
              <div style={{ padding:"22px 20px 16px",position:"relative" }}>
                <div style={{ position:"absolute",top:0,right:0,width:80,height:80,borderRadius:"0 20px 0 80px",background:`${item.color}08` }}/>
                {isOwned && <div style={{ display:"inline-flex",alignItems:"center",gap:4,background:"rgba(34,197,94,0.2)",border:"1px solid rgba(34,197,94,0.5)",borderRadius:20,padding:"3px 12px",fontSize:10,fontWeight:900,color:"#22c55e",letterSpacing:1,marginBottom:12 }}>✓ YA OBTENIDO</div>}
                {!isOwned && item.badge && <div style={{ display:"inline-flex",alignItems:"center",background:`linear-gradient(135deg,${item.color}33,${item.color}11)`,border:`1px solid ${item.color}55`,borderRadius:20,padding:"3px 12px",fontSize:10,fontWeight:900,color:item.color,letterSpacing:1,marginBottom:12 }}>{item.badge}</div>}
                <div style={{ fontSize:42,marginBottom:12,filter:`drop-shadow(0 0 12px ${item.color}88)`,display:"inline-block",transition:"transform .3s" }}>{item.icon}</div>
                <div style={{ fontWeight:900,color:"#fff",fontSize:17,marginBottom:4 }}>{item.name}</div>
                <div style={{ color:"#666",fontSize:12,lineHeight:1.5,marginBottom:14 }}>{item.desc}</div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <div style={{ fontWeight:900,fontSize:20,color:"var(--brand-primary, #f5e03a)",textShadow:"0 0 10px var(--brand-primary, #f5e03a)44" }}>🍋 {item.cost.toLocaleString()}</div>
                  <Pop as="button" onClick={e=>{ e.stopPropagation(); buy(item); }} disabled={isOwned||!canAfford||buying===item.id}
                    hoverScale={(!isOwned&&canAfford)?1.08:1}
                    style={{ background:isOwned?"rgba(34,197,94,0.15)":canAfford?`linear-gradient(135deg,${item.color},${item.color}cc)`:"rgba(255,255,255,0.05)",color:isOwned?"#22c55e":canAfford?"#000":"#444",border:isOwned?"1px solid rgba(34,197,94,0.4)":"none",borderRadius:10,padding:"8px 18px",fontWeight:900,cursor:isOwned||!canAfford?"not-allowed":"pointer",fontSize:13,boxShadow:(!isOwned&&canAfford)?`0 4px 20px ${item.color}55`:"none" }}>
                    {buying===item.id?"...":isOwned?"✓ Obtenido":canAfford?"Comprar":"Sin coins"}
                  </Pop>
                </div>
                {!canAfford&&!isOwned&&<div style={{ color:"#ef4444",fontSize:11,marginTop:6,fontWeight:700 }}>Faltan {(item.cost-balance).toLocaleString()} 🍋</div>}
              </div>
              <AnimatePresence initial={false}>
                {isOpen&&(
                  <motion.div
                    key="detail"
                    initial={{ height:0, opacity:0 }}
                    animate={{ height:"auto", opacity:1 }}
                    exit={{ height:0, opacity:0 }}
                    transition={{ duration:0.28, ease:[0.2,0.8,0.2,1] }}
                    style={{ background:"rgba(0,0,0,0.5)",borderTop:`1px solid ${item.color}22`,overflow:"hidden" }}>
                    <div style={{ padding:"14px 20px",color:"#94a3b8",fontSize:12,lineHeight:1.8 }}>{item.detail}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── MISIONES ───────────────────────────────────────────────────────────────────
function ReferralCard() {
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch(`${API}/profile/referrals`, { headers: hdrs() })
      .then(r => r.json()).then(d => { if (d.ok) setData(d); }).catch(() => {});
  }, []);
  if (!data) return null;
  const link = data.link;
  const stats = data.stats || {};
  function copy() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <FadeUp style={{ background: "linear-gradient(135deg,rgba(167,139,250,.07),rgba(236,72,153,.04))", border: "1px solid rgba(167,139,250,.25)", borderRadius: 18, padding: "20px 24px", position: "relative", overflow: "hidden", display: "block", marginBottom: 22 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#a78bfa,#ec4899,#a78bfa,transparent)", backgroundSize: "200% 100%", animation: "shimmerLoad 3s linear infinite" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: "2.5px", textTransform: "uppercase", color: "#a78bfa", fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 18, height: 1, background: "#a78bfa" }} />Programa de referidos
          </div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: "1px", color: "#fff", lineHeight: 1 }}>
            Invitá amigos · ganá <span style={{ color: "var(--brand-primary, #f5e03a)" }}>25 LC</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 6, lineHeight: 1.5 }}>
            Tu amigo recibe 25 LC al hacer su primer envío. Vos también ganás 25 LC.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontFamily: "'DM Mono',monospace" }}>
          <div style={{ textAlign: "center" }}>
            <CountUp value={stats.total || 0} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: "#a78bfa", lineHeight: 1, display: "block" }}>{stats.total || 0}</CountUp>
            <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "rgba(255,255,255,.4)", textTransform: "uppercase", marginTop: 4 }}>Invitados</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <CountUp value={stats.rewarded || 0} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: "#22c55e", lineHeight: 1, display: "block" }}>{stats.rewarded || 0}</CountUp>
            <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "rgba(255,255,255,.4)", textTransform: "uppercase", marginTop: 4 }}>Activos</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <CountUp value={stats.total_coins_earned || 0} style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: "var(--brand-primary, #f5e03a)", lineHeight: 1, display: "block" }}>{stats.total_coins_earned || 0}</CountUp>
            <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "rgba(255,255,255,.4)", textTransform: "uppercase", marginTop: 4 }}>LC ganados</div>
          </div>
        </div>
      </div>

      {link ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 14px", background: "rgba(0,0,0,.4)", border: "1px solid rgba(167,139,250,.3)", borderRadius: 10 }}>
          <code style={{ flex: 1, fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#a78bfa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link}</code>
          <Pop as="button" onClick={copy}
            style={{ padding: "8px 14px", background: copied ? "#22c55e" : "linear-gradient(135deg,#a78bfa,#ec4899)", color: "#000", border: "none", borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: "pointer", letterSpacing: "1px", textTransform: "uppercase", flexShrink: 0 }}>
            {copied ? "✓ Copiado" : "📋 Copiar link"}
          </Pop>
          <Pop as="a" href={`https://wa.me/?text=${encodeURIComponent(`Te paso mi link: ${link} — te doy 25 LC con tu primer envío 🍋`)}`} target="_blank" rel="noreferrer"
            style={{ padding: "8px 14px", background: "rgba(34,197,94,.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,.4)", borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: "pointer", letterSpacing: "1px", textTransform: "uppercase", flexShrink: 0, textDecoration: "none" }}>
            💬 WA
          </Pop>
        </div>
      ) : (
        <div style={{ padding: "12px 14px", background: "rgba(255,140,42,.08)", border: "1px solid rgba(255,140,42,.3)", borderRadius: 10, fontSize: 12, color: "var(--brand-accent, #ff8c2a)", fontWeight: 600 }}>
          Configurá un @ usuario en tu perfil para tener tu link único.
        </div>
      )}
    </FadeUp>
  );
}

function LoginStreak({ refreshKey }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${API}/profile/streak`, { headers: hdrs() })
      .then(r => r.json()).then(d => { if (d.ok) setData(d); }).catch(() => {});
  }, [refreshKey]);
  if (!data) return null;
  const streak = data.streak || 0;
  const week = data.week || [];
  return (
    <FadeUp style={{ background:"linear-gradient(135deg,rgba(245,224,58,.06),rgba(255,85,0,.04))", border:"1px solid rgba(245,224,58,.22)", borderRadius:18, padding:"20px 24px", position:"relative", overflow:"hidden", display:"block" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500),var(--brand-primary, #f5e03a),transparent)", backgroundSize:"200% 100%", animation:"shimmerLoad 3s linear infinite" }}/>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16, marginBottom:14 }}>
        <div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:"2.5px", textTransform:"uppercase", color:"var(--brand-accent, #ff8c2a)", fontWeight:600, marginBottom:6, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ width:18, height:1, background:"var(--brand-accent, #ff8c2a)" }}/>Racha de login
          </div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, letterSpacing:"1px", color:"#fff", lineHeight:1, display:"flex", alignItems:"baseline", gap:8 }}>
            <CountUp value={streak} style={{ color:"var(--brand-primary, #f5e03a)", fontSize:42 }}>{streak}</CountUp>
            <span style={{ fontSize:18, color:"rgba(255,255,255,.4)" }}>{streak===1 ? "día" : "días"} seguidos</span>
            <span style={{ fontSize:24 }}>{streak >= 7 ? "🔥🔥" : streak >= 3 ? "🔥" : "✨"}</span>
          </div>
        </div>
        <div style={{ textAlign:"right", fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"1.5px", color:"rgba(255,255,255,.45)" }}>
          {streak >= 7 ? "MÁXIMO ✓" : `Faltan ${7 - streak} para el bonus`}
          <div style={{ fontSize:9, color:"rgba(255,255,255,.3)", marginTop:4 }}>+25 LC al completar 7</div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
        {week.map(d => (
          <div key={d.date} style={{
            padding:"10px 6px", textAlign:"center",
            background: d.claimed ? "linear-gradient(135deg,rgba(245,224,58,.18),rgba(255,85,0,.08))" : d.is_today ? "rgba(245,224,58,.04)" : "rgba(255,255,255,.02)",
            border: `1px solid ${d.claimed ? "rgba(245,224,58,.4)" : d.is_today ? "rgba(245,224,58,.25)" : "rgba(255,255,255,.05)"}`,
            borderRadius: 10, position:"relative",
          }}>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:8, letterSpacing:"1px", color: d.claimed ? "var(--brand-primary, #f5e03a)" : "rgba(255,255,255,.3)", fontWeight:700, marginBottom:4 }}>
              {d.day_short}
            </div>
            <div style={{ fontSize:18, lineHeight:1 }}>
              {d.claimed ? "✅" : d.is_today ? "⭐" : "·"}
            </div>
            {d.is_today && !d.claimed && (
              <div style={{ position:"absolute", inset:0, borderRadius:10, border:"2px dashed rgba(245,224,58,.4)", animation:"shimmerLoad 2s ease-in-out infinite", pointerEvents:"none" }}/>
            )}
          </div>
        ))}
      </div>
    </FadeUp>
  );
}

function Missions({ onClaim }) {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch(`${API}/profile/missions`, { headers: hdrs() })
      .then(r=>r.json()).then(d=>{ if(d.ok) setMissions(d.missions); setLoading(false); });
  }, []);

  const claim = async (slug) => {
    setClaiming(slug);
    const r = await fetch(`${API}/profile/missions/${slug}/claim`,{method:"POST",headers:hdrs()});
    const d = await r.json();
    if (d.ok) {
      setMissions(p=>p.map(m=>m.slug===slug?{...m,claimed_at:new Date().toISOString()}:m));
      onClaim?.(d.coins_earned);
      const mission = missions.find(m=>m.slug===slug);
      showToast({ title: mission?.title || "Mision completada", subtitle: `+${d.coins_earned} Coins acreditados`, icon: mission?.icon || "🍋", color: "var(--brand-primary, #f5e03a)" });
    } else alert(d.error);
    setClaiming(null);
  };

  if (loading) return (
    <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
      {[1,2,3,4].map(i=><div key={i} style={{ height:88,borderRadius:18,background:"rgba(255,255,255,0.02)",animation:"shimmerLoad 1.5s ease-in-out infinite" }}/>)}
    </div>
  );

  const groups = [
    { type:"daily",   label:"Misiones Diarias",   icon:"🌅", color:"var(--brand-primary, #f5e03a)", desc:"Se resetean cada dia" },
    { type:"weekly",  label:"Misiones Semanales",  icon:"📆", color:"#a78bfa", desc:"Se resetean cada semana" },
    { type:"onetime", label:"Logros Especiales",   icon:"🏆", color:"var(--brand-primary, #f5e03a)", desc:"Una sola vez — recompensas grandes" },
  ];

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:32 }}>
      <LoginStreak refreshKey={missions.map(m=>m.claimed_at).join(",")} />
      {groups.map(g => {
        const gm = missions.filter(m=>m.mission_type===g.type);
        if (!gm.length) return null;
        const done = gm.filter(m=>m.claimed_at).length;
        const pctGroup = (done/gm.length)*100;
        return (
          <div key={g.type}>
            <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:16,padding:"16px 20px",background:`linear-gradient(135deg,${g.color}12,transparent)`,border:`1px solid ${g.color}25`,borderRadius:18,position:"relative",overflow:"hidden" }}>
              <div style={{ position:"absolute",bottom:0,left:0,height:3,width:`${pctGroup}%`,background:`linear-gradient(90deg,${g.color},${g.color}88)`,transition:"width 1s ease",borderRadius:3 }}/>
              <div style={{ width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${g.color}22,${g.color}44)`,border:`1px solid ${g.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0 }}>{g.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:900,color:"#fff",fontSize:17 }}>{g.label}</div>
                <div style={{ color:"#666",fontSize:12,marginTop:2 }}>{g.desc}</div>
              </div>
              <div style={{ textAlign:"right",flexShrink:0 }}>
                <div style={{ fontWeight:900,fontSize:24,color:g.color,textShadow:`0 0 20px ${g.color}66` }}>{done}/{gm.length}</div>
                <div style={{ color:"#666",fontSize:11 }}>completadas</div>
              </div>
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12 }}>
              {gm.map(m => {
                const done2=!!m.completed_at, claimed=!!m.claimed_at;
                const pct=Math.min(100,((m.progress||0)/Math.max(1,m.requirement_value))*100);
                return (
                  <div key={m.slug}
                    style={{ background:claimed?`linear-gradient(135deg,rgba(34,197,94,0.08),rgba(0,0,0,0.8))`:done2?`linear-gradient(135deg,${g.color}10,rgba(0,0,0,0.8))`:"rgba(255,255,255,0.02)",border:`1px solid ${claimed?"rgba(34,197,94,0.35)":done2?g.color+"40":"rgba(255,255,255,0.06)"}`,borderRadius:16,padding:"18px 20px",display:"flex",gap:16,alignItems:"center",transition:"all .3s",boxShadow:done2&&!claimed?`0 0 20px ${g.color}22`:claimed?"0 0 20px rgba(34,197,94,0.15)":"none" }}
                    onMouseEnter={e=>{e.currentTarget.style.transform="translateX(4px)";e.currentTarget.style.borderColor=claimed?"rgba(34,197,94,0.5)":done2?g.color+"66":"rgba(255,255,255,0.12)";}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.borderColor=claimed?"rgba(34,197,94,0.35)":done2?g.color+"40":"rgba(255,255,255,0.06)";}}>
                    <div style={{ width:50,height:50,borderRadius:14,background:claimed?"linear-gradient(135deg,rgba(34,197,94,0.2),rgba(34,197,94,0.1))":done2?`linear-gradient(135deg,${g.color}25,${g.color}10)`:"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0,border:`1px solid ${claimed?"rgba(34,197,94,0.4)":done2?g.color+"40":"rgba(255,255,255,0.06)"}`,boxShadow:done2&&!claimed?`0 0 16px ${g.color}33`:"none" }}>
                      {m.icon}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontWeight:800,color:claimed?"#22c55e":done2?g.color:"#ccc",fontSize:15,marginBottom:3 }}>{m.title}</div>
                      <div style={{ color:"#555",fontSize:12 }}>{m.description}</div>
                      {!done2 && m.requirement_value>1 && (
                        <div style={{ marginTop:10 }}>
                          <div style={{ height:4,background:"rgba(255,255,255,0.05)",borderRadius:4,overflow:"hidden" }}>
                            <div style={{ height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${g.color},${g.color}88)`,borderRadius:4,transition:"width .8s ease",boxShadow:`0 0 8px ${g.color}66` }}/>
                          </div>
                          <div style={{ color:"#444",fontSize:10,marginTop:4 }}>{m.progress||0} / {m.requirement_value}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink:0,textAlign:"right" }}>
                      <div style={{ color:"var(--brand-primary, #f5e03a)",fontWeight:900,fontSize:18,marginBottom:8,textShadow:"0 0 10px var(--brand-primary, #f5e03a)44" }}>+{m.coins_reward} 🍋</div>
                      {claimed ? <div style={{ color:"#22c55e",fontSize:12,fontWeight:800,background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:8,padding:"4px 10px" }}>✓ Listo</div>
                      : done2 ? <Pop as="button" onClick={()=>claim(m.slug)} disabled={claiming===m.slug}
                          hoverScale={1.08}
                          style={{ background:`linear-gradient(135deg,${g.color},${g.color}bb)`,color:"#000",border:"none",borderRadius:10,padding:"8px 18px",fontWeight:900,cursor:"pointer",fontSize:13,boxShadow:`0 4px 20px ${g.color}55` }}>
                          {claiming===m.slug?"...":"Reclamar 🍋"}
                        </Pop>
                      : <div style={{ color:"#333",fontSize:12,fontWeight:700 }}>Pendiente</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── RANKING ─────────────────────────────────────────────────────────────────────
function Ranking() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/profile/ranking?limit=20`, { headers: hdrs() })
      .then(r=>r.json()).then(d=>{ if(d.ok) setData(d.ranking); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
      {[1,2,3,4,5].map(i=><div key={i} style={{ height:80,borderRadius:18,background:"rgba(255,255,255,0.02)",animation:"shimmerLoad 1.5s ease-in-out infinite",animationDelay:`${i*0.1}s` }}/>)}
    </div>
  );

  const PODIUM_COLORS = ["var(--brand-primary, #f5e03a)","#94a3b8","#b45309"];
  const MEDALS = ["🥇","🥈","🥉"];
  const PODIUM_GLOW = ["var(--brand-primary, #f5e03a)","#94a3b8","#b45309"];

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
      {data.map((u, i) => {
        const ns = buildNameStyle(u);
        const isStaff = ["admin","operator"].includes(u.role);
        const isPod = i<3;
        return (
          <div key={u.id}
            style={{ display:"flex",alignItems:"center",gap:16,padding:"16px 20px",background:isPod?`linear-gradient(135deg,${PODIUM_COLORS[i]}12,rgba(0,0,0,0.8))`:"rgba(255,255,255,0.02)",border:`1px solid ${isPod?PODIUM_COLORS[i]+"33":"rgba(255,255,255,0.05)"}`,borderRadius:20,transition:"all .3s",boxShadow:isPod?`0 0 30px ${PODIUM_GLOW[i]}18`:"none",position:"relative",overflow:"hidden" }}
            onMouseEnter={e=>{ e.currentTarget.style.transform="translateX(6px)";e.currentTarget.style.borderColor=isPod?PODIUM_COLORS[i]+"55":"rgba(255,255,255,0.1)";e.currentTarget.style.background=isPod?`linear-gradient(135deg,${PODIUM_COLORS[i]}20,rgba(0,0,0,0.8))`:"rgba(255,255,255,0.04)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform="";e.currentTarget.style.borderColor=isPod?PODIUM_COLORS[i]+"33":"rgba(255,255,255,0.05)";e.currentTarget.style.background=isPod?`linear-gradient(135deg,${PODIUM_COLORS[i]}12,rgba(0,0,0,0.8))`:"rgba(255,255,255,0.02)"; }}>

            {isPod && <div style={{ position:"absolute",top:0,left:0,width:"100%",height:2,background:`linear-gradient(90deg,${PODIUM_COLORS[i]},transparent)` }}/>}

            <div style={{ width:48,textAlign:"center",flexShrink:0 }}>
              {isPod ? <span style={{ fontSize:30,filter:`drop-shadow(0 0 10px ${PODIUM_GLOW[i]}88)` }}>{MEDALS[i]}</span>
              : <span style={{ fontSize:14,fontWeight:900,color:"#333" }}>#{i+1}</span>}
            </div>

            <Avatar u={u} size={48} />

            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4 }}>
                {u.icon_slug && ICONS_MAP[u.icon_slug] && <span style={{ fontSize:15 }}>{ICONS_MAP[u.icon_slug]}</span>}
                {isStaff && <span style={{ fontSize:15 }}>🍋</span>}
                <span style={{ fontWeight:900,fontSize:17,...ns }}>{u.name}</span>
                {isStaff && <span style={{ background:"#ef444418",border:"1px solid #ef444430",borderRadius:6,padding:"2px 8px",fontSize:9,color:"#ef4444",fontWeight:900,letterSpacing:1 }}>STAFF</span>}
              </div>
              {u.nickname && <div style={{ fontSize:12,color:u.nick_color||"#555",textShadow:u.nick_glow?`0 0 ${u.nick_glow}px ${u.nick_color||"#555"}`:"none",marginBottom:4 }}>{u.nickname}</div>}
              <div style={{ display:"flex",gap:12 }}>
                <span style={{ color:"#333",fontSize:11 }}>#{u.client_number}</span>
                {u.total_shipments>0&&<span style={{ color:"#444",fontSize:11 }}>📦 {u.total_shipments}</span>}
                {u.delivered>0&&<span style={{ color:"#444",fontSize:11 }}>✅ {u.delivered}</span>}
              </div>
            </div>

            <div style={{ textAlign:"right",flexShrink:0 }}>
              <div style={{ fontWeight:900,fontSize:24,color:isPod?PODIUM_COLORS[i]:"#e2e8f0",textShadow:isPod?`0 0 20px ${PODIUM_GLOW[i]}66`:"none" }}>
                {Number(u.total_earned||0).toLocaleString()}
              </div>
              <div style={{ color:"#333",fontSize:10 }}>🍋 ganados</div>
              <div style={{ color:"#444",fontSize:11,marginTop:2,fontWeight:700 }}>{Number(u.balance||0).toLocaleString()} disp.</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── GIFTING ─────────────────────────────────────────────────────────────────────
function Gift({ balance, onGift }) {
  const [clientNum, setClientNum] = useState("");
  const [amount, setAmount] = useState(50);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const quick = [10,25,50,100,250,500];

  const send = async () => {
    if (!clientNum||amount<10) return;
    setSending(true); setResult(null);
    const r = await fetch(`${API}/profile/gift`,{method:"POST",headers:hdrs(),body:JSON.stringify({to_client_number:parseInt(clientNum),amount,message})});
    const d = await r.json();
    if (d.ok) { setResult({ok:true,text:d.message}); setClientNum(""); setMessage(""); onGift?.(amount); }
    else setResult({ok:false,text:d.error});
    setSending(false);
  };

  return (
    <div style={{ maxWidth:560,margin:"0 auto" }}>
      <div style={{ background:"linear-gradient(145deg,rgba(245,224,58,0.06),rgba(0,0,0,0.95))",border:"2px solid rgba(245,224,58,0.2)",borderRadius:28,padding:"36px 32px",boxShadow:"0 0 80px rgba(245,224,58,0.06)",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-40,right:-40,fontSize:180,opacity:0.03,userSelect:"none",pointerEvents:"none" }}>🎁</div>
        <div style={{ textAlign:"center",marginBottom:32 }}>
          <div style={{ fontSize:64,marginBottom:12,filter:"drop-shadow(0 0 20px var(--brand-primary, #f5e03a)66)",display:"inline-block",animation:"wiggle 3s ease-in-out infinite" }}>🎁</div>
          <div style={{ fontWeight:900,fontSize:26,color:"#fff",marginBottom:6 }}>Regalar Coins</div>
          <div style={{ color:"#555",fontSize:14 }}>Compartí tu amor con la comunidad 🍋</div>
        </div>

        {result && <div style={{ background:result.ok?"linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05))":"linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05))",border:`1px solid ${result.ok?"rgba(34,197,94,0.4)":"rgba(239,68,68,0.4)"}`,borderRadius:14,padding:"14px 20px",color:result.ok?"#22c55e":"#ef4444",fontSize:15,fontWeight:800,marginBottom:24,textAlign:"center",animation:"popInBounce 0.5s ease" }}>{result.text}</div>}

        <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
          <div>
            <label style={{ color:"var(--brand-primary, #f5e03a)",fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",display:"block",marginBottom:10 }}>Numero de cliente</label>
            <input value={clientNum} onChange={e=>setClientNum(e.target.value)} placeholder="Ej: 42" type="number" min="1"
              style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"2px solid rgba(255,255,255,0.08)",borderRadius:14,color:"#fff",fontSize:18,padding:"15px 18px",outline:"none",boxSizing:"border-box",transition:"all .2s" }}
              onFocus={e=>{e.target.style.borderColor="var(--brand-primary, #f5e03a)";e.target.style.boxShadow="0 0 20px var(--brand-primary, #f5e03a)22";}}
              onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.08)";e.target.style.boxShadow="none";}} />
          </div>

          <div>
            <label style={{ color:"var(--brand-primary, #f5e03a)",fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",display:"block",marginBottom:10 }}>
              Cantidad · <span style={{ color:"#fff" }}>{balance.toLocaleString()} disponibles</span>
            </label>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:12 }}>
              {quick.map(a=>(
                <Pop as="button" key={a} onClick={()=>setAmount(a)}
                  style={{ background:amount===a?"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))":"rgba(255,255,255,0.04)",border:`1px solid ${amount===a?"transparent":"rgba(255,255,255,0.08)"}`,borderRadius:10,padding:"9px 18px",color:amount===a?"#000":"#666",cursor:"pointer",fontSize:14,fontWeight:900,boxShadow:amount===a?"0 4px 16px var(--brand-primary, #f5e03a)44":"none" }}>
                  {a}
                </Pop>
              ))}
            </div>
            <div style={{ background:"rgba(255,255,255,0.04)",border:"2px solid rgba(245,224,58,0.2)",borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:12 }}>
              <span style={{ fontSize:26 }}>🍋</span>
              <input type="number" value={amount} onChange={e=>setAmount(Math.max(10,Math.min(balance,parseInt(e.target.value)||10)))} min={10} max={balance}
                style={{ flex:1,background:"none",border:"none",color:"var(--brand-primary, #f5e03a)",fontSize:28,fontWeight:900,outline:"none" }}/>
              <span style={{ color:"#333",fontSize:12 }}>LC</span>
            </div>
          </div>

          <div>
            <label style={{ color:"var(--brand-primary, #f5e03a)",fontSize:11,fontWeight:800,letterSpacing:2,textTransform:"uppercase",display:"block",marginBottom:10 }}>Mensaje (opcional)</label>
            <input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Un regalo para vos! 🍋" maxLength={100}
              style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"2px solid rgba(255,255,255,0.08)",borderRadius:14,color:"#fff",fontSize:14,padding:"15px 18px",outline:"none",boxSizing:"border-box",transition:"all .2s" }}
              onFocus={e=>{e.target.style.borderColor="var(--brand-primary, #f5e03a)";e.target.style.boxShadow="0 0 20px var(--brand-primary, #f5e03a)22";}}
              onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.08)";e.target.style.boxShadow="none";}}/>
          </div>

          <Pop as="button" onClick={send} disabled={sending||!clientNum||amount>balance||amount<10}
            hoverScale={1.02}
            style={{ background:(!sending&&clientNum&&amount<=balance&&amount>=10)?"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a),var(--brand-accent, #ff5500))":"rgba(255,255,255,0.04)",color:(!sending&&clientNum&&amount<=balance&&amount>=10)?"#000":"#333",border:"none",borderRadius:16,padding:"18px",fontWeight:900,fontSize:18,cursor:(!sending&&clientNum&&amount<=balance)?"pointer":"not-allowed",boxShadow:(!sending&&clientNum&&amount<=balance)?"0 8px 40px var(--brand-primary, #f5e03a)55":"none",letterSpacing:1 }}>
            {sending?"Enviando...":`🎁 Regalar ${amount.toLocaleString()} LC`}
          </Pop>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function Coins() {
  const [tab, setTab] = useState("tienda");
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [level, setLevel] = useState("bronze");
  const [loading, setLoading] = useState(true);
  const [showSpin, setShowSpin] = useState(false);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    fetch(`${API}/profile`,{headers:hdrs()}).then(r=>r.json()).then(d=>{
      if (d.coins) { setBalance(d.coins.balance||0); setTotalEarned(d.coins.total_earned||0); }
      if (d.user) setLevel(d.user.level||"bronze");
      setLoading(false);
    });
  }, []);

  const spawn = (n=12) => {
    const ps = Array.from({length:n},(_,i)=>({id:Date.now()+i,x:15+Math.random()*70,delay:Math.random()*0.6}));
    setParticles(ps); setTimeout(()=>setParticles([]),3500);
  };

  const LC = {
    bronze:{ c:"#b45309", g:"linear-gradient(135deg,#b45309,#d97706)", l:"Bronce", i:"🥉", n:500 },
    silver:{ c:"#94a3b8", g:"linear-gradient(135deg,#64748b,#94a3b8)", l:"Plata",  i:"🥈", n:2000 },
    gold:  { c:"var(--brand-primary, #f5e03a)", g:"linear-gradient(135deg,var(--brand-primary, #f5e03a),var(--brand-primary, #f5e03a))", l:"Oro",    i:"🥇", n:null },
  };
  const lc = LC[level]||LC.bronze;
  const pct = lc.n ? Math.min(100,(totalEarned/lc.n)*100) : 100;

  const TABS = [
    { id:"tienda",   icon:"🛍️", label:"Tienda",   color:"var(--brand-primary, #f5e03a)" },
    { id:"ruleta",   icon:"🎰", label:"Ruleta",   color:"#a78bfa" },
    { id:"misiones", icon:"🎯", label:"Misiones", color:"#22c55e" },
    { id:"ranking",  icon:"🏆", label:"Ranking",  color:"var(--brand-primary, #f5e03a)" },
    { id:"regalar",  icon:"🎁", label:"Regalar",  color:"#ec4899" },
  ];

  return (
    <>
      {showSpin && <SpinModal onClose={()=>setShowSpin(false)} onWin={c=>{ setBalance(b=>b+c); if(c>0) spawn(20); }} />}

      <div style={{ minHeight:"100vh",background:"#080808",color:"#e2e8f0",display:"flex",flexDirection:"column" }}>
        <style>{`
          @keyframes rotateSlow{from{transform:rotate(0)}to{transform:rotate(360deg)}}
          @keyframes popInBounce{0%{transform:scale(0.6);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
          @keyframes coinFly{0%{transform:translateY(0) scale(1.5) rotate(0deg);opacity:1}100%{transform:translateY(-320px) scale(0) rotate(360deg);opacity:0}}
          @keyframes confettiBlast{0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1}100%{transform:translate(var(--dx,30px),var(--dy,-200px)) rotate(var(--rot,360deg)) scale(0.3);opacity:0}}
          @keyframes shimmerLoad{0%{background-position:-400px 0}100%{background-position:400px 0}}
          @keyframes slideDown{0%{opacity:0;transform:translateY(-10px)}100%{opacity:1;transform:translateY(0)}}
          @keyframes btnPulse{0%,100%{box-shadow:0 8px 40px var(--brand-primary, #f5e03a)66,0 0 0 1px var(--brand-primary, #f5e03a)33}50%{box-shadow:0 8px 60px var(--brand-primary, #f5e03a)88,0 0 0 3px var(--brand-primary, #f5e03a)55}}
          @keyframes wiggle{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
          @keyframes heroGlow{0%,100%{box-shadow:0 0 40px var(--brand-primary, #f5e03a)15,inset 0 1px 0 rgba(245,224,58,0.1)}50%{box-shadow:0 0 80px var(--brand-primary, #f5e03a)25,inset 0 1px 0 rgba(245,224,58,0.2)}}
          @keyframes numberPop{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
          .tab-btn:hover { transform: scale(1.05) !important; }
        `}</style>

        {particles.map(p=>(
          <div key={p.id} style={{ position:"fixed",left:`${p.x}%`,top:"50%",zIndex:9999,fontSize:28,animation:"coinFly 2.8s ease-out forwards",animationDelay:`${p.delay}s`,pointerEvents:"none" }}>🍋</div>
        ))}

        {/* TOPBAR DE TABS (Tienda · Ruleta · Misiones · Ranking · Regalar) */}
        <div style={{ display:"flex",gap:6,padding:"14px 24px",borderBottom:"1px solid rgba(255,255,255,0.04)",background:"rgba(5,5,5,0.95)",position:"sticky",top:0,zIndex:10,overflowX:"auto",scrollbarWidth:"none" }}>
          {TABS.map(t=>{
            const isActive = tab===t.id && t.id!=="ruleta";
            return (
              <Pop as="button" key={t.id} className="tab-btn"
                onClick={()=>{ if(t.id==="ruleta"){setShowSpin(true);}else{setTab(t.id);} }}
                style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 18px",borderRadius:14,background:isActive?`linear-gradient(135deg,${t.color}22,${t.color}0a)`:"transparent",border:`1px solid ${isActive?t.color+"44":"transparent"}`,cursor:"pointer",color:isActive?t.color:"#666",boxShadow:isActive?`0 0 20px ${t.color}22`:"none",position:"relative",whiteSpace:"nowrap",flexShrink:0 }}>
                {isActive && <motion.div layoutId="lc-tab-bar" style={{ position:"absolute",left:"15%",right:"15%",bottom:0,height:3,background:t.color,borderRadius:"3px 3px 0 0",boxShadow:`0 0 8px ${t.color}` }}/>}
                <span style={{ fontSize:18,filter:isActive?`drop-shadow(0 0 8px ${t.color})`:"none",transition:"all .25s" }}>{t.icon}</span>
                <span style={{ fontSize:11,fontWeight:800,letterSpacing:1,textTransform:"uppercase" }}>{t.label}</span>
              </Pop>
            );
          })}
        </div>

        {/* CONTENIDO */}
        <div style={{ flex:1,overflowY:"auto",padding:"28px 32px 48px" }}>

          {/* HERO EDITORIAL */}
          <FadeUp style={{ position:"relative",background:"linear-gradient(135deg,var(--mid) 0%,var(--deep) 100%)",border:"1px solid var(--border2)",padding:"32px 36px",marginBottom:28,overflow:"hidden",display:"block" }}>
            <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,var(--lemon),var(--orange),transparent)" }}/>
            <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(245,224,58,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(245,224,58,.018) 1px,transparent 1px)",backgroundSize:"48px 48px",pointerEvents:"none",opacity:.7 }}/>
            <div style={{ position:"absolute",right:-30,bottom:-50,fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(140px,18vw,260px)",lineHeight:.78,letterSpacing:"-6px",color:"transparent",WebkitTextStroke:"1px rgba(245,224,58,.04)",pointerEvents:"none",userSelect:"none" }}>COINS</div>

            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:24,position:"relative",zIndex:2 }}>
              <div>
                <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"3.5px",textTransform:"uppercase",color:"var(--orange)",display:"flex",alignItems:"center",gap:12,marginBottom:14 }}>
                  <span style={{ width:28,height:1,background:"var(--orange)" }}/>Coins
                </div>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(56px,7vw,96px)",lineHeight:.84,letterSpacing:"-1.5px",color:"var(--text)",marginBottom:6 }}>
                  TU <em style={{ fontStyle:"normal",color:"var(--lemon)" }}>BALANCE</em>
                </div>
                <div style={{ display:"flex",alignItems:"baseline",gap:12,marginBottom:8 }}>
                  <CountUp value={balance} color="var(--lemon)" style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:48,fontWeight:400,color:"var(--lemon)",lineHeight:1,letterSpacing:"1px" }}>
                    {loading?"—":Number(balance).toLocaleString()}
                  </CountUp>
                  <span style={{ fontFamily:"'DM Mono',monospace",fontSize:14,color:"var(--muted2)",letterSpacing:"3px" }}>LC 🍋</span>
                </div>
                <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"2px",color:"var(--muted2)",marginBottom:18,textTransform:"uppercase" }}>Total ganado: <span style={{ color:"var(--lemon)",fontWeight:500 }}>{Number(totalEarned).toLocaleString()}</span></div>

                <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10 }}>
                  <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:lc.g,borderRadius:24,padding:"6px 18px",boxShadow:`0 4px 20px ${lc.c}44` }}>
                    <span style={{ fontSize:16 }}>{lc.i}</span>
                    <span style={{ fontSize:12,fontWeight:900,color:"#000",letterSpacing:1 }}>NIVEL {lc.l.toUpperCase()}</span>
                  </div>
                  {lc.n&&<span style={{ color:"#333",fontSize:12 }}>→ {(lc.n-totalEarned).toLocaleString()} para el siguiente</span>}
                </div>
                <div style={{ height:6,width:"min(320px,100%)",background:"rgba(255,255,255,0.04)",borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ height:"100%",width:`${pct}%`,background:lc.g,borderRadius:10,transition:"width 2s ease",boxShadow:`0 0 16px ${lc.c}66` }}/>
                </div>
              </div>

              <div style={{ textAlign:"center" }}>
                <div style={{ width:110,height:110,borderRadius:"50%",background:`radial-gradient(circle,${lc.c}25,transparent)`,border:`2px solid ${lc.c}44`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:`0 0 50px ${lc.c}22,inset 0 0 30px ${lc.c}11`,cursor:"pointer",transition:"all .3s" }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.1) rotate(5deg)";e.currentTarget.style.boxShadow=`0 0 80px ${lc.c}44,inset 0 0 40px ${lc.c}22`;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=`0 0 50px ${lc.c}22,inset 0 0 30px ${lc.c}11`;}}>
                  <Jumbo style={{ fontSize:48 }}>{lc.i}</Jumbo>
                  <span style={{ fontSize:8,color:lc.c,fontWeight:900,letterSpacing:2,marginTop:2 }}>{level==="gold"?"MAX":lc.l.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </FadeUp>

          <ReferralCard />

          {tab==="tienda"   && <Store balance={balance} onBuy={c=>{ setBalance(b=>b-c); spawn(6); }} />}
          {tab==="misiones" && <Missions onClaim={c=>{ setBalance(b=>b+c); spawn(14); }} />}
          {tab==="ranking"  && <Ranking />}
          {tab==="regalar"  && <Gift balance={balance} onGift={a=>setBalance(b=>b-a)} />}
        </div>
      </div>
    </>
  );
}
