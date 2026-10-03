import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import './Points.css';

async function listado(path) {
  const rows = [];
  let pagina = 1;
  while (true) {
    const data = await api(`${path}?page=${pagina}`);
    rows.push(...(data.results || data));
    if (!data.next) return rows;
    pagina++;
  }
}

export default function Points() {
  const { user, salir } = useAuth();
  const admin = user.rol === 'ADMIN';
  const cliente = user.rol === 'CLIENTE';
  const [recompensas, setRecompensas] = useState([]);
  const [cupones, setCupones] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [saldo, setSaldo] = useState(0);
  const [estado, setEstado] = useState('Cargando…');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [seleccion, setSeleccion] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [consulta, setConsulta] = useState(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', costo_puntos: 100, negocio_id: '', activo: false });
  const [negocios, setNegocios] = useState([]);

  async function cargar() {
    const r = await listado('/recompensas/');
    setRecompensas(r);
    if (cliente) {
      const [yo, c, m] = await Promise.all([api('/auth/yo/'), listado('/cupones/'), listado('/puntos/movimientos/')]);
      setSaldo(yo.puntos_saldo); setCupones(c); setMovimientos(m);
    }
    if (admin) setNegocios(await listado('/admin/empresas/'));
    setEstado('');
  }
  useEffect(() => { cargar().catch(e => { setEstado(''); setError(e.message); }); }, [user.id]);

  async function accion(fn) {
    setOcupado(true); setError(''); setEstado('');
    try { await fn(); } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  }
  async function canjear() {
    const r = seleccion;
    const key = `points:${user.id}:${r.id}`;
    let id = localStorage.getItem(key);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
    const cupon = await api(`/recompensas/${r.id}/canjear/`, { method: 'POST', body: { clave_operacion: id } });
    localStorage.removeItem(key);
    setSeleccion(null);
    await cargar();
    setEstado(`Cupón generado: ${cupon.nombre}. Muéstralo en ${cupon.negocio_nombre}.`);
  }
  return <div className="points">
    <header className="points-header"><div><span className="points-eyebrow">PASEO ARANJUEZ · RETO 1</span><h1>Paseo Points</h1><p>{cliente ? 'Tu próxima visita tiene una recompensa.' : admin ? 'Beneficios claros, negocios responsables.' : 'Entrega beneficios con una sola validación.'}</p></div>{!admin && <button className="btn" onClick={salir}>Cerrar sesión</button>}</header>
    {error && <p role="alert" className="points-error">{error}</p>}
    {estado && <p role="status" className="points-status">{estado}</p>}
    <button className="btn" disabled={ocupado} onClick={() => accion(cargar)}>Actualizar</button>
    {cliente && <>
      <section className="points-balance"><span>Tu saldo disponible</span><strong>{saldo.toLocaleString('es-BO')} <small>puntos</small></strong><p>Los puntos se acreditan cuando el comercio confirma tu compra o entrega tu pedido.</p></section>
      <h2>Elige tu próximo beneficio</h2><div className="points-grid">{recompensas.map(r => <article className="points-card" key={r.id}><span className="points-eyebrow">{r.negocio_nombre}</span><h3>{r.nombre}</h3><p>{r.descripcion}</p><strong>{r.costo_puntos} puntos</strong><button className="btn primary" disabled={ocupado || saldo < r.costo_puntos} onClick={() => setSeleccion(r)}>{saldo < r.costo_puntos ? `Te faltan ${r.costo_puntos - saldo} puntos` : 'Elegir beneficio'}</button></article>)}</div>{!recompensas.length && <p>Aún no hay beneficios disponibles.</p>}
      {seleccion && <section className="points-confirm" aria-label="Confirmar canje"><h2>¿Canjear {seleccion.nombre}?</h2><p>Se descontarán {seleccion.costo_puntos} puntos ahora. El cupón se utiliza una sola vez en {seleccion.negocio_nombre}. Revisa las condiciones antes de confirmar.</p><p>{seleccion.descripcion}</p><button className="btn primary" disabled={ocupado} onClick={() => accion(canjear)}>Confirmar canje</button> <button className="btn" disabled={ocupado} onClick={() => setSeleccion(null)}>Volver</button></section>}
      <h2>Mis cupones</h2><div className="points-grid">{cupones.map(c => <article className="points-card" key={c.id}><span className="points-pill">{c.estado === 'activo' ? 'Disponible' : 'Utilizado'}</span><h3>{c.nombre}</h3><p>{c.negocio_nombre} · {c.costo_puntos} puntos</p><p>{c.descripcion}</p>{c.estado === 'activo' && <><p>Muestra este código al personal del negocio:</p><code className="points-code">{c.codigo}</code><small>El código permite usar tu beneficio. Compártelo únicamente en caja.</small></>}</article>)}</div>{!cupones.length && <p>Tus beneficios canjeados aparecerán aquí.</p>}
      <h2>Actividad</h2><ul className="points-history">{movimientos.map(m => <li key={m.id}><div>{m.descripcion}<small>{new Date(m.creado_en).toLocaleString('es-BO')}</small></div><strong>{m.puntos > 0 ? '+' : ''}{m.puntos}</strong></li>)}</ul>{!movimientos.length && <p>Todavía no tienes movimientos.</p>}
    </>}
    {!cliente && !admin && <section className="points-card"><h2>Validar un beneficio</h2><p>Consulta el cupón del visitante. Confirma la entrega solo después de comprobar el beneficio.</p><form onSubmit={e => { e.preventDefault(); accion(async () => { setConsulta(null); setConsulta(await api('/cupones/consultar/', { method: 'POST', body: { codigo: codigo.trim() } })); }); }}><label>Código del cupón<input required pattern="[a-fA-F0-9]{24}" maxLength={24} value={codigo} onChange={e => { setCodigo(e.target.value); setConsulta(null); }} autoComplete="off" /></label><button className="btn primary" disabled={ocupado}>Consultar cupón</button></form>{consulta && <div className="points-confirm"><h3>{consulta.nombre}</h3><p>{consulta.descripcion}</p><p>Estado: {consulta.estado}</p>{consulta.estado === 'activo' && <button className="btn primary" disabled={ocupado} onClick={() => accion(async () => { const c = await api('/cupones/validar/', { method: 'POST', body: { codigo: consulta.codigo } }); setConsulta(c); setEstado('Entrega registrada. Este cupón ya no puede utilizarse.'); })}>Confirmar entrega del beneficio</button>}</div>}</section>}
    {admin && <>
      <section className="points-card"><h2>Crear beneficio</h2><p>Empieza como borrador. Actívalo cuando el negocio confirme qué entregará y bajo qué condiciones.</p><form className="points-form" onSubmit={e => { e.preventDefault(); accion(async () => { await api('/recompensas/', { method: 'POST', body: { ...form, negocio_id: Number(form.negocio_id), costo_puntos: Number(form.costo_puntos) } }); setForm({ nombre: '', descripcion: '', costo_puntos: 100, negocio_id: '', activo: false }); await cargar(); setEstado('Beneficio guardado como borrador.'); }); }}><label>Nombre<input required maxLength={120} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label><label>Negocio responsable<select required value={form.negocio_id} onChange={e => setForm({ ...form, negocio_id: e.target.value })}><option value="">Seleccionar negocio</option>{negocios.filter(n => n.activo && n.tipo !== 'OFICINA').map(n => <option key={n.id} value={n.id}>{n.nombre}</option>)}</select></label><label>Costo en puntos<input type="number" min={1} max={1000000} required value={form.costo_puntos} onChange={e => setForm({ ...form, costo_puntos: e.target.value })} /></label><label>Beneficio y condiciones<textarea required value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Qué recibe el visitante, dónde y restricciones acordadas." /></label><button className="btn primary" disabled={ocupado}>Guardar borrador</button></form></section>
      <h2>Beneficios del programa</h2><div className="points-grid">{recompensas.map(r => <article className="points-card" key={r.id}><span className="points-pill">{r.activo ? 'Activo' : 'Borrador / pausado'}</span><h3>{r.nombre}</h3><p>{r.negocio_nombre} · {r.costo_puntos} puntos</p><p>{r.descripcion}</p><button className="btn" disabled={ocupado} onClick={() => accion(async () => { await api(`/recompensas/${r.id}/`, { method: 'PATCH', body: { activo: !r.activo } }); await cargar(); })}>{r.activo ? 'Pausar beneficio' : 'Activar beneficio acordado'}</button></article>)}</div>
    </>}
  </div>;
}
