import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import BarcodeScanner from "../components/BarcodeScanner.jsx";
import EditorialHero from "../components/EditorialHero.jsx";
import Skeleton from "../components/Skeleton.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const STATUSES = ["Recibido en depósito","En preparación","Despachado","En tránsito","Listo para entrega","Entregado"];
const ORIGINS = ["USA","CHINA","EUROPA"];
const SERVICES_BY_ORIGIN = { USA:["NORMAL","EXPRESS","TECH_PREMIUM"], CHINA:["NORMAL","EXPRESS"], EUROPA:["NORMAL"] };
const DEFAULT_RATES_FALLBACK = { usa_normal:45, usa_express:55, usa_tech_premium:75, china_normal:58, china_express:68, europa_normal:58 };

const num = (v,fb=0)=>{const n=Number(String(v??"").replace(",","."));return Number.isFinite(n)?n:fb;};
const numOrNull = v=>{if(v===""||v==null)return null;const n=Number(String(v).replace(",","."));return Number.isFinite(n)?n:null;};
const fmtDate = v=>{if(!v)return"–";try{return new Date(v).toLocaleString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});}catch{return String(v);}};
const MIN_BILLABLE_KG=1;

function normalizeOrigin(v){const o=String(v||"").toUpperCase().trim();return ORIGINS.includes(o)?o:"USA";}
function normalizeService(origin,v){const o=normalizeOrigin(origin);if(o==="EUROPA")return"NORMAL";const s=String(v||"").toUpperCase().trim();if(s==="TECH_PREMIUM"&&o==="USA")return"TECH_PREMIUM";return s==="EXPRESS"?"EXPRESS":"NORMAL";}
function getLaneRate({origin,service,rates,defaults}){
  const r=rates||{};const d=defaults||DEFAULT_RATES_FALLBACK;
  if(origin==="USA"&&service==="NORMAL")return numOrNull(r.usa_normal)??num(d.usa_normal);
  if(origin==="USA"&&service==="EXPRESS")return numOrNull(r.usa_express)??num(d.usa_express);
  if(origin==="USA"&&service==="TECH_PREMIUM")return numOrNull(r.usa_tech_premium)??num(d.usa_tech_premium??75);
  if(origin==="CHINA"&&service==="NORMAL")return numOrNull(r.china_normal)??num(d.china_normal);
  if(origin==="CHINA"&&service==="EXPRESS")return numOrNull(r.china_express)??num(d.china_express);
  if(origin==="EUROPA")return numOrNull(r.europa_normal)??num(d.europa_normal);
  return 0;
}

const STATUS_CFG={
  "Recibido en depósito":{c:"#f5e03a",bg:"rgba(245,224,58,0.1)",bd:"rgba(245,224,58,0.25)",dot:"#f5e03a",icon:"📥"},
  "En preparación":{c:"#ff8c2a",bg:"rgba(255,140,42,0.1)",bd:"rgba(255,140,42,0.25)",dot:"#ff8c2a",icon:"🔧"},
  "Despachado":{c:"#60a5fa",bg:"rgba(96,165,250,0.1)",bd:"rgba(96,165,250,0.25)",dot:"#60a5fa",icon:"🚀"},
  "En tránsito":{c:"#c084fc",bg:"rgba(192,132,252,0.1)",bd:"rgba(192,132,252,0.25)",dot:"#c084fc",icon:"✈️"},
  "Listo para entrega":{c:"#34d399",bg:"rgba(52,211,153,0.1)",bd:"rgba(52,211,153,0.25)",dot:"#34d399",icon:"📬"},
  "Entregado":{c:"#f5e03a",bg:"rgba(245,224,58,0.12)",bd:"rgba(245,224,58,0.3)",dot:"#f5e03a",icon:"✅"},
};

const ORIGIN_CFG={USA:{c:"#f5e03a",bg:"rgba(245,224,58,0.1)"},CHINA:{c:"#ff8c2a",bg:"rgba(255,140,42,0.1)"},EUROPA:{c:"#60a5fa",bg:"rgba(96,165,250,0.1)"}};

// ── Toast System ──────────────────────────────────────────────────────────────
function useToast(){
  const [toasts,setToasts]=useState([]);
  const add=useCallback((msg,type="ok")=>{
    const id=Date.now()+Math.random();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3800);
  },[]);
  const rm=useCallback(id=>setToasts(p=>p.filter(t=>t.id!==id)),[]);
  return{toasts,toast:add,removeToast:rm};
}

