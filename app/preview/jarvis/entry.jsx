import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import JarvisCuerpo from '../../components/JarvisCuerpo';
import './preview.css';

const EMOCIONES = [
  ['amable', 'Amable', '¡Hola! Qué bueno verte por aquí.'],
  ['feliz', 'Feliz', '¡Me alegra poder ayudarte!'],
  ['enojado', 'Enojado', 'Mmm… eso no me hace mucha gracia.'],
  ['serio', 'Serio', 'Vamos a revisar los detalles.'],
  ['curioso', 'Curioso', 'Cuéntame, te estoy escuchando.'],
  ['sorprendido', 'Sorprendido', '¡Oh! Eso sí que no me lo esperaba.'],
  ['triste', 'Empático', 'Entiendo. Busquemos una solución juntos.'],
];
const ESTADOS = [['inactivo','En reposo'],['escuchando','Escuchar'],['hablando','Hablar'],['analizando','Analizar QR'],['indicando','Señalar']];
function Preview() {
  const [emocion, setEmocion] = useState('feliz');
  const [estado, setEstado] = useState('inactivo');
  const [animado, setAnimado] = useState(true);
  const [oscuro, setOscuro] = useState(false);
  const expresion = EMOCIONES.find(e => e[0] === emocion);
  return <main>
    <header><a className="marca" href="#"><span className="marca-icono">J</span> Paseo Aranjuez <span className="separador">/</span> Jarvis</a><span className="etiqueta">Estudio de expresiones</span></header>
    <div className="intro"><div><span className="eyebrow">TU ANFITRIÓN DEL PASEO</span><h1>Pequeños gestos.<br/><span>Mucha personalidad.</span></h1></div><p>El mismo Jarvis, con una cara que cuenta más.<br/>Elige una emoción y dale movimiento.</p></div>
    <div className="workspace">
      <section className={`escenario ${oscuro ? 'oscuro' : ''}`} aria-label="Vista previa del personaje">
        <div className="escenario-top"><span className="live"><i/> Vista interactiva</span><button className="tema" onClick={() => setOscuro(!oscuro)}>{oscuro ? 'Fondo claro' : 'Fondo oscuro'}</button></div>
        <div className="dialogo" aria-live="polite">{estado === 'analizando' ? 'Un momento, estoy verificando tu invitación…' : expresion[2]}</div>
        <div className="personaje"><JarvisCuerpo ancho={280} emocion={estado === 'inactivo' || estado === 'hablando' ? emocion : null} estado={estado} animado={animado} saludar /></div>
        <div className="nombre"><strong>Jarvis</strong><span>Tu guía, con una sonrisa.</span></div>
        <div className="escenario-bottom"><span>Diseño original · Paseo 360</span><button aria-pressed={!animado} onClick={() => setAnimado(!animado)}>{animado ? 'Pausar movimiento' : 'Activar movimiento'}</button></div>
      </section>
      <aside><div className="panel-titulo"><span className="paso">01</span><div><h2>Cómo se siente</h2><p>Cejas, mirada, boca y postura.</p></div></div>
        <div className="emociones">{EMOCIONES.map(([valor, nombre]) => <button key={valor} className="emocion" aria-pressed={valor === emocion} onClick={() => {setEmocion(valor);setEstado('inactivo');}}>
          <JarvisCuerpo ancho={65} emocion={valor} animado={false} halo={false}/><span>{nombre}</span>{valor === emocion && <span className="seleccion">✓</span>}
        </button>)}</div>
        <div className="panel-titulo segundo"><span className="paso">02</span><div><h2>Qué está haciendo</h2><p>Prueba sus gestos en contexto.</p></div></div>
        <div className="acciones">{ESTADOS.map(([valor,nombre]) => <button key={valor} aria-pressed={valor === estado} onClick={() => setEstado(valor)}>{nombre}</button>)}</div>
        <p className="nota">Demostración visual. La cámara, el QR y el audio no están conectados en esta vista.</p>
      </aside>
    </div>
    <footer>Formas suaves. Mirada expresiva. Identidad propia.<span>JARVIS / 02</span></footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
