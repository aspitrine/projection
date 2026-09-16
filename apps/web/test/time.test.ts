import { describe, expect, it } from "@effect/vitest";

import { formatDuration } from "../src/features/display/time";

describe("formatDuration", () => {
  it("écrit minutes et secondes, heures si besoin, et le dépassement en négatif", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(59_000)).toBe("0:59");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_600_000)).toBe("1:00:00");
    expect(formatDuration(-1_500)).toBe("-0:02");
    expect(formatDuration(-90_000)).toBe("-1:30");
  });
});
