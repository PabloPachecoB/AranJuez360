import { ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { fileToDataUrl } from '../lib/image';

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label: string;
  hint?: string;
  square?: boolean;
};

/** Zona para soltar o elegir fotos. Con max=1 funciona como foto única. */
export function ImageUploader({ value, onChange, max = 1, label, hint, square }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add(files: FileList | File[]) {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    setBusy(true);
    try {
      const urls = await Promise.all(imgs.slice(0, max - value.length || 1).map((f) => fileToDataUrl(f)));
      onChange(max === 1 ? urls.slice(0, 1) : [...value, ...urls].slice(0, max));
    } finally {
      setBusy(false);
    }
  }

  const full = max > 1 && value.length >= max;

  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className={`thumbs ${square ? 'square' : ''}`}>
        {value.map((url, i) => (
          <div className="thumb" key={i}>
            <img src={url} alt="" />
            <button type="button" className="thumb-x" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Quitar foto">
              <X size={14} />
            </button>
          </div>
        ))}
        {!full && !(max === 1 && value.length === 1) && (
          <button
            type="button"
            className={`drop ${drag ? 'drag' : ''}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void add(e.dataTransfer.files);
            }}>
            <ImagePlus size={22} />
            <span>{busy ? 'Subiendo…' : max > 1 ? 'Agregar fotos' : 'Subir foto'}</span>
          </button>
        )}
      </div>
      {hint && <span className="hint">{hint}</span>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={max > 1}
        hidden
        onChange={(e) => {
          if (e.target.files) void add(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
