import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { api } from "../api";
import { Estado, useApi } from "../ui";

/**
 * QR de fidelización del negocio: lo genera el propio negocio, lo imprime y lo pone en caja.
 * El cliente lo escanea con la app del Paseo, ingresa NIT y monto, y la caja aprueba.
 */
export default function MiQR() {
  const codigo = useApi("/mi-empresa/codigo/");
  const perfil = useApi("/mi-empresa/");
  const lienzo = useRef(null);
  const [msg, setMsg] = useState(null);

  const descargar = () => {
    const canvas = lienzo.current?.querySelector("canvas");
    if (!canvas) return;
    const enlace = document.createElement("a");
    enlace.href = canvas.toDataURL("image/png");
    enlace.download = `qr-caja-${(perfil.data?.nombre || "negocio").toLowerCase().replace(/\s+/g, "-")}.png`;
    enlace.click();
  };

  const regenerar = async () => {
    if (!window.confirm(
      "¿Generar un QR nuevo? El QR impreso actual dejará de funcionar y tendrás que imprimir el nuevo. "
      + "Úsalo si se filtró una foto del QR."
    )) return;
    try {
      await api("/mi-empresa/codigo/regenerar/", { method: "POST" });
      setMsg("QR nuevo generado. Imprímelo y reemplaza el anterior en caja.");
      codigo.recargar();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo.data.enlace);
      setMsg("Enlace copiado: grábalo en un sticker NFC con la app NFC Tools.");
    } catch {
      window.prompt("Copia el enlace para el sticker NFC:", codigo.data.enlace);
    }
  };

  return (
    <>
      <div className="page-head no-imprimir">
        <div>
          <h1>Mi QR de caja</h1>
          <p>Imprímelo y ponlo en tu caja. Tus clientes lo escanean con la app del Paseo para ganar monedas.</p>
        </div>
      </div>

      <Estado cargando={codigo.cargando && !codigo.data} error={codigo.error} vacio={false}>
        {codigo.data && (
          <div className="qr-caja">
            <section className="card qr-cartel" ref={lienzo}>
              <div className="qr-marca">PASEO ARANJUEZ · MONEDAS</div>
              <h2>{perfil.data?.nombre}</h2>
              <p className="qr-instruccion">Escanea con la app del Paseo y gana monedas con tu compra</p>
              <QRCodeCanvas value={codigo.data.enlace} size={280} level="M" marginSize={2} />
              <div className="qr-codigo">{codigo.data.codigo}</div>
              <p className="muted">1. Escanea · 2. Ingresa tu NIT y el monto · 3. La caja aprueba</p>
            </section>

            <section className="card no-imprimir">
              <h2>Acciones</h2>
              <div className="qr-acciones">
                <button className="btn" onClick={() => window.print()}>Imprimir</button>
                <button className="btn ghost" onClick={descargar}>Descargar imagen</button>
                <button className="btn ghost" onClick={copiar}>Copiar enlace NFC</button>
              </div>
              <p className="sub" style={{ marginTop: 12 }}>
                Cada compra que tus clientes registren con este QR te llega a <strong>Caja</strong> para que la apruebes
                revisando el ticket.
              </p>
              <hr />
              <h2>¿Se filtró una foto del QR?</h2>
              <p className="sub">Genera uno nuevo: el anterior deja de funcionar al instante.</p>
              <button className="btn ghost" onClick={regenerar}>Generar QR nuevo</button>
              {msg && <p className="muted" style={{ marginTop: 10 }}>{msg}</p>}
            </section>
          </div>
        )}
      </Estado>
    </>
  );
}
