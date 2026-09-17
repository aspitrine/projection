// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest";
import { DeckItem, DeckSlide, LiveCursor } from "@projection/live/domain";
import { ProjectId, ProjectItemId } from "@projection/shared-kernel";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import { LiveSlideCards } from "../src/features/live/slide-cards";

// Le rendu thématisé lit les sorties du projet via l'API : hors sujet ici.
vi.mock("../src/features/outputs/output-preview", () => ({ ThemedSlide: () => null }));

afterEach(cleanup);

const itemId = ProjectItemId.make("11111111-1111-4111-8111-111111111111");
const projectId = ProjectId.make("33333333-3333-4333-8333-333333333333");
const otherItemId = ProjectItemId.make("22222222-2222-4222-8222-222222222222");
const item = new DeckItem({
  itemId,
  kind: "Song",
  title: "Chant préparé",
  sourceId: null,
  notes: null,
  missing: false,
  slides: [
    new DeckSlide({
      content: { _tag: "Lines", lines: ["Première"], caption: null },
      label: "Couplet 1",
      sectionId: null,
      parts: [{ _tag: "Lines", lines: ["Première"], caption: null }],
    }),
  ],
});

describe("cartes de diffusion", () => {
  it("ne marque pas en rouge un item seulement préparé", () => {
    render(
      <LiveSlideCards
        projectId={projectId}
        item={item}
        title={item.title}
        live={new LiveCursor({ itemId: otherItemId, slideIndex: 0 })}
        onBroadcast={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Diffuser Chant préparé/ }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("marque en rouge uniquement la diapo réellement diffusée", () => {
    render(
      <LiveSlideCards
        projectId={projectId}
        item={item}
        title={item.title}
        live={new LiveCursor({ itemId, slideIndex: 0 })}
        onBroadcast={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Diffuser Chant préparé/ }).getAttribute("aria-current"),
    ).toBe("true");
  });
});
