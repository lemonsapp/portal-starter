import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

const NAV_STAFF = [
  { path: "/inicio",         label: "Inicio",      icon: "🏠", color: "#22c55e" },
  { path: "/operator",       label: "Operador",    icon: "🗂️",  color: "var(--brand-primary, #f5e03a)" },
  { path: "/coins/operator", label: "Coins",       icon: "🪙", color: "var(--brand-primary, #f5e03a)" },
  { path: "/chat",           label: "Chat",        icon: "💬", color: "#a78bfa" },
];

const NAV_CLIENT = [
  { path: "/inicio",           label: "Inicio",       icon: "🏠", color: "var(--brand-primary, #f5e03a)" },
  { path: "/client/shipments", label: "Mis Envíos",   icon: "📦", color: "var(--brand-primary, #f5e03a)" },
  { path: "/perfil",           label: "Mi Perfil",    icon: "👤", color: "#60a5fa" },
  { path: "/client/quote",     label: "Presupuesto",  icon: "🧮", color: "#22c55e" },
  { path: "/coins",            label: "Coins",        icon: "🪙", color: "var(--brand-primary, #f5e03a)" },
  { path: "/chat",             label: "Chat",         icon: "💬", color: "#a78bfa" },
];

export default function Sidebar({ mobile = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const userCtx  = useUser();
  const [me, setMe] = useState(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.user) setMe(d.user); }).catch(() => {});
    const check = async () => {
      try {
        const r = await fetch(`${API}/api/chat/unread`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.ok) setUnread(d.total || 0);
      } catch {}
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  const isStaff = me?.role === "operator" || me?.role === "admin";
  const links   = isStaff ? NAV_STAFF : NAV_CLIENT;

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <>
      <style>{`
        .sidebar-wrap {
          width: 88px;
          min-height: calc(100vh - 64px);
          background: linear-gradient(180deg, rgba(7,9,15,.97) 0%, rgba(2,3,7,.97) 100%);
          border-right: 1px solid rgba(240,236,227,.06);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 22px 0 28px;
          gap: 6px;
          flex-shrink: 0;
          position: sticky;
          top: 64px;
          height: calc(100vh - 64px);
          overflow-y: auto;
          position: sticky;
        }
        .sidebar-wrap::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),.4), transparent);
        }
        .sb-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 14px 8px;
          width: 76px;
          border-radius: 0;
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.34,1.56,0.64,1);
          color: rgba(240,236,227,.32);
          position: relative;
          text-decoration: none;
          opacity: 0;
          transform: translateX(-12px);
          animation: sbEnter .55s cubic-bezier(.2,.8,.2,1) forwards;
        }
        @keyframes sbEnter {
          to { opacity: 1; transform: translateX(0); }
        }
        .sb-btn:hover {
          background: rgba(var(--brand-primary-rgb),0.06) !important;
          color: var(--c) !important;
          transform: translateY(-2px) !important;
          border-color: rgba(var(--brand-primary-rgb),.18) !important;
        }
        .sb-btn.active {
          color: var(--c);
          background: linear-gradient(180deg, color-mix(in srgb, var(--c) 14%, transparent), color-mix(in srgb, var(--c) 4%, transparent));
          border-color: color-mix(in srgb, var(--c) 28%, transparent);
        }
        .sb-active-bar {
          position: absolute;
          left: 0; top: 22%; bottom: 22%;
          width: 2px;
          border-radius: 0;
          background: var(--c);
          box-shadow: 0 0 12px var(--c);
          animation: sbBarPop .5s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes sbBarPop { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @media (max-width: 768px) {
          .sidebar-wrap { width: 60px !important; }
          .sb-btn { width: 52px !important; padding: 10px 4px !important; }
          .sb-label { font-size: 7px !important; }
        }
        @media (max-width: 480px) {
          .sidebar-wrap { width: 52px !important; }
          .sb-label { display: none !important; }
        }
        .sb-btn-mobile {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 6px 12px; border-radius: 12px; background: transparent;
          border: none; cursor: pointer; transition: all .2s; color: #444; flex: 1;
        }
        .sb-btn-mobile.active { color: var(--c); background: rgba(255,255,255,0.05); }
        .sb-icon {
          font-size: 22px;
          transition: filter 0.25s, transform .25s;
          line-height: 1;
        }
        .sb-btn:hover .sb-icon { transform: scale(1.1) rotate(-3deg); }
        .sb-btn.active .sb-icon {
          filter: drop-shadow(0 0 10px var(--c)) drop-shadow(0 0 20px color-mix(in srgb, var(--c) 30%, transparent));
        }
        .sb-label {
          font-family: 'DM Mono', monospace;
          font-size: 8.5px;
          font-weight: 500;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          line-height: 1;
        }
        .sb-badge {
          position: absolute;
          top: 8px; right: 8px;
          background: #ef4444;
          color: #fff;
          font-size: 9px;
          font-weight: 900;
          border-radius: 999px;
          padding: 1px 5px;
          min-width: 16px;
          text-align: center;
          animation: sbBadgePop 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes sbBadgePop {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
        .sb-divider {
          width: 40px;
          height: 1px;
          background: rgba(255,255,255,0.05);
          margin: 8px 0;
        }
      `}</style>

      <nav className={mobile ? "sidebar-bottom" : "sidebar-wrap"} style={mobile ? { display:"flex", flexDirection:"row", width:"100%", padding:"0 8px", gap:0, justifyContent:"space-around", alignItems:"center", height:58 } : {}}>
        {links.map((link, i) => {
          const active = isActive(link.path);
          const isChat = link.path === "/chat";
          return (
            <button
              key={link.path}
              className={`sb-btn${active ? " active" : ""}`}
              style={{ "--c": link.color, animationDelay: `${i * 60}ms` }}
              onClick={() => navigate(link.path)}
              title={link.label}
            >
              {active && <div className="sb-active-bar" style={{ background: link.color, boxShadow: `0 0 12px ${link.color}` }} />}
              {isChat && unread > 0 && <span className="sb-badge">{unread > 9 ? "9+" : unread}</span>}
              <span className="sb-icon">{link.icon}</span>
              <span className="sb-label">{link.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
