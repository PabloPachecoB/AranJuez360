import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo, /api y /auth se reenvían al backend Django (sin problemas de CORS).
const BACKEND = process.env.VITE_BACKEND_URL || "http://127.0.0.1:8001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // 5173 cae en un rango reservado por Windows (Hyper-V)
    host: true, // accesible desde la red Wi-Fi (enlaces de invitación abiertos desde el celular)
    proxy: {
      "/api": BACKEND,
      "/auth": BACKEND,
      "/media": BACKEND,
    },
  },
});
