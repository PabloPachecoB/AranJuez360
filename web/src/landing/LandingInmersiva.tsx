import { useEffect, useRef } from "react";
import { iniciarShader } from "./shader";
import { activarFiltroComercios, activarInclinacionTelefono } from "./efectos";

/**
 * Paseo Aranjuez 360 — Experiencia Web Inmersiva (Desktop).
 * Portada pública tomada de la pantalla de Stitch; ruta: /inicio.
 */
export default function LandingInmersiva() {
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const limpiezas: Array<() => void> = [];

    // 0. Fondo WebGL del hero
    const canvas = el.querySelector<HTMLCanvasElement>("#shader-canvas-ANIMATION_38");
    if (canvas) limpiezas.push(iniciarShader(canvas));

    // 1. Inclinación 3D del teléfono según el mouse
    limpiezas.push(activarInclinacionTelefono(el));

    // 2. Filtro de comercios por categoría
    limpiezas.push(activarFiltroComercios(el, "fadeIn 0.35s ease-out forwards"));

    return () => limpiezas.forEach((fn) => fn());
  }, []);

  return (
    <div ref={raiz} className="landing-360 bg-background font-body-md text-on-surface min-h-screen">
<header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,43,73,0.06)]"><div className="h-20 max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between gap-6"><div className="flex items-center gap-3 shrink-0"><div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary shadow-sm"><span className="material-symbols-outlined text-[24px]">view_in_ar</span></div><div className="flex flex-col"><span className="font-headline-sm text-headline-sm font-bold tracking-tight text-primary leading-none">PASEO ARANJUEZ</span><span className="font-label-caps text-label-caps tracking-widest text-secondary uppercase">Experiencia 360 · Cochabamba</span></div></div><nav className="hidden xl:flex items-center gap-7" data-active-classes="text-secondary font-semibold"><a aria-current="page" className="transition-colors text-secondary font-semibold" data-path="inicio" href="#">Inicio</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="los-3-pilares" href="#">Los 3 Pilares</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="como-funciona" href="#">Cómo Funciona</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="70-tiendas" href="#">70 Tiendas</a><a className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors" data-path="para-negocios" href="#">Para Negocios</a></nav><div className="flex items-center gap-3 shrink-0"><a className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-full font-label-md text-label-md font-semibold text-primary-container hover:bg-surface-container-high transition-colors" data-path="portal-negocios-login" href="/">Portal Negocios</a><a className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-container hover:bg-tertiary-container text-on-primary font-label-md text-label-md font-semibold shadow-[0_2px_8px_-2px_rgba(0,34,59,0.12)] transition-all transform active:scale-95" data-path="descargar-app" href="#"><span className="material-symbols-outlined text-[18px]">smartphone</span><span>Descargar App 360</span></a><div className="hidden md:flex items-center pl-2 ml-1 border-l border-outline-variant/30"><img alt="Profile" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-container/10" src="https://lh3.googleusercontent.com/aida/AEtjO1Va1az1w3ugCACC1LxPIk5L7-yHO7HDjRl4dr9NrqM2cjuIJpPmVDUGxE-lt2UyMLHEmfm-2cY00X5IVzeUKROleud5vcV1-chjCJgJ7DwCOqhqRbUAMwtRAk6m8vDNwdM32aKUOTXzCv50A3Fmi9Dt3GTFmtD73z0BJE6FyiG-s_LYlZbBrBuej-9Kav2-AtQlGIoyozXkj-khMmA9683hA0cIyJLpWp-us_q9WmKIJXroMtXUdWnF6c7DQDBW81g_dEF2aOmwvPM" /></div></div></div></header><main className="w-full pt-20 bg-background"><div className="flex flex-col w-full">

{/* El fondo ocupa todo el ancho de la pantalla; el contenido queda centrado dentro */}
<div className="relative overflow-hidden w-full">
<div className="absolute inset-0 w-full h-full pointer-events-none opacity-60 z-0" style={{ display: "block" }}>
<canvas id="shader-canvas-ANIMATION_38" style={{ display: "block", width: "100%", height: "100%" }}></canvas>

</div>
<div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-secondary-container/15 blur-3xl pointer-events-none z-0"></div>
<div className="absolute top-1/2 -right-32 w-[30rem] h-[30rem] rounded-full bg-primary-fixed/30 blur-3xl pointer-events-none z-0"></div>
<section className="relative pt-8 pb-20 lg:py-24 px-6 lg:px-12 max-w-7xl mx-auto w-full" id="heroSection">
<div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">

<div className="lg:col-span-7 flex flex-col items-start space-y-6">

<div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-container-high/80 shadow-sm backdrop-blur-md border border-outline-variant/30">
<span className="relative flex h-2.5 w-2.5">
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-container opacity-75"></span>
<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
</span>
<span className="font-label-caps text-label-caps text-primary tracking-widest uppercase font-bold">Mall Paseo Aranjuez · Cochabamba, Bolivia</span>
</div>

<h1 className="font-display-hero text-display-hero text-primary tracking-tight font-extrabold max-w-xl">
          Todo el Paseo Aranjuez en la <span className="text-secondary">palma de tu mano.</span>
</h1>

<p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
          La super-app oficial para pedir y retirar sin filas en 70 tiendas, acumular <strong className="text-primary font-semibold">Paseo Points</strong> en cada visita y explorar el mall asistido por <strong className="text-primary font-semibold">Jarvis IA</strong>.
        </p>

<div className="flex flex-wrap items-center gap-4 pt-2 w-full sm:w-auto">
<a className="inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-primary-container text-on-primary font-label-lg text-label-lg font-bold shadow-md hover:bg-tertiary-container hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 transform active:scale-95" href="#descarga-app">
<span className="material-symbols-outlined text-[22px]">file_download</span>
<div className="text-left flex flex-col leading-none">
<span className="text-[10px] uppercase tracking-wider text-on-primary/70">Descargar en</span>
<span className="font-bold">App Store</span>
</div>
</a>
<a className="inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-surface-container-lowest text-primary font-label-lg text-label-lg font-bold shadow-sm hover:bg-surface-container hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transform active:scale-95" href="#descarga-app">
<span className="material-symbols-outlined text-[22px] text-secondary">play_arrow</span>
<div className="text-left flex flex-col leading-none">
<span className="text-[10px] uppercase tracking-wider text-on-surface-variant">Disponible en</span>
<span className="font-bold">Google Play</span>
</div>
</a>
<a className="inline-flex items-center gap-1.5 px-4 py-3 text-secondary font-label-lg text-label-lg font-semibold hover:text-primary transition-colors group" href="#como-funciona">
<span>Ver demo interactiva</span>
<span className="material-symbols-outlined text-[18px] group-hover:translate-y-1 transition-transform">arrow_downward</span>
</a>
</div>

<div className="pt-6 grid grid-cols-3 gap-6 w-full max-w-lg">
<div className="flex flex-col">
<span className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">70+</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Tiendas y cafés</span>
</div>
<div className="flex flex-col">
<span className="font-headline-lg text-headline-lg font-bold text-secondary tracking-tight">0%</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Recargo pickup</span>
</div>
<div className="flex flex-col">
<div className="flex items-center gap-1">
<span className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">4.9</span>
<span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
</div>
<span className="font-body-sm text-body-sm text-on-surface-variant">App Store &amp; Play</span>
</div>
</div>
</div>

<div className="lg:col-span-5 relative flex justify-center items-center py-6" id="phoneWrapper" style={{ perspective: "1000px" }}>

<div className="hidden sm:flex absolute -left-8 top-8 z-30 items-center gap-3 p-3.5 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,43,73,0.18)] border border-secondary-container/20 animate-float-1 transition-transform hover:scale-105">
<div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary shrink-0">
<span className="material-symbols-outlined text-[22px]">shopping_bag</span>
</div>
<div className="flex flex-col pr-2">
<div className="flex items-center gap-1.5">
<span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
<span className="font-label-md text-label-md font-bold text-primary">Orden lista en Typica Café</span>
</div>
<span className="font-body-sm text-[11px] text-secondary font-semibold leading-tight">Nivel 2 · Mostrador Express</span>
</div>
</div>

