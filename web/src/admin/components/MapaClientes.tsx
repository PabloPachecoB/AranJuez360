import { useState } from 'react';
import { Estado, useApi } from './ui';
import { num } from '../format';
import geometria from '../data/cochabamba.json';
import './mapa-clientes.css';

type Metricas = { clientes: number; clientes_con_compras: number; compras: number; monto: number | string; visitas: number; puntos_saldo: number | string; puntos_ganados: number | string; compradores_recurrentes: number; dias_entre_compras: number | null; compras_por_comprador: number };
type Zona = Metricas & { clave: string; nombre: string; edad_promedio: number | null; consumo_por_comprador: number | string; por_edad: (Metricas & { nombre: string })[]; por_ocupacion: (Metricas & { nombre: string })[] };
type Datos = { provincias: Zona[]; ciudades: Zona[]; sin_procedencia: Zona };
type Medida = 'clientes' | 'monto' | 'consumo_por_comprador';
const MEDIDAS: { clave: Medida; nombre: string }[] = [
  { clave: 'clientes', nombre: 'Más clientes' },
  { clave: 'monto', nombre: 'Mayor consumo' },
  { clave: 'consumo_por_comprador', nombre: 'Gasto por comprador' },
];
const COLORES = ['#e5ebed', '#d3ece9', '#91cfc5', '#48aa9b', '#217d71', '#105347'];
const dinero = (n: unknown) => `Bs ${Number(n).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const valor = (n: unknown, medida: Medida) => medida === 'clientes' ? num(n) : dinero(n);

function IconoPersonas() {
  return <svg className="geo-icono-personas" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="10" r="4"/><path d="M4 26v-3a8 8 0 0 1 16 0v3M22 6a4 4 0 0 1 0 8m2 4a7 7 0 0 1 4 6v2" strokeLinecap="round"/></svg>;
}
function frecuencia(zona: Zona) {
  return zona.dias_entre_compras === null ? 'Sin compras repetidas' : zona.dias_entre_compras < 1 ? 'Menos de 1 día entre compras' : `${num(zona.dias_entre_compras)} días entre compras`;
}
function FichaMapa({ zona, cerrar }: { zona: Zona; cerrar: () => void }) {
  const ocupaciones = zona.por_ocupacion.filter(o => o.nombre !== 'Sin dato');
  const principales = ocupaciones.filter(o => o.clientes === ocupaciones[0]?.clientes);
  return <aside className="geo-ficha-mapa" aria-label={`Resumen de ${zona.nombre}`}>
    <button type="button" className="geo-cerrar-ficha" onClick={cerrar} aria-label="Cerrar ficha de provincia">×</button>
    <span className="geo-kicker">PROVINCIA SELECCIONADA</span><h4>{zona.nombre}</h4>
    <div className="geo-personas"><IconoPersonas/><div><strong>{num(zona.clientes)}</strong><span>clientes registrados</span></div></div>
    <dl><div><dt>Edad promedio</dt><dd>{zona.edad_promedio === null ? 'Sin dato' : `${num(zona.edad_promedio)} años`}</dd></div>
      <div><dt>Ocupación más frecuente</dt><dd>{principales.length ? principales.map(o => `${o.nombre} (${num(o.clientes)})`).join(' · ') : 'Sin dato'}</dd></div>
      <div><dt>Frecuencia media de quienes repiten</dt><dd>{frecuencia(zona)}</dd></div>
      <div><dt>Puntos disponibles</dt><dd>{num(zona.puntos_saldo)}</dd></div>
      <div><dt>Puntos ganados en el periodo</dt><dd>{num(zona.puntos_ganados)}</dd></div></dl>
    <small>Desglose completo debajo del mapa.</small>
  </aside>;
}

function Detalle({ zona }: { zona: Zona }) {
  const consumidor = [...zona.por_edad].filter(e => e.nombre !== 'Sin dato' && Number(e.monto) > 0)
    .sort((a,b) => Number(b.monto) - Number(a.monto))[0];
  return <div className="geo-detalle">
    <dl className="geo-cifras">
      <div><dt>Clientes registrados</dt><dd className="geo-personas-cifra"><IconoPersonas/>{num(zona.clientes)}</dd></div>
      <div><dt>Consumo registrado</dt><dd>{dinero(zona.monto)}</dd></div>
      <div><dt>Compradores</dt><dd>{num(zona.clientes_con_compras)}</dd></div>
      <div><dt>Compras aprobadas</dt><dd>{num(zona.compras)}</dd></div>
      <div><dt>Gasto por comprador</dt><dd>{dinero(zona.consumo_por_comprador)}</dd></div>
      <div><dt>Visitas</dt><dd>{num(zona.visitas)}</dd></div>
      <div><dt>Puntos disponibles hoy</dt><dd>{num(zona.puntos_saldo)}</dd></div>
      <div><dt>Puntos ganados en el periodo</dt><dd>{num(zona.puntos_ganados)}</dd></div>
      <div><dt>Compras por comprador</dt><dd>{num(zona.compras_por_comprador)}</dd></div>
    </dl>
    <p className="geo-nota"><strong>{num(zona.compradores_recurrentes)} compradores recurrentes</strong> (2 o más compras aprobadas en el periodo). {frecuencia(zona)}{zona.dias_entre_compras !== null ? ', promedio entre quienes repiten' : ''}.</p>
    <p className="geo-nota">Edad promedio: {zona.edad_promedio === null ? 'sin datos' : `${num(zona.edad_promedio)} años`}.</p>
    {consumidor && <p className="geo-nota">Mayor consumo conocido: <strong>{consumidor.nombre} años</strong> · {dinero(consumidor.monto)}{zona.por_edad.filter(e => e.nombre !== 'Sin dato' && Number(e.monto) === Number(consumidor.monto)).length > 1 ? ' (empate)' : ''}.</p>}
    {zona.clientes > 0 ? <div className="geo-tabla-scroll"><table className="geo-edades">
      <caption>Edades de los clientes y su consumo</caption>
      <thead><tr><th>Edad</th><th>Clientes</th><th>Compradores</th><th>Consumo</th><th>Puntos disponibles</th></tr></thead>
      <tbody>{zona.por_edad.map(e => <tr key={e.nombre}><th scope="row">{e.nombre}</th><td>{num(e.clientes)}</td><td>{num(e.clientes_con_compras)}</td><td>{dinero(e.monto)}</td><td>{num(e.puntos_saldo)}</td></tr>)}</tbody>
    </table></div> : <p className="geo-nota">Todavía no hay clientes registrados de esta provincia.</p>}
    {zona.clientes > 0 && <div className="geo-tabla-scroll"><table className="geo-edades geo-ocupaciones"><caption>Ocupación declarada en la app</caption><thead><tr><th>Ocupación</th><th>Clientes</th><th>Compras</th><th>Consumo</th><th>Puntos disponibles</th></tr></thead><tbody>{zona.por_ocupacion.map(o => <tr key={o.nombre}><th scope="row">{o.nombre}</th><td>{num(o.clientes)}</td><td>{num(o.compras)}</td><td>{dinero(o.monto)}</td><td>{num(o.puntos_saldo)}</td></tr>)}</tbody></table></div>}
  </div>;
}

export default function MapaClientes({ query }: { query: string }) {
  const datos = useApi<Datos>(`/admin/reportes/clientes/mapa/${query}`);
  const [medida, setMedida] = useState<Medida>('clientes');
  const [seleccion, setSeleccion] = useState('CERCADO');
  const [buscar, setBuscar] = useState('');
  const [zoom, setZoom] = useState(1);
  const [foco, setFoco] = useState<string | null>(null);
  const [mostrarFicha, setMostrarFicha] = useState(false);
  function elegir(codigo: string) { setSeleccion(codigo); setMostrarFicha(true); }
  const provincias = datos.data?.provincias || [];
  const zona = provincias.find(p => p.clave === seleccion);
  const resaltada = provincias.find(p => p.clave === foco);
  const maximo = Math.max(0, ...provincias.map(p => Number(p[medida])));
  const ciudades = [...(datos.data?.ciudades || [])].filter(c => c.nombre.toLocaleLowerCase().includes(buscar.toLocaleLowerCase()))
    .sort((a,b) => Number(b[medida]) - Number(a[medida]) || a.nombre.localeCompare(b.nombre));
  const nivel = (n: number) => n === 0 || maximo === 0 ? 0 : Math.max(1, Math.ceil(n / maximo * 5));
  const total = provincias.reduce((n,p) => n + p.clientes, 0);
  return <section className="geo-clientes mb-space-md rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-space-md" aria-label="Mapa de procedencia de clientes">
    <header className="geo-cabecera"><div><span className="geo-kicker">AUDIENCIA DEL PASEO</span><h2 className="font-headline-sm text-headline-sm">De dónde vienen tus clientes</h2><p className="geo-nota">Procedencia declarada en la app. Clientes: total registrado actual. Consumo y visitas: periodo seleccionado.</p></div>
      <div className="geo-medidas" role="group" aria-label="Medida del mapa">{MEDIDAS.map(m => <button key={m.clave} type="button" aria-pressed={medida === m.clave} onClick={() => setMedida(m.clave)}>{m.nombre}</button>)}</div>
    </header>
    <Estado cargando={datos.cargando} error={datos.error}>
      <div className="geo-layout">
        <div className="geo-local">
          <div className="geo-titulo"><div><h3>Cochabamba</h3><p className="geo-nota">{num(total)} clientes · 16 provincias</p></div><div className="geo-zoom"><button type="button" disabled={zoom <= 1} onClick={() => setZoom(z => Math.max(1,z - .5))} aria-label="Alejar mapa">−</button><button type="button" disabled={zoom >= 3} onClick={() => setZoom(z => Math.min(3,z + .5))} aria-label="Acercar mapa">+</button></div></div>
          <div className="geo-mapa-con-ficha"><div className="geo-mapa-scroll">
            <svg className="geo-mapa" viewBox="0 0 800 540" style={{ width: `${zoom * 100}%` }} role="group" aria-label="Mapa de intensidad por provincia de Cochabamba">
              <text x="745" y="35" className="geo-norte">N ↑</text>
              {geometria.map(g => {
                const p = provincias.find(r => r.clave === g.codigo);
                if (!p) return null;
                return <path key={g.codigo} d={g.path} fillRule="evenodd" fill={COLORES[nivel(Number(p[medida]))]}
                  className={seleccion === g.codigo ? 'seleccionada' : ''} role="button" tabIndex={0} aria-pressed={seleccion === g.codigo}
                  aria-label={`${p.nombre}: ${valor(p[medida], medida)}`} onClick={() => elegir(g.codigo)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(g.codigo); } }}
                  onMouseEnter={() => setFoco(g.codigo)} onMouseLeave={() => setFoco(null)} onFocus={() => setFoco(g.codigo)} onBlur={() => setFoco(null)}>
                  <title>{p.nombre}: {valor(p[medida], medida)}</title>
                </path>;
              })}
            </svg>
          </div>{mostrarFicha && zona && <FichaMapa zona={zona} cerrar={() => setMostrarFicha(false)}/>}</div>
          <p className="geo-hover" aria-live="polite">{resaltada ? `${resaltada.nombre} · ${valor(resaltada[medida], medida)}` : 'Selecciona una provincia para ver sus clientes, consumo y edades.'}</p>
          <div className="geo-leyenda"><span><i style={{ background: COLORES[0] }}/>Sin actividad / clientes</span>{COLORES.slice(1).map((color,i) => <span key={color}><i style={{ background: color }}/>{(i+1)*20}%</span>)}<small>Intensidad respecto al máximo: {valor(maximo, medida)}</small></div>
          {maximo === 0 && <p className="geo-nota">No hay datos para esta medida en Cochabamba.</p>}
          <p className="geo-fuente">Por provincia; no representa domicilios ni ubicación en vivo. Límites de referencia: <a href="https://www.geoboundaries.org/api/current/gbOpen/BOL/ADM2/" target="_blank" rel="noreferrer">GeoBolivia / geoBoundaries (2015)</a>.</p>
          <label className="geo-selector">Provincia<select value={seleccion} onChange={e => elegir(e.target.value)}>{provincias.map(p => <option key={p.clave} value={p.clave}>{p.nombre} · {valor(p[medida], medida)}</option>)}</select></label>
          {zona && <><h3 className="geo-zona-nombre">{zona.nombre}</h3><Detalle zona={zona}/></>}
        </div>
        <aside className="geo-ciudades" aria-label="Clientes de otras ciudades"><h3>Otras ciudades</h3><p className="geo-nota">{num(datos.data?.ciudades.reduce((n,c) => n+c.clientes,0))} clientes · ordenadas por {MEDIDAS.find(m => m.clave === medida)?.nombre.toLocaleLowerCase()}</p>
          <input aria-label="Buscar ciudad" placeholder="Buscar ciudad…" value={buscar} onChange={e => setBuscar(e.target.value)}/>
          <div className="geo-ciudades-lista">{ciudades.map(c => <details key={c.clave} className="geo-ciudad"><summary><span><strong>{c.nombre}</strong><small>{num(c.clientes)} clientes · {num(c.clientes_con_compras)} compradores</small></span><b>{dinero(c.monto)}</b></summary><Detalle zona={c}/></details>)}</div>
          {!ciudades.length && <p className="geo-nota">{buscar ? 'No hay ciudades que coincidan.' : 'Aún no hay clientes de otras ciudades.'}</p>}
          {!!datos.data?.sin_procedencia.clientes && <details className="geo-ciudad geo-sin-dato"><summary>Sin procedencia · {num(datos.data.sin_procedencia.clientes)} clientes</summary><Detalle zona={datos.data.sin_procedencia}/></details>}
        </aside>
      </div>
    </Estado>
    {datos.error && <button type="button" onClick={datos.recargar}>Reintentar carga del mapa</button>}
  </section>;
}
