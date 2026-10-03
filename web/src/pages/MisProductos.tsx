import { Package, Pencil, Plus, Search, Store, Tag, Trash2, Utensils } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useDb } from '../api/db';
import { api } from '../api/db';
import { ImageUploader } from '../components/ImageUploader';
import { Modal } from '../components/Modal';
import { abiertoAhora, agruparPorSeccion, bs, SECCIONES_SUGERIDAS } from '../lib/image';
import type { Producto } from '../types';

type Draft = {
  id?: string;
  nombre: string;
  descripcion: string;
  seccion: string;
  precio: string;
  stock: string;
  foto_url: string;
  activo: boolean;
  en_promocion: boolean;
  precio_promocion: number | null;
};

type Filtro = 'todos' | 'promo' | 'ocultos' | 'sinstock';

const vacio: Draft = { nombre: '', descripcion: '', seccion: '', precio: '', stock: '1', foto_url: '', activo: true, en_promocion: false, precio_promocion: null };
const toDraft = (p: Producto): Draft => ({ ...p, seccion: p.seccion ?? '', precio: String(p.precio), stock: String(p.stock) });

export function MisProductos() {
  const { productos, negocio, secciones: propias } = useDb();
  const [nueva, setNueva] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const n = {
    todos: productos.length,
    promo: productos.filter((p) => p.en_promocion).length,
    ocultos: productos.filter((p) => !p.activo).length,
    sinstock: productos.filter((p) => p.stock === 0).length,
  };

  const lista = useMemo(
    () =>
      productos.filter((p) => {
        if (!p.nombre.toLowerCase().includes(q.toLowerCase())) return false;
        if (filtro === 'promo') return p.en_promocion;
        if (filtro === 'ocultos') return !p.activo;
        if (filtro === 'sinstock') return p.stock === 0;
        return true;
      }),
    [productos, q, filtro],
  );

  const seccionesUsadas = agruparPorSeccion(productos).map(([s]) => s).filter((s) => s !== 'General');
  const sugeridas = [...new Set([...propias, ...seccionesUsadas, ...SECCIONES_SUGERIDAS])];
  const enVenta = productos.filter((p) => p.activo && p.stock > 0).length;
  const disponibilidad = productos.length ? Math.round((enVenta / productos.length) * 100) : 0;
  const ubic = [negocio.piso && `Piso ${negocio.piso}`, negocio.local && `Local ${negocio.local}`].filter(Boolean).join(' · ');
  const abierto = negocio.activo && abiertoAhora(negocio.horario) !== false;
  const destacado = productos.find((p) => p.activo);

  function agregarSeccion() {
    const n = (nueva ?? '').trim();
    if (n) {
      api.addSeccion(n);
      setDraft((d) => d && { ...d, seccion: n });
    }
    setNueva(null);
  }

  function guardar(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const precio = Number(draft.precio);
    const stock = Number(draft.stock);
    if (!draft.nombre.trim()) return setError('Escribe el nombre del producto.');
    if (!draft.seccion.trim()) return setError('Elige o escribe la sección del menú (ej. Bebidas frías).');
    if (!(precio > 0)) return setError('El precio debe ser mayor a 0.');
    if (!Number.isInteger(stock) || stock < 0) return setError('El stock debe ser un número entero, 0 o más.');
    const promo = draft.en_promocion && draft.precio_promocion != null && draft.precio_promocion < precio;
    api.saveProducto({
      id: draft.id,
      nombre: draft.nombre.trim(),
      descripcion: draft.descripcion.trim(),
      seccion: draft.seccion.trim(),
      precio,
      stock,
      foto_url: draft.foto_url,
      activo: draft.activo,
      en_promocion: !!promo,
      precio_promocion: promo ? draft.precio_promocion : null,
    });
    setDraft(null);
  }

  const abrir = (d: Draft) => {
    setError('');
    setDraft(d);
  };

  const FILTROS: { key: Filtro; label: string; color?: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'promo', label: 'Con promo', color: 'var(--gold)' },
    { key: 'ocultos', label: 'Ocultos', color: '#9aa1b2' },
    { key: 'sinstock', label: 'Sin stock', color: 'var(--red)' },
  ];

  return (
    <>
      <div className="toolbar">
        <h2>
          Mis productos <span className="count">{productos.length}</span>
        </h2>
        <button className="btn primary" onClick={() => abrir(vacio)}>
          <Plus size={18} /> Nuevo producto
        </button>
      </div>
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto por nombre…" />
        </label>
        <div className="filters" style={{ marginLeft: 'auto' }}>
          {FILTROS.map((f) => (
            <button key={f.key} className={filtro === f.key ? 'on' : ''} onClick={() => setFiltro(f.key)}>
              {f.color && <i className="dotc" style={{ background: f.color }} />}
              {f.label} ({n[f.key]})
            </button>
          ))}
        </div>
      </div>

      <div className="layout">
        <div>
          {productos.length === 0 ? (
            <div className="empty">
              <Package size={44} />
              <h3>Aún no tienes productos</h3>
              <p>Sube tu primer producto con foto y precio para que los clientes lo vean en la app.</p>
              <button className="btn primary" onClick={() => abrir(vacio)}>
                <Plus size={18} /> Subir mi primer producto
              </button>
            </div>
          ) : lista.length === 0 ? (
            <div className="empty small">
              <p>No hay productos con ese filtro o búsqueda.</p>
            </div>
          ) : (
            agruparPorSeccion(lista).map(([seccion, items]) => (
            <section key={seccion} className="menu-sec">
              <h3 className="sec-title">
                {seccion} <span className="count">{items.length}</span>
              </h3>
            <div className="grid">
              {items.map((p) => (
                <article key={p.id} className={`pcard ${p.en_promocion ? 'promo' : ''} ${p.activo ? '' : 'off'}`}>
                  <div className="pimg">
                    {p.foto_url ? <img src={p.foto_url} alt="" /> : <Package size={36} />}
                    {p.en_promocion && p.precio_promocion != null ? (
                      <span className="tag">
                        <Tag size={11} /> Promo -{Math.round((1 - p.precio_promocion / p.precio) * 100)}%
                      </span>
                    ) : !p.activo ? (
                      <span className="tag gray">Oculto para clientes</span>
                    ) : null}
                    {p.stock === 0 && <span className="tag red">Agotado</span>}
                  </div>
                  <div className="pbody">
                    <h4>{p.nombre}</h4>
                    <p className="price">
                      {p.en_promocion && p.precio_promocion != null ? (
                        <>
                          <b>{bs(p.precio_promocion)}</b>
                          <s>{bs(p.precio)}</s>
                        </>
                      ) : (
                        <b>{bs(p.precio)}</b>
                      )}
                    </p>
                  </div>
                  <div className="pfoot">
                    <span className={`pill ${p.stock === 0 ? 'zero' : ''}`}>{p.stock === 0 ? 'Sin stock (0 disp.)' : `${p.stock} disponibles`}</span>
                    <button className="btn small" onClick={() => abrir(toDraft(p))}>
                      <Pencil size={13} /> Editar
                    </button>
                    <button
                      className="icon-btn danger"
                      aria-label={`Eliminar ${p.nombre}`}
                      onClick={() => confirm(`¿Eliminar “${p.nombre}”?`) && api.deleteProducto(p.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            </section>
            ))
          )}
        </div>

        <aside className="side">
          <section className="panel">
            <div className="panel-head">
              <h3>Estado del catálogo</h3>
              <span className="badge-gold">Paseo Aranjuez</span>
            </div>
            <div className="stat-row">
              <div>
                <big>{disponibilidad}%</big>
                <small>Disponibilidad en vitrina</small>
              </div>
              <div className="ring" style={{ ['--p' as string]: disponibilidad }}>
                <span>
                  <Store size={18} />
                </span>
              </div>
            </div>
            <div className="stats2">
              <div>
                <b>{enVenta}</b>
                <small>En venta activa</small>
              </div>
              <div>
                <b>{n.promo}</b>
                <small>Con descuento</small>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Así te verá el cliente</h3>
              <span className="badge-gold" style={{ background: 'var(--soft)', color: 'var(--muted)' }}>En vivo</span>
            </div>
            <div className="mini">
              <div className="mini-head">
                <span>{negocio.nombre} · App Clientes</span>
                <i>PaseoYa</i>
              </div>
              <div className="mini-row">
                <div className="avatar" style={{ width: 36, height: 36 }}>
                  {negocio.logo_url ? <img src={negocio.logo_url} alt="" /> : (negocio.nombre[0] ?? '?').toUpperCase()}
                </div>
                <div>
                  <b>{negocio.nombre}</b>
                  <small>
                    {ubic} · {abierto ? 'Abierto' : 'Cerrado'}
                  </small>
                </div>
              </div>
              {destacado && (
                <div className="mini-row">
                  {destacado.foto_url && <img src={destacado.foto_url} alt="" />}
                  <div style={{ flex: 1 }}>
                    <b>{destacado.nombre}</b>
                    <small>
                      {bs(destacado.en_promocion && destacado.precio_promocion != null ? destacado.precio_promocion : destacado.precio)}
                    </small>
                  </div>
                </div>
              )}
            </div>
            <p className="note">Los cambios de stock y precio se reflejan al instante en los teléfonos de los visitantes.</p>
          </section>

          <section className="panel cta">
            <div className="ico">
              <Utensils size={20} />
            </div>
            <h3>¿Tienes un producto nuevo que no figura aquí?</h3>
            <p>Crea tu artículo en menos de un minuto con fotos apetitosas y precios actualizados.</p>
            <button className="btn small" style={{ width: '100%' }} onClick={() => abrir(vacio)}>
              <Plus size={14} /> Subir mi primer producto
            </button>
          </section>
        </aside>
      </div>

      {draft && (
        <Modal title={draft.id ? 'Editar producto' : 'Nuevo producto'} onClose={() => setDraft(null)}>
          <form onSubmit={guardar} className="form">
            <ImageUploader label="Foto del producto" value={draft.foto_url ? [draft.foto_url] : []} onChange={(u) => setDraft({ ...draft, foto_url: u[0] ?? '' })} />
            <label className="field">
              <span className="label">Nombre *</span>
              <input autoFocus value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Ej. Brownie con helado" />
            </label>
            <div className="field">
              <span className="label">Sección del menú *</span>
              <input list="secciones" value={draft.seccion} onChange={(e) => setDraft({ ...draft, seccion: e.target.value })} placeholder="Ej. Tecitos, Repostería dulce, Platos de fondo" />
              <datalist id="secciones">
                {sugeridas.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {sugeridas.map((s) => (
                  <button type="button" key={s} className={`chip ${draft.seccion === s ? 'on' : ''}`} onClick={() => setDraft({ ...draft, seccion: s })}>
                    {s}
                  </button>
                ))}
                {nueva === null ? (
                  <button type="button" className="chip add" onClick={() => setNueva('')} aria-label="Agregar nueva sección">
                    + Nueva sección
                  </button>
                ) : (
                  <span className="chip-new">
                    <input
                      autoFocus
                      value={nueva}
                      maxLength={40}
                      placeholder="Ej. Tecitos"
                      onChange={(e) => setNueva(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          agregarSeccion();
                        } else if (e.key === 'Escape') {
                          e.stopPropagation();
                          setNueva(null);
                        }
                      }}
                    />
                    <button type="button" className="chip on" onClick={agregarSeccion}>
                      Agregar
                    </button>
                  </span>
                )}
              </div>
              <span className="hint">Así se ordena tu menú para el cliente, como en una carta impresa.</span>
            </div>
            <label className="field">
              <span className="label">Descripción</span>
              <textarea rows={2} value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} />
            </label>
            <div className="row3">
              <label className="field">
                <span className="label">Precio (Bs) *</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.precio} onChange={(e) => setDraft({ ...draft, precio: e.target.value })} />
              </label>
              <label className="field">
                <span className="label">Stock</span>
                <input type="number" min="0" step="1" inputMode="numeric" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} />
              </label>
            </div>
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
                Guardar producto
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
