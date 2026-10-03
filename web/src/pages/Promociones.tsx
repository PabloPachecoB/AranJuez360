import { Check, CheckCircle2, Package, Percent, Tag, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, useDb } from '../api/db';
import { Modal } from '../components/Modal';
import { bs } from '../lib/image';
import type { Producto } from '../types';

const descuento = (p: Producto) => (p.precio_promocion != null ? Math.round((1 - p.precio_promocion / p.precio) * 100) : 0);
const redondear = (n: number) => Math.round(n * 100) / 100;

export function Promociones() {
  const { productos, negocio } = useDb();
  const [edit, setEdit] = useState<Producto | null>(null);
  const [valor, setValor] = useState('');
  const [error, setError] = useState('');

  const activas = productos.filter((p) => p.en_promocion);
  const disponibles = productos.filter((p) => !p.en_promocion && p.activo);

  function abrir(p: Producto) {
    setEdit(p);
    setValor(p.precio_promocion != null ? String(p.precio_promocion) : '');
    setError('');
  }

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const v = Number(valor);
    if (!(v > 0) || v >= edit.precio) return setError(`El precio de promoción debe ser mayor a 0 y menor a ${bs(edit.precio)}.`);
    api.setPromocion(edit.id, v);
    setEdit(null);
  }

  const v = Number(valor);
  const ahorro = edit && v > 0 && v < edit.precio ? redondear(edit.precio - v) : null;

  const Card = ({ p, activa }: { p: Producto; activa: boolean }) => (
    <article className={`pcard ${activa ? 'promo' : ''}`}>
      <div className="pimg">
        {p.foto_url ? <img src={p.foto_url} alt="" /> : <Package size={36} />}
        {activa && (
          <span className="tag">
            <Tag size={11} /> -{descuento(p)}%
          </span>
        )}
      </div>
      <div className="pbody">
        <h4>{p.nombre}</h4>
        <p className="price">
          {activa ? (
            <>
              <b>{bs(p.precio_promocion ?? p.precio)}</b>
              <s>{bs(p.precio)}</s>
            </>
          ) : (
            <b>{bs(p.precio)}</b>
          )}
        </p>
      </div>
      <div className="pfoot">
        {activa ? (
          <>
            <button className="btn small" onClick={() => abrir(p)}>
              Cambiar precio
            </button>
            <button className="btn small ghost" onClick={() => api.setPromocion(p.id, null)}>
              <X size={14} /> Quitar
            </button>
          </>
        ) : (
          <button className="btn small primary" onClick={() => abrir(p)}>
            <Percent size={14} /> Poner en promoción
          </button>
        )}
      </div>
    </article>
  );

  return (
    <>
      <div className="toolbar">
        <h2>
          Promociones activas <span className="count">{activas.length}</span>
        </h2>
      </div>

      {activas.length === 0 ? (
        <div className="empty small">
          <Tag size={36} />
          <p>No tienes promociones activas. Elige un producto abajo y ponle precio especial.</p>
        </div>
      ) : (
        <div className="grid">
          {activas.map((p) => (
            <Card key={p.id} p={p} activa />
          ))}
        </div>
      )}

      <div className="toolbar spaced">
        <h2>
          Productos sin promoción <span className="count">{disponibles.length}</span>
        </h2>
      </div>

      {disponibles.length === 0 ? (
        <div className="empty small">
          <p>{productos.length === 0 ? 'Primero sube productos en “Mis productos”.' : 'Todos tus productos visibles ya están en promoción.'}</p>
        </div>
      ) : (
        <div className="grid">
          {disponibles.map((p) => (
            <Card key={p.id} p={p} activa={false} />
          ))}
        </div>
      )}

      {edit && (
        <Modal eyebrow="Configuración de descuento" title={`Activar promoción para ${edit.nombre}`} onClose={() => setEdit(null)}>
          <form className="form" onSubmit={guardar}>
            <div className="pricebox">
              <div>
                <small>Precio de lista regular</small>
                <b>{bs(edit.precio)}</b>
              </div>
              <span>Vitrina {negocio.nombre}</span>
            </div>
            <div>
              <p className="label" style={{ marginBottom: 8 }}>
                Atajos rápidos de descuento:
              </p>
              <div className="quick">
                {[10, 20, 30, 50].map((d) => {
                  const precio = redondear(edit.precio * (1 - d / 100));
                  return (
                    <button type="button" key={d} className={v === precio ? 'on' : ''} onClick={() => setValor(String(precio))}>
                      -{d}%
                      <small>{bs(precio)}</small>
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="field">
              <span className="label">Precio final de promoción (Bs)</span>
              <div className="prefix">
                <span>Bs</span>
                <input autoFocus type="number" min="0" step="0.01" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
              </div>
            </label>
            {ahorro != null && (
              <p className="saving">
                <CheckCircle2 size={14} style={{ verticalAlign: -2 }} /> El cliente ahorrará {bs(ahorro)} en cada compra
              </p>
            )}
            {error && <p className="error">{error}</p>}
            <footer className="modal-foot">
              <button type="button" className="btn" onClick={() => setEdit(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn primary">
                <Check size={16} /> Activar promoción
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
