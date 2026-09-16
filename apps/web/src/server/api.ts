import { BibleLive, BibleServiceLive, bibleMigrations } from "@projection/bible/server";
import { layerIdentity } from "@projection/identity/server";
import { ImportsLive } from "@projection/imports/server";
import { MediaLive, MediaServiceLive, mediaMigrations } from "@projection/media/server";
import { LiveFrames, LiveLive, liveMigrations } from "@projection/live/server";
import {
  FrameGateway,
  OutputsLive,
  OutputsServiceLive,
  outputsMigrations,
} from "@projection/outputs/server";
import {
  DatabaseHealth,
  DatabaseLive,
  LoggerLive,
  ObjectStorage,
  SystemHandlersLive,
  layerMigrations,
} from "@projection/platform";
import { ProjectsLive, ProjectsServiceLive, projectsMigrations } from "@projection/projects/server";
import { SlidesLive, TextSlidesServiceLive, slidesMigrations } from "@projection/slides/server";
import { SongsLive, SongsServiceLive, songsMigrations } from "@projection/songs/server";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";

import { ApiRpcs } from "../api/contract";
import { auth, ensureAuthSchema } from "../services";
import { BrandingSourceLive } from "./branding";
import { DeckSourceLive } from "./deck-source";
import { ProjectLibraryLive, SongLibraryLive } from "./imports";
import { MediaStorageLive } from "./media-storage";
import { SongEditingLive } from "./song-editing";

const AuthMigrationsLive = Layer.effectDiscard(
  Effect.promise(ensureAuthSchema).pipe(Effect.withSpan("auth.migrations")),
);

/** Les sorties lisent et publient les images via le contexte live. */
const FrameGatewayLive = Layer.effect(
  FrameGateway,
  Effect.gen(function* () {
    const frames = yield* LiveFrames;
    return FrameGateway.of({ watch: frames.watch, show: frames.show });
  }),
);

const HandlersLive = Layer.mergeAll(
  SystemHandlersLive,
  LiveLive,
  layerIdentity(auth),
  SongsLive,
  BibleLive,
  SlidesLive,
  ProjectsLive,
  OutputsLive,
  MediaLive,
  ImportsLive,
).pipe(
  Layer.provide(DatabaseHealth.layer),
  // La régie résout les projets en diapos via les cas d'usage des autres contextes.
  Layer.provide(
    DeckSourceLive.pipe(
      Layer.provide(
        Layer.mergeAll(
          SongsServiceLive,
          BibleServiceLive,
          TextSlidesServiceLive,
          ProjectsServiceLive,
          OutputsServiceLive,
          MediaServiceLive,
        ),
      ),
    ),
  ),
  Layer.provide(SongEditingLive.pipe(Layer.provide(SongsServiceLive))),
  Layer.provide(
    Layer.mergeAll(
      SongLibraryLive.pipe(Layer.provide(SongsServiceLive)),
      ProjectLibraryLive.pipe(Layer.provide(ProjectsServiceLive)),
    ),
  ),
  Layer.provide(MediaStorageLive.pipe(Layer.provide(ObjectStorage.layerConfig))),
  Layer.provide(FrameGatewayLive),
  Layer.provide(BrandingSourceLive),
  Layer.provide(LiveFrames.layerMemory),
);

const ApiLive = RpcServer.layerHttp({
  group: ApiRpcs,
  path: "/api/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(HandlersLive),
  Layer.provide(RpcSerialization.layerNdjson),
  // Les migrations sont construites avant le serveur RPC.
  Layer.provide(
    Layer.mergeAll(
      AuthMigrationsLive,
      layerMigrations([
        songsMigrations,
        bibleMigrations,
        slidesMigrations,
        projectsMigrations,
        outputsMigrations,
        liveMigrations,
        mediaMigrations,
      ]),
    ),
  ),
  Layer.provide(DatabaseLive),
  Layer.provide(LoggerLive),
);

export const apiHandler = HttpRouter.toWebHandler(ApiLive);

if (import.meta.hot) {
  import.meta.hot.dispose(() => apiHandler.dispose());
}
