import { useId } from 'react';

export type EstadoJarvis = 'inactivo' | 'escuchando' | 'pensando' | 'hablando' | 'analizando' | 'autorizado' | 'denegado';

/** Versión SVG web del personaje de la app: mismo azul, pañuelo y expresiones. */
export default function JarvisRecepcion({ estado, mirada = 0 }: { estado: EstadoJarvis; mirada?: number }) {
  const id = useId().replace(/:/g, '');
  const serio = estado === 'denegado';
  const pensando = estado === 'analizando' || estado === 'pensando';
  const feliz = estado === 'autorizado' || estado === 'hablando';
  const x = Math.max(-1, Math.min(1, mirada)) * 5;
  return <svg className={`recepcion-jarvis estado-${estado}`} viewBox="0 0 260 320" role="img" aria-label={`Jarvis ${estado}`}>
    <defs><clipPath id={`${id}-cara`}><rect x="66" y="65" width="130" height="96" rx="38"/></clipPath></defs>
    <circle className="jarvis-halo" cx="130" cy="163" r="104" fill={pensando || feliz ? '#f6be3b' : '#55b7e4'}/>
    <ellipse cx="130" cy="291" rx="59" ry="6" fill="#b7d6e2"/>
    <g className="jarvis-cuerpo">
      <path d="M106 246v25m46-25v25" stroke="#1777ac" strokeWidth="23" strokeLinecap="round"/>
      <rect x="77" y="265" width="49" height="24" rx="12" fill="#1777ac"/><rect x="132" y="265" width="49" height="24" rx="12" fill="#1777ac"/>
      <rect x="77" y="262" width="49" height="20" rx="10" fill="#288fc6"/><rect x="132" y="262" width="49" height="20" rx="10" fill="#288fc6"/>
      <g className="jarvis-brazo izquierdo"><path d="M81 179Q60 190 60 224" fill="none" stroke="#1777ac" strokeWidth="23" strokeLinecap="round"/><path d="M80 175Q61 186 60 221" fill="none" stroke="#288fc6" strokeWidth="21" strokeLinecap="round"/><rect x="43" y="219" width="32" height="28" rx="12" fill="#bceeff"/><path d="M51 232h15" stroke="#55b7e4" strokeWidth="3" strokeLinecap="round"/></g>
      <g className="jarvis-brazo derecho"><path d="M180 179Q201 190 201 224" fill="none" stroke="#1777ac" strokeWidth="23" strokeLinecap="round"/><path d="M181 175Q200 186 201 221" fill="none" stroke="#288fc6" strokeWidth="21" strokeLinecap="round"/><rect x="185" y="219" width="32" height="28" rx="12" fill="#bceeff"/><path d="M193 232h15" stroke="#55b7e4" strokeWidth="3" strokeLinecap="round"/></g>
      <rect x="77" y="162" width="108" height="96" rx="40" fill="#1777ac"/><rect x="77" y="155" width="108" height="96" rx="40" fill="#288fc6"/>
      <rect x="96" y="189" width="71" height="53" rx="26" fill="#55b7e4"/><rect x="118" y="199" width="30" height="33" rx="12" fill="#f6be3b"/><path d="M127 222v-10a6 6 0 0 1 12 0v10z" fill="none" stroke="#00324b" strokeWidth="3"/>
      <path d="M95 167q31 6 70-3" stroke="#f6be3b" strokeWidth="17" strokeLinecap="round"/><path d="M164 167l13 26" stroke="#f6be3b" strokeWidth="18" strokeLinecap="round"/>
      <g className="jarvis-cabeza">
        <path d="M133 44l3-22" stroke="#1777ac" strokeWidth="8" strokeLinecap="round"/><rect x="126" y="11" width="22" height="22" rx="9" fill="#f6be3b"/>
        <rect x="49" y="40" width="165" height="141" rx="58" fill="#1777ac"/><rect x="49" y="32" width="165" height="141" rx="58" fill="#288fc6"/>
        <path d="M77 52l40-6" stroke="#55b7e4" strokeWidth="10" strokeLinecap="round"/>
        <rect x="66" y="65" width="130" height="96" rx="38" fill="#bceeff"/>
        <path d={serio ? 'M91 80h24m29 0h24' : pensando ? 'M91 80l24-3m29-3l24 4' : 'M91 80l24-5m29 0l24 5'} stroke="#1777ac" strokeWidth="6" strokeLinecap="round"/>
        <g className="jarvis-ojos">
          <rect x="88" y="88" width="39" height="46" rx="20" fill="white"/><rect x="136" y="88" width="39" height="46" rx="20" fill="white"/>
          <g style={{ transform: `translateX(${x}px)` }}><rect x="99" y="98" width="21" height="30" rx="11" fill="#00324b"/><rect x="144" y="98" width="21" height="30" rx="11" fill="#00324b"/><ellipse cx="112" cy="106" rx="4" ry="5" fill="white"/><ellipse cx="157" cy="106" rx="4" ry="5" fill="white"/></g>
          {serio && <path d="M85 90h45m4 0h45" stroke="#bceeff" strokeWidth="19"/>}
        </g>
        <path d="M77 140h12m86 0h12" stroke="#f995a5" opacity={feliz ? .9 : .4} strokeWidth="7" strokeLinecap="round"/>
        {serio ? <path d="M120 145h25" stroke="#123b59" strokeWidth="5" strokeLinecap="round"/> : pensando ? <ellipse cx="143" cy="146" rx="8" ry="4" fill="#123b59"/> : <g className="jarvis-boca"><path d="M113 139h39q0 22-20 22t-19-22" fill="#123b59"/><path d="M118 141h29" stroke="white" strokeWidth="5" strokeLinecap="round"/><path d="M129 158q5-9 15-5" stroke="#f48198" strokeWidth="7" strokeLinecap="round"/></g>}
        {pensando && <g clipPath={`url(#${id}-cara)`}><path className="jarvis-escaner" d="M69 75h124" stroke="#f6be3b" strokeWidth="3" opacity=".7"/></g>}
      </g>
    </g>
  </svg>;
}
