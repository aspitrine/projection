import type { FrameContent } from "@projection/presentation/domain";
import {
  Actor,
  CurrentActor,
  OrganizationId,
  ProjectId,
  ProjectItemId,
  UserId,
} from "@projection/shared-kernel";
import { Effect, Layer } from "effect";

import { DeckSource } from "../src/application/ports";
import { Deck, DeckItem, DeckSlide } from "../src/domain/Deck";
import { LiveProjectNotFound } from "../src/domain/LiveSession";

export const organizationId = OrganizationId.make("org-a");
export const projectId = ProjectId.make("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

export const asActor = (organization = "org-a") =>
  Effect.provideService(
    CurrentActor,
    new Actor({
      userId: UserId.make("user"),
      organizationId: OrganizationId.make(organization),
      role: "operator",
    }),
  );

export const itemId = (index: number) =>
  ProjectItemId.make(`00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`);

const linesOf = (text: string): FrameContent => ({ _tag: "Lines", lines: [text], caption: null });

/**
 * Élément dont chaque diapo affiche `texte` en salle ; avec `parts` > 1, le stream
 * voit les parties `texte.1`, `texte.2`…
 */
export const item = (index: number, texts: ReadonlyArray<string>, parts = 1) =>
  new DeckItem({
    itemId: itemId(index),
    kind: "Song",
    title: `Élément ${index}`,
    notes: null,
    missing: false,
    slides: texts.map(
      (text) =>
        new DeckSlide({
          content: linesOf(text),
          label: text,
          parts:
            parts === 1
              ? [linesOf(text)]
              : Array.from({ length: parts }, (_, part) => linesOf(`${text}.${part + 1}`)),
        }),
    ),
  });

export const deckOf = (items: ReadonlyArray<DeckItem>) =>
  new Deck({ projectId, projectName: "Culte", items });

/** Source de deck modifiable pendant le test (simule l'édition du projet). */
export const makeDeckSource = (initial: Deck | null) => {
  let current = initial;
  return {
    layer: Layer.succeed(
      DeckSource,
      DeckSource.of({
        resolve: (id) =>
          Effect.suspend(() =>
            current !== null && current.projectId === id
              ? Effect.succeed(current)
              : Effect.fail(new LiveProjectNotFound({ projectId: id })),
          ),
      }),
    ),
    set: (deck: Deck | null) => {
      current = deck;
    },
  };
};
