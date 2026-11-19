import { api } from "../api/client";
import type { EstadoTarjeta } from "./tipos";

/** Pide al backend que publique el pase real en Google Wallet y devuelva el enlace para guardarlo. */
export function publicarEnWallet(estado: EstadoTarjeta): Promise<{ enlace_wallet: string }> {
  return api("/sorteo-paseo/wallet/publicar/", { method: "POST", body: estado, auth: false });
}
