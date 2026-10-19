// spec: specs/panel-negocio.md (secciones 3, 5, 6 y 7)
import { expect, test } from '@playwright/test';
import { iniciarSesion, USUARIOS } from '../utilidades/login';

test.describe('Secciones del panel', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.negocio);
    await expect(page).toHaveURL(/\/productos/);
  });

  test('3.1 pedidos: estado vacío', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page.getByText('Gestión de Retiros')).toBeVisible();
    await expect(page.getByText('No hay pedidos entrantes por ahora.')).toBeVisible();
  });

  test('3.2 pedidos: código de retiro inexistente muestra error', async ({ page }) => {
    await page.goto('/pedidos');
    await page.getByPlaceholder('Código ej. BD069AC6').fill('ZZZZ9999');
    await page.getByRole('button', { name: 'Validar y Entregar' }).click();
    await expect(page.getByText('No se encontró ningún pedido con ese código en tu negocio.')).toBeVisible();
  });

  test('5.1 caja: pestañas y bandeja vacía', async ({ page }) => {
    await page.goto('/caja');
    for (const pestana of ['Por aprobar', 'Aprobadas', 'Rechazadas']) {
      await expect(page.getByText(pestana, { exact: true })).toBeVisible();
    }
    await expect(page.getByText(/No hay compras por aprobar/)).toBeVisible();
  });

  test('6.1 recompensas: catálogo de canje de demo', async ({ page }) => {
    await page.goto('/recompensas');
    await expect(page.getByText('1.000 monedas = Bs 30')).toBeVisible();
    await expect(page.getByRole('row', { name: /Capuchino gratis/ })).toContainText('760');
  });

  test('7.1 ofertas: oferta de demo activa', async ({ page }) => {
    await page.goto('/ofertas');
    await expect(page.getByRole('row', { name: /2x1 en capuchinos/ })).toContainText('Activo');
  });

  test('5.2 caja: cupón inexistente muestra error', async ({ page }) => {
    await page.goto('/caja');
    await page.getByLabel('Código del cupón').fill('NOEXISTE1');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page.locator('p.error')).toBeVisible();
  });

  test('6.2 recompensas: publicar un producto lo agrega al catálogo', async ({ page }) => {
    await page.goto('/recompensas');
    await page.getByRole('button', { name: 'Publicar producto' }).click();
    await page.getByLabel('Tomar de mis productos (opcional)').selectOption({ label: 'Chocolate caliente · Bs 25' });
    const nombre = `Chocolate canje ${Date.now()}`;
    await page.getByLabel('Nombre *').fill(nombre);
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    const fila = page.getByRole('row', { name: new RegExp(nombre) });
    await expect(fila).toContainText('Visible');
    // Se quita al final para no llenar el catálogo de demo.
    page.once('dialog', (dialogo) => dialogo.accept());
    await fila.getByRole('button', { name: 'Quitar' }).click();
    await expect(fila).toHaveCount(0);
  });

  test('7.2 ofertas: agregar oferta la muestra activa', async ({ page }) => {
    await page.goto('/ofertas');
    await page.getByRole('button', { name: 'Agregar oferta' }).click();
    const titulo = `Oferta prueba ${Date.now()}`;
    await page.getByLabel('Título *').fill(titulo);
    await page.getByLabel('Precio de oferta (Bs)').fill('18');
    await page.getByRole('button', { name: 'Crear' }).click();
    const fila = page.getByRole('row', { name: new RegExp(titulo) });
    await expect(fila).toContainText('Bs 18');
    await expect(fila).toContainText('Activo');
    page.once('dialog', (dialogo) => dialogo.accept());
    await fila.getByRole('button', { name: 'Eliminar' }).click();
    await expect(fila).toHaveCount(0);
  });
});
