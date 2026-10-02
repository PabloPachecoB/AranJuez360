import { useState, type FormEvent } from "react";
import type { Producto, ProductoInput } from "../types";

interface Props {
  productoExistente: Producto | null;
  onGuardar: (datos: ProductoInput) => void;
  onCerrar: () => void;
}

const vacio: ProductoInput = {
  nombre: "",
  descripcion: "",
  precio: 0,
  foto_url: "",
  stock: 0,
  en_promocion: false,
  precio_promocion: null,
  activo: true,
};

export function ProductoFormModal({ productoExistente, onGuardar, onCerrar }: Props) {
  const [datos, setDatos] = useState<ProductoInput>(productoExistente ?? vacio);

  function actualizar<K extends keyof ProductoInput>(campo: K, valor: ProductoInput[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar({
      ...datos,
      precio_promocion: datos.en_promocion ? datos.precio_promocion : null,
    });
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>{productoExistente ? "Editar producto" : "Nuevo producto"}</h2>

        <label className="campo">
          Nombre
          <input
            required
            value={datos.nombre}
            onChange={(e) => actualizar("nombre", e.target.value)}
          />
        </label>

        <label className="campo">
          Descripción
          <textarea
            value={datos.descripcion}
            onChange={(e) => actualizar("descripcion", e.target.value)}
          />
        </label>

        <div className="campo-fila">
          <label className="campo">
            Precio (Bs)
            <input
              required
              type="number"
              min={0}
              step="0.5"
              value={datos.precio}
              onChange={(e) => actualizar("precio", Number(e.target.value))}
            />
          </label>

          <label className="campo">
            Stock
            <input
              required
              type="number"
              min={0}
              value={datos.stock}
              onChange={(e) => actualizar("stock", Number(e.target.value))}
            />
          </label>
        </div>

        <label className="campo">
          URL de foto (opcional)
          <input
            value={datos.foto_url}
            onChange={(e) => actualizar("foto_url", e.target.value)}
            placeholder="https://..."
          />
        </label>

        <label className="campo-checkbox">
          <input
            type="checkbox"
            checked={datos.en_promocion}
            onChange={(e) => actualizar("en_promocion", e.target.checked)}
          />
          En promoción
        </label>

        {datos.en_promocion && (
          <label className="campo">
            Precio de promoción (Bs)
            <input
              required
              type="number"
              min={0}
              step="0.5"
              value={datos.precio_promocion ?? ""}
              onChange={(e) => actualizar("precio_promocion", Number(e.target.value))}
            />
          </label>
        )}

        <label className="campo-checkbox">
          <input
            type="checkbox"
            checked={datos.activo}
            onChange={(e) => actualizar("activo", e.target.checked)}
          />
          Activo (visible para clientes)
        </label>

        <div className="modal-acciones">
          <button type="button" className="btn btn-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primario">
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
