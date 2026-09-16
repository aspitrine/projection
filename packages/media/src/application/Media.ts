import { CurrentActor, MediaId } from "@projection/shared-kernel";
import { Clock, Context, Effect, Layer, Option } from "effect";

import {
  MediaAsset,
  MediaNotFound,
  MediaTooLarge,
  MediaUpload,
  type MediaUploadInput,
  UnsupportedMedia,
  maxBytesFor,
  mediaKindOf,
  storageKeyFor,
} from "../domain/Media";
import { MediaRepository, MediaStorage } from "./ports";

/** Bibliothèque de médias de l'organisation courante. */
export class Media extends Context.Service<
  Media,
  {
    /** Médias téléversés jusqu'au bout, du plus récent au plus ancien. */
    readonly list: Effect.Effect<ReadonlyArray<MediaAsset>, never, CurrentActor>;
    /** Réserve une place et signe l'URL de téléversement du navigateur. */
    requestUpload(
      input: MediaUploadInput,
    ): Effect.Effect<MediaUpload, UnsupportedMedia | MediaTooLarge, CurrentActor>;
    /** Marque le média comme disponible une fois le téléversement terminé. */
    confirmUpload(id: MediaId): Effect.Effect<MediaAsset, MediaNotFound, CurrentActor>;
    /** URL de lecture signée ; `ttlSeconds` allonge la validité pour les écrans. */
    url(id: MediaId, ttlSeconds?: number): Effect.Effect<string, MediaNotFound, CurrentActor>;
    /** Média de l'organisation courante, pour composer un projet. */
    get(id: MediaId): Effect.Effect<MediaAsset, MediaNotFound, CurrentActor>;
    remove(id: MediaId): Effect.Effect<void, MediaNotFound, CurrentActor>;
  }
>()("@projection/media/Media") {
  static readonly layer = Layer.effect(
    Media,
    Effect.gen(function* () {
      const repository = yield* MediaRepository;
      const storage = yield* MediaStorage;

      const find = Effect.fnUntraced(function* (id: MediaId) {
        const actor = yield* CurrentActor;
        const asset = yield* repository.findById(actor.organizationId, id);
        return yield* Option.match(asset, {
          onNone: () => Effect.fail(new MediaNotFound({ id })),
          onSome: Effect.succeed,
        });
      });

      return Media.of({
        list: Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const assets = yield* repository.list(actor.organizationId);
          return [...assets]
            .filter((asset) => asset.ready)
            .sort((left, right) => right.createdAt - left.createdAt);
        }).pipe(Effect.withSpan("Media.list")),

        requestUpload: Effect.fn("Media.requestUpload")(function* (input: MediaUploadInput) {
          const kind = mediaKindOf(input.contentType);
          if (kind === null) {
            return yield* new UnsupportedMedia({ contentType: input.contentType });
          }
          const maxBytes = maxBytesFor(kind);
          if (input.sizeBytes > maxBytes) {
            return yield* new MediaTooLarge({ sizeBytes: input.sizeBytes, maxBytes });
          }

          const actor = yield* CurrentActor;
          const now = yield* Clock.currentTimeMillis;
          const id = MediaId.make(crypto.randomUUID());
          const asset = new MediaAsset({
            id,
            organizationId: actor.organizationId,
            kind,
            name: input.name,
            contentType: input.contentType,
            sizeBytes: input.sizeBytes,
            storageKey: storageKeyFor(actor.organizationId, id, input.contentType),
            ready: false,
            createdAt: now,
          });
          yield* repository.insert(asset);
          const uploadUrl = yield* storage.presignUpload(asset.storageKey, asset.contentType);
          return new MediaUpload({ asset, uploadUrl });
        }),

        confirmUpload: Effect.fn("Media.confirmUpload")(function* (id: MediaId) {
          const actor = yield* CurrentActor;
          const updated = yield* repository.markReady(actor.organizationId, id);
          return yield* Option.match(updated, {
            onNone: () => Effect.fail(new MediaNotFound({ id })),
            onSome: Effect.succeed,
          });
        }),

        url: Effect.fn("Media.url")(function* (id: MediaId, ttlSeconds?: number) {
          const asset = yield* find(id);
          return yield* storage.presignDownload(asset.storageKey, ttlSeconds);
        }),

        get: Effect.fn("Media.get")(function* (id: MediaId) {
          return yield* find(id);
        }),

        remove: Effect.fn("Media.remove")(function* (id: MediaId) {
          const actor = yield* CurrentActor;
          const deleted = yield* repository.delete(actor.organizationId, id);
          const asset = yield* Option.match(deleted, {
            onNone: () => Effect.fail(new MediaNotFound({ id })),
            onSome: Effect.succeed,
          });
          // L'objet suit la ligne : pas de fichier orphelin dans le stockage.
          yield* storage.remove(asset.storageKey);
        }),
      });
    }),
  );
}
