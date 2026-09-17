import { describe, expect, it } from "@effect/vitest";

import { brandingFor } from "../src/domain/Output";

const organization = { name: "Église", logoUrl: "https://exemple.org/logo.png" };

describe("brandingFor", () => {
  it("reprend l'identité de l'organisation sans logo choisi", () => {
    expect(brandingFor(organization, undefined, null)).toEqual(organization);
    expect(brandingFor(organization, null, null)).toEqual(organization);
  });

  it("affiche le texte choisi, sans image", () => {
    expect(brandingFor(organization, { _tag: "Text", text: "Bienvenue" }, null)).toEqual({
      name: "Bienvenue",
      logoUrl: null,
    });
  });

  it("affiche l'image choisie, et retombe sur l'organisation si elle a disparu", () => {
    const logo = { _tag: "Image", mediaId: "m1" } as const;
    expect(brandingFor(organization, logo, { url: "https://s3/logo.png", video: false })).toEqual({
      name: "",
      logoUrl: "https://s3/logo.png",
    });
    expect(brandingFor(organization, logo, null)).toEqual(organization);
    expect(brandingFor(organization, logo, { url: "https://s3/clip.mp4", video: true })).toEqual(
      organization,
    );
  });
});
