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

  it("centre la mise en page « titre » et met le titre en avant", () => {
    const { container } = render(
      <SlideRenderer
        theme={new SlideTheme({ ...defaultTheme, textAlign: "left", verticalAlign: "bottom" })}
        slide={{ kind: "rich", blocks: parseRichText("Bienvenue\n\nAu culte"), layout: "title" }}
      />,
    );
    expect(container.querySelector('[data-slot="slide-heading"]')?.textContent).toBe("Bienvenue");
    const box = container.querySelector<HTMLElement>('[data-slot="slide-content"]')?.parentElement;
    expect(box?.style.textAlign).toBe("center");
    expect(box?.style.justifyContent).toBe("center");
  });

  it("aligne la mise en page « titre + corps » en haut à gauche", () => {
    const { container } = render(
      <SlideRenderer
        slide={{
          kind: "rich",
          blocks: parseRichText("# Ordre du culte\n- Chant"),
          layout: "titleBody",
        }}
      />,
    );
    const box = container.querySelector<HTMLElement>('[data-slot="slide-content"]')?.parentElement;
    expect(box?.style.textAlign).toBe("left");
    expect(box?.style.justifyContent).toBe("flex-start");
  });

  it("pose la référence d'un verset tout en bas, hors du bloc de texte", () => {
    const { container } = render(
      <SlideRenderer slide={{ kind: "lines", lines: ["Car Dieu…"], reference: "Jean 3.16" }} />,
    );
    const reference = container.querySelector('[data-slot="slide-reference"]');
    expect(reference?.textContent).toBe("Jean 3.16");
    expect(
      container.querySelector('[data-slot="slide-content"]')?.contains(reference ?? null),
    ).toBe(false);
  });

  it("place la référence juste sous le texte pour le stream", () => {
    const { container } = render(
      <SlideRenderer
        slide={{ kind: "lines", lines: ["Car Dieu…"], reference: "Jean 3.16" }}
        referencePlacement="below"
      />,
    );
    const content = container.querySelector('[data-slot="slide-content"]');
    expect(content?.lastElementChild?.textContent).toBe("Jean 3.16");
  });

  it("encadre une citation et détache son attribution", () => {
    const { container } = render(
      <SlideRenderer
        slide={{
          kind: "rich",
          blocks: parseRichText("Tout est grâce.\n\n— Bernanos"),
          layout: "quote",
        }}
      />,
    );
    const content = container.querySelector('[data-slot="slide-content"]');
    expect(content?.textContent).toContain("« Tout est grâce. »");
    expect(container.querySelector('[data-slot="slide-attribution"]')?.textContent).toBe(
      "— Bernanos",
    );
  });

  it("dessine le fond du thème et son voile", () => {
    const theme = new SlideTheme({ ...defaultTheme, backgroundDim: 0.4 });
    const { container } = render(
      <SlideRenderer
        theme={theme}
        slide={{ kind: "lines", lines: ["Texte"] }}
        background={{ url: "https://exemple.test/fond.jpg", video: false }}
      />,
    );
    const image = container.querySelector<HTMLImageElement>('img[data-slot="slide-background"]');
    expect(image?.getAttribute("src")).toBe("https://exemple.test/fond.jpg");
    expect(container.querySelector<HTMLElement>('[data-slot="slide-dim"]')?.style.background).toBe(
      "rgba(0, 0, 0, 0.4)",
    );
  });

  it("lit une vidéo de fond en boucle et sans son", () => {
    const { container } = render(
      <SlideRenderer
        slide={{ kind: "lines", lines: ["Texte"] }}
        background={{ url: "https://exemple.test/fond.webm", video: true }}
      />,
    );
    const video = container.querySelector<HTMLVideoElement>('video[data-slot="slide-background"]');
    expect(video?.loop).toBe(true);
    expect(video?.muted).toBe(true);
    expect(container.querySelector('[data-slot="slide-dim"]')).toBeNull();
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

  it("dessine un bandeau derrière le texte (lower third)", () => {
    const theme = new SlideTheme({
      ...defaultTheme,
      background: "transparent",
      textBackground: "rgba(0, 0, 0, 0.5)",
    });
    const { container } = render(
      <SlideRenderer theme={theme} slide={{ kind: "lines", lines: ["Texte"] }} />,
    );
    const content = container.querySelector<HTMLElement>('[data-slot="slide-content"]');
    expect(content?.style.background).toBe("rgba(0, 0, 0, 0.5)");
    expect(content?.style.padding).toBe("0.35em 0.7em");
  });
});
