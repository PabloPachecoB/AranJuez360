import Paseo360 from "../Paseo360";
import { Estado, useApi } from "../ui";
import Caja from "./Caja";
import { Fotos, Ofertas } from "./Catalogo";
import Horarios from "./Horarios";
import MiFicha from "./MiFicha";
import MiQR from "./MiQR";
import Recompensas from "./Recompensas";

/**
 * Pantallas de Paseo 360 dentro del panel del negocio: lo que ese panel no
 * tenía — horarios, ofertas de la app, galería y ficha pública con su página /sitio.
 */
function ConEmpresa({ children }) {
  const perfil = useApi("/mi-empresa/");
  return (
    <Paseo360>
      <Estado cargando={perfil.cargando && !perfil.data} error={perfil.error} vacio={false}>
        {perfil.data && children(perfil.data, perfil.recargar)}
      </Estado>
    </Paseo360>
  );
}

export function HorariosNegocio() {
  return <ConEmpresa>{(empresa) => <Horarios empresa={empresa} />}</ConEmpresa>;
}

export function OfertasNegocio() {
  return <ConEmpresa>{() => <Ofertas />}</ConEmpresa>;
}

export function FotosNegocio() {
  return <ConEmpresa>{() => <Fotos />}</ConEmpresa>;
}

export function FichaNegocio() {
  return (
    <ConEmpresa>
      {(empresa, recargar) => (
        <>
          <p style={{ textAlign: "right", margin: "0 0 8px" }}>
            <a className="btn ghost small" href={`/sitio/${empresa.id}`} target="_blank" rel="noreferrer">Ver mi página ↗</a>
          </p>
          <MiFicha empresa={empresa} onCambio={recargar} />
        </>
      )}
    </ConEmpresa>
  );
}

export function CajaNegocio() {
  return <Paseo360><Caja /></Paseo360>;
}

export function QRNegocio() {
  return <Paseo360><MiQR /></Paseo360>;
}

export function RecompensasNegocio() {
  return <Paseo360><Recompensas /></Paseo360>;
}
