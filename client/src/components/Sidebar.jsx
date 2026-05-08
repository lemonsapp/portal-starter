import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

/* =====================================================================
   Sidebar — premium dark, paleta restrained Holistic.
   Rationale: sin emojis (SVG outline 1.6 stroke, currentColor), sin
   colores rainbow per item (todo green primary), entrance animado con
   useGSAP scoped (cleanup automático al unmount).

   Skills: gsap-react useGSAP, gsap-timeline (entrance stagger),
   gsap-utils (random delays controlados), gsap-performance.
   ===================================================================== */

/* ── SVG Icons (Lucide-like, 1.6 stroke) ─────────────────────────── */
const Icon = ({ name }) => {
    const props = {
        width: 22, height: 22, viewBox: "0 0 24 24",
        fill: "none", stroke: "currentColor",
        strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round",
        "aria-hidden": "true",
    };
    switch (name) {
        case "home":    return <svg {...props}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>;
        case "user":    return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>;
        case "coins":   return <svg {...props}><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M3 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><ellipse cx="17" cy="14" rx="4" ry="2"/><path d="M13 14v4c0 1.1 1.8 2 4 2s4-.9 4-2v-4"/></svg>;
        case "chat":    return <svg {...props}><path d="M4 6.5C4 5.7 4.7 5 5.5 5h13c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5H10l-4 3v-3H5.5c-.8 0-1.5-.7-1.5-1.5z"/></svg>;
        case "admin":   return <svg {...props}><path d="M12 3l8 3v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>;
        case "shop":    return <svg {...props}><path d="M3 8h18l-1.5 11a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>;
        case "package": return <svg {...props}><path d="m3.3 7 8.7-4 8.7 4v10l-8.7 4-8.7-4z"/><path d="M3.3 7 12 11l8.7-4"/><path d="M12 11v10"/></svg>;
        default:        return null;
    }
};

const NAV_STAFF = [
    { path: "/inicio", label: "Inicio", icon: "home" },
    { path: "/coins",  label: "Coins",  icon: "coins" },
    { path: "/chat",   label: "Chat",   icon: "chat" },
    { path: "/admin",  label: "Admin",  icon: "admin" },
];

