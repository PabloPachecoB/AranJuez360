import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { ListaApi, Monedero, Oferta } from "../api";
import { nivelParaSaldo } from "../constants";
import { CabeceraCliente, EstadoDatos, Superficie } from "../components/ClienteUi";
import { useClienteDatos } from "../hooks/useClienteDatos";
import { formatoBolivianos, formatoFecha, formatoPuntos, lista } from "../utils";

export function ClienteInicioPage() {
  const { usuario } = useAuth();
  const monedero = useClienteDatos<Monedero>("/puntos/monedero/");
  const ofertas = useClienteDatos<ListaApi<Oferta>>("/ofertas/", false);
  const saldo = Number(monedero.data?.saldo || usuario?.puntos_saldo || 0);
  const nivel = nivelParaSaldo(saldo);
  const promociones = lista(ofertas.data).slice(0, 3);

  return (
    <div className="animate-cliente-in">
      <CabeceraCliente eyebrow="PaseoYa · Mi espacio" titulo={`Hola, ${usuario?.first_name || "bienvenido"}`} descripcion="Tu próxima visita puede acercarte a algo bueno." />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="relative overflow-hidden bg-primary px-6 py-7 text-white sm:px-9 sm:py-9">
          <div className="relative z-10 max-w-xl">
            <p className="font-label-md text-label-md font-bold uppercase text-secondary-fixed-dim">Saldo disponible</p>
            <p className="mt-3 font-display text-[52px] leading-none font-extrabold tabular-nums sm:text-[64px]">{formatoPuntos(saldo)} <span className="text-[20px] font-semibold">pts</span></p>
            <p className="mt-3 font-body-md text-body-md text-white/80">Equivale a {formatoBolivianos(monedero.data?.saldo_bs)} en beneficios.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/recompensas" className="inline-flex min-h-11 items-center gap-2 bg-secondary-fixed-dim px-4 font-label-md text-label-md font-bold text-on-primary-fixed hover:bg-secondary-fixed">
                <span className="material-symbols-outlined" aria-hidden="true">redeem</span> Ver recompensas
              </Link>
              <Link to="/pase" className="inline-flex min-h-11 items-center gap-2 border border-white/40 px-4 font-label-md text-label-md font-bold text-white hover:bg-white/10">
                <span className="material-symbols-outlined" aria-hidden="true">qr_code_2</span> Mostrar mi pase
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="absolute -right-14 -top-24 h-80 w-80 rounded-full border-[36px] border-white/5" />
        </section>

        <Superficie className="flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-label-md text-label-md font-bold uppercase text-on-surface-variant">Tu nivel</p>
              <h2 className="mt-2 font-headline-lg text-headline-lg" style={{ color: nivel.actual.color }}>{nivel.actual.nombre}</h2>
            </div>
            <span className="material-symbols-outlined text-[34px]" style={{ color: nivel.actual.color }} aria-hidden="true">workspace_premium</span>
          </div>
          <div className="mt-8">
            <div className="mb-2 flex justify-between gap-4 font-body-sm text-body-sm">
              <span>Multiplicador activo <strong>{nivel.actual.multiplicador}</strong></span>
              <span>{nivel.siguiente ? `${formatoPuntos(nivel.siguiente.desde - saldo)} pts al siguiente` : "Nivel máximo"}</span>
            </div>
            <div className="h-2.5 overflow-hidden bg-surface-container-high" role="progressbar" aria-valuenow={Math.round(nivel.progreso * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-secondary transition-[width] duration-700" style={{ width: `${nivel.progreso * 100}%` }} />
            </div>
            <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
              {nivel.siguiente ? `Suma ${formatoPuntos(nivel.siguiente.desde - saldo)} puntos para llegar a ${nivel.siguiente.nombre}.` : "Disfruta los beneficios de tu nivel Platinum."}
            </p>
          </div>
        </Superficie>
      </div>

      <div className="mt-7 grid gap-7 xl:grid-cols-[1.5fr_1fr]">
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div><p className="font-label-md text-label-md font-bold uppercase text-secondary">En el Paseo</p><h2 className="mt-1 font-headline-md text-headline-md">Promociones vigentes</h2></div>
            <Link to="/explorar" className="font-label-md text-label-md font-bold text-primary hover:underline">Ver todas</Link>
          </div>
          <EstadoDatos cargando={ofertas.cargando} error={ofertas.error} vacio={!promociones.length} onRetry={ofertas.recargar}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {promociones.map((oferta) => (
                <article key={oferta.id} className="flex min-h-44 flex-col justify-between border border-outline-variant/50 bg-surface-container-lowest p-4">
                  <div>
                    <p className="font-label-sm text-label-sm font-bold uppercase text-secondary">{oferta.empresa_nombre}</p>
                    <h3 className="mt-2 font-headline-sm text-headline-sm">{oferta.titulo}</h3>
                    <p className="mt-1 line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">{oferta.descripcion}</p>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-2">
                    {oferta.precio_oferta ? <strong className="font-price-display text-price-display text-primary">{formatoBolivianos(oferta.precio_oferta)}</strong> : <span className="font-body-sm text-body-sm text-on-surface-variant">Válida hasta {formatoFecha(oferta.fin)}</span>}
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Piso {oferta.piso || "—"}</span>
                  </div>
                </article>
              ))}
            </div>
          </EstadoDatos>
        </section>

        <Superficie>
          <p className="font-label-md text-label-md font-bold uppercase text-secondary">Tu próximo objetivo</p>
          {monedero.data?.siguiente ? (
            <>
              <h2 className="mt-2 font-headline-md text-headline-md">{monedero.data.siguiente.nombre}</h2>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{formatoPuntos(monedero.data.siguiente.faltan_puntos)} pts restantes</p>
              <div className="mt-4 h-2 overflow-hidden bg-surface-container-high"><div className="h-full bg-primary" style={{ width: `${Math.max(4, monedero.data.siguiente.progreso * 100)}%` }} /></div>
            </>
          ) : <p className="mt-3 font-body-md text-body-md text-on-surface-variant">Explora las recompensas y elige tu siguiente canje.</p>}
          <Link to="/recompensas" className="mt-5 inline-flex items-center gap-2 font-label-md text-label-md font-bold text-primary hover:underline">Abrir catálogo <span aria-hidden="true">→</span></Link>
        </Superficie>
      </div>
    </div>
  );
}