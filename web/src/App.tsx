import { Eye, Layers, Package, Percent, Store } from 'lucide-react';
import { useState } from 'react';
import { api, useDb } from './api/db';
import { PillNav, type NavItem } from './components/PillNav';
import { abiertoAhora } from './lib/image';
import { MiLocal } from './pages/MiLocal';
import { MisCombos } from './pages/MisCombos';
import { MisProductos } from './pages/MisProductos';
import { Presentacion } from './pages/Presentacion';
import { Promociones } from './pages/Promociones';

type Tab = 'productos' | 'combos' | 'local' | 'promos' | 'presentacion';

export default function App() {
  const { negocio, productos } = useDb();
  const [tab, setTab] = useState<Tab>('productos');

  const items: NavItem<Tab>[] = [
    { key: 'productos', label: 'Mis productos', icon: Package },
    { key: 'combos', label: 'Combos', icon: Layers },
    { key: 'local', label: 'Mi local', icon: Store },
    { key: 'promos', label: 'Promociones', icon: Percent, badge: productos.filter((p) => p.en_promocion).length },
    { key: 'presentacion', label: 'Ver presentación', icon: Eye },
  ];

  const abierto = negocio.activo && abiertoAhora(negocio.horario) !== false;
  const ubic = [negocio.piso && `Piso ${negocio.piso}`, negocio.local && `Local ${negocio.local}`].filter(Boolean).join(' · ');

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="avatar">{negocio.logo_url ? <img src={negocio.logo_url} alt="" /> : (negocio.nombre[0] ?? '?').toUpperCase()}</div>
          <div>
            <p className="eyebrow">PaseoYa · Panel del negocio</p>
            <b>{negocio.nombre}</b>
            <small>
              {ubic} <i className={`dotc`} style={{ background: abierto ? 'var(--green)' : '#9aa1b2' }} /> {abierto ? 'Abierto ahora' : 'Cerrado'}
            </small>
          </div>
        </div>
        <PillNav items={items} value={tab} onChange={setTab} />
        <div className="estado">
          Estado
          <div className="seg" role="group" aria-label="Estado del negocio">
            <button className={negocio.activo ? 'on' : ''} onClick={() => api.saveNegocio({ ...negocio, activo: true })}>
              Abierto
            </button>
            <button className={!negocio.activo ? 'on' : ''} onClick={() => api.saveNegocio({ ...negocio, activo: false })}>
              Cerrado
            </button>
          </div>
        </div>
      </header>
      <main>
        {tab === 'productos' && <MisProductos />}
        {tab === 'combos' && <MisCombos />}
        {tab === 'local' && <MiLocal key={negocio.id} onVerPresentacion={() => setTab('presentacion')} />}
        {tab === 'promos' && <Promociones />}
        {tab === 'presentacion' && <Presentacion />}
      </main>
    </div>
  );
}
