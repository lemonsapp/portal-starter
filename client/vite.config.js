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
})
