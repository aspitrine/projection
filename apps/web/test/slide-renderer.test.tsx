// @vitest-environment jsdom
import { describe, expect, it } from "@effect/vitest";
import { SlideTheme, defaultTheme } from "@projection/presentation/domain";
import { parseRichText } from "@projection/slides/domain";
import { cleanup, render } from "@testing-library/react";
import { afterEach } from "vitest";

import { SlideRenderer } from "../src/features/presentation/slide-renderer";

afterEach(cleanup);

describe("SlideRenderer", () => {
  it("affiche des lignes et leur libellé avec le thème par défaut", () => {
    const { container, getByText } = render(
      <SlideRenderer
        slide={{ kind: "lines", lines: ["Gloire à Dieu", "Alléluia"], caption: "Refrain" }}
      />,
    );
    expect(getByText("Gloire à Dieu")).toBeTruthy();
    expect(getByText("Alléluia")).toBeTruthy();
    expect(container.querySelector('[data-slot="slide-caption"]')?.textContent).toBe("Refrain");

    const slide = container.querySelector<HTMLElement>('[data-slot="slide"]');
    expect(slide?.style.background).toBe("rgb(0, 0, 0)");
    expect(slide?.style.containerType).toBe("size");
  });

  it("affiche du texte enrichi", () => {
    const { container } = render(
      <SlideRenderer
        slide={{ kind: "rich", blocks: parseRichText("# Annonces\nCulte à **10 h**") }}
      />,
    );
    expect(container.querySelector("h2")?.textContent).toBe("Annonces");
    expect(container.querySelector("strong")?.textContent).toBe("10 h");
  });

  it("n'affiche rien pour un écran vide", () => {
    const { container } = render(<SlideRenderer slide={{ kind: "blank" }} />);
    expect(container.querySelector('[data-slot="slide-content"]')).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("respecte un thème sans libellé", () => {
    const theme = new SlideTheme({ ...defaultTheme, showCaption: false, background: "#123456" });
    const { container } = render(
      <SlideRenderer
        theme={theme}
        slide={{ kind: "lines", lines: ["Texte"], caption: "Masqué" }}
      />,
    );
    expect(container.querySelector('[data-slot="slide-caption"]')).toBeNull();
    expect(container.querySelector<HTMLElement>('[data-slot="slide"]')?.style.background).toBe(
      "rgb(18, 52, 86)",
    );
  });
});
