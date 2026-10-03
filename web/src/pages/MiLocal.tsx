import { AtSign, Camera, Clock, Eye, ImagePlus, Link2, MapPin, MessageCircle, Moon, Sun, Tag, X } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { api, CATEGORIAS, useDb } from '../api/db';
import { ClientePreview } from '../components/ClientePreview';
import { ImageUploader } from '../components/ImageUploader';
import { fileToDataUrl } from '../lib/image';
import type { Negocio } from '../types';

const NOMBRES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MAX_FOTOS = 6;

function parseDias(h: string): boolean[] {
  const on = Array(7).fill(false) as boolean[];
  const rango = h.match(/(Lun|Mar|Mié|Jue|Vie|Sáb|Dom)\s+a\s+(Lun|Mar|Mié|Jue|Vie|Sáb|Dom)/);
  if (rango) {
    for (let i = NOMBRES.indexOf(rango[1]); i <= NOMBRES.indexOf(rango[2]); i++) on[i] = true;
    return on;
  }
  const lista = [...h.matchAll(/Lun|Mar|Mié|Jue|Vie|Sáb|Dom/g)];
  if (lista.length) {
    lista.forEach((m) => (on[NOMBRES.indexOf(m[0])] = true));
    return on;
  }
  return [true, true, true, true, true, true, false];
}

function parseHoras(h: string) {
  const t = [...h.matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => `${m[1].padStart(2, '0')}:${m[2]}`);
  return { abre: t[0] ?? '10:00', cierra: t[1] ?? '21:00' };
}

function textoDias(on: boolean[]): string {
  const idx = on.flatMap((v, i) => (v ? [i] : []));
  if (!idx.length) return '';
  const seguidos = idx.length >= 3 && idx[idx.length - 1] - idx[0] === idx.length - 1;
  return seguidos ? `${NOMBRES[idx[0]]} a ${NOMBRES[idx[idx.length - 1]]}` : idx.map((i) => NOMBRES[i]).join(', ');
}

