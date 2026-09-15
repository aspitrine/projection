import { describe, expect, it } from "@effect/vitest";
import { Actor, CurrentActor, OrganizationId, SongId, UserId } from "@projection/shared-kernel";
import { Effect, Layer } from "effect";

import { SongRepository } from "../src/application/SongRepository";
import { Songs } from "../src/application/Songs";
import { SongInput } from "../src/domain/Song";

const TestLayer = Songs.layer.pipe(Layer.provideMerge(SongRepository.layerMemory));

const actorOf = (organizationId: string) =>
  new Actor({
    userId: UserId.make("user"),
    organizationId: OrganizationId.make(organizationId),
    role: "operator",
  });

const inOrganization = (organizationId: string) =>
  Effect.provideService(CurrentActor, actorOf(organizationId));

const input = (overrides: Partial<SongInput> = {}) =>
  new SongInput({
    title: "Il est bon",
    authors: "  Paul Wilbur ",
    copyright: "",
    ccli: null,
    lyrics: "[Couplet 1]\nIl est bon\n[Refrain]\nAlléluia\n[Refrain]",
    ...overrides,
  });

describe("Songs", () => {
  it.effect("crée un chant dans l'organisation de l'acteur, champs normalisés", () =>
    Effect.gen(function* () {
      const songs = yield* Songs;
      const song = yield* songs.create(input()).pipe(inOrganization("org-a"));

      expect(song.organizationId).toBe("org-a");
      expect(song.authors).toBe("Paul Wilbur");
      expect(song.copyright).toBeNull();
      expect(song.arrangement).toEqual(["verse-1", "chorus", "chorus"]);
      expect(song.createdAt).toBe(song.updatedAt);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("refuse des paroles invalides sans rien enregistrer", () =>
    Effect.gen(function* () {
      const songs = yield* Songs;
      const error = yield* songs
        .create(input({ lyrics: "" }))
        .pipe(inOrganization("org-a"), Effect.flip);
      expect(error._tag).toBe("InvalidLyrics");
      expect(yield* songs.list(null).pipe(inOrganization("org-a"))).toEqual([]);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("isole les chants par organisation", () =>
    Effect.gen(function* () {
      const songs = yield* Songs;
      const song = yield* songs.create(input()).pipe(inOrganization("org-a"));

      expect(yield* songs.list(null).pipe(inOrganization("org-b"))).toEqual([]);
      const notFound = yield* songs.get(song.id).pipe(inOrganization("org-b"), Effect.flip);
      expect(notFound._tag).toBe("SongNotFound");
      const notDeleted = yield* songs.remove(song.id).pipe(inOrganization("org-b"), Effect.flip);
      expect(notDeleted._tag).toBe("SongNotFound");
      expect(yield* songs.get(song.id).pipe(inOrganization("org-a"))).toEqual(song);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("met à jour titre et paroles en conservant la date de création", () =>
    Effect.gen(function* () {
      const songs = yield* Songs;
      const created = yield* songs.create(input()).pipe(inOrganization("org-a"));
      const updated = yield* songs
        .update(created.id, input({ title: "Il est bon de louer", lyrics: "[Refrain]\nGloire" }))
        .pipe(inOrganization("org-a"));

      expect(updated.id).toBe(created.id);
      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.title).toBe("Il est bon de louer");
      expect(updated.arrangement).toEqual(["chorus"]);
      expect(yield* songs.get(created.id).pipe(inOrganization("org-a"))).toEqual(updated);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("recherche par titre sans tenir compte de la casse ni des accents", () =>
    Effect.gen(function* () {
      const songs = yield* Songs;
      yield* songs.create(input({ title: "Écoute mon cœur" })).pipe(inOrganization("org-a"));
      yield* songs.create(input({ title: "Gloire à son nom" })).pipe(inOrganization("org-a"));

      const results = yield* songs.list("ECOUTE").pipe(inOrganization("org-a"));
      expect(results.map((song) => song.title)).toEqual(["Écoute mon cœur"]);
      expect(yield* songs.list("   ").pipe(inOrganization("org-a"))).toHaveLength(2);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("supprime un chant", () =>
    Effect.gen(function* () {
      const songs = yield* Songs;
      const song = yield* songs.create(input()).pipe(inOrganization("org-a"));
      yield* songs.remove(song.id).pipe(inOrganization("org-a"));
      const error = yield* songs.get(song.id).pipe(inOrganization("org-a"), Effect.flip);
      expect(error).toMatchObject({ _tag: "SongNotFound", id: song.id });
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("signale un chant inconnu", () =>
    Effect.gen(function* () {
      const songs = yield* Songs;
      const id = SongId.make("00000000-0000-4000-8000-000000000000");
      const error = yield* songs.update(id, input()).pipe(inOrganization("org-a"), Effect.flip);
      expect(error._tag).toBe("SongNotFound");
    }).pipe(Effect.provide(TestLayer)),
  );
});
