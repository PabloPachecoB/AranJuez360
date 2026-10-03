import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import type { ProductoApi, ProductoInput } from "../api/productos";
import { Switch } from "./Switch";

interface Props {
  productoExistente: ProductoApi | null;
  onGuardar: (datos: ProductoInput, foto: File | null) => void;
  onCerrar: () => void;
  guardando: boolean;
  error: string | null;
}

const FORMATOS_ACEPTADOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANO_MAXIMO_MB = 5;

const vacio: ProductoInput = {
  nombre: "",
  descripcion: "",
  precio: 0,
  stock: 0,
  en_promocion: false,
  precio_promocion: null,
  activo: true,
};

function aInput(p: ProductoApi | null): ProductoInput {
  if (!p) return vacio;
  return {
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: Number(p.precio),
    stock: p.stock,
    en_promocion: p.en_promocion,
    precio_promocion: p.precio_promocion != null ? Number(p.precio_promocion) : null,
    activo: p.activo,
  };
}

const inputClase =
  "w-full px-space-md py-3 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary transition-all";
const labelClase = "font-label-md text-label-md text-on-surface font-semibold";

export function ProductoFormModal({ productoExistente, onGuardar, onCerrar, guardando, error }: Props) {
  const [datos, setDatos] = useState<ProductoInput>(aInput(productoExistente));
  const [foto, setFoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(productoExistente?.foto ?? null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const descuentoPct =
    datos.en_promocion && datos.precio > 0 && datos.precio_promocion != null && datos.precio_promocion < datos.precio
      ? Math.round(((datos.precio - datos.precio_promocion) / datos.precio) * 100)
      : null;

  function actualizar<K extends keyof ProductoInput>(campo: K, valor: ProductoInput[K]) {
    setDatos((prev) => ({ ...prev, [campo]: valor }));
  }

  function procesarArchivo(archivo: File | undefined) {
    if (!archivo) return;
    if (!FORMATOS_ACEPTADOS.includes(archivo.type)) {
      setErrorFoto("Formato no soportado. Usa JPG, PNG o WEBP.");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_MB * 1024 * 1024) {
      setErrorFoto(`La foto supera ${TAMANO_MAXIMO_MB}MB.`);
      return;
    }
    setErrorFoto(null);
    setFoto(archivo);
    // Solo para la vista previa en este formulario — lo que se sube de
    // verdad al guardar es el archivo (multipart), no esta URL temporal.
    setPreviewUrl(URL.createObjectURL(archivo));
  }

  function quitarFoto() {
    setFoto(null);
    setPreviewUrl(null);
    setErrorFoto(null);
  }

  function onSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastrando(false);
    procesarArchivo(e.dataTransfer.files[0]);
  }

  function onSeleccionarArchivo(e: ChangeEvent<HTMLInputElement>) {
    procesarArchivo(e.target.files?.[0]);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onGuardar(
      {
        ...datos,
        precio_promocion: datos.en_promocion ? datos.precio_promocion : null,
      },
      foto
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-on-surface/60 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <form
        className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="px-space-lg pt-space-lg pb-space-md flex items-start justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs text-primary mb-1">
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span className="font-badge-code text-badge-code uppercase font-bold tracking-wider">
                Catálogo PaseoYa
              </span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold tracking-tight">
              {productoExistente ? "Editar producto" : "Nuevo producto para PaseoYa"}
            </h2>
          </div>
          <button
            type="button"
            className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            onClick={onCerrar}
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="overflow-y-auto px-space-lg py-space-md flex flex-col gap-space-lg text-on-surface">
          <div className="p-space-md bg-surface-container-low rounded-xl">
            <div className="flex items-center gap-space-xs mb-space-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">photo_camera</span>
              <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Foto del producto
              </span>
            </div>
            {previewUrl ? (
              <div className="flex items-center gap-space-md bg-surface-container-lowest p-space-sm rounded-xl">
                <img
                  src={previewUrl}
                  alt="Vista previa"
                  className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                />
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-label-md text-label-md text-on-surface truncate">
                    {foto ? foto.name : "Foto actual"}
                  </span>
                  <button type="button" className="font-label-sm text-label-sm text-error font-bold text-left hover:underline" onClick={quitarFoto}>
                    Quitar foto
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`flex flex-col items-center justify-center gap-1 p-space-lg rounded-xl border-2 border-dashed cursor-pointer text-center transition-colors ${
                  arrastrando ? "border-primary bg-primary-fixed/30" : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container"
                }`}
                onClick={() => inputArchivoRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={onSoltar}
              >
                <span className="material-symbols-outlined text-primary text-[28px]">cloud_upload</span>
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  Arrastra una foto aquí o haz clic para subir
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  JPG, PNG o WEBP, máx. {TAMANO_MAXIMO_MB}MB
                </span>
                <input
                  ref={inputArchivoRef}
                  type="file"
                  accept={FORMATOS_ACEPTADOS.join(",")}
                  hidden
                  onChange={onSeleccionarArchivo}
                />
              </div>
            )}
            {errorFoto && <p className="font-body-sm text-body-sm text-error mt-2">{errorFoto}</p>}
          </div>

          <div className="flex flex-col gap-space-md">
            <div className="flex flex-col gap-1.5">
              <label className={labelClase}>
                Nombre del producto <span className="text-primary">*</span>
              </label>
              <input
                required
                className={inputClase}
                placeholder="Ej. Latte Vainilla 350ml"
                value={datos.nombre}
                onChange={(e) => actualizar("nombre", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClase}>Descripción</label>
              <textarea
                className={`${inputClase} resize-y`}
                rows={2}
                placeholder="Ingredientes, volumen o detalles principales..."
                value={datos.descripcion}
                onChange={(e) => actualizar("descripcion", e.target.value)}
              />
            </div>
          </div>

          <div className="p-space-md bg-surface-container-low rounded-xl flex flex-col gap-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary text-[20px]">local_offer</span>
              <span className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Precio, stock y promoción
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              <div className="flex flex-col gap-1.5">
                <label className={labelClase}>
                  Precio regular (Bs) <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 font-price-sm text-price-sm text-on-surface-variant">
                    Bs
                  </span>
                  <input
                    required
                    type="number"
                    min={0}
                    step="0.5"
                    className={`${inputClase} pl-11`}
                    value={datos.precio}
                    onChange={(e) => actualizar("precio", Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClase}>
                  Stock <span className="text-primary">*</span>
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  className={inputClase}
                  value={datos.stock}
                  onChange={(e) => actualizar("stock", Number(e.target.value))}
                />
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl flex flex-col gap-space-sm shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md font-bold text-on-surface">
                    ¿Activar promoción?
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Se mostrará destacado en el catálogo de clientes.
                  </span>
                </div>
                <Switch
                  checked={datos.en_promocion}
                  onChange={(en_promocion) => actualizar("en_promocion", en_promocion)}
                  label="Activar promoción"
                />
              </div>
              {datos.en_promocion && (
                <div className="pt-space-sm border-t border-surface-container-highest grid grid-cols-1 md:grid-cols-2 gap-space-md items-center">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-md text-label-md text-primary font-bold">
                      Precio promocional (Bs)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 font-price-sm text-price-sm text-primary font-bold">
                        Bs
                      </span>
                      <input
                        required
                        type="number"
                        min={0}
                        step="0.5"
                        className={`${inputClase} pl-11 text-primary font-bold`}
                        value={datos.precio_promocion ?? ""}
                        onChange={(e) => actualizar("precio_promocion", Number(e.target.value))}
                      />
                    </div>
                  </div>
                  {descuentoPct != null && (
                    <span className="bg-primary text-on-primary font-label-md text-label-md font-bold px-3 py-1 rounded-full shadow-sm w-fit justify-self-start md:justify-self-end">
                      -{descuentoPct}% OFF
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-space-md bg-surface-container-low rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">visibility</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-md text-label-md font-bold text-on-surface">
                  Visible en PaseoYa
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Al guardar, será visible para los clientes del centro comercial.
                </span>
              </div>
            </div>
            <Switch
              checked={datos.activo}
              onChange={(activo) => actualizar("activo", activo)}
              label="Producto activo"
            />
          </div>

          {error && (
            <p className="font-body-sm text-body-sm text-error bg-error-container/40 rounded-lg px-space-md py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-space-sm p-space-lg bg-surface-container-lowest">
          <button
            type="button"
            className="px-space-md py-2.5 text-on-surface-variant hover:bg-surface-container font-label-md text-label-md rounded-lg transition-colors"
            onClick={onCerrar}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="px-space-lg py-2.5 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-bold rounded-lg shadow-sm transition-all disabled:opacity-60"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
