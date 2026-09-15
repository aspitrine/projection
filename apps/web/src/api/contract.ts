import { BibleRpcs } from "@projection/bible/contract";
import { IdentityRpcs } from "@projection/identity/contract";
import { LiveRpcs } from "@projection/live/contract";
import { SystemRpcs } from "@projection/platform/contract";
import { SongsRpcs } from "@projection/songs/contract";

/**
 * Contrat RPC complet de l'application, importable côté client.
 * Chaque bounded context y ajoute son groupe via `.merge(...)`.
 */
export const ApiRpcs = SystemRpcs.merge(LiveRpcs, IdentityRpcs, SongsRpcs, BibleRpcs);