<div className="hidden sm:flex absolute -right-6 bottom-12 z-30 items-center gap-3 p-3.5 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,43,73,0.18)] border border-secondary/20 animate-float-2 transition-transform hover:scale-105">
<div className="w-10 h-10 rounded-xl bg-primary-container text-secondary-container flex items-center justify-center shrink-0 relative">
<span className="material-symbols-outlined text-[22px]">auto_awesome</span>
<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-secondary-container rounded-full animate-pulse"></span>
</div>
<div className="flex flex-col pr-2">
<span className="font-label-md text-label-md font-bold text-primary">Jarvis 360 Escuchando</span>
<div className="flex items-center gap-1 pt-0.5">
<span className="w-1 h-2.5 bg-secondary rounded-full animate-bounce"></span>
<span className="w-1 h-4 bg-secondary-container rounded-full animate-bounce" style={{ animationDelay: "0.15s" }}></span>
<span className="w-1 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></span>
<span className="font-body-sm text-[11px] text-on-surface-variant leading-tight pl-1">Voz activa en tiempo real</span>
</div>
</div>
</div>

<div className="hidden sm:flex absolute right-2 top-2 z-30 items-center gap-2 px-3.5 py-2 rounded-full bg-secondary text-on-secondary shadow-lg border border-secondary-container/30 animate-float-3 transition-transform hover:scale-105">
<span className="material-symbols-outlined text-[16px] text-secondary-container animate-spin" style={{ animationDuration: "8s" }}>stars</span>
<span className="font-label-caps text-[10px] tracking-wider uppercase font-bold">+450 Pts ganados hoy</span>
</div>

<div className="relative w-[310px] h-[630px] rounded-[48px] bg-primary p-3.5 shadow-[0_25px_50px_-12px_rgba(0,43,73,0.45)] transition-all duration-200 ease-out" id="interactivePhone" style={{ transformStyle: "preserve-3d", transform: "rotateX(0deg) rotateY(0deg)" }}>

<div className="absolute inset-x-8 top-3 h-36 bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-t-[36px] pointer-events-none transition-opacity duration-300" id="phoneGlare"></div>

<div className="relative w-full h-full bg-background rounded-[38px] overflow-hidden flex flex-col shadow-inner">

<div className="pt-3 pb-2 px-6 flex items-center justify-between z-30">
<span className="font-label-caps text-[11px] font-bold text-primary">09:41</span>
<div className="w-24 h-5 bg-primary rounded-full flex items-center justify-end px-2 space-x-1.5 shadow-xs">
<span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-pulse"></span>
<span className="w-2 h-2 rounded-full bg-on-primary/60"></span>
</div>
<div className="flex items-center gap-1 text-primary">
<span className="material-symbols-outlined text-[14px]">wifi</span>
<span className="material-symbols-outlined text-[14px]">battery_full</span>
</div>
</div>

<div className="px-5 pt-2 pb-3 flex items-center justify-between">
<div className="flex items-center gap-2.5">
<div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-[12px] shadow-sm">PA</div>
<div className="flex flex-col">
<span className="font-label-caps text-[9px] uppercase tracking-wider text-secondary font-bold">Bienvenido a</span>
<span className="font-label-md text-label-md font-bold text-primary leading-none">Paseo Aranjuez</span>
</div>
</div>
<div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary relative">
<span className="material-symbols-outlined text-[18px]">notifications</span>
<span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full animate-ping"></span>
<span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
</div>
</div>

<div className="flex-1 px-4 space-y-3 overflow-hidden">

<div className="p-3.5 rounded-2xl bg-surface-container-lowest shadow-sm space-y-2.5 border border-surface-container-high/60">
<div className="flex items-center justify-between">
<div className="flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
<span className="font-label-caps text-[10px] uppercase font-bold text-primary tracking-wide">Orden en curso · #P-342</span>
</div>
<span className="text-[10px] font-semibold text-secondary px-2 py-0.5 rounded-full bg-secondary-fixed">Nivel 2</span>
</div>
<div className="flex items-center justify-between">
<div>
<h4 className="font-label-lg text-label-lg font-bold text-primary leading-tight">Typica Café Aranjuez</h4>
<p className="font-body-sm text-[11px] text-on-surface-variant">1x Chemex + 1x Croissant Almendras</p>
</div>
<div className="text-right">
<span className="font-headline-sm text-headline-sm font-extrabold text-secondary leading-none">4 min</span>
<span className="block text-[9px] text-on-surface-variant font-medium">Listo p/ retirar</span>
</div>
</div>
<div className="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
<div className="bg-gradient-to-r from-secondary-container to-secondary h-full w-4/5 rounded-full"></div>
</div>
</div>

<div className="p-3.5 rounded-2xl bg-gradient-to-br from-primary-container via-[#043355] to-tertiary-container text-on-primary shadow-sm flex items-center justify-between">
<div>
<span className="text-[10px] text-on-primary-container font-medium block">Balance disponible</span>
<div className="flex items-baseline gap-1">
<span className="font-headline-md text-headline-md font-extrabold text-on-primary">1,280</span>
<span className="text-[11px] font-semibold text-secondary-container">PTS</span>
</div>
<span className="text-[9px] text-on-primary-container/80">Equivale a Bs 64 en consumo</span>
</div>
<a className="px-3 py-1.5 rounded-full bg-surface-container-lowest/15 hover:bg-surface-container-lowest/25 backdrop-blur-sm text-[11px] font-bold text-on-primary transition-colors" href="#pilares">Canjear</a>
</div>

<div className="p-3 rounded-2xl bg-surface-container-low flex items-center gap-3 border border-outline-variant/30">
<div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-on-secondary shrink-0 shadow-xs">
<span className="material-symbols-outlined text-[16px]">mic</span>
</div>
<div className="flex-1 min-w-0">
<span className="text-[10px] font-bold text-primary block leading-tight">Jarvis Asistente 360</span>
<div className="flex items-center gap-1 pt-1 h-3.5">
<span className="w-1 h-2 bg-secondary rounded-full animate-bounce"></span>
<span className="w-1 h-3.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "0.15s" }}></span>
<span className="w-1 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></span>
<span className="w-1 h-3 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "0.45s" }}></span>
<span className="w-1 h-1.5 bg-secondary rounded-full"></span>
<span className="text-[10px] text-on-surface-variant truncate ml-1 font-medium">"¿Dónde consigo café tranquilo?"</span>
</div>
</div>
</div>

<div className="grid grid-cols-3 gap-2 pt-1">
<div className="p-2 rounded-xl bg-surface-container-lowest text-center shadow-xs border border-surface-container-high/40 hover:bg-surface-container-low transition-colors">
<span className="material-symbols-outlined text-secondary text-[20px]">restaurant</span>
<span className="block text-[10px] font-semibold text-primary mt-0.5">Comida</span>
</div>
<div className="p-2 rounded-xl bg-surface-container-lowest text-center shadow-xs border border-surface-container-high/40 hover:bg-surface-container-low transition-colors">
<span className="material-symbols-outlined text-secondary text-[20px]">movie</span>
<span className="block text-[10px] font-semibold text-primary mt-0.5">Cine</span>
</div>
<div className="p-2 rounded-xl bg-surface-container-lowest text-center shadow-xs border border-surface-container-high/40 hover:bg-surface-container-low transition-colors">
<span className="material-symbols-outlined text-secondary text-[20px]">local_parking</span>
<span className="block text-[10px] font-semibold text-primary mt-0.5">Parqueo</span>
</div>
</div>
</div>

<div className="p-3 bg-surface-container-lowest shadow-md flex justify-around items-center border-t border-surface-container/60">
<span className="material-symbols-outlined text-primary text-[22px]">home</span>
<span className="material-symbols-outlined text-outline text-[22px]">storefront</span>
<div className="w-9 h-9 -mt-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-md transform hover:scale-110 transition-transform">
<span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
</div>
<span className="material-symbols-outlined text-outline text-[22px]">loyalty</span>
<span className="material-symbols-outlined text-outline text-[22px]">person</span>
</div>
</div>
</div>
</div>
</div>
</section>
</div>

