import { Actor, CurrentActor, OrganizationId, type Role, UserId } from "@projection/shared-kernel";
import { Effect, Layer, Ref } from "effect";

import { MediaStorage } from "../src/application/ports";

export const asActor = (organizationId: string, role: Role = "operator") =>
  Effect.provideService(
    CurrentActor,
    new Actor({
      userId: UserId.make("user"),
      organizationId: OrganizationId.make(organizationId),
      role,
    }),
  );

/** Stockage en mémoire : URL prévisibles et objets supprimés retenus pour les assertions. */
export const makeMediaStorage = () =>
  Ref.make<ReadonlyArray<string>>([]).pipe(
    Effect.map((removed) => ({
      removed,
      layer: Layer.succeed(
        MediaStorage,
        MediaStorage.of({
          presignUpload: (key, contentType) =>
            Effect.succeed(`https://stockage.test/${key}?upload&type=${contentType}`),
          presignDownload: (key) => Effect.succeed(`https://stockage.test/${key}?lecture`),
          remove: (key) => Ref.update(removed, (keys) => [...keys, key]),
        }),
      ),
    })),
  );
