import { Frame, type Track, initialFrame } from "@projection/presentation/domain";
import {
  Actor,
  CurrentActor,
  OrganizationId,
  type ProjectId,
  type Role,
  UserId,
} from "@projection/shared-kernel";
import { Effect, Layer, Stream, SubscriptionRef } from "effect";

import { BrandingSource, FrameGateway } from "../src/application/ports";

export const asActor = (organizationId: string, role: Role = "operator") =>
  Effect.provideService(
    CurrentActor,
    new Actor({
      userId: UserId.make("user"),
      organizationId: OrganizationId.make(organizationId),
      role,
    }),
  );

/** Passerelle en mémoire, une image par projet et par piste. */
export const FrameGatewayMemory = Layer.effect(
  FrameGateway,
  Effect.sync(() => {
    const refs = new Map<string, SubscriptionRef.SubscriptionRef<Frame>>();
    const refFor = (organizationId: string, projectId: ProjectId, track: Track) =>
      Effect.suspend(() => {
        const key = `${organizationId}:${projectId}:${track}`;
        const existing = refs.get(key);
        if (existing) return Effect.succeed(existing);
        return SubscriptionRef.make(initialFrame).pipe(
          Effect.tap((ref) => Effect.sync(() => refs.set(key, ref))),
        );
      });
    return FrameGateway.of({
      watch: (organizationId, projectId, track) =>
        Stream.unwrap(
          Effect.map(refFor(organizationId, projectId, track), SubscriptionRef.changes),
        ),
      show: (organizationId, projectId, content) =>
        Effect.forEach(
          ["room", "stream"] as const,
          (track) =>
            Effect.flatMap(refFor(organizationId, projectId, track), (ref) =>
              SubscriptionRef.update(
                ref,
                (frame) => new Frame({ ...frame, version: frame.version + 1, content }),
              ),
            ),
          { discard: true },
        ),
    });
  }),
);

export const BrandingSourceMemory = Layer.succeed(
  BrandingSource,
  BrandingSource.of({
    get: (organizationId) => Effect.succeed({ name: `Église ${organizationId}`, logoUrl: null }),
  }),
);
