import { useEffect, useMemo, useState } from "react";
import {
  listarMisProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  type ProductoApi,
  type ProductoInput,
} from "../api/productos";
import { ApiError } from "../../api/client";
import { ProductoFormModal } from "../components/ProductoFormModal";
import { Switch } from "../components/Switch";

const STOCK_BAJO_UMBRAL = 5;

type FiltroEstado = "todos" | "activos" | "pausados";
type FiltroPromo = "todos" | "con_descuento" | "regular";

export function ProductosPage() {
  const [productos, setProductos] = useState<ProductoApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [filtroPromo, setFiltroPromo] = useState<FiltroPromo>("todos");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEnEdicion, setProductoEnEdicion] = useState<ProductoApi | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  async function recargar() {
    setCargando(true);
    setErrorCarga(null);
    try {
      setProductos(await listarMisProductos());
    } catch (err) {
      setErrorCarga(err instanceof ApiError ? err.message : "No se pudo cargar el catálogo.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  const kpis = useMemo(
    () => ({
      total: productos.length,
      activos: productos.filter((p) => p.activo).length,
      enPromocion: productos.filter((p) => p.en_promocion).length,
      stockBajo: productos.filter((p) => p.stock > 0 && p.stock <= STOCK_BAJO_UMBRAL).length,
    }),
    [productos]
  );

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (termino && !p.nombre.toLowerCase().includes(termino)) return false;
      if (filtroEstado === "activos" && !p.activo) return false;
      if (filtroEstado === "pausados" && p.activo) return false;
      if (filtroPromo === "con_descuento" && !p.en_promocion) return false;
      if (filtroPromo === "regular" && p.en_promocion) return false;
      return true;
    });
  }, [productos, busqueda, filtroEstado, filtroPromo]);

  function abrirNuevo() {
    setProductoEnEdicion(null);
    setErrorModal(null);
    setModalAbierto(true);
  }

  function abrirEdicion(producto: ProductoApi) {
    setProductoEnEdicion(producto);
    setErrorModal(null);
    setModalAbierto(true);
  }

  async function guardarProducto(datos: ProductoInput) {
    setGuardando(true);
    setErrorModal(null);
    try {
      if (productoEnEdicion) {
        const actualizado = await actualizarProducto(productoEnEdicion.id, datos);
        setProductos((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)));
      } else {
        const creado = await crearProducto(datos);
        setProductos((prev) => [...prev, creado]);
      }
      setModalAbierto(false);
    } catch (err) {
      setErrorModal(err instanceof ApiError ? err.message : "No se pudo guardar el producto.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(producto: ProductoApi) {
    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
    await eliminarProducto(producto.id);
    setProductos((prev) => prev.filter((p) => p.id !== producto.id));
  }

  async function cambiarActivo(producto: ProductoApi, activo: boolean) {
    setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, activo } : p)));
    try {
      await actualizarProducto(producto.id, { activo });
    } catch {
      // revertir si falló
      setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, activo: !activo } : p)));
    }
  }

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md mb-space-lg">
        <div>
          <div className="flex items-center gap-space-xs text-on-surface-variant font-badge-code text-badge-code uppercase tracking-wider mb-1">
            <span>Catálogo Digital</span>
            <span className="text-outline-variant">•</span>
            <span className="text-secondary font-bold">En línea para Recojo Mall</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
            Mis productos
          </h1>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-on-surface-variant" />
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              Total: <span className="font-bold">{kpis.total}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary-container/60 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="font-label-md text-label-md text-on-secondary-container font-semibold">
              Activos: <span className="font-bold">{kpis.activos}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-fixed rounded-full shadow-sm">
            <span className="material-symbols-outlined text-primary text-[15px]">local_offer</span>
            <span className="font-label-md text-label-md text-on-primary-fixed-variant font-semibold">
              En promoción: <span className="font-bold">{kpis.enPromocion}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-primary-container" />
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              Stock bajo: <span className="font-bold text-primary">{kpis.stockBajo}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-[0_2px_12px_rgba(19,27,46,0.04)] mb-space-md flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            className="w-full pl-11 pr-4 py-2.5 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/80 transition-all"
            placeholder="Buscar producto por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <select
            className="appearance-none bg-surface-container-low hover:bg-surface-container pl-3.5 pr-8 py-2.5 rounded-lg font-label-md text-label-md text-on-surface font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/80 transition-all"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
          >
            <option value="todos">Estado: Todos</option>
            <option value="activos">Solo activos</option>
            <option value="pausados">Pausados</option>
          </select>
          <select
            className="appearance-none bg-surface-container-low hover:bg-surface-container pl-3.5 pr-8 py-2.5 rounded-lg font-label-md text-label-md text-on-surface font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/80 transition-all"
            value={filtroPromo}
            onChange={(e) => setFiltroPromo(e.target.value as FiltroPromo)}
          >
            <option value="todos">Promoción: Todos</option>
            <option value="con_descuento">Con descuento activo</option>
            <option value="regular">Precio regular</option>
          </select>
          <button
            className="flex items-center gap-space-xs bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-label-md px-5 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
            onClick={abrirNuevo}
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Nuevo producto</span>
          </button>
        </div>
      </div>

      {errorCarga && (
        <p className="font-body-sm text-body-sm text-error bg-error-container/40 rounded-lg px-space-md py-2 mb-space-md">
          {errorCarga}
        </p>
      )}

      <div className="bg-surface-container-lowest rounded-xl shadow-[0_2px_12px_rgba(19,27,46,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <th className="py-3.5 px-4">Producto y Detalle</th>
                <th className="py-3.5 px-4">Precio</th>
                <th className="py-3.5 px-4">Existencias</th>
                <th className="py-3.5 px-4">Promoción</th>
                <th className="py-3.5 px-4 text-center">En PaseoYa</th>
                <th className="py-3.5 pr-6 pl-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {cargando && (
                <tr>
                  <td colSpan={6} className="py-space-lg text-center text-on-surface-variant font-body-md text-body-md">
                    Cargando productos...
                  </td>
                </tr>
              )}
              {!cargando &&
                productosFiltrados.map((producto) => {
                  const stockBajo = producto.stock > 0 && producto.stock <= STOCK_BAJO_UMBRAL;
                  const sinStock = producto.stock === 0;
                  return (
                    <tr key={producto.id} className="hover:bg-surface-container-low/60 transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col min-w-0">
                          <span className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-primary transition-colors">
                            {producto.nombre}
                          </span>
                          <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                            {producto.descripcion}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {producto.en_promocion && producto.precio_promocion ? (
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-body-sm text-body-sm line-through text-on-surface-variant">
                              Bs {producto.precio}
                            </span>
                            <span className="font-price-sm text-price-sm text-primary font-extrabold">
                              Bs {producto.precio_promocion}
                            </span>
                          </div>
                        ) : (
                          <span className="font-price-sm text-price-sm text-on-surface font-extrabold">
                            Bs {producto.precio}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {sinStock ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-label-md text-label-md font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-error" />
                            Sin stock
                          </span>
                        ) : stockBajo ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-fixed text-primary font-label-md text-label-md font-bold">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            {producto.stock} · Stock bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/40 text-on-secondary-container font-label-md text-label-md font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                            {producto.stock} unid.
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {producto.en_promocion ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-fixed text-primary font-label-sm text-label-sm font-bold shadow-xs">
                            <span className="material-symbols-outlined text-[13px]">percent</span>
                            En promoción
                          </span>
                        ) : (
                          <span className="font-body-sm text-body-sm text-on-surface-variant/60">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Switch
                          checked={producto.activo}
                          onChange={(activo) => cambiarActivo(producto, activo)}
                          label={`Mostrar ${producto.nombre} en PaseoYa`}
                        />
                      </td>
                      <td className="py-3.5 pr-6 pl-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="p-1.5 rounded-lg text-primary hover:bg-primary-fixed transition-colors flex items-center gap-1 font-label-md text-label-md font-bold"
                            onClick={() => abrirEdicion(producto)}
                          >
                            <span className="material-symbols-outlined text-[17px]">edit</span>
                            <span>Editar</span>
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-error hover:bg-error-container transition-colors flex items-center gap-1 font-label-md text-label-md font-medium"
                            onClick={() => eliminar(producto)}
                          >
                            <span className="material-symbols-outlined text-[17px]">delete</span>
                            <span>Eliminar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              {!cargando && productosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-space-lg text-center text-on-surface-variant font-body-md text-body-md">
                    No se encontraron productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-surface-container-lowest px-space-lg py-space-md flex items-center justify-between gap-space-sm border-t border-surface-container">
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Mostrando <span className="font-semibold text-on-surface">{productosFiltrados.length}</span> de{" "}
            <span className="font-semibold text-on-surface">{productos.length}</span> productos
          </span>
        </div>
      </div>

      {modalAbierto && (
        <ProductoFormModal
          productoExistente={productoEnEdicion}
          onGuardar={guardarProducto}
          onCerrar={() => setModalAbierto(false)}
          guardando={guardando}
          error={errorModal}
        />
      )}
    </div>
  );
}
