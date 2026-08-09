console.log("[BUILD MARKER] caja fix v2");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}
if ("caches" in window) {
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
}

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./styles/premium-fx.css";

// El _r lo agrega ChunkErrorBoundary para reventar cachés de HTML viejo
// tras un deploy. Cumplido su trabajo, se borra de la barra de direcciones.
try {
  const u = new URL(window.location.href);
  if (u.searchParams.has("_r")) {
    u.searchParams.delete("_r");
    window.history.replaceState(null, "", u.toString());
  }
} catch { /* sin URL API no hay nada que limpiar */ }

// Limpiar Service Worker para evitar problemas de caché
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
  caches.keys().then(keys => {
    keys.forEach(k => caches.delete(k));
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
// Mon Mar 23 17:01:40 UTC 2026
// rebuild Fri Mar 27 02:25:14 UTC 2026
