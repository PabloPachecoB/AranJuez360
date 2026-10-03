import { Clock, MapPin, MessageCircle } from 'lucide-react';
import { CATEGORIAS } from '../api/db';
import { abiertoAhora } from '../lib/image';
import type { Negocio } from '../types';

/** Vista previa en vivo de la ficha del negocio en la app del cliente. */
export function ClientePreview({ n }: { n: Negocio }) {
  const abierto = n.activo && abiertoAhora(n.horario) !== false;
  const cat = CATEGORIAS.find((c) => c.id === n.categoria_id)?.nombre ?? '';
  const ubic = [n.piso && `Piso ${n.piso}`, n.local && `Local ${n.local}`].filter(Boolean).join(' · ');

  return (
    <article className="cp">
      <div className="cp-cover">
        {n.fotos_local[0] && <img src={n.fotos_local[0]} alt="Portada del local" />}
        <span className={`cp-badge ${abierto ? '' : 'off'}`}>{abierto ? 'ABIERTO' : 'CERRADO'}</span>
      </div>
      <div className="cp-body">
        <div className="cp-logo">{n.logo_url ? <img src={n.logo_url} alt="" /> : (n.nombre[0] ?? '?').toUpperCase()}</div>
        <h4>{n.nombre || 'Nombre del negocio'}</h4>
        <p className="cp-cat">{cat}</p>
        <p className="cp-line">
          <MapPin size={13} /> {ubic || 'Piso · Local'}
        </p>
        <p className="cp-line">
          <Clock size={13} /> {n.horario}
        </p>
        {n.descripcion && <p className="cp-desc">{n.descripcion}</p>}
        {n.fotos_local.length > 1 && (
          <div className="cp-thumbs">
            {n.fotos_local.slice(1, 4).map((u, i) => (
              <img key={i} src={u} alt="" />
            ))}
          </div>
        )}
        {n.whatsapp && (
          <a className="btn primary small" href={`https://wa.me/591${n.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
            <MessageCircle size={14} /> Pedir por WhatsApp
          </a>
        )}
      </div>
    </article>
  );
}
