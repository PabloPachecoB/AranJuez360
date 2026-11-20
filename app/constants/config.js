// Fuente de verdad: EXPO_PUBLIC_API_BASE en el archivo .env (host del backend, sin /api/v1).
// INICIAR.cmd actualiza esta variable con la IP actual de la red.
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE || "http://localhost:8001").replace(/\/$/, "");
export const API_V1_URL = `${API_BASE_URL}/api/v1`;
export const REFRESH_URL = `${API_BASE_URL}/auth/token/refresh/`;
