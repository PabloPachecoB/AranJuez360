import { defineConfig, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Pruebas e2e de Paseo Aranjuez 360.
// Levanta su propio backend (base y correos aparte) y la web; no toca los datos de desarrollo.
const raiz = path.resolve(__dirname, '..');
const backend = path.join(raiz, 'backend');
const python = path.join(backend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const carpetaE2E = path.join(raiz, 'tmp', 'e2e');
export const CARPETA_CORREOS = path.join(carpetaE2E, 'correos');
mkdirSync(CARPETA_CORREOS, { recursive: true });

const PUERTO_BACKEND = 8002;
const PUERTO_WEB = 3002;

// E2E_VISIBLE=1 abre el navegador para ver las pruebas en vivo.
const visible = !!process.env.E2E_VISIBLE;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `http://127.0.0.1:${PUERTO_WEB}`,
    headless: !visible,
    launchOptions: { slowMo: visible ? 300 : 0 },
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
    locale: 'es-BO',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Base e2e migrada y con datos de demo antes de servir.
      command: [
        `"${python}" manage.py migrate --noinput`,
        `"${python}" manage.py cargar_demo`,
        `"${python}" manage.py runserver 127.0.0.1:${PUERTO_BACKEND} --noreload`,
      ].join(' && '),
      cwd: backend,
      url: `http://127.0.0.1:${PUERTO_BACKEND}/api/v1/auth/procedencias/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: entornoBackend(),
    },
    {
      command: `npx vite --port ${PUERTO_WEB} --strictPort`,
      cwd: path.join(raiz, 'web'),
      url: `http://127.0.0.1:${PUERTO_WEB}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { VITE_BACKEND_URL: `http://127.0.0.1:${PUERTO_BACKEND}` },
    },
  ],
});

export function entornoBackend(): Record<string, string> {
  return {
    SQLITE_PATH: path.join(carpetaE2E, 'db.sqlite3'),
    EMAIL_BACKEND: 'django.core.mail.backends.filebased.EmailBackend',
    EMAIL_FILE_PATH: CARPETA_CORREOS,
    AUTH_THROTTLE_RATE: '1000/min',
    PYTHONIOENCODING: 'utf-8',
  };
}
