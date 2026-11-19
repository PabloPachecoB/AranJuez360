import { expect, test } from '@playwright/test';
import { iniciarSesion, USUARIOS } from '../utilidades/login';

// Prueba semilla: los agentes (planner / generator) parten de aquí, ya con sesión de negocio.
test('seed: sesión iniciada como negocio', async ({ page }) => {
  await iniciarSesion(page, USUARIOS.negocio);
  await expect(page).toHaveURL(/\/productos/);
});