<section className="w-full py-20 px-6 lg:px-12 bg-surface-container-low/60" id="pilares">
<div className="max-w-7xl mx-auto space-y-12">

<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
<div className="space-y-3 max-w-xl">
<div className="inline-flex items-center gap-2 text-secondary font-label-caps text-label-caps uppercase tracking-wider font-bold">
<span className="material-symbols-outlined text-[16px]">layers</span>
<span>Innovación en Cochabamba</span>
</div>
<h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight">
            Tres pilares diseñados para tu visita sin fricciones.
          </h2>
</div>
<p className="font-body-md text-body-md text-on-surface-variant max-w-md">
          Unificamos el comercio presencial del Paseo Aranjuez con tecnología de vanguardia para compras, lealtad y navegación inteligente.
        </p>
</div>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

<div className="group rounded-3xl bg-surface-container-lowest p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between border border-transparent hover:border-secondary-container/30">
<div className="space-y-6">
<div className="flex items-center justify-between">
<div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
<span className="material-symbols-outlined text-[28px]">shopping_bag_speed</span>
</div>
<span className="font-label-caps text-[12px] font-extrabold text-primary px-3 py-1 bg-surface-container rounded-full">01 / PASEOYA</span>
</div>
<div className="space-y-2">
<h3 className="font-headline-sm text-headline-sm font-bold text-primary">Compra online y retira en el local</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Pide tu almuerzo, café o prenda desde el auto o mientras caminas por el mall. Retira directo en el mostrador del comercio con 0% recargos de envío.
              </p>
</div>

<div className="p-5 rounded-2xl bg-surface-container-low space-y-4">
<div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
<div>
<span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">Ticket PaseoYa</span>
<span className="font-title-lg text-title-lg font-extrabold text-primary">Turno #K-902</span>
</div>
<div className="text-right">
<span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Listo p/ recoger</span>
</div>
</div>

<div className="flex flex-col items-center justify-center pt-1 space-y-1">
<div className="flex items-center space-x-1 h-9 opacity-85">
<span className="w-1 h-full bg-primary"></span>
<span className="w-2 h-full bg-primary"></span>
<span className="w-0.5 h-full bg-primary"></span>
<span className="w-1.5 h-full bg-primary"></span>
<span className="w-1 h-full bg-primary"></span>
<span className="w-3 h-full bg-primary"></span>
<span className="w-0.5 h-full bg-primary"></span>
<span className="w-2 h-full bg-primary"></span>
<span className="w-1 h-full bg-primary"></span>
<span className="w-1.5 h-full bg-primary"></span>
<span className="w-0.5 h-full bg-primary"></span>
<span className="w-2 h-full bg-primary"></span>
</div>
<span className="font-label-caps text-[10px] tracking-widest text-outline">MOSTRAR EN TIENDA</span>
</div>
</div>
</div>
<div className="pt-6">
<span className="inline-flex items-center gap-2 font-label-md text-label-md font-bold text-secondary group-hover:translate-x-1 transition-transform">
              Conocer más de PaseoYa <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</span>
</div>
</div>

<div className="group rounded-3xl bg-surface-container-lowest p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between border border-transparent hover:border-secondary-container/30">
<div className="space-y-6">
<div className="flex items-center justify-between">
<div className="w-14 h-14 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
<span className="material-symbols-outlined text-[28px]">rewarded_ads</span>
</div>
<span className="font-label-caps text-[12px] font-extrabold text-secondary px-3 py-1 bg-secondary-fixed rounded-full">02 / LEALTAD</span>
</div>
<div className="space-y-2">
<h3 className="font-headline-sm text-headline-sm font-bold text-primary">Acumula puntos y canjea premios</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Cada consumo en los 70 locales suma Paseo Points. Canjéalos por entradas para Multicine, horas de parqueo subterráneo o postres en Dumbo.
              </p>
</div>

<div className="p-5 rounded-2xl bg-surface-container-low space-y-3">
<div className="flex items-center justify-between">
<span className="font-label-md text-label-md font-bold text-primary">Recompensas Populares</span>
<span className="font-label-caps text-[10px] text-secondary font-bold">VER TODAS</span>
</div>
<div className="space-y-2">
<div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-secondary text-[20px]">movie</span>
<div>
<span className="font-label-md text-[13px] font-bold text-primary block leading-tight">Boleto 2D Multicine</span>
<span className="text-[10px] text-on-surface-variant">Lunes a Domingo</span>
</div>
</div>
<span className="font-label-md text-label-md font-extrabold text-secondary">600 pts</span>
</div>
<div className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container transition-colors">
<div className="flex items-center gap-2.5">
<span className="material-symbols-outlined text-secondary text-[20px]">icecream</span>
<div>
<span className="font-label-md text-[13px] font-bold text-primary block leading-tight">Copa Helado Dumbo</span>
<span className="text-[10px] text-on-surface-variant">2 sabores artesanales</span>
</div>
</div>
<span className="font-label-md text-label-md font-extrabold text-secondary">350 pts</span>
</div>
</div>
</div>
</div>
<div className="pt-6">
<span className="inline-flex items-center gap-2 font-label-md text-label-md font-bold text-secondary group-hover:translate-x-1 transition-transform">
              Explorar catálogo de premios <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</span>
</div>
</div>

<div className="group rounded-3xl bg-surface-container-lowest p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between border border-transparent hover:border-secondary-container/30">
<div className="space-y-6">
<div className="flex items-center justify-between">
<div className="w-14 h-14 rounded-2xl bg-tertiary-container text-secondary-container flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
<span className="material-symbols-outlined text-[28px]">graphic_eq</span>
</div>
<span className="font-label-caps text-[12px] font-extrabold text-primary px-3 py-1 bg-surface-container rounded-full">03 / JARVIS IA</span>
</div>
<div className="space-y-2">
<h3 className="font-headline-sm text-headline-sm font-bold text-primary">Asistente por voz para el mall</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Pregúntale a Jarvis por productos específicos, promociones del día, horarios o la ruta más rápida hacia cualquier tienda o baño dentro del centro comercial.
              </p>
</div>

<div className="p-5 rounded-2xl bg-primary-container text-on-primary space-y-3 relative overflow-hidden">
<div className="flex items-center justify-between text-secondary-container">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-[18px]">neurology</span>
<span className="font-label-caps text-[10px] uppercase font-bold tracking-wider">Jarvis Response · En vivo</span>
</div>
<div className="flex items-center gap-1.5">
<span className="w-1.5 h-1.5 rounded-full bg-secondary-container animate-ping"></span>
<span className="text-[10px] font-mono text-on-primary-container">0.3s</span>
</div>
</div>

<div className="flex items-center justify-center gap-2 py-4 h-14" id="audioWaveVisualizer">
<span className="w-1.5 bg-secondary-container rounded-full jarvis-bar-1"></span>
<span className="w-1.5 bg-secondary-container rounded-full jarvis-bar-2"></span>
<span className="w-1.5 bg-secondary rounded-full jarvis-bar-3"></span>
<span className="w-1.5 bg-on-primary rounded-full jarvis-bar-4 shadow-sm"></span>
<span className="w-1.5 bg-secondary-container rounded-full jarvis-bar-5"></span>
<span className="w-1.5 bg-secondary-container rounded-full jarvis-bar-6"></span>
<span className="w-1.5 bg-secondary-container rounded-full jarvis-bar-7"></span>
</div>
<div className="p-2.5 rounded-xl bg-surface-container-lowest/10 text-on-primary text-[12px] leading-snug border border-surface-container-lowest/10">
                "Te sugiero la terraza de <strong className="text-secondary-container font-semibold">Typica Café</strong> en el Nivel 2. Tienen wifi rápido y vista panorámica a la Av. América."
              </div>
