import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import type { FaceDetector } from '@mediapipe/tasks-vision';

export type Presencia = { cerca: boolean; x: number; cantidad: number };
type Eventos = { presencia: (p: Presencia) => void; qr: (codigo: string) => void };

/** Fotogramas procesados localmente. No hay reconocimiento de identidad ni grabación. */
export function useVision(eventos: Eventos) {
  const video = useRef<HTMLVideoElement>(null);
  const callbacks = useRef(eventos);
  const sesion = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const detector = useRef<FaceDetector | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [activa, setActiva] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [camaras, setCamaras] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => { callbacks.current = eventos; });

  function detener() {
    sesion.current++;
    clearInterval(timer.current);
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
    detector.current?.close();
    detector.current = null;
    if (video.current) video.current.srcObject = null;
    setActiva(false); setCargando(false);
  }
  useEffect(() => () => {
    sesion.current++;
    clearInterval(timer.current);
    stream.current?.getTracks().forEach(t => t.stop());
    detector.current?.close();
  }, []);

  async function iniciar(deviceId = '') {
    detener();
    const turno = sesion.current;
    setCargando(true); setError(''); setAviso('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error('La cámara necesita HTTPS o localhost y un navegador compatible.');
      const nueva = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
        width: { ideal: 1280 }, height: { ideal: 720 },
      } });
      if (turno !== sesion.current) { nueva.getTracks().forEach(t => t.stop()); return; }
      stream.current = nueva;
      nueva.getVideoTracks()[0].addEventListener('ended', () => {
        if (turno !== sesion.current) return;
        detener(); setError('Se desconectó la cámara. Vuelve a conectarla e inicia la recepción.');
      });
      if (video.current) { video.current.srcObject = nueva; await video.current.play(); }
      const dispositivos = await navigator.mediaDevices.enumerateDevices();
      if (turno !== sesion.current) return;
      setCamaras(dispositivos.filter(d => d.kind === 'videoinput'));
      setActiva(true);
      try {
        const [{ FaceDetector }, { default: wasmLoaderPath }, { default: wasmBinaryPath }] = await Promise.all([
          import('@mediapipe/tasks-vision'),
          import('@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url'),
          import('@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url'),
        ]);
        if (turno !== sesion.current) return;
        const modelo = await FaceDetector.createFromOptions({ wasmLoaderPath, wasmBinaryPath }, {
          baseOptions: { modelAssetPath: '/modelos/blaze_face_short_range.tflite', delegate: 'CPU' },
          runningMode: 'VIDEO', minDetectionConfidence: 0.65,
        });
        if (turno !== sesion.current) { modelo.close(); return; }
        detector.current = modelo;
      } catch {
        if (turno !== sesion.current) return;
        setAviso('El saludo automático no está disponible. Puedes tocar Hablar o mostrar tu QR.');
      }
      if (turno !== sesion.current) return;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let ultimoQR = '', ultimaLectura = 0, ultimoTiempo = -1, objetivo = 0.5, ultimaCara = 0;
      setCargando(false);
      // Cinco fotogramas por segundo para dejar tiempo al personaje y al audio.
      timer.current = setInterval(() => {
        const v = video.current;
        if (document.hidden || !v || v.readyState < 2 || v.currentTime === ultimoTiempo || !ctx) return;
        ultimoTiempo = v.currentTime;
        const ahora = performance.now();
        if (detector.current) {
          try {
            const caras = detector.current.detectForVideo(v, ahora).detections
              .map(d => d.boundingBox).filter(b => b !== undefined)
              .map(b => ({ x: (b.originX + b.width / 2) / v.videoWidth, ancho: b.width / v.videoWidth }));
            const candidatas = caras.filter(c => c.x > .18 && c.x < .82 && c.ancho > .10);
            // Mantener la atención cerca de la posición elegida; no saltar de rostro.
            const elegida = ahora - ultimaCara < 1500
              ? candidatas.filter(c => Math.abs(c.x - objetivo) < .22).sort((a,b) => Math.abs(a.x-objetivo)-Math.abs(b.x-objetivo))[0]
              : candidatas.sort((a,b) => b.ancho-a.ancho)[0];
            if (elegida) { objetivo = elegida.x; ultimaCara = ahora; }
            callbacks.current.presencia({ cerca: Boolean(elegida), x: 1 - 2 * objetivo, cantidad: caras.length });
          } catch {
            detector.current.close(); detector.current = null;
            setAviso('Se pausó la detección de presencia. El lector QR sigue disponible.');
          }
        }
        canvas.width = 640; canvas.height = Math.round(640 * v.videoHeight / v.videoWidth);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
        if (qr && (qr.data !== ultimoQR || ahora - ultimaLectura > 8000)) {
          ultimoQR = qr.data; ultimaLectura = ahora; callbacks.current.qr(qr.data);
        }
      }, 200);
      return true;
    } catch (e) {
      if (turno !== sesion.current) return;
      detener();
      setError(e instanceof DOMException && e.name === 'NotAllowedError'
        ? 'Cámara bloqueada. Pulsa el icono junto a la dirección, permite Cámara y vuelve a pulsar Activar recepción. Si sigue bloqueada, revisa Privacidad > Cámara en Windows.'
        : e instanceof DOMException && e.name === 'NotFoundError'
        ? 'No encuentro una cámara. Conecta la Logitech por USB y vuelve a intentarlo.'
        : e instanceof DOMException && e.name === 'NotReadableError'
        ? 'La cámara está ocupada. Cierra la aplicación que la usa y vuelve a intentarlo.'
        : e instanceof Error ? e.message : 'No pude iniciar la cámara.');
      return false;
    }
  }
  return { video, activa, cargando, error, aviso, camaras, iniciar, detener };
}
