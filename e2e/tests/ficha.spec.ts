// spec: specs/panel-negocio.md (sección 9)
import { expect, test } from '@playwright/test';
import { iniciarSesion, USUARIOS } from '../utilidades/login';

test.describe('Ficha pública', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.negocio);
    await expect(page).toHaveURL(/\/productos/);
    await page.goto('/ficha');
  });

  test('9.1 guardar ficha persiste al recargar', async ({ page }) => {
    const lema = `El mejor café del Paseo ${Date.now()}`;
    await page.getByLabel('Lema').fill(lema);
    await page.getByLabel('Instagram (URL)').fill('https://instagram.com/cafearanjuez');
    await page.getByRole('button', { name: 'Guardar ficha' }).click();
    await expect(page.getByText('Ficha guardada. Ya se ve en la app.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Lema')).toHaveValue(lema);
  });

  test('9.2 Instagram con URL inválida muestra error', async ({ page }) => {
    await page.getByLabel('Instagram (URL)').fill('no-es-url');
    await page.getByRole('button', { name: 'Guardar ficha' }).click();
    await expect(page.locator('label', { hasText: 'Instagram (URL)' }).locator('small.error')).toBeVisible();
    await expect(page.getByText('Ficha guardada. Ya se ve en la app.')).toHaveCount(0);
  });

  test('9.3 ver mi página abre el sitio del negocio', async ({ page }) => {
    const [sitio] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('link', { name: 'Ver mi página ↗' }).click(),
    ]);
    await expect(sitio).toHaveURL(/\/sitio\/\d+/);
    await expect(sitio.getByRole('heading', { name: 'Café Aranjuez', level: 1 })).toBeVisible();
  });
});