</div>
</div>
<div className="pt-6">
<span className="inline-flex items-center gap-2 font-label-md text-label-md font-bold text-secondary group-hover:translate-x-1 transition-transform">
              Hablar con Jarvis Demo <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
</span>
</div>
</div>
</div>
</div>
</section>

<section className="py-20 px-6 lg:px-12 max-w-7xl mx-auto w-full" id="como-funciona">
<div className="space-y-14">
<div className="text-center max-w-2xl mx-auto space-y-3">
<span className="font-label-caps text-label-caps uppercase text-secondary font-bold tracking-widest">Paso a paso</span>
<h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight">Tu nueva rutina en Paseo Aranjuez</h2>
<p className="font-body-md text-body-md text-on-surface-variant">Olvídate de hacer filas interminables en el patio de comidas o esperar por una mesa sin saber cuándo estará tu pedido.</p>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">

<div className="hidden lg:block absolute top-1/2 left-12 right-12 h-1 bg-surface-container-high -translate-y-8 z-0"></div>

<div className="relative z-10 flex flex-col p-6 rounded-3xl bg-surface-container-lowest shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 space-y-4 border border-outline-variant/20">
<div className="w-14 h-14 rounded-2xl bg-surface-container-high text-primary flex items-center justify-center font-headline-sm font-extrabold shadow-sm">
            01
          </div>
<div className="space-y-2">
<h4 className="font-title-lg text-title-lg font-bold text-primary">Explora las 70 Tiendas</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">
              Revisa menús en vivo, catálogos de moda, ofertas flash y cartelera de Multicine con asientos disponibles.
            </p>
</div>
<div className="pt-2 flex items-center gap-2 text-secondary font-label-caps text-[11px] font-bold">
<span className="material-symbols-outlined text-[16px]">explore</span>
<span>DIRECTORIO SIN FILAS</span>
</div>
</div>

<div className="relative z-10 flex flex-col p-6 rounded-3xl bg-surface-container-lowest shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 space-y-4 border border-outline-variant/20">
<div className="w-14 h-14 rounded-2xl bg-surface-container-high text-primary flex items-center justify-center font-headline-sm font-extrabold shadow-sm">
            02
          </div>
<div className="space-y-2">
<h4 className="font-title-lg text-title-lg font-bold text-primary">Ordena con PaseoYa</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">
              Elige tus productos y paga en segundos mediante Simple QR boliviano, tarjeta de débito o crédito nacional.
            </p>
</div>
<div className="pt-2 flex items-center gap-2 text-secondary font-label-caps text-[11px] font-bold">
<span className="material-symbols-outlined text-[16px]">qr_code</span>
<span>PAGO SEGURO SIMPLE QR</span>
</div>
</div>

<div className="relative z-10 flex flex-col p-6 rounded-3xl bg-surface-container-lowest shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 space-y-4 border border-outline-variant/20">
<div className="w-14 h-14 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center font-headline-sm font-extrabold shadow-md">
            03
          </div>
<div className="space-y-2">
<h4 className="font-title-lg text-title-lg font-bold text-primary">Retira en Mostrador</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">
              Recibe la notificación push cuando esté listo, acércate al local y muestra tu ticket digital. ¡Cero espera!
            </p>
</div>
<div className="pt-2 flex items-center gap-2 text-secondary font-label-caps text-[11px] font-bold">
<span className="material-symbols-outlined text-[16px]">touch_app</span>
<span>EXPRESS PICKUP</span>
</div>
</div>

<div className="relative z-10 flex flex-col p-6 rounded-3xl bg-surface-container-lowest shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 space-y-4 border border-outline-variant/20">
<div className="w-14 h-14 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center font-headline-sm font-extrabold shadow-sm">
            04
          </div>
<div className="space-y-2">
<h4 className="font-title-lg text-title-lg font-bold text-primary">Gana Paseo Points</h4>
<p className="font-body-sm text-body-sm text-on-surface-variant">
              Cada compra suma puntos automáticos a tu billetera para canjear por estacionamiento libre, café y entradas.
            </p>
</div>
<div className="pt-2 flex items-center gap-2 text-secondary font-label-caps text-[11px] font-bold">
<span className="material-symbols-outlined text-[16px]">stars</span>
<span>CLUB EXCLUSIVO VIP</span>
</div>
</div>
</div>
</div>
</section>

<section className="py-20 px-6 lg:px-12 bg-surface-container-low/40 w-full" id="tiendas">
<div className="max-w-7xl mx-auto space-y-10">

<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
<div>
<span className="font-label-caps text-label-caps uppercase text-secondary font-bold tracking-widest">Catálogo Oficial</span>
<h2 className="font-headline-xl text-headline-xl text-primary font-bold tracking-tight">Comercios destacados en Aranjuez</h2>
</div>

<div className="relative flex items-center gap-1 p-1.5 rounded-full bg-surface-container-high/80 backdrop-blur-sm border border-outline-variant/30" id="categoryFilterContainer">
<button className="cat-filter-btn active relative z-10 px-5 py-2 rounded-full font-label-md text-label-md font-bold transition-all duration-300 text-on-primary bg-primary-container shadow-sm" data-cat="todas">
            Todas (70)
          </button>
<button className="cat-filter-btn relative z-10 px-5 py-2 rounded-full font-label-md text-label-md font-semibold text-on-surface-variant hover:text-primary transition-all duration-300" data-cat="gastro">
            Gastronomía
          </button>
<button className="cat-filter-btn relative z-10 px-5 py-2 rounded-full font-label-md text-label-md font-semibold text-on-surface-variant hover:text-primary transition-all duration-300" data-cat="moda">
            Moda &amp; Deportes
          </button>
<button className="cat-filter-btn relative z-10 px-5 py-2 rounded-full font-label-md text-label-md font-semibold text-on-surface-variant hover:text-primary transition-all duration-300" data-cat="entretenimiento">
            Entretenimiento
          </button>
</div>
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" id="storesGrid">

<div className="store-card group rounded-3xl bg-surface-container-lowest overflow-hidden shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,101,145,0.22)] hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between border border-transparent hover:border-secondary/30 relative" data-category="gastro">
<div>
<div className="relative h-52 w-full overflow-hidden">
<div className="w-full h-full bg-cover bg-center group-hover:scale-108 transition-transform duration-700 ease-out" data-alt="Modern artisanal coffee shop interior in Cochabamba with wooden accents, warm lighting, professional barista brewing pour-over coffee in high end glass apparatus and lush tropical greenery in Paseo Aranjuez mall." style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBM_eLZ8ksKpDFCOJphGmMWULvwB_JfPDFj2C9kdr2Ud3aI_Gr61mY2BwuQfd77mFd0ZN8a8ATQP4xn6WCvNZ1_arTTQaJJ48TjKcps1A-dONo8uHMKkYRybnKSfH_znFLZhzOD_z4KQxyR-D62okoHEH9Pry9mrDkaQ9KFbAUYuBPFIuX6945-_KLF0s2K5nWb45W6cTmibzR_ZIUV4e4b8h0sY7kn7m-IlXgDhjdeJLUjGDjjhrnL4A')" }}></div>
<div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
<span className="absolute top-4 left-4 font-label-caps text-[10px] font-bold px-3 py-1 rounded-full bg-primary-container/90 backdrop-blur-md text-on-primary shadow-sm">
                NIVEL 2 · TERRAZA
              </span>
<div className="absolute top-4 right-4 flex items-center gap-1 font-label-caps text-[10px] font-bold px-2.5 py-1 rounded-full bg-secondary text-on-secondary shadow-md transform group-hover:scale-105 transition-transform">
<span className="material-symbols-outlined text-[13px]">stars</span> +20 Pts
              </div>
<span className="absolute bottom-4 right-4 flex items-center gap-1 font-label-md text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary shadow-xs">
<span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> 4.9 (1.2k)
              </span>
