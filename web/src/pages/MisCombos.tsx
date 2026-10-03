import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, useDb } from '../api/db';
import { ImageUploader } from '../components/ImageUploader';
import { Modal } from '../components/Modal';
import { bs } from '../lib/image';
import type { Combo, Producto } from '../types';

type Draft = { id?: string; nombre: string; descripcion: string; precio: string; foto_url: string; activo: boolean; cantidades: Record<string, number> };

const vacio: Draft = { nombre: '', descripcion: '', precio: '', foto_url: '', activo: true, cantidades: {} };

export const sumaNormal = (c: Pick<Combo, 'items'>, productos: Producto[]) =>
  c.items.reduce((s, it) => s + (productos.find((p) => p.id === it.producto_id)?.precio ?? 0) * it.cantidad, 0);

export const incluye = (c: Pick<Combo, 'items'>, productos: Producto[]) =>
  c.items.map((it) => `${it.cantidad}× ${productos.find((p) => p.id === it.producto_id)?.nombre ?? 'Producto'}`).join(' + ');

export function MisCombos() {
  const { combos, productos } = useDb();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const abrir = (d: Draft) => {
    setError('');
    setDraft(d);
  };

  const editar = (c: Combo) =>
    abrir({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      precio: String(c.precio),
      foto_url: c.foto_url,
      activo: c.activo,
      cantidades: Object.fromEntries(c.items.map((i) => [i.producto_id, i.cantidad])),
    });

  const items = draft ? Object.entries(draft.cantidades).filter(([, q]) => q > 0).map(([producto_id, cantidad]) => ({ producto_id, cantidad })) : [];
  const normal = sumaNormal({ items }, productos);
  const precio = Number(draft?.precio);
  const ahorro = precio > 0 && normal > precio ? normal - precio : 0;

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    if (!draft.nombre.trim()) return setError('Ponle un nombre al combo.');
    if (!items.length) return setError('Elige al menos un producto para el combo.');
    if (!(precio > 0)) return setError('El precio del combo debe ser mayor a 0.');
    api.saveCombo({ id: draft.id, nombre: draft.nombre.trim(), descripcion: draft.descripcion.trim(), precio, foto_url: draft.foto_url, items, activo: draft.activo });
    setDraft(null);
  }

  const setQ = (id: string, q: number) =>
    setDraft((d) => d && { ...d, cantidades: { ...d.cantidades, [id]: Math.max(0, Math.min(20, q)) } });

  return (
    <>
      <div className="toolbar">
        <h2>
          Mis combos <span className="count">{combos.length}</span>
        </h2>
        <button className="btn primary" onClick={() => abrir(vacio)} disabled={productos.length === 0}>
          <Plus size={18} /> Nuevo combo
        </button>
      </div>

      {productos.length === 0 ? (
        <div className="empty">
          <Layers size={44} />
          <h3>Primero sube tus productos</h3>
          <p>Un combo se arma con productos de tu menú. Ve a “Mis productos” y crea al menos uno.</p>
        </div>
      ) : combos.length === 0 ? (
        <div className="empty">
          <Layers size={44} />
          <h3>Aún no tienes combos</h3>
          <p>Junta varios productos con un precio especial: se venden más y el cliente ahorra.</p>
          <button className="btn primary" onClick={() => abrir(vacio)}>
            <Plus size={18} /> Crear mi primer combo
          </button>
        </div>
      ) : (
        <div className="grid">
          {combos.map((c) => {
            const n = sumaNormal(c, productos);
            return (
              <article key={c.id} className={`pcard promo ${c.activo ? '' : 'off'}`}>
                <div className="pimg">
                  {c.foto_url ? <img src={c.foto_url} alt="" /> : <Layers size={36} />}
                  <span className="tag">Combo</span>
                  {!c.activo && <span className="tag gray" style={{ left: 'auto', right: 8 }}>Oculto</span>}
                </div>
                <div className="pbody">
                  <h4>{c.nombre}</h4>
                  <p className="hint">{incluye(c, productos)}</p>
                  <p className="price">
                    <b>{bs(c.precio)}</b>
                    {n > c.precio && <s>{bs(n)}</s>}
                  </p>
                </div>
                <div className="pfoot">
                  <span className="pill none">{c.items.length} productos</span>
                  <button className="btn small" onClick={() => editar(c)}>
                    <Pencil size={13} /> Editar
                  </button>
                  <button className="icon-btn danger" aria-label={`Eliminar ${c.nombre}`} onClick={() => confirm(`¿Eliminar el combo “${c.nombre}”?`) && api.deleteCombo(c.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {draft && (
        <Modal eyebrow="Combo" title={draft.id ? 'Editar combo' : 'Nuevo combo'} onClose={() => setDraft(null)}>
          <form onSubmit={guardar} className="form">
            <ImageUploader label="Foto del combo" value={draft.foto_url ? [draft.foto_url] : []} onChange={(u) => setDraft({ ...draft, foto_url: u[0] ?? '' })} />
            <label className="field">
              <span className="label">Nombre del combo *</span>
              <input autoFocus value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Ej. Combo Burger + Papas" />
            </label>
            <div className="field">
              <span className="label">¿Qué incluye? *</span>
              <div className="combo-items">
                {productos.map((p) => {
                  const q = draft.cantidades[p.id] ?? 0;
                  return (
                    <div key={p.id} className={`combo-item ${q > 0 ? 'on' : ''}`}>
                      <span>
                        {p.nombre} <small>{bs(p.precio)}</small>
                      </span>
                      <div className="qty">
                        <button type="button" aria-label={`Quitar ${p.nombre}`} onClick={() => setQ(p.id, q - 1)}>
                          −
                        </button>
                        <b>{q}</b>
                        <button type="button" aria-label={`Agregar ${p.nombre}`} onClick={() => setQ(p.id, q + 1)}>
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <label className="field">
              <span className="label">Precio del combo (Bs) *</span>
              <div className="prefix">
                <span>Bs</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.precio} onChange={(e) => setDraft({ ...draft, precio: e.target.value })} />
              </div>
              {normal > 0 && (
                <span className="hint">
                  Comprados por separado: {bs(normal)}{' '}
                  <button type="button" className="linkbtn" onClick={() => setDraft({ ...draft, precio: String(Math.round(normal * 0.85 * 100) / 100) })}>
                    Sugerir -15%
                  </button>
                </span>
              )}
            </label>
            {ahorro > 0 && <p className="saving">El cliente ahorra {bs(ahorro)} con este combo</p>}
            <label className="check">
              <input type="checkbox" checked={draft.activo} onChange={(e) => setDraft({ ...draft, activo: e.target.checked })} />
              Visible para los clientes
            </label>
            {error && <p className="error">{error}</p>}
            <footer className="modal-foot">
              <button type="button" className="btn" onClick={() => setDraft(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn primary">
                Guardar combo
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
