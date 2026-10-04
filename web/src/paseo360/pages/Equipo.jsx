import { useState } from "react";
import Crud from "../Crud";
import { api } from "../api";
import { fecha } from "../format";

const estado = (f) => <span className={`pill ${f.is_active ? "on" : "off"}`}>{f.is_active ? "● Activo" : "○ Inactivo"}</span>;

/** Porteros del Paseo: el admin los crea con su correo y ellos reciben la contraseña por correo. */
export default function Equipo() {
  const [aviso, setAviso] = useState(null);

  const reenviar = async (portero) => {
    setAviso(null);
    try {
      await api(`/admin/porteros/${portero.id}/reenviar-acceso/`, { method: "POST" });
      setAviso(`Le enviamos un acceso nuevo a ${portero.email}.`);
    } catch (err) {
      setAviso(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Equipo del Paseo</h1>
          <p>Porteros que registran visitas, invitaciones a oficinas y entradas a eventos desde su app.</p>
        </div>
      </div>
      {aviso && <p className="aviso-ok card">{aviso}</p>}
      <Crud
        titulo="Porteros"
        subtitulo="Su app solo tiene escáner de QR, eventos y cartelera. No se borran: se desactivan."
        endpoint="/admin/porteros/"
        textoNuevo="Agregar portero"
        nombreFila={(f) => `${f.first_name} ${f.last_name}`.trim()}
        sinEliminar
        inicial={{ first_name: "", last_name: "", email: "", celular: "", is_active: true }}
        campos={[
          { k: "first_name", label: "Nombre", requerido: true },
          { k: "last_name", label: "Apellido" },
          { k: "email", label: "Correo", requerido: true, ayuda: "Ahí recibe su usuario y contraseña temporal" },
          { k: "celular", label: "Celular" },
          { k: "is_active", label: "Activo", tipo: "checkbox" },
        ]}
        columnas={[
          { label: "Portero", render: (f) => <strong>{`${f.first_name} ${f.last_name}`.trim()}</strong> },
          { label: "Correo", render: (f) => f.email },
          { label: "Celular", render: (f) => f.celular || "—" },
          { label: "Desde", render: (f) => fecha(f.date_joined) },
          { label: "Estado", render: estado },
        ]}
        acciones={(f) => (
          <>
            <button className="btn ghost small" onClick={() => reenviar(f)}>Reenviar acceso</button>{" "}
          </>
        )}
      />
    </>
  );
}
