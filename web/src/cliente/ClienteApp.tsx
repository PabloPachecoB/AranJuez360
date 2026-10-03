import { useAuth } from "../auth/AuthContext";

export function ClienteApp() {
  const { usuario, cerrarSesion } = useAuth();

  return (
    <main className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center gap-4 p-space-lg">
      <h1 className="font-headline-lg text-headline-lg text-primary">PaseoYa</h1>
      <p className="font-body-md text-body-md">Hola, {usuario?.first_name || usuario?.email}.</p>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Tu sesión de cliente está activa. Este panel está en preparación.
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
