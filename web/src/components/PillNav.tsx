import type { LucideIcon } from 'lucide-react';

export type NavItem<T extends string> = { key: T; label: string; icon: LucideIcon; badge?: number };

export function PillNav<T extends string>({ items, value, onChange }: { items: NavItem<T>[]; value: T; onChange: (k: T) => void }) {
  return (
    <nav className="pillnav" aria-label="Secciones">
      {items.map(({ key, label, icon: Icon, badge }) => (
        <button key={key} className={key === value ? 'active' : ''} onClick={() => onChange(key)}>
          <Icon size={20} />
          {label}
          {badge != null && badge > 0 && <b>{badge}</b>}
        </button>
      ))}
    </nav>
  );
}
