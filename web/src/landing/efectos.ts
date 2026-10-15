// Interacciones compartidas por las portadas de Stitch (/inicio y /inicio-cinematico).

/** Inclinación 3D del teléfono según el mouse. Devuelve la función que la desactiva. */
export function activarInclinacionTelefono(raiz: HTMLElement): () => void {
  const wrapper = raiz.querySelector<HTMLElement>("#phoneWrapper");
  const phone = raiz.querySelector<HTMLElement>("#interactivePhone");
  const glare = raiz.querySelector<HTMLElement>("#phoneGlare");
  if (!wrapper || !phone) return () => {};

  const onMove = (e: MouseEvent) => {
    const rect = wrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotateX = ((y - cy) / cy) * -14;
    const rotateY = ((x - cx) / cx) * 14;
    phone.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
    if (glare) {
      const gx = (x / rect.width) * 100;
      const gy = (y / rect.height) * 100;
      glare.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%)`;
    }
  };
  const onLeave = () => {
    phone.style.transform = "rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    phone.style.transition = "transform 0.5s ease-out";
    if (glare) glare.style.background = "linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)";
  };
  const onEnter = () => {
    phone.style.transition = "transform 0.1s ease-out";
  };
  wrapper.addEventListener("mousemove", onMove);
  wrapper.addEventListener("mouseleave", onLeave);
  wrapper.addEventListener("mouseenter", onEnter);
  return () => {
    wrapper.removeEventListener("mousemove", onMove);
    wrapper.removeEventListener("mouseleave", onLeave);
    wrapper.removeEventListener("mouseenter", onEnter);
  };
}

/** Filtro de comercios por categoría; `animacion` es la que se aplica a las tarjetas que aparecen. */
export function activarFiltroComercios(raiz: HTMLElement, animacion: string): () => void {
  const botones = raiz.querySelectorAll<HTMLElement>(".cat-filter-btn");
  const tarjetas = raiz.querySelectorAll<HTMLElement>(".store-card");
  const limpiezas: Array<() => void> = [];

  botones.forEach((boton) => {
    const onClick = () => {
      const cat = boton.getAttribute("data-cat");
      botones.forEach((btn) => {
        btn.classList.remove("bg-primary-container", "text-on-primary", "shadow-sm", "active");
        btn.classList.add("text-on-surface-variant");
      });
      boton.classList.add("bg-primary-container", "text-on-primary", "shadow-sm", "active");
      boton.classList.remove("text-on-surface-variant");
      tarjetas.forEach((card) => {
        if (cat === "todas" || card.getAttribute("data-category") === cat) {
          card.style.display = "flex";
          card.style.animation = animacion;
        } else {
          card.style.display = "none";
        }
      });
    };
    boton.addEventListener("click", onClick);
    limpiezas.push(() => boton.removeEventListener("click", onClick));
  });
  return () => limpiezas.forEach((fn) => fn());
}