</div>
<div className="p-6 space-y-3">
<div className="flex items-start justify-between">
<div>
<h3 className="font-headline-sm text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors">Typica Café Aranjuez</h3>
<span className="font-body-sm text-body-sm text-on-surface-variant">Cafetería de Especialidad &amp; Brunch</span>
</div>
<div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary-fixed group-hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[20px]">coffee</span>
</div>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                Café boliviano de origen, repostería artesanal recién horneada y la vista panorámica más relajante del norte cochabambino.
              </p>
</div>
</div>
<div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-surface-container/80">
<div className="flex flex-col">
<span className="text-[10px] uppercase text-outline font-bold">Tiempo promedio</span>
<span className="font-label-md text-label-md font-bold text-emerald-700">5 - 10 min</span>
</div>
<button className="px-5 py-2.5 rounded-full bg-primary-container hover:bg-tertiary-container hover:shadow-md text-on-primary font-label-md text-label-md font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95">
<span className="material-symbols-outlined text-[16px]">touch_app</span>
<span>Pedir con PaseoYa</span>
</button>
</div>
</div>

<div className="store-card group rounded-3xl bg-surface-container-lowest overflow-hidden shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,101,145,0.22)] hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between border border-transparent hover:border-secondary/30 relative" data-category="entretenimiento">
<div>
<div className="relative h-52 w-full overflow-hidden">
<div className="w-full h-full bg-cover bg-center group-hover:scale-108 transition-transform duration-700 ease-out" data-alt="Futuristic luxury cinema theater foyer inside Paseo Aranjuez Mall, soft blue mood LED neon accents, sleek popcorn candy bar and interactive digital ticket kiosks in modern Cochabamba architecture." style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDyRUxrGTpSceobkFu2wDd-tQbBnv2lx8QHvOgBPTTIW_K5Ro78zHyGlBlJ_rJrh-o1ZOhhQXWvh9kMF6Kk9Z3m6T-vYa1zJplZNkmHsE13QiT6xikIWpEZPXWrtILOAG5Od1hFpNyBzCKrGzCu9n-qEfokoGM8bm8TVECLBLybOFqqmbVY3B-DlLWdQj4NktgS12waolOxDKNf7qUf_dYdq9CMqiOfDm8cd6U7GpxQfxXU-0ap6F792Q')" }}></div>
<div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
<span className="absolute top-4 left-4 font-label-caps text-[10px] font-bold px-3 py-1 rounded-full bg-primary-container/90 backdrop-blur-md text-on-primary shadow-sm">
                NIVEL 3 · CINES
              </span>
<div className="absolute top-4 right-4 flex items-center gap-1 font-label-caps text-[10px] font-bold px-2.5 py-1 rounded-full bg-secondary text-on-secondary shadow-md transform group-hover:scale-105 transition-transform">
<span className="material-symbols-outlined text-[13px]">stars</span> +50 Pts
              </div>
<span className="absolute bottom-4 right-4 flex items-center gap-1 font-label-md text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary shadow-xs">
<span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> 4.8 (3.4k)
              </span>
</div>
<div className="p-6 space-y-3">
<div className="flex items-start justify-between">
<div>
<h3 className="font-headline-sm text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors">Multicine Paseo</h3>
<span className="font-body-sm text-body-sm text-on-surface-variant">Salas VIP, Dolby Atmos &amp; Candystore</span>
</div>
<div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary-fixed group-hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[20px]">movie</span>
</div>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                Cartelera internacional con asientos reclinables premium. Pide tus combos de pipocas desde la app y retíralos sin filas.
              </p>
</div>
</div>
<div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-surface-container/80">
<div className="flex flex-col">
<span className="text-[10px] uppercase text-outline font-bold">Candybar pickup</span>
<span className="font-label-md text-label-md font-bold text-secondary">Inmediato</span>
</div>
<button className="px-5 py-2.5 rounded-full bg-primary-container hover:bg-tertiary-container hover:shadow-md text-on-primary font-label-md text-label-md font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95">
<span className="material-symbols-outlined text-[16px]">confirmation_number</span>
<span>Boletos &amp; Pipocas</span>
</button>
</div>
</div>

<div className="store-card group rounded-3xl bg-surface-container-lowest overflow-hidden shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,101,145,0.22)] hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between border border-transparent hover:border-secondary/30 relative" data-category="gastro">
<div>
<div className="relative h-52 w-full overflow-hidden">
<div className="w-full h-full bg-cover bg-center group-hover:scale-108 transition-transform duration-700 ease-out" data-alt="Charming gelato ice cream parlor with bright display case showing artisanal colorful flavors, family enjoying sundaes inside an elegant modern Bolivian shopping mall in Cochabamba." style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDRWxiaxK9yQjp6ew0PEAH3jh0oFu2QDBPPz5Yqji5dAqlZS1tKFNke4aGinhD5i2uc-2zdZvB-aasUhUsMpNuWbhIj8rC7iICilsKgtE2m7mclEX8gve4S9stA7RN2ma-X8iq4FrwcOAslJSLvs5GV0rv0797J4xWXuemdBchZLQQkFYYaKvB7pdxZGaXts5LZeC6dHTVnwho7xQgR2OJyblLHtg_a974DIlc__1vrGhlkY-jqB1I4lA')" }}></div>
<div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
<span className="absolute top-4 left-4 font-label-caps text-[10px] font-bold px-3 py-1 rounded-full bg-primary-container/90 backdrop-blur-md text-on-primary shadow-sm">
                PLANTA BAJA · PLAZA CENTRAL
              </span>
<div className="absolute top-4 right-4 flex items-center gap-1 font-label-caps text-[10px] font-bold px-2.5 py-1 rounded-full bg-secondary text-on-secondary shadow-md transform group-hover:scale-105 transition-transform">
<span className="material-symbols-outlined text-[13px]">stars</span> +15 Pts
              </div>
<span className="absolute bottom-4 right-4 flex items-center gap-1 font-label-md text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary shadow-xs">
<span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> 4.7 (890)
              </span>
</div>
<div className="p-6 space-y-3">
<div className="flex items-start justify-between">
<div>
<h3 className="font-headline-sm text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors">Dumbo Heladería</h3>
<span className="font-body-sm text-body-sm text-on-surface-variant">Helados Artesanales &amp; Pastelería</span>
</div>
<div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary-fixed group-hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[20px]">icecream</span>
</div>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                La clásica tradición cochabambina con sabores artesanales y repostería para compartir con toda la familia en plaza Aranjuez.
              </p>
</div>
</div>
<div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-surface-container/80">
<div className="flex flex-col">
<span className="text-[10px] uppercase text-outline font-bold">Tiempo promedio</span>
<span className="font-label-md text-label-md font-bold text-emerald-700">3 - 5 min</span>
</div>
<button className="px-5 py-2.5 rounded-full bg-primary-container hover:bg-tertiary-container hover:shadow-md text-on-primary font-label-md text-label-md font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95">
<span className="material-symbols-outlined text-[16px]">touch_app</span>
<span>Pedir con PaseoYa</span>
</button>
</div>
</div>

<div className="store-card group rounded-3xl bg-surface-container-lowest overflow-hidden shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,101,145,0.22)] hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between border border-transparent hover:border-secondary/30 relative" data-category="moda">
<div>
<div className="relative h-52 w-full overflow-hidden">
<div className="w-full h-full bg-cover bg-center group-hover:scale-108 transition-transform duration-700 ease-out" data-alt="High-end sporting goods store with clean architectural shelving, neon backlights, Nike and Adidas running shoes on display in a luxury mall in South America." style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBfZEZ3izWhmv88V1Giwi7Cp6wkOHXZgEIVRvgoSpYMHqWGU4xdi5hZ9-ASd2_0eH59oYmILR75sS7ioZmR28mLZ1DVBONxPHmd0equz1xHfqjpDhvT5WCbwTFZF8KsrqB18oghk9Go73743OtpWan5EQ9WUxkkaIE55QNNoOocXVepA8r2a3bY991vw8a7Igjlvc5iYJdFZ7THkmfTiBrpkQRluK1-wi3Ets57ABha1kcmB_Gm_XWNPg')" }}></div>
<div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
<span className="absolute top-4 left-4 font-label-caps text-[10px] font-bold px-3 py-1 rounded-full bg-primary-container/90 backdrop-blur-md text-on-primary shadow-sm">
                NIVEL 1 · LOCAL 108
              </span>
