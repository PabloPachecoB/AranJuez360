/** Reduce una imagen a JPEG de máximo `max` px para guardarla liviana (data URL). */
export function fileToDataUrl(file: File, max = 900, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Archivo de imagen no válido'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas no disponible'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const bs = (n: number) => `Bs ${n.toFixed(2)}`;

/** true/false según la hora actual; null si no se puede leer el horario. */
export function abiertoAhora(horario: string, now = new Date()): boolean | null {
  const m = horario.match(/(\d{1,2}):(\d{2})\s*a\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const open = +m[1] * 60 + +m[2];
  const close = +m[3] * 60 + +m[4];
  const cur = now.getHours() * 60 + now.getMinutes();
  return open <= close ? cur >= open && cur < close : cur >= open || cur < close;
}

export const SECCION_BASE = 'General';

/** Agrupa productos por sección (A–Z; "General" al final) para armar el menú. */
export function agruparPorSeccion<T extends { seccion?: string }>(items: T[]): [string, T[]][] {
  const mapa = new Map<string, T[]>();
  for (const it of items) {
    const s = it.seccion?.trim() || SECCION_BASE;
    mapa.set(s, [...(mapa.get(s) ?? []), it]);
  }
  return [...mapa.entries()].sort(([a], [b]) => (a === SECCION_BASE ? 1 : b === SECCION_BASE ? -1 : a.localeCompare(b, 'es')));
}

/** Secciones sugeridas según el rubro, tomadas de menús reales del Paseo. */
export const SECCIONES_SUGERIDAS = ['Bebidas calientes', 'Bebidas frías', 'Jugos', 'Chocolates', 'Repostería dulce', 'Repostería salada', 'Platos de fondo', 'Entradas'];
