import { useAuth } from "../auth/AuthContext";

/** Los clientes usan la app del Paseo; la web es para administración, negocios y oficinas. */
export function ClienteApp() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <main className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center gap-4 p-space-lg text-center">
      <img src="/logo-360.svg" alt="Paseo Aranjuez 360" className="w-56 max-w-full" />
      <p className="font-headline-sm text-headline-sm text-primary">Hola, {usuario?.first_name || usuario?.email}.</p>
      <p className="font-body-md text-body-md max-w-sm text-on-surface-variant">
        Tu cuenta es de cliente: tus monedas, pedidos de Comer, entradas y recompensas están en la
        <strong> app del Paseo</strong> en tu celular. Este sitio es el panel de la administración, los negocios y las oficinas.
      </p>
      <button
        type="button"
        className="rounded-lg bg-primary px-space-md py-space-sm text-on-primary"
        onClick={cerrarSesion}
      >
        Cerrar sesión
      </button>
    </main>
  );
}