const NAV_CLIENT = [
    { path: "/inicio",  label: "Inicio",   icon: "home" },
    { path: "/perfil",  label: "Perfil",   icon: "user" },
    { path: "/coins",   label: "Coins",    icon: "coins" },
    { path: "/chat",    label: "Chat",     icon: "chat" },
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

    const isActive = (path) =>
        location.pathname === path || location.pathname.startsWith(path + "/");

    /* ── Entrance: CSS keyframes con stagger via animation-delay.
       Decisión: GSAP no está instalado en client/; usamos CSS keyframes
       puras para mantener premium feel sin agregar deps. Si en futuro
       sumamos GSAP al client, migrar a useGSAP del @gsap/react. */
    return (
        <>
            <style>{`
                .h-sb {
                    width: var(--h-sidebar-w, 76px);
                    min-height: calc(100vh - var(--h-topbar-h, 64px));
                    background: linear-gradient(180deg, var(--h-bg-1) 0%, var(--h-bg-0) 100%);
                    border-right: 1px solid var(--h-line-1);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: var(--h-sp-5) 0 var(--h-sp-7);
                    gap: var(--h-sp-1);
                    flex-shrink: 0;
                    position: sticky;
                    top: var(--h-topbar-h, 64px);
                    height: calc(100vh - var(--h-topbar-h, 64px));
                    overflow-y: auto;
                    overflow-x: hidden;
                    scrollbar-width: none;
                }
                .h-sb::-webkit-scrollbar { display: none; }
                .h-sb::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 50%; transform: translateX(-50%);
                    width: 60%; height: 1px;
                    background: linear-gradient(90deg, transparent, var(--h-green-mid), transparent);
                }

                .h-sb__btn {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    padding: 14px 8px;
                    width: 64px;
                    border-radius: var(--h-r-md);
                    background: transparent;
                    border: 1px solid transparent;
                    cursor: pointer;
                    color: var(--h-text-3);
                    text-decoration: none;
                    transition:
                        color var(--h-trans-base),
                        background var(--h-trans-base),
                        border-color var(--h-trans-base),
                        transform var(--h-trans-fast);
                    will-change: transform;
                    opacity: 0;
                    animation: h-sb-enter 480ms var(--h-ease-out) forwards;
                }
                @keyframes h-sb-enter {
                    from { opacity: 0; transform: translateX(-12px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .h-sb__btn:hover {
                    color: var(--h-text-1);
                    background: var(--h-bg-2);
                    border-color: var(--h-line-2);
                    transform: translateY(-1px);
                }
                .h-sb__btn.is-active {
                    color: var(--h-green);
                    background: var(--h-green-soft);
                    border-color: var(--h-green-mid);
                }
                .h-sb__btn.is-active::before {
                    content: '';
                    position: absolute;
                    left: -1px; top: 22%; bottom: 22%;
                    width: 2px;
                    border-radius: 0 2px 2px 0;
                    background: var(--h-green);
                    box-shadow: var(--h-glow-green);
                    animation: h-sb-bar 320ms var(--h-ease-out);
                }
                @keyframes h-sb-bar {
                    from { transform: scaleY(0); }
                    to   { transform: scaleY(1); }
                }
                .h-sb__btn:focus-visible {
                    outline: 2px solid var(--h-green);
                    outline-offset: 2px;
                }

                .h-sb__icon {
                    display: grid;
                    place-items: center;
                    width: 26px;
                    height: 26px;
                    transition: transform var(--h-trans-base);
                }
                .h-sb__btn:hover .h-sb__icon { transform: scale(1.06); }
                .h-sb__btn.is-active .h-sb__icon {
                    filter: drop-shadow(0 0 6px var(--h-green-glow));
                }

                .h-sb__label {
                    font-family: var(--h-font-mono);
                    font-size: 9px;
                    font-weight: 500;
                    letter-spacing: 1.4px;
                    text-transform: uppercase;
                    line-height: 1;
                }

                .h-sb__badge {
                    position: absolute;
                    top: 6px; right: 8px;
                    min-width: 16px;
                    padding: 1px 5px;
                    border-radius: var(--h-r-full);
                    background: var(--h-danger);
                    color: #fff;
                    font-family: var(--h-font-mono);
                    font-size: 9px;
                    font-weight: 700;
                    text-align: center;
                    box-shadow: 0 0 0 2px var(--h-bg-1);
                }

                @media (max-width: 768px) {
                    .h-sb { width: 60px; padding: var(--h-sp-3) 0 var(--h-sp-5); }
                    .h-sb__btn { width: 50px; padding: 10px 4px; }
                    .h-sb__label { font-size: 8px; }
                }
                @media (max-width: 480px) {
                    .h-sb { width: 52px; }
                    .h-sb__label { display: none; }
                }
            `}</style>

            <nav
                className={mobile ? "sidebar-bottom" : "h-sb"}
                style={mobile ? {
                    display: "flex", flexDirection: "row", width: "100%",
                    padding: "0 8px", gap: 0, justifyContent: "space-around",
                    alignItems: "center", height: 58,
                } : {}}
                aria-label="Navegación principal"
            >
                {links.map((link, i) => {
                    const active = isActive(link.path);
                    const isChat = link.path === "/chat";
                    return (
                        <button
                            key={link.path}
                            className={`h-sb__btn${active ? " is-active" : ""}`}
                            style={{ animationDelay: `${i * 70}ms` }}
                            onClick={() => navigate(link.path)}
                            title={link.label}
                            aria-current={active ? "page" : undefined}
                            type="button"
                        >
                            {isChat && unread > 0 && (
                                <span className="h-sb__badge" aria-label={`${unread} mensajes sin leer`}>
                                    {unread > 9 ? "9+" : unread}
                                </span>
                            )}
                            <span className="h-sb__icon"><Icon name={link.icon} /></span>
                            <span className="h-sb__label">{link.label}</span>
                        </button>
                    );
                })}
            </nav>
        </>
    );
}
