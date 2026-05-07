import { useState, useEffect, createContext, useContext, useCallback } from "react";

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback(({ title, subtitle, icon, color }) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, subtitle, icon, color: color || "#f5e03a" }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position:"fixed", bottom:28, right:24, zIndex:99999, display:"flex", flexDirection:"column", gap:12, pointerEvents:"none" }}>
        {toasts.map((t, i) => (
          <ToastItem key={t.id} toast={t} index={i} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 30);
    const leaveTimer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onRemove(toast.id), 500);
    }, 4500);
    return () => clearTimeout(leaveTimer);
  }, []);

  const close = () => {
    setLeaving(true);
    setTimeout(() => onRemove(toast.id), 500);
  };

  return (
    <div
      onClick={close}
      style={{
        pointerEvents: "all",
        cursor: "pointer",
        background: "linear-gradient(135deg,#111,#1a1a1a)",
        border: `2px solid ${toast.color}66`,
        borderRadius: 20,
        padding: "18px 22px",
        minWidth: 300,
        maxWidth: 380,
        boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 30px ${toast.color}33`,
        transform: visible && !leaving ? "translateX(0) scale(1)" : "translateX(120%) scale(0.8)",
        opacity: visible && !leaving ? 1 : 0,
        transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Barra de progreso */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, height: 3,
        background: `linear-gradient(90deg,${toast.color},${toast.color}88)`,
        borderRadius: "0 0 0 20px",
        animation: "toastProgress 4.5s linear forwards",
        width: "100%",
      }} />

      {/* Glow top */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:60, background:`radial-gradient(ellipse at 50% 0%,${toast.color}18,transparent)`, pointerEvents:"none" }} />

      <div style={{ display:"flex", alignItems:"center", gap:16, position:"relative" }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: `linear-gradient(135deg,${toast.color}33,${toast.color}11)`,
          border: `2px solid ${toast.color}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26,
          boxShadow: `0 0 20px ${toast.color}44`,
          animation: "toastIconPop 0.6s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          {toast.icon || "🍋"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#f5e03a", fontSize: 10, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>
            🎉 Felicidades!
          </div>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 15, marginBottom: 2, lineHeight: 1.3 }}>
            {toast.title}
          </div>
          {toast.subtitle && (
            <div style={{ color: "#666", fontSize: 12, lineHeight: 1.4 }}>
              {toast.subtitle}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes toastIconPop {
          0% { transform: scale(0) rotate(-20deg); }
          60% { transform: scale(1.2) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
