// spec: specs/panel-negocio.md (sección 2)
import { expect, test, type Page } from '@playwright/test';
import { iniciarSesion, USUARIOS } from '../utilidades/login';

test.describe('Productos', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, USUARIOS.negocio);
    await expect(page).toHaveURL(/\/productos/);
  });

  test('2.1 listado muestra los productos de demo', async ({ page }) => {
    await expect(page.getByRole('row', { name: /Capuchino/ })).toContainText('Bs 22.00');
    await expect(page.getByRole('row', { name: /Chocolate caliente/ })).toContainText('Bs 25.00');
  });

  test('2.2 crear producto lo agrega a la tabla', async ({ page }) => {
    // Nombre único: la base e2e se conserva entre corridas.
    const nombre = `Latte Vainilla ${Date.now()}`;
    await page.getByRole('button', { name: 'Nuevo producto' }).click();
    await page.getByLabel('Nombre del producto').fill(nombre);
    await page.getByLabel('Precio regular (Bs)').fill('28');
    await page.getByLabel('Stock').fill('10');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('row', { name: new RegExp(nombre) })).toContainText('Bs 28.00');
  });

  test('2.3 guardar sin nombre no crea el producto', async ({ page }) => {
    await page.getByRole('button', { name: 'Nuevo producto' }).click();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    const campoNombre = page.getByLabel('Nombre del producto');
    await expect(campoNombre).toBeVisible();
    expect(await campoNombre.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  });

  test('2.4 cancelar no crea el producto', async ({ page }) => {
    const nombre = `No guardar ${Date.now()}`;
    await page.getByRole('button', { name: 'Nuevo producto' }).click();
    await page.getByLabel('Nombre del producto').fill(nombre);
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByLabel('Nombre del producto')).toHaveCount(0);
    await expect(page.getByRole('row', { name: new RegExp(nombre) })).toHaveCount(0);
  });

  test('2.5 buscar filtra por nombre', async ({ page }) => {
    await page.getByPlaceholder('Buscar producto por nombre...').fill('Capu');
    await expect(page.getByRole('row', { name: /Capuchino/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Chocolate caliente/ })).toHaveCount(0);
  });

  test('2.6 filtro de estado "Pausados" oculta los activos', async ({ page }) => {
    await page.getByRole('combobox').first().selectOption('pausados');
    await expect(page.getByRole('row', { name: /Chocolate caliente/ })).toHaveCount(0);
    await page.getByRole('combobox').first().selectOption('todos');
    await expect(page.getByRole('row', { name: /Chocolate caliente/ })).toBeVisible();
  });

  // 2.7 a 2.9 trabajan sobre un producto propio para no alterar los de demo que usa 2.1.
  test('2.7 pausar en la app se mantiene al recargar', async ({ page }) => {
    const nombre = await crearProducto(page, 'Pausar');
    const mostrar = page.getByLabel(`Mostrar ${nombre} en la app`);
    await expect(mostrar).toBeChecked();
    await mostrar.uncheck({ force: true });
    await expect(mostrar).not.toBeChecked();
    await page.reload();
    await expect(page.getByLabel(`Mostrar ${nombre} en la app`)).not.toBeChecked();
  });

  test('2.8 editar cambia el precio', async ({ page }) => {
    const nombre = await crearProducto(page, 'Editar');
    await page.getByRole('row', { name: new RegExp(nombre) }).getByRole('button', { name: 'Editar' }).click();
    await expect(page.getByRole('heading', { name: 'Editar producto' })).toBeVisible();
    await page.getByLabel('Precio regular (Bs)').fill('27');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByRole('row', { name: new RegExp(nombre) })).toContainText('Bs 27.00');
  });

  test('2.9 eliminar lo quita de la tabla', async ({ page }) => {
    const nombre = await crearProducto(page, 'Eliminar');
    page.once('dialog', (dialogo) => dialogo.accept());
    await page.getByRole('row', { name: new RegExp(nombre) }).getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByRole('row', { name: new RegExp(nombre) })).toHaveCount(0);
  });
});

async function crearProducto(page: Page, prefijo: string) {
  const nombre = `${prefijo} ${Date.now()}`;
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Nombre del producto').fill(nombre);
  await page.getByLabel('Precio regular (Bs)').fill('20');
  await page.getByLabel('Stock').fill('5');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('row', { name: new RegExp(nombre) })).toBeVisible();
  return nombre;
}
