import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo, /api, /auth, /media e /invitacion se reenvían al backend Django (sin CORS).
const BACKEND = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000, // 5173 cae en un rango reservado por Windows (Hyper-V)
    host: true, // accesible desde la red Wi-Fi (enlaces de invitación abiertos desde el celular)
    proxy: {
      '/api': BACKEND,
      '/auth': BACKEND,
      '/media': BACKEND,
      '/invitacion': BACKEND,
    },
  },
})