<div className="absolute top-4 right-4 flex items-center gap-1 font-label-caps text-[10px] font-bold px-2.5 py-1 rounded-full bg-secondary text-on-secondary shadow-md transform group-hover:scale-105 transition-transform">
<span className="material-symbols-outlined text-[13px]">stars</span> +35 Pts
              </div>
<span className="absolute bottom-4 right-4 flex items-center gap-1 font-label-md text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary shadow-xs">
<span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> 4.9 (740)
              </span>
</div>
<div className="p-6 space-y-3">
<div className="flex items-start justify-between">
<div>
<h3 className="font-headline-sm text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors">Fair Play Store</h3>
<span className="font-body-sm text-body-sm text-on-surface-variant">Calzado, Ropa Deportiva &amp; Accesorios</span>
</div>
<div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary-fixed group-hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[20px]">fitness_center</span>
</div>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                Marcas líderes mundiales: Nike, Adidas, Puma y Under Armour. Aparta tu talla en la app y pruébatela sin esperar atención.
              </p>
</div>
</div>
<div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-surface-container/80">
<div className="flex flex-col">
<span className="text-[10px] uppercase text-outline font-bold">Reserva de talla</span>
<span className="font-label-md text-label-md font-bold text-primary">2 horas guardada</span>
</div>
<button className="px-5 py-2.5 rounded-full bg-surface-container-high hover:bg-surface-container text-primary font-label-md text-label-md font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95">
<span className="material-symbols-outlined text-[16px]">inventory_2</span>
<span>Apartar Talla</span>
</button>
</div>
</div>

<div className="store-card group rounded-3xl bg-surface-container-lowest overflow-hidden shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,101,145,0.22)] hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between border border-transparent hover:border-secondary/30 relative" data-category="entretenimiento">
<div>
<div className="relative h-52 w-full overflow-hidden">
<div className="w-full h-full bg-cover bg-center group-hover:scale-108 transition-transform duration-700 ease-out" data-alt="Minimalist modern Samsung technology store showroom with glass tables, glowing flagship Galaxy smartphones, premium tech ambiance in Cochabamba mall." style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAX7TYEMpjVTUDD7Lx3mmTzPEj8VU0VG9iFcaBXpQcGghm5SYruwG8QLGqWU5mwoi6J4R8uI2HkZUWZfOQb81_TGxtHxgpavtaH-Rp_JykdBIzQDwijsdqhdzXx81zhyycWMQKQrI11fuDdE_0vd88KDploZ2WhN7VahEhkUy3eS1BZKj2Vd9QWEcLYlngqAjDx_4PU2CJjUVezkoOqnzYCFgDa8NqWJ6YtUBEqinBgIqKwO9K9vM8YuA')" }}></div>
<div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
<span className="absolute top-4 left-4 font-label-caps text-[10px] font-bold px-3 py-1 rounded-full bg-primary-container/90 backdrop-blur-md text-on-primary shadow-sm">
                PLANTA BAJA · LOCAL 22
              </span>
<div className="absolute top-4 right-4 flex items-center gap-1 font-label-caps text-[10px] font-bold px-2.5 py-1 rounded-full bg-secondary text-on-secondary shadow-md transform group-hover:scale-105 transition-transform">
<span className="material-symbols-outlined text-[13px]">stars</span> +100 Pts
              </div>
<span className="absolute bottom-4 right-4 flex items-center gap-1 font-label-md text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary shadow-xs">
<span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> 4.9 (610)
              </span>
</div>
<div className="p-6 space-y-3">
<div className="flex items-start justify-between">
<div>
<h3 className="font-headline-sm text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors">Samsung Store</h3>
<span className="font-body-sm text-body-sm text-on-surface-variant">Smartphones, Watches &amp; Ecosistema Galaxy</span>
</div>
<div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary-fixed group-hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[20px]">devices</span>
</div>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                Asesoramiento experto oficial, servicio técnico certificado y accesorios originales con puntos acumulables Paseo 360.
              </p>
</div>
</div>
<div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-surface-container/80">
<div className="flex flex-col">
<span className="text-[10px] uppercase text-outline font-bold">Garantía oficial</span>
<span className="font-label-md text-label-md font-bold text-secondary">Bolivia 1 Año</span>
</div>
<button className="px-5 py-2.5 rounded-full bg-surface-container-high hover:bg-surface-container text-primary font-label-md text-label-md font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95">
<span className="material-symbols-outlined text-[16px]">visibility</span>
<span>Ver Catálogo</span>
</button>
</div>
</div>

<div className="store-card group rounded-3xl bg-surface-container-lowest overflow-hidden shadow-sm hover:shadow-[0_20px_40px_-15px_rgba(0,101,145,0.22)] hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between border border-transparent hover:border-secondary/30 relative" data-category="moda">
<div>
<div className="relative h-52 w-full overflow-hidden">
<div className="w-full h-full bg-cover bg-center group-hover:scale-108 transition-transform duration-700 ease-out" data-alt="High luxury boutique jewelry store window display with sparkling diamond rings, gold necklaces, warm museum spotlighting in Paseo Aranjuez Mall Cochabamba." style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDu6n8TLyeq_c8Ke6nK_DXpoulmXaFITRd7ARBSq82nCJyERdFReOYkJPCQ7xcESV2eYerG5ZF3KKLhN4cERmknGTbIllD5qrt6CBDx8cJMFWRuzuRGKTj458OedbpR58OaS_BAexszo9m_Kj2tOfuvwyKAhkbdy3aGYfJt98z6-2T5lq0kLA3dvm-3-1Z_2Q3HYaCm6BbO2nEV-cnuTPqXBxAUbKpHNPx4kPMQMM2SefwHVkPkxP1Pfw')" }}></div>
<div className="absolute inset-0 bg-gradient-to-t from-primary/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
<span className="absolute top-4 left-4 font-label-caps text-[10px] font-bold px-3 py-1 rounded-full bg-primary-container/90 backdrop-blur-md text-on-primary shadow-sm">
                NIVEL 1 · BOUTIQUE 114
              </span>
<div className="absolute top-4 right-4 flex items-center gap-1 font-label-caps text-[10px] font-bold px-2.5 py-1 rounded-full bg-secondary text-on-secondary shadow-md transform group-hover:scale-105 transition-transform">
<span className="material-symbols-outlined text-[13px]">stars</span> +80 Pts
              </div>
<span className="absolute bottom-4 right-4 flex items-center gap-1 font-label-md text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary shadow-xs">
<span className="material-symbols-outlined text-[14px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span> 5.0 (420)
              </span>
</div>
<div className="p-6 space-y-3">
<div className="flex items-start justify-between">
<div>
<h3 className="font-headline-sm text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors">Casa Elena Joyería</h3>
<span className="font-body-sm text-body-sm text-on-surface-variant">Joyería Fina &amp; Relojería Suiza</span>
</div>
<div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary-fixed group-hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[20px]">diamond</span>
</div>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
                Diseños exclusivos en oro de 18k, piedras preciosas certificadas y piezas conmemorativas únicas para momentos inolvidables.
              </p>
</div>
</div>
<div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-surface-container/80">
<div className="flex flex-col">
<span className="text-[10px] uppercase text-outline font-bold">Atención personalizada</span>
<span className="font-label-md text-label-md font-bold text-primary">Cita VIP</span>
</div>
<button className="px-5 py-2.5 rounded-full bg-surface-container-high hover:bg-surface-container text-primary font-label-md text-label-md font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95">
<span className="material-symbols-outlined text-[16px]">calendar_today</span>
<span>Agendar Cita</span>
</button>
</div>
</div>
</div>
</div>
</section>

<section className="w-full py-24 px-6 lg:px-12 bg-primary-container text-on-primary relative overflow-hidden" id="negocios">

