import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Layers, MapPin, Package, Tag } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIAS, useDb } from '../api/db';
import { DEMO, type Entrada } from '../api/demo';
import { ClientePreview } from '../components/ClientePreview';
import { abiertoAhora, agruparPorSeccion, bs } from '../lib/image';
import type { Combo, Producto } from '../types';
import { incluye, sumaNormal } from './MisCombos';

type Vista = 'menu' | 'promos' | 'combos';

const productosVisibles = (e: Entrada) => e.productos.filter((p) => p.activo && p.stock > 0);
const combosVisibles = (e: Entrada) => e.combos.filter((c) => c.activo);

function ProductoCliente({ p }: { p: Producto }) {
  const promo = p.en_promocion && p.precio_promocion != null;
  return (
    <article className={`pcard ${promo ? 'promo' : ''}`}>
      <div className="pimg">
        {p.foto_url ? <img src={p.foto_url} alt="" /> : <Package size={36} />}
        {promo && (
          <span className="tag">
            <Tag size={11} /> -{Math.round((1 - (p.precio_promocion as number) / p.precio) * 100)}%
          </span>
        )}
      </div>
      <div className="pbody">
        <h4>{p.nombre}</h4>
        <p className="price">
          {promo ? (
            <>
              <b>{bs(p.precio_promocion as number)}</b>
              <s>{bs(p.precio)}</s>
            </>
          ) : (
            <b>{bs(p.precio)}</b>
          )}
        </p>
      </div>
    </article>
  );
}

function ComboCliente({ c, productos }: { c: Combo; productos: Producto[] }) {
  const normal = sumaNormal(c, productos);
  return (
    <article className="pcard promo">
      <div className="pimg">
        {c.foto_url ? <img src={c.foto_url} alt="" /> : <Layers size={36} />}
        <span className="tag">Combo</span>
        {normal > c.precio && <span className="tag red">Ahorras {bs(normal - c.precio)}</span>}
      </div>
      <div className="pbody">
        <h4>{c.nombre}</h4>
        <p className="hint">{incluye(c, productos)}</p>
        <p className="price">
          <b>{bs(c.precio)}</b>
          {normal > c.precio && <s>{bs(normal)}</s>}
        </p>
      </div>
    </article>
  );
}

