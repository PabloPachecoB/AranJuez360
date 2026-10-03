import { useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { canjearRecompensa, type Cupon, type ListaApi, type Monedero, type Recompensa } from "../api";
import { UMBRALES_RECOMPENSA } from "../constants";
import { CabeceraCliente, EstadoDatos } from "../components/ClienteUi";
import { useClienteDatos } from "../hooks/useClienteDatos";
import { formatoFecha, formatoPuntos, lista } from "../utils";

const filtros = ["Todas", ...UMBRALES_RECOMPENSA.map((valor) => String(valor))];

export function ClienteRecompensasPage() {
  const catalogo = useClienteDatos<ListaApi<Recompensa>>("/puntos/recompensas/");
  const monedero = useClienteDatos<Monedero>("/puntos/monedero/");
  const [filtro, setFiltro] = useState("Todas");
  const [canjeando, setCanjeando] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const puntos = Number(monedero.data?.saldo || 0);
  const recompensas = lista(catalogo.data).filter((item) => filtro === "Todas" || Number(item.costo_puntos) <= Number(filtro));

  async function canjear(item: Recompensa) {
    if (!window.confirm(`¿Canjear “${item.nombre}” por ${formatoPuntos(item.costo_puntos)} puntos?`)) return;
    setCanjeando(item.id);
    setAviso(null);
    try {
      const cupon: Cupon = await canjearRecompensa(item.id);
      setAviso(`Canje confirmado. Tu código es ${cupon.codigo}.`);
      monedero.recargar();
      catalogo.recargar();
    } catch (error) {
      setAviso(error instanceof Error ? error.message : "No se pudo completar el canje.");
    } finally {
      setCanjeando(null);
    }
  }

  return (
    <div className="animate-cliente-in">
      <CabeceraCliente eyebrow="Catálogo Paseo Points" titulo="Elige tu próxima recompensa" descripcion="Canjea tus puntos por beneficios en los establecimientos participantes." action={<div className="bg-[#174b3b] px-4 py-3 text-white"><span className="block font-label-sm text-label-sm uppercase text-white/70">Saldo</span><strong className="font-headline-sm text-headline-sm">{formatoPuntos(puntos)} pts</strong></div>} />
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por umbral de puntos">
        {filtros.map((valor) => <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => setFiltro(valor)} className={`min-h-10 border px-4 font-label-md text-label-md font-semibold ${filtro === valor ? "border-primary bg-primary text-on-primary" : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant hover:border-primary"}`}>{valor === "Todas" ? "Todas" : `${valor} pts`}</button>)}
      </div>
      {aviso && <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 border-l-4 border-secondary bg-[#e9f3eb] px-4 py-3 font-body-md text-body-md"><span>{aviso}</span><Link to="/cupones" className="font-label-md text-label-md font-bold text-primary hover:underline">Ver mis cupones</Link></div>}
      <EstadoDatos cargando={catalogo.cargando} error={catalogo.error} vacio={!recompensas.length} onRetry={catalogo.recargar}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recompensas.map((item) => {
            const costo = Number(item.costo_puntos);
            const disponible = puntos >= costo;
            return (
              <article key={item.id} className="flex flex-col border border-outline-variant/50 bg-surface-container-lowest">
                {item.imagen ? <img src={item.imagen} alt="" className="h-40 w-full object-cover" /> : <div className="grid h-32 place-items-center bg-[#edf3eb]"><span className="material-symbols-outlined text-[48px] text-secondary" aria-hidden="true">redeem</span></div>}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3"><span className="font-label-sm text-label-sm font-bold uppercase text-secondary">{item.categoria}</span><strong className="shrink-0 font-price-sm text-price-sm text-primary">{formatoPuntos(costo)} pts</strong></div>
                  <h2 className="mt-2 font-headline-sm text-headline-sm">{item.nombre}</h2>
                  <p className="mt-2 flex-1 font-body-sm text-body-sm text-on-surface-variant">{item.descripcion || "Beneficio exclusivo para miembros PaseoYa."}</p>
                  <p className="mt-4 border-t border-outline-variant/40 pt-3 font-body-sm text-body-sm text-on-surface-variant">{item.empresa_nombre || "Válido en Paseo Aranjuez"}</p>
                  <button type="button" disabled={!disponible || canjeando !== null} onClick={() => void canjear(item)} className="mt-4 min-h-11 bg-primary px-4 font-label-md text-label-md font-bold text-on-primary hover:bg-primary-container disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant">
                    {canjeando === item.id ? "Confirmando…" : disponible ? "Canjear recompensa" : `Te faltan ${formatoPuntos(costo - puntos)} pts`}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </EstadoDatos>
    </div>
  );
}

export function ClienteCuponesPage() {
  const cuponesApi = useClienteDatos<ListaApi<Cupon>>("/puntos/canjes/");
  const [filtro, setFiltro] = useState<"ACTIVO" | "TODOS">("ACTIVO");
  const cupones = lista(cuponesApi.data).filter((item) => filtro === "TODOS" || item.estado === "ACTIVO");

  return (
    <div className="animate-cliente-in">
      <CabeceraCliente eyebrow="Tu billetera" titulo="Cupones y beneficios" descripcion="Presenta el código en el establecimiento para usar tu recompensa." />
      <div className="mb-5 inline-flex border border-outline-variant/50 bg-surface-container-lowest p-1" role="group" aria-label="Estado de cupones">
        {(["ACTIVO", "TODOS"] as const).map((estado) => <button key={estado} type="button" aria-pressed={filtro === estado} onClick={() => setFiltro(estado)} className={`min-h-9 px-4 font-label-md text-label-md font-semibold ${filtro === estado ? "bg-[#174b3b] text-white" : "text-on-surface-variant"}`}>{estado === "ACTIVO" ? "Por usar" : "Todos"}</button>)}
      </div>
      <EstadoDatos cargando={cuponesApi.cargando} error={cuponesApi.error} vacio={!cupones.length} onRetry={cuponesApi.recargar}>
        <div className="grid gap-4 lg:grid-cols-2">
          {cupones.map((cupon) => (
            <article key={cupon.id} className="grid gap-4 border border-outline-variant/50 bg-surface-container-lowest p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${cupon.estado === "ACTIVO" ? "bg-secondary" : "bg-outline"}`} /><span className="font-label-sm text-label-sm font-bold uppercase text-secondary">{cupon.estado_nombre}</span></div>
                <h2 className="mt-2 font-headline-sm text-headline-sm">{cupon.recompensa_nombre}</h2>
                <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Canjeable en {cupon.empresa_nombre || "Paseo Aranjuez"}</p>
                <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">Emitido el {formatoFecha(cupon.creado_en)} · {formatoPuntos(cupon.monedas)} pts</p>
                <code className="mt-3 inline-block bg-surface-container-low px-3 py-2 font-mono text-sm font-bold tracking-widest text-on-surface">{cupon.codigo}</code>
              </div>
              {cupon.estado === "ACTIVO" && <div className="justify-self-center border border-outline-variant/40 bg-white p-2"><QRCodeSVG value={cupon.codigo} size={112} level="M" /></div>}
            </article>
          ))}
        </div>
      </EstadoDatos>
    </div>
  );
}