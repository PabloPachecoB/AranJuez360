import { mkdirSync, rmSync } from 'node:fs';
import { CARPETA_CORREOS } from './playwright.config';

// Antes de cada corrida: se vacían los correos para leer solo los códigos nuevos.
export default function globalSetup() {
  rmSync(CARPETA_CORREOS, { recursive: true, force: true });
  mkdirSync(CARPETA_CORREOS, { recursive: true });
}
