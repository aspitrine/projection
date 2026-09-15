// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest";
import type { FrameContent } from "@projection/presentation/domain";
import { cleanup, render } from "@testing-library/react";
import { afterEach } from "vitest";

import { FrameView, safeLogoUrl } from "../src/features/display/frame-view";

afterEach(cleanup);

const content: FrameContent = { _tag: "Lines", lines: ["Gloire à Dieu"], caption: null };
const branding = { name: "Église Saint-Test", logoUrl: null };
const slide = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="slide"]');

describe("FrameView", () => {
  it("affiche le contenu sans bouton d'urgence", () => {
    const { getByText } = render(
      <FrameView content={content} cover="none" type="room" branding={branding} />,
    );
    expect(getByText("Gloire à Dieu")).toBeTruthy();
  });

  it("écran noir : noir en salle, transparent sur le stream, sans texte", () => {
    const room = render(
      <FrameView content={content} cover="black" type="room" branding={branding} />,
    );
    expect(slide(room.container)?.style.background).toBe("rgb(0, 0, 0)");
    expect(room.container.textContent).toBe("");
    cleanup();
    const stream = render(
      <FrameView content={content} cover="black" type="stream" branding={branding} />,
    );
    expect(slide(stream.container)?.style.background).toBe("transparent");
  });

  it("texte masqué : fond du thème conservé, pas de texte", () => {
    const { container } = render(
      <FrameView content={content} cover="hideText" type="room" branding={branding} />,
    );
    expect(container.querySelector('[data-slot="slide-content"]')).toBeNull();
    expect(slide(container)?.dataset.cover).toBe("hideText");
  });

  it("logo : nom de l'organisation, ou image si l'URL est sûre", () => {
    const named = render(
      <FrameView content={content} cover="logo" type="room" branding={branding} />,
    );
    expect(named.getByText("Église Saint-Test")).toBeTruthy();
    expect(named.container.querySelector("img")).toBeNull();
    cleanup();

    const withLogo = render(
      <FrameView
        content={content}
        cover="logo"
        type="room"
        branding={{ name: "Église", logoUrl: "https://example.org/logo.png" }}
      />,
    );
    expect(withLogo.container.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.org/logo.png",
    );
  });

  it("n'accepte que les URL de logo http(s) ou relatives", () => {
    expect(safeLogoUrl("https://example.org/a.png")).toBe("https://example.org/a.png");
    expect(safeLogoUrl("/logo.svg")).toBe("/logo.svg");
    expect(safeLogoUrl("javascript:alert(1)")).toBeNull();
    expect(safeLogoUrl("//evil.example/a.png")).toBeNull();
    expect(safeLogoUrl(null)).toBeNull();
  });
});
