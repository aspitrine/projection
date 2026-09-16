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

describe("Import de fichiers ChordPro", () => {
  it.effect("crée les chants, ignore les doublons de titre et signale les fichiers en erreur", () =>
    Effect.gen(function* () {
      const songs = yield* Songs;
      yield* songs.create(input()).pipe(inOrganization("org-a"));

      const report = yield* songs
        .importFiles("chordpro", [
          { fileName: "grace.cho", content: "{title: Grâce infinie}\n{soc}\n[G]Alléluia\n{eoc}" },
          { fileName: "doublon.cho", content: "{title: IL EST  bôn}\nLigne" },
          { fileName: "vide.cho", content: "{title: Vide}\n[G] [C]" },
          { fileName: "Sans titre.chordpro", content: "Première ligne\n\nSeconde strophe" },
          { fileName: "grace-bis.cho", content: "{t: Grace infinie}\nAutre version" },
          { fileName: "rejeu.cho", content: "{title: Rejeu}\n[Refrain]" },
        ])
        .pipe(inOrganization("org-a"));

      expect(report.imported.map((entry) => [entry.fileName, entry.title])).toEqual([
        ["grace.cho", "Grâce infinie"],
        ["Sans titre.chordpro", "Sans titre"],
      ]);
      expect(report.duplicates).toEqual([
        { fileName: "doublon.cho", title: "IL EST  bôn" },
        { fileName: "grace-bis.cho", title: "Grace infinie" },
      ]);
      expect(report.errors.map((entry) => entry.fileName)).toEqual(["vide.cho", "rejeu.cho"]);

      const imported = yield* songs.get(report.imported[0]!.id).pipe(inOrganization("org-a"));
      expect(imported.arrangement).toEqual(["chorus"]);

      // Une autre organisation n'a pas ces chants : pas de doublon chez elle.
      const other = yield* songs
        .importFiles("chordpro", [
          { fileName: "doublon.cho", content: "{title: Il est bon}\nLigne" },
        ])
        .pipe(inOrganization("org-b"));
      expect(other.imported).toHaveLength(1);
    }).pipe(Effect.provide(TestLayer)),
  );
});

describe("Recherche de chants", () => {
  it.effect("cherche dans le titre et les paroles, sans casse ni accents, avec extrait", () =>
    Effect.gen(function* () {
      const songs = yield* Songs;
      yield* songs.create(input()).pipe(inOrganization("org-a"));
      yield* songs
        .create(
          input({
            title: "Grâce infinie",
            lyrics: "[Couplet 1]\nQuelle grâce merveilleuse\nElle sauve un pécheur",
          }),
        )
        .pipe(inOrganization("org-a"));

      // Mot présent seulement dans les paroles, écrit sans accent.
      const found = yield* songs.list("pecheur").pipe(inOrganization("org-a"));
      expect(found.map((song) => song.title)).toEqual(["Grâce infinie"]);
      expect(found[0]?.excerpt).toContain("pécheur");

      // Recherche par titre : l'extrait n'est pas obligatoire.
      expect(
        (yield* songs.list("il est").pipe(inOrganization("org-a"))).map((s) => s.title),
      ).toEqual(["Il est bon"]);
      // Sans recherche, pas d'extrait.
      const all = yield* songs.list(null).pipe(inOrganization("org-a"));
      expect(all.every((song) => song.excerpt === null)).toBe(true);
      // Une autre organisation ne voit rien.
      expect(yield* songs.list("pecheur").pipe(inOrganization("org-b"))).toEqual([]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
