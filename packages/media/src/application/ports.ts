import type { MediaId, OrganizationId } from "@projection/shared-kernel";
import { Context, Effect, Layer, Option, Ref } from "effect";

import { MediaAsset } from "../domain/Media";

/** Port de persistance des médias, limité à une organisation. */
export class MediaRepository extends Context.Service<
  MediaRepository,
  {
    list(organizationId: OrganizationId): Effect.Effect<ReadonlyArray<MediaAsset>>;
    findById(organizationId: OrganizationId, id: MediaId): Effect.Effect<Option.Option<MediaAsset>>;
    insert(asset: MediaAsset): Effect.Effect<void>;
    markReady(
      organizationId: OrganizationId,
      id: MediaId,
    ): Effect.Effect<Option.Option<MediaAsset>>;
    delete(organizationId: OrganizationId, id: MediaId): Effect.Effect<Option.Option<MediaAsset>>;
  }
>()("@projection/media/MediaRepository") {
  static readonly layerMemory = Layer.effect(
    MediaRepository,
    Ref.make<ReadonlyArray<MediaAsset>>([]).pipe(
      Effect.map((store) => {
        const update = (
          organizationId: OrganizationId,
          id: MediaId,
          change: (asset: MediaAsset) => MediaAsset | null,
        ) =>
          Ref.modify(store, (assets) => {
            const current = assets.find(
              (asset) => asset.id === id && asset.organizationId === organizationId,
            );
            if (current === undefined) return [Option.none<MediaAsset>(), assets] as const;
            const updated = change(current);
            return [
              Option.some(updated ?? current),
              updated === null
                ? assets.filter((asset) => asset !== current)
                : assets.map((asset) => (asset === current ? updated : asset)),
            ] as const;
          });

        return MediaRepository.of({
          list: (organizationId) =>
            Ref.get(store).pipe(
              Effect.map((assets) =>
                assets.filter((asset) => asset.organizationId === organizationId),
              ),
            ),
          findById: (organizationId, id) =>
            Ref.get(store).pipe(
              Effect.map((assets) =>
                Option.fromNullishOr(
                  assets.find(
                    (asset) => asset.id === id && asset.organizationId === organizationId,
                  ),
                ),
              ),
            ),
          insert: (asset) => Ref.update(store, (assets) => [...assets, asset]),
          markReady: (organizationId, id) =>
            update(organizationId, id, (asset) => new MediaAsset({ ...asset, ready: true })),
          delete: (organizationId, id) => update(organizationId, id, () => null),
        });
      }),
    ),
  );
}

/**
 * Port vers le stockage S3 compatible : le serveur ne transporte jamais les fichiers,
 * il signe des URL que le navigateur utilise directement.
 */
export class MediaStorage extends Context.Service<
  MediaStorage,
  {
    presignUpload(storageKey: string, contentType: string): Effect.Effect<string>;
    presignDownload(storageKey: string, ttlSeconds?: number): Effect.Effect<string>;
    remove(storageKey: string): Effect.Effect<void>;
  }
>()("@projection/media/MediaStorage") {}
