import { useMemo, useState } from "react";
import { productosIniciales, STOCK_BAJO_UMBRAL } from "../mockData";
import type { Producto, ProductoInput } from "../types";
import { ProductoFormModal } from "../components/ProductoFormModal";

function crearId() {
  return `producto-${Math.random().toString(36).slice(2, 10)}`;
}

export function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>(productosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEnEdicion, setProductoEnEdicion] = useState<Producto | null>(null);

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return productos;
    return productos.filter((p) => p.nombre.toLowerCase().includes(termino));
  }, [productos, busqueda]);

  function abrirNuevo() {
    setProductoEnEdicion(null);
    setModalAbierto(true);
  }

  function abrirEdicion(producto: Producto) {
    setProductoEnEdicion(producto);
    setModalAbierto(true);
  }

  function guardarProducto(datos: ProductoInput) {
    if (productoEnEdicion) {
      setProductos((prev) =>
        prev.map((p) => (p.id === productoEnEdicion.id ? { ...p, ...datos } : p))
      );
    } else {
      setProductos((prev) => [
        ...prev,
        {
          ...datos,
          id: crearId(),
          negocio_id: "negocio-1",
          creado_en: new Date().toISOString(),
        },
      ]);
    }
    setModalAbierto(false);
  }

  function eliminarProducto(id: string) {
    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
    setProductos((prev) => prev.filter((p) => p.id !== id));
  }

  function cambiarActivo(id: string, activo: boolean) {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, activo } : p)));
  }

  return (
    <div className="pagina">
      <div className="pagina-encabezado">
        <h1>Mis productos</h1>
        <button className="btn btn-primario" onClick={abrirNuevo}>
          + Nuevo producto
        </button>
      </div>

      <input
        className="buscador"
        placeholder="Buscar producto por nombre..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <table className="tabla-productos">
        <thead>
          <tr>
            <th></th>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Promoción</th>
            <th>Activo</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {productosFiltrados.map((producto) => {
            const stockBajo = producto.stock > 0 && producto.stock <= STOCK_BAJO_UMBRAL;
            const sinStock = producto.stock === 0;
            return (
              <tr key={producto.id}>
                <td>
                  <div className="foto-placeholder" aria-hidden="true" />
                </td>
                <td>
                  <div className="nombre-producto">{producto.nombre}</div>
                  <div className="descripcion-producto">{producto.descripcion}</div>
                </td>
                <td>
                  {producto.en_promocion ? (
                    <>
                      <span className="precio-tachado">Bs {producto.precio}</span>{" "}
                      <span className="precio-promocion">Bs {producto.precio_promocion}</span>
                    </>
                  ) : (
                    <span>Bs {producto.precio}</span>
                  )}
                </td>
                <td className={sinStock ? "stock-cero" : stockBajo ? "stock-bajo" : undefined}>
                  {producto.stock}
                  {sinStock && " · sin stock"}
                  {stockBajo && " · bajo"}
                </td>
                <td>
                  {producto.en_promocion && <span className="badge badge-promo">En promoción</span>}
                </td>
                <td>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={producto.activo}
                      onChange={(e) => cambiarActivo(producto.id, e.target.checked)}
                    />
                    <span className="switch-slider" />
                  </label>
                </td>
                <td>
                  <button className="btn-texto" onClick={() => abrirEdicion(producto)}>
                    Editar
                  </button>
                  <button className="btn-texto btn-peligro" onClick={() => eliminarProducto(producto.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            );
          })}
          {productosFiltrados.length === 0 && (
            <tr>
              <td colSpan={7} className="tabla-vacia">
                No se encontraron productos.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {modalAbierto && (
        <ProductoFormModal
          productoExistente={productoEnEdicion}
          onGuardar={guardarProducto}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  );
}
