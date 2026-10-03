import { useState } from "react";
import type { Categoria, Empresa, ListaApi, Oferta } from "../api";
import { CabeceraCliente, EncabezadoPanel, EstadoDatos } from "../components/ClienteUi";
import { useClienteDatos } from "../hooks/useClienteDatos";
import { formatoBolivianos, formatoFecha, lista } from "../utils";

export function ClienteExplorarPage() {
  const categoriasApi = useClienteDatos<ListaApi<Categoria>>("/categorias/", false);
  const ofertasApi = useClienteDatos<ListaApi<Oferta>>("/ofertas/", false);
  const [buscar, setBuscar] = useState("");
  const [categoria, setCategoria] = useState("");
  const [piso, setPiso] = useState("");
  const query = new URLSearchParams();
  if (buscar.trim()) query.set("buscar", buscar.trim());
  if (categoria) query.set("categoria", categoria);
  const empresasPath = `/empresas/${query.size ? `?${query.toString()}` : ""}`;
  const empresasApi = useClienteDatos<ListaApi<Empresa>>(empresasPath, false);
  const empresas = lista(empresasApi.data);
  const pisos = [...new Set(empresas.map((empresa) => empresa.piso).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const filtradas = empresas.filter((empresa) => !piso || empresa.piso === piso);

  return (
    <div className="animate-cliente-in">
      <CabeceraCliente eyebrow="Directorio y novedades" titulo="Explora el Paseo" descripcion="Encuentra tu próxima parada, revisa promociones y descubre nuevos locales." />
      <section className="mb-8 bg-primary px-5 py-6 text-white sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <EncabezadoPanel oscuro icono="local_offer" eyebrow="Ideas para hoy" titulo="Promociones vigentes" />
          <span className="font-body-sm text-body-sm text-white/75">Actualizadas desde los negocios participantes</span>
        </div>
        <EstadoDatos cargando={ofertasApi.cargando} error={ofertasApi.error} vacio={!lista(ofertasApi.data).length} onRetry={ofertasApi.recargar}>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lista(ofertasApi.data).map((oferta) => (
              <article key={oferta.id} className="flex min-h-36 flex-col justify-between bg-white p-4 text-on-surface">
                <div><p className="font-label-sm text-label-sm font-bold uppercase text-secondary">{oferta.empresa_nombre} · Piso {oferta.piso || "—"}</p><h3 className="mt-2 font-headline-sm text-headline-sm">{oferta.titulo}</h3><p className="mt-1 line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">{oferta.descripcion}</p></div>
                <div className="mt-4 flex items-end justify-between gap-2"><div>{oferta.precio_oferta && <strong className="font-price-display text-price-display text-primary">{formatoBolivianos(oferta.precio_oferta)}</strong>}{oferta.precio_normal && <span className="ml-2 font-body-sm text-body-sm text-on-surface-variant line-through">{formatoBolivianos(oferta.precio_normal)}</span>}</div><span className="font-label-sm text-label-sm text-on-surface-variant">Hasta {formatoFecha(oferta.fin)}</span></div>
              </article>
            ))}
          </div>
        </EstadoDatos>
      </section>

      <EncabezadoPanel icono="storefront" eyebrow="Encuentra tu local" titulo="Directorio de establecimientos" />
      <div className="mb-5 grid gap-3 md:grid-cols-[minmax(12rem,1.5fr)_minmax(10rem,1fr)_minmax(9rem,0.7fr)]">
        <label className="flex h-11 items-center gap-2 border border-outline-variant/60 bg-surface-container-lowest px-3"><span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">search</span><span className="sr-only">Buscar establecimientos</span><input value={buscar} onChange={(event) => setBuscar(event.target.value)} placeholder="Nombre del local" className="min-w-0 flex-1 bg-transparent font-body-md text-body-md outline-none" /></label>
        <label className="sr-only" htmlFor="cliente-categoria">Categoría</label><select id="cliente-categoria" value={categoria} onChange={(event) => setCategoria(event.target.value)} className="h-11 border border-outline-variant/60 bg-surface-container-lowest px-3 font-body-md text-body-md"><option value="">Todas las categorías</option>{lista(categoriasApi.data).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        <label className="sr-only" htmlFor="cliente-piso">Piso</label><select id="cliente-piso" value={piso} onChange={(event) => setPiso(event.target.value)} className="h-11 border border-outline-variant/60 bg-surface-container-lowest px-3 font-body-md text-body-md"><option value="">Todos los pisos</option>{pisos.map((item) => <option key={item} value={item}>Piso {item}</option>)}</select>
      </div>
      <EstadoDatos cargando={empresasApi.cargando} error={empresasApi.error} vacio={!filtradas.length} onRetry={empresasApi.recargar}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((empresa) => (
            <article key={empresa.id} className="flex items-center gap-4 border border-outline-variant/50 bg-surface-container-lowest p-4">
              {empresa.logo ? <img src={empresa.logo} alt="" className="h-14 w-14 shrink-0 object-contain" /> : <span className="grid h-14 w-14 shrink-0 place-items-center bg-surface-container-low text-secondary"><span className="material-symbols-outlined text-[28px]" aria-hidden="true">storefront</span></span>}
              <div className="min-w-0"><h3 className="truncate font-headline-sm text-headline-sm">{empresa.nombre}</h3><p className="mt-1 truncate font-body-sm text-body-sm text-on-surface-variant">{empresa.categoria_nombre || empresa.tipo}</p><p className="mt-1 font-label-sm text-label-sm font-semibold text-secondary">Piso {empresa.piso || "—"} · Local {empresa.local || "—"}</p></div>
            </article>
          ))}
        </div>
      </EstadoDatos>
    </div>
  );
}