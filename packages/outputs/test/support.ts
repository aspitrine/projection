import { Frame, type FrameContent, initialFrame } from "@projection/presentation/domain";
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

/** Passerelle en mémoire, une image par organisation. */
export const FrameGatewayMemory = Layer.effect(
  FrameGateway,
  Effect.sync(() => {
    const refs = new Map<string, SubscriptionRef.SubscriptionRef<Frame>>();
    const refFor = (organizationId: string) =>
      Effect.suspend(() => {
        const existing = refs.get(organizationId);
        if (existing) return Effect.succeed(existing);
        return SubscriptionRef.make(initialFrame).pipe(
          Effect.tap((ref) => Effect.sync(() => refs.set(organizationId, ref))),
        );
      });
    return FrameGateway.of({
      watch: (organizationId) =>
        Stream.unwrap(Effect.map(refFor(organizationId), SubscriptionRef.changes)),
      show: (organizationId, content: FrameContent) =>
        Effect.flatMap(refFor(organizationId), (ref) =>
          SubscriptionRef.updateAndGet(
            ref,
            (frame) => new Frame({ ...frame, version: frame.version + 1, content }),
          ),
        ),
    });
  }),
);
