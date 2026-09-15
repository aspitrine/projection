import { Frame, type Track, initialFrame } from "@projection/presentation/domain";
import { Actor, CurrentActor, OrganizationId, type Role, UserId } from "@projection/shared-kernel";
import { Effect, Layer, Stream, SubscriptionRef } from "effect";

import { FrameGateway } from "../src/application/ports";

export const asActor = (organizationId: string, role: Role = "operator") =>
  Effect.provideService(
    CurrentActor,
    new Actor({
      userId: UserId.make("user"),
      organizationId: OrganizationId.make(organizationId),
      role,
    }),
  );

/** Passerelle en mémoire, une image par organisation et par piste. */
export const FrameGatewayMemory = Layer.effect(
  FrameGateway,
  Effect.sync(() => {
    const refs = new Map<string, SubscriptionRef.SubscriptionRef<Frame>>();
    const refFor = (organizationId: string, track: Track) =>
      Effect.suspend(() => {
        const key = `${organizationId}:${track}`;
        const existing = refs.get(key);
        if (existing) return Effect.succeed(existing);
        return SubscriptionRef.make(initialFrame).pipe(
          Effect.tap((ref) => Effect.sync(() => refs.set(key, ref))),
        );
      });
    return FrameGateway.of({
      watch: (organizationId, track) =>
        Stream.unwrap(Effect.map(refFor(organizationId, track), SubscriptionRef.changes)),
      show: (organizationId, content) =>
        Effect.forEach(
          ["room", "stream"] as const,
          (track) =>
            Effect.flatMap(refFor(organizationId, track), (ref) =>
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
