import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

type Props = { title: string; eyebrow?: string; onClose: () => void; children: ReactNode };

export function Modal({ title, eyebrow, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>
            {eyebrow && <p className="modal-eyebrow">{eyebrow}</p>}
            <h3>{title}</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
