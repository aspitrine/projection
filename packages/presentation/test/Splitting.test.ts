import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { Splitting, roomSplitting, streamSplitting } from "../src/domain/Split";

describe("Splitting", () => {
  const decode = Schema.decodeUnknownOption(Splitting);

  it("accepte les valeurs par défaut et refuse les valeurs hors bornes", () => {
    expect(decode(roomSplitting)._tag).toBe("Some");
    expect(decode(streamSplitting)._tag).toBe("Some");
    expect(decode({ songMaxLines: 0, scriptureMaxCharacters: 140 })._tag).toBe("None");
    expect(decode({ songMaxLines: 2, scriptureMaxCharacters: 10 })._tag).toBe("None");
    expect(decode({ songMaxLines: 2.5, scriptureMaxCharacters: 140 })._tag).toBe("None");
  });
});
