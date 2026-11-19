import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { TIPOS } from "../format";
import { PISOS, type EspacioMapa, type PisoMapa } from "./planoEspacios";

interface EmpresaMapa {
  id: number;
  nombre: string;
  tipo: string;
  categoria_nombre: string | null;
  piso: string;
  local: string;
  activo: boolean;
}

interface ListaPaginada<T> {
  next: string | null;
  results: T[];
}

function codigoLocal(empresa: EmpresaMapa): string | null {
  const piso = empresa.piso.trim();
  const local = empresa.local.trim().replace(/^(local|oficina)\s*/i, "");
  if (piso !== "2" && piso !== "3") return null;
  if (!/^\d+$/.test(local)) return null;
  const numero = Number(local);
  if (numero >= 1 && numero <= 99) return `${piso}${String(numero).padStart(2, "0")}`;
  return local;
}

function Icono({ nombre, tamano = 20 }: { nombre: string; tamano?: number }) {
  return <span className="material-symbols-outlined leading-none" style={{ fontSize: tamano }} aria-hidden="true">{nombre}</span>;
}

export default function MapaEspacios() {
  const [piso, setPiso] = useState<PisoMapa["numero"]>("2");
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [empresas, setEmpresas] = useState<EmpresaMapa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contenedorMapa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vigente = true;
    async function cargarEmpresas() {
      try {
        const todas: EmpresaMapa[] = [];
        let pagina = 1;
        let hayMas = true;
        while (hayMas) {
          const respuesta = await api<ListaPaginada<EmpresaMapa>>(`/admin/empresas/?page=${pagina}`);
          todas.push(...respuesta.results);
          hayMas = Boolean(respuesta.next);
          pagina += 1;
        }
        if (vigente) setEmpresas(todas);
      } catch (fallo) {
        if (vigente) setError(fallo instanceof Error ? fallo.message : "No se pudo cargar el directorio.");
      } finally {
        if (vigente) setCargando(false);
      }
    }
    void cargarEmpresas();
    return () => { vigente = false; };
  }, []);

  const mapa = PISOS[piso];
  const porEspacio = useMemo(() => {
    const agrupadas = new Map<string, EmpresaMapa[]>();
    for (const empresa of empresas) {
      const codigo = codigoLocal(empresa);
      if (!codigo) continue;
      agrupadas.set(codigo, [...(agrupadas.get(codigo) || []), empresa]);
    }
    return agrupadas;
  }, [empresas]);
  const espacioSeleccionado = mapa.espacios.find((espacio) => espacio.numero === seleccion);
  const ocupantes = seleccion ? porEspacio.get(seleccion) || [] : [];
  const textoBusqueda = busqueda.trim().toLocaleLowerCase("es");
  const coincide = (espacio: EspacioMapa) =>
    !textoBusqueda || espacio.numero.includes(textoBusqueda) ||
    (porEspacio.get(espacio.numero) || []).some((empresa) => empresa.nombre.toLocaleLowerCase("es").includes(textoBusqueda));
  const encontrados = mapa.espacios.filter(coincide).length;

  function cambiarPiso(nuevoPiso: PisoMapa["numero"]) {
    setPiso(nuevoPiso);
    setSeleccion(null);
    setZoom(1);
    setBusqueda("");
    if (contenedorMapa.current) {
      contenedorMapa.current.scrollLeft = 0;
      contenedorMapa.current.scrollTop = 0;
    }
  }

  function tecladoEspacio(evento: KeyboardEvent<SVGPathElement>, espacio: EspacioMapa) {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      setSeleccion(espacio.numero);
    }
  }

  return (
    <div className="mapa-page mx-auto max-w-[1800px]">
      <header className="mb-space-lg flex flex-wrap items-end justify-between gap-space-md">
        <div>
          <p className="mb-1 font-label-sm text-label-sm font-semibold uppercase tracking-[0.12em] text-secondary">Directorio / Mapa y espacios</p>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Mapa y espacios</h1>
          <p className="mt-1 max-w-[65ch] font-body-md text-body-md text-on-surface-variant">
            Explora los planos del Paseo. Pulsa un local para ver su ubicación y la ficha vinculada.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-surface-container-low px-4 py-2 font-label-md text-label-md text-on-surface-variant">
          <Icono nombre="layers" tamano={18} /> Dos plantas disponibles
        </span>
      </header>

      <div className="grid min-w-0 gap-space-md xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest" aria-label="Plano interactivo">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/40 px-space-md py-space-md">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Plano del piso {piso}</h2>
              <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                {mapa.espacios.length} espacios seleccionables · Toca un área numerada
              </p>
            </div>
            <div className="flex rounded-lg bg-surface-container-low p-1" role="group" aria-label="Seleccionar piso">
              {(["2", "3"] as const).map((numero) => (
                <button key={numero} type="button" onClick={() => cambiarPiso(numero)}
                  aria-pressed={piso === numero}
                  className={`min-h-11 rounded-md px-4 font-label-md text-label-md font-semibold transition-colors ${piso === numero ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:bg-surface-container-high"}`}>
                  Piso {numero}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-space-md py-3">
            <label className="relative block w-full max-w-72">
              <span className="sr-only">Buscar local o establecimiento en el piso {piso}</span>
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-on-surface-variant"><Icono nombre="search" tamano={19} /></span>
              <input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar local o establecimiento"
                className="min-h-11 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest py-2 pl-10 pr-3 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant" />
            </label>
            <div className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
              <span className="h-3 w-3 rounded-sm border-2 border-primary bg-secondary-container/50" /> Seleccionado
              <span className="ml-2 h-3 w-3 rounded-full bg-admin-sidebar-accent" /> Ficha vinculada
            </div>
          </div>

          {textoBusqueda && <p className="px-space-md pb-2 font-body-sm text-body-sm text-on-surface-variant" role="status">
            {encontrados === 0 ? "Sin coincidencias en este piso." : `${encontrados} ${encontrados === 1 ? "espacio encontrado" : "espacios encontrados"} en el plano.`}
          </p>}

          <div ref={contenedorMapa} className="mapa-lienzo overflow-auto bg-[#f8f7f3]" tabIndex={0}
            role="region" aria-label={`Mapa desplazable del piso ${piso}`}>
            <svg viewBox="0 0 1600 1080" className="block h-auto max-w-none" style={{ width: `${zoom * 100}%`, minWidth: 700 * zoom }}
              role="group" aria-label={`Plano del piso ${piso} con ${mapa.espacios.length} locales interactivos`}>
              <image href={mapa.plano} x="0" y="0" width="1600" height="1080" preserveAspectRatio="xMidYMid meet" />
              {mapa.espacios.map((espacio) => {
                const activo = seleccion === espacio.numero;
                const visible = coincide(espacio);
                const vinculado = (porEspacio.get(espacio.numero) || []).length > 0;
                return (
                  <g key={espacio.numero} className={visible ? "" : "mapa-espacio-atenuado"}>
                    <path d={espacio.trazado} className="mapa-espacio"
                      data-selected={activo} role="button" tabIndex={0}
                      aria-label={`Local ${espacio.numero}${vinculado ? ", con ficha vinculada" : ""}`}
                      aria-pressed={activo} onClick={() => setSeleccion(espacio.numero)}
                      onKeyDown={(evento) => tecladoEspacio(evento, espacio)}>
                      <title>Local {espacio.numero}{vinculado ? ` · ${porEspacio.get(espacio.numero)?.map((empresa) => empresa.nombre).join(", ")}` : ""}</title>
                    </path>
                    <rect x={espacio.x - 36} y={espacio.y - 18} width="72" height="36" rx="8"
                      className={activo ? "mapa-etiqueta-activa" : "mapa-etiqueta"} pointerEvents="none" />
                    <text x={espacio.x} y={espacio.y + 7} textAnchor="middle"
                      className={activo ? "mapa-numero-activo" : "mapa-numero"} pointerEvents="none">
                      {espacio.numero}
                    </text>
                    {vinculado && <circle cx={espacio.x + 34} cy={espacio.y - 17} r="7"
                      className="mapa-vinculado" pointerEvents="none" />}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/40 px-space-md py-3">
            <p className="font-body-sm text-body-sm text-on-surface-variant">Desplaza el plano para explorar todos los espacios.</p>
            <div className="flex items-center gap-1" role="group" aria-label="Zoom del plano">
              <button type="button" className="mapa-control" aria-label="Alejar plano" disabled={zoom <= 1}
                onClick={() => setZoom((actual) => Math.max(1, Math.round((actual - 0.25) * 100) / 100))}><Icono nombre="remove" /></button>
              <span className="min-w-14 text-center font-label-md text-label-md text-on-surface-variant">{Math.round(zoom * 100)}%</span>
              <button type="button" className="mapa-control" aria-label="Acercar plano" disabled={zoom >= 2.5}
                onClick={() => setZoom((actual) => Math.min(2.5, Math.round((actual + 0.25) * 100) / 100))}><Icono nombre="add" /></button>
              <button type="button" className="mapa-control ml-1" aria-label="Ajustar plano al tamaño inicial" onClick={() => setZoom(1)}><Icono nombre="fit_screen" /></button>
            </div>
          </div>
        </section>

        <aside className="min-w-0 self-start rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md xl:sticky xl:top-space-md" aria-label="Información del espacio seleccionado" aria-live="polite">
          {espacioSeleccionado ? (
            <>
              <div className="mb-space-md flex items-start justify-between gap-3">
                <div>
                  <p className="font-label-sm text-label-sm font-semibold uppercase tracking-[0.12em] text-secondary">Espacio seleccionado</p>
                  <h2 className="mt-1 font-headline-md text-headline-md text-on-surface">Local {espacioSeleccionado.numero}</h2>
                </div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-secondary-container text-on-secondary-container"><Icono nombre="storefront" /></span>
              </div>
              <dl className="space-y-3 border-y border-outline-variant/40 py-space-md font-body-md text-body-md">
                <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Planta</dt><dd className="font-semibold text-on-surface">Piso {piso}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Número</dt><dd className="font-semibold text-on-surface">{espacioSeleccionado.numero}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-on-surface-variant">Fichas vinculadas</dt><dd className="font-semibold text-on-surface">{cargando ? "Cargando…" : error ? "No disponible" : ocupantes.length}</dd></div>
              </dl>
              <div className="pt-space-md">
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Establecimiento</h3>
                {cargando ? <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">Consultando el directorio…</p>
                  : error ? <p className="mt-2 font-body-sm text-body-sm text-error">{error}</p>
                  : ocupantes.length ? ocupantes.map((empresa) => (
                    <div key={empresa.id} className="mt-3 rounded-lg bg-surface-container-low p-3">
                      <p className="font-label-md text-label-md font-semibold text-on-surface">{empresa.nombre}</p>
                      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{empresa.categoria_nombre || TIPOS[empresa.tipo] || empresa.tipo}</p>
                      <span className="mt-2 inline-flex rounded-full bg-secondary-container px-2 py-1 font-label-sm text-label-sm text-on-secondary-container">
                        {empresa.activo ? "Ficha activa" : "Ficha inactiva"}
                      </span>
                    </div>
                  )) : <p className="mt-2 rounded-lg bg-surface-container-low p-3 font-body-sm text-body-sm text-on-surface-variant">
                    Aún no hay una ficha del directorio vinculada con este número de local.
                  </p>}
                <Link to="/empresas" className="mt-space-md inline-flex min-h-11 items-center gap-2 font-label-md text-label-md font-semibold text-primary hover:underline">
                  Ver directorio de establecimientos <Icono nombre="arrow_forward" tamano={18} />
                </Link>
              </div>
            </>
          ) : (
            <div className="py-space-lg text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-surface-container-low text-secondary"><Icono nombre="touch_app" tamano={28} /></span>
              <h2 className="mt-space-md font-headline-sm text-headline-sm text-on-surface">Elige un espacio en el plano</h2>
              <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">Pulsa sobre cualquiera de los locales numerados para consultar su información.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
