import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, SorteoApiError } from "../api";
import { CampoCodigo } from "../components/CampoCodigo";
import { Alerta, Marco, botonClase } from "../components/Marco";
import { TEXTO_CANAL } from "../formato";
import { desafioPendiente, sesionTarjeta } from "../sesion";

const ESPERA_REENVIO_SEGUNDOS = 60;

export function VerificarPage() {
  const navegar = useNavigate();
  const [pendiente, setPendiente] = useState(() => desafioPendiente.obtener());
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [foco, setFoco] = useState(0);
  const [segundos, setSegundos] = useState(() => restantes(pendiente?.creado_en));
  const enCurso = useRef(false); // frena dos verificaciones simultáneas (el código autoenvía al llegar a 6 dígitos)

  useEffect(() => {
    const t = setInterval(() => setSegundos(restantes(pendiente?.creado_en)), 1000);
    return () => clearInterval(t);
  }, [pendiente?.creado_en]);

  if (!pendiente) return <Navigate to="/tarjeta" replace />;

  async function verificar(valor: string) {
    if (!pendiente || enCurso.current) return;
    enCurso.current = true;
    setError(null);
    setAviso(null);
    setVerificando(true);
    try {
      const r = await api.verificar(pendiente.desafio, valor);
      sesionTarjeta.guardar(r.sesion);
      desafioPendiente.borrar();
      navegar("/tarjeta/mi", { replace: true });
    } catch (err) {
      setCodigo("");
      setFoco((n) => n + 1); // el foco vuelve a la primera casilla: en el celular el teclado sigue abierto
      if (err instanceof SorteoApiError) {
        setError(err.message);
        // un desafío que ya no existe no se puede reenviar: hay que empezar de nuevo
        if (err.codigo === "desafio_invalido") desafioPendiente.borrar();
      } else setError("No se pudo revisar el código. Prueba de nuevo.");
    } finally {
      enCurso.current = false;
      setVerificando(false);
    }
  }

  async function reenviar() {
    if (!pendiente || enCurso.current) return;
    enCurso.current = true;
    setError(null);
    setAviso(null);
    try {
      const nuevo = await api.reenviar(pendiente.desafio);
      desafioPendiente.guardar(nuevo);
      setPendiente(desafioPendiente.obtener());
      setCodigo("");
      setFoco((n) => n + 1);
      setAviso("Te enviamos otro código.");
    } catch (err) {
      setError(err instanceof SorteoApiError ? err.message : "No se pudo reenviar el código.");
    } finally {
      enCurso.current = false;
    }
  }

  return (
    <Marco
      titulo="Escribe tu código"
      subtitulo={`Lo enviamos a tu ${TEXTO_CANAL[pendiente.canal]} ${pendiente.destino}. Vale ${pendiente.vence_en_minutos} minutos.`}
    >
      <div className="flex flex-col gap-5">
        <CampoCodigo valor={codigo} onCambio={setCodigo} onCompleto={verificar} deshabilitado={verificando} conError={!!error} enfocar={foco} />
        {error && <Alerta>{error}</Alerta>}
        {aviso && (
          <p role="status" className="text-center text-secondary">
            {aviso}
          </p>
        )}
        <button type="button" className={botonClase} disabled={codigo.length !== 6 || verificando} onClick={() => verificar(codigo)}>
          {verificando ? "Verificando…" : "Verificar"}
        </button>
        <button
          type="button"
          onClick={reenviar}
          disabled={segundos > 0}
          className="font-semibold text-secondary underline disabled:text-on-surface-variant disabled:no-underline"
        >
          {segundos > 0 ? `Pedir otro código en ${segundos} s` : "Pedir otro código"}
        </button>
        <p className="rounded-lg bg-surface-container-low px-3 py-2 text-on-surface-variant">
          ¿No llega? {pendiente.canal === "CORREO" ? "Revisa el spam. " : ""}
          Si ya tenías tarjeta, usa el mismo correo o celular de tu registro.
        </p>
        <Link to="/tarjeta" onClick={() => desafioPendiente.borrar()} className="text-center text-on-surface-variant underline">
          Cambiar mis datos
        </Link>
      </div>
    </Marco>
  );
}

function restantes(creadoEn?: number): number {
  if (!creadoEn) return 0;
  return Math.max(0, ESPERA_REENVIO_SEGUNDOS - Math.floor((Date.now() - creadoEn) / 1000));
}
