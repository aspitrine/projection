import { describe, expect, it } from "@effect/vitest";
import { MediaId } from "@projection/shared-kernel";
import { Effect, Layer, Ref } from "effect";

import { Media } from "../src/application/Media";
import { MediaRepository } from "../src/application/ports";
import { MAX_IMAGE_BYTES, MediaUploadInput } from "../src/domain/Media";
import { asActor, makeMediaStorage } from "./support";

const image = (overrides: Partial<MediaUploadInput> = {}) =>
  new MediaUploadInput({
    name: "fond.jpg",
    contentType: "image/jpeg",
    sizeBytes: 1024,
    ...overrides,
  });

describe("Media", () => {
  it.effect("téléverse en deux temps : réservation signée puis confirmation", () =>
    Effect.gen(function* () {
      const storage = yield* makeMediaStorage();
      const layer = Media.layer.pipe(
        Layer.provideMerge(Layer.mergeAll(MediaRepository.layerMemory, storage.layer)),
      );

      yield* Effect.gen(function* () {
        const media = yield* Media;
        const upload = yield* media.requestUpload(image()).pipe(asActor("org-a"));

        expect(upload.asset).toMatchObject({ kind: "image", ready: false, name: "fond.jpg" });
        expect(upload.asset.storageKey.startsWith("org-a/")).toBe(true);
        expect(upload.uploadUrl).toContain("?upload");
        // Tant que le navigateur n'a pas confirmé, le média n'apparaît pas.
        expect(yield* media.list.pipe(asActor("org-a"))).toEqual([]);

        const ready = yield* media.confirmUpload(upload.asset.id).pipe(asActor("org-a"));
        expect(ready.ready).toBe(true);
        expect((yield* media.list.pipe(asActor("org-a"))).map((asset) => asset.id)).toEqual([
          upload.asset.id,
        ]);
        expect(yield* media.url(upload.asset.id).pipe(asActor("org-a"))).toContain("?lecture");

        // Une autre organisation ne voit rien et ne peut rien lire.
        expect(yield* media.list.pipe(asActor("org-b"))).toEqual([]);
        const foreign = yield* media.url(upload.asset.id).pipe(asActor("org-b"), Effect.flip);
        expect(foreign._tag).toBe("MediaNotFound");

        yield* media.remove(upload.asset.id).pipe(asActor("org-a"));
        expect(yield* Ref.get(storage.removed)).toEqual([upload.asset.storageKey]);
        expect(yield* media.list.pipe(asActor("org-a"))).toEqual([]);
      }).pipe(Effect.provide(layer));
    }),
  );

  it.effect("refuse les types non gérés et les fichiers trop gros", () =>
    Effect.gen(function* () {
      const storage = yield* makeMediaStorage();
      const layer = Media.layer.pipe(
        Layer.provideMerge(Layer.mergeAll(MediaRepository.layerMemory, storage.layer)),
      );

      yield* Effect.gen(function* () {
        const media = yield* Media;
        const unsupported = yield* media
          .requestUpload(image({ contentType: "application/pdf" }))
          .pipe(asActor("org-a"), Effect.flip);
        expect(unsupported._tag).toBe("UnsupportedMedia");

        const tooLarge = yield* media
          .requestUpload(image({ sizeBytes: MAX_IMAGE_BYTES + 1 }))
          .pipe(asActor("org-a"), Effect.flip);
        expect(tooLarge).toMatchObject({ _tag: "MediaTooLarge", maxBytes: MAX_IMAGE_BYTES });

        const missing = yield* media
          .confirmUpload(MediaId.make("00000000-0000-4000-8000-000000000000"))
          .pipe(asActor("org-a"), Effect.flip);
        expect(missing._tag).toBe("MediaNotFound");
      }).pipe(Effect.provide(layer));
    }),
  );
});