<div className="absolute inset-0 bg-gradient-to-r from-primary via-primary-container to-primary opacity-90 pointer-events-none"></div>
<div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-secondary-container/10 blur-3xl pointer-events-none"></div>
<div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

<div className="lg:col-span-7 space-y-8">
<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-lowest/10 backdrop-blur-md">
<span className="material-symbols-outlined text-secondary-container text-[18px]">domain</span>
<span className="font-label-caps text-label-caps text-secondary-container uppercase tracking-wider font-bold">B2B · Locatarios &amp; Nuevas Marcas</span>
</div>
<div className="space-y-4">
<h2 className="font-display-hero text-headline-xl lg:text-display-hero font-extrabold text-on-primary tracking-tight leading-tight">
            Vende más dentro del mall sin comisiones abusivas.
          </h2>
<p className="font-body-lg text-body-lg text-on-primary-container max-w-xl">
            Conecta tu punto de venta al ecosistema digital de Paseo Aranjuez 360. Recibe pedidos pagados con Simple QR y administra todo desde una tablet táctil ultra-simple.
          </p>
</div>

<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
<div className="p-5 rounded-2xl bg-surface-container-lowest/5 backdrop-blur-sm space-y-2 hover:bg-surface-container-lowest/10 transition-colors">
<div className="flex items-center gap-2.5 text-secondary-container">
<span className="material-symbols-outlined text-[24px]">percent</span>
<span className="font-title-lg text-title-lg font-bold text-on-primary">0% Comisión Delivery</span>
</div>
<p className="font-body-sm text-body-sm text-on-primary-container">
              El cliente retira en tu mostrador. No dependes de repartidores en moto ni de cobros confiscatorios.
            </p>
</div>
<div className="p-5 rounded-2xl bg-surface-container-lowest/5 backdrop-blur-sm space-y-2 hover:bg-surface-container-lowest/10 transition-colors">
<div className="flex items-center gap-2.5 text-secondary-container">
<span className="material-symbols-outlined text-[24px]">point_of_sale</span>
<span className="font-title-lg text-title-lg font-bold text-on-primary">Cobro Inmediato QR</span>
</div>
<p className="font-body-sm text-body-sm text-on-primary-container">
              Fondos acreditados directamente a la cuenta bancaria corporativa de tu negocio en Bolivia.
            </p>
</div>
<div className="p-5 rounded-2xl bg-surface-container-lowest/5 backdrop-blur-sm space-y-2 hover:bg-surface-container-lowest/10 transition-colors">
<div className="flex items-center gap-2.5 text-secondary-container">
<span className="material-symbols-outlined text-[24px]">analytics</span>
<span className="font-title-lg text-title-lg font-bold text-on-primary">Métricas en Tiempo Real</span>
</div>
<p className="font-body-sm text-body-sm text-on-primary-container">
              Conoce horas pico de afluencia, platos o productos más buscados y fidelización de clientes recurrentes.
            </p>
</div>
<div className="p-5 rounded-2xl bg-surface-container-lowest/5 backdrop-blur-sm space-y-2 hover:bg-surface-container-lowest/10 transition-colors">
<div className="flex items-center gap-2.5 text-secondary-container">
<span className="material-symbols-outlined text-[24px]">campaign</span>
<span className="font-title-lg text-title-lg font-bold text-on-primary">Pauta Push &amp; Pantallas</span>
</div>
<p className="font-body-sm text-body-sm text-on-primary-container">
              Notificaciones segmentadas a los visitantes que están dentro del mall en el momento oportuno.
            </p>
</div>
</div>
</div>

<div className="lg:col-span-5 flex justify-center">
<div className="w-full max-w-[420px] bg-surface-container-lowest rounded-[32px] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.35)] text-on-surface">

<div className="flex flex-col items-center text-center space-y-2 mb-8">

<div className="relative w-28 h-16 flex items-center justify-center">
<div className="flex items-center">
<span className="text-4xl font-extrabold tracking-tighter text-primary font-headline-lg">360</span>
<div className="w-10 h-10 ml-2 rounded-full border-2 border-primary flex items-center justify-center relative">
<div className="w-7 h-7 rounded-full border border-primary flex items-center justify-center">
<span className="material-symbols-outlined text-[16px] text-primary">navigation</span>
</div>
</div>
</div>
</div>
<span className="font-headline-sm text-headline-sm font-extrabold text-primary tracking-tight">Paseo Aranjuez</span>
<p className="font-body-sm text-[13px] text-on-surface-variant font-medium pt-1">
              Panel de administración, negocios y oficinas
            </p>
</div>

<form className="space-y-5" onSubmit={(e) => { e.preventDefault(); window.alert("Bienvenido al Portal de Administración de Paseo Aranjuez 360."); }}>
<div className="space-y-1.5 text-left">
<label className="font-label-md text-label-md font-bold text-primary block">Correo</label>
<div className="relative">
<input className="w-full px-4 py-3.5 rounded-xl bg-surface-container-low text-primary font-body-md text-body-md focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary focus:outline-none transition-all placeholder:text-outline" placeholder="nombre@comercio.bo" required type="email" defaultValue="cafearanjuez@paseo.bo" />
</div>
</div>
<div className="space-y-1.5 text-left">
<div className="flex items-center justify-between">
<label className="font-label-md text-label-md font-bold text-primary block">Contraseña</label>
<a className="font-label-caps text-[11px] text-secondary hover:underline" href="#">¿Olvidaste tu clave?</a>
</div>
<input className="w-full px-4 py-3.5 rounded-xl bg-surface-container-low text-primary font-body-md text-body-md focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary focus:outline-none transition-all placeholder:text-outline" placeholder="Ingresa tu contraseña" required type="password" defaultValue="••••••••••••" />
</div>

<button className="w-full py-4 rounded-xl bg-primary hover:bg-tertiary text-on-primary font-title-lg text-title-lg font-bold tracking-tight shadow-md transition-all duration-300 transform active:scale-[0.98] mt-2" type="submit">
              Continuar
            </button>

<div className="text-center pt-3">
<a className="font-body-sm text-[13px] text-on-surface-variant hover:text-primary transition-colors" href="#">
                ¿Nuevo en Paseo Aranjuez? <strong className="text-secondary font-bold">Crea tu cuenta</strong>
</a>
</div>
</form>

<div className="mt-6 pt-5 border-t border-surface-container text-center flex items-center justify-center gap-1.5 text-outline">
<span className="material-symbols-outlined text-[16px]">lock</span>
<span className="font-label-caps text-[10px] uppercase tracking-wider">Acceso Seguro SSL 256-bit</span>
</div>
</div>
</div>
</div>
</section>

<section className="py-20 px-6 lg:px-12 max-w-7xl mx-auto w-full" id="descarga-app">
<div className="relative rounded-3xl bg-surface-container-lowest shadow-xl overflow-hidden p-8 lg:p-16 border border-surface-container">
<div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-secondary/10 blur-3xl pointer-events-none"></div>
<div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">

<div className="lg:col-span-7 space-y-6">
<div className="inline-flex items-center gap-2 text-secondary font-label-caps text-label-caps font-bold uppercase tracking-wider">
<span className="material-symbols-outlined text-[18px]">phone_iphone</span>
<span>Descarga gratuita iOS &amp; Android</span>
</div>
<h2 className="font-headline-xl text-headline-xl text-primary font-extrabold tracking-tight">
            Vive la experiencia 360 en tu próxima visita.
          </h2>
<p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
            Disponible para iPhone y smartphones Android. Escanea el código QR desde la cámara de tu celular para instalar la aplicación oficial de Mall Paseo Aranjuez.
          </p>
<div className="flex flex-wrap items-center gap-4 pt-2">
<div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-primary text-on-primary">
<span className="material-symbols-outlined text-[24px]">verified</span>
<div className="flex flex-col">
<span className="font-label-caps text-[10px] text-on-primary/70 uppercase">Certificada por</span>
<span className="font-label-md text-label-md font-bold">Paseo Aranjuez Oficial</span>
</div>
</div>
<div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-surface-container text-primary">
<span className="material-symbols-outlined text-[24px] text-secondary">wifi_protected_setup</span>
<div className="flex flex-col">
<span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Simple QR Bolivia</span>
<span className="font-label-md text-label-md font-bold">Pagos 100% Seguros</span>
</div>
</div>
</div>
</div>

