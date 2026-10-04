import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { RefObject } from 'react';
import { api, apiForm, ApiError } from '../api/client';
import JarvisRecepcion from './JarvisRecepcion';
import type { EstadoJarvis } from './JarvisRecepcion';
import { useVision } from './vision';
import type { Presencia } from './vision';
import './recepcion.css';

type Empresa = { id: number; nombre: string; piso: string; local: string; referencia: string; horario: string; tipo: string };
type Contexto = { fecha: string; empresas: Empresa[]; ofertas: { titulo: string; empresa: string; piso: string; local: string; precio: string | null; fin: string }[]; puntos_interes: { nombre: string; piso: string; indicaciones: string }[] };
type Turno = { role: 'user' | 'assistant'; content: string };
type ResultadoQR = { autorizado: boolean; text: string; destino?: Pick<Empresa, 'nombre' | 'piso' | 'local' | 'referencia'> };
const BASE = '/agente/recepcion/';
const SALUDO = '¡Hola! ¿Vienes al Paseo Aranjuez, a una tienda o tienes una cita?';
const ESTADOS: Record<EstadoJarvis, string> = { inactivo: 'Aquí para ayudarte', escuchando: 'Te escucho…', pensando: 'Consultando…', hablando: 'Jarvis te responde', analizando: 'Verificando invitación…', autorizado: 'Visita autorizada', denegado: 'Revisa tu invitación' };

function mensajeError(e: unknown) {
  if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return 'La sesión de recepción terminó. Solicita ayuda al encargado para iniciar sesión nuevamente.';
  return e instanceof Error ? e.message : 'No pude completar la consulta. Solicita ayuda en recepción.';
}