function Sec({ n, icon, title, sub, children }: { n: number; icon: ReactNode; title: string; sub: string; children: ReactNode }) {
  return (
    <section className="sec">
      <div className="sec-head">
        <div className="sec-ico">{icon}</div>
        <div>
          <h3>
            {n}. {title}
          </h3>
          <p>{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function MiLocal({ onVerPresentacion }: { onVerPresentacion: () => void }) {
  const { negocio } = useDb();
  const [n, setN] = useState<Negocio>(negocio);
  const [dias, setDias] = useState(() => parseDias(negocio.horario));
  const [horas, setHoras] = useState(() => parseHoras(negocio.horario));
  const [aviso, setAviso] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const horario = `${textoDias(dias)} ${horas.abre} a ${horas.cierra}`.trim();
  const actual: Negocio = { ...n, horario };
  const sucio = JSON.stringify(actual) !== JSON.stringify(negocio);

  const completo = useMemo(() => {
    const checks = [actual.logo_url, actual.nombre.trim(), actual.descripcion.trim(), actual.piso, actual.local.trim(), actual.referencia.trim(), textoDias(dias), actual.fotos_local.length, actual.whatsapp.trim(), actual.instagram.trim()];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [actual, dias]);

  const set = <K extends keyof Negocio>(k: K, v: Negocio[K]) => {
    setN((p) => ({ ...p, [k]: v }));
    setAviso('');
  };

  const valido = n.nombre.trim().length > 0 && dias.some(Boolean);

  function guardar() {
    if (!valido) return setAviso(!n.nombre.trim() ? 'Escribe el nombre del negocio.' : 'Elige al menos un día de apertura.');
    api.saveNegocio({ ...actual, nombre: actual.nombre.trim() });
    setAviso('Cambios guardados');
    setTimeout(() => setAviso((a) => (a === 'Cambios guardados' ? '' : a)), 2500);
  }

  function descartar() {
    setN(negocio);
    setDias(parseDias(negocio.horario));
    setHoras(parseHoras(negocio.horario));
    setAviso('');
  }

  async function agregarFotos(files: FileList | null) {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, MAX_FOTOS - n.fotos_local.length);
    const urls = await Promise.all(imgs.map((f) => fileToDataUrl(f)));
    set('fotos_local', [...n.fotos_local, ...urls]);
  }

  return (
    <>
      <div className="pagehead">
        <p className="crumb">Administración › Ficha de Mi Local</p>
        <div className="row">
          <h2>Configuración del Establecimiento</h2>
          <span className="complete">
            <Tag size={13} /> Perfil {completo}% completo
          </span>
          <button className="btn small" onClick={onVerPresentacion}>
            <Eye size={15} /> Ver presentación
          </button>
        </div>
        <p>Actualiza la información visible para los clientes y visitantes dentro del complejo comercial Paseo Aranjuez.</p>
      </div>

      <div className="layout">
        <div className="stack">
          <Sec n={1} icon={<Tag size={16} />} title="Identidad de Marca" sub="Logotipo distintivo, denominación y presentación en el directorio.">
            <ImageUploader label="Logotipo cuadrado" value={n.logo_url ? [n.logo_url] : []} onChange={(u) => set('logo_url', u[0] ?? '')} square hint="PNG o JPG, fondo claro se ve mejor." />
            <div className="row3">
              <label className="field">
                <span className="label">Nombre comercial *</span>
                <input value={n.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej. Café Chaski" />
              </label>
              <label className="field">
                <span className="label">Categoría comercial</span>
                <select value={n.categoria_id} onChange={(e) => set('categoria_id', e.target.value)}>
                  {CATEGORIAS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span className="label">Descripción para clientes</span>
              <textarea rows={3} maxLength={240} value={n.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Cuéntale al cliente qué ofreces" />
              <span className="hint" style={{ textAlign: 'right' }}>
                {n.descripcion.length} / 240
              </span>
            </label>
          </Sec>

          <Sec n={2} icon={<MapPin size={16} />} title="Ubicación Física en Paseo Aranjuez" sub="Facilita el flujo de clientes bajo tu ubicación dentro del Paseo.">
            <div className="row3">
              <label className="field">
                <span className="label">Piso o nivel</span>
                <select value={n.piso} onChange={(e) => set('piso', e.target.value)}>
                  {['1', '2', '3', '4'].map((p) => (
                    <option key={p} value={p}>
                      Piso {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Número de local o módulo</span>
                <input value={n.local} onChange={(e) => set('local', e.target.value)} placeholder="Ej. 8" />
              </label>
            </div>
            <label className="field">
              <span className="label">Indicaciones y referencias de acceso</span>
              <input value={n.referencia} onChange={(e) => set('referencia', e.target.value)} placeholder="Ej. Frente a los ascensores, junto al balcón central" />
            </label>
          </Sec>

          <Sec n={3} icon={<Clock size={16} />} title="Horarios y Operación" sub="Sincronización en vivo con el sistema de apertura general.">
            <div className="field">
              <span className="label">Días hábiles de apertura</span>
              <div className="days">
                {INICIALES.map((l, i) => (
                  <button
                    type="button"
                    key={i}
                    title={NOMBRES[i]}
                    aria-label={NOMBRES[i]}
                    aria-pressed={dias[i]}
                    className={dias[i] ? 'on' : ''}
                    onClick={() => {
                      setDias(dias.map((v, j) => (j === i ? !v : v)));
                      setAviso('');
                    }}>
                    {l}
                  </button>
                ))}
              </div>
              <span className="hint">Se mostrará como: {horario || 'elige al menos un día'}</span>
            </div>
            <div className="row3">
              <label className="field">
                <span className="label">
                  <Sun size={13} /> Apertura matutina
                </span>
                <input type="time" value={horas.abre} onChange={(e) => setHoras({ ...horas, abre: e.target.value })} />
              </label>
              <label className="field">
                <span className="label">
                  <Moon size={13} /> Cierre nocturno
                </span>
                <input type="time" value={horas.cierra} onChange={(e) => setHoras({ ...horas, cierra: e.target.value })} />
              </label>
            </div>
          </Sec>

          <Sec n={4} icon={<Camera size={16} />} title="Galería Fotográfica del Local" sub={`Capacidad hasta ${MAX_FOTOS} imágenes. La primera es la portada principal.`}>
            <div className="gallery">
              {n.fotos_local.map((u, i) => (
                <div className="gslot" key={i}>
                  <img src={u} alt={`Foto ${i + 1} del local`} />
                  {i === 0 && <span className="cover-tag">Portada principal</span>}
                  <button type="button" className="thumb-x" aria-label="Quitar foto" onClick={() => set('fotos_local', n.fotos_local.filter((_, j) => j !== i))}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              {n.fotos_local.length < MAX_FOTOS && (
                <button type="button" className="gslot empty-slot" onClick={() => fileRef.current?.click()}>
                  <span>
                    <ImagePlus size={22} style={{ display: 'block', margin: '0 auto 4px' }} />
                    Adjuntar foto
                    <br />
                    {n.fotos_local.length} / {MAX_FOTOS}
                  </span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void agregarFotos(e.target.files);
                e.target.value = '';
              }}
            />
          </Sec>

          <Sec n={5} icon={<MessageCircle size={16} />} title="Canales Directos de Comunicación" sub="Conexión directa y rápida con tus visitantes y clientes en tránsito.">
            <div className="row3">
              <label className="field">
                <span className="label">
                  <MessageCircle size={13} /> WhatsApp para pedidos y reservas
                </span>
                <input value={n.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="Ej. 70012345" inputMode="tel" />
              </label>
              <label className="field">
                <span className="label">
                  <AtSign size={13} /> Instagram
                </span>
                <input value={n.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@tunegocio" />
              </label>
            </div>
            <label className="field">
              <span className="label">
                <Link2 size={13} /> Facebook
              </span>
              <input value={n.facebook} onChange={(e) => set('facebook', e.target.value)} placeholder="facebook.com/tunegocio" />
            </label>
          </Sec>
        </div>

        <aside className="side">
          <section className="panel">
            <div className="panel-head">
              <h3>Así te verá el cliente</h3>
              <span className="badge-gold">App PaseoYa</span>
            </div>
            <ClientePreview n={actual} />
            <p className="note">Los cambios en el formulario se actualizan en vivo en esta vista previa.</p>
          </section>
        </aside>
      </div>

      {(sucio || aviso) && (
        <div className="savebar">
          <div>
            <div className="msg">
              <b>{aviso && !sucio ? aviso : sucio ? 'Tienes cambios sin guardar' : aviso}</b>
              {aviso && sucio && <small style={{ color: '#ffb4b4' }}>{aviso}</small>}
            </div>
            {sucio && (
              <>
                <button className="btn ghost" onClick={descartar}>
                  Descartar cambios
                </button>
                <button className="btn gold" onClick={guardar}>
                  Guardar configuración
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
