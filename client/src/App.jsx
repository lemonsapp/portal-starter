import "./styles/staff-mobile.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { UserProvider } from "./context/UserContext.jsx";
import { ToastProvider } from "./components/ToastReward.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Footer from "./components/Footer.jsx";
import PremiumFX from "./components/PremiumFX.jsx";
import { useBranding, useFeatureFlag } from "./lib/branding.js";
import { useEffect, useState, lazy, Suspense } from "react";
import PWAManager from "./components/PWAManager.jsx";
import AppNotification from "./components/AppNotification.jsx";
import OnboardingModal from "./components/OnboardingModal.jsx";
import usePresence from "./hooks/usePresence.js";
import { useParams, useNavigate } from "react-router-dom";

// ── Lazy-loaded pages ──────────────────────────────────────────────────────
// Cada page se carga on-demand. El primer paint (login) se reduce a su chunk
// + vendor + main. Las pages "premium" (Profile, Chat, Admin) sólo bajan
// cuando el user las navega.
const Login            = lazy(() => import("./pages/Login.jsx"));
const ForgotPassword   = lazy(() => import("./pages/ForgotPassword.jsx"));
const ResetPassword    = lazy(() => import("./pages/ResetPassword.jsx"));
const Register         = lazy(() => import("./pages/Register.jsx"));
const VerifyEmail      = lazy(() => import("./pages/VerifyEmail.jsx"));
const HomeClient       = lazy(() => import("./pages/HomeClient.jsx"));
const Coins            = lazy(() => import("./pages/Coins.jsx"));
const ProfilePage      = lazy(() => import("./pages/ProfilePage.jsx"));
const ChatPage         = lazy(() => import("./pages/ChatPage.jsx"));
const PrivateChatsPage = lazy(() => import("./pages/PrivateChatsPage.jsx"));
const AdminPanel       = lazy(() => import("./pages/AdminPanel.jsx"));
const AdminSetup       = lazy(() => import("./pages/AdminSetup.jsx"));
const SetupAdmin       = lazy(() => import("./pages/SetupAdmin.jsx"));

// Fallback minimo mientras baja un chunk (evita pantalla en blanco).
function PageLoader() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--brand-bg, #080808)", color: "rgba(var(--brand-primary-rgb, 245,224,58),.4)", fontFamily: "monospace", fontSize: 12, letterSpacing: 2 }}>
      CARGANDO...
    </div>
  );
}

// Redirige a /setup-admin si la DB no tiene users; si no, renderiza Login.
// Side effect: también redirige al admin a /admin/setup si app_config está
// incompleta (status.cloudinary o status.resend en false). Esto cumple la
// UX del spec § 8.1 step 5: 'admin loguea → app detecta config vacía →
// redirige a /admin/setup'.
function LoginOrBootstrap() {
  const [decision, setDecision] = useState("loading");
  useEffect(() => {
    fetch(`${API}/auth/needs-bootstrap`)
      .then(r => r.json())
      .then(d => setDecision(d.needs_bootstrap ? "bootstrap" : "login"))
      .catch(() => setDecision("login"));  // fail-open: muestra login
  }, []);
  if (decision === "loading") return null;
  if (decision === "bootstrap") return <Navigate to="/setup-admin" replace />;
  return <Login />;
}

// Feature gate: si la feature está OFF, devuelve 404 redirect.
// Spec § 11: 'Apagar `coins` desactiva: la página /coins, el widget de
// balance, la tab Coins del admin, los rewards por registro/perfil/onboarding.'
function FeatureGate({ flag, children }) {
  const enabled = useFeatureFlag(flag);
  if (!enabled) return <Navigate to="/inicio" replace />;
  return children;
}

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
  return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#080808", color: "rgba(var(--brand-primary-rgb),.4)", fontFamily: "monospace", fontSize: 12, letterSpacing: 2 }}>CARGANDO PERFIL...</div>;
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
        <main style={{ flex:1, overflowY:"auto", minWidth:0, display:"flex", flexDirection:"column" }}>
          <div key={location.pathname} className="fxPage" style={{ flex:1 }}>
            {children}
          </div>
          {!isMobile && <Footer />}
        </main>
      </div>
      {/* Sidebar bottom en mobile — visible en todas las rutas autenticadas */}
      {isMobile && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:400, background:"rgba(5,5,5,0.98)", borderTop:"1px solid rgba(var(--brand-primary-rgb),0.1)", display:"flex", justifyContent:"space-around", padding:"6px 0 max(6px,env(safe-area-inset-bottom))" }}>
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
    <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"#080808", color:"rgba(var(--brand-primary-rgb),0.4)", fontFamily:"monospace", fontSize:12, letterSpacing:"2px" }}>
      CARGANDO...
    </div>
  );

  if (status === "fail") return <Navigate to="/" replace state={{ from: location.pathname }} />;
  if (allowRoles && !allowRoles.includes(me.role)) return <Navigate to="/inicio" replace />;

  return <AppLayout me={me} refreshMe={(u) => setMe(u)}>{children}</AppLayout>;
}

export default function App() {
  useBranding(); // Aplica CSS vars + document.title desde defaults (Sprint 2 los reemplaza con valores del wizard)
  return (
    <ToastProvider>
    <UserProvider>
    <BrowserRouter>
      <PremiumFX />
      <PWAManager />
      <AppNotification />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Publicas sin sidebar */}
        <Route path="/setup-admin"    element={<SetupAdmin />} />
        <Route path="/"                element={<LoginOrBootstrap />} />
        <Route path="/login"            element={<LoginOrBootstrap />} />
        <Route path="/forgot-password"  element={<ForgotPassword />} />
        <Route path="/register"          element={<Register />} />
        <Route path="/registro"          element={<Register />} />
        <Route path="/verify-email"      element={<VerifyEmail />} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* Cliente */}
        <Route path="/inicio"           element={<AuthGate><HomeClient /></AuthGate>} />
        <Route path="/coins"            element={<FeatureGate flag="coins"><AuthGate><Coins /></AuthGate></FeatureGate>} />
        <Route path="/perfil"           element={<AuthGate><ProfilePage /></AuthGate>} />
        <Route path="/perfil/:username"    element={<ProfilePage />} />
        <Route path="/perfil/id/:userId"   element={<ProfileByIdRedirect />} />
        <Route path="/chat"             element={<FeatureGate flag="chat"><AuthGate><ChatPage /></AuthGate></FeatureGate>} />
        <Route path="/chats"            element={<FeatureGate flag="chat"><AuthGate><PrivateChatsPage /></AuthGate></FeatureGate>} />
        <Route path="/chats/:otherId"   element={<FeatureGate flag="chat"><AuthGate><PrivateChatsPage /></AuthGate></FeatureGate>} />

        {/* Staff */}
        <Route path="/admin"         element={<AuthGate allowRoles={["admin"]}><AdminPanel /></AuthGate>} />
        <Route path="/admin/setup"   element={<AuthGate allowRoles={["admin"]}><AdminSetup /></AuthGate>} />

        {/* Fallbacks */}
        <Route path="/client" element={<Navigate to="/inicio" replace />} />
        <Route path="*"       element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </UserProvider>
    </ToastProvider>
  );
}

// redeploy trigger
// Sun Apr 19 00:42:53 UTC 2026
