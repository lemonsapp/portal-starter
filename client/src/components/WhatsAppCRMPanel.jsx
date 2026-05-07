import { useCallback, useEffect, useRef, useState } from "react";
import EditorialHero from "./EditorialHero.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");
const hdrs = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

const POLL_CHAT = 1500;
const POLL_LIST = 4000;

function digits(v) { return String(v || "").replace(/\D/g, ""); }

function fmtTime(v) {
  if (!v) return "";
  try {
    const d = new Date(v), now = new Date(), diff = now - d;
    if (diff < 60000) return "ahora";
    if (diff < 3600000) return `${Math.floor(diff/60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

function fmtFull(v) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("es-AR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }); }
  catch { return String(v); }
}

const MODES = {
  bot:              { label:"Bot",      color:"#22d3a8", icon:"🤖" },
  operator:         { label:"Operador", color:"#f59e0b", icon:"✋" },
  waiting_operator: { label:"Esperando",color:"#f87171", icon:"⏳" },
  closed:           { label:"Cerrado",  color:"#475569", icon:"✕"  },
};

function Avatar({ name, phone, size=40 }) {
  const init = name ? name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase() : digits(phone||"").slice(-2) || "?";
  const hue = (digits(phone||"").split("").reduce((a,c)=>a+Number(c),0)*47)%360;
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, background:`linear-gradient(135deg,hsl(${hue},60%,35%),hsl(${(hue+30)%360},55%,25%))`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.35, fontWeight:900, color:"#fff" }}>
      {init}
    </div>
  );
}

function ModeTag({ mode }) {
  const m = MODES[mode] || { label:mode, color:"#64748b", icon:"•" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:99, background:`${m.color}18`, color:m.color, fontSize:10, fontWeight:800 }}>
      {m.icon} {m.label}
    </span>
  );
}

export default function WhatsAppCRMPanel() {
  const [summary, setSummary]   = useState(null);
  const [rows, setRows]         = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [q, setQ]               = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [sending, setSending]   = useState(false);
  const [acting, setActing]     = useState("");
  const [newMsg, setNewMsg]     = useState(false);

  const bottomRef   = useRef(null);
  const selRef      = useRef(null);
  const chatPollRef = useRef(null);
  const listPollRef = useRef(null);
  const inputRef    = useRef(null);
  selRef.current = selected;

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 80);
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/wa/crm/summary`, { headers:hdrs() });
      const d = await r.json();
      setSummary(d.summary || null);
    } catch {}
  }, []);

  const fetchRows = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim()) p.set("q", q.trim());
      if (modeFilter) p.set("mode", modeFilter);
      if (onlyPending) p.set("only_pending", "1");
      const r = await fetch(`${API}/api/wa/crm/conversations?${p}`, { headers:hdrs() });
      const d = await r.json();
      setRows(d.rows || []);
    } catch {} finally { if (!silent) setLoading(false); }
  }, [q, modeFilter, onlyPending]);

  const fetchMessages = useCallback(async (id, silent=false) => {
    try {
      const r = await fetch(`${API}/api/wa/crm/conversations/${id}/messages`, { headers:hdrs() });
      const d = await r.json();
      const msgs = d.rows || [];
      setMessages(prev => {
        if (msgs.length > prev.length) {
          setNewMsg(true);
          setTimeout(() => setNewMsg(false), 800);
          scrollBottom();
        }
        return msgs;
      });
    } catch {}
  }, [scrollBottom]);

  useEffect(() => {
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    if (!selected?.id) return;
    chatPollRef.current = setInterval(() => {
      if (selRef.current?.id) fetchMessages(selRef.current.id, true);
    }, POLL_CHAT);
    return () => clearInterval(chatPollRef.current);
  }, [selected?.id, fetchMessages]);

  useEffect(() => {
    if (listPollRef.current) clearInterval(listPollRef.current);
    fetchSummary();
    fetchRows();
    listPollRef.current = setInterval(() => {
      fetchSummary();
      fetchRows(true);
    }, POLL_LIST);
    return () => clearInterval(listPollRef.current);
  }, [modeFilter, onlyPending]);

  const openConversation = async (row) => {
    setSelected(row);
    setMessages([]);
    inputRef.current?.focus();
    try {
      await fetch(`${API}/api/wa/crm/conversations/${row.id}/read`, { method:"POST", headers:hdrs() });
      await fetchMessages(row.id);
      fetchRows(true);
      fetchSummary();
    } catch {}
  };

  const act = async (kind) => {
    if (!selected || acting) return;
    setActing(kind);
    const modeMap = { take:"operator", release:"bot", close:"closed" };
    if (modeMap[kind]) {
      setSelected(s => ({ ...s, mode:modeMap[kind], needs_operator:false }));
      setRows(prev => prev.map(r => r.id===selected.id ? { ...r, mode:modeMap[kind], needs_operator:false } : r));
    }
    try {
      await fetch(`${API}/api/wa/crm/conversations/${selected.id}/${kind}`, { method:"POST", headers:hdrs() });
      fetchRows(true);
      fetchSummary();
    } catch {} finally { setActing(""); }
  };

  const sendMessage = async () => {
    if (!selected || !input.trim() || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    const optimistic = { id:`opt_${Date.now()}`, direction:"outbound", sender_type:"operator", message:text, created_at:new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    scrollBottom();
    try {
      await fetch(`${API}/api/wa/crm/send`, { method:"POST", headers:hdrs(), body:JSON.stringify({ conversation_id:selected.id, message:text }) });
      await fetchMessages(selected.id, true);
      fetchRows(true);
    } catch { setInput(text); setMessages(prev => prev.filter(m => m.id !== optimistic.id)); }
    finally { setSending(false); }
  };

  const stats = [
    { label:"Esperando",   value:summary?.waiting_operator??0, color:"#f87171" },
    { label:"Con operador",value:summary?.operator_active??0,  color:"#f59e0b" },
    { label:"Bot activo",  value:summary?.bot_active??0,       color:"#22d3a8" },
    { label:"Sin leer",    value:summary?.unread??0,           color:"#60a5fa" },
    { label:"Total",       value:summary?.total??0,            color:"#94a3b8" },
  ];

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#e2e8f0" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes livePulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes newMsgGlow{0%,100%{border-color:rgba(255,255,255,.08)}50%{border-color:rgba(245,224,58,.4)}}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:99px}
        .ci{transition:background .12s,border-color .12s}
        .ci:hover{background:rgba(255,255,255,.05)!important}
        .ci.sel{background:rgba(245,224,58,.07)!important;border-left-color:#f5e03a!important}
        .ab{transition:all .15s;cursor:pointer}
        .ab:hover:not(:disabled){filter:brightness(1.2);transform:translateY(-1px)}
        .ab:disabled{opacity:.4;cursor:not-allowed}
        textarea:focus,input:focus{outline:none!important;border-color:rgba(245,224,58,.4)!important}
      `}</style>

      <EditorialHero
        eyebrow="Mensajería"
        title="WHATSAPP"
        em="CRM"
        watermark="WA CRM"
        live
        meta={stats.map(s => `${s.label}: ${s.value}`)}
      />

      <div className="wacrm-grid">
      <style>{`
        .wacrm-grid{display:grid;grid-template-columns:280px 1fr 260px;gap:10px}
        @media (max-width:900px){
          .wacrm-grid{grid-template-columns:1fr}
          .wacrm-col-list{display:${selected?'none':'flex'} !important}
          .wacrm-col-chat{display:${selected?'flex':'none'} !important;min-height:calc(100vh - 180px) !important}
          .wacrm-col-info{display:none !important}
        }
        .wacrm-back-btn{display:none}
        @media (max-width:900px){.wacrm-back-btn{display:flex !important}}
      `}</style>

        <div className="wacrm-col-list" style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.08)", borderRadius:16, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ padding:"12px 12px 10px", borderBottom:"1px solid rgba(255,255,255,.06)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:800 }}>💬 Chats</span>
              {loading && <div style={{ width:12, height:12, borderRadius:"50%", border:"2px solid rgba(255,255,255,.1)", borderTopColor:"#f5e03a", animation:"spin .7s linear infinite" }}/>}
            </div>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar..." style={{ width:"100%", height:32, borderRadius:9, border:"1px solid rgba(255,255,255,.1)", background:"rgba(255,255,255,.05)", color:"#e2e8f0", padding:"0 10px", fontSize:12, boxSizing:"border-box", marginBottom:8 }}/>
            <div style={{ display:"flex", gap:6 }}>
              <select value={modeFilter} onChange={e=>setModeFilter(e.target.value)} style={{ flex:1, height:30, borderRadius:8, border:"1px solid rgba(255,255,255,.1)", background:"rgba(255,255,255,.05)", color:"#e2e8f0", fontSize:11, padding:"0 6px" }}>
                <option value="">Todos</option>
                <option value="waiting_operator">Esperando</option>
                <option value="operator">Operador</option>
                <option value="bot">Bot</option>
              </select>
              <button onClick={()=>setOnlyPending(v=>!v)} className="ab" style={{ height:30, padding:"0 10px", borderRadius:8, border:"none", fontSize:11, fontWeight:800, background:onlyPending?"#f87171":"rgba(255,255,255,.06)", color:onlyPending?"#fff":"#94a3b8" }}>🔴</button>
            </div>
          </div>
          <div style={{ overflowY:"auto", flex:1, maxHeight:"70vh" }}>
            {rows.length === 0 && <div style={{ padding:24, textAlign:"center", color:"#334155", fontSize:12 }}>Sin conversaciones</div>}
            {rows.map(row => {
              const isSel = selected?.id === row.id;
              const m = MODES[row.mode] || MODES.bot;
              return (
                <button key={row.id} onClick={()=>openConversation(row)} className={`ci${isSel?" sel":""}`}
                  style={{ width:"100%", textAlign:"left", border:"none", borderLeft:`3px solid ${isSel?m.color:"transparent"}`, cursor:"pointer", padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,.04)", background:"transparent", color:"#e2e8f0" }}>
                  <div style={{ display:"flex", gap:9, alignItems:"center" }}>
                    <div style={{ position:"relative" }}>
                      <Avatar name={row.contact_name} phone={row.phone} size={38}/>
                      <span style={{ position:"absolute", bottom:0, right:0, width:10, height:10, borderRadius:"50%", background:m.color, border:"2px solid #0b1020" }}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ fontWeight:700, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.contact_name || row.phone}</div>
                        <div style={{ fontSize:10, color:"#475569", flexShrink:0, marginLeft:4 }}>{fmtTime(row.last_message_at)}</div>
                      </div>
                      <div style={{ fontSize:11, color:"#64748b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:2 }}>{row.last_message || "Sin mensajes"}</div>
                      <div style={{ display:"flex", gap:4, marginTop:4, alignItems:"center" }}>
                        {row.needs_operator && <span style={{ fontSize:9, fontWeight:800, padding:"1px 5px", borderRadius:99, background:"rgba(248,113,113,.15)", color:"#f87171", border:"1px solid rgba(248,113,113,.3)" }}>ATIENDE</span>}
                        {Number(row.unread_count)>0 && <span style={{ marginLeft:"auto", minWidth:16, height:16, borderRadius:99, background:"#f5e03a", color:"#0b1020", fontSize:9, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px" }}>{row.unread_count}</span>}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="wacrm-col-chat" style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.08)", borderRadius:16, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:580, animation:newMsg?"newMsgGlow .6s ease":undefined }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
            {selected ? (
              <>
                <div style={{ display:"flex", gap:10, alignItems:"center", minWidth:0, flex:1 }}>
                  <button onClick={()=>setSelected(null)} className="wacrm-back-btn" aria-label="Volver"
                    style={{ background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.1)", borderRadius:8, color:"#fff", width:34, height:34, fontSize:18, cursor:"pointer", flexShrink:0, alignItems:"center", justifyContent:"center" }}>‹</button>
                  <Avatar name={selected.contact_name} phone={selected.phone} size={36}/>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{selected.contact_name || "Sin nombre"}</div>
                    <div style={{ fontSize:11, color:"#475569", fontFamily:"monospace" }}>{selected.phone}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <ModeTag mode={selected.mode}/>
                  {selected.needs_operator && <span style={{ fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:99, background:"rgba(248,113,113,.15)", color:"#f87171", border:"1px solid rgba(248,113,113,.3)" }}>⚠ PENDIENTE</span>}
                </div>
              </>
            ) : (
              <div style={{ color:"#334155", fontSize:13 }}>← Seleccioná una conversación</div>
            )}
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"14px 16px", maxHeight:"calc(70vh - 160px)", display:"flex", flexDirection:"column", gap:8 }}>
            {!selected && <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10, color:"#334155" }}><div style={{ fontSize:40 }}>💬</div><div style={{ fontSize:13 }}>Seleccioná un chat</div></div>}
            {messages.map((m,i) => {
              const isIn = m.direction === "inbound";
              const isOp = m.sender_type === "operator";
              const isOpt = String(m.id).startsWith("opt_");
              const color = isIn?"#60a5fa":isOp?"#f59e0b":"#22d3a8";
              const label = isIn?"Cliente":isOp?"Operador":"Bot";
              return (
                <div key={m.id} style={{ display:"flex", justifyContent:isIn?"flex-start":"flex-end", animation:"fadeUp .18s ease" }}>
                  <div style={{ maxWidth:"78%", padding:"9px 13px", borderRadius:14, background:isIn?"rgba(96,165,250,.08)":isOp?"rgba(245,158,11,.08)":"rgba(34,211,168,.06)", border:`1px solid ${color}25`, borderBottomLeftRadius:isIn?2:14, borderBottomRightRadius:isIn?14:2, opacity:isOpt?.6:1 }}>
                    <div style={{ fontSize:9, fontWeight:800, color, marginBottom:4, letterSpacing:"0.5px" }}>{label}</div>
                    <div style={{ fontSize:13, lineHeight:1.55, whiteSpace:"pre-wrap", color:"#e2e8f0" }}>{m.message}</div>
                    <div style={{ fontSize:10, color:"#334155", marginTop:5, textAlign:"right" }}>{fmtFull(m.created_at)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef}/>
          </div>

          {selected && (
            <div style={{ padding:"10px 14px", borderTop:"1px solid rgba(255,255,255,.06)" }}>
              <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey))sendMessage();}} placeholder="Escribí... (Ctrl+Enter para enviar)" rows={2} style={{ flex:1, borderRadius:10, resize:"none", border:"1px solid rgba(255,255,255,.1)", background:"rgba(255,255,255,.05)", color:"#e2e8f0", padding:"9px 12px", fontSize:13, lineHeight:1.5, boxSizing:"border-box" }}/>
                <button onClick={sendMessage} disabled={sending||!input.trim()} className="ab" style={{ width:80, borderRadius:10, border:"none", background:sending?"rgba(245,224,58,.3)":"linear-gradient(135deg,#f5e03a,#ff5500)", color:"#0b1020", fontWeight:900, fontSize:13, cursor:"pointer", flexShrink:0 }}>
                  {sending?"...":"Enviar"}
                </button>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>act("take")} disabled={!!acting||selected.mode==="operator"} className="ab" style={{ flex:1, height:34, borderRadius:9, border:"1px solid rgba(245,158,11,.3)", background:"rgba(245,158,11,.1)", color:"#f59e0b", fontWeight:700, fontSize:12 }}>{acting==="take"?"...":"✋ Tomar"}</button>
                <button onClick={()=>act("release")} disabled={!!acting||selected.mode==="bot"} className="ab" style={{ flex:1, height:34, borderRadius:9, border:"1px solid rgba(34,211,168,.3)", background:"rgba(34,211,168,.1)", color:"#22d3a8", fontWeight:700, fontSize:12 }}>{acting==="release"?"...":"🤖 Bot"}</button>
                <button onClick={()=>act("close")} disabled={!!acting} className="ab" style={{ height:34, padding:"0 14px", borderRadius:9, border:"1px solid rgba(248,113,113,.3)", background:"rgba(248,113,113,.1)", color:"#f87171", fontWeight:700, fontSize:12 }}>{acting==="close"?"...":"✕"}</button>
              </div>
            </div>
          )}
        </div>

        <div className="wacrm-col-info" style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.08)", borderRadius:16, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,.06)", fontSize:13, fontWeight:800 }}>🧠 Info</div>
          <div style={{ padding:12, display:"flex", flexDirection:"column", gap:10, overflowY:"auto" }}>
            {!selected ? (
              <div style={{ color:"#334155", fontSize:12, textAlign:"center", padding:"20px 0" }}>Seleccioná un chat</div>
            ) : (
              <>
                <InfoCard title="Contacto">
                  <InfoRow label="Nombre" value={selected.contact_name||"—"}/>
                  <InfoRow label="Teléfono" value={selected.phone} mono/>
                </InfoCard>
                <InfoCard title="Estado">
                  <div style={{ marginBottom:8 }}><ModeTag mode={selected.mode}/></div>
                  <InfoRow label="Sin leer" value={selected.unread_count??0}/>
                  <InfoRow label="Último msg" value={fmtTime(selected.last_message_at)}/>
                  <InfoRow label="Creado" value={fmtFull(selected.created_at)}/>
                </InfoCard>
                <InfoCard title="Acciones">
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {[
                      {kind:"take",label:"✋ Tomar conv.",color:"#f59e0b",dis:selected.mode==="operator"},
                      {kind:"release",label:"🤖 Devolver bot",color:"#22d3a8",dis:selected.mode==="bot"},
                      {kind:"close",label:"✕ Cerrar",color:"#f87171",dis:false},
                    ].map(a=>(
                      <button key={a.kind} onClick={()=>act(a.kind)} disabled={!!acting||a.dis} className="ab" style={{ width:"100%", height:34, borderRadius:9, border:`1px solid ${a.color}30`, background:`${a.color}10`, color:a.color, fontWeight:700, fontSize:12, cursor:"pointer" }}>
                        {acting===a.kind?"...":a.label}
                      </button>
                    ))}
                  </div>
                </InfoCard>
                {selected.last_message && (
                  <InfoCard title="Último mensaje">
                    <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.5, fontStyle:"italic", background:"rgba(255,255,255,.03)", borderRadius:8, padding:"8px 10px" }}>
                      "{selected.last_message.slice(0,120)}{selected.last_message.length>120?"…":""}"
                    </div>
                  </InfoCard>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:12, padding:"10px 12px" }}>
      <div style={{ fontSize:9, fontWeight:800, color:"#475569", textTransform:"uppercase", letterSpacing:"1.2px", marginBottom:8 }}>{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono=false }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5, gap:8 }}>
      <span style={{ fontSize:11, color:"#64748b", flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:600, color:mono?"#94a3b8":"#cbd5e1", fontFamily:mono?"monospace":undefined, textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"60%" }}>{value??"—"}</span>
    </div>
  );
}
