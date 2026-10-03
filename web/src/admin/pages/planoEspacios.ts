export interface EspacioMapa {
  numero: string;
  trazado: string;
  x: number;
  y: number;
}

export interface PisoMapa {
  numero: "2" | "3";
  plano: string;
  espacios: EspacioMapa[];
}

// Las áreas siguen exactamente los contornos de los locales en los SVG de public.
// El orden del piso 2 corresponde a la numeración 201–216 del diseño de Stitch.
const piso2: Array<[string, number, number]> = [
  ["M210 195L580 175L600 200V340L520 395H210V195Z", 395, 285],
  ["M600 175H850V275L760 300L600 340V175Z", 715, 235],
  ["M870 175H1030V275H870V175Z", 950, 225],
  ["M1045 175H1200V275H1045V175Z", 1122, 225],
  ["M1215 175H1350C1390 194.1 1411.67 241.85 1415 318.25V366H1215V175Z", 1310, 275],
  ["M1215 389H1415V489H1215V389Z", 1315, 439],
  ["M1215 512H1415V612H1215V512Z", 1315, 562],
  ["M1215 637H1415V737H1215V637Z", 1315, 687],
  ["M930 640H1105V742.632L1066.5 790H930V640Z", 1015, 704],
  ["M785 755H915V855H845L785 820V755Z", 850, 800],
  ["M570 755H760V855H570V755Z", 665, 805],
  ["M215 740H480V860H260C230 853.333 215 835 215 805V740Z", 350, 797],
  ["M215 620H390V715H215V620Z", 302, 667],
  ["M215 490H385V605H215V490Z", 300, 548],
  ["M215 415H470V475H215V415Z", 340, 445],
  ["M784 640H914V685H784V640Z", 849, 663],
];

const piso3: Array<[string, number, number]> = [
  ["M210 500H430V575H210V500Z", 320, 538],
  ["M210 590H430V675H210V590Z", 320, 632],
  ["M210 690H430V777H255L210 748V690Z", 320, 731],
  ["M650 175H835V345H650V175Z", 742, 260],
  ["M1220 325H1385V410H1220V325Z", 1302, 367],
  ["M1220 425H1385V515H1220V425Z", 1302, 470],
  ["M1220 530H1385V615H1320V675H1220V530Z", 1290, 585],
  ["M791 651.125L941 611V686H861H791V651.125Z", 867, 652],
  ["M940 611H1045V711H940V611Z", 992, 661],
  ["M650 745H825V845H650V745Z", 737, 795],
  ["M1048 614H1153V714H1048V614Z", 1100, 664],
];

function numerar(piso: PisoMapa["numero"], areas: Array<[string, number, number]>): EspacioMapa[] {
  return areas.map(([trazado, x, y], indice) => ({
    numero: `${piso}${String(indice + 1).padStart(2, "0")}`,
    trazado,
    x,
    y,
  }));
}

export const PISOS: Record<PisoMapa["numero"], PisoMapa> = {
  "2": { numero: "2", plano: "/plano_piso_2_base%201.svg", espacios: numerar("2", piso2) },
  "3": { numero: "3", plano: "/plano_piso_3_base%201.svg", espacios: numerar("3", piso3) },
};
