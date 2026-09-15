import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { fitFontSize } from "../src/domain/Fit";

describe("fitFontSize", () => {
  it("garde la taille maximale quand le contenu tient", () => {
    expect(fitFontSize({ min: 3, max: 11, fits: () => true })).toBe(11);
  });

  it("renvoie la taille minimale quand rien ne tient", () => {
    expect(fitFontSize({ min: 3, max: 11, fits: () => false })).toBe(3);
  });

  it("converge vers le seuil sans le dépasser", () => {
    const size = fitFontSize({ min: 3, max: 11, fits: (candidate) => candidate <= 7.37 });
    expect(size).toBeLessThanOrEqual(7.37);
    expect(size).toBeGreaterThan(7.37 - 0.1);
  });

  it("limite le nombre de mesures (dichotomie)", () => {
    let measures = 0;
    fitFontSize({
      min: 3,
      max: 11,
      fits: (candidate) => {
        measures++;
        return candidate <= 5;
      },
    });
    expect(measures).toBeLessThanOrEqual(10);
  });

  const Threshold = Schema.Number.check(Schema.isBetween({ minimum: 3, maximum: 11 }));

  it.prop(
    "le résultat tient toujours et reste proche du seuil",
    { threshold: Threshold },
    ({ threshold }) => {
      const size = fitFontSize({ min: 3, max: 11, fits: (candidate) => candidate <= threshold });
      expect(size).toBeLessThanOrEqual(threshold);
      expect(threshold - size).toBeLessThanOrEqual(0.1);
    },
  );
});
