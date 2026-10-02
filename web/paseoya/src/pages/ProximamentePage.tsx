interface Props {
  titulo: string;
}

export function ProximamentePage({ titulo }: Props) {
  return (
    <div className="pagina">
      <h1>{titulo}</h1>
      <p className="proximamente">Pantalla pendiente de construir.</p>
    </div>
  );
}
