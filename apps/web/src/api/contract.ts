import { SystemRpcs } from "@projection/platform/contract";

/**
 * Contrat RPC complet de l'application, importable côté client.
 * Chaque bounded context y ajoute son groupe via `.merge(...)`.
 */
export const ApiRpcs = SystemRpcs;
