import { useEffect, useRef, useState } from "react";

export type EstadoCamara = "inactiva" | "pidiendo-permiso" | "activa" | "sin-soporte" | "permiso-denegado" | "error";

/**
 * Escanea QR con la cámara usando BarcodeDetector nativo (Chrome/Android). Si el
 * navegador no lo soporta o el permiso se niega, el caller debe ofrecer entrada
 * manual — por eso esta issue (#45) pide ambas, no solo la cámara.
 */
export function useEscanerQR(activo: boolean, onDetectado: (valor: string) => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [estado, setEstado] = useState<EstadoCamara>("inactiva");
  const onDetectadoRef = useRef(onDetectado);
  useEffect(() => {
    onDetectadoRef.current = onDetectado;
  });

  useEffect(() => {
    if (!activo) {
      setEstado("inactiva");
      return;
    }

    const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
    } }).BarcodeDetector;

    if (!BarcodeDetectorCtor) {
      setEstado("sin-soporte");
      return;
    }

    let detenido = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });

    setEstado("pidiendo-permiso");

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (detenido) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
        setEstado("activa");

        const detectar = async () => {
          if (detenido || !videoRef.current) return;
          try {
            const codigos = await detector.detect(videoRef.current);
            if (codigos[0]?.rawValue) {
              onDetectadoRef.current(codigos[0].rawValue);
              // seguimos escaneando: si el código resulta inválido, el caller vuelve
              // a poner su bandera de "ya detectado" en false y debe poder reintentar.
            }
          } catch {
            // frame no decodificable; seguimos intentando
          }
          frame = requestAnimationFrame(detectar);
        };
        frame = requestAnimationFrame(detectar);
      })
      .catch((err) => {
        setEstado(err?.name === "NotAllowedError" ? "permiso-denegado" : "error");
      });

    return () => {
      detenido = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [activo]);

  return { videoRef, estado };
}
