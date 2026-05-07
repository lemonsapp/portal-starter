import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind a 0.0.0.0 para que Codespaces / Docker / LAN puedan conectarse
    host: true,
    // Permitir cualquier host (necesario en Codespaces; el dominio cambia
    // por nombre de codespace). En prod no se usa este server, así que safe.
    allowedHosts: true,
  },
  build: {
    // Sprint 10: code splitting. Cada page va por su chunk via React.lazy()
    // (ver App.jsx); aca dividimos vendors pesados en chunks separados para
    // que el cache del browser los reuse entre deploys (cambia tu codigo
    // pero no cambia react-dom → no rebajan).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router-dom") || id.includes("/react-router/")) return "vendor-router";
          if (id.includes("/react/") || id.includes("react-dom"))                return "vendor-react";
          if (id.includes("socket.io-client") || id.includes("engine.io-client")) return "vendor-socket";
          if (id.includes("framer-motion"))                                       return "vendor-framer";
          if (id.includes("lottie"))                                              return "vendor-lottie";
          if (id.includes("@zxing"))                                              return "vendor-zxing";
          if (id.includes("jspdf") || id.includes("html2canvas"))                 return "vendor-jspdf";
          if (id.includes("@simplewebauthn"))                                     return "vendor-webauthn";
          return "vendor-misc";
        },
      },
    },
    // Subimos el limit de warning (estos vendors son normales, no error real).
    chunkSizeWarningLimit: 600,
  },
})
