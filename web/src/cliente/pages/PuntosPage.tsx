import type { Monedero } from "../api";
import { NIVELES_CLIENTE, nivelParaSaldo } from "../constants";
import { CabeceraCliente, EncabezadoPanel, EstadoDatos, Superficie } from "../components/ClienteUi";
import { useClienteDatos } from "../hooks/useClienteDatos";
import { formatoPuntos } from "../utils";

export function ClientePuntosPage() {
  const monedero = useClienteDatos<Monedero>("/puntos/monedero/");
  const saldo = Number(monedero.data?.saldo || 0);
  const nivel = nivelParaSaldo(saldo);

  return (
    <div className="animate-cliente-in">
      <CabeceraCliente eyebrow="Paseo Points" titulo="Tu lealtad tiene recompensa" descripcion="Consulta tu saldo y descubre cuánto falta para avanzar de nivel." />
      <EstadoDatos cargando={monedero.cargando} error={monedero.error} onRetry={monedero.recargar}>
        {monedero.data && (
          <>
            <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <section className="bg-primary p-6 text-white sm:p-8">
                <EncabezadoPanel oscuro icono="account_balance_wallet" eyebrow="Paseo Points" titulo="Monedas disponibles" />
                <p className="mt-4 font-display text-[54px] leading-none font-extrabold tabular-nums">{formatoPuntos(saldo)}</p>
                <p className="mt-3 font-body-md text-body-md text-white/80">Puntos listos para usar en el Paseo.</p>
                <p className="mt-8 border-t border-white/20 pt-4 font-body-sm text-body-sm text-white/80">{monedero.data.recompensas_disponibles} recompensas a tu alcance ahora</p>
              </section>
              <Superficie className="flex flex-col justify-between">
                <EncabezadoPanel icono="workspace_premium" eyebrow="Estatus de lealtad" titulo={`Nivel ${nivel.actual.nombre}`} />
                <div className="mt-6">
                  <div className="mb-2 flex flex-wrap justify-between gap-2 font-body-sm text-body-sm"><span>Multiplicador <strong>{nivel.actual.multiplicador}</strong></span><span>{nivel.siguiente ? `${formatoPuntos(nivel.siguiente.desde - saldo)} pts para ${nivel.siguiente.nombre}` : "Nivel máximo alcanzado"}</span></div>
                  <div className="h-3 bg-surface-container-high" role="progressbar" aria-valuenow={Math.round(nivel.progreso * 100)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-secondary transition-[width] duration-700" style={{ width: `${nivel.progreso * 100}%` }} /></div>
                </div>
              </Superficie>
            </div>

            <section className="mt-8">
              <EncabezadoPanel icono="trending_up" eyebrow="Escalera de lealtad" titulo="Cada visita te acerca" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {NIVELES_CLIENTE.map((item, indice) => {
                  const activo = item.nombre === nivel.actual.nombre;
                  const pasado = saldo >= (NIVELES_CLIENTE[indice + 1]?.desde ?? Number.POSITIVE_INFINITY);
                  return (
                    <article key={item.nombre} className={`border p-4 ${activo ? "border-secondary bg-secondary-fixed/60" : "border-outline-variant/50 bg-surface-container-lowest"}`}>
                      <div className="flex items-center justify-between gap-2"><h3 className="font-headline-sm text-headline-sm" style={{ color: item.color }}>{item.nombre}</h3><span className="font-label-md text-label-md font-bold">{item.multiplicador}</span></div>
                      <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">Desde {formatoPuntos(item.desde)} puntos</p>
                      <p className="mt-3 font-label-sm text-label-sm font-bold uppercase text-secondary">{activo ? "Nivel actual" : pasado ? "Completado" : "Por alcanzar"}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </EstadoDatos>
    </div>
  );
}