function Portada({ e, vista0, onBack }: { e: Entrada; vista0: Vista; onBack: () => void }) {
  const [vista, setVista] = useState<Vista>(vista0);
  const productos = productosVisibles(e);
  const promos = productos.filter((p) => p.en_promocion);
  const combos = combosVisibles(e);
  const secciones = agruparPorSeccion(productos);

  const vacio = { menu: 'Este negocio aún no tiene productos publicados.', promos: 'Este negocio no tiene promociones activas.', combos: 'Este negocio no tiene combos.' }[vista];
  const hay = vista === 'menu' ? productos.length : vista === 'promos' ? promos.length : combos.length;

  return (
    <>
      <button className="btn small" onClick={onBack} style={{ marginBottom: 16 }}>
        <ArrowLeft size={16} /> Volver al directorio
      </button>
      <div className="layout">
        <div>
          <div className="toolbar">
            <h2>{e.negocio.nombre}</h2>
            {e.mio && <span className="badge-gold">Tu tienda</span>}
          </div>
          <div className="filters" style={{ marginBottom: 16 }}>
            <button className={vista === 'menu' ? 'on' : ''} onClick={() => setVista('menu')}>
              Menú ({productos.length})
            </button>
            <button className={vista === 'promos' ? 'on' : ''} onClick={() => setVista('promos')}>
              <i className="dotc" style={{ background: 'var(--gold)' }} />
              Promos ({promos.length})
            </button>
            <button className={vista === 'combos' ? 'on' : ''} onClick={() => setVista('combos')}>
              Combos ({combos.length})
            </button>
          </div>
          {!hay ? (
            <div className="empty small">
              <p>{vacio}</p>
            </div>
          ) : vista === 'menu' ? (
            <>
              {secciones.length > 1 && (
                <div className="chips menu-index" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
                  {secciones.map(([s, items]) => (
                    <button key={s} type="button" className="chip" onClick={() => document.getElementById(`sec-${e.negocio.id}-${s}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                      {s} ({items.length})
                    </button>
                  ))}
                </div>
              )}
              {secciones.map(([s, items]) => (
                <section key={s} className="menu-sec" id={`sec-${e.negocio.id}-${s}`}>
                  <h3 className="sec-title">{s}</h3>
                  <div className="grid">
                    {items.map((p) => (
                      <ProductoCliente key={p.id} p={p} />
                    ))}
                  </div>
                </section>
              ))}
            </>
          ) : (
            <div className="grid">
              {vista === 'promos' && promos.map((p) => <ProductoCliente key={p.id} p={p} />)}
              {vista === 'combos' && combos.map((c) => <ComboCliente key={c.id} c={c} productos={e.productos} />)}
            </div>
          )}
        </div>
        <aside className="side">
          <ClientePreview n={e.negocio} />
        </aside>
      </div>
    </>
  );
}

type Slide = { key: string; negocioId: string; vista: Vista; tipo: string; titulo: string; tienda: string; img: string; precio: number; antes?: number };

/** Carrusel que rota solo con todas las promos y combos del Paseo. */
function CarruselPromos({ slides, onOpen, onVerTiendas }: { slides: Slide[]; onOpen: (s: Slide) => void; onVerTiendas: () => void }) {
  const pista = useRef<HTMLDivElement>(null);
  const pausa = useRef(false);

  const mover = (dir: 1 | -1) => {
    const el = pista.current;
    if (!el) return;
    const paso = (el.querySelector('.slide') as HTMLElement | null)?.offsetWidth ?? 280;
    const fin = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    if (dir === 1 && fin) el.scrollTo({ left: 0, behavior: 'smooth' });
    else if (dir === -1 && el.scrollLeft <= 4) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    else el.scrollBy({ left: dir * (paso + 16), behavior: 'smooth' });
  };

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => !pausa.current && mover(1), 3200);
    return () => clearInterval(t);
  }, []);

  if (!slides.length) return null;

  return (
    <section className="promo-rail" aria-label="Promociones del Paseo">
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <h2>
          Promociones del Paseo <span className="count">{slides.length}</span>
        </h2>
      </div>
      <div
        className="rail"
        ref={pista}
        onMouseEnter={() => (pausa.current = true)}
        onMouseLeave={() => (pausa.current = false)}
        onFocus={() => (pausa.current = true)}
        onBlur={() => (pausa.current = false)}>
        {slides.map((s) => (
          <button key={s.key} className="slide" onClick={() => onOpen(s)} aria-label={`${s.titulo}, ${s.tienda}`}>
            <img src={s.img} alt="" />
            <span className="slide-shade" />
            <span className="slide-tag">{s.tipo}</span>
            <span className="slide-body">
              <strong>{s.titulo}</strong>
              <em>{s.tienda}</em>
              <span className="slide-price">
                {bs(s.precio)} {s.antes != null && <s>{bs(s.antes)}</s>}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="rail-foot">
        <button className="btn gold" onClick={onVerTiendas}>
          Navega por nuestras tiendas
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" aria-label="Anterior" onClick={() => mover(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button className="icon-btn" aria-label="Siguiente" onClick={() => mover(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

export function Presentacion() {
  const { negocio, productos, combos } = useDb();
  const [sel, setSel] = useState<{ id: string; vista: Vista } | null>(null);
  const [cat, setCat] = useState('todas');
  const directorio = useRef<HTMLDivElement>(null);

  const entradas = useMemo<Entrada[]>(() => [{ negocio, productos, combos, mio: true }, ...DEMO], [negocio, productos, combos]);
  const actual = entradas.find((e) => e.negocio.id === sel?.id);

  const slides = useMemo<Slide[]>(
    () =>
      entradas.flatMap((e) => [
        ...productosVisibles(e)
          .filter((p) => p.en_promocion && p.precio_promocion != null)
          .map<Slide>((p) => ({ key: p.id, negocioId: e.negocio.id, vista: 'promos', tipo: `-${Math.round((1 - (p.precio_promocion as number) / p.precio) * 100)}%`, titulo: p.nombre, tienda: e.negocio.nombre, img: p.foto_url || e.negocio.fotos_local[0] || '', precio: p.precio_promocion as number, antes: p.precio })),
        ...combosVisibles(e).map<Slide>((c) => {
          const n = sumaNormal(c, e.productos);
          return { key: c.id, negocioId: e.negocio.id, vista: 'combos', tipo: 'COMBO', titulo: c.nombre, tienda: e.negocio.nombre, img: c.foto_url || e.negocio.fotos_local[0] || '', precio: c.precio, antes: n > c.precio ? n : undefined };
        }),
      ]),
    [entradas],
  );

  if (actual && sel) return <Portada key={sel.id + sel.vista} e={actual} vista0={sel.vista} onBack={() => setSel(null)} />;

  const lista = entradas.filter((e) => cat === 'todas' || e.negocio.categoria_id === cat);

  return (
    <>
      <div className="pagehead" ref={directorio}>
        <p className="crumb">Vista del cliente</p>
        <h2>Presentación del Paseo</h2>
        <p>Así se publican los negocios en la app. Entra a cada tienda para ver su portada, su menú, sus promos y sus combos.</p>
      </div>
      <div className="filters" style={{ marginBottom: 18 }}>
        <button className={cat === 'todas' ? 'on' : ''} onClick={() => setCat('todas')}>
          Todas ({entradas.length})
        </button>
        {CATEGORIAS.map((c) => (
          <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
            {c.nombre} ({entradas.filter((e) => e.negocio.categoria_id === c.id).length})
          </button>
        ))}
      </div>
      <div className="grid">
        {lista.map((e) => {
          const n = e.negocio;
          const abierto = n.activo && abiertoAhora(n.horario) !== false;
          return (
            <button key={n.id} className="dcard" onClick={() => setSel({ id: n.id, vista: 'menu' })}>
              <div className="dcover">
                {n.fotos_local[0] ? <img src={n.fotos_local[0]} alt="" /> : <span>{(n.nombre[0] ?? '?').toUpperCase()}</span>}
                {e.mio && <span className="tag">Tu tienda</span>}
              </div>
              <div className="dbody">
                <h4>{n.nombre}</h4>
                <p>
                  <MapPin size={13} /> {[n.piso && `Piso ${n.piso}`, n.local && `Local ${n.local}`].filter(Boolean).join(' - ')}
                </p>
                <p>
                  <Clock size={13} /> {n.horario} <i className="dotc" style={{ background: abierto ? 'var(--green)' : '#9aa1b2' }} />
                </p>
                <div className="dmeta">
                  <span>{productosVisibles(e).length} en el menú</span>
                  <span className="badge-gold">
                    {productosVisibles(e).filter((p) => p.en_promocion).length} promos · {combosVisibles(e).length} combos
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <CarruselPromos slides={slides} onOpen={(s) => setSel({ id: s.negocioId, vista: s.vista })} onVerTiendas={() => directorio.current?.scrollIntoView({ behavior: 'smooth' })} />

      <p className="note" style={{ marginTop: 20 }}>
        Los demás comercios son datos de ejemplo hasta conectar el backend.
      </p>
    </>
  );
}