export default function Recepcion() {
  const [iniciada, setIniciada] = useState(false);
  const [saludando, setSaludando] = useState(false);
  const saludoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [estado, setEstado] = useState<EstadoJarvis>('inactivo');
  const [texto, setTexto] = useState(SALUDO);
  const [pregunta, setPregunta] = useState('');
  const [error, setError] = useState('');
  const [mirada, setMirada] = useState(0);
  const [voz, setVoz] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [contexto, setContexto] = useState<Contexto | null>(null);
  const [panel, setPanel] = useState<'inicio' | 'directorio' | 'ofertas' | 'lugares' | 'qr'>('inicio');
  const [resultado, setResultado] = useState<ResultadoQR | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [codigo, setCodigo] = useState('');
  const [dispositivo, setDispositivo] = useState('');
  const [avisoContexto, setAvisoContexto] = useState('');
  const epoca = useRef(0);
  const bloqueado = useRef(false);
  const historial = useRef<Turno[]>([]);
  const ultimaActividad = useRef(0);
  const presenciaDesde = useRef(0);
  const ausenciaDesde = useRef(0);
  const saludado = useRef(false);
  const audio = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const limiteAudio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const vozVersion = useRef(0);
  const ultimoEscaneo = useRef('');

  function detenerVoz() { vozVersion.current++; window.speechSynthesis?.cancel(); }

  function cambiarOcupado(value: boolean) { bloqueado.current = value; setOcupado(value); }
  function pararAudio() {
    clearTimeout(limiteAudio.current);
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    recorder.current = null;
    audio.current?.getTracks().forEach(t => t.stop()); audio.current = null;
    setGrabando(false);
  }
  function nuevaConsulta() {
    clearTimeout(saludoTimer.current); setSaludando(false);
    epoca.current++; pararAudio(); detenerVoz(); ultimoEscaneo.current = '';
    historial.current = []; cambiarOcupado(false); setEstado('inactivo'); setTexto(SALUDO);
    setPregunta(''); setCodigo(''); setResultado(null); setBusqueda(''); setPanel('inicio'); setError('');
    ultimaActividad.current = Date.now();
  }
  function saludar() {
    clearTimeout(saludoTimer.current); setSaludando(true); decir(SALUDO);
    saludoTimer.current = setTimeout(() => setSaludando(false), 3000);
  }
  async function activarRecepcion() {
    // La voz se prueba dentro del gesto del encargado para habilitar el audio.
    decir('Vamos a activar la cámara.');
    if (await vision.iniciar(dispositivo)) {
      setIniciada(true); saludado.current = true; saludar();
    }
  }
  function decir(frase: string, final: EstadoJarvis = 'inactivo') {
    detenerVoz();
    setTexto(frase); ultimaActividad.current = Date.now();
    if (!voz || !window.speechSynthesis) { setEstado(final); return; }
    const turno = epoca.current;
    const version = vozVersion.current;
    const speech = new SpeechSynthesisUtterance(frase);
    speech.lang = 'es-BO'; speech.rate = 1; speech.pitch = 1.08;
    const voces = window.speechSynthesis.getVoices();
    speech.voice = voces.find(v => v.lang.startsWith('es-BO')) || voces.find(v => v.lang.startsWith('es')) || null;
    setEstado(final === 'denegado' ? 'denegado' : 'hablando');
    speech.onend = () => { if (turno === epoca.current && version === vozVersion.current) setEstado(final); };
    speech.onerror = () => { if (turno === epoca.current && version === vozVersion.current) setEstado(final); };
    window.speechSynthesis.speak(speech);
  }
  function presencia(p: Presencia) {
    if (!iniciada) return;
    const ahora = Date.now();
    if (p.cerca) {
      ausenciaDesde.current = 0;
      if (!presenciaDesde.current) presenciaDesde.current = ahora;
      setMirada(p.x);
      if (!saludado.current && ahora - presenciaDesde.current > 1600 && !bloqueado.current) {
        saludado.current = true; saludar();
      }
    } else {
      presenciaDesde.current = 0;
      if (!ausenciaDesde.current) ausenciaDesde.current = ahora;
      if (ahora - ausenciaDesde.current > 12000 && saludado.current) {
        saludado.current = false; setMirada(0); nuevaConsulta();
      }
    }
  }
  const vision = useVision({ presencia, qr: (value) => {
    if (iniciada && !bloqueado.current && ultimoEscaneo.current !== value) {
      ultimoEscaneo.current = value; void verificar(value);
    }
  } });

  useEffect(() => {
    let activo = true;
    async function cargar() {
      try {
        const data = await api<Contexto>(BASE + 'contexto/');
        if (activo) { setContexto(data); setAvisoContexto(''); }
      } catch (e) { if (activo) { setContexto(null); setAvisoContexto(mensajeError(e)); } }
    }
    void cargar(); const t = setInterval(cargar, 300000);
    return () => { activo = false; clearInterval(t); };
  }, []);
  useEffect(() => {
    if (!iniciada) return;
    ultimaActividad.current = Date.now();
    const t = setInterval(() => { if (Date.now() - ultimaActividad.current > 90000) nuevaConsulta(); }, 1000);
    return () => clearInterval(t);
  }, [iniciada]);
  useEffect(() => () => {
    epoca.current++; clearTimeout(limiteAudio.current); clearTimeout(saludoTimer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    audio.current?.getTracks().forEach(t => t.stop()); window.speechSynthesis?.cancel();
  }, []);

  async function preguntar(message: string) {
    if (!message.trim() || bloqueado.current) return;
    if (/\b(cita|invitaci[oó]n|qr|oficina)\b/i.test(message)) {
      setPregunta(''); setPanel('qr'); decir('Acerca el QR de tu invitación a la cámara, por favor.'); return;
    }
    const turno = epoca.current;
    cambiarOcupado(true); detenerVoz(); setEstado('pensando');
    setError(''); setResultado(null); setTexto('Voy a consultar la información del Paseo.');
    ultimaActividad.current = Date.now(); saludado.current = true;
    try {
      const response = await api<{ text: string }>(BASE + 'chat/', { method: 'POST', body: { message, history: historial.current.slice(-8) } });
      if (turno !== epoca.current) return;
      historial.current = [...historial.current, { role: 'user' as const, content: message }, { role: 'assistant' as const, content: response.text }].slice(-8);
      setPregunta(''); decir(response.text);
    } catch (e) { if (turno === epoca.current) { setError(mensajeError(e)); setTexto('Puedes consultar el directorio o solicitar ayuda en recepción.'); setEstado('inactivo'); } }
    finally { if (turno === epoca.current) cambiarOcupado(false); }
  }

  async function verificar(value: string) {
    if (bloqueado.current) return;
    setPanel('qr'); setResultado(null); setError('');
    if (!/^(?:paseo360:\/\/inv\/)?[A-Za-z2-9]{8}$/.test(value.trim())) {
      decir('Este código no es una invitación de oficinas. Muestra el QR que te envió la oficina.'); return;
    }
    const turno = epoca.current;
    cambiarOcupado(true); detenerVoz(); setEstado('analizando');
    setTexto('Un momento, estoy verificando tu invitación.');
    ultimaActividad.current = Date.now(); saludado.current = true;
    try {
      const data = await api<ResultadoQR>(BASE + 'qr/', { method: 'POST', body: { codigo: value.trim() } });
      if (turno !== epoca.current) return;
      setResultado(data); setCodigo(''); decir(data.text, data.autorizado ? 'autorizado' : 'denegado');
    } catch (e) {
      if (turno !== epoca.current) return;
      ultimoEscaneo.current = '';
      setError(mensajeError(e)); setEstado('inactivo');
      decir('No pude verificar tu invitación. Solicita ayuda en recepción.');
    } finally { if (turno === epoca.current) cambiarOcupado(false); }
  }

  async function microfono() {
    if (grabando) { pararAudio(); return; }
    if (bloqueado.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('Este navegador no permite grabar audio. Puedes escribir tu pregunta.'); return; }
    const turno = epoca.current;
    cambiarOcupado(true); detenerVoz(); setError(''); saludado.current = true;
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (turno !== epoca.current) { mic.getTracks().forEach(t => t.stop()); return; }
      audio.current = mic;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(mic, mimeType ? { mimeType } : undefined);
      const partes: Blob[] = [];
      recorder.current = rec;
      rec.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
      rec.onerror = () => { if (turno === epoca.current) { epoca.current++; pararAudio(); cambiarOcupado(false); setEstado('inactivo'); setError('No pude grabar el audio. Puedes escribir tu pregunta.'); } };
      rec.onstop = async () => {
        mic.getTracks().forEach(t => t.stop()); clearTimeout(limiteAudio.current);
        if (turno !== epoca.current) return;
        setGrabando(false); setEstado('pensando'); setTexto('Estoy escuchando tu pregunta…');
        try {
          const formato = rec.mimeType.includes('mp4') ? 'm4a' : rec.mimeType.includes('ogg') ? 'ogg' : 'webm';
          const form = new FormData(); form.append('audio', new Blob(partes, { type: rec.mimeType }), `pregunta.${formato}`);
          const data = await apiForm<{ text: string }>(BASE + 'transcribir/', form, 'POST');
          if (turno !== epoca.current) return;
          cambiarOcupado(false); setPregunta(data.text); await preguntar(data.text);
        } catch (e) { if (turno === epoca.current) { cambiarOcupado(false); setEstado('inactivo'); setError(mensajeError(e)); } }
      };
      rec.start(); setGrabando(true); setEstado('escuchando'); setTexto('Te escucho. Toca Enviar voz cuando termines.');
      ultimaActividad.current = Date.now();
      limiteAudio.current = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 15000);
    } catch (e) { if (turno === epoca.current) { pararAudio(); cambiarOcupado(false); setEstado('inactivo'); setError(mensajeError(e)); } }
  }

  function enviar(e: FormEvent) { e.preventDefault(); void preguntar(pregunta.trim()); }
  function handleAbrirPanel(tipo: typeof panel) { setPanel(tipo); }
  const empresas = contexto?.empresas.filter(e => `${e.nombre} ${e.tipo}`.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase())) || [];
  return <main className="recepcion">
    <header className="recepcion-header"><div className="recepcion-marca"><a className="recepcion-logo" href="/recepcion" aria-label="Paseo Aranjuez 360, recepción"><span>J</span><strong>Paseo Aranjuez<small>360</small></strong></a><span>Tu recepción virtual</span></div><div className="recepcion-utilidades">
      <button onClick={() => { setVoz(!voz); detenerVoz(); if (estado === 'hablando') setEstado('inactivo'); }} aria-pressed={voz}>{voz ? 'Voz activada' : 'Voz silenciada'}</button>
      <button onClick={() => { if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => setError('No se pudo activar pantalla completa.')); else void document.exitFullscreen(); }}>Pantalla completa</button>
    </div></header>
    <div className="recepcion-layout">
      <section className="recepcion-anfitrion"><span className="recepcion-etiqueta">BIENVENIDO AL PASEO</span><h1>Hola, soy Jarvis.<br/><span>Estoy para ayudarte.</span></h1>
        <div className={`recepcion-personaje ${saludando ? 'saludando' : ''}`}><JarvisRecepcion estado={estado} mirada={mirada}/></div>
        <div className="recepcion-respuesta" aria-live="polite"><span className={`recepcion-estado ${estado}`}>{ESTADOS[estado]}</span><p>{texto}</p></div>
        {error && <p className="recepcion-error" role="alert">{error}</p>}
        <div className="recepcion-conversacion"><button className={`recepcion-microfono ${grabando ? 'grabando' : ''}`} onClick={() => void microfono()} disabled={!iniciada || (ocupado && !grabando)}>{grabando ? 'Enviar voz' : 'Hablar con Jarvis'}</button>
          {estado === 'hablando' && <button onClick={() => { detenerVoz(); setEstado('inactivo'); }}>Interrumpir</button>}
          <button onClick={nuevaConsulta}>Nueva consulta</button></div>
        <form className="recepcion-pregunta" onSubmit={enviar}><input aria-label="Tu pregunta" placeholder="También puedes escribir tu pregunta…" value={pregunta} onChange={e => { setPregunta(e.target.value); ultimaActividad.current = Date.now(); }} maxLength={1000} disabled={!iniciada}/><button disabled={!iniciada || ocupado || !pregunta.trim()}>Enviar</button></form>
        <p className="recepcion-privacidad">La cámara procesa presencia y QR en este dispositivo, sin guardar imágenes. Al tocar Hablar, el audio se envía para transcribir tu pregunta.</p>
      </section>
      <section className="recepcion-servicios" aria-label="Información y acceso">
        {!iniciada && <div className="recepcion-activar"><span className="recepcion-etiqueta">PREPARAR LA PANTALLA</span><h2>Empecemos.</h2><p>El encargado activa cámara y sonido una vez. Permite el acceso a la cámara cuando lo solicite el navegador.</p><button className="recepcion-principal" disabled={vision.cargando} onClick={() => void activarRecepcion()}>{vision.cargando ? 'Esperando cámara…' : 'Activar recepción'}</button><button onClick={() => { setIniciada(true); saludar(); }}>Continuar sin cámara</button></div>}
        <div className="recepcion-atajos">{([['directorio','Empresas y horarios','Encuentra tu destino'],['ofertas','Ofertas de hoy','Descubre novedades'],['lugares','Cómo llegar','Baños y otros servicios'],['qr','Tengo una invitación','Muestra tu QR']] as const).map(([tipo,titulo,sub]) => <button key={tipo} aria-pressed={panel === tipo} onClick={() => handleAbrirPanel(tipo)}><strong>{titulo}</strong><span>{sub}</span></button>)}</div>
        <div className="recepcion-panel">
          {panel === 'inicio' && <><span className="recepcion-etiqueta">BIENVENIDO</span><h2>¿A dónde vienes?</h2><p>Elige una opción o toca Hablar con Jarvis para responder.</p><div className="recepcion-destinos"><button disabled={!iniciada} onClick={() => { setPanel('lugares'); decir('¡Bienvenido al Paseo! ¿Qué lugar buscas?'); }}>Visitar el Paseo</button><button disabled={!iniciada} onClick={() => { setPanel('directorio'); decir('¿A qué tienda quieres ir?'); }}>Buscar una tienda</button><button disabled={!iniciada} onClick={() => { setPanel('qr'); decir('Acerca el QR de tu invitación a la cámara, por favor.'); }}>Tengo una cita</button></div></>}
          {panel === 'directorio' && <><h2>Empresas y horarios</h2><input aria-label="Buscar empresa" placeholder="Nombre de la empresa…" value={busqueda} onChange={e => setBusqueda(e.target.value)}/><div className="recepcion-lista">{empresas.map(e => <article key={e.id}><h3>{e.nombre}</h3><p>{e.piso ? `Piso ${e.piso}` : 'Piso por confirmar'}{e.local && ` · ${e.local}`}</p><strong>{e.horario}</strong>{e.referencia && <p>{e.referencia}</p>}</article>)}{!empresas.length && <p>No hay empresas para esta búsqueda.</p>}</div></>}
          {panel === 'ofertas' && <><h2>Ofertas vigentes</h2><div className="recepcion-lista">{contexto?.ofertas.map((o,i) => <article key={i}><h3>{o.titulo}</h3><p>{o.empresa}{o.piso && ` · Piso ${o.piso}`}</p>{o.precio && <strong>Bs {o.precio}</strong>}<p>Válida hasta {o.fin.split('-').reverse().join('/')}</p></article>)}{!contexto?.ofertas.length && <p>No hay ofertas disponibles para mostrar.</p>}</div></>}
          {panel === 'lugares' && <><h2>Cómo llegar</h2><div className="recepcion-lista">{contexto?.puntos_interes.map((p,i) => <article key={i}><h3>{p.nombre}</h3>{p.piso && <strong>Piso {p.piso}</strong>}<p>{p.indicaciones}</p></article>)}{!contexto?.puntos_interes.length && <p>Las indicaciones de baños y ascensores aún no están configuradas para esta pantalla. Consulta en recepción.</p>}</div></>}
          {panel === 'qr' && <><h2>{resultado?.autorizado ? 'Tu destino' : 'Tu invitación'}</h2>{resultado ? <article className={`recepcion-pase ${resultado.autorizado ? 'aprobado' : ''}`}><strong>{resultado.autorizado ? 'Visita autorizada' : 'Invitación no habilitada'}</strong><p>{resultado.text}</p>{resultado.destino && <><span className="recepcion-piso">{resultado.destino.piso ? `Piso ${resultado.destino.piso}` : 'Consulta en recepción'}</span><h3>{resultado.destino.nombre}</h3><p>{resultado.destino.local && `Oficina ${resultado.destino.local}`}</p><p>{resultado.destino.referencia}</p></>}<small>La verificación no registra el ingreso ni abre puertas. Portería confirma tu entrada.</small></article> : <p>Muestra el QR de la oficina frente a la cámara. Lo verificaré con el sistema.</p>}<form className="recepcion-codigo" onSubmit={e => { e.preventDefault(); void verificar(codigo); }}><label>¿No puedes mostrarlo?<input aria-label="Código de invitación" placeholder="Código de 8 caracteres" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} maxLength={8}/></label><button disabled={!iniciada || ocupado || codigo.length !== 8}>Verificar código</button></form></>}
          {avisoContexto && <p className="recepcion-error">{avisoContexto}</p>}
        </div>
        <CameraPreview videoRef={vision.video} escaneando={panel === 'qr'} cargando={vision.cargando} activa={vision.activa}/>
        {(vision.error || vision.aviso) && <p className="recepcion-error" role="status">{vision.error || vision.aviso}</p>}
        {iniciada && <details className="recepcion-ajustes"><summary>Configurar cámara</summary><select aria-label="Seleccionar cámara" value={dispositivo} onChange={e => setDispositivo(e.target.value)}><option value="">Cámara predeterminada</option>{vision.camaras.map((c,i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Cámara ${i+1}`}</option>)}</select><button disabled={vision.cargando} onClick={() => void vision.iniciar(dispositivo)}>Activar cámara</button><button onClick={vision.detener}>Apagar cámara</button><small>Coloca la cámara a la altura del rostro y prueba el saludo acercándote al centro. La cercanía es aproximada.</small></details>}
      </section>
    </div>
    <footer className="recepcion-footer"><span>Paseo Aranjuez · Recepción virtual</span><span>Las conversaciones se limpian al terminar o tras 90 segundos sin interacción.</span></footer>
  </main>;
}

function CameraPreview({ videoRef, escaneando, cargando, activa }: {
  videoRef: RefObject<HTMLVideoElement | null>; escaneando: boolean; cargando: boolean; activa: boolean;
}) {
  return <div className={`recepcion-camara ${escaneando ? 'escanear' : ''}`}>
    <video ref={videoRef} muted playsInline aria-label="Vista de cámara para acercar el QR"/>
    <div className="recepcion-marco"/>
    <span>{cargando ? 'Preparando cámara…' : activa ? 'Acerca tu QR al centro' : 'Cámara desactivada'}</span>
  </div>;
}
