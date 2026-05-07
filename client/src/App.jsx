import ChatPage from "./pages/ChatPage";
import "./styles/staff-mobile.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { UserProvider } from "./context/UserContext.jsx";
import { ToastProvider } from "./components/ToastReward.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import PremiumFX from "./components/PremiumFX.jsx";
import { useEffect, useState } from "react";

import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import PWAManager from "./components/PWAManager.jsx";
import LemonCoins from "./pages/LemonCoins.jsx";
import LemonNotification from "./components/LemonNotification.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import Register from "./pages/Register.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import HomeClient from "./pages/HomeClient.jsx";
import PrivateChatsPage from "./pages/PrivateChatsPage.jsx";
import usePresence from "./hooks/usePresence.js";
import OnboardingModal from "./components/OnboardingModal.jsx";
import { useParams, useNavigate } from "react-router-dom";

function ProfileByIdRedirect() {
  const { userId } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    fetch(`${API}/profile/${userId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(d => {
        if (d?.user?.username) navigate(`/perfil/${d.user.username}`, { replace: true });
        else navigate("/inicio", { replace: true });
      })
      .catch(() => navigate("/inicio", { replace: true }));
  }, [userId, navigate]);
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#080808", color: "rgba(245,224,58,.4)", fontFamily: "monospace", fontSize: 12, letterSpacing: 2 }}>CARGANDO PERFIL...</div>;
}

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

async function fetchMe() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data.user : null;
  } catch { return null; }
}

// Layout con Topbar + Sidebar para rutas autenticadas
function AppLayout({ children, me, refreshMe }) {
  usePresence(45000); // heartbeat global cada 45s mientras esté autenticado
  const location = useLocation();

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", background:"transparent", position:"relative", zIndex:3 }}>
      <Topbar />
      <div style={{ display:"flex", flex:1, position:"relative" }}>
        {!isMobile && <Sidebar />}
        <main style={{ flex:1, overflowY:"auto", minWidth:0 }}>
          <div key={location.pathname} className="fxPage">
            {children}
          </div>
        </main>
      </div>
      {/* Sidebar bottom en mobile — visible en todas las rutas autenticadas incluso /coins/operator */}
      {/* Sidebar bottom en mobile */}
      {isMobile && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:400, background:"rgba(5,5,5,0.98)", borderTop:"1px solid rgba(245,224,58,0.1)", display:"flex", justifyContent:"space-around", padding:"6px 0 max(6px,env(safe-area-inset-bottom))" }}>
          <Sidebar mobile />
        </div>
      )}
      {isMobile && <div style={{ height:70 }} />}
      {me && <OnboardingModal user={me} onComplete={(u) => refreshMe?.(u)} />}
    </div>
  );
}

function AuthGate({ children, allowRoles }) {
  const [status, setStatus] = useState("loading");
  const [me, setMe] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    fetchMe().then(user => {
      if (cancelled) return;
      if (user) { setMe(user); setStatus("ok"); }
      else setStatus("fail");
    }).catch(() => { if (!cancelled) setStatus("fail"); });
    return () => { cancelled = true; };
  }, []);

  if (status === "loading") return (
    <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"#080808", color:"rgba(245,224,58,0.4)", fontFamily:"monospace", fontSize:12, letterSpacing:"2px" }}>
      CARGANDO...
    </div>
  );

  if (status === "fail") return <Navigate to="/" replace state={{ from: location.pathname }} />;
  if (allowRoles && !allowRoles.includes(me.role)) return <Navigate to="/inicio" replace />;

  return <AppLayout me={me} refreshMe={(u) => setMe(u)}>{children}</AppLayout>;
}

export default function App() {
  return (
    <ToastProvider>
    <UserProvider>
    <BrowserRouter>
      <PremiumFX />
      <PWAManager />
      <LemonNotification />
      <Routes>
        {/* Publicas sin sidebar */}
        <Route path="/"                element={<Login />} />
        <Route path="/forgot-password"  element={<ForgotPassword />} />
        <Route path="/register"          element={<Register />} />
        <Route path="/verify-email"      element={<VerifyEmail />} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* Cliente */}
        <Route path="/inicio"           element={<AuthGate><HomeClient /></AuthGate>} />
        <Route path="/coins"            element={<AuthGate><LemonCoins /></AuthGate>} />
        <Route path="/perfil"           element={<AuthGate><ProfilePage /></AuthGate>} />
        <Route path="/perfil/:username"    element={<ProfilePage />} />
        <Route path="/perfil/id/:userId"   element={<ProfileByIdRedirect />} />
        <Route path="/chat"             element={<AuthGate><ChatPage /></AuthGate>} />
        <Route path="/chats"            element={<AuthGate><PrivateChatsPage /></AuthGate>} />
        <Route path="/chats/:otherId"   element={<AuthGate><PrivateChatsPage /></AuthGate>} />

        {/* Staff */}

        {/* Fallbacks */}
        <Route path="/client" element={<Navigate to="/inicio" replace />} />
        <Route path="*"       element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </UserProvider>
    </ToastProvider>
  );
}

// redeploy trigger
// Sun Apr 19 00:42:53 UTC 2026