<div className="lg:col-span-5 flex flex-col sm:flex-row items-center justify-center gap-8 bg-surface-container-low p-8 rounded-3xl">

<div className="flex flex-col items-center space-y-3 shrink-0">
<div className="p-4 bg-surface-container-lowest rounded-2xl shadow-md relative">
<svg className="w-36 h-36" fill="currentColor" viewBox="0 0 140 140">

<path d="M10,10 h40 v40 h-40 z M20,20 h20 v20 h-20 z" fill="#001629"></path>
<path d="M90,10 h40 v40 h-40 z M100,20 h20 v20 h-20 z" fill="#001629"></path>
<path d="M10,90 h40 v40 h-40 z M20,100 h20 v20 h-20 z" fill="#001629"></path>

<rect fill="#006591" height="10" width="10" x="25" y="25"></rect>
<rect fill="#006591" height="10" width="10" x="105" y="25"></rect>
<rect fill="#006591" height="10" width="10" x="25" y="105"></rect>

<rect fill="#001629" height="8" width="8" x="60" y="15"></rect>
<rect fill="#001629" height="8" width="8" x="75" y="20"></rect>
<rect fill="#001629" height="8" width="8" x="60" y="35"></rect>
<rect fill="#006591" height="8" width="8" x="75" y="50"></rect>
<rect fill="#001629" height="8" width="8" x="15" y="60"></rect>
<rect fill="#001629" height="8" width="8" x="30" y="70"></rect>
<rect fill="#001629" height="8" width="8" x="90" y="65"></rect>
<rect fill="#006591" height="8" width="8" x="110" y="75"></rect>
<rect fill="#001629" height="8" width="8" x="60" y="90"></rect>
<rect fill="#001629" height="8" width="8" x="80" y="100"></rect>
<rect fill="#001629" height="8" width="8" x="100" y="105"></rect>
<rect fill="#006591" height="8" width="8" x="115" y="115"></rect>
<rect fill="#001629" height="8" width="8" x="65" y="115"></rect>
<rect fill="#002b49" height="20" rx="4" width="20" x="60" y="65"></rect>
</svg>
</div>
<span className="font-label-caps text-[11px] font-bold text-primary tracking-wider uppercase text-center">Escanea con tu cámara</span>
</div>

<div className="flex flex-col space-y-3 w-full sm:w-auto">
<a className="flex items-center gap-3 px-5 py-3 rounded-xl bg-primary text-on-primary hover:bg-tertiary transition-all hover:-translate-y-0.5 shadow-xs" href="#">
<span className="material-symbols-outlined text-[26px]">file_download</span>
<div className="text-left">
<span className="block text-[10px] text-on-primary/70 leading-none">Descargar para</span>
<span className="font-label-lg text-label-lg font-bold">iOS Apple</span>
</div>
</a>
<a className="flex items-center gap-3 px-5 py-3 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container transition-all hover:-translate-y-0.5 shadow-xs" href="#">
<span className="material-symbols-outlined text-[26px] text-secondary">play_arrow</span>
<div className="text-left">
<span className="block text-[10px] text-on-surface-variant leading-none">Disponible para</span>
<span className="font-label-lg text-label-lg font-bold">Android OS</span>
</div>
</a>
</div>
</div>
</div>
</div>
</section>


</div></main><footer className="w-full bg-primary-container text-on-primary"><div className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-12"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-on-primary-container/20"><div className="lg:col-span-2 space-y-4"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-surface-container-lowest/10 flex items-center justify-center text-secondary-container"><span className="material-symbols-outlined text-[22px]">view_in_ar</span></div><span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-primary">MALL PASEO ARANJUEZ</span></div><p className="font-body-md text-body-md text-on-primary-container max-w-sm">El epicentro de compras, gastronomía gourmet y tecnología interactiva 360 en el corazón de Cochabamba, Bolivia.</p><div className="space-y-2 text-on-primary-container font-body-sm text-body-sm"><div className="flex items-start gap-2.5"><span className="material-symbols-outlined text-[18px] text-secondary-container shrink-0 mt-0.5">location_on</span><span>Av. América &amp; Calle Paccieri, Zona Norte, Cochabamba, Bolivia</span></div><div className="flex items-center gap-2.5"><span className="material-symbols-outlined text-[18px] text-secondary-container shrink-0">schedule</span><span>Lunes a Domingo: 10:00 - 22:00</span></div><div className="flex items-center gap-2.5"><span className="material-symbols-outlined text-[18px] text-secondary-container shrink-0">call</span><span>+591 4 4458900 · info@paseoaranjuez.bo</span></div></div></div><div><h4 className="font-title-lg text-title-lg font-bold text-on-primary mb-4">Explorar Mall</h4><ul className="space-y-2.5 font-body-sm text-body-sm text-on-primary-container"><li><a className="hover:text-on-primary transition-colors" data-path="70-tiendas" href="#">Directorio 70 Tiendas</a></li><li><a className="hover:text-on-primary transition-colors" data-path="gastronomia" href="#">Gastronomía &amp; Terrazas</a></li><li><a className="hover:text-on-primary transition-colors" data-path="cine-entretenimiento" href="#">Cine &amp; Entretenimiento</a></li><li><a className="hover:text-on-primary transition-colors" data-path="mapa-360-interactivo" href="#">Mapa 360 Interactivo</a></li><li><a className="hover:text-on-primary transition-colors" data-path="eventos-agenda" href="#">Eventos &amp; Cartelera</a></li></ul></div><div><h4 className="font-title-lg text-title-lg font-bold text-on-primary mb-4">Plataforma 360</h4><ul className="space-y-2.5 font-body-sm text-body-sm text-on-primary-container"><li><a className="hover:text-on-primary transition-colors" data-path="los-3-pilares" href="#">Los 3 Pilares</a></li><li><a className="hover:text-on-primary transition-colors" data-path="como-funciona" href="#">Guía de Uso 360</a></li><li><a className="hover:text-on-primary transition-colors" data-path="descargar-app" href="#">App para iOS &amp; Android</a></li><li><a className="hover:text-on-primary transition-colors" data-path="beneficios-club" href="#">Club Paseo VIP</a></li><li><a className="hover:text-on-primary transition-colors" data-path="estacionamiento-smart" href="#">Estacionamiento Smart</a></li></ul></div><div><h4 className="font-title-lg text-title-lg font-bold text-on-primary mb-4">Corporativo</h4><ul className="space-y-2.5 font-body-sm text-body-sm text-on-primary-container"><li><a className="hover:text-on-primary transition-colors" data-path="para-negocios" href="#">Alquiler de Locales</a></li><li><a className="hover:text-on-primary transition-colors" data-path="portal-negocios-login" href="/">Portal Negocios</a></li><li><a className="hover:text-on-primary transition-colors" data-path="espacios-publicitarios" href="#">Publicidad In-Mall</a></li><li><a className="hover:text-on-primary transition-colors" data-path="prensa" href="#">Sala de Prensa</a></li><li><a className="hover:text-on-primary transition-colors" data-path="contacto" href="#">Atención al Cliente</a></li></ul></div></div><div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 font-body-sm text-body-sm text-on-primary-container"><p>© 2025 Paseo Aranjuez Mall 360. Todos los derechos reservados. Cochabamba, Bolivia.</p><div className="flex items-center gap-6"><a className="hover:text-on-primary transition-colors" data-path="terminos" href="#">Términos y Condiciones</a><a className="hover:text-on-primary transition-colors" data-path="privacidad" href="#">Políticas de Privacidad</a><a className="hover:text-on-primary transition-colors" data-path="seguridad" href="#">Seguridad</a></div></div></div></footer>
    </div>
  );
}
