// spec: specs/panel-negocio.md (sección 1)
import { expect, test } from '@playwright/test';
import { iniciarSesion, PASSWORD_DEMO, USUARIOS } from '../utilidades/login';

test.describe('Acceso', () => {
  test('1.1 login con código lleva al panel del negocio', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.negocio);
    await expect(page).toHaveURL(/\/productos/);
    await expect(page.getByText('Café Aranjuez').first()).toBeVisible();
  });

  test('1.2 contraseña incorrecta muestra error', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Correo').fill(USUARIOS.negocio);
    await page.getByLabel('Contraseña').fill('incorrecta-123');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('form p.text-error')).toBeVisible();
    await expect(page.getByLabel('Código')).toHaveCount(0);
  });

  test('1.3 código incorrecto no deja entrar', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Correo').fill(USUARIOS.negocio);
    await page.getByLabel('Contraseña').fill(PASSWORD_DEMO);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Código').fill('000000');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.locator('form p.text-error')).toBeVisible();
    await expect(page.getByRole('link', { name: /productos/i })).toHaveCount(0);
  });

  test('1.4 cerrar sesión vuelve al login', async ({ page }) => {
    await iniciarSesion(page, USUARIOS.negocio);
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
  });
});
