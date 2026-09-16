import { MediaStorage } from "@projection/media/server";
import { ObjectStorage } from "@projection/platform";
import { Effect, Layer } from "effect";

/**
 * Branche le port média sur le stockage S3 compatible.
 * Une panne du stockage est un défaut : l'appel RPC échoue, rien n'est enregistré à moitié.
 */
export const MediaStorageLive = Layer.effect(
  MediaStorage,
  Effect.gen(function* () {
    const storage = yield* ObjectStorage;

    return MediaStorage.of({
      presignUpload: (key, contentType) =>
        storage.presignUpload(key, contentType).pipe(Effect.orDie),
      presignDownload: (key, ttlSeconds) =>
        storage.presignDownload(key, ttlSeconds).pipe(Effect.orDie),
      remove: (key) => storage.remove(key).pipe(Effect.orDie),
    });
  }),
);
