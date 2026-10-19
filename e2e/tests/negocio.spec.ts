// spec: specs/panel-negocio.md (secciones 4 y 8)
import { expect, test } from '@playwright/test';
import { iniciarSesion, USUARIOS } from '../utilidades/login';

test.describe('Mi negocio y horarios', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.negocio);
    await expect(page).toHaveURL(/\/productos/);
  });

  test('4.1 resumen de ventas sin pedidos', async ({ page }) => {
    await page.goto('/negocio');
    await expect(page.getByText('Resumen de ventas y rendimiento')).toBeVisible();
    await expect(page.getByText('Bs 0', { exact: true }).first()).toBeVisible();
  });

  test('4.2 editar información comercial persiste', async ({ page }) => {
    await page.goto('/negocio');
    const referencia = `Frente a la fuente ${Date.now()}`;
    await page.getByLabel('Teléfono').fill('71234567');
    await page.getByLabel('Referencia de llegada').fill(referencia);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('¡Cambios guardados!')).toBeVisible();
    // Vista previa: el texto va junto al ícono location_on, por eso no se busca exacto.
    await expect(page.getByText(referencia)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Referencia de llegada')).toHaveValue(referencia);
  });

  test('8.1 guardar horario se refleja en Mi negocio', async ({ page }) => {
    await page.goto('/horarios');
    const fila = (dia: string) => page.getByRole('row', { name: new RegExp(dia) });
    await fila('Domingo').getByRole('checkbox').check();
    await fila('Lunes').getByRole('checkbox').uncheck();
    await fila('Lunes').locator('input[type="time"]').nth(1).fill('20:00');
    await page.getByRole('button', { name: 'Guardar horarios' }).click();
    await expect(page.getByText('Horarios guardados.')).toBeVisible();

    await page.goto('/negocio');
    // Sin segundos: "Lun 10:00–20:00", no "10:00:00–20:00:00".
    await expect(page.getByText(/^Lun \d\d:\d\d–20:00$/)).toBeVisible();
    await expect(page.getByText(/^Dom /)).toHaveCount(0);
  });
});
