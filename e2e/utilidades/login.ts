import { expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { CARPETA_CORREOS } from '../playwright.config';

// Usuarios creados por `manage.py cargar_demo`.
export const PASSWORD_DEMO = 'Paseo2026!';
export const USUARIOS = {
  admin: 'admin@paseo.bo',
  negocio: 'cafearanjuez@paseo.bo',
  cliente: 'cliente@paseo.bo',
  cajero: 'caja.cafe@paseo.bo',
} as const;

// El backend e2e guarda los correos como archivos: se toma el código del último enviado a `email`.
export async function ultimoCodigo(email: string, desde: number): Promise<string> {
  let codigo: string | undefined;
  await expect.poll(() => {
    const archivos = readdirSync(CARPETA_CORREOS)
      .map((nombre) => path.join(CARPETA_CORREOS, nombre))
      .filter((archivo) => statSync(archivo).mtimeMs >= desde)
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    for (const archivo of archivos) {
      const texto = readFileSync(archivo, 'utf8');
      if (!texto.includes(`To: ${email}`)) continue;
      codigo = texto.match(/^\s+(\d{6})\s*$/m)?.[1];
      if (codigo) return codigo;
    }
    return undefined;
  }, { message: `código de acceso para ${email}`, timeout: 10_000 }).toBeTruthy();
  return codigo!;
}

export async function iniciarSesion(page: Page, email: string, password = PASSWORD_DEMO) {
  await page.goto('/');
  const desde = Date.now() - 1000;
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Continuar' }).click();
  const codigo = await ultimoCodigo(email, desde);
  await page.getByLabel('Código').fill(codigo);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}