function Toasts({toasts,removeToast}){
  return(
    <div style={{position:"fixed",bottom:28,right:28,zIndex:9999,display:"flex",flexDirection:"column",gap:10,pointerEvents:"none"}}>
      {toasts.map(t=>{
        const isErr=t.type==="err";const isWarn=t.type==="warn";
        const bc=isErr?"rgba(239,68,68,0.18)":isWarn?"rgba(255,140,42,0.18)":"rgba(245,224,58,0.12)";
        const border=isErr?"rgba(239,68,68,0.45)":isWarn?"rgba(255,140,42,0.4)":"rgba(245,224,58,0.35)";
        const icon=isErr?"⚠":"ok"===t.type?"✓":"⚡";
        return(
          <div key={t.id} onClick={()=>removeToast(t.id)} style={{pointerEvents:"all",cursor:"pointer",display:"flex",alignItems:"center",gap:12,padding:"13px 18px",background:bc,border:`1px solid ${border}`,borderRadius:14,backdropFilter:"blur(24px)",boxShadow:"0 12px 40px rgba(0,0,0,0.5)",animation:"op-toastIn .35s cubic-bezier(.34,1.56,.64,1)",minWidth:260,maxWidth:360}}>
            <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
            <span style={{fontSize:13,fontFamily:"'Barlow',sans-serif",fontWeight:600,color:"var(--text)",flex:1}}>{t.msg}</span>
            <span style={{fontSize:11,color:"var(--muted2)",flexShrink:0}}>✕</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Floating Tab Bar ──────────────────────────────────────────────────────────
function FTabs({tabs,active,onChange,size="md"}){
  const h=size==="sm"?38:44;
  return(
    <div style={{maxWidth:"100%",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}} className="op-ftabs-scroll">
    <style>{`.op-ftabs-scroll::-webkit-scrollbar{display:none}`}</style>
    <div style={{display:"inline-flex",gap:4,padding:"5px 6px",background:"var(--deep)",border:"1px solid var(--border2)",borderRadius:18,boxShadow:"0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",width:"max-content"}}>
      {tabs.map(t=>{
        const on=active===t.key;
        return(
          <button key={t.key} onClick={()=>onChange(t.key)} style={{display:"flex",alignItems:"center",gap:7,height:h,padding:`0 ${size==="sm"?14:18}px`,borderRadius:13,border:"none",cursor:"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:size==="sm"?12:13,letterSpacing:"0.8px",textTransform:"uppercase",transition:"all .22s cubic-bezier(.34,1.56,.64,1)",background:on?"var(--lemon)":"transparent",color:on?"var(--void)":"var(--ghost)",boxShadow:on?"0 4px 20px rgba(245,224,58,0.35), inset 0 1px 0 rgba(255,255,255,0.3)":"none",transform:on?"scale(1.02)":"scale(1)"}}
            onMouseEnter={e=>{if(!on){e.currentTarget.style.background="rgba(245,224,58,0.08)";e.currentTarget.style.color="var(--lemon)";}}}
            onMouseLeave={e=>{if(!on){e.currentTarget.style.background="transparent";e.currentTarget.style.color="var(--ghost)";}}}
          >
            <span style={{fontSize:size==="sm"?14:16}}>{t.icon}</span>
            <span>{t.label}</span>
            {t.badge!=null&&t.badge>0&&(
              <span style={{minWidth:18,height:18,borderRadius:9,padding:"0 5px",background:on?"rgba(0,0,0,0.2)":"rgba(245,224,58,0.15)",color:on?"var(--void)":"var(--lemon)",fontSize:9,fontWeight:900,fontFamily:"'DM Mono',monospace",display:"flex",alignItems:"center",justifyContent:"center"}}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
    </div>
  );
}

// ── Ripple Button ─────────────────────────────────────────────────────────────
function Btn({children,onClick,style={},disabled=false,v="ghost",size="md"}){
  const ref=useRef(null);
  function click(e){
    if(disabled)return;
    const b=ref.current;const r=b.getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top;
    const rip=document.createElement("span");
    rip.style.cssText=`position:absolute;border-radius:50%;transform:scale(0);animation:op-ripple .5s linear;background:rgba(255,255,255,0.2);width:80px;height:80px;left:${x-40}px;top:${y-40}px;pointer-events:none;`;
    b.appendChild(rip);setTimeout(()=>rip.remove(),600);
    onClick&&onClick(e);
  }
  const h=size==="sm"?30:size==="lg"?50:40;
  const variants={
    ghost:{background:"var(--faint2)",border:"1px solid var(--border2)",color:"var(--text)"},
    primary:{background:"var(--lemon)",border:"none",color:"var(--void)",boxShadow:"0 4px 20px rgba(245,224,58,0.3)"},
    danger:{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",color:"#f87171"},
    green:{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.25)",color:"#4ade80"},
    orange:{background:"rgba(255,140,42,0.1)",border:"1px solid rgba(255,140,42,0.25)",color:"#ff8c2a"},
  };
  return(
    <button ref={ref} onClick={click} disabled={disabled} style={{position:"relative",overflow:"hidden",border:"none",cursor:disabled?"not-allowed":"pointer",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:size==="sm"?11:13,letterSpacing:"0.8px",textTransform:"uppercase",transition:"all .2s cubic-bezier(.34,1.56,.64,1)",opacity:disabled?.45:1,height:h,padding:`0 ${size==="sm"?10:16}px`,borderRadius:10,display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap",...variants[v],...style}}
      onMouseEnter={e=>{if(!disabled)e.currentTarget.style.transform="translateY(-1px) scale(1.02)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";}}>
      {children}
    </button>
  );
}

// ── Label ─────────────────────────────────────────────────────────────────────
function Lbl({children}){
  return <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:500,letterSpacing:"2px",textTransform:"uppercase",color:"var(--muted2)",marginBottom:6}}>{children}</div>;
}

// ── Glass Card ────────────────────────────────────────────────────────────────
function Card({children,style={},accent="var(--lemon)"}){
  return(
    <div style={{background:"var(--mid)",border:"1px solid var(--border)",borderRadius:16,position:"relative",overflow:"hidden",...style}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${accent},transparent)`}}/>
      {children}
    </div>
  );
}

// ── Status Select ─────────────────────────────────────────────────────────────
function StatusSel({value,onChange,disabled}){
  const cfg=STATUS_CFG[value]||{c:"var(--text)",bg:"var(--faint2)",bd:"var(--border2)"};
  return(
    <select value={value} onChange={onChange} disabled={disabled}
      style={{height:34,padding:"0 10px",borderRadius:8,border:`1px solid ${cfg.bd}`,background:cfg.bg,color:cfg.c,fontFamily:"'Barlow',sans-serif",fontSize:11,fontWeight:700,outline:"none",cursor:"pointer",minWidth:160}}>
      {STATUSES.map(s=><option key={s} value={s} style={{background:"var(--mid)",color:"var(--text)"}}>{s}</option>)}
    </select>
  );
}

// ── Scan Button ───────────────────────────────────────────────────────────────
function ScanBtn({onClick}){
  return <Btn onClick={onClick} v="ghost" style={{width:42,height:42,padding:0,borderRadius:10,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>📷</Btn>;
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Hr(){return <div style={{height:1,background:"var(--border)",margin:"14px 0"}}/>;}

// ── AI Panel ──────────────────────────────────────────────────────────────────
function AIPanel({toast}){
  const [settings,setSettings]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [newChat,setNewChat]=useState({jid:"",label:""});
  async function load(){setLoading(true);try{const r=await fetch(`${API}/api/ai/settings`,{headers:{Authorization:`Bearer ${getToken()}`}});const d=await r.json();if(d.ok)setSettings(d.settings);}catch{toast("Error cargando","err");}finally{setLoading(false);}}
  async function toggle(key){if(!settings)return;setSaving(true);try{const r=await fetch(`${API}/api/ai/settings`,{method:"POST",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({[key]:!settings[key]})});const d=await r.json();if(d.ok){setSettings(s=>({...s,[key]:!s[key]}));toast("Actualizado");}}catch{toast("Error","err");}finally{setSaving(false);}}
  async function blockChat(){if(!newChat.jid.trim())return toast("Ingresá el JID","warn");setSaving(true);try{const r=await fetch(`${API}/api/ai/settings/block-chat`,{method:"POST",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({jid:newChat.jid.trim(),label:newChat.label.trim()||newChat.jid.trim()})});const d=await r.json();if(d.ok){setSettings(s=>({...s,blocked_wa_chats:d.blocked}));setNewChat({jid:"",label:""});toast("Bloqueado ✓");}}catch{toast("Error","err");}finally{setSaving(false);}}
  async function unblockChat(jid){setSaving(true);try{const r=await fetch(`${API}/api/ai/settings/unblock-chat`,{method:"POST",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({jid})});const d=await r.json();if(d.ok){setSettings(s=>({...s,blocked_wa_chats:d.blocked}));toast("Desbloqueado");}}catch{toast("Error","err");}finally{setSaving(false);}}
  useEffect(()=>{load();},[]);
  if(loading)return (
    <div style={{padding:"22px 16px"}}>
      <Skeleton.Hero heroH={120} contentH={140}/>
      <div style={{height:18}}/>
      <Skeleton.Cards count={3} h={140} cols="1fr 1fr 1fr"/>
    </div>
  );
  const Toggle=({label,icon,keyName,description})=>{
    const on=settings?.[keyName]===true||settings?.[keyName]==="true";
    return(
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px",background:on?"rgba(245,224,58,0.03)":"rgba(239,68,68,0.03)",border:`1px solid ${on?"rgba(245,224,58,0.15)":"rgba(239,68,68,0.12)"}`,borderRadius:12,marginBottom:8,transition:"all .3s"}}>
        <div><div style={{fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:14,marginBottom:3}}>{icon} {label}</div><div style={{fontSize:12,color:"var(--muted2)"}}>{description}</div></div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:9,fontFamily:"'DM Mono',monospace",fontWeight:500,letterSpacing:"2px",padding:"3px 10px",borderRadius:20,background:on?"rgba(245,224,58,0.15)":"rgba(239,68,68,0.12)",color:on?"var(--lemon)":"#f87171"}}>{on?"ACTIVO":"INACTIVO"}</span>
          <button onClick={()=>toggle(keyName)} disabled={saving} style={{width:48,height:26,borderRadius:13,border:"none",cursor:"pointer",background:on?"#22c55e":"rgba(255,255,255,0.1)",position:"relative",transition:"all .3s",flexShrink:0}}>
            <div style={{position:"absolute",top:3,left:on?26:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"all .3s",boxShadow:"0 2px 6px rgba(0,0,0,0.4)"}}/>
          </button>
        </div>
      </div>
    );
  };
  const blocked=Array.isArray(settings?.blocked_wa_chats)?settings.blocked_wa_chats:[];
  const globalOn=settings?.global_enabled===true||settings?.global_enabled==="true";
  const channelsOn=["limoncin_enabled","whatsapp_enabled","telegram_enabled"].filter(k=>settings?.[k]===true||settings?.[k]==="true").length;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:22}}>
      <EditorialHero
        eyebrow="Founder AI"
        title="CONTROL"
        em="IA"
        watermark="LIMONCIN"
        live={globalOn}
        meta={[
          globalOn?"Sistema activo":"Sistema apagado",
          `${channelsOn}/3 canales activos`,
          `${blocked.length} chats bloqueados`,
        ]}
      />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card style={{padding:"20px 22px"}} accent="var(--lemon)">
        <div className="sectionLabel" style={{marginBottom:14}}>Control global</div>
        <Toggle label="Sistema IA — GLOBAL" icon="🤖" keyName="global_enabled" description="Desactiva todos los bots de una vez"/>
      </Card>
      <Card style={{padding:"20px 22px"}} accent="var(--orange)">
        <div className="sectionLabel" style={{marginBottom:14}}>Canales</div>
        <Toggle label="LIMONCIN — Telegram" icon="🍋" keyName="limoncin_enabled" description="Agente IA en Telegram"/>
        <Toggle label="Bot WhatsApp" icon="📲" keyName="whatsapp_enabled" description="Bot de atención al cliente"/>
        <Toggle label="Bot Telegram Clientes" icon="✈️" keyName="telegram_enabled" description="Bot de consultas"/>
      </Card>
      </div>
      <Card style={{padding:"20px 22px"}} accent="#60a5fa">
        <div className="sectionLabel" style={{marginBottom:14}}>Chats bloqueados ({blocked.length})</div>
        <div style={{fontSize:12,color:"var(--muted2)",marginBottom:12}}>JID: <code style={{color:"var(--lemon)",fontFamily:"'DM Mono',monospace"}}>549116…@s.whatsapp.net</code></div>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <input className="input" placeholder="JID completo" value={newChat.jid} onChange={e=>setNewChat(c=>({...c,jid:e.target.value}))} style={{flex:2,minWidth:200}}/>
          <input className="input" placeholder="Etiqueta" value={newChat.label} onChange={e=>setNewChat(c=>({...c,label:e.target.value}))} style={{flex:1,minWidth:120}}/>
          <Btn onClick={blockChat} disabled={saving} v="danger">🚫 Bloquear</Btn>
        </div>
        {blocked.length===0?<div style={{textAlign:"center",padding:20,color:"var(--muted2)",fontSize:12,fontFamily:"'DM Mono',monospace",letterSpacing:"1px"}}>SIN CHATS BLOQUEADOS</div>:blocked.map(b=>(
          <div key={b.jid} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.12)",borderRadius:10,marginBottom:8}}>
            <div><div style={{fontWeight:700,fontSize:13}}>🚫 {b.label}</div><div style={{fontSize:11,color:"var(--muted2)",fontFamily:"'DM Mono',monospace"}}>{b.jid}</div></div>
            <Btn onClick={()=>unblockChat(b.jid)} disabled={saving} v="green" size="sm">✓ Desbloquear</Btn>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Editorial Hero is imported at top ─────────────────────────────────────────

// ── Lines Panel (estado por línea: Normal / Express por país) ────────────────
const LINE_FALLBACK={usa_normal:true,usa_express:true,china_normal:true,china_express:true,europa_normal:false};
const COUNTRIES_CFG=[
  {key:"usa",   flag:"🇺🇸",label:"USA",   depot:"Miami",                       accent:"#f5e03a",glow:"245,224,58",
   lines:[
     {key:"usa_normal", svc:"Normal",      eta:"7-10 días", express:false},
     {key:"usa_express",svc:"Express ⚡",  eta:"72 horas",  express:true},
   ]},
  {key:"china", flag:"🇨🇳",label:"China", depot:"Guangzhou",                   accent:"#ff8c2a",glow:"255,140,42",
   lines:[
     {key:"china_normal", svc:"Normal",     eta:"~18 días", express:false},
     {key:"china_express",svc:"Express ⚡", eta:"~7 días",  express:true},
   ]},
  {key:"europa",flag:"🇪🇺",label:"Europa",depot:"España · Toda Europa",         accent:"#60a5fa",glow:"96,165,250",
   lines:[
     {key:"europa_normal",svc:"Normal",     eta:"18-20 días",express:false},
   ]},
];
const NOTE_PRESETS=["Demorado","2 días demorado","5 días demorado","Aduana retenida","Sin demoras"];
function LinesPanel({toast}){
  const [lines,setLines]=useState(null);
  const [notes,setNotes]=useState({});
  const [noteDraft,setNoteDraft]=useState({});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(null);
  async function load(){
    setLoading(true);
    try{
      const r=await fetch(`${API}/public/operations-status`,{cache:"no-store"});
      const d=await r.json();
      if(d.ok){setLines({...LINE_FALLBACK,...d.lines});setNotes(d.notes||{});setNoteDraft(d.notes||{});}
    }catch{toast("Error cargando estado","err");}
    finally{setLoading(false);}
  }
  async function toggleLine(lineKey){
    if(!lines)return;
    setSaving(lineKey);
    const next=!lines[lineKey];
    try{
      const r=await fetch(`${API}/operator/operations-status`,{
        method:"PUT",
        headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},
        body:JSON.stringify({[lineKey]:next}),
      });
      const d=await r.json();
      if(d.ok){
        setLines({...LINE_FALLBACK,...d.lines});
        setNotes(d.notes||{});
        toast(`${lineKey.replace("_"," ").toUpperCase()} · ${next?"operando":"pausado"}`);
      }else toast(d.error||"Error","err");
    }catch{toast("Error de red","err");}
    finally{setSaving(null);}
  }
  async function saveNote(lineKey){
    if(!lines)return;
    const val=(noteDraft[lineKey]||"").trim().slice(0,80);
    if(val===((notes[lineKey]||"").trim()))return;
    setSaving("note_"+lineKey);
    try{
      const r=await fetch(`${API}/operator/operations-status`,{
        method:"PUT",
        headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},
        body:JSON.stringify({notes:{[lineKey]:val}}),
      });
      const d=await r.json();
      if(d.ok){
        setLines({...LINE_FALLBACK,...d.lines});
        setNotes(d.notes||{});
        setNoteDraft(d.notes||{});
        toast(val?`Nota · ${lineKey.replace("_"," ").toUpperCase()}: ${val}`:`Nota borrada · ${lineKey.replace("_"," ").toUpperCase()}`);
      }else toast(d.error||"Error","err");
    }catch{toast("Error de red","err");}
    finally{setSaving(null);}
  }
  async function applyPreset(lineKey,preset){
    const val=preset==="Sin demoras"?"":preset;
    setNoteDraft(d=>({...d,[lineKey]:val}));
    setSaving("note_"+lineKey);
    try{
      const r=await fetch(`${API}/operator/operations-status`,{
        method:"PUT",
        headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},
        body:JSON.stringify({notes:{[lineKey]:val}}),
      });
      const d=await r.json();
      if(d.ok){setLines({...LINE_FALLBACK,...d.lines});setNotes(d.notes||{});setNoteDraft(d.notes||{});toast(val?`Nota · ${preset}`:"Demoras limpiadas");}
      else toast(d.error||"Error","err");
    }catch{toast("Error de red","err");}
    finally{setSaving(null);}
  }
  async function toggleCountry(countryKey,turnOn){
    if(!lines)return;
    const country=COUNTRIES_CFG.find(c=>c.key===countryKey);if(!country)return;
    setSaving("c_"+countryKey);
    const body=Object.fromEntries(country.lines.map(l=>[l.key,turnOn]));
    try{
      const r=await fetch(`${API}/operator/operations-status`,{
        method:"PUT",
        headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},
        body:JSON.stringify(body),
      });
      const d=await r.json();
      if(d.ok){
        setLines({...LINE_FALLBACK,...d.lines});
        toast(`${country.label} · ${turnOn?"todo activado":"todo pausado"}`);
      }else toast(d.error||"Error","err");
    }catch{toast("Error de red","err");}
    finally{setSaving(null);}
  }
  useEffect(()=>{load();},[]);
  if(loading||!lines)return(
    <div style={{padding:"22px 16px"}}>
      <Skeleton.Hero heroH={120} contentH={140}/>
      <div style={{height:18}}/>
      <Skeleton.Cards count={3} h={220} cols="1fr 1fr 1fr"/>
    </div>
  );
  const totalLines=COUNTRIES_CFG.reduce((a,c)=>a+c.lines.length,0);
  const onLines=COUNTRIES_CFG.reduce((a,c)=>a+c.lines.filter(l=>lines[l.key]).length,0);
  const heroLive=onLines>0;
  const heroMeta=[
    `${onLines}/${totalLines} líneas operando`,
    ...COUNTRIES_CFG.map(c=>{
      const on=c.lines.filter(l=>lines[l.key]).length;
      return `${c.label} · ${on}/${c.lines.length}`;
    }),
  ];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:22}}>
      <EditorialHero
        eyebrow="Estado operativo"
        title="LÍNEAS"
        em="EN VIVO"
        watermark="STATUS"
        live={heroLive}
        meta={heroMeta}
      />
      <div style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px",background:"rgba(245,224,58,.04)",border:"1px solid rgba(245,224,58,.14)",borderRadius:12}}>
        <span style={{fontSize:18,lineHeight:1}}>💡</span>
        <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.7}}>
          Controlá cada <strong style={{color:"var(--lemon)"}}>línea individualmente</strong> (Normal y Express por país). Los cambios se reflejan al instante en el botón flotante del landing público. Usá esto para feriados, cierres aduaneros, capacidad operativa o pausas temporales.
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14}}>
        {COUNTRIES_CFG.map(c=>{
          const onCount=c.lines.filter(l=>lines[l.key]).length;
          const totalC=c.lines.length;
          const allOn=onCount===totalC;
          const allOff=onCount===0;
          const dotColor=allOn?"#22c55e":allOff?"#ef4444":"#fbbf24";
          const dotGlow=allOn?"34,197,94":allOff?"239,68,68":"251,191,36";
          const stateText=allOn?"OPERANDO":allOff?"PAUSADO":"PARCIAL";
          const savingC=saving==="c_"+c.key;
          return(
            <Card key={c.key} accent={dotColor} style={{padding:0,overflow:"hidden"}}>
              {/* Header país */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 22px 16px",borderBottom:"1px solid var(--border)",background:`linear-gradient(135deg,rgba(${c.glow},0.05),transparent 60%)`}}>
                <div style={{display:"flex",alignItems:"center",gap:14,minWidth:0}}>
                  <span style={{fontSize:42,lineHeight:1,filter:`drop-shadow(0 0 14px rgba(${c.glow},0.45))`,flexShrink:0}}>{c.flag}</span>
                  <div style={{minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:"1px",lineHeight:1,color:"var(--text)"}}>{c.label}</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",fontWeight:700,padding:"3px 9px",background:`rgba(${dotGlow},0.12)`,border:`1px solid rgba(${dotGlow},0.3)`,color:dotColor,borderRadius:4}}>{stateText}</div>
                    </div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"1.8px",textTransform:"uppercase",color:"var(--muted2)"}}>{c.depot}</div>
                  </div>
                </div>
                <div style={{width:14,height:14,borderRadius:"50%",background:dotColor,boxShadow:`0 0 12px ${dotColor},0 0 22px rgba(${dotGlow},0.6)`,flexShrink:0,animation:"linePulse 2s ease-in-out infinite"}}/>
              </div>

              {/* Filas de líneas */}
              <div style={{padding:"4px 0"}}>
                {c.lines.map(l=>{
                  const on=!!lines[l.key];
                  const sv=saving===l.key;
                  const nsv=saving==="note_"+l.key;
                  const noteVal=noteDraft[l.key]??"";
                  const persistedNote=(notes[l.key]||"").trim();
                  const dirty=noteVal.trim()!==persistedNote;
                  return(
                    <div key={l.key} style={{display:"flex",flexDirection:"column",gap:10,padding:"14px 22px",borderBottom:"1px solid rgba(255,255,255,0.025)",transition:"background .25s"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"1.5px",fontWeight:700,padding:"3px 10px",color:l.express?"#ff8c2a":"var(--lemon)",background:l.express?"rgba(255,140,42,0.08)":"rgba(245,224,58,0.08)",border:`1px solid ${l.express?"rgba(255,140,42,0.22)":"rgba(245,224,58,0.22)"}`}}>{l.svc}</div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"1px",color:"var(--muted2)"}}>{l.eta}</div>
                            {on&&persistedNote&&(
                              <div style={{fontFamily:"'DM Mono',monospace",fontSize:9.5,letterSpacing:"1px",fontWeight:700,padding:"2px 7px",color:"#fbbf24",background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.25)",borderRadius:4,textTransform:"uppercase"}}>⏱ {persistedNote}</div>
                            )}
                          </div>
                          <div style={{fontSize:11,color:on?(persistedNote?"#fbbf24":"#22c55e"):"#f87171",fontWeight:600,letterSpacing:"0.3px"}}>
                            {on?(persistedNote?"● Operando con demoras · visible en landing":"● Operando · visible en landing"):"○ Pausado · marcado en rojo"}
                          </div>
                        </div>
                        <button onClick={()=>toggleLine(l.key)} disabled={sv}
                          style={{width:52,height:28,borderRadius:14,border:"none",cursor:sv?"wait":"pointer",background:on?"#22c55e":"rgba(255,255,255,0.08)",position:"relative",transition:"all .3s",flexShrink:0,opacity:sv?.55:1,boxShadow:on?"0 0 14px rgba(34,197,94,0.35)":"none"}}>
                          <div style={{position:"absolute",top:3,left:on?27:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"all .3s cubic-bezier(.34,1.56,.64,1)",boxShadow:"0 2px 6px rgba(0,0,0,0.4)"}}/>
                        </button>
                      </div>

                      {/* Nota de demora manual */}
                      <div style={{display:"flex",flexDirection:"column",gap:6,padding:"10px 12px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"1.5px",fontWeight:700,color:"var(--muted2)",textTransform:"uppercase",flexShrink:0}}>⏱ Nota</span>
                          <input
                            type="text"
                            value={noteVal}
                            maxLength={80}
                            placeholder="ej: 5 días demorado"
                            onChange={e=>setNoteDraft(d=>({...d,[l.key]:e.target.value}))}
                            onKeyDown={e=>{if(e.key==="Enter")saveNote(l.key);}}
                            disabled={nsv}
                            style={{flex:1,minWidth:0,padding:"6px 10px",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,color:"#fff",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"0.5px",outline:"none"}}
                          />
                          <button onClick={()=>saveNote(l.key)} disabled={nsv||!dirty}
                            style={{padding:"6px 11px",borderRadius:6,border:"1px solid rgba(245,224,58,0.3)",background:dirty?"rgba(245,224,58,0.12)":"rgba(255,255,255,0.04)",color:dirty?"var(--lemon)":"var(--muted2)",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"1.2px",fontWeight:700,cursor:dirty&&!nsv?"pointer":"default",opacity:nsv?0.55:1,flexShrink:0}}>
                            {nsv?"…":"Guardar"}
                          </button>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {NOTE_PRESETS.map(p=>(
                            <button key={p} onClick={()=>applyPreset(l.key,p)} disabled={nsv}
                              style={{padding:"3px 9px",borderRadius:4,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:p==="Sin demoras"?"#22c55e":"#fbbf24",fontFamily:"'DM Mono',monospace",fontSize:9.5,letterSpacing:"0.8px",fontWeight:600,cursor:nsv?"wait":"pointer",opacity:nsv?0.5:1}}>
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer: acciones masivas país */}
              {totalC>1&&(
                <div style={{display:"flex",gap:8,padding:"12px 22px 16px",borderTop:"1px solid var(--border)",background:"rgba(255,255,255,0.012)"}}>
                  <button onClick={()=>toggleCountry(c.key,true)} disabled={savingC||allOn}
                    style={{flex:1,padding:"9px 12px",borderRadius:8,border:"1px solid rgba(34,197,94,0.3)",background:allOn?"rgba(34,197,94,0.18)":"rgba(34,197,94,0.06)",color:"#22c55e",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"1.5px",fontWeight:700,cursor:allOn||savingC?"default":"pointer",transition:"all .25s",opacity:allOn?.5:1}}>
                    ✓ Activar todo
                  </button>
                  <button onClick={()=>toggleCountry(c.key,false)} disabled={savingC||allOff}
                    style={{flex:1,padding:"9px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,0.3)",background:allOff?"rgba(239,68,68,0.18)":"rgba(239,68,68,0.06)",color:"#ef4444",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"1.5px",fontWeight:700,cursor:allOff||savingC?"default":"pointer",transition:"all .25s",opacity:allOff?.5:1}}>
                    ✕ Pausar todo
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <style>{`@keyframes linePulse{0%,100%{opacity:.85;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}`}</style>
    </div>
  );
}

// ── Coupons Panel ────────────────────────────────────────────────────────────
const COUPON_LANES=[
  {key:"all",label:"Todas",emoji:"🌍"},
  {key:"usa",label:"USA",emoji:"🇺🇸"},
  {key:"china",label:"China",emoji:"🇨🇳"},
  {key:"europa",label:"Europa",emoji:"🇪🇺"},
  {key:"normal",label:"Normal",emoji:"📦"},
  {key:"express",label:"Express",emoji:"⚡"},
];
function CouponsPanel({toast}){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [draft,setDraft]=useState({code:"",description:"",discount_pct:"",discount_usd:"",applies_to:"all",min_kg:"",max_uses:"",expires_at:""});
  const [saving,setSaving]=useState(false);
  async function load(){
    setLoading(true);
    try{
      const r=await fetch(`${API}/admin/coupons`,{headers:{Authorization:`Bearer ${getToken()}`}});
      const d=await r.json();
      if(d.ok)setItems(d.coupons);
    }catch{toast("Error","err");}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  function genCode(){
    const c="LMN" + Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5);
    setDraft(d=>({...d,code:c}));
  }
  async function create(){
    if(!draft.code.trim())return toast("Falta código","warn");
    if(!draft.discount_pct&&!draft.discount_usd)return toast("Definí descuento","warn");
    setSaving(true);
    try{
      const body={
        code:draft.code.trim().toUpperCase(),
        description:draft.description.trim()||null,
        discount_pct:draft.discount_pct?Number(draft.discount_pct):null,
        discount_usd:draft.discount_usd?Number(draft.discount_usd):null,
        applies_to:draft.applies_to,
        min_kg:draft.min_kg?Number(draft.min_kg):0,
        max_uses:draft.max_uses?Number(draft.max_uses):null,
        expires_at:draft.expires_at?new Date(draft.expires_at).toISOString():null,
      };
      const r=await fetch(`${API}/admin/coupons`,{method:"POST",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json();
      if(d.ok){toast(`✓ ${body.code} creado`);setDraft({code:"",description:"",discount_pct:"",discount_usd:"",applies_to:"all",min_kg:"",max_uses:"",expires_at:""});await load();}
      else toast(d.error||"Error","err");
    }catch{toast("Error de red","err");}
    finally{setSaving(false);}
  }
  async function toggleActive(c){
    try{
      const r=await fetch(`${API}/admin/coupons/${c.id}`,{method:"PATCH",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({active:!c.active})});
      const d=await r.json();if(d.ok){toast(c.active?"Pausado":"Activado");await load();}
    }catch{toast("Error","err");}
  }
  async function del(c){
    if(!window.confirm(`¿Borrar ${c.code}?`))return;
    try{
      const r=await fetch(`${API}/admin/coupons/${c.id}`,{method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}});
      const d=await r.json();if(d.ok){toast("Eliminado");await load();}
    }catch{toast("Error","err");}
  }
  function copyCode(c){
    navigator.clipboard.writeText(c.code);
    toast(`Copiado: ${c.code}`);
  }
  const active=items.filter(c=>c.active).length;
  const expired=items.filter(c=>c.expires_at&&new Date(c.expires_at)<new Date()).length;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:22}}>
      <EditorialHero
        eyebrow="Marketing"
        title="CUPONES"
        em="DESCUENTO"
        watermark="DEALS"
        live={active>0}
        meta={[`${items.length} totales`,`${active} activos`,`${expired} expirados`]}
      />

      <Card accent="#ec4899" style={{padding:"22px 24px"}}>
        <div className="sectionLabel" style={{marginBottom:18}}>🎟 Crear nuevo cupón</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:14}}>
          <div>
            <Lbl>Código *</Lbl>
            <div style={{display:"flex",gap:6}}>
              <input className="input" placeholder="MAYO15" value={draft.code} onChange={e=>setDraft(d=>({...d,code:e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,"")}))} maxLength={40} style={{flex:1}}/>
              <Btn onClick={genCode} v="ghost" size="sm">🎲</Btn>
            </div>
          </div>
          <div>
            <Lbl>Descripción</Lbl>
            <input className="input" placeholder="Promo Mayo" value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))} maxLength={200}/>
          </div>
          <div>
            <Lbl>Descuento %</Lbl>
            <input className="input" type="number" placeholder="15" value={draft.discount_pct} onChange={e=>setDraft(d=>({...d,discount_pct:e.target.value,discount_usd:""}))} max={100}/>
          </div>
          <div>
            <Lbl>Descuento USD fijo</Lbl>
            <input className="input" type="number" placeholder="10" value={draft.discount_usd} onChange={e=>setDraft(d=>({...d,discount_usd:e.target.value,discount_pct:""}))}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <Lbl>Aplica a</Lbl>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {COUPON_LANES.map(l=>{
                const sel=draft.applies_to===l.key;
                return(
                  <button key={l.key} onClick={()=>setDraft(d=>({...d,applies_to:l.key}))}
                    style={{padding:"7px 12px",border:`1px solid ${sel?"#ec489966":"var(--border)"}`,background:sel?"rgba(236,72,153,0.1)":"var(--faint2)",color:sel?"#ec4899":"var(--muted)",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"1.2px",fontWeight:700,textTransform:"uppercase",borderRadius:6}}>
                    {l.emoji} {l.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Lbl>Mín. kg (opcional)</Lbl>
            <input className="input" type="number" placeholder="0" value={draft.min_kg} onChange={e=>setDraft(d=>({...d,min_kg:e.target.value}))}/>
          </div>
          <div>
            <Lbl>Usos máx (opcional)</Lbl>
            <input className="input" type="number" placeholder="∞" value={draft.max_uses} onChange={e=>setDraft(d=>({...d,max_uses:e.target.value}))}/>
          </div>
          <div>
            <Lbl>Expira (opcional)</Lbl>
            <input className="input" type="datetime-local" value={draft.expires_at} onChange={e=>setDraft(d=>({...d,expires_at:e.target.value}))}/>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <Btn onClick={create} disabled={saving||!draft.code} v="primary" size="lg" style={{padding:"0 28px"}}>
            {saving?"…":"⚡ Crear cupón"}
          </Btn>
        </div>
      </Card>

      <Card style={{padding:"20px 22px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div className="sectionLabel" style={{margin:0}}>📋 Cupones ({items.length})</div>
          <Btn onClick={load} v="ghost" size="sm">↻</Btn>
        </div>
        {loading?(
          <div style={{padding:30,textAlign:"center",color:"var(--muted2)",fontSize:12}}>Cargando…</div>
        ):items.length===0?(
          <div style={{padding:40,textAlign:"center"}}>
            <div style={{fontSize:36,opacity:.4,marginBottom:8}}>🎟</div>
            <div style={{fontSize:13,color:"var(--muted2)"}}>Sin cupones todavía</div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {items.map(c=>{
              const lane=COUPON_LANES.find(l=>l.key===c.applies_to)||{label:c.applies_to,emoji:"📦"};
              const exp=c.expires_at&&new Date(c.expires_at)<new Date();
              const exhausted=c.max_uses&&c.used_count>=c.max_uses;
              return(
                <div key={c.id} style={{display:"flex",gap:12,padding:"14px 16px",background:!c.active||exp||exhausted?"rgba(239,68,68,0.025)":"rgba(236,72,153,0.04)",border:`1px solid ${!c.active||exp||exhausted?"rgba(239,68,68,0.2)":"rgba(236,72,153,0.25)"}`,borderRadius:12,opacity:!c.active?.6:1,alignItems:"center"}}>
                  <button onClick={()=>copyCode(c)} title="Copiar código" style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:900,color:"#ec4899",padding:"8px 14px",background:"rgba(236,72,153,0.08)",border:"1px solid rgba(236,72,153,0.4)",borderRadius:8,cursor:"pointer",letterSpacing:"1px",flexShrink:0}}>{c.code} 📋</button>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:14,fontWeight:800,color:"#fff"}}>
                        {c.discount_pct?`${c.discount_pct}% OFF`:`$${Number(c.discount_usd).toFixed(2)} OFF`}
                      </span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"1.2px",padding:"2px 7px",background:"rgba(236,72,153,0.1)",border:"1px solid rgba(236,72,153,0.3)",color:"#ec4899",borderRadius:4,textTransform:"uppercase"}}>{lane.emoji} {lane.label}</span>
                      {!c.active&&<span style={{fontSize:9,fontWeight:700,letterSpacing:"1.5px",padding:"2px 7px",color:"#ef4444",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:4,fontFamily:"'DM Mono',monospace"}}>PAUSADO</span>}
                      {exp&&<span style={{fontSize:9,fontWeight:700,letterSpacing:"1.5px",padding:"2px 7px",color:"#ef4444",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:4,fontFamily:"'DM Mono',monospace"}}>EXPIRADO</span>}
                      {exhausted&&<span style={{fontSize:9,fontWeight:700,letterSpacing:"1.5px",padding:"2px 7px",color:"#ef4444",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:4,fontFamily:"'DM Mono',monospace"}}>AGOTADO</span>}
                    </div>
                    {c.description&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:3}}>{c.description}</div>}
                    <div style={{fontSize:10,color:"var(--muted2)",fontFamily:"'DM Mono',monospace",letterSpacing:".5px"}}>
                      Usos: {c.used_count}{c.max_uses?`/${c.max_uses}`:" / ∞"}
                      {c.min_kg>0&&` · Mín ${c.min_kg}kg`}
                      {c.expires_at&&` · Expira ${fmtDate(c.expires_at)}`}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button onClick={()=>toggleActive(c)} title={c.active?"Pausar":"Activar"} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${c.active?"rgba(34,197,94,0.4)":"rgba(239,68,68,0.4)"}`,background:c.active?"rgba(34,197,94,0.06)":"rgba(239,68,68,0.06)",color:c.active?"#22c55e":"#ef4444",cursor:"pointer",fontSize:11}}>{c.active?"●":"○"}</button>
                    <button onClick={()=>del(c)} title="Borrar" style={{padding:"6px 10px",borderRadius:6,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.04)",color:"#ef4444",cursor:"pointer",fontSize:11}}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Emojis Panel ─────────────────────────────────────────────────────────────
function EmojisPanel({toast}){
  const [emojis,setEmojis]=useState([]);
  const [loading,setLoading]=useState(true);
  const [uploading,setUploading]=useState(false);
  const [draftKey,setDraftKey]=useState("");
  const [draftLabel,setDraftLabel]=useState("");
  const [draftCategory,setDraftCategory]=useState("general");
  const [draftFile,setDraftFile]=useState(null);
  const [preview,setPreview]=useState(null);
  async function load(){
    setLoading(true);
    try{
      const r=await fetch(`${API}/api/chat/emojis`,{headers:{Authorization:`Bearer ${getToken()}`}});
      const d=await r.json();
      if(d.ok)setEmojis(d.emojis);
    }catch{toast("Error cargando","err");}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  function handleFile(e){
    const f=e.target.files[0];
    if(!f)return;
    if(!f.type.startsWith("image/"))return toast("Solo imágenes (PNG/WEBP/GIF)","err");
    if(f.size>2*1024*1024)return toast("Máximo 2MB","err");
    setDraftFile(f);
    const reader=new FileReader();
    reader.onload=ev=>setPreview(ev.target.result);
    reader.readAsDataURL(f);
  }
  async function upload(){
    if(!draftKey||!/^[a-z0-9_]{2,30}$/.test(draftKey))return toast("Key inválida (a-z, 0-9, _, 2-30)","warn");
    if(!draftFile)return toast("Subí un archivo","warn");
    setUploading(true);
    try{
      const fd=new FormData();
      fd.append("file",draftFile);
      fd.append("key",draftKey);
      fd.append("label",draftLabel||draftKey);
      fd.append("category",draftCategory);
      const r=await fetch(`${API}/api/chat/emojis`,{method:"POST",headers:{Authorization:`Bearer ${getToken()}`},body:fd});
      const d=await r.json();
      if(d.ok){
        toast(`✓ :${draftKey}: subido`);
        setDraftKey("");setDraftLabel("");setDraftFile(null);setPreview(null);
        await load();
      }else toast(d.error||"Error","err");
    }catch{toast("Error de red","err");}
    finally{setUploading(false);}
  }
  async function del(key){
    if(!window.confirm(`¿Borrar :${key}:?`))return;
    try{
      const r=await fetch(`${API}/api/chat/emojis/${key}`,{method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}});
      const d=await r.json();
      if(d.ok){toast("Eliminado");await load();}
    }catch{toast("Error","err");}
  }
  const CATEGORIES=["general","reacciones","lemons","memes","stickers"];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:22}}>
      <EditorialHero
        eyebrow="Customización chat"
        title="EMOJIS"
        em="CUSTOM"
        watermark="EMOJI"
        live={emojis.length>0}
        meta={[
          `${emojis.length} subidos`,
          ...CATEGORIES.map(c=>`${c}: ${emojis.filter(e=>e.category===c).length}`),
        ]}
      />

      <div style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px",background:"rgba(167,139,250,.04)",border:"1px solid rgba(167,139,250,.14)",borderRadius:12}}>
        <span style={{fontSize:18,lineHeight:1}}>💡</span>
        <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.7}}>
          Subí PNG/WEBP/GIF de hasta 2MB. Usá una <strong style={{color:"#a78bfa"}}>key corta</strong> (ej: <code>lemon_party</code>). En el chat se invocan con <code>:lemon_party:</code>. Tamaño recomendado: <strong>128×128</strong>. GIFs se mantienen animados.
        </div>
      </div>

      {/* FORM SUBIR */}
      <Card accent="#a78bfa" style={{padding:"22px 24px"}}>
        <div className="sectionLabel" style={{marginBottom:18}}>📤 Subir nuevo emoji</div>
        <div style={{display:"grid",gridTemplateColumns:"180px 1fr",gap:18,alignItems:"start"}}>
          {/* Preview */}
          <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:180,borderRadius:14,border:"2px dashed rgba(167,139,250,.4)",background:"rgba(167,139,250,.04)",cursor:"pointer",position:"relative",overflow:"hidden",transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(167,139,250,.7)"} onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(167,139,250,.4)"}>
            {preview?(
              <img src={preview} alt="preview" style={{maxWidth:"80%",maxHeight:"80%",objectFit:"contain"}}/>
            ):(
              <>
                <div style={{fontSize:36,opacity:.4,marginBottom:8}}>🖼</div>
                <div style={{fontSize:11,color:"var(--muted2)",fontFamily:"'DM Mono',monospace",letterSpacing:"1px",textTransform:"uppercase"}}>Click para subir</div>
                <div style={{fontSize:9,color:"var(--muted2)",marginTop:4}}>PNG/WEBP/GIF · 2MB</div>
              </>
            )}
            <input type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
          </label>
          {/* Fields */}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div>
              <Lbl>Key (identificador único) *</Lbl>
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",background:"var(--faint2)",border:"1px solid var(--border)",borderRadius:8}}>
                <span style={{color:"var(--muted2)",fontFamily:"'DM Mono',monospace"}}>:</span>
                <input value={draftKey} onChange={e=>setDraftKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} placeholder="lemon_party" maxLength={30} style={{flex:1,background:"none",border:"none",color:"var(--text)",fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,outline:"none"}}/>
                <span style={{color:"var(--muted2)",fontFamily:"'DM Mono',monospace"}}>:</span>
              </div>
              <div style={{fontSize:10,color:"var(--muted2)",marginTop:4,fontFamily:"'DM Mono',monospace"}}>Solo letras, números y _. Min 2, max 30.</div>
            </div>
            <div>
              <Lbl>Label (nombre visible)</Lbl>
              <input className="input" value={draftLabel} onChange={e=>setDraftLabel(e.target.value)} placeholder="Lemon Party" maxLength={40}/>
            </div>
            <div>
              <Lbl>Categoría</Lbl>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {CATEGORIES.map(c=>{
                  const sel=draftCategory===c;
                  return(
                    <button key={c} onClick={()=>setDraftCategory(c)}
                      style={{padding:"6px 12px",border:`1px solid ${sel?"#a78bfa66":"var(--border)"}`,background:sel?"rgba(167,139,250,.1)":"var(--faint2)",color:sel?"#a78bfa":"var(--muted)",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"1.2px",fontWeight:700,textTransform:"uppercase",borderRadius:6}}>
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:6}}>
              <Btn onClick={upload} disabled={uploading||!draftKey||!draftFile} v="primary" size="lg" style={{padding:"0 28px"}}>
                {uploading?"…":"⚡ Subir emoji"}
              </Btn>
            </div>
          </div>
        </div>
      </Card>

      {/* LISTA */}
      <Card style={{padding:"20px 22px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div className="sectionLabel" style={{margin:0}}>🎨 Emojis subidos ({emojis.length})</div>
          <Btn onClick={load} v="ghost" size="sm">↻ Refrescar</Btn>
        </div>
        {loading?(
          <div style={{padding:30,textAlign:"center",color:"var(--muted2)",fontSize:12}}>Cargando…</div>
        ):emojis.length===0?(
          <div style={{padding:40,textAlign:"center"}}>
            <div style={{fontSize:36,opacity:.4,marginBottom:8}}>🖼</div>
            <div style={{fontSize:13,color:"var(--muted2)"}}>Sin emojis todavía</div>
            <div style={{fontSize:11,color:"var(--muted2)",marginTop:6,fontFamily:"'DM Mono',monospace"}}>Subí el primero arriba ↑</div>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
            {emojis.map(e=>(
              <div key={e.key} style={{background:"rgba(255,255,255,.02)",border:"1px solid var(--border)",borderRadius:12,padding:12,textAlign:"center",position:"relative",transition:"all .25s"}}>
                <img src={e.url} alt={e.key} style={{width:56,height:56,objectFit:"contain",margin:"0 auto 8px",display:"block"}}/>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--lemon)",fontWeight:700,marginBottom:3,letterSpacing:".5px"}}>:{e.key}:</div>
                <div style={{fontSize:10,color:"var(--muted2)",marginBottom:4}}>{e.label||"—"}</div>
                <div style={{fontSize:9,color:"var(--muted2)",fontFamily:"'DM Mono',monospace",letterSpacing:"1px",textTransform:"uppercase",marginBottom:8}}>{e.category}{e.kind==="animated"?" · GIF":""}</div>
                <button onClick={()=>del(e.key)} title="Borrar"
                  style={{position:"absolute",top:6,right:6,width:24,height:24,borderRadius:6,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.06)",color:"#ef4444",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Announcements Panel ──────────────────────────────────────────────────────
const ANN_CATS=[
  {key:"general", label:"Anuncio",  emoji:"📢", color:"#ede9e0"},
  {key:"urgente", label:"Urgente",  emoji:"🚨", color:"#ef4444"},
  {key:"linea",   label:"Líneas",   emoji:"🌐", color:"#f5e03a"},
  {key:"feriado", label:"Feriado",  emoji:"🎌", color:"#60a5fa"},
  {key:"tip",     label:"Tip",      emoji:"💡", color:"#fbbf24"},
  {key:"novedad", label:"Novedad",  emoji:"✨", color:"#a78bfa"},
];
const ANN_DRAFT_DEFAULT={title:"",body:"",category:"general",emoji:"",link_url:"",link_label:"",pinned:false,expires_at:"",notify:true};
function AnnouncementsPanel({toast}){
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [draft,setDraft]=useState(ANN_DRAFT_DEFAULT);
  const [editingId,setEditingId]=useState(null);
  const [saving,setSaving]=useState(false);
  async function load(){
    setLoading(true);
    try{
      const r=await fetch(`${API}/api/announcements?all=1`,{headers:{Authorization:`Bearer ${getToken()}`}});
      const d=await r.json();
      if(d.ok)setItems(d.announcements);
    }catch{toast("Error cargando","err");}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  function startEdit(a){
    setEditingId(a.id);
    setDraft({
      title:a.title||"",
      body:a.body||"",
      category:a.category||"general",
      emoji:a.emoji||"",
      link_url:a.link_url||"",
      link_label:a.link_label||"",
      pinned:!!a.pinned,
      expires_at:a.expires_at?a.expires_at.slice(0,16):"",
    });
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function cancelEdit(){setEditingId(null);setDraft(ANN_DRAFT_DEFAULT);}
  async function save(){
    if(!draft.title.trim())return toast("Falta título","warn");
    setSaving(true);
    const body={
      title:draft.title.trim(),
      body:draft.body.trim()||null,
      category:draft.category,
      emoji:draft.emoji.trim()||null,
      link_url:draft.link_url.trim()||null,
      link_label:draft.link_label.trim()||null,
      pinned:!!draft.pinned,
      expires_at:draft.expires_at?new Date(draft.expires_at).toISOString():null,
    };
    if(!editingId)body.notify=draft.notify!==false;
    try{
      const url=editingId?`${API}/api/announcements/${editingId}`:`${API}/api/announcements`;
      const method=editingId?"PATCH":"POST";
      const r=await fetch(url,{method,headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json();
      if(d.ok){
        const msg=editingId?"Actualizado ✓":(d.notified?`Publicado ✓ · ${d.notified} notificaciones enviadas`:"Publicado ✓");
        toast(msg);cancelEdit();await load();
      }
      else toast(d.error||"Error","err");
    }catch{toast("Error de red","err");}
    finally{setSaving(false);}
  }
  async function togglePin(a){
    try{
      const r=await fetch(`${API}/api/announcements/${a.id}`,{method:"PATCH",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({pinned:!a.pinned})});
      const d=await r.json();if(d.ok){toast(a.pinned?"Despinneado":"Fijado en destacado");await load();}
    }catch{toast("Error","err");}
  }
  async function toggleActive(a){
    try{
      const r=await fetch(`${API}/api/announcements/${a.id}`,{method:"PATCH",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({active:!a.active})});
      const d=await r.json();if(d.ok){toast(a.active?"Pausado":"Activado");await load();}
    }catch{toast("Error","err");}
  }
  async function del(a){
    if(!window.confirm(`¿Borrar "${a.title}"?`))return;
    try{
      const r=await fetch(`${API}/api/announcements/${a.id}`,{method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}});
      const d=await r.json();if(d.ok){toast("Eliminado");await load();}
    }catch{toast("Error","err");}
  }
  const activeCount=items.filter(a=>a.active).length;
  const pinnedCount=items.filter(a=>a.pinned).length;
  const cat=ANN_CATS.find(c=>c.key===draft.category)||ANN_CATS[0];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:22}}>
      <EditorialHero
        eyebrow="Comunicación"
        title="ANUNCIOS"
        em="EN VIVO"
        watermark="NEWS"
        live={activeCount>0}
        meta={[
          `${items.length} totales`,
          `${activeCount} activos`,
          `${pinnedCount} destacados`,
        ]}
      />

      {/* Form crear/editar */}
      <Card accent={cat.color} style={{padding:"24px 26px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <div className="sectionLabel" style={{margin:0}}>{editingId?`✏️ Editando #${editingId}`:"📢 Publicar nuevo anuncio"}</div>
          {editingId&&<Btn onClick={cancelEdit} v="ghost" size="sm">Cancelar</Btn>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,marginBottom:14}}>
          <div style={{gridColumn:"1/-1"}}>
            <Lbl>Título *</Lbl>
            <input className="input" placeholder="Ej: Feriado en China del 1 al 5 de Mayo" value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} maxLength={140}/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <Lbl>Texto (opcional)</Lbl>
            <textarea className="input" rows={3} placeholder="Detalle del anuncio. Aparece debajo del título." value={draft.body} onChange={e=>setDraft(d=>({...d,body:e.target.value}))} maxLength={2000} style={{resize:"vertical",minHeight:80,fontFamily:"'Barlow',sans-serif"}}/>
          </div>
          <div>
            <Lbl>Categoría</Lbl>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {ANN_CATS.map(c=>{
                const sel=draft.category===c.key;
                return(
                  <button key={c.key} onClick={()=>setDraft(d=>({...d,category:c.key}))}
                    style={{padding:"7px 12px",border:`1px solid ${sel?c.color+"66":"var(--border)"}`,background:sel?c.color+"1a":"var(--faint2)",color:sel?c.color:"var(--muted)",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"1.2px",fontWeight:700,textTransform:"uppercase",borderRadius:6,transition:"all .2s"}}>
                    {c.emoji} {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Lbl>Emoji custom (opcional)</Lbl>
            <input className="input" placeholder="🚨 / 🎌 / 💡" value={draft.emoji} onChange={e=>setDraft(d=>({...d,emoji:e.target.value}))} maxLength={8}/>
          </div>
          <div>
            <Lbl>URL CTA (opcional)</Lbl>
            <input className="input" placeholder="https://..." value={draft.link_url} onChange={e=>setDraft(d=>({...d,link_url:e.target.value}))}/>
          </div>
          <div>
            <Lbl>Label CTA (opcional)</Lbl>
            <input className="input" placeholder="Más info / Ver más" value={draft.link_label} onChange={e=>setDraft(d=>({...d,link_label:e.target.value}))} maxLength={40}/>
          </div>
          <div>
            <Lbl>Expira (opcional)</Lbl>
            <input className="input" type="datetime-local" value={draft.expires_at} onChange={e=>setDraft(d=>({...d,expires_at:e.target.value}))}/>
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:10,flexWrap:"wrap"}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"10px 14px",background:draft.pinned?"rgba(245,224,58,0.06)":"var(--faint2)",border:`1px solid ${draft.pinned?"rgba(245,224,58,0.3)":"var(--border)"}`,borderRadius:8,transition:"all .2s",flex:1,minWidth:140}}>
              <input type="checkbox" checked={draft.pinned} onChange={e=>setDraft(d=>({...d,pinned:e.target.checked}))}/>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"1.5px",fontWeight:700,color:draft.pinned?"var(--lemon)":"var(--muted)"}}>📌 Destacar</span>
            </label>
            {!editingId&&(
              <label title="Aparece en la 🔔 de cada usuario" style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"10px 14px",background:draft.notify?"rgba(34,197,94,0.06)":"var(--faint2)",border:`1px solid ${draft.notify?"rgba(34,197,94,0.3)":"var(--border)"}`,borderRadius:8,transition:"all .2s",flex:1,minWidth:140}}>
                <input type="checkbox" checked={!!draft.notify} onChange={e=>setDraft(d=>({...d,notify:e.target.checked}))}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"1.5px",fontWeight:700,color:draft.notify?"#22c55e":"var(--muted)"}}>🔔 Notificar a todos</span>
              </label>
            )}
          </div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn onClick={save} disabled={saving||!draft.title.trim()} v="primary" size="lg" style={{padding:"0 28px"}}>
            {saving?"…":(editingId?"💾 Guardar cambios":"⚡ Publicar")}
          </Btn>
        </div>
      </Card>

      {/* Lista */}
      <Card style={{padding:"20px 22px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div className="sectionLabel" style={{margin:0}}>📋 Todos los anuncios ({items.length})</div>
          <Btn onClick={load} v="ghost" size="sm">↻ Refrescar</Btn>
        </div>
        {loading?(
          <div style={{padding:30,textAlign:"center",color:"var(--muted2)",fontSize:12}}>Cargando…</div>
        ):items.length===0?(
          <div style={{padding:40,textAlign:"center"}}>
            <div style={{fontSize:36,opacity:.4,marginBottom:8}}>📭</div>
            <div style={{fontSize:13,color:"var(--muted2)"}}>Sin anuncios todavía</div>
            <div style={{fontSize:11,color:"var(--muted2)",marginTop:6,fontFamily:"'DM Mono',monospace"}}>Publicá el primero arriba</div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {items.map(a=>{
              const c=ANN_CATS.find(x=>x.key===a.category)||ANN_CATS[0];
              const inactive=!a.active;
              const expired=a.expires_at&&new Date(a.expires_at)<new Date();
              return(
                <div key={a.id} style={{display:"flex",gap:12,padding:"14px 16px",background:inactive||expired?"rgba(239,68,68,0.025)":"rgba(255,255,255,0.018)",border:`1px solid ${inactive||expired?"rgba(239,68,68,0.2)":c.color+"33"}`,borderRadius:12,opacity:inactive?.6:1,transition:"all .25s"}}>
                  <div style={{fontSize:24,lineHeight:1,flexShrink:0,marginTop:3}}>{a.emoji||c.emoji}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,letterSpacing:"1.5px",padding:"3px 9px",color:c.color,background:c.color+"1a",border:`1px solid ${c.color}55`,borderRadius:4,textTransform:"uppercase"}}>{c.label}</span>
                      {a.pinned&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,letterSpacing:"1.5px",padding:"3px 9px",color:"var(--lemon)",background:"rgba(245,224,58,0.1)",border:"1px solid rgba(245,224,58,0.3)",borderRadius:4}}>📌 Destacado</span>}
                      {inactive&&<span style={{fontSize:9,fontWeight:700,letterSpacing:"1.5px",padding:"3px 9px",color:"#ef4444",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:4,fontFamily:"'DM Mono',monospace"}}>PAUSADO</span>}
                      {expired&&<span style={{fontSize:9,fontWeight:700,letterSpacing:"1.5px",padding:"3px 9px",color:"#ef4444",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:4,fontFamily:"'DM Mono',monospace"}}>EXPIRADO</span>}
                      <span style={{fontSize:10,color:"var(--muted2)",marginLeft:"auto",fontFamily:"'DM Mono',monospace"}}>#{a.id} · {fmtDate(a.created_at)}</span>
                    </div>
                    <div style={{fontFamily:"'Barlow',sans-serif",fontSize:14,fontWeight:700,color:"var(--text)",lineHeight:1.35,marginBottom:a.body?4:0}}>{a.title}</div>
                    {a.body&&<div style={{fontSize:12,color:"var(--muted)",lineHeight:1.55}}>{a.body}</div>}
                    {a.link_url&&<div style={{fontSize:11,color:c.color,marginTop:6,fontFamily:"'DM Mono',monospace",letterSpacing:"0.5px"}}>↗ {a.link_label||a.link_url}</div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0,alignItems:"flex-end"}}>
                    <button onClick={()=>togglePin(a)} title={a.pinned?"Despinear":"Fijar"} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${a.pinned?"rgba(245,224,58,0.4)":"var(--border)"}`,background:a.pinned?"rgba(245,224,58,0.1)":"transparent",color:a.pinned?"var(--lemon)":"var(--muted2)",cursor:"pointer",fontSize:11}}>📌</button>
                    <button onClick={()=>toggleActive(a)} title={a.active?"Pausar":"Activar"} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${a.active?"rgba(34,197,94,0.4)":"rgba(239,68,68,0.4)"}`,background:a.active?"rgba(34,197,94,0.06)":"rgba(239,68,68,0.06)",color:a.active?"#22c55e":"#ef4444",cursor:"pointer",fontSize:11}}>{a.active?"●":"○"}</button>
                    <button onClick={()=>startEdit(a)} title="Editar" style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",background:"transparent",color:"var(--muted)",cursor:"pointer",fontSize:11}}>✏️</button>
                    <button onClick={()=>del(a)} title="Borrar" style={{padding:"6px 10px",borderRadius:6,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.04)",color:"#ef4444",cursor:"pointer",fontSize:11}}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Invite Panel ──────────────────────────────────────────────────────────────
function InvitePanel({toast}){
  const [codes,setCodes]=useState([]);const [loading,setLoading]=useState(true);const [generating,setGenerating]=useState(false);const [notes,setNotes]=useState("");const [qty,setQty]=useState(1);const [copied,setCopied]=useState(null);
  async function load(){setLoading(true);try{const r=await fetch(`${API}/admin/invite-codes`,{headers:{Authorization:`Bearer ${getToken()}`}});const d=await r.json();if(d.ok)setCodes(d.codes);}catch{toast("Error","err");}finally{setLoading(false);}}
  async function generate(){setGenerating(true);try{const r=await fetch(`${API}/admin/invite-codes`,{method:"POST",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({notes:notes||null,expires_days:1,quantity:qty})});const d=await r.json();if(d.ok){toast(`${d.codes.length} código(s) generado(s)`);setNotes("");await load();}else toast(d.error||"Error","err");}catch{toast("Error de red","err");}finally{setGenerating(false);}}
  async function del(id){await fetch(`${API}/admin/invite-codes/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}});await load();}
  function copy(code){navigator.clipboard.writeText(code);setCopied(code);setTimeout(()=>setCopied(null),2000);}
  function copyLink(code){navigator.clipboard.writeText(`${window.location.origin}/register?code=${code}`);setCopied(code+"_l");setTimeout(()=>setCopied(null),2000);}
  useEffect(()=>{load();},[]);
  const pending=codes.filter(c=>!c.used_by),used=codes.filter(c=>c.used_by);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,marginTop:22}}>
      <EditorialHero
        eyebrow="Acceso por invitación"
        title="CÓDIGOS"
        em="DE INVITACIÓN"
        watermark="INVITES"
        meta={[`${pending.length} pendientes`, `${used.length} usados`, "Validez 24h · Uso único"]}
      />
      <Card style={{padding:"22px 24px"}} accent="var(--lemon)">
        <div className="sectionLabel" style={{marginBottom:16}}>Generar códigos de invitación</div>
        <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",letterSpacing:"2px",color:"var(--orange)",marginBottom:18}}>VÁLIDOS 24H · USO ÚNICO</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div>
            <Lbl>Cantidad</Lbl>
            <div style={{display:"flex",gap:6}}>{[1,3,5,10].map(n=><button key={n} onClick={()=>setQty(n)} style={{width:44,height:42,borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:"1px",transition:"all .2s",background:qty===n?"var(--lemon)":"var(--faint2)",color:qty===n?"var(--void)":"var(--ghost)"}}>{n}</button>)}</div>
          </div>
          <div style={{flex:1,minWidth:160}}><Lbl>Nota (opcional)</Lbl><input className="input" placeholder="Para cliente..." value={notes} onChange={e=>setNotes(e.target.value)}/></div>
          <Btn onClick={generate} disabled={generating} v="primary" size="lg" style={{padding:"0 28px"}}>{generating?"…":"⚡ Generar"}</Btn>
        </div>
      </Card>
      <Card style={{padding:"20px 22px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:"2px"}}>Pendientes <span style={{color:"var(--lemon)"}}>{pending.length}</span></div>
          <Btn onClick={load} size="sm">↻ Actualizar</Btn>
        </div>
        {loading?<div style={{textAlign:"center",padding:20,color:"var(--muted2)",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"2px"}}>CARGANDO…</div>
        :pending.length===0?<div style={{textAlign:"center",padding:20,color:"var(--muted2)",fontSize:12,fontFamily:"'DM Mono',monospace",letterSpacing:"1px"}}>SIN CÓDIGOS PENDIENTES</div>
        :pending.map(c=>{
          const exp=c.expires_at?new Date(c.expires_at):null;
          const hrs=exp?Math.max(0,Math.round((exp-new Date())/3600000)):null;
          const soon=hrs!==null&&hrs<3;
          return(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:soon?"rgba(239,68,68,0.04)":"rgba(245,224,58,0.02)",border:`1px solid ${soon?"rgba(239,68,68,0.18)":"rgba(245,224,58,0.1)"}`,borderRadius:12,marginBottom:8,flexWrap:"wrap"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:"6px",color:"var(--lemon)",background:"rgba(245,224,58,0.07)",padding:"8px 18px",borderRadius:10,minWidth:130,textAlign:"center"}}>{c.code}</div>
              <div style={{flex:1}}>{c.notes&&<div style={{fontSize:12,color:"var(--ghost)",marginBottom:2}}>{c.notes}</div>}<div style={{fontSize:11,fontFamily:"'DM Mono',monospace",letterSpacing:"1px",color:soon?"#f87171":"var(--muted2)"}}>{exp?(hrs>0?`⏳ ${hrs}H RESTANTES`:"⚠ VENCIDO"):"SIN VENCIMIENTO"}</div></div>
              <div style={{display:"flex",gap:6}}>
                <Btn onClick={()=>copy(c.code)} size="sm" v={copied===c.code?"green":"ghost"}>{copied===c.code?"✓ COPIADO":"📋 COPIAR"}</Btn>
                <Btn onClick={()=>copyLink(c.code)} size="sm" v={copied===c.code+"_l"?"green":"ghost"}>{copied===c.code+"_l"?"✓":"🔗 LINK"}</Btn>
                <Btn onClick={()=>del(c.id)} size="sm" v="danger" style={{width:30,padding:0,justifyContent:"center"}}>✕</Btn>
              </div>
            </div>
          );
        })}
      </Card>
      {used.length>0&&(
        <Card style={{padding:"20px 22px"}} accent="#22c55e">
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:"2px",marginBottom:14}}>Usados <span style={{color:"#22c55e"}}>{used.length}</span></div>
          {used.slice(0,8).map(c=>(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"rgba(34,197,94,0.03)",border:"1px solid rgba(34,197,94,0.1)",borderRadius:10,marginBottom:6}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:"4px",color:"rgba(34,197,94,0.5)"}}>{c.code}</div>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:"#22c55e"}}>{c.used_by_name}</div><div style={{fontSize:11,color:"var(--muted2)"}}>{c.used_by_email}</div></div>
              <div style={{fontSize:9,fontFamily:"'DM Mono',monospace",letterSpacing:"2px",color:"rgba(34,197,94,0.5)"}}>✓ USADO</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
// Mapeo tab → scope. Una tab está permitida si me.scopes es null/contiene "*" o contiene el scope mapeado.
const TAB_SCOPES = {
  panel:   "general",
  lines:   "general",
  news:    "general",
  coupons: "general",
  emojis:  "general",
  wa:      "whatsapp",
  ia:      "general",
  ig:      "instagram",
  invites: "general",
};
function tabAllowed(tabKey, scopes) {
  if (!scopes || scopes.length === 0) return true;            // sin restricción
  if (scopes.includes("*")) return true;
  const s = TAB_SCOPES[tabKey] || "general";
  return scopes.includes(s);
}

export default function OperatorPanel(){
  const {toasts,toast,removeToast}=useToast();
  const [me,setMe]=useState(null);
  useEffect(()=>{
    const token = getToken();
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) setMe(d.user); })
      .catch(()=>{});
  },[]);
  const scopes = me?.scopes || null;
  const [opTab,setOpTab]=useState("panel");
  // Si el usuario no tiene scope para "panel", saltar a la primera tab permitida.
  useEffect(()=>{
    if (!scopes) return;
    if (!tabAllowed(opTab, scopes)) {
      const firstAllowed = Object.keys(TAB_SCOPES).find(k => tabAllowed(k, scopes));
      if (firstAllowed) setOpTab(firstAllowed);
    }
  },[scopes]);
  const [igSubTab,setIgSubTab]=useState("automations");
  const [panelTab,setPanelTab]=useState("envios");
  const [allClients,setAllClients]=useState([]);
  const [clientsLoading,setClientsLoading]=useState(false);
  const [clientSearch,setClientSearch]=useState("");
  const [nextClientNum,setNextClientNum]=useState("");
  const [showScanner,setShowScanner]=useState(false);
  const [scannerMode,setScannerMode]=useState("search");
  const [stats,setStats]=useState(null);
  const [loadingStats,setLoadingStats]=useState(false);
  const [newClientNumber,setNewClientNumber]=useState("");
  const [newName,setNewName]=useState("");
  const [newEmail,setNewEmail]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [clientNumber,setClientNumber]=useState("");
  const [client,setClient]=useState(null);
  const [defaults,setDefaults]=useState(DEFAULT_RATES_FALLBACK);
  const [rates,setRates]=useState({usa_normal:"",usa_express:"",usa_tech_premium:"",china_normal:"",china_express:"",europa_normal:""});
  const [savingRates,setSavingRates]=useState(false);
  const [packageCode,setPackageCode]=useState("");
  const [description,setDescription]=useState("");
  const [boxCode,setBoxCode]=useState("");
  const [tracking,setTracking]=useState("");
  const [weightKg,setWeightKg]=useState("");
  const [status,setStatus]=useState("Recibido en depósito");
  const [origin,setOrigin]=useState("USA");
  const [service,setService]=useState("NORMAL");
  const [overrideEnabled,setOverrideEnabled]=useState(false);
  const [overrideRate,setOverrideRate]=useState("");
  const [codeLoading,setCodeLoading]=useState(false);
  const [useRealWeight,setUseRealWeight]=useState(false);
  const [opSearch,setOpSearch]=useState("");
  const [opClientNumber,setOpClientNumber]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const [rows,setRows]=useState([]);
  const [savingId,setSavingId]=useState(null);
  const [statusDraft,setStatusDraft]=useState({});
  const [openId,setOpenId]=useState(null);
  const [events,setEvents]=useState([]);
  const [loadingEvents,setLoadingEvents]=useState(false);
  const [editId,setEditId]=useState(null);
  const [editDraft,setEditDraft]=useState({});
  const [savingEditId,setSavingEditId]=useState(null);
  const [editRateCtx,setEditRateCtx]=useState(null);
  const [editRateLoading,setEditRateLoading]=useState(false);
  const editRateCacheRef=useRef(new Map());

  const handleScan=code=>{
    if(scannerMode==="fill")setTracking(code);
    else if(scannerMode==="fill_edit")setEditDraft(p=>({...p,tracking:code}));
    else{setOpSearch(code);setTimeout(()=>loadShipments(code),100);}
    setShowScanner(false);toast(`📷 ${code}`);
  };

  const laneRate=useMemo(()=>getLaneRate({origin:normalizeOrigin(origin),service:normalizeService(origin,service),rates,defaults}),[origin,service,rates,defaults]);
  const appliedRate=useMemo(()=>overrideEnabled?(numOrNull(overrideRate)??0):Number(laneRate||0),[overrideEnabled,overrideRate,laneRate]);
  const realKg=useMemo(()=>{const w=num(weightKg,NaN);return Number.isFinite(w)&&w>0?w:0;},[weightKg]);
  const isBelowMin=realKg>0&&realKg<MIN_BILLABLE_KG;
  const billedKg=useMemo(()=>{const w=num(weightKg,NaN);if(!Number.isFinite(w)||w<=0)return 0;return(useRealWeight||!isBelowMin)?w:MIN_BILLABLE_KG;},[weightKg,useRealWeight,isBelowMin]);
  const estimated=useMemo(()=>billedKg<=0?0:billedKg*Number(appliedRate||0),[billedKg,appliedRate]);

  useEffect(()=>{const a=SERVICES_BY_ORIGIN[origin]||["NORMAL"];if(!a.includes(service))setService(a[0]);},[origin]);
  useEffect(()=>{
    async function fetchCode(){setCodeLoading(true);try{const r=await fetch(`${API}/operator/next-code?origin=${origin}&service=${normalizeService(origin,service)}&t=${Date.now()}`,{headers:{Authorization:`Bearer ${getToken()}`}});const d=await r.json();if(d.code)setPackageCode(d.code);}catch{}finally{setCodeLoading(false);}}
    fetchCode();
  },[origin,service]);

  async function loadDashboard(){setLoadingStats(true);try{const r=await fetch(`${API}/operator/dashboard`,{headers:{Authorization:`Bearer ${getToken()}`}});const d=await r.json();if(r.ok)setStats(d.stats);}catch{}finally{setLoadingStats(false);}}
  async function loadAllClients(){setClientsLoading(true);try{const r=await fetch(`${API}/operator/clients/all`,{headers:{Authorization:`Bearer ${getToken()}`}});const d=await r.json();if(r.ok){const c=d.clients||[];setAllClients(c);setNextClientNum(String(c.reduce((mx,x)=>Math.max(mx,Number(x.client_number)||0),0)+1));}}catch{}setClientsLoading(false);}
  async function createClient(){
    const n=Number(newClientNumber);
    if(Number.isNaN(n)||n<0)return toast("Número de cliente inválido","err");
    if(!newName||!newEmail||!newPassword)return toast("Completá todos los campos","warn");
    const r=await fetch(`${API}/operator/clients`,{method:"POST",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({client_number:n,name:newName,email:newEmail,password:newPassword,role:"client"})});
    const d=await r.json();if(!r.ok)return toast(d?.error||"Error","err");
    toast(`✓ Cliente #${d.user.client_number} creado`);setNewClientNumber("");setNewName("");setNewEmail("");setNewPassword("");
    await loadAllClients();await loadDashboard();
  }
  async function findClient(){
    setClient(null);const n=Number(clientNumber);if(Number.isNaN(n))return toast("Número inválido","err");
    const r=await fetch(`${API}/operator/clients?client_number=${n}`,{headers:{Authorization:`Bearer ${getToken()}`}});
    const d=await r.json();if(!r.ok)return toast(d?.error||"Error","err");if(!d.user)return toast("Cliente no encontrado","warn");
    setClient(d.user);setDefaults(d.defaults||DEFAULT_RATES_FALLBACK);
    const rt=d.rates||null;setRates({usa_normal:rt?.usa_normal??"",usa_express:rt?.usa_express??"",usa_tech_premium:rt?.usa_tech_premium??"",china_normal:rt?.china_normal??"",china_express:rt?.china_express??"",europa_normal:rt?.europa_normal??""});
  }
  async function saveClientRates(){
    if(!client?.id)return toast("Buscá un cliente primero","warn");setSavingRates(true);
    try{const p={usa_normal:numOrNull(rates.usa_normal),usa_express:numOrNull(rates.usa_express),usa_tech_premium:numOrNull(rates.usa_tech_premium),china_normal:numOrNull(rates.china_normal),china_express:numOrNull(rates.china_express),europa_normal:numOrNull(rates.europa_normal)};
      const r=await fetch(`${API}/operator/clients/${client.id}/rates`,{method:"PUT",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify(p)});
      const d=await r.json();if(!r.ok)return toast(d?.error||"Error","err");
      setDefaults(d.defaults||DEFAULT_RATES_FALLBACK);setRates({usa_normal:d?.rates?.usa_normal??"",usa_express:d?.rates?.usa_express??"",usa_tech_premium:d?.rates?.usa_tech_premium??"",china_normal:d?.rates?.china_normal??"",china_express:d?.rates?.china_express??"",europa_normal:d?.rates?.europa_normal??""});
      editRateCacheRef.current.delete(String(client.client_number));toast("Tarifas guardadas ✓");}catch{toast("Error","err");}finally{setSavingRates(false);}
  }
  async function createShipment(){
    if(!client)return toast("Buscá un cliente primero","warn");
    if(!packageCode||!description||!weightKg)return toast("Faltan campos","warn");
    const wp=num(weightKg,NaN);if(!Number.isFinite(wp)||wp<=0)return toast("Peso inválido","err");
    if(overrideEnabled){const rt=numOrNull(overrideRate);if(rt==null||rt<0)return toast("Tarifa inválida","err");}
    const body={client_number:client.client_number,package_code:packageCode,description,box_code:boxCode||null,tracking:tracking||null,weight_kg:wp,status,origin:normalizeOrigin(origin),service:normalizeService(origin,service),charge_real_weight:useRealWeight};
    const bill=(useRealWeight||wp>=MIN_BILLABLE_KG)?wp:MIN_BILLABLE_KG;
    if(overrideEnabled){const rt=Number(numOrNull(overrideRate)||0);body.rate_usd_per_kg=rt;body.estimated_usd=Number((bill*rt).toFixed(2));}
    else{const lR=getLaneRate({origin:normalizeOrigin(origin),service:normalizeService(origin,service),rates,defaults});body.estimated_usd=Number((bill*lR).toFixed(2));body.rate_usd_per_kg=lR;}
    const r=await fetch(`${API}/operator/shipments`,{method:"POST",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
    const d=await r.json();if(!r.ok)return toast(d?.error||"Error","err");
    toast(`✓ Envío ${d.shipment?.code||packageCode} creado`);
    setPackageCode("");setDescription("");setBoxCode("");setTracking("");setWeightKg("");setStatus("Recibido en depósito");setOrigin("USA");setService("NORMAL");setOverrideEnabled(false);setOverrideRate("");setUseRealWeight(false);
    await loadShipments();await loadDashboard();setPanelTab("envios");
  }
  async function loadShipments(ov){
    const qs=new URLSearchParams();const sv=ov!==undefined?ov:opSearch;
    if(sv.trim())qs.set("search",sv.trim());if(opClientNumber.trim())qs.set("client_number",opClientNumber.trim());
    const r=await fetch(`${API}/operator/shipments?${qs}`,{headers:{Authorization:`Bearer ${getToken()}`}});
    const d=await r.json();if(!r.ok)return toast(d?.error||"Error","err");
    const list=d.rows||[];setRows(list);const dd={};list.forEach(row=>(dd[row.id]=row.status));setStatusDraft(dd);
  }
  async function loadEvents(id){setLoadingEvents(true);const r=await fetch(`${API}/shipments/${id}/events`,{headers:{Authorization:`Bearer ${getToken()}`}});const d=await r.json();setLoadingEvents(false);if(!r.ok){toast(d?.error||"Error","err");setEvents([]);return;}setEvents(d.rows||[]);}
  async function deleteShipment(id,code){
    if(!window.confirm(`¿Eliminar ${code}?`))return;
    try{const r=await fetch(`${API}/operator/shipments/${id}`,{method:"DELETE",headers:{Authorization:`Bearer ${getToken()}`}});const d=await r.json();if(d.ok){toast(`✓ ${code} eliminado`);loadShipments();}else toast(`Error: ${d.error}`,"err");}catch(e){toast(`Error: ${e.message}`,"err");}
  }
  async function saveStatus(id){
    const ns=statusDraft[id];if(!ns)return;setSavingId(id);
    const r=await fetch(`${API}/operator/shipments/${id}/status`,{method:"PATCH",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify({status:ns})});
    const d=await r.json();setSavingId(null);if(!r.ok)return toast(d?.error||"Error","err");
    toast(`Estado → ${ns}`);await loadShipments();await loadDashboard();if(openId===id)await loadEvents(id);
  }
  async function getRatesCtx(cn){
    const k=String(cn);const c=editRateCacheRef.current.get(k);if(c)return c;
    const r=await fetch(`${API}/operator/clients?client_number=${cn}`,{headers:{Authorization:`Bearer ${getToken()}`}});
    const d=await r.json();if(!r.ok)throw new Error(d?.error||"Error tarifas");
    const ctx={client_number:cn,defaults:d.defaults||DEFAULT_RATES_FALLBACK,rates:d.rates||null};
    editRateCacheRef.current.set(k,ctx);return ctx;
  }
  function recalcEdit(nd,row,ctx){
    const o=normalizeOrigin(nd.origin??row.origin??"USA");const s=normalizeService(o,nd.service??row.service??"NORMAL");
    const wR=num(nd.weight_kg,NaN);const w=Number.isFinite(wR)&&wR>0?Math.max(wR,MIN_BILLABLE_KG):wR;
    const ov=Boolean(nd.override_edit);
    const ar=getLaneRate({origin:o,service:s,rates:{usa_normal:ctx?.rates?.usa_normal??"",usa_express:ctx?.rates?.usa_express??"",usa_tech_premium:ctx?.rates?.usa_tech_premium??"",china_normal:ctx?.rates?.china_normal??"",china_express:ctx?.rates?.china_express??"",europa_normal:ctx?.rates?.europa_normal??""},defaults:ctx?.defaults||DEFAULT_RATES_FALLBACK});
    const out={...nd,origin:o,service:s};if(!ov)out.rate_usd_per_kg=String(Number(ar||0).toFixed(2));
    const ur=ov?num(out.rate_usd_per_kg,0):Number(ar||0);
    out.estimated_usd=(!Number.isFinite(w)||w<=0)?"":String(Number((w*ur).toFixed(2)).toFixed(2));
    return out;
  }
  function updateEditField(f,v){const row=rows.find(x=>x.id===editId);if(!row)return;const ctx=editRateCtx&&editRateCtx.client_number===row.client_number?editRateCtx:{client_number:row.client_number,defaults:DEFAULT_RATES_FALLBACK,rates:null};setEditDraft(recalcEdit({...editDraft,[f]:v},row,ctx));}
  function setEditOverride(mode){
    const row=rows.find(x=>x.id===editId);if(!row)return;
    const ctx=editRateCtx&&editRateCtx.client_number===row.client_number?editRateCtx:{client_number:row.client_number,defaults:DEFAULT_RATES_FALLBACK,rates:null};
    const en=mode==="MANUAL";let base={...editDraft,override_edit:en};
    if(en){const o=normalizeOrigin(base.origin??row.origin??"USA");const s=normalizeService(o,base.service??row.service??"NORMAL");const ar=getLaneRate({origin:o,service:s,rates:{usa_normal:ctx?.rates?.usa_normal??"",usa_express:ctx?.rates?.usa_express??"",china_normal:ctx?.rates?.china_normal??"",china_express:ctx?.rates?.china_express??"",europa_normal:ctx?.rates?.europa_normal??""},defaults:ctx?.defaults||DEFAULT_RATES_FALLBACK});if(String(base.rate_usd_per_kg??"").trim()==="")base.rate_usd_per_kg=String(Number(ar||0).toFixed(2));}
    setEditDraft(recalcEdit(base,row,ctx));
  }
  async function startEdit(r){
    setEditId(r.id);
    const init={package_code:r.code??r.package_code??"",description:r.description??"",box_code:r.box_code??"",tracking:r.tracking??"",weight_kg:String(r.weight_kg??""),origin:r.origin??"USA",service:r.service??"NORMAL",override_edit:false,rate_usd_per_kg:r.rate_usd_per_kg!=null?String(r.rate_usd_per_kg):"",estimated_usd:r.estimated_usd!=null?String(r.estimated_usd):""};
    setEditDraft(init);setEditRateLoading(true);
    try{const ctx=await getRatesCtx(r.client_number);setEditRateCtx(ctx);setEditDraft(recalcEdit(init,r,ctx));}
    catch(e){toast(String(e?.message||"Error"),"err");setEditRateCtx(null);setEditDraft(recalcEdit(init,r,{defaults:DEFAULT_RATES_FALLBACK,rates:null}));}
    finally{setEditRateLoading(false);}
  }
  function cancelEdit(){setEditId(null);setEditDraft({});setEditRateCtx(null);setEditRateLoading(false);}
  async function saveEdit(id){
    setSavingEditId(id);
    const p={package_code:(editDraft.package_code||"").trim(),description:(editDraft.description||"").trim(),box_code:(editDraft.box_code||"").trim()||null,tracking:(editDraft.tracking||"").trim()||null,weight_kg:num(editDraft.weight_kg,NaN),origin:normalizeOrigin(editDraft.origin),service:normalizeService(editDraft.origin,editDraft.service),rate_usd_per_kg:editDraft.rate_usd_per_kg===""?null:num(editDraft.rate_usd_per_kg,NaN),estimated_usd:editDraft.estimated_usd===""?null:num(editDraft.estimated_usd,NaN)};
    if(!p.package_code||!p.description||!Number.isFinite(p.weight_kg)){setSavingEditId(null);return toast("Revisá código, descripción y peso","warn");}
    const r=await fetch(`${API}/operator/shipments/${id}`,{method:"PATCH",headers:{Authorization:`Bearer ${getToken()}`,"Content-Type":"application/json"},body:JSON.stringify(p)});
    const d=await r.json();setSavingEditId(null);if(!r.ok)return toast(d?.error||"Error","err");
    toast("Cambios guardados ✓");cancelEdit();await loadShipments();await loadDashboard();
  }
  async function refreshAll(){await loadShipments();await loadDashboard();await loadAllClients();}
  useEffect(()=>{refreshAll();},[]);

  const KPI_LIST=[
    {icon:"📦",label:"Total",        value:stats?.total??0,        c:"var(--lemon)"},
    {icon:"📥",label:"Recibidos",    value:stats?.received??0,     c:"var(--lemon)"},
    {icon:"🔧",label:"Preparación",  value:stats?.prep??0,         c:"var(--orange)"},
    {icon:"🚀",label:"Despachados",  value:stats?.sent??0,         c:"#60a5fa"},
    {icon:"✈️",label:"En tránsito",  value:stats?.transit??0,      c:"#c084fc"},
    {icon:"📬",label:"Listos",       value:stats?.ready??0,        c:"#34d399"},
    {icon:"✅",label:"Entregados",   value:stats?.delivered??0,    c:"var(--lemon)"},
    {icon:"⚖️",label:"Peso total",   value:`${Number(stats?.total_weight??0).toFixed(1)} kg`, c:"#94a3b8"},
  ];

  return(
    <div className="screen" data-staff-page style={{maxWidth:1700,margin:"0 auto",padding:"0 8px 48px"}}>
      <style>{`
        @keyframes op-ripple{to{transform:scale(4);opacity:0}}
        @keyframes op-toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes op-fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes op-pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes op-kpi-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes op-num-pop{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
        .op-fade{animation:op-fadeUp .32s ease both}
        .op-tr{transition:background .15s, transform .15s}
        .op-tr:hover td{background:rgba(245,224,58,0.025)!important}
        .op-tr:hover td:first-child{box-shadow:inset 2px 0 0 var(--lemon)}
        .op-tr-edit td{background:rgba(245,224,58,0.04)!important;border-left:2px solid var(--lemon)!important}
        .op-kpi{animation:op-kpi-in .55s cubic-bezier(.2,.8,.2,1) both;position:relative;overflow:hidden}
        .op-kpi::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 100% at 50% 100%,var(--kpi-c,rgba(245,224,58,.07)),transparent 60%);opacity:0;transition:opacity .35s;pointer-events:none}
        .op-kpi:hover{transform:translateY(-4px);border-color:rgba(245,224,58,0.25)!important;box-shadow:0 20px 48px rgba(0,0,0,0.5),0 0 0 1px rgba(245,224,58,.08)!important}
        .op-kpi:hover::after{opacity:1}
        .op-kpi-num{animation:op-num-pop .45s cubic-bezier(.34,1.56,.64,1) .15s both}
      `}</style>

      <Toasts toasts={toasts} removeToast={removeToast}/>
      {showScanner&&<BarcodeScanner onScan={handleScan} onClose={()=>setShowScanner(false)}/>}

      {/* ── EDITORIAL HERO ── */}
      <EditorialHero
        eyebrow="Operaciones"
        title="PANEL"
        em="OPERADOR"
        watermark="OPERACIONES"
        live
        meta={[`${rows.length||0} envíos en panel`, "Control en tiempo real"]}
        actions={
          <Btn onClick={refreshAll} disabled={loadingStats} v="ghost" style={{height:42}}>
            <span style={loadingStats?{animation:"op-pulse 1s infinite",display:"inline-block"}:{}}>↻</span> Actualizar
          </Btn>
        }
      />

      {/* ── TOP NAV ── */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:28,position:"sticky",top:12,zIndex:100}}>
        <FTabs active={opTab} onChange={setOpTab} tabs={[
          {key:"panel",   icon:"🗂", label:"Panel",       badge:rows.length||0},
          {key:"lines",   icon:"🌐", label:"Líneas"},
          {key:"news",    icon:"📰", label:"Anuncios"},
          {key:"coupons", icon:"🎟", label:"Cupones"},
          {key:"emojis",  icon:"😀", label:"Emojis"},
          {key:"ia",      icon:"🤖", label:"Control IA"},
          {key:"invites", icon:"🔑", label:"Invitaciones"},
        ].filter(t => tabAllowed(t.key, scopes))}/>
      </div>

      {opTab==="ia"      && tabAllowed("ia", scopes)      && <AIPanel toast={toast}/>}
      {opTab==="invites" && tabAllowed("invites", scopes) && <InvitePanel toast={toast}/>}
      {opTab==="lines"   && tabAllowed("lines", scopes)   && <LinesPanel toast={toast}/>}
      {opTab==="news"    && tabAllowed("news", scopes)    && <AnnouncementsPanel toast={toast}/>}
      {opTab==="emojis"  && tabAllowed("emojis", scopes)  && <EmojisPanel toast={toast}/>}
      {opTab==="coupons" && tabAllowed("coupons", scopes) && <CouponsPanel toast={toast}/>}

      {opTab==="panel" && tabAllowed("panel", scopes) && (
        <div className="op-fade">

          {/* ── KPI ROW ── */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8,marginBottom:24}}>
            {KPI_LIST.map((k,i)=>(
              <div key={k.label} className="op-kpi" style={{background:"var(--mid)",border:"1px solid var(--border)",padding:"18px 20px",transition:"all .25s",cursor:"default","--kpi-c":`${k.c}1a`,animationDelay:`${i*70}ms`}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${k.c},transparent)`}}/>
                <div style={{fontSize:22,marginBottom:10,filter:`drop-shadow(0 0 8px ${k.c}55)`}}>{k.icon}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"var(--muted2)",marginBottom:6}}>{k.label}</div>
                <div className="op-kpi-num" style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:36,letterSpacing:"1px",color:loadingStats?"var(--faint)":k.c,lineHeight:1,transition:"color .3s"}}>{loadingStats?"—":k.value}</div>
              </div>
            ))}
          </div>

          {/* ── PANEL SUB-TABS ── */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:22}}>
            <FTabs size="sm" active={panelTab} onChange={setPanelTab} tabs={[
              {key:"envios",  icon:"🗂",label:"Envíos",   badge:rows.length||0},
              {key:"nuevo",   icon:"➕",label:"Nuevo envío"},
              {key:"clientes",icon:"👥",label:"Clientes",  badge:allClients.length||0},
            ]}/>
          </div>

          {/* ════ ENVÍOS ════ */}
          {panelTab==="envios"&&(()=>{
            const visibleRows = statusFilter ? rows.filter(r=>r.status===statusFilter) : rows;
            const statusCounts = STATUSES.reduce((acc,s)=>{ acc[s]=rows.filter(r=>r.status===s).length; return acc; },{});
            return (
            <div className="op-fade">
              {/* Searchbar */}
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{flex:1,position:"relative",minWidth:240}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,opacity:.3,pointerEvents:"none"}}>🔍</span>
                  <input className="input" placeholder="Código, tracking, descripción, caja…" value={opSearch} onChange={e=>setOpSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loadShipments()} style={{paddingLeft:40}}/>
                </div>
                <ScanBtn onClick={()=>{setScannerMode("search");setShowScanner(true);}}/>
                <input className="input" placeholder="Cliente #" value={opClientNumber} onChange={e=>setOpClientNumber(e.target.value)} onKeyDown={e=>e.key==="Enter"&&loadShipments()} style={{width:110}}/>
                <Btn onClick={()=>loadShipments()} v="primary">Buscar</Btn>
                <Btn onClick={refreshAll} v="ghost">↻</Btn>
              </div>

              {/* Filtro por estado — chips */}
              <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"1.5px",fontWeight:700,color:"var(--muted2)",textTransform:"uppercase",marginRight:4}}>Estado:</span>
                <button onClick={()=>setStatusFilter("")}
                  style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${statusFilter===""?"var(--lemon)":"var(--border)"}`,background:statusFilter===""?"rgba(245,224,58,0.12)":"var(--faint2)",color:statusFilter===""?"var(--lemon)":"var(--muted)",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"1px",fontWeight:700,cursor:"pointer",textTransform:"uppercase"}}>
                  Todos · {rows.length}
                </button>
                {STATUSES.map(s=>{
                  const cfg=STATUS_CFG[s]||{c:"var(--text)",bg:"var(--faint2)",bd:"var(--border2)",icon:""};
                  const active=statusFilter===s;
                  const n=statusCounts[s]||0;
                  return (
                    <button key={s} onClick={()=>setStatusFilter(active?"":s)}
                      title={`${n} en este estado`}
                      style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${active?cfg.c:cfg.bd}`,background:active?cfg.bg:"var(--faint2)",color:active?cfg.c:"var(--muted)",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"1px",fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5,opacity:n===0&&!active?0.5:1}}>
                      <span style={{fontSize:11}}>{cfg.icon}</span>
                      {s} · {n}
                    </button>
                  );
                })}
              </div>

              <div style={{background:"var(--mid)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden"}}>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:1020}}>
                    <thead>
                      <tr style={{background:"rgba(0,0,0,0.4)"}}>
                        {["Cliente","Código","Fecha","Descripción","Caja","Tracking","Peso","Origen","Servicio","Tarifa","USD","Modo","Estado","","",""].map((h,i)=>(
                          <th key={i} style={{textAlign:"left",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"var(--muted2)",padding:"12px 12px",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map(r=>{
                        const isE=editId===r.id;
                        const o=normalizeOrigin(isE?editDraft.origin:r.origin);
                        const sOpts=SERVICES_BY_ORIGIN[o]||["NORMAL"];
                        const ov=Boolean(editDraft.override_edit);
                        const oc=ORIGIN_CFG[r.origin]||{c:"var(--text)",bg:"var(--faint2)"};
                        return(<>
                          <tr key={r.id} className={isE?"op-tr op-tr-edit":"op-tr"}>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <div style={{width:28,height:28,borderRadius:8,background:"rgba(245,224,58,0.1)",border:"1px solid rgba(245,224,58,0.2)",display:"grid",placeItems:"center",fontSize:9,fontFamily:"'DM Mono',monospace",fontWeight:500,color:"var(--lemon)",flexShrink:0}}>#{r.client_number}</div>
                                <span style={{fontSize:11,color:"var(--muted2)",maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.client_name||""}</span>
                              </div>
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              {isE?<input className="input" value={editDraft.package_code||""} onChange={e=>updateEditField("package_code",e.target.value)} style={{width:110,height:34}}/>
                              :<span style={{fontFamily:"'DM Mono',monospace",fontWeight:500,fontSize:12,color:"var(--lemon)",letterSpacing:"0.5px"}}>{r.code||r.package_code}</span>}
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)",fontSize:10,fontFamily:"'DM Mono',monospace",color:"var(--muted2)",whiteSpace:"nowrap"}}>{fmtDate(r.date_in)}</td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)",maxWidth:140}}>
                              {isE?<input className="input" value={editDraft.description||""} onChange={e=>updateEditField("description",e.target.value)} style={{height:34}}/>
                              :<span style={{fontSize:12,color:"var(--ghost)"}}>{r.description}</span>}
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              {isE?<input className="input" value={editDraft.box_code||""} onChange={e=>updateEditField("box_code",e.target.value)} style={{width:80,height:34}}/>
                              :r.box_code?<span style={{fontSize:10,fontFamily:"'DM Mono',monospace",padding:"3px 8px",borderRadius:6,background:"var(--faint2)",border:"1px solid var(--border2)"}}>{r.box_code}</span>:<span style={{color:"var(--faint)"}}>–</span>}
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              {isE?<div style={{display:"flex",gap:4}}><input className="input" value={editDraft.tracking||""} onChange={e=>updateEditField("tracking",e.target.value)} style={{flex:1,minWidth:90,height:34}}/><ScanBtn onClick={()=>{setScannerMode("fill_edit");setShowScanner(true);}}/></div>
                              :<span style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"var(--ghost)"}}>{r.tracking||"–"}</span>}
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)",fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:12}}>
                              {isE?<input className="input" value={editDraft.weight_kg||""} onChange={e=>updateEditField("weight_kg",e.target.value)} inputMode="decimal" style={{width:70,height:34}}/>:`${Number(r.weight_kg).toFixed(2)} kg`}
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              {isE?<select className="input" value={editDraft.origin||"USA"} onChange={e=>updateEditField("origin",e.target.value)} style={{height:34}}>{ORIGINS.map(x=><option key={x} value={x}>{x}</option>)}</select>
                              :<span style={{fontSize:10,fontFamily:"'DM Mono',monospace",fontWeight:500,letterSpacing:"1px",padding:"3px 8px",borderRadius:6,background:oc.bg,color:oc.c}}>{r.origin}</span>}
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              {isE?<select className="input" value={o==="EUROPA"?"NORMAL":editDraft.service||"NORMAL"} onChange={e=>updateEditField("service",e.target.value)} disabled={o==="EUROPA"} style={{height:34}}>{sOpts.map(s=><option key={s} value={s}>{s}</option>)}</select>
                              :<span style={{fontSize:10,color:"var(--muted2)",fontFamily:"'DM Mono',monospace"}}>{r.service}</span>}
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              {isE?<input className="input" value={editDraft.rate_usd_per_kg||""} onChange={e=>updateEditField("rate_usd_per_kg",e.target.value)} readOnly={!ov} inputMode="decimal" style={{width:70,height:34}}/>
                              :r.rate_usd_per_kg!=null?<span style={{fontSize:12}}>${Number(r.rate_usd_per_kg).toFixed(2)}</span>:<span style={{color:"var(--faint)"}}>–</span>}
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              {isE?<input className="input" value={editDraft.estimated_usd||""} readOnly style={{width:80,height:34}}/>
                              :r.estimated_usd!=null?<span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:"1px",color:"var(--lemon)"}}>${Number(r.estimated_usd).toFixed(2)}</span>:<span style={{color:"var(--faint)"}}>–</span>}
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              {isE?<select className="input" value={ov?"MANUAL":"AUTO"} onChange={e=>setEditOverride(e.target.value)} disabled={editRateLoading} style={{width:90,height:34}}><option value="AUTO">AUTO</option><option value="MANUAL">MANUAL</option></select>
                              :<span style={{color:"var(--faint)",fontSize:10}}>–</span>}
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              <StatusSel value={statusDraft[r.id]||r.status} onChange={e=>setStatusDraft(s=>({...s,[r.id]:e.target.value}))} disabled={isE}/>
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              <div style={{display:"flex",gap:4}}>
                                <Btn onClick={()=>saveStatus(r.id)} disabled={savingId===r.id||isE} v="ghost" size="sm" style={{width:32,padding:0,justifyContent:"center"}}>
                                  <span style={savingId===r.id?{animation:"op-pulse 1s infinite",display:"inline-block"}:{}}>{savingId===r.id?"…":"💾"}</span>
                                </Btn>
                                <Btn onClick={()=>deleteShipment(r.id,r.code)} v="danger" size="sm" style={{width:32,padding:0,justifyContent:"center"}}>🗑</Btn>
                                <Btn onClick={()=>{const n=openId===r.id?null:r.id;setOpenId(n);if(n)loadEvents(r.id);}} v="ghost" size="sm" style={{width:32,padding:0,justifyContent:"center"}}>{openId===r.id?"▲":"📋"}</Btn>
                              </div>
                            </td>
                            <td style={{padding:"11px 12px",borderBottom:"1px solid var(--border)"}}>
                              {isE?(
                                <div style={{display:"flex",gap:4}}>
                                  <Btn onClick={()=>saveEdit(r.id)} disabled={savingEditId===r.id||editRateLoading} v="primary" size="sm">{savingEditId===r.id?"…":"OK"}</Btn>
                                  <Btn onClick={cancelEdit} v="danger" size="sm" style={{width:30,padding:0,justifyContent:"center"}}>✕</Btn>
                                </div>
                              ):<Btn onClick={()=>startEdit(r)} v="ghost" size="sm" style={{width:32,padding:0,justifyContent:"center"}}>✏</Btn>}
                            </td>
                          </tr>
                          {openId===r.id&&(
                            <tr key={`ev-${r.id}`}>
                              <td colSpan={16} style={{padding:0,borderBottom:"1px solid var(--border)"}}>
                                <div style={{padding:"16px 20px",background:"rgba(245,224,58,0.015)",borderTop:"1px solid rgba(245,224,58,0.08)",animation:"op-fadeUp .2s ease"}}>
                                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",color:"var(--orange)",marginBottom:12,textTransform:"uppercase"}}>Historial — {r.code}</div>
                                  {loadingEvents?<span style={{fontSize:12,color:"var(--muted2)"}}>Cargando…</span>:events.length===0?<span style={{fontSize:12,color:"var(--muted2)"}}>Sin eventos.</span>:(
                                    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                                      {events.map(e=>{
                                        const sc2=STATUS_CFG[e.new_status]||{c:"var(--text)",dot:"#fff"};
                                        return(
                                          <div key={e.created_at} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,padding:"6px 10px",background:"var(--faint2)",border:"1px solid var(--border)",borderRadius:8}}>
                                            <div style={{width:6,height:6,borderRadius:"50%",background:sc2.dot,boxShadow:`0 0 6px ${sc2.dot}`,flexShrink:0}}/>
                                            <span style={{color:"var(--muted2)",fontSize:10,fontFamily:"'DM Mono',monospace"}}>{fmtDate(e.created_at)}</span>
                                            <span style={{color:"var(--ghost)"}}>{e.old_status||"—"}</span>
                                            <span style={{color:"var(--faint)"}}>→</span>
                                            <span style={{fontWeight:700,color:sc2.c}}>{sc2.icon} {e.new_status}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>);
                      })}
                      {visibleRows.length===0&&<tr><td colSpan={16} style={{padding:48,textAlign:"center",color:"var(--muted2)",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:"2px"}}>{statusFilter?`SIN ENVÍOS EN "${statusFilter.toUpperCase()}"`:"SIN ENVÍOS — BUSCÁ O ACTUALIZÁ"}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{marginTop:8,fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",color:"var(--faint)",textAlign:"right"}}>💾 GUARDÁ EL ESTADO — EL CLIENTE LO VE AL INSTANTE</div>
            </div>
            );
          })()}

          {/* ════ NUEVO ENVÍO ════ */}
          {panelTab==="nuevo"&&(
            <div className="op-fade" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {/* Cliente */}
              <Card style={{padding:"22px 24px"}} accent="var(--lemon)">
                <div className="sectionLabel" style={{marginBottom:16}}>🔍 Cliente activo</div>
                <div style={{display:"flex",gap:8,marginBottom:16}}>
                  <input className="input" placeholder="Número de cliente" value={clientNumber} onChange={e=>setClientNumber(e.target.value)} onKeyDown={e=>e.key==="Enter"&&findClient()} style={{flex:1}}/>
                  <Btn onClick={findClient} v="primary">Buscar</Btn>
                </div>
                {!client&&<div style={{padding:"12px 16px",borderRadius:10,background:"var(--faint2)",border:"1px solid var(--border)",color:"var(--muted2)",fontFamily:"'DM Mono',monospace",letterSpacing:"1px",textTransform:"uppercase",fontSize:10}}>Buscá un cliente para cargar sus tarifas</div>}
                {client&&<>
                  <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"rgba(245,224,58,0.04)",border:"1px solid rgba(245,224,58,0.15)",borderRadius:12,marginBottom:18}}>
                    <div style={{width:44,height:44,borderRadius:14,background:"var(--lemon)",display:"grid",placeItems:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"var(--void)",flexShrink:0}}>{String(client.name||"?")[0].toUpperCase()}</div>
                    <div>
                      <div style={{fontFamily:"'Barlow',sans-serif",fontWeight:800,fontSize:15}}>#{client.client_number} — {client.name}</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"var(--muted2)",marginTop:2}}>{client.email}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",color:"var(--muted2)",textTransform:"uppercase"}}>Tarifas USD/kg</div>
                    <div style={{display:"flex",gap:6}}>
                      <Btn size="sm" onClick={()=>setRates({usa_normal:String(defaults.usa_normal??45),usa_express:String(defaults.usa_express??55),usa_tech_premium:String(defaults.usa_tech_premium??75),china_normal:String(defaults.china_normal??58),china_express:String(defaults.china_express??68),europa_normal:String(defaults.europa_normal??58)})}>Defaults</Btn>
                      <Btn size="sm" onClick={()=>setRates({usa_normal:"",usa_express:"",usa_tech_premium:"",china_normal:"",china_express:"",europa_normal:""})}>Auto</Btn>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                    {[["USA Normal","usa_normal",defaults.usa_normal],["USA Express","usa_express",defaults.usa_express],["USA Tech Premium","usa_tech_premium",defaults.usa_tech_premium??75],["China Normal","china_normal",defaults.china_normal],["China Express","china_express",defaults.china_express],["Europa Normal","europa_normal",defaults.europa_normal]].map(([l,k,ph])=>(
                      <div key={k}><Lbl>{l}</Lbl><input className="input" inputMode="decimal" placeholder={String(ph)} value={rates[k]} onChange={e=>setRates(rr=>({...rr,[k]:e.target.value}))} style={{height:36}}/></div>
                    ))}
                  </div>
                  <Btn onClick={saveClientRates} disabled={savingRates} v="primary" style={{width:"100%",height:42,borderRadius:12,fontSize:14}}>{savingRates?"Guardando…":"💾 Guardar tarifas"}</Btn>
                </>}
              </Card>

              {/* Envío */}
              <Card style={{padding:"22px 24px"}} accent="var(--orange)">
                <div className="sectionLabel" style={{marginBottom:16}}>📮 Datos del envío</div>
                {!client&&<div style={{padding:"10px 14px",borderRadius:10,background:"rgba(255,140,42,0.06)",border:"1px solid rgba(255,140,42,0.15)",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"1px",textTransform:"uppercase",color:"var(--orange)",marginBottom:14}}>⚠ Buscá un cliente primero</div>}
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div><Lbl>Código {codeLoading&&"↻"}</Lbl><input className="input" placeholder="USA-N-0001" value={packageCode} onChange={e=>setPackageCode(e.target.value)} style={{fontFamily:"'DM Mono',monospace",fontWeight:500}}/></div>
                    <div><Lbl>Caja</Lbl><input className="input" placeholder="BOX-A1" value={boxCode} onChange={e=>setBoxCode(e.target.value)}/></div>
                  </div>
                  <div><Lbl>Descripción *</Lbl><input className="input" placeholder="Contenido" value={description} onChange={e=>setDescription(e.target.value)}/></div>
                  <div><Lbl>Tracking</Lbl>
                    <div style={{display:"flex",gap:8}}><input className="input" placeholder="Número de tracking" value={tracking} onChange={e=>setTracking(e.target.value)} style={{flex:1}}/><ScanBtn onClick={()=>{setScannerMode("fill");setShowScanner(true);}}/></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                    <div><Lbl>Peso kg *</Lbl><input className="input" placeholder="0.00" value={weightKg} onChange={e=>setWeightKg(e.target.value)} inputMode="decimal"/></div>
                    <div><Lbl>Origen</Lbl><select className="input" value={origin} onChange={e=>setOrigin(e.target.value)}>{ORIGINS.map(o=><option key={o} value={o}>{o}</option>)}</select></div>
                    <div><Lbl>Servicio</Lbl><select className="input" value={origin==="EUROPA"?"NORMAL":service} onChange={e=>setService(e.target.value)} disabled={origin==="EUROPA"}>{(SERVICES_BY_ORIGIN[origin]||["NORMAL"]).map(s=><option key={s} value={s}>{s==="TECH_PREMIUM"?"📱 Tech Premium":s}</option>)}</select></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div><Lbl>Estado inicial</Lbl><select className="input" value={status} onChange={e=>setStatus(e.target.value)}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                    <div><Lbl>Modo tarifa</Lbl><select className="input" value={overrideEnabled?"MANUAL":"AUTO"} onChange={e=>{const m=e.target.value==="MANUAL";setOverrideEnabled(m);if(!m)setOverrideRate("");}}><option value="AUTO">AUTO</option><option value="MANUAL">MANUAL</option></select></div>
                  </div>
                  {overrideEnabled&&<div><Lbl>Tarifa manual USD/kg</Lbl><input className="input" placeholder="USD/kg" value={overrideRate} onChange={e=>setOverrideRate(e.target.value)} inputMode="decimal"/></div>}
                  {isBelowMin&&(
                    <div style={{padding:"14px 16px",borderRadius:12,background:"rgba(245,224,58,0.04)",border:"1px solid rgba(245,224,58,0.15)"}}>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",color:"var(--lemon)",marginBottom:10}}>⚖ PESO MENOR A 1 KG</div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setUseRealWeight(false)} style={{flex:1,height:40,borderRadius:10,border:`1px solid ${!useRealWeight?"rgba(245,224,58,0.35)":"var(--border)"}`,cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:12,transition:"all .2s",background:!useRealWeight?"rgba(245,224,58,0.1)":"var(--faint2)",color:!useRealWeight?"var(--lemon)":"var(--muted2)"}}>
                          📋 Mínimo 1kg<br/><span style={{fontSize:10,fontWeight:400}}>${(appliedRate*1).toFixed(2)}</span>
                        </button>
                        <button onClick={()=>setUseRealWeight(true)} style={{flex:1,height:40,borderRadius:10,border:`1px solid ${useRealWeight?"rgba(34,197,94,0.35)":"var(--border)"}`,cursor:"pointer",fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:12,transition:"all .2s",background:useRealWeight?"rgba(34,197,94,0.1)":"var(--faint2)",color:useRealWeight?"#4ade80":"var(--muted2)"}}>
                          ✓ Peso real<br/><span style={{fontSize:10,fontWeight:400}}>${(appliedRate*realKg).toFixed(2)}</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Resumen */}
                  <div style={{padding:"16px 18px",borderRadius:14,background:"rgba(0,0,0,0.4)",border:"1px solid var(--border)"}}>
                    {[["Origen / Servicio",`${origin} ${origin!=="EUROPA"?service:""}`],["Tarifa aplicada",`$${Number(appliedRate||0).toFixed(2)}/kg`],["Peso facturable",billedKg>0?`${billedKg.toFixed(2)} kg`:"—"]].map(([l,v])=>(
                      <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:8}}>
                        <span style={{color:"var(--muted2)",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"1px"}}>{l}</span>
                        <span style={{fontWeight:700}}>{v}</span>
                      </div>
                    ))}
                    <Hr/>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"3px",color:"var(--muted2)",textTransform:"uppercase"}}>Estimado USD</span>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,letterSpacing:"1px",background:"linear-gradient(135deg,var(--lemon),var(--orange))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>${Number(estimated||0).toFixed(2)}</span>
                    </div>
                  </div>
                  <Btn onClick={createShipment} v="primary" size="lg" style={{width:"100%",borderRadius:14,fontSize:16,letterSpacing:"2px",fontFamily:"'Bebas Neue',sans-serif"}}>Guardar envío</Btn>
                </div>
              </Card>
            </div>
          )}

          {/* ════ CLIENTES ════ */}
          {panelTab==="clientes"&&(
            <div className="op-fade" style={{display:"grid",gridTemplateColumns:"1fr 1.6fr",gap:14}}>
              <Card style={{padding:"22px 24px"}} accent="#22c55e">
                <div className="sectionLabel" style={{marginBottom:16}}>👤 Crear cliente</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div><Lbl>Número de cliente</Lbl>
                    <div style={{display:"flex",gap:8}}>
                      <input className="input" placeholder="Ej: 42" value={newClientNumber} onChange={e=>setNewClientNumber(e.target.value)} style={{flex:1}}/>
                      {nextClientNum&&<Btn size="sm" onClick={()=>setNewClientNumber(nextClientNum)} v="ghost" style={{flexShrink:0,color:"var(--lemon)"}}>→ #{nextClientNum}</Btn>}
                    </div>
                  </div>
                  <div><Lbl>Nombre completo</Lbl><input className="input" placeholder="Nombre" value={newName} onChange={e=>setNewName(e.target.value)}/></div>
                  <div><Lbl>Email</Lbl><input className="input" placeholder="email@ejemplo.com" value={newEmail} onChange={e=>setNewEmail(e.target.value)}/></div>
                  <div><Lbl>Contraseña</Lbl><input className="input" type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></div>
                  <Btn onClick={createClient} v="primary" style={{height:44,width:"100%",borderRadius:12,fontSize:14,marginTop:4}}>➕ Crear cliente</Btn>
                </div>
              </Card>

              <Card style={{padding:"22px 24px"}} accent="#a78bfa">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:"2px"}}>Clientes <span style={{color:"#a78bfa"}}>{allClients.length}</span></div>
                  <Btn onClick={loadAllClients} disabled={clientsLoading} size="sm">{clientsLoading?"…":"↻"}</Btn>
                </div>
                <div style={{marginBottom:14}}><input className="input" placeholder="Buscar por #, nombre o email…" value={clientSearch} onChange={e=>setClientSearch(e.target.value)}/></div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:"rgba(0,0,0,0.3)"}}>
                        {["#","Nombre","Email","Envíos","USD","Último",""].map((h,i)=>(
                          <th key={i} style={{textAlign:"left",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:"2px",textTransform:"uppercase",color:"var(--muted2)",padding:"10px 12px",borderBottom:"1px solid var(--border)"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allClients.filter(c=>!clientSearch||String(c.client_number).includes(clientSearch)||(c.name||"").toLowerCase().includes(clientSearch.toLowerCase())||(c.email||"").toLowerCase().includes(clientSearch.toLowerCase())).map(c=>(
                        <tr key={c.id} className="op-tr">
                          <td style={{padding:"10px 12px",borderBottom:"1px solid var(--border)"}}><span style={{fontFamily:"'DM Mono',monospace",fontWeight:500,fontSize:12,color:"var(--lemon)"}}>#{c.client_number}</span></td>
                          <td style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",fontWeight:700,fontSize:13}}>{c.name}</td>
                          <td style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",fontSize:11,color:"var(--muted2)"}}>{c.email}</td>
                          <td style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",textAlign:"center"}}><span style={{padding:"2px 8px",borderRadius:6,background:Number(c.shipment_count)>0?"rgba(245,224,58,0.1)":"var(--faint2)",color:Number(c.shipment_count)>0?"var(--lemon)":"var(--muted2)",fontSize:11,fontFamily:"'DM Mono',monospace"}}>{Number(c.shipment_count)||0}</span></td>
                          <td style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:"1px",color:"var(--lemon)"}}>{Number(c.total_billed||0)>0?`$${Number(c.total_billed).toFixed(0)}`:"–"}</td>
                          <td style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",fontSize:10,fontFamily:"'DM Mono',monospace",color:"var(--muted2)"}}>{c.last_shipment?new Date(c.last_shipment).toLocaleDateString("es-AR"):"–"}</td>
                          <td style={{padding:"10px 12px",borderBottom:"1px solid var(--border)"}}><Btn size="sm" onClick={()=>{setClientNumber(String(c.client_number));setPanelTab("nuevo");}}>Usar →</Btn></td>
                        </tr>
                      ))}
                      {allClients.length===0&&!clientsLoading&&<tr><td colSpan={7} style={{padding:28,textAlign:"center",color:"var(--muted2)",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:"2px"}}>SIN CLIENTES</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